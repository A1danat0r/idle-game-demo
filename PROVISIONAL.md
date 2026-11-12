# Still not covered by the approved spec

Spec r2 (sha256 `5555883ad744b977c729238a40046de2beab3daa5de7742b02054f4483eea361`) is approved for the draft. The rules below are the only ones it still does not settle. Each has a named constant in `src/provisional.ts` except the sell buttons, which are plain UI.

## Forest fox level

`FOREST_FOX_LEVEL = 10` in `src/provisional.ts`.

Spec §2.5 still says the Forest fox has no catalogue level and that 10 is a placeholder. HP (60) and max hit (3) are derived from that number.

**Question:** what level is the Forest fox?

## Regen and an attack on the same timestamp

`REGEN_BEFORE_ATTACK_ON_TIE = true`.

**Question:** if regen and an attack fall on the same timestamp, which resolves first?

## Second tab

`TAB_LOCK_STALE_MS = 4000`.

The spec says only one tab runs and the other shows a notice. It does not say how long a silent tab keeps the lock, or whether a blocked tab may take over without a reload. This demo keeps the lock for 4 seconds of heartbeats and the blocked tab stays on the notice until it is reloaded.

**Question:** how long after a tab goes silent may another tab take over, and must that tab be reloaded?

## When the catch-up pop-up appears

`SILENT_GAP_MS = 5000` and `CATCHUP_REPORT_MIN_MS = 1000`.

A visible gap shorter than 5 seconds is applied with no pop-up. A credited window shorter than 1 second does not open the pop-up, unless the 24 hour cap cut it or the clock moved backwards. The spec says the report is a pop-up on load and does not set a minimum.

**Question:** should every non-zero catch-up, including a fraction of a second, open the pop-up?

## Sell quantity

Inventory has Sell 1 and Sell all. Selling is instant either way. The spec does not say how many of a stack one tap sells.

**Question:** is selling one at a time, the whole stack, or both?
