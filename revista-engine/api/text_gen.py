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
# Modelo com web search built-in da OpenAI (lança em 2025) — usado pra
# seções que precisam de dados reais (agenda cultural, novidades).
SEARCH_MODEL = os.environ.get("OPENAI_SEARCH_MODEL", "gpt-4o-search-preview")

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
        f"Queridos moradores do {condominio}, é com alegria que escrevo essa carta "
        f"para abrir nossa edição de {mes_nome}. {titulo_carta} é o tema que escolhemos "
        f"para guiar este mês, e ele tem tudo a ver com a forma como vivemos juntos por aqui.\n\n"
        f"Cada edição é uma oportunidade de olhar pro condomínio com novos olhos. {mes_nome} "
        f"traz suas próprias particularidades, e a matéria de capa, que fala sobre {materia_capa}, "
        f"convida todos nós a refletir sobre como podemos construir uma convivência mais leve "
        f"e mais humana no nosso dia a dia. São conversas simples, mas que fazem diferença.\n\n"
        f"Como gosto sempre de lembrar, condomínio bom é aquele em que todo mundo se sente "
        f"em casa. Isso não acontece sozinho. Acontece quando cada morador faz a sua parte, "
        f"quando a gestão escuta, quando os funcionários são tratados com respeito, quando "
        f"as crianças podem brincar sem medo e quando os mais velhos encontram aqui um lugar "
        f"de acolhimento. É um trabalho coletivo, contínuo, que vale a pena.\n\n"
        f"Aproveitem também a receita do mês, {receita}, que vem para a mesa com o sabor "
        f"de quem conhece a estação. E na agenda cultural vocês encontram sugestões para "
        f"sair do prédio e descobrir o que a cidade tem oferecido por aí.\n\n"
        f"Boa leitura, e um abraço para todas as famílias do {condominio}.\n\n"
        f"{nome}"
    )

    return _gerar_carta(prompt, fallback)


# Slugs precisam bater EXATAMENTE com o que a seção horoscope.py espera
# (aries, touro, gemeos, cancer, leao, virgem, libra, escorpiao,
#  sagitario, capricornio, aquario, peixes).
SIGNOS = [
    ("aries", "Áries", "21/03–19/04"),
    ("touro", "Touro", "20/04–20/05"),
    ("gemeos", "Gêmeos", "21/05–20/06"),
    ("cancer", "Câncer", "21/06–22/07"),
    ("leao", "Leão", "23/07–22/08"),
    ("virgem", "Virgem", "23/08–22/09"),
    ("libra", "Libra", "23/09–22/10"),
    ("escorpiao", "Escorpião", "23/10–21/11"),
    ("sagitario", "Sagitário", "22/11–21/12"),
    ("capricornio", "Capricórnio", "22/12–19/01"),
    ("aquario", "Aquário", "20/01–18/02"),
    ("peixes", "Peixes", "19/02–20/03"),
]


