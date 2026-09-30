// Ren spill-logikk for Othello på 6×6. Ingen DOM, ingen klokke.
// Tilfeldighet (for lett nivå) sendes inn som en rand()-funksjon som gir tall i [0, 1).
//
// Brettet er en flat liste med 36 ruter, rad for rad: indeks = rad * 6 + kolonne.
// En rute er null (tom), 0 (mørk) eller 1 (lys). Mørk begynner.

const Othello = {
  SIZE: 6,
  DIRS: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  LEVELS: {
    lett: { greedy: true, blunder: 0.4 },
    middels: { depth: 3, exact: 0 },
    vanskelig: { depth: 6, exact: 10 },
  },
  // Verdien av hver rute for datamaskinen: hjørner er gode, rutene ved siden av hjørnene er farlige.
  WEIGHTS: [
    30, -8, 5, 5, -8, 30,
    -8, -15, 1, 1, -15, -8,
    5, 1, 2, 2, 1, 5,
    5, 1, 2, 2, 1, 5,
    -8, -15, 1, 1, -15, -8,
    30, -8, 5, 5, -8, 30,
  ],
  MOBILITY: 4, // poeng per lovlige trekk mer enn motstanderen
  FINAL: 1000, // poeng per brikke i forskjell når partiet er slutt

  create() {
    const cells = new Array(36).fill(null);
    cells[2 * 6 + 2] = 1;
    cells[3 * 6 + 3] = 1;
    cells[2 * 6 + 3] = 0;
    cells[3 * 6 + 2] = 0;
    return Othello.fromCells(cells, 0);
  },

  // Bygg en tilstand fra et brett der `next` står for tur. Har hen ingen trekk, står hen over;
  // har ingen av dem trekk, er partiet slutt.
  fromCells(cells, next = 0, moves = 0, last = null) {
    const base = { cells, moves, last, current: next, status: "playing", winner: null, passed: null };
    if (Othello.movesFor(cells, next).length > 0) return base;
    if (Othello.movesFor(cells, 1 - next).length > 0) return { ...base, current: 1 - next, passed: next };
    const [a, b] = Othello.count({ cells });
    return { ...base, status: "over", winner: a === b ? "draw" : a > b ? 0 : 1 };
  },

  // Brikkene som snus hvis `player` legger i rute i. Tom liste = ulovlig trekk.
  flips(cells, i, player) {
    if (i < 0 || i >= 36 || (cells[i] !== null && cells[i] !== -1)) return [];
    const x = i % 6;
    const y = (i - x) / 6;
    const out = [];
    for (const [dx, dy] of Othello.DIRS) {
      let cx = x + dx;
      let cy = y + dy;
      const run = [];
      while (cx >= 0 && cx < 6 && cy >= 0 && cy < 6 && cells[cy * 6 + cx] === 1 - player) {
        run.push(cy * 6 + cx);
        cx += dx;
        cy += dy;
      }
      if (run.length && cx >= 0 && cx < 6 && cy >= 0 && cy < 6 && cells[cy * 6 + cx] === player) {
        for (const r of run) out.push(r);
      }
    }
    return out;
  },

  movesFor(cells, player) {
    const out = [];
    for (let i = 0; i < 36; i++) if (Othello.flips(cells, i, player).length) out.push(i);
    return out;
  },

  // Lovlige trekk for spilleren som har tur.
  legalMoves(state) {
    return state.status === "playing" ? Othello.movesFor(state.cells, state.current) : [];
  },

  canPlay(state, i) {
    return state.status === "playing" && Othello.flips(state.cells, i, state.current).length > 0;
  },

  // Antall brikker: [mørk, lys].
  count(state) {
    let a = 0;
    let b = 0;
    for (const v of state.cells) {
      if (v === 0) a++;
      else if (v === 1) b++;
    }
    return [a, b];
  },

  // Legg en brikke i rute i for spilleren som har tur. Ulovlig trekk gir samme tilstand tilbake.
  // Etterpå er `current` den som skal trekke, og `passed` den som eventuelt måtte stå over.
  play(state, i) {
    if (state.status !== "playing") return state;
    const player = state.current;
    const flipped = Othello.flips(state.cells, i, player);
    if (flipped.length === 0) return state;
    const cells = state.cells.slice();
    cells[i] = player;
    for (const f of flipped) cells[f] = player;
    return Othello.fromCells(cells, 1 - player, state.moves + 1, { i, player, flipped });
  },

  // Seiersrekke etter et parti. result: "win" | "loss" | "draw" | "abandon".
  nextStreak(streak, result) {
    if (result === "win") return streak + 1;
    if (result === "draw") return streak;
    return 0;
  },

  // ---------- Datamaskinen ----------

  // Velg rute for spilleren som har tur. level: "lett" | "middels" | "vanskelig".
  chooseMove(state, level = "middels", rand = Math.random) {
    const legal = Othello.legalMoves(state);
    if (legal.length === 0) return null;
    const me = state.current;
    const cfg = Othello.LEVELS[level] || Othello.LEVELS.middels;

    if (cfg.greedy) {
      if (rand() < cfg.blunder) return legal[Math.floor(rand() * legal.length)];
      let best = legal[0];
      let most = 0;
      for (const i of legal) {
        const n = Othello.flips(state.cells, i, me).length;
        if (n > most) {
          most = n;
          best = i;
        }
      }
      return best;
    }

    const g = Int8Array.from(state.cells, (v) => (v === null ? -1 : v));
    let empty = 0;
    for (const v of g) if (v === -1) empty++;
    const depth = empty <= cfg.exact ? 99 : cfg.depth;

    let best = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    for (const i of Othello.ORDER) {
      const flipped = Othello.flips(g, i, me);
      if (flipped.length === 0) continue;
      Othello.Search.put(g, i, flipped, me);
      const score = -Othello.Search.negamax(g, 1 - me, depth - 1, -Infinity, -alpha, false);
      Othello.Search.take(g, i, flipped, me);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
      if (score > alpha) alpha = score;
    }
    return best;
  },
};

