/**
 * Cliente leve da OpenAI Chat Completions API pra geração de copy
 * de carrossel Instagram. Sem dependência externa — fetch direto.
 */

import type { CarrosselCopy } from "./carrosseis";

const OPENAI_API = "https://api.openai.com/v1/chat/completions";

/** Instruções detalhadas por formato de carrossel. Só o bloco do
 *  formato escolhido é injetado no prompt — mantém o prompt enxuto. */
const FORMATO_INSTRUCOES: Record<string, string> = {
  historia_real:
    `FORMATO: HISTÓRIA REAL (o que mais engaja e salva).\n` +
    `- Dê NOME ao personagem (Renata, Lucas, Carlos), nunca "um morador".\n` +
    `- Detalhes concretos: "6 kg", "4 horas", "23%", "Ap. 8B" — tornam crível.\n` +
    `- A história tem virada: setup → conflito → descoberta → resolução.\n` +
    `- Personagens/situações podem ser compostos. NUNCA invente condomínios ou endereços reais.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): hook — o momento de tensão máxima, sem resolver. + tarja FORMATO.\n` +
    `  2: quem é o personagem e qual o problema.\n` +
    `  3: o erro que quase aconteceu (ou aconteceu).\n` +
    `  4: a virada — o que descobriu/aprendeu/fez.\n` +
    `  5: o resultado concreto (com número).\n` +
    `  último: CTA "Você já passou por isso? Comenta SIM ou NÃO".`,
  lista:
    `FORMATO: LISTA (educativo, pontos equivalentes).\n` +
    `- MÁXIMO 5 itens. Cada item cabe em UMA linha — se não couber, está longo demais.\n` +
    `- Ordene do MENOS óbvio pro MAIS surpreendente: o item 5 precisa chocar.\n` +
    `- Os números são parte do design (Black 900, mint, grande) — o body do slide só explica curto.\n` +
    `- Sem bullet points no texto. A lista vive nos slides numerados.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): "X coisas que [ação provocativa]". + tarja FORMATO.\n` +
    `  2 a N-1: um item por slide — número no título + explicação curta no body.\n` +
    `  último: CTA "Qual você não sabia? Comenta o número aqui".`,
  mito_verdade:
    `FORMATO: MITO VS VERDADE (crenças erradas difundidas).\n` +
    `- Sempre em PARES: Mito num slide, Verdade no slide seguinte.\n` +
    `- O mito precisa SOAR RAZOÁVEL — senão não tem impacto desmistificar.\n` +
    `- A verdade precisa ser ESPECÍFICA: "a lei diz exatamente o oposto", não "não é bem assim". Cite artigo/REsp quando der.\n` +
    `- MÁXIMO 3 pares por carrossel.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): "Você acredita em algum desses mitos sobre condomínio?". + tarja FORMATO.\n` +
    `  2,3: Mito 1 → Verdade 1.  4,5: Mito 2 → Verdade 2.  (e assim por diante até 3 pares)\n` +
    `  No tipo de cada slide: use "mito" pros slides de mito e "verdade" pros de verdade.\n` +
    `  último: CTA "Qual mito você acreditava? Comenta aqui".`,
  antes_depois:
    `FORMATO: ANTES / DEPOIS (resultado tangível de gestão profissional).\n` +
    `- O "depois" precisa ter NÚMERO concreto: "caiu de 23% pra 4% em 6 meses", não "melhorou muito".\n` +
    `- O "antes" precisa ser RECONHECÍVEL: o leitor pensa "isso parece o meu prédio".\n` +
    `- NUNCA fabricar resultados. Se não tem dado plausível, use outro ângulo dentro do formato.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): o dado do "depois" em destaque — o resultado final primeiro. + tarja FORMATO.\n` +
    `  2: o "antes" — como estava o condomínio.\n` +
    `  3: o problema raiz — por que estava assim.\n` +
    `  4: o que mudou — decisão/ação que virou o jogo.\n` +
    `  5: o "depois" detalhado com todos os números.\n` +
    `  último: CTA "Seu condomínio está no antes ou no depois?".`,
  dado_choca:
    `FORMATO: DADO QUE CHOCA (estatística surpreendente com fonte).\n` +
    `- Use só dados que você conhece com FONTE IDENTIFICÁVEL (SíndicoNet, IBGE, SECOVI, STJ, leis federais, reportagens datadas). NUNCA invente números. NUNCA "estudos mostram" ou "especialistas afirmam".\n` +
    `- Reescreva o dado com suas palavras (fato é livre, texto da fonte não).\n` +
    `- Cite a fonte no slide E na legenda: "Fonte: SíndicoNet, 2025" (formato mínimo). Se não souber um dado real e atual, prefira uma referência legal sólida (ex: Lei 4.591/64, Código Civil art. 1.336) reescrita como dado.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): SÓ o número em destaque, sem contexto ainda — número Black 900, mint/sand, ocupa o slide. + tarja FORMATO.\n` +
    `  2: o que esse número significa na vida real do morador.\n` +
    `  3: quem está dentro do dado — a pessoa por trás da estatística.\n` +
    `  4: o contraponto — o que muda quando se sabe o dado.\n` +
    `  5: o que fazer com essa informação.\n` +
    `  último: CTA "Você está nesse número? Comenta SIM ou NÃO".`,
  tutorial:
    `FORMATO: TUTORIAL RÁPIDO (ação prática que dá pra fazer hoje).\n` +
    `- MÁXIMO 5 passos. Cada passo COMEÇA com verbo de ação: "Solicite", "Anote", "Envie", "Guarde", "Exija".\n` +
    `- Sem jargão jurídico sem tradução imediata. Citou lei? Explique em uma frase o que significa.\n` +
    `- Precisa ser acionável HOJE. Se depende de advogado/processo, não é tutorial.\n` +
    `- O ÚLTIMO slide tem um modelo de texto/script que o morador copia direto.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): o problema que o tutorial resolve, em forma de pergunta. + tarja FORMATO.\n` +
    `  2: por que a maioria não faz — a barreira que o tutorial derruba.\n` +
    `  3 a N-1: um passo por slide, numerado, verbo de ação no início.\n` +
    `  último: o modelo/script copiável + CTA "Salva esse post. Você vai precisar.".`,
  opiniao:
    `FORMATO: OPINIÃO FORTE (posição clara da MARCA sobre tema polêmico).\n` +
    `- A opinião é da Sindicompany, não de personagem fictício.\n` +
    `- Precisa de ARGUMENTO: 2-3 razões concretas que sustentam a posição.\n` +
    `- ANTECIPE o contra-argumento num slide ("eu sei que você discorda, mas...") + responda.\n` +
    `- NUNCA atacar pessoas — a opinião é sobre prática/sistema, nunca sobre síndicos/moradores/gestoras específicas.\n` +
    `- CTA obrigatoriamente de DEBATE: dois lados claros.\n` +
    `ESTRUTURA DE SLIDES:\n` +
    `  1 (capa): a afirmação provocativa sem contexto — MÁXIMO 6 palavras. + tarja FORMATO.\n` +
    `  2: o problema que motivou a opinião — dado ou situação real.\n` +
    `  3: argumento 1 — a razão principal.\n` +
    `  4: o contra-argumento que o leitor vai pensar — e a resposta a ele.\n` +
    `  5: argumento 2 e consequência prática.\n` +
    `  último: CTA "Concorda ou discorda? Comenta CONCORDO ou DISCORDO.".`,
};

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
              "Você é redator do Instagram @sindicompanybr (Sindicompany — " +
              "síndicos profissionais, SP e RJ). Escreve como pessoa " +
              "inteligente corrigindo um amigo, NUNCA como empresa instruindo " +
              "cliente. Voz: começa dentro da cabeça do leitor, frases curtas " +
              "(um sujeito, um predicado, acabou), tom direto, sem rodeios. " +
              "Português brasileiro com TODOS os acentos corretos (você, " +
              "síndico, condomínio, gestão, está, são). " +
              "PROIBIDO: gerúndio (evitando, garantindo, proporcionando), " +
              "linguagem corporativa (soluções integradas, atendimento " +
              "acolhedor, gestão eficiente, excelência), frases de introdução " +
              "(é importante ressaltar, levando em consideração, nesse " +
              "contexto, vale destacar), CTA comercial em corpo de post " +
              "educativo (Fale com a Sindicompany, Entre em contato), " +
              "travessão (—), aspas curvas (“ ”), emoji decorativo, negrito " +
              "mecânico. Use apenas aspas retas (\"). Sempre termine cada " +
              "post (legenda) com 'Por mais lares. 🏡'.",
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
  const instrucoesFormato =
    FORMATO_INSTRUCOES[input.formato] ??
    `FORMATO: ${formato_label} (estrutura livre, mantendo a voz e os 7 passos).`;
  const prompt =
    `Crie 3 VERSÕES de copy pra um carrossel do @sindicompanybr.\n\n` +
    `BRIEFING:\n` +
    `- Título interno: ${input.titulo}\n` +
    `- Tema: ${input.tema}\n` +
    `- Formato: ${formato_label}\n` +
    `- Quantidade de slides: ${input.n_slides}\n` +
    (input.briefing ? `- Contexto extra: ${input.briefing}\n` : "") +
    `\n${instrucoesFormato}\n\n` +
    `VOZ (vale pra TODOS os formatos):\n` +
    `Estrutura narrativa baseada no post de maior alcance: CENA concreta (começa no meio) → SUPOSIÇÃO do leitor (termina com "né?"/"certo?") → CONTRADIÇÃO em ≤3 palavras → EXPLICAÇÃO uma ideia por frase → FECHAMENTO paradoxal/quotável → CTA binário/escala. A ASSINATURA "Por mais lares. 🏡" aparece SÓ na legenda, nunca nos slides. Use a estrutura de slides do FORMATO acima; a voz acima é o tom de cada slide.\n\n` +
    `REGRAS GERAIS:\n` +
    `- Capa: o tema "${input.tema}" aparece literal ou em paráfrase clara, ancorado no contexto condominial. Capa inteira (titulo + body) tem no máximo 20 palavras.\n` +
    `- Cada slide interno: tipo + título (3-7 palavras) + body (1-3 frases curtas, máx 35 palavras).\n` +
    `- Em posts educativos (mito, dado, tutorial, lista jurídica): pelo menos UMA âncora — artigo (ex: "Código Civil, art. 1.336"), decisão judicial (ex: "STJ, REsp 1.699.022/SP, 2019") OU dado com fonte nomeada e datada.\n` +
    `- Contexto condominial sempre: assembleia, taxa, síndico, morador, área comum, regulamento, convivência, fachada, manutenção. Pelo menos UM slide menciona "condomínio" ou "condominial" literal.\n\n` +
    `LEGENDA Instagram (pra cada versão): replica a narrativa em texto corrido (4-8 linhas), hook na primeira linha, termina OBRIGATORIAMENTE com "Por mais lares. 🏡" e EXATAMENTE 3 hashtags na linha seguinte.\n\n` +
    `VARIAÇÃO ENTRE AS 3 VERSÕES (mesmo formato e voz, abordagens diferentes):\n` +
    `- Versão A: foco no morador comum (apartamento, garagem, elevador, convivência doméstica)\n` +
    `- Versão B: foco em governança/financeiro (assembleia, taxa, prestação de contas, fundo de reserva)\n` +
    `- Versão C: foco no síndico/gestão (rotina, decisões, responsabilidade, mediação)\n\n` +
    `REGRAS DE PORTUGUÊS (humanização):\n` +
    `- Acentos corretos em TODA palavra: você, síndico, condomínio, gestão, está, são, é, à.\n` +
    `- Fale "você", voz ativa, sujeito explícito. Frase curta: um sujeito, um predicado.\n` +
    `- NUNCA: gerúndio (evitando, garantindo, proporcionando), travessão (—), aspas curvas (" "), emoji decorativo no corpo do slide, frases de introdução tipo "é importante ressaltar", CTA comercial ("Fale com a Sindicompany").\n` +
    `- LISTA NEGRA: papel fundamental, momento crucial, cenário em constante evolução, destacando a importância, o futuro é promissor, juntos somos mais fortes, destaca-se, vibrante, no coração de, em meio a, reflete a, simboliza a, evidencia a, um verdadeiro testemunho, desafios e oportunidades, rica diversidade, não apenas X mas também Y, mergulhando em, celebrando a, fomentando o, pavimentando o caminho, estudos mostram, especialistas afirmam.\n` +
    `- Use exemplos concretos (artigos de lei, REsp, números, ações reais) em vez de abstrações.\n\n` +
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
    `- Sanitize words that DALL-E commonly blocks: replace ` +
    `weapons/violence/drugs/crime/illegal acts with neutral equivalents; ` +
    `replace specific real-person names (politicians, celebrities) with ` +
    `'a person'; replace specific brand names ('Apple iPhone' -> ` +
    `'a smartphone'); replace 'briga'/'conflito' with 'conversation' or ` +
    `'meeting'; replace 'inadimplencia'/'divida' with 'paperwork' or ` +
    `'documents'; replace 'seguranca'/'security guard' with 'concierge' ` +
    `or 'doorman'.\n` +
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
