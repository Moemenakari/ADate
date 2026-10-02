// The three small games two people can play in a chat: tic-tac-toe, draw and guess, and a quick quiz with choices.
// Pure rules only: no database here. The match chat and the friends' chat both use these.
const WORDS = ['cat', 'dog', 'house', 'pizza', 'sun', 'moon', 'tree', 'car', 'fish', 'apple', 'banana', 'phone', 'book', 'bike', 'flower', 'cake', 'star', 'heart', 'rain', 'cloud', 'boat', 'train', 'plane', 'ball', 'shoe', 'hat', 'glasses', 'clock', 'key', 'door', 'chair', 'bed', 'camera', 'guitar', 'rocket', 'robot', 'ice cream', 'burger', 'coffee', 'rainbow', 'mountain', 'beach', 'umbrella', 'snowman', 'butterfly', 'bird', 'horse', 'turtle', 'lion', 'elephant', 'pencil', 'balloon', 'crown', 'candle', 'ghost', 'pumpkin', 'island', 'bridge', 'castle', 'volcano'];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
// Quick "pick one" questions. Each has 3 choices.
const QUIZ = [
  ['Pick a superpower', ['Fly', 'Read minds', 'Be invisible']], ['Best weekend plan?', ['Movie night', 'Hang out outside', 'Sleep all day']], ['Pick a pizza', ['Cheese', 'Pepperoni', 'Veggie']], ['Pick a pet', ['Dog', 'Cat', 'Parrot']],
  ['Where would you travel?', ['Beach', 'Mountains', 'Big city']], ['Pick a drink', ['Juice', 'Coffee', 'Soda']], ['Best time of day?', ['Morning', 'Evening', 'Late night']], ['Pick a snack', ['Chips', 'Chocolate', 'Fruit']],
  ['Pick a game type', ['Racing', 'Puzzle', 'Adventure']], ['Pick a season', ['Summer', 'Winter', 'Spring']], ['What do you do when you are bored?', ['Music', 'Games', 'Draw']], ['Pick a movie type', ['Comedy', 'Action', 'Cartoon']],
  ['Pick a talent', ['Sing', 'Dance', 'Draw']], ['Pick a dessert', ['Ice cream', 'Cake', 'Cookies']], ['Pick a color', ['Blue', 'Purple', 'Yellow']], ['Pick a place to live', ['Near the sea', 'In the mountains', 'In the city']],
  ['Best way to talk to a friend?', ['Voice note', 'Text', 'Meet in person']], ['Pick a sport', ['Football', 'Basketball', 'Swimming']], ['Pick a hobby', ['Photography', 'Gaming', 'Cooking']], ['Pick an animal', ['Lion', 'Dolphin', 'Eagle']],
  ['Pick a sandwich', ['Falafel', 'Shawarma', 'Cheese']], ['Pick a trip', ['Camping', 'Hotel', 'Road trip']], ['Pick a gift', ['A book', 'A game', 'A hoodie']], ['Pick a morning', ['Early and calm', 'Late and slow', 'Busy and fun']],
  ['Pick a school subject', ['Art', 'Science', 'Sports']], ['Pick a music type', ['Pop', 'Rap', 'Chill']], ['Pick a fruit', ['Mango', 'Strawberry', 'Watermelon']], ['Pick a role in a team', ['Leader', 'Joker', 'Planner']],
  ['Pick a cartoon world', ['Space', 'Ocean', 'Jungle']], ['Pick a rainy day plan', ['Hot chocolate', 'Video games', 'Long nap']]
];

const fail = (message, status) => { const e = new Error(message); e.status = status || 409; return e; };
const norm = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The first state of a game. `starter` goes first (X, or the drawer). */
function init(type, starter, other) {
  if (type === 'xo') return { v: 0, board: Array(9).fill(''), x: starter, o: other, turn: starter, winner: null };
  if (type === 'draw') return { v: 0, drawer: starter, word: WORDS[Math.floor(Math.random() * WORDS.length)], strokes: [], solved: false, guesses: 0 };
  if (type === 'quiz') { const q = QUIZ[Math.floor(Math.random() * QUIZ.length)]; return { v: 0, q: q[0], opts: q[1], picks: {} }; }
  throw fail('Unknown game', 400);
}
const LABEL = { xo: '❌⭕ Tic-Tac-Toe', draw: '🎨 Draw and guess', quiz: '🎲 Quick question', tod: '🎭 Truth or Dare' };

