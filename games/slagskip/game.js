// Tegning, input og turflyt for Slagskip. Reglene og datamaskinen ligger i logic.js.
(function () {
  const GAME_ID = "slagskip";
  const B = Battleship;
  const { SIZE, FLEET, HUMAN, CPU } = B;
  const CPU_DELAY = 750;
  const END_DELAY = 1100; // la sluttstillingen vises litt før sluttkortet
  const LEVEL_NAMES = { lett: "lett", middels: "middels", vanskelig: "vanskelig" };
  const CENTER = 3 * SIZE + 3;

  const el = {
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    mini: document.getElementById("mini"),
    caption: document.getElementById("caption"),
    ships: document.getElementById("ships"),
    rotate: document.getElementById("rotate"),
    random: document.getElementById("random"),
    start: document.getElementById("start"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    sides: [document.getElementById("side0"), document.getElementById("side1")],
    counts: [document.getElementById("count0"), document.getElementById("count1")],
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
    levels: [...document.querySelectorAll(".level")],
  };

  let state = B.create();
  let level = "middels";
  let cursor = CENTER; // valgt rute for tastaturet
  let hover = null; // ruten musa er over (forhåndsvisning)
  let selected = 0; // skipet som skal legges, eller -1
  let horizontal = true;
  let lastFleet = null; // oppstillingen fra forrige spill
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres
  const streaks = { lett: 0, middels: 0, vanskelig: 0 };
  const bestKey = () => GAME_ID + ":" + level;
  const where = (i) => "Rad " + (Math.floor(i / SIZE) + 1) + ", kolonne " + ((i % SIZE) + 1) + ": ";

  // ---------- Brett ----------

  const cells = [];
  const miniCells = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const b = document.createElement("button");
    b.className = "cell";
    b.dataset.i = i;
    el.grid.appendChild(b);
    cells.push(b);
    const d = document.createElement("div");
    d.className = "cell";
    el.mini.appendChild(d);
    miniCells.push(d);
  }

  const shipButtons = FLEET.map((len, k) => {
    const b = document.createElement("button");
    b.className = "shipbtn";
    for (let s = 0; s < len; s++) b.appendChild(document.createElement("span")).className = "seg";
    b.addEventListener("click", () => chooseShip(k));
    el.ships.appendChild(b);
    return b;
  });

  function humanTurn() {
    return state.phase === "playing" && state.current === HUMAN && !Common.isOverlayOpen(el.board);
  }

  function firstUnplaced() {
    return state.boards[HUMAN].ships.findIndex((s) => !s);
  }

  // Rutene skipet som er valgt, vil dekke hvis det legges der markøren eller musa står.
  function preview() {
    const anchor = el.grid.classList.contains("keys") ? cursor : hover;
    const board = state.boards[HUMAN];
    if (selected < 0 || anchor === null || B.shipAt(board, anchor) >= 0) return null;
    const len = FLEET[selected];
    const list = B.shipCells(B.fitStart(anchor, len, horizontal), len, horizontal);
    return { cells: new Set(list), ok: B.canPlace(board.ships, list, selected) };
  }

  function drawPlacing() {
    const board = state.boards[HUMAN];
    const pre = preview();
    cells.forEach((b, i) => {
      const ship = B.shipAt(board, i) >= 0;
      let cls = "cell";
      if (ship) cls += " ship";
      if (pre && pre.cells.has(i)) cls += " pre" + (pre.ok ? "" : " bad");
      if (i === cursor) cls += " sel";
      b.className = cls;
      b.disabled = false;
      b.setAttribute("aria-label", where(i) + (ship ? "skip, trykk for å flytte" : "åpent hav"));
    });
    shipButtons.forEach((b, k) => {
      b.classList.toggle("placed", Boolean(board.ships[k]));
      b.setAttribute("aria-pressed", String(k === selected));
      b.setAttribute("aria-label", "Skip på " + FLEET[k] + " ruter" + (board.ships[k] ? ", plassert" : ""));
    });
    el.rotate.textContent = horizontal ? "Roter ↔" : "Roter ↕";
    el.rotate.setAttribute("aria-label", "Roter. Skipet legges nå " + (horizontal ? "vannrett" : "loddrett"));
    el.start.disabled = !B.ready(state);
    el.caption.textContent = "Din flåte – legg ut skipene";
    el.grid.classList.add("live");
  }

  function drawBattle() {
    const last = state.last;
    const mine = humanTurn();
    const lost = state.phase === "over" && state.winner === CPU;

    const enemy = state.boards[CPU];
    const ev = B.view(enemy);
    cells.forEach((b, i) => {
      const v = ev.cells[i];
      let cls = "cell";
      if (v) cls += " " + v;
      else if (lost && B.shipAt(enemy, i) >= 0) cls += " reveal";
      if (last && last.player === HUMAN && last.i === i) cls += " last shot";
      if (i === cursor) cls += " sel";
      b.className = cls;
      b.disabled = !mine || v !== null;
      b.setAttribute("aria-label", where(i) + { null: "ikke skutt på", miss: "bom", hit: "treff", sunk: "senket skip" }[v]);
    });

    const own = state.boards[HUMAN];
    const ov = B.view(own);
    miniCells.forEach((d, i) => {
      let cls = "cell";
      if (ov.cells[i]) cls += " " + ov.cells[i];
      else if (B.shipAt(own, i) >= 0) cls += " ship";
      if (last && last.player === CPU && last.i === i) cls += " last shot";
      d.className = cls;
    });

    el.caption.textContent = "Datamaskinens farvann – skyt her";
    el.grid.classList.toggle("live", mine);
  }

  function draw() {
    const placing = state.phase === "placing";
    el.board.classList.toggle("placing", placing);
    el.board.classList.toggle("battle", !placing);
    if (placing) drawPlacing();
    else drawBattle();
    drawStats();
  }

  function drawStats() {
    const playing = state.phase === "playing";
    el.counts[HUMAN].textContent = state.phase === "placing" ? FLEET.length : B.shipsLeft(state.boards[HUMAN]);
    el.counts[CPU].textContent = state.phase === "placing" ? FLEET.length : B.shipsLeft(state.boards[CPU]);
    el.sides.forEach((s, p) => s.classList.toggle("turn", playing && state.current === p));
    el.streak.textContent = streaks[level];
    el.best.textContent = Common.getBest(bestKey()) || 0;
    el.levels.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Plassering ----------

  function sayPlacing() {
    if (B.ready(state)) say("Flåten er klar. Trykk «Start kampen», eller trykk på et skip for å flytte det.");
    else say("Legg ut skipet på " + FLEET[selected] + " ruter. Nivå: " + LEVEL_NAMES[level] + ".");
  }

  function startGame(newLevel) {
    // Å forlate en kamp etter første skudd teller som tap for seiersrekken.
    if (state.phase === "playing" && state.shots[HUMAN] + state.shots[CPU] > 0) {
      streaks[level] = B.nextStreak(streaks[level], "abandon");
    }
    if (newLevel) level = newLevel;
    Common.hideOverlay(el.board);
    token++;
    state = B.create();
    if (lastFleet) {
      lastFleet.forEach((s, k) => (state = B.placeShip(state, k, s.cells[0], s.horizontal)));
    }
    selected = firstUnplaced();
    horizontal = true;
    cursor = CENTER;
    hover = null;
    sayPlacing();
    draw();
  }

  // Løfter opp et skip som ligger på brettet, og gjør det klart til å legges på nytt.
  function pickUp(k) {
    horizontal = state.boards[HUMAN].ships[k].horizontal;
    state = B.removeShip(state, k);
    selected = k;
  }

  function chooseShip(k) {
    if (state.phase !== "placing" || Common.isOverlayOpen(el.board)) return;
    if (state.boards[HUMAN].ships[k]) pickUp(k);
    selected = k;
    sayPlacing();
    draw();
  }

  function placeAt(i) {
    if (state.phase !== "placing" || Common.isOverlayOpen(el.board)) return;
    cursor = i;
    const on = B.shipAt(state.boards[HUMAN], i);
    if (on >= 0) {
      pickUp(on);
      say("Skipet er løftet opp. Trykk der det skal ligge.");
    } else if (selected < 0) {
      say("Alle skipene ligger på brettet. Trykk på et skip for å flytte det.");
    } else {
      const len = FLEET[selected];
      const next = B.placeShip(state, selected, B.fitStart(i, len, horizontal), horizontal);
      if (next === state) {
        say("Der er det ikke plass. Skip kan ikke ligge oppå hverandre.", "bad");
      } else {
        state = next;
        selected = firstUnplaced();
        sayPlacing();
      }
    }
    draw();
  }

  function rotate() {
    if (state.phase !== "placing" || Common.isOverlayOpen(el.board)) return;
    horizontal = !horizontal;
    draw();
  }

  function startBattle() {
    if (!B.ready(state)) return;
    lastFleet = state.boards[HUMAN].ships;
    state = B.start(state, Math.random);
    cursor = CENTER;
    say("Du skyter først. Trykk på en rute i datamaskinens farvann.");
    draw();
  }

  // ---------- Kamp ----------

  function later(fn, ms) {
    const t = token;
    setTimeout(() => t === token && fn(), ms);
  }

  function humanShoot(i) {
    if (!humanTurn()) return;
    cursor = i;
    const next = B.shoot(state, i);
    if (next === state) {
      say("Der har du allerede skutt.");
      draw();
      return;
    }
    state = next;
    afterShot();
  }

  function cpuShoot() {
    state = B.shoot(state, B.chooseMove(B.view(state.boards[HUMAN]), level, Math.random));
    afterShot();
  }

  // Etter et skudd: er spillet slutt, skyter samme spiller igjen, eller går turen videre?
  function afterShot() {
    if (state.phase === "over") return finish();
    const { player, result, len } = state.last;
    if (player === HUMAN) {
      if (result === "miss") say("Bom. Datamaskinen skyter …");
      else if (result === "hit") say("Treff! Skyt igjen.", "good");
      else say("Senket! Skipet på " + len + " ruter er borte. Skyt igjen.", "good");
    } else {
      if (result === "miss") say("Datamaskinen bommet. Din tur.");
      else if (result === "hit") say("Datamaskinen traff et av skipene dine og skyter igjen …", "bad");
      else say("Datamaskinen senket skipet ditt på " + len + " ruter og skyter igjen …", "bad");
    }
    draw();
    if (state.current === CPU) later(cpuShoot, CPU_DELAY);
  }

  function finish() {
    const result = state.winner === HUMAN ? "win" : "loss";
    streaks[level] = B.nextStreak(streaks[level], result);
    const record = result === "win" && Common.saveBest(bestKey(), streaks[level]);
    const best = Common.getBest(bestKey()) || 0;

    const title = result === "win" ? "Du vant!" : "Datamaskinen vant";
    const text = result === "win"
      ? "Du senket hele flåten på " + state.shots[HUMAN] + " skudd. Seiersrekke på " + LEVEL_NAMES[level] + ": " +
        streaks[level] + "." + (record ? " Ny rekord!" : " Rekord: " + best + ".")
      : "Hele flåten din er senket. Skipene du ikke fant, vises på brettet. Rekken din på " +
        LEVEL_NAMES[level] + " er nullstilt. Rekord: " + best + ".";

    say(result === "win" ? "Du vant! Hele flåten er senket." : "Datamaskinen senket hele flåten din.", result === "win" ? "good" : "bad");
    draw();
    later(() => {
      Common.showOverlay(el.board, {
        title,
        text,
        buttons: [
          { label: "Nytt spill", primary: true, onClick: () => startGame() },
          { label: "Se brettet" },
        ],
      });
    }, END_DELAY);
  }

  // ---------- Input ----------

  function act(i) {
    if (state.phase === "placing") placeAt(i);
    else humanShoot(i);
  }

  const cellIndex = (target) => {
    const b = target.closest && target.closest(".cell");
    return b ? Number(b.dataset.i) : null;
  };

  function setHover(i) {
    if (i === hover) return;
    hover = i;
    if (state.phase === "placing") drawPlacing();
  }

  el.grid.addEventListener("click", (e) => {
    const i = cellIndex(e.target);
    if (i !== null) act(i);
  });
  el.grid.addEventListener("pointerdown", () => el.grid.classList.remove("keys"));
  el.grid.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    el.grid.classList.remove("keys");
    setHover(cellIndex(e.target));
  });
  el.grid.addEventListener("pointerleave", () => setHover(null));

  el.rotate.addEventListener("click", rotate);
  el.random.addEventListener("click", () => {
    if (state.phase !== "placing") return;
    state = B.placeRandom(state, Math.random);
    selected = -1;
    sayPlacing();
    draw();
  });
  el.start.addEventListener("click", startBattle);
  el.newGame.addEventListener("click", () => startGame());
  el.levels.forEach((b) =>
    b.addEventListener("click", () => {
      if (state.phase === "playing") {
        if (b.dataset.level !== level) startGame(b.dataset.level);
      } else if (state.phase === "over") {
        startGame(b.dataset.level);
      } else {
        level = b.dataset.level;
        sayPlacing();
        drawStats();
      }
    })
  );

  const MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || state.phase === "over") return;
    const move = MOVES[e.key];
    const onButton = e.target.closest && e.target.closest(".levels, .controls, .dock");
    if (onButton && !move) return; // la knapper få Enter og mellomrom
    if (move) {
      e.preventDefault();
      const c = Math.min(SIZE - 1, Math.max(0, (cursor % SIZE) + move[0]));
      const r = Math.min(SIZE - 1, Math.max(0, Math.floor(cursor / SIZE) + move[1]));
      // Markøren styrer nå; slipp fokus på knapper og ruter, så Enter treffer ruten under markøren.
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      cursor = r * SIZE + c;
      el.grid.classList.add("keys");
      draw();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      el.grid.classList.add("keys");
      act(cursor);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      rotate();
    }
  });

  // ---------- Start ----------

  draw();
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Legg ut de fire skipene dine, og senk datamaskinens flåte før den senker din. Treff gir nytt skudd. Velg nivå:",
    howto: [
      { keys: ["Trykk"], text: "Legg et skip, eller skyt" },
      { keys: ["R"], text: "Roter skipet" },
      { keys: ["Piler", "Enter"], text: "Flytt markøren og velg" },
    ],
    buttons: [
      { label: "Lett", onClick: () => startGame("lett") },
      { label: "Middels", primary: true, onClick: () => startGame("middels") },
      { label: "Vanskelig", onClick: () => startGame("vanskelig") },
    ],
  });
})();
