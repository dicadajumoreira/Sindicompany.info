/**
 * Arte do comunicado, renderizada em pixels exatos para os 2 formatos:
 *  - "a4"      : 794 x 1123 px  (A4 retrato @ 96dpi)
 *  - "celular" : 1080 x 1350 px (4:5, padrao Instagram/WhatsApp)
 *
 * O mesmo no e usado para o preview na tela e como alvo do
 * html-to-image (download em PNG). Por isso usa estilos inline.
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
  kicker: number; titulo: number; sub: number; body: number;
  footerLogoH: number; byLogoH: number;
}> = {
  a4: {
    w: 794, h: 1123, pad: 56,
    frameTop: 168, frameBot: 132,
    logoH: 64, logoW: 340, illoH: 168, illoW: 230,
    kicker: 13, titulo: 30, sub: 19, body: 14.5,
    footerLogoH: 38, byLogoH: 32,
  },
  celular: {
    w: 1080, h: 1350, pad: 70,
    frameTop: 210, frameBot: 168,
    logoH: 90, logoW: 470, illoH: 240, illoW: 320,
    kicker: 17, titulo: 40, sub: 25, body: 19,
    footerLogoH: 52, byLogoH: 44,
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
  /** Logo do(a) sindico(a)/administradora (rodape, quando By Sindicompany). */
  logoSindicoUrl?: string | null;
  /** Logo "by sindicompany" dos assets (rodape, quando By Sindicompany). */
  byLogoUrl?: string | null;
  /** true quando o sindico do condo e By Sindicompany (2 logos no rodape). */
  ehBy: boolean;
}

export function ComunicadoArt(props: ComunicadoArtProps) {
  const d = DIMS[props.variant];
  const paras = (props.corpo || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const topLogo = props.logoCondominioUrl || props.logoSindicoUrl || null;

  // Rodape: By -> logo do sindico + logo by sindicompany; senao -> logo Sindicompany.
  const footerNodes = props.ehBy && (props.logoSindicoUrl || props.byLogoUrl) ? (
    <>
      {props.logoSindicoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.logoSindicoUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: d.footerLogoH, maxWidth: d.w * 0.32, objectFit: "contain" }} />
      )}
      {props.logoSindicoUrl && props.byLogoUrl && (
        <span style={{ width: 1, height: d.footerLogoH * 0.8, background: "rgba(0,0,0,.18)" }} />
      )}
      {props.byLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.byLogoUrl} alt="by sindicompany" crossOrigin="anonymous" style={{ maxHeight: d.byLogoH, maxWidth: d.w * 0.3, objectFit: "contain" }} />
      )}
    </>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SINDICOMPANY_LOGO} alt="Sindicompany" crossOrigin="anonymous" style={{ maxHeight: d.footerLogoH, maxWidth: d.w * 0.42, objectFit: "contain" }} />
  );

  return (
    <div
      id={props.nodeId}
      style={{
        position: "relative", width: d.w, height: d.h, background: PAPER,
        fontFamily: "'Epilogue', 'DejaVu Sans', sans-serif", color: INK,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      {/* Ilustracao no canto superior direito */}
      {props.ilustracaoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={props.ilustracaoUrl}
          alt=""
          aria-hidden="true"
          crossOrigin="anonymous"
          style={{ position: "absolute", top: 0, right: 0, maxHeight: d.illoH + d.pad * 0.6, maxWidth: d.illoW, objectFit: "contain" }}
        />
      )}

      {/* Logo do condominio no canto superior esquerdo */}
      <div style={{ position: "absolute", top: d.pad * 0.7, left: d.pad, maxWidth: d.logoW }}>
        {topLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={topLogo} alt={props.condominio} crossOrigin="anonymous" style={{ maxHeight: d.logoH, maxWidth: d.logoW, objectFit: "contain" }} />
        ) : (
          <div style={{ fontFamily: "'Provicali', 'Liberation Serif', serif", fontSize: d.titulo, color: ONIX, lineHeight: 1, letterSpacing: "-0.01em" }}>
            {props.condominio}
          </div>
        )}
      </div>

      {/* Moldura mint */}
      <div style={{ position: "absolute", top: d.frameTop, left: d.pad * 0.85, right: d.pad * 0.85, bottom: d.frameBot, border: `2px solid ${MINT}` }} />

      {/* Conteudo */}
      <div
        style={{
          position: "absolute",
          top: d.frameTop + d.pad * 0.85,
          left: d.pad * 0.85 + d.pad * 0.85,
          right: d.pad * 0.85 + d.pad * 0.85,
          bottom: d.frameBot + d.pad * 0.6,
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ color: MINT_DARK, fontWeight: 700, fontSize: d.kicker, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: d.pad * 0.18 }}>
          Comunicado importante
        </div>
        <h1 style={{ color: MINT_DARK, fontWeight: 800, fontSize: d.titulo, lineHeight: 1.08, margin: 0 }}>{props.titulo}</h1>
        {props.subtitulo && (
          <div style={{ color: MINT_DARK, fontWeight: 700, fontSize: d.sub, lineHeight: 1.15, marginTop: d.pad * 0.1 }}>{props.subtitulo}</div>
        )}
        <div style={{ marginTop: d.pad * 0.7, fontSize: d.body, lineHeight: 1.6, color: INK, textAlign: "justify" }}>
          {paras.length ? (
            paras.map((p, i) => <p key={i} style={{ margin: `0 0 ${d.pad * 0.5}px` }}>{p}</p>)
          ) : (
            <p style={{ margin: 0, color: "#9ca3af" }}>(sem texto)</p>
          )}
        </div>
      </div>

      {/* Rodape: logotipos centralizados */}
      <div style={{ position: "absolute", bottom: d.pad * 0.5, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: d.pad * 0.45 }}>
        {footerNodes}
      </div>
    </div>
  );
}
