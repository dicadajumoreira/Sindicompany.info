"""
Engine de geração de carrossel Instagram da Sindicompany.

Pipeline:
  1. Lê o registro `carrosseis` no Supabase pelo id
  2. Gera copy estruturada via GPT (N slides com tipo + título + body)
  3. Renderiza HTML por slide com paleta + Epilogue
  4. Playwright captura cada slide como PNG 3072×3839 (4K vertical 4:5)
  5. Sobe os PNGs no bucket público condominios-fotos/__carrosseis/<id>/
  6. Gera legenda Instagram via GPT
  7. Atualiza o registro: png_paths, legenda, status=publicada

Falha em qualquer etapa: marca status=erro com erro_mensagem.

Uso (CLI):
    python -m api.carrossel_generate <carrossel_id>
"""

from __future__ import annotations

import io
import json
import os
import sys
import traceback
from typing import Any

from api.supabase_client import _client as _sb_client
from api.text_gen import _client as _openai_client, MODEL, _gerar_json

BUCKET = "condominios-fotos"
SLIDE_W = 3072
SLIDE_H = 3839  # 4:5 vertical

PALETTE = {
    "onix": "#1A1C29",
    "mint": "#84C7D3",
    "sand": "#DABDA9",
    "lavender": "#B8C0FF",
    "white": "#FFFFFF",
    "gray_5": "#F4F4F5",
}


# =============================================================================
# Supabase helpers
# =============================================================================


def _fetch_carrossel(carrossel_id: str) -> dict[str, Any] | None:
    sb = _sb_client()
    res = sb.table("carrosseis").select("*").eq("id", carrossel_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _update_carrossel(carrossel_id: str, fields: dict[str, Any]) -> None:
    sb = _sb_client()
    sb.table("carrosseis").update(fields).eq("id", carrossel_id).execute()


def _upload_png(carrossel_id: str, slide_idx: int, png_bytes: bytes) -> str:
    sb = _sb_client()
    path = f"__carrosseis/{carrossel_id}/slide-{slide_idx}.png"
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=png_bytes,
        file_options={"content-type": "image/png", "upsert": "true"},
    )
    pub = sb.storage.from_(BUCKET).get_public_url(path)
    if isinstance(pub, str):
        return pub
    # supabase-py 2.x retorna string direta; algumas versões retornam dict
    return pub.get("publicUrl") if isinstance(pub, dict) else str(pub)


# =============================================================================
# Copy generation (GPT)
# =============================================================================


def _gerar_copy(carrossel: dict[str, Any]) -> dict[str, Any]:
    """Gera os textos dos slides + legenda Instagram via GPT.

    Retorna dict com:
      - slides: list[{tipo, titulo, body}] — N slides conforme n_slides
      - legenda: str — legenda Instagram pronta pra colar
    """
    n_slides = int(carrossel.get("n_slides") or 6)
    titulo = (carrossel.get("titulo") or "").strip()
    tema = (carrossel.get("tema") or "").strip()
    formato = (carrossel.get("formato") or "historia_real").strip()
    briefing = (carrossel.get("briefing") or "").strip()

    formato_label = formato.replace("_", " ")

    prompt = (
        f"Você está escrevendo um carrossel pro Instagram da Sindicompany "
        f"(@sindicompanybr), gestão condominial profissional. Tom: alegre, "
        f"amigável, objetivo, transparente. Público: moradores de condomínio.\n\n"
        f"BRIEFING:\n"
        f"- Título interno: {titulo}\n"
        f"- Tema: {tema}\n"
        f"- Formato: {formato_label}\n"
        f"- Quantidade de slides: {n_slides}\n"
        + (f"- Contexto extra: {briefing}\n" if briefing else "")
        + f"\n"
        f"REGRAS:\n"
        f"- SLIDE 1 (capa): título-gancho curto que dá curiosidade em 1.5s. "
        f"Body opcional, máx 8 palavras.\n"
        f"- SLIDES INTERNOS: cada um com tipo, título (3-7 palavras) e body "
        f"(1-3 frases curtas, máx 35 palavras). Crie tensão entre slides.\n"
        f"- ÚLTIMO SLIDE: pergunta SIM/NÃO simples ou call-to-action pra "
        f"comentar/salvar.\n"
        f"- Português brasileiro com acentos corretos.\n"
        f"- Fale 'você', não 'os moradores'. Frases curtas.\n"
        f"- NUNCA usar travessão (—). Substituir por vírgula, ponto ou dois-pontos.\n"
        f"- LISTA NEGRA (não usar): 'papel fundamental', 'momento crucial', "
        f"'cenário em constante evolução', 'destacando a importância', "
        f"'o futuro é promissor', 'juntos somos mais fortes'.\n"
        f"- LEGENDA Instagram: 4-6 linhas, hook na primeira, 5-8 hashtags na "
        f"última linha. Tom humano, não corporativo.\n\n"
        f"Devolva JSON estrito (sem markdown):\n"
        f'{{ "slides": [{{"tipo":"capa","titulo":"...","body":"..."}}, '
        f'{{"tipo":"texto","titulo":"...","body":"..."}}, ... '
        f'(total {n_slides} slides) ], "legenda":"..." }}'
    )

    fallback = {
        "slides": (
            [
                {
                    "tipo": "capa",
                    "titulo": titulo or tema or "Sindicompany",
                    "body": "",
                }
            ]
            + [
                {
                    "tipo": "texto",
                    "titulo": f"Ponto {i}",
                    "body": "Conteúdo do slide.",
                }
                for i in range(2, n_slides)
            ]
            + [
                {
                    "tipo": "cta",
                    "titulo": "O que você acha?",
                    "body": "Comenta aqui embaixo.",
                }
            ]
        )[:n_slides],
        "legenda": (
            f"{titulo or tema}\n\n"
            f"Conta nos comentários se você já passou por isso.\n\n"
            f"#sindicompany #condominio #sindico"
        ),
    }

    data = _gerar_json(prompt, fallback, expected_keys=["slides"])
    # Garante n_slides exato
    slides = list(data.get("slides") or [])[:n_slides]
    while len(slides) < n_slides:
        slides.append({"tipo": "texto", "titulo": "", "body": ""})
    data["slides"] = slides
    return data


