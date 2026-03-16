"""Tests for normalization utilities."""

from src.normalization.tournament_normalizer import (
    normalize_age_class,
    normalize_entry_fee,
    normalize_gender,
)
from src.normalization.deduplication import _name_similarity


class TestNormalization:
    def test_age_class(self):
        assert normalize_age_class("Erwachsene") == "adults"
        assert normalize_age_class("Jugend") == "youth"
        assert normalize_age_class("AK 50") == "50+"
        assert normalize_age_class(None) is None

    def test_gender(self):
        assert normalize_gender("Damen") == "female"
        assert normalize_gender("Herren") == "male"
        assert normalize_gender("Mannschaft") == "team"

    def test_entry_fee(self):
        assert normalize_entry_fee("30,- €") == 30.0
        assert normalize_entry_fee("45,50 €") == 45.50
        assert normalize_entry_fee("€ 30") == 30.0
        assert normalize_entry_fee(None) is None


class TestDeduplication:
    def test_similar_names(self):
        assert _name_similarity(
            "Bayerische Meisterschaft Herren",
            "Bayerische Meisterschaft Herren 2026",
        ) > 0.6

    def test_different_names(self):
        assert _name_similarity(
            "Clubmeisterschaft Starnberg",
            "Bayerische Jugend Meisterschaft",
        ) < 0.6
