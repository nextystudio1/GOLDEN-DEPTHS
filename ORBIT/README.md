# ORBIT — Worlds Beyond

An original pixel-art side-view sandbox game prototype, maintained in an isolated folder and branch inside GOLDEN-DEPTHS. This is inspired by the broad sandbox genre, not a copy of Pixel Worlds assets, UI, branding, maps, or proprietary content.

## Current client build
- Landscape and portrait responsive canvas, pixel-art tiles drawn in code.
- Side-view movement, jump, touch and keyboard controls.
- Mine/place blocks, hotbar, backpack, material drops and a starter crafting interaction.
- Procedural terrain, trees, ore and crystals.
- Local worlds list and local save for map/inventory/player.
- Supabase project client configuration uses only the public publishable key.

## Not yet release-ready
This branch is a client gameplay foundation. It does not yet implement authenticated world creation, shared chunk persistence, realtime multiplayer, secure server-authoritative mining/rewards, full trading/market, chat/moderation, complete item content, Android packaging/signing, or production tests. Local worlds are device-local, not shared online. Do not advertise multiplayer until backend functions and multiplayer tests exist.

## Project boundary
The older root-level GOLDEN-DEPTHS game is left untouched. ORBIT is under `ORBIT/` on branch `orbit-development`.
