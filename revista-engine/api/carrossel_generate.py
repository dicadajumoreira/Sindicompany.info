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

import base64
import io
import json
import os
import sys
import traceback
import urllib.error
import urllib.request
from typing import Any

from api.supabase_client import _client as _sb_client
from api.text_gen import _client as _openai_client, MODEL, _gerar_json


_PATTERNS_CACHE: list[str] | None = None  # data URLs prontos pra uso


def _patterns_data_urls() -> list[str]:
    """Baixa todos os patterns disponiveis em
    condominios-fotos/__patterns/pattern-{1..20}.{png,jpg,webp}
    e devolve lista de data URLs (base64). Cache por processo pra
    nao re-baixar a cada slide. Falha silenciosa se nao houver
    patterns ou SUPABASE_URL nao estiver setada."""
    global _PATTERNS_CACHE
    if _PATTERNS_CACHE is not None:
        return _PATTERNS_CACHE

    out: list[str] = []
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _PATTERNS_CACHE = out
        return out

    for i in range(1, 21):
        for ext in ("png", "jpg", "jpeg", "webp"):
            url = (
                f"{base}/storage/v1/object/public/"
                f"condominios-fotos/__patterns/pattern-{i}.{ext}"
            )
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": "carrossel-engine/1.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status != 200:
                        continue
                    content = resp.read()
                    ctype = (
                        resp.headers.get("Content-Type", "image/png")
                        .split(";")[0]
                        .strip()
                    )
                b64 = base64.b64encode(content).decode("ascii")
                out.append(f"data:{ctype};base64,{b64}")
                break  # achou nessa ext, vai pro proximo i
            except urllib.error.HTTPError:
                continue
            except Exception as e:  # noqa: BLE001
                print(
                    f"[carrossel] pattern-{i}.{ext} falhou: {type(e).__name__}: {e}",
                    flush=True,
                )
                break

    _PATTERNS_CACHE = out
    print(f"[carrossel] {len(out)} pattern(s) carregado(s)", flush=True)
    return out


def _pattern_for_slide(slide_idx: int) -> str:
    """Devolve uma data URL ciclando entre patterns disponiveis pelo
    indice do slide, ou string vazia se nenhum pattern existir."""
    pats = _patterns_data_urls()
    if not pats:
        return ""
    return pats[(slide_idx - 1) % len(pats)]


_ICON_CACHE: str | None = None
_ICONS_LIST_CACHE: list[str] | None = None


def _icon_data_url() -> str:
    """Devolve data URL do icon principal (slot 1 em __icons/icon-1.X)
    pra usar como marca no canto inferior direito dos slides. Cache
    no processo. String vazia se nao houver."""
    global _ICON_CACHE
    if _ICON_CACHE is not None:
        return _ICON_CACHE
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _ICON_CACHE = ""
        return ""
    for ext in ("png", "svg", "webp", "jpg", "jpeg"):
        url = (
            f"{base}/storage/v1/object/public/"
            f"condominios-fotos/__icons/icon-1.{ext}"
        )
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "carrossel-engine/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    continue
                content = resp.read()
                ctype = (
                    resp.headers.get("Content-Type", "image/png")
                    .split(";")[0]
                    .strip()
                )
            b64 = base64.b64encode(content).decode("ascii")
            _ICON_CACHE = f"data:{ctype};base64,{b64}"
            print(f"[carrossel] icon-1.{ext} carregado", flush=True)
            return _ICON_CACHE
        except urllib.error.HTTPError:
            continue
        except Exception as e:  # noqa: BLE001
            print(
                f"[carrossel] icon-1.{ext} falhou: {type(e).__name__}: {e}",
                flush=True,
            )
            break
    _ICON_CACHE = ""
    return ""


def _icons_all_data_urls() -> list[str]:
    """Baixa todos os icons do CARROSSEL em
    __icon-carrossel/icon-{1..20}.X e devolve lista de data URLs na
    ordem dos slots. Cache por processo. Slots vazios sao pulados.

    Bucket separado de __icons/ (que eh a biblioteca geral). Esse aqui
    e exclusivo da engine de carrossel: cada slot preenche o fundo de
    um slide especifico."""
    global _ICONS_LIST_CACHE
    if _ICONS_LIST_CACHE is not None:
        return _ICONS_LIST_CACHE
    out: list[str] = []
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _ICONS_LIST_CACHE = out
        return out
    for i in range(1, 21):
        for ext in ("png", "svg", "webp", "jpg", "jpeg"):
            url = (
                f"{base}/storage/v1/object/public/"
                f"condominios-fotos/__icon-carrossel/icon-{i}.{ext}"
            )
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": "carrossel-engine/1.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status != 200:
                        continue
                    content = resp.read()
                    ctype = (
                        resp.headers.get("Content-Type", "image/png")
                        .split(";")[0]
                        .strip()
                    )
                b64 = base64.b64encode(content).decode("ascii")
                out.append(f"data:{ctype};base64,{b64}")
                break  # achou nessa ext, vai pro proximo i
            except urllib.error.HTTPError:
                continue
            except Exception:  # noqa: BLE001
                break
    _ICONS_LIST_CACHE = out
    print(f"[carrossel] {len(out)} icon-carrossel carregado(s)", flush=True)
    return out


