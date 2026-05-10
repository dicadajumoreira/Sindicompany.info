/**
 * Cliente leve da OpenAI Chat Completions API pra geração de copy
 * de carrossel Instagram. Sem dependência externa — fetch direto.
 */

import type { CarrosselCopy } from "./carrosseis";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

interface ChatOk {
  ok: true;
  content: string;
}
interface ChatErr {
  ok: false;
  error: string;
}

async function chat(prompt: string): Promise<ChatOk | ChatErr> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
  if (!apiKey || !apiKey.startsWith("sk-")) {
    return { ok: false, error: "OPENAI_API_KEY ausente ou inválida." };
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  const orgId = (process.env.OPENAI_ORGANIZATION ?? "").trim();
  if (orgId) headers["OpenAI-Organization"] = orgId;
  const projId = (process.env.OPENAI_PROJECT ?? "").trim();
  if (projId) headers["OpenAI-Project"] = projId;

  let res: Response;
  try {
    res = await fetch(OPENAI_API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é editor de conteúdo da Sindicompany para Instagram. Tom alegre, amigável, objetivo. Português brasileiro com acentos corretos. Sem travessão. Frases curtas.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.85,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `Falha de rede: ${e.message}` : "Falha de rede.",
    };
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
    return { ok: false, error: "OpenAI retornou JSON inválido." };
  }
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return { ok: false, error: "OpenAI retornou resposta vazia." };
  return { ok: true, content };
}

/** Gera 3 versões de copy pra carrossel — angulos editoriais distintos. */
export async function gerarTresCopies(input: {
  titulo: string;
  tema: string;
  formato: string;
  n_slides: number;
  briefing?: string;
}): Promise<{ ok: true; copies: CarrosselCopy[] } | { ok: false; error: string }> {
  const formato_label = input.formato.replaceAll("_", " ");
  const prompt =
    `Você está criando 3 versões DIFERENTES de copy pra um carrossel ` +
    `do Instagram da Sindicompany (@sindicompanybr, gestão condominial).\n\n` +
    `BRIEFING:\n` +
    `- Título interno: ${input.titulo}\n` +
    `- Tema: ${input.tema}\n` +
    `- Formato: ${formato_label}\n` +
    `- Quantidade de slides: ${input.n_slides}\n` +
    (input.briefing ? `- Contexto extra: ${input.briefing}\n` : "") +
    `\nREGRAS POR SLIDE:\n` +
    `- SLIDE 1 (capa): título-gancho curto que dá curiosidade em 1.5s. Body opcional, máx 8 palavras.\n` +
    `- SLIDES INTERNOS: tipo + título (3-7 palavras) + body (1-3 frases curtas, máx 35 palavras).\n` +
    `- ÚLTIMO SLIDE: pergunta SIM/NÃO simples ou call-to-action.\n` +
    `- Português brasileiro com acentos corretos. Fale 'você'.\n` +
    `- NUNCA usar travessão (—). Substituir por vírgula, ponto ou dois-pontos.\n` +
    `- LISTA NEGRA: 'papel fundamental', 'momento crucial', 'cenário em constante evolução', 'destacando a importância', 'o futuro é promissor', 'juntos somos mais fortes'.\n\n` +
    `CADA UMA DAS 3 VERSÕES DEVE TER ÂNGULO DIFERENTE:\n` +
    `- Versão A: emocional, conta uma história curta\n` +
    `- Versão B: dado/fato direto, mais informativa\n` +
    `- Versão C: provocativa, faz uma pergunta forte e desafia o senso comum\n\n` +
    `LEGENDA Instagram (pra cada versão): 4-6 linhas, hook na primeira, 5-8 hashtags na última linha.\n\n` +
    `Devolva JSON estrito (sem markdown):\n` +
    `{ "options": [\n` +
    `  { "slides": [{"tipo":"capa","titulo":"...","body":"..."}, ... total ${input.n_slides} slides], "legenda":"..." },\n` +
    `  { "slides": [...], "legenda":"..." },\n` +
    `  { "slides": [...], "legenda":"..." }\n` +
    `] }`;

  const r = await chat(prompt);
  if (!r.ok) return { ok: false, error: r.error };

  let parsed: { options?: CarrosselCopy[] };
  try {
    parsed = JSON.parse(r.content);
  } catch {
    return { ok: false, error: "Resposta da IA não é JSON válido." };
  }
  const opts = (parsed.options ?? []).slice(0, 3);
  if (opts.length === 0) {
    return { ok: false, error: "IA não retornou nenhuma opção de copy." };
  }
  // Normaliza: garante que cada copy tem n_slides exato
  const normalized: CarrosselCopy[] = opts.map((o) => {
    const slides = (o.slides ?? []).slice(0, input.n_slides);
    while (slides.length < input.n_slides) {
      slides.push({ tipo: "texto", titulo: "", body: "" });
    }
    return { slides, legenda: o.legenda ?? "" };
  });
  return { ok: true, copies: normalized };
}

