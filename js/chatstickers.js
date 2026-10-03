/* Our own chat stickers: a big emoji on a coloured blob with a short caption (English and Lebanese).
   Sent as the text "[st:id]". window.ChatStickers.el(id) draws one, picker(onPick) opens the keyboard. */
(function () {
  const G = ['#ffd9e8,#ffb3d1', '#d9ecff,#a8d2ff', '#e0ffd9,#aef0a0', '#fff1c9,#ffd36e', '#eadcff,#c9afff', '#ffe0cf,#ffb894', '#d2fbf3,#8fe6d6'];
  // [id, emoji, caption, category]
  const P = [
    ['hi', '👋', 'Hi!', 'Chat'], ['kifak', '😄', 'كيفك؟', 'Chat'], ['sabah', '☀️', 'صباح الخير', 'Chat'], ['masa', '🌙', 'تصبح على خير', 'Chat'], ['yalla', '🏃', 'يلا!', 'Chat'], ['shou', '😲', 'شو؟!', 'Chat'], ['aanjad', '🤨', 'عنجد؟', 'Chat'], ['tamam', '👌', 'تمام', 'Chat'], ['mashi', '👍', 'ماشي', 'Chat'], ['khalas', '✋', 'خلص', 'Chat'], ['bye', '👋', 'Bye!', 'Chat'], ['brb', '⏳', 'Brb', 'Chat'],
    ['lol', '😂', 'LOL', 'Fun'], ['dahaktni', '🤣', 'ضحكتني', 'Fun'], ['omg', '🙀', 'OMG', 'Fun'], ['wow', '🤩', 'WOW', 'Fun'], ['cool', '😎', 'Cool', 'Fun'], ['hahaha', '😆', 'هاها', 'Fun'], ['fire', '🔥', 'نار!', 'Fun'], ['bored', '🥱', 'زهقت', 'Fun'], ['party', '🥳', 'Party', 'Fun'], ['gg', '🎮', 'GG', 'Fun'], ['win', '🏆', 'Winner', 'Fun'], ['oops', '🙈', 'Oops', 'Fun'],
    ['love', '😍', 'بحبك', 'Love'], ['hug', '🤗', 'Hug', 'Love'], ['kiss', '😘', 'Muah', 'Love'], ['heart', '💜', 'Love', 'Love'], ['miss', '🥺', 'اشتقتلك', 'Love'], ['cute', '🥰', 'Cute', 'Love'], ['yahabibi', '💖', 'يا حبيبي', 'Love'], ['sweet', '🍬', 'Sweet', 'Love'], ['rose', '🌹', 'For you', 'Love'], ['star', '⭐', 'You rock', 'Love'], ['bff', '👯', 'BFF', 'Love'], ['shy', '😊', 'Aww', 'Love'],
    ['takram', '🙏', 'تكرم', 'Lebanese'], ['yeslamo', '🤲', 'يسلمو', 'Lebanese'], ['ala', '🫡', 'على راسي', 'Lebanese'], ['mashallah', '🧿', 'ما شاء الله', 'Lebanese'], ['balah', '😮', 'بالله؟', 'Lebanese'], ['shoqseh', '🧐', 'شو القصة؟', 'Lebanese'], ['wala', '🤷', 'ولا يهمك', 'Lebanese'], ['mabrouk', '🎉', 'مبروك', 'Lebanese'], ['khayr', '🤔', 'خير؟', 'Lebanese'], ['sahtein', '🍽️', 'صحتين', 'Lebanese'], ['manoush', '🥙', 'منقوشة', 'Lebanese'], ['arghile', '☕', 'قهوة؟', 'Lebanese'],
    ['sad', '😢', 'Sad', 'Mood'], ['angry', '😡', 'Grr', 'Mood'], ['tired', '😴', 'نعسان', 'Mood'], ['sick', '🤒', 'تعبان', 'Mood'], ['hungry', '🍕', 'جوعان', 'Mood'], ['thinking', '💭', 'Hmm', 'Mood'], ['sorry', '🙇', 'Sorry', 'Mood'], ['thanks', '💐', 'Thanks', 'Mood'], ['stress', '😵', 'Stress', 'Mood'], ['chill', '🧘', 'Chill', 'Mood'], ['nope', '🙅', 'No!', 'Mood'], ['yes', '🙆', 'Yes!', 'Mood'],
    ['exam', '📝', 'Exam!', 'School'], ['study', '📚', 'ندرس؟', 'School'], ['bell', '🔔', 'الجرس', 'School'], ['homework', '✏️', 'واجبات', 'School'], ['bus', '🚌', 'الباص', 'School'], ['lunch', '🥪', 'Lunch', 'School'], ['grad', '🎓', 'Grad', 'School'], ['football', '⚽', 'Goal!', 'School'], ['music', '🎧', 'Music', 'School'], ['photo', '📸', 'Selfie', 'School'], ['sleepover', '🛏️', 'Sleepover', 'School'], ['weekend', '🎒', 'Weekend', 'School']
  ];
  const BY = {}; P.forEach((s, i) => { BY[s[0]] = { id: s[0], emoji: s[1], text: s[2], cat: s[3], bg: G[i % G.length] }; });
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  /* Stickers people design themselves: an emoji, a short caption, a colour and a shape. Sent as the text [sk:emoji|caption|colour|shape], so chats stay text only and the normal text filter checks the caption. */
  const SHAPES = ['blob', 'circle', 'square', 'burst'], SK = /^\[sk:([^|\]]{1,8})\|([^|\]]{0,16})\|([0-6])\|([0-3])\]$/u;
  const skToken = (e, t, c, sh) => '[sk:' + e + '|' + t + '|' + c + '|' + sh + ']';
  function customEl(e, text, c, sh, small) {
    const b = mk('div', 'stk shape-' + SHAPES[sh] + (small ? ' sm' : '')); b.style.background = 'linear-gradient(135deg,' + G[c] + ')'; b.setAttribute('role', 'img'); b.setAttribute('aria-label', text || 'sticker');
    b.append(mk('span', 'stk-e', e)); if (text) b.append(mk('span', 'stk-t', text)); return b;
  }
  const isSticker = (t) => /^\[st:[a-z]+\]$/.test(String(t || '')) || SK.test(String(t || ''));
  const MINE = 'adate.mystk';
  const loadMine = () => { try { return JSON.parse(localStorage.getItem(MINE) || '[]').filter((x) => Array.isArray(x) && x.length === 4).slice(0, 40); } catch (e) { return []; } };
  const saveMine = (a) => { try { localStorage.setItem(MINE, JSON.stringify(a.slice(0, 40))); } catch (e) { /* ok */ } };
  function el(id, small) {
    const s = BY[id]; if (!s) return null;
    const b = mk('div', 'stk' + (small ? ' sm' : '')); b.style.background = 'linear-gradient(135deg,' + s.bg.split(',').join(',') + ')'; b.setAttribute('role', 'img'); b.setAttribute('aria-label', s.text);
    b.append(mk('span', 'stk-e', s.emoji), mk('span', 'stk-t', s.text)); return b;
  }
  /** Draws a chat message body: a sticker when it is one, plain text otherwise. */
  function body(text) { const t = String(text || ''), k = SK.exec(t); if (k) return customEl(k[1], k[2], Number(k[3]), Number(k[4])); const m = /^\[st:([a-z]+)\]$/.exec(t); return (m && el(m[1])) || t; }
  const EMOJIS = ['😎', '😂', '🤣', '😍', '🥰', '😘', '🤩', '🥳', '😜', '🤪', '😏', '😴', '🤔', '🙄', '😅', '😭', '😡', '🥺', '🤗', '🙈', '👍', '👌', '✌️', '🤞', '💪', '🙏', '👏', '🔥', '💯', '✨', '⭐', '💜', '❤️', '💔', '🎉', '🎮', '⚽', '🏀', '🎧', '🎤', '🍕', '🍔', '🍟', '🍦', '☕', '🥙', '🌹', '🌴', '🏖️', '☀️', '🌙', '🚗', '✈️', '📚', '✏️', '🎒', '🐱', '🐶', '🦄', '🐼', '🦁', '🐸'];
  function maker(onSend, back) {
    let e = '😎', c = 0, sh = 0; const text = mk('input'), prev = mk('div', 'stkprev'), emojiIn = mk('input'), grid = mk('div', 'stkemojis'), colors = mk('div', 'row'), shapes = mk('div', 'row');
    text.type = 'text'; text.maxLength = 14; text.placeholder = 'Write on it (like "Cool hawa")'; text.setAttribute('aria-label', 'Sticker text'); emojiIn.type = 'text'; emojiIn.maxLength = 8; emojiIn.placeholder = 'or type any emoji'; emojiIn.setAttribute('aria-label', 'Sticker emoji');
    const draw = () => { prev.replaceChildren(customEl(e, text.value.trim(), c, sh)); colors.replaceChildren(...G.map((g, i) => { const b = mk('button', 'dot' + (i === c ? ' on' : '')); b.type = 'button'; b.style.background = 'linear-gradient(135deg,' + g + ')'; b.setAttribute('aria-label', 'Colour ' + (i + 1)); b.onclick = () => { c = i; draw(); }; return b; })); shapes.replaceChildren(...SHAPES.map((n, i) => { const b = mk('button', 'chip' + (i === sh ? ' on' : ''), n); b.type = 'button'; b.onclick = () => { sh = i; draw(); }; return b; })); };
    grid.replaceChildren(...EMOJIS.map((x) => { const b = mk('button', 'emo', x); b.type = 'button'; b.onclick = () => { e = x; emojiIn.value = ''; draw(); }; return b; }));
    text.oninput = draw; emojiIn.oninput = () => { const v = [...emojiIn.value.trim()].slice(0, 4).join(''); if (v) { e = v; draw(); } };
    const send = mk('button', 'btn pri', 'Send'), save = mk('button', 'btn', '💾 Save to My stickers'), cancel = mk('button', 'btn sm', '← Back'); send.type = save.type = cancel.type = 'button';
    send.onclick = () => { const t = text.value.trim(); const tok = skToken(e, t, c, sh); if (!SK.test(tok)) return; onSend(tok); };
    save.onclick = () => { const a = loadMine(); const t = text.value.trim(); a.unshift([e, t, c, sh]); saveMine(a); save.textContent = '✅ Saved'; };
    cancel.onclick = back;
    const box = mk('div', 'stkpick stkmaker'); box.append(cancel, prev, text, grid, emojiIn, mk('small', 'hint', 'Colour'), colors, mk('small', 'hint', 'Shape'), shapes, mk('div', 'row'), send, save);
    draw(); return box;
  }
  function picker(onPick) {
    const cats = ['Mine', 'Chat', 'Fun', 'Love', 'Lebanese', 'Mood', 'School']; let cat = loadMine().length ? 'Mine' : 'Chat', q = '';
    const box = mk('div', 'stkpick'), search = mk('input'), chips = mk('div', 'stkcats'), grid = mk('div', 'stkgrid'), top = mk('div', 'row');
    search.type = 'text'; search.placeholder = 'Search stickers…'; search.setAttribute('aria-label', 'Search stickers'); search.maxLength = 20;
    const create = mk('button', 'btn sm pri', '✨ Create your own'); create.type = 'button';
    const showMaker = () => { box.replaceChildren(maker((tok) => onPick(tok, true), () => { box.replaceChildren(top, search, chips, grid); draw(); })); };
    create.onclick = showMaker; top.append(create);
    const draw = () => {
      chips.replaceChildren(...cats.map((x) => { const b = mk('button', 'chip' + (x === cat && !q ? ' on' : ''), x === 'Mine' ? '⭐ Mine' : x); b.type = 'button'; b.onclick = () => { cat = x; q = ''; search.value = ''; draw(); }; return b; }));
      if (cat === 'Mine' && !q) { const mine = loadMine(); grid.replaceChildren(...(mine.length ? mine.map((m, i) => { const b = mk('button', 'stkbtn'); b.type = 'button'; b.append(customEl(m[0], m[1], m[2], m[3], true)); b.onclick = () => onPick(skToken(m[0], m[1], m[2], m[3]), true); b.oncontextmenu = (ev) => { ev.preventDefault(); if (confirm('Remove this sticker?')) { const a = loadMine(); a.splice(i, 1); saveMine(a); draw(); } }; let t; b.ontouchstart = () => { t = setTimeout(() => { if (confirm('Remove this sticker?')) { const a = loadMine(); a.splice(i, 1); saveMine(a); draw(); } }, 700); }; b.ontouchend = () => clearTimeout(t); return b; }) : [mk('p', 'hint', 'Nothing here yet. Tap “Create your own” and save it.')])); return; }
      const list = P.filter((s) => q ? (s[2] + ' ' + s[0] + ' ' + s[3]).toLowerCase().includes(q) : s[3] === (cat === 'Mine' ? 'Chat' : cat));
      grid.replaceChildren(...(list.length ? list.map((s) => { const x = mk('button', 'stkbtn'); x.type = 'button'; x.append(el(s[0], true)); x.setAttribute('aria-label', s[2]); x.onclick = () => onPick('[st:' + s[0] + ']'); return x; }) : [mk('p', 'hint', 'No stickers found')]));
    };
    search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
    box.append(top, search, chips, grid); draw(); return box;
  }
  window.ChatStickers = { el, body, picker, isSticker, all: P.length };
})();
