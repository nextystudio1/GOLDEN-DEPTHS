# GOLDEN DEPTHS

GOLDEN DEPTHS is an original browser-based 2D side-view mining sandbox prototype. It is built with HTML, CSS, Canvas and JavaScript, with Supabase Auth/Postgres for online player data and GitHub Pages for static hosting.

## Current playable systems

- Side-view platform movement, jumping, mining and touch controls for mobile.
- Procedurally generated underground world with surface terrain, caves and several ore types.
- Slime encounters, health and respawn.
- Backpack, local guest progress, crafting recipes, selling and pickaxe upgrades.
- Supabase account registration/login and server-side mining, inventory, gold and upgrade RPCs.
- Player-to-player trade offers with create, accept and cancel RPCs.
- Online world chunk save/load and basic player-position presence sync.
- Original project-created pixel SVG terrain/ore atlas and miner character sprite.

## Technology

- Frontend: HTML, CSS, JavaScript Canvas.
- Backend: Supabase Auth, Postgres, RPC and Realtime Postgres Changes.
- Hosting and CI: GitHub Pages and GitHub Actions / Playwright.

The browser client uses only the public Supabase anon key in `config.js`. Never put a service-role key or other server secret in this repository.

## Test

Run locally:

```bash
npm install
npx playwright install chromium
npm test
```

GitHub Actions also runs static smoke checks and a browser gameplay test on pushes to `main`.

## Important release status

This repository is still under development and is **not yet a verified production release**. The current browser test covers guest entry, visible world rendering, sprite loading, and a mining interaction. It does not yet prove the complete account, trade, persistence, or simultaneous multiplayer flows with multiple real test accounts.

Online chunk persistence and presence are implemented in the client, but need dedicated authenticated multi-client verification. Presence is a lightweight synchronization feature, not an authoritative multiplayer game server or anti-cheat system. Payment/top-up features are not included.

## Art and licensing

The terrain/ore atlas and miner sprite currently used by the game are original SVG artwork created for this project. The project also documents Kenney CC0 packs as approved sources for future additions; a listed source must not be described as integrated until its files are actually included and tested.

- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — CC0, attribution appreciated but not required.
- [Kenney Platformer Art Pixel](https://kenney.nl/assets/platformer-art-pixel) — CC0.

No proprietary sprites, maps, names or UI artwork from other commercial games should be copied into this project.

## Deployment

GitHub Pages is configured through the repository's Actions workflow. A successful deployment means the static site was published; it does not by itself mean every online game feature has passed end-to-end testing.
