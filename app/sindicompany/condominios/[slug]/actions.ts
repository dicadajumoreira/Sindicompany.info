"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { condoFromSlug, slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  upsertCondoMeta,
  uploadCondoFoto,
  uploadCondoLogo,
  type CondoMetaInput,
} from "@/lib/sindicompany/condominios-db";
import type { Genero } from "@/lib/sindicompany/db";
import { describeError } from "@/lib/sindicompany/errors";

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

async function maybeUploadLogo(
  fd: FormData,
  field: string,
  slug: string,
): Promise<string | null> {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.size > MAX_PHOTO_BYTES) {
    backWithError(slug, "Logo maior que 5MB.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    backWithError(slug, "Logo precisa ser JPG, PNG ou WebP.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = EXT_BY_TYPE[file.type];
  try {
    return await uploadCondoLogo(slug, buf, file.type, ext);
  } catch (e) {
    const msg = describeError(e);
    backWithError(slug, `Falha ao subir logo: ${msg}`);
  }
}

function isNextControlError(e: unknown): boolean {
  // redirect() / notFound() do Next throwam um erro com .digest começando com NEXT_
  // Não devemos engolir; precisa rethrow pra Next executar o redirect.
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function salvarCondoMetaAction(formData: FormData): Promise<void> {
  const slug = getStr(formData, "slug");
  try {
    await salvarCondoMetaImpl(formData);
  } catch (e) {
    if (isNextControlError(e)) throw e;
    console.error("[condo-meta] action failed:", e);
    backWithError(slug, `Erro inesperado: ${describeError(e)}`);
  }
}

async function salvarCondoMetaImpl(formData: FormData): Promise<void> {
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

  const sindicoFotoExistente = getStr(formData, "sindico_foto_existente");
  const logoExistente = getStr(formData, "logo_existente");

  const novaFotoSindico = await maybeUploadFoto(formData, "sindico_foto", slug, "sindico");
  const novoLogo = await maybeUploadLogo(formData, "logo_file", slug);

  const input: CondoMetaInput = {
    nome,
    sindico_nome,
    sindico_genero,
    sindico_foto_path: novaFotoSindico ?? sindicoFotoExistente ?? null,
    logo_url: novoLogo ?? logoExistente ?? null,
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
