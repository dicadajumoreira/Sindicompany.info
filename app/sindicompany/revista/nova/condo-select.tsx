"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface CondoSelectProps {
  condominios: readonly string[];
  defaultValue: string;
  className: string;
}

/**
 * Select de condomínio que recarrega a página com `?condominio=X`
 * quando muda, pra que o server saiba qual condo está selecionado e
 * possa mostrar/esconder a seção do gestor de acordo com o cadastro.
 */
export function CondoSelect({ condominios, defaultValue, className }: CondoSelectProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (e.target.value) {
      next.set("condominio", e.target.value);
    } else {
      next.delete("condominio");
    }
    startTransition(() => {
      router.replace(`?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <select
      name="condominio"
      required
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={isPending}
      className={className}
    >
      <option value="">Selecione…</option>
      {condominios.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
