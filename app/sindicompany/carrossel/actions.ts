"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  createCarrossel,
  createCarrosselFotoUploadIntent,
  getCarrossel,
  updateCarrossel,
  uploadCarrosselFotoBytes,
  type CarrosselInput,
} from "@/lib/sindicompany/carrosseis";
import { describeError } from "@/lib/sindicompany/errors";
import { dispatchGenerateCarrossel } from "@/lib/sindicompany/engine";
import {
  buildCarrosselPromptSafe,
  downloadImageBytes,
  generateImage,
} from "@/lib/sindicompany/openai-image";
import {
  descreverCenaParaCapa,
  gerarTresCopies,
} from "@/lib/sindicompany/openai-text";

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

function backTo(url: string, message: string, fd: FormData): never {
  const params = new URLSearchParams({ error: message });
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  redirect(`${url}?${params.toString()}`);
}

// =============================================================================
// Upload helpers (signed URL pra Storage)
// =============================================================================

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

// =============================================================================
// Etapa 1: cria carrossel + gera 3 copies → /[id]/copy
// =============================================================================

export async function iniciarCarrosselAction(formData: FormData): Promise<void> {
  await requireAuth();

  const titulo = getStr(formData, "titulo");
  const tema = getStr(formData, "tema");
  const formato = getStr(formData, "formato");
  const briefing = getStr(formData, "briefing");
  const n_slides_raw = parseInt(getStr(formData, "n_slides"), 10);
  const n_slides = Number.isFinite(n_slides_raw)
    ? Math.max(1, Math.min(10, n_slides_raw))
    : 6;

  if (!titulo) backTo("/sindicompany/carrossel/novo", "Informe o título do carrossel.", formData);
  if (!tema) backTo("/sindicompany/carrossel/novo", "Selecione o tema.", formData);
  if (!formato) backTo("/sindicompany/carrossel/novo", "Selecione o formato.", formData);

  const input: CarrosselInput = {
    titulo,
    tema,
    formato,
    briefing: briefing || undefined,
    n_slides,
  };

  let carrossel;
  try {
    carrossel = await createCarrossel(input);
  } catch (e) {
    backTo(
      "/sindicompany/carrossel/novo",
      `Falha ao criar carrossel: ${describeError(e)}`,
      formData,
    );
  }

  // Gera 3 opções de copy via GPT
  const copies = await gerarTresCopies({
    titulo, tema, formato, n_slides, briefing: briefing || undefined,
  });
  if (copies.ok) {
    try {
      await updateCarrossel(carrossel.id, { copy_options: copies.copies });
    } catch {
      // se falhar, segue sem copies — usuário pode regenerar
    }
  }

  revalidatePath("/sindicompany/carrossel");
  redirect(`/sindicompany/carrossel/${carrossel.id}/copy`);
}

// =============================================================================
// Etapa 2: editora escolhe uma das 3 copies → /[id]/foto
// =============================================================================

export async function escolherCopyAction(
  carrosselId: string,
  idx: number,
): Promise<void> {
  await requireAuth();
  const i = Number.isInteger(idx) ? Math.max(0, Math.min(2, idx)) : 0;
  await updateCarrossel(carrosselId, { copy_selected: i });
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
  redirect(`/sindicompany/carrossel/${carrosselId}/foto`);
}

// =============================================================================
// Etapa 3: foto + dispara geração final dos PNGs
// =============================================================================

export async function finalizarCarrosselAction(
  carrosselId: string,
): Promise<void> {
  await requireAuth();
  await dispatchGenerateCarrossel(carrosselId);
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
  redirect(`/sindicompany/carrossel/${carrosselId}`);
}

export async function salvarFotoCapaAction(
  carrosselId: string,
  fotoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada." };
  }
  if (!fotoUrl) return { ok: false, error: "URL vazia." };
  try {
    await updateCarrossel(carrosselId, { foto_capa_url: fotoUrl });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

// =============================================================================
// Geração da foto via DALL-E usando a copy escolhida como contexto
// =============================================================================

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
  carrosselId: string;
}): Promise<GenerateFotoOk | GenerateFotoErr> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }

  // Lê o registro pra usar a copy escolhida como contexto editorial
  let carrossel;
  try {
    carrossel = await getCarrossel(input.carrosselId);
  } catch (e) {
    return { ok: false, error: `Banco indisponível: ${describeError(e)}` };
  }
  if (!carrossel) return { ok: false, error: "Carrossel não encontrado." };

  const idx = carrossel.copy_selected ?? 0;
  const copy = carrossel.copy_options?.[idx];
  const slide1 = copy?.slides?.[0];
  const tituloCapa = slide1?.titulo || carrossel.titulo;
  const subtitulo = slide1?.body || "";

  // Pipeline 2 estágios pra evitar safety filter:
  // 1) GPT-4o-mini converte a copy pt-BR (que pode ter palavras como
  //    "conflito", "inadimplência") numa frase visual neutra em inglês.
  // 2) Essa cena vira o subject do prompt do DALL-E. Tem fallback pro
  //    builder antigo se a tradução falhar.
  let subject = "";
  const cena = await descreverCenaParaCapa({
    tema: carrossel.tema,
    tituloCapa,
    subtitulo,
  });
  if (cena.ok) subject = cena.sceneEn;

  const prompt = subject
    ? `Editorial photograph for Brazilian Instagram cover (4:5 vertical). ` +
      `Scene: ${subject} ` +
      `Style: candid documentary photo, real Brazilian residential building setting, ` +
      `natural daylight, shallow depth of field, photorealistic, no text, no logos, ` +
      `composition leaves the bottom half slightly less busy.`
    : buildCarrosselPromptSafe({
        titulo: tituloCapa,
        tema: carrossel.tema,
      });

  const result = await generateImage(prompt, {
    size: "1024x1792",
    quality: "standard",
    style: "natural",
  });
  if (!result.ok) {
    return {
      ok: false,
      error: /safety|content[_ ]policy/i.test(result.error)
        ? `A OpenAI bloqueou a geração. Tente trocar o tema ou faça upload manual. (${result.error})`
        : result.error,
    };
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

  // DALL-E 3 só entrega 1024x1024, 1024x1792 ou 1792x1024 — nenhum é
  // 4:5. Pedimos vertical (1024x1792) e cropamos pro centro 4:5
  // (1024x1280) antes de salvar, que é a proporção do feed Instagram.
  try {
    const { default: sharp } = await import("sharp");
    bytes = await sharp(bytes)
      .resize({ width: 1024, height: 1280, fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  } catch (e) {
    // Se sharp falhar, segue com a imagem original — o engine Python
    // ainda crop pra 4:5 quando compõe a capa.
    console.warn("sharp crop falhou, usando imagem original:", e);
  }

  let publicUrl: string;
  try {
    publicUrl = await uploadCarrosselFotoBytes(bytes);
  } catch (e) {
    return { ok: false, error: `Falha ao subir pro Storage: ${describeError(e)}` };
  }

  // Persiste já no registro pra a editora não perder se sair da página
  try {
    await updateCarrossel(input.carrosselId, { foto_capa_url: publicUrl });
  } catch {
    // não bloqueia — finalizar action também salva
  }

  return { ok: true, publicUrl, revisedPrompt: result.revised_prompt };
}

// =============================================================================
// Re-dispara geração final (retry / refazer)
// =============================================================================

export async function regenerateCarrosselAction(carrosselId: string): Promise<void> {
  await requireAuth();
  await dispatchGenerateCarrossel(carrosselId);
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
}
