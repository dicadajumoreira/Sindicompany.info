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
        gdown.download_folder(
            url=full_url,
            output=str(dest),
            quiet=True,
            use_cookies=False,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[drive] download falhou: {type(e).__name__}: {e}", flush=True)
        return []

    # gdown cria um diretório com o nome da pasta raiz dentro de dest.
    # Procuramos o primeiro subdir e listamos seus filhos como subpastas.
    root_dirs = [p for p in dest.iterdir() if p.is_dir()]
    if not root_dirs:
        print(f"[drive] nada baixado em {dest}", flush=True)
        return []

    root = root_dirs[0]
    out: list[dict[str, Any]] = []
    for sub in sorted(root.iterdir()):
        if not sub.is_dir():
            continue
        imagens = sorted(
            p for p in sub.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS
        )
        if not imagens:
            print(f"[drive] subpasta '{sub.name}' sem imagens", flush=True)
            continue
        out.append(
            {
                "nome_pasta": sub.name,
                "foto_path": str(imagens[0].absolute()),
            }
        )

    print(f"[drive] {len(out)} subpastas com fotos: {[o['nome_pasta'] for o in out]}", flush=True)
    return out


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
                return str(imgs[0].absolute())
    return None
