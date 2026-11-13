/**
 * Constants that implement the approved spec.
 * Spec r2 sha256 ae654ead1a207010a454deb78186c4c360f8897c3699fad50f3e372ba09003f9.
 */

/**
 * §5: if a regen tick and an action fall on the same instant, regen applies first.
 * Editorial wording, Nora 2026-11-13. This is how the build already worked.
 */
export const REGEN_BEFORE_ATTACK_ON_TIE = true;

/**
 * §6.6: the running tab renews its lock every second. Another tab may take
 * over only after 4s of silence, and only on reload. Until then it shows the notice.
 * Editorial wording, Nora 2026-11-13.
 */
export const TAB_LOCK_STALE_MS = 4000;

/**
 * §7.1: gaps under 5s in a visible tab are credited silently.
 * Editorial wording, Nora 2026-11-13.
 */
export const SILENT_GAP_MS = 5000;

/**
 * §7.1: show the catch-up pop-up on load or return when at least 1s was
 * credited, the 24h cap cut the window, or the clock went backwards.
 * Editorial wording, Nora 2026-11-13.
 */
export const CATCHUP_REPORT_MIN_MS = 1000;

/** Dev tools render only when the URL query is ?dev=1. */
export function devToolsRequested(search: string): boolean {
  return new URLSearchParams(search).get('dev') === '1';
}
