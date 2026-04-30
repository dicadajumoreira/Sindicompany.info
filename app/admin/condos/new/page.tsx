"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/utils";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "sindico.info";

export default function NewCondoPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/condos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug: effectiveSlug }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erro ao criar condomínio");
      return;
    }
    router.push("/admin/condos");
    router.refresh();
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-onix-900">
        Novo condomínio
      </h1>
      <p className="text-sm text-g60 mt-1">
        Cria um novo dashboard isolado com subdomínio próprio.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 bg-white border border-onix-100 rounded-xl p-6 space-y-4"
      >
        <div>
          <label className="text-sm font-medium text-onix-900">
            Nome do condomínio
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Edifício Club Park Butantã"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-onix-100 focus:outline-none focus:ring-2 focus:ring-mint"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-onix-900">
            Subdomínio
          </label>
          <div className="mt-1 flex items-stretch">
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={effectiveSlug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              className="flex-1 px-3 py-2 rounded-l-lg border border-onix-100 focus:outline-none focus:ring-2 focus:ring-mint"
            />
            <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-onix-100 bg-onix-50 text-sm text-g60">
              .{ROOT_DOMAIN}
            </span>
          </div>
          <p className="text-xs text-g60 mt-1">
            Apenas letras minúsculas, números e hífen.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name || !effectiveSlug}
          className="px-4 py-2.5 rounded-lg bg-onix-900 text-white font-medium hover:bg-onix-800 disabled:opacity-50"
        >
          {loading ? "Criando…" : "Criar condomínio"}
        </button>
      </form>
    </div>
  );
}
