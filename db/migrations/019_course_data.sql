-- Rich per-club course data: description, architect, scorecard, photos, flyovers.
-- Pilot scope: populated for Riedhof only. UI renders conditionally so other
-- clubs are unaffected until they get their own data.
--
-- Shape stored in `course_data` JSONB (all keys optional):
--   {
--     "description": "text describing the course",
--     "architect": "Heinz Fehring",
--     "year_designed": 1985,
--     "course_type": "Parkland",
--     "tees": [
--       { "color": "Schwarz", "gender": "Herren",
--         "course_rating": 73.5, "slope": 142, "par": 72, "length_m": 6847 }
--     ],
--     "photos": ["https://.../photo1.jpg", ...],
--     "holes": [
--       { "number": 1, "video_url": "https://.../bahn-01.mp4", "thumbnail_url": null }
--     ],
--     "source_url": "https://www.riedhof.de/platz/",
--     "updated_at": "2026-05-25"
--   }

ALTER TABLE golf_clubs ADD COLUMN IF NOT EXISTS course_data JSONB;

-- Seed Riedhof (matched by pccaddie_id since IDs are stable across environments)
UPDATE golf_clubs
SET course_data = $JSON$
{
  "description": "18-Loch-Meisterschaftsplatz, harmonisch in die natürliche Landschaft des Voralpenlands eingebettet. Variable Abschläge und Fahnenpositionen erlauben sowohl entspannte Runden mit der Familie als auch anspruchsvolles, sportliches Spiel.",
  "architect": "Heinz Fehring",
  "course_type": "Parkland",
  "tees": [
    { "color": "Schwarz", "gender": "Herren", "course_rating": 73.5, "slope": 142, "par": 72, "length_m": 6847 },
    { "color": "Weiß",    "gender": "Herren", "course_rating": 71.2, "slope": 135, "par": 72, "length_m": 6406 },
    { "color": "Gelb",    "gender": "Herren", "course_rating": 69.1, "slope": 128, "par": 72, "length_m": 6006 },
    { "color": "Blau",    "gender": "Herren", "course_rating": 66.8, "slope": 120, "par": 72, "length_m": 5606 },
    { "color": "Rot",     "gender": "Damen",  "course_rating": 72.4, "slope": 138, "par": 72, "length_m": 6507 }
  ],
  "photos": [
    "https://www.riedhof.de/files/lightbox_platz_a-49.jpg",
    "https://www.riedhof.de/files/lightbox_platz_01_a-50.jpg",
    "https://www.riedhof.de/files/lightbox_platz_02_a-51.jpg",
    "https://www.riedhof.de/files/lightbox_platz_03_a-52.jpg",
    "https://www.riedhof.de/files/lightbox_platz_04_a-53.jpg",
    "https://www.riedhof.de/files/lightbox_platz_05_a-54.jpg",
    "https://www.riedhof.de/files/lightbox_platz_06_a-55.jpg"
  ],
  "holes": [
    { "number": 1,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-01_protipp_lq_a-745.mp4" },
    { "number": 2,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-02_protipp_lq_a-747.mp4" },
    { "number": 3,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-03_protipp_lq_a-748.mp4" },
    { "number": 4,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-04_protipp_lq_a-750.mp4" },
    { "number": 5,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-05_protipp_lq_a-749.mp4" },
    { "number": 6,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-06_protipp_lq_a-752.mp4" },
    { "number": 7,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-07_protipp_lq_a-751.mp4" },
    { "number": 8,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-08_protipp_lq_a-736.mp4" },
    { "number": 9,  "video_url": "https://www.riedhof.de/files/riedhof_bahn-09_protipp_lq_a-735.mp4" },
    { "number": 10, "video_url": "https://www.riedhof.de/files/riedhof_bahn-10_protipp_lq_a-738.mp4" },
    { "number": 11, "video_url": "https://www.riedhof.de/files/riedhof_bahn-11_protipp_lq_a-737.mp4" },
    { "number": 12, "video_url": "https://www.riedhof.de/files/riedhof_bahn-12_protipp_lq_a-740.mp4" },
    { "number": 13, "video_url": "https://www.riedhof.de/files/riedhof_bahn-13_protipp_lq_a-739.mp4" },
    { "number": 14, "video_url": "https://www.riedhof.de/files/riedhof_bahn-14_protipp_lq_a-742.mp4" },
    { "number": 15, "video_url": "https://www.riedhof.de/files/riedhof_bahn-15_protipp_lq_a-741.mp4" },
    { "number": 16, "video_url": "https://www.riedhof.de/files/riedhof_bahn-16_protipp_lq_a-743.mp4" },
    { "number": 17, "video_url": "https://www.riedhof.de/files/riedhof_bahn-17_protipp_lq_a-744.mp4" },
    { "number": 18, "video_url": "https://www.riedhof.de/files/riedhof_bahn-18_protipp_lq_a-746.mp4" }
  ],
  "source_url": "https://www.riedhof.de/platz/",
  "updated_at": "2026-05-25"
}
$JSON$::jsonb
WHERE pccaddie_id = '0498844';
