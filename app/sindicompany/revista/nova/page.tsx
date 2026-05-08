import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { CONDOMINIOS } from "@/lib/sindicompany/condominios";
import { getCondoMeta } from "@/lib/sindicompany/condominios-db";
import {
  sugerirMateria,
  sugerirReceita,
  sugerirCartaSindico,
  sugerirCartaGestor,
} from "@/lib/sindicompany/sugestoes";
import { novaRevistaAction } from "./actions";
import { CondoSelect } from "./condo-select";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getStr(s: Record<string, string | string[] | undefined>, k: string, fallback = ""): string {
  const v = s[k];
  return Array.isArray(v) ? v[0] ?? fallback : v ?? fallback;
}

export default async function NovaEdicaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
  const sp = await searchParams;
  const error = getStr(sp, "error");

  // Defaults: mês atual+1 (próxima edição), ano corrente
  const now = new Date();
  const defaultMes = Number(getStr(sp, "mes")) || now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const defaultAno = Number(getStr(sp, "ano")) ||
    (now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear());

  const sugMateria = sugerirMateria(defaultMes);
  const sugReceita = sugerirReceita(defaultMes);
  const sugCartaSindico = sugerirCartaSindico(defaultMes);
  const sugCartaGestor = sugerirCartaGestor(defaultMes);

  const condoSelecionado = getStr(sp, "condominio");
  const meta = condoSelecionado
    ? await getCondoMeta(condoSelecionado).catch(() => null)
    : null;
  const condoTemGestor = !!meta?.tem_gestor;

  const v = (k: string, fallback = "") => getStr(sp, k, fallback);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/sindicompany/dashboard"
        className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
      >
        ← Voltar
      </Link>

      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
          Nova edição
        </div>
        <h1 className="text-3xl font-bold text-onix-900">Gerar revista mensal</h1>
        <p className="text-sm text-g60 mt-2 max-w-xl">
          Preencha as informações abaixo. Quando confirmar, a engine usa esses dados
          (e baixa as fotos do Drive) pra montar as 16 seções da revista.
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <form action={novaRevistaAction} className="space-y-8">
        {/* ============ EDIÇÃO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            1 · Edição
          </h2>

          <Field label="Condomínio">
            <CondoSelect
              condominios={CONDOMINIOS}
              defaultValue={v("condominio")}
              className={selectCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mês">
              <select name="mes" required defaultValue={String(defaultMes).padStart(2, "0")}
                      className={selectCls}>
                {MESES.map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Ano">
              <input type="number" name="ano" defaultValue={defaultAno}
                     min={2025} max={2030} required
                     className={inputCls + " tabular-nums"} />
            </Field>
          </div>
        </section>

        {/* ============ LIDERANÇA (vem do cadastro do condomínio) ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-2">
            2 · Liderança
          </h2>
          <p className="text-sm text-onix-800">
            O(a) síndico(a) e o gestor são puxados automaticamente do cadastro
            do condomínio. Confira se o cadastro está atualizado antes de gerar.
          </p>
          <Link
            href="/sindicompany/condominios"
            className="text-sm text-mint-700 hover:underline mt-2 inline-block"
          >
            Editar cadastros de condomínios →
          </Link>
        </section>

        {/* ============ CARTAS ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            3 · Cartas
          </h2>

          {/* --- Carta do(a) síndico(a) --- */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-onix-900">Carta do(a) síndico(a)</h3>

            {sugCartaSindico && (
              <div className="rounded-lg bg-mint-50 border border-mint-100 px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                  Tema sugerido para {MESES[defaultMes - 1]}
                </div>
                <div className="font-medium text-onix-900">{sugCartaSindico.tema}</div>
                <div className="text-onix-800 opacity-80 mt-0.5">{sugCartaSindico.resumo}</div>
              </div>
            )}

            <Field label="Tema da carta">
              <input type="text" name="carta_sindico_tema"
                     defaultValue={v("carta_sindico_tema") || sugCartaSindico?.tema || ""}
                     className={inputCls} />
            </Field>

            <Field label="Texto da carta (opcional)"
                   hint="Se deixar em branco, a engine escreve uma carta baseada no tema. Se preencher, usa o seu texto.">
              <textarea name="carta_sindico_texto" rows={6}
                        defaultValue={v("carta_sindico_texto")}
                        placeholder="Escreva a carta do(a) síndico(a) aqui, ou deixe em branco para o sistema sugerir."
                        className={inputCls} />
            </Field>
          </div>

          {/* --- Carta do gestor (só aparece se o condo tem gestor cadastrado) --- */}
          {condoTemGestor && (
            <div className="space-y-3 pt-4 border-t border-onix-100">
              <div>
                <h3 className="text-sm font-semibold text-onix-900">
                  Carta do gestor{meta?.gestor_nome ? ` — ${meta.gestor_nome}` : ""}
                </h3>
              </div>

              {sugCartaGestor && (
                <div className="rounded-lg bg-sand-50 border border-onix-100 px-4 py-3 text-sm" style={{background:"#F7EFE9"}}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                    Tema sugerido para {MESES[defaultMes - 1]}
                  </div>
                  <div className="font-medium text-onix-900">{sugCartaGestor.tema}</div>
                  <div className="text-onix-800 opacity-80 mt-0.5">{sugCartaGestor.resumo}</div>
                </div>
              )}

              <Field label="Tema da carta">
                <input type="text" name="carta_gestor_tema"
                       defaultValue={v("carta_gestor_tema") || sugCartaGestor?.tema || ""}
                       className={inputCls} />
              </Field>

              <Field label="Texto da carta (opcional)"
                     hint="Se deixar em branco, a engine escreve uma carta baseada no tema.">
                <textarea name="carta_gestor_texto" rows={6}
                          defaultValue={v("carta_gestor_texto")}
                          placeholder="Escreva a carta do gestor aqui, ou deixe em branco para o sistema sugerir."
                          className={inputCls} />
              </Field>
            </div>
          )}

          {!condoSelecionado && (
            <div className="pt-4 border-t border-onix-100 text-xs text-g60">
              Carta do gestor aparece aqui depois que você selecionar um condomínio
              (e só se ele tiver gestor cadastrado).
            </div>
          )}

          {condoSelecionado && !condoTemGestor && (
            <div className="pt-4 border-t border-onix-100 text-xs text-g60">
              {meta
                ? `${condoSelecionado} não tem gestor cadastrado — a carta do gestor não vai sair nesta edição.`
                : `${condoSelecionado} ainda não foi cadastrado — `}
              {!meta && (
                <Link
                  href={`/sindicompany/condominios`}
                  className="text-mint-700 hover:underline"
                >
                  abrir cadastro
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ============ CONTEÚDO DO CONDOMÍNIO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            4 · Conteúdo do condomínio
          </h2>

          <Field label="Link da pasta de fotos de manutenção (Google Drive)"
                 hint="A engine baixa todas as fotos das subpastas pra montar 'Nosso Condomínio'.">
            <input type="url" name="drive_manutencao_url"
                   defaultValue={v("drive_manutencao_url")}
                   placeholder="https://drive.google.com/drive/folders/..."
                   className={inputCls} />
          </Field>

          <Field label="Link da pasta de prestação de contas (Google Drive)"
                 hint="A engine extrai os números pra 'Nossos Números' (KPIs e despesas).">
            <input type="url" name="drive_prestacao_url"
                   defaultValue={v("drive_prestacao_url")}
                   placeholder="https://drive.google.com/drive/folders/..."
                   className={inputCls} />
          </Field>

          <Field label="O condomínio teve advertências/multas neste mês?">
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" name="tem_advertencias" value="on"
                     defaultChecked={v("tem_advertencias") === "on"} />
              Sim
            </label>
          </Field>

          <Field label="Observações sobre advertências/multas (opcional)">
            <textarea name="multas_advertencias_obs" rows={2}
                      defaultValue={v("multas_advertencias_obs")}
                      placeholder="Ex: 8 advertências (barulho), 2 multas totalizando R$ 850,00"
                      className={inputCls} />
          </Field>

          <Field label="Houve eventos no condomínio neste mês?">
            <label className="flex items-center gap-2 text-sm mt-1">
              <input type="checkbox" name="tem_eventos" value="on"
                     defaultChecked={v("tem_eventos") === "on"} />
              Sim
            </label>
          </Field>

          <Field label="Link da pasta de fotos dos eventos (se sim)">
            <input type="url" name="drive_eventos_url"
                   defaultValue={v("drive_eventos_url")}
                   placeholder="https://drive.google.com/drive/folders/..."
                   className={inputCls} />
          </Field>
        </section>

        {/* ============ EDITORIAL ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            5 · Editorial
          </h2>

          {sugMateria && (
            <div className="rounded-lg bg-mint-50 border border-mint-100 px-4 py-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                Sugestão para {MESES[defaultMes - 1]}
              </div>
              <div className="font-medium text-onix-900">{sugMateria.titulo}</div>
              <div className="text-onix-800 opacity-80 mt-0.5">{sugMateria.subtitulo}</div>
            </div>
          )}

          <Field label="Título da matéria de capa">
            <input type="text" name="materia_capa_titulo"
                   defaultValue={v("materia_capa_titulo") || sugMateria?.titulo || ""}
                   className={inputCls} />
          </Field>

          <Field label="Subtítulo da matéria de capa">
            <textarea name="materia_capa_subtitulo" rows={2}
                      defaultValue={v("materia_capa_subtitulo") || sugMateria?.subtitulo || ""}
                      className={inputCls} />
          </Field>

          <Field label="Link/URL da foto de capa"
                 hint="Foto que aparece como fundo da capa. Pode ser link do Drive ou URL pública.">
            <input type="url" name="foto_capa_url"
                   defaultValue={v("foto_capa_url")}
                   placeholder="https://..."
                   className={inputCls} />
          </Field>

          {sugReceita && (
            <div className="rounded-lg bg-sand-50 border border-onix-100 px-4 py-3 text-sm" style={{background:"#F7EFE9"}}>
              <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                Receita sugerida
              </div>
              <div className="font-medium text-onix-900">{sugReceita.titulo}</div>
              <div className="text-onix-800 opacity-80 mt-0.5">{sugReceita.descricao}</div>
            </div>
          )}

          <Field label="Receita do mês">
            <input type="text" name="receita_titulo"
                   defaultValue={v("receita_titulo") || sugReceita?.titulo || ""}
                   className={inputCls} />
          </Field>

          <Field label="Notas pro editor (opcional)">
            <textarea name="notas_editor" rows={3}
                      defaultValue={v("notas_editor")}
                      placeholder="Algo que a equipe editorial precise saber sobre essa edição."
                      className={inputCls} />
          </Field>
        </section>

        {/* ============ AÇÕES ============ */}
        <div className="flex gap-3 pt-2">
          <button type="submit"
                  className="rounded-lg bg-onix-900 text-white px-5 py-2.5 font-medium hover:bg-onix-800">
            Gerar revista
          </button>
          <Link href="/sindicompany/dashboard"
                className="rounded-lg border border-onix-100 px-5 py-2.5 font-medium hover:bg-onix-50">
            Cancelar
          </Link>
        </div>

        <p className="text-xs text-g60 mt-4">
          Após confirmar, a engine baixa os dados das pastas do Drive informadas
          e monta as 16 seções editoriais. O processo leva entre 30 e 90 segundos.
          Você pode revisar e regerar a qualquer momento.
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-onix-800 block mb-1">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-g60 mt-1 block">{hint}</span>}
    </label>
  );
}

const inputCls =
  "block w-full rounded-lg border border-onix-100 bg-white px-3.5 py-2.5 text-onix-900 outline-none focus:border-mint-600 focus:ring-2 focus:ring-mint-100";

const selectCls = inputCls;
