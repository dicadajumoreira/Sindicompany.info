"""
S07 — Novidades e Legislação.

1 página fixa. 3 notícias dos últimos 30 dias com badge categorizado e
fonte sempre citada (Doc 01 §3 S07).

Inputs:
- mes_referencia (str)
- noticias (list[dict], 3 itens):
  - badge ('LEGISLAÇÃO' | 'MERCADO' | 'NOVIDADE' | 'TECNOLOGIA')
  - titulo (str)
  - data (str) — DD/MM/AAAA ou descritivo
  - resumo (str)
  - fonte (str)
"""

from __future__ import annotations

from .base import Section


# Cores do badge por tipo
_BADGE_COLORS = {
    "legislação": ("#1A1C29", "#FFFFFF"),
    "legislacao": ("#1A1C29", "#FFFFFF"),
    "mercado":    ("#D4AE94", "#1A1C29"),  # sand-80
    "novidade":   ("#84C7D3", "#1A1C29"),  # mint
    "tecnologia": ("#B8C0FF", "#1A1C29"),  # lavender
    "tech":       ("#B8C0FF", "#1A1C29"),
}


def _badge_colors(badge: str) -> tuple[str, str]:
    return _BADGE_COLORS.get((badge or "").strip().lower(), ("#76B1BC", "#FFFFFF"))


class News(Section):
    """Novidades e Legislação (S07)."""

    type = "news"
    label = "Novidades e Legislação"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        items = inputs.get("noticias") or []
        if not isinstance(items, list) or not items:
            errors.append("Novidades: 'noticias' precisa ser lista não-vazia")
        elif len(items) > 5:
            errors.append(f"Novidades: máximo 5 itens (recebido {len(items)})")
        else:
            for i, n in enumerate(items):
                if not n.get("fonte"):
                    errors.append(f"Novidades[{i}]: 'fonte' é obrigatória")
                if not n.get("titulo"):
                    errors.append(f"Novidades[{i}]: 'titulo' é obrigatório")
        return errors

    def paginate(self, inputs: dict) -> int:
        return 1

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def _render(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        intro = (inputs.get("intro") or "").strip()
        items = list(inputs.get("noticias") or [])[:5]

        cards_html = "\n".join(self._render_card(n) for n in items)

        intro_html = (
            f'<p class="news__intro">{_escape(intro)}</p>'
            if intro else ""
        )

        return f"""
<section class="page news-page">
  <div class="news__content">
    <header class="news__header">
      <div class="news__kicker">NOVIDADES E LEGISLAÇÃO · {_escape(mes)}</div>
      <h1 class="news__titulo">O que aconteceu nos últimos 30 dias</h1>
      {intro_html}
    </header>

    <div class="news__list">
      {cards_html}
    </div>
  </div>
</section>

<style>
  .news-page {{
    background: var(--white);
    color: var(--onix);
    padding: 48px 56px 40px;
  }}

  .news__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }}

  .news__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 12px;
  }}

  .news__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 38px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
    margin-bottom: 8px;
    max-width: 22ch;
    text-wrap: balance;
  }}

  .news__intro {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.7;
    max-width: 60ch;
  }}

  .news__list {{
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
    min-height: 0;
  }}

  .news-card {{
    background: var(--gray-5);
    border-radius: 8px;
    padding: 18px 22px;
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 18px;
    align-items: start;
    flex: 1;
  }}

  .news-card__meta {{
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }}

  .badge {{
    display: inline-block;
    padding: 3px 9px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }}

  .news-card__data {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--onix);
    opacity: 0.55;
  }}

  .news-card__body {{
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}

  .news-card__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 1.1;
    color: var(--onix);
    letter-spacing: -0.015em;
  }}

  .news-card__resumo {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.8;
  }}

  .news-card__fonte {{
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(26, 28, 41, 0.12);
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 600;
    color: var(--mint-80);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }}

  .news-card__fonte::before {{
    content: "Fonte · ";
    opacity: 0.7;
  }}
</style>
"""

    def _render_card(self, n: dict) -> str:
        bg, fg = _badge_colors(n.get("badge", ""))
        return f"""
      <article class="news-card">
        <div class="news-card__meta">
          <span class="badge" style="background:{bg};color:{fg}">
            {_escape(n.get('badge', '—'))}
          </span>
          <div class="news-card__data">{_escape(n.get('data', ''))}</div>
        </div>
        <div class="news-card__body">
          <h3 class="news-card__titulo">{_escape(n.get('titulo', ''))}</h3>
          <p class="news-card__resumo">{_escape(n.get('resumo', ''))}</p>
          <div class="news-card__fonte">{_escape(n.get('fonte', ''))}</div>
        </div>
      </article>"""


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
