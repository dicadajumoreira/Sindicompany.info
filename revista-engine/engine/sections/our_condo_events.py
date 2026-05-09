"""
S09 — Nosso Condomínio (Eventos).

Caderno de eventos no MESMO padrão da S08 Manutenção: cada evento vira
uma "seção" com título + grid de fotos. Empacotador distribui as
seções em páginas com 4-6 fotos cada, garantindo que todos os eventos
apareçam.

Inputs:
- mes_referencia (str)
- nome_condominio (str)
- eventos (list[dict]):
  - titulo (str)
  - data (str opcional)
  - descricao (str opcional)
  - fotos (list[str])
"""

from __future__ import annotations

import hashlib
import unicodedata

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


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()


_EVENT_CATEGORIAS: list[tuple[str, list[str]]] = [
    ("Festa Junina",  ["junina", "sao joao", "sao pedro"]),
    ("Confraternização", ["confraternizacao", "fim de ano", "natal", "ano novo"]),
    ("Carnaval",      ["carnaval", "bloquinho"]),
    ("Páscoa",        ["pascoa"]),
    ("Dia das Crianças", ["criancas", "dia das criancas"]),
    ("Dia das Mães",  ["dia das maes"]),
    ("Dia dos Pais",  ["dia dos pais"]),
    ("Aniversário",   ["aniversario", "niver"]),
    ("Show",          ["show", "musica ao vivo", "concerto"]),
    ("Cinema",        ["cinema", "filme"]),
    ("Bazar",         ["bazar", "feira"]),
    ("Workshop",      ["workshop", "oficina", "curso"]),
    ("Esporte",       ["futebol", "torneio", "campeonato", "esporte", "tenis"]),
    ("Reunião",       ["reuniao", "assembleia"]),
]


def _categorizar_evento(titulo: str) -> str:
    n = _normalize(titulo)
    for cat, kws in _EVENT_CATEGORIAS:
        if any(k in n for k in kws):
            return cat
    return "Evento"


def _empacotar_eventos_por_fotos(eventos: list[dict]) -> list[list[dict]]:
    """Mesma ideia do empacotador de manutenção: distribui as seções
    de evento em páginas com 4-6 fotos cada (até 4 fotos por seção).
    Se um evento tem mais de 4 fotos, divide em múltiplas seções."""
    # Primeiro expande eventos com >4 fotos em múltiplas seções
    secoes: list[dict] = []
    for ev in eventos:
        titulo = ev.get("titulo") or ""
        data = ev.get("data") or ""
        desc = ev.get("descricao") or ""
        fotos = list(ev.get("fotos") or [])
        kicker = _categorizar_evento(titulo)
        if not fotos:
            secoes.append({
                "titulo": titulo, "data": data, "descricao": desc,
                "kicker": kicker, "fotos_usadas": [], "_first": True,
            })
            continue
        # Quebra em chunks de 4 fotos por seção
        for i in range(0, len(fotos), 4):
            chunk = fotos[i : i + 4]
            secoes.append({
                "titulo": titulo, "data": data, "descricao": desc,
                "kicker": kicker, "fotos_usadas": chunk,
                "_first": (i == 0),  # só a primeira seção mostra título completo
            })

    # Empacotador: máx 6 fotos por página, evita passar do limite
    pages: list[list[dict]] = []
    cur: list[dict] = []
    cur_count = 0
    for s in secoes:
        n = max(1, len(s["fotos_usadas"]))
        # Fecha sempre que ultrapassaria 6 fotos (mesmo que página atual
        # esteja com menos que 4) — melhor página com 3 do que com 7+.
        if cur and cur_count + n > 6:
            pages.append(cur)
            cur = []
            cur_count = 0
        cur.append(s)
        cur_count += n
    if cur:
        pages.append(cur)
    return pages


