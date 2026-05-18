import { createAdminClient } from "@/lib/supabase/admin";

export type CarrosselStatus = "rascunho" | "em_producao" | "publicada" | "erro";

export interface CarrosselSlide {
  tipo: string;
  titulo: string;
  body: string;
}

export interface CarrosselCopy {
  slides: CarrosselSlide[];
  legenda: string;
}

export type CarrosselBrand = "sindicompanybr" | "bysindicompany" | "consvictabr";

export const CARROSSEL_BRANDS: { id: CarrosselBrand; handle: string; label: string }[] = [
  { id: "sindicompanybr", handle: "@sindicompanybr", label: "Sindicompany" },
  { id: "bysindicompany", handle: "@bysindicompany", label: "BySindicompany" },
  { id: "consvictabr", handle: "@consvictabr", label: "Consvicta" },
];

// Arquetipos de capa do Brand Hub Sindicompany 2026-05-17. Espelha o
// registry COVER_ARCHETYPES_SC do revista-engine/api/carrossel_generate.py.
// hasPhoto indica se o arquetipo consome a foto da etapa 3 do
// /sindicompany/carrossel/novo. Aplica so a sindicompanybr +
// bysindicompany — Consvicta sempre usa a capa propria.
export type CarrosselCoverArchetype =
  | "editorial-question"
  | "stat-slap"
  | "numbered-guide"
  | "manifesto"
  | "pattern-explosion"
  | "pull-quote"
  | "headline-only"
  | "glow-hero"
  | "versus"
  | "sticky-note"
  | "mythbuster"
  | "brackets"
  | "dark-premium"
  | "magazine-cover"
  | "split-portrait"
  | "hero-portrait"
  | "avatar-quote"
  | "photo-circle"
  | "photo-banner"
  | "floating-card"
  | "photo-blur"
  | "cinema";

export const CARROSSEL_COVER_ARCHETYPES: {
  id: CarrosselCoverArchetype;
  label: string;
  hasPhoto: boolean;
  hint: string;
}[] = [
  // SEM foto
  { id: "editorial-question", label: "Editorial Question", hasPhoto: false, hint: "Pergunta italic Purple + Navy sobre Paper" },
  { id: "stat-slap", label: "Stat slap", hasPhoto: false, hint: "Número gigante sobre fundo Beige" },
  { id: "numbered-guide", label: "Numbered guide", hasPhoto: false, hint: "Split número Navy / headline" },
  { id: "manifesto", label: "Manifesto", hasPhoto: false, hint: "Italic gigante sobre fundo Cyan" },
  { id: "pattern-explosion", label: "Pattern explosion", hasPhoto: false, hint: "Pattern topo + card Paper na base" },
  { id: "pull-quote", label: "Pull quote", hasPhoto: false, hint: "Aspas Beige gigantes + citação italic" },
  { id: "headline-only", label: "Headline-only", hasPhoto: false, hint: "Headline gigante sobre Beige" },
  { id: "glow-hero", label: "Glow hero", hasPhoto: false, hint: "Símbolo + glows duplos sobre Navy" },
  { id: "versus", label: "Versus", hasPhoto: false, hint: 'Errado vs Certo (body no formato "errado | certo")' },
  { id: "sticky-note", label: "Sticky note", hasPhoto: false, hint: "Card Beige tipo post-it rotacionado" },
  { id: "mythbuster", label: "Mito × Verdade", hasPhoto: false, hint: 'Mito + Verdade com labels (body "mito | verdade")' },
  { id: "brackets", label: "Brackets", hasPhoto: false, hint: "Colchetes Beige gigantes envolvendo headline" },
  // COM foto (etapa 3)
  { id: "dark-premium", label: "Dark Premium", hasPhoto: true, hint: "Foto full + gradient Navy" },
  { id: "magazine-cover", label: "Magazine cover", hasPhoto: true, hint: "Masthead + foto + faixa Paper" },
  { id: "split-portrait", label: "Split portrait", hasPhoto: true, hint: "Foto 45% esquerda + texto 55% Paper" },
  { id: "hero-portrait", label: "Hero portrait", hasPhoto: true, hint: "Foto full + tag mono + box Beige" },
  { id: "avatar-quote", label: "Avatar quote", hasPhoto: true, hint: "Avatar circular + citação italic" },
  { id: "photo-circle", label: "Foto circular", hasPhoto: true, hint: "Círculo gigante TR + texto BL" },
  { id: "photo-banner", label: "Photo banner", hasPhoto: true, hint: "Foto top 60% + Paper bottom com headline" },
  { id: "floating-card", label: "Floating card", hasPhoto: true, hint: "Foto em card centralizado sobre Navy" },
  { id: "photo-blur", label: "Photo blur", hasPhoto: true, hint: "Foto desfocada como background + headline crisp" },
  { id: "cinema", label: "Cinema", hasPhoto: true, hint: "Foto em faixa cinemascope central + headline acima" },
];

const COVER_ARCHETYPE_IDS = new Set(CARROSSEL_COVER_ARCHETYPES.map((a) => a.id));

export function isValidCoverArchetype(s: string): s is CarrosselCoverArchetype {
  return COVER_ARCHETYPE_IDS.has(s as CarrosselCoverArchetype);
}

export interface Carrossel {
  id: string;
  brand: CarrosselBrand;
  objetivo: string | null;
  titulo: string;
  tema: string | null;
  formato: string | null;
  briefing: string | null;
  foto_capa_url: string | null;
  cover_archetype: CarrosselCoverArchetype | null;
  n_slides: number;
  status: CarrosselStatus;
  png_paths: string[] | null;
  zip_url: string | null;
  slide_fotos: string[] | null;
  legenda: string | null;
  erro_mensagem: string | null;
  gerado_em: string | null;
  copy_options: CarrosselCopy[] | null;
  copy_selected: number | null;
  created_at: string;
  updated_at: string;
}

export interface CarrosselInput {
  brand?: CarrosselBrand;
  objetivo?: string;
  titulo: string;
  tema?: string;
  formato?: string;
  briefing?: string;
  foto_capa_url?: string;
  cover_archetype?: CarrosselCoverArchetype;
  n_slides?: number;
}

export async function updateCarrossel(
  id: string,
  patch: Partial<{
    foto_capa_url: string;
    copy_options: CarrosselCopy[];
    copy_selected: number | null;
    slide_fotos: (string | null)[];
    status: CarrosselStatus;
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id);
  if (error) throw error;
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
    .insert({
      ...input,
      brand: input.brand ?? "sindicompanybr",
      status: "rascunho" as CarrosselStatus,
    })
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

/** Sobe bytes (de uma imagem gerada por IA, por exemplo) direto pro
 *  bucket via service role e devolve a URL pública. */
export async function uploadCarrosselFotoBytes(
  bytes: Buffer,
  contentType = "image/png",
): Promise<string> {
  const path = `__carrosseis/ai-${Date.now()}.png`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
