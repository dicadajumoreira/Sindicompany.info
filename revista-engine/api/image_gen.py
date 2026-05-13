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
# Default: gpt-image-1 (modelo atual de imagem da OpenAI). Para forcar
# dall-e-3, defina OPENAI_IMAGE_MODEL=dall-e-3.
IMAGE_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")

BUCKET = "editoriais-fotos"


def _is_dalle() -> bool:
    return IMAGE_MODEL.startswith("dall-e")


def _map_size(size: str) -> str:
    """Normaliza o tamanho pro modelo ativo."""
    if _is_dalle():
        # dall-e-3: 1024x1024, 1792x1024 (landscape), 1024x1792 (portrait).
        if size in ("1536x1024",):
            return "1792x1024"
        if size in ("1024x1536",):
            return "1024x1792"
        if size == "auto":
            return "1024x1024"
        return size
    # gpt-image-1: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait), auto.
    if size == "1792x1024":
        return "1536x1024"
    if size == "1024x1792":
        return "1024x1536"
    return size


def _quality_arg() -> str:
    return "hd" if _is_dalle() else "high"


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
    """Gera imagem via OpenAI e devolve URL estável (no Supabase).
    Retorna None se algo falhar. Tenta o modelo configurado e, em caso de
    falha (ex.: conta sem acesso ao gpt-image-1), cai pro dall-e-3."""
    cli = _openai_client()
    if cli is None:
        print("[image_gen] OPENAI_API_KEY ausente", flush=True)
        return None

    # Lista de modelos a tentar: o primario (env) + o fallback (dall-e-3).
    candidatos = [IMAGE_MODEL]
    if IMAGE_MODEL != "dall-e-3":
        candidatos.append("dall-e-3")

    for modelo in candidatos:
        is_dalle = modelo.startswith("dall-e")
        # tamanhos e qualidade variam por modelo
        if is_dalle:
            if size in ("1536x1024",):
                size_norm = "1792x1024"
            elif size in ("1024x1536",):
                size_norm = "1024x1792"
            elif size == "auto":
                size_norm = "1024x1024"
            else:
                size_norm = size
            quality = "hd"
        else:
            if size == "1792x1024":
                size_norm = "1536x1024"
            elif size == "1024x1792":
                size_norm = "1024x1536"
            else:
                size_norm = size
            quality = "high"

        print(f"[image_gen] modelo={modelo} size={size_norm} q={quality} prompt='{prompt[:60]}...'", flush=True)
        try:
            resp = cli.images.generate(
                model=modelo,
                prompt=prompt,
                size=size_norm,  # type: ignore[arg-type]
                quality=quality,  # type: ignore[arg-type]
                n=1,
            )
            if not resp.data:
                print(f"[image_gen] {modelo}: resposta sem data", flush=True)
                continue
            item = resp.data[0]
            b64 = getattr(item, "b64_json", None)
            url = getattr(item, "url", None)
        except Exception as e:  # noqa: BLE001
            print(f"[image_gen] {modelo} falhou: {type(e).__name__}: {e}", flush=True)
            continue

        if b64:
            import base64
            try:
                content = base64.b64decode(b64)
            except Exception as e:  # noqa: BLE001
                print(f"[image_gen] {modelo}: decode b64 falhou: {type(e).__name__}: {e}", flush=True)
                continue
            up = _upload_supabase(content)
            if up:
                return up
            continue

        if url:
            try:
                r = requests.get(url, timeout=60)
                r.raise_for_status()
                up = _upload_supabase(r.content)
                if up:
                    return up
            except Exception as e:  # noqa: BLE001
                print(f"[image_gen] {modelo}: download/upload falhou: {type(e).__name__}: {e}", flush=True)
            continue

        print(f"[image_gen] {modelo}: resposta sem b64_json nem url", flush=True)

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
