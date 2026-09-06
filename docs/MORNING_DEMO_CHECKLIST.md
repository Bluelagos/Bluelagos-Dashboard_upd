# Morning Demo Checklist

---

## The night before / first thing in the morning

- [ ] Laptop fully charged. Bring the charger.
- [ ] Phone charged, with a mobile hotspot configured and tested (know the password).
- [ ] A second device (phone/tablet) that can open the site as a backup screen.
- [ ] **Do NOT run a system/browser update this morning.** Freeze the environment.
- [ ] Pull the latest project and install: `npm install` (only if the repo changed).
- [ ] Generate a fresh verified snapshot: `npm run snapshot:presentation` — expect `134 rows, count integrity passed`.
- [ ] Run the readiness check: `npm run presentation:check` — expect **"Presentation check passed"**.
- [ ] Confirm `.env.local` contains `NEXT_PUBLIC_ALLOW_SNAPSHOT_FALLBACK=1`.
- [ ] Build and start the production server: `npm run build` then `npm start` — no errors.
- [ ] If using the hosted URL (Vercel/Netlify): open it, hard-refresh, confirm it loads and the map renders.
- [ ] Click through all nine demo pages once (see `DEMO_WALKTHROUGH.md`). Confirm each map draws.
- [ ] Open `/briefing` and step through every scene with the arrow keys.
- [ ] Take **full-screen screenshots** of: Overview, Explorer with OSM + H3 layers on, one community dossier, Accessibility, Climate, Scenarios with a catchment placed, Data Quality. Put them in one folder. This is your no-internet fallback.
- [ ] Save `EXECUTIVE_SUMMARY.md` as a PDF you can email or hand over.
- [ ] Check Supabase status page / dashboard — project is active, not paused.
- [ ] Decide your one rehearsed community for the dossier scene. Write its name on a sticky note.
- [ ] Rehearse the script (`DEPUTY_GOVERNOR_SCRIPT.md`) out loud, timed, at least twice. Target 8 minutes.

## Five minutes before

- [ ] Open the app to the **Overview** page. Leave it loaded.
- [ ] Glance at the KPI row — does the community count read **134**? If it reads something else, the register changed legitimately; adjust your spoken numbers, don't panic.
- [ ] Confirm no **VERIFIED SNAPSHOT** banner (means live data is working). If the banner *is* showing, that's fine — say so once when you start ("we're on the verified snapshot from [time] because the venue network is unreliable").
- [ ] Open `/explorer` in a second tab, toggle the OSM + H3 layers once so they're warm, toggle them off again.
- [ ] Open `/scenarios` in a third tab; place one catchment so the interaction is warm; reset.
- [ ] Close every other app. Close email, chat, notifications.
- [ ] Enable **Do Not Disturb / presentation mode** on the OS.
- [ ] Browser zoom to a level where the KPI numbers and map legend are readable from across a boardroom — usually 110–125%.
- [ ] Full-screen the browser (F11). Hide the bookmarks bar.
- [ ] Water within reach. Sticky note with the community name in view.

## If the internet dies mid-demo

1. Don't apologise repeatedly. Say once: "The venue connection has dropped — I'll continue on the verified snapshot / screenshots."
2. If the app still loads (snapshot fallback active): keep going. The banner explains itself. **Avoid** clicking into deep filters or the live search.
3. If the app won't load at all: switch to the screenshot folder. Walk the same nine scenes from the images. The story doesn't change.
4. **Do NOT** try to re-run `npm` commands or debug live in front of the room.

## What still works with no internet (snapshot + screenshots)

- The full narrative: problem → field evidence → geography → one community → access → climate → scenario → data quality → next steps.
- All the numbers in this study pack.
- The evidence-class argument (FIELD / OSM / DERIVED / MODELLED).

## What needs internet

- Live data refresh (falls back to snapshot).
- Basemap tiles (map still shows boundaries/points/analysis without them, just no street backdrop).
- The hosted URL, if you're not running locally.
