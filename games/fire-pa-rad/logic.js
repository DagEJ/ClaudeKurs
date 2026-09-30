// Ren spill-logikk for Fire på rad. Ingen DOM, ingen klokke.
// Tilfeldighet (for lett nivå) sendes inn som en rand()-funksjon som gir tall i [0, 1).
//
// Brettet lagres som 7 kolonner, hver en liste med spillernummer (0 eller 1) nedenfra og opp.
// cols[c][r] er brikken i kolonne c, rad r (r = 0 er nederst).

const FourInARow = {
  COLS: 7,
  ROWS: 6,
  // Søkerekkefølge: midten først. Det gir bedre trekk ved likt og raskere alfa-beta-søk.
  ORDER: [3, 2, 4, 1, 5, 0, 6],
  LEVELS: {
    lett: { depth: 2, blunder: 0.35 },
    middels: { depth: 4, blunder: 0 },
    vanskelig: { depth: 7, blunder: 0 },
  },
  WIN_SCORE: 1000000,

  create(first = 0) {
    return {
      cols: Array.from({ length: FourInARow.COLS }, () => []),
      current: first,
      status: "playing", // "playing" | "over"
      winner: null, // 0, 1 eller "draw"
      line: null, // [[c, r], ...] for vinnerrekken
      moves: 0,
      last: null, // { c, r, player }
    };
  },

  canDrop(state, c) {
    return state.status === "playing" && c >= 0 && c < FourInARow.COLS && state.cols[c].length < FourInARow.ROWS;
  },

  legalMoves(state) {
    return FourInARow.ORDER.filter((c) => FourInARow.canDrop(state, c)).sort((a, b) => a - b);
  },

  // Finn fire (eller flere) på rad gjennom ruten (c, r). Returnerer rutene, eller null.
  findLine(cols, c, r) {
    const p = cols[c][r];
    if (p === undefined) return null;
    const at = (cc, rr) => (cc >= 0 && cc < FourInARow.COLS ? cols[cc][rr] : undefined);
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const cells = [[c, r]];
      for (let k = 1; at(c + dc * k, r + dr * k) === p; k++) cells.push([c + dc * k, r + dr * k]);
      for (let k = 1; at(c - dc * k, r - dr * k) === p; k++) cells.unshift([c - dc * k, r - dr * k]);
      if (cells.length >= 4) return cells;
    }
    return null;
  },

  // Legg en brikke i kolonne c for spilleren som har tur.
  drop(state, c) {
    if (!FourInARow.canDrop(state, c)) return state;
    const player = state.current;
    const cols = state.cols.map((col, i) => (i === c ? [...col, player] : col));
    const r = cols[c].length - 1;
    const moves = state.moves + 1;
    const last = { c, r, player };

    const line = FourInARow.findLine(cols, c, r);
    if (line) return { ...state, cols, moves, last, status: "over", winner: player, line };
    if (moves === FourInARow.COLS * FourInARow.ROWS) {
      return { ...state, cols, moves, last, status: "over", winner: "draw", line: null };
    }
    return { ...state, cols, moves, last, current: 1 - player };
  },

  // Seiersrekke etter et parti. result: "win" | "loss" | "draw" | "abandon".
  nextStreak(streak, result) {
    if (result === "win") return streak + 1;
    if (result === "draw") return streak;
    return 0;
  },

  // ---------- Datamaskinen ----------

  // Velg kolonne for spilleren som har tur. level: "lett" | "middels" | "vanskelig".
  chooseMove(state, level = "middels", rand = Math.random) {
    const legal = FourInARow.legalMoves(state);
    if (legal.length === 0) return null;
    const me = state.current;
    const cfg = FourInARow.LEVELS[level] || FourInARow.LEVELS.middels;
    const s = FourInARow.Search.from(state);

    // Alle nivåer tar en vinnende rute de ser.
    for (const c of FourInARow.ORDER) {
      if (s.h[c] < FourInARow.ROWS && s.winsIf(c, me)) return c;
    }
    if (cfg.blunder > 0 && rand() < cfg.blunder) {
      return legal[Math.floor(rand() * legal.length)];
    }

    let best = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    for (const c of FourInARow.ORDER) {
      if (s.h[c] >= FourInARow.ROWS) continue;
      s.play(c, me);
      const score = s.won(c) ? FourInARow.WIN_SCORE : -s.negamax(cfg.depth - 1, -Infinity, -alpha, 1 - me);
      s.undo(c);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
      if (score > alpha) alpha = score;
    }
    return best;
  },
};

