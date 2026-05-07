"""
S09 — Nosso Condomínio (Eventos).

1-N páginas dinâmico (Doc 01 §3 S09). Por ora: 1 página com até 4 eventos
em grid 2×2.

Regras (Doc 01):
- Máx 4 cards no grid
- Foto sem legenda confirmada → exibir só foto, NUNCA inventar legenda

Inputs:
- mes_referencia (str)
- nome_condominio (str)
- eventos (list[dict]):
  - titulo (str)
  - data (str) — descritiva, ex: "5 de abril"
  - descricao (str opcional)
  - fotos (list[str])
"""

from __future__ import annotations

import hashlib

from .base import Section


_PLACEHOLDER_PALETTES = [
    ("#84C7D3", "#76B1BC"),
    ("#D4AE94", "#B07A4B"),
    ("#B8C0FF", "#6B70B8"),
    ("#76B1BC", "#1A1C29"),
    ("#DABDA9", "#B07A4B"),
    ("#EFCAAF", "#D4AE94"),
    ("#84C7D3", "#1A1C29"),
    ("#B8C0FF", "#84C7D3"),
]


def _placeholder_gradient(seed: str) -> str:
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    c1, c2 = _PLACEHOLDER_PALETTES[h % len(_PLACEHOLDER_PALETTES)]
    angle = 100 + (h >> 8) % 80
    return f"background: linear-gradient({angle}deg, {c1} 0%, {c2} 100%);"


def _photo_bg(foto: str, seed: str) -> str:
    if foto:
        return (
            f"background-image: url('{_escape_attr(foto)}');"
            f"background-size: cover; background-position: center;"
        )
    return _placeholder_gradient(seed)


class OurCondoEvents(Section):
    """Nosso Condomínio (Eventos) — S09."""

    type = "our_condo_events"
    label = "Nosso Condomínio — Eventos"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        eventos = inputs.get("eventos") or []
        if not isinstance(eventos, list):
            errors.append("Eventos: 'eventos' deve ser lista")
        elif len(eventos) > 4:
            errors.append(f"Eventos: máx 4 itens no grid (recebido {len(eventos)})")
        return errors

    def paginate(self, inputs: dict) -> int:
        return 1

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def _render(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        eventos = list(inputs.get("eventos") or [])[:4]

        cards_html = "\n".join(self._render_event(e) for e in eventos)

        return f"""
<section class="page events-page">
  <div class="events__content">
    <header class="events__header">
      <div class="events__kicker">EVENTOS · {_escape(mes)}</div>
      <h1 class="events__titulo">O que rolou no {_escape(condo)}</h1>
      <p class="events__sub">Os melhores momentos compartilhados em comunidade — registros do que vivemos juntos no mês.</p>
    </header>

    <div class="events__grid">
      {cards_html}
    </div>
  </div>
</section>

<style>
  .events-page {{
    background: var(--white);
    color: var(--onix);
    padding: 48px 56px 40px;
  }}

  .events__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }}

  .events__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 10px;
  }}

  .events__titulo {{
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

  .events__sub {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.7;
    max-width: 60ch;
  }}

  .events__grid {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
  }}

  .event-card {{
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--gray-5);
  }}

  .event-card__photo {{
    flex: 1;
    min-height: 160px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    position: relative;
  }}

  .event-card__date-overlay {{
    position: absolute;
    top: 12px; left: 12px;
    background: rgba(255, 255, 255, 0.92);
    padding: 5px 10px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--onix);
  }}

  .event-card__body {{
    padding: 14px 18px 16px;
    background: var(--white);
    border-top: 1px solid var(--gray-20);
  }}

  .event-card__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 17px;
    font-weight: 400;
    line-height: 1.15;
    color: var(--onix);
    letter-spacing: -0.015em;
    margin-bottom: 6px;
  }}

  .event-card__desc {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    line-height: 1.45;
    color: var(--onix);
    opacity: 0.78;
  }}
</style>
"""

    def _render_event(self, e: dict) -> str:
        titulo = (e.get("titulo") or "").strip()
        data = (e.get("data") or "").strip()
        desc = (e.get("descricao") or "").strip()
        fotos = list(e.get("fotos") or [])
        seed = titulo + (fotos[0] if fotos else "")
        photo_bg = _photo_bg(fotos[0] if fotos else "", seed)

        date_html = (
            f'<div class="event-card__date-overlay">{_escape(data)}</div>'
            if data else ""
        )
        desc_html = (
            f'<p class="event-card__desc">{_escape(desc)}</p>'
            if desc else ""
        )

        return f"""
      <article class="event-card">
        <div class="event-card__photo" style="{photo_bg}">
          {date_html}
        </div>
        <div class="event-card__body">
          <h3 class="event-card__titulo">{_escape(titulo)}</h3>
          {desc_html}
        </div>
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
