"use client";

import { useState } from "react";

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

interface TemaPickerProps {
  temas: string[];
  defaultTema: string;
  defaultTemaOutro: string;
}

export function TemaPicker({ temas, defaultTema, defaultTemaOutro }: TemaPickerProps) {
  const [tema, setTema] = useState(defaultTema);
  const isOutro = tema === "Outro";

  return (
    <>
      <select
        name="tema"
        value={tema}
        onChange={(e) => setTema(e.target.value)}
        required
        className={inputCls}
      >
        <option value="">— Selecione —</option>
        {temas.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {isOutro && (
        <input
          type="text"
          name="tema_outro"
          defaultValue={defaultTemaOutro}
          required
          maxLength={120}
          placeholder="Descreva o tema (ex: 'Reforma da fachada', 'Festa junina')"
          className={`${inputCls} mt-2`}
        />
      )}
    </>
  );
}
