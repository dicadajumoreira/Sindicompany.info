import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  ICON_CARROSSEL_MAX_SLOTS,
  ICON_MAX_SLOTS,
  LOGO_MAX_SLOTS,
  PATTERN_MAX_SLOTS,
  listConsvictaIconCarrosselUrls,
  listConsvictaIconUrls,
  listConsvictaLogoUrls,
  listConsvictaPatternUrls,
} from "@/lib/sindicompany/condominios-db";
import {
  getConsvictaIconCarrosselUploadIntent,
  getConsvictaIconUploadIntent,
  getConsvictaLogoUploadIntent,
  getConsvictaPatternUploadIntent,
} from "../revista/nova/upload-actions";
import { AssetSlotGrid } from "../asset-slot-grid";
import { DashboardShell } from "../shell";
import { UploadLibraryButton } from "./upload-library-button";
import {
  CONSVICTA_LIBRARY_FUNDOS,
  CONSVICTA_LIBRARY_ICONS,
  CONSVICTA_LIBRARY_LOGOS,
  CONSVICTA_LIBRARY_PATTERNS,
} from "./library-manifest";

/** Biblioteca embutida (public/consvicta-library): logos e ícones servidos
 *  via CDN como assets estáticos. Lista vem do manifesto hardcoded —
 *  evita fs.readdir em runtime (que NÃO funciona em serverless do
 *  Netlify/Vercel — public/ é estático no CDN, não no Node). */
function readEmbeddedLibrary(): {
  logos: string[];
  patterns: string[];
  fundos: string[];
  iconsByCategory: Array<{ category: string; files: string[] }>;
} {
  const byCat = new Map<string, string[]>();
  for (const f of CONSVICTA_LIBRARY_ICONS) {
    const idx = f.indexOf("_");
    const cat = idx > 0 ? f.slice(0, idx) : "Outros";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(f);
  }
  const iconsByCategory = Array.from(byCat.entries())
    .map(([category, files]) => ({ category, files: [...files].sort() }))
    .sort((a, b) => a.category.localeCompare(b.category));
  return {
    logos: [...CONSVICTA_LIBRARY_LOGOS].sort(),
    patterns: [...CONSVICTA_LIBRARY_PATTERNS].sort(),
    fundos: [...CONSVICTA_LIBRARY_FUNDOS].sort(),
    iconsByCategory,
  };
}

