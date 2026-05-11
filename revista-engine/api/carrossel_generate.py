"""
Engine de geração de carrossel Instagram da Sindicompany.

Pipeline:
  1. Lê o registro `carrosseis` no Supabase pelo id
  2. Gera copy estruturada via GPT (N slides com tipo + título + body)
  3. Renderiza HTML por slide com paleta + Epilogue
  4. Playwright captura cada slide como PNG 3072×3839 (4K vertical 4:5)
  5. Sobe os PNGs no bucket público condominios-fotos/__carrosseis/<id>/
  6. Gera legenda Instagram via GPT
  7. Atualiza o registro: png_paths, legenda, status=publicada

Falha em qualquer etapa: marca status=erro com erro_mensagem.

Uso (CLI):
    python -m api.carrossel_generate <carrossel_id>
"""

from __future__ import annotations

import base64
import io
import json
import os
import random
import sys
import traceback
import urllib.error
import urllib.request
from typing import Any

from api.supabase_client import _client as _sb_client
from api.text_gen import _client as _openai_client, MODEL, _gerar_json


# Marca do carrossel atual — setada em main() antes de qualquer
# lookup de asset. Define qual conjunto de buckets/handle/logo usar.
_BRAND = "sindicompanybr"


def _asset_prefix() -> str:
    """Prefixo dos buckets de assets conforme a marca:
    - sindicompanybr -> '__'   (ex: __patterns/, __icons/)
    - bysindicompany -> '__by-' (ex: __by-patterns/, __by-icons/)"""
    return "__by-" if _BRAND == "bysindicompany" else "__"


def _handle() -> str:
    return "@bysindicompany" if _BRAND == "bysindicompany" else "@sindicompanybr"


_PATTERNS_CACHE: list[str] | None = None  # data URLs prontos pra uso


def _patterns_data_urls() -> list[str]:
    """Baixa todos os patterns disponiveis em
    condominios-fotos/__patterns/pattern-{1..20}.{png,jpg,webp}
    e devolve lista de data URLs (base64). Cache por processo pra
    nao re-baixar a cada slide. Falha silenciosa se nao houver
    patterns ou SUPABASE_URL nao estiver setada."""
    global _PATTERNS_CACHE
    if _PATTERNS_CACHE is not None:
        return _PATTERNS_CACHE

    out: list[str] = []
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _PATTERNS_CACHE = out
        return out

    for i in range(1, 21):
        for ext in ("png", "jpg", "jpeg", "webp"):
            url = (
                f"{base}/storage/v1/object/public/"
                f"condominios-fotos/{_asset_prefix()}patterns/pattern-{i}.{ext}"
            )
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": "carrossel-engine/1.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status != 200:
                        continue
                    content = resp.read()
                    ctype = (
                        resp.headers.get("Content-Type", "image/png")
                        .split(";")[0]
                        .strip()
                    )
                b64 = base64.b64encode(content).decode("ascii")
                out.append(f"data:{ctype};base64,{b64}")
                break  # achou nessa ext, vai pro proximo i
            except urllib.error.HTTPError:
                continue
            except Exception as e:  # noqa: BLE001
                print(
                    f"[carrossel] pattern-{i}.{ext} falhou: {type(e).__name__}: {e}",
                    flush=True,
                )
                break

    _PATTERNS_CACHE = out
    print(f"[carrossel] {len(out)} pattern(s) carregado(s)", flush=True)
    return out


_PATTERNS_SHUFFLED_CACHE: list[str] | None = None


def _patterns_shuffled() -> list[str]:
    """Mesma lista de _patterns_data_urls(), mas embaralhada uma vez
    por processo. Como o engine roda um processo novo por carrossel
    (workflow GitHub Actions), cada carrossel pega uma ordem diferente
    — evita 'sempre os mesmos patterns na mesma posicao'.

    Dentro do mesmo carrossel, a ordem e estavel — todos os slides
    leem da mesma lista embaralhada, garantindo variedade entre
    adjacentes."""
    global _PATTERNS_SHUFFLED_CACHE
    if _PATTERNS_SHUFFLED_CACHE is not None:
        return _PATTERNS_SHUFFLED_CACHE
    base = list(_patterns_data_urls())
    random.shuffle(base)
    _PATTERNS_SHUFFLED_CACHE = base
    return base


def _pattern_for_slide(slide_idx: int) -> str:
    """Devolve uma data URL ciclando entre patterns aleatorizados pelo
    indice do slide, ou string vazia se nenhum pattern existir.

    Whitelist por slide: certos slides so podem usar patterns
    especificos (curadoria da marca). Pra esses, sorteia um do
    whitelist. Pra os demais, usa o shuffle global."""
    allowed = _SLIDE_PATTERN_WHITELIST.get(slide_idx)
    if allowed:
        # Embaralha os slots permitidos e devolve o primeiro que
        # tiver arquivo no Storage.
        shuffled_allowed = list(allowed)
        random.shuffle(shuffled_allowed)
        for slot in shuffled_allowed:
            url = _pattern_slot_data_url(slot)
            if url:
                return url
        return ""
    pats = _patterns_shuffled()
    if not pats:
        return ""
    return pats[(slide_idx - 1) % len(pats)]


# Curadoria de patterns por slide. Slot 1..20 mapeia pra
# __patterns/pattern-N.X. Slides nao listados aqui usam o shuffle
# global de TODOS os patterns disponiveis.
_SLIDE_PATTERN_WHITELIST: dict[int, list[int]] = {
    2: [1, 3, 8, 10, 11, 14, 16, 17],
    3: [1, 3, 8, 10, 11, 16, 17],
    4: [1, 3, 4, 6, 8, 10, 11, 13, 16, 17, 18, 19],
    5: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    6: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19],
}


_PATTERN_SLOT_CACHE: dict[int, str] = {}


def _pattern_slot_data_url(slot: int) -> str:
    """Baixa um pattern especifico em __patterns/pattern-{slot}.X.
    Cache por slot. String vazia se nao houver arquivo no slot."""
    if slot in _PATTERN_SLOT_CACHE:
        return _PATTERN_SLOT_CACHE[slot]
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _PATTERN_SLOT_CACHE[slot] = ""
        return ""
    for ext in ("png", "jpg", "jpeg", "webp"):
        url = (
            f"{base}/storage/v1/object/public/"
            f"condominios-fotos/{_asset_prefix()}patterns/pattern-{slot}.{ext}"
        )
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "carrossel-engine/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    continue
                content = resp.read()
                ctype = (
                    resp.headers.get("Content-Type", "image/png")
                    .split(";")[0]
                    .strip()
                )
            b64 = base64.b64encode(content).decode("ascii")
            url_str = f"data:{ctype};base64,{b64}"
            _PATTERN_SLOT_CACHE[slot] = url_str
            return url_str
        except urllib.error.HTTPError:
            continue
        except Exception:  # noqa: BLE001
            break
    _PATTERN_SLOT_CACHE[slot] = ""
    return ""


