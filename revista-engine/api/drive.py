"""
Integração Google Drive — baixa pastas compartilhadas pra usar
fotos nas seções da revista.

A editora cola um link público de pasta do Drive no form (ex:
"Link da pasta de fotos de manutenção"). A engine baixa a pasta
inteira pra um diretório temporário e organiza as fotos por
subpasta (cada subpasta vira um card de manutenção).

Requer que a pasta esteja com permissão "Qualquer pessoa com o
link" no Drive. Não usa OAuth nem service account.
"""

from __future__ import annotations

import re
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def extract_folder_id(url: str) -> str | None:
    """Extrai o ID da pasta de uma URL do Google Drive.

    Formatos aceitos:
      https://drive.google.com/drive/folders/<ID>
      https://drive.google.com/drive/folders/<ID>?usp=sharing
      https://drive.google.com/open?id=<ID>
    """
    if not url:
        return None
    m = re.search(r"/folders/([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    if m:
        return m.group(1)
    return None


def baixar_pastas_manutencao(drive_url: str, dest: Path) -> list[dict[str, Any]]:
    """Baixa pasta de manutenções do Drive.

    Retorna uma lista [{nome_pasta, foto_path}, ...] com 1 foto por
    subpasta. Se a subpasta tem múltiplas fotos, pega a primeira.
    """
    if not drive_url:
        return []

    folder_id = extract_folder_id(drive_url)
    if not folder_id:
        print(f"[drive] URL inválida (sem folder_id): {drive_url}", flush=True)
        return []

    dest.mkdir(parents=True, exist_ok=True)
    full_url = f"https://drive.google.com/drive/folders/{folder_id}"
    print(f"[drive] baixando pasta {folder_id}", flush=True)

    try:
        import gdown  # noqa: PLC0415
    except ImportError:
        print("[drive] gdown não instalado", flush=True)
        return []

    try:
        # download_folder respeita estrutura de subpastas
        # remaining_ok=True permite passar do limite default de 50 arquivos
        gdown.download_folder(
            url=full_url,
            output=str(dest),
            quiet=False,
            use_cookies=False,
            remaining_ok=True,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[drive] download falhou: {type(e).__name__}: {e}", flush=True)
        return []

    # Diagnóstico: lista o que veio
    todos = list(dest.rglob("*"))
    arquivos = [p for p in todos if p.is_file()]
    pastas = [p for p in todos if p.is_dir()]
    print(f"[drive] baixados {len(arquivos)} arquivos em {len(pastas)} pastas/subpastas", flush=True)
    for p in pastas[:10]:
        print(f"[drive]   pasta: {p.relative_to(dest)}", flush=True)

    # gdown cria um diretório com o nome da pasta raiz dentro de dest.
    # Procuramos o primeiro subdir e listamos seus filhos como subpastas.
    root_dirs = [p for p in dest.iterdir() if p.is_dir()]
    if not root_dirs:
        print(f"[drive] nada baixado em {dest}", flush=True)
        return []

    root = root_dirs[0]
    out: list[dict[str, Any]] = []

    # Caso 1: tem subpastas dentro de root (estrutura esperada)
    subpastas = [p for p in sorted(root.iterdir()) if p.is_dir()]
    if subpastas:
        for sub in subpastas:
            imagens = sorted(
                p for p in sub.rglob("*")
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            )
            if not imagens:
                print(f"[drive] subpasta '{sub.name}' sem imagens", flush=True)
                continue
            out.append(
                {
                    "nome_pasta": sub.name,
                    "fotos": [_path_to_url(p) for p in imagens],
                }
            )
        print(f"[drive] {len(out)} subpastas com fotos: {[o['nome_pasta'] for o in out]}", flush=True)
        return out

    # Caso 2: só fotos diretamente na root (sem subpastas) — usa filename como título
    imagens_diretas = sorted(
        p for p in root.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )
    if imagens_diretas:
        for img in imagens_diretas:
            out.append(
                {
                    "nome_pasta": img.stem,
                    "fotos": [_path_to_url(img)],
                }
            )
        print(f"[drive] {len(out)} fotos diretas (sem subpastas): {[o['nome_pasta'] for o in out[:5]]}...", flush=True)
        return out

    print(f"[drive] root '{root.name}' sem subpastas e sem imagens diretas", flush=True)
    return out


def _path_to_url(p: Path) -> str:
    """Converte path absoluto em file:// URL com encoding correto.
    Necessário pra paths com espaços/acentos (ex: 'Pintura da fachada/foto.jpg')
    funcionarem como background-image url() no WeasyPrint."""
    return p.absolute().as_uri()


def _coletar_pastas(root: Path) -> list[dict[str, Any]]:
    """Dado um diretório com (sub)pastas + fotos, devolve a lista no
    formato que a S3 (Nosso Condomínio) espera. Mesma lógica usada
    pra Drive: subpastas → cards; sem subpastas → cada foto vira card."""
    out: list[dict[str, Any]] = []
    subpastas = [p for p in sorted(root.iterdir()) if p.is_dir()]
    if subpastas:
        for sub in subpastas:
            imagens = sorted(
                p for p in sub.rglob("*")
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            )
            if not imagens:
                print(f"[zip] subpasta '{sub.name}' sem imagens", flush=True)
                continue
            out.append(
                {
                    "nome_pasta": sub.name,
                    "fotos": [_path_to_url(p) for p in imagens],
                }
            )
        return out

    imagens_diretas = sorted(
        p for p in root.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )
    for img in imagens_diretas:
        out.append(
            {"nome_pasta": img.stem, "fotos": [_path_to_url(img)]}
        )
    return out


def baixar_pastas_manutencao_zip(zip_url: str, dest: Path) -> list[dict[str, Any]]:
    """Baixa um ZIP via HTTP, descompacta e devolve a mesma estrutura
    de baixar_pastas_manutencao(). Cada subpasta dentro do ZIP vira um
    card de manutenção, usando o nome da pasta como título."""
    if not zip_url:
        return []

    dest.mkdir(parents=True, exist_ok=True)
    zip_path = dest / "manutencao.zip"

    try:
        req = urllib.request.Request(zip_url, headers={"User-Agent": "revista-engine/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            zip_path.write_bytes(resp.read())
        print(f"[zip] baixado {zip_path.stat().st_size} bytes de {zip_url[:80]}...", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"[zip] download falhou: {type(e).__name__}: {e}", flush=True)
        return []

    extract_dir = dest / "extracted"
    extract_dir.mkdir(exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path) as zf:
            # Filtra entries: ignora arquivos de macOS (__MACOSX, .DS_Store)
            members = [
                m for m in zf.namelist()
                if not m.startswith("__MACOSX/")
                and not m.endswith("/.DS_Store")
                and not m.endswith("/Thumbs.db")
            ]
            zf.extractall(extract_dir, members=members)
        print(f"[zip] extraídos {len(members)} membros em {extract_dir}", flush=True)
    except zipfile.BadZipFile as e:
        print(f"[zip] arquivo não é um ZIP válido: {e}", flush=True)
        return []
    except Exception as e:  # noqa: BLE001
        print(f"[zip] extração falhou: {type(e).__name__}: {e}", flush=True)
        return []

    # Se o ZIP encapsulou tudo numa pasta-mãe (caso típico do macOS),
    # desce um nível.
    entries = [p for p in extract_dir.iterdir() if not p.name.startswith(".")]
    if len(entries) == 1 and entries[0].is_dir():
        root = entries[0]
    else:
        root = extract_dir

    pastas = _coletar_pastas(root)
    print(f"[zip] {len(pastas)} card(s): {[p['nome_pasta'] for p in pastas[:8]]}", flush=True)
    return pastas


def baixar_capa_manutencao_zip(zip_url: str, dest: Path) -> str | None:
    """Pega a primeira imagem na raiz do ZIP já extraído (capa do caderno)."""
    extract_dir = dest / "extracted"
    if not extract_dir.exists():
        return None
    entries = [p for p in extract_dir.iterdir() if not p.name.startswith(".")]
    root = entries[0] if (len(entries) == 1 and entries[0].is_dir()) else extract_dir
    imgs = sorted(
        p for p in root.iterdir()
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )
    return _path_to_url(imgs[0]) if imgs else None


def baixar_capa_manutencao(drive_url: str, dest: Path) -> str | None:
    """Pega a primeira imagem da raiz da pasta (foto de capa do caderno).

    Útil pra abertura da seção 'Nosso Condomínio'. Se não houver
    imagem na raiz, retorna None.
    """
    folder_id = extract_folder_id(drive_url)
    if not folder_id:
        return None

    # Reaproveita o download já feito por baixar_pastas_manutencao se dest
    # já existe e tem conteúdo. Senão, baixa só a raiz.
    if dest.exists() and any(dest.iterdir()):
        root_dirs = [p for p in dest.iterdir() if p.is_dir()]
        if root_dirs:
            root = root_dirs[0]
            imgs = sorted(
                p for p in root.iterdir()
                if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
            )
            if imgs:
                return _path_to_url(imgs[0])
    return None
