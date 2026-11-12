/**
 * Only behaviour the approved spec still does not settle.
 * Everything else in the demo follows spec r2 (sha256 5555883a…).
 */

/**
 * PROVISIONAL: spec §2.5 still says the Forest fox has no catalogue level
 * and that 10 is a placeholder. HP and max hit are derived from this number.
 * Question: what level is the Forest fox?
 */
export const FOREST_FOX_LEVEL = 10;

/**
 * PROVISIONAL: the spec does not say which event wins when regen and an
 * attack fall on the same timestamp. Regen is applied first.
 * Question: if regen and an attack share a timestamp, which happens first?
 */
export const REGEN_BEFORE_ATTACK_ON_TIE = true;

/**
 * PROVISIONAL: a second tab is blocked while the other tab's heartbeat is
 * younger than this. The spec only says one tab runs and the other shows a notice.
 * Question: how long after a tab goes silent may another tab take over?
 */
export const TAB_LOCK_STALE_MS = 4000;

/**
 * PROVISIONAL: a visible-tab gap shorter than this is applied with no pop-up.
 * A longer gap, and any return from a hidden tab, uses the offline report.
 * Question: how long a gap should count as "coming back" and show the pop-up?
 */
export const SILENT_GAP_MS = 5000;

/**
 * PROVISIONAL: the catch-up pop-up is skipped when the credited window is
 * shorter than this, unless the 24h cap cut it or the clock moved backwards.
 * Question: should every non-zero catch-up, including a fraction of a second, open the pop-up?
 */
export const CATCHUP_REPORT_MIN_MS = 1000;

/** Dev tools render only when the URL query is ?dev=1. That flag is the spec's rule. */
export function devToolsRequested(search: string): boolean {
  return new URLSearchParams(search).get('dev') === '1';
}
