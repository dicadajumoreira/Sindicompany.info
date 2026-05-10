"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  createCarrossel,
  createCarrosselFotoUploadIntent,
  uploadCarrosselFotoBytes,
  type CarrosselInput,
} from "@/lib/sindicompany/carrosseis";
import { describeError } from "@/lib/sindicompany/errors";
import {
  buildCarrosselPrompt,
  downloadImageBytes,
  generateImage,
} from "@/lib/sindicompany/openai-image";

const ALLOWED_IMG_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

interface UploadIntentResult {
  ok: true;
  uploadUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}
interface UploadIntentError {
  ok: false;
  error: string;
}

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

function getStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function backWithError(message: string, fd: FormData): never {
  const params = new URLSearchParams({ error: message });
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  redirect(`/sindicompany/carrossel/novo?${params.toString()}`);
}

export async function getCarrosselFotoUploadIntent(
  ext: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_IMG_EXT.has(e)) {
    return { ok: false, error: "Foto precisa ser jpg, png ou webp." };
  }
  try {
    const intent = await createCarrosselFotoUploadIntent(e);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha desconhecida.",
    };
  }
}

export async function novoCarrosselAction(formData: FormData): Promise<void> {
  await requireAuth();

  const titulo = getStr(formData, "titulo");
  const tema = getStr(formData, "tema");
  const formato = getStr(formData, "formato");
  const briefing = getStr(formData, "briefing");
  const foto_capa_url = getStr(formData, "foto_capa_url_uploaded") || undefined;

  if (!titulo) backWithError("Informe o título do carrossel.", formData);
  if (!tema) backWithError("Selecione o tema.", formData);
  if (!formato) backWithError("Selecione o formato.", formData);

  const input: CarrosselInput = {
    titulo,
    tema,
    formato,
    briefing: briefing || undefined,
    foto_capa_url,
  };

  let carrossel;
  try {
    carrossel = await createCarrossel(input);
  } catch (e) {
    backWithError(`Falha ao criar carrossel: ${describeError(e)}`, formData);
  }

  revalidatePath("/sindicompany/carrossel");
  redirect(`/sindicompany/carrossel/${carrossel.id}`);
}

interface GenerateFotoOk {
  ok: true;
  publicUrl: string;
  revisedPrompt?: string;
}
interface GenerateFotoErr {
  ok: false;
  error: string;
}

export async function generateFotoCapaWithAI(input: {
  titulo: string;
  tema?: string;
  formato?: string;
  briefing?: string;
}): Promise<GenerateFotoOk | GenerateFotoErr> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  const titulo = (input.titulo ?? "").trim();
  if (!titulo && !input.tema) {
    return { ok: false, error: "Informe pelo menos o título ou tema antes de gerar." };
  }

  const prompt = buildCarrosselPrompt({
    titulo: titulo || (input.tema ?? "Sindicompany"),
    tema: input.tema,
    formato: input.formato,
    briefing: input.briefing,
  });

  const result = await generateImage(prompt, {
    size: "1024x1792",
    quality: "hd",
    style: "natural",
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  let bytes: Buffer;
  try {
    bytes = await downloadImageBytes(result.url);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao baixar a imagem gerada.",
    };
  }

  let publicUrl: string;
  try {
    publicUrl = await uploadCarrosselFotoBytes(bytes);
  } catch (e) {
    return {
      ok: false,
      error: `Falha ao subir pro Storage: ${describeError(e)}`,
    };
  }
  return { ok: true, publicUrl, revisedPrompt: result.revised_prompt };
}
