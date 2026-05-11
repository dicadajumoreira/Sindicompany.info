import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { condoFromSlug, slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  getCondoMeta,
  getCondoFotoPublicUrl,
  type CondoMeta,
} from "@/lib/sindicompany/condominios-db";
import { salvarCondoMetaAction } from "./actions";

function getStr(s: Record<string, string | string[] | undefined>, k: string): string {
  const v = s[k];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

async function safeGetMeta(nome: string): Promise<{ meta: CondoMeta | null; error: string | null }> {
  try {
    return { meta: await getCondoMeta(nome), error: null };
  } catch (e) {
    return { meta: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function EditarCondoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const { slug } = await params;
  const nome = condoFromSlug(slug);
  if (!nome) notFound();

  const sp = await searchParams;
  const error = getStr(sp, "error");

  const { meta, error: dbError } = await safeGetMeta(nome);

  const sindicoFotoUrl = meta?.sindico_foto_path
    ? getCondoFotoPublicUrl(meta.sindico_foto_path)
    : null;
  const gestorFotoUrl = meta?.gestor_foto_path
    ? getCondoFotoPublicUrl(meta.gestor_foto_path)
    : null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href="/sindicompany/condominios"
        className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
      >
        ← Voltar para condomínios
      </Link>

      <header className="mb-10">
        <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
          Condomínio
        </div>
        <h1 className="text-3xl font-bold text-onix-900">{nome}</h1>
        <p className="text-sm text-g60 mt-2 max-w-xl">
          Cadastre o(a) síndico(a) e o gestor do condomínio. Essas informações
          ficam salvas e são reaproveitadas em todas as edições da revista.
        </p>
      </header>

      {(error || dbError) && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
          {error || dbError}
        </div>
      )}

      <form action={salvarCondoMetaAction} encType="multipart/form-data" className="space-y-8">
        <input type="hidden" name="slug" value={slugifyCondo(nome)} />
        <input type="hidden" name="sindico_foto_existente" value={meta?.sindico_foto_path ?? ""} />

        {/* ============ SÍNDICO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            Síndico(a)
          </h2>

          <Field
            label="By Sindicompany"
            hint="Se marcado, a revista deste condomínio usa o logotipo do By Sindicompany (Assets BySindicompany) no lugar do logo Sindicompany — LOGO 2 em página de fundo branco, LOGO 1 em fundo escuro."
          >
            <label className="flex items-center gap-2 text-sm mt-1">
              <input
                type="checkbox"
                name="is_by_sindico"
                value="on"
                defaultChecked={!!meta?.is_by_sindico}
              />
              Este síndico faz parte do By Sindicompany
            </label>
          </Field>

          <Field label="Nome">
            <input
              type="text"
              name="sindico_nome"
              required
              defaultValue={meta?.sindico_nome ?? ""}
              placeholder="Ex: Juliana Moreira"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-mail">
              <input
                type="email"
                name="sindico_email"
                defaultValue={meta?.sindico_email ?? ""}
                placeholder="sindico@email.com"
                className={inputCls}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                type="text"
                name="sindico_whatsapp"
                defaultValue={meta?.sindico_whatsapp ?? ""}
                placeholder="(11) 99999-9999"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Gênero">
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sindico_genero"
                  value="feminino"
                  required
                  defaultChecked={meta?.sindico_genero === "feminino"}
                />
                Síndica
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="sindico_genero"
                  value="masculino"
                  defaultChecked={meta?.sindico_genero === "masculino"}
                />
                Síndico
              </label>
            </div>
          </Field>

          <Field
            label="Foto"
            hint="JPG, PNG ou WebP. Máx 5MB. Aparece na seção 'Carta do Síndico' da revista."
          >
            {sindicoFotoUrl && (
              <div className="mb-3 flex items-center gap-3">
                <Image
                  src={sindicoFotoUrl}
                  alt={`Foto de ${meta?.sindico_nome ?? "síndico"}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="rounded-full object-cover w-20 h-20 border border-onix-100"
                />
                <span className="text-xs text-g60">
                  Foto atual. Suba uma nova abaixo para substituir.
                </span>
              </div>
            )}
            <input
              type="file"
              name="sindico_foto"
              accept="image/jpeg,image/png,image/webp"
              className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100"
            />
          </Field>
        </section>

        {/* ============ GESTOR DE ATENDIMENTO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            Gestor de Atendimento
          </h2>
          <p className="text-xs text-g60 -mt-3">
            Pessoa de contato da Sindicompany pra esse condomínio. Aparece na
            carta do gestor e na contracapa da revista. Deixe o nome em branco
            se o condomínio não tem gestor de atendimento.
          </p>

          <Field label="Nome" hint="Nome de quem atende esse condomínio.">
            <input
              type="hidden"
              name="gestor_foto_existente"
              value={meta?.gestor_foto_path ?? ""}
            />
            <input
              type="text"
              name="gestor_nome"
              defaultValue={meta?.gestor_nome ?? ""}
              maxLength={120}
              placeholder="Ex: Carlos Andrade (deixe em branco se não tem)"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-mail">
              <input
                type="email"
                name="gestor_email"
                defaultValue={meta?.gestor_email ?? ""}
                placeholder="gestor@email.com"
                className={inputCls}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                type="text"
                name="gestor_whatsapp"
                defaultValue={meta?.gestor_whatsapp ?? ""}
                placeholder="(11) 99999-9999"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Gênero" hint="Define o título: Gestor / Gestora de Atendimento.">
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gestor_genero"
                  value="feminino"
                  defaultChecked={meta?.gestor_genero === "feminino"}
                />
                Gestora de Atendimento
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gestor_genero"
                  value="masculino"
                  defaultChecked={
                    meta?.gestor_genero === "masculino" || !meta?.gestor_genero
                  }
                />
                Gestor de Atendimento
              </label>
            </div>
          </Field>

          <Field
            label="Foto"
            hint="JPG, PNG ou WebP. Máx 5MB. Opcional."
          >
            {gestorFotoUrl && (
              <div className="mb-3 flex items-center gap-3">
                <Image
                  src={gestorFotoUrl}
                  alt={`Foto de ${meta?.gestor_nome ?? "gestor"}`}
                  width={80}
                  height={80}
                  unoptimized
                  className="rounded-full object-cover w-20 h-20 border border-onix-100"
                />
                <span className="text-xs text-g60">
                  Foto atual. Suba uma nova abaixo para substituir.
                </span>
              </div>
            )}
            <input
              type="file"
              name="gestor_foto"
              accept="image/jpeg,image/png,image/webp"
              className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100"
            />
          </Field>
        </section>

        {/* ============ LOGOTIPO DO SÍNDICO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            Logotipo do síndico
          </h2>
          <p className="text-xs text-g60 -mt-3">
            Default usado nas revistas (capa e contracapa). Substitui o logo
            Sindicompany quando preenchido.
          </p>

          <Field
            label="Logo"
            hint="JPG, PNG ou WebP transparente. Máx 5MB."
          >
            <input
              type="hidden"
              name="logo_sindico_existente"
              value={meta?.logo_url ?? ""}
            />
            {meta?.logo_url && (
              <div className="mb-3 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.logo_url}
                  alt={`Logo do síndico de ${nome}`}
                  className="rounded-lg object-contain bg-onix-50 w-32 h-20 border border-onix-100 p-2"
                />
                <span className="text-xs text-g60 mt-1">
                  Logo atual. Suba um novo abaixo para substituir.
                </span>
              </div>
            )}
            <input
              type="file"
              name="logo_sindico_file"
              accept="image/jpeg,image/png,image/webp"
              className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100"
            />
          </Field>
        </section>

        {/* ============ LOGOTIPO DO CONDOMÍNIO ============ */}
        <section className="bg-white rounded-xl border border-onix-100 p-6 space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mint-700">
            Logotipo do condomínio
          </h2>
          <p className="text-xs text-g60 -mt-3">
            Logo oficial do condomínio (placa, fachada, identidade visual).
            Não substitui o do síndico na revista — fica disponível pra usos
            específicos (peças avulsas, comunicados, etc).
          </p>

          <Field
            label="Logo"
            hint="JPG, PNG ou WebP transparente. Máx 5MB."
          >
            <input
              type="hidden"
              name="logo_condominio_existente"
              value={meta?.logo_condominio_url ?? ""}
            />
            {meta?.logo_condominio_url && (
              <div className="mb-3 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={meta.logo_condominio_url}
                  alt={`Logo do condomínio ${nome}`}
                  className="rounded-lg object-contain bg-onix-50 w-32 h-20 border border-onix-100 p-2"
                />
                <span className="text-xs text-g60 mt-1">
                  Logo atual. Suba um novo abaixo para substituir.
                </span>
              </div>
            )}
            <input
              type="file"
              name="logo_condominio_file"
              accept="image/jpeg,image/png,image/webp"
              className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100"
            />
          </Field>
        </section>

        <p className="text-xs text-g60">
          Gestor agora é cadastrado por edição (em &quot;Nova revista&quot;), porque
          pode mudar de uma edição pra outra.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-onix-900 text-white px-5 py-2.5 font-medium hover:bg-onix-800"
          >
            Salvar
          </button>
          <Link
            href="/sindicompany/condominios"
            className="rounded-lg border border-onix-100 px-5 py-2.5 font-medium hover:bg-onix-50"
          >
            Cancelar
          </Link>
        </div>
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
