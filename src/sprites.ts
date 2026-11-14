/**
 * Placeholder pixel sprites. Size, palette and the final drawings are not decided.
 * Each enemy is one grid in ENEMY_SPRITES. The player is PLAYER_SPRITE.
 * Combat only calls enemyFigure(id) or playerFigure(); it does not contain art.
 * Swap a grid here to change a picture.
 */

export type PixelSprite = readonly string[];

/** Placeholder colours. Recolour a letter here without touching a grid. */
const PALETTE: Record<string, string> = {
  k: '#16101c',
  s: '#ffd0ae',
  p: '#241c38',
  w: '#fffaf4',
  i: '#ffffff',
  m: '#d86878',
  r: '#f4a8b0',
  a: '#ee7aa2',
  A: '#c44e76',
  d: '#6b58cc',
  D: '#43368f',
  b: '#2a2434',
  t: '#e4b86e',
  T: '#b88840',
  u: '#f6e6c4',
  n: '#ee8894',
  g: '#a8a29a',
  G: '#6c6862',
  c: '#f4e8d0',
  C: '#d4c4a0',
  h: '#efe8d8',
  H: '#cbb892',
  y: '#3e9a4c',
  Y: '#246632',
  z: '#8ed468',
  j: '#2c8c42',
  J: '#164828',
  f: '#3d96d0',
  F: '#24648e',
  q: '#f0c85a',
  v: '#e4eef6',
  o: '#e87838',
  O: '#c05020',
  l: '#d6e278',
  L: '#a8bc50',
  x: '#3a8a48',
  X: '#245c30',
  B: '#8a6844',
  e: '#5c4028',
  '1': '#6a4030',
  '2': '#4a2c20',
  '3': '#c88858',
  '4': '#f4e6b0',
  '5': '#3a3224',
  '6': '#4a6a40',
  '7': '#2e4428',
  '8': '#8a5c32',
};

/** Chibi girl. Hair, large eyes, dress. Not a combat stat. */
export const PLAYER_SPRITE: PixelSprite = sprite([
  '................',
  '.....aaaaaa.....',
  '...aaAaaaaAaa...',
  '..aAassssssAAa..',
  '.aaassssssssaaa.',
  '.aasswpiwpiissaa',
  '.aasswpiwpiissaa',
  '.aarsswwwwssraa.',
  '.aaasssmmsssaaa.',
  '..aaassssssaaa..',
  '...aaAAAAAAaa...',
  '....dddddddd....',
  '...ddssssssdd...',
  '..ddssddddssdd..',
  '...dddddddddd...',
  '....ddd..ddd....',
  '.....bb..bb.....',
  '.....bb..bb.....',
]);

/**
 * One grid per enemy id. Meadow verge, then Woodland edge.
 * Tall ears, a tail, horns, a shell, a beak, tusks and a hat are the silhouettes.
 */
