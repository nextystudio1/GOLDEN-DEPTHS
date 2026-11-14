# ORBIT — Worlds Beyond

ORBIT is an original 2D side-view pixel sandbox project. It uses original game artwork and broad sandbox genre conventions; it does not copy Pixel Worlds branding, proprietary sprites, maps, or UI.

## Implemented foundation

- Landscape-first canvas game with touch and keyboard movement.
- Procedural world terrain, caves, ore layers, surface trees, and biome palettes.
- Mining and block placement; online tile changes and inventory rewards are validated by authenticated server RPCs.
- Supabase Auth, player profiles, public worlds, world membership, and chunk state.
- Realtime world chunk updates and player presence.
- Backpack inventory sheet with drag-to-expand and drag-to-dismiss interaction.
- Crafting, equipment progression, gathering XP, and level display.
- Chunk claims that protect blocks and farming interactions from other players.
- Local offline save and a basic PWA shell.
- Capacitor Android wrapper configured for landscape immersive fullscreen.

## Build and test

The debug workflow is **ORBIT Android Build**. It runs JavaScript/smoke checks, generates the Capacitor Android project, applies landscape/fullscreen configuration, builds an installable debug APK, and uploads it as a GitHub Actions artifact.

The latest confirmed debug build passed all workflow steps on commit `e057d397609cc8b063feeee852c306d367541f63`. Debug APKs are test builds, not Play Store releases.

## Signed production build

The manual workflow is **ORBIT Signed Production Build** in GitHub Actions. It builds both a signed release APK and a signed Android App Bundle (AAB), verifies their signatures, and uploads a release package.

Before running it, configure these four GitHub repository Actions secrets using a keystore that the project owner controls and has securely backed up:

- `ANDROID_KEYSTORE_BASE64` — Base64-encoded upload keystore file.
- `ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `ANDROID_KEY_ALIAS` — key alias inside the keystore.
- `ANDROID_KEY_PASSWORD` — key password.

Never commit a keystore or place its passwords in source code, issues, screenshots, or chat. Do not generate a different key for every release; future updates must use the same upload key (unless a formal key-reset process is completed).

## Backend and security

- Supabase Auth for accounts.
- Supabase Postgres RPC for authoritative gameplay mutations, inventory, mining, crafting, planting/harvesting, and chunk claims.
- Supabase Realtime for player presence and shared-world updates.
- Public gameplay RPC wrappers call restricted implementations in the non-exposed `orbit_private` schema.
- The browser client contains only the public publishable key. Never put a service-role or secret key in client files.
- RLS is enabled on the game tables and direct client writes to protected gameplay tables are restricted.

These controls are a security foundation, not a claim that the game has passed an independent penetration test or production abuse review.

## Release status

**Not yet approved for public production release.** A successful debug build and a configured signed-build workflow do not prove release readiness. Remaining release gates:

1. Install the newest APK on real Android devices, including a lower/mid-range phone; verify fullscreen, touch controls, backpack gestures, landscape rotation, performance, and resume/reconnect.
2. Test account creation/login, world creation/joining, mining, placement, inventory, crafting, chunk claims, and multiplayer behavior with at least two independent accounts/devices.
3. Finish privacy disclosures and a working account/data deletion process specifically for ORBIT. The older repository-root privacy and deletion pages belong to the previous game and must not be reused as if they describe ORBIT.
4. Complete moderation/reporting, abuse/rate-limit review, server load/reconnect testing, and recovery procedures before opening public multiplayer.
5. Configure the owner-controlled signing key and produce a verified signed APK/AAB.
6. Prepare store listing, support contact, content rating, Data safety, privacy URL, and account deletion URL. Publishing-account requirements must be handled by an eligible account owner/guardian where applicable.

## Intellectual property

The ORBIT terrain and character artwork are original project assets. Future external assets must be checked for license compatibility before integration. Never describe a source pack as integrated unless its files are included and tested.
