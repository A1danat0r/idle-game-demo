import { itemName } from './content';
import type { FloatNote } from './engine';

/** Completions inside this window share one popup. */
export const FLOAT_BATCH_MS = 400;
/** How many floating texts may be on screen at once. */
export const FLOAT_CAP = 3;
/** How long a floater stays up, matching the CSS animation. */
export const FLOAT_LIFE_MS = 1100;

export interface FloaterView {
  tone: 'action' | 'player' | 'enemy' | 'miss' | 'heal' | 'toast';
  place: 'bar' | 'combat';
  text: string;
}

function fmtQty(amount: number): string {
  const rounded = Math.round(amount * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** One action popup: XP rounded down, like the rest of the UI, plus the items gained. */
export function formatActionNotes(notes: Extract<FloatNote, { kind: 'action' }>[]): string {
  const xp = new Map<string, number>();
  const items = new Map<string, number>();
  for (const note of notes) {
    if (note.xp > 0) xp.set(note.skill, (xp.get(note.skill) ?? 0) + note.xp);
    if (note.qty > 0) items.set(note.itemId, (items.get(note.itemId) ?? 0) + note.qty);
  }
  const lines: string[] = [];
  const skills = [...xp.entries()];
  for (const [skill, amount] of skills) {
    const shown = Math.floor(amount);
    if (shown <= 0) continue;
    lines.push(skills.length === 1 ? `+${shown} XP` : `+${shown} ${skill} XP`);
  }
  for (const [id, qty] of items) lines.push(`+${qty} ${itemName(id)}`);
  return lines.join('\n');
}

/** Merge a burst of notes into at most FLOAT_CAP texts. Extra hits keep the latest ones. */
export function presentNotes(notes: FloatNote[]): FloaterView[] {
  const actions = notes.filter((note): note is Extract<FloatNote, { kind: 'action' }> => note.kind === 'action');
  const views: FloaterView[] = [];
  const actionText = formatActionNotes(actions);
  if (actionText) views.push({ tone: 'action', place: 'bar', text: actionText });
  for (const note of notes) {
    if (note.kind === 'player-hit') views.push({ tone: 'player', place: 'combat', text: fmtQty(note.amount) });
    else if (note.kind === 'enemy-hit') views.push({ tone: 'enemy', place: 'combat', text: `-${note.amount}` });
    else if (note.kind === 'miss') {
      views.push({ tone: note.side === 'enemy' ? 'enemy' : 'miss', place: 'combat', text: 'Miss' });
    }
    else if (note.kind === 'heal') views.push({ tone: 'heal', place: 'combat', text: `+${note.amount}` });
    else if (note.kind === 'toast') views.push({ tone: 'toast', place: 'bar', text: note.text });
  }
  if (views.length <= FLOAT_CAP) return views;
  const lead = views.filter((view) => view.place === 'bar');
  const rest = views.filter((view) => view.place === 'combat');
  return [...lead, ...rest.slice(-(FLOAT_CAP - lead.length))];
}
