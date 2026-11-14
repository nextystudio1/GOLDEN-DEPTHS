# GOLDEN DEPTHS

GOLDEN DEPTHS is an original browser-based 2D side-view mining sandbox prototype. It is built with HTML, CSS, Canvas and JavaScript, with Supabase Auth/Postgres for online player data and GitHub Pages for static hosting.

## Current playable systems

- Side-view platform movement, jumping, mining and touch controls for mobile.
- Expanded 360 × 120 tile procedural world with caves, ore layers, pixel-art surface trees and four biome palettes: Verdant Fields, Amber Dunes, Frost Hollow and Ember Depths.
- Full-world map overlay with a live player-position marker.
- Slime encounters, health and respawn.
- Backpack, local guest progress, crafting recipes, selling and pickaxe upgrades.
- Supabase account registration/login and server-side mining, inventory, gold and upgrade RPCs.
- Player-to-player trade offers with create, accept and cancel RPCs.
- Online world chunk save/load, conflict-aware saves, and basic player-position/world-change synchronization.
- Server-side mining cooldown and login-safe username generation.
- Live Crystal Rush event with a temporary increased Crystal Shard drop chance.
- Original project-created pixel SVG terrain/ore atlas and miner character sprite.

## Technology

- Frontend: HTML, CSS, JavaScript Canvas.
- Backend: Supabase Auth, Postgres, RPC and Realtime Postgres Changes.
- Hosting and CI: GitHub Pages and GitHub Actions / Playwright.

The browser client uses only the public Supabase anon key in `config.js`. Never put a service-role key or other server secret in this repository. Game RPCs are restricted to authenticated users, player-owned rows use RLS, and public event reads are limited to currently published event windows.

## Test

Run locally:

```bash
npm install
npx playwright install chromium
npm test
```

GitHub Actions also runs static smoke checks and a browser gameplay test on pushes to `main`.

## Important release status

This repository is still under development and is **not yet a verified production release**. The current six-test Playwright suite covers guest entry, visible world rendering, sprite loading, expanded world dimensions, mining, failed online mining behavior, online chunk-save wiring, the live event panel, full-world map and player marker, trade purchase UI/RPC wiring, and landscape controls/player movement using mocked Supabase clients. Database transaction checks have also exercised player start/duplicate usernames, trade escrow/accept/cancel and mining cooldown with temporary test records that were cleaned up afterward. These checks do not yet prove simultaneous multiplayer synchronization with multiple real authenticated clients.

Online chunk persistence and presence are implemented in the client, but need dedicated authenticated multi-client verification. The database now limits mining RPC frequency and restricts game RPC execution to authenticated users; these protections still need end-to-end testing with real accounts. Presence is a lightweight synchronization feature, not an authoritative multiplayer game server or anti-cheat system. Payment/top-up features are not included.

## Art and licensing

The terrain/ore atlas and miner sprite currently used by the game are original SVG artwork created for this project. The project also documents Kenney CC0 packs as approved sources for future additions; a listed source must not be described as integrated until its files are actually included and tested.

- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — CC0, attribution appreciated but not required.
- [Kenney Platformer Art Pixel](https://kenney.nl/assets/platformer-art-pixel) — CC0.

No proprietary sprites, maps, names or UI artwork from other commercial games should be copied into this project.

## Deployment

GitHub Pages is configured through the repository's Actions workflow. A successful deployment means the static site was published; it does not by itself mean every online game feature has passed end-to-end testing.