export default async function ConsvictaAssetsPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const patterns = await safe(
    listConsvictaPatternUrls,
    Array(PATTERN_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const icons = await safe(
    listConsvictaIconUrls,
    Array(ICON_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const fundos = await safe(
    listConsvictaIconCarrosselUrls,
    Array(ICON_CARROSSEL_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const logos = await safe(
    listConsvictaLogoUrls,
    Array(LOGO_MAX_SLOTS).fill(null) as (string | null)[],
  );

  const library = readEmbeddedLibrary();

  return (
    <DashboardShell>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <Link
          href="/sindicompany/dashboard"
          className="text-sm text-g60 hover:text-onix-900 inline-block"
        >
          ← Voltar
        </Link>

        <header>
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            Tema · Carrossel @consvictabr
          </div>
          <h1 className="text-3xl font-bold text-onix-900 mb-2">
            Assets Consvicta
          </h1>
          <p className="text-sm text-g60 max-w-2xl mb-4">
            Assets exclusivos dos carrosséis da marca{" "}
            <strong className="text-onix-900">@consvictabr</strong>. A engine
            usa estes buckets quando o carrossel for criado com a marca
            Consvicta. JPG, PNG, WebP e SVG. Máx 10MB cada.
          </p>
        </header>

        {/* Botao "Subir biblioteca" SEMPRE visivel — independente da
            biblioteca embutida ter carregado, do tamanho da tela, ou
            de qualquer estado. Comeca aqui pra ser a primeira acao
            visivel da pagina. */}
        <UploadLibraryButton />

        {(library.logos.length > 0 ||
          library.iconsByCategory.length > 0) && (
          <section className="rounded-lg border border-mint-200 bg-mint-50/50 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">📚</span>
              <div>
                <h2 className="text-sm font-semibold text-onix-900 mb-1">
                  Biblioteca embutida (sistema)
                </h2>
                <p className="text-xs text-g60 max-w-2xl">
                  Assets oficiais da Consvicta carregados pelo engine direto
                  do código (não dependem dos slots abaixo). Logos servem
                  como referência para upload nos slots; ícones são
                  selecionados automaticamente pelo smart-picker conforme
                  o título/body de cada slide.
                </p>
              </div>
            </div>

            {library.logos.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs uppercase tracking-wider text-onix-700 font-semibold mb-2">
                  Logotipos ({library.logos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {library.logos.map((f) => (
                    <div
                      key={f}
                      className="rounded border border-onix-100 bg-white p-3 flex flex-col items-center gap-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/consvicta-library/logos/${f}`}
                        alt={f}
                        className="h-10 w-auto"
                      />
                      <code className="text-[10px] text-g60 break-all">
                        {f}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {library.patterns.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs uppercase tracking-wider text-onix-700 font-semibold mb-2">
                  Patterns ({library.patterns.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {library.patterns.map((f) => (
                    <div
                      key={f}
                      className="rounded border border-onix-100 bg-white overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/consvicta-library/patterns/${f}`}
                        alt={f}
                        className="w-full aspect-square object-cover block"
                      />
                      <code className="block px-2 py-1.5 text-[10px] text-g60 break-all">
                        {f.replace("pattern-", "").replace(".svg", "")}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {library.fundos.length > 0 && (
              <div className="mb-5">
                <h3 className="text-xs uppercase tracking-wider text-onix-700 font-semibold mb-2">
                  Fundos ({library.fundos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {library.fundos.map((f) => (
                    <div
                      key={f}
                      className="rounded border border-onix-100 bg-white overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/consvicta-library/fundos/${f}`}
                        alt={f}
                        className="w-full aspect-square object-cover block"
                      />
                      <code className="block px-2 py-1.5 text-[10px] text-g60 break-all">
                        {f.replace("fundo-", "").replace(".svg", "")}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {library.iconsByCategory.map(({ category, files }) => (
              <div key={category} className="mb-4 last:mb-0">
                <h3 className="text-xs uppercase tracking-wider text-onix-700 font-semibold mb-2">
                  {category.replace(/_/g, " ")} ({files.length})
                </h3>
                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
                  {files.map((f) => (
                    <div
                      key={f}
                      title={f}
                      className="rounded border border-onix-100 bg-white p-2 aspect-square flex items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/consvicta-library/icons/${f}`}
                        alt={f}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Patterns</h2>
          <p className="text-xs text-g60 mb-4">
            Texturas de fundo dos slides (40% opacity).{" "}
            {patterns.length} slot{patterns.length === 1 ? "" : "s"} ·
            biblioteca embutida tem {CONSVICTA_LIBRARY_PATTERNS.length}.
          </p>
          <AssetSlotGrid
            storageKey="consvicta.patterns"
            label="Pattern"
            initialUrls={patterns}
            uploadIntent={getConsvictaPatternUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Icons</h2>
          <p className="text-xs text-g60 mb-4">
            Biblioteca de ícones (slot 2 = capa, slot 6 = CTA).{" "}
            {icons.length} slot{icons.length === 1 ? "" : "s"} ·
            biblioteca embutida tem {CONSVICTA_LIBRARY_ICONS.length}.
          </p>
          <AssetSlotGrid
            storageKey="consvicta.icons"
            label="Icon"
            initialUrls={icons}
            uploadIntent={getConsvictaIconUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">
            Fundo Carrossel
          </h2>
          <p className="text-xs text-g60 mb-4">
            Imagens de fundo dos slides: slot 1 → slide 1 (capa), slot 2 →
            slide 2, …. {fundos.length} slot{fundos.length === 1 ? "" : "s"} ·
            biblioteca embutida tem {CONSVICTA_LIBRARY_FUNDOS.length}.
          </p>
          <AssetSlotGrid
            storageKey="consvicta.fundos"
            label="Fundo"
            hint={(slot) => `Slide ${slot}`}
            initialUrls={fundos}
            uploadIntent={getConsvictaIconCarrosselUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Logotipos</h2>
          <p className="text-xs text-g60 mb-4">
            Variantes do logo Consvicta (slot 1 = topo dos slides, slot 2 =
            watermark). {logos.length} slot{logos.length === 1 ? "" : "s"} ·
            biblioteca embutida tem {CONSVICTA_LIBRARY_LOGOS.length}.
          </p>
          <AssetSlotGrid
            storageKey="consvicta.logos"
            label="Logo"
            aspect="wide"
            initialUrls={logos}
            uploadIntent={getConsvictaLogoUploadIntent}
            gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          />
        </section>
      </main>
    </DashboardShell>
  );
}
