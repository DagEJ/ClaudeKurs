// Ren logikk for Slagskip. Ingen DOM. Tilfeldighet sendes inn som en rand()-funksjon.
// Reglene står i REGLER.md («Vår versjon»).
//
// Tilstand:
//   phase:   "placing" | "playing" | "over"
//   boards:  [spiller, datamaskin], hver { ships: [{ len, cells, horizontal } | null], shots: [bool] }
//   current: hvem som skyter (0 = spiller, 1 = datamaskin)
//   shots:   antall skudd hver har avfyrt
//   last:    siste skudd { player, i, result: "miss" | "hit" | "sunk", len }
//   winner:  null, 0 eller 1
const Battleship = (function () {
  const SIZE = 8;
  const FLEET = [4, 3, 3, 2];
  const HUMAN = 0;
  const CPU = 1;
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  // ---------- Skip og plassering ----------

  // Rutene til et skip som starter i «start» og går mot høyre eller nedover. null hvis det stikker utenfor.
  function shipCells(start, len, horizontal) {
    if (!Number.isInteger(start) || start < 0 || start >= SIZE * SIZE) return null;
    const r = Math.floor(start / SIZE);
    const c = start % SIZE;
    if ((horizontal ? c : r) + len > SIZE) return null;
    const cells = [];
    for (let k = 0; k < len; k++) cells.push(horizontal ? start + k : start + k * SIZE);
    return cells;
  }

  // Skyver startruten inn på brettet, så skipet får plass.
  function fitStart(i, len, horizontal) {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const max = SIZE - len;
    return horizontal ? r * SIZE + Math.min(c, max) : Math.min(r, max) * SIZE + c;
  }

  // Skip kan ligge inntil hverandre, men ikke overlappe. «skip» er et skip som ses bort fra (det som flyttes).
  function canPlace(ships, cells, skip = -1) {
    if (!cells) return false;
    return ships.every((s, k) => !s || k === skip || !s.cells.some((c) => cells.includes(c)));
  }

  function randomFleet(rand) {
    const ships = [];
    for (const len of FLEET) {
      const options = [];
      for (const horizontal of [true, false]) {
        for (let start = 0; start < SIZE * SIZE; start++) {
          const cells = shipCells(start, len, horizontal);
          if (canPlace(ships, cells)) options.push({ len, cells, horizontal });
        }
      }
      ships.push(pick(options, rand));
    }
    return ships;
  }

  function pick(list, rand) {
    return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  }

  const noShots = () => new Array(SIZE * SIZE).fill(false);

  function create() {
    return {
      phase: "placing",
      boards: [
        { ships: FLEET.map(() => null), shots: noShots() },
        { ships: [], shots: noShots() },
      ],
      current: HUMAN,
      shots: [0, 0],
      last: null,
      winner: null,
    };
  }

  function withHumanShips(state, ships) {
    return { ...state, boards: [{ ...state.boards[HUMAN], ships }, state.boards[CPU]] };
  }

  // Legger (eller flytter) spillerens skip nummer «index». Ugyldig plassering endrer ingenting.
  function placeShip(state, index, start, horizontal) {
    if (state.phase !== "placing" || !(index in FLEET)) return state;
    const ships = state.boards[HUMAN].ships;
    const cells = shipCells(start, FLEET[index], horizontal);
    if (!canPlace(ships, cells, index)) return state;
    return withHumanShips(state, ships.map((s, k) => (k === index ? { len: FLEET[index], cells, horizontal } : s)));
  }

  function removeShip(state, index) {
    if (state.phase !== "placing" || !state.boards[HUMAN].ships[index]) return state;
    return withHumanShips(state, state.boards[HUMAN].ships.map((s, k) => (k === index ? null : s)));
  }

  function placeRandom(state, rand) {
    if (state.phase !== "placing") return state;
    return withHumanShips(state, randomFleet(rand));
  }

  const ready = (state) => state.boards[HUMAN].ships.every(Boolean);

  // Starter kampen: datamaskinens flåte legges ut, og spilleren skyter først.
  function start(state, rand) {
    if (state.phase !== "placing" || !ready(state)) return state;
    return {
      ...state,
      phase: "playing",
      boards: [state.boards[HUMAN], { ships: randomFleet(rand), shots: noShots() }],
      current: HUMAN,
    };
  }

  // ---------- Skyting ----------

  // Hvilket skip som ligger i ruten, eller -1.
  function shipAt(board, i) {
    return board.ships.findIndex((s) => s && s.cells.includes(i));
  }

  function isSunk(board, index) {
    return board.ships[index].cells.every((c) => board.shots[c]);
  }

  function shipsLeft(board) {
    return board.ships.filter((s, k) => s && !isSunk(board, k)).length;
  }

  // Den som har turen, skyter på motstanderens rute i. Treff gir nytt skudd; bom gir turen videre.
  function shoot(state, i) {
    if (state.phase !== "playing" || !Number.isInteger(i) || i < 0 || i >= SIZE * SIZE) return state;
    const shooter = state.current;
    const target = 1 - shooter;
    if (state.boards[target].shots[i]) return state;

    const shots = state.boards[target].shots.slice();
    shots[i] = true;
    const board = { ...state.boards[target], shots };
    const index = shipAt(board, i);
    const result = index < 0 ? "miss" : isSunk(board, index) ? "sunk" : "hit";
    const over = shipsLeft(board) === 0;
    const boards = state.boards.slice();
    boards[target] = board;
    const count = state.shots.slice();
    count[shooter]++;

    return {
      ...state,
      boards,
      shots: count,
      last: { player: shooter, i, result, len: index < 0 ? 0 : board.ships[index].len },
      current: result === "miss" ? target : shooter,
      phase: over ? "over" : "playing",
      winner: over ? shooter : null,
    };
  }

  // Det motstanderen vet om et brett: bom, treff og senket per rute, og lengden på skipene som er igjen.
  function view(board) {
    const cells = board.shots.map((shot, i) => {
      if (!shot) return null;
      const index = shipAt(board, i);
      return index < 0 ? "miss" : isSunk(board, index) ? "sunk" : "hit";
    });
    const remaining = board.ships.filter((s, k) => s && !isSunk(board, k)).map((s) => s.len);
    return { cells, remaining };
  }

  // ---------- Datamaskinen ----------

  function step(i, dr, dc) {
    const r = Math.floor(i / SIZE) + dr;
    const c = (i % SIZE) + dc;
    return r < 0 || r >= SIZE || c < 0 || c >= SIZE ? null : r * SIZE + c;
  }

  // Ledige ruter ved siden av treff som ikke er senket. Ruter i forlengelsen av to treff på rad går foran.
  function followUps(v) {
    const score = new Map();
    v.cells.forEach((cell, i) => {
      if (cell !== "hit") return;
      for (const [dr, dc] of DIRS) {
        const n = step(i, dr, dc);
        if (n === null || v.cells[n] !== null) continue;
        const behind = step(i, -dr, -dc);
        const s = behind !== null && v.cells[behind] === "hit" ? 2 : 1;
        score.set(n, Math.max(score.get(n) || 0, s));
      }
    });
    const best = Math.max(0, ...score.values());
    return [...score.keys()].filter((n) => score.get(n) === best).sort((a, b) => a - b);
  }

  // For hver ledig rute: hvor mange måter skipene som er igjen, kan ligge over den.
  // Plasseringer som dekker treff som ikke er senket, veier mye tyngre.
  function density(v) {
    const weight = new Array(SIZE * SIZE).fill(0);
    for (const len of v.remaining) {
      for (const horizontal of [true, false]) {
        for (let s = 0; s < SIZE * SIZE; s++) {
          const cells = shipCells(s, len, horizontal);
          if (!cells || cells.some((c) => v.cells[c] === "miss" || v.cells[c] === "sunk")) continue;
          const hits = cells.filter((c) => v.cells[c] === "hit").length;
          const w = Math.pow(100, hits);
          for (const c of cells) if (v.cells[c] === null) weight[c] += w;
        }
      }
    }
    return weight;
  }

  // Velger rute å skyte på ut fra det som er kjent (se view). Returnerer null hvis alt er skutt på.
  function chooseMove(v, level, rand) {
    const free = [];
    v.cells.forEach((cell, i) => cell === null && free.push(i));
    if (!free.length) return null;

    if (level === "vanskelig") {
      const weight = density(v);
      const best = Math.max(...free.map((i) => weight[i]));
      return pick(free.filter((i) => weight[i] === best), rand);
    }

    const targets = followUps(v);
    if (level === "lett") {
      return targets.length && rand() < 0.5 ? pick(targets, rand) : pick(free, rand);
    }
    if (targets.length) return pick(targets, rand);
    // Minste skip er to ruter, så annenhver rute er nok til å finne alle.
    const pattern = free.filter((i) => (Math.floor(i / SIZE) + (i % SIZE)) % 2 === 0);
    return pick(pattern.length ? pattern : free, rand);
  }

  // Seiersrekke: seier +1, tap eller forlatt spill nullstiller.
  function nextStreak(streak, result) {
    return result === "win" ? streak + 1 : 0;
  }

  return {
    SIZE, FLEET, HUMAN, CPU,
    shipCells, fitStart, canPlace, randomFleet,
    create, placeShip, removeShip, placeRandom, ready, start,
    shipAt, isSunk, shipsLeft, shoot, view,
    followUps, density, chooseMove, nextStreak,
  };
})();

if (typeof module !== "undefined") module.exports = Battleship;
