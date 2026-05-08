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
            max_tokens=1200,
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
        f"Estrutura sugerida (carta longa que ocupa página inteira de revista A4):\n"
        f"1) Saudação calorosa aos moradores do {condominio}\n"
        f"2) Reflexão sobre o tema da carta conectando com a realidade do condomínio\n"
        f"3) Comentário sobre a matéria de capa do mês como convite à leitura\n"
        f"4) Menção à receita e aos eventos/notícias do condomínio quando houver\n"
        f"5) Encerramento caloroso, assinado por {nome}\n\n"
        f"Tom: caloroso, próximo, em primeira pessoa do singular. "
        f"5 a 6 parágrafos densos. Total entre 350 e 500 palavras."
    )

    fallback = (
        f"Queridos moradores do {condominio}, esta edição de {mes_nome} traz {titulo_carta} "
        f"como tema central. A matéria de capa fala sobre {materia_capa}, e na receita do mês "
        f"você encontra {receita}. Boa leitura, {nome}."
    )

    return _gerar_carta(prompt, fallback)


SIGNOS = [
    ("Áries", "21/03–19/04"), ("Touro", "20/04–20/05"), ("Gêmeos", "21/05–20/06"),
    ("Câncer", "21/06–22/07"), ("Leão", "23/07–22/08"), ("Virgem", "23/08–22/09"),
    ("Libra", "23/09–22/10"), ("Escorpião", "23/10–21/11"), ("Sagitário", "22/11–21/12"),
    ("Capricórnio", "22/12–19/01"), ("Aquário", "20/01–18/02"), ("Peixes", "19/02–20/03"),
]


def _gerar_json(prompt_user: str, fallback: Any, expected_keys: list[str] | None = None) -> Any:
    """Roda prompt esperando JSON e dá parse seguro. Cai no fallback se falhar."""
    cli = _client()
    if cli is None:
        print("[text_gen] OPENAI_API_KEY ausente — usando fallback JSON", flush=True)
        return fallback

    try:
        resp = cli.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_HUMANIZER + "\n\nResponda APENAS um JSON válido, sem texto extra antes ou depois."},
                {"role": "user", "content": prompt_user},
            ],
            temperature=0.7,
            max_tokens=1800,
            response_format={"type": "json_object"},
        )
        import json
        data = json.loads(resp.choices[0].message.content or "{}")
    except Exception as e:  # noqa: BLE001
        print(f"[text_gen] OpenAI/JSON falhou: {e} — usando fallback", flush=True)
        return fallback

    if expected_keys and not all(k in data for k in expected_keys):
        print(f"[text_gen] resposta sem chaves esperadas {expected_keys} — usando fallback", flush=True)
        return fallback

    return data


