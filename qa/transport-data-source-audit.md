# Transport Data Source Audit — 2026-10-09

## Current automated verification

- Live GitHub Pages URL: https://istanbultransport.github.io/istanbul-tourist-transport-planner/
- Live build observed by Chromium: `V230.12.19-BUSINESS-ROUTE-QA`, matching the `main` build marker.
- Live smoke checks: 16 passed, 0 failed. These cover HTTP response, build marker, business catalogue/search, Europe/Anatolia filters, one visible route, JavaScript errors, Service Worker, cache version, and offline app-shell reload.
- Full local Chromium suite: 105 passed, 0 failed. This includes all 40 R01–R40 origin/search/selection/route-display UI flows, route-engine fixture checks, mocked browser geolocation, and offline PWA smoke tests.
- Important distinction: mocked GPS verifies permission/state handling, not physical coordinate accuracy on a real handset.

## Sources checked

### M4 route, station sequence and integrations

Official source: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M4

The official M4 page lists the Kadıköy–Sabiha Gökçen station sequence and identifies these integrations:
- Kadıköy: T3 tram, sea lines, sea buses and motorboats.
- Ayrılık Çeşmesi: Marmaray.
- Ünalan: Metrobüs.
- Kozyatağı: M8.
- Pendik: YHT access via İETT buses.

**Routing implication verified:** M4↔Marmaray is modelled at Ayrılık Çeşmesi, not as a direct transfer at Pendik. Pendik YHT is a surface-access connection, not a rail interchange. The route graph guard and the R01–R40 suite check for invalid transfer shortcuts.

**Additional official integration cross-checks:**
- M8 official page: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M8 confirms Bostancı ↔ Marmaray/high-speed rail/sea lines, Kozyatağı ↔ M4, and Dudullu ↔ M5.
- M5 official page: https://www.metro.istanbul/Hatlarimiz/HatDetay?hat=M5 confirms Üsküdar ↔ Marmaray/İETT/sea piers, Altunizade ↔ Metrobüs, and Dudullu ↔ M8. It also lists the extension through Sultanbeyli, opened 22 May 2026; the current app's M5 sequence includes Sultanbeyli.
- These source checks agree with the app's M4↔Marmaray at Ayrılık Çeşmesi, M4↔M8 at Kozyatağı, M8↔Marmaray at Bostancı, M8↔M5 at Dudullu, M5↔Marmaray at Üsküdar, and M5↔Metrobüs at Altunizade entries.


### Station exit names

Official source: https://www.metro.istanbul/dosyalar/bilgilendirme/Gece-Metrosu-Kapal%C4%B1-Giri%C5%9Fler.pdf

The application has 24 station records and 80 numbered exit records in `stationExitRegistry`, each labelled with the source `Metro İstanbul PDF`. The official PDF contains exit numbers/names for the M4 stations represented in the registry, including Kadıköy, Ayrılık Çeşmesi, Acıbadem, Ünalan, Göztepe, Yenisahra, Kozyatağı, Bostancı, Küçükyalı, Maltepe, Huzurevi, Gülsuyu, Esenkent, Hastane-Adliye, Soğanlık, Kartal, Yakacık, Pendik, Tavşantepe, Fevzi Çakmak, Yayalar-Şeyhli, Kurtköy and Sabiha Gökçen; it also includes M2/Taksim entries.

**Scope warning:** this is a night-service entrance/exit status document. Its open/closed status must not be presented as current all-day availability. The app uses it for exit names/numbering, not as a live closure feed. Names and numbers are source-backed; real-time access/closure status is not verified by this static registry.

### Last-mile bus registry

Official İETT route links currently embedded in the registry:
- 15F: https://iett.istanbul/RouteDetail?hkod=15F
- 139A: https://iett.istanbul/RouteDetail?hkod=139A&routename=139A
- 48G: https://iett.istanbul/RouteDetail?hkod=48G&routename=G%C3%96KT%C3%9CRK-+MESC%C4%B0D%C4%B0+SELAM

