"""
S11 — Nossos Números.

Fechamento financeiro do mês: KPIs principais + tabela das principais
despesas + nota de transparência.

Dados são EXATOS — nunca inventar (Doc 01 §3 S11).

Inputs:
- mes_referencia (str) — ex: "FEVEREIRO 2026"
- kpis (dict):
  - receita_brl (float)
  - despesas_brl (float)
  - fundo_reserva_brl (float)
  - inadimplencia_pct (float)
- principais_despesas (list[dict]) — categorias com valor_brl e observacao opc.
- despesa_extra (dict opcional) — categoria fora-da-curva com descricao
- nota_transparencia (str) — texto no rodapé
"""

from __future__ import annotations

from .base import A4, Section


# Texto padrão se nada for passado (Doc 01 §3 S11 menciona "default fixo").
_NOTA_DEFAULT = (
    "Os valores apresentados refletem o balancete oficial fechado pela "
    "administradora. A prestação de contas completa está disponível na "
    "área restrita dos moradores, com extratos, comprovantes e relatórios "
    "auditáveis. Em caso de dúvida, procure a administração."
)


def _fmt_brl(v: float) -> str:
    """Formata valor em R$ com ponto de milhar e vírgula decimal (pt-BR)."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "R$ —"
    sinal = "-" if v < 0 else ""
    v = abs(v)
    inteiro = int(v)
    centavos = round((v - inteiro) * 100)
    s = f"{inteiro:,}".replace(",", ".")
    return f"{sinal}R$ {s},{centavos:02d}"


def _fmt_pct(v: float) -> str:
    try:
        return f"{float(v):.1f}%".replace(".", ",")
    except (TypeError, ValueError):
        return "—"


class OurNumbers(Section):
    """Nossos Números (S11)."""

    type = "our_numbers"
    label = "Nossos Números"

    # =========================================================================
    # Contrato Section
    # =========================================================================

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        if not inputs.get("mes_referencia"):
            errors.append("Nossos Números: 'mes_referencia' é obrigatório (ex: 'FEVEREIRO 2026')")

        kpis = inputs.get("kpis") or {}
        if not isinstance(kpis, dict):
            errors.append("Nossos Números: 'kpis' deve ser um dicionário")
        else:
            for key in ("receita_brl", "despesas_brl", "fundo_reserva_brl", "inadimplencia_pct"):
                if key not in kpis:
                    errors.append(f"Nossos Números: kpis.{key} não pode ser omitido (use 0 se não aplica)")

        despesas = inputs.get("principais_despesas") or []
        if not isinstance(despesas, list):
            errors.append("Nossos Números: 'principais_despesas' deve ser lista")
        else:
            for i, d in enumerate(despesas):
                if not isinstance(d, dict) or "categoria" not in d or "valor_brl" not in d:
                    errors.append(f"Nossos Números: despesa[{i}] precisa de 'categoria' e 'valor_brl'")

        return errors

    def paginate(self, inputs: dict) -> int:
        return 1  # por enquanto — se a tabela ficar grande migramos pra 2

    def render_a4(self, inputs: dict, theme) -> list[str]:
        return [self._render(inputs, theme)]

    def render_mobile(self, inputs: dict, theme) -> list[str]:
        # Mobile pausado — devolve A4 mesmo (a engine de orquestração pode ignorar)
        return [self._render(inputs, theme)]

    # =========================================================================
    # Render (A4)
    # =========================================================================

    def _render(self, inputs: dict, theme) -> str:
        mes = (inputs.get("mes_referencia") or "").strip().upper()
        kpis = inputs.get("kpis") or {}
        despesas = list(inputs.get("principais_despesas") or [])
        despesa_extra = inputs.get("despesa_extra")
        nota = (inputs.get("nota_transparencia") or _NOTA_DEFAULT).strip()

        # Calcular maior valor pra normalizar barras
        max_despesa = max(
            (float(d.get("valor_brl", 0)) for d in despesas), default=1.0
        ) or 1.0

        kpi_cards = self._render_kpi_cards(kpis, theme)
        despesas_tbl = self._render_despesas(despesas, max_despesa, theme)
        extra_block = self._render_despesa_extra(despesa_extra, theme) if despesa_extra else ""

        return f"""
<section class="page numbers-page">
  <div class="numbers__content">
    <header class="numbers__header">
      <div class="numbers__kicker">NOSSOS NÚMEROS · {_escape(mes)}</div>
      <h1 class="numbers__titulo">Fechamento financeiro</h1>
    </header>

    <div class="numbers__kpis">
      {kpi_cards}
    </div>

    <div class="numbers__despesas">
      <h2 class="numbers__sub">Principais despesas do mês</h2>
      {despesas_tbl}
    </div>

    {extra_block}

    <footer class="numbers__nota">
      <span class="numbers__nota-label">Transparência</span>
      <span class="numbers__nota-text">{_escape(nota)}</span>
    </footer>
  </div>
</section>