_ICON_CACHE: str | None = None
_ICONS_LIST_CACHE: list[str] | None = None
_ICON_SLOT_CACHE: dict[int, str] = {}
_LOGO_SLOT_CACHE: dict[int, str] = {}


def _logo_slot_data_url(slot: int) -> str:
    """Devolve data URL do logo em __logos/logo-{slot}.X. Cache por
    slot. String vazia se nao houver."""
    if slot in _LOGO_SLOT_CACHE:
        return _LOGO_SLOT_CACHE[slot]
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _LOGO_SLOT_CACHE[slot] = ""
        return ""
    for ext in ("png", "svg", "webp", "jpg", "jpeg"):
        url = (
            f"{base}/storage/v1/object/public/"
            f"condominios-fotos/{_asset_prefix()}logos/logo-{slot}.{ext}"
        )
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "carrossel-engine/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    continue
                content = resp.read()
                ctype = (
                    resp.headers.get("Content-Type", "image/png")
                    .split(";")[0]
                    .strip()
                )
            b64 = base64.b64encode(content).decode("ascii")
            url_str = f"data:{ctype};base64,{b64}"
            _LOGO_SLOT_CACHE[slot] = url_str
            print(f"[carrossel] logo-{slot}.{ext} carregado", flush=True)
            return url_str
        except urllib.error.HTTPError:
            continue
        except Exception:  # noqa: BLE001
            break
    _LOGO_SLOT_CACHE[slot] = ""
    return ""


def _icon_slot_data_url(slot: int) -> str:
    """Devolve data URL do icon especifico em __icons/icon-{slot}.X.
    Cache por slot. String vazia se nao houver."""
    if slot in _ICON_SLOT_CACHE:
        return _ICON_SLOT_CACHE[slot]
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _ICON_SLOT_CACHE[slot] = ""
        return ""
    for ext in ("png", "svg", "webp", "jpg", "jpeg"):
        url = (
            f"{base}/storage/v1/object/public/"
            f"condominios-fotos/{_asset_prefix()}icons/icon-{slot}.{ext}"
        )
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "carrossel-engine/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    continue
                content = resp.read()
                ctype = (
                    resp.headers.get("Content-Type", "image/png")
                    .split(";")[0]
                    .strip()
                )
            b64 = base64.b64encode(content).decode("ascii")
            url_str = f"data:{ctype};base64,{b64}"
            _ICON_SLOT_CACHE[slot] = url_str
            print(f"[carrossel] icon-{slot}.{ext} carregado", flush=True)
            return url_str
        except urllib.error.HTTPError:
            continue
        except Exception:  # noqa: BLE001
            break
    _ICON_SLOT_CACHE[slot] = ""
    return ""


def _icon_data_url() -> str:
    """Devolve data URL do icon principal (slot 1 em __icons/icon-1.X)
    pra usar como marca no canto inferior direito dos slides. Cache
    no processo. String vazia se nao houver."""
    global _ICON_CACHE
    if _ICON_CACHE is not None:
        return _ICON_CACHE
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _ICON_CACHE = ""
        return ""
    for ext in ("png", "svg", "webp", "jpg", "jpeg"):
        url = (
            f"{base}/storage/v1/object/public/"
            f"condominios-fotos/{_asset_prefix()}icons/icon-1.{ext}"
        )
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "carrossel-engine/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    continue
                content = resp.read()
                ctype = (
                    resp.headers.get("Content-Type", "image/png")
                    .split(";")[0]
                    .strip()
                )
            b64 = base64.b64encode(content).decode("ascii")
            _ICON_CACHE = f"data:{ctype};base64,{b64}"
            print(f"[carrossel] icon-1.{ext} carregado", flush=True)
            return _ICON_CACHE
        except urllib.error.HTTPError:
            continue
        except Exception as e:  # noqa: BLE001
            print(
                f"[carrossel] icon-1.{ext} falhou: {type(e).__name__}: {e}",
                flush=True,
            )
            break
    _ICON_CACHE = ""
    return ""


