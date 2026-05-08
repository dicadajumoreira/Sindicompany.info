import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { CONDOMINIOS } from "@/lib/sindicompany/condominios";
import { getCondoMeta } from "@/lib/sindicompany/condominios-db";
import {
  getEditorial,
  editorialEstaPronto,
  formatMesAno,
} from "@/lib/sindicompany/editoriais";
import {
  sugerirCartaSindico,
  sugerirCartaGestor,
} from "@/lib/sindicompany/sugestoes";
import { novaRevistaAction } from "./actions";
import { CondoSelect, MesSelect, AnoInput } from "./condo-select";

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

  // Defaults: lê da URL primeiro; senão, próxima edição (mês atual + 1).
  const now = new Date();
  const proxMes = now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2;
  const proxAno = now.getMonth() + 2 > 12 ? now.getFullYear() + 1 : now.getFullYear();
  const mesFromUrl = Number.parseInt(getStr(sp, "mes"), 10);
  const anoFromUrl = Number.parseInt(getStr(sp, "ano"), 10);
  const defaultMes = Number.isInteger(mesFromUrl) && mesFromUrl >= 1 && mesFromUrl <= 12
    ? mesFromUrl
    : proxMes;
  const defaultAno = Number.isInteger(anoFromUrl) && anoFromUrl >= 2025 && anoFromUrl <= 2030
    ? anoFromUrl
    : proxAno;

  const condoSelecionado = getStr(sp, "condominio");
  const meta = condoSelecionado
    ? await getCondoMeta(condoSelecionado).catch(() => null)
    : null;
  const condoTemGestor = !!meta?.tem_gestor;

  const editorial = await getEditorial(defaultMes, defaultAno).catch(() => null);
  const editorialOk = editorialEstaPronto(editorial);
  const sugCartaSindico = sugerirCartaSindico(defaultMes);
  const sugCartaGestor = sugerirCartaGestor(defaultMes);
  const temaSindico = editorial?.carta_sindico_tema ?? sugCartaSindico?.tema ?? "";
  const temaGestor = editorial?.carta_gestor_tema ?? sugCartaGestor?.tema ?? "";
  const editorialSlug = formatMesAno(defaultMes, defaultAno);

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

      {/* Editorial mensal — vai aplicado a toda revista deste mês */}
      <section
        className={`mb-6 rounded-xl border ${
          editorialOk
            ? "border-mint-100 bg-mint-50/40"
            : "border-amber-200 bg-amber-50/60"
        }`}
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-onix-100/60">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-semibold text-mint-700">
              Editorial mensal · {MESES[defaultMes - 1]} / {defaultAno}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-onix-900">
              {editorialOk
                ? "Pronto — esses dados vão entrar na revista"
                : editorial
                  ? "Em rascunho — faltam campos obrigatórios"
                  : "Ainda não definido"}
            </div>
          </div>
          <Link
            href={`/sindicompany/editorial/${editorialSlug}`}
            className="shrink-0 text-sm underline font-medium text-onix-900"
          >
            {editorial ? "Editar" : "Definir"} →
          </Link>
        </header>

        {editorial ? (
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 text-sm">
            <PreviewItem
              label="Matéria de capa"
              value={editorial.materia_capa_titulo}
              sub={editorial.materia_capa_subtitulo ?? undefined}
            />
            <PreviewItem
              label="Receita do mês"
              value={editorial.receita_titulo}
              sub={editorial.receita_descricao ?? undefined}
            />
            <PreviewItem
              label="Foto de capa"
              value={editorial.foto_capa_url ? "Definida" : null}
              sub={editorial.foto_capa_url ?? undefined}
              mono
            />
            <PreviewItem
              label="Tema · Carta do(a) síndico(a)"
              value={editorial.carta_sindico_tema}
            />
            <PreviewItem
              label="Tema · Carta do gestor"
              value={editorial.carta_gestor_tema}
            />
            {editorial.notas_editor_geral && (
              <PreviewItem
                label="Notas do editor"
                value={editorial.notas_editor_geral}
              />
            )}
          </div>
        ) : (
          <div className="px-5 py-4 text-sm text-amber-900">
            Defina matéria de capa, foto, receita e temas das cartas antes
            de gerar revistas deste mês.
          </div>
        )}
      </section>

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
              <MesSelect
                meses={MESES}
                defaultValue={String(defaultMes).padStart(2, "0")}
                className={selectCls}
              />
            </Field>
            <Field label="Ano">
              <AnoInput defaultValue={defaultAno} className={inputCls} />
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
            <h3 className="text-sm font-semibold text-onix-900">
              Carta do(a) síndico(a){meta?.sindico_nome ? ` — ${meta.sindico_nome}` : ""}
            </h3>

            {temaSindico ? (
              <div className="rounded-lg bg-mint-50 border border-mint-100 px-4 py-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                  Tema deste mês (vem do editorial mensal)
                </div>
                <div className="font-medium text-onix-900">{temaSindico}</div>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                Tema da carta ainda não foi definido para esta edição.{" "}
                <Link
                  href={`/sindicompany/editorial/${String(defaultMes).padStart(2, "0")}-${defaultAno}`}
                  className="font-semibold underline"
                >
                  Definir editorial mensal →
                </Link>
              </div>
            )}

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

              {temaGestor ? (
                <div className="rounded-lg bg-sand-50 border border-onix-100 px-4 py-3 text-sm" style={{background:"#F7EFE9"}}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-mint-700 mb-1">
                    Tema deste mês (vem do editorial mensal)
                  </div>
                  <div className="font-medium text-onix-900">{temaGestor}</div>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                  Tema da carta ainda não foi definido para esta edição.{" "}
                  <Link
                    href={`/sindicompany/editorial/${String(defaultMes).padStart(2, "0")}-${defaultAno}`}
                    className="font-semibold underline"
                  >
                    Definir editorial mensal →
                  </Link>
                </div>
              )}

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

        {/* ============ NOTAS DESTA EDIÇÃO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            5 · Notas desta edição (opcional)
          </h2>
          <Field label="Algo específico desta revista que a equipe precisa saber">
            <textarea name="notas_editor" rows={3}
                      defaultValue={v("notas_editor")}
                      placeholder="Ex: a foto da assembleia chega no dia 15, esperar."
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

function PreviewItem({
  label,
  value,
  sub,
  mono = false,
}: {
  label: string;
  value: string | null;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider font-semibold text-mint-700 mb-0.5">
        {label}
      </div>
      {value ? (
        <div className={`text-onix-900 font-medium ${mono ? "break-all text-xs" : ""}`}>
          {value}
        </div>
      ) : (
        <div className="text-g60 italic">não definido</div>
      )}
      {sub && (
        <div className={`text-onix-800 opacity-70 text-xs mt-0.5 ${mono ? "break-all" : ""}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-lg border border-onix-100 bg-white px-3.5 py-2.5 text-onix-900 outline-none focus:border-mint-600 focus:ring-2 focus:ring-mint-100";

const selectCls = inputCls;
