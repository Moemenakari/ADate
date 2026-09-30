# ADate

Make a cute invite page (romantic ask, hang out, coffee, birthday…) and send the link. Phone-first, free, no sign-up.
Static site: plain HTML + CSS + JS, no build step.

## What it does
- **Wizard for the sender:** names & vibe → words (✨ AI suggestions on every line) → main picture → wallpaper (vibes, world cities, Lebanese places) → the sneaky "No" button → stickers → send.
- **Receiver flow:** ask → yay → day + time (with a pick-up countdown) → options → final message written by AI → send answer.
- **Inbox for the sender:** no login. Each invite has a secret owner key; open your private link to see when it was opened and what she answered.

## Two modes
| | Demo mode (default) | With the free Supabase backend |
|---|---|---|
| Invite link | long, contains the whole invite | short `#/i/abc123` |
| Her answer | WhatsApp / share / copy | saved, shown in your inbox |
| Setup | none | one SQL file + 2 keys |

### Turn on the backend (free)
1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL editor. Tables are locked; the site only uses the listed functions.
3. Put the Project URL and the **anon** key in `config.js` (`supabaseUrl`, `supabaseKey`). The anon key is meant to be public.

## AI suggestions
`js/ai.js` first asks a free text endpoint (Pollinations, no key; see `aiUrl` in `config.js`) and falls back to built-in lines when it is slow or down. Set `aiUrl: ''` to use only the built-in lines.

## Run locally
    python3 -m http.server 8000   # http://localhost:8000

## Free hosting (GitHub Pages)
Repo Settings → Pages → Source: **GitHub Actions**. `.github/workflows/pages.yml` publishes on every push to `main`.

Programming by [Moemen Akari](https://github.com/moemenakari).
