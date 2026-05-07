import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";

export default async function RevistaPage({
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

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <Link
        href="/sindicompany/dashboard"
        className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
      >
        ← Voltar
      </Link>

      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
          Revista
        </div>
        <h1 className="text-3xl font-bold text-onix-900">
          {id.replace(/-/g, " ")}
        </h1>
      </header>

      <div className="rounded-xl border border-onix-100 bg-white p-6 space-y-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
            PDF
          </div>
          <a
            href={`/api/sindicompany/revista/${id}/pdf`}
            target="_blank"
            rel="noopener"
            className="text-onix-900 underline font-medium"
          >
            Abrir revista_completa.pdf
          </a>
        </div>

        <div className="rounded-lg bg-onix-50 px-4 py-3 text-sm text-g60">
          Em produção, este botão serve o PDF a partir do Supabase Storage com
          URL assinada e expiração configurável. Por ora, é um placeholder.
        </div>
      </div>
    </main>
  );
}
