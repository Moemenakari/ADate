// Hand-drawn soft-cartoon stickers (inline SVG, 100x100 viewBox).
(function () {
  function cat(o) {
    const f = o.fill, s = o.stroke || '#5a3a4a', ear = o.ear || '#ffb6c9';
    const eyes = o.eyes === 'happy'
      ? `<path d="M34 46q4-6 8 0M58 46q4-6 8 0" stroke="${s}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : o.eyes === 'heart'
      ? `<path d="M38 50l-5-5a3 3 0 014-4l1 1 1-1a3 3 0 014 4z" fill="#ff4d8d"/><path d="M62 50l-5-5a3 3 0 014-4l1 1 1-1a3 3 0 014 4z" fill="#ff4d8d"/>`
      : `<ellipse cx="38" cy="46" rx="3.6" ry="4.6" fill="${s}"/><ellipse cx="62" cy="46" rx="3.6" ry="4.6" fill="${s}"/><circle cx="39.2" cy="44.4" r="1.3" fill="#fff"/><circle cx="63.2" cy="44.4" r="1.3" fill="#fff"/>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="50" cy="78" rx="26" ry="19" fill="${f}" stroke="${s}" stroke-width="3"/>
<ellipse cx="38" cy="92" rx="8" ry="5" fill="${f}" stroke="${s}" stroke-width="3"/><ellipse cx="62" cy="92" rx="8" ry="5" fill="${f}" stroke="${s}" stroke-width="3"/>
<path d="M76 80q16-2 12-20" stroke="${s}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M22 40L20 12l22 14z" fill="${f}" stroke="${s}" stroke-width="3" stroke-linejoin="round"/><path d="M26 32l-1-12 10 7z" fill="${ear}"/>
<path d="M78 40l2-28-22 14z" fill="${f}" stroke="${s}" stroke-width="3" stroke-linejoin="round"/><path d="M74 32l1-12-10 7z" fill="${ear}"/>
<ellipse cx="50" cy="48" rx="31" ry="26" fill="${f}" stroke="${s}" stroke-width="3"/>
${o.mark || ''}${eyes}
<ellipse cx="30" cy="56" rx="5" ry="3.4" fill="#ff9db8" opacity=".75"/><ellipse cx="70" cy="56" rx="5" ry="3.4" fill="#ff9db8" opacity=".75"/>
<path d="M47 54h6l-3 3.4z" fill="#ff7fa2"/><path d="M50 57.4v3M50 60.4q-4 4-8 0M50 60.4q4 4 8 0" stroke="${s}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M22 54l-11-2M22 59l-10 3M78 54l11-2M78 59l10 3" stroke="${s}" stroke-width="1.8" stroke-linecap="round"/>
${o.extra || ''}</svg>`;
  }
  const heart = (c, x = 50, y = 50, k = 1) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 26C-36 0-24-32 0-16 24-32 36 0 0 26z" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  const S = {};
  const add = (id, name, svg) => (S[id] = { id, name, svg });

  add('cat-white', 'White cat', cat({ fill: '#fffdfb' }));
  add('cat-orange', 'Orange cat', cat({ fill: '#ffb867', stroke: '#7a4218', mark: '<path d="M50 24v8M42 26l2 6M58 26l-2 6" stroke="#e58a2d" stroke-width="3" stroke-linecap="round"/>' }));
  add('cat-black', 'Black cat', cat({ fill: '#4a4458', stroke: '#2a2535', ear: '#ff9db8' }));
  add('cat-grey', 'Grey cat', cat({ fill: '#c9cfe0', stroke: '#575f7d', mark: '<path d="M44 24v7M50 23v8M56 24v7" stroke="#9aa3c2" stroke-width="3" stroke-linecap="round"/>' }));
  add('cat-love', 'Cat in love', cat({ fill: '#fffdfb', eyes: 'heart', extra: heart('#ff4d8d', 82, 22, .35) }));
  add('cat-happy', 'Happy cat', cat({ fill: '#ffe2b8', stroke: '#7a4a2a', eyes: 'happy' }));
  add('cat-party', 'Party cat', cat({ fill: '#fffdfb', eyes: 'happy', extra: '<path d="M50 4l-13 22h26z" fill="#ff7ab8" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="4" r="4" fill="#ffd84d"/><circle cx="46" cy="16" r="2" fill="#fff"/><circle cx="54" cy="20" r="2" fill="#7fe0ff"/>' }));
  add('cat-crown', 'Royal cat', cat({ fill: '#fff4ec', extra: '<path d="M32 22l6 10 12-14 12 14 6-10 2 16H30z" fill="#ffd84d" stroke="#b8860b" stroke-width="2.5" stroke-linejoin="round"/>' }));
  add('cat-coffee', 'Coffee cat', cat({ fill: '#fffdfb', eyes: 'happy', extra: '<rect x="56" y="76" width="22" height="18" rx="5" fill="#fff" stroke="#5a3a4a" stroke-width="3"/><path d="M78 80q9 0 9 6t-9 5" stroke="#5a3a4a" stroke-width="3" fill="none"/><path d="M62 72q-3-5 0-9M70 72q-3-5 0-9" stroke="#ffb6c9" stroke-width="3" fill="none" stroke-linecap="round"/>' }));
  add('heart', 'Heart', `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${heart('#ff4d8d')}<ellipse cx="30" cy="36" rx="7" ry="4" transform="rotate(-35 30 36)" fill="#fff" opacity=".7"/></svg>`);
  add('hearts', 'Two hearts', `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${heart('#ff86b8', 34, 62, .8)}${heart('#ff3d7f', 64, 40, 1)}</svg>`);
  add('star', 'Star', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 8l12 27 29 3-22 20 7 29-26-15-26 15 7-29L9 38l29-3z" fill="#ffd84d" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><ellipse cx="42" cy="34" rx="5" ry="3" fill="#fff" opacity=".8"/></svg>');
  add('sparkle', 'Sparkle', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 6q4 40 44 44-40 4-44 44-4-40-44-44 40-4 44-44z" fill="#fff" stroke="#ffb3dd" stroke-width="4" stroke-linejoin="round"/></svg>');
  add('paw', 'Paw', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="#ffb6c9" stroke="#fff" stroke-width="3"><ellipse cx="50" cy="66" rx="20" ry="17"/><ellipse cx="22" cy="44" rx="9" ry="12"/><ellipse cx="40" cy="26" rx="9" ry="12"/><ellipse cx="60" cy="26" rx="9" ry="12"/><ellipse cx="78" cy="44" rx="9" ry="12"/></g></svg>');
  add('fish', 'Fish', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M14 50q26-30 56 0-30 30-56 0z" fill="#7fd6ff" stroke="#3a7fa8" stroke-width="3"/><path d="M68 50l20-16v32z" fill="#7fd6ff" stroke="#3a7fa8" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="46" r="3.5" fill="#3a7fa8"/><path d="M46 38q6 12 0 24" stroke="#3a7fa8" stroke-width="2.5" fill="none"/></svg>');
  add('coffee', 'Coffee', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M22 40h50v26q0 20-25 20T22 66z" fill="#fff" stroke="#8a5a44" stroke-width="3.5" stroke-linejoin="round"/><path d="M72 46q16 0 16 12t-16 12" stroke="#8a5a44" stroke-width="3.5" fill="none"/><path d="M26 44h42v8q-21 8-42 0z" fill="#b97a56"/><path d="M36 30q-4-7 0-13M50 30q-4-7 0-13M62 30q-4-7 0-13" stroke="#ffb6c9" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M42 68q5 5 10 0" stroke="#8a5a44" stroke-width="3" fill="none" stroke-linecap="round"/></svg>');
  add('cake', 'Cake', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="52" width="64" height="34" rx="8" fill="#ffd9e8" stroke="#d94a8c" stroke-width="3.5"/><path d="M18 60q8 10 16 0t16 0 16 0 16 0v-2H18z" fill="#fff" stroke="#d94a8c" stroke-width="3" stroke-linejoin="round"/><rect x="46" y="34" width="8" height="18" rx="3" fill="#7fd6ff" stroke="#3a7fa8" stroke-width="2.5"/><path d="M50 32q-6-8 0-14 6 6 0 14z" fill="#ffd84d" stroke="#e58a2d" stroke-width="2"/><circle cx="34" cy="72" r="3" fill="#ff4d8d"/><circle cx="66" cy="72" r="3" fill="#ff4d8d"/></svg>');
  add('gift', 'Gift', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="16" y="42" width="68" height="44" rx="6" fill="#ff86b8" stroke="#c22a72" stroke-width="3.5"/><rect x="12" y="32" width="76" height="16" rx="5" fill="#ffb3d3" stroke="#c22a72" stroke-width="3.5"/><path d="M50 32v54" stroke="#fff" stroke-width="7"/><path d="M50 32q-24-22-24-8t24 8zM50 32q24-22 24-8t-24 8z" fill="#fff" stroke="#c22a72" stroke-width="3" stroke-linejoin="round"/></svg>');
  add('balloon', 'Balloon', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 8c22 0 32 18 28 34-3 14-16 24-28 24S25 56 22 42C18 26 28 8 50 8z" fill="#ff5c9d" stroke="#fff" stroke-width="3.5"/><path d="M46 66l4 8 4-8z" fill="#ff5c9d"/><path d="M50 74q-8 10 0 16t0 8" stroke="#8a5a80" stroke-width="2.5" fill="none"/><ellipse cx="38" cy="26" rx="5" ry="8" transform="rotate(25 38 26)" fill="#fff" opacity=".6"/></svg>');
  add('flower', 'Flower', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="#ffb3dd" stroke="#fff" stroke-width="3"><circle cx="50" cy="26" r="15"/><circle cx="74" cy="44" r="15"/><circle cx="65" cy="72" r="15"/><circle cx="35" cy="72" r="15"/><circle cx="26" cy="44" r="15"/></g><circle cx="50" cy="52" r="13" fill="#ffd84d" stroke="#fff" stroke-width="3"/></svg>');
  add('bear', 'Teddy', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="28" r="12" fill="#c98c62" stroke="#7a4a2a" stroke-width="3"/><circle cx="76" cy="28" r="12" fill="#c98c62" stroke="#7a4a2a" stroke-width="3"/><circle cx="50" cy="52" r="34" fill="#d9a074" stroke="#7a4a2a" stroke-width="3"/><ellipse cx="50" cy="62" rx="14" ry="11" fill="#f5dcc0"/><circle cx="37" cy="46" r="3.6" fill="#5a3a2a"/><circle cx="63" cy="46" r="3.6" fill="#5a3a2a"/><ellipse cx="50" cy="58" rx="4.5" ry="3.2" fill="#5a3a2a"/><path d="M50 61v4M44 67q6 4 12 0" stroke="#5a3a2a" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>');
  add('bunny', 'Bunny', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><ellipse cx="36" cy="22" rx="9" ry="20" fill="#fff" stroke="#8a6a80" stroke-width="3"/><ellipse cx="64" cy="22" rx="9" ry="20" fill="#fff" stroke="#8a6a80" stroke-width="3"/><ellipse cx="36" cy="24" rx="4" ry="12" fill="#ffb6c9"/><ellipse cx="64" cy="24" rx="4" ry="12" fill="#ffb6c9"/><ellipse cx="50" cy="60" rx="32" ry="28" fill="#fff" stroke="#8a6a80" stroke-width="3"/><circle cx="38" cy="56" r="3.6" fill="#5a3a4a"/><circle cx="62" cy="56" r="3.6" fill="#5a3a4a"/><ellipse cx="30" cy="66" rx="5" ry="3.4" fill="#ff9db8" opacity=".75"/><ellipse cx="70" cy="66" rx="5" ry="3.4" fill="#ff9db8" opacity=".75"/><path d="M47 64h6l-3 3.4z" fill="#ff7fa2"/><path d="M50 67.4q-4 4-8 0M50 67.4q4 4 8 0" stroke="#5a3a4a" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>');
  add('cloud', 'Cloud', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M28 72a18 18 0 010-36 22 22 0 0142-6 18 18 0 0110 42z" fill="#fff" stroke="#d9c2f0" stroke-width="3.5" stroke-linejoin="round"/></svg>');
  add('rainbow', 'Rainbow', '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke-width="8"><path d="M10 78a40 40 0 0180 0" stroke="#ff6b8a"/><path d="M18 78a32 32 0 0164 0" stroke="#ffc85a"/><path d="M26 78a24 24 0 0148 0" stroke="#7fe0a0"/><path d="M34 78a16 16 0 0132 0" stroke="#7fc8ff"/></g></svg>');

  window.STICKERS = S;
  window.STICKER_ORDER = Object.keys(S);
})();
