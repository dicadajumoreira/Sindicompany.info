import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-onix-50">
      <header className="border-b border-onix-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-semibold text-onix-900">
            Hubstation
          </Link>
          <nav className="flex items-center gap-4 text-sm text-g60">
            <Link href="/admin/condos" className="hover:text-onix-900">
              Meus condomínios
            </Link>
            <Link href="/admin/account" className="hover:text-onix-900">
              Conta
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
