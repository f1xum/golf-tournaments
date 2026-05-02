-- Clean up club contact info that leaked from german-golf-guide.de itself.
--
-- The GGG scraper was grabbing the page's first mailto:/tel: link without
-- scoping to the club sidebar, so every club got GGG's own support contact
-- stamped on it. The scraper is now scoped + filtered (ggg_clubs.py), but
-- the DB still has the bad data until the next scrape run.

-- Email: strip GGG's address + the malformed "//info@..." form that
-- came from href="mailto://info@..." after the scraper stripped "mailto:".
UPDATE golf_clubs
SET email = NULL
WHERE email ILIKE '%@german-golf-guide.de'
   OR email LIKE '//%'
   OR email LIKE 'mailto:%';

-- Phone: GGG's support line (0221/98606-…) — match all formatting variants.
UPDATE golf_clubs
SET phone = NULL
WHERE regexp_replace(phone, '\D', '', 'g') LIKE '%22198606%';

-- Website: GGG's own domain was already filtered in the scraper, but
-- catch any stragglers.
UPDATE golf_clubs
SET website = NULL
WHERE website ILIKE '%german-golf-guide.de%';
