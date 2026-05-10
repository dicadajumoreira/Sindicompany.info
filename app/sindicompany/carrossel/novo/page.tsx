import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { DashboardShell } from "../../shell";
import { novoCarrosselAction } from "../actions";
import { CarrosselFotoUpload } from "../foto-upload";

const TEMAS = [
  "Direitos do morador",
  "Taxa de condomínio",
  "Síndico profissional",
  "Conflitos entre vizinhos",
  "Segurança",
  "Animais de estimação",
  "Assembleias e votações",
  "Valorização do imóvel",
  "Tecnologia no condomínio",
  "Tendências em alta",
  "Outro",
];

const FORMATOS = [
  { id: "historia_real", label: "História real", hint: "O que mais engaja e salva" },
  { id: "lista", label: "Lista", hint: "5–7 itens numerados" },
  { id: "mito_verdade", label: "Mito vs. Verdade", hint: "Compara crenças com fatos" },
  { id: "antes_depois", label: "Antes / Depois", hint: "Mostra transformação" },
  { id: "dado_choca", label: "Dado que choca", hint: "Estatística com peso" },
  { id: "tutorial", label: "Tutorial rápido", hint: "Passo a passo prático" },
  { id: "opiniao", label: "Opinião forte", hint: "Posição com argumento" },
];

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

export default async function NovoCarrosselPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const v = (k: string): string => {
    const val = params[k];
    return Array.isArray(val) ? val[0] ?? "" : val ?? "";
  };

  return (
    <DashboardShell>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/sindicompany/carrossel"
          className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
        >
          ← Voltar
        </Link>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
            Novo carrossel
          </div>
          <h1 className="text-3xl font-bold text-onix-900">
            Briefing do carrossel
          </h1>
          <p className="text-sm text-g60 mt-2 max-w-xl">
            Preencha as informações abaixo. A engine usa o tema, formato e foto
            de capa pra montar 5–7 slides em 4K com identidade Sindicompany.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-6">
            {error}
          </div>
        )}

        <form action={novoCarrosselAction} className="space-y-6">
          <Field
            label="Título interno"
            hint="Pra organização — não aparece no post."
          >
            <input
              type="text"
              name="titulo"
              defaultValue={v("titulo")}
              required
              maxLength={120}
              placeholder='Ex: "História real — síndico que reduziu inadimplência"'
              className={inputCls}
            />
          </Field>

          <Field
            label="Tema"
            hint="Assunto principal do carrossel."
          >
            <select name="tema" defaultValue={v("tema")} required className={inputCls}>
              <option value="">— Selecione —</option>
              {TEMAS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Formato" hint="Como o conteúdo é apresentado.">
            <div className="grid grid-cols-2 gap-2">
              {FORMATOS.map((f) => (
                <label
                  key={f.id}
                  className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
                >
                  <input
                    type="radio"
                    name="formato"
                    value={f.id}
                    defaultChecked={v("formato") === f.id}
                    required
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-onix-900">
                      {f.label}
                    </div>
                    <div className="text-xs text-g60">{f.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field
            label="Quantidade de slides"
            hint="De 1 a 10. Recomendado: 5 a 7. Mais slides exigem briefing mais detalhado."
          >
            <select
              name="n_slides"
              defaultValue={v("n_slides") || "6"}
              className={inputCls}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} slide{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Foto da capa"
            hint="Imagem real (pessoa, cotidiano, ambiente). Será o slide 1 com texto na metade de baixo. Recomendado: 4:5, alta resolução."
          >
            <CarrosselFotoUpload />
          </Field>

          <Field
            label="Briefing (opcional)"
            hint="Conte o ângulo, contexto, números relevantes ou referências. Quanto mais específico, melhor o copy gerado."
          >
            <textarea
              name="briefing"
              rows={5}
              defaultValue={v("briefing")}
              maxLength={2000}
              placeholder="Ex: O síndico João assumiu um condomínio com 12% de inadimplência e em 8 meses caiu pra 1,3%. Estratégia: conversa individual + plano de pagamento + comunicação clara."
              className={inputCls}
            />
          </Field>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="rounded-lg bg-onix-900 text-white px-5 py-2.5 font-medium hover:bg-onix-800"
            >
              Criar carrossel
            </button>
            <Link
              href="/sindicompany/carrossel"
              className="rounded-lg border border-onix-100 px-5 py-2.5 font-medium hover:bg-onix-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </main>
    </DashboardShell>
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
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-onix-900">{label}</label>
      {hint && <p className="text-xs text-g60">{hint}</p>}
      {children}
    </div>
  );
}
