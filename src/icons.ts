import type { IconName } from './content';

const G = '#e8c46a';
const D = '#1a2238';
const shapes: Record<IconName, string> = {
  log: `<rect x="6" y="14" width="28" height="12" rx="6" fill="#8a5a2b"/><circle cx="32" cy="20" r="6" fill="#d9a86c" stroke="#8a5a2b" stroke-width="2"/><circle cx="32" cy="20" r="2" fill="#8a5a2b"/>`,
  hide: `<path d="M8 12 Q20 4 32 12 L30 30 Q20 36 10 30 Z" fill="#a0724a"/>`,
  meat: `<ellipse cx="18" cy="20" rx="12" ry="9" fill="#c0504d"/><rect x="27" y="17" width="8" height="5" rx="2" fill="#eee"/>`,
  berry: `<circle cx="14" cy="22" r="6" fill="#b03a6a"/><circle cx="25" cy="22" r="6" fill="#8a2f5a"/><circle cx="20" cy="13" r="6" fill="#c2457a"/>`,
  herb: `<path d="M20 34 L20 14" stroke="#4c8a3c" stroke-width="2"/><ellipse cx="14" cy="16" rx="6" ry="3" fill="#6ab04c" transform="rotate(-30 14 16)"/><ellipse cx="26" cy="12" rx="6" ry="3" fill="#6ab04c" transform="rotate(30 26 12)"/><ellipse cx="14" cy="26" rx="6" ry="3" fill="#6ab04c" transform="rotate(-30 14 26)"/>`,
  sword: `<path d="M28 6 L32 8 L16 26 L13 24 Z" fill="#c9ced6"/><path d="M10 22 L18 30" stroke="${G}" stroke-width="3"/><path d="M13 27 L8 32" stroke="#7a5230" stroke-width="3"/>`,
  shield: `<path d="M20 5 L33 10 Q33 26 20 35 Q7 26 7 10 Z" fill="#b07a3a" stroke="${G}" stroke-width="2"/><path d="M20 10 V30 M12 16 H28" stroke="${D}" stroke-width="2"/>`,
  body: `<path d="M12 8 L28 8 L34 16 L29 18 L29 34 L11 34 L11 18 L6 16 Z" fill="#9a7048"/>`,
  food: `<ellipse cx="20" cy="26" rx="14" ry="6" fill="#d9d2c0"/><ellipse cx="20" cy="22" rx="9" ry="6" fill="#b5652e"/>`,
  coin: `<circle cx="20" cy="20" r="13" fill="${G}" stroke="#a37b20" stroke-width="3"/><text x="20" y="25" text-anchor="middle" font-size="13" font-weight="bold" fill="#a37b20">c</text>`,
  ore: `<path d="M8 26 L16 10 L28 14 L34 26 L24 32 Z" fill="#c4783a"/><path d="M16 10 L20 22 L8 26 Z" fill="#e0a060"/>`,
  fish: `<ellipse cx="18" cy="20" rx="12" ry="7" fill="#5aa0c8"/><path d="M28 20 L36 12 L36 28 Z" fill="#3d7ea3"/>`,
  bar: `<rect x="6" y="16" width="28" height="10" rx="2" fill="#b87333"/><rect x="6" y="16" width="28" height="3" fill="#e0a060"/>`,
  gem: `<path d="M20 6 L32 16 L20 34 L8 16 Z" fill="#3dba8a"/>`,
  stone: `<ellipse cx="20" cy="22" rx="12" ry="8" fill="#8d8478"/>`,
  axe: `<path d="M22 6 L26 6 L24 34 L22 34 Z" fill="#7a5230"/><path d="M8 8 H24 L20 18 H10 Z" fill="#c9ced6"/>`,
  pick: `<path d="M20 16 L22 16 L22 34 L20 34 Z" fill="#7a5230"/><path d="M6 14 L34 10 L32 16 L8 18 Z" fill="#9aa3b5"/>`,
  ammo: `<path d="M12 28 L16 8 H20 L18 28 Z" fill="#c9ced6"/><path d="M24 28 L28 12 H31 L27 28 Z" fill="#b87333"/>`,
  part: `<path d="M10 24 Q20 8 30 24 L24 30 H16 Z" fill="#6d4c2f"/>`,
  moss: `<circle cx="14" cy="22" r="6" fill="#3d7a45"/><circle cx="24" cy="18" r="7" fill="#4c8a3c"/><circle cx="26" cy="26" r="5" fill="#2f5a3a"/>`,
};

export const icon = (name: IconName, size = 40) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">${shapes[name]}</svg>`;

export const chibi = (fill: string, w = 110, extra = '') => `
<svg width="${w}" height="${w * 1.3}" viewBox="0 0 100 130" aria-label="character">
  <ellipse cx="50" cy="126" rx="30" ry="4" fill="#000" opacity=".4"/>
  <rect x="34" y="70" width="32" height="38" rx="12" fill="${fill}" stroke="${G}" stroke-width="1.5"/>
  <rect x="36" y="104" width="10" height="20" rx="4" fill="${fill}"/><rect x="54" y="104" width="10" height="20" rx="4" fill="${fill}"/>
  <circle cx="50" cy="42" r="32" fill="${fill}" stroke="${G}" stroke-width="1.5"/>
  <circle cx="40" cy="46" r="4" fill="${G}"/><circle cx="60" cy="46" r="4" fill="${G}"/>
  ${extra}
</svg>`;
