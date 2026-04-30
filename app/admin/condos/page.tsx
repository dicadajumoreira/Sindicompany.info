import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "sindico.info";

type CondoRow = {
  condo_id: string;
  role: string;
  condos: { id: string; slug: string; name: string } | null;
};

export default async function CondosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data, error } = await supabase
    .from("memberships")
    .select("condo_id, role, condos:condo_id (id, slug, name)")
    .order("created_at", { ascending: false });

  const memberships = (data ?? []) as unknown as CondoRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-onix-900">
            Meus condomínios
          </h1>
          <p className="text-sm text-g60 mt-1">
            Acesse ou gerencie os dashboards onde você tem acesso.
          </p>
        </div>
        <Link
          href="/admin/condos/new"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-onix-900 text-white text-sm font-medium hover:bg-onix-800"
        >
          + Novo condomínio
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          Erro ao carregar: {error.message}
        </p>
      )}

      {memberships.length === 0 ? (
        <div className="bg-white border border-dashed border-onix-100 rounded-xl p-12 text-center">
          <p className="text-onix-900 font-medium">Nenhum condomínio ainda</p>
          <p className="text-sm text-g60 mt-1">
            Crie seu primeiro dashboard para começar.
          </p>
          <Link
            href="/admin/condos/new"
            className="inline-flex items-center mt-4 px-4 py-2 rounded-lg bg-onix-900 text-white text-sm font-medium hover:bg-onix-800"
          >
            Criar condomínio
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memberships.map((m) => {
            const condo = m.condos;
            if (!condo) return null;
            const url = `https://${condo.slug}.${ROOT_DOMAIN}`;
            return (
              <li
                key={m.condo_id}
                className="bg-white border border-onix-100 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-onix-900">
                      {condo.name}
                    </h3>
                    <p className="text-xs text-g60 mt-0.5">{url}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-mint-50 text-mint-700">
                    {m.role}
                  </span>
                </div>
                <div className="flex gap-2 mt-4">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-mint-700 hover:underline"
                  >
                    Abrir dashboard →
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
