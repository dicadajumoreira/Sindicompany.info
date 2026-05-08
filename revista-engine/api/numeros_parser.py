"""
Parser pra dashboard de prestação de contas.

A editora coloca um arquivo dentro da pasta do Drive de prestação de
contas (campo `drive_prestacao_url` no form). A engine baixa a pasta,
detecta o tipo do arquivo e extrai os números via GPT.

Formatos suportados:
- .html / .htm  → texto bruto vai pro GPT extrair
- .png / .jpg / .jpeg / .webp / .gif  → GPT-4o Vision lê o print do dashboard

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
from api.text_gen import _gerar_json, _gerar_json_vision


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
_HTML_EXTS = {".html", ".htm"}


def _baixar_pasta(drive_url: str, dest: Path) -> Path | None:
    """Baixa a pasta inteira do Drive. Retorna o destino ou None."""
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

    return dest


def _localizar_arquivos(dest: Path) -> tuple[list[Path], list[Path]]:
    """Devolve (htmls, imagens) encontrados na pasta."""
    htmls: list[Path] = []
    imagens: list[Path] = []
    for f in dest.rglob("*"):
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext in _HTML_EXTS:
            htmls.append(f)
        elif ext in _IMAGE_EXTS:
            imagens.append(f)
    return htmls, imagens


def _strip_html(html: str, max_chars: int = 30000) -> str:
    """Remove tags pesadas de HTML pra reduzir tokens. Mantém estrutura
    e conteúdo de tabelas/listas (onde os números costumam estar)."""
    html = re.sub(r"<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<style\b[^<]*(?:(?!</style>)<[^<]*)*</style>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)
    html = re.sub(r"<svg\b.*?</svg>", "", html, flags=re.IGNORECASE | re.DOTALL)
    html = re.sub(r"<img\b[^>]*>", "", html, flags=re.IGNORECASE)
    html = re.sub(r"\s+", " ", html)
    if len(html) > max_chars:
        html = html[:max_chars]
    return html


_PROMPT_INSTRUCAO = (
    "Aqui está o dashboard de prestação de contas mensal de um condomínio "
    "brasileiro. Extraia os principais números financeiros em JSON estruturado.\n\n"
    "Formato esperado:\n"
    "{\n"
    '  "kpis": {\n'
    '    "receita_brl": float,        // total de receitas/arrecadação no mês\n'
    '    "despesas_brl": float,       // total de despesas/saídas no mês\n'
    '    "fundo_reserva_brl": float,  // saldo do fundo de reserva\n'
    '    "inadimplencia_pct": float   // percentual de inadimplência (ex: 4.2)\n'
    "  },\n"
    '  "principais_despesas": [\n'
    '    {"categoria":"...", "valor_brl": float, "observacao": "..."}  // 5-7 itens, dos maiores\n'
    "  ],\n"
    '  "historico": [\n'
    '    {"mes_label":"AAA/MM", "saldo_brl": float}  // últimos 5-6 meses se aparecer\n'
    "  ]\n"
    "}\n\n"
    "REGRAS:\n"
    "- Use float (R$ 12.345,67 → 12345.67). Não use string nem prefixo R$.\n"
    "- Inadimplência em % numérico (ex: 4.2, não '4,2%').\n"
    "- Use 0 quando o valor não estiver claramente disponível.\n"
    "- 'principais_despesas' deve listar as MAIORES despesas do mês.\n"
    "- Sem texto fora do JSON. Sem markdown.\n"
)


def parse_nossos_numeros(drive_url: str, dest: Path) -> dict[str, Any] | None:
    """Baixa o dashboard da pasta e usa GPT pra extrair números estruturados.

    Tenta nesta ordem:
      1. Imagens (PNG/JPG/...) → GPT-4o Vision
      2. HTML/HTM → GPT-4o-mini com texto bruto

    Retorna None se nada foi encontrado ou o GPT falhou completamente.
    """
    if not _baixar_pasta(drive_url, dest):
        return None

    htmls, imagens = _localizar_arquivos(dest)
    print(f"[numeros] encontrados: {len(htmls)} HTML + {len(imagens)} imagem(ns)", flush=True)

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

    if imagens:
        # Manda até 3 imagens (caso o dashboard esteja dividido em prints)
        imgs = sorted(imagens, key=lambda p: p.name)[:3]
        print(f"[numeros] processando via Vision: {[p.name for p in imgs]}", flush=True)
        data = _gerar_json_vision(
            _PROMPT_INSTRUCAO,
            [str(p) for p in imgs],
            fallback,
            expected_keys=["kpis"],
        )
        return data

    if htmls:
        try:
            raw_html = htmls[0].read_text(encoding="utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            print(f"[numeros] erro lendo {htmls[0].name}: {e}", flush=True)
            return None

        snippet = _strip_html(raw_html)
        print(f"[numeros] HTML reduzido para {len(snippet)} chars", flush=True)
        prompt = _PROMPT_INSTRUCAO + "\nHTML:\n" + snippet
        data = _gerar_json(prompt, fallback, expected_keys=["kpis"])
        return data

    print(f"[numeros] nenhum arquivo suportado em {dest}", flush=True)
    return None