# =============================================================================
# HTML render
# =============================================================================


def _slide_html(
    *,
    slide_idx: int,
    total: int,
    tipo: str,
    titulo: str,
    body: str,
    foto_capa_url: str = "",
    is_capa: bool = False,
) -> str:
    """Monta o HTML de um único slide pronto pra renderizar."""
    p = PALETTE
    epilogue_url = (
        "https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;800;900&display=swap"
    )

    if is_capa:
        # Slide 1: foto na metade de cima + texto sobre overlay escuro embaixo
        bg = (
            f'<div class="hero-img" style="background-image: url(\'{foto_capa_url}\')"></div>'
            if foto_capa_url
            else f'<div class="hero-img" style="background: linear-gradient(135deg, {p["mint"]} 0%, {p["onix"]} 100%);"></div>'
        )
        body_html = f'<p class="capa-body">{_h(body)}</p>' if body else ""
        return f"""
<!doctype html><html><head><meta charset="utf-8">
<link href="{epilogue_url}" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {SLIDE_W}px; height: {SLIDE_H}px; }}
  body {{
    font-family: 'Epilogue', sans-serif;
    background: {p["onix"]};
    color: {p["white"]};
    overflow: hidden;
    position: relative;
  }}
  .hero-img {{
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }}
  .overlay {{
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg,
      rgba(26,28,41,0.0) 0%,
      rgba(26,28,41,0.0) 38%,
      rgba(26,28,41,0.55) 60%,
      rgba(26,28,41,0.92) 100%
    );
  }}
  .content {{
    position: absolute;
    left: 180px; right: 180px; bottom: 220px;
  }}
  .badge {{
    display: inline-block;
    background: {p["mint"]};
    color: {p["onix"]};
    font-weight: 800;
    font-size: 38px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 18px 32px;
    border-radius: 8px;
    margin-bottom: 60px;
  }}
  .capa-titulo {{
    font-weight: 900;
    font-size: 168px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {p["white"]};
    text-wrap: balance;
  }}
  .capa-body {{
    font-weight: 600;
    font-size: 56px;
    line-height: 1.25;
    color: {p["sand"]};
    margin-top: 48px;
    max-width: 24ch;
  }}
  .handle {{
    position: absolute;
    bottom: 80px; left: 180px;
    font-size: 36px;
    font-weight: 600;
    color: {p["mint"]};
    letter-spacing: 0.08em;
  }}
</style></head>
<body>
  {bg}
  <div class="overlay"></div>
  <div class="content">
    <span class="badge">Sindicompany</span>
    <h1 class="capa-titulo">{_h(titulo)}</h1>
    {body_html}
  </div>
  <div class="handle">@sindicompanybr</div>
</body></html>
"""

    # Slides internos: fundo claro com paleta. Alterna entre 3 estilos.
    is_cta = tipo == "cta" or slide_idx == total
    estilo = "dark" if is_cta else ("sand" if slide_idx % 2 == 0 else "light")
    if estilo == "dark":
        bg_color = p["onix"]
        fg_color = p["white"]
        accent = p["mint"]
        accent_text = p["onix"]
    elif estilo == "sand":
        bg_color = p["sand"]
        fg_color = p["onix"]
        accent = p["onix"]
        accent_text = p["sand"]
    else:
        bg_color = p["gray_5"]
        fg_color = p["onix"]
        accent = p["mint"]
        accent_text = p["onix"]

    badge_label = (
        "Sindicompany"
        if is_cta
        else f"{slide_idx} / {total}"
    )

    body_html = f'<p class="slide-body">{_h(body)}</p>' if body else ""

    return f"""
<!doctype html><html><head><meta charset="utf-8">
<link href="{epilogue_url}" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {SLIDE_W}px; height: {SLIDE_H}px; }}
  body {{
    font-family: 'Epilogue', sans-serif;
    background: {bg_color};
    color: {fg_color};
    overflow: hidden;
    position: relative;
  }}
  .corner {{
    position: absolute;
    top: 180px; right: 180px;
    width: 140px; height: 140px;
    border-radius: 50%;
    background: {accent};
    opacity: 0.35;
  }}
  .content {{
    position: absolute;
    left: 180px; right: 180px;
    top: 50%;
    transform: translateY(-50%);
  }}
  .badge {{
    display: inline-block;
    background: {accent};
    color: {accent_text};
    font-weight: 800;
    font-size: 36px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 16px 28px;
    border-radius: 8px;
    margin-bottom: 80px;
  }}
  .slide-titulo {{
    font-weight: 800;
    font-size: 144px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {fg_color};
    margin-bottom: 56px;
    text-wrap: balance;
    max-width: 18ch;
  }}
  .slide-body {{
    font-weight: 500;
    font-size: 60px;
    line-height: 1.35;
    color: {fg_color};
    opacity: 0.88;
    max-width: 22ch;
  }}
  .handle {{
    position: absolute;
    bottom: 120px; left: 180px;
    font-size: 32px;
    font-weight: 600;
    color: {accent};
    letter-spacing: 0.08em;
  }}
  .pagination {{
    position: absolute;
    bottom: 120px; right: 180px;
    font-size: 32px;
    font-weight: 700;
    color: {fg_color};
    opacity: 0.55;
  }}
</style></head>
<body>
  <div class="corner"></div>
  <div class="content">
    <span class="badge">{_h(badge_label)}</span>
    <h2 class="slide-titulo">{_h(titulo)}</h2>
    {body_html}
  </div>
  <div class="handle">@sindicompanybr</div>
  <div class="pagination">{slide_idx} / {total}</div>
</body></html>
"""


