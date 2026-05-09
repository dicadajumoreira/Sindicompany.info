"""
S14 — Expediente.

1 página fixa. Créditos editoriais sempre presentes (Síndico, Equipe do
Condomínio, Equipe Sindicompany) + extras opcionais (Doc 01 §3 S14).

Inputs:
- mes_referencia (str)
- nome_condominio (str)
- numero_edicao (int) e ano_edicao (int)
- nome_sindico (str)  ← vem da Carta (S02)
- cargo_sindico (str opcional)
- equipe_condominio (list[str] opcional)
- equipe_sindicompany (list[str] opcional)
- creditos_extras (list[dict] opcional) — {titulo, nomes (list)}
- editor_responsavel (str opcional)
- contato (str opcional) — endereço/email para correções
"""

from __future__ import annotations

from .base import Section


class Colophon(Section):
    """Expediente (S14)."""

    type = "colophon"
    label = "Expediente"

    def validate(self, inputs: dict) -> list[str]:
        errors: list[str] = []
        if not inputs.get("nome_condominio"):
            errors.append("Expediente: 'nome_condominio' é obrigatório")
        if not inputs.get("nome_sindico"):
            errors.append("Expediente: 'nome_sindico' é obrigatório (mesma da Carta)")
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
        edicao = inputs.get("numero_edicao", 0)
        ano = inputs.get("ano_edicao", 0)
        sindico = (inputs.get("nome_sindico") or "").strip()
        cargo_sindico = (inputs.get("cargo_sindico") or "Síndico(a) Profissional").strip()
        # Label do bloco de crédito ('Síndico' ou 'Síndica' conforme gênero)
        label_sindico = (inputs.get("label_sindico") or "Síndico").strip()
        equipe_condo = list(inputs.get("equipe_condominio") or [])
        equipe_sc = list(inputs.get("equipe_sindicompany") or [])
        extras = list(inputs.get("creditos_extras") or [])
        editor = (inputs.get("editor_responsavel") or "").strip()
        contato = (inputs.get("contato") or "").strip()

        # Créditos obrigatórios (3) + extras
        creditos = [
            (label_sindico, [f"{sindico} · {cargo_sindico}" if sindico else "—"]),
            ("Equipe do Condomínio", equipe_condo or [f"Equipe administrativa · {condo}"]),
            ("Equipe Sindicompany",  equipe_sc or [
                "Direção editorial",
                "Pauta e produção",
                "Diagramação e revisão",
            ]),
        ]
        for c in extras:
            t = c.get("titulo", "").strip()
            ns = list(c.get("nomes") or [])
            if t and ns:
                creditos.append((t, ns))

        # Bloco de "Fontes de Pesquisa" usa layout inline com '|' separando
        # itens. Demais blocos seguem o layout vertical em lista.
        def _render_cred_block(titulo: str, nomes: list) -> str:
            t_norm = titulo.strip().lower()
            if t_norm.startswith("fonte"):  # 'Fontes de Pesquisa'
                inline = " | ".join(_escape(str(n)) for n in nomes)
                return (
                    f'<div class="cred-block cred-block--inline">'
                    f'<h3 class="cred-block__titulo">{_escape(titulo)}</h3>'
                    f'<p class="cred-block__inline">{inline}</p>'
                    f'</div>'
                )
            itens = "".join(
                f'<li class="cred-block__item">{_escape(str(n))}</li>'
                for n in nomes
            )
            return (
                f'<div class="cred-block">'
                f'<h3 class="cred-block__titulo">{_escape(titulo)}</h3>'
                f'<ul class="cred-block__list">{itens}</ul>'
                f'</div>'
            )

        creditos_html = "\n".join(
            _render_cred_block(titulo, nomes) for titulo, nomes in creditos
        )

        edicao_str = f"Edição {edicao:02d} · {ano}" if (edicao and ano) else ""

        return f"""
<section class="page colophon-page">
  <div class="colophon__content">
    <header class="colophon__header">
      <div class="colophon__kicker">EXPEDIENTE · {_escape(mes)}</div>
      <h1 class="colophon__titulo">Quem fez esta edição</h1>
    </header>

    <div class="colophon__ficha">
      <div class="ficha-item">
        <span class="ficha-item__label">Publicação</span>
        <span class="ficha-item__value">Revista mensal de moradores</span>
      </div>
      <div class="ficha-item">
        <span class="ficha-item__label">Condomínio</span>
        <span class="ficha-item__value">{_escape(condo)}</span>
      </div>
      <div class="ficha-item">
        <span class="ficha-item__label">Edição</span>
        <span class="ficha-item__value">{_escape(edicao_str)}</span>
      </div>
      {f'<div class="ficha-item"><span class="ficha-item__label">Editor responsável</span><span class="ficha-item__value">{_escape(editor)}</span></div>' if editor else ''}
    </div>

    <div class="colophon__creditos">
      {creditos_html}
    </div>

    <footer class="colophon__nota">
      <div class="colophon__legal">
        <strong>Sindicompany ®</strong> · revista produzida por equipe editorial dedicada,
        sob curadoria da síndica responsável e da gestão do condomínio.
        {f"Correções e sugestões: {_escape(contato)}." if contato else ""}
        Todos os direitos reservados.
      </div>
    </footer>
  </div>
</section>

<style>
  .colophon-page {{
    background: var(--white);
    color: var(--onix);
    padding: 56px;
  }}

  .colophon__content {{
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }}

  .colophon__kicker {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 12px;
  }}

  .colophon__titulo {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 44px;
    font-weight: 400;
    line-height: 0.98;
    letter-spacing: -0.025em;
    color: var(--onix);
  }}

  /* Ficha técnica em grid horizontal */
  .colophon__ficha {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px 28px;
    background: var(--gray-5);
    border-radius: 8px;
    padding: 18px 22px;
  }}

  .ficha-item {{
    display: flex;
    flex-direction: column;
    gap: 2px;
  }}

  .ficha-item__label {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--mint-80);
  }}

  .ficha-item__value {{
    font-family: '{theme.fonte_titulos.family}', serif;
    font-size: 14px;
    color: var(--onix);
    line-height: 1.2;
  }}

  /* Créditos: 3 colunas */
  .colophon__creditos {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    flex: 1;
  }}

  .cred-block {{
    border-top: 2px solid var(--onix);
    padding-top: 12px;
  }}

  .cred-block:nth-child(1) {{ border-top-color: #84C7D3; }} /* mint */
  .cred-block:nth-child(2) {{ border-top-color: #D4AE94; }} /* sand-80 */
  .cred-block:nth-child(3) {{ border-top-color: #B8C0FF; }} /* lavender */
  .cred-block:nth-child(4) {{ border-top-color: #76B1BC; }} /* mint-80 */
  .cred-block:nth-child(5) {{ border-top-color: #DABDA9; }} /* sand */

  .cred-block__titulo {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--mint-80);
    margin-bottom: 12px;
  }}

  .cred-block__list {{
    list-style: none;
    margin: 0; padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}

  /* Layout inline pra 'Fontes de Pesquisa': separador '|' entre itens */
  .cred-block--inline {{
    grid-column: 1 / -1;
  }}
  .cred-block__inline {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: var(--onix);
    margin: 0;
  }}

  .cred-block__item {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: var(--onix);
  }}

  /* Nota legal no rodapé */
  .colophon__nota {{
    border-top: 1px solid var(--gray-20);
    padding-top: 14px;
  }}

  .colophon__legal {{
    font-family: '{theme.fonte_corpo.family}', sans-serif;
    font-size: 10px;
    line-height: 1.5;
    color: var(--onix);
    opacity: 0.65;
    max-width: 80ch;
  }}

  .colophon__legal strong {{
    color: var(--onix);
    opacity: 1;
    font-weight: 600;
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
