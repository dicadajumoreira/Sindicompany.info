"""
Parser pra dashboard de prestação de contas em HTML.

A editora coloca um arquivo HTML dentro da pasta do Drive de
prestação de contas (campo `drive_prestacao_url` no form). A engine
baixa a pasta inteira (junto com tudo que estiver lá), localiza o
arquivo .html e extrai os números via GPT.

Retorna o dict no formato esperado pela seção S11 (our_numbers.py):
  - kpis: {receita_brl, despesas_brl, fundo_reserva_brl, inadimplencia_pct}
  - principais_despesas: [{categoria, valor_brl, observacao}]
  - historico: [{mes_label, saldo_brl}]
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from api.drive import extract_folder_id
from api.text_gen import _gerar_json


def _baixar_html_da_pasta(drive_url: str, dest: Path) -> str | None:
    """Baixa pasta do Drive e retorna o conteúdo do primeiro .html encontrado."""
    folder_id = extract_folder_id(drive_url)
    if not folder_id:
        print(f"[numeros] URL inválida: {drive_url}", flush=True)
        return None

    dest.mkdir(parents=True, exist_ok=True)
    print(f"[numeros] baixando pasta {folder_id}", flush=True)

    try:
        import gdown  # noqa: PLC0415
        gdown.download_folder(
            url=f"https://drive.google.com/drive/folders/{folder_id}",
            output=str(dest),
            quiet=False,
            use_cookies=False,
            remaining_ok=True,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[numeros] download falhou: {type(e).__name__}: {e}", flush=True)
        return None

    htmls = list(dest.rglob("*.html")) + list(dest.rglob("*.htm"))
    if not htmls:
        print(f"[numeros] nenhum .html encontrado em {dest}", flush=True)
        return None

    print(f"[numeros] {len(htmls)} arquivo(s) HTML; usando '{htmls[0].name}'", flush=True)
    try:
        return htmls[0].read_text(encoding="utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        print(f"[numeros] erro lendo {htmls[0].name}: {e}", flush=True)
        return None


def _strip_html(html: str, max_chars: int = 30000) -> str:
    """Remove tags pesadas de HTML pra reduzir tokens. Mantém estrutura
    e conteúdo de tabelas/listas (onde os números costumam estar)."""
    # remove <script>, <style>, comentários
    html = re.sub(r"<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<style\b[^<]*(?:(?!</style>)<[^<]*)*</style>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)
    # remove svg/img inline
    html = re.sub(r"<svg\b.*?</svg>", "", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<img\b[^>]*>", "", html, flags=re.IGNORECASE)
    # collapse whitespace
    html = re.sub(r"\s+", " ", html)
    if len(html) > max_chars:
        html = html[:max_chars]
    return html


def parse_nossos_numeros(drive_url: str, dest: Path) -> dict[str, Any] | None:
    """Baixa o HTML da pasta e usa GPT pra extrair números estruturados.

    Retorna dict com kpis/principais_despesas/historico no shape que
    a seção our_numbers espera. None se não conseguir parsear.
    """
    raw_html = _baixar_html_da_pasta(drive_url, dest)
    if not raw_html:
        return None

    snippet = _strip_html(raw_html)
    print(f"[numeros] HTML reduzido para {len(snippet)} chars", flush=True)

    prompt = (
        "Aqui está o HTML de um dashboard de prestação de contas mensal de "
        "um condomínio brasileiro. Extraia os principais números financeiros "
        "em JSON estruturado.\n\n"
        "Formato esperado:\n"
        "{\n"
        '  "kpis": {\n'
        '    "receita_brl": float,\n'
        '    "despesas_brl": float,\n'
        '    "fundo_reserva_brl": float,\n'
        '    "inadimplencia_pct": float\n'
        '  },\n'
        '  "principais_despesas": [\n'
        '    {"categoria":"...", "valor_brl": float, "observacao": "..."} x 5-7\n'
        '  ],\n'
        '  "historico": [\n'
        '    {"mes_label":"AAA/MM", "saldo_brl": float} x 5-6\n'
        "  ]\n"
        "}\n\n"
        "Use 0 quando o valor não estiver claramente disponível. Sem texto "
        "fora do JSON.\n\nHTML:\n" + snippet
    )

    fallback = {
        "kpis": {
            "receita_brl": 0,
            "despesas_brl": 0,
            "fundo_reserva_brl": 0,
            "inadimplencia_pct": 0,
        },
        "principais_despesas": [],
        "historico": [],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["kpis"])
    return data
