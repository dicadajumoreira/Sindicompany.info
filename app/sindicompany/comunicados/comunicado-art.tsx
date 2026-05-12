/**
 * Arte do comunicado, renderizada em pixels exatos para os 2 formatos:
 *  - "a4"      : 794 x 1123 px   (A4 retrato @ 96dpi, para impressao/mural)
 *  - "celular" : 1080 x 1920 px  (Story do Instagram, 9:16)
 *
 * O mesmo no e usado para o preview na tela e como alvo do
 * html-to-image (download em PNG). Por isso usa estilos inline.
 *
 * Layout:
 *  - topo esquerda: logotipo do condominio (do cadastro do condo)
 *  - topo direita : ilustracao (enviada por comunicado), POR CIMA da
 *    linha (moldura) que delimita a pagina
 *  - moldura mint aberta embaixo (top + laterais, SEM linha embaixo)
 *  - conteudo: "COMUNICADO IMPORTANTE" + titulo (mint) + texto justificado
 *  - rodape (centro, sem linha): logotipo do(a) sindico(a). Se o sindico
 *    for By Sindicompany, ao lado vem o logotipo "by sindicompany".
 */

const MINT = "#56CFE1";
const MINT_DARK = "#2E9AAC";
const INK = "#3A3D4A";
const ONIX = "#1E1E24";
const PAPER = "#FBFAF6";

const SINDICOMPANY_LOGO =
  "https://raw.githubusercontent.com/dicadajumoreira/Sindicompany/main/Logotipo%20Sindicompany%201.png";

type Variant = "a4" | "celular";

const DIMS: Record<Variant, {
  w: number; h: number; pad: number;
  frameTop: number; frameBot: number;
  logoH: number; logoW: number; illoH: number; illoW: number;
  kicker: number; titulo: number; sub: number; body: number; bodyGap: number;
  footerLogoH: number; byLogoH: number; contentPad: number;
}> = {
  a4: {
    w: 794, h: 1123, pad: 52,
    frameTop: 122, frameBot: 124,
    logoH: 88, logoW: 397, illoH: 152, illoW: 220,
    kicker: 13, titulo: 31, sub: 19, body: 14.5, bodyGap: 11,
    footerLogoH: 40, byLogoH: 34, contentPad: 32,
  },
  celular: {
    // Story do Instagram (1080x1920). Fontes ampliadas pra leitura no celular.
    w: 1080, h: 1920, pad: 84,
    frameTop: 236, frameBot: 260,
    logoH: 172, logoW: 540, illoH: 360, illoW: 430,
    kicker: 27, titulo: 60, sub: 38, body: 32, bodyGap: 26,
    footerLogoH: 78, byLogoH: 64, contentPad: 60,
  },
};

export interface ComunicadoArtProps {
  variant: Variant;
  nodeId: string;
  condominio: string;
  titulo: string;
  subtitulo?: string | null;
  corpo: string;
  ilustracaoUrl?: string | null;
  /** Logo proprio do condominio (canto superior esquerdo). */
  logoCondominioUrl?: string | null;
  /** Logo do(a) sindico(a)/administradora (rodape). */
  logoSindicoUrl?: string | null;
  /** Logo "by sindicompany" dos assets (rodape, quando By Sindicompany). */
  byLogoUrl?: string | null;
  /** true quando o sindico do condo e By Sindicompany. */
  ehBy: boolean;
}

