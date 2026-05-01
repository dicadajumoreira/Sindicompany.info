"""
S15 — Contracapa.

Seção estrutural fixa. Sempre 1 página. Inputs opcionais.

Layout (Doc 01 §3 S15):
- Fundo: Onix sólido
- Logo grande, branco, centralizado
- Tagline ("Por mais lares.") em fonte de títulos (Provicali)
- Handle (@sindicompanybr)
- Opcional: label da próxima edição

Esta é a primeira seção implementada — serve para validar o pipeline
inteiro (theme → section → HTML → Playwright → PDF) ponta-a-ponta com
o mínimo de complexidade.
"""

from __future__ import annotations

from .base import A4, MOBILE, Section


class BackCover(Section):
    """Contracapa (S15)."""

    type = "back_cover"
    label = "Contracapa"

    # =========================================================================
    # Contrato Section
    # =========================================================================

    def validate(self, inputs: dict) -> list[str]:
        # Contracapa não tem campos obrigatórios — só rejeita tipos errados
        errors = []
        proxima = inputs.get("proxima_edicao_label")
        if proxima is not None and not isinstance(proxima, str):
            errors.append("Contracapa: 'proxima_edicao_label' deve ser texto, recebido " + type(proxima).__name__)
        return errors

    def paginate(self, inputs: dict) -> int:
        return 1

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme, dims=A4, scale="a4")]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme, dims=MOBILE, scale="mobile")]

    # =========================================================================
    # Render
    # =========================================================================

    def _render(self, inputs: dict, theme, *, dims, scale: str) -> str:
        proxima = inputs.get("proxima_edicao_label", "").strip() if inputs else ""
        logo_svg = theme.logo_svg("white")

        # Tamanhos por formato (em px CSS). A4 é o "normal"; Mobile escala
        # em torno de 0.7x mas ajusta proporção: queremos a tagline grande
        # e legível em ambos.
        if scale == "a4":
            logo_max_width = 460
            tagline_size = 75
            handle_size = 9
            proxima_size = 6
            top_pad = 220
            tagline_margin_top = 64
            handle_margin_bottom = 90
        else:  # mobile
            logo_max_width = 360
            tagline_size = 64
            handle_size = 10
            proxima_size = 7
            top_pad = 160
            tagline_margin_top = 56
            handle_margin_bottom = 80

        proxima_block = (
            f'<div class="back-cover__proxima">{_escape(proxima)}</div>'
            if proxima else ""
        )

        return f"""
<section class="page back-cover" data-format="{scale}">
  <div class="back-cover__core">
    <div class="back-cover__logo">{logo_svg}</div>
    <div class="back-cover__tagline">{_escape(theme.tagline)}</div>
  </div>
  <footer class="back-cover__footer">
    {proxima_block}
    <div class="back-cover__handle">{_escape(theme.handle)}</div>
  </footer>
</section>

<style>
  .back-cover {{
    background: var(--onix);
    color: var(--white);
    padding: {top_pad}px 64px 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
  }}

  .back-cover__core {{
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: {tagline_margin_top}px;
    width: 100%;
  }}

  .back-cover__logo {{
    width: 100%;
    max-width: {logo_max_width}px;
    display: flex;
    justify-content: center;
  }}

  .back-cover__logo svg {{
    width: 100%;
    height: auto;
    display: block;
  }}

  .back-cover__tagline {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: {tagline_size}px;
    font-weight: 400;
    line-height: 0.95;
    letter-spacing: -0.02em;
    text-align: center;
    color: var(--sand);
  }}

  .back-cover__footer {{
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    margin-bottom: {handle_margin_bottom - 64}px;
  }}

  .back-cover__handle {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: {handle_size}px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--white);
    opacity: 0.85;
  }}

  .back-cover__proxima {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: {proxima_size}px;
    font-weight: 300;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--sand);
    opacity: 0.7;
  }}
</style>
"""


def _escape(s: str) -> str:
    """Escapa HTML básico para evitar injeção em conteúdo de texto."""
    return (
        s.replace("&", "&amp;")
         .replace("<", "&lt;")
         .replace(">", "&gt;")
    )
