"use client";

import { useState } from "react";
import { toPng } from "html-to-image";

interface PrintButtonProps {
  baseName?: string;
}

export function PrintButton({ baseName }: PrintButtonProps) {
  const [busy, setBusy] = useState<"pdf" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);

  // Click handler precisa ser SINCRONO no inicio pra preservar o "user
  // gesture" do navegador — se nao, iOS Safari bloqueia window.open().
  function baixarPdf() {
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
    // Abre a aba JA, sincrono, dentro do user gesture. Vamos atualizar a
    // location dela depois com o ObjectURL do PDF.
    const novaAba = isMobile ? window.open("", "_blank") : null;
    if (isMobile && novaAba) {
      // Mensagem de "carregando" enquanto o PDF gera.
      try {
        novaAba.document.write(
          '<html><head><title>Preparando PDF…</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family: system-ui, sans-serif; padding: 24px; text-align: center; color: #1A1C29;"><p style="margin-top: 40vh; font-size: 18px;">Gerando PDF da Revista de Boas-Vindas…</p><p style="font-size: 14px; color: #6b7280;">Isso pode levar alguns segundos.</p></body></html>',
        );
      } catch {
        /* ignore: about:blank as cross-origin? */
      }
    }

    void (async () => {
      setBusy("pdf");
      setErro(null);
      setProgresso(null);
      try {
        const pages = Array.from(document.querySelectorAll<HTMLElement>(".bv-page"));
        if (pages.length === 0) {
          setErro("Páginas não encontradas.");
          if (novaAba) novaAba.close();
          setBusy(null);
          return;
        }
        // Em mobile, pixelRatio 1 evita OOM no canvas (A4 a 96dpi ja da uma
        // imagem boa pra leitura em tela; pra print, melhor usar desktop).
        const pixelRatio = isMobile ? 1 : 2;
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

        for (let i = 0; i < pages.length; i++) {
          setProgresso(`Página ${i + 1} de ${pages.length}…`);
          let dataUrl: string;
          try {
            // Primeiro pass aquece a embeddable imagens (logos, ilustracao).
            await toPng(pages[i], { cacheBust: true, pixelRatio });
            dataUrl = await toPng(pages[i], {
              cacheBust: true,
              pixelRatio,
              backgroundColor: "#FFFFFF",
            });
          } catch (e) {
            throw new Error(`Página ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
          }
          if (i > 0) pdf.addPage("a4", "portrait");
          pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297, undefined, "FAST");
        }

        const file = (baseName?.trim() || "revista-boas-vindas")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        const fileName = `${file || "revista-boas-vindas"}.pdf`;

        if (isMobile) {
          const blob = pdf.output("blob");
          const url = URL.createObjectURL(blob);
          if (novaAba && !novaAba.closed) {
            // Aba aberta sincronamente; trocar a location agora funciona.
            novaAba.location.href = url;
          } else {
            // Aba foi bloqueada / fechada: tenta o download tradicional.
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          // Mantem o blob na memoria por um tempo pra a aba conseguir ler.
          setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
        } else {
          pdf.save(fileName);
        }
      } catch (e) {
        if (novaAba && !novaAba.closed) {
          try {
            novaAba.document.body.innerHTML =
              '<p style="font-family:system-ui,sans-serif;padding:24px;color:#b91c1c;">Falha ao gerar o PDF. Fecha esta aba e tenta de novo, ou usa um computador.</p>';
          } catch {
            /* ignore */
          }
        }
        setErro(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
      } finally {
        setBusy(null);
        setProgresso(null);
      }
    })();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={baixarPdf}
        disabled={busy !== null}
        className="rounded-md bg-mint-600 hover:bg-mint-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5"
      >
        {busy === "pdf" ? (progresso ?? "Gerando PDF…") : "Baixar PDF"}
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