def _gerar_json(
    prompt_user: str,
    fallback: Any,
    expected_keys: list[str] | None = None,
    *,
    use_web_search: bool = False,
) -> Any:
    """Roda prompt esperando JSON e dá parse seguro.

    use_web_search: True usa o modelo gpt-4o-search-preview que pesquisa
    na web. Útil pra agenda cultural, novidades, etc.
    """
    cli = _client()
    if cli is None:
        print("[text_gen] OPENAI_API_KEY ausente — usando fallback JSON", flush=True)
        return fallback

    model = SEARCH_MODEL if use_web_search else MODEL
    print(f"[text_gen] chamando {model} (web_search={use_web_search})", flush=True)

    try:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_HUMANIZER + "\n\nResponda APENAS um JSON válido, sem texto extra antes ou depois, nada de ```json."},
                {"role": "user", "content": prompt_user},
            ],
        }
        # Modelos search-preview não aceitam temperature ou response_format
        if not use_web_search:
            kwargs["temperature"] = 0.7
            kwargs["max_tokens"] = 1800
            kwargs["response_format"] = {"type": "json_object"}

        resp = cli.chat.completions.create(**kwargs)
        raw = (resp.choices[0].message.content or "").strip()
        print(f"[text_gen] resposta {len(raw)} chars", flush=True)

        import json
        # Modelos search-preview às vezes envolvem em ```json ... ```
        cleaned = raw
        if cleaned.startswith("```"):
            # remove primeira linha (```json) e última linha (```)
            cleaned = "\n".join(cleaned.split("\n")[1:-1])
        data = json.loads(cleaned or "{}")
    except Exception as e:  # noqa: BLE001
        print(f"[text_gen] OpenAI/JSON falhou: {type(e).__name__}: {e}", flush=True)
        return fallback

    if expected_keys and not all(k in data for k in expected_keys):
        print(f"[text_gen] resposta sem chaves esperadas {expected_keys}: tem {list(data.keys())[:5]}", flush=True)
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
        f'Responda JSON: {{ "titulo_secao": "...", "intro": "...", "dicas": [{{"titulo":"...","corpo":"..."}} x 6] }}'
    )
    fallback = {
        "titulo_secao": f"Dicas para {mes_nome}",
        "intro": "Pequenos hábitos que fazem o condomínio funcionar melhor.",
        "dicas": [
            {"titulo": f"Dica {i+1} de {mes_nome}", "corpo": "Aproveite o mês com responsabilidade na convivência."}
            for i in range(6)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["dicas"])
    return _aplicar_clean_recursivo(data)


def gerar_curiosidades(mes: int, ano: int) -> dict[str, Any]:
    """4 curiosidades do setor condominial pro mês."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Gere 4 curiosidades sobre o mercado/setor condominial brasileiro pra {mes_nome} de {ano}. "
        f"Cada uma com um número/dado concreto e um contexto curto. Conteúdo de quem entende "
        f"de gestão condominial. Evite informações inventadas: use apenas fatos plausíveis e "
        f"comuns no setor (inadimplência média, número de condôminos, gastos com energia, etc). "
        f"Para cada curiosidade, atribua uma fonte plausível (ex: 'Sindicato da Habitação', "
        f"'pesquisa setorial 2024').\n\n"
        f'JSON: {{ "intro": "...", "curiosidades": [{{"fato":"...","contexto":"...","fonte":"..."}} x 4] }}'
    )
    fallback = {
        "intro": "Quatro dados pra contextualizar o mês no setor condominial.",
        "curiosidades": [
            {"fato": "Setor", "contexto": "Curiosidade do setor condominial.", "fonte": "Pesquisa setorial"} for _ in range(4)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["curiosidades"])
    return _aplicar_clean_recursivo(data)


def gerar_novidades(mes: int, ano: int) -> dict[str, Any]:
    """6 novidades reais de mercado/legislação pro mês (via web search)."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Pesquise NA WEB notícias REAIS de {mes_nome} de {ano} sobre o setor "
        f"condominial brasileiro: legislação (leis, decretos, súmulas STJ), "
        f"tecnologia (apps, automação), mercado (juros, inadimplência, taxas), "
        f"sustentabilidade. Use portais especializados (SíndicoNet, Folha "
        f"Condomínios, Direcional Condomínios, ABADI, blogs jurídicos).\n\n"
        f"Selecione 6 notícias com data, título, resumo (1-2 frases) e fonte "
        f"verificável. Apenas fatos publicados, nada inventado.\n\n"
        f'JSON estrito: {{ "intro": "Resumo do mês no setor", '
        f'"noticias": [{{"data":"DD/MM","titulo":"...","resumo":"...","fonte":"Veículo"}} x 6] }}'
    )
    fallback = {
        "intro": "Seis movimentos do mês no universo condominial.",
        "noticias": [
            {
                "data": f"{(i+1)*4:02d}/{mes:02d}",
                "titulo": f"Novidade {i+1}",
                "resumo": "Tendência a observar.",
                "fonte": "Mercado",
            }
            for i in range(6)
        ],
    }
    # Novidades também usam web search (legislações, mercado em tempo real)
    data = _gerar_json(prompt, fallback, expected_keys=["noticias"], use_web_search=True)
    return _aplicar_clean_recursivo(data)