/** Traduz fielmente a descricao livre que a editora escreveu na
 *  textarea 'Descrever a imagem'. Diferente de descreverCenaParaCapa,
 *  NAO inventa cena nem reduz detalhes — preserva pessoas, ambientes,
 *  objetos, cores, climas que ela mencionou. So neutraliza palavras
 *  que DALL-E bloqueia (violencia, armas, drogas, marcas comerciais).
 *  Se nada precisar mudar, devolve traducao literal. */
export async function traduzirDescricaoUsuario(
  descPt: string,
): Promise<{ ok: true; descEn: string } | { ok: false; error: string }> {
  const prompt =
    `Translate this Brazilian Portuguese photo description into English ` +
    `for a DALL-E prompt. Rules:\n` +
    `- Preserve EVERY visual detail the author wrote: people, age, ` +
    `clothing, gender, environment, objects, colors, time of day, mood.\n` +
    `- Do NOT add scenes or details the author did not mention.\n` +
    `- Do NOT remove details (do not 'simplify').\n` +
    `- Only neutralize words DALL-E blocks: replace weapons/violence/drugs/` +
    `crime/illegal acts with neutral equivalents. Keep brand-free.\n` +
    `- Output: a single English sentence/paragraph faithful to the original. ` +
    `No quotes, no commentary.\n` +
    `- Output JSON: {"desc_en": "..."}\n\n` +
    `INPUT:\n${descPt}`;

  const r = await chat(prompt);
  if (!r.ok) return { ok: false, error: r.error };
  let parsed: { desc_en?: string };
  try {
    parsed = JSON.parse(r.content);
  } catch {
    return { ok: false, error: "Traducao do prompt: JSON invalido." };
  }
  const desc = (parsed.desc_en ?? "").trim();
  if (!desc) return { ok: false, error: "Traducao vazia." };
  return { ok: true, descEn: desc };
}

/** Pega a copy escolhida (em pt-BR, podendo conter palavras "sensíveis"
 *  como conflito/inadimplência) e devolve UMA frase em inglês, neutra,
 *  100% visual/fotográfica, pronta pra alimentar o DALL-E sem disparar
 *  os filtros de safety. */
export async function descreverCenaParaCapa(input: {
  tema: string | null;
  tituloCapa: string;
  subtitulo: string;
}): Promise<{ ok: true; sceneEn: string } | { ok: false; error: string }> {
  const prompt =
    `Convert this Brazilian Instagram carousel cover into a single English ` +
    `sentence describing a concrete photographable SCENE for a documentary ` +
    `editorial photo. Rules:\n` +
    `- One sentence, max 35 words.\n` +
    `- Concrete visible objects/setting only (lobby, garden, hallway, ` +
    `balcony, kitchen, common area, plants, daylight, etc).\n` +
    `- No abstract concepts (no "security", "conflict", "justice", ` +
    `"crisis", "debt", "violence"). Translate any negative theme into a ` +
    `neutral everyday scene about Brazilian condominium life.\n` +
    `- People (if any): adults in everyday clothes, calm body language, ` +
    `no weapons, no fighting, no medical emergencies.\n` +
    `- No brand names, no logos, no text in the image.\n` +
    `- Output JSON: {"scene_en": "..."}\n\n` +
    `INPUT (Portuguese):\n` +
    `Tema: ${input.tema ?? "—"}\n` +
    `Capa título: ${input.tituloCapa}\n` +
    `Capa subtítulo: ${input.subtitulo || "—"}`;

  const r = await chat(prompt);
  if (!r.ok) return { ok: false, error: r.error };
  let parsed: { scene_en?: string };
  try {
    parsed = JSON.parse(r.content);
  } catch {
    return { ok: false, error: "Descrição da cena: JSON inválido." };
  }
  const scene = (parsed.scene_en ?? "").trim();
  if (!scene) return { ok: false, error: "Descrição vazia." };
  return { ok: true, sceneEn: scene };
}
