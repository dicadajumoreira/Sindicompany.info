"""
Geração de texto humanizado pra cartas da revista.

Política do produto:
  - Toda carta gerada por IA precisa parecer escrita por uma pessoa,
    não por máquina. Sem travessões (—), sem cara de "ChatGPT".
  - Português brasileiro correto, com todos os acentos.
  - Carta do(a) síndico(a) deve referenciar matéria de capa, receita
    do mês, números do condo (quando houver) e algum acontecimento
    interno se a edição teve. Carta do gestor é mais operacional.

Sem API key (OPENAI_API_KEY ausente), as funções caem num texto
genérico baseado no tema, pra não derrubar a geração.
"""

from __future__ import annotations

import os
import re
from typing import Any

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# Caracteres que a editora pediu pra remover de qualquer texto:
#   — em dash, – en dash, ‒ figure dash, ― horizontal bar
DASH_RX = re.compile(r"[‐‑‒–—―]")


def clean_text(text: str) -> str:
    """Pós-processamento aplicado a TODO texto da revista.

    - Remove travessões (substitui por vírgula+espaço)
    - Normaliza espaços duplicados
    - Tira espaço antes de pontuação
    """
    if not text:
        return text

    # — / – / – etc → ", " (mais natural que apagar)
    out = DASH_RX.sub(", ", text)

    # Espaço antes de pontuação (típico de pós-processamento bagunçado)
    out = re.sub(r"\s+([,;:.!?])", r"\1", out)

    # Espaços duplicados
    out = re.sub(r"[ \t]+", " ", out)

    # Limpa linhas com só espaços
    out = re.sub(r"\n[ \t]+", "\n", out)

    return out.strip()


def _client():
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        return None


SYSTEM_HUMANIZER = (
    "Você escreve textos editoriais para uma revista mensal de condomínios em português brasileiro. "
    "Escreva como uma pessoa real escreveria: em primeira pessoa quando apropriado, com naturalidade, "
    "voz própria, frases de tamanhos variados, e detalhes concretos. Evite jargões corporativos, "
    "clichês de IA ('Em um mundo onde…'), enumeração mecânica e introduções genéricas. "
    "REGRAS DURAS:\n"
    "- NUNCA use travessões (—, –). Use vírgulas, pontos ou parênteses.\n"
    "- Português brasileiro correto, com todos os acentos (á, é, í, ó, ú, ã, õ, ç).\n"
    "- Sem markdown. Sem emojis. Sem listas com bullets.\n"
    "- Parágrafos curtos. 2 a 4 parágrafos no total.\n"
    "- Evite frases prontas tipo 'É com grande prazer que…'."
)


def _gerar_carta(prompt_user: str, fallback: str) -> str:
    """Roda o prompt no OpenAI; cai no fallback se algo der errado."""
    cli = _client()
    if cli is None:
        print("[text_gen] OPENAI_API_KEY ausente — usando fallback", flush=True)
        return clean_text(fallback)

    try:
        resp = cli.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_HUMANIZER},
                {"role": "user", "content": prompt_user},
            ],
            temperature=0.8,
            max_tokens=600,
        )
        text = resp.choices[0].message.content or ""
    except Exception as e:  # noqa: BLE001
        print(f"[text_gen] OpenAI falhou: {e} — usando fallback", flush=True)
        return clean_text(fallback)

    return clean_text(text)


MESES_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def gerar_carta_sindico(
    condo: dict[str, Any],
    editorial: dict[str, Any],
    revista: dict[str, Any],
) -> str:
    """Gera a carta do(a) síndico(a) personalizada pro condomínio + mês."""
    nome = condo.get("sindico_nome") or "Síndico(a)"
    genero = condo.get("sindico_genero") or "feminino"
    titulo_carta = editorial.get("carta_sindico_tema") or "Mensagem do mês"
    materia_capa = editorial.get("materia_capa_titulo") or ""
    receita = editorial.get("receita_titulo") or ""
    condominio = revista.get("condominio") or ""
    mes_nome = MESES_PT[int(revista["mes"]) - 1] if revista.get("mes") else ""
    ano = revista.get("ano", "")

    eventos = "Houve eventos no condomínio neste mês." if revista.get("tem_eventos") else ""
    advert = revista.get("multas_advertencias_obs") or ""

    pronome = "a síndica" if genero == "feminino" else "o síndico"

    prompt = (
        f"Escreva a carta de {pronome} '{nome}' pra revista mensal do condomínio "
        f"'{condominio}', edição de {mes_nome} de {ano}.\n\n"
        f"Tema da carta: {titulo_carta}\n"
        f"Matéria de capa do mês: {materia_capa}\n"
        f"Receita do mês: {receita}\n"
        f"{('Acontecimentos internos: ' + eventos) if eventos else ''}\n"
        f"{('Notas sobre advertências/multas: ' + advert) if advert else ''}\n\n"
        f"Estrutura sugerida:\n"
        f"1) Saudação calorosa aos moradores, mencionando o condomínio pelo nome\n"
        f"2) Conexão entre o tema da carta e a vida real do condomínio\n"
        f"3) Referência leve à matéria de capa e à receita do mês como convite à leitura\n"
        f"4) Encerramento simples, assinado por {nome}\n\n"
        f"Tom: caloroso, próximo, em primeira pessoa do singular. 3 parágrafos."
    )

    fallback = (
        f"Queridos moradores do {condominio}, esta edição de {mes_nome} traz {titulo_carta} "
        f"como tema central. A matéria de capa fala sobre {materia_capa}, e na receita do mês "
        f"você encontra {receita}. Boa leitura, {nome}."
    )

    return _gerar_carta(prompt, fallback)


def gerar_carta_gestor(
    condo: dict[str, Any],
    editorial: dict[str, Any],
    revista: dict[str, Any],
) -> str:
    """Gera a carta do gestor (operacional, próximo do dia a dia)."""
    nome = revista.get("gestor_nome") or "Gestor"
    titulo = editorial.get("carta_gestor_tema") or "Recado do gestor"
    condominio = revista.get("condominio") or ""
    mes_nome = MESES_PT[int(revista["mes"]) - 1] if revista.get("mes") else ""
    ano = revista.get("ano", "")

    prompt = (
        f"Escreva a carta do gestor de atendimento '{nome}' pra revista mensal do "
        f"condomínio '{condominio}', edição de {mes_nome} de {ano}.\n\n"
        f"Tema: {titulo}\n\n"
        f"Tom: prático, próximo dos moradores, voz do dia a dia. Fale de canais "
        f"de atendimento, manutenções correntes, regras simples de convivência. "
        f"2 parágrafos curtos. Encerre assinando como gestor."
    )

    fallback = (
        f"Olá, moradores do {condominio}. Esta edição de {mes_nome} é sobre {titulo}. "
        f"Estou à disposição pelos canais de atendimento. Abraço, {nome}."
    )

    return _gerar_carta(prompt, fallback)
