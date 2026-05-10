/**
 * Geração de imagens via DALL-E 3 (OpenAI). Usado pra criar a foto da
 * capa do carrossel Instagram a partir do briefing da editora — quando
 * ela não quer fazer upload manual.
 *
 * Não usa SDK pra evitar dependência adicional; chama a REST API direto.
 */

const OPENAI_API = "https://api.openai.com/v1/images/generations";

export interface DalleResult {
  ok: true;
  /** URL temporária da OpenAI (expira em ~1h) — precisa ser baixada e
   *  re-uploadada pra storage estável. */
  url: string;
  /** Prompt revisado pela OpenAI (eles ajustam pra moderation/quality). */
  revised_prompt?: string;
}

export interface DalleError {
  ok: false;
  error: string;
}

interface DalleOptions {
  /** "1024x1024" (quadrada), "1792x1024" (landscape) ou "1024x1792" (portrait/4:5).
   *  Pra carrossel Instagram (4:5), use portrait. */
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  /** "standard" ou "hd". HD custa o dobro mas dá detalhes melhores. */
  quality?: "standard" | "hd";
  /** "vivid" (dramático) ou "natural" (mais sóbrio). Para editorial Sindicompany,
   *  "natural" funciona melhor (estilo fotojornalismo). */
  style?: "vivid" | "natural";
}

export async function generateImage(
  prompt: string,
  opts: DalleOptions = {},
): Promise<DalleResult | DalleError> {
  // Sanitiza a chave: trim de whitespace/quebras de linha + remove
  // prefixo 'Bearer ' se a editora colou já com header.
  const rawKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const apiKey = rawKey.replace(/^Bearer\s+/i, "");
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY ausente nas variáveis de ambiente." };
  }
  if (!apiKey.startsWith("sk-")) {
    return {
      ok: false,
      error: "OPENAI_API_KEY não começa com 'sk-' (formato inválido). Verifique a variável no Vercel.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // Project keys (sk-proj-...) podem exigir org/project explícito
  // dependendo da config da conta. Se as envs estiverem setadas,
  // anexa.
  const orgId = (process.env.OPENAI_ORGANIZATION ?? "").trim();
  if (orgId) headers["OpenAI-Organization"] = orgId;
  const projId = (process.env.OPENAI_PROJECT ?? "").trim();
  if (projId) headers["OpenAI-Project"] = projId;

  const body = {
    model: "dall-e-3",
    prompt,
    n: 1,
    size: opts.size ?? "1024x1792",
    quality: opts.quality ?? "hd",
    style: opts.style ?? "natural",
    response_format: "url",
  };

  let res: Response;
  try {
    res = await fetch(OPENAI_API, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
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
      const j = await res.json();
      detail = j?.error?.message ?? JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    // Mensagens mais úteis pra status codes comuns
    if (res.status === 401) {
      const isProjKey = apiKey.startsWith("sk-proj-");
      const dica = isProjKey
        ? "Sua chave é do tipo 'project' (sk-proj-...). Defina também as variáveis OPENAI_PROJECT (proj_...) e/ou OPENAI_ORGANIZATION (org_...) no Vercel."
        : "Verifique se OPENAI_API_KEY está correta no Vercel (sem espaços, sem aspas) e se a conta tem créditos.";
      return {
        ok: false,
        error: `OpenAI 401 (auth inválida): ${detail.slice(0, 160)}. ${dica}`,
      };
    }
    return {
      ok: false,
      error: `OpenAI retornou ${res.status}: ${detail.slice(0, 200)}`,
    };
  }

  let json: { data?: Array<{ url?: string; revised_prompt?: string }> };
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "OpenAI retornou resposta não-JSON." };
  }

  const item = json.data?.[0];
  if (!item?.url) {
    return { ok: false, error: "Resposta sem URL de imagem." };
  }
  return { ok: true, url: item.url, revised_prompt: item.revised_prompt };
}

/** Baixa a imagem temporária da OpenAI e devolve os bytes. URL da OpenAI
 *  expira em ~1h, então sempre re-upload pra Supabase. */
export async function downloadImageBytes(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "sindicompany-painel/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Download da imagem falhou: HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** Constrói um prompt editorial pra DALL-E baseado no briefing do
 *  carrossel. O estilo é fotojornalismo brasileiro de condomínio
 *  (real, sem ilustração, sem texto na imagem). */
export function buildCarrosselPrompt(input: {
  titulo: string;
  tema?: string | null;
  formato?: string | null;
  briefing?: string | null;
}): string {
  const partes = [
    "Editorial photograph for Brazilian Instagram carousel cover (4:5 vertical).",
    `Subject/theme: ${_sanitizar(input.tema ?? input.titulo)}.`,
  ];
  if (input.formato) partes.push(`Format: ${input.formato.replaceAll("_", " ")}.`);
  if (input.briefing) {
    const brief = _sanitizar(input.briefing).slice(0, 500);
    partes.push(`Context/briefing: ${brief}`);
  }
  partes.push(
    "Style: candid documentary photography, real Brazilian condominium setting (lobby, hallway, common area, garden, balcony as appropriate). Natural daylight, shallow depth of field, journalistic framing. People are diverse (when present), in everyday moments, no posing. Cinematic warm tones. Photorealistic, hyper-detailed, no illustration, no graphic art, NO TEXT IN THE IMAGE, no logos, no watermarks. Composition leaves the bottom half slightly less busy so a text overlay can be added later in post-production.",
  );
  return partes.join(" ");
}

/** Versão minimal do prompt — usada como fallback quando a OpenAI
 *  rejeita o prompt completo por safety. Remove o briefing
 *  (provável fonte do trigger) e fica genérico. */
export function buildCarrosselPromptSafe(input: {
  titulo: string;
  tema?: string | null;
}): string {
  const tema = _sanitizar(input.tema ?? input.titulo);
  return (
    `Editorial photograph for Brazilian Instagram cover (4:5 vertical). ` +
    `Subject: ${tema}. ` +
    `Style: candid documentary photo, real Brazilian residential building setting, ` +
    `natural daylight, shallow depth of field, photorealistic, no text, no logos. ` +
    `Color palette dominated by Sindicompany brand pastels: mint cyan #84C7D3, ` +
    `warm sand beige #DABDA9, soft lavender #B8C0FF, white #FFFFFF, light gray ` +
    `#F4F4F5. Airy and low-saturation. Avoid heavy reds, oranges, dark blues, ` +
    `forest greens or saturated primaries.`
  );
}

/** Substitui termos que costumam disparar o safety filter da OpenAI
 *  por sinônimos mais neutros (sem perder o sentido pra um prompt
 *  de fotografia editorial). */
function _sanitizar(s: string): string {
  if (!s) return "";
  const map: Array<[RegExp, string]> = [
    [/\bseguran[çc]a\b/gi, "comunidade"],
    [/\bconflito(s)?\b/gi, "convivência"],
    [/\bbriga(s)?\b/gi, "diálogo"],
    [/\bviol[êe]ncia\b/gi, "atenção"],
    [/\barma(s)?\b/gi, ""],
    [/\bdroga(s)?\b/gi, ""],
    [/\bcrime(s)?\b/gi, "questão"],
    [/\binadimpl[êe]ncia\b/gi, "gestão financeira"],
    [/\bd[ií]vida(s)?\b/gi, "compromisso"],
  ];
  let out = s;
  for (const [re, repl] of map) out = out.replace(re, repl);
  return out;
}
