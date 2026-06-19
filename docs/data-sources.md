# Data Sources

## Directly Configured

These sources do not require a user-provided API key and are wired into `POST /api/monitor/run`.

| Layer | Source | Method | Notes |
|---|---|---|---|
| News discovery | GDELT DOC 2.0 | Public JSON API | Queries Europe/France/Germany/UK AI copyright litigation terms, then keeps only allowlisted domains. |
| Rights-holder signals | GDELT DOC 2.0 domain queries | Public JSON API | Monitors SACD, Le Figaro, GEMA, SGDL/SNE related queries. All hits enter review. |
| Legislation and policy signals | GDELT DOC 2.0 official-domain queries | Public JSON API | Monitors European Commission, EUR-Lex, France Ministry of Culture, Assemblée nationale and related official domains for AI Act, GPAI, TDM and French copyright policy terms. |
| Official EU court signals | CURIA/CJEU RSS | RSS | Monitors EU court items for copyright, IP, AI, TDM, authors/publishers terms. |
| Peripheral official signals | ECHR RSS | RSS | Low-priority property/expression/IP watch. |
| Video intelligence | European Parliament, Assemblée nationale, SACD, GEMA | Official/rightsholder portals | Tracks hearings, press conferences, interviews, campaign videos and public event pages for later transcription/review. |
| Market indicators | Yahoo Finance chart endpoint | Public delayed JSON | Tracks AI-platform and rights-holder exposure basket. This is a market-sensitivity signal, not legal evidence. |
| Risk calendar | Internal calendar + cited official/tracker sources | Seeded event records | Tracks hearings, vote windows, policy deadlines, expected judgments and rights-holder pressure dates. |
| Manual official capture | `/api/documents/capture` | URL capture | Archives official URLs/PDF/HTML/JSON with SHA-256. |

## Configured But Requires Your Credentials

| Source | Why It Needs You | Status |
|---|---|---|
| Judilibre / PISTE | Requires ProConnect/PISTE application access and KeyId, bearer token, or OAuth/API credentials. | Adapter implemented; credentials pending. |
| Légifrance / AIFE | Requires API access and endpoint permission. | Source registered; adapter pending endpoint details. |

## Priority Sources To Register

1. Judilibre / PISTE: French official judicial decisions.
2. Légifrance / AIFE: French legal and case-law supplement.
3. EUR-Lex Web Service or SPARQL: EU legal texts and case-law automation.
4. CURIA advanced search/API if access is available beyond public RSS.

## Allowlisted News / Commentary Domains

- Reuters
- AP News
- Le Monde
- Le Figaro
- The Guardian
- Politico Europe
- Euractiv
- Lawfare
- Music Business Worldwide
- JUVE Patent
- The Technollama

## Rights Holder / Organization Domains

- SACD
- GEMA
- SGDL
- SNE
- Le Figaro
- European Parliament Multimedia Centre
- Assemblée nationale videos
- Yahoo Finance

## Official / Policy Domains

- EUR-Lex
- European Commission / digital-strategy.ec.europa.eu
- European Parliament
- Council of the European Union
- France Ministry of Culture
- Assemblée nationale
- Sénat
- Légifrance
- Arcom
- CNIL

All automatically discovered cards are created with `status=review`; they are not published to the public dashboard until approved in `/admin.html`.
