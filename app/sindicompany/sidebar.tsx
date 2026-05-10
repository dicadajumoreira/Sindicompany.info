import Link from "next/link";
import { logoutAction } from "./login/actions";

interface NavItem {
  label: string;
  href?: string;
  emoji?: string;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Revistas",
    href: "/sindicompany/dashboard",
    emoji: "📕",
    children: [
      { label: "Edições", href: "/sindicompany/dashboard" },
      { label: "Editorial mensal", href: "/sindicompany/editorial" },
    ],
  },
  { label: "Carrosséis", href: "/sindicompany/carrossel", emoji: "🎠" },
  { label: "Condomínios", href: "/sindicompany/condominios", emoji: "🏢" },
  { label: "Patterns", href: "/sindicompany/patterns", emoji: "🎨" },
];

function renderItem(item: NavItem, depth = 0): React.ReactNode {
  const padding = depth === 0 ? "px-3" : "pl-10 pr-3";
  const fontSize = depth === 0 ? "text-sm font-medium" : "text-xs font-normal";
  const opacity = depth === 0 ? "text-white/85" : "text-white/65";

  const inner = (
    <span className="flex items-center gap-3">
      {item.emoji && <span className="text-base">{item.emoji}</span>}
      <span>{item.label}</span>
    </span>
  );

  return (
    <div key={item.label}>
      {item.href ? (
        <Link
          href={item.href}
          className={`flex items-center ${padding} py-2 rounded-md ${fontSize} ${opacity} hover:bg-white/10 hover:text-white transition-colors`}
        >
          {inner}
        </Link>
      ) : (
        <div className={`flex items-center ${padding} py-2 ${fontSize} ${opacity}`}>
          {inner}
        </div>
      )}
      {item.children && (
        <div className="mt-0.5 mb-1 space-y-0.5">
          {item.children.map((child) => renderItem(child, depth + 1))}
        </div>
      )}
    </div>
  );
}

export function SindicompanySidebar() {
  return (
    <aside className="w-60 shrink-0 sticky top-0 h-screen bg-onix-900 text-white px-4 py-6 flex flex-col">
      <Link href="/sindicompany/dashboard" className="block mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://raw.githubusercontent.com/dicadajumoreira/Sindicompany/main/Logotipo%20Sindicompany%201.png"
          alt="Sindicompany"
          className="h-8 w-auto mb-3"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <span className="text-[10px] uppercase tracking-[0.24em] font-semibold text-mint-400">
          Comunicação
        </span>
      </Link>

      <nav className="flex-1 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => renderItem(item))}
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
