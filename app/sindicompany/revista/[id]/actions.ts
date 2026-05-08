"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { markRevistaErro } from "@/lib/sindicompany/db";
import { dispatchGenerateRevista } from "@/lib/sindicompany/engine";
import { describeError } from "@/lib/sindicompany/errors";

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

export async function cancelarRevistaAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  try {
    await markRevistaErro(id, "Cancelada manualmente.");
  } catch (e) {
    console.error("[revista] cancelar failed:", e);
    redirect(`/sindicompany/revista/${id}?error=${encodeURIComponent(describeError(e))}`);
  }

  revalidatePath(`/sindicompany/revista/${id}`);
  revalidatePath("/sindicompany/dashboard");
  redirect(`/sindicompany/revista/${id}`);
}

export async function regerarRevistaAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  // Reseta o status pra em_producao e dispara o workflow de novo.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("revistas")
    .update({ status: "em_producao", erro_mensagem: null })
    .eq("id", id);
  if (error) {
    console.error("[revista] regerar reset failed:", error);
    redirect(`/sindicompany/revista/${id}?error=${encodeURIComponent(describeError(error))}`);
  }

  await dispatchGenerateRevista(id);

  revalidatePath(`/sindicompany/revista/${id}`);
  revalidatePath("/sindicompany/dashboard");
  redirect(`/sindicompany/revista/${id}`);
}
