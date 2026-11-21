# Unfire Power Web Lab

**Status:** experimental browser tool on a dedicated `gh-pages` review branch. It is not the native iPhone app (`/apps/power/`) and it is not a live electricity feed. The page remains `noindex,nofollow` until the product owner approves discoverability and the legal/QA gates have been checked.

## What it does

- Uses **user-entered hourly prices in €/kWh**, one value per local hour, without any internet request from the Power Web page.
- Or imports a **user-provided REData JSON file** from disk. Parser selects *only* `included[].id == "1001"` (PVPC), rejects missing/duplicated/malformed rows, and divides the official €/MWh numerical figures by 1000. The wholesale spot price series (600, often quarter-hour intervals) is deliberately ignored.
- Exactly matches each timestamp to `Europe/Madrid` local calendar time. Daylight-saving transitions with **23 or 25 hours** are covered, and repeated autumn hours have distinct offsets.
- Estimates the cheapest and most expensive start window for a constant-power appliance running **1–6 whole hours**, comparing against an optional manually entered fixed €/kWh rate. Does **not** compute a bill, recommend contracts or infer someone's supplier.
- Shows a responsive hourly price graph, clearly labelled data provenance and last published/updated value when the imported JSON provides it, and CSV export with spreadsheet formula-injection neutralization.
- Includes an explicit **fictional sample** for trying the interface without suggesting made-up prices are current.
- No paid APIs, keys, user accounts, cookies, localStorage, external JS/fonts, tracking, microphone, server processing, or background tasks.

## Why it does not auto-fetch Red Eléctrica data yet

On 21 Nov 2026, a live diagnostic request to the published REData endpoint
`/es/datos/mercados/precios-mercados-tiempo-real?start_date=YYYY-MM-DDT00:00&end_date=YYYY-MM-DDT23:59&time_trunc=hour`
returned HTTP 200 with CORS `Access-Control-Allow-Origin: *` and two independent series: PVPC indicator `1001` with 24 hourly items and spot indicator `600` with 96 quarter-hour items. This **proves technical access, not legal authorization to reproduce or redistribute the data automatically**.

The official Red Eléctrica legal notice demands explicit attribution and the date of last update and restricts copying/reuse, especially outside personal/noncommercial informational usage. Until rights and branding are verified for Unfire's product context, a visitor opens the REData data request separately, downloads it through the source, and imports it locally. Power Web does not proxy, cache, mirror, auto-fetch or redistribute official data.

Official references:
- API documentation: https://www.ree.es/es/datos/apidatos
- Legal conditions: https://www.ree.es/es/aviso-legal
- PVPC system information: https://www.ree.es/es/operacion/sistema-electrico/pvpc

**No claim of endorsement, national-wide uniform PVPC applicability or parity with contract-specific prices.** This lab labels its hourly values "Spain mainland / Europe-Madrid"; neither island nor Ceuta/Melilla schedule should be asserted from this source selection without geographic validation.

## Running and tests

Run from repository root (no package install for app):

```sh
python3 -m http.server 8768
# Open http://localhost:8768/apps/power-web/
node --test apps/power-web/engine.test.cjs
node --check apps/power-web/engine.js
node --check apps/power-web/app.js
```

The dedicated GitHub Actions workflow adds Chromium and WebKit actual interaction tests, including sample, 23/24/25-hour days, manual prices, JSON PVPC import, failure modes, CSV, 320–1440 px layouts and authentic browser screenshots using explicitly synthetic data.

## Release and product boundaries

- Native `/apps/power/` and its App Store link must remain unchanged.
- The new browser route is `/apps/power-web/` and intentionally does **not** create an automatic catalogue link before actual release validation.
- Price-source rights, direct API use and final attribution wording require legal review before adding any automatic live feed.
- Monitor browser resource limits and source API terms. Do not provision new paid services.
- Before claiming Safari compatibility, independently test native macOS Safari and physical iOS/Android. CI WebKit is not real-device evidence.
- Check GitHub workflow status, native-app integrity, rollback, live HTTPS after merge, and confirm whether the page stays noindex.
