"""Camada de seções: cada uma das 16 partes da revista."""

from .back_cover import BackCover
from .base import A4, MOBILE, PageDimensions, Section

__all__ = [
    "Section",
    "PageDimensions",
    "A4",
    "MOBILE",
    "BackCover",
]
