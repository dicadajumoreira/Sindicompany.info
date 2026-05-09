"""
S08 — Nosso Condomínio (Manutenções).

Páginas: 1-N dinâmico (Doc 01 §3 S08).

Regras de paginação:
- Manutenção com 6+ fotos → página inteira (hero) com foto grande + grid
- Manutenção com 3-5 fotos → card grande (large), 1 por página coletiva
- Manutenção com 1-2 fotos → card pequeno (small), até 2 por página
- Padrão: máx 6 fotos por página em A4

Para preview com placeholders, foto vira background colorido baseado no
hash do título.

Inputs:
- mes_referencia (str)
- nome_condominio (str)
- manutencoes (list[dict]):
  - titulo (str)
  - descricao (str opcional)
  - tipo_badge ('MANUTENÇÃO' | 'JARDIM' | 'ENGENHARIA' | 'OPERACIONAL' | 'SEGURANÇA')
  - fotos (list[str]) — paths/URLs ou strings vazias para placeholder
"""

from __future__ import annotations

import hashlib

from .base import Section


_BADGE_COLORS = {
    "jardim":       ("#84C7D3", "#1A1C29"),
    "piscina":      ("#84C7D3", "#1A1C29"),
    "elevador":     ("#1A1C29", "#FFFFFF"),
    "maquinário":   ("#1A1C29", "#FFFFFF"),
    "maquinario":   ("#1A1C29", "#FFFFFF"),
    "pintura":      ("#D4AE94", "#1A1C29"),
    "reforma":      ("#D4AE94", "#1A1C29"),
    "limpeza":      ("#76B1BC", "#FFFFFF"),
    "hidráulica":   ("#B8C0FF", "#1A1C29"),
    "hidraulica":   ("#B8C0FF", "#1A1C29"),
    "elétrica":     ("#1A1C29", "#FFFFFF"),
    "eletrica":     ("#1A1C29", "#FFFFFF"),
    "estrutura":    ("#76B1BC", "#FFFFFF"),
    "engenharia":   ("#1A1C29", "#FFFFFF"),
    "operacional":  ("#76B1BC", "#FFFFFF"),
    "segurança":    ("#1A1C29", "#84C7D3"),
    "seguranca":    ("#1A1C29", "#84C7D3"),
    "manutenção":   ("#76B1BC", "#FFFFFF"),
    "manutencao":   ("#76B1BC", "#FFFFFF"),
}


def _badge_colors(badge: str) -> tuple[str, str]:
    return _BADGE_COLORS.get((badge or "manutenção").strip().lower(),
                              ("#76B1BC", "#FFFFFF"))


def _empacotar_por_fotos(mans: list[dict]) -> list[list[dict]]:
    """Distribui as manutenções em páginas com até 6 fotos cada.

    Cada manutenção usa até 4 fotos próprias. Empacotador fecha a página
    quando adicionar a próxima ultrapassaria 6 fotos. Garante que todos
    os itens são listados, mesmo aqueles com 1-2 fotos só.
    """
    pages: list[list[dict]] = []
    cur: list[dict] = []
    cur_count = 0
    for m in mans:
        n_disp = len(m.get("fotos") or [])
        n_usar = min(max(1, n_disp), 4)
        # Fecha sempre que ultrapassaria 6 fotos
        if cur and cur_count + n_usar > 6:
            pages.append(cur)
            cur = []
            cur_count = 0
        item = dict(m)
        item["fotos_usadas"] = (m.get("fotos") or [])[:n_usar]
        cur.append(item)
        cur_count += n_usar
    if cur:
        pages.append(cur)
    return pages


# Paleta de placeholder (8 tonalidades sand/mint/lavender pra variar)
_PLACEHOLDER_PALETTES = [
    ("#84C7D3", "#76B1BC"),   # mint
    ("#D4AE94", "#B07A4B"),   # sand-80 → mais escuro
    ("#B8C0FF", "#6B70B8"),   # lavender
    ("#76B1BC", "#1A1C29"),   # mint-80 → onix
    ("#DABDA9", "#B07A4B"),   # sand
    ("#EFCAAF", "#D4AE94"),   # sand-90 → sand-80
    ("#84C7D3", "#1A1C29"),   # mint → onix
    ("#B8C0FF", "#84C7D3"),   # lavender → mint
]


def _placeholder_gradient(seed: str) -> str:
    """Gera CSS gradient para placeholder de foto baseado em hash do seed."""
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    c1, c2 = _PLACEHOLDER_PALETTES[h % len(_PLACEHOLDER_PALETTES)]
    angle = 100 + (h >> 8) % 80  # 100-180 graus
    return f"background: linear-gradient({angle}deg, {c1} 0%, {c2} 100%);"


def _photo_bg(foto: str, seed: str) -> str:
    """Background CSS pra um slot de foto (real ou placeholder)."""
    if foto:
        return (
            f"background-image: url('{_escape_attr(foto)}');"
            f"background-size: cover; background-position: center;"
        )
    return _placeholder_gradient(seed)


def _display_size(n_photos: int) -> str:
    if n_photos >= 6:
        return "hero"
    if n_photos >= 3:
        return "large"
    return "small"


