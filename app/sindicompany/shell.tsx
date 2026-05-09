import { SindicompanySidebar } from "./sidebar";

/** Shell padrão das páginas internas do painel: sidebar à esquerda
 *  + conteúdo à direita. Usado em dashboard, condomínios, editorial,
 *  carrosséis, patterns, etc. NÃO usar em /login (que é stand-alone). */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SindicompanySidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