The three entries are marked verified in code and contain stop/boarding/alighting descriptions. This does not guarantee current operating hours or service status; those can change and should be checked against İETT before a journey.

## Remaining data-validation gates

These are **not marked fully verified** by the current CI:

1. **39 static GPS station coordinates:** the browser test checks that coordinates are finite and that the browser permission flow accepts a mocked location. Each station coordinate still needs independent map/source comparison and a real Android/iOS location spot-check.
2. **Walking estimates:** the source currently contains 30 curated `touristWalkMinutes` entries, 121 `lastMileWalkMinutes` entries and 45 `touristWalkDistanceKmMap` distances. They do not all have per-entry route-source URLs in the application. Values generated from distance and an assumed walking speed are estimates, not measured pedestrian navigation ETAs. Do not describe all of them as field-verified.
3. **All transfer pairs:** the validator rejects unverified same-node rail transfers, and the official M4 integration points above were checked. Every other cross-line transfer pair still needs a line-by-line official-source audit; CI coherence alone is not proof of real-world interchange access.
4. **Station exits to destination walking links:** exit names are source-backed, but the practical walking route, slope/accessibility and minutes from each exit to its linked destination need route-level map or field checks.
5. **Physical-device acceptance:** CI used headless Chromium. It does not replace GPS, Safari/iOS PWA installation, Android home-screen install, push/update behavior or real offline checks on actual phones.

## Release rule

Keep the product in **pre-release verification** until the coordinate, transfer, walking-link and physical-device gates above have evidence. Do not mark a route PASS merely because it renders; record the visible route steps, transfer nodes, walking/last-mile steps, source and build ID.


## GPS coordinate audit extraction — 2026-10-09

- Extracted the current `staticGpsStationCoordinates()` registry from `index.html` into [`qa/station-coordinate-audit.csv`](station-coordinate-audit.csv).
- The CSV contains **49 station/mode records** (49 unique station+mode keys). This differs from the earlier summary of **39 static GPS station coordinates** above; the earlier count should be treated as stale and reconciled with the current source.
- Every row is marked `PENDING_INDEPENDENT_COORDINATE_CHECK`. The OpenStreetMap URL is a visual review link at the current app coordinate, **not evidence that the coordinate is correct**. The official line URL supports station/line identity only, not the exact latitude/longitude.
- Duplicate-coordinate groups detected: Ayrılık Çeşmesi M4/Marmaray; Üsküdar Marmaray/M5; Yenikapı Marmaray/M2; Kağıthane M7/M11; Kayaşehir M3/M11; and **Olimpiyat M11/Halkalı Stadı M11**. Shared coordinates may be valid for connected interchange nodes, but each pair must be reviewed; Olimpiyat/Halkalı Stadı is a high-priority possible coordinate-copy error.
- The current static M4 GPS registry is partial: it contains 11 M4 records, while Metro İstanbul's official M4 page lists 23 stations. Do not infer the missing stations are covered by this GPS candidate list.
- No application coordinates were changed in this step. The CSV is an audit inventory only; the release gate remains blocked until each row has an independently checked coordinate source and a recorded result.


## First independent coordinate cross-check — 2026-10-09

