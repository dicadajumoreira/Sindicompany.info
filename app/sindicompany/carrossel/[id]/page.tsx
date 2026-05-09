import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { getCarrossel } from "@/lib/sindicompany/carrosseis";
import { DashboardShell } from "../../shell";

export default async function CarrosselDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const { id } = await params;
  let carrossel;
  try {
    carrossel = await getCarrossel(id);
  } catch (e) {
    return (
      <DashboardShell>
        <main className="max-w-3xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <strong>Banco indisponível.</strong>{" "}
            {e instanceof Error ? e.message : String(e)}
          </div>
        </main>
      </DashboardShell>
    );
  }

  if (!carrossel) notFound();

  return (
    <DashboardShell>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/sindicompany/carrossel"
          className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
        >
          ← Voltar
        </Link>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            Carrossel · {carrossel.tema ?? "—"}
          </div>
          <h1 className="text-3xl font-bold text-onix-900">{carrossel.titulo}</h1>
        </header>

        <section className="rounded-xl border border-onix-100 bg-white p-6 space-y-4">
          <Field label="Tema" value={carrossel.tema} />
          <Field label="Formato" value={carrossel.formato} />
          <Field label="Status" value={carrossel.status} />
          {carrossel.foto_capa_url && (
            <div>
              <div className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-2">
                Foto da capa
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carrossel.foto_capa_url}
                alt="Capa"
                className="rounded-lg max-h-64 object-cover"
                style={{ aspectRatio: "4/5" }}
              />
            </div>
          )}
          {carrossel.briefing && (
            <div>
              <div className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-2">
                Briefing
              </div>
              <p className="text-sm whitespace-pre-wrap text-onix-900">
                {carrossel.briefing}
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Em breve:</strong> a geração automática dos slides em 4K. Por
          enquanto, este registro armazena o briefing pra a equipe rodar a skill
          <code className="mx-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
            sindicompany-carrossel
          </code>
          manualmente.
        </div>
      </main>
    </DashboardShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-1">
        {label}
      </div>
      <div className="text-sm text-onix-900">{value ?? "—"}</div>
    </div>
  );
}
