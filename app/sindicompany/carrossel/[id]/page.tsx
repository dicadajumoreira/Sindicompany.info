import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { getCarrossel } from "@/lib/sindicompany/carrosseis";
import { DashboardShell } from "../../shell";
import { CarrosselAutoRefresh } from "./refresh";
import { LegendaCopy } from "./legenda-copy";
import { RegenerateButton } from "./regenerate-button";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_producao: "Em produção",
  publicada: "Pronto",
  erro: "Erro",
};

const STATUS_BG: Record<string, string> = {
  rascunho: "bg-onix-50 text-onix-800",
  em_producao: "bg-mint-50 text-mint-700",
  publicada: "bg-mint-100 text-mint-700",
  erro: "bg-red-50 text-red-800",
};

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

  const isProducing = carrossel.status === "em_producao" || carrossel.status === "rascunho";
  const slides = carrossel.png_paths ?? [];

  return (
    <DashboardShell>
      <CarrosselAutoRefresh active={isProducing} />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Link
          href="/sindicompany/carrossel"
          className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
        >
          ← Voltar
        </Link>

        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
              Carrossel · {carrossel.tema ?? "—"}
            </div>
            <h1 className="text-3xl font-bold text-onix-900">{carrossel.titulo}</h1>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${STATUS_BG[carrossel.status] ?? "bg-onix-50 text-onix-800"}`}
              >
                {STATUS_LABEL[carrossel.status] ?? carrossel.status}
              </span>
              <span className="text-xs text-g60">
                {carrossel.n_slides ?? 6} slide{(carrossel.n_slides ?? 6) > 1 ? "s" : ""} · {carrossel.formato ?? "—"}
              </span>
            </div>
          </div>
          {(carrossel.status === "rascunho" || carrossel.status === "erro") && (
            <RegenerateButton id={carrossel.id} />
          )}
          {carrossel.status === "publicada" && (
            <RegenerateButton id={carrossel.id} label="Gerar de novo" />
          )}
        </header>

        {carrossel.status === "em_producao" && (
          <div className="rounded-xl border border-mint-200 bg-mint-50 px-5 py-4 text-sm text-mint-800 mb-6">
            <strong>Gerando os slides…</strong> A engine está rodando no GitHub Actions.
            Pode levar 1-3 minutos. Esta página atualiza sozinha quando ficar pronto.
          </div>
        )}

        {carrossel.status === "erro" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 mb-6">
            <strong>Falha na geração.</strong> {carrossel.erro_mensagem ?? "Erro desconhecido."}
          </div>
        )}

        {/* Briefing */}
        <section className="rounded-xl border border-onix-100 bg-white p-6 space-y-4 mb-6">
          {carrossel.foto_capa_url && (
            <div>
              <div className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-2">
                Foto da capa
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={carrossel.foto_capa_url}
                alt="Capa"
                className="rounded-lg max-h-64 object-cover bg-onix-50"
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

        {/* Slides gerados */}
        {slides.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-3">
              Slides ({slides.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {slides.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-onix-100 bg-onix-50 hover:ring-2 hover:ring-mint-400"
                  style={{ aspectRatio: "4/5" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Slide ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
            <p className="text-xs text-g60 mt-2">
              Clique numa miniatura pra abrir o PNG em 4K. Salve cada um com botão direito → "Salvar imagem como…".
            </p>
          </section>
        )}

        {/* Legenda */}
        {carrossel.legenda && (
          <section className="rounded-xl border border-onix-100 bg-white p-6">
            <h2 className="text-xs uppercase tracking-wider text-mint-700 font-semibold mb-3">
              Legenda Instagram
            </h2>
            <LegendaCopy legenda={carrossel.legenda} />
          </section>
        )}
      </main>
    </DashboardShell>
  );
}