- Updated `qa/station-coordinate-audit.csv` to add a dedicated `coordinate_evidence_source_url` field and recorded source-backed outcomes for three records.
- **Confirmed mismatch:** `Olimpiyat M11` incorrectly reused the `Halkalı Stadı M11` coordinate `41.05629, 28.77441`. Wikidata's Olimpiyatköy record, DailyMetro's station entry and a geotagged Wikimedia Commons station photo place Olimpiyatköy around `41.07855, 28.76951`. The CSV now records that corrected candidate and marks the mismatch; the app's `index.html` has **not** been changed yet. Because the coordinate references are non-operator sources, retain an operator/official-map confirmation as a release follow-up.
- **Cross-check match:** `Halkalı Stadı M11` remains `41.05629, 28.77441`, matching multiple map/catalogue references.
- **Cross-check match:** `Olimpiyat M9` remains `41.07954, 28.76719`, close to the geotagged Wikimedia Commons photo location and other map/catalogue references. This is a separate M9 station from Olimpiyatköy M11.
- Sources: https://www.wikidata.org/wiki/Q113516923 ; https://dailymetro.live/istanbul/en/station/olimpiyatkoy ; https://commons.wikimedia.org/wiki/File:M11_Olimpiyatk%C3%B6y_Metro_%C4%B0stasyonu_21062026_12.jpg ; https://www.wikidata.org/wiki/Q113518000 ; https://dailymetro.live/istanbul/en/station/halkal-stad ; https://mapcarta.com/N10702895858 ; https://commons.wikimedia.org/wiki/File:M9_Olimpiyat_-_Peron_kat%C4%B1_2026.jpg ; https://dailymetro.live/istanbul/station/olimpiyat ; https://turkipedia.com/Olimpiyat_%28%C4%B0stanbul_Metrosu%29
- Remaining 46 records are still pending independent coordinate checks. Do not treat the overall GPS dataset as verified.

## Coordinate audit continuation — 2026-10-09

- Continued the station-by-station review and added source links plus coordinate-difference notes for **19 additional records**, prioritising M4, M11 and shared interchange complexes. Commit: `b908b3e545a66410131d9c11c8dfb705027fce85`.
- Reconciled the current CSV: **49 total records**; **27 remain pending independent coordinate checks**. The other 22 have a recorded comparison result, but this does **not** mean all 22 are approved for release.
- Current status totals: 7 close matches against non-operator map/catalogue sources; 4 matches against non-operator sources; 5 variance-review records; 5 records requiring further coordinate-variance review; 1 confirmed mismatch (Olimpiyat M11); 27 pending.
- M4 inventory count is **12 records**, not 11 as stated in the earlier extraction note. Ten M4 records now have a comparison note; Kartal M4 remains pending. M4 coordinates with notable differences include Acıbadem (~130 m), Ünalan (~105 m), Kozyatağı (~105 m) and Sabiha Gökçen (~400 m) versus the cited DailyMetro catalogue points. These are flagged for point-definition/official-map review, not automatically treated as incorrect because entrances, station footprints and representative map points can differ.
- M4 close comparisons recorded for Kadıköy, Göztepe, Yenisahra, Maltepe and Pendik. Ayrılık Çeşmesi and Bostancı are retained as variance-review items rather than silently changing the app's coordinates.
- M11 checks recorded for Halkalı, İbn Haldun Üniversitesi, Arnavutköy Hastane and Kayaşehir. Kayaşehir M11 is flagged for review because the M11 station point differs from the existing app point and should not be conflated with M3 Kayaşehir Merkez. The earlier Olimpiyat M11 mismatch remains a CSV-only correction candidate; app code has not been changed.
- Interchange-coordinate review recorded for Üsküdar (M5/Marmaray) and Yenikapı (M2/Marmaray). A shared interchange may legitimately use one routing node, but separate line-specific station coordinates should not be assumed to represent the exact same physical entrance/platform.
- Source-quality rule: DailyMetro/Mapcarta/Wikidata/Wikimedia are comparison evidence, not official operator coordinate feeds. The official Metro İstanbul M4 page confirms line/station identity and sequence, not exact latitude/longitude. Therefore, all non-operator matches remain provisional pending an official map/field check where required.
- No application code or live coordinates were changed in this continuation. The CSV is the audit record, and the release gate remains blocked pending resolution of variance flags, the 27 pending rows, transfer/walking validations, and real-device acceptance.

## Marmaray coordinate cross-check continuation — 2026-10-09

