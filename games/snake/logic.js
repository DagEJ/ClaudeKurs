// Ren spill-logikk for Snake. Ingen DOM, ingen klokke, ingen Math.random:
// tid (dt i ms) og tilfeldighet (rand() i [0, 1)) sendes inn fra game.js.
//
// Tilstand:
//   cols, rows    brettstørrelse
//   snake         liste med ruter { x, y }, hodet først
//   dir           retningen slangen går nå ("up" | "down" | "left" | "right")
//   queue         svinger som venter på neste steg (maks QUEUE_MAX)
//   apple         { x, y } eller null når brettet er fullt
//   status        "ready" (venter på første retning) | "playing" | "over" | "won"
//   score         antall epler spist
//   acc           tid samlet opp mot neste steg (ms)
//   crash         { x, y, reason: "wall" | "self" } når spillet er tapt, ellers null
const Snake = (function () {
  const COLS = 15;
  const ROWS = 15;
  const START_LENGTH = 3;
  const START_INTERVAL = 160; // ms per steg ved start
  const INTERVAL_STEP = 4; // så mye kortere blir steget per eple
  const MIN_INTERVAL = 70; // raskeste fart
  const QUEUE_MAX = 2;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  function interval(score) {
    return Math.max(MIN_INTERVAL, START_INTERVAL - score * INTERVAL_STEP);
  }

  // Et tilfeldig ledig felt, eller null når slangen fyller brettet.
  function placeApple(snake, cols, rows, rand) {
    const taken = new Set(snake.map((p) => p.y * cols + p.x));
    const free = [];
    for (let i = 0; i < cols * rows; i++) if (!taken.has(i)) free.push(i);
    if (free.length === 0) return null;
    const i = free[Math.min(free.length - 1, Math.floor(rand() * free.length))];
    return { x: i % cols, y: Math.floor(i / cols) };
  }

  function newGame(rand, opts = {}) {
    const cols = opts.cols || COLS;
    const rows = opts.rows || ROWS;
    const len = opts.length || START_LENGTH;
    const hx = Math.floor(cols / 2);
    const hy = Math.floor(rows / 2);
    const snake = [];
    for (let i = 0; i < len; i++) snake.push({ x: hx - i, y: hy });
    return {
      cols,
      rows,
      snake,
      dir: "right",
      queue: [],
      apple: placeApple(snake, cols, rows, rand),
      status: "ready",
      score: 0,
      acc: 0,
      crash: null,
    };
  }

  // Legger en sving i køen. Svingen sammenlignes med den siste svingen i køen
  // (eller retningen slangen har), så rett bakover og samme retning ignoreres.
  // Ved "ready" starter en gyldig retning spillet.
  function turn(state, dir) {
    if (!DIRS[dir]) return state;
    if (state.status !== "ready" && state.status !== "playing") return state;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (state.status === "ready") {
      if (dir === OPPOSITE[state.dir]) return state;
      const queue = dir === state.dir ? [] : [dir];
      return { ...state, status: "playing", queue, acc: 0 };
    }
    if (dir === last || dir === OPPOSITE[last]) return state;
    if (state.queue.length >= QUEUE_MAX) return state;
    return { ...state, queue: [...state.queue, dir] };
  }

  // Ett steg: ta neste sving fra køen, flytt hodet, spis eller flytt halen, sjekk krasj.
  function tick(state, rand) {
    if (state.status !== "playing") return state;
    const queue = state.queue.slice();
    const dir = queue.length ? queue.shift() : state.dir;
    const d = DIRS[dir];
    const head = state.snake[0];
    const next = { x: head.x + d.x, y: head.y + d.y };

    if (next.x < 0 || next.y < 0 || next.x >= state.cols || next.y >= state.rows) {
      return { ...state, dir, queue, status: "over", crash: { ...next, reason: "wall" } };
    }

    const eats = state.apple !== null && next.x === state.apple.x && next.y === state.apple.y;
    // Halen flytter seg samme steg (hvis slangen ikke vokser), så den ruta er ledig.
    const body = eats ? state.snake : state.snake.slice(0, -1);
    if (body.some((p) => p.x === next.x && p.y === next.y)) {
      return { ...state, dir, queue, status: "over", crash: { ...next, reason: "self" } };
    }

    const snake = [next, ...body];
    if (!eats) return { ...state, snake, dir, queue };

    const score = state.score + 1;
    const apple = placeApple(snake, state.cols, state.rows, rand);
    return { ...state, snake, dir, queue, score, apple, status: apple ? "playing" : "won" };
  }

  // Lar tiden gå dt ms, og tar så mange steg som farten tilsier.
  function step(state, dt, rand) {
    if (state.status !== "playing") return state;
    let s = { ...state, acc: state.acc + dt };
    while (s.status === "playing" && s.acc >= interval(s.score)) {
      const acc = s.acc - interval(s.score);
      s = { ...tick(s, rand), acc };
    }
    return s;
  }

  return {
    COLS, ROWS, START_LENGTH, START_INTERVAL, INTERVAL_STEP, MIN_INTERVAL, QUEUE_MAX, DIRS, OPPOSITE,
    interval, placeApple, newGame, turn, tick, step,
  };
})();

if (typeof module !== "undefined") module.exports = Snake;
