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
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (let i = 0; i < pages.length; i++) {
        // Dois passes ajudam a embutir imagens externas (logos, ilustracoes)
        // com fontes carregadas. Pixel ratio 2 da nitidez razoavel pra A4
        // sem inflar o arquivo demais.
        await toPng(pages[i], { cacheBust: true, pixelRatio: 2 });
        const dataUrl = await toPng(pages[i], {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#FFFFFF",
        });
        if (i > 0) pdf.addPage("a4", "portrait");
        // A4 em mm: 210 x 297. Adiciona cada pagina como imagem ocupando
        // a folha inteira (full bleed).
        pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297, undefined, "FAST");
      }
      const file = (baseName?.trim() || "revista-boas-vindas")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      pdf.save(`${file || "revista-boas-vindas"}.pdf`);
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