/** What one player is allowed to see. The secret word is hidden from the guesser until it is solved. */
function view(type, st, uid) {
  if (type === 'xo') { const win = st.winner == null ? null : st.winner === 'draw' ? 'draw' : st.winner === uid ? 'me' : 'them'; return { type, board: st.board, my_turn: st.turn === uid && win == null, mark: st.x === uid ? 'X' : 'O', winner: win, line: st.line || null, done: win != null }; }
  if (type === 'draw') { const drawer = st.drawer === uid; return { type, i_draw: drawer, word: drawer || st.solved ? st.word : null, letters: st.word.length, strokes: st.strokes, solved: !!st.solved, guesses: st.guesses || 0, done: !!st.solved }; }
  if (type === 'quiz') { const mine = st.picks[uid], both = Object.keys(st.picks).length >= 2; const other = Object.entries(st.picks).find(([k]) => Number(k) !== uid); return { type, q: st.q, opts: st.opts, my_pick: mine == null ? null : mine, their_pick: both && other ? other[1] : null, their_done: !!other, done: both }; }
  return null;
}

/** One player acts. Returns { st, text } (text = an optional line to show in the chat). Throws an Error with .status when the move is not allowed. */
function act(type, st, uid, a) {
  if (type === 'xo') {
    const cell = Number(a.cell);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw fail('Bad square', 400);
    if (st.winner != null) throw fail('This game is over');
    if (st.turn !== uid) throw fail('Wait for your turn');
    if (st.board[cell]) throw fail('That square is taken');
    st.board[cell] = uid === st.x ? 'X' : 'O';
    const line = LINES.find((l) => l.every((i) => st.board[i] && st.board[i] === st.board[l[0]]));
    if (line) { st.winner = uid; st.line = line; } else if (st.board.every(Boolean)) st.winner = 'draw'; else st.turn = uid === st.x ? st.o : st.x;
    return { st };
  }
  if (type === 'draw') {
    if (a.guess !== undefined) { // the other person guesses
      if (st.drawer === uid) throw fail('You are drawing. Do not tell the word!', 403);
      if (st.solved) throw fail('Already guessed');
      if ((st.guesses || 0) >= 30) throw fail('No more guesses');
      const g = norm(a.guess).slice(0, 40); if (!g) throw fail('Type a guess', 400);
      st.guesses = (st.guesses || 0) + 1;
      const ok = g === norm(st.word); if (ok) st.solved = true;
      return { st, correct: ok, text: ok ? '🎉 Correct! It was: ' + st.word : '💭 ' + g, kind: ok ? 'game' : 'text' };
    }
    if (st.drawer !== uid) throw fail('Only the drawer can draw', 403);
    if (st.solved) throw fail('Already guessed');
    if (a.clear) { st.strokes = []; return { st }; }
    const k = a.stroke || {}, pts = Array.isArray(k.p) ? k.p.slice(0, 400) : [];
    if (!pts.length || !pts.every((q) => Array.isArray(q) && q.length === 2 && q.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000))) throw fail('Bad stroke', 400);
    if (!/^#[0-9a-fA-F]{6}$/.test(String(k.c || ''))) throw fail('Bad colour', 400);
    if (st.strokes.length >= 150) throw fail('The board is full. Clear it.');
    st.strokes.push({ c: k.c, w: Math.max(2, Math.min(24, Number(k.w) || 6)), p: pts.map((q) => [Math.round(q[0]), Math.round(q[1])]) });
    return { st };
  }
  if (type === 'quiz') {
    const i = Number(a.pick);
    if (!Number.isInteger(i) || i < 0 || i >= st.opts.length) throw fail('Bad choice', 400);
    if (st.picks[uid] != null) throw fail('You already chose');
    st.picks[uid] = i;
    return { st };
  }
  throw fail('Unknown game', 400);
}
module.exports = { init, view, act, LABEL, TYPES: ['xo', 'draw', 'quiz'] };
