import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sindicompany — Comunicação",
  description: "Plataforma de comunicação editorial da Sindicompany.",
};

export default function SindicompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-onix-50 text-onix-900">{children}</div>;
}
