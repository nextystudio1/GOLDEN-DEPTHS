# GOLDEN DEPTHS

GOLDEN DEPTHS is an original 2D side-view mining sandbox for web and Android. The browser client is built with HTML, CSS, Canvas and JavaScript. Supabase Auth, Postgres RPC and Realtime provide online accounts, inventory, shared-world changes and player trading.

## Playable systems

- Landscape-friendly side-view movement, jumping, touch controls and keyboard controls.
- Procedural 360 × 120 tile world with caves, ore layers, surface trees and four biome palettes: Verdant Fields, Amber Dunes, Frost Hollow and Ember Depths.
- Direct block mining: tap and hold the block itself; show mining feedback and collect drops.
- Server-validated online mining: the server checks the requested tile, player reach, cooldown and whether another player already mined it. Block removal and inventory reward are committed together.
- Shared world chunks with revision tracking and Supabase Realtime updates.
- Full-world map, player marker, online player presence, slime encounters, health and respawn.
- Backpack, guest progress, crafting, selling, Gold and an upgrade shop.
- Player-to-player trade: select another player, send a request, accept or decline, set item/Gold offers, and have both players confirm. The final exchange is processed transactionally on the server.
- Crystal Rush event with a temporary Crystal Shard bonus.
- Account deletion in-game and through a public web page.

## Play online

- Game: https://nextystudio1.github.io/GOLDEN-DEPTHS/
- Privacy policy: https://nextystudio1.github.io/GOLDEN-DEPTHS/privacy.html
- Account deletion: https://nextystudio1.github.io/GOLDEN-DEPTHS/account-deletion.html

Online accounts, multiplayer, trade and server saves require an internet connection. Guest play stores its progress locally on the current device.

## Android

The Android WebView wrapper loads a local copy of the game and its SVG assets in landscape immersive mode. Online features still require internet access.

- Android package: `com.nextystudio.goldendepths`
- Version: `0.2.0` (versionCode 2)
- Compile/target SDK: 36
- Debug APK workflow: **Build Golden Depths APK**
- Signed Play bundle workflow: **Build Golden Depths Play release**

The debug APK is for testing and is not a Play Store release. The signed release workflow requires these GitHub Actions repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep the upload keystore and passwords private and maintain a secure backup. Never commit them to this repository or send them in chat.

## Backend and security

- Supabase Auth for accounts.
- Supabase Postgres RPC for inventory, mining, Gold, upgrades and trades.
- Supabase Realtime for player presence, trade updates and shared-world chunk updates.
- Public gameplay RPCs run as invoker wrappers and call restricted functions in the non-exposed `private` schema. Gameplay actions require an authenticated account.
- The browser repository contains only the public Supabase anon key in `config.js`. Never put a service-role or secret key in the client.
- Account deletion is handled by the `delete-account` Edge Function with JWT verification. User-owned game data is removed; shared world chunks remain and lose their account attribution.
- Movement and presence are still lightweight client-synchronized data. This is not a dedicated authoritative multiplayer server or a complete anti-cheat system.
- Payment and top-up features are not included.

## Development and tests

Run locally:

```bash
npm install
npx playwright install chromium
npm test
```

GitHub Actions runs static checks and Playwright browser tests on pushes to `main`. Database smoke tests use temporary records inside rollback-only transactions. The current browser suite contains 12 tests; successful CI is evidence for the tested flows, not proof of every device/network combination.

## Release status

This repository is a release candidate, not yet a verified public production release. Before publishing:

1. Run the browser and Android CI workflows and confirm they pass on the final commit.
2. Install the APK on a real Android phone and test landscape layout, login, mining, trade, account deletion and reconnect behavior.
3. Configure the four Android signing secrets and build the signed AAB.
4. Add a public support email to the Play Store listing.
5. Complete Play Console app-content, content-rating and Data safety declarations, and submit the privacy-policy and account-deletion URLs.
6. Confirm the publishing account meets Google Play's current account and age requirements.

## Art and licensing

The terrain/ore atlas and miner sprite currently used by the game are original SVG artwork created for this project. Kenney CC0 packs are documented as approved sources for future additions; a listed source must not be described as integrated until its files are actually included and tested.

- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — CC0, attribution appreciated but not required.
- [Kenney Platformer Art Pixel](https://kenney.nl/assets/platformer-art-pixel) — CC0.

No proprietary sprites, maps, names or UI artwork from other commercial games should be copied into this project.
