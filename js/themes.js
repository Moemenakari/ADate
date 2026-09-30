// Themes: colours + scenery drawn as SVG. Scenery is trusted code (never user text).
(function () {
  const puff = (x, y, k = 1, c = '#fff') =>
    `<g transform="translate(${x} ${y}) scale(${k})" fill="${c}"><circle cx="0" cy="0" r="14"/><circle cx="16" cy="-8" r="18"/><circle cx="36" cy="0" r="14"/><rect x="-12" y="0" width="60" height="14" rx="7"/></g>`;
  const block = (x, y, k = 1, c = '#fff') =>
    `<g transform="translate(${x} ${y}) scale(${k})" fill="${c}"><rect x="0" y="0" width="60" height="14"/><rect x="12" y="-14" width="30" height="14"/><rect x="24" y="14" width="40" height="12"/></g>`;

  function pinkScene() {
    return `<svg viewBox="0 0 420 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0 100Q60 46 130 88T260 76T420 98V240H0z" fill="#f7b3e6"/>
<path d="M0 140Q90 96 180 134T340 124T420 140V240H0z" fill="#ef7ccb"/>
<path d="M0 182Q100 150 210 176T420 170V240H0z" fill="#dd55b4"/>
${puff(40, 150, .9)}${puff(300, 132, 1)}${puff(170, 196, .8)}
<g fill="#ff5fae"><path d="M60 214l4-4 4 4-4 5z"/><path d="M350 206l4-4 4 4-4 5z"/><path d="M250 222l3-3 3 3-3 4z"/></g></svg>`;
  }
  function mcScene() {
    let r = '';
    const cols = 21, W = 20;
    for (let i = 0; i < cols; i++) {
      r += `<rect x="${i * W}" y="150" width="${W}" height="20" fill="${i % 3 === 0 ? '#4fa63d' : '#5fb84a'}"/>`;
      r += `<rect x="${i * W}" y="170" width="${W}" height="70" fill="#8b5a2b"/>`;
      if (i % 2 === 0) r += `<rect x="${i * W + 4}" y="${186 + (i % 4) * 8}" width="10" height="10" fill="#6d4420"/>`;
      if (i % 5 === 1) r += `<rect x="${i * W + 4}" y="${212}" width="10" height="10" fill="#9a9a9a"/>`;
    }
    return `<svg viewBox="0 0 420 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${r}
<rect x="330" y="118" width="14" height="32" fill="#7a4e26"/><rect x="310" y="90" width="54" height="30" fill="#3f9a37"/><rect x="322" y="70" width="30" height="20" fill="#3f9a37"/></svg>`;
  }
  function nightScene() {
    let b = '';
    const hs = [70, 110, 60, 130, 90, 120, 76, 100, 64];
    hs.forEach((h, i) => {
      const x = i * 48 - 6;
      b += `<rect x="${x}" y="${240 - h}" width="44" height="${h}" fill="${i % 2 ? '#2a1f52' : '#372a6b'}"/>`;
      for (let j = 0; j < h / 20 - 1; j++) if ((i + j) % 2 === 0) b += `<rect x="${x + 8}" y="${240 - h + 8 + j * 20}" width="6" height="8" fill="#ffd97a"/><rect x="${x + 26}" y="${240 - h + 18 + j * 20}" width="6" height="8" fill="#ffd97a"/>`;
    });
    return `<svg viewBox="0 0 420 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${b}</svg>`;
  }
  function nightSky() {
    let s = '';
    for (let i = 0; i < 26; i++) s += `<circle cx="${(i * 97) % 420}" cy="${(i * 53) % 300}" r="${i % 3 ? 1.2 : 2}" fill="#fff" opacity="${0.5 + (i % 5) / 10}"/>`;
    return `<svg viewBox="0 0 420 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${s}<circle cx="330" cy="70" r="26" fill="#fff6c9"/><circle cx="342" cy="62" r="24" fill="#5a3f9e" opacity=".55"/></svg>`;
  }
  function beachScene() {
    return `<svg viewBox="0 0 420 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="330" cy="60" r="32" fill="#ffe27a"/>
<rect y="118" width="420" height="60" fill="#5cc8e8"/>
<path d="M0 132q26-12 52 0t52 0 52 0 52 0 52 0 52 0 52 0 52 0" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>
<path d="M0 170Q100 150 210 168T420 160V240H0z" fill="#fbe3a6"/><path d="M0 200Q120 184 240 198T420 192V240H0z" fill="#f6d488"/>
<g fill="#ff8fb8"><path d="M70 208l6-8 6 8z"/><circle cx="320" cy="214" r="6"/></g></svg>`;
  }

  const T = {
    pink:      { name: 'Sweet pink',  emoji: '🌸', sky: 'linear-gradient(#ffc6ee,#e57bff 70%,#c45cf0)', accent: '#ff3d95', accent2: '#c2256f', ink: '#8a1c5c', font: "'Fredoka',system-ui,sans-serif", scene: pinkScene, cloud: puff, cloudColor: '#fff' },
    minecraft: { name: 'Blocky',      emoji: '🟩', sky: 'linear-gradient(#78c6ff,#cdeeff)',            accent: '#4fa63d', accent2: '#2f6f25', ink: '#22321f', font: "'Press Start 2P','Fredoka',monospace", scene: mcScene, cloud: block, cloudColor: '#fff', blocky: true },
    night:     { name: 'Night city',  emoji: '🌙', sky: 'linear-gradient(#1c1447,#4a2f96 80%,#7a4fc4)',  accent: '#ffb84d', accent2: '#c27a12', ink: '#fff4d6', font: "'Fredoka',system-ui,sans-serif", scene: nightScene, sky2: nightSky, cloud: puff, cloudColor: '#8f7bd6', dark: true },
    beach:     { name: 'Beach day',   emoji: '🏖️', sky: 'linear-gradient(#8fdcff,#d6f4ff)',             accent: '#ff7a59', accent2: '#c2452a', ink: '#0f5c7a', font: "'Fredoka',system-ui,sans-serif", scene: beachScene, cloud: puff, cloudColor: '#fff' },
    custom:    { name: 'My colour',   emoji: '🎨', sky: null,                                            accent: null, accent2: null, ink: '#3a2a4a', font: "'Fredoka',system-ui,sans-serif", scene: pinkScene, cloud: puff, cloudColor: '#fff' }
  };
  window.THEMES = T;
  window.THEME_ORDER = ['pink', 'minecraft', 'night', 'beach', 'custom'];
})();
