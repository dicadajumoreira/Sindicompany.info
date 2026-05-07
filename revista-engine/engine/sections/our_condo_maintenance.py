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
    "jardim":      ("#84C7D3", "#1A1C29"),
    "engenharia":  ("#1A1C29", "#FFFFFF"),
    "operacional": ("#76B1BC", "#FFFFFF"),
    "segurança":   ("#1A1C29", "#84C7D3"),
    "seguranca":   ("#1A1C29", "#84C7D3"),
    "manutenção":  ("#76B1BC", "#FFFFFF"),
    "manutencao":  ("#76B1BC", "#FFFFFF"),
}


def _badge_colors(badge: str) -> tuple[str, str]:
    return _BADGE_COLORS.get((badge or "manutenção").strip().lower(),
                              ("#76B1BC", "#FFFFFF"))


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
        # 1 abertura + 1 página com cards. Multi-página real (cards quebrando
        # entre páginas) vem com o paginador dinâmico.
        return 2

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [
            self._render_abertura(inputs, theme),
            self._render_cards(inputs, theme),
        ]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return self.render_a4(inputs, theme)

    def _render_abertura(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        mans = list(inputs.get("manutencoes") or [])

        # Stats
        n_intervencoes = len(mans)
        n_fotos = sum(len(m.get("fotos") or []) for m in mans)
        # Categorias únicas
        cats = set()
        for m in mans:
            tipo = (m.get("tipo_badge") or "MANUTENÇÃO").strip().upper()
            cats.add(tipo)
        n_cats = len(cats)

        # Hero placeholder gradient (composição com cores do tema)
        hero_css = (
            "background: linear-gradient(135deg, "
            "#84C7D3 0%, #76B1BC 35%, #1A1C29 100%);"
        )

        return f"""
<section class="page maint-cover-page">
  <div class="maint-cover__hero" style="{hero_css}">
    <div class="maint-cover__hero-overlay"></div>
    <div class="maint-cover__hero-content">
      <div class="maint-cover__kicker">CADERNO ESPECIAL · {_escape(mes)}</div>
      <h1 class="maint-cover__titulo">Nosso<br>Condomínio</h1>
      <p class="maint-cover__sub">
        Um registro do que mantém o {_escape(condo)} bem cuidado:
        manutenções, intervenções e cuidados feitos pela nossa equipe técnica
        ao longo do mês.
      </p>
    </div>
  </div>

  <div class="maint-cover__stats">
    <div class="maint-cover__stat">
      <div class="maint-cover__stat-num">{n_intervencoes}</div>
      <div class="maint-cover__stat-label">Intervenções<br>realizadas</div>
    </div>
    <div class="maint-cover__stat">
      <div class="maint-cover__stat-num">{n_fotos}</div>
      <div class="maint-cover__stat-label">Fotos<br>registradas</div>
    </div>
    <div class="maint-cover__stat">
      <div class="maint-cover__stat-num">{n_cats}</div>
      <div class="maint-cover__stat-label">Áreas de<br>atuação</div>
    </div>
  </div>

  <div class="maint-cover__nota">
    <div class="maint-cover__nota-label">Nas próximas páginas</div>
    <div class="maint-cover__nota-text">
      Veja em detalhe cada manutenção feita este mês — com fotos, descrição e
      a área responsável. As intervenções variam entre paisagismo, engenharia,
      operacional e segurança, e foram conduzidas pela equipe técnica do
      condomínio em parceria com a administração.
    </div>
  </div>
</section>

<style>
  .maint-cover-page {{
    background: var(--white);
    color: var(--onix);
    padding: 0;
    display: flex;
    flex-direction: column;
  }}

  .maint-cover__hero {{
    position: relative;
    height: 480px;
    flex-shrink: 0;
    overflow: hidden;
  }}

  .maint-cover__hero-overlay {{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(
      180deg,
      rgba(26,28,41,0.0) 0%,
      rgba(26,28,41,0.0) 30%,
      rgba(26,28,41,0.6) 75%,
      rgba(26,28,41,0.92) 100%
    );
  }}

  .maint-cover__hero-content {{
    position: absolute;
    left: 56px; right: 56px; bottom: 40px;
    color: var(--white);
  }}

  .maint-cover__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--mint);
    margin-bottom: 14px;
  }}

  .maint-cover__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 88px;
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.03em;
    color: var(--white);
    margin-bottom: 16px;
  }}

  .maint-cover__sub {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: var(--sand-90);
    max-width: 50ch;
  }}

  /* Stats em 3 colunas */
  .maint-cover__stats {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    border-bottom: 1px solid var(--gray-20);
  }}

  .maint-cover__stat {{
    padding: 32px 28px;
    text-align: center;
    border-right: 1px solid var(--gray-20);
  }}

  .maint-cover__stat:last-child {{
    border-right: none;
  }}

  .maint-cover__stat-num {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 64px;
    font-weight: 400;
    line-height: 0.9;
    color: var(--mint-80);
    letter-spacing: -0.025em;
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }}

  .maint-cover__stat-label {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--onix);
    line-height: 1.4;
  }}

  /* Nota explicativa */
  .maint-cover__nota {{
    padding: 28px 56px 36px;
    flex: 1;
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }}

  .maint-cover__nota-label {{
    flex: 0 0 140px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--mint-80);
    padding-top: 4px;
  }}

  .maint-cover__nota-text {{
    flex: 1;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    line-height: 1.55;
    color: var(--onix);
    opacity: 0.78;
    max-width: 60ch;
  }}
</style>
"""

    def _render_cards(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        condo = (inputs.get("nome_condominio") or "").strip()
        mans = list(inputs.get("manutencoes") or [])

        # Por simplicidade no preview: pegar até 4 com display_size large/small
        # e fazer um grid 2x2. Para hero (6+) renderizar como destaque mais largo.
        cards_html = "\n".join(
            self._render_card(m, theme) for m in mans[:4]
        )

        return f"""
<section class="page maint-page">
  <div class="maint__content">
    <header class="maint__header">
      <div class="maint__kicker">NOSSO CONDOMÍNIO · {_escape(mes)}</div>
      <h1 class="maint__titulo">O que fizemos pelo {_escape(condo)} este mês</h1>
      <p class="maint__sub">Registro das principais manutenções e intervenções realizadas pela nossa equipe técnica.</p>
    </header>

    <div class="maint__grid">
      {cards_html}
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

  .maint__sub {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.7;
    max-width: 60ch;
  }}

  .maint__grid {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;
    gap: 14px;
    flex: 1;
    min-height: 0;
  }}

  .maint-card {{
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}

  .maint-card__head {{
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }}

  .badge {{
    display: inline-block;
    padding: 4px 10px;
    border-radius: 3px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    flex-shrink: 0;
  }}

  .maint-card__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.15;
    color: var(--onix);
    letter-spacing: -0.015em;
    flex: 1;
  }}

  /* Grid 3 col × 2 lin de fotos */
  .maint-card__photos {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: 4px;
    flex: 1;
    min-height: 0;
    border-radius: 6px;
    overflow: hidden;
  }}

  .maint-card__photo-slot {{
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    min-height: 60px;
  }}
</style>
"""

    def _render_card(self, m: dict, theme) -> str:
        titulo = (m.get("titulo") or "").strip()
        badge = (m.get("tipo_badge") or "MANUTENÇÃO").strip()
        fotos = list(m.get("fotos") or [])
        n = len(fotos)
        bg, fg = _badge_colors(badge)

        # Grid de 6 fotos (3 col × 2 lin); preenche placeholder se faltar
        slots = []
        for i in range(6):
            f = fotos[i] if i < n else ""
            seed = f"{titulo}-{i}-{f}"
            slots.append(f'<div class="maint-card__photo-slot" style="{_photo_bg(f, seed)}"></div>')
        photos_grid = "".join(slots)

        return f"""
      <article class="maint-card">
        <div class="maint-card__head">
          <span class="badge" style="background:{bg};color:{fg}">{_escape(badge)}</span>
          <h3 class="maint-card__titulo">{_escape(titulo)}</h3>
        </div>
        <div class="maint-card__photos">{photos_grid}</div>
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