def gerar_signos(mes: int, ano: int) -> dict[str, Any]:
    """Previsões pros 12 signos pro mês.

    A seção horoscope.py espera previsoes com chaves slugificadas
    sem acento: aries, touro, gemeos, cancer, leao, virgem, libra,
    escorpiao, sagitario, capricornio, aquario, peixes.
    """
    mes_nome = MESES_PT[mes - 1]
    keys = ", ".join(slug for slug, _, _ in SIGNOS)

    prompt = (
        f"Gere previsões astrológicas leves pros 12 signos pra {mes_nome} de {ano}. "
        f"Tom: divertido, otimista, sem prometer coisas mirabolantes. 1 a 2 frases por signo, "
        f"foco em convivência, autocuidado, dia a dia. Sem clichês de horóscopo de revista popular.\n\n"
        f"As chaves do JSON precisam ser EXATAMENTE: {keys} (sem acentos).\n\n"
        f'JSON: {{ "previsoes": {{ "aries": "...", "touro": "...", ..., "peixes": "..." }} }}'
    )
    fallback = {
        "previsoes": {slug: f"{mes_nome} convida a olhar pra dentro com calma." for slug, _, _ in SIGNOS}
    }
    data = _gerar_json(prompt, fallback, expected_keys=["previsoes"])
    return _aplicar_clean_recursivo(data)


def gerar_agenda_cultural(mes: int, ano: int) -> dict[str, Any]:
    """Agenda cultural com eventos reais via web search."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Pesquise NA WEB (em portais como Veja SP, Catraca Livre, Quero na Cena, "
        f"Folha de São Paulo - Guia, Time Out São Paulo, sites de teatros e museus, "
        f"Netflix/Globoplay/Prime Video pra estreias) eventos culturais REAIS "
        f"acontecendo em São Paulo em {mes_nome} de {ano}.\n\n"
        f"Categorias: shows, peças, exposições, cinema, festivais, gastronomia, "
        f"streaming. Use eventos com datas e locais reais.\n\n"
        f"Retorne 1 hero + 12 cards. Para cada um, traga categoria, título, "
        f"descrição curta (1 frase), data (DD/MM ou intervalo), local. "
        f"O hero é o evento mais importante do mês.\n\n"
        f'JSON estrito (sem markdown, sem texto antes/depois): {{ '
        f'"hero": {{"categoria":"Cinema/Teatro/etc.","titulo":"...","sinopse":"...","data":"DD/MM","local":"..."}}, '
        f'"cards_secundarios": [{{"categoria":"...","titulo":"...","descricao_curta":"...","data":"DD/MM","local":"..."}} x 12] '
        f'}}'
    )
    fallback = {
        "hero": {
            "categoria": "Cultura",
            "titulo": f"Destaques de {mes_nome}",
            "sinopse": f"Os melhores eventos da cidade em {mes_nome} de {ano}.",
            "data": f"{mes_nome} {ano}",
            "local": "São Paulo",
        },
        "cards_secundarios": [
            {
                "categoria": "Cultura",
                "titulo": f"Evento cultural {i+1}",
                "descricao_curta": "Programação do mês.",
                "data": f"{(i+1)*2:02d}/{mes:02d}",
                "local": "São Paulo",
            }
            for i in range(12)
        ],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["cards_secundarios"], use_web_search=True)
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
        f"Use dados plausíveis (não invente números específicos).\n\n"
        f'JSON: {{ "corpo_blocos": [{{"tipo":"paragrafo","texto":"..."}} x 8] }}'
    )
    fallback = {
        "corpo_blocos": [
            {
                "tipo": "paragrafo",
                "texto": (
                    f"Sobre {titulo}, vale lembrar que cada condomínio é único. "
                    f"O essencial é ouvir, dialogar e construir consensos a partir do que é comum. "
                    f"Em {mes_nome}, aproveite pra revisar os pequenos hábitos que fazem a "
                    f"diferença na convivência."
                ),
            }
            for _ in range(8)
        ]
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
