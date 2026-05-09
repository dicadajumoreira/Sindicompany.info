import { createAdminClient } from "@/lib/supabase/admin";

export type CarrosselStatus = "rascunho" | "em_producao" | "publicada" | "erro";

export interface Carrossel {
  id: string;
  titulo: string;
  tema: string | null;
  formato: string | null;
  briefing: string | null;
  foto_capa_url: string | null;
  status: CarrosselStatus;
  png_paths: string[] | null;
  legenda: string | null;
  erro_mensagem: string | null;
  gerado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarrosselInput {
  titulo: string;
  tema?: string;
  formato?: string;
  briefing?: string;
  foto_capa_url?: string;
}

const TABLE = "carrosseis";
const BUCKET = "condominios-fotos"; // reaproveita o bucket público

export async function listCarrosseis(): Promise<Carrossel[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Carrossel[];
}

export async function getCarrossel(id: string): Promise<Carrossel | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Carrossel | null;
}

export async function createCarrossel(input: CarrosselInput): Promise<Carrossel> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, status: "rascunho" as CarrosselStatus })
    .select()
    .single();
  if (error) throw error;
  return data as Carrossel;
}

export async function deleteCarrossel(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Upload da foto de capa do carrossel via signed URL. Path fixo
 *  no bucket público condominios-fotos pra reaproveitar a infra. */
export async function createCarrosselFotoUploadIntent(
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const e = ext.toLowerCase().replace(/^\./, "");
  const path = `__carrosseis/foto-${Date.now()}.${e}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}
