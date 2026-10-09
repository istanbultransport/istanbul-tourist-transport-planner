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
