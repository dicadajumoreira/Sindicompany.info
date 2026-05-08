"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { isCondominioValido, slugifyCondo } from "@/lib/sindicompany/condominios";
import { getCondoMeta, uploadGestorFotoRevista } from "@/lib/sindicompany/condominios-db";
import { createRevista, type RevistaInput } from "@/lib/sindicompany/db";
import { getEditorial, editorialEstaPronto } from "@/lib/sindicompany/editoriais";
import { dispatchGenerateRevista } from "@/lib/sindicompany/engine";
import { describeError, detectMigrationMissing } from "@/lib/sindicompany/errors";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

function backToFormWithError(message: string, fields: FormData): never {
  const params = new URLSearchParams({ error: message });
  // Preserva os valores que ela já tinha digitado pra ela não perder no erro
  for (const [k, v] of fields.entries()) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  redirect(`/sindicompany/revista/nova?${params.toString()}`);
}

function isValidDriveUrl(url: string): boolean {
  if (!url) return true; // opcional
  return /^https?:\/\/(drive|docs)\.google\.com\//.test(url);
}

function getStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function getBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export async function novaRevistaAction(formData: FormData): Promise<void> {
  await requireAuth();

  const condominio = getStr(formData, "condominio");
  const mesRaw = getStr(formData, "mes");
  const anoRaw = getStr(formData, "ano");

  if (!condominio || !isCondominioValido(condominio)) {
    backToFormWithError("Condomínio inválido.", formData);
  }

  const mes = Number.parseInt(mesRaw, 10);
  const ano = Number.parseInt(anoRaw, 10);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    backToFormWithError("Mês inválido.", formData);
  }
  if (!Number.isInteger(ano) || ano < 2025 || ano > 2030) {
    backToFormWithError("Ano inválido.", formData);
  }

  // Liderança vem do cadastro do condomínio (condominios_meta).
  const meta = await getCondoMeta(condominio).catch(() => null);
  if (!meta || !meta.sindico_nome || !meta.sindico_genero) {
    backToFormWithError(
      `Cadastre o(a) síndico(a) de "${condominio}" antes de gerar a revista. ` +
        `Vá em Condomínios → ${condominio}.`,
      formData,
    );
  }
  const sindico_nome = meta.sindico_nome;
  const sindico_genero = meta.sindico_genero;

  // Gestor agora é por edição (vem do form, não do cadastro do condo).
  const tem_gestor = getBool(formData, "tem_gestor");
  const gestor_nome = getStr(formData, "gestor_nome");
  if (tem_gestor && !gestor_nome) {
    backToFormWithError(
      "Marcou que tem gestor — informe o nome.",
      formData,
    );
  }

  const drive_manutencao_url = getStr(formData, "drive_manutencao_url");
  const drive_prestacao_url = getStr(formData, "drive_prestacao_url");
  if (drive_manutencao_url && !isValidDriveUrl(drive_manutencao_url)) {
    backToFormWithError("Link de manutenção precisa ser uma URL do Google Drive.", formData);
  }
  if (drive_prestacao_url && !isValidDriveUrl(drive_prestacao_url)) {
    backToFormWithError("Link de prestação precisa ser uma URL do Google Drive.", formData);
  }

  const tem_advertencias = getBool(formData, "tem_advertencias");
  const multas_advertencias_obs = getStr(formData, "multas_advertencias_obs");

  const tem_eventos = getBool(formData, "tem_eventos");
  const drive_eventos_url = getStr(formData, "drive_eventos_url");
  if (tem_eventos && drive_eventos_url && !isValidDriveUrl(drive_eventos_url)) {
    backToFormWithError("Link de eventos precisa ser do Google Drive.", formData);
  }

  const notas_editor = getStr(formData, "notas_editor");
  const carta_sindico_texto = getStr(formData, "carta_sindico_texto");
  const carta_gestor_texto = getStr(formData, "carta_gestor_texto");

  // Editorial mensal precisa estar pronto antes de gerar revista.
  const editorial = await getEditorial(mes, ano).catch(() => null);
  if (!editorialEstaPronto(editorial)) {
    const slug = `${String(mes).padStart(2, "0")}-${ano}`;
    backToFormWithError(
      `Editorial de ${mesRaw}/${anoRaw} ainda não está pronto. ` +
        `Defina matéria de capa e receita em Editorial mensal (/sindicompany/editorial/${slug}).`,
      formData,
    );
  }

  // Foto do gestor: novo upload sobrescreve, senão mantém a existente
  // (caso ela tenha duplicado uma edição anterior).
  let gestor_foto_url: string | undefined = getStr(formData, "gestor_foto_existente") || undefined;
  if (tem_gestor) {
    const file = formData.get("gestor_foto_file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PHOTO_BYTES) {
        backToFormWithError("Foto do gestor maior que 5MB.", formData);
      }
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        backToFormWithError("Foto do gestor precisa ser JPG, PNG ou WebP.", formData);
      }
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const ext = PHOTO_EXT_BY_TYPE[file.type];
        // Upload com placeholder de id; vamos atualizar com o id real após criar
        gestor_foto_url = await uploadGestorFotoRevista(
          slugifyCondo(condominio),
          `pending-${Date.now()}`,
          buf,
          file.type,
          ext,
        );
      } catch (e) {
        backToFormWithError(`Falha ao subir foto do gestor: ${describeError(e)}`, formData);
      }
    }
  } else {
    gestor_foto_url = undefined;
  }

  const input: RevistaInput = {
    condominio,
    mes,
    ano,
    sindico_nome,
    sindico_genero,
    tem_gestor,
    gestor_nome: tem_gestor ? gestor_nome : undefined,
    gestor_foto_url: tem_gestor ? gestor_foto_url : undefined,
    drive_manutencao_url: drive_manutencao_url || undefined,
    drive_prestacao_url: drive_prestacao_url || undefined,
    tem_advertencias,
    multas_advertencias_obs: tem_advertencias ? multas_advertencias_obs : undefined,
    tem_eventos,
    drive_eventos_url: tem_eventos ? drive_eventos_url || undefined : undefined,
    notas_editor: notas_editor || undefined,
    carta_sindico_texto: carta_sindico_texto || undefined,
    // Carta do gestor só salva se o condo tem gestor cadastrado
    carta_gestor_texto: tem_gestor ? carta_gestor_texto || undefined : undefined,
  };

  let revista;
  try {
    revista = await createRevista(input);
  } catch (e) {
    console.error("[revista] createRevista failed:", e);
    const msg = describeError(e);
    if (msg.toLowerCase().includes("duplicate")) {
      backToFormWithError("Já existe uma revista para esse condomínio nesse mês.", formData);
    }
    const migrationHint = detectMigrationMissing(msg);
    backToFormWithError(
      migrationHint ? migrationHint : `Não foi possível criar a edição. ${msg}`,
      formData,
    );
  }

  // Dispara a engine via GitHub Actions (fire-and-forget). Se falhar
  // ou demorar demais, a editora pode subir o PDF manualmente na página
  // da revista como fallback.
  await dispatchGenerateRevista(revista.id);

  revalidatePath("/sindicompany/dashboard");
  redirect(`/sindicompany/revista/${revista.id}`);
}
