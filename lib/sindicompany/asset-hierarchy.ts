/**
 * Hierarquia oficial de Assets do Sindicompany.info.
 *
 * Estrutura por marca: cada uma das 3 marcas (Sindicompany, BySindicompany,
 * Consvicta) tem sua propria copia completa desta arvore.
 *
 * Levels:
 *   1. Brand (sindicompany | by | consvicta) — definido no path da rota
 *   2. Section (Brand Assets, Social Media Assets, Visual Library, ...)
 *   3. Category (Logotipos, Tipografia, Patterns, Texturas, ...)
 *   4. Subcategory (opcional — ex: Carrosseis > Fundos > Capa)
 *   5. Leaf (asset slot — onde upload acontece)
 *
 * Cada leaf gera um bucket prefix no Supabase Storage no formato:
 *   __{brand-prefix}/{section}/{category}/{subcategory}/{leaf}
 *
 * Onde brand-prefix = "" (Sindicompany), "by", ou "consvicta".
 */

export type AssetBrand = "sindicompanybr" | "bysindicompany" | "consvictabr";

export interface AssetNode {
  slug: string;
  label: string;
  description?: string;
  children?: AssetNode[];
  /** Se setado, este leaf reusa um bucket legacy (ex: "logos", "patterns")
   *  em vez de derivar do path. Mantem assets ja uploadados acessiveis. */
  legacyBucket?: string;
}

/** Helper: marca um node como leaf (sem children) com label + slug. */
function leaf(slug: string, label: string, opts: { legacyBucket?: string } = {}): AssetNode {
  return { slug, label, ...opts };
}

