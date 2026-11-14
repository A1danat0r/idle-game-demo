/**
 * Constants that implement the approved spec.
 * Spec r2 sha256 8cdf8506554acdc09d941237533faf9c7308c6e34b203b83c39625b7476e500d.
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

/** Remembered Debug switch. localStorage, so it survives reloads in the browser and in the installed app. */
export const DEV_STORAGE_KEY = 'idle-game-demo-dev';

/** Dev tools render when the URL query is ?dev=1. */
export function devToolsRequested(search: string): boolean {
  return new URLSearchParams(search).get('dev') === '1';
}

/**
 * Tools are on when this visit's link asks for them, or when the remembered switch is on.
 * A stored "0" does not hide a link that still says ?dev=1.
 */
export function devToolsEnabled(search: string, stored: string | null): boolean {
  return devToolsRequested(search) || stored === '1';
}
