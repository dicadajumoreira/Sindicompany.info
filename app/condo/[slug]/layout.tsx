import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { href: "", label: "Visão Geral" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/engenharia", label: "Apontamentos" },
  { href: "/gestao", label: "Gestão de Pessoas" },
  { href: "/juridico", label: "Jurídico" },
  { href: "/plano", label: "Plano Diretor" },
  { href: "/valpatrimonial", label: "Valorização Patrimonial" },
  { href: "/documentos", label: "Documentos" },
] as const;

export default async function CondoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: condo } = await supabase
    .from("condos")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!condo) notFound();

  return (
    <div className="min-h-screen bg-onix-50">
      <header className="border-b border-onix-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-onix-900">
                {condo.name}
              </h1>
              <p className="text-xs text-g60">{condo.slug}.sindico.info</p>
            </div>
            <Link
              href="/admin/condos"
              className="text-sm text-g60 hover:text-onix-900"
            >
              ← Painel
            </Link>
          </div>
          <nav className="mt-4 flex flex-wrap gap-1 -mb-px">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={`/condo/${slug}${tab.href}`}
                className="px-3 py-2 text-sm font-medium text-g60 hover:text-onix-900 border-b-2 border-transparent hover:border-mint"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
