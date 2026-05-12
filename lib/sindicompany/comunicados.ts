import { createAdminClient } from "@/lib/supabase/admin";

const TABLE = "comunicados";
const BUCKET = "condominios-fotos"; // reaproveita o bucket publico de fotos

export interface Comunicado {
  id: string;
  condominio: string;
  titulo: string;
  subtitulo: string | null;
  briefing: string | null;
  corpo: string;
  ilustracao_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComunicadoInput {
  condominio: string;
  titulo: string;
  subtitulo?: string | null;
  briefing?: string | null;
  corpo?: string | null;
  ilustracao_path?: string | null;
}

export async function listComunicados(): Promise<Comunicado[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Comunicado[];
}

export async function getComunicado(id: string): Promise<Comunicado | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Comunicado | null;
}

export async function createComunicado(input: ComunicadoInput): Promise<Comunicado> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      condominio: input.condominio,
      titulo: input.titulo,
      subtitulo: input.subtitulo ?? null,
      briefing: input.briefing ?? null,
      corpo: input.corpo ?? "",
      ilustracao_path: input.ilustracao_path ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Comunicado;
}

export async function updateComunicado(
  id: string,
  patch: Partial<ComunicadoInput>,
): Promise<void> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.condominio !== undefined) payload.condominio = patch.condominio;
  if (patch.titulo !== undefined) payload.titulo = patch.titulo;
  if (patch.subtitulo !== undefined) payload.subtitulo = patch.subtitulo ?? null;
  if (patch.briefing !== undefined) payload.briefing = patch.briefing ?? null;
  if (patch.corpo !== undefined) payload.corpo = patch.corpo ?? "";
  if (patch.ilustracao_path !== undefined) payload.ilustracao_path = patch.ilustracao_path ?? null;
  const { error } = await supabase.from(TABLE).update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteComunicado(id: string): Promise<void> {
  const supabase = createAdminClient();
  const c = await getComunicado(id);
  if (c?.ilustracao_path) {
    await supabase.storage.from(BUCKET).remove([c.ilustracao_path]).catch(() => {});
  }
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Sobe a ilustracao do comunicado; retorna o storage path. */
export async function uploadComunicadoIlustracao(
  id: string,
  bytes: Buffer,
  contentType: string,
  ext: string,
): Promise<string> {
  const supabase = createAdminClient();
  const path = `comunicados/${id}-ilustracao-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

export function getComunicadoIlustracaoUrl(path: string): string {
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// --------------------------------------------------------------
// Geracao de texto por IA (a partir de um briefing curto da editora).
// --------------------------------------------------------------

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

const SYSTEM_COMUNICADO = `Voce e o redator de comunicados de condominio da Sindicompany.
Escreve avisos formais, claros e cordiais para os moradores. Regras:
- Comece com a saudacao "Prezados moradores," (ou "Prezados condominos,").
- TAMANHO: o texto sera diagramado em duas artes pequenas (um Story de Instagram
  1080x1920 e uma folha A4). Por isso ele PRECISA ser curto: 3 a 4 paragrafos
  BEM curtos (1 a 3 frases cada), no maximo cerca de 110 a 130 palavras no total.
  Nao ultrapasse esse limite de jeito nenhum, senao o texto e cortado na arte.
  Se o briefing tiver muitos detalhes, resuma e priorize o essencial.
- Separe os paragrafos por uma linha em branco.
- Linguagem objetiva, respeitosa, sem juridiques pesado, sem alarmismo.
- Encerre com uma frase curta pedindo a colaboracao de todos.
- Portugues do Brasil correto, com acentuacao. NUNCA use travessao (—); use virgula ou ponto.
- Nao use emojis, nao use markdown, nao coloque titulo. Responda APENAS o corpo do comunicado em texto puro.`;

export async function gerarTextoComunicado(input: {
  condominio: string;
  titulo: string;
  subtitulo?: string | null;
  briefing: string;
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!apiKey || !apiKey.startsWith("sk-")) {
    return { ok: false, error: "OPENAI_API_KEY ausente ou invalida." };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const orgId = (process.env.OPENAI_ORGANIZATION ?? "").trim();
  if (orgId) headers["OpenAI-Organization"] = orgId;
  const projId = (process.env.OPENAI_PROJECT ?? "").trim();
  if (projId) headers["OpenAI-Project"] = projId;

  const prompt = [
    `Condominio: ${input.condominio}`,
    `Assunto do comunicado: ${input.titulo}${input.subtitulo ? " - " + input.subtitulo : ""}`,
    `O que precisa ser comunicado (briefing da sindicatura):`,
    input.briefing,
    ``,
    `Escreva o corpo do comunicado, curto o suficiente pra caber tanto num Story`,
    `de Instagram quanto numa folha A4 sem cortar (no maximo ~130 palavras).`,
  ].join("\n");

  let res: Response;
  try {
    res = await fetch(OPENAI_API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_COMUNICADO },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 420,
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Falha de rede: ${e.message}` : "Falha de rede." };
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    return { ok: false, error: `OpenAI ${res.status}: ${detail.slice(0, 160)}` };
  }
  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "OpenAI retornou JSON invalido." };
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return { ok: false, error: "OpenAI retornou resposta vazia." };
  // Remove travessoes que o modelo eventualmente insere.
  const limpo = content.replace(/\s*[—–]\s*/g, ", ").replace(/[ \t]+\n/g, "\n").trim();
  return { ok: true, texto: limpo };
}
