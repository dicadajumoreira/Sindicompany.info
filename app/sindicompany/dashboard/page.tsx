import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { logoutAction } from "../login/actions";

// Mock — Fase 2 puxa de Supabase
const REVISTAS_MOCK = [
  {
    id: "villa-park-osasco-04-2026",
    condominio: "Villa Park Osasco",
    edicao: "04 / 2026",
    status: "Publicada",
    paginas: 17,
    geradoEm: "2026-04-25",
  },
  {
    id: "gardens-living-04-2026",
    condominio: "Gardens Living Club",
    edicao: "04 / 2026",
    status: "Publicada",
    paginas: 16,
    geradoEm: "2026-04-05",
  },
  {
    id: "gardens-living-05-2026",
    condominio: "Gardens Living Club",
    edicao: "05 / 2026",
    status: "Em produção",
    paginas: null,
    geradoEm: null,
  },
];

export default async function DashboardPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="flex items-start justify-between mb-12">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            Sindicompany · Comunicação
          </div>
          <h1 className="text-4xl font-bold text-onix-900 leading-tight">
            Revistas mensais
          </h1>
          <p className="text-sm text-g60 mt-2 max-w-md">
            Gere, revise e publique a revista de cada condomínio sob gestão.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sindicompany/revista/nova"
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-onix-900 text-white font-medium hover:bg-onix-800 text-sm"
          >
            + Nova edição
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-g60 hover:text-onix-900 underline-offset-2 hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {/* Lista de revistas */}
      <section className="bg-white rounded-xl border border-onix-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-onix-100 text-left">
              <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-mint-700">
                Condomínio
              </th>
              <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-mint-700">
                Edição
              </th>
              <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-mint-700">
                Status
              </th>
              <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-mint-700">
                Páginas
              </th>
              <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-mint-700">
                Gerado em
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {REVISTAS_MOCK.map((r) => (
              <tr key={r.id} className="border-b border-onix-100 last:border-0">
                <td className="px-6 py-4 font-medium text-onix-900">
                  {r.condominio}
                </td>
                <td className="px-6 py-4 text-onix-800">{r.edicao}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                      r.status === "Publicada"
                        ? "bg-mint-50 text-mint-700"
                        : "bg-onix-50 text-onix-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-onix-800 tabular-nums">
                  {r.paginas ?? "—"}
                </td>
                <td className="px-6 py-4 text-onix-800 tabular-nums">
                  {r.geradoEm ?? "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/sindicompany/revista/${r.id}`}
                    className="text-sm font-medium text-onix-900 hover:underline"
                  >
                    Abrir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Empty footer */}
      <footer className="mt-16 text-center text-xs text-g60">
        Sindicompany ® · Plataforma de comunicação editorial
      </footer>
    </main>
  );
}
