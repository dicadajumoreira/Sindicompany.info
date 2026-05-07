"""Camada de seções: cada uma das 16 partes da revista."""

from .back_cover import BackCover
from .base import A4, MOBILE, PageDimensions, Section
from .colophon import Colophon
from .cover import Cover
from .cultural_agenda import CulturalAgenda
from .horoscope import Horoscope
from .industry_facts import IndustryFacts
from .letter import Letter
from .news import News
from .our_numbers import OurNumbers
from .recipe import Recipe
from .tips import Tips
from .warnings import Warnings

__all__ = [
    "Section",
    "PageDimensions",
    "A4",
    "MOBILE",
    "BackCover",
    "Colophon",
    "Cover",
    "CulturalAgenda",
    "Horoscope",
    "IndustryFacts",
    "Letter",
    "News",
    "OurNumbers",
    "Recipe",
    "Tips",
    "Warnings",
]
