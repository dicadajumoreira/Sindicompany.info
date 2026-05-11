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
  /** Logo do(a) sindico(a) — default usado na capa/contracapa da revista. */
  logo_url: string | null;
  /** Logotipo oficial do condominio — opcional, nao substitui o do sindico. */
  logo_condominio_url: string | null;
  // Gestor de Atendimento — cadastrado aqui (nao mais por edicao). O
  // titulo sai do genero: 'Gestor de Atendimento' / 'Gestora de Atendimento'.
  tem_gestor: boolean;
  gestor_nome: string | null;
  gestor_genero: Genero | null;
  gestor_foto_path: string | null;
  updated_at: string;
}

export interface CondoMetaInput {
  nome: string;
  sindico_nome?: string;
  sindico_genero?: Genero;
  sindico_foto_path?: string | null;
  logo_url?: string | null;
  logo_condominio_url?: string | null;
  gestor_nome?: string | null;
  gestor_genero?: Genero | null;
  gestor_foto_path?: string | null;
}

/** Titulo do gestor conforme o genero. */
export function gestorTitulo(genero: Genero | null | undefined): string {
  return genero === "feminino" ? "Gestora de Atendimento" : "Gestor de Atendimento";
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
  const base = {
    nome: input.nome,
    sindico_nome: input.sindico_nome ?? null,
    sindico_genero: input.sindico_genero ?? null,
    sindico_foto_path: input.sindico_foto_path ?? null,
    logo_url: input.logo_url ?? null,
    logo_condominio_url: input.logo_condominio_url ?? null,
    gestor_nome: input.gestor_nome ?? null,
    gestor_foto_path: input.gestor_foto_path ?? null,
    tem_gestor: !!(input.gestor_nome && input.gestor_nome.trim()),
  };
  const full = { ...base, gestor_genero: input.gestor_genero ?? null };

  let res = await supabase
    .from(TABLE)
    .upsert(full, { onConflict: "nome" })
    .select()
    .single();

  // gestor_genero eh coluna nova (migration 20260528). Se ainda nao foi
  // rodada, o upsert falha com PGRST204 — refaz sem ela.
  if (res.error && /gestor_genero|PGRST204/.test(res.error.message ?? "")) {
    res = await supabase
      .from(TABLE)
      .upsert(base, { onConflict: "nome" })
      .select()
      .single();
  }
  if (res.error) throw res.error;
  return res.data as CondoMeta;
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

/** Padrões geométricos globais (não são por condomínio) que vão como
 *  fundo sutil em todas as páginas da revista. Até 20 slots fixos
 *  __patterns/pattern-{1..20}.png no bucket público. */
export async function createPatternUploadIntent(
  slot: number,
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const e = ext.toLowerCase().replace(/^\./, "");
  const path = `__patterns/pattern-${slot}.${e}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Lista as URLs públicas dos patterns já subidos (slots 1..MAX). */
export const PATTERN_MAX_SLOTS = 20;

export async function listPatternUrls(): Promise<(string | null)[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("__patterns", { limit: 100 });
  if (error || !data) return Array(PATTERN_MAX_SLOTS).fill(null);
  const bySlot: (string | null)[] = Array(PATTERN_MAX_SLOTS).fill(null);
  for (const obj of data) {
    const m = obj.name.match(/^pattern-(\d{1,2})\.(png|jpg|jpeg|webp|svg)$/i);
    if (!m) continue;
    const slot = parseInt(m[1], 10);
    if (slot < 1 || slot > PATTERN_MAX_SLOTS) continue;
    const { data: pub } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`__patterns/${obj.name}`);
    bySlot[slot - 1] = `${pub.publicUrl}?v=${obj.updated_at ?? obj.created_at ?? Date.now()}`;
  }
  return bySlot;
}

// =============================================================================
// Assets globais — Icons e Logos
// Mesma logica de Patterns: slots fixos no bucket publico, prefix
// proprio (__icons / __logos), util pra reaproveitar nos slides.
// =============================================================================

export const ICON_MAX_SLOTS = 20;
export const ICON_CARROSSEL_MAX_SLOTS = 20;
export const LOGO_MAX_SLOTS = 10;

async function _createSlotUploadIntent(
  prefix: string,
  basename: string,
  slot: number,
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const e = ext.toLowerCase().replace(/^\./, "");
  const path = `${prefix}/${basename}-${slot}.${e}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

async function _listSlotUrls(
  prefix: string,
  basename: string,
  max: number,
): Promise<(string | null)[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 100 });
  if (error || !data) return Array(max).fill(null);
  const bySlot: (string | null)[] = Array(max).fill(null);
  const re = new RegExp(`^${basename}-(\\d{1,2})\\.(png|jpg|jpeg|webp|svg)$`, "i");
  for (const obj of data) {
    const m = obj.name.match(re);
    if (!m) continue;
    const slot = parseInt(m[1], 10);
    if (slot < 1 || slot > max) continue;
    const { data: pub } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(`${prefix}/${obj.name}`);
    bySlot[slot - 1] = `${pub.publicUrl}?v=${obj.updated_at ?? obj.created_at ?? Date.now()}`;
  }
  return bySlot;
}

