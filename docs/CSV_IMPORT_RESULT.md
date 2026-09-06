# Blue Lagos CSV import — result

**Status: APPLIED & VERIFIED — 2026-09-06.**

Source: `data/import/Blue_Lagos_Master_Data.csv` (134 community records + 1 spreadsheet
totals row, ignored). Conflict policy: **numeric** (adopt the CSV's team-verified
population / registered-voters / women / youth for every matched community; LGA
and community-name labels left unchanged). Executed as a single transactional
`BEGIN; … COMMIT;` from `docs/csv-import.sql` in the Supabase SQL editor.

## Before → after

| metric | before | after |
| --- | --- | --- |
| communities | 134 | 134 |
| `estimated_population` total | 322,054 | **502,002** |
| population known | 93 / 134 | **134 / 134** |
| women known | 92 | 133 |
| youth known | 92 | 133 |
| registered voters known | ~86 | 128 |
| geolocated (has coordinates) | 93 | 93 *(CSV carried no coordinates for the 41)* |
| duplicate ids | 0 | 0 |

## What was written

- **556 field values** across **112 communities** (112 `UPDATE` statements).
  - 314 fills of previously-NULL fields on the 41 survey-only communities
    (population, women, youth, voters, occupation, priority amenities, head).
  - 242 team-verified numeric revisions on the 93 already-populated communities.
- **2 values rejected as corrupted and never written**: `Igbo Oja kekere`
  (id 315) CSV women 7,495 and youth 3,747 against a population of 312 — a single
  sub-count cannot exceed the community population. Those two fields remain NULL.
- **1 conflict deliberately not applied** (outside `numeric` scope): `Emina`
  (id 402) `community_head` — Supabase keeps "Alhaji Elemina" rather than the
  CSV's "CHIEF WASIU TAIWO AJUMOKO".

## Verification

- Full register re-read via the anon key: 134 rows, server count 134, 0 duplicate ids.
- **All 556 written field values spot-checked against `docs/csv-import.sql` — 0 mismatches.**
- `estimated_population` total = **502,002**, known **134 / 134** — matches the
  dry-run prediction and the CSV's own totals row exactly.
- Post-import register snapshot: `data/backups/blue_lagos_after_csv_import_2026-09-06T15-41-47-894Z.json`
  (134 rows, SHA-256 recorded).
- `data/presentation-snapshot.json` regenerated from the updated database.
- Gates: `lint · typecheck · 148 unit · build · 19 E2E · pipeline:validate · presentation:check` — all green.

## Review items left open (labels only — data already correct)

These 5 communities are matched to the right Supabase row; only a label differs
and was intentionally not changed:

| Supabase id | name | CSV LGA | Supabase LGA | note |
| --- | --- | --- | --- | --- |
| 380 | Abureji | Epe | Ibeju Lekki | CSV disagrees on LGA |
| 358 | Dongo | Ibeju Lekki | Epe | CSV disagrees on LGA |
| 315 | Igbo Oja kekere | Ojo | Epe | CSV disagrees on LGA |
| 319 | Tafi | Ojo | Ojo | CSV spells it "Taffi" |
| 378 | Takwa bay | Eti Osa | Eti Osa | CSV spells it "Tarkwa bay" |

## Known limitation

A **pre-import row-level backup was not captured by this tooling** because the
write was executed in the Supabase SQL editor rather than through
`scripts/import-blue-lagos-csv.mjs --apply` (which backs up first). The
pre-import aggregate state is documented above (322,054 / 93 known). For a full
rollback, use Supabase's automatic project backups / point-in-time recovery, or
the SQL editor's query history (the import was one atomic transaction).
