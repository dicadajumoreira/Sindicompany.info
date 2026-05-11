"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { CONDOMINIOS_SET, slugifyCondo } from "@/lib/sindicompany/condominios";
import {
  listCondoMetas,
  upsertCondoMeta,
} from "@/lib/sindicompany/condominios-db";
import { describeError } from "@/lib/sindicompany/errors";

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) redirect("/sindicompany/login");
}

/** Cria um condominio novo (so o nome) e leva pra tela de edicao do
 *  cadastro completo. Condominios novos vivem em condominios_meta —
 *  a lista mescla a lista estatica com os nomes do meta, em ordem
 *  alfabetica. */
export async function criarCondominioAction(formData: FormData): Promise<void> {
  await requireAuth();
  const nome = String(formData.get("nome") ?? "").trim().replace(/\s+/g, " ");
  if (!nome) {
    redirect("/sindicompany/condominios/novo?error=" + encodeURIComponent("Informe o nome do condomínio."));
  }
  // Ja existe (na lista estatica ou no meta)?
  if (CONDOMINIOS_SET.has(nome)) {
    redirect(`/sindicompany/condominios/${slugifyCondo(nome)}`);
  }
  try {
    const metas = await listCondoMetas();
    if (metas.some((m) => m.nome === nome)) {
      redirect(`/sindicompany/condominios/${slugifyCondo(nome)}`);
    }
    await upsertCondoMeta({ nome });
  } catch (e) {
    redirect(
      "/sindicompany/condominios/novo?error=" +
        encodeURIComponent(`Não foi possível criar: ${describeError(e)}`),
    );
  }
  revalidatePath("/sindicompany/condominios");
  redirect(`/sindicompany/condominios/${slugifyCondo(nome)}`);
}