class OurCondoEvents(Section):
    """Caderno de Eventos — S09. 4-6 fotos por página."""

    type = "our_condo_events"
    label = "Nosso Condomínio — Eventos"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        eventos = inputs.get("eventos") or []
        if not isinstance(eventos, list):
            errors.append("Eventos: 'eventos' deve ser lista")
        return errors

    def paginate(self, inputs: dict) -> int:
        eventos = list(inputs.get("eventos") or [])
        if not eventos:
            return 0
        return max(1, len(_empacotar_eventos_por_fotos(eventos)))

    def render_a4(self, inputs: dict, theme) -> list[str]:
        eventos = list(inputs.get("eventos") or [])
        if not eventos:
            return []
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        paginas_de_secoes = _empacotar_eventos_por_fotos(eventos)
        return [
            self._render_page(secs, mes, condo, theme)
            for secs in paginas_de_secoes
        ]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return self.render_a4(inputs, theme)

    def _render_page(
        self, secoes: list[dict], mes: str, condo: str, theme,
    ) -> str:
        secoes_html = "\n".join(self._render_secao(s) for s in secoes)
        return f"""
<section class="page event-page">
  <div class="ev__content">
    <header class="ev__header">
      <div class="ev__kicker">EVENTO NO CONDOMÍNIO · {_escape(mes)} · {_escape(condo)}</div>
      <h1 class="ev__titulo-pagina">O que rolou no {_escape(condo)}</h1>
    </header>

    <div class="ev__list">
      {secoes_html}
    </div>
  </div>
</section>

<style>
  .event-page {{
    background: var(--white);
    color: var(--onix);
    padding: 40px 44px 36px;
  }}

  .ev__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }}

  .ev__header {{
    border-bottom: 2px solid var(--mint);
    padding-bottom: 12px;
  }}

  .ev__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 6px;
  }}

  .ev__titulo-pagina {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 32px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.022em;
    color: var(--onix);
    margin: 0;
  }}

  .ev__list {{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}

  .ev-secao {{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}

  .ev-secao__head {{
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }}

  .ev-secao__badge {{
    display: inline-block;
    padding: 3px 9px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    background: var(--mint);
    color: var(--onix);
  }}

  .ev-secao__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1.05;
    color: var(--onix);
    letter-spacing: -0.018em;
    margin: 0;
  }}

  .ev-secao__data {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--onix);
    opacity: 0.55;
  }}

  .ev-secao__cont {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-style: italic;
    color: var(--onix);
    opacity: 0.55;
  }}

  .ev-secao__desc {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.78;
    margin: 4px 0 6px;
    max-width: 70ch;
  }}

  .ev-secao__grid {{
    flex: 1;
    min-height: 0;
    display: grid;
    gap: 8px;
  }}
  .ev-secao__grid--1 {{ grid-template-columns: 1fr; }}
  .ev-secao__grid--2 {{ grid-template-columns: 1fr 1fr; }}
  .ev-secao__grid--3 {{ grid-template-columns: 1.4fr 1fr 1fr; grid-template-rows: 1fr 1fr; }}
  .ev-secao__grid--3 > :first-child {{ grid-row: span 2; }}
  .ev-secao__grid--4 {{ grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }}

  .ev-foto {{
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    min-height: 0;
  }}
</style>
"""

    def _render_secao(self, s: dict) -> str:
        titulo = (s.get("titulo") or "").strip()
        data = (s.get("data") or "").strip()
        desc = (s.get("descricao") or "").strip()
        kicker = (s.get("kicker") or "Evento").strip()
        fotos = list(s.get("fotos_usadas") or [])
        first = bool(s.get("_first", True))
        n = max(1, min(4, len(fotos)))

        # Header só aparece completo na primeira seção do evento.
        # Em seções de continuação, mostra "(continuação)" sutil.
        if first:
            head_html = f"""
        <div class="ev-secao__head">
          <span class="ev-secao__badge">{_escape(kicker)}</span>
          <h3 class="ev-secao__titulo">{_escape(titulo)}</h3>
          {f'<span class="ev-secao__data">{_escape(data)}</span>' if data else ''}
        </div>
        {f'<p class="ev-secao__desc">{_escape(desc)}</p>' if desc else ''}"""
        else:
            head_html = f"""
        <div class="ev-secao__head">
          <h3 class="ev-secao__titulo">{_escape(titulo)}</h3>
          <span class="ev-secao__cont">continuação</span>
        </div>"""

        if fotos:
            cells = []
            for i, foto in enumerate(fotos[:n]):
                seed = titulo + str(i) + foto
                photo_bg = _photo_bg(foto, seed)
                cells.append(f'<div class="ev-foto" style="{photo_bg}"></div>')
            grid_html = (
                f'<div class="ev-secao__grid ev-secao__grid--{n}">'
                f'{"".join(cells)}'
                f'</div>'
            )
        else:
            seed = titulo or "evento"
            grid_html = (
                f'<div class="ev-secao__grid ev-secao__grid--1">'
                f'<div class="ev-foto" style="{_photo_bg("", seed)}"></div>'
                f'</div>'
            )

        return f"""
      <article class="ev-secao">
        {head_html}
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
