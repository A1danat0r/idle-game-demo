# Still not covered by the approved spec

Spec r2 (sha256 `8cdf8506554acdc09d941237533faf9c7308c6e34b203b83c39625b7476e500d`) is approved for the draft, including the t310 gold economy. Nothing in this build is still provisional.

## Accepted as built

These were open here and are now spec wording. The constants stay, because they are the values the spec now states.

- Regen and an action on the same instant: regen applies first (`REGEN_BEFORE_ATTACK_ON_TIE`).
- Second tab: the running tab renews its lock every second. Another tab may take over only after 4 seconds of silence, on reload, and shows the notice until then (`TAB_LOCK_STALE_MS`).
- Catch-up pop-up: on load or return when at least 1 second was credited, the 24 hour cap cut the window, or the clock went backwards. A visible-tab gap under 5 seconds is credited with no pop-up (`CATCHUP_REPORT_MIN_MS`, `SILENT_GAP_MS`).
- Inventory selling: Sell 1 and Sell all, both instant.
