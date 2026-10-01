# ADate

Make a cute invite page (romantic ask, hang out, coffee, birthday…) and send the link. Phone-first, free, no sign-up.
Static site: plain HTML + CSS + JS, no build step.

## What it does
- **Wizard for the sender:** names & vibe → words (✨ AI suggestions on every line) → main picture → wallpaper (vibes, world cities, Lebanese places) → the sneaky "No" button → stickers → send.
- **Receiver flow:** ask → yay → day + time (with a pick-up countdown) → options → final message written by AI → send answer.
- **Inbox for the sender:** no login. Each invite has a secret owner key; open your private link to see when it was opened and what she answered.

## Backend (free): Vercel + Neon
- `api/handler.js` is the whole API (one Vercel function). Data lives in Neon Postgres (`db/schema.sql`).
- Env vars on Vercel: `DATABASE_URL` (Neon connection string) and `ADMIN_KEY` (opens `#/admin`, the owner dashboard with every number, CSV export).
- No user accounts: each invite has a secret owner token; the private link `#/d/<id>.<token>` opens its inbox.
- If `/api` isn't there (GitHub Pages or a plain file server) the site falls back to **demo mode**: the invite lives inside the link and the answer goes out by WhatsApp/share.
- Vercel's free Hobby plan is for non-commercial use. Before charging money, move `api/handler.js` to a plan or host that allows it (for example Cloudflare Workers).

## AI suggestions
`js/ai.js` first asks a free text endpoint (Pollinations, no key; see `aiUrl` in `config.js`) and falls back to built-in lines when it is slow or down. Set `aiUrl: ''` to use only the built-in lines.

## Run locally
    python3 -m http.server 8000   # http://localhost:8000

## Hosting
The whole repo deploys to Vercel as-is (static files + `/api`). No build step.

Programming by [the author](https://github.com/moemenakari).
