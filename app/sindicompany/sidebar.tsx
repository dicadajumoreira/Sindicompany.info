import Link from "next/link";
import { logoutAction } from "./login/actions";

interface NavItem {
  label: string;
  href: string;
  emoji?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Revistas", href: "/sindicompany/dashboard", emoji: "📕" },
  { label: "Editorial mensal", href: "/sindicompany/editorial", emoji: "📅" },
  { label: "Carrosséis", href: "/sindicompany/carrossel", emoji: "🎠" },
  { label: "Condomínios", href: "/sindicompany/condominios", emoji: "🏢" },
  { label: "Patterns", href: "/sindicompany/patterns", emoji: "🎨" },
];

export function SindicompanySidebar() {
  return (
    <aside className="w-60 shrink-0 sticky top-0 h-screen bg-onix-900 text-white px-4 py-6 flex flex-col">
      <Link href="/sindicompany/dashboard" className="block mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://raw.githubusercontent.com/dicadajumoreira/Sindicompany/main/Logotipo%20Sindicompany%201.png"
          alt="Sindicompany"
          className="h-8 w-auto mb-3 invert brightness-0 contrast-100"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <span className="text-[10px] uppercase tracking-[0.24em] font-semibold text-mint-400">
          Comunicação
        </span>
      </Link>

      <nav className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
          >
            {item.emoji && <span className="text-base">{item.emoji}</span>}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <form action={logoutAction} className="pt-4 border-t border-white/10">
        <button
          type="submit"
          className="text-xs text-white/55 hover:text-white underline-offset-2 hover:underline"
        >
          Sair
        </button>
      </form>
    </aside>
  );
}
