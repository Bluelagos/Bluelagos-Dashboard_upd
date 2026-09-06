# Blue Lagos CSV import reconciliation

_Generated 2026-09-06T15:42:00.975Z · mode: **DRY RUN** · conflicts: **numeric** · source: `data\import\Blue_Lagos_Master_Data.csv`_

> Baseline Supabase state before import: **134 communities**, estimated_population total **502,002**, population known **134**, unavailable **0**.

## 1. CSV summary

| property | value |
| --- | --- |
| filename | Blue_Lagos_Master_Data.csv |
| community records (named rows) | 134 |
| non-record rows (no community name — ignored) | 1 |
| columns | 69 |
| delimiter | `,` |
| BOM | no |
| duplicate rows | 0 |
| empty rows skipped | 0 |

_Non-record rows carry values in: Estimated Population:. Treated as a spreadsheet totals/notes row and excluded from every count, match and write._

## 2. CSV column profile

| column | type | non-null | null | unique | examples |
| --- | --- | --- | --- | --- | --- |
| ObjectID | integer | 134 | 0 | 134 | 1 · 2 · 3 · 4 · 5 |
| Community Name | string | 134 | 0 | 134 | Aba keta · Aba oyinbo · Abatuntun · Abegede · Abejoye |
| LGA: | string | 134 | 0 | 7 | Epe · Ibeju Lekki · Amuwo Odofin · Ojo · Badagry |
| Senatorial District | string | 134 | 0 | 3 | Lagos East · Lagos West · Lagos Central |
| Community Ruler Title | string | 134 | 0 | 5 | baale · chief · king · oloritun · other |
| Specify Title | string | 3 | 131 | 2 | Community leader · (Ottun baale Sagbokodji community) |
| Input the full name of the Community Head | string | 134 | 0 | 131 | Chief mutiu · Mr sikiru · AKOJO MUFUTAO · Suluka ibrahim · CHIEF BELLO ISMAIL OL |
| Primary Visit Route: | string | 134 | 0 | 3 | road_water · water_only · seasonal |
| Estimated Population: | integer | 134 | 0 | 64 | 50 · 100 · 62 · 375 · 5534 |
| Household estimated population | string | 134 | 0 | 25 | Below 50 · 62 - 125 · Above 1000 · 401 - 450 · 189 - 250 |
| Estimated Registered Voters: | integer | 128 | 6 | 81 | 44 · 50 · 145 · 2765 · 500 |
| Enter the name of the community polling unit | string | 99 | 35 | 94 | Aba keta · Abomiti poling unit · WorldC1 · ABEJOYE · Abomiti poling center |
| Existing Amenities: | string | 134 | 0 | 27 | _others · power · water,health,power,education,jetty · education · water,power,j |
| Priority Needed Amenities: | string | 133 | 1 | 58 | water,health,power,education · water,health,education,power,jetty · water,health |
| specify amenities | string | 28 | 106 | 2 | fishing tools · Electricity, Secondary School and good Road construction |
| Primary Occupation | string | 134 | 0 | 5 | fishing · transport · farming · artisan · trading |
| Select one political party that dominates the community | string | 134 | 0 | 1 | stronghold |
| State of Past Govt Presence: | string | 44 | 90 | 2 | functional · abandoned |
| Describe Abandoned Project: | string | 20 | 114 | 19 | Solar project · Electricity, borehole and jetty · Primary healthcare · Secondary |
| Input the full name of the Blue Lagos Contact person in the community(1st) | string | 134 | 0 | 130 | Mr tawrid · Mr eskay · AKOJO MUFUTAO · Saheed Otuba · AGUNREGE ABOLAJI |
| Input the Phone Number of the Blue Lagos Contact person in the community (1st) | string | 134 | 0 | 129 | 08131181832 · 08131188132 · 09016946509 · 07045768214 · 8108561972 |
| Input the full name of the Blue Lagos Contact person in the community (2nd) | string | 94 | 40 | 92 | Iya Zainab · Mr Olawale · BALOGUN ALIU · Ibrahim · Mr gbolahan |
| Input the Phone Number of the Blue Lagos Contact person in the community (2nd) | integer | 123 | 11 | 118 | 08151147837 · 08123567890 · 09046300584 · 08146642687 · 7041914434 |
| Input comment | string | 49 | 85 | 39 | i will appreciate if you can make it to our community · No comment · The person  |
| Select the community Local Government | string | 86 | 48 | 7 | epe · ibeju_lekki · ojo · badagry · Ojo |
| pulled_senatorial_district | string | 57 | 77 | 3 | Lagos East · Lagos West · Lagos Central |
| Main challenges getting PVC? | string | 134 | 0 | 15 | not_aware,cost,no_center · cost,no_center · no_center · cost · process_hard |
| Roughly how many people have NIN? | string | 134 | 0 | 4 | 40_70 · 70_100 · 10_40 · 0_10 |
| Main challenges getting NIN? | string | 134 | 0 | 14 | no_center,cost · cost · other · cost,no_center · no_center |
| How difficult is it to reach the nearest center? | string | 134 | 0 | 3 | difficult · very_difficult · requires_boat |
| Estimated number of women | integer | 134 | 0 | 93 | 35 · 62 · 37 · 107 · 2121 |
| Estimated number of youth | integer | 134 | 0 | 87 | 19 · 50 · 117 · 2460 · 250 |
| Estimated number of pregnant women | integer | 133 | 1 | 34 | 4 · 6 · 13 · 12 · 50 |
| Have NGOs or government programs come here before? | boolean | 134 | 0 | 2 | no · yes |
| If yes, what did they do? | string | 12 | 122 | 10 | borehole · Dey did primary school for the communty · They drilled borehole for t |
| Select TOP 2 ways people receive information in your community | string | 134 | 0 | 10 | leaders,radio · leaders,social_media · social_media · leaders,religious · leader |
| In the absence of a formal health center, where do residents primarily go for first-aid or immediate medical treatment inside the community? | string | 125 | 9 | 3 | traditional · mobile_worker · chemist |
| What is the primary mode of medical evacuation from this community during an emergency? | string | 124 | 10 | 3 | road_vehicle · unmotorized_boat · motorized_boat |
| What is the highest level of education physically available inside this community cluster? | string | 61 | 73 | 3 | primary · senior_sec · junior_sec |
| Are children forced to cross open water or major transit routes without a pedestrian bridge to reach the nearest school? | boolean | 134 | 0 | 2 | yes · no |
| What is the predominant method of solid waste disposal in this community? | string | 134 | 0 | 4 | buried · burnt · water_dump · formal_collect |
| What is the primary toilet facility used by most households in this cluster? | string | 134 | 0 | 4 | open_water · open_ · shared · flush |
| During peak rainy season/high tide, how long does floodwater typically remain stagnant within the living areas? | string | 134 | 0 | 4 | weeks_1_2 · days_1_3 · immediate · permanent |
| What is the primary, everyday source of drinking water for the majority of residents here? | string | 134 | 0 | 5 | well · river · borehole · vendor · rain |
| Over the last 5 years, has the community lost living space or houses to riverbank erosion or water encroachment? | string | 134 | 0 | 3 | minor · stable · severe |
| Does this community have a designated emergency evacuation point or a community-led disaster emergency committee? | string | 49 | 85 | 2 | inactive · active |
| What is the dominant structural material used for the walls of dwellings in this cluster? | string | 134 | 0 | 3 | wood · concrete · thatch |
| What is the community's biggest barrier to selling their agricultural harvest or fish catch? | string | 134 | 0 | 3 | high_cost · no_access · cold_storage |
| What is the status of mobile network coverage (Internet /Voice call) in this exact community? | string | 134 | 0 | 2 | good_4g · voice_only |
| During the off-season or periods of severe weather/flooding, or dry season how does the majority of the community secure daily food? | string | 134 | 0 | 4 | relief · stored · skipping · sharing |
| What is the physical condition of the main boat landing area for this community? | string | 134 | 0 | 3 | mudbank · concrete · wooden |
| What is the primary source of electricity for lighting at night? | string | 92 | 42 | 3 | generator · grid · solar |
| Where do community residents primarily go to report security incidents or resolve major legal/land disputes? | string | 134 | 0 | 3 | traditional · police · vigilante |
| Is there an active, functional cooperative or thrift society (Esusu/Ajo) operating within this community cluster? | string | 67 | 67 | 2 | weak · active |
| What is the primary economic role of women in this specific community cluster? | string | 134 | 0 | 4 | processing · formal · trading · unpaid |
| What is the dominant daily activity or occupation for young adults (18-35) residing in this community? | string | 134 | 0 | 4 | local_trade · idle · vocational · migrating |
| 1. Have immunisation or vaccination teams visited your community within the last 12 months? | string | 134 | 0 | 3 | no · yes · dont_know |
| 2. When vaccination teams visit, are children in your community usually vaccinated? | string | 134 | 0 | 3 | no · yes · dont_know |
| 3. How are immunisation services usually provided in your community? | string | 134 | 0 | 4 | no_teams · outreach_team · health_facility · both |
| 4. How often do vaccination or immunisation teams visit your community? | string | 134 | 0 | 5 | never · once_a_year · rarely · monthly · every_few_months |
| 5. Do you believe all eligible children in your community have access to routine immunisation services? | boolean | 134 | 0 | 2 | no · yes |
| 6. What are the main challenges to accessing immunisation services in your community? | string | 134 | 0 | 6 | no_teams · transport_challenges · other · facility_too_far · facility_too_far,tr |
| Please specify the other challenge: | string | 1 | 133 | 1 | Only if the vaccination team fail to come |
| x | float | 93 | 41 | 90 | 4.094155 · 3.809966 · 3.732494 · 4.094979379 · 3.236103 |
| y | float | 93 | 41 | 90 | 6.5082436 · 6.595618995 · 6.505015 · 6.519604703 · 6.440964 |
| Input the full name of the Blue Lagos Contact person in the community(2nd) | string | 30 | 104 | 29 | CHIEF BELLO ISMAIL OLAYEMI · CHIEF MUKAILA LAWAL · CHIEF OGUNLAJA TAOHEED A. · C |
| Data QA Note | string | 91 | 43 | 50 | Population updated 40->50 (team-verified current estimate); women, youth, voters |
| Cluster | integer | 134 | 0 | 4 | 3 · 0 · 2 · 1 |
| Severity Score | integer | 134 | 0 | 8 | 8 · 10 · 9 · 6 · 5 |

