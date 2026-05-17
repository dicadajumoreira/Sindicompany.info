import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ASSET_HIERARCHY,
  AssetBrand,
  AssetNode,
  basenameForLeaf,
  BRAND_HANDLE,
  BRAND_LABEL,
  BRAND_ROUTE,
  bucketForLeaf,
  findNode,
} from "@/lib/sindicompany/asset-hierarchy";
import { AssetSlotGrid } from "./asset-slot-grid";
import { DashboardShell } from "./shell";
import { UploadLibraryButton } from "./consvicta-assets/upload-library-button";
import { UploadLibraryButtonSindicompany } from "./assets/upload-library-button";
import { NoLibraryNote } from "./no-library-note";

const BUCKET = "condominios-fotos";

/** Lista URLs publicas dos arquivos de um bucket prefix.
 *  Detecta o maior slot ocupado e retorna array sparse. Tamanho >= 20
 *  pra ter slots vazios pro user fazer novo upload. */
async function listLeafSlotUrls(
  bucketPrefix: string,
  basename: string,
): Promise<(string | null)[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(bucketPrefix, { limit: 1000 });
    if (error || !data) return Array(20).fill(null);
    const re = new RegExp(`^${basename}-(\\d{1,3})\\.(png|jpg|jpeg|webp|svg)$`, "i");
    const found = new Map<number, string>();
    let maxSlot = 20;
    for (const obj of data) {
      const m = obj.name.match(re);
      if (!m) continue;
      const slot = parseInt(m[1], 10);
      if (slot < 1) continue;
      const { data: pub } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${bucketPrefix}/${obj.name}`);
      found.set(
        slot,
        `${pub.publicUrl}?v=${obj.updated_at ?? obj.created_at ?? Date.now()}`,
      );
      if (slot > maxSlot) maxSlot = slot;
    }
    const bySlot: (string | null)[] = Array(maxSlot).fill(null);
    for (const [slot, url] of found.entries()) bySlot[slot - 1] = url;
    return bySlot;
  } catch {
    return Array(20).fill(null);
  }
}

interface AssetExplorerProps {
  brand: AssetBrand;
  /** Path do URL — vazio = hub, array = profundidade da arvore. */
  path: string[];
  /** Server action de upload — recebe o bucket prefix + basename e
   *  devolve UploadIntent. Definido em cada rota brand-specific. */
  uploadIntent: (
    bucket: string,
    basename: string,
    slot: number,
    ext: string,
  ) => Promise<
    | { ok: true; uploadUrl: string; token: string; path: string; publicUrl: string }
    | { ok: false; error: string }
  >;
}

export async function AssetExplorer({ brand, path, uploadIntent }: AssetExplorerProps) {
  const brandLabel = BRAND_LABEL[brand];
  const brandHandle = BRAND_HANDLE[brand];
  const brandRoute = BRAND_ROUTE[brand];

  // Path vazio = HUB (visao geral das 6 secoes)
  if (path.length === 0) {
    return <HubView brand={brand} />;
  }

  // Encontra o node
  const node = findNode(path);
  if (!node) {
    return <NotFoundView brand={brand} brandLabel={brandLabel} brandRoute={brandRoute} />;
  }

  // Tem children = BRANCH (mostra subcategorias)
  if (node.children && node.children.length > 0) {
    return (
      <BranchView
        brand={brand}
        brandLabel={brandLabel}
        brandRoute={brandRoute}
        path={path}
        node={node}
      />
    );
  }

  // Sem children = LEAF (mostra slot grid)
  return (
    <LeafView
      brand={brand}
      brandLabel={brandLabel}
      brandHandle={brandHandle}
      brandRoute={brandRoute}
      path={path}
      node={node}
      uploadIntent={uploadIntent}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// HUB — visao geral das 6 secoes da marca
// ─────────────────────────────────────────────────────────────────────
function HubView({ brand }: { brand: AssetBrand }) {
  const brandLabel = BRAND_LABEL[brand];
  const brandHandle = BRAND_HANDLE[brand];
  const brandRoute = BRAND_ROUTE[brand];

  return (
    <DashboardShell>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Link
          href="/sindicompany/dashboard"
          className="text-sm text-g60 hover:text-onix-900 inline-block"
        >
          ← Voltar
        </Link>

        <header>
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            Assets · {brandHandle}
          </div>
          <h1 className="text-3xl font-bold text-onix-900 mb-2">
            Assets {brandLabel}
          </h1>
          <p className="text-sm text-g60 max-w-2xl">
            Biblioteca completa de assets da marca {brandLabel}. Organizada em 4
            pilares: <strong>Brand Assets</strong> (institucional),{" "}
            <strong>Social Media</strong> (capas + carrosséis + CTAs +
            elementos), <strong>Visual Library</strong> (patterns + fotografia
            + backgrounds + ícones) e <strong>AI Ready Assets</strong>{" "}
            (prompts + composições + regras + templates).
          </p>
        </header>

        {brand === "consvictabr" ? (
          <UploadLibraryButton />
        ) : brand === "sindicompanybr" ? (
          <UploadLibraryButtonSindicompany />
        ) : (
          <NoLibraryNote brand={brandLabel} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ASSET_HIERARCHY.map((section) => (
            <Link
              key={section.slug}
              href={`${brandRoute}/${section.slug}`}
              className="rounded-lg border border-onix-100 bg-white p-5 hover:border-mint-400 hover:shadow-md transition group"
            >
              <h2 className="text-sm font-semibold text-onix-900 mb-1 group-hover:text-mint-700">
                {section.label}
              </h2>
              {section.description && (
                <p className="text-xs text-g60 mb-3">{section.description}</p>
              )}
              <div className="text-[10px] text-onix-500 uppercase tracking-wider">
                {section.children?.length ?? 0} categorias
              </div>
            </Link>
          ))}
        </div>
      </main>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BRANCH — node intermediário, mostra subcategorias clicáveis
// ─────────────────────────────────────────────────────────────────────
function BranchView({
  brandLabel,
  brandRoute,
  path,
  node,
}: {
  brand: AssetBrand;
  brandLabel: string;
  brandRoute: string;
  path: string[];
  node: AssetNode;
}) {
  return (
    <DashboardShell>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Breadcrumb brandLabel={brandLabel} brandRoute={brandRoute} path={path} />

        <header>
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            {brandLabel} · {path.slice(0, -1).join(" › ") || "Section"}
          </div>
          <h1 className="text-3xl font-bold text-onix-900 mb-2">{node.label}</h1>
          {node.description && (
            <p className="text-sm text-g60 max-w-2xl">{node.description}</p>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(node.children ?? []).map((child) => (
            <Link
              key={child.slug}
              href={`${brandRoute}/${path.join("/")}/${child.slug}`}
              className="rounded-lg border border-onix-100 bg-white p-4 hover:border-mint-400 hover:shadow-sm transition group"
            >
              <h2 className="text-sm font-semibold text-onix-900 group-hover:text-mint-700 mb-1">
                {child.label}
              </h2>
              <div className="text-[10px] text-onix-500 uppercase tracking-wider">
                {child.children?.length
                  ? `${child.children.length} subcategorias`
                  : "Asset slots"}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LEAF — node final, mostra AssetSlotGrid
// ─────────────────────────────────────────────────────────────────────
async function LeafView({
  brand,
  brandLabel,
  brandHandle,
  brandRoute,
  path,
  node,
  uploadIntent,
}: {
  brand: AssetBrand;
  brandLabel: string;
  brandHandle: string;
  brandRoute: string;
  path: string[];
  node: AssetNode;
  uploadIntent: AssetExplorerProps["uploadIntent"];
}) {
  const bucket = bucketForLeaf(brand, path, node);
  const basename = basenameForLeaf(node);
  const urls = await listLeafSlotUrls(bucket, basename);

  // Server action thin wrapper que injeta bucket+basename antes do
  // upload intent generico fornecido pela rota.
  async function leafUploadIntent(
    slot: number,
    ext: string,
  ): Promise<
    | { ok: true; uploadUrl: string; token: string; path: string; publicUrl: string }
    | { ok: false; error: string }
  > {
    "use server";
    return uploadIntent(bucket, basename, slot, ext);
  }

  const storageKey = `${brand}.${path.join(".")}`;

  return (
    <DashboardShell>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Breadcrumb brandLabel={brandLabel} brandRoute={brandRoute} path={path} />

        <header>
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            {brandHandle} · {path.slice(0, -1).join(" › ")}
          </div>
          <h1 className="text-3xl font-bold text-onix-900 mb-2">{node.label}</h1>
          <p className="text-sm text-g60 max-w-2xl">
            {urls.length} slot{urls.length === 1 ? "" : "s"} ·{" "}
            <code className="text-[11px] bg-onix-50 px-1 rounded">{bucket}</code>
            {node.legacyBucket && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-mint-700">
                legacy bucket
              </span>
            )}
          </p>
        </header>

        <AssetSlotGrid
          storageKey={storageKey}
          label={node.label}
          initialUrls={urls}
          uploadIntent={leafUploadIntent}
        />
      </main>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 404 — path invalido
// ─────────────────────────────────────────────────────────────────────
function NotFoundView({
  brandLabel,
  brandRoute,
}: {
  brand: AssetBrand;
  brandLabel: string;
  brandRoute: string;
}) {
  return (
    <DashboardShell>
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <Link
          href={brandRoute}
          className="text-sm text-g60 hover:text-onix-900 inline-block"
        >
          ← Assets {brandLabel}
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-onix-900 mb-2">
            Categoria não encontrada
          </h1>
          <p className="text-sm text-g60">
            Esta categoria não existe nesta marca. Volta pro hub e escolhe uma
            seção válida.
          </p>
        </header>
      </main>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Breadcrumb compartilhado
// ─────────────────────────────────────────────────────────────────────
function Breadcrumb({
  brandLabel,
  brandRoute,
  path,
}: {
  brandLabel: string;
  brandRoute: string;
  path: string[];
}) {
  const parts: { label: string; href: string }[] = [
    { label: brandLabel, href: brandRoute },
  ];
  let acc: string[] = [];
  let level: AssetNode[] = ASSET_HIERARCHY;
  for (const slug of path) {
    const node = level.find((n) => n.slug === slug);
    if (!node) break;
    acc = [...acc, slug];
    parts.push({ label: node.label, href: `${brandRoute}/${acc.join("/")}` });
    level = node.children ?? [];
  }
  // Ultimo node nao precisa ser link
  return (
    <nav className="text-sm text-g60 flex items-center gap-1.5 flex-wrap">
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-onix-300">/</span>}
            {isLast ? (
              <span className="text-onix-900 font-medium">{p.label}</span>
            ) : (
              <Link href={p.href} className="hover:text-onix-900">
                {p.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
