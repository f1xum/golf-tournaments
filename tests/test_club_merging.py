"""Tests for duplicate-club detection.

The risk in scripts/merge_duplicate_clubs.py is not missing a duplicate — that
just leaves things as they are today. It is a *false* merge, which hides a real
club behind a redirect to a different club. These tests pin the cases that
actually appeared in the live Bavarian data when the matcher was too loose.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from merge_duplicate_clubs import (  # noqa: E402
    distinctive_tokens,
    group_duplicates,
    host_key,
    names_the_club,
    normalize_name,
    pick_keeper,
    same_club,
)


def club(name, **kw):
    base = {
        "id": kw.pop("id", name),
        "name": name,
        "city": None,
        "pccaddie_id": None,
        "latitude": None,
        "longitude": None,
        "website": None,
    }
    base.update(kw)
    return base


class TestNormalizeName:
    def test_legal_suffix_is_ignored(self):
        assert normalize_name("GC Am Reichswald") == normalize_name("GC Am Reichswald e. V.")

    def test_golf_club_spellings_collapse(self):
        assert normalize_name("Golf-Club Feldafing e.V.") == normalize_name("Golfclub Feldafing e. V.")

    def test_umlauts_fold(self):
        assert normalize_name("GC Schloß Mainsondheim") == normalize_name("GC Schloss Mainsondheim")

    def test_word_order_does_not_matter(self):
        # "Tegernseer Golf-Club Bad Wiessee" vs "Tegernseer GC Bad Wiessee"
        assert normalize_name("Tegernseer Golf-Club Bad Wiessee") == normalize_name(
            "Tegernseer GC Bad Wiessee"
        )

    def test_different_clubs_stay_different(self):
        assert normalize_name("Golfclub Ebersberg e.V.") != normalize_name("Golfclub Erlangen e.V.")


class TestDistinctiveTokens:
    def test_generic_golf_words_are_dropped(self):
        assert distinctive_tokens("Porsche Golf Course") == {"porsche"}
        assert distinctive_tokens("Beckenbauer Golf Course") == {"beckenbauer"}


class TestSameClub:
    def test_name_variant_in_same_town_merges(self):
        a = club("GC Am Reichswald", city="Nürnberg")
        b = club("GC Am Reichswald e. V.", city="Nürnberg")
        assert same_club(a, b)

    def test_same_name_different_town_does_not_merge(self):
        a = club("Golfclub Schloßberg", city="Reisbach")
        b = club("Golfclub Schloßberg", city="Hamburg")
        assert not same_club(a, b)

    def test_shared_pccaddie_id_needs_corroboration(self):
        # HVB-Club München books through Schloßberg's PC CADDIE calendar, so
        # the ids match — but they are two different clubs in two towns.
        a = club("HVB-Club GC e.V.", city="München", pccaddie_id="0498818")
        b = club("Golfclub Schloßberg", city="Reisbach", pccaddie_id="0498818")
        assert not same_club(a, b)

    def test_shared_pccaddie_id_in_same_town_merges(self):
        a = club("Golfclub Schloßberg", city="Reisbach", pccaddie_id="0498818")
        b = club("Golfclub Schloßberg e. V.", city="Reisbach", pccaddie_id="0498818")
        assert same_club(a, b)

    def test_shared_coordinates_alone_do_not_merge(self):
        # Two distinct courses at the same Bad Griesbach resort.
        a = club("Porsche Golf Course", city="Rotthalmünster", latitude=48.4, longitude=13.2)
        b = club("Beckenbauer Golf Course", city="Rotthalmünster", latitude=48.4, longitude=13.2)
        assert not same_club(a, b)

    def test_shared_coordinates_plus_shared_name_token_merges(self):
        a = club("Reversible Golf Patting", city="Patting", latitude=47.9, longitude=12.5)
        b = club("Golfanlage Patting - Hochriesblick", city="Patting", latitude=47.9, longitude=12.5)
        assert same_club(a, b)


class TestHostKey:
    def test_www_and_scheme_are_stripped(self):
        assert host_key(club("A", website="https://www.example.de/turniere")) == "example.de"

    def test_platform_hosts_are_not_identity(self):
        # Hundreds of unrelated clubs sit on pccaddie.net.
        assert host_key(club("A", website="https://www.pccaddie.net/clubs/0498847")) is None


class TestNamesTheClub:
    def test_spaced_dash_marks_a_course_variant(self):
        assert not names_the_club(club("Münchner Golf Eschenried - Platz Eschenhof"))
        assert not names_the_club(club("Golfclub Eschenried e.V. – Gröbenbach"))

    def test_unspaced_hyphen_is_part_of_the_name(self):
        assert names_the_club(club("GC Lindau-Bad Schachen"))
        assert names_the_club(club("Golf-Club Feldafing e.V."))


class TestGrouping:
    def test_transitive_group(self):
        rows = [
            club("GC Lindau-Bad Schachen", city="Lindau", id="a"),
            club("Golf-Club Lindau-Bad Schachen e.V.", city="Lindau", id="b"),
            club("GC Lindau-Bad Schachen e. V.", city="Lindau", id="c"),
        ]
        groups = group_duplicates(rows)
        assert len(groups) == 1
        assert {c["id"] for c in groups[0]} == {"a", "b", "c"}

    def test_unrelated_clubs_in_one_town_form_no_group(self):
        # Iffeldorf really does host two separate clubs.
        rows = [club("Golfclub Iffeldorf e.V.", city="Iffeldorf", id="a"),
                club("St. Eurach Land- und Golfclub e. V.", city="Iffeldorf", id="b")]
        assert group_duplicates(rows) == []

    def test_differently_named_rows_on_one_pccaddie_calendar_merge(self):
        # "Golfclub Hof e.V." and "Golfclub Haidt e.V." look like two clubs but
        # share PC CADDIE id 0498834 and sit 4 m apart — GC Hof plays at Haidt.
        rows = [club("Golfclub Hof e.V.", city="Gattendorf", pccaddie_id="0498834",
                     latitude=50.3447172, longitude=11.9605834, id="a"),
                club("Golfclub Haidt e.V.", city="Gattendorf Haidt", pccaddie_id="0498834",
                     latitude=50.3447189, longitude=11.9605284, id="b")]
        groups = group_duplicates(rows)
        assert len(groups) == 1

    def test_own_domain_plus_shared_token_groups_differently_named_rows(self):
        site = "https://www.muenchner-golf-eschenried.de"
        rows = [
            club("Münchner Golf Eschenried", city="Eschenried", website=site, id="a"),
            club("Golfclub Eschenried e.V. – Gröbenbach", city="Eschenried", website=site, id="b"),
            club("Golf Eschenried - Golfpark Gut Häusern", city="Markt Indersdorf",
                 website=site, id="c"),
        ]
        groups = group_duplicates(rows)
        assert len(groups) == 1
        assert {c["id"] for c in groups[0]} == {"a", "b", "c"}

    def test_shared_domain_alone_does_not_merge_resort_courses(self):
        # Bad Griesbach's courses all live on quellness-golf.com.
        site = "https://www.quellness-golf.com/media/pdf/Turnierkalender.pdf"
        rows = [club("Porsche Golf Course", city="Rotthalmünster", website=site, id="a"),
                club("Beckenbauer Golf Course", city="Rotthalmünster", website=site, id="b")]
        assert group_duplicates(rows) == []

    def test_keeper_prefers_the_club_name_over_a_course_name(self):
        from collections import Counter

        rows = [club("Golfclub Eschenried e.V. – Gröbenbach", city="Eschenried", id="a"),
                club("Münchner Golf Eschenried", city="Eschenried", id="b")]
        # Nothing has tournaments, so the name tiebreak decides the page title.
        assert pick_keeper(rows, Counter(), Counter())["id"] == "b"

    def test_keeper_is_the_row_with_the_most_upcoming_tournaments(self):
        from collections import Counter

        a = club("GC Höslwang im Chiemgau", city="Höslwang", id="a")
        b = club("GC Höslwang im Chiemgau e.V.", city="Höslwang", id="b")
        keeper = pick_keeper([a, b], Counter({"b": 35}), Counter({"b": 120}))
        assert keeper["id"] == "b"
