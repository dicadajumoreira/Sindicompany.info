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
            max_tokens=800,
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
        f"4 a 5 parágrafos. Total entre 300 e 400 palavras (limite estrito "
        f"para caber na página A4 sem cortar)."
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

    use_web_search: True tenta primeiro o modelo gpt-4o-search-preview
    (com web search built-in). Se a conta não tiver acesso, cai no
    modelo padrão sem search.
    """
    cli = _client()
    if cli is None:
        print("[text_gen] OPENAI_API_KEY ausente — usando fallback JSON", flush=True)
        return fallback

    # Tenta search-preview se pedido; em caso de erro (acesso, model not
    # found, etc), reativa modelo regular.
    models_to_try = [(SEARCH_MODEL, True)] if use_web_search else []
    models_to_try.append((MODEL, False))

    last_error = None
    for model, with_search in models_to_try:
        print(f"[text_gen] chamando {model} (web_search={with_search})", flush=True)
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_HUMANIZER + "\n\nResponda APENAS um JSON válido, sem texto antes/depois e sem markdown."},
                    {"role": "user", "content": prompt_user},
                ],
            }
            # Modelos search-preview não aceitam temperature, response_format ou max_tokens da mesma forma
            if not with_search:
                kwargs["temperature"] = 0.7
                kwargs["max_tokens"] = 1800
                kwargs["response_format"] = {"type": "json_object"}

            resp = cli.chat.completions.create(**kwargs)
            raw = (resp.choices[0].message.content or "").strip()
            print(f"[text_gen] resposta {len(raw)} chars de {model}", flush=True)

            import json
            # search-preview às vezes envolve em ```json ... ```
            cleaned = raw
            if cleaned.startswith("```"):
                cleaned = "\n".join(cleaned.split("\n")[1:-1])
            data = json.loads(cleaned or "{}")

            if expected_keys and not all(k in data for k in expected_keys):
                print(
                    f"[text_gen] {model}: faltam chaves {expected_keys} (tem {list(data.keys())[:5]})",
                    flush=True,
                )
                last_error = "missing-keys"
                continue  # tenta próximo modelo

            return data

        except Exception as e:  # noqa: BLE001
            print(f"[text_gen] {model} falhou: {type(e).__name__}: {str(e)[:200]}", flush=True)
            last_error = str(e)
            continue  # tenta próximo modelo

    print(f"[text_gen] todos os modelos falharam (último erro: {last_error}) — fallback", flush=True)
    return fallback


def _gerar_json_vision(
    prompt_user: str,
    image_paths: list[str],
    fallback: Any,
    expected_keys: list[str] | None = None,
) -> Any:
    """Roda prompt + uma ou mais imagens no GPT-4o Vision esperando JSON.

    Usado pra extrair números de um print de dashboard (PNG/JPG) que a
    editora coloca na pasta de prestação de contas.
    """
    cli = _client()
    if cli is None:
        print("[text_gen] OPENAI_API_KEY ausente — usando fallback JSON (vision)", flush=True)
        return fallback

    import base64
    import json
    import mimetypes

    # Modelos sem 'mini' veem imagens com mais detalhes; gpt-4o-mini é ok
    # pra dashboards simples e mais barato.
    vision_model = os.environ.get("OPENAI_VISION_MODEL", "gpt-4o")

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt_user}]
    for p in image_paths:
        try:
            with open(p, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            mime = mimetypes.guess_type(p)[0] or "image/png"
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
            })
        except Exception as e:  # noqa: BLE001
            print(f"[text_gen] falhou lendo imagem {p}: {e}", flush=True)
            continue

    if len(content) == 1:
        # Nenhuma imagem foi lida com sucesso
        return fallback

    print(f"[text_gen] chamando {vision_model} com {len(content)-1} imagem(ns)", flush=True)
    try:
        resp = cli.chat.completions.create(
            model=vision_model,
            messages=[
                {"role": "system", "content": "Você extrai dados financeiros estruturados de dashboards. Responda APENAS um JSON válido, sem texto antes/depois e sem markdown."},
                {"role": "user", "content": content},
            ],
            temperature=0.2,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
        print(f"[text_gen] vision retornou {len(raw)} chars", flush=True)
        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = "\n".join(cleaned.split("\n")[1:-1])
        data = json.loads(cleaned or "{}")
        if expected_keys and not all(k in data for k in expected_keys):
            print(f"[text_gen] vision: faltam chaves {expected_keys}", flush=True)
            return fallback
        return data
    except Exception as e:  # noqa: BLE001
        print(f"[text_gen] vision falhou: {type(e).__name__}: {str(e)[:200]}", flush=True)
        return fallback


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


def gerar_dica_receita(titulo: str, intro: str = "") -> str:
    """Gera uma dica curta (1-2 frases) referente à receita do mês.

    A dica é específica do prato — ex: substituição de ingrediente,
    ponto certo, harmonização. Não dica genérica de cozinha.
    """
    titulo = (titulo or "").strip()
    if not titulo:
        return ""
    cli = _client()
    fallback = "Sirva quente, com uma dose extra de carinho."
    if cli is None:
        return fallback
    prompt = (
        f"Receita do mês: '{titulo}'.\n"
        f"{('Sobre a receita: ' + intro) if intro else ''}\n\n"
        f"Escreva UMA dica de cozinheira experiente, em 1 ou 2 frases (máx 220 caracteres), "
        f"ESPECÍFICA pra essa receita: pode ser uma substituição de ingrediente, "
        f"o ponto certo de cozimento, uma combinação que casa, ou um truque de "
        f"apresentação. Tom: leve, próximo, voz humana. Sem clichês. Sem bullet. "
        f"Sem aspas, sem prefixos como 'Dica:'."
    )
    try:
        resp = cli.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_HUMANIZER},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            max_tokens=120,
        )
        text = (resp.choices[0].message.content or "").strip()
        return clean_text(text) or fallback
    except Exception as e:  # noqa: BLE001
        print(f"[text_gen] dica receita falhou: {e}", flush=True)
        return fallback


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
    """6 novidades reais que impactam quem vive em condomínios."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Pesquise NA WEB notícias REAIS de {mes_nome} de {ano} que IMPACTAM "
        f"a vida de quem mora em condomínios. Cubra:\n"
        f"- Mudanças em leis (Código Civil, lei do inquilinato, IPTU, IR)\n"
        f"- Decisões do STJ/STF sobre condomínios\n"
        f"- Tecnologia que muda o dia a dia (delivery, IoT, segurança)\n"
        f"- Tarifas e custos (água, luz, gás, serviços)\n"
        f"- Tendências de mercado imobiliário e aluguel\n\n"
        f"FONTES OBRIGATÓRIAS (pesquise nesses portais): UOL, G1, Folha de "
        f"São Paulo, R7. Pode complementar com SíndicoNet e Direcional Condomínios. "
        f"Apenas notícias REAIS publicadas, com fonte verificável.\n\n"
        f"Selecione 6 notícias com data (dentro de {mes_nome}/{ano}), título "
        f"curto e direto (no máx 60 caracteres), resumo de UMA frase só (no máx "
        f"120 caracteres) e veículo. Categorize cada uma com badge: "
        f"LEGISLAÇÃO, MERCADO, NOVIDADE ou TECNOLOGIA.\n\n"
        f"REGRA CRÍTICA: 'titulo' e 'resumo' devem conter SOMENTE prosa "
        f"limpa. Sem URLs, sem markdown links [texto](url), sem citações "
        f"inline tipo '([uol.com.br](https://...))'. O nome do veículo vai "
        f"APENAS no campo 'fonte'.\n\n"
        f'JSON estrito: {{ "intro": "Resumo do mês para condôminos", '
        f'"noticias": [{{"badge":"LEGISLAÇÃO","data":"DD/MM","titulo":"...","resumo":"...","fonte":"UOL/G1/Folha/R7"}} x 6] }}'
    )
    fallback = {
        "intro": "Seis movimentos do mês no universo condominial.",
        "noticias": [
            {
                "badge": ["NOVIDADE", "LEGISLAÇÃO", "MERCADO", "TECNOLOGIA"][i % 4],
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
    """Agenda cultural com lançamentos reais via web search."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Pesquise NA WEB lançamentos REAIS de {mes_nome} de {ano} nessas categorias:\n"
        f"- NETFLIX: séries e filmes que estreiam em {mes_nome}/{ano}\n"
        f"- GOOGLE PLAY / Prime Video / Disney+: estreias do mês\n"
        f"- CINEMA: filmes que estreiam nas salas brasileiras em {mes_nome}/{ano} "
        f"(consulte AdoroCinema, Filmow, Folha de São Paulo - Guia)\n"
        f"- TEATRO: peças em cartaz em São Paulo em {mes_nome}/{ano} "
        f"(consulte Quero na Cena, Veja SP, Catraca Livre, sites de teatros)\n\n"
        f"Selecione 1 destaque (hero) + 12 cards. Cada item com data real, local "
        f"(quando aplicável) e descrição curta de 1 frase. Use SEMPRE títulos reais.\n\n"
        f"REGRA CRÍTICA: 'titulo', 'sinopse' e 'descricao_curta' devem ser "
        f"prosa limpa. Sem URLs, sem markdown [texto](url), sem citações "
        f"inline tipo '([site.com](https://...))'. Não cite veículos no texto.\n\n"
        f'JSON estrito (sem markdown): {{ '
        f'"hero": {{"categoria":"NETFLIX/CINEMA/TEATRO/STREAMING","titulo":"Título real","sinopse":"...","data":"DD/MM","local":"..."}}, '
        f'"cards_secundarios": [{{"categoria":"...","titulo":"Título real","descricao_curta":"...","data":"DD/MM","local":"..."}} x 12] '
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
    """Matéria de capa em 8 blocos baseada em pesquisa real."""
    mes_nome = MESES_PT[mes - 1]
    prompt = (
        f"Escreva a matéria de capa de uma revista mensal de condomínios "
        f"para {mes_nome} {ano}. Título: '{titulo}'. Subtítulo: '{subtitulo}'.\n\n"
        f"PESQUISE NA WEB (UOL, G1, Folha de São Paulo, R7) reportagens, "
        f"dados, tendências e estudos recentes que cabem no tema E que "
        f"IMPACTAM a vida de quem vive em condomínios. Use fatos reais, "
        f"números reais (com fonte) e cite os portais consultados.\n\n"
        f"Estrutura: 8 blocos curtos (80-120 palavras cada). Tom jornalístico "
        f"próximo, voz humana, português brasileiro com acentos corretos. "
        f"Nada de bullets, nada de travessões. Cada bloco aborda um ângulo "
        f"diferente. Sempre conecte com o cotidiano do condomínio.\n\n"
        f"INCLUA também 3 a 5 fontes (nome do veículo + ano), tipo "
        f"'UOL · 2025', 'G1 · 2024', 'Folha de São Paulo · 2025'.\n\n"
        f"REGRA CRÍTICA: o campo 'texto' de cada bloco deve conter SOMENTE "
        f"prosa limpa. NÃO inclua URLs, links em markdown como [texto](url) "
        f"nem citações inline tipo '([uol.com.br](https://...))'. As fontes "
        f"vão APENAS no campo separado 'fontes'.\n\n"
        f'JSON: {{ "corpo_blocos": [{{"tipo":"paragrafo","texto":"..."}} x 8], '
        f'"fontes": ["UOL · 2025", "G1 · 2024", ... 3-5 itens] }}'
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
        ],
        "fontes": ["UOL", "G1", "Folha de São Paulo"],
    }
    data = _gerar_json(prompt, fallback, expected_keys=["corpo_blocos"], use_web_search=True)
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