def _aplicar_clean_recursivo(obj: Any) -> Any:
    """Aplica clean_text() em todas as strings dentro de um objeto JSON."""
    if isinstance(obj, str):
        return clean_text(obj)
    if isinstance(obj, list):
        return [_aplicar_clean_recursivo(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _aplicar_clean_recursivo(v) for k, v in obj.items()}
    return obj


def gerar_dicas_praticas(mes: int, ano: int) -> dict[str, Any]:
    """6 dicas práticas para convivência condominial neste mês."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Gere 6 dicas práticas de convivência condominial pra edição de {mes_nome} de {ano}. "
        f"Tom: leve, direto, prático. Cada dica é uma situação real do dia a dia "
        f"(barulho, lixo, áreas comuns, mudança, pets). Conecte com a estação do ano "
        f"({mes_nome}) quando fizer sentido.\n\n"
        f'Responda JSON: {{ "titulo_secao": "...", "intro": "...", "dicas": [{{"titulo":"...","texto":"..."}} x 6] }}'
    )
    fallback = {
        "titulo_secao": f"Dicas para {mes_nome}",
        "intro": "Pequenos hábitos que fazem o condomínio funcionar melhor.",
        "dicas": [
            {"titulo": f"Dica de {mes_nome}", "texto": "Aproveite o mês com responsabilidade na convivência condominial."} for _ in range(6)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["dicas"])
    return _aplicar_clean_recursivo(data)


def gerar_curiosidades(mes: int, ano: int) -> dict[str, Any]:
    """4 curiosidades do setor condominial pro mês."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Gere 4 curiosidades sobre o mercado/setor condominial brasileiro pra {mes_nome} de {ano}. "
        f"Cada uma com um número/dado concreto e uma explicação curta. Conteúdo de quem entende "
        f"de gestão condominial. Evite informações inventadas: use apenas fatos plausíveis e "
        f"comuns no setor (inadimplência média, número de condôminos, gastos com energia, etc).\n\n"
        f'JSON: {{ "intro": "...", "curiosidades": [{{"numero":"...","texto":"..."}} x 4] }}'
    )
    fallback = {
        "intro": "Quatro dados pra contextualizar o mês no setor condominial.",
        "curiosidades": [
            {"numero": "—", "texto": "Curiosidade do setor condominial."} for _ in range(4)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["curiosidades"])
    return _aplicar_clean_recursivo(data)


def gerar_novidades(mes: int, ano: int) -> dict[str, Any]:
    """6 novidades de mercado/legislação pro mês."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Gere 6 novidades plausíveis de mercado, lei e tecnologia condominial pra {mes_nome} de {ano}. "
        f"Mistura jurídico, tecnológico, financeiro e operacional. Use linguagem direta, "
        f"sem jargão. Evite afirmações específicas demais (números exatos, nomes de leis "
        f"reais que você não tem certeza). Foque em tendências e categorias.\n\n"
        f'JSON: {{ "intro": "...", "noticias": [{{"categoria":"...","titulo":"...","resumo":"..."}} x 6] }}'
    )
    fallback = {
        "intro": "Seis movimentos do mês no universo condominial.",
        "noticias": [
            {"categoria": "Mercado", "titulo": f"Novidade {i+1}", "resumo": "Tendência a observar."} for i in range(6)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["noticias"])
    return _aplicar_clean_recursivo(data)


def gerar_signos(mes: int, ano: int) -> dict[str, Any]:
    """Previsões pros 12 signos pro mês."""
    mes_nome = MESES_PT[mes - 1]
    signos_lista = ", ".join(s[0] for s in SIGNOS)

    prompt = (
        f"Gere previsões astrológicas leves pros 12 signos pra {mes_nome} de {ano}. "
        f"Tom: divertido, otimista, sem prometer coisas mirabolantes. 1 a 2 frases por signo, "
        f"foco em convivência, autocuidado, dia a dia. Sem clichês de horóscopo de revista popular "
        f"(nada de 'cuidado com inveja', etc).\n\n"
        f"Signos: {signos_lista}.\n\n"
        f'JSON: {{ "previsoes": {{ "Áries": "...", "Touro": "...", ... }} }}'
    )
    fallback = {
        "previsoes": {nome: f"{mes_nome} convida a olhar pra dentro." for nome, _ in SIGNOS}
    }
    data = _gerar_json(prompt, fallback, expected_keys=["previsoes"])
    return _aplicar_clean_recursivo(data)


def gerar_agenda_cultural(mes: int, ano: int) -> dict[str, Any]:
    """Sugestões de agenda cultural pro mês (em São Paulo, principalmente)."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Gere sugestões de agenda cultural pra {mes_nome} de {ano}, com foco em São Paulo "
        f"e cidades grandes do Brasil. 1 destaque (hero) + 12 cards secundários. "
        f"Variedade: museus, shows, peças, festivais, gastronomia, esporte. Evite eventos "
        f"reais específicos que você não tenha certeza absoluta — prefira categorias "
        f"genéricas que combinam com o mês ('exposições do mês', 'circuito gastronômico').\n\n"
        f'JSON: {{ "hero": {{"titulo":"...","subtitulo":"...","quando":"...","onde":"..."}}, '
        f'"cards_secundarios": [{{"categoria":"...","titulo":"...","quando":"...","onde":"..."}} x 12] }}'
    )
    fallback = {
        "hero": {
            "titulo": f"Destaques de {mes_nome}",
            "subtitulo": "Os melhores eventos da cidade neste mês.",
            "quando": f"{mes_nome} {ano}",
            "onde": "São Paulo",
        },
        "cards_secundarios": [
            {"categoria": "Cultura", "titulo": f"Evento {i+1}", "quando": f"{mes_nome}", "onde": "São Paulo"} for i in range(12)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["cards_secundarios"])
    return _aplicar_clean_recursivo(data)


def gerar_materia_capa_completa(
    titulo: str, subtitulo: str, mes: int, ano: int,
) -> dict[str, Any]:
    """Texto completo de matéria de capa em 8 blocos (preenche 2 páginas)."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Escreva uma matéria de capa de revista mensal de condomínios pra {mes_nome} {ano}. "
        f"Título: '{titulo}'. Subtítulo: '{subtitulo}'.\n\n"
        f"Estrutura: 8 blocos curtos de texto (cada bloco com 80 a 120 palavras). "
        f"Tom: jornalístico próximo, voz humana, em português brasileiro com acentos corretos. "
        f"Nada de bullets ou listas. Sem travessões. Cada bloco aborda um ângulo diferente do tema. "
        f"Use dados plausíveis (não invente números específicos). Cite tipos de fonte ('especialistas', "
        f"'pesquisas do setor') sem nomes próprios reais.\n\n"
        f'JSON: {{ "corpo_blocos": ["...", "...", ... 8 blocos] }}'
    )
    fallback = {
        "corpo_blocos": [
            f"Sobre {titulo}, vale lembrar que cada condomínio é único. "
            f"O essencial é ouvir, dialogar e construir consensos a partir do que é comum. "
            f"Em {mes_nome}, aproveite pra revisar os pequenos hábitos que fazem a "
            f"diferença na convivência."
        ] * 8
    }
    data = _gerar_json(prompt, fallback, expected_keys=["corpo_blocos"])
    return _aplicar_clean_recursivo(data)


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
