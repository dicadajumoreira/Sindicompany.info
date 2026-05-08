"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { condoFromSlug, slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  upsertCondoMeta,
  uploadCondoFoto,
  type CondoMetaInput,
} from "@/lib/sindicompany/condominios-db";
import type { Genero } from "@/lib/sindicompany/db";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_BY_TYPE: Record<string, string> = {
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

function backWithError(slug: string, message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/sindicompany/condominios/${slug}?${params.toString()}`);
}

function getStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function getBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(e);
    } catch {
      return "erro desconhecido";
    }
  }
  return "erro desconhecido";
}

async function maybeUploadFoto(
  fd: FormData,
  field: string,
  slug: string,
  role: "sindico" | "gestor",
): Promise<string | null> {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_PHOTO_BYTES) {
    backWithError(slug, `Foto do ${role} maior que 5MB.`);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    backWithError(slug, `Foto do ${role} precisa ser JPG, PNG ou WebP.`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = EXT_BY_TYPE[file.type];
  try {
    return await uploadCondoFoto(slug, role, buf, file.type, ext);
  } catch (e) {
    const msg = describeError(e);
    if (/bucket.*not.*found|not.*found.*bucket/i.test(msg)) {
      backWithError(
        slug,
        "Bucket de fotos não existe. Rode a migration 20260509 no Supabase.",
      );
    }
    backWithError(slug, `Falha ao subir foto do ${role}: ${msg}`);
  }
}

export async function salvarCondoMetaAction(formData: FormData): Promise<void> {
  await requireAuth();

  const slug = getStr(formData, "slug");
  const nome = condoFromSlug(slug);
  if (!nome) {
    redirect("/sindicompany/condominios");
  }

  const sindico_nome = getStr(formData, "sindico_nome");
  const generoRaw = getStr(formData, "sindico_genero");
  const sindico_genero: Genero | undefined =
    generoRaw === "masculino" || generoRaw === "feminino" ? generoRaw : undefined;

  if (!sindico_nome) backWithError(slug, "Informe o nome do(a) síndico(a).");
  if (!sindico_genero) backWithError(slug, "Selecione o gênero do(a) síndico(a).");

  const tem_gestor = getBool(formData, "tem_gestor");
  const gestor_nome = getStr(formData, "gestor_nome");
  if (tem_gestor && !gestor_nome) {
    backWithError(slug, "Marcou que tem gestor — informe o nome.");
  }

  const sindicoFotoExistente = getStr(formData, "sindico_foto_existente");
  const gestorFotoExistente = getStr(formData, "gestor_foto_existente");

  const novaFotoSindico = await maybeUploadFoto(formData, "sindico_foto", slug, "sindico");
  const novaFotoGestor = tem_gestor
    ? await maybeUploadFoto(formData, "gestor_foto", slug, "gestor")
    : null;

  const input: CondoMetaInput = {
    nome,
    sindico_nome,
    sindico_genero,
    sindico_foto_path: novaFotoSindico ?? sindicoFotoExistente ?? null,
    tem_gestor,
    gestor_nome: tem_gestor ? gestor_nome : undefined,
    gestor_foto_path: tem_gestor ? (novaFotoGestor ?? gestorFotoExistente ?? null) : null,
  };

  try {
    await upsertCondoMeta(input);
  } catch (e) {
    const msg = describeError(e);
    if (/relation.*condominios_meta.*does not exist|table.*condominios_meta/i.test(msg)) {
      backWithError(
        slug,
        "Tabela condominios_meta ainda não existe. Rode a migration 20260509 no Supabase.",
      );
    }
    backWithError(slug, `Não foi possível salvar. ${msg}`);
  }

  revalidatePath("/sindicompany/condominios");
  revalidatePath(`/sindicompany/condominios/${slugifyCondo(nome)}`);
  redirect(`/sindicompany/condominios?saved=${slug}`);
}