export const ASSET_HIERARCHY: AssetNode[] = [
  // ───────────────────────────────────────────────────────────────────
  // 1. Brand Assets
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "brand-assets",
    label: "Brand Assets",
    description: "Tudo que é institucional e fixo da marca",
    children: [
      {
        slug: "logotipos",
        label: "Logotipos",
        children: [
          // Principal reusa o bucket legacy "logos" pros 10 slots ja
          // uploadados (Sindicompany/By: logo padrao; Consvicta: wordmark + symbol)
          leaf("principal", "Principal", { legacyBucket: "logos" }),
          leaf("branco", "Branco"),
          leaf("preto", "Preto"),
          leaf("horizontal", "Horizontal"),
          leaf("vertical", "Vertical"),
          leaf("simbolo", "Símbolo"),
          leaf("svg", "SVG"),
          leaf("png", "PNG"),
          leaf("fundo-transparente", "Fundo transparente"),
        ],
      },
      {
        slug: "tipografia",
        label: "Tipografia",
        children: [
          leaf("fontes-oficiais", "Fontes oficiais"),
          leaf("hierarquia", "Hierarquia tipográfica"),
          leaf("combinacoes", "Combinações"),
          leaf("regras-uso", "Regras de uso"),
        ],
      },
      {
        slug: "paleta-cores",
        label: "Paleta de cores",
        children: [
          leaf("hex", "HEX"),
          leaf("rgb", "RGB"),
          leaf("gradientes", "Gradientes"),
          leaf("combinacoes-aprovadas", "Combinações aprovadas"),
        ],
      },
      {
        slug: "brand-guidelines",
        label: "Brand Guidelines",
        children: [
          leaf("manual", "Manual da marca"),
          leaf("aplicacoes-corretas", "Aplicações corretas"),
          leaf("aplicacoes-proibidas", "Aplicações proibidas"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // 2. Social Media Assets
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "social-media",
    label: "Social Media Assets",
    description: "Carrosséis, posts, stories — material publicado",
    children: [
      {
        slug: "carrosseis",
        label: "Carrosséis",
        children: [
          {
            slug: "fundos",
            label: "Fundos",
            children: [
              // Conteudo reusa "icon-carrossel" (bucket existente)
              leaf("capa", "Capa"),
              leaf("conteudo", "Conteúdo", { legacyBucket: "icon-carrossel" }),
              leaf("cta", "CTA"),
              leaf("editorial", "Editorial"),
              leaf("premium", "Premium"),
              leaf("minimalista", "Minimalista"),
              leaf("escuro", "Escuro"),
              leaf("claro", "Claro"),
            ],
          },
          {
            slug: "elementos-graficos",
            label: "Elementos gráficos",
            children: [
              leaf("linhas", "Linhas"),
              leaf("molduras", "Molduras"),
              leaf("setas", "Setas"),
              leaf("boxes", "Boxes"),
              leaf("tags", "Tags"),
              leaf("glow", "Glow"),
              leaf("blur", "Blur"),
              leaf("texturas", "Texturas"),
            ],
          },
          {
            slug: "cta-assets",
            label: "CTA Assets",
            children: [
              leaf("comente", "“Comente”"),
              leaf("compartilhe", "“Compartilhe”"),
              leaf("salve", "“Salve”"),
              leaf("segue", "“Segue”"),
              leaf("whatsapp", "WhatsApp"),
              leaf("botoes-visuais", "Botões visuais"),
            ],
          },
          {
            slug: "covers",
            label: "Covers",
            children: [
              leaf("templates-capa", "Templates de capa"),
              leaf("estruturas-prontas", "Estruturas prontas"),
              leaf("variacoes-titulo", "Variações de título"),
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // 3. Visual Library
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "visual-library",
    label: "Visual Library",
    description: "Patterns, texturas, backgrounds — biblioteca visual",
    children: [
      {
        slug: "patterns",
        label: "Patterns",
        children: [
          // Geométricos reusa o bucket "patterns" (todos uploads atuais)
          leaf("geometricos", "Geométricos", { legacyBucket: "patterns" }),
          leaf("arquitetonicos", "Arquitetônicos"),
          leaf("premium", "Premium"),
          leaf("organicos", "Orgânicos"),
          leaf("editorial", "Editorial"),
        ],
      },
      {
        slug: "texturas",
        label: "Texturas",
        children: [
          leaf("marmore", "Mármore"),
          leaf("papel", "Papel"),
          leaf("concreto", "Concreto"),
          leaf("vidro", "Vidro"),
          leaf("metal", "Metal"),
          leaf("noise", "Noise"),
        ],
      },
      {
        slug: "backgrounds",
        label: "Backgrounds",
        children: [
          leaf("institucional", "Institucional"),
          leaf("instagram", "Instagram"),
          leaf("story", "Story"),
          leaf("site", "Site"),
          leaf("apresentacao", "Apresentação"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // 4. Icon Library
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "icon-library",
    label: "Icon Library",
    description: "Biblioteca de ícones por estilo e área",
    children: [
      {
        slug: "icones",
        label: "Ícones",
        children: [
          leaf("outline", "Outline"),
          leaf("filled", "Filled"),
          leaf("minimalistas", "Minimalistas"),
          // Condomínio reusa o bucket "icons" (86 icones Consvicta + Sindicompany)
          leaf("condominio", "Condomínio", { legacyBucket: "icons" }),
          leaf("financeiro", "Financeiro"),
          leaf("juridico", "Jurídico"),
          leaf("engenharia", "Engenharia"),
          leaf("comunicacao", "Comunicação"),
          leaf("ia", "IA"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // 5. AI Ready Assets
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "ai-ready",
    label: "AI Ready Assets",
    description: "Prompts, composições e regras pra geração via IA",
    children: [
      {
        slug: "prompts-visuais",
        label: "Prompts Visuais",
        children: [
          leaf("editorial", "Estilo editorial"),
          leaf("ultra-realista", "Estilo ultra-realista"),
          leaf("instagram", "Estilo Instagram"),
          leaf("pixar", "Estilo Pixar"),
          leaf("corporativo", "Estilo corporativo"),
        ],
      },
      {
        slug: "composicoes",
        label: "Composições",
        children: [
          leaf("mulher-executiva", "Mulher executiva"),
          leaf("assembleia", "Assembleia"),
          leaf("area-comum", "Área comum"),
          leaf("sindico", "Síndico"),
          leaf("prestacao-contas", "Prestação de contas"),
          leaf("conflito-condominial", "Conflito condominial"),
        ],
      },
      {
        slug: "regras-visuais",
        label: "Regras Visuais",
        children: [
          leaf("safe-area-instagram", "Safe area Instagram"),
          leaf("margens", "Margens"),
          leaf("estetica-marca", "Estética da marca"),
          leaf("profundidade", "Profundidade"),
          leaf("iluminacao", "Iluminação"),
          leaf("tipografia-ideal", "Tipografia ideal"),
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────
  // 6. Templates
  // ───────────────────────────────────────────────────────────────────
  {
    slug: "templates",
    label: "Templates",
    description: "Modelos prontos pra reuso",
    children: [
      {
        slug: "instagram",
        label: "Instagram",
        children: [
          leaf("carrossel", "Carrossel"),
          leaf("reels-cover", "Reels cover"),
          leaf("story", "Story"),
          leaf("feed-unico", "Feed único"),
        ],
      },
      {
        slug: "comercial",
        label: "Comercial",
        children: [
          leaf("propostas", "Propostas"),
          leaf("pdfs", "PDFs"),
          leaf("apresentacoes", "Apresentações"),
          leaf("relatorios", "Relatórios"),
        ],
      },
      {
        slug: "eventos",
        label: "Eventos",
        children: [
          leaf("convites", "Convites"),
          leaf("credenciais", "Credenciais"),
          leaf("backdrop", "Backdrop"),
          leaf("certificados", "Certificados"),
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Prefixo do bucket por marca (corresponde aos buckets ja existentes). */
export const BRAND_PREFIX: Record<AssetBrand, string> = {
  sindicompanybr: "__",            // ex: __logos, __patterns
  bysindicompany: "__by-",         // ex: __by-logos, __by-patterns
  consvictabr: "__consvicta-",     // ex: __consvicta-logos, __consvicta-patterns
};

/** URL da rota de assets por marca. */
export const BRAND_ROUTE: Record<AssetBrand, string> = {
  sindicompanybr: "/sindicompany/assets",
  bysindicompany: "/sindicompany/by-assets",
  consvictabr: "/sindicompany/consvicta-assets",
};

export const BRAND_LABEL: Record<AssetBrand, string> = {
  sindicompanybr: "Sindicompany",
  bysindicompany: "BySindicompany",
  consvictabr: "Consvicta",
};

export const BRAND_HANDLE: Record<AssetBrand, string> = {
  sindicompanybr: "@sindicompanybr",
  bysindicompany: "@bysindicompany",
  consvictabr: "@consvictabr",
};

/** Encontra um node a partir do path (array de slugs).
 *  Retorna o node OU null se path inexistente. */
export function findNode(path: string[]): AssetNode | null {
  if (path.length === 0) return null;
  let level: AssetNode[] = ASSET_HIERARCHY;
  let found: AssetNode | null = null;
  for (const slug of path) {
    const next = level.find((n) => n.slug === slug);
    if (!next) return null;
    found = next;
    level = next.children ?? [];
  }
  return found;
}

/** Resolve o nome do bucket pra um leaf, considerando legacy. */
export function bucketForLeaf(
  brand: AssetBrand,
  pathSegments: string[],
  leafNode: AssetNode,
): string {
  const prefix = BRAND_PREFIX[brand];
  if (leafNode.legacyBucket) {
    // Bucket legado (ex: "__consvicta-logos", "__patterns", "__by-icons")
    return `${prefix}${leafNode.legacyBucket}`;
  }
  // Bucket novo derivado do path. Ex: "__consvicta-brand-logotipos-branco"
  const slug = pathSegments.join("-");
  return `${prefix}${slug}`;
}

/** Determina basename pro upload baseado no node leaf (consistente com
 *  buckets antigos: pattern-N.svg, icon-N.svg, logo-N.svg, ...). */
export function basenameForLeaf(leafNode: AssetNode): string {
  if (leafNode.legacyBucket === "patterns") return "pattern";
  if (leafNode.legacyBucket === "icons") return "icon";
  if (leafNode.legacyBucket === "icon-carrossel") return "icon";
  if (leafNode.legacyBucket === "logos") return "logo";
  // Novos: usa o slug do leaf como basename. Ex: leaf "branco" -> branco-N.svg
  return leafNode.slug;
}

/** Itera todos os leaves da hierarquia, retornando path + node. */
export function* iterLeaves(
  nodes: AssetNode[] = ASSET_HIERARCHY,
  prefix: string[] = [],
): Generator<{ path: string[]; node: AssetNode }> {
  for (const node of nodes) {
    const current = [...prefix, node.slug];
    if (!node.children || node.children.length === 0) {
      yield { path: current, node };
    } else {
      yield* iterLeaves(node.children, current);
    }
  }
}