## 3. Column resolution (auto-detected — review)

| role | CSV column |
| --- | --- |
| identity: stable id | ObjectID |
| identity: community name | Community Name |
| geography: LGA | LGA: |
| geography: district | Senatorial District |
| cluster | Cluster |
| field: estimated_population | Estimated Population: |
| field: estimated_registered_voters | Estimated Registered Voters: |
| field: estimated_number_of_women | Estimated number of women |
| field: estimated_number_of_youth | Estimated number of youth |
| field: longitude | x |
| field: latitude | y |
| field: primary_occupation | Primary Occupation |
| field: priority_needed_amenities | Priority Needed Amenities: |
| field: community_head | Input the full name of the Community Head |
| field: nearest_hospital_name | — none detected — |
| field: dist_to_hospital_km | — none detected — |

## 4. Record matching

| status | count |
| --- | --- |
| exact_name_lga_match | 129 |
| probable_match_review | 5 |
| supabase_only | 0 |
| — csv rows total — | 134 |
| — supabase rows total — | 134 |

### Ambiguous / review-required matches

| csv row | csv name | csv lga | status | matched Supabase row | why |
| --- | --- | --- | --- | --- | --- |
| 9 | Abureji | Epe | probable_match_review | 380 · Abureji · ibeju_lekki | name matches; CSV LGA "Epe" vs Supabase "ibeju_lekki" |
| 28 | Dongo | Ibeju Lekki | probable_match_review | 358 · Dongo · epe | name matches; CSV LGA "Ibeju Lekki" vs Supabase "epe" |
| 47 | Igbo Oja kekere | Ojo | probable_match_review | 315 · Igbo Oja kekere · epe | name matches; CSV LGA "Ojo" vs Supabase "epe" |
| 132 | Taffi | Ojo | probable_match_review | 319 · Tafi · ojo | spelling variant of "Tafi" (edit distance 1, same LGA) |
| 134 | Tarkwa bay | Eti Osa | probable_match_review | 378 · Takwa bay · eti_osa | spelling variant of "Takwa bay" (edit distance 1, same LGA) |