- Added source-backed comparisons for **9 more Marmaray records** using Mapcarta pages based on OpenStreetMap station nodes. CSV commit: `e6a58115c38407a9f66c89bdc188079886e2ba14`.
- High-priority discrepancies: **Yunus** differs from the cited railway-station node by over 1 km; **Kaynarca** by roughly 2 km; **Kartal Marmaray** by roughly 1.5 km, with the current Kartal point appearing near the Yunus area; **Suadiye** and **Feneryolu** also differ by several hundred metres. These are flagged for confirmation rather than automatically overwriting app coordinates.
- Erenköy matches the cited OSM/Mapcarta coordinate exactly; Söğütlüçeşme is a close match. Bostancı and Göztepe remain variance-review items.
- Current inventory remains 49 records. After this batch, status totals are: `CROSS_CHECKED_NONOFFICIAL_SOURCE_CLOSE_MATCH`: 8; `CROSS_CHECKED_NONOFFICIAL_SOURCE_VARIANCE_REVIEW`: 7; `COORDINATE_VARIANCE_REVIEW_REQUIRED`: 10; `PENDING_INDEPENDENT_COORDINATE_CHECK`: 18; `CROSS_CHECKED_NONOFFICIAL_SOURCE_MATCH`: 5; `CROSS_CHECKED_COORDINATE_MISMATCH_CONFIRMED`: 1.
- The sources are map/catalogue records, not an official TCDD/Marmaray coordinate feed. For large discrepancies, verify station identity and exact target point (station node, platform, entrance or transfer node) against an operator map before changing app code. No app code was changed in this batch.

## Remaining station-coordinate first-pass review — 2026-10-09

- Completed a first-pass source review for the final 18 rows that were still marked pending. CSV commit: `10486de36d558dfc0e0ff36aa7d7446b7f711414`.
- The current 49-row inventory now has only **1 row still without an independent coordinate comparison**; however, **30 rows still need variance resolution or stronger independent/operator confirmation**, so this does not mean the coordinate dataset is verified or release-ready.
- High-risk Marmaray mismatches are now documented with Mapcarta/OpenStreetMap evidence:
  - Kaynarca app point `40.86510, 29.23250` vs station node `40.87137, 29.25596` (about 2.1 km).
  - Kartal Marmaray app point `40.88560, 29.20840` vs Kartal station node `40.88869, 29.19108` (about 1.5 km). The app point is near the Yunus-area station node; likely station-to-coordinate assignment problem.
  - Yunus app point `40.87620, 29.22150` vs Yunus node `40.88456, 29.21041` (about 1.3 km). The existing coordinate candidates for Yunus and Kartal Marmaray need to be remapped carefully to their actual station identities, not just swapped blindly.
  - Suadiye and Feneryolu also show several-hundred-metre differences and remain flagged.
- Other notable discrepancies:
  - M5 Ümraniye, Dudullu and Çekmeköy show roughly kilometre-scale differences against the cited OSM/Mapcarta station nodes.
  - M2 Şişli–Mecidiyeköy and Levent show several-hundred-metre differences; Taksim, Vezneciler, Gayrettepe and 4. Levent need point-definition review.
  - M11 Kağıthane's Mapcarta/OSM station node is approximately 290 m east of the M7 Kağıthane station node. The two line-specific rows should not share one exact coordinate when the data model intends separate platform/station points.
  - M3 Kayaşehir Merkez and M11 Kayaşehir are distinct stations; preserve separate coordinates. The M3 station is mapped around `41.11908, 28.76634`; the M11 station is nearby but not identical.
- Official Metro İstanbul route pages confirm station names, line identity and interchange relationships, but do not publish precise latitude/longitude in the reviewed pages. Mapcarta/OSM and other catalogues are comparison evidence, not an operator coordinate feed.
- **No live application coordinates were changed.** The CSV records candidate source points and discrepancy notes only. Do not auto-replace the app's coordinate from a map node until the exact intended point (platform, station centroid, entrance or transfer node) and station identity are verified.
- The last run for commit `a3a79e3` passed both Static and Browser QA and GitHub Pages deployment. The newer commit `10486de` has its own QA and Pages runs queued at the time this report was written; their outcomes must be checked before claiming that commit's workflows passed.

