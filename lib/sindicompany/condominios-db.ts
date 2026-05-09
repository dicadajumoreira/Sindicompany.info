/**
 * Metadados estáveis de cada condomínio (síndico, gestor, fotos).
 * Diferente de `db.ts` (que mexe nas revistas), aqui é a info que
 * a engine reaproveita em todas as edições.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Genero } from "./db";

const TABLE = "condominios_meta";
const BUCKET = "condominios-fotos";

export interface CondoMeta {
  nome: string;
  sindico_nome: string | null;
  sindico_genero: Genero | null;
  sindico_foto_path: string | null;
  logo_url: string | null;
  // Campos de gestor abaixo são deprecated em condo_meta — moved to revistas.
  // Mantidos no schema só pra não quebrar dados antigos.
  tem_gestor: boolean;
  gestor_nome: string | null;
  gestor_foto_path: string | null;
  updated_at: string;
}

export interface CondoMetaInput {
  nome: string;
  sindico_nome?: string;
  sindico_genero?: Genero;
  sindico_foto_path?: string | null;
  logo_url?: string | null;
}

export async function getCondoMeta(nome: string): Promise<CondoMeta | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("nome", nome)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CondoMeta | null;
}

export async function listCondoMetas(): Promise<CondoMeta[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) throw error;
  return (data ?? []) as CondoMeta[];
}

export async function upsertCondoMeta(input: CondoMetaInput): Promise<CondoMeta> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        nome: input.nome,
        sindico_nome: input.sindico_nome ?? null,
        sindico_genero: input.sindico_genero ?? null,
        sindico_foto_path: input.sindico_foto_path ?? null,
        logo_url: input.logo_url ?? null,
      },
      { onConflict: "nome" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CondoMeta;
}

/** Sobe foto do gestor (atrelada a uma revista específica) e retorna URL pública. */
export async function uploadGestorFotoRevista(
  condoSlug: string,
  revistaId: string,
  bytes: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${condoSlug}/gestor-${revistaId}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Cria um signed upload URL pra que o navegador suba direto pro Storage,
 *  sem passar pela Server Action (Vercel limita request body a 4.5–50MB).
 *  Retorna o token + path + URL pública final que o form vai persistir. */
export async function createPrestacaoUploadIntent(
  condoSlug: string,
  revistaId: string,
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const path = `${condoSlug}/prestacao-${revistaId}.${ext}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Mesma ideia pro ZIP de manutenção (arquivo grande, 100MB+). */
export async function createManutencaoZipUploadIntent(
  condoSlug: string,
  revistaId: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const path = `${condoSlug}/manutencao-${revistaId}.zip`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Capa manual da seção 'Nosso Condomínio' (S08). Aceita imagem (JPG/PNG/WebP). */
export async function createManutencaoCapaUploadIntent(
  condoSlug: string,
  revistaId: string,
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const path = `${condoSlug}/manutencao-capa-${revistaId}.${ext}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Mesma ideia pro ZIP de eventos. */
export async function createEventosZipUploadIntent(
  condoSlug: string,
  revistaId: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const path = `${condoSlug}/eventos-${revistaId}.zip`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Sobe o arquivo de prestação de contas (imagem ou PDF) atrelado a
 *  uma revista específica. Mantido para fluxos que ainda usam upload
 *  via Server Action (testes locais e arquivos pequenos). O fluxo
 *  preferido é o cliente direto via createPrestacaoUploadIntent. */
export async function uploadPrestacaoArquivo(
  condoSlug: string,
  revistaId: string,
  bytes: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${condoSlug}/prestacao-${revistaId}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Sobe o ZIP de fotos de manutenção atrelado a uma revista. O ZIP
 *  contém subpastas (cada uma = card de manutenção) com fotos dentro.
 *  A engine baixa, descompacta e usa os nomes das pastas como títulos. */
export async function uploadManutencaoZip(
  condoSlug: string,
  revistaId: string,
  bytes: Buffer,
): Promise<string> {
  const path = `${condoSlug}/manutencao-${revistaId}.zip`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/zip", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Sobe logotipo do condomínio e retorna URL pública. */
export async function uploadCondoLogo(
  slug: string,
  bytes: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${slug}/logo-${Date.now()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Sobe foto e retorna o storage path. */
export async function uploadCondoFoto(
  slug: string,
  role: "sindico" | "gestor",
  bytes: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${slug}/${role}-${Date.now()}.${ext}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/** URL pública da foto (bucket é público). */
export function getCondoFotoPublicUrl(path: string): string {
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteCondoFoto(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([path]);
}
