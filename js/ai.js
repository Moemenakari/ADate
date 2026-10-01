// "✨ Suggest" engine. Tries a real AI endpoint first; always has instant local suggestions as a fallback.
(function () {
  const CFG = window.ADATE_CONFIG || {};
  const VIBES = [['sweet', '🥰 Sweet'], ['flirty', '😏 Flirty'], ['funny', '😂 Funny'], ['poetic', '🌙 Poetic'], ['shy', '🙈 Shy']];

  // Field meaning (used in the AI prompt) + local lines per vibe. {to}/{from} are filled at render time.
  const F = {
    title:     { what: 'the big question shown on the first screen asking the person out', max: 12 },
    sub:       { what: 'a short signature line under the big question', max: 8 },
    caption:   { what: 'a tiny extra line under the question (an inside joke, pet name or sweet detail)', max: 10 },
    yay:       { what: 'the excited headline when they say YES', max: 5 },
    yaySub:    { what: 'a warm one-sentence message shown right after they say YES', max: 16 },
    dateTitle: { what: 'the title of the screen where they pick a day and time', max: 6 },
    dateSub:   { what: 'a short line under that title', max: 10 },
    pickup:    { what: 'a playful line about picking them up from their doorstep, use the token {days} for the number of days left', max: 14 },
    actTitle:  { what: 'the title above a list of date ideas to choose from', max: 7 },
    doneTitle: { what: 'the final screen title after everything is booked', max: 6 },
    noLine:    { what: 'what the sad or cheeky "No" button caption says after being pressed', max: 9 },
    reply:     { what: 'a short warm text message from the person who said yes to the one who asked, confirming the date details', max: 45 }
  };

  const L = {
    title: {
      sweet: ['{to}, will you go out with me?', '{to}, would you be my favourite person?', '{to}, can I take you on a date?', 'Hey {to}, be mine? 💛'],
      flirty: ['{to}, say yes and I’ll make it worth it 😏', '{to}, you + me + one good night?', 'Go out with me, {to}. I dare you.', '{to}, I’m trouble. Come anyway?'],
      funny: ['{to}, hear me out: you, me, snacks?', '{to}, will you go out with me? (no pressure, lots of pressure)', 'Breaking news: {to} is invited on a date!', '{to}, wanna be my plus one?'],
      poetic: ['{to}, will you walk with me under the stars?', '{to}, let’s make tonight a memory?', 'In all the world, {to}, it’s you. Come out with me?', '{to}, would you share a sunset with me?'],
      shy: ['um… {to}, would you maybe go out with me? 🙈', '{to}, I’ve been wanting to ask you something…', '{to}, is it okay if I ask you out?', 'Hi {to}. So… a date? 🫣']
    },
    sub: {
      sweet: ['— {from}, with love', 'signed, your {from}', '— yours, {from}'], flirty: ['— {from} 😉', 'xoxo, {from}', '— {from}, your problem now'],
      funny: ['— {from} (your snack provider)', 'signed, {from}, the brave', '— {from}, nervous but cute'], poetic: ['— {from}, under the same moon', 'with all my heart, {from}', '— {from}'],
      shy: ['— {from}, nervous 🥹', 'from {from}, hands shaking', '— {from}']
    },
    caption: {
      sweet: ['You make my days softer ☁️', 'Just you and me 💛', 'Saved you the best seat'], flirty: ['Yes is the only right answer 😌', 'Wear something that makes me forget words', 'I already picked the song 🎶'],
      funny: ['Snacks are included 🍿', 'I promise to laugh at your jokes', 'Free hugs with every yes'], poetic: ['The night is better with you 🌙', 'Every road leads to you', 'Let the stars be our witnesses ✨'],
      shy: ['(my heart is beating so loud)', 'take your time… but say yes 🥺', 'I practised this for days']
    },
    yay: {
      sweet: ['YAY! 💖', 'You said yes! 🥹', 'Best day ever!'], flirty: ['Knew it 😏', 'Good choice 🔥', 'YES! Finally 😌'],
      funny: ['LET’S GOOO! 🎉', 'Victory dance! 💃', 'She said yes! 🥳'], poetic: ['My heart sings 🎶', 'A yes for the stars ✨', 'Sweetest word ever'], shy: ['wait… really?! 🥹', 'You said yes?!', 'omg yes?? 🙈']
    },
    yaySub: {
      sweet: ['Thank you. You just made my whole day.', 'My heart is doing happy little flips.', 'I’ll make it a day you never forget.'], flirty: ['You won’t regret it. Promise.', 'Get ready, it’s going to be good.', 'Clear your night, it’s all mine now.'],
      funny: ['I already told my cat. She’s thrilled.', 'I may scream into a pillow. Continue.', 'Emergency! Buy a new shirt!'], poetic: ['The stars just rearranged themselves for us.', 'This yes will stay with me forever.', 'You’ve turned an ordinary day into a story.'],
      shy: ['I can’t stop smiling right now.', 'I’m going to need a minute. Happy tears.', 'Okay breathe. You said yes.']
    },
    dateTitle: {
      sweet: ['Pick our day 💛', 'When shall we meet?', 'Choose a day'], flirty: ['Name the day 😏', 'When are you free?', 'Pick a day, pick a time'], funny: ['Mark your calendar!', 'Choose wisely (no cancelling)', 'Pick a date, any date'],
      poetic: ['When the moon allows', 'Choose our evening', 'Pick a day for us'], shy: ['So… when?', 'Pick a day, please 🙈', 'When works for you?']
    },
    dateSub: {
      sweet: ['Whatever suits you best.', 'I’ll be ready, I promise.', 'Any day is good with you.'], flirty: ['I’ll make the time worth it.', 'Choose well, I’m counting.', 'I’ll be the one smiling.'],
      funny: ['Bonus points for weekends.', 'No Mondays, please. Mondays are sad.', 'I’ll bring the charm.'], poetic: ['The sun will wait for you.', 'Every hour is gold with you.', 'The city will keep our table.'], shy: ['Only if you’re free, no rush.', 'Take your time!', 'Anything works for me.']
    },
    pickup: {
      sweet: ['{days} days until I pick you up from your doorstep 🚗💛', 'In {days} days I’ll be waiting downstairs for you 💐', '{days} days and I’ll knock on your door 🥰'],
      flirty: ['{days} days until I pick you up. Dress to impress 😏', 'Countdown: {days} days till I’m downstairs waiting 🔥', '{days} days. Be ready when I call.'],
      funny: ['{days} days until I roll up under your building 🚙💨', 'Pick-up in {days} days. I’ll honk. Sorry, neighbours.', '{days} days until the legendary pick-up!'],
      poetic: ['{days} days until I find you beneath the evening sky 🌆', 'In {days} days I’ll be at your door with a thousand words unsaid', '{days} sunsets until I come for you 🌇'],
      shy: ['{days} days until I’ll be downstairs… nervous 🙈', 'I’ll wait for you downstairs in {days} days, okay?', '{days} days. I’ll text when I’m outside 🫣']
    },
    actTitle: {
      sweet: ['What shall we do together?', 'Pick our adventure 💛', 'What would you love?'], flirty: ['What do you feel like?', 'Pick your favourite plan 😏', 'Your choice tonight'], funny: ['Choose your quest!', 'Pick a plan (snacks included)', 'Level up: pick a plan'],
      poetic: ['Where shall the night take us?', 'Choose our story', 'Pick a chapter'], shy: ['What would you like? 🙈', 'Any of these okay?', 'Pick what you like']
    },
    doneTitle: {
      sweet: ['It’s a date! 💖', 'We’re on! 🥰', 'See you soon 💛'], flirty: ['Booked. Don’t be late 😏', 'Date locked in 🔒', 'It’s on'], funny: ['Plans made, no refunds!', 'Official! Legally binding 😂', 'Calendar updated!'],
      poetic: ['A memory waiting to happen', 'Written in the stars ✨', 'Our evening awaits'], shy: ['It’s really happening 🥹', 'Okay! See you there', 'Eeek, it’s a date!']
    },
    noLine: {
      sweet: ['Are you sure? 🥺', 'Please think again…', 'That hurt a little 💔'], flirty: ['Bold of you 😏', 'Try again, gorgeous', 'Not buying it 😌'], funny: ['Wrong button, buddy!', 'Error 404: No not found', 'The button ran away 🏃'],
      poetic: ['Every no echoes in my heart…', 'The stars disagree', 'Even the moon says yes'], shy: ['oh… okay? 🥺', 'really?? 😢', 'I’ll just sit here quietly']
    },
    reply: {
      sweet: ['Yes {from}, I accept this date 💖 {date}{time}, {act}. I’ll be so happy to go out with you, and I hope what we have stays this beautiful. Thank you for this sweet invite 🥹',
        'You made me smile so much. Yes! {date}{time} — {act}. I can’t wait, and I hope we keep going like this. Thank you for thinking of me 💛',
        'Of course yes 🥰 {date}{time}, {act}. I’ll be very happy to spend it with you. Thanks for the cutest invite, {from}.'],
      flirty: ['Yes {from}… you had me at the first button 😏 {date}{time}, {act}. I’ll be very happy to go out with you, and I hope we stay just like this. Thanks for this cute invite 💕',
        'Alright, you win 😌 {date}{time} — {act}. I’m already looking forward to it, and I hope this is only the beginning. Thank you for the sweetest invite 🔥',
        'Yes. I’m saying yes, {from} 😉 {date}{time}, {act}. Pick me up on time, I’ll be smiling. I hope we last, and thanks for this lovely surprise 💋'],
      funny: ['YES! Calendar updated: {date}{time}, {act} 😂 I’ll bring the good mood, you bring the snacks. Thanks for the invite, {from}!',
        'Fine, fine, you convinced me 😂 {date}{time} — {act}. Can’t wait! Thanks for the funniest invite ever.'],
      poetic: ['With a full heart: yes, {from} ✨ {date}{time}, {act}. I hope what we have keeps growing like this. Thank you for this beautiful invitation 🌙',
        'I’ll meet you there: {date}{time} — {act}. The stars can wait for us. Thank you, {from} 💫'],
      shy: ['y-yes 🙈 {date}{time}, {act}. I’ll be really happy to go with you, and I hope we stay like this. Thank you for the cute invite 🥹',
        'okay yes!! {date}{time}, {act}. I’m already nervous (the good kind). Thanks for asking, {from} 🫣']
    }
  };
  const TYPE_TITLE = {
    friends: ['{to}, wanna hang out?', '{to}, squad needs you. Are you in?', '{to}, let’s make plans!', 'Ayo {to}, free this week?'],
    coffee: ['{to}, coffee date? ☕', '{to}, let me buy you a coffee?', 'One coffee, endless chat, {to}?', '{to}, latte or tea with me?'],
    birthday: ['{to}, you’re invited to my birthday! 🎂', 'Come celebrate with me, {to}!', '{to}, it isn’t a party without you 🎈', 'Save the date, {to}: my birthday!']
  };

  const pick = (a, n) => a.slice().sort(() => Math.random() - 0.5).slice(0, n);
  function local(field, ctx, n) {
    n = n || 4;
    const v = ctx.vibe || 'sweet';
    let pool = (L[field] && (L[field][v] || L[field].sweet)) || [];
    if (field === 'title' && TYPE_TITLE[ctx.type]) pool = TYPE_TITLE[ctx.type].concat(pool.slice(0, 2));
    return pick(pool, n);
  }

  function prompt(field, ctx) {
    const f = F[field];
    return [
      'You write tiny lines for a cute, mobile invite website where someone asks their person on a date. Output ONLY the lines.',
      `Occasion: ${ctx.typeLabel || ctx.type || 'romantic ask'}. Tone: ${ctx.vibe || 'sweet'}. Their relationship: ${ctx.rel || 'partner'}.`,
      `Names: the asker is "${ctx.from || 'me'}", the person invited is "${ctx.to || 'you'}". You may use the tokens {to} and {from} instead of names.`,
      `Write 4 different options for: ${f.what}. Each at most ${f.max} words, at most one emoji, warm and natural, not cheesy, English. One per line, no numbering, no quotes.`,
      ctx.extra ? 'Details: ' + ctx.extra : ''
    ].join('\n');
  }
  async function remote(field, ctx) {
    const url = CFG.aiUrl === undefined ? 'https://text.pollinations.ai/' : CFG.aiUrl;
    if (!url) return [];
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(url + encodeURIComponent(prompt(field, ctx)) + '?model=openai&seed=' + ((Math.random() * 1e6) | 0), { signal: ctl.signal });
      if (!r.ok) return [];
      const txt = await r.text();
      return txt.split('\n').map((s) => s.replace(/^[\s\-*•\d.)"“]+|["”\s]+$/g, '').trim()).filter((s) => s && s.length < 160 && !/^(here|sure|option)/i.test(s)).slice(0, 4);
    } catch (e) { return []; } finally { clearTimeout(t); }
  }
  // instant = local lines, then replaced with real AI lines if the service answers
  async function suggest(field, ctx, onInstant) {
    const loc = local(field, ctx, 4);
    if (onInstant) onInstant(loc);
    const r = await remote(field, ctx);
    return r.length ? { lines: r.concat(loc.slice(0, 1)), ai: true } : { lines: loc, ai: false };
  }
  async function reply(ctx) { // ctx: vibe, variant, date, time, act, from
    const fill = (t) => t.replace(/\{date\}/g, ctx.date || 'soon').replace(/\{time\}/g, ctx.time ? ' at ' + ctx.time : '').replace(/\{act\}/g, ctx.act || 'our plan').replace(/\{from\}/g, ctx.from || 'you');
    const bank = L.reply[ctx.vibe || 'sweet'] || L.reply.sweet;
    const r = await remote('reply', Object.assign({}, ctx, { extra: `Date: ${ctx.date || 'to be decided'}${ctx.time ? ' at ' + ctx.time : ''}. Plan: ${ctx.act || 'surprise'}. Say yes warmly, say you will be very happy to go, hope the relationship stays like this, and thank them for the cute invite website. Flirty and sweet.` }));
    return r.length ? { text: r[0], ai: true } : { text: fill(bank[(ctx.variant || 0) % bank.length]), ai: false };
  }
  window.AI = { VIBES, FIELDS: F, local, suggest, reply };
})();
