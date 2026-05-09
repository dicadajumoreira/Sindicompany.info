"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCarrosselFotoUploadIntent } from "./actions";

const BUCKET = "condominios-fotos";

export function CarrosselFotoUpload({ initialUrl }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "ok" | "error">(
    initialUrl ? "ok" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [filename, setFilename] = useState("");

  async function handleFile(file: File) {
    setErrorMsg("");
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

  return (
    <div className="space-y-2">
      <input type="hidden" name="foto_capa_url_uploaded" value={url} />
      {url && status === "ok" && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Foto da capa"
            className="w-24 h-30 rounded object-cover bg-onix-50"
            style={{ aspectRatio: "4/5" }}
          />
          <span className="text-xs text-g60">{filename || "Foto pronta"}</span>
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={status === "uploading"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="block text-sm text-onix-800 file:mr-3 file:rounded-md file:border file:border-onix-100 file:bg-onix-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-onix-100 disabled:opacity-50"
      />
      {status === "uploading" && (
        <p className="text-xs text-g60">Enviando…</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-700">{errorMsg}</p>
      )}
    </div>
  );
}