def _icons_all_data_urls() -> list[str]:
    """Baixa todos os icons do CARROSSEL em
    __icon-carrossel/icon-{1..20}.X e devolve lista de data URLs na
    ordem dos slots. Cache por processo. Slots vazios sao pulados.

    Bucket separado de __icons/ (que eh a biblioteca geral). Esse aqui
    e exclusivo da engine de carrossel: cada slot preenche o fundo de
    um slide especifico."""
    global _ICONS_LIST_CACHE
    if _ICONS_LIST_CACHE is not None:
        return _ICONS_LIST_CACHE
    out: list[str] = []
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        _ICONS_LIST_CACHE = out
        return out
    for i in range(1, 21):
        for ext in ("png", "svg", "webp", "jpg", "jpeg"):
            url = (
                f"{base}/storage/v1/object/public/"
                f"condominios-fotos/{_asset_prefix()}icon-carrossel/icon-{i}.{ext}"
            )
            try:
                req = urllib.request.Request(
                    url, headers={"User-Agent": "carrossel-engine/1.0"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    if resp.status != 200:
                        continue
                    content = resp.read()
                    ctype = (
                        resp.headers.get("Content-Type", "image/png")
                        .split(";")[0]
                        .strip()
                    )
                b64 = base64.b64encode(content).decode("ascii")
                out.append(f"data:{ctype};base64,{b64}")
                break  # achou nessa ext, vai pro proximo i
            except urllib.error.HTTPError:
                continue
            except Exception:  # noqa: BLE001
                break
    _ICONS_LIST_CACHE = out
    print(f"[carrossel] {len(out)} icon-carrossel carregado(s)", flush=True)
    return out


def _icon_for_slide(slide_idx: int) -> str:
    """Mapeia: slot 1 -> slide 2, slot 2 -> slide 3, etc.
    Capa (slide_idx 1) NAO recebe Fundo Carrossel — retorna vazio."""
    icons = _icons_all_data_urls()
    if not icons or slide_idx < 2:
        return ""
    return icons[(slide_idx - 2) % len(icons)]

BUCKET = "condominios-fotos"
SLIDE_W = 3072
SLIDE_H = 3839  # 4:5 vertical

PALETTE = {
    "onix": "#1A1C29",
    "mint": "#84C7D3",
    "sand": "#DABDA9",
    "lavender": "#B8C0FF",
    "white": "#FFFFFF",
    "gray_5": "#F4F4F5",
}


# =============================================================================
# Supabase helpers
# =============================================================================


def _fetch_carrossel(carrossel_id: str) -> dict[str, Any] | None:
    sb = _sb_client()
    res = sb.table("carrosseis").select("*").eq("id", carrossel_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _update_carrossel(carrossel_id: str, fields: dict[str, Any]) -> None:
    sb = _sb_client()
    sb.table("carrosseis").update(fields).eq("id", carrossel_id).execute()


def _upload_png(carrossel_id: str, slide_idx: int, png_bytes: bytes) -> str:
    sb = _sb_client()
    path = f"__carrosseis/{carrossel_id}/slide-{slide_idx}.png"
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=png_bytes,
        file_options={"content-type": "image/png", "upsert": "true"},
    )
    pub = sb.storage.from_(BUCKET).get_public_url(path)
    if isinstance(pub, str):
        return pub
    # supabase-py 2.x retorna string direta; algumas versões retornam dict
    return pub.get("publicUrl") if isinstance(pub, dict) else str(pub)


def _upload_slides_zip(
    carrossel_id: str, png_bytes_por_slide: list[bytes]
) -> str:
    """Empacota todos os PNGs em um ZIP e sobe pro bucket. Devolve URL
    publica. Cada PNG vai como slide-N.png (mesma convencao dos
    individuais)."""
    import zipfile

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
        for i, png in enumerate(png_bytes_por_slide, start=1):
            zf.writestr(f"slide-{i}.png", png)
    zip_bytes = buf.getvalue()
    sb = _sb_client()
    path = f"__carrosseis/{carrossel_id}/slides.zip"
    sb.storage.from_(BUCKET).upload(
        path=path,
        file=zip_bytes,
        file_options={"content-type": "application/zip", "upsert": "true"},
    )
    pub = sb.storage.from_(BUCKET).get_public_url(path)
    if isinstance(pub, str):
        return pub
    return pub.get("publicUrl") if isinstance(pub, dict) else str(pub)


# =============================================================================
# Copy generation (GPT)
# =============================================================================

# Instrucoes detalhadas por formato — so o bloco do formato escolhido
# eh injetado no prompt.
FORMATO_INSTRUCOES = {
    "historia_real": (
        "FORMATO: HISTORIA REAL (o que mais engaja e salva).\n"
        "- De NOME ao personagem (Renata, Lucas, Carlos), nunca 'um morador'.\n"
        "- Detalhes concretos: '6 kg', '4 horas', '23%', 'Ap. 8B'.\n"
        "- A historia tem virada: setup -> conflito -> descoberta -> resolucao.\n"
        "- Personagens/situacoes podem ser compostos. NUNCA invente condominios/enderecos reais.\n"
        "ESTRUTURA: 1(capa) hook no momento de tensao maxima, sem resolver. "
        "2 quem e o personagem e o problema. 3 o erro que quase aconteceu. "
        "4 a virada. 5 o resultado concreto com numero. "
        "ultimo CTA 'Voce ja passou por isso? Comenta SIM ou NAO'."
    ),
    "lista": (
        "FORMATO: LISTA (educativo, pontos equivalentes).\n"
        "- MAXIMO 5 itens, cada um cabe em UMA linha.\n"
        "- Ordene do MENOS obvio pro MAIS surpreendente: o item final precisa chocar.\n"
        "- Numeros sao parte do design (Black 900, mint, grande). Sem bullet points no texto.\n"
        "ESTRUTURA: 1(capa) 'X coisas que [acao provocativa]'. "
        "2 a N-1 um item por slide (numero no titulo + explicacao curta no body). "
        "ultimo CTA 'Qual voce nao sabia? Comenta o numero aqui'."
    ),
    "mito_verdade": (
        "FORMATO: MITO VS VERDADE (crencas erradas difundidas).\n"
        "- Sempre em PARES: Mito num slide, Verdade no seguinte.\n"
        "- O mito precisa SOAR RAZOAVEL. A verdade precisa ser ESPECIFICA (cite artigo/REsp).\n"
        "- MAXIMO 3 pares.\n"
        "ESTRUTURA: 1(capa) 'Voce acredita em algum desses mitos sobre condominio?'. "
        "2,3 Mito1->Verdade1. 4,5 Mito2->Verdade2. tipo dos slides: 'mito' / 'verdade'. "
        "ultimo CTA 'Qual mito voce acreditava? Comenta aqui'."
    ),
    "antes_depois": (
        "FORMATO: ANTES / DEPOIS (resultado tangivel de gestao profissional).\n"
        "- O 'depois' precisa ter NUMERO concreto ('caiu de 23% pra 4% em 6 meses').\n"
        "- O 'antes' precisa ser RECONHECIVEL. NUNCA fabricar resultados.\n"
        "ESTRUTURA: 1(capa) o dado do 'depois' em destaque (resultado final primeiro). "
        "2 o 'antes'. 3 o problema raiz. 4 o que mudou. 5 o 'depois' detalhado com numeros. "
        "ultimo CTA 'Seu condominio esta no antes ou no depois?'."
    ),
    "dado_choca": (
        "FORMATO: DADO QUE CHOCA (estatistica surpreendente com fonte).\n"
        "- So dados que voce conhece com FONTE IDENTIFICAVEL (SindicoNet, IBGE, SECOVI, STJ, leis federais, reportagens datadas). NUNCA invente. NUNCA 'estudos mostram'/'especialistas afirmam'.\n"
        "- Reescreva o dado com suas palavras. Cite a fonte no slide E na legenda ('Fonte: SindicoNet, 2025'). Sem dado real seguro? Use uma referencia legal solida reescrita como dado.\n"
        "ESTRUTURA: 1(capa) SO o numero em destaque (Black 900, mint/sand, ocupa o slide), sem contexto. "
        "2 o que esse numero significa na vida do morador. 3 quem esta dentro do dado. "
        "4 o contraponto. 5 o que fazer com a info. ultimo CTA 'Voce esta nesse numero? SIM ou NAO'."
    ),
    "tutorial": (
        "FORMATO: TUTORIAL RAPIDO (acao pratica que da pra fazer hoje).\n"
        "- MAXIMO 5 passos, cada um COMECA com verbo de acao (Solicite, Anote, Envie, Guarde, Exija).\n"
        "- Sem jargao juridico sem traducao imediata. Precisa ser acionavel HOJE.\n"
        "- O ULTIMO slide tem um modelo de texto/script que o morador copia direto.\n"
        "ESTRUTURA: 1(capa) o problema que o tutorial resolve, em pergunta. "
        "2 por que a maioria nao faz (a barreira). 3 a N-1 um passo por slide, numerado, verbo de acao. "
        "ultimo o modelo/script copiavel + CTA 'Salva esse post. Voce vai precisar'."
    ),
    "opiniao": (
        "FORMATO: OPINIAO FORTE (posicao clara da MARCA sobre tema polemico).\n"
        "- A opiniao e da Sindicompany, nao de personagem ficticio. Precisa de 2-3 razoes concretas.\n"
        "- ANTECIPE o contra-argumento num slide ('sei que voce discorda, mas...') + responda.\n"
        "- NUNCA atacar pessoas. CTA obrigatoriamente de DEBATE.\n"
        "ESTRUTURA: 1(capa) a afirmacao provocativa sem contexto, MAX 6 palavras. "
        "2 o problema que motivou (dado/situacao). 3 argumento 1. 4 o contra-argumento + resposta. "
        "5 argumento 2 e consequencia pratica. ultimo CTA 'Concorda ou discorda? Comenta CONCORDO ou DISCORDO'."
    ),
}


def _gerar_copy(carrossel: dict[str, Any]) -> dict[str, Any]:
    """Gera os textos dos slides + legenda Instagram via GPT.

    Retorna dict com:
      - slides: list[{tipo, titulo, body}] — N slides conforme n_slides
      - legenda: str — legenda Instagram pronta pra colar
    """
    n_slides = int(carrossel.get("n_slides") or 6)
    titulo = (carrossel.get("titulo") or "").strip()
    tema = (carrossel.get("tema") or "").strip()
    formato = (carrossel.get("formato") or "historia_real").strip()
    briefing = (carrossel.get("briefing") or "").strip()
    objetivo = (carrossel.get("objetivo") or "").strip()

    formato_label = formato.replace("_", " ")
    instrucoes_formato = FORMATO_INSTRUCOES.get(
        formato,
        f"FORMATO: {formato_label} (estrutura livre, mantendo a voz e os 7 passos).",
    )
    casa = chr(0x1F3E1)
    is_by = _BRAND == "bysindicompany"
    obj_map_sindico = {
        "comentarios": "OBJETIVO: GERAR COMENTARIOS. CTA SEMPRE binario (SIM/NAO, "
        "CONCORDO/DISCORDO, MORADOR CERTO/SINDICO CERTO). Tema com dois lados "
        "defensaveis. Ultimo slide nomeia os dois lados. Sucesso = debate, nao alcance.",
        "salvamentos": "OBJETIVO: GERAR SALVAMENTOS. Conteudo util e confiavel, "
        "linguagem objetiva. Ancore lei/artigo/numero. CTA 'Salva esse post' / "
        "'Manda no grupo do condominio'. Nunca CTA de debate.",
        "clientes": "OBJETIVO: ATRAIR CLIENTES. Mostre o caos, a dor, o antes e o "
        "resultado com numeros reais. Nunca venda direto. A marca pode aparecer e "
        "a tagline 'Por mais lares.' pode entrar no fechamento. CTA leve "
        "('Seu condominio esta assim?', 'A gente resolve', 'Link na bio').",
        "educar": "OBJETIVO: EDUCAR MORADORES. Surpresa + identificacao. Linguagem "
        "muito acessivel, sem juridiques. Primeiro o problema conhecido, depois o "
        "que ele nao sabia. CTA depende do tema (salvar OU debate binario).",
    }
    obj_map_by = {
        "comentarios": "OBJETIVO: DEBATE ENTRE SINDICOS. Identificacao + divisao "
        "entre sindicos profissionais. CTA tipo 'SINDICO OPERACIONAL ou ESTRATEGICO', "
        "'COBRARIA ou RELEVARIA', 'DEMITIRIA ou TREINARIA'. Temas: sindico que faz "
        "tudo sozinho, excesso de WhatsApp, conselho toxico, sindrome do sindico 24h, "
        "romantizacao da sobrecarga. NUNCA dica de condominio pro morador.",
        "salvamentos": "OBJETIVO: CRESCIMENTO PROFISSIONAL DO SINDICO. Ferramenta/"
        "framework/checklist que melhora a gestao. Muito escaneavel e pratico. CTA "
        "'Salva isso', 'Todo sindico precisa guardar', 'Manda pra outro sindico'.",
        "clientes": "OBJETIVO: ATRAIR SINDICOS PRO BY SINDICOMPANY. O sindico pensa "
        "'nao quero crescer sozinho'. By como ELITE DE MERCADO/estrutura/posicionamento "
        "- nunca franquia, nunca recrutamento comum. Mostra bastidores, equipe, "
        "suporte, processos, networking. Dor: fazer tudo sozinho, refem do WhatsApp, "
        "nao conseguir crescer. CTA seletivo ('Talvez o proximo passo da sua "
        "sindicatura seja esse', 'Nem todo sindico esta pronto pra crescer assim').",
        "autoridade": "OBJETIVO: POSICIONAR AUTORIDADE NO MERCADO. Eleva o By como "
        "REFERENCIA em sindicatura profissional. Linguagem sofisticada, estrategica, "
        "menos emocional, menos humor. Temas: futuro da sindicatura, profissionalizacao "
        "do mercado, erros estruturais do setor, gestao por dados, sindico como "
        "empresario. CTA institucional ('O mercado mudou', 'A sindicatura esta "
        "evoluindo', 'Por mais sindicos preparados'). Bom com formato Manifesto/"
        "tendencia/dado que choca/visao estrategica.",
    }
    obj_map = obj_map_by if is_by else obj_map_sindico
    objetivo_bloco = (f"\n{obj_map[objetivo]}\n" if objetivo in obj_map else "")
    persona = (
        "Voce e redator do @bysindicompany — marca da Sindicompany pra SINDICOS "
        "PROFISSIONAIS, aspirantes a sindicatura e sindicos em crescimento. NAO "
        "fala com o morador. Tom aspiracional, provocativo, estrategico, "
        "empresarial. Vende estrutura, pertencimento, crescimento, posicionamento, "
        "autoridade, escala, networking, suporte. Fale como mentor que ja chegou."
        if is_by
        else "Voce e redator do @sindicompanybr (Sindicompany — sindicos "
        "profissionais SP/RJ). VOCE FALA COM O MORADOR COMUM, nao com o sindico. "
        "Escreve como pessoa inteligente corrigindo um amigo, NUNCA como empresa "
        "instruindo cliente."
    )
    assinatura = (
        "By Sindicompany. Sindicatura no proximo nivel."
        if is_by
        else f"Por mais lares. {casa}"
    )
    contexto = (
        "- Contexto: bastidores e realidade da SINDICATURA PROFISSIONAL — gestao, "
        "lideranca, mercado, carreira, estrutura. Quando falar de condominio, e "
        "sempre pelo angulo de quem GERE, nao de quem mora.\n"
        if is_by
        else "- Contexto condominial sempre (assembleia, taxa, sindico, morador, "
        "area comum, regulamento, convivencia, fachada, manutencao). Pelo menos UM "
        "slide menciona 'condominio' ou 'condominial' literal.\n"
    )
    extra_negra = (
        ", o sucesso e uma jornada, acredite no seu potencial, saia da zona de "
        "conforto, o ceu e o limite, mindset vencedor"
        if is_by
        else ""
    )

    prompt = (
        f"{persona}\n\n"
        f"{objetivo_bloco}"
        f"BRIEFING:\n"
        f"- Título interno: {titulo}\n"
        f"- Tema: {tema}\n"
        f"- Formato: {formato_label}\n"
        f"- Quantidade de slides: {n_slides}\n"
        + (f"- Contexto extra: {briefing}\n" if briefing else "")
        + f"\n{instrucoes_formato}\n\n"
        + (
            "IMPORTANTE: quando objetivo e formato apontarem direcoes "
            "diferentes, o OBJETIVO manda (CTA, tom, estrutura).\n\n"
            if objetivo_bloco
            else ""
        )
        + f"VOZ (vale pra TODOS os formatos):\n"
        f"Estrutura narrativa do post de maior alcance: CENA concreta (comeca no meio) -> "
        f"SUPOSICAO do leitor (termina com 'ne?'/'certo?') -> CONTRADICAO em <=3 palavras -> "
        f"EXPLICACAO uma ideia por frase -> FECHAMENTO paradoxal/quotavel -> CTA binario/escala. "
        f"A ASSINATURA '{assinatura}' aparece SO na legenda, nunca nos slides. "
        f"Use a estrutura de slides do FORMATO acima; a voz aqui e o tom de cada slide.\n\n"
        f"REGRAS GERAIS:\n"
        f"- Capa: o tema '{tema}' aparece literal ou em parafrase clara. Capa inteira (titulo + body) tem no max 20 palavras.\n"
        f"- Cada slide interno: tipo + titulo (3-7 palavras) + body (1-3 frases curtas, max 35 palavras).\n"
        f"- Em posts educativos (mito, dado, tutorial, lista juridica): pelo menos UMA ancora — artigo (ex: 'Codigo Civil, art. 1.336'), decisao judicial (ex: 'STJ, REsp 1.699.022/SP, 2019') OU dado com fonte nomeada e datada.\n"
        f"{contexto}\n"
        f"LEGENDA Instagram: replica a narrativa em texto corrido (4-8 linhas), hook na primeira linha, termina OBRIGATORIAMENTE com '{assinatura}' e EXATAMENTE 3 hashtags na linha seguinte.\n\n"
        f"REGRAS DE PORTUGUES E VOZ:\n"
        f"- Acentos corretos em toda palavra: voce, sindico, condominio, gestao, esta, sao.\n"
        f"- Fale 'voce', voz ativa, sujeito explicito. Frase curta: um sujeito, um predicado, acabou.\n"
        f"- PROIBIDO: gerundio (evitando, garantindo, proporcionando), travessao (—), aspas curvas (“”), emoji decorativo no slide, frases de introducao ('e importante ressaltar', 'vale destacar', 'nesse contexto'), CTA comercial em post educativo ('Fale com a Sindicompany').\n"
        f"- LISTA NEGRA: papel fundamental, momento crucial, cenario em constante evolucao, destacando a importancia, o futuro e promissor, juntos somos mais fortes, destaca-se, vibrante, no coracao de, em meio a, reflete a, simboliza a, evidencia a, um verdadeiro testemunho, desafios e oportunidades, rica diversidade, nao apenas X mas tambem Y, mergulhando em, celebrando a, fomentando o, pavimentando o caminho, estudos mostram, especialistas afirmam{extra_negra}.\n"
        f"- Use exemplos concretos (artigos de lei, REsp, numeros, acoes reais).\n\n"
        f"Devolva JSON estrito (sem markdown):\n"
        f'{{ "slides": [{{"tipo":"capa","titulo":"...","body":"..."}}, '
        f'{{"tipo":"texto","titulo":"...","body":"..."}}, ... '
        f'(total {n_slides} slides) ], "legenda":"..." }}'
    )

    fallback = {
        "slides": (
            [
                {
                    "tipo": "capa",
                    "titulo": titulo or tema or "Sindicompany",
                    "body": "",
                }
            ]
            + [
                {
                    "tipo": "texto",
                    "titulo": f"Ponto {i}",
                    "body": "Conteúdo do slide.",
                }
                for i in range(2, n_slides)
            ]
            + [
                {
                    "tipo": "cta",
                    "titulo": "O que você acha?",
                    "body": "Comenta aqui embaixo.",
                }
            ]
        )[:n_slides],
        "legenda": (
            f"{titulo or tema}\n\n"
            f"Conta nos comentários se você já passou por isso.\n\n"
            f"#sindicompany #condominio #sindico"
        ),
    }

    data = _gerar_json(prompt, fallback, expected_keys=["slides"])
    # Garante n_slides exato
    slides = list(data.get("slides") or [])[:n_slides]
    while len(slides) < n_slides:
        slides.append({"tipo": "texto", "titulo": "", "body": ""})
    data["slides"] = slides
    return data


# =============================================================================
# HTML render
# =============================================================================


FORMATO_LABELS = {
    "historia_real": "História Real",
    "lista": "Lista",
    "mito_verdade": "Mito vs Verdade",
    "antes_depois": "Antes / Depois",
    "dado_choca": "Dado que Choca",
    "tutorial": "Tutorial Rápido",
    "opiniao": "Opinião Forte",
}


def _formato_label(formato: str) -> str:
    """Devolve o rotulo amigavel do formato (ja em titulo). Se for um
    valor desconhecido, faz best-effort trocando _ por espaco."""
    f = (formato or "").strip().lower()
    return FORMATO_LABELS.get(f, f.replace("_", " ").title() or "Carrossel")


def _slide_html(
    *,
    slide_idx: int,
    total: int,
    tipo: str,
    titulo: str,
    body: str,
    formato: str = "",
    foto_capa_url: str = "",
    foto_slide_url: str = "",
    is_capa: bool = False,
) -> str:
    """Monta o HTML de um único slide pronto pra renderizar."""
    p = PALETTE
    handle = _handle()
    epilogue_url = (
        "https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;800;900&display=swap"
    )
    # Logo 5 sempre no topo de TODOS os slides (capa + internos + CTA)
    # Logo no topo de TODOS os slides. @sindicompanybr usa o slot 5;
    # @bysindicompany usa o slot 1 (LOGO 1 do bucket __by-logos).
    logo_top_slot = 1 if _BRAND == "bysindicompany" else 5
    logo_top_url = _logo_slot_data_url(logo_top_slot)
    logo_top_img = (
        f'<img class="logo-top" src="{logo_top_url}" alt="" />'
        if logo_top_url
        else ""
    )

    if is_capa:
        # Slide 1: foto na metade de cima + texto sobre overlay escuro embaixo
        bg = (
            f'<div class="hero-img" style="background-image: url(\'{foto_capa_url}\')"></div>'
            if foto_capa_url
            else f'<div class="hero-img" style="background: linear-gradient(135deg, {p["mint"]} 0%, {p["onix"]} 100%);"></div>'
        )
        body_html = f'<p class="capa-body">{_h(body)}</p>' if body else ""
        # Capa: forca Icon 2 (slot fixo em __icons/icon-2.X)
        icon_url = _icon_slot_data_url(2)
        icon_img = (
            f'<img class="brand-icon" src="{icon_url}" alt="" />' if icon_url else ""
        )
        return f"""
<!doctype html><html><head><meta charset="utf-8">
<link href="{epilogue_url}" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {SLIDE_W}px; height: {SLIDE_H}px; }}
  body {{
    font-family: 'Epilogue', sans-serif;
    background: {p["onix"]};
    color: {p["white"]};
    overflow: hidden;
    position: relative;
  }}
  .hero-img {{
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }}
  .vignette {{
    /* Vignette cinematografica — escurece sutilmente os cantos pra
       dar profundidade e foco no centro da foto. */
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(ellipse at center,
      transparent 50%,
      rgba(26,28,41,0.45) 100%);
    pointer-events: none;
  }}
  .overlay {{
    /* Texto da capa ocupa exatamente 50% (metade de baixo).
       Topo segue limpo pra a foto aparecer; metade de baixo tem
       gradiente forte pra contraste do titulo. */
    position: absolute; top: 50%; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg,
      rgba(26,28,41,0.0) 0%,
      rgba(26,28,41,0.85) 18%,
      rgba(26,28,41,0.96) 100%
    );
  }}
  .content {{
    /* Caixa de texto cobre exatamente a metade inferior do slide. */
    position: absolute;
    left: 180px; right: 180px;
    top: 50%; bottom: 0;
    padding: 100px 0 220px;
    display: flex; flex-direction: column; justify-content: center;
  }}
  /* Tamanhos calibrados pra Instagram display (1080w). Slide eh
     3072w (escala 2.844x), por isso os px CSS sao maiores que os
     px display que a marca pediu:
       capa titulo  100 display -> 285 css
       capa body     50 display -> 142 css
       capa @        28 display ->  80 css */
  .badge {{
    /* Tarja de FORMATO em destaque: caixa de contorno fino,
       fundo transparente, texto branco em caixa-alta com tracking
       largo (estilo editorial dos exemplos da marca). */
    display: inline-block;
    border: 4px solid rgba(255,255,255,0.65);
    background: transparent;
    color: {p["white"]};
    font-family: 'Epilogue', sans-serif;
    font-weight: 700;
    font-size: 64px;
    letter-spacing: 0.30em;
    text-transform: uppercase;
    padding: 28px 56px;
    border-radius: 10px;
    margin-bottom: 50px;
  }}
  .accent-line {{
    /* Barra fina mint sob o badge — assinatura editorial. */
    width: 180px; height: 6px;
    background: {p["mint"]};
    margin-bottom: 50px;
    border-radius: 3px;
  }}
  .capa-titulo {{
    font-weight: 900;
    font-size: 285px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {p["white"]};
    text-wrap: balance;
  }}
  .capa-body {{
    font-weight: 600;
    font-size: 142px;
    line-height: 1.25;
    color: {p["sand"]};
    margin-top: 48px;
    max-width: 24ch;
  }}
  .handle {{
    position: absolute;
    bottom: 80px; left: 180px;
    font-family: 'Epilogue', sans-serif;
    font-size: 80px;
    font-weight: 600;
    color: {p["mint"]};
    letter-spacing: 0.08em;
  }}
  .brand-icon {{
    /* +100% sobre o tamanho anterior (220 -> 440) pra reforcar a marca. */
    position: absolute;
    bottom: 80px; right: 180px;
    width: 440px; height: 440px;
    object-fit: contain;
  }}
  .logo-top {{
    /* Logo 5 da marca no topo de TODOS os slides, alinhado a
       esquerda (mesmo padding horizontal de .handle e .content). */
    position: absolute;
    top: 100px; left: 180px;
    width: 700px; max-height: 220px;
    object-fit: contain;
    z-index: 5;
  }}
</style></head>
<body>
  {bg}
  <div class="vignette"></div>
  <div class="overlay"></div>
  <div class="content">
    <span class="badge">{_h(_formato_label(formato))}</span>
    <div class="accent-line"></div>
    <h1 class="capa-titulo">{_h(titulo)}</h1>
    {body_html}
  </div>
  {logo_top_img}
  <div class="handle">{handle}</div>
  {icon_img}
</body></html>
"""

    # Slides internos: cada slide ganha uma cor de fundo diferente,
    # ciclando pares e impares por listas separadas. Garante que
    # consecutivos nao repitam (pares cycle 2, impares cycle 3).
    # Excecao: ULTIMO SLIDE (CTA) sempre fundo onix pra fechar o
    # carrossel com peso de marca.
    is_cta = tipo == "cta" or slide_idx == total
    if is_cta:
        bg_color = p["onix"]
        fg_color = p["white"]
        accent = p["mint"]
        accent_text = p["onix"]
    else:
        pares = [p["mint"], p["sand"]]
        impares = [p["lavender"], p["white"], p["gray_5"]]
        if slide_idx % 2 == 0:
            bg_color = pares[(slide_idx // 2 - 1) % len(pares)]
        else:
            bg_color = impares[((slide_idx - 1) // 2 - 1) % len(impares)]

        fg_color = p["onix"]
        # Accent: nas cores muito claras (white / gray_5) usa mint pra
        # destacar; nas medias (mint / sand / lavender) usa onix solido.
        if bg_color in (p["white"], p["gray_5"]):
            accent = p["mint"]
            accent_text = p["onix"]
        else:
            accent = p["onix"]
            accent_text = p["white"]

    badge_label = (
        "Sindicompany"
        if is_cta
        else f"{slide_idx} / {total}"
    )

    body_html = f'<p class="slide-body">{_h(body)}</p>' if body else ""

    # Pattern de fundo:
    # - Slides internos: pattern ciclando, tile 800x800, 10% opacity
    # - CTA (ultimo): Pattern 1 fixo, mesma regra (tile 800x800, 10%)
    if is_cta:
        pats = _patterns_data_urls()
        pattern_url = pats[0] if pats else ""
    else:
        pattern_url = _pattern_for_slide(slide_idx)
    pattern_div = '<div class="pattern-bg"></div>' if pattern_url else ""

    # Tamanhos calibrados pra Instagram (1080w display). Slide 4K
    # = 2.844x, por isso CSS px = display px * 2.844 (arredondado).
    # Internos (mid 75/47/27 display): titulo 213, body 134, footer 77.
    # CTA (mid 80/52/29 display):     titulo 228, body 148, @ 82.
    if is_cta:
        titulo_font = 228
        body_font = 148
        handle_font = 82
        pagination_font = 82
        badge_font = 82
    else:
        titulo_font = 213
        body_font = 134
        handle_font = 77
        pagination_font = 77
        badge_font = 80

    # Fundo Carrossel: usado como icon-bg grande nos slides internos.
    # CTA NAO recebe — fica so com onix + pattern.
    icon_url_internal = "" if is_cta else _icon_for_slide(slide_idx)
    icon_bg_div = (
        '<div class="icon-bg"></div>' if icon_url_internal else ""
    )
    # Foto opcional por slide (sobrescreve cor de fundo + pattern
    # quando a editora subiu uma na Etapa 3).
    slide_foto_div = (
        '<div class="slide-foto"></div><div class="slide-foto-overlay"></div>'
        if foto_slide_url
        else ""
    )
    # Brand-icon do canto inferior direito: SO aparece em CTA (Icon 6
    # em __icons/). Slides internos comuns ficam sem corner — Fundo
    # Carrossel eh exclusivo da camada de fundo (.icon-bg).
    corner_url = _icon_slot_data_url(6) if is_cta else ""
    icon_img_internal = (
        f'<img class="brand-icon" src="{corner_url}" alt="" />'
        if corner_url
        else ""
    )
    # Posicao do fundo carrossel: rente a borda direita nos pares
    # (2, 4, 6) e rente a borda esquerda nos impares (3, 5, 7).
    # Imagem mantem a cor original — sem filter pra preservar a paleta
    # subida no admin Fundo Carrossel.
    icon_bleed_side = "right" if slide_idx % 2 == 0 else "left"
    # Numero editorial vai no lado OPOSTO pra equilibrar a massa visual.
    icon_bleed_side_oposto = "left" if slide_idx % 2 == 0 else "right"

    return f"""
<!doctype html><html><head><meta charset="utf-8">
<link href="{epilogue_url}" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{ width: {SLIDE_W}px; height: {SLIDE_H}px; }}
  body {{
    font-family: 'Epilogue', sans-serif;
    background: {bg_color};
    color: {fg_color};
    overflow: hidden;
    position: relative;
  }}
  .pattern-bg {{
    /* Pattern da marca em 10% como textura de fundo nos slides internos.
       Uma unica instancia que cobre todo o slide (cover preserva aspect
       ratio do arquivo, recortando bordas se preciso). Sem repeat, sem
       distorcao. */
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('{pattern_url}');
    background-repeat: no-repeat;
    background-position: center center;
    background-size: cover;
    opacity: 0.10;
    pointer-events: none;
  }}
  .frame-corner {{
    /* Molduras editoriais finas no canto superior direito —
       substitui a bola antiga, vibe revista premium. */
    position: absolute;
    top: 180px; right: 180px;
    width: 180px; height: 180px;
    border-top: 6px solid {accent};
    border-right: 6px solid {accent};
    opacity: 0.55;
  }}
  .bignum {{
    /* Numero gigante do slide como elemento editorial — opacidade
       baixa pra nao competir com texto principal. Usa o accent pra
       reforco de marca. Posicionado oposto ao Fundo Carrossel
       (pares: esquerda; impares: direita) pra equilibrar massa. */
    position: absolute;
    bottom: 200px;
    {icon_bleed_side_oposto}: 180px;
    font-family: 'Epilogue', sans-serif;
    font-size: 720px;
    font-weight: 900;
    line-height: 0.85;
    color: {accent};
    opacity: 0.10;
    letter-spacing: -0.04em;
    pointer-events: none;
  }}
  .content {{
    position: absolute;
    left: 180px; right: 180px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
  }}
  .badge {{
    display: inline-block;
    background: {accent};
    color: {accent_text};
    font-family: 'Epilogue', sans-serif;
    font-weight: 800;
    font-size: {badge_font}px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 22px 40px;
    border-radius: 10px;
    margin-bottom: 50px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.12);
  }}
  .accent-line {{
    /* Barra fina abaixo do badge — assinatura editorial. */
    width: 180px; height: 6px;
    background: {accent};
    margin-bottom: 50px;
    border-radius: 3px;
  }}
  .slide-titulo {{
    font-weight: 800;
    font-size: {titulo_font}px;
    line-height: 0.95;
    letter-spacing: -0.025em;
    color: {fg_color};
    margin-bottom: 56px;
    text-wrap: balance;
    max-width: 18ch;
  }}
  .slide-body {{
    font-weight: 500;
    font-size: {body_font}px;
    line-height: 1.35;
    color: {fg_color};
    opacity: 0.88;
    max-width: 22ch;
  }}
  /* Para palavras destacadas dentro do body — 55-70 display
     (mid 62 -> 176 css). Use <span class="destaque">…</span>. */
  .destaque {{
    font-weight: 800;
    font-size: 176px;
    line-height: 1.1;
    color: {accent};
  }}
  .handle {{
    position: absolute;
    bottom: 120px; left: 180px;
    font-family: 'Epilogue', sans-serif;
    font-size: {handle_font}px;
    font-weight: 600;
    color: {accent};
    letter-spacing: 0.08em;
  }}
  .brand-icon {{
    /* Icone da marca no canto inferior direito de cada slide.
       Slot 1 em __icons/icon-1 — fica vazio se nao houver. */
    position: absolute;
    bottom: 80px; right: 180px;
    width: 440px; height: 440px;
    object-fit: contain;
  }}
  .logo-top {{
    /* Logo 5 da marca no topo de TODOS os slides, alinhado a
       esquerda (mesmo padding horizontal de .handle e .content). */
    position: absolute;
    top: 100px; left: 180px;
    width: 700px; max-height: 220px;
    object-fit: contain;
    z-index: 5;
  }}
  .slide-foto {{
    /* Foto opcional por slide (sobrescreve cor de fundo + pattern).
       Cobre o slide inteiro. Renderiza so quando a editora subiu uma
       foto pro slide na Etapa 3. */
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('{foto_slide_url}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }}
  .slide-foto-overlay {{
    /* Gradiente escuro pra texto ficar legivel sobre a foto. */
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background: linear-gradient(180deg,
      rgba(26,28,41,0.30) 0%,
      rgba(26,28,41,0.55) 60%,
      rgba(26,28,41,0.85) 100%
    );
  }}
  .icon-bg {{
    /* Imagem 'Fundo Carrossel': 90% da largura do slide (~2765px),
       grudada no canto INFERIOR direito ou esquerdo (pares -> direita,
       impares -> esquerda). 0mm da borda lateral E 0mm da borda
       inferior. Mantem a cor original do arquivo (sem CSS filter).
       Opacity 0.15 — suave o suficiente pra nao competir com o texto. */
    position: absolute;
    bottom: 0;
    {icon_bleed_side}: 0;
    width: 2765px; height: 2765px;
    background-image: url('{icon_url_internal}');
    background-repeat: no-repeat;
    background-position: {icon_bleed_side} bottom;
    background-size: contain;
    opacity: 0.15;
    pointer-events: none;
  }}
</style></head>
<body>
  {pattern_div}
  {slide_foto_div}
  {icon_bg_div}
  <div class="frame-corner"></div>
  <div class="bignum">{slide_idx:02d}</div>
  <div class="content">
    <span class="badge">{_h(badge_label)}</span>
    <div class="accent-line"></div>
    <h2 class="slide-titulo">{_h(titulo)}</h2>
    {body_html}
  </div>
  {logo_top_img}
  <div class="handle">{handle}</div>
  {icon_img_internal}
</body></html>
"""


def _h(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# =============================================================================
# Playwright render
# =============================================================================


def _render_slide_png(html: str) -> bytes:
    """Renderiza HTML em PNG 3072×3839 via Playwright sync."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": SLIDE_W, "height": SLIDE_H},
                device_scale_factor=1,
            )
            page = ctx.new_page()
            page.set_content(html, wait_until="networkidle")
            png = page.screenshot(
                full_page=False,
                type="png",
                clip={"x": 0, "y": 0, "width": SLIDE_W, "height": SLIDE_H},
            )
            return png
        finally:
            browser.close()


# =============================================================================
# Pipeline
# =============================================================================


def gerar_carrossel(carrossel_id: str) -> int:
    """Pipeline completo. Retorna 0 se OK, 1 se falhou."""
    global _BRAND
    print(f"[carrossel] iniciando geração de {carrossel_id}", flush=True)
    try:
        carrossel = _fetch_carrossel(carrossel_id)
        if not carrossel:
            print(f"[carrossel] {carrossel_id} não encontrado", flush=True)
            return 1

        # Define a marca ANTES de qualquer lookup de asset (buckets,
        # handle, logo). Default sindicompanybr pra registros legacy.
        b = (carrossel.get("brand") or "sindicompanybr").strip().lower()
        _BRAND = "bysindicompany" if b == "bysindicompany" else "sindicompanybr"
        print(f"[carrossel] brand={_BRAND}", flush=True)

        _update_carrossel(carrossel_id, {"status": "em_producao", "erro_mensagem": None})

        # 1. Copy: prefere a copy escolhida pela editora no wizard.
        #    Cai no _gerar_copy só pra registros legacy sem copy_options.
        copy_options = carrossel.get("copy_options") or []
        copy_selected = carrossel.get("copy_selected")
        chosen = None
        if isinstance(copy_options, list) and copy_options:
            idx = copy_selected if isinstance(copy_selected, int) else 0
            if 0 <= idx < len(copy_options):
                chosen = copy_options[idx]
        if chosen and isinstance(chosen, dict) and chosen.get("slides"):
            slides = list(chosen.get("slides") or [])
            legenda = chosen.get("legenda") or ""
            print(
                f"[carrossel] usando copy salva (idx={copy_selected}): {len(slides)} slides",
                flush=True,
            )
        else:
            copy = _gerar_copy(carrossel)
            slides = copy["slides"]
            legenda = copy.get("legenda") or ""
            print(f"[carrossel] copy gerado pelo engine: {len(slides)} slides", flush=True)

        # 2. Render + upload de cada slide
        n_total = len(slides)
        png_urls: list[str] = []
        png_bytes_list: list[bytes] = []
        foto_capa = (carrossel.get("foto_capa_url") or "").strip()
        slide_fotos = carrossel.get("slide_fotos") or []

        for i, s in enumerate(slides, start=1):
            # slide_fotos eh indexado 0-based: posicao 0 = slide 1 (capa),
            # posicao 1 = slide 2, posicao 2 = slide 3, etc. Capa usa
            # foto_capa_url separadamente, entao aqui so importa pros
            # internos + CTA.
            foto_slide = ""
            if 0 <= (i - 1) < len(slide_fotos):
                foto_slide = (slide_fotos[i - 1] or "").strip() if slide_fotos[i - 1] else ""

            html = _slide_html(
                slide_idx=i,
                total=n_total,
                tipo=str(s.get("tipo") or "texto"),
                titulo=str(s.get("titulo") or ""),
                body=str(s.get("body") or ""),
                formato=str(carrossel.get("formato") or ""),
                foto_capa_url=foto_capa,
                foto_slide_url=foto_slide,
                is_capa=(i == 1),
            )
            print(f"[carrossel] renderizando slide {i}/{n_total}…", flush=True)
            png = _render_slide_png(html)
            url = _upload_png(carrossel_id, i, png)
            png_urls.append(url)
            png_bytes_list.append(png)
            print(f"[carrossel] slide {i} salvo: {url[:80]}", flush=True)

        # 2b. Empacota todos os PNGs num ZIP pra download de uma vez
        zip_url = ""
        try:
            zip_url = _upload_slides_zip(carrossel_id, png_bytes_list)
            print(f"[carrossel] zip salvo: {zip_url[:80]}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[carrossel] falha ao subir zip (segue sem): {e}", flush=True)

        # 3. Atualiza registro. zip_url eh coluna nova (migration
        # 20260524) — se ainda nao foi rodada no Supabase a chamada
        # quebra com PGRST204. Tentamos com o campo; se cair com erro
        # de coluna ausente, fazemos retry sem ele.
        from datetime import datetime, timezone
        base_fields = {
            "png_paths": png_urls,
            "legenda": legenda,
            "status": "publicada",
            "gerado_em": datetime.now(timezone.utc).isoformat(),
            "erro_mensagem": None,
        }
        try:
            _update_carrossel(
                carrossel_id, {**base_fields, "zip_url": zip_url or None}
            )
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "zip_url" in msg or "PGRST204" in msg:
                print(
                    f"[carrossel] coluna zip_url ausente (rode migration "
                    f"20260524). Salvando sem zip_url. Detalhe: {msg[:120]}",
                    flush=True,
                )
                _update_carrossel(carrossel_id, base_fields)
            else:
                raise
        print(f"[carrossel] OK — {n_total} slides + legenda", flush=True)
        return 0

    except Exception as e:  # noqa: BLE001
        tb = traceback.format_exc()
        print(f"[carrossel] ERROR: {e}\n{tb}", flush=True)
        try:
            _update_carrossel(carrossel_id, {
                "status": "erro",
                "erro_mensagem": str(e)[:500],
            })
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("uso: python -m api.carrossel_generate <carrossel_id>", file=sys.stderr)
        sys.exit(2)
    sys.exit(gerar_carrossel(sys.argv[1]))