// Søkerekkefølge: de mest verdifulle rutene først. Det gir raskere alfa-beta-søk.
Othello.ORDER = Othello.WEIGHTS.map((_, i) => i).sort((a, b) => Othello.WEIGHTS[b] - Othello.WEIGHTS[a] || a - b);

// Søket jobber på en muterbar kopi av brettet (Int8Array, -1 = tom).
Othello.Search = {
  put(g, i, flipped, p) {
    g[i] = p;
    for (const f of flipped) g[f] = p;
  },
  take(g, i, flipped, p) {
    g[i] = -1;
    for (const f of flipped) g[f] = 1 - p;
  },
  mobility(g, p) {
    let n = 0;
    for (let i = 0; i < 36; i++) if (g[i] === -1 && Othello.flips(g, i, p).length) n++;
    return n;
  },
  // Poeng for stillingen sett fra spiller p.
  evaluate(g, p) {
    let score = 0;
    for (let i = 0; i < 36; i++) {
      if (g[i] === p) score += Othello.WEIGHTS[i];
      else if (g[i] === 1 - p) score -= Othello.WEIGHTS[i];
    }
    return score + Othello.MOBILITY * (Othello.Search.mobility(g, p) - Othello.Search.mobility(g, 1 - p));
  },
  // Sluttstilling: brikkeforskjellen, sett fra p.
  final(g, p) {
    let diff = 0;
    for (let i = 0; i < 36; i++) {
      if (g[i] === p) diff++;
      else if (g[i] === 1 - p) diff--;
    }
    return diff * Othello.FINAL;
  },
  // Negamax med alfa-beta. Returnerer poeng sett fra p, som har tur.
  // Å stå over bruker ikke opp søkedybde. `passed` er sann når motstanderen nettopp sto over.
  negamax(g, p, depth, alpha, beta, passed) {
    if (depth <= 0) return Othello.Search.evaluate(g, p);
    let best = -Infinity;
    for (const i of Othello.ORDER) {
      if (g[i] !== -1) continue;
      const flipped = Othello.flips(g, i, p);
      if (flipped.length === 0) continue;
      Othello.Search.put(g, i, flipped, p);
      const score = -Othello.Search.negamax(g, 1 - p, depth - 1, -beta, -alpha, false);
      Othello.Search.take(g, i, flipped, p);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    if (best !== -Infinity) return best;
    // Ingen lovlige trekk: stå over, eller slutt hvis motstanderen også sto over.
    if (passed) return Othello.Search.final(g, p);
    return -Othello.Search.negamax(g, 1 - p, depth, -beta, -alpha, true);
  },
};

if (typeof module !== "undefined") module.exports = Othello;
