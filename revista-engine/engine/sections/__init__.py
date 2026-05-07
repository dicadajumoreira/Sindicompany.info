"""Camada de seções: cada uma das 16 partes da revista."""

from .back_cover import BackCover
from .base import A4, MOBILE, PageDimensions, Section
from .cover import Cover
from .letter import Letter
from .our_numbers import OurNumbers
from .warnings import Warnings

__all__ = [
    "Section",
    "PageDimensions",
    "A4",
    "MOBILE",
    "BackCover",
    "Cover",
    "Letter",
    "OurNumbers",
    "Warnings",
]
