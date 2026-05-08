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
  tem_gestor: boolean;
  gestor_nome?: string;
  gestor_foto_path?: string | null;
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
        tem_gestor: input.tem_gestor,
        gestor_nome: input.tem_gestor ? input.gestor_nome ?? null : null,
        gestor_foto_path: input.tem_gestor ? input.gestor_foto_path ?? null : null,
      },
      { onConflict: "nome" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as CondoMeta;
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