// Rask, muterbar kopi av brettet som bare brukes inni søket.
FourInARow.Search = {
  // Alle vinduer på fire ruter (69 stykker), som indekser i et flatt brett (c * ROWS + r).
  WINDOWS: (() => {
    const w = [];
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 6; r++) {
        for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const ec = c + dc * 3;
          const er = r + dr * 3;
          if (ec < 0 || ec > 6 || er < 0 || er > 5) continue;
          w.push([0, 1, 2, 3].map((k) => (c + dc * k) * 6 + (r + dr * k)));
        }
      }
    }
    return w;
  })(),

  from(state) {
    const s = Object.create(FourInARow.Search.proto);
    s.g = new Int8Array(42).fill(-1);
    s.h = new Int8Array(7);
    state.cols.forEach((col, c) => {
      col.forEach((p, r) => (s.g[c * 6 + r] = p));
      s.h[c] = col.length;
    });
    s.count = state.moves;
    return s;
  },

  proto: {
    play(c, p) {
      this.g[c * 6 + this.h[c]] = p;
      this.h[c]++;
      this.count++;
    },
    undo(c) {
      this.h[c]--;
      this.g[c * 6 + this.h[c]] = -1;
      this.count--;
    },
    // Ga siste brikke i kolonne c fire på rad?
    won(c) {
      const r = this.h[c] - 1;
      const p = this.g[c * 6 + r];
      const at = (cc, rr) => (cc >= 0 && cc < 7 && rr >= 0 && rr < 6 ? this.g[cc * 6 + rr] : -2);
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        let n = 1;
        for (let k = 1; at(c + dc * k, r + dr * k) === p; k++) n++;
        for (let k = 1; at(c - dc * k, r - dr * k) === p; k++) n++;
        if (n >= 4) return true;
      }
      return false;
    },
    winsIf(c, p) {
      this.play(c, p);
      const w = this.won(c);
      this.undo(c);
      return w;
    },
    // Poeng for stillingen sett fra spiller p.
    evaluate(p) {
      let score = 0;
      for (let r = 0; r < 6; r++) {
        const v = this.g[3 * 6 + r];
        if (v === p) score += 3;
        else if (v === 1 - p) score -= 3;
      }
      for (const w of FourInARow.Search.WINDOWS) {
        let mine = 0;
        let theirs = 0;
        for (const i of w) {
          const v = this.g[i];
          if (v === p) mine++;
          else if (v !== -1) theirs++;
        }
        if (mine && theirs) continue;
        if (mine === 3) score += 5;
        else if (mine === 2) score += 2;
        else if (theirs === 3) score -= 5;
        else if (theirs === 2) score -= 2;
      }
      return score;
    },
    // Negamax med alfa-beta. Returnerer poeng sett fra p, som har tur.
    // Raskere seier og senere tap gir bedre poeng (derfor + dybde).
    negamax(depth, alpha, beta, p) {
      if (this.count === 42) return 0;
      if (depth === 0) return this.evaluate(p);
      let best = -Infinity;
      for (const c of FourInARow.ORDER) {
        if (this.h[c] >= 6) continue;
        this.play(c, p);
        const score = this.won(c) ? FourInARow.WIN_SCORE + depth : -this.negamax(depth - 1, -beta, -alpha, 1 - p);
        this.undo(c);
        if (score > best) best = score;
        if (score > alpha) alpha = score;
        if (alpha >= beta) break;
      }
      return best;
    },
  },
};

if (typeof module !== "undefined") module.exports = FourInARow;
