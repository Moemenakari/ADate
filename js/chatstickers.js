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
  function el(id, small) {
    const s = BY[id]; if (!s) return null;
    const b = mk('div', 'stk' + (small ? ' sm' : '')); b.style.background = 'linear-gradient(135deg,' + s.bg.split(',').join(',') + ')'; b.setAttribute('role', 'img'); b.setAttribute('aria-label', s.text);
    b.append(mk('span', 'stk-e', s.emoji), mk('span', 'stk-t', s.text)); return b;
  }
  /** Draws a chat message body: a sticker when it is one, plain text otherwise. */
  function body(text) { const m = /^\[st:([a-z]+)\]$/.exec(String(text || '')); return (m && el(m[1])) || String(text || ''); }
  function picker(onPick) {
    const cats = ['Chat', 'Fun', 'Love', 'Lebanese', 'Mood', 'School']; let cat = 'Chat', q = '';
    const box = mk('div', 'stkpick'), search = mk('input'), chips = mk('div', 'stkcats'), grid = mk('div', 'stkgrid');
    search.type = 'text'; search.placeholder = 'Search stickers…'; search.setAttribute('aria-label', 'Search stickers'); search.maxLength = 20;
    const draw = () => {
      chips.replaceChildren(...cats.map((c) => { const x = mk('button', 'chip' + (c === cat && !q ? ' on' : ''), c); x.type = 'button'; x.onclick = () => { cat = c; q = ''; search.value = ''; draw(); }; return x; }));
      const list = P.filter((s) => q ? (s[2] + ' ' + s[0] + ' ' + s[3]).toLowerCase().includes(q) : s[3] === cat);
      grid.replaceChildren(...(list.length ? list.map((s) => { const x = mk('button', 'stkbtn'); x.type = 'button'; x.append(el(s[0], true)); x.setAttribute('aria-label', s[2]); x.onclick = () => onPick(s[0]); return x; }) : [mk('p', 'hint', 'No stickers found')]));
    };
    search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
    box.append(search, chips, grid); draw(); return box;
  }
  window.ChatStickers = { el, body, picker, all: P.length };
})();
