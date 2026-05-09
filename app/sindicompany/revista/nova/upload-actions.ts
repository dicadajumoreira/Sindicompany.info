"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  createEventosZipUploadIntent,
  createManutencaoCapaUploadIntent,
  createManutencaoZipUploadIntent,
  createPatternUploadIntent,
  createPrestacaoUploadIntent,
} from "@/lib/sindicompany/condominios-db";

const ALLOWED_PRESTACAO_EXT = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const ALLOWED_IMG_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    throw new Error("unauthorized");
  }
}

interface UploadIntentResult {
  ok: true;
  uploadUrl: string;  // signed PUT URL
  token: string;
  path: string;
  publicUrl: string;
}

interface UploadIntentError {
  ok: false;
  error: string;
}

export async function getPrestacaoUploadIntent(
  condominio: string,
  ext: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_PRESTACAO_EXT.has(e)) {
    return { ok: false, error: "Extensão precisa ser jpg, png, webp ou pdf." };
  }
  if (!condominio) return { ok: false, error: "Condomínio inválido." };
  try {
    const slug = slugifyCondo(condominio);
    const id = `pending-${Date.now()}`;
    const intent = await createPrestacaoUploadIntent(slug, id, e);
    // Constrói a URL completa do PUT a partir do supabase storage URL
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha desconhecida." };
  }
}

export async function getManutencaoZipUploadIntent(
  condominio: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  if (!condominio) return { ok: false, error: "Condomínio inválido." };
  try {
    const slug = slugifyCondo(condominio);
    const id = `pending-${Date.now()}`;
    const intent = await createManutencaoZipUploadIntent(slug, id);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha desconhecida." };
  }
}

export async function getEventosZipUploadIntent(
  condominio: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  if (!condominio) return { ok: false, error: "Condomínio inválido." };
  try {
    const slug = slugifyCondo(condominio);
    const id = `pending-${Date.now()}`;
    const intent = await createEventosZipUploadIntent(slug, id);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha desconhecida." };
  }
}

export async function getManutencaoCapaUploadIntent(
  condominio: string,
  ext: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_IMG_EXT.has(e)) {
    return { ok: false, error: "Capa precisa ser jpg, png ou webp." };
  }
  if (!condominio) return { ok: false, error: "Condomínio inválido." };
  try {
    const slug = slugifyCondo(condominio);
    const id = `pending-${Date.now()}`;
    const intent = await createManutencaoCapaUploadIntent(slug, id, e);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha desconhecida." };
  }
}

export async function getPatternUploadIntent(
  slot: number,
  ext: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessao expirada. Faca login de novo." };
  }
  if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
    return { ok: false, error: "Slot invalido (1 a 10)." };
  }
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_IMG_EXT.has(e)) {
    return { ok: false, error: "Pattern precisa ser jpg, png ou webp." };
  }
  try {
    const intent = await createPatternUploadIntent(slot, e);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha desconhecida." };
  }
}
