"""
Acesso ao Supabase (DB + Storage) usando a service role key.
"""

from __future__ import annotations

import os
from typing import Any

from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "revistas-pdfs"


def _client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar setados",
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_revista(revista_id: str) -> dict[str, Any] | None:
    sb = _client()
    res = sb.table("revistas").select("*").eq("id", revista_id).maybe_single().execute()
    return res.data


def fetch_editorial(mes: int, ano: int) -> dict[str, Any] | None:
    sb = _client()
    res = (
        sb.table("editoriais_mensais")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano)
        .maybe_single()
        .execute()
    )
    return res.data


def fetch_condo_meta(condominio: str) -> dict[str, Any] | None:
    sb = _client()
    res = (
        sb.table("condominios_meta")
        .select("*")
        .eq("nome", condominio)
        .maybe_single()
        .execute()
    )
    return res.data


def upload_pdf(revista_id: str, pdf_bytes: bytes) -> str:
    """Sobe o PDF (upsert) e retorna o storage path."""
    sb = _client()
    path = f"{revista_id}.pdf"
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    return path


def mark_publicada(revista_id: str, storage_path: str, paginas: int) -> None:
    sb = _client()
    sb.table("revistas").update(
        {
            "status": "publicada",
            "pdf_storage_path": storage_path,
            "paginas": paginas,
            "gerado_em": "now()",
            "erro_mensagem": None,
        }
    ).eq("id", revista_id).execute()


def mark_erro(revista_id: str, mensagem: str) -> None:
    sb = _client()
    sb.table("revistas").update(
        {"status": "erro", "erro_mensagem": mensagem},
    ).eq("id", revista_id).execute()
