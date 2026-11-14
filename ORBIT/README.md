# ORBIT — Worlds Beyond

ORBIT is an original 2D side-view pixel sandbox project. It borrows broad genre ideas such as mining, building, exploration, and player-made worlds, but does not copy Pixel Worlds branding, proprietary sprites, maps, or UI.

## Implemented foundation
- Responsive landscape-first canvas game with touch and keyboard movement.
- Procedural local world plus server-generated deterministic online terrain.
- Mining and block placement; online tile changes and inventory rewards are processed through authenticated server RPCs.
- Starter item catalog seeded in Supabase.
- Email/password sign-up and sign-in using Supabase Auth.
- Player profiles and profile-backed level/coin display.
- Create public worlds, join worlds, load/save chunk state.
- Realtime world chunk updates and player-presence positions.
- Local offline save and a basic PWA shell.
- Capacitor Android project configuration and GitHub Actions debug APK build.

## Backend security
- All public game tables have RLS enabled.
- Direct client writes to inventory, market listings, trades, world membership, and world chunks are revoked.
- Validated game RPC implementations live in the non-exposed `orbit_private` schema; only invoker wrappers are exposed for authenticated users.
- No service-role or secret key is shipped to the client.
- Security advisor was checked after the RPC move; it returned no security lints.

## Not release-ready yet
This is still an early online gameplay foundation, not a finished commercial game. The following are not implemented or not production-tested:
- Full trade negotiation/acceptance and a secure player market checkout.
- Chat, friend list, party/permissions, moderation, reports, and world rollback tools.
- Farming growth cycles, crafting progression, pets, cosmetics, quests, dungeons, bosses, events, and the complete item catalogue.
- Server load testing, abuse/rate-limit review, reconnect/resume testing, and multi-device gameplay QA.
- Signed production Android release APK/AAB, app signing key management, store listing, privacy policy, and release compliance review.

## Build
GitHub Actions builds a landscape Android **debug APK** for device testing. A debug APK is not a Play Store production release. The release build must be signed with a protected keystore and pass real-device QA.

Project files are isolated under `ORBIT/` on branch `orbit-development`; the older repository root project is left untouched.