export function createIconUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__icons", "icon", slot, ext);
}
export function listIconUrls() {
  return _listSlotUrls("__icons", "icon", ICON_MAX_SLOTS);
}

export function createIconCarrosselUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__icon-carrossel", "icon", slot, ext);
}
export function listIconCarrosselUrls() {
  return _listSlotUrls("__icon-carrossel", "icon", ICON_CARROSSEL_MAX_SLOTS);
}

export function createLogoUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__logos", "logo", slot, ext);
}
export function listLogoUrls() {
  return _listSlotUrls("__logos", "logo", LOGO_MAX_SLOTS);
}

// =============================================================================
// Assets BySindicompany — buckets __by-patterns / __by-icons /
// __by-icon-carrossel / __by-logos. Conectados aos carrosseis da
// marca 'bysindicompany' (a engine usa o prefixo __by- quando o
// carrossel.brand for bysindicompany).
// =============================================================================

export function createByPatternUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__by-patterns", "pattern", slot, ext);
}
export function listByPatternUrls() {
  return _listSlotUrls("__by-patterns", "pattern", PATTERN_MAX_SLOTS);
}

export function createByIconUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__by-icons", "icon", slot, ext);
}
export function listByIconUrls() {
  return _listSlotUrls("__by-icons", "icon", ICON_MAX_SLOTS);
}

export function createByIconCarrosselUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__by-icon-carrossel", "icon", slot, ext);
}
export function listByIconCarrosselUrls() {
  return _listSlotUrls("__by-icon-carrossel", "icon", ICON_CARROSSEL_MAX_SLOTS);
}

export function createByLogoUploadIntent(slot: number, ext: string) {
  return _createSlotUploadIntent("__by-logos", "logo", slot, ext);
}
export function listByLogoUrls() {
  return _listSlotUrls("__by-logos", "logo", LOGO_MAX_SLOTS);
}

/** Copia todos os arquivos dos buckets de assets do @sindicompanybr
 *  (__patterns, __icons, __icon-carrossel, __logos) pros equivalentes
 *  do @bysindicompany (__by-*). Sobrescreve o que ja existir no destino.
 *  Devolve resumo por prefixo. Operacao idempotente. */
export async function copyAssetsToByBrand(): Promise<
  { ok: true; copied: Record<string, number> } | { ok: false; error: string }
> {
  const supabase = createAdminClient();
  const pairs: [string, string][] = [
    ["__patterns", "__by-patterns"],
    ["__icons", "__by-icons"],
    ["__icon-carrossel", "__by-icon-carrossel"],
    ["__logos", "__by-logos"],
  ];
  const copied: Record<string, number> = {};
  try {
    for (const [src, dst] of pairs) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(src, { limit: 200 });
      if (error) throw error;
      let n = 0;
      for (const obj of data ?? []) {
        // pula "pastas" e arquivos sem nome
        if (!obj.name || obj.name.endsWith("/")) continue;
        const { error: cpErr } = await supabase.storage
          .from(BUCKET)
          .copy(`${src}/${obj.name}`, `${dst}/${obj.name}`);
        // copy nao tem upsert; se ja existir, remove e copia de novo
        if (cpErr) {
          await supabase.storage.from(BUCKET).remove([`${dst}/${obj.name}`]);
          const { error: cpErr2 } = await supabase.storage
            .from(BUCKET)
            .copy(`${src}/${obj.name}`, `${dst}/${obj.name}`);
          if (cpErr2) throw cpErr2;
        }
        n++;
      }
      copied[src] = n;
    }
    return { ok: true, copied };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha desconhecida.",
    };
  }
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

/** Sobe logotipo (do sindico ou do condominio) e retorna URL pública.
 *  O `kind` vai pro nome do arquivo pra ficar facil identificar visualmente
 *  no Storage. Default 'sindico' pra compatibilidade com chamadas antigas. */
export async function uploadCondoLogo(
  slug: string,
  bytes: Buffer,
  contentType: string,
  ext: string,
  kind: "sindico" | "condominio" = "sindico",
): Promise<string> {
  const path = `${slug}/logo-${kind}-${Date.now()}.${ext}`;
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
