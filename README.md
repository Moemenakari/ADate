# ADate

Make a cute, funny invite page (romantic ask, hang out, coffee, birthday…) and send the link.
Pure static site: HTML + CSS + JS, no build step, free to host.

## How it works
- Pick who it's for and the occasion (each has its own tone and default words).
- Edit names, words, picture, theme/wallpaper, stickers, and what the **No** button does on each press.
  The last "No" press repeats forever, and only **YES** can continue.
- The whole invite is packed into the link (`#/v/...`), so there is no server or database.

## Run locally
    python3 -m http.server 8000   # then open http://localhost:8000

## Free hosting (GitHub Pages)
Repo Settings → Pages → Source: **GitHub Actions**. The workflow in `.github/workflows/pages.yml` publishes on every push to `main`.

## Optional: online sticker search
Get a free Tenor API key and put it in `config.js` (`tenorKey`). Left empty, everything else still works.
