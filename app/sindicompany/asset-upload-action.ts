"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "condominios-fotos";
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "svg"]);

interface IntentOk {
  ok: true;
  uploadUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}
interface IntentErr {
  ok: false;
  error: string;
}

/** Server action universal de upload pros leaves de Assets. Recebe
 *  bucket prefix + basename derivados do path da hierarquia, mais
 *  slot/ext do user, e cria intent de upload sign URL no Supabase. */
export async function createLeafUploadIntent(
  bucketPrefix: string,
  basename: string,
  slot: number,
  ext: string,
): Promise<IntentOk | IntentErr> {
  // 1. Auth
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return { ok: false, error: "Sessao expirada. Faca login de novo." };
  }
  // 2. Valida slot
  if (!Number.isInteger(slot) || slot < 1 || slot > 999) {
    return { ok: false, error: "Slot invalido (1 a 999)." };
  }
  // 3. Valida ext
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_EXT.has(e)) {
    return { ok: false, error: `Extensao invalida: ${e}. Aceitos: jpg, png, webp, svg.` };
  }
  // 4. Sanitiza bucket prefix (so chars permitidos pra evitar path traversal)
  if (!/^[a-zA-Z0-9_/-]+$/.test(bucketPrefix)) {
    return { ok: false, error: "Bucket prefix invalido." };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(basename)) {
    return { ok: false, error: "Basename invalido." };
  }

  const path = `${bucketPrefix}/${basename}-${slot}.${e}`;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (error) throw error;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${data.token}`;
    return {
      ok: true,
      uploadUrl,
      token: data.token,
      path,
      publicUrl: pub.publicUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha no upload intent.",
    };
  }
}
