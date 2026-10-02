/* The little game boards (tic-tac-toe, draw and guess, quick question), shared by the match chat and the friends' chat.
   GameBoard.mount(parent, before, handlers) returns { set(game) }. handlers: move(cell), stroke(k), clear(), guess(text), pick(i). */
(function () {
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k.startsWith('on')) el[k] = v; else el.setAttribute(k, v === true ? '' : v); } kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); }); return el; };
  const toast = (m) => { const t = h('div', { class: 'toast bad' }, m); document.body.append(t); setTimeout(() => t.remove(), 2600); };
  const run = async (fn) => { try { await fn(); } catch (e) { toast((e && e.message) || 'Something went wrong'); } };

  function xoPanel(g, H) {
    const cells = g.board.map((c, i) => h('button', { class: 'xocell' + (g.line && g.line.includes(i) ? ' win' : ''), disabled: !!c || !g.my_turn || g.winner, onclick: () => run(() => H.move(i)) }, c === 'X' ? '❌' : c === 'O' ? '⭕' : ''));
    const status = g.winner === 'me' ? '🎉 You won!' : g.winner === 'them' ? '😅 They won' : g.winner === 'draw' ? '🤝 Draw' : g.my_turn ? 'Your turn (you are ' + (g.mark === 'X' ? '❌' : '⭕') + ')' : 'Their turn…';
    return h('div', { class: 'gamepanel' }, h('b', null, status), h('div', { class: 'xogrid' }, cells));
  }

  function quizPanel(g, H) {
    const same = g.done && g.my_pick === g.their_pick;
    const title = g.done ? (same ? '🎉 Same choice!' : 'Different choices') : g.my_pick != null ? 'Waiting for them…' : g.their_done ? 'They chose. Your turn:' : 'Pick one:';
    return h('div', { class: 'gamepanel' }, h('b', null, g.q), h('small', { class: 'hint' }, title),
      ...g.opts.map((o, i) => h('button', { class: 'btn block' + (g.my_pick === i ? ' pri' : ''), disabled: g.my_pick != null, onclick: () => run(() => H.pick(i)) }, (g.my_pick === i ? '✅ ' : '') + o + (g.done && g.their_pick === i ? '  · them' : ''))));
  }

  function todPanel(g, H) {
    const left = Math.max(0, Math.round((new Date(g.until) - Date.now()) / 3600000));
    const head = h('b', null, '🎭 Truth or Dare · Level ' + g.level + ' · ' + g.name);
    if (g.done) return h('div', { class: 'gamepanel' }, head, h('small', { class: 'hint' }, 'The 24 hours are over.'));
    const sub = h('small', { class: 'hint' }, left + ' h left · round ' + (g.count + 1));
    if (g.phase === 'pick') return h('div', { class: 'gamepanel' }, head, sub, g.my_turn ? h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: () => run(() => H.todPick('truth')) }, '🟣 Truth'), h('button', { class: 'btn pri', onclick: () => run(() => H.todPick('dare')) }, '🟠 Dare')) : h('small', { class: 'hint' }, 'Their turn to choose…'));
    return h('div', { class: 'gamepanel' }, head, sub, h('div', { class: 'todq' }, g.kind === 'truth' ? '🟣 Truth' : '🟠 Dare', h('p', null, g.text)), g.my_turn ? h('div', { class: 'stack' }, h('small', { class: 'hint' }, 'Answer in the chat, then press Done.'), h('button', { class: 'btn pri', onclick: () => run(() => H.todDone()) }, '✅ Done, their turn')) : h('small', { class: 'hint' }, 'They are answering…'));
  }

  function drawPanel(g, H) {
    const cv = h('canvas', { class: 'drawcv', width: 600, height: 600 }), ctx = cv.getContext('2d');
    let color = '#ffffff', width = 8, cur = null, local = g.strokes.slice();
    const paint = () => { ctx.fillStyle = '#1b1b2a'; ctx.fillRect(0, 0, 600, 600); local.concat(cur ? [cur] : []).forEach((k) => { ctx.strokeStyle = k.c; ctx.lineWidth = k.w * 0.6; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); k.p.forEach(([x, y], i) => { const px = x * 0.6, py = y * 0.6; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); if (k.p.length === 1) ctx.lineTo(k.p[0][0] * 0.6 + 0.1, k.p[0][1] * 0.6); ctx.stroke(); }); };
    paint();
    const title = g.solved ? '🎉 Guessed! It was: ' + g.word : g.i_draw ? 'Draw: ' + g.word : 'Guess the word (' + g.letters + ' letters)';
    const wrap = h('div', { class: 'gamepanel', 'data-keep': g.i_draw && !g.solved ? '1' : '' }, h('b', null, title), cv);
    if (g.i_draw && !g.solved) {
      const pos = (e) => { const r = cv.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return [Math.max(0, Math.min(1000, Math.round((t.clientX - r.left) / r.width * 1000))), Math.max(0, Math.min(1000, Math.round((t.clientY - r.top) / r.height * 1000)))]; };
      const down = (e) => { e.preventDefault(); cur = { c: color, w: width, p: [pos(e)] }; paint(); };
      const move = (e) => { if (!cur) return; e.preventDefault(); const q = pos(e), l = cur.p[cur.p.length - 1]; if (Math.abs(q[0] - l[0]) + Math.abs(q[1] - l[1]) > 6 && cur.p.length < 400) { cur.p.push(q); paint(); } };
      const up = () => { if (!cur) return; const k = cur; cur = null; local.push(k); paint(); run(() => H.stroke(k)); };
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); window.addEventListener('pointerup', up); cv.style.touchAction = 'none';
      const colors = ['#ffffff', '#ff4d6a', '#ffd60a', '#27d3a2', '#4da3ff', '#a78bff'];
      wrap.append(h('div', { class: 'row drawtools' }, ...colors.map((c) => h('button', { class: 'dot', style: 'background:' + c, 'aria-label': 'Colour ' + c, onclick: () => { color = c; } })), h('button', { class: 'btn sm', onclick: () => { width = width === 8 ? 18 : 8; } }, 'Thick / thin'), h('button', { class: 'btn sm', onclick: () => { local = []; paint(); run(() => H.clear()); } }, 'Clear')));
      wrap.redraw = () => {};
    } else if (!g.solved) {
      const gi = h('input', { type: 'text', maxlength: 40, placeholder: 'Your guess', 'aria-label': 'Your guess', enterkeyhint: 'send' });
      const guess = () => { const t = gi.value.trim(); if (!t) return; gi.value = ''; run(() => H.guess(t)); };
      gi.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); guess(); } };
      wrap.append(h('div', { class: 'row' }, gi, h('button', { class: 'btn pri sm', onclick: guess }, 'Guess')));
      wrap.update = (g2) => { local = g2.strokes.slice(); paint(); };
    }
    return wrap;
  }

  window.GameBoard = {
    mount(parent, before, H) {
      let panel = null, key = '';
      const drop = () => { if (panel) { panel.remove(); panel = null; key = ''; } };
      return {
        set(g) {
          if (!g || (g.type === 'tod' && g.level === undefined)) return drop(); // an old plain question has nothing to draw
          const k = JSON.stringify(g); if (k === key && panel) return; key = k;
          if (panel && panel.update && g.type === 'draw' && !g.i_draw && !g.solved) { panel.update(g); return; }
          if (panel && panel.dataset.keep && g.type === 'draw' && g.i_draw && !g.solved) return; // do not wipe what the drawer is drawing
          const el = g.type === 'xo' ? xoPanel(g, H) : g.type === 'quiz' ? quizPanel(g, H) : g.type === 'tod' ? todPanel(g, H) : drawPanel(g, H);
          if (panel) panel.replaceWith(el); else parent.insertBefore(el, before); panel = el;
        },
        clear: drop
      };
    }
  };
})();
