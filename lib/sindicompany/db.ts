/**
 * DB helpers para o backoffice Sindicompany.
 *
 * Como o acesso é por senha única (não auth.users), todas as queries
 * usam o cliente admin (service_role). A camada Next.js valida a sessão
 * antes de chegar aqui.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type RevistaStatus = "em_producao" | "publicada" | "erro";

export interface Revista {
  id: string;
  condominio: string;
  mes: number;
  ano: number;
  status: RevistaStatus;
  pdf_storage_path: string | null;
  paginas: number | null;
  gerado_em: string | null;
  erro_mensagem: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "revistas";
const BUCKET = "revistas-pdfs";

export async function listRevistas(): Promise<Revista[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Revista[];
}

export async function getRevista(id: string): Promise<Revista | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as Revista | null;
}

export async function createRevista(input: {
  condominio: string;
  mes: number;
  ano: number;
}): Promise<Revista> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      condominio: input.condominio,
      mes: input.mes,
      ano: input.ano,
      status: "em_producao" as RevistaStatus,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Revista;
}

export async function markRevistaPublished(
  id: string,
  pdf_storage_path: string,
  paginas: number,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: "publicada" as RevistaStatus,
      pdf_storage_path,
      paginas,
      gerado_em: new Date().toISOString(),
      erro_mensagem: null,
    })
    .eq("id", id);

  if (error) throw error;
}

export async function markRevistaErro(id: string, mensagem: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      status: "erro" as RevistaStatus,
      erro_mensagem: mensagem,
    })
    .eq("id", id);

  if (error) throw error;
}

/** Upload do PDF gerado para o bucket; retorna o storage path. */
export async function uploadRevistaPdf(
  revistaId: string,
  pdfBytes: Buffer,
): Promise<string> {
  const path = `${revistaId}.pdf`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) throw error;
  return path;
}

/** Gera URL assinada (1h) para o PDF de uma revista. */
export async function getSignedPdfUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export function formatEdicao(mes: number, ano: number): string {
  return `${String(mes).padStart(2, "0")} / ${ano}`;
}