### CSV-only communities

None.

### Supabase-only communities

None.

## 5. Population

| metric | value |
| --- | --- |
| current known total | 502,002 |
| communities missing population (before) | 0 |
| CSV supplies population for missing communities (safe fill) | 0 |
| population added from those fills | 0 |
| population conflicts (Supabase has a different value) | 0 |
| invalid CSV population values | 0 |
| population conflicts being applied (mode) | 0 (numeric) |
| net change from applied population conflicts | +0 |
| **projected known total (conflicts=numeric)** | **502,002** |
| projected population-known communities | 134 / 134 |
| still unavailable after import | 0 |
| _for reference:_ CSV totals row (Σ all 134 CSV population values) | 502,002 |

_The ~500,000 expectation is **not** used to adjust any value. `conflicts=none` keeps every existing Supabase value and only fills the 41 blanks; `conflicts=numeric` also adopts the CSV's team-verified revisions for population/voters/women/youth._

## 6. Coordinates

| metric | value |
| --- | --- |
| missing coordinates filled from CSV | 0 |
| coordinate conflicts (material difference) | 0 |
| invalid CSV coordinates | 0 |

## 7. Proposed database actions

### Safe updates (NULL → valid CSV value) — applied with `--apply`

None.

### Conflicts — Supabase already has a value, CSV differs

Applied in this run: **0** (mode `numeric`). `--conflicts numeric` would apply the 0 population/voter/women/youth rows; `--conflicts all` would apply all 1. The CSV "Data QA Note" column documents these as team-verified revisions.

| id | community | field | Supabase value | CSV value | applied now? |
| --- | --- | --- | --- | --- | --- |
| 394 | Emina | community_head | Alhaji Elemina | CHIEF WASIU TAIWO AJUMOKO | no |

### Ignored — invalid CSV values (NOT applied, NOT zeroed)

| id | community | field | CSV value | reason |
| --- | --- | --- | --- | --- |
| 315 | Igbo Oja kekere | estimated_number_of_women | 7495 | exceeds community population (312) |
| 315 | Igbo Oja kekere | estimated_number_of_youth | 3747 | exceeds community population (312) |

### Verified equal — no action (1114 fields)

### New rows

0 CSV-only communities are reported above and are **not** inserted by this script. Review them and, if genuinely new survey communities, insert them in a separate reviewed batch.

## 8. Write path

`SUPABASE_SERVICE_ROLE_KEY` is **absent**. The anon key cannot write under RLS. Add the service-role key to `.env.local` (gitignored) before `--apply`, or run the safe updates as SQL yourself.
