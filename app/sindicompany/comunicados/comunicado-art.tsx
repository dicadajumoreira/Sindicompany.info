"use client";

/**
 * Arte do comunicado, renderizada em pixels exatos para os 2 formatos:
 *  - "a4"      : 794 x 1123 px   (A4 retrato @ 96dpi, para impressao/mural)
 *  - "celular" : 1080 x 1920 px  (Story do Instagram, 9:16)
 *
 * O mesmo no e usado para o preview na tela e como alvo do html-to-image
 * (download em PNG). Por isso usa estilos inline.
 *
 * Layout:
 *  - logotipo do condominio: alinhado a moldura vertical (15mm da borda),
 *    ocupando ate 50% da largura, sem distorcer, centralizado verticalmente
 *    entre a borda do topo e a linha horizontal da moldura.
 *  - ilustracao: canto superior direito, 8mm das bordas, POR CIMA da moldura.
 *  - moldura mint: laterais a 15mm das bordas; a linha horizontal fica 5mm
 *    "atras" da ilustracao (a ilustracao a cobre); aberta embaixo. A posicao
 *    da linha se adequa a altura real da ilustracao (medida ao carregar).
 *  - conteudo: titulo a 4mm da moldura (e 4mm da ilustracao); texto vai ate a
 *    moldura direita (4mm de recuo).
 *  - rodape (centro, sem linha): logotipo do(a) sindico(a) [+ By Sindicompany].
 */

import { useEffect, useRef, useState } from "react";

const MINT = "#56CFE1";
const MINT_DARK = "#2E9AAC";
const INK = "#3A3D4A";
const ONIX = "#1E1E24";
const PAPER = "#FBFAF6";

const SINDICOMPANY_LOGO =
  "https://raw.githubusercontent.com/dicadajumoreira/Sindicompany/main/Logotipo%20Sindicompany%201.png";

type Variant = "a4" | "celular";

