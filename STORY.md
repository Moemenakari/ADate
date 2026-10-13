# The story of O HUB

I am Mouemen Akari, a junior student. This is how I built O HUB, what went wrong along the way, and how I fixed it.

## What I set out to do
A free, friendly, phone-first community app for teens and young adults in Lebanon and the Arab world. People chat in groups, meet in age circles, play games, and can earn and spend points. I wanted it to cost nothing to run, and still be able to earn a little through small point packs.

## How I built it
- I decided every feature myself: the match tab, the age circles, the points, the shop, the owner dashboard.
- I worked in small steps. I described one thing, tested it on my phone, and said what was wrong or what to change next.
- The app is plain JavaScript on the front end and small serverless functions on the back end, with a Postgres database. That keeps it fast and free to host.
- I used AI tools as a coding helper. The ideas, the rules and the decisions were mine, and I checked the result at every step.

## Problems I met and how I solved them
1. **The page flashed the old design when it opened.** I found the old text and the late theme loading, and replaced them with a logo screen, the right style from the first frame, and an inline theme script.
2. **A broken page after I removed old code.** One deleted function took another one with it. I restored it and now run the real pages in a headless browser after each change.
3. **The support account showed up as a person to swipe.** I filtered it out everywhere and hid its profile.
4. **Safety for young people.** Social accounts and phone numbers are only visible inside the same age group, adults only for numbers. I refused features that would put minors at risk, such as live location sharing.
5. **Payments.** I did not want card details on my site. People pay outside, then send a transaction number and a receipt, and I approve it from my dashboard.
6. **Only one admin.** No normal account can ever be an admin. The owner has a separate dashboard with its own key.
7. **Private data.** User data and the payment number live in the database only, never in this public repository.

## Tools and services I used
- GitHub for the code
- Vercel for hosting
- Neon for the Postgres database
- Web Push for phone notifications
- A headless browser and a local database for testing the real code before every release

## AI
I used AI assistants to write and review code, to explain errors, and to speed up testing. I gave the direction, the product decisions and the safety rules.

## Skills I practised
- Planning a product in small steps
- Database design and safe changes to it
- Debugging and reading error messages
- Privacy, safety and fair-use rules
- Writing a privacy policy and terms (they still need a lawyer to review them)

## Links
- App: https://adate.vercel.app
- Code: https://github.com/Moemenakari/adate
- Truth Date, my other project: https://github.com/Moemenakari/truthdate

## News
- Truth Date, the invite link game, moved into its own repository with its own database.
- Privacy and Terms pages are in.
- The app was renamed O HUB with a new logo.
- Payments by receipt, a support chat, and the two-photo profile card are live.
