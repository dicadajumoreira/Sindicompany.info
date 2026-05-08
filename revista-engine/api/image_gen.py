"""
Geração de imagens via OpenAI (DALL-E 3 / gpt-image-1) e upload
pra Supabase Storage para uso nas seções da revista.

DALL-E max é 1792x1024 (landscape) ou 1024x1792 (portrait). Não
chega a 8K mas é mais que suficiente pra capa A4 a 300dpi.

A imagem gerada é baixada e re-uploadada pro bucket público
'editoriais-fotos' (mesmo da foto de capa do editorial), pra
ter URL estável (a URL da OpenAI expira em ~1h).
"""

from __future__ import annotations

import io
import os
import uuid
from typing import Any

import requests

from api.supabase_client import _client as _sb_client

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "dall-e-3")

BUCKET = "editoriais-fotos"


def _openai_client():
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        return None


def _upload_supabase(bytes_: bytes, content_type: str = "image/png") -> str | None:
    """Sobe bytes pro bucket público e retorna a URL pública."""
    sb = _sb_client()
    path = f"ai/{uuid.uuid4().hex}.png"
    try:
        sb.storage.from_(BUCKET).upload(
            path=path,
            file=bytes_,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        url = sb.storage.from_(BUCKET).get_public_url(path)
        # supabase-py 2.x retorna string direta; .data.publicUrl em algumas versões
        return url if isinstance(url, str) else url.get("publicUrl")  # type: ignore[union-attr]
    except Exception as e:  # noqa: BLE001
        print(f"[image_gen] upload pra Supabase falhou: {type(e).__name__}: {e}", flush=True)
        return None


def _gerar_imagem(prompt: str, size: str = "1792x1024") -> str | None:
    """Gera imagem via DALL-E e devolve URL estável (no Supabase).
    Retorna None se algo falhar."""
    cli = _openai_client()
    if cli is None:
        print("[image_gen] OPENAI_API_KEY ausente", flush=True)
        return None

    print(f"[image_gen] gerando '{prompt[:60]}...' ({size})", flush=True)
    try:
        resp = cli.images.generate(
            model=IMAGE_MODEL,
            prompt=prompt,
            size=size,  # type: ignore[arg-type]
            quality="hd",
            n=1,
        )
        url = resp.data[0].url if resp.data else None
        if not url:
            print("[image_gen] resposta sem URL", flush=True)
            return None
    except Exception as e:  # noqa: BLE001
        print(f"[image_gen] DALL-E falhou: {type(e).__name__}: {e}", flush=True)
        return None

    # Baixa e re-upload pra ter URL estável
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        return _upload_supabase(r.content)
    except Exception as e:  # noqa: BLE001
        print(f"[image_gen] download/upload falhou: {type(e).__name__}: {e}", flush=True)
        return None


def gerar_foto_materia_capa(titulo: str, subtitulo: str) -> str | None:
    """Gera foto editorial pra matéria de capa (formato landscape, alta resolução)."""
    prompt = (
        f"Editorial magazine cover photograph for an article titled '{titulo}'. "
        f"Theme: {subtitulo}. Style: high-end Brazilian magazine, candid, "
        f"natural lighting, deep focus, journalistic, real-world setting "
        f"(condominium, urban Brazil), no text in the image. Cinematic composition, "
        f"warm tones. Photorealistic, hyper-detailed, no illustration, no graphic art."
    )
    return _gerar_imagem(prompt, size="1792x1024")


def gerar_foto_receita(titulo: str, descricao: str = "") -> str | None:
    """Gera foto editorial da receita do mês."""
    extra = f". {descricao}" if descricao else ""
    prompt = (
        f"Top-down food editorial photograph: {titulo}{extra}. "
        f"Style: cookbook quality, natural daylight from window, ceramic plate "
        f"on rustic wooden table, garnish, steam, shallow background props. "
        f"Brazilian editorial magazine aesthetic. Photorealistic, no text, no logos."
    )
    return _gerar_imagem(prompt, size="1792x1024")


def gerar_foto_agenda_hero(titulo: str, categoria: str = "") -> str | None:
    """Gera foto pro destaque (hero) da agenda cultural."""
    if not titulo:
        return None
    prompt = (
        f"Editorial photograph for cultural section, theme: '{titulo}'. "
        f"Category: {categoria}. Style: high-end Brazilian magazine, candid, "
        f"natural lighting, cinematic, real-world setting (theater stage, "
        f"cinema, museum, gastronomic event, concert). Photorealistic, "
        f"hyper-detailed, warm tones, no text, no logos, no graphic art."
    )
    return _gerar_imagem(prompt, size="1792x1024")


def gerar_foto_lifestyle(titulo: str, kicker: str = "") -> str | None:
    """Gera foto pra Vida Condominial (S12B), normalmente conectada
    a uma data celebrativa do mês."""
    if not titulo:
        return None
    prompt = (
        f"Editorial lifestyle photograph for an article titled '{titulo}'. "
        f"Theme/kicker: {kicker}. Style: high-end Brazilian magazine, candid, "
        f"natural lighting, real people in a Brazilian condominium / urban "
        f"setting, warm tones, journalistic. Photorealistic, hyper-detailed, "
        f"no text, no logos, no graphic art."
    )
    return _gerar_imagem(prompt, size="1792x1024")
