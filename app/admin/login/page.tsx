"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/admin/condos");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl border border-onix-100 p-8">
      <h1 className="text-2xl font-semibold text-onix-900">Entrar</h1>
      <p className="mt-1 text-sm text-g60">
        Acesse seus dashboards de condomínio.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-onix-900">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-onix-100 focus:outline-none focus:ring-2 focus:ring-mint"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-onix-900">Senha</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-onix-100 focus:outline-none focus:ring-2 focus:ring-mint"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 rounded-lg bg-onix-900 text-white font-medium hover:bg-onix-800 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="mt-4 text-sm text-g60 text-center">
        Não tem conta?{" "}
        <Link href="/admin/signup" className="text-mint-700 font-medium">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
