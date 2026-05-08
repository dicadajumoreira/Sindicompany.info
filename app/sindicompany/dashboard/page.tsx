import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { listRevistas, formatEdicao, type Revista } from "@/lib/sindicompany/db";
import { logoutAction } from "../login/actions";

const STATUS_LABELS: Record<Revista["status"], string> = {
  em_producao: "Em produção",
  publicada: "Publicada",
  erro: "Erro",
};

const STATUS_CLASSES: Record<Revista["status"], string> = {
  em_producao: "bg-onix-50 text-onix-800",
  publicada: "bg-mint-50 text-mint-700",
  erro: "bg-red-50 text-red-800",
};

async function safeListRevistas(): Promise<{ revistas: Revista[]; error: string | null }> {
  try {
    const revistas = await listRevistas();
    return { revistas, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { revistas: [], error: msg };
  }
}

export default async function DashboardPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const { revistas, error } = await safeListRevistas();

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
            href="/sindicompany/condominios"
            className="inline-flex items-center px-4 py-2.5 rounded-lg border border-onix-100 text-onix-900 font-medium hover:bg-onix-50 text-sm"
          >
            Condomínios
          </Link>
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

      {/* Banner de erro de DB (Supabase ausente/desconfig) */}
      {error && (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Banco indisponível.</strong> {error.includes("env") || error.includes("Missing")
            ? "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local."
            : `Detalhe: ${error}`}
        </div>
      )}

      {/* Lista de revistas */}
      {revistas.length === 0 && !error ? (
        <section className="bg-white rounded-xl border border-onix-100 px-8 py-16 text-center">
          <h2 className="text-xl font-semibold text-onix-900 mb-2">
            Nenhuma edição ainda
          </h2>
          <p className="text-sm text-g60 mb-6">
            Crie a primeira edição para começar.
          </p>
          <Link
            href="/sindicompany/revista/nova"
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-onix-900 text-white font-medium hover:bg-onix-800 text-sm"
          >
            + Nova edição
          </Link>
        </section>
      ) : revistas.length > 0 ? (
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
              {revistas.map((r) => (
                <tr key={r.id} className="border-b border-onix-100 last:border-0">
                  <td className="px-6 py-4 font-medium text-onix-900">
                    {r.condominio}
                  </td>
                  <td className="px-6 py-4 text-onix-800">
                    {formatEdicao(r.mes, r.ano)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${STATUS_CLASSES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-onix-800 tabular-nums">
                    {r.paginas ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-onix-800 tabular-nums">
                    {r.gerado_em ? r.gerado_em.slice(0, 10) : "—"}
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
      ) : null}

      <footer className="mt-16 text-center text-xs text-g60">
        Sindicompany ® · Plataforma de comunicação editorial
      </footer>
    </main>
  );
}