const DIMS: Record<Variant, {
  w: number; h: number; frameBot: number;
  logoH: number; mm15: number; mm8: number; mm5: number; mm4: number;
  titulo: number; sub: number; body: number;
  footerLogoH: number; byLogoH: number; footerGap: number;
}> = {
  a4: {
    // 15mm @ 96dpi (A4 = 210mm = 794px -> ~3.78px/mm).
    w: 794, h: 1123, frameBot: 100,
    logoH: 190, mm15: 57, mm8: 30, mm5: 19, mm4: 15,
    titulo: 30, sub: 18, body: 14,
    footerLogoH: 38, byLogoH: 32, footerGap: 24,
  },
  celular: {
    // Story do Instagram (1080x1920). Margens proporcionais; fontes ampliadas.
    w: 1080, h: 1920, frameBot: 150,
    logoH: 300, mm15: 84, mm8: 44, mm5: 28, mm4: 22,
    titulo: 52, sub: 33, body: 26,
    footerLogoH: 70, byLogoH: 58, footerGap: 36,
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
  const { mm15, mm8, mm4, w, h } = d;
  // Nunca exibir travessao no texto, venha de onde vier.
  const corpo = (props.corpo || "").replace(/\r\n/g, "\n").replace(/\s*[‐‑‒–—―]\s*/g, ", ").trimEnd();

  const temIlustracao = !!props.ilustracaoUrl;
  const usableW = w - 2 * mm15;

  // Logo: alinhado a moldura vertical (15mm da borda), ate 50% da largura.
  // Pinado proximo do topo (8mm) pra deixar o minimo de espaco no topo.
  const logoLeftX = mm15;
  const logoTopY = mm8;
  const logoW = Math.round(w * 0.5);

  // Ilustracao: canto superior direito, 8mm das bordas. Limites generosos.
  const illoTopY = mm8;
  const illoMaxW = Math.round(usableW * 0.33);
  const illoMaxH = Math.round(usableW * 0.62);

  // Altura realmente renderizada da ilustracao, medida ao carregar a imagem.
  const imgRef = useRef<HTMLImageElement>(null);
  const [illoH, setIlloH] = useState<number | null>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.offsetHeight) setIlloH(el.offsetHeight);
  }, [props.ilustracaoUrl]);

  // Base (y) da ilustracao e quanto ela "transpassa" a moldura (~12% da altura).
  const illoBottomY = temIlustracao && illoH ? illoTopY + illoH : 0;
  const illoOverlap = illoH ? Math.round(illoH * 0.12) : 0;
  // Linha horizontal da moldura:
  //  - sem ilustracao: 8mm abaixo do bloco do logo.
  //  - com ilustracao: logo abaixo da base da ilustracao (a ilustracao a
  //    transpassa, sem deixar espaco em branco entre as duas), respeitando um
  //    limite minimo (pra o logo caber acima) e maximo (pra sobrar espaco pro texto).
  const logoMinH = Math.round(d.logoH * 0.55);
  const minFrameTop = logoTopY + logoMinH + mm4;
  const maxFrameTop = Math.round(h * 0.36);
  const frameTop = temIlustracao && illoH
    ? Math.min(maxFrameTop, Math.max(minFrameTop, illoBottomY - illoOverlap))
    : logoTopY + d.logoH + mm8;
  // Altura util do bloco do logo (encolhe se a linha estiver alta).
  const logoBoxH = Math.min(d.logoH, frameTop - logoTopY - mm4);

  // x da borda esquerda da ilustracao (alinhada a direita, a 8mm da borda).
  const illoLeftX = w - mm8 - illoMaxW;
  // Linha horizontal do topo: do canto esquerdo da moldura ate ~8mm antes da
  // ilustracao (quando houver); senao atravessa toda a largura util.
  const topLineW = temIlustracao
    ? Math.max(logoW * 0.4, illoLeftX - mm8 - mm15)
    : usableW;
  // Texto do corpo vai ate a moldura direita (4mm de recuo).
  const contentRight = mm15 + mm4;
  // So o titulo recua a mais pra manter 4mm da ilustracao.
  const tituloMarginRight = temIlustracao ? Math.max(0, mm8 + illoMaxW + mm4 - mm15) : 0;
  // O corpo do texto comeca abaixo da base da ilustracao (caso ela ultrapasse a
  // linha) + 4mm; senao usa o espacamento normal apos o titulo.
  const tituloEstAltura = Math.round(d.titulo * 1.1) + (props.subtitulo ? Math.round(d.sub * 1.15) + Math.round(mm4 * 0.5) : 0);
  const bodyMarginTop = Math.max(
    Math.round(mm4 * 1.6),
    illoBottomY - frameTop + mm4 - tituloEstAltura,
  );

  // Rodape: lista de logos a mostrar (sindico [+ by] OU fallback Sindicompany).
  const footerImgs: { src: string; h: number; maxW: number }[] = [];
  if (props.ehBy) {
    if (props.logoSindicoUrl) footerImgs.push({ src: props.logoSindicoUrl, h: d.footerLogoH, maxW: w * 0.32 });
    if (props.byLogoUrl) footerImgs.push({ src: props.byLogoUrl, h: d.byLogoH, maxW: w * 0.3 });
    if (footerImgs.length === 0) footerImgs.push({ src: SINDICOMPANY_LOGO, h: d.footerLogoH, maxW: w * 0.42 });
  } else {
    footerImgs.push({ src: props.logoSindicoUrl || SINDICOMPANY_LOGO, h: d.footerLogoH, maxW: w * 0.42 });
  }

  return (
    <div
      id={props.nodeId}
      style={{
        position: "relative", width: w, height: h, background: PAPER,
        fontFamily: "'Epilogue', 'DejaVu Sans', sans-serif", color: INK,
        overflow: "hidden", boxSizing: "border-box",
      }}
    >
      {/* Logo do condominio */}
      <div style={{ position: "absolute", top: logoTopY, left: logoLeftX, width: logoW, height: logoBoxH, display: "flex", alignItems: "center", zIndex: 1 }}>
        {props.logoCondominioUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.logoCondominioUrl} alt={props.condominio} crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", objectPosition: "left center", display: "block" }} />
        ) : (
          <div style={{ fontFamily: "'Provicali', 'Liberation Serif', serif", fontSize: d.titulo * 1.3, color: ONIX, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
            {props.condominio}
          </div>
        )}
      </div>

      {/* Moldura mint: laterais a 15mm das bordas; ABERTA embaixo. */}
      <div
        style={{
          position: "absolute",
          top: frameTop, left: mm15, right: mm15, bottom: d.frameBot,
          borderLeft: `2px solid ${MINT}`,
          borderRight: `2px solid ${MINT}`,
          zIndex: 1,
        }}
      />
      {/* Linha horizontal do topo. Quando ha ilustracao, recua ~8mm antes dela. */}
      <div
        style={{
          position: "absolute",
          top: frameTop, left: mm15, width: topLineW, height: 2,
          background: MINT, zIndex: 1,
        }}
      />

      {/* Ilustracao: 8mm das bordas (topo e direita), POR CIMA da moldura. */}
      {props.ilustracaoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={props.ilustracaoUrl}
          alt=""
          aria-hidden="true"
          crossOrigin="anonymous"
          onLoad={(e) => setIlloH((e.currentTarget as HTMLImageElement).offsetHeight)}
          style={{ position: "absolute", top: illoTopY, right: mm8, maxHeight: illoMaxH, maxWidth: illoMaxW, display: "block", zIndex: 3 }}
        />
      )}

      {/* Conteudo */}
      <div
        style={{
          position: "absolute",
          top: frameTop + mm4,
          left: mm15 + mm4,
          right: contentRight,
          bottom: d.frameBot + mm4 * 2,
          display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 2,
        }}
      >
        <h1 style={{ color: MINT_DARK, fontWeight: 800, fontSize: d.titulo, lineHeight: 1.08, margin: 0, marginRight: tituloMarginRight }}>{props.titulo}</h1>
        {props.subtitulo && (
          <div style={{ color: MINT_DARK, fontWeight: 700, fontSize: d.sub, lineHeight: 1.15, marginTop: mm4 * 0.5, marginRight: tituloMarginRight }}>{props.subtitulo}</div>
        )}
        <div style={{ marginTop: bodyMarginTop, fontSize: d.body, lineHeight: 1.55, color: INK, textAlign: "justify", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {corpo ? corpo : <span style={{ color: "#9ca3af" }}>(sem texto)</span>}
        </div>
      </div>

      {/* Rodape: logotipo(s) centralizado(s), sem linha */}
      <div style={{ position: "absolute", bottom: mm15 * 0.6, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: d.footerGap, zIndex: 2 }}>
        {footerImgs.map((it, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: d.footerGap }}>
            {i > 0 && <span style={{ width: 1, height: it.h * 0.8, background: "rgba(0,0,0,.18)" }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.src} alt="" crossOrigin="anonymous" style={{ maxHeight: it.h, maxWidth: it.maxW, objectFit: "contain" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