def _icon_for_slide(slide_idx: int) -> str:
    """Mapeia: slot 1 -> slide 2, slot 2 -> slide 3, etc.
    Se nao houver icon pra o slide, cicla pra reutilizar."""
    icons = _icons_all_data_urls()
    if not icons or slide_idx < 2:
        return ""
    return icons[(slide_idx - 2) % len(icons)]

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


def _upload_slides_zip(
    carrossel_id: str, png_bytes_por_slide: list[bytes]
) -> str:
    """Empacota todos os PNGs em um ZIP e sobe pro bucket. Devolve URL
    publica. Cada PNG vai como slide-N.png (mesma convencao dos
    individuais)."""
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
        for i, png in enumerate(png_bytes_por_slide, start=1):
            zf.writestr(f"slide-{i}.png", png)
    zip_bytes = buf.getvalue()
    sb = _sb_client()
    path = f"__carrosseis/{carrossel_id}/slides.zip"
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=zip_bytes,
        file_options={"content-type": "application/zip", "upsert": "true"},
    )
    pub = sb.storage.from_(BUCKET).get_public_url(path)
    if isinstance(pub, str):
        return pub
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
        f"\nREGRAS DE PORTUGUÊS (humanização):\n"
        f"- Acentos corretos em TODA palavra: você, síndico, condomínio, "
        f"gestão, está, são, é, à, taxa.\n"
        f"- Fale 'você', voz ativa, sujeito explícito. Frases curtas e "
        f"longas misturadas.\n"
        f"- NUNCA travessão (—). Use vírgula, ponto, dois-pontos ou parênteses.\n"
        f"- NUNCA aspas curvas (“”). Só aspas retas (\").\n"
        f"- Use exemplos concretos (números, ações reais). Sem abstração genérica.\n"
        f"- LISTA NEGRA (proibidas, literais ou em sinônimo claro):\n"
        f"  'papel fundamental', 'momento crucial', 'cenário em constante "
        f"evolução', 'destacando a importância', 'o futuro é promissor', "
        f"'juntos somos mais fortes', 'destaca-se', 'se destaca', 'vibrante', "
        f"'no coração de', 'em meio a', 'reflete a', 'simboliza a', "
        f"'evidencia a', 'um verdadeiro testemunho', 'desafios e oportunidades', "
        f"'rica diversidade', 'não apenas X, mas também Y', 'mergulhando em', "
        f"'celebrando a', 'fomentando o', 'pavimentando o caminho'.\n"
        f"- Sem emoji, sem negrito mecânico, sem listas com cabeçalho colado em dois-pontos.\n"
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
        icon_url = _icon_data_url()
        icon_img = (
            f'<img class="brand-icon" src="{icon_url}" alt="" />' if icon_url else ""
        )
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
    /* Texto da capa ocupa exatamente 50% (metade de baixo).
       Topo segue limpo pra a foto aparecer; metade de baixo tem
       gradiente forte pra contraste do titulo. */
    position: absolute; top: 50%; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg,
      rgba(26,28,41,0.0) 0%,
      rgba(26,28,41,0.85) 18%,
      rgba(26,28,41,0.96) 100%
    );
  }}
  .content {{
    /* Caixa de texto cobre exatamente a metade inferior do slide. */
    position: absolute;
    left: 180px; right: 180px;
    top: 50%; bottom: 0;
    padding: 100px 0 220px;
    display: flex; flex-direction: column; justify-content: center;
  }}
  /* Tamanhos calibrados pra Instagram display (1080w). Slide eh
     3072w (escala 2.844x), por isso os px CSS sao maiores que os
     px display que a marca pediu:
       capa titulo  100 display -> 285 css
       capa body     50 display -> 142 css
       capa @        28 display ->  80 css */
  .badge {{
    display: inline-block;
    background: {p["mint"]};
    color: {p["onix"]};
    font-weight: 800;
    font-size: 80px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 22px 40px;
    border-radius: 10px;
    margin-bottom: 60px;
  }}
  .capa-titulo {{
    font-weight: 900;
    font-size: 285px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {p["white"]};
    text-wrap: balance;
  }}
  .capa-body {{
    font-weight: 600;
    font-size: 142px;
    line-height: 1.25;
    color: {p["sand"]};
    margin-top: 48px;
    max-width: 24ch;
  }}
  .handle {{
    position: absolute;
    bottom: 80px; left: 180px;
    font-family: 'Epilogue', sans-serif;
    font-size: 80px;
    font-weight: 600;
    color: {p["mint"]};
    letter-spacing: 0.08em;
  }}
  .brand-icon {{
    /* +100% sobre o tamanho anterior (220 -> 440) pra reforcar a marca. */
    position: absolute;
    bottom: 80px; right: 180px;
    width: 440px; height: 440px;
    object-fit: contain;
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
  {icon_img}
</body></html>
"""

    # Slides internos: cada slide ganha uma cor de fundo diferente,
    # ciclando pares e impares por listas separadas. Garante que
    # consecutivos nao repitam (pares cycle 2, impares cycle 3).
    # Excecao: ULTIMO SLIDE (CTA) sempre fundo onix pra fechar o
    # carrossel com peso de marca.
    is_cta = tipo == "cta" or slide_idx == total
    if is_cta:
        bg_color = p["onix"]
        fg_color = p["white"]
        accent = p["mint"]
        accent_text = p["onix"]
    else:
        pares = [p["mint"], p["sand"]]
        impares = [p["lavender"], p["white"], p["gray_5"]]
        if slide_idx % 2 == 0:
            bg_color = pares[(slide_idx // 2 - 1) % len(pares)]
        else:
            bg_color = impares[((slide_idx - 1) // 2 - 1) % len(impares)]

        fg_color = p["onix"]
        # Accent: nas cores muito claras (white / gray_5) usa mint pra
        # destacar; nas medias (mint / sand / lavender) usa onix solido.
        if bg_color in (p["white"], p["gray_5"]):
            accent = p["mint"]
            accent_text = p["onix"]
        else:
            accent = p["onix"]
            accent_text = p["white"]

    badge_label = (
        "Sindicompany"
        if is_cta
        else f"{slide_idx} / {total}"
    )

    body_html = f'<p class="slide-body">{_h(body)}</p>' if body else ""

    # Pattern de fundo:
    # - Slides internos: pattern ciclando, tile 800x800, 10% opacity
    # - CTA (ultimo): Pattern 1 fixo, mesma regra (tile 800x800, 10%)
    if is_cta:
        pats = _patterns_data_urls()
        pattern_url = pats[0] if pats else ""
    else:
        pattern_url = _pattern_for_slide(slide_idx)
    pattern_div = '<div class="pattern-bg"></div>' if pattern_url else ""

    # Tamanhos calibrados pra Instagram (1080w display). Slide 4K
    # = 2.844x, por isso CSS px = display px * 2.844 (arredondado).
    # Internos (mid 75/47/27 display): titulo 213, body 134, footer 77.
    # CTA (mid 80/52/29 display):     titulo 228, body 148, @ 82.
    if is_cta:
        titulo_font = 228
        body_font = 148
        handle_font = 82
        pagination_font = 82
        badge_font = 82
    else:
        titulo_font = 213
        body_font = 134
        handle_font = 77
        pagination_font = 77
        badge_font = 80

    icon_url_internal = _icon_for_slide(slide_idx)
    icon_img_internal = (
        f'<img class="brand-icon" src="{icon_url_internal}" alt="" />'
        if icon_url_internal
        else ""
    )
    icon_bg_div = (
        '<div class="icon-bg"></div>' if icon_url_internal else ""
    )
    # Contraste: bg escuro (onix da CTA) inverte o icone pra branco;
    # bg claro forca o icone a ficar preto solido. Garante leitura
    # independente da cor original do icone subido.
    bg_is_dark = bg_color == p["onix"]
    icon_filter = (
        "brightness(0) invert(1)" if bg_is_dark else "brightness(0)"
    )
    # Posicao do icon de fundo: rente a borda direita nos pares
    # (2, 4, 6) e rente a borda esquerda nos impares (3, 5, 7).
    icon_bleed_side = "right" if slide_idx % 2 == 0 else "left"

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
  .pattern-bg {{
    /* Pattern da marca em 10% como textura de fundo nos slides internos.
       Tile 800px pra o desenho aparecer claramente em 4K sem ficar
       tao denso que polua o conteudo. */
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('{pattern_url}');
    background-repeat: repeat;
    background-size: 800px 800px;
    opacity: 0.10;
    pointer-events: none;
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
    font-size: {badge_font}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 22px 40px;
    border-radius: 10px;
    margin-bottom: 80px;
  }}
  .slide-titulo {{
    font-weight: 800;
    font-size: {titulo_font}px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {fg_color};
    margin-bottom: 56px;
    text-wrap: balance;
    max-width: 18ch;
  }}
  .slide-body {{
    font-weight: 500;
    font-size: {body_font}px;
    line-height: 1.35;
    color: {fg_color};
    opacity: 0.88;
    max-width: 22ch;
  }}
  /* Para palavras destacadas dentro do body — 55-70 display
     (mid 62 -> 176 css). Use <span class="destaque">…</span>. */
  .destaque {{
    font-weight: 800;
    font-size: 176px;
    line-height: 1.1;
    color: {accent};
  }}
  .handle {{
    position: absolute;
    bottom: 120px; left: 180px;
    font-family: 'Epilogue', sans-serif;
    font-size: {handle_font}px;
    font-weight: 600;
    color: {accent};
    letter-spacing: 0.08em;
  }}
  .brand-icon {{
    /* Icone da marca no canto inferior direito de cada slide.
       Slot 1 em __icons/icon-1 — fica vazio se nao houver. */
    position: absolute;
    bottom: 80px; right: 180px;
    width: 440px; height: 440px;
    object-fit: contain;
  }}
  .icon-bg {{
    /* Icone grande de fundo: 90% da largura do slide (~2765px),
       posicionado RENTE a borda (sem bleed), alternando direita/
       esquerda pela paridade do indice. Pares (2, 4, 6) -> direita;
       impares (3, 5, 7) -> esquerda. 15% opacity. CSS filter forca
       preto/branco conforme a cor do bg pra garantir contraste.
       background-position alinhado na borda pra o icone ficar 0mm
       da borda do slide (sem gap mesmo com aspect ratio diferente). */
    position: absolute;
    top: 50%;
    {icon_bleed_side}: 0;
    transform: translateY(-50%);
    width: 2765px; height: 2765px;
    background-image: url('{icon_url_internal}');
    background-repeat: no-repeat;
    background-position: {icon_bleed_side} center;
    background-size: contain;
    opacity: 0.15;
    filter: {icon_filter};
    pointer-events: none;
  }}
</style></head>
<body>
  {pattern_div}
  {icon_bg_div}
  <div class="corner"></div>
  <div class="content">
    <span class="badge">{_h(badge_label)}</span>
    <h2 class="slide-titulo">{_h(titulo)}</h2>
    {body_html}
  </div>
  <div class="handle">@sindicompanybr</div>
  {icon_img_internal}
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

        # 1. Copy: prefere a copy escolhida pela editora no wizard.
        #    Cai no _gerar_copy só pra registros legacy sem copy_options.
        copy_options = carrossel.get("copy_options") or []
        copy_selected = carrossel.get("copy_selected")
        chosen = None
        if isinstance(copy_options, list) and copy_options:
            idx = copy_selected if isinstance(copy_selected, int) else 0
            if 0 <= idx < len(copy_options):
                chosen = copy_options[idx]
        if chosen and isinstance(chosen, dict) and chosen.get("slides"):
            slides = list(chosen.get("slides") or [])
            legenda = chosen.get("legenda") or ""
            print(
                f"[carrossel] usando copy salva (idx={copy_selected}): {len(slides)} slides",
                flush=True,
            )
        else:
            copy = _gerar_copy(carrossel)
            slides = copy["slides"]
            legenda = copy.get("legenda") or ""
            print(f"[carrossel] copy gerado pelo engine: {len(slides)} slides", flush=True)

        # 2. Render + upload de cada slide
        n_total = len(slides)
        png_urls: list[str] = []
        png_bytes_list: list[bytes] = []
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
            png_bytes_list.append(png)
            print(f"[carrossel] slide {i} salvo: {url[:80]}", flush=True)

        # 2b. Empacota todos os PNGs num ZIP pra download de uma vez
        zip_url = ""
        try:
            zip_url = _upload_slides_zip(carrossel_id, png_bytes_list)
            print(f"[carrossel] zip salvo: {zip_url[:80]}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[carrossel] falha ao subir zip (segue sem): {e}", flush=True)

        # 3. Atualiza registro. zip_url eh coluna nova (migration
        # 20260524) — se ainda nao foi rodada no Supabase a chamada
        # quebra com PGRST204. Tentamos com o campo; se cair com erro
        # de coluna ausente, fazemos retry sem ele.
        from datetime import datetime, timezone
        base_fields = {
            "png_paths": png_urls,
            "legenda": legenda,
            "status": "publicada",
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "erro_mensagem": None,
        }
        try:
            _update_carrossel(
                carrossel_id, {**base_fields, "zip_url": zip_url or None}
            )
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "zip_url" in msg or "PGRST204" in msg:
                print(
                    f"[carrossel] coluna zip_url ausente (rode migration "
                    f"20260524). Salvando sem zip_url. Detalhe: {msg[:120]}",
                    flush=True,
                )
                _update_carrossel(carrossel_id, base_fields)
            else:
                raise
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
