"use client";

import { useState } from "react";
import { toPng } from "html-to-image";

interface PrintButtonProps {
  baseName?: string;
}

export function PrintButton({ baseName }: PrintButtonProps) {
  const [busy, setBusy] = useState<"pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function baixarPdf() {
    setBusy("pdf");
    setErro(null);
    try {
      const pages = Array.from(document.querySelectorAll<HTMLElement>(".bv-page"));
      if (pages.length === 0) {
        setErro("Páginas não encontradas.");
        setBusy(null);
        return;
      }
      // Em telas pequenas (mobile), reduz o pixel ratio pra nao estourar
      // a memoria do canvas em iOS Safari / Android Chrome (geram OOM
      // silencioso em A4 com pixelRatio 2+).
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
      const pixelRatio = isMobile ? 1.3 : 2;
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (let i = 0; i < pages.length; i++) {
        // Dois passes ajudam a embutir imagens externas (logos, ilustracoes)
        // com fontes carregadas.
        await toPng(pages[i], { cacheBust: true, pixelRatio });
        const dataUrl = await toPng(pages[i], {
          cacheBust: true,
          pixelRatio,
          backgroundColor: "#FFFFFF",
        });
        if (i > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297, undefined, "FAST");
      }
      const file = (baseName?.trim() || "revista-boas-vindas")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const fileName = `${file || "revista-boas-vindas"}.pdf`;

      // Em desktop o pdf.save() resolve. Em mobile o atributo download
      // do <a> nao e confiavel (especialmente iOS Safari): abre num
      // ObjectURL em nova aba, ai o usuario salva pelo proprio navegador.
      if (isMobile) {
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          // Pop-up bloqueado: faz o download tradicional como fallback.
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        // Libera o ObjectURL depois de uns segundos pra a aba conseguir ler.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        pdf.save(fileName);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={baixarPdf}
        disabled={busy !== null}
        className="rounded-md bg-mint-600 hover:bg-mint-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5"
      >
        {busy === "pdf" ? "Gerando PDF…" : "Baixar PDF"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        disabled={busy !== null}
        className="rounded-md border border-white/30 text-white text-xs font-medium px-3 py-1.5 hover:bg-white/10 disabled:opacity-50"
      >
        Imprimir
      </button>
      {erro && <span className="text-xs text-rose-300 ml-2">{erro}</span>}
    </div>
  );
}
