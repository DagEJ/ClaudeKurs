// Ren spill-logikk for 2048 med tidsangrep.
// Ingen DOM og ingen klokke: tidssteg (ms) og en rand()-funksjon som gir tall i [0, 1) sendes inn.
//
// Brikker: { id, v, r, c } – id er fast gjennom spillet, slik at tegningen kan animere.
// status: "playing" | "timeup" | "over"
// mode:   "timed" (starter slik) | "free" (etter at spilleren velger å fortsette)

const Game2048 = {
  SIZE: 4,
  TIME_MS: 120000,
  UNDOS: 3,
  HISTORY: 10,
  GOAL: 2048,

  create() {
    return {
      tiles: [],
      score: 0,
      nextId: 1,
      mode: "timed",
      status: "playing",
      started: false, // klokka starter ved første trekk
      timeLeft: Game2048.TIME_MS,
      undosLeft: Game2048.UNDOS,
      history: [],
      timedScore: null, // poeng da tiden var ute (eller da trekkene tok slutt i tidsmodus)
      reachedGoal: false,
      last: null, // hva siste handling gjorde, til tegningen
    };
  },

  newGame(rand) {
    let s = Game2048.create();
    s = Game2048.spawn(s, rand);
    s = Game2048.spawn(s, rand);
    return { ...s, last: null };
  },

  // Legg en ny brikke (2 med 90 % sjanse, ellers 4) i en tilfeldig tom rute.
  spawn(state, rand) {
    const n = Game2048.SIZE;
    const taken = new Set(state.tiles.map((t) => t.r * n + t.c));
    const empty = [];
    for (let i = 0; i < n * n; i++) if (!taken.has(i)) empty.push(i);
    if (empty.length === 0) return state;
    const cell = empty[Math.floor(rand() * empty.length)];
    const tile = { id: state.nextId, v: rand() < 0.9 ? 2 : 4, r: Math.floor(cell / n), c: cell % n };
    return { ...state, tiles: [...state.tiles, tile], nextId: state.nextId + 1 };
  },

  // Skyv alle brikker i én retning. Hver brikke kan slås sammen bare én gang per trekk.
  // Returnerer { tiles, gained, moved, removed: [{id, r, c}], merged: [id] }.
  slide(tiles, dir) {
    const n = Game2048.SIZE;
    const [dr, dc] = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[dir];
    const idx = [...Array(n).keys()];
    const rows = dr === 1 ? idx.slice().reverse() : idx;
    const cols = dc === 1 ? idx.slice().reverse() : idx;

    const copy = tiles.map((t) => ({ ...t }));
    const grid = idx.map(() => Array(n).fill(null));
    copy.forEach((t) => (grid[t.r][t.c] = t));

    const merged = new Set();
    const removed = [];
    let moved = false;
    let gained = 0;

    for (const r of rows) {
      for (const c of cols) {
        const t = grid[r][c];
        if (!t) continue;
        let nr = r;
        let nc = c;
        let gone = false;
        for (;;) {
          const tr = nr + dr;
          const tc = nc + dc;
          if (tr < 0 || tr >= n || tc < 0 || tc >= n) break;
          const other = grid[tr][tc];
          if (!other) {
            nr = tr;
            nc = tc;
            continue;
          }
          if (other.v === t.v && !merged.has(other.id)) {
            other.v *= 2;
            gained += other.v;
            merged.add(other.id);
            grid[r][c] = null;
            removed.push({ id: t.id, r: tr, c: tc });
            gone = true;
            moved = true;
          }
          break;
        }
        if (!gone && (nr !== r || nc !== c)) {
          grid[r][c] = null;
          grid[nr][nc] = t;
          t.r = nr;
          t.c = nc;
          moved = true;
        }
      }
    }

    const removedIds = new Set(removed.map((x) => x.id));
    return {
      tiles: copy.filter((t) => !removedIds.has(t.id)),
      gained,
      moved,
      removed,
      merged: [...merged],
    };
  },

  canMove(state) {
    const n = Game2048.SIZE;
    if (state.tiles.length < n * n) return true;
    const at = {};
    state.tiles.forEach((t) => (at[t.r + "," + t.c] = t.v));
    return state.tiles.some(
      (t) => at[t.r + "," + (t.c + 1)] === t.v || at[t.r + 1 + "," + t.c] === t.v
    );
  },

  maxTile(state) {
    return state.tiles.reduce((m, t) => Math.max(m, t.v), 0);
  },

  // Ett trekk: skyv, legg til ny brikke, sjekk mål og slutt.
  step(state, dir, rand) {
    if (state.status !== "playing") return state;
    const res = Game2048.slide(state.tiles, dir);
    if (!res.moved) return state;

    const snapshot = { tiles: state.tiles, score: state.score };
    let s = {
      ...state,
      tiles: res.tiles,
      score: state.score + res.gained,
      started: true,
      history: [...state.history, snapshot].slice(-Game2048.HISTORY),
    };
    s = Game2048.spawn(s, rand);
    s.last = {
      removed: res.removed,
      merged: res.merged,
      newId: s.nextId - 1,
      gained: res.gained,
      goal: false,
    };
    if (!s.reachedGoal && Game2048.maxTile(s) >= Game2048.GOAL) {
      s.reachedGoal = true;
      s.last.goal = true;
    }
    if (!Game2048.canMove(s)) {
      s.status = "over";
      if (s.mode === "timed") s.timedScore = s.score;
    }
    return s;
  },

  // Flytt klokka fremover. Går bare i tidsmodus, mens spillet pågår, etter første trekk.
  tick(state, dtMs) {
    if (state.mode !== "timed" || state.status !== "playing" || !state.started) return state;
    const timeLeft = Math.max(0, state.timeLeft - dtMs);
    if (timeLeft === 0) {
      return { ...state, timeLeft, status: "timeup", timedScore: state.score, last: null };
    }
    return { ...state, timeLeft };
  },

  // Etter at tiden er ute: spill videre uten tid på samme brett.
  continueFree(state) {
    if (state.status !== "timeup") return state;
    return { ...state, mode: "free", status: "playing", last: null };
  },

  canUndo(state) {
    return (
      (state.status === "playing" || state.status === "over") &&
      state.undosLeft > 0 &&
      state.history.length > 0
    );
  },

  // Gå ett trekk tilbake. Virker også når det ikke er flere trekk (redder spillet).
  undo(state) {
    if (!Game2048.canUndo(state)) return state;
    const prev = state.history[state.history.length - 1];
    return {
      ...state,
      tiles: prev.tiles,
      score: prev.score,
      history: state.history.slice(0, -1),
      undosLeft: state.undosLeft - 1,
      status: "playing",
      timedScore: state.mode === "timed" ? null : state.timedScore,
      last: { undo: true },
    };
  },
};

if (typeof module !== "undefined") module.exports = Game2048;
