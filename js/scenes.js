// World + Lebanon wallpapers. Each one is a THEME: sky gradient + colours + a landmark illustration.
// Keep the landmark inside x 70..350 (the sides get cropped on tall phones).
(function () {
  const R = (x, y, w, h, f, rx) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 0}" fill="${f}"/>`;
  const C = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
  const P = (d, f, x) => `<path d="${d}" fill="${f}" ${x || ''}/>`;
  const S = (d, st, w, x) => `<path d="${d}" fill="none" stroke="${st}" stroke-width="${w || 2}" stroke-linecap="round" ${x || ''}/>`;
  const svg = (b) => `<svg viewBox="0 0 420 240" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
  const wins = (x, y, w, h, c, gx, gy) => { let s = ''; for (let i = 0; i < w; i += gx) for (let j = 0; j < h; j += gy) s += R(x + i + 3, y + j + 4, 4, 5, c); return s; };
  const palm = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k || 1})"><path d="M0 0q4-22 2-44" stroke="#7a5a3a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M2-44q-18-6-26 6M2-44q-8-14-24-10M2-44q10-14 26-8M2-44q20-2 26 10M2-44q2-16 10-20" stroke="#4a9a52" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  const pine = (x, y, k, c) => `<g transform="translate(${x} ${y}) scale(${k || 1})">${R(-2, -14, 4, 14, '#6d4a2a')}${P('M0-46L-13-14H13z', c || '#3f8a4a')}${P('M0-58L-10-32H10z', c || '#4a9a55')}</g>`;
  const sea = (y, c1, c2) => `${R(0, y, 420, 240 - y, c1)}${S(`M0 ${y + 14}q26-10 52 0t52 0 52 0 52 0 52 0 52 0 52 0 52 0`, '#fff', 3, 'opacity=".55"')}${S(`M0 ${y + 40}q30-10 60 0t60 0 60 0 60 0 60 0 60 0 60 0`, c2 || '#fff', 3, 'opacity=".35"')}`;
  const hills = (y, c, amp) => P(`M0 ${y}q70-${amp || 40} 140-6t140 0 140 ${-(amp || 40) / 2}V240H0z`, c);
  const col = (x, y, h, c) => `${R(x, y, 9, h, c, 2)}${R(x - 3, y - 4, 15, 5, c, 2)}${R(x - 3, y + h - 2, 15, 5, c, 2)}`;

  const W = {};
  const add = (id, o) => { W[id] = Object.assign({ font: "'Fredoka',system-ui,sans-serif", cloud: window.THEMES.pink.cloud, cloudColor: '#fff', sceneH: '40%', group: 'world' }, o); };

  /* ---------------- WORLD ---------------- */
  add('paris', { name: 'Paris', emoji: '🗼', sky: 'linear-gradient(#ffd9c7,#ffb7cf 55%,#c9a6ff)', accent: '#e0567f', accent2: '#a83058', ink: '#5a2240', scene: () => svg(
    R(0, 196, 420, 44, '#8b7a9a') + R(70, 150, 70, 70, '#ffe9dc') + R(280, 140, 70, 80, '#ffe3d2') + P('M66 150h78l-10-22H76z', '#7d86a8') + P('M276 140h78l-10-24h-58z', '#7d86a8') +
    wins(70, 150, 70, 70, '#f0b8a0', 14, 18) + wins(280, 140, 70, 80, '#f0b8a0', 14, 18) +
    P('M210 10L216 66 226 108 238 158 262 224H244L228 188Q210 174 192 188L176 224H158L182 158 194 108 204 66Z', '#6b4a64') + R(198, 106, 24, 5, '#6b4a64') + R(188, 156, 44, 6, '#6b4a64') + C(210, 8, 3, '#6b4a64') +
    S('M176 224Q210 180 244 224', '#8b7a9a', 3)) });

  add('london', { name: 'London', emoji: '🎡', sky: 'linear-gradient(#cfd9ea,#eef2f8 70%,#ffe7d6)', accent: '#c93a4a', accent2: '#8f2230', ink: '#2f3a55', scene: () => svg(
    sea(196, '#7fa6c9', '#fff') + R(70, 150, 120, 50, '#d9c79a') + wins(70, 150, 120, 50, '#9a865a', 12, 14) + P('M70 150l10-14h100l10 14z', '#6d7f94') +
    R(250, 70, 40, 130, '#e0cf9f') + wins(250, 100, 40, 90, '#a8945a', 10, 18) + P('M248 70h44l-22-44z', '#6d7f94') + C(270, 92, 14, '#fff') + S('M270 92v-9M270 92l6 3', '#444', 2) + R(268, 14, 4, 14, '#6d7f94') +
    C(150, 140, 52, 'none').replace('fill="none"', 'fill="none" stroke="#fff" stroke-width="3"') + S('M150 88v104M98 140h104M113 103l74 74M187 103l-74 74', '#fff', 1.5) + C(150, 140, 5, '#fff') + S('M150 192l-18 30M150 192l18 30', '#fff', 3)) });

  add('newyork', { name: 'New York', emoji: '🗽', sky: 'linear-gradient(#ffb98a,#d88ab8 55%,#6d5aa8)', accent: '#ffcf5a', accent2: '#c48a12', ink: '#fff6e6', dark: true, scene: () => {
    let b = ''; [[70, 130, 34, '#3b3468'], [100, 100, 40, '#463d7a'], [134, 140, 34, '#3b3468'], [262, 120, 36, '#463d7a'], [294, 146, 30, '#3b3468'], [320, 108, 34, '#3b3468']].forEach(([x, y, w, c]) => { b += R(x, y, w, 226 - y, c) + wins(x, y, w, 226 - y, '#ffd97a', 10, 16); });
    return svg(R(0, 226, 420, 14, '#2a2350') + b + R(178, 60, 54, 166, '#4b4286') + R(190, 38, 30, 24, '#4b4286') + R(200, 22, 10, 18, '#4b4286') + R(207, 4, 2, 20, '#fff') + wins(178, 66, 54, 150, '#ffd97a', 10, 14) + P('M170 226l8-30h54l8 30z', '#4b4286')); } });

  add('tokyo', { name: 'Tokyo', emoji: '🗻', sky: 'linear-gradient(#ffe3ee,#ffc9dd 60%,#f4a6c8)', accent: '#e8557d', accent2: '#a8294f', ink: '#5a2a3c', scene: () => svg(
    P('M60 226L170 70l12 6 10-14 10 14 10-6 110 156z', '#7a8cc4') + P('M170 70l12 6 10-14 10 14 10-6 14 26-18-8-10 12-10-12-10 12-10-12-18 8z', '#fff') +
    hills(200, '#f7c6d8', 16) + R(250, 168, 40, 10, '#b8324a') + R(254, 156, 32, 10, '#d4425a') + R(258, 146, 24, 9, '#b8324a') + P('M246 168h48l-4-6h-40z', '#7a2a3a') + R(268, 120, 4, 26, '#7a2a3a') +
    R(96, 160, 6, 60, '#d4324a') + R(132, 160, 6, 60, '#d4324a') + R(90, 154, 54, 8, '#d4324a') + R(98, 170, 38, 5, '#d4324a') +
    C(200, 190, 20, '#ffb3cc') + C(222, 184, 18, '#ffc2d6') + C(180, 196, 16, '#ffb3cc') + R(198, 204, 6, 24, '#7a5a4a') + R(0, 226, 420, 14, '#e89ab8')) });

  add('dubai', { name: 'Dubai', emoji: '🏙️', sky: 'linear-gradient(#ffd77a,#ff9c6b 55%,#e8648a)', accent: '#ff7a3d', accent2: '#b84a14', ink: '#5a2a12', scene: () => {
    let b = ''; [[80, 150, 26], [106, 130, 26], [134, 160, 22], [262, 140, 26], [290, 122, 28], [320, 158, 24]].forEach(([x, y, w], i) => { b += R(x, y, w, 226 - y, i % 2 ? '#c8684a' : '#b85a40') + wins(x, y, w, 226 - y, '#ffe2a8', 9, 15); });
    return svg(C(330, 80, 30, '#fff1b8') + b + P('M210 6L214 60 224 110 236 226H184L196 110 206 60Z', '#d98a6a') + P('M210 6L212 40 208 40z', '#fff') + P('M0 226q70-22 140-6t140 0 140-10V240H0z', '#e8b27a') + P('M0 236q90-18 180-4t240-8V240H0z', '#d8a066')); } });

  add('rome', { name: 'Rome', emoji: '🏛️', sky: 'linear-gradient(#ffc78a,#ffa37a 55%,#d97a9a)', accent: '#d9534a', accent2: '#8f2a24', ink: '#56261c', scene: () => {
    let a = ''; for (let i = 0; i < 7; i++) a += P(`M${96 + i * 32} 150v-10a9 9 0 0118 0v10z`, '#8f5a44') + P(`M${96 + i * 32} 182v-10a9 9 0 0118 0v10z`, '#8f5a44') + P(`M${96 + i * 32} 214v-12a9 9 0 0118 0v12z`, '#8f5a44');
    return svg(C(330, 70, 26, '#fff0b8') + P('M80 226V132q130-34 260 0v94z', '#d8a07a') + a + P('M80 132q130-34 260 0', '#b87a5a', 'stroke="#b87a5a" stroke-width="4" fill="none"') + pine(60, 226, 1.2) + pine(366, 226, 1, '#4a7a4a') + R(0, 226, 420, 14, '#8f7a5a')); } });

  add('istanbul', { name: 'Istanbul', emoji: '🕌', sky: 'linear-gradient(#9ee0e8,#ffd8c2 70%,#ffb9a0)', accent: '#2b9a9a', accent2: '#16605f', ink: '#16464a', scene: () => svg(
    sea(198, '#4ab0c4', '#fff') + R(120, 150, 180, 50, '#e8c79a') + P('M140 150a70 56 0 01140 0z', '#d8b07a') + P('M172 150a38 40 0 0176 0z', '#c89a64') + C(210, 108, 3, '#c89a64') + P('M208 70h4v36h-4z', '#c89a64') +
    R(96, 90, 12, 110, '#f2e0c4') + P('M94 90l8-26 8 26z', '#9a7a5a') + R(312, 90, 12, 110, '#f2e0c4') + P('M310 90l8-26 8 26z', '#9a7a5a') + R(120, 170, 180, 4, '#c8a676') +
    P('M170 218l16 10h40l16-10z', '#7a4a3a') + R(206, 196, 3, 22, '#7a4a3a') + P('M209 198l22 14h-22z', '#fff')) });

  add('cairo', { name: 'Cairo', emoji: '🐪', sky: 'linear-gradient(#ffe2a0,#ffc07a 60%,#f59a6a)', accent: '#d98a2a', accent2: '#8f5a12', ink: '#5a3410', scene: () => svg(
    C(300, 60, 28, '#fff3c8') + P('M70 226L150 96l80 130z', '#e0a860') + P('M150 96l80 130h-40z', '#c88a44') + P('M190 226L268 120l78 106z', '#e8b470') + P('M268 120l78 106h-40z', '#d09850') + P('M130 226L170 160l40 66z', '#d9a058') +
    P('M0 226q90-26 180-8t240-14V240H0z', '#f0c078') + P('M0 236q110-18 220-4t200-6V240H0z', '#e0a860') + palm(96, 226, 1) + palm(340, 228, .8)) });

  add('santorini', { name: 'Santorini', emoji: '🏝️', sky: 'linear-gradient(#7cc8ff,#d6f0ff 75%)', accent: '#2f7fd6', accent2: '#1a4f8f', ink: '#123a66', scene: () => svg(
    sea(190, '#2f86d6', '#fff') + P('M70 226V170l40-16 40 10 50-24 60 14 50-10 20 20v62z', '#f4f0ea') +
    R(96, 150, 34, 30, '#fff') + P('M96 150a17 17 0 0134 0z', '#2f6fd0') + R(200, 130, 30, 34, '#fff') + P('M200 130a15 15 0 0130 0z', '#2f6fd0') + R(286, 150, 36, 30, '#fff') + P('M286 150a18 18 0 0136 0z', '#2f6fd0') +
    R(140, 170, 28, 26, '#fff') + R(246, 168, 28, 28, '#fff') + R(104, 162, 7, 10, '#2f6fd0') + R(208, 146, 7, 10, '#2f6fd0') + C(132, 210, 6, '#e85a9a') + C(300, 206, 6, '#e85a9a') + R(0, 226, 420, 14, '#e8e2d8')) });

  /* ---------------- LEBANON ---------------- */
  const LB = { group: 'lebanon' };
  add('beirut', Object.assign({ name: 'Beirut', emoji: '🌇', sky: 'linear-gradient(#ffb58a,#ff8fa8 55%,#7a6ad0)', accent: '#ff5a7a', accent2: '#b82a4a', ink: '#5a1f36', scene: () => svg(
    C(210, 110, 38, '#ffe0a0') + R(70, 176, 100, 22, '#7a6a9a', 2) + wins(70, 160, 100, 36, '#ffe0a0', 12, 12) + R(296, 160, 50, 40, '#7a6a9a') + R(310, 140, 22, 26, '#7a6a9a') + wins(296, 160, 50, 40, '#ffe0a0', 12, 12) +
    sea(196, '#6a5ab8', '#fff') + P('M150 232V168q10-30 26-30t26 30v64z', '#4a3a78') + P('M232 232V150q8-26 26-26 20 0 26 26v82z', '#443470') + P('M176 232v-44a26 26 0 0152 0v44z', '#6a5ab8') + S('M150 196q30-40 82-10', '#fff', 2, 'opacity=".3"')) }, LB));

  add('tripoli', Object.assign({ name: 'Tripoli', emoji: '🏰', sky: 'linear-gradient(#9fd6ff,#ffe9c8 75%)', accent: '#d9782a', accent2: '#8f4a10', ink: '#4a3018', scene: () => svg(
    hills(170, '#7ab26a', 34) + R(100, 120, 200, 86, '#d8b888') + R(84, 100, 40, 106, '#c8a474') + R(276, 100, 40, 106, '#c8a474') + R(160, 92, 44, 114, '#c8a474') +
    [84, 100, 108, 276, 292, 300, 160, 176, 192].map((x) => R(x, (x < 130 || x > 270) ? 92 : 84, 8, 10, '#c8a474')).join('') + P('M138 206v-22a14 14 0 0128 0v22z', '#6a4a2a') + R(178, 130, 8, 16, '#6a4a2a') + wins(100, 130, 200, 60, '#a8845a', 28, 24) +
    R(184, 70, 2, 24, '#6a4a2a') + P('M186 70l22 6-22 6z', '#e04a4a') + R(318, 168, 5, 44, '#7a5a3a') + palm(330, 212, .9) + palm(76, 214, 1) + R(0, 206, 420, 34, '#c8a474')) }, LB));

  add('akkar', Object.assign({ name: 'Akkar', emoji: '🌳', sky: 'linear-gradient(#a6dcff,#e6f7d8 75%)', accent: '#4a9a3a', accent2: '#2a6a22', ink: '#1f4a1c', scene: () => svg(
    C(320, 60, 24, '#fff2a8') + P('M60 190l70-70 50 40 50-60 70 76 60-30v100H60z', '#8ac07a') + P('M0 210q90-40 180-10t240-20V240H0z', '#5aa84a') + P('M0 226q100-30 210-6t210-16V240H0z', '#4a9a3a') +
    pine(110, 214, 1.2, '#2f7a3a') + pine(150, 222, .9, '#3a8a42') + pine(300, 212, 1.1, '#2f7a3a') + pine(338, 222, .8, '#3a8a42') +
    R(200, 186, 44, 30, '#e8d4a8') + P('M194 188l28-24 28 24z', '#c8583a') + R(216, 198, 12, 18, '#8a5a3a') + [[120, 232], [140, 236], [270, 232], [290, 236]].map(([x, y]) => C(x, y, 4, '#fff')).join('')) }, LB));

  add('batroun', Object.assign({ name: 'Batroun', emoji: '🌊', sky: 'linear-gradient(#8fe0ff,#e8fbff 75%)', accent: '#1f9ad6', accent2: '#0e5f8f', ink: '#0e4460', scene: () => svg(
    sea(150, '#3ab8d8', '#fff') + R(0, 148, 420, 6, '#e8d8b0') + R(70, 120, 280, 30, '#d8c08a') + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(`M${80 + i * 34} 150v-16a11 11 0 0122 0v16z`, '#8a7040')).join('') + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => R(72 + i * 32, 112, 12, 10, '#d8c08a')).join('') +
    R(250, 70, 34, 50, '#f4ece0') + P('M248 70h38l-19-26z', '#d95a3a') + R(265, 84, 6, 12, '#6a4a2a') + P('M0 196q60-20 120 0t120 0 120 0 60-6V240H0z', '#e8d8a8') + S('M0 214q60-14 120 0t120 0 180-4', '#fff', 4, 'opacity=".7"')) }, LB));

  add('anfeh', Object.assign({ name: 'Anfeh', emoji: '🧂', sky: 'linear-gradient(#ffd4a8,#bfe4ff 70%)', accent: '#2a8ac8', accent2: '#135a8f', ink: '#123f5f', scene: () => svg(
    sea(120, '#3a9ad0', '#fff') + P('M0 240V176q30-18 70-8t60-10q30 14 50 6v76z', '#6a6258') + P('M250 240V184q30-14 60-4t110-8v68z', '#5a534a') + P('M0 226q60-16 120 0t120-4 180 2V240H0z', '#d8c8a4') +
    R(150, 138, 38, 34, '#f8f4ea') + P('M146 138h46l-23-26z', '#d86a4a') + R(166, 152, 7, 20, '#6a4a2a') + R(166, 92, 3, 22, '#6a5a4a') + R(160, 98, 15, 3, '#6a5a4a') +
    [0, 1, 2].map((i) => R(216 + i * 26, 204, 22, 12, '#f4f0e8')).join('') + [0, 1, 2].map((i) => R(216 + i * 26, 220, 22, 10, '#f4f0e8')).join('') + C(330, 66, 22, '#fff0b0')) }, LB));

  add('baalbek', Object.assign({ name: 'Baalbek', emoji: '🏛️', sky: 'linear-gradient(#ffc27a,#ffe7b8 70%)', accent: '#c8782a', accent2: '#8a4a10', ink: '#56300e', scene: () => svg(
    P('M0 160l60-50 40 30 60-60 60 50 70-70 80 90v90H0z', '#d8a878') + P('M0 190l80-30 60 20 100-40 80 30 100-20v90H0z', '#c89860') +
    R(98, 172, 224, 10, '#e8d0a0') + R(92, 182, 236, 12, '#dcc08a') + [0, 1, 2, 3, 4, 5].map((i) => col(108 + i * 38, 92, 80, '#f0dcb0')).join('') + R(98, 84, 224, 12, '#e8d0a0') + R(104, 72, 212, 12, '#dcc08a') + P('M104 72h212l-20-16H124z', '#d8bc84') +
    R(0, 214, 420, 26, '#d8b078') + pine(60, 222, .9, '#8a8a4a') + pine(370, 224, .8, '#8a8a4a')) }, LB));

  add('zahle', Object.assign({ name: 'Zahle', emoji: '🍇', sky: 'linear-gradient(#b8e4ff,#f3fbe0 75%)', accent: '#8a4ac8', accent2: '#5a2a8f', ink: '#3a1f5a', scene: () => {
    let v = ''; for (let i = 0; i < 6; i++) v += S(`M0 ${160 + i * 10}q110-${16 - i} 210-6t210 0`, i % 2 ? '#4a8a3a' : '#6aaa4a', 3);
    return svg(P('M0 150q110-48 210-14t210-20v124H0z', '#8acc6a') + v + P('M0 214q80-10 160 0t260-8v34H0z', '#7ab8e8') + S('M0 220q80-8 160 0t260-6', '#fff', 2, 'opacity=".6"') +
      R(230, 100, 26, 52, '#f4ece0') + P('M228 100h30l-15-24z', '#c84a4a') + R(241, 52, 3, 24, '#8a6a4a') + R(234, 58, 17, 3, '#8a6a4a') +
      [[110, 226], [150, 230], [300, 228]].map(([x, y]) => `<g transform="translate(${x} ${y})">${R(-2, -10, 4, 10, '#6d4a2a')}${C(0, -18, 12, '#3f8a4a')}</g>`).join('') + [0, 1, 2, 3].map((i) => R(110 + i * 26, 194, 18, 12, '#d86a4a')).join('')); } }, LB));

  add('saida', Object.assign({ name: 'Saida', emoji: '🏯', sky: 'linear-gradient(#8fd8ff,#e6f6ff 70%)', accent: '#2a9ad0', accent2: '#135f8f', ink: '#10456a', scene: () => svg(
    P('M0 150l70-44 50 30 70-50 90 60 60-30 80 40v44H0z', '#7a9ac8') + sea(160, '#3ab0d8', '#fff') + S('M200 204h140', '#d8c8a0', 10) + R(130, 140, 48, 66, '#e0cfa0') + R(118, 124, 26, 82, '#d4c08a') + R(166, 132, 22, 74, '#d4c08a') +
    [118, 124, 130, 166, 172, 178].map((x) => R(x, 116 + (x > 150 ? 12 : 0), 5, 9, '#d4c08a')).join('') + P('M146 206v-20a9 9 0 0118 0v20z', '#6a4a2a') + R(330, 170, 20, 34, '#d8c8a0') + P('M0 226q70-16 140-2t140 0 140-6V240H0z', '#e8d8a8')) }, LB));

  add('tyre', Object.assign({ name: 'Tyre (Sour)', emoji: '🏺', sky: 'linear-gradient(#ffd08a,#ff9e8a 60%,#b27acb)', accent: '#e0683a', accent2: '#8f3210', ink: '#542012', scene: () => svg(
    C(210, 120, 34, '#fff1b0') + sea(150, '#b07ac0', '#ffe0b0') + R(0, 196, 420, 44, '#e8c898') + [0, 1, 2, 3, 4].map((i) => col(92 + i * 40, 120, 76, '#f4e0b8')).join('') + R(84, 114, 172, 8, '#ead0a0') +
    P('M268 196v-60a30 30 0 0160 0v60z', '#f0d8a8') + P('M280 196v-52a18 18 0 0136 0v52z', '#b07ac0') + palm(352, 214, .9) + palm(62, 216, .8)) }, LB));

  add('nabatieh', Object.assign({ name: 'Nabatieh', emoji: '🫒', sky: 'linear-gradient(#b0e0ff,#fff3d0 75%)', accent: '#6a9a2a', accent2: '#3f6412', ink: '#2a4410', scene: () => svg(
    P('M0 150l90-40 70 30 70-50 70 40 70-30 50 20v120H0z', '#9ac47a') + P('M170 226V110l30-20 40 18 30-10v128z', '#b8a27a') + R(196, 76, 52, 38, '#d8c49a') + [0, 1, 2, 3].map((i) => R(196 + i * 14, 66, 8, 10, '#d8c49a')).join('') + R(206, 90, 10, 14, '#7a6440') + R(228, 90, 10, 14, '#7a6440') + R(200, 50, 2, 18, '#6a5a3a') + P('M202 50l18 5-18 5z', '#e04a4a') +
    P('M0 204q100-30 200-6t220-14V240H0z', '#6aa84a') + [[90, 222], [130, 228], [290, 224], [330, 230]].map(([x, y]) => `<g transform="translate(${x} ${y})">${R(-2, -10, 4, 10, '#6d4a2a')}${C(0, -18, 13, '#7a9a4a')}</g>`).join('')) }, LB));

  add('bekaa', Object.assign({ name: 'Bekaa', emoji: '🌾', sky: 'linear-gradient(#9ed8ff,#fff0c8 75%)', accent: '#c89a1a', accent2: '#8a6a08', ink: '#4a3808', scene: () => {
    let f = ''; const cs = ['#d8c050', '#8ac05a', '#e8d880', '#6aa84a', '#c8b048']; for (let i = 0; i < 10; i++) f += P(`M${i * 46 - 20} 240L${i * 40 + 110} 160h40L${i * 46 + 26} 240z`, cs[i % 5]);
    return svg(P('M0 130l70-46 60 34 60-60 70 66 60-40 100 46v70H0z', '#9aa8d0') + P('M130 118l60-60 30 28-40 30zM300 90l40-40 70 50z', '#fff', 'opacity=".9"') + R(0, 150, 420, 90, '#b8d078') + f +
      [90, 130, 290, 330].map((x) => `<g transform="translate(${x} 184)">${R(-2, 0, 3, 30, '#7a6a3a')}<ellipse cx="0" cy="-6" rx="6" ry="20" fill="#5a9a42"/></g>`).join('')); } }, LB));

  add('cedars', Object.assign({ name: 'Cedars', emoji: '🏔️', sky: 'linear-gradient(#6ab4f0,#d6eeff 75%)', accent: '#2a7a4a', accent2: '#154a2c', ink: '#123a24', scene: () => {
    const cedar = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})">${R(-4, -20, 8, 20, '#6d4a2a')}<ellipse cx="-16" cy="-28" rx="22" ry="7" fill="#2f7a4a"/><ellipse cx="14" cy="-38" rx="24" ry="7" fill="#3a8a52"/><ellipse cx="-6" cy="-48" rx="20" ry="7" fill="#2f7a4a"/><ellipse cx="6" cy="-58" rx="14" ry="6" fill="#3a8a52"/></g>`;
    return svg(P('M40 200l90-110 40 40 60-90 70 100 40-50 90 110z', '#a8b8d8') + P('M130 90l40 40-22 10-18-14-16 12zM230 40l70 100-24-8-16-14-20 12-22-16z', '#fff') + P('M0 200q100-30 210-4t210-14V240H0z', '#dfe8f4') + R(0, 214, 420, 26, '#8aa86a') +
      cedar(110, 230, 1.3) + cedar(200, 236, 1.6) + cedar(300, 230, 1.2) + cedar(352, 238, .9)); } }, LB));

  Object.assign(window.THEMES, W);
  window.THEME_GROUPS = [
    ['Vibes', ['pink', 'minecraft', 'night', 'beach', 'custom']],
    ['World', ['paris', 'london', 'newyork', 'tokyo', 'dubai', 'rome', 'istanbul', 'cairo', 'santorini']],
    ['Lebanon', ['beirut', 'tripoli', 'akkar', 'batroun', 'anfeh', 'baalbek', 'zahle', 'saida', 'tyre', 'nabatieh', 'bekaa', 'cedars']]
  ];
})();
