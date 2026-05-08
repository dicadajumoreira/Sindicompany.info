"""
Composer — converte os registros do Supabase (revista, editorial mensal,
condomínio_meta) nos `inputs` esperados por cada seção da engine.

Onde o site ainda não coleta dados, caímos nos DEFAULT_INPUTS dos
scripts de preview pra ter algo razoável (placeholder + tema mensal
fixo). À medida que mais dados vêm do site, esses fallbacks somem.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

# Garante import do package engine + dos scripts de preview (defaults)
sys.path.insert(0, str(Path(__file__).parent.parent))

from engine.theme import load_theme
from engine.sections import (
    BackCover, Colophon, Cover, CoverStory, CulturalAgenda, Horoscope,
    IndustryFacts, Letter, LifestyleArticle, News, OurCondoEvents,
    OurCondoMaintenance, OurNumbers, Recipe, Tips, Warnings,
)
from scripts.preview_colophon import DEFAULT_INPUTS as COLOPHON_DEFAULT       # type: ignore
from scripts.preview_cover import DEFAULT_INPUTS as COVER_DEFAULT             # type: ignore
from scripts.preview_cover_story import DEFAULT_INPUTS as COVER_STORY_DEFAULT  # type: ignore
from scripts.preview_cultural_agenda import DEFAULT_INPUTS as AGENDA_DEFAULT   # type: ignore
from scripts.preview_horoscope import DEFAULT_INPUTS as HOROSCOPE_DEFAULT     # type: ignore
from scripts.preview_industry_facts import DEFAULT_INPUTS as INDUSTRY_DEFAULT  # type: ignore
from scripts.preview_letter import DEFAULT_INPUTS as LETTER_DEFAULT           # type: ignore
from scripts.preview_lifestyle_article import DEFAULT_INPUTS as LIFE_DEFAULT  # type: ignore
from scripts.preview_news import DEFAULT_INPUTS as NEWS_DEFAULT               # type: ignore
from scripts.preview_our_condo_events import DEFAULT_INPUTS as EVENTS_DEFAULT  # type: ignore
from scripts.preview_our_condo_maintenance import DEFAULT_INPUTS as MAINT_DEFAULT  # type: ignore
from scripts.preview_our_numbers import DEFAULT_INPUTS as NUMBERS_DEFAULT     # type: ignore
from scripts.preview_recipe import DEFAULT_INPUTS as RECIPE_DEFAULT           # type: ignore
from scripts.preview_tips import DEFAULT_INPUTS as TIPS_DEFAULT               # type: ignore
from scripts.preview_warnings import DEFAULT_INPUTS as WARNINGS_DEFAULT       # type: ignore


MESES = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]


def _mes_ano(revista: dict[str, Any]) -> str:
    mes = int(revista["mes"])
    return f"{MESES[mes - 1]} {revista['ano']}"


def _edicao_label(revista: dict[str, Any]) -> str:
    mes = int(revista["mes"])
    ano = revista["ano"]
    condo = revista["condominio"].upper()
    return f"EDIÇÃO {mes:02d} · {MESES[mes - 1]} {ano} · {condo} · @sindicompanybr"


def _cargo_sindico(condo_meta: dict[str, Any] | None) -> str:
    if not condo_meta:
        return "Síndico(a)"
    g = condo_meta.get("sindico_genero")
    return "Síndica" if g == "feminino" else "Síndico"


def build_inputs_from_db(
    revista: dict[str, Any],
    editorial: dict[str, Any] | None,
    condo: dict[str, Any] | None,
) -> list[tuple[str, Any, dict[str, Any]]]:
    """Retorna [(label, section_instance, inputs), …] na ordem editorial."""

    ed = editorial or {}

    # ---- S01 Capa
    cover_inputs = dict(COVER_DEFAULT)
    cover_inputs["edicao_label"] = _edicao_label(revista)
    if ed.get("materia_capa_titulo"):
        cover_inputs["manchete"] = ed["materia_capa_titulo"]
        cover_inputs["tema_materia"] = ed.get("materia_capa_titulo", "")
    if ed.get("materia_capa_subtitulo"):
        cover_inputs["subtitulo"] = ed["materia_capa_subtitulo"]
    if ed.get("foto_capa_url"):
        cover_inputs["foto_capa"] = ed["foto_capa_url"]

    # ---- S02 Carta do Síndico
    letter_inputs = dict(LETTER_DEFAULT)
    if condo and condo.get("sindico_nome"):
        letter_inputs["nome_sindico"] = condo["sindico_nome"]
        letter_inputs["genero"] = condo.get("sindico_genero") or "feminino"
        letter_inputs["cargo"] = _cargo_sindico(condo)
    letter_inputs["mes_ano"] = _mes_ano(revista)
    if ed.get("carta_sindico_tema"):
        letter_inputs["titulo"] = ed["carta_sindico_tema"]
    if revista.get("carta_sindico_texto"):
        letter_inputs["texto"] = revista["carta_sindico_texto"]
    if condo and condo.get("sindico_foto_path"):
        # Path relativo no bucket público — engine espera URL pública ou caminho local.
        letter_inputs["foto_sindico"] = condo["sindico_foto_path"]

    # ---- S03 Agenda Cultural
    agenda_inputs = dict(AGENDA_DEFAULT)

    # ---- S04 Matéria de Capa
    cover_story_inputs = dict(COVER_STORY_DEFAULT)
    if ed.get("materia_capa_titulo"):
        cover_story_inputs["titulo"] = ed["materia_capa_titulo"]
    if ed.get("materia_capa_subtitulo"):
        cover_story_inputs["subtitulo"] = ed["materia_capa_subtitulo"]

    # ---- S05/S06/S07 placeholders (ainda sem input via site)
    tips_inputs = dict(TIPS_DEFAULT)
    industry_inputs = dict(INDUSTRY_DEFAULT)
    news_inputs = dict(NEWS_DEFAULT)

    # ---- S08/S09 (Drive integration ainda pendente — placeholders)
    maint_inputs = dict(MAINT_DEFAULT)
    if revista.get("condominio"):
        maint_inputs["condominio"] = revista["condominio"]
    events_inputs = dict(EVENTS_DEFAULT)

    # ---- S10 Receita
    recipe_inputs = dict(RECIPE_DEFAULT)
    recipe_inputs["mes_referencia"] = _mes_ano(revista)
    if ed.get("receita_titulo"):
        recipe_inputs["titulo_receita"] = ed["receita_titulo"]
    if ed.get("receita_descricao"):
        recipe_inputs["intro"] = ed["receita_descricao"]

    # ---- S11 Nossos Números (Drive prestação ainda pendente)
    numbers_inputs = dict(NUMBERS_DEFAULT)

    # ---- S12 Advertências
    warnings_inputs = dict(WARNINGS_DEFAULT)
    if revista.get("multas_advertencias_obs"):
        warnings_inputs["observacao"] = revista["multas_advertencias_obs"]

    # ---- S12B Vida Condominial / S13 Signos / S14 Expediente / S15 Contracapa
    life_inputs = dict(LIFE_DEFAULT)
    horoscope_inputs = dict(HOROSCOPE_DEFAULT)
    colophon_inputs = dict(COLOPHON_DEFAULT)
    back_cover_inputs = {"proxima_edicao_label": f"Próxima edição: {MESES[(int(revista['mes'])) % 12].lower()} {revista['ano'] if int(revista['mes']) < 12 else int(revista['ano'])+1}"}

    return [
        ("S01 Capa",                   Cover(),                cover_inputs),
        ("S02 Carta do Síndico",       Letter(),               letter_inputs),
        ("S03 Agenda Cultural",        CulturalAgenda(),       agenda_inputs),
        ("S04 Matéria de Capa",        CoverStory(),           cover_story_inputs),
        ("S05 Dicas Práticas",         Tips(),                 tips_inputs),
        ("S06 Curiosidades",           IndustryFacts(),        industry_inputs),
        ("S07 Novidades e Legislação", News(),                 news_inputs),
        ("S08 Manutenções",            OurCondoMaintenance(),  maint_inputs),
        ("S09 Eventos",                OurCondoEvents(),       events_inputs),
        ("S10 Receita do Mês",         Recipe(),               recipe_inputs),
        ("S11 Nossos Números",         OurNumbers(),           numbers_inputs),
        ("S12 Advertências e Multas",  Warnings(),             warnings_inputs),
        ("S12B Vida Condominial",      LifestyleArticle(),     life_inputs),
        ("S13 Signos do Mês",          Horoscope(),            horoscope_inputs),
        ("S14 Expediente",             Colophon(),             colophon_inputs),
        ("S15 Contracapa",             BackCover(),            back_cover_inputs),
    ]


def render_pdf_bytes(sequence: list[tuple[str, Any, dict[str, Any]]]) -> tuple[bytes, int]:
    """Renderiza o HTML composto e converte pra PDF via WeasyPrint."""
    theme = load_theme()
    bodies: list[str] = []
    page_count = 0

    for label, section, inputs in sequence:
        errors = section.validate(inputs)
        if errors:
            print(f"  ⚠ {label}: warnings de validação: {errors}", flush=True)
        section_bodies = section.render_a4(inputs, theme)
        bodies.extend(section_bodies)
        page_count += len(section_bodies)
        print(f"  ✓ {label} · {len(section_bodies)} pág", flush=True)

    full_html = theme.page_document("\n".join(bodies), format="a4")

    # WeasyPrint só importado aqui pra deixar o composer importável
    # mesmo em ambientes sem libs de sistema (testes etc).
    from weasyprint import HTML
    from io import BytesIO

    buf = BytesIO()
    HTML(string=full_html, base_url=str(Path.cwd())).write_pdf(target=buf)
    return buf.getvalue(), page_count
