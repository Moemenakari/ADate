# ADate 🐱💌

> A personal project: a small, smart idea with a lot of room to grow.

ADate turns "will you go out with me?" into a little experience. Pick a vibe, add a name and a few stickers, and send a link. The other person says yes, picks a day, a time and a plan, and the answer comes back to you on WhatsApp and in your own inbox. The "No" button, of course, never wins.

**Try it:** https://adate.vercel.app

The idea is simple, but it can grow in many directions (games, communities, stories, new occasions). Where it goes next is open: see `ROADMAP.md`.

## What it does
**Sender (wizard, 7 steps):** who it's for and your WhatsApp number → words (✨ suggestions on every line, 5 tones) → round main picture → wallpaper (vibes, world cities, Lebanese places) → what the sneaky "No" button says and does on each press → stickers (drag, resize, tilt, upload your own) → preview and send.

**Receiver:** ask screen (YES grows, "No" shrinks/runs away/shakes, the last "No" line repeats forever and never continues) → yay → tap-only calendar → tap-only time → pick a plan → a warm reply written for them → **Send on WhatsApp**: one tap opens WhatsApp with a nicely formatted message and saves the same answer in the sender's inbox. The message is built instantly (the AI may only upgrade its first lines), so it can never be empty.

**Sender afterwards:** log in with your WhatsApp number + password and open your inbox: a big notification card shows each new answer (her message, date, time, plan, how many times she pressed "No"). The page refreshes by itself. Forgot the password? Answer the security question you picked.

## How it is built
| Part | What | Where |
|---|---|---|
| Frontend | Plain HTML/CSS/JS, no build step, hash routes (`#/make`, `#/i/<id>`, `#/mine`) | `index.html`, `css/`, `js/` |
| Stage | One 9:16 "phone" drawn with CSS container units, so it looks the same on every screen | `js/app.js` (`buildStage`) |
| Art | Cats/stickers and 26 wallpapers are hand-written inline SVG (no image files) | `js/stickers.js`, `js/themes.js`, `js/scenes.js` |
| Words | Tries a free text-AI endpoint, falls back instantly to built-in lines per tone | `js/ai.js` |
| API | One Vercel serverless function | `api/handler.js` |
| Database | Neon Postgres, two tables | `db/schema.sql` |
| Hosting | Vercel (static files + `/api`) | `vercel.json` |

Secrets (such as the database URL) live in Vercel environment variables, never in this repo.

**Demo mode:** if `/api` isn't reachable (plain file server, GitHub Pages) the whole invite is packed into the link (`#/v/...`) and the answer goes out by WhatsApp/share. Handy for local work.

## Design decisions
- Soft, calm colours and big touch targets; follows the phone's dark mode.
- Dates and times are **tap-only** (month names, hour/minute buttons): typing dates on phones kept breaking.
- The main picture is cropped to a circle on upload so edges never look bad.
- Phone numbers: Lebanon needs only the 8 digits; other countries pick a country code.

## Privacy
We store names, the WhatsApp numbers entered, the invite (including uploaded pictures) and the answers. Invites are reachable only by link; only the sender (private link) and the site owner can read answers. Invites can be deleted from "My invites". See `#/privacy`.

## Rough edges (honest list)
- The AI endpoint is a free third-party service; when it is slow the built-in lines are used. Not verified in every region.
- Link previews are the same for every invite (the invite id is after `#`). Per-invite previews need path URLs (`/i/<id>`) served by the API.
- Uploaded pictures travel inside the invite (shrunk). Big uploads make demo-mode links long.
- No rate limiting yet beyond size/count caps; one shared owner key.
- Automated tests don't exist; the flow was checked by driving the site in a browser against a mocked API and the SQL against the real database.
- Vercel's Hobby plan is for non-commercial use. Move the API before charging money.
- Some wallpapers (for example Beirut's rocks) are simplified illustrations.

## Run locally
    python3 -m http.server 8000     # demo mode, http://localhost:8000

## Credits
Built with AI tools as a coding helper. See `ROADMAP.md` for what comes next.
