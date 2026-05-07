"""
S03 — Agenda Cultural.

1 página fixa. Zona A (hero ~50%) + zona B (grid 2 colunas com 4–5 cards
secundários). Tom editorial leve.

Inputs (Doc 01 §3 S03):
- mes_referencia (str)
- hero (dict): categoria, titulo, sinopse, foto (path/URL opcional)
- cards_secundarios (list[dict]): categoria, titulo, descricao_curta,
  data (opcional, ex: "30 abr")
"""

from __future__ import annotations

from .base import Section


# Cor do badge por categoria (lookup case-insensitive)
_CATEGORIA_COLORS = {
    "cinema":     ("#1A1C29", "#FFFFFF"),  # onix bg, white text
    "série":      ("#76B1BC", "#FFFFFF"),  # mint-80
    "serie":      ("#76B1BC", "#FFFFFF"),
    "streaming":  ("#76B1BC", "#FFFFFF"),
    "show":       ("#D4AE94", "#1A1C29"),  # sand-80
    "shows":      ("#D4AE94", "#1A1C29"),
    "música":     ("#D4AE94", "#1A1C29"),
    "musica":     ("#D4AE94", "#1A1C29"),
    "game":       ("#B8C0FF", "#1A1C29"),  # lavender
    "games":      ("#B8C0FF", "#1A1C29"),
    "tech":       ("#B8C0FF", "#1A1C29"),
    "arte":       ("#84C7D3", "#1A1C29"),  # mint
    "exposição":  ("#84C7D3", "#1A1C29"),
    "exposicao":  ("#84C7D3", "#1A1C29"),
    "evento":     ("#84C7D3", "#1A1C29"),
    "livro":      ("#EFCAAF", "#1A1C29"),  # sand-90
    "estreia":    ("#1A1C29", "#FFFFFF"),
}


def _badge_colors(cat: str) -> tuple[str, str]:
    """Retorna (background, color) para o badge da categoria."""
    if not cat:
        return ("#1A1C29", "#FFFFFF")
    key = cat.strip().lower()
    return _CATEGORIA_COLORS.get(key, ("#1A1C29", "#FFFFFF"))