class OurCondoMaintenance(Section):
    """Nosso Condomínio (Manutenções) — S08."""

    type = "our_condo_maintenance"
    label = "Nosso Condomínio — Manutenções"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        mans = inputs.get("manutencoes") or []
        if not isinstance(mans, list):
            errors.append("Manutenções: 'manutencoes' deve ser lista")
        return errors

    def paginate(self, inputs: dict) -> int:
        # 1 abertura + N páginas. Empacotamento dinâmico por nº de fotos.
        mans = list(inputs.get("manutencoes") or [])
        return 1 + max(1, len(_empacotar_por_fotos(mans)))

    def render_a4(self, inputs: dict, theme) -> list[str]:
        mans = list(inputs.get("manutencoes") or [])
        paginas_de_itens = _empacotar_por_fotos(mans) or [[]]

        pages = [self._render_abertura(inputs, theme)]
        for itens in paginas_de_itens:
            chunk_inputs = dict(inputs)
            chunk_inputs["manutencoes"] = itens
            pages.append(self._render_cards(chunk_inputs, theme))
        return pages

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return self.render_a4(inputs, theme)

    def _render_abertura(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip().upper()
        foto = (inputs.get("foto_capa_caderno") or "").strip()

        # Foto full-bleed; placeholder gradient se sem foto
        if foto:
            bg_css = (
                f"background-image: url('{_escape_attr(foto)}');"
                f"background-size: cover; background-position: center;"
            )
        else:
            bg_css = (
                "background: linear-gradient(135deg, "
                "#84C7D3 0%, #76B1BC 35%, #1A1C29 100%);"
            )

        return f"""
<section class="page maint-cover-page" style="{bg_css}">
  <div class="maint-cover__overlay"></div>
  <div class="maint-cover__content">
    <div class="maint-cover__kicker">{_escape(condo)} · {_escape(mes)}</div>
    <h1 class="maint-cover__titulo">Caderno de<br>Manutenção</h1>
  </div>
</section>

<style>
  .maint-cover-page {{
    position: relative;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    color: var(--white);
    overflow: hidden;
  }}

  .maint-cover__overlay {{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(26,28,41,0.25) 0%,
      rgba(26,28,41,0.45) 60%,
      rgba(26,28,41,0.85) 100%
    );
  }}

  .maint-cover__content {{
    position: absolute;
    left: 56px; right: 56px; bottom: 80px;
    z-index: 2;
  }}

  .maint-cover__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--mint);
    margin-bottom: 18px;
  }}

  .maint-cover__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 96px;
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.03em;
    color: var(--white);
  }}
</style>
"""

    def _render_cards(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        mans = list(inputs.get("manutencoes") or [])

        # Cada manutenção da página vira uma "seção" com badge + título +
        # grid de fotos (cada item usa seu campo 'fotos_usadas' definido
        # pelo empacotamento; total da página fica entre 4 e 6 fotos).
        secoes_html = "\n".join(
            self._render_secao(m, theme) for m in mans
        )

        return f"""
<section class="page maint-page">
  <div class="maint__content">
    <header class="maint__header">
      <div class="maint__kicker">NOSSO CONDOMÍNIO · {_escape(mes)}</div>
      <h1 class="maint__titulo">O que fizemos pelo {_escape(condo)} este mês</h1>
    </header>

    <div class="maint__list">
      {secoes_html}
    </div>
  </div>
</section>

<style>
  .maint-page {{
    background: var(--white);
    color: var(--onix);
    padding: 48px 56px 40px;
  }}

  .maint__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }}

  .maint__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 10px;
  }}

  .maint__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 36px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
    margin-bottom: 6px;
    max-width: 22ch;
    text-wrap: balance;
  }}

  .maint__list {{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}

  .maint-secao {{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}

  .maint-secao__head {{
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }}

  .badge {{
    display: inline-block;
    padding: 3px 9px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }}

  .maint-secao__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1.05;
    color: var(--onix);
    letter-spacing: -0.018em;
    margin: 0;
  }}

  .maint-secao__grid {{
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 8px;
  }}
  .maint-secao__grid--1 {{ grid-template-columns: 1fr; }}
  .maint-secao__grid--2 {{ grid-template-columns: 1fr 1fr; }}
  .maint-secao__grid--3 {{ grid-template-columns: 1.4fr 1fr 1fr; grid-template-rows: 1fr 1fr; }}
  .maint-secao__grid--3 > :first-child {{ grid-row: span 2; }}
  .maint-secao__grid--4 {{ grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }}

  .maint-foto {{
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    min-height: 0;
  }}
</style>
"""

    def _render_secao(self, m: dict, theme) -> str:
        titulo = (m.get("titulo") or "").strip()
        badge = (m.get("tipo_badge") or "MANUTENÇÃO").strip()
        # 'fotos_usadas' é definido pelo empacotador (até 4 por seção).
        # Se não vier, fallback: pega tudo de 'fotos' (até 4).
        fotos = list(m.get("fotos_usadas") or (m.get("fotos") or [])[:4])
        n = max(1, min(4, len(fotos)))
        bg, fg = _badge_colors(badge)

        if fotos:
            cells = []
            for i, foto in enumerate(fotos[:n]):
                seed = titulo + str(i) + foto
                photo_bg = _photo_bg(foto, seed)
                cells.append(f'<div class="maint-foto" style="{photo_bg}"></div>')
            grid_html = (
                f'<div class="maint-secao__grid maint-secao__grid--{n}">'
                f'{"".join(cells)}'
                f'</div>'
            )
        else:
            # Sem fotos: ainda lista o item (placeholder gradient)
            seed = titulo or "manut"
            photo_bg = _photo_bg("", seed)
            grid_html = (
                f'<div class="maint-secao__grid maint-secao__grid--1">'
                f'<div class="maint-foto" style="{photo_bg}"></div>'
                f'</div>'
            )

        return f"""
      <article class="maint-secao">
        <div class="maint-secao__head">
          <span class="badge" style="background:{bg};color:{fg}">{_escape(badge)}</span>
          <h3 class="maint-secao__titulo">{_escape(titulo)}</h3>
        </div>
        {grid_html}
      </article>"""


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _escape_attr(s: str) -> str:
    return _escape(s).replace('"', "&quot;").replace("'", "&#39;")