export const ENEMY_SPRITES: Record<string, PixelSprite> = {
  'meadow.hare': sprite([
    '..n......n......',
    '.tnn....nnnt....',
    '.tnn....nnnt....',
    '.ttn....nttt....',
    '..tttttttttt....',
    '.ttsswpiwptt....',
    '.tttsssssstt....',
    '..tttnntttt.....',
    '...ttttttt......',
    '....tttttt......',
    '...ttuuuutt.u...',
    '..tttttttttt....',
    '...ttt..ttt.....',
    '...bb....bb.....',
  ]),
  'meadow.rat': sprite([
    '....ii....ii....',
    '...iggggggggi...',
    '....gswpiwpgg...',
    '....ggsssggg....',
    '.....ggnggg.....',
    '....gggggggg....',
    '...gggggggggg...',
    '....ggg..gggg...',
    '.....gg..ggg....',
    '..........gg....',
  ]),
  'meadow.ram': sprite([
    '.hh........hh...',
    'hHh........hHh..',
    'hHh........hHh..',
    '.hhcccccccchh...',
    '..ccswpiwpcc....',
    '..ccccsscccc....',
    '...cccccccc.....',
    '..cccccccccc....',
    '.cccccccccccc...',
    '.cccuuuuucccc...',
    '.cccccccccccc...',
    '..ccc....ccc....',
    '..bb......bb....',
  ]),
  'meadow.moss': sprite([
    '.....zzzz.......',
    '...yyyzzzyyy....',
    '..yYyyyyyyyyY...',
    '.yYyswpiwpyYy...',
    '.yyyyyyyyyyyy...',
    '..yYyzzzzyYy....',
    '.yyYyyyyyyYyy...',
    '..yyyyyyyyyy....',
    '...yYYYYYYy.....',
  ]),
  'meadow.beetle': sprite([
    '...k........k...',
    '..k..........k..',
    '.....jjjjjj.....',
    '....jJjjjjJj....',
    '...jjswpiwpjj...',
    '..jjjJjjjjJjjj..',
    '..jjjjjjjjjjjj..',
    '...jjjJjjJjjj...',
    '....jjjjjjjj....',
    '...k.k....k.k...',
    '..k...k..k...k..',
  ]),
  'wood.jay': sprite([
    '......ffff......',
    '....ffFfffff....',
    '...ffswpffqf....',
    '..fffswpfffqff..',
    '..fffffffffff...',
    '...ffvvvvfff....',
    '..fffffffffff...',
    '....fffffff.....',
    '....fff.fff.....',
    '....k.....k.....',
  ]),
  'wood.fox': sprite([
    '...oo......oo...',
    '..oooooooooooo..',
    '...ooswpiwpoo...',
    '...ooossssooo...',
    '....ooonnooo....',
    '...oooooooooo...',
    '....ouuuuuuo....',
    '...oooooooooo...',
    '....ooo..ooooo..',
    '....oo....oooo..',
    '..........oooo..',
  ]),
  'wood.grub': sprite([
    '..lllllllllll...',
    '.lLlswpilLLLll..',
    '.llllssssLLlll..',
    '..lLLLLLLLLLl...',
    '...llllllllll...',
  ]),
  'wood.tortoise': sprite([
    '......BB........',
    '.....BssB.......',
    '.....BwpB.......',
    '...xxxxxxxx.....',
    '..xXxxxxxxXx....',
    '.xXxzzxzxzxXx...',
    '.xXxxxxxxxxXx...',
    '..xXxxxxxxXx....',
    '...xxxxxxxx.....',
    '..ee......ee....',
    '..ee......ee....',
  ]),
  'wood.boar': sprite([
    '...11....11.....',
    '..1222..2221....',
    '..12wpiwpw21....',
    '...13333331.....',
    '..14413331441...',
    '...11111111.....',
    '..1111111111....',
    '.111111111111...',
    '.1111....1111...',
    '..22......22....',
  ]),
  'wood.poacher': sprite([
    '....55555555....',
    '...5555555555...',
    '..555555555555..',
    '...55ssssss55...',
    '....sswpiwps....',
    '....ssssssss....',
    '.....ssmmss.....',
    '...6666666666...',
    '..666666666666..',
    '.66ss666666ss8..',
    '.6666666666688..',
    '..66666666688...',
    '...66....66.....',
    '...bb....bb.....',
  ]),
};

function sprite(rows: string[]): PixelSprite {
  const width = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== width) throw new Error(`sprite row has ${row.length} pixels, expected ${width}: ${row}`);
    for (const pixel of row) {
      if (pixel !== '.' && PALETTE[pixel] == null) throw new Error(`unknown pixel "${pixel}"`);
    }
  }
  return rows;
}

/** Draw a grid as hard-edged pixels. The requested width snaps to a whole number of pixels. */
function renderSprite(id: string, rows: PixelSprite, requested: number): string {
  const cols = rows[0]?.length ?? 1;
  const scale = Math.max(1, Math.round(requested / cols));
  const rects: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const fill = PALETTE[row[x]];
      if (!fill) continue;
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`);
    }
  });
  const width = cols * scale;
  const height = rows.length * scale;
  return `<svg class="pixel" data-art="${id}" width="${width}" height="${height}" viewBox="0 0 ${cols} ${rows.length}" shape-rendering="crispEdges" style="image-rendering:pixelated" aria-hidden="true">${rects.join('')}</svg>`;
}

/** The picture for an enemy. An unknown id still draws, using the hare grid, so the screen cannot go blank. */
export function enemyFigure(id: string, w = 84): string {
  return renderSprite(id, ENEMY_SPRITES[id] ?? ENEMY_SPRITES['meadow.hare'], w);
}

/** The player picture. Same renderer as the enemies, so it swaps the same way. */
export function playerFigure(w = 84): string {
  return renderSprite('player', PLAYER_SPRITE, w);
}
