import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-block px-3 py-1 rounded-full bg-mint-50 text-mint-700 text-sm font-medium">
          Hubstation
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-onix-900">
          Dashboards para condomínios,
          <br />
          em um lugar só.
        </h1>
        <p className="text-lg text-g60">
          Sua síndica em uma plataforma. Gerencie financeiro, jurídico,
          plano diretor, valorização patrimonial e documentos com um
          dashboard por condomínio, dados isolados, acesso por perfil.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href="/admin"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-onix-900 text-white font-medium hover:bg-onix-800"
          >
            Entrar no painel
          </Link>
          <Link
            href="/admin/signup"
            className="inline-flex items-center px-5 py-2.5 rounded-lg border border-onix-100 font-medium hover:bg-onix-50"
          >
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  );
}
