# Roadmap (ideas, not promises)

## Next
- Real phone notifications (Web Push, works when the site is added to the home screen) when someone answers.
- WhatsApp Business API (paid) to auto-send her answer to the sender without her tapping send.
- Per-invite link previews (`/i/<id>` served by the API) so WhatsApp shows a custom card.
- Share cards: export an invite or an answer as an image for Snapchat / Instagram stories.
- Rate limiting and an owner key per admin.

## Next: prove phone ownership
- Today an account is a WhatsApp number plus a password and nobody proves the number is theirs.
- Options researched: WhatsApp Business Platform code (about 1 cent per message, needs a Meta business account and a dedicated number), email magic-link login (free tier, needs a sending domain), SMS code.
- Leaning towards: email as the verified login, WhatsApp number kept as a contact picked from the phone's contacts, WhatsApp code later when there is revenue.

## Later: "Ask me" community games
- A person opens a public "Ask me anything" page and shares it.
- Friends send anonymous questions; she answers them privately or publicly.
- Share an answer as a story card to Snapchat or Instagram.
- Fun rules: only she sees who asked if she wants to; the asker can reveal themselves.
- Needs: moderation/reporting, abuse controls, age rules, and a clear privacy model (decide before building).

## Money (when there is real usage)
- Premium wallpapers, stickers and themes (anniversary, engagement, apology).
- Invites that never expire, custom link names, no footer.
- Partner places (cafés, restaurants) as sponsored plan options.
- Move the API off Vercel Hobby first.