<style>
  .numbers-page {{
    background: var(--white);
    color: var(--onix);
    padding: 56px;
  }}

  .numbers__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }}

  .numbers__header {{
    margin-bottom: 0;
  }}

  .numbers__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 14px;
  }}

  .numbers__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 48px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
  }}

  /* KPI cards: 4 colunas */
  .numbers__kpis {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }}

  .kpi-card {{
    background: var(--gray-5);
    border-radius: 6px;
    padding: 18px 14px;
    border-left: 3px solid var(--mint);
  }}

  .kpi-card--neg {{ border-left-color: var(--sand-80); }}
  .kpi-card--reserve {{ border-left-color: var(--lavender); }}
  .kpi-card--inad {{ border-left-color: var(--onix); }}

  .kpi-card__label {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 8px;
  }}

  .kpi-card__value {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: var(--onix);
    line-height: 1.05;
    word-break: break-word;
  }}

  .kpi-card__hint {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    color: var(--onix);
    opacity: 0.55;
    margin-top: 4px;
  }}

  /* Despesas table */
  .numbers__despesas {{
    flex: 1;
    min-height: 0;
  }}

  .numbers__sub {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 18px;
    font-weight: 400;
    color: var(--onix);
    margin-bottom: 12px;
    border-bottom: 1px solid var(--gray-20);
    padding-bottom: 8px;
  }}

  .despesa-row {{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid var(--gray-5);
  }}

  .despesa-row__cat {{
    flex: 0 0 30%;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: var(--onix);
  }}

  .despesa-row__bar-wrap {{
    flex: 1;
    height: 6px;
    background: var(--gray-5);
    border-radius: 3px;
    overflow: hidden;
  }}

  .despesa-row__bar {{
    height: 100%;
    background: var(--mint);
    border-radius: 3px;
  }}

  .despesa-row__val {{
    flex: 0 0 110px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--onix);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }}

  .despesa-row__obs {{
    flex: 0 0 25%;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    color: var(--onix);
    opacity: 0.6;
    font-style: italic;
  }}

  /* Despesa extra (highlight) */
  .despesa-extra {{
    background: var(--sand);
    border-radius: 6px;
    padding: 14px 18px;
    margin-top: 4px;
  }}

  .despesa-extra__label {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--onix);
    margin-bottom: 4px;
  }}

  .despesa-extra__head {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }}

  .despesa-extra__cat {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 16px;
    font-weight: 400;
    color: var(--onix);
  }}

  .despesa-extra__val {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 18px;
    font-weight: 400;
    color: var(--onix);
    font-variant-numeric: tabular-nums;
  }}

  .despesa-extra__desc {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    color: var(--onix);
    opacity: 0.7;
    margin-top: 6px;
    line-height: 1.4;
  }}

  /* Nota de transparência */
  .numbers__nota {{
    border-top: 1px solid var(--gray-20);
    padding-top: 12px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }}

  .numbers__nota-label {{
    flex: 0 0 100px;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    padding-top: 2px;
  }}

  .numbers__nota-text {{
    flex: 1;
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    line-height: 1.45;
    color: var(--onix);
    opacity: 0.7;
  }}
</style>
"""

    def _render_kpi_cards(self, kpis: dict, theme) -> str:
        receita = kpis.get("receita_brl", 0)
        despesas = kpis.get("despesas_brl", 0)
        fundo = kpis.get("fundo_reserva_brl", 0)
        inad = kpis.get("inadimplencia_pct", 0)
        saldo = float(receita or 0) - float(despesas or 0)

        return f"""
      <div class="kpi-card">
        <div class="kpi-card__label">Receita</div>
        <div class="kpi-card__value">{_fmt_brl(receita)}</div>
      </div>
      <div class="kpi-card kpi-card--neg">
        <div class="kpi-card__label">Despesas</div>
        <div class="kpi-card__value">{_fmt_brl(despesas)}</div>
        <div class="kpi-card__hint">Saldo {_fmt_brl(saldo)}</div>
      </div>
      <div class="kpi-card kpi-card--reserve">
        <div class="kpi-card__label">Fundo de reserva</div>
        <div class="kpi-card__value">{_fmt_brl(fundo)}</div>
      </div>
      <div class="kpi-card kpi-card--inad">
        <div class="kpi-card__label">Inadimplência</div>
        <div class="kpi-card__value">{_fmt_pct(inad)}</div>
      </div>"""

    def _render_despesas(self, despesas: list, max_v: float, theme) -> str:
        if not despesas:
            return '<p class="despesa-row"><span class="despesa-row__cat">—</span></p>'

        rows = []
        for d in despesas:
            cat = _escape(str(d.get("categoria", "")))
            val = float(d.get("valor_brl", 0))
            obs = _escape(str(d.get("observacao", "")))
            pct = max(0, min(100, (val / max_v) * 100)) if max_v else 0
            rows.append(f"""
      <div class="despesa-row">
        <div class="despesa-row__cat">{cat}</div>
        <div class="despesa-row__bar-wrap">
          <div class="despesa-row__bar" style="width: {pct:.1f}%;"></div>
        </div>
        <div class="despesa-row__obs">{obs}</div>
        <div class="despesa-row__val">{_fmt_brl(val)}</div>
      </div>""")
        return "\n".join(rows)

    def _render_despesa_extra(self, extra: dict, theme) -> str:
        cat = _escape(str(extra.get("categoria", "")))
        val = _fmt_brl(extra.get("valor_brl", 0))
        desc = _escape(str(extra.get("descricao", "")))
        return f"""
    <div class="despesa-extra">
      <div class="despesa-extra__label">Despesa pontual do mês</div>
      <div class="despesa-extra__head">
        <span class="despesa-extra__cat">{cat}</span>
        <span class="despesa-extra__val">{val}</span>
      </div>
      <div class="despesa-extra__desc">{desc}</div>
    </div>"""


def _escape(s: str) -> str:
    return (
        (s or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
