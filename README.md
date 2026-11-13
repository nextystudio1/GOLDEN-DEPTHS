# GOLDEN DEPTHS

A browser-based online mining game starter.

## Stack
- HTML, CSS, JavaScript
- Supabase Auth and Postgres RPC
- GitHub Pages hosting

## Deploy
1. Open repository Settings → Pages.
2. Under Build and deployment choose Deploy from a branch.
3. Select branch `main` and folder `/(root)`, then Save.
4. Open the published GitHub Pages URL.

## Backend
This frontend expects the `golden_` tables and RPC functions to exist in the connected Supabase project. The browser uses only a publishable key; never put a service-role key in frontend files.

## Current scope
This is an online starter build with account login, mining RPC, backpack, selling and pickaxe upgrade. Trading, player marketplace, live events, 2D movement/combat and payments are not yet implemented.
