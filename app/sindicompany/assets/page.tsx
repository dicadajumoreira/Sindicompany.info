import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  ICON_CARROSSEL_MAX_SLOTS,
  ICON_MAX_SLOTS,
  LOGO_MAX_SLOTS,
  PATTERN_MAX_SLOTS,
  listIconCarrosselUrls,
  listIconUrls,
  listLogoUrls,
  listPatternUrls,
} from "@/lib/sindicompany/condominios-db";
import {
  getIconCarrosselUploadIntent,
  getIconUploadIntent,
  getLogoUploadIntent,
  getPatternUploadIntent,
} from "../revista/nova/upload-actions";
import { AssetSlotGrid } from "../asset-slot-grid";
import { DashboardShell } from "../shell";
import { NoLibraryNote } from "../no-library-note";

export default async function AssetsSindicompanyPage() {
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
    listPatternUrls,
    Array(PATTERN_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const icons = await safe(
    listIconUrls,
    Array(ICON_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const fundos = await safe(
    listIconCarrosselUrls,
    Array(ICON_CARROSSEL_MAX_SLOTS).fill(null) as (string | null)[],
  );
  const logos = await safe(
    listLogoUrls,
    Array(LOGO_MAX_SLOTS).fill(null) as (string | null)[],
  );

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
            Tema · Carrossel @sindicompanybr
          </div>
          <h1 className="text-3xl font-bold text-onix-900 mb-2">
            Assets Sindicompany
          </h1>
          <p className="text-sm text-g60 max-w-2xl mb-4">
            Assets exclusivos dos carrosséis da marca{" "}
            <strong className="text-onix-900">@sindicompanybr</strong>. A engine
            usa estes buckets quando o carrossel for criado com a marca
            Sindicompany (padrão). JPG, PNG, WebP e SVG. Máx 10MB cada.
          </p>
        </header>

        <NoLibraryNote brand="Sindicompany" />

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Patterns</h2>
          <p className="text-xs text-g60 mb-4">
            Texturas de fundo dos slides (10% opacity). {patterns.length} slot
            {patterns.length === 1 ? "" : "s"}.
          </p>
          <AssetSlotGrid
            storageKey="sindicompany.patterns"
            label="Pattern"
            initialUrls={patterns}
            uploadIntent={getPatternUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Icons</h2>
          <p className="text-xs text-g60 mb-4">
            Biblioteca de ícones (slot 2 = capa, slot 6 = CTA). {icons.length}{" "}
            slot{icons.length === 1 ? "" : "s"}.
          </p>
          <AssetSlotGrid
            storageKey="sindicompany.icons"
            label="Icon"
            initialUrls={icons}
            uploadIntent={getIconUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">
            Fundo Carrossel
          </h2>
          <p className="text-xs text-g60 mb-4">
            Imagens de fundo dos slides: slot 1 → slide 2, slot 2 → slide 3, ….{" "}
            {fundos.length} slot{fundos.length === 1 ? "" : "s"}.
          </p>
          <AssetSlotGrid
            storageKey="sindicompany.fundos"
            label="Fundo"
            hint={(slot) => `Slide ${slot + 1}`}
            initialUrls={fundos}
            uploadIntent={getIconCarrosselUploadIntent}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-onix-900 mb-1">Logotipos</h2>
          <p className="text-xs text-g60 mb-4">
            Variantes do logo Sindicompany (slot 5 = topo dos slides).{" "}
            {logos.length} slot{logos.length === 1 ? "" : "s"}.
          </p>
          <AssetSlotGrid
            storageKey="sindicompany.logos"
            label="Logo"
            aspect="wide"
            initialUrls={logos}
            uploadIntent={getLogoUploadIntent}
            gridClassName="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          />
        </section>
      </main>
    </DashboardShell>
  );
}
