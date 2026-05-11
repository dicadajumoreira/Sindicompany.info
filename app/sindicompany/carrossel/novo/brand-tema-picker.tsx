"use client";

import { useState } from "react";

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

interface Props {
  temasSindico: string[];
  temasBy: string[];
  defaultBrand: string;
  defaultObjetivo: string;
  defaultTema: string;
  defaultTemaOutro: string;
}

const OBJETIVOS_SINDICO = [
  {
    id: "comentarios",
    label: "Gerar comentários (debate)",
    hint: "Divide opiniões. CTA binário (SIM/NÃO). Sucesso = discussão com dois lados.",
  },
  {
    id: "salvamentos",
    label: "Gerar salvamentos (utilidade)",
    hint: "Tão útil que o leitor guarda. Cita lei/artigo/número. CTA 'Salva esse post'.",
  },
  {
    id: "clientes",
    label: "Atrair novos clientes",
    hint: "Mostra o caos e o resultado. Marca pode aparecer. CTA leve 'Seu condomínio está assim?'.",
  },
  {
    id: "educar",
    label: "Educar moradores",
    hint: "Surpresa + identificação. Linguagem acessível, sem juridiquês.",
  },
];

const OBJETIVOS_BY = [
  {
    id: "comentarios",
    label: "Debate entre síndicos",
    hint: "Identificação + divisão entre síndicos. CTA tipo 'SÍNDICO OPERACIONAL ou ESTRATÉGICO'.",
  },
  {
    id: "salvamentos",
    label: "Crescimento profissional",
    hint: "Ferramenta/framework que melhora a gestão. CTA 'Salva isso' / 'Manda pra outro síndico'.",
  },
  {
    id: "clientes",
    label: "Atrair síndicos pro By",
    hint: "'Eu não quero crescer sozinho.' By como elite de mercado. CTA seletivo, nunca recrutamento comum.",
  },
  {
    id: "autoridade",
    label: "Posicionar autoridade no mercado",
    hint: "Manifesto/tendência. 'Eles estão à frente do mercado.' CTA institucional 'O mercado mudou.'.",
  },
];

/** Combina o seletor de MARCA + OBJETIVO + TEMA. A lista de temas
 *  muda conforme a marca; o objetivo (Passo 0) só aparece pro
 *  @sindicompanybr e define tom, gancho, CTA, formato e critério de
 *  sucesso do carrossel. */
export function BrandTemaPicker({
  temasSindico,
  temasBy,
  defaultBrand,
  defaultObjetivo,
  defaultTema,
  defaultTemaOutro,
}: Props) {
  const [brand, setBrand] = useState(
    defaultBrand === "bysindicompany" ? "bysindicompany" : "sindicompanybr",
  );
  const [objetivo, setObjetivo] = useState(defaultObjetivo);
  const temas = brand === "bysindicompany" ? temasBy : temasSindico;
  const [tema, setTema] = useState(
    temas.includes(defaultTema) ? defaultTema : "",
  );
  const isOutro = tema === "Outro" || tema === "Outros";
  const isSindico = brand === "sindicompanybr";
  const objetivos = isSindico ? OBJETIVOS_SINDICO : OBJETIVOS_BY;

  function onBrandChange(b: string) {
    setBrand(b);
    const novaLista = b === "bysindicompany" ? temasBy : temasSindico;
    if (!novaLista.includes(tema)) setTema("");
    // 'educar' so existe pro sindicompanybr; 'autoridade' so pro by.
    const objIds = (b === "bysindicompany" ? OBJETIVOS_BY : OBJETIVOS_SINDICO).map(
      (o) => o.id,
    );
    if (!objIds.includes(objetivo)) setObjetivo("");
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
        <label className="block text-sm font-medium text-onix-900">
          Objetivo do carrossel
        </label>
        <p className="text-xs text-g60">
          {isSindico
            ? "O que o post precisa provocar no morador — muda tom, gancho, formato, CTA e critério de sucesso. Escolha UM."
            : "O que o post precisa provocar no síndico profissional — muda linguagem, gatilhos, formato, CTA e percepção de valor. Escolha UM."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {objetivos.map((o) => (
            <label
              key={o.id}
              className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
            >
              <input
                type="radio"
                name="objetivo"
                value={o.id}
                checked={objetivo === o.id}
                onChange={() => setObjetivo(o.id)}
                required
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-onix-900">
                  {o.label}
                </div>
                <div className="text-xs text-g60">{o.hint}</div>
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
