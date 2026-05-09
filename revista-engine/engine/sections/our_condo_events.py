"""
S09 — Nosso Condomínio (Eventos).

Cada evento ganha sua PRÓPRIA página A4 (Doc 01 §3 S09 atualizado).
Layout: foto hero (60% da altura), kicker editorial, título grande,
descrição opcional, grid com até 4 fotos extras.

Inputs:
- mes_referencia (str)
- nome_condominio (str)
- eventos (list[dict]):
  - titulo (str)
  - data (str opcional)
  - descricao (str opcional)
  - fotos (list[str]) — primeira é hero; até 4 extras viram grid
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


# Inferência simples de kicker editorial pelo nome do evento — mesma
# ideia do categorizador de manutenção.
import unicodedata


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()


_EVENT_CATEGORIAS: list[tuple[str, list[str]]] = [
    ("Festa Junina",  ["junina", "sao joao", "sao pedro"]),
    ("Confraternização", ["confraternizacao", "confraternização", "fim de ano", "natal", "ano novo"]),
    ("Carnaval",      ["carnaval", "bloquinho"]),
    ("Páscoa",        ["pascoa", "páscoa"]),
    ("Dia das Crianças", ["criancas", "crianças", "dia das criancas"]),
    ("Dia das Mães",  ["dia das maes", "mae", "mães"]),
    ("Dia dos Pais",  ["dia dos pais", "pai"]),
    ("Aniversário",   ["aniversario", "niver"]),
    ("Show",          ["show", "musica ao vivo", "música ao vivo", "concerto"]),
    ("Cinema",        ["cinema", "filme"]),
    ("Bazar",         ["bazar", "feira"]),
    ("Workshop",      ["workshop", "oficina", "curso"]),
    ("Esporte",       ["futebol", "torneio", "campeonato", "esporte", "tenis"]),
    ("Reunião",       ["reuniao", "reunião", "assembleia"]),
]


def _categorizar_evento(titulo: str) -> str:
    n = _normalize(titulo)
    for cat, kws in _EVENT_CATEGORIAS:
        if any(k in n for k in kws):
            return cat
    return "Evento"


class OurCondoEvents(Section):
    """Nosso Condomínio (Eventos) — S09. 1 página A4 por evento."""

    type = "our_condo_events"
    label = "Nosso Condomínio — Eventos"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        eventos = inputs.get("eventos") or []
        if not isinstance(eventos, list):
            errors.append("Eventos: 'eventos' deve ser lista")
        return errors

    def paginate(self, inputs: dict) -> int:
        n = len(list(inputs.get("eventos") or []))
        return max(1, n)

    def render_a4(self, inputs: dict, theme) -> list[str]:
        eventos = list(inputs.get("eventos") or [])
        if not eventos:
            return []
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        return [self._render_page(e, mes, condo, theme) for e in eventos]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return self.render_a4(inputs, theme)

    def _render_page(self, evento: dict, mes: str, condo: str, theme) -> str:
        titulo = (evento.get("titulo") or "").strip()
        data = (evento.get("data") or "").strip()
        desc = (evento.get("descricao") or "").strip()
        fotos = list(evento.get("fotos") or [])

        kicker = _categorizar_evento(titulo)
        hero_foto = fotos[0] if fotos else ""
        extras = fotos[1:5]  # até 4 fotos extras no rodapé

        hero_bg = _photo_bg(hero_foto, titulo + (hero_foto or ""))

        # Grid de fotos extras (se houver)
        grid_html = ""
        if extras:
            cells = []
            for i, foto in enumerate(extras):
                bg = _photo_bg(foto, titulo + str(i) + foto)
                cells.append(f'<div class="ev-extra" style="{bg}"></div>')
            grid_html = f"""
    <div class="ev-extras ev-extras--{len(extras)}">
      {''.join(cells)}
    </div>"""

        date_html = (
            f'<span class="ev__data">{_escape(data)}</span>'
            if data else ""
        )
        desc_html = (
            f'<p class="ev__desc">{_escape(desc)}</p>'
            if desc else ""
        )

        return f"""
<section class="page event-page">
  <div class="ev__hero" style="{hero_bg}">
    <div class="ev__hero-overlay"></div>
    <div class="ev__hero-content">
      <div class="ev__kicker">EVENTOS · {_escape(mes)} · {_escape(condo)}</div>
      <span class="ev__categoria">{_escape(kicker)}</span>
      <h1 class="ev__titulo">{_escape(titulo)}</h1>
      {date_html}
    </div>
  </div>

  <div class="ev__body">
    {desc_html}
    {grid_html}
  </div>
</section>

<style>
  .event-page {{
    background: var(--white);
    color: var(--onix);
    padding: 0;
    display: flex;
    flex-direction: column;
  }}

  .ev__hero {{
    position: relative;
    flex: 0 0 58%;
    overflow: hidden;
  }}

  .ev__hero-overlay {{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(26,28,41,0.0) 0%,
      rgba(26,28,41,0.0) 30%,
      rgba(26,28,41,0.55) 70%,
      rgba(26,28,41,0.92) 100%
    );
  }}

  .ev__hero-content {{
    position: absolute;
    left: 56px; right: 56px; bottom: 36px;
    color: var(--white);
  }}

  .ev__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--sand);
    margin-bottom: 12px;
  }}

  .ev__categoria {{
    display: inline-block;
    background: var(--mint);
    color: var(--onix);
    padding: 4px 10px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 14px;
  }}

  .ev__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 44px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.028em;
    color: var(--white);
    max-width: 18ch;
    margin: 0 0 10px;
    text-wrap: balance;
  }}

  .ev__data {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sand-90);
  }}

  .ev__body {{
    flex: 1;
    min-height: 0;
    padding: 28px 56px 36px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }}

  .ev__desc {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 13px;
    line-height: 1.55;
    color: var(--onix);
    opacity: 0.85;
    max-width: 68ch;
    margin: 0;
  }}

  .ev-extras {{
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 10px;
  }}
  .ev-extras--1 {{ grid-template-columns: 1fr; }}
  .ev-extras--2 {{ grid-template-columns: 1fr 1fr; }}
  .ev-extras--3 {{ grid-template-columns: 1.4fr 1fr 1fr; }}
  .ev-extras--4 {{ grid-template-columns: 1fr 1fr 1fr 1fr; }}

  .ev-extra {{
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    min-height: 0;
  }}
</style>
"""


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _escape_attr(s: str) -> str:
    return _escape(s).replace('"', "&quot;").replace("'", "&#39;")
