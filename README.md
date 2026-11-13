# Idle

A phone idle game in the Melvor style. Installable web app, TypeScript and Vite, no framework. The rules are the approved draft in the project spec (16 gathering nodes, 12 Cooking recipes, 28 Smithing recipes, 11 enemies).

Equipment has three slots: weapon, body, and shield. Weapons add Accuracy and Power. Bronze and iron body armour and the bronze shield add Guard. Crafted gear stays in the bank until you equip it. The Forest fox is level 8.

## Run

```bash
npm install
npm run dev
```

Open the printed URL. The app is sized for a portrait phone (about 390×844). Production build:

```bash
npm run build
npm run preview
```

The built files are served under `/idle-game-demo/`, which is the GitHub Pages path.

## Test

```bash
npm test
```

That runs the engine tests: XP and prices, action timers, tools, combat (120 XP per kill, hit chance, one enemy attack per swing), the reference-route pacing bands, save/load, a corrupt save, offline progress, and the shop restock.

`npm run route` prints the section 4 official route. It drives the real engine: Smithing first, then the iron spear is forged and equipped before any combat. Loot is credited at expected value, which is how that route was computed. Hit rolls still use the seeded generator, with the equipped weapon's Accuracy and Power. With node and enemy mastery, the bands are 0.494–0.546h, 1.149–1.27h, and 16.626–20.458h.

## Dev tools

Add `?dev=1` to the URL. Nothing in the ordinary game links to this. The Dev button then opens a panel that can:

- move the clock forward or back, through the same offline rules as a real return
- edit coins, a skill level, or grant an item
- export and import the save as JSON, including the stats log (actions, kills, swings, misses, food, coins by source)
- play the section 4 reference route
- measure hit rates, the Attack 1 kill cycle, poacher coins, and the survivability samples

The header shows the build label `demo-dev` and the short commit it was built from.

## Offline

The app stores the game in `localStorage` (`saveFormat` 2, with node and enemy mastery XP). A format-1 save loads with empty mastery maps. Closing it and coming back credits up to 24 hours of the activity you left running. The catch-up pop-up opens on load or when you return if at least 1 second was credited, the 24 hour cap cut the window, or the clock went backwards. A gap under 5 seconds while the tab stays visible is credited with no pop-up.

A backwards clock credits nothing and sets the last-credited time to the current clock. Moving the clock forward after that credits the new window. Reloading, or a second tab, does not credit the same window twice.

The running tab renews its lock every second. Another tab shows a notice until it is reloaded, and it can take over only after 4 seconds of silence. The activity bar sits in the bottom bar, directly above the tabs. Inventory sells with Sell 1 and Sell all, both instant. After one online visit, the service worker can open the app shell offline.