class CulturalAgenda(Section):
    """Agenda Cultural (S03)."""

    type = "cultural_agenda"
    label = "Agenda Cultural"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        hero = inputs.get("hero") or {}
        if not isinstance(hero, dict):
            errors.append("Agenda: 'hero' deve ser um dict")
            return errors
        if not hero.get("titulo"):
            errors.append("Agenda: hero.titulo é obrigatório")

        cards = inputs.get("cards_secundarios") or []
        if not isinstance(cards, list):
            errors.append("Agenda: 'cards_secundarios' deve ser lista")
        elif len(cards) > 6:
            errors.append(f"Agenda: máximo 6 cards secundários (recebido {len(cards)})")
        return errors

    def paginate(self, inputs: dict) -> int:
        return 1

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def _render(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        hero = inputs.get("hero") or {}
        cards = list(inputs.get("cards_secundarios") or [])[:6]

        hero_html = self._render_hero(hero, theme)
        cards_html = self._render_cards(cards, theme)

        return f"""
<section class="page agenda-page">
  <div class="agenda__content">
    <header class="agenda__header">
      <div class="agenda__kicker">AGENDA CULTURAL · {_escape(mes)}</div>
      <h1 class="agenda__titulo">Vale a pena ver, ouvir e visitar</h1>
      <p class="agenda__sub">
        Uma seleção do que há de mais interessante nos cinemas, palcos
        e telas neste mês.
      </p>
    </header>

    {hero_html}

    <div class="agenda__cards">
      {cards_html}
    </div>
  </div>
</section>

<style>
  .agenda-page {{
    background: var(--white);
    color: var(--onix);
    padding: 48px 56px 40px;
  }}

  .agenda__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }}

  .agenda__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 10px;
  }}

  .agenda__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 38px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
    margin-bottom: 6px;
  }}

  .agenda__sub {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    color: var(--onix);
    opacity: 0.65;
    line-height: 1.4;
    max-width: 60ch;
  }}

  /* Hero */
  .agenda-hero {{
    display: flex;
    gap: 18px;
    align-items: stretch;
    background: var(--gray-5);
    border-radius: 8px;
    overflow: hidden;
  }}

  .agenda-hero__photo {{
    flex: 0 0 50%;
    min-height: 220px;
    background-position: center;
    background-size: cover;
    background-repeat: no-repeat;
  }}

  .agenda-hero__body {{
    flex: 1;
    padding: 18px 22px 18px 0;
    display: block;
  }}

  .agenda-hero__label,
  .agenda-hero__titulo,
  .agenda-hero__sinopse,
  .agenda-hero__data {{
    margin-bottom: 10px;
  }}

  .agenda-hero__data {{
    margin-bottom: 0;
  }}

  .agenda-hero__label {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
  }}

  .agenda-hero__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 26px;
    font-weight: 400;
    line-height: 1.0;
    letter-spacing: -0.02em;
    color: var(--onix);
  }}

  .agenda-hero__sinopse {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.85;
  }}

  .agenda-hero__data {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--onix);
    opacity: 0.6;
    padding-top: 4px;
    border-top: 1px solid var(--gray-20);
  }}

  /* Cards secundários — grid 3 colunas, altura compacta */
  .agenda__cards {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: min-content;
    gap: 10px;
  }}

  .agenda-card {{
    background: var(--gray-5);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }}

  .agenda-card__head {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }}

  .badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }}

  .agenda-card__data {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--onix);
    opacity: 0.55;
  }}

  .agenda-card__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 1.1;
    color: var(--onix);
    margin-top: 2px;
  }}

  .agenda-card__desc {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9.5px;
    line-height: 1.4;
    color: var(--onix);
    opacity: 0.75;
    margin-top: 4px;
  }}
</style>
"""

    # --------------------------------------------------------------
    def _render_hero(self, hero: dict, theme) -> str:
        if not hero or not hero.get("titulo"):
            return ""
        cat = (hero.get("categoria") or "").strip()
        bg, fg = _badge_colors(cat)
        foto = (hero.get("foto") or "").strip()
        if foto:
            photo_css = (
                f"background-image: url('{_escape_attr(foto)}');"
            )
        else:
            # Placeholder gradient
            photo_css = (
                "background: linear-gradient(135deg, "
                "var(--lavender) 0%, var(--mint) 60%, var(--mint-80) 100%);"
            )
        data = (hero.get("data") or "").strip()

        return f"""
    <article class="agenda-hero">
      <div class="agenda-hero__photo" style="{photo_css}"></div>
      <div class="agenda-hero__body">
        <span class="agenda-hero__label">
          <span class="badge" style="background:{bg};color:{fg}">
            {_escape(cat) or 'DESTAQUE'}
          </span>
        </span>
        <h2 class="agenda-hero__titulo">{_escape(hero.get('titulo',''))}</h2>
        <p class="agenda-hero__sinopse">{_escape(hero.get('sinopse',''))}</p>
        {f'<div class="agenda-hero__data">{_escape(data)}</div>' if data else ''}
      </div>
    </article>
"""

    # --------------------------------------------------------------
    def _render_cards(self, cards: list[dict], theme) -> str:
        if not cards:
            return ""
        items = []
        for c in cards:
            cat = (c.get("categoria") or "").strip()
            bg, fg = _badge_colors(cat)
            data = (c.get("data") or "").strip()
            items.append(f"""
      <article class="agenda-card">
        <div class="agenda-card__head">
          <span class="badge" style="background:{bg};color:{fg}">{_escape(cat) or '—'}</span>
          {f'<span class="agenda-card__data">{_escape(data)}</span>' if data else ''}
        </div>
        <h3 class="agenda-card__titulo">{_escape(c.get('titulo',''))}</h3>
        <p class="agenda-card__desc">{_escape(c.get('descricao_curta','') or c.get('descricao',''))}</p>
      </article>""")
        return "\n".join(items)


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _escape_attr(s: str) -> str:
    return _escape(s).replace('"', "&quot;").replace("'", "&#39;")
