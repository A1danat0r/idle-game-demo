# Still not covered by the approved spec

Spec r2 (sha256 `680c583358758c5642348cdeba5c222c5d72e1f9e337907eaf8fe57778d8e56b`) is approved for the draft. Editorial wording from 2026-11-13 is included. No numbers, pacing, gear stats, or Forest fox level changed in that wording pass.

## Forest fox level

`FOREST_FOX_LEVEL = 10` in `src/provisional.ts`.

Spec §2.5 still says the Forest fox has no catalogue level and that 10 is a placeholder. HP (60) and max hit (3) are derived from that number. Gear stats are also still undecided; worn gear has no stats.

**Question:** what level is the Forest fox?

## Accepted as built

These were open here and are now spec wording. The constants stay, because they are the values the spec now states.

- Regen and an action on the same instant: regen applies first (`REGEN_BEFORE_ATTACK_ON_TIE`).
- Second tab: the running tab renews its lock every second. Another tab may take over only after 4 seconds of silence, on reload, and shows the notice until then (`TAB_LOCK_STALE_MS`).
- Catch-up pop-up: on load or return when at least 1 second was credited, the 24 hour cap cut the window, or the clock went backwards. A visible-tab gap under 5 seconds is credited with no pop-up (`CATCHUP_REPORT_MIN_MS`, `SILENT_GAP_MS`).
- Inventory selling: Sell 1 and Sell all, both instant.