def _h(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# =============================================================================
# Playwright render
# =============================================================================


def _render_slide_png(html: str) -> bytes:
    """Renderiza HTML em PNG 3072×3839 via Playwright sync."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": SLIDE_W, "height": SLIDE_H},
                device_scale_factor=1,
            )
            page = ctx.new_page()
            page.set_content(html, wait_until="networkidle")
            png = page.screenshot(
                full_page=False,
                type="png",
                clip={"x": 0, "y": 0, "width": SLIDE_W, "height": SLIDE_H},
            )
            return png
        finally:
            browser.close()


# =============================================================================
# Pipeline
# =============================================================================


def gerar_carrossel(carrossel_id: str) -> int:
    """Pipeline completo. Retorna 0 se OK, 1 se falhou."""
    print(f"[carrossel] iniciando geração de {carrossel_id}", flush=True)
    try:
        carrossel = _fetch_carrossel(carrossel_id)
        if not carrossel:
            print(f"[carrossel] {carrossel_id} não encontrado", flush=True)
            return 1

        _update_carrossel(carrossel_id, {"status": "em_producao", "erro_mensagem": None})

        # 1. Copy via GPT
        copy = _gerar_copy(carrossel)
        slides = copy["slides"]
        legenda = copy.get("legenda") or ""
        print(f"[carrossel] copy gerado: {len(slides)} slides", flush=True)

        # 2. Render + upload de cada slide
        n_total = len(slides)
        png_urls: list[str] = []
        foto_capa = (carrossel.get("foto_capa_url") or "").strip()

        for i, s in enumerate(slides, start=1):
            html = _slide_html(
                slide_idx=i,
                total=n_total,
                tipo=str(s.get("tipo") or "texto"),
                titulo=str(s.get("titulo") or ""),
                body=str(s.get("body") or ""),
                foto_capa_url=foto_capa,
                is_capa=(i == 1),
            )
            print(f"[carrossel] renderizando slide {i}/{n_total}…", flush=True)
            png = _render_slide_png(html)
            url = _upload_png(carrossel_id, i, png)
            png_urls.append(url)
            print(f"[carrossel] slide {i} salvo: {url[:80]}", flush=True)

        # 3. Atualiza registro
        from datetime import datetime, timezone
        _update_carrossel(carrossel_id, {
            "png_paths": png_urls,
            "legenda": legenda,
            "status": "publicada",
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "erro_mensagem": None,
        })
        print(f"[carrossel] OK — {n_total} slides + legenda", flush=True)
        return 0

    except Exception as e:  # noqa: BLE001
        tb = traceback.format_exc()
        print(f"[carrossel] ERROR: {e}\n{tb}", flush=True)
        try:
            _update_carrossel(carrossel_id, {
                "status": "erro",
                "erro_mensagem": str(e)[:500],
            })
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: python -m api.carrossel_generate <carrossel_id>", file=sys.stderr)
        sys.exit(2)
    sys.exit(gerar_carrossel(sys.argv[1]))
