import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { CONDOMINIOS } from "@/lib/sindicompany/condominios";
import { novaRevistaAction } from "./actions";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function NovaEdicaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
  const { error } = await searchParams;

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link
        href="/sindicompany/dashboard"
        className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
      >
        ← Voltar
      </Link>

      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
          Nova edição
        </div>
        <h1 className="text-3xl font-bold text-onix-900">
          Gerar revista mensal
        </h1>
        <p className="text-sm text-g60 mt-2">
          Selecione o condomínio e o mês de referência. A revista é montada
          automaticamente a partir dos dados da pasta do Drive.
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <form
        action={novaRevistaAction}
        className="space-y-5 bg-white rounded-xl border border-onix-100 p-6"
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-onix-800">
            Condomínio
          </span>
          <select
            name="condominio"
            required
            className="mt-1.5 block w-full rounded-lg border border-onix-100 bg-white px-3.5 py-2.5"
          >
            <option value="">Selecione…</option>
            {CONDOMINIOS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-onix-800">
              Mês
            </span>
            <select
              name="mes"
              required
              className="mt-1.5 block w-full rounded-lg border border-onix-100 bg-white px-3.5 py-2.5"
            >
              <option value="">Selecione…</option>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, "0")}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-onix-800">
              Ano
            </span>
            <input
              type="number"
              name="ano"
              defaultValue={2026}
              min={2025}
              max={2030}
              required
              className="mt-1.5 block w-full rounded-lg border border-onix-100 bg-white px-3.5 py-2.5 tabular-nums"
            />
          </label>
        </div>

        <div className="rounded-lg bg-onix-50 px-4 py-3 text-sm text-g60">
          <strong className="text-onix-900">Como funciona:</strong> ao confirmar,
          a engine baixa os dados da pasta do Drive correspondente, monta as 16
          seções editoriais e gera o PDF final. O processo leva entre 30 e 90
          segundos.
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-onix-900 text-white px-5 py-2.5 font-medium hover:bg-onix-800"
          >
            Gerar revista
          </button>
          <Link
            href="/sindicompany/dashboard"
            className="rounded-lg border border-onix-100 px-5 py-2.5 font-medium hover:bg-onix-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </main>
  );
}
