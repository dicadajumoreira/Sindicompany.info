"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  parseMesAno,
  upsertEditorial,
  type EditorialInput,
} from "@/lib/sindicompany/editoriais";
import { describeError, detectMigrationMissing } from "@/lib/sindicompany/errors";

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

function backWithError(slug: string, message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/sindicompany/editorial/${slug}?${params.toString()}`);
}

function getStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function isValidImageUrl(url: string): boolean {
  if (!url) return true;
  return /^https?:\/\//.test(url);
}

export async function salvarEditorialAction(formData: FormData): Promise<void> {
  await requireAuth();

  const slug = getStr(formData, "slug");
  const parsed = parseMesAno(slug);
  if (!parsed) {
    redirect("/sindicompany/editorial");
  }

  const foto_capa_url = getStr(formData, "foto_capa_url");
  if (foto_capa_url && !isValidImageUrl(foto_capa_url)) {
    backWithError(slug, "Foto de capa precisa ser uma URL válida (http/https).");
  }

  const input: EditorialInput = {
    mes: parsed.mes,
    ano: parsed.ano,
    materia_capa_titulo: getStr(formData, "materia_capa_titulo") || undefined,
    materia_capa_subtitulo: getStr(formData, "materia_capa_subtitulo") || undefined,
    foto_capa_url: foto_capa_url || undefined,
    receita_titulo: getStr(formData, "receita_titulo") || undefined,
    receita_descricao: getStr(formData, "receita_descricao") || undefined,
    carta_sindico_tema: getStr(formData, "carta_sindico_tema") || undefined,
    carta_gestor_tema: getStr(formData, "carta_gestor_tema") || undefined,
    notas_editor_geral: getStr(formData, "notas_editor_geral") || undefined,
  };

  try {
    await upsertEditorial(input);
  } catch (e) {
    console.error("[editorial] upsert failed:", e);
    const msg = describeError(e);
    const hint = detectMigrationMissing(msg);
    backWithError(slug, hint ?? `Não foi possível salvar. ${msg}`);
  }

  revalidatePath("/sindicompany/editorial");
  revalidatePath(`/sindicompany/editorial/${slug}`);
  redirect(`/sindicompany/editorial?saved=${slug}`);
}
