"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  generateFotoCapaWithAI,
  getCarrosselFotoUploadIntent,
} from "./actions";

const BUCKET = "condominios-fotos";

export function CarrosselFotoUpload({ initialUrl }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<
    "idle" | "uploading" | "generating" | "ok" | "error"
  >(initialUrl ? "ok" : "idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [filename, setFilename] = useState("");
  const [revisedPrompt, setRevisedPrompt] = useState<string>("");

  async function handleFile(file: File) {
    setErrorMsg("");
    setRevisedPrompt("");
    setFilename(file.name);
    if (file.size > 30 * 1024 * 1024) {
      setStatus("error");
      setErrorMsg("Foto maior que 30MB.");
      return;
    }
    setStatus("uploading");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const intent = await getCarrosselFotoUploadIntent(ext);
    if (!intent.ok) {
      setStatus("error");
      setErrorMsg(intent.error);
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(intent.path, intent.token, file, {
          upsert: true,
          contentType: file.type || undefined,
        });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message || "Falha no upload.");
        return;
      }
      setUrl(intent.publicUrl);
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Falha desconhecida.");
    }
  }

  async function handleGenerate() {
    setErrorMsg("");
    setRevisedPrompt("");
    setFilename("");
    setStatus("generating");

    // Lê tema/formato/briefing/titulo do form pai
    const form = document.querySelector<HTMLFormElement>("form");
    const data = form ? new FormData(form) : null;
    const titulo = (data?.get("titulo") as string) ?? "";
    const tema = (data?.get("tema") as string) ?? "";
    const formato = (data?.get("formato") as string) ?? "";
    const briefing = (data?.get("briefing") as string) ?? "";

    if (!titulo && !tema) {
      setStatus("error");
      setErrorMsg("Preencha o título ou tema antes de gerar com IA.");
      return;
    }

    const result = await generateFotoCapaWithAI({
      titulo,
      tema: tema || undefined,
      formato: formato || undefined,
      briefing: briefing || undefined,
    });
    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error);
      return;
    }
    setUrl(result.publicUrl);
    setRevisedPrompt(result.revisedPrompt ?? "");
    setStatus("ok");
  }

  const isBusy = status === "uploading" || status === "generating";

  return (
    <div className="space-y-2">
      <input type="hidden" name="foto_capa_url_uploaded" value={url} />

      {url && status === "ok" && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Foto da capa"
            className="w-24 rounded object-cover bg-onix-50"
            style={{ aspectRatio: "4/5" }}
          />
          <div className="flex-1">
            <p className="text-xs text-g60">
              {filename || (revisedPrompt ? "Foto gerada por IA" : "Foto pronta")}
            </p>
            {revisedPrompt && (
              <p className="text-[10px] text-g60 mt-1 line-clamp-3">
                <em>{revisedPrompt}</em>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={isBusy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100 disabled:opacity-50"
        />
        <span className="text-xs text-g60">ou</span>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-md bg-mint-600 hover:bg-mint-700 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
        >
          ✨ Gerar com IA
        </button>
      </div>

      {status === "uploading" && <p className="text-xs text-g60">Enviando…</p>}
      {status === "generating" && (
        <p className="text-xs text-g60">Gerando imagem com IA (até 30s)…</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-700">{errorMsg}</p>
      )}
    </div>
  );
}