export function ComunicadoArt(props: ComunicadoArtProps) {
  const d = DIMS[props.variant];
  // Nunca exibir travessao no texto, venha de onde vier.
  const corpo = (props.corpo || "").replace(/\r\n/g, "\n").replace(/\s*[‐‑‒–—―]\s*/g, ", ").trimEnd();

  // Rodape: lista de logos a mostrar (sindico [+ by] OU fallback Sindicompany).
  const footerImgs: { src: string; h: number; maxW: number }[] = [];
  if (props.ehBy) {
    if (props.logoSindicoUrl) footerImgs.push({ src: props.logoSindicoUrl, h: d.footerLogoH, maxW: d.w * 0.32 });
    if (props.byLogoUrl) footerImgs.push({ src: props.byLogoUrl, h: d.byLogoH, maxW: d.w * 0.3 });
    if (footerImgs.length === 0) footerImgs.push({ src: SINDICOMPANY_LOGO, h: d.footerLogoH, maxW: d.w * 0.42 });
  } else {
    footerImgs.push({ src: props.logoSindicoUrl || SINDICOMPANY_LOGO, h: d.footerLogoH, maxW: d.w * 0.42 });
  }

  return (
    <div
      id={props.nodeId}
      style={{
        position: "relative", width: d.w, height: d.h, background: PAPER,
        fontFamily: "'Epilogue', 'DejaVu Sans', sans-serif", color: INK,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      {/* Logo do condominio: topo esquerdo, ocupa ate a metade da largura da arte.
          Usa o logo do condominio; se nao houver, cai pro logo do(a) sindico(a). */}
      {(() => {
        const topLogo = props.logoCondominioUrl || props.logoSindicoUrl || null;
        return (
          <div style={{ position: "absolute", top: d.pad * 0.45, left: d.pad, width: d.logoW, zIndex: 1 }}>
            {topLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={topLogo} alt={props.condominio} crossOrigin="anonymous" style={{ width: "100%", maxHeight: d.logoH, objectFit: "contain", objectPosition: "left center", display: "block" }} />
            ) : (
              <div style={{ fontFamily: "'Provicali', 'Liberation Serif', serif", fontSize: d.titulo, color: ONIX, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
                {props.condominio}
              </div>
            )}
          </div>
        );
      })()}

      {/* Moldura mint: topo + laterais, ABERTA embaixo (sem linha de delimitacao) */}
      <div
        style={{
          position: "absolute",
          top: d.frameTop, left: d.pad * 0.85, right: d.pad * 0.85, bottom: d.frameBot,
          borderTop: `2px solid ${MINT}`,
          borderLeft: `2px solid ${MINT}`,
          borderRight: `2px solid ${MINT}`,
          zIndex: 1,
        }}
      />

      {/* Ilustracao no canto superior direito — ACIMA da linha da moldura */}
      {props.ilustracaoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.ilustracaoUrl}
          alt=""
          aria-hidden="true"
          crossOrigin="anonymous"
          style={{ position: "absolute", top: 0, right: 0, maxHeight: Math.round(d.frameTop * 1.3), maxWidth: d.illoW, objectFit: "contain", zIndex: 3 }}
        />
      )}

      {/* Conteudo dentro da moldura */}
      <div
        style={{
          position: "absolute",
          top: d.frameTop + d.contentPad,
          left: d.pad * 0.85 + d.contentPad,
          right: d.pad * 0.85 + d.contentPad,
          bottom: d.frameBot + d.contentPad * 0.6,
          display: "flex", flexDirection: "column", zIndex: 2,
        }}
      >
        <div style={{ color: MINT_DARK, fontWeight: 700, fontSize: d.kicker, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: d.contentPad * 0.3 }}>
          Comunicado importante
        </div>
        <h1 style={{ color: MINT_DARK, fontWeight: 800, fontSize: d.titulo, lineHeight: 1.08, margin: 0 }}>{props.titulo}</h1>
        {props.subtitulo && (
          <div style={{ color: MINT_DARK, fontWeight: 700, fontSize: d.sub, lineHeight: 1.15, marginTop: d.contentPad * 0.18 }}>{props.subtitulo}</div>
        )}
        <div style={{ marginTop: d.contentPad * 0.9, fontSize: d.body, lineHeight: 1.55, color: INK, textAlign: "justify", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {corpo ? corpo : <span style={{ color: "#9ca3af" }}>(sem texto)</span>}
        </div>
      </div>

      {/* Rodape: logotipo(s) centralizado(s), sem linha */}
      <div style={{ position: "absolute", bottom: d.pad * 0.55, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: d.pad * 0.45, zIndex: 2 }}>
        {footerImgs.map((it, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: d.pad * 0.45 }}>
            {i > 0 && <span style={{ width: 1, height: it.h * 0.8, background: "rgba(0,0,0,.18)" }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.src} alt="" crossOrigin="anonymous" style={{ maxHeight: it.h, maxWidth: it.maxW, objectFit: "contain" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
