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
  logoH: number; logoW: number; logoInset: number;
  kicker: number; titulo: number; sub: number; body: number; bodyGap: number;
  footerLogoH: number; byLogoH: number; contentPad: number;
}> = {
  a4: {
    // logoInset = 15mm @ 96dpi (A4 = 210mm = 794px -> ~3.78px/mm). Tambem usado
    // como margem das linhas laterais da moldura ate a borda da pagina, e como
    // distancia da linha horizontal ate o logotipo.
    w: 794, h: 1123, pad: 52,
    // frameTop = logoInset + logoH + logoInset (15mm abaixo do logo)
    frameTop: 324, frameBot: 110,
    logoH: 210, logoW: 340, logoInset: 57,
    kicker: 13, titulo: 30, sub: 18, body: 14, bodyGap: 10,
    footerLogoH: 38, byLogoH: 32, contentPad: 28,
  },
  celular: {
    // Story do Instagram (1080x1920). Fontes ampliadas pra leitura no celular.
    w: 1080, h: 1920, pad: 84,
    // frameTop = logoInset + logoH + logoInset
    frameTop: 508, frameBot: 180,
    logoH: 340, logoW: 456, logoInset: 84,
    kicker: 25, titulo: 52, sub: 33, body: 27, bodyGap: 21,
    footerLogoH: 76, byLogoH: 62, contentPad: 44,
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
      {/* Logo do condominio: a 15mm da borda esquerda e 15mm do topo (A4),
          ocupando ate a metade da largura da arte. Sem logo cadastrado ->
          mostra o nome do condominio. */}
      {(() => {
        const topLogo = props.logoCondominioUrl || null;
        return (
          <div style={{ position: "absolute", top: d.logoInset, left: d.logoInset, width: d.logoW, height: d.logoH, display: "flex", alignItems: "center", zIndex: 1 }}>
            {topLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={topLogo} alt={props.condominio} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "left center", display: "block" }} />
            ) : (
              <div style={{ fontFamily: "'Provicali', 'Liberation Serif', serif", fontSize: d.titulo * 1.3, color: ONIX, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
                {props.condominio}
              </div>
            )}
          </div>
        );
      })()}

      {/* Moldura mint: laterais a 15mm das bordas, linha horizontal 15mm abaixo
          do logo; ABERTA embaixo (sem linha de delimitacao). */}
      <div
        style={{
          position: "absolute",
          top: d.frameTop, left: d.logoInset, right: d.logoInset, bottom: d.frameBot,
          borderTop: `2px solid ${MINT}`,
          borderLeft: `2px solid ${MINT}`,
          borderRight: `2px solid ${MINT}`,
          zIndex: 1,
        }}
      />

      {/* Ilustracao no canto superior direito. Fica POR CIMA da moldura e
          ULTRAPASSA a linha horizontal (bleed pra baixo). */}
      {props.ilustracaoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.ilustracaoUrl}
          alt=""
          aria-hidden="true"
          crossOrigin="anonymous"
          style={{ position: "absolute", top: 0, right: 0, maxHeight: Math.round(d.frameTop * 1.75), maxWidth: d.w - d.logoInset - d.logoW + 56, objectFit: "contain", objectPosition: "right top", zIndex: 3 }}
        />
      )}

      {/* Conteudo dentro da moldura */}
      <div
        style={{
          position: "absolute",
          top: d.frameTop + d.contentPad,
          left: d.logoInset + d.contentPad,
          right: d.logoInset + d.contentPad,
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
