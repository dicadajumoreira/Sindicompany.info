"use client";

import { useState } from "react";

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

interface Props {
  temasSindico: string[];
  temasBy: string[];
  defaultBrand: string;
  defaultTema: string;
  defaultTemaOutro: string;
}

/** Combina o seletor de MARCA + o seletor de TEMA. A lista de temas
 *  muda conforme a marca selecionada — @sindicompanybr (morador) e
 *  @bysindicompany (síndico profissional) têm pautas distintas. */
export function BrandTemaPicker({
  temasSindico,
  temasBy,
  defaultBrand,
  defaultTema,
  defaultTemaOutro,
}: Props) {
  const [brand, setBrand] = useState(
    defaultBrand === "bysindicompany" ? "bysindicompany" : "sindicompanybr",
  );
  const temas = brand === "bysindicompany" ? temasBy : temasSindico;
  const [tema, setTema] = useState(
    temas.includes(defaultTema) ? defaultTema : "",
  );
  const isOutro = tema === "Outro" || tema === "Outros";

  function onBrandChange(b: string) {
    setBrand(b);
    const novaLista = b === "bysindicompany" ? temasBy : temasSindico;
    if (!novaLista.includes(tema)) setTema("");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-onix-900">Marca</label>
        <p className="text-xs text-g60">
          Pra qual Instagram este carrossel é. Cada marca tem público,
          objetivo e linguagem próprios.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "sindicompanybr", label: "@sindicompanybr", hint: "Morador" },
            { id: "bysindicompany", label: "@bysindicompany", hint: "Síndico profissional" },
          ].map((b) => (
            <label
              key={b.id}
              className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
            >
              <input
                type="radio"
                name="brand"
                value={b.id}
                checked={brand === b.id}
                onChange={() => onBrandChange(b.id)}
                required
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-onix-900">{b.label}</div>
                <div className="text-xs text-g60">{b.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-onix-900">Tema</label>
        <p className="text-xs text-g60">
          Assunto principal do carrossel. Selecione &quot;Outro&quot; pra
          digitar um tema livre.
        </p>
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
            placeholder="Descreva o tema"
            className={`${inputCls} mt-2`}
          />
        )}
      </div>
    </div>
  );
}
