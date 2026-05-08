"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { isCondominioValido } from "@/lib/sindicompany/condominios";
import { createRevista } from "@/lib/sindicompany/db";

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

function backToFormWithError(message: string): never {
  const q = new URLSearchParams({ error: message });
  redirect(`/sindicompany/revista/nova?${q.toString()}`);
}

export async function novaRevistaAction(formData: FormData): Promise<void> {
  await requireAuth();

  const condominio = String(formData.get("condominio") ?? "").trim();
  const mesRaw = String(formData.get("mes") ?? "").trim();
  const anoRaw = String(formData.get("ano") ?? "").trim();

  if (!condominio || !isCondominioValido(condominio)) {
    backToFormWithError("Condomínio inválido.");
  }

  const mes = Number.parseInt(mesRaw, 10);
  const ano = Number.parseInt(anoRaw, 10);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    backToFormWithError("Mês inválido.");
  }
  if (!Number.isInteger(ano) || ano < 2025 || ano > 2030) {
    backToFormWithError("Ano inválido.");
  }

  let revista;
  try {
    revista = await createRevista({ condominio, mes, ano });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    backToFormWithError(
      `Não foi possível criar a edição. ${msg.includes("duplicate") ? "Já existe uma revista para esse condomínio/mês." : msg}`,
    );
  }

  // TODO Fase 4: disparar engine Python via fetch para o serviço de
  // geração. Por ora, a revista fica em "em_producao" até a equipe
  // anexar o PDF manualmente OU até a engine ser plugada.
  //
  // Plano: POST {ENGINE_URL}/generate com {revista_id, condominio, mes, ano}.
  // O serviço Python:
  //   1. baixa dados do Drive
  //   2. renderiza com a engine
  //   3. faz upload do PDF via Storage API
  //   4. PATCH /api/sindicompany/revistas/{id} marcando como publicada

  revalidatePath("/sindicompany/dashboard");
  redirect(`/sindicompany/revista/${revista.id}`);
}
