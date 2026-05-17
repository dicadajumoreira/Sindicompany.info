"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SINDICOMPANY_LIBRARY_LOGOS,
} from "./library-manifest";

const BUCKET = "condominios-fotos";

// Mapeamento dos arquivos da biblioteca embutida (public/sindicompany-library/)
// pros slots do Supabase no bucket Sindicompany (__logos, __icons, __patterns).
// Idempotente: upsert: true, pode ser chamado quantas vezes quiser sem
// duplicar.
//
// Convenção do engine (carrossel_generate.py):
// - Topo de todos os slides usa slot 5 do bucket __logos (logo principal
//   Sindicompany horizontal). Brand Hub novo mantém isso.
// - Slot 1-4 ficam disponíveis pra variações futuras (cyan, lavender, etc).
// - Masks PNG (mask-houses, mask-dot, mask-outer-filled) vão pros slots
//   6+ — são os blocos primitivos do símbolo paramétrico SC_SVG do
//   Brand Hub novo. O engine atual não usa, mas ficam disponíveis pra
//   um futuro upgrade do template carrossel.
const LOGO_MAP: Array<{ slot: number; src: string; ext: string }> = [
  // slot 5 = wordmark horizontal Navy (default do engine)
  { slot: 5, src: "public/sindicompany-library/logos/sindicompany-horizontal-dark.png", ext: "png" },
  // slots 6-8 = primitivas do símbolo paramétrico
  { slot: 6, src: "public/sindicompany-library/logos/mask-houses.png", ext: "png" },
  { slot: 7, src: "public/sindicompany-library/logos/mask-dot.png", ext: "png" },
  { slot: 8, src: "public/sindicompany-library/logos/mask-outer-filled.png", ext: "png" },
];

export interface UploadResult {
  ok: boolean;
  uploaded: number;
  failed: number;
  details: Array<{ path: string; ok: boolean; error?: string }>;
}

/** Sobe a biblioteca embutida (logos + masks) pros buckets do Supabase
 *  Sindicompany de uma vez. Roda 100% server-side: usa o service_role
 *  já disponível no env Netlify. Idempotente.
 *
 *  Hoje só sobe logos+masks (os 4 PNGs embutidos do Brand Hub novo).
 *  Patterns e icons coloridos do ZIP "Sindicompany Assets" podem ser
 *  uploadados manualmente via UI de slots ou expandindo o manifest
 *  + LOGO_MAP/PATTERN_MAP/ICON_MAP acima quando os PNGs estiverem
 *  extraídos em `public/sindicompany-library/`. */
export async function uploadEmbeddedSindicompanyAssets(): Promise<UploadResult> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return {
      ok: false,
      uploaded: 0,
      failed: 0,
      details: [{ path: "auth", ok: false, error: "Sessão inválida" }],
    };
  }

  const sb = createAdminClient();
  const details: UploadResult["details"] = [];
  let uploaded = 0;
  let failed = 0;

  const tryReadFile = async (relPath: string): Promise<Buffer> => {
    const candidates = [
      relPath,
      path.join(process.cwd(), relPath),
      path.join(process.cwd(), ".next", "standalone", relPath),
      path.join(process.cwd(), ".next", "server", relPath),
    ];
    let lastErr: Error | null = null;
    for (const p of candidates) {
      try {
        return await readFile(p);
      } catch (e) {
        lastErr = e as Error;
      }
    }
    throw lastErr ?? new Error(`Não encontrei ${relPath} em nenhum candidato`);
  };

  const upload = async (localPath: string, remotePath: string, contentType: string) => {
    try {
      const buf = await tryReadFile(localPath);
      const { error } = await sb.storage.from(BUCKET).upload(remotePath, buf, {
        contentType,
        upsert: true,
      });
      if (error) throw new Error(error.message);
      uploaded += 1;
      details.push({ path: remotePath, ok: true });
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      details.push({ path: remotePath, ok: false, error: msg });
    }
  };

  // Logos + masks PNG (4 arquivos do Brand Hub novo)
  for (const { slot, src, ext } of LOGO_MAP) {
    await upload(src, `__logos/logo-${slot}.${ext}`, `image/${ext}`);
  }

  // Sanity check: confirma que o manifest tem todos os arquivos mapeados
  for (const file of SINDICOMPANY_LIBRARY_LOGOS) {
    const mapped = LOGO_MAP.some((m) => m.src.endsWith(file));
    if (!mapped) {
      details.push({
        path: `manifest:${file}`,
        ok: false,
        error: "arquivo no manifest mas não mapeado pra slot — verifica LOGO_MAP",
      });
      failed += 1;
    }
  }

  revalidatePath("/sindicompany/assets");
  return { ok: failed === 0, uploaded, failed, details };
}
