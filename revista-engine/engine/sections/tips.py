"""
S05 — Dicas Práticas.

1 página fixa (cabe 6–8 dicas; pode crescer pra 2 se preciso). Tom direto,
sem jargão, acionável (Doc 01 §3 S05).

Inputs:
- mes_referencia (str)
- titulo_secao (str opcional) — substitui "Dicas práticas" se passado
- intro (str opcional) — texto curto de abertura
- dicas (list[dict]):
  - titulo (str)
  - corpo (str, 1–2 linhas)
"""

from __future__ import annotations

from .base import Section


class Tips(Section):
    """Dicas Práticas (S05)."""

    type = "tips"
    label = "Dicas Práticas"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        dicas = inputs.get("dicas") or []
        if not isinstance(dicas, list) or not dicas:
            errors.append("Dicas: 'dicas' precisa ser lista não-vazia")
        elif len(dicas) > 8:
            errors.append(f"Dicas: máximo 8 itens (recebido {len(dicas)})")
        return errors

    def paginate(self, inputs: dict) -> int:
        return 1

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def _render(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        titulo = (inputs.get("titulo_secao") or "Dicas práticas").strip()
        intro = (inputs.get("intro") or "").strip()
        dicas = list(inputs.get("dicas") or [])[:8]

        cards_html = "\n".join(
            f"""
      <article class="dica-card">
        <div class="dica-card__num">{i+1:02d}</div>
        <div class="dica-card__body">
          <h3 class="dica-card__titulo">{_escape(d.get('titulo', ''))}</h3>
          <p class="dica-card__corpo">{_escape(d.get('corpo', ''))}</p>
        </div>
      </article>"""
            for i, d in enumerate(dicas)
        )

        intro_html = (
            f'<p class="tips__intro">{_escape(intro)}</p>'
            if intro else ""
        )

        return f"""
<section class="page tips-page">
  <div class="tips__content">
    <header class="tips__header">
      <div class="tips__kicker">DICAS PRÁTICAS · {_escape(mes)}</div>
      <h1 class="tips__titulo">{_escape(titulo)}</h1>
      {intro_html}
    </header>

    <div class="tips__grid">
      {cards_html}
    </div>
  </div>
</section>

<style>
  .tips-page {{
    background: var(--white);
    color: var(--onix);
    padding: 48px 56px 40px;
  }}

  .tips__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }}

  .tips__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 12px;
  }}

  .tips__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 44px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
    margin-bottom: 8px;
  }}

  .tips__intro {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.7;
    max-width: 60ch;
  }}

  /* Grid de dicas — 2 colunas, altura preenche resto da página */
  .tips__grid {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 1fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }}

  .dica-card {{
    background: var(--gray-5);
    border-radius: 6px;
    padding: 18px 20px;
    display: flex;
    gap: 18px;
    align-items: flex-start;
  }}

  .dica-card:nth-child(2n) {{
    background: #EEF7F8; /* mint vibe */
  }}

  .dica-card__num {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 38px;
    font-weight: 400;
    line-height: 0.85;
    color: var(--mint-80);
    flex-shrink: 0;
    width: 50px;
    font-variant-numeric: tabular-nums;
  }}

  .dica-card__body {{
    flex: 1;
  }}

  .dica-card__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 17px;
    font-weight: 400;
    line-height: 1.1;
    color: var(--onix);
    margin-bottom: 6px;
  }}

  .dica-card__corpo {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.8;
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
