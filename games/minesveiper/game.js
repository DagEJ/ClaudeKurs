// Tegning, input og klokke for Minesveiper. Reglene ligger i logic.js.
(function () {
  const GAME_ID = "minesveiper";
  const LONG_PRESS_MS = 400;
  const MOVE_TOLERANCE = 10; // px fingeren kan flytte seg under et langt trykk
  const END_DELAY = 900; // la brettet vises litt før sluttkortet
  const TICK_MS = 200;
  const LEVEL_NAMES = { lett: "lett", middels: "middels", vanskelig: "vanskelig" };

  const el = {
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    mines: document.getElementById("mines"),
    time: document.getElementById("time"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
    levels: [...document.querySelectorAll(".level")],
  };

  let state = null;
  let level = "middels";
  let cells = []; // knappene, i samme rekkefølge som state.cells
  let cursor = 0; // valgt rute for tastaturet
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres
  let lastTick = performance.now();
  const bestKey = () => GAME_ID + ":" + level;
  const live = () => state.status === "ready" || state.status === "playing";

  // ---------- Brett ----------

  function buildGrid() {
    el.grid.textContent = "";
    el.grid.style.setProperty("--cols", state.cols);
    cells = state.cells.map((_, i) => {
      const b = document.createElement("button");
      b.className = "cell covered";
      b.dataset.i = i;
      el.grid.appendChild(b);
      return b;
    });
  }

  function cellLabel(cell, i) {
    const where = "Rad " + (Math.floor(i / state.cols) + 1) + ", kolonne " + ((i % state.cols) + 1) + ": ";
    if (cell.open && cell.mine) return where + "mine";
    if (cell.open) return where + (cell.n === 0 ? "tom" : cell.n + (cell.n === 1 ? " mine" : " miner") + " rundt");
    if (cell.flag) return where + "flagg";
    return where + "dekket";
  }

  function draw() {
    const lost = state.status === "lost";
    state.cells.forEach((cell, i) => {
      const b = cells[i];
      const wasCovered = b.classList.contains("covered");
      let cls = "cell";
      let text = "";
      if (cell.open && cell.mine) {
        cls += " open" + (i === state.exploded ? " exploded" : "");
        text = "💣";
      } else if (cell.open) {
        cls += " open" + (cell.n ? " num n" + cell.n : "");
        text = cell.n ? String(cell.n) : "";
        if (wasCovered) cls += " pop";
      } else if (lost && cell.mine && !cell.flag) {
        cls += " open"; // miner som ikke ble funnet
        text = "💣";
      } else {
        cls += " covered";
        if (cell.flag) {
          text = "🚩";
          if (lost && !cell.mine) cls += " wrong";
        }
      }
      if (i === cursor) cls += " sel";
      b.className = cls;
      b.textContent = text;
      b.tabIndex = i === cursor ? 0 : -1;
      b.disabled = !live();
      b.setAttribute("aria-label", cellLabel(cell, i));
    });
    el.grid.classList.toggle("live", live());
    drawStats();
  }

  function drawStats() {
    el.mines.textContent = Minesweeper.minesLeft(state);
    el.time.textContent = Common.formatTime(Minesweeper.seconds(state));
    const best = Common.getBest(bestKey());
    el.best.textContent = best === null ? "–" : Common.formatTime(best);
    el.levels.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Spillflyt ----------

  function later(fn, ms) {
    const t = token;
    setTimeout(() => t === token && fn(), ms);
  }

  function startGame(newLevel) {
    if (newLevel) level = newLevel;
    Common.hideOverlay(el.board);
    token++;
    state = Minesweeper.create(level);
    cursor = Math.floor(state.rows / 2) * state.cols + Math.floor(state.cols / 2);
    buildGrid();
    say("Åpne en rute for å starte. Den første er alltid trygg.");
    draw();
  }

  function canPlay() {
    return state && live() && !Common.isOverlayOpen(el.board);
  }

  // Trykk på en rute: åpne den, eller åpne naboene hvis den alt er et åpnet tall.
  function press(i) {
    if (!canPlay()) return;
    cursor = i;
    const before = state;
    state = state.cells[i].open ? Minesweeper.chord(state, i) : Minesweeper.open(state, i, Math.random);
    if (before.status === "ready" && state.status !== "ready") say("");
    draw();
    if (!live()) finish();
  }

  function flag(i) {
    if (!canPlay()) return;
    cursor = i;
    state = Minesweeper.toggleFlag(state, i);
    draw();
  }

  function finish() {
    const won = state.status === "won";
    const seconds = Minesweeper.seconds(state);
    const time = Common.formatTime(seconds);
    const record = won && Common.saveBest(bestKey(), seconds, false);
    const best = Common.getBest(bestKey());

    const title = won ? "Du klarte det!" : "Pang!";
    const text = won
      ? "Alle rutene er ryddet på " + time + " (" + LEVEL_NAMES[level] + ")." +
        (record ? " Ny rekord!" : " Rekord: " + Common.formatTime(best) + ".")
      : "Du traff en mine etter " + time + ". Feil flagg er streket over.";

    say(won ? "Du klarte det på " + time + "!" : "Pang! Du traff en mine.", won ? "good" : "bad");
    drawStats();
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

  // Klokka står stille når fanen er skjult eller et kort er oppe.
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(now - lastTick, 1000);
    lastTick = now;
    if (!state || state.status !== "playing" || document.hidden || Common.isOverlayOpen(el.board)) return;
    state = Minesweeper.tick(state, dt);
    el.time.textContent = Common.formatTime(Minesweeper.seconds(state));
  }, TICK_MS);
  document.addEventListener("visibilitychange", () => { lastTick = performance.now(); });

  // ---------- Input ----------

  const cellIndex = (target) => {
    const b = target.closest && target.closest(".cell");
    return b ? Number(b.dataset.i) : null;
  };

  // Langt trykk setter flagg. Klikket som følger når fingeren slippes, skal ikke åpne ruten.
  let pressTimer = null;
  let pressStart = null;
  let skipClick = false;
  let lastPointer = "mouse";

  function cancelPress() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  el.grid.addEventListener("pointerdown", (e) => {
    el.grid.classList.remove("keys");
    lastPointer = e.pointerType;
    skipClick = false;
    cancelPress();
    const i = cellIndex(e.target);
    if (i === null || e.button !== 0) return;
    pressStart = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      pressTimer = null;
      skipClick = true;
      flag(i);
    }, LONG_PRESS_MS);
  });
  el.grid.addEventListener("pointermove", (e) => {
    if (pressTimer === null) return;
    if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > MOVE_TOLERANCE) cancelPress();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => el.grid.addEventListener(type, cancelPress));

  el.grid.addEventListener("click", (e) => {
    const i = cellIndex(e.target);
    if (i === null) return;
    if (skipClick) {
      skipClick = false;
      return;
    }
    press(i);
  });

  // Høyreklikk setter flagg. På touch kommer contextmenu av et langt trykk, som alt er håndtert.
  el.grid.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const i = cellIndex(e.target);
    if (i !== null && lastPointer === "mouse") flag(i);
  });

  el.newGame.addEventListener("click", () => startGame());
  el.levels.forEach((b) => b.addEventListener("click", () => startGame(b.dataset.level)));

  const MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || !state) return;
    if (e.target.closest && e.target.closest(".levels, .controls")) return; // la knapper få tastene sine
    const move = MOVES[e.key];
    if (move) {
      e.preventDefault();
      const c = Math.min(state.cols - 1, Math.max(0, (cursor % state.cols) + move[0]));
      const r = Math.min(state.rows - 1, Math.max(0, Math.floor(cursor / state.cols) + move[1]));
      cursor = r * state.cols + c;
      el.grid.classList.add("keys");
      draw();
      if (!cells[cursor].disabled) cells[cursor].focus({ preventScroll: true });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      el.grid.classList.add("keys");
      press(cursor);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      if (e.repeat) return;
      el.grid.classList.add("keys");
      flag(cursor);
    }
  });

  // ---------- Start ----------

  startGame("middels");
  say("");
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Åpne alle ruter uten mine. Tallet viser hvor mange miner som ligger rundt. Velg nivå:",
    howto: [
      { keys: ["Trykk"], text: "Åpne en rute" },
      { keys: ["Hold", "F"], text: "Sett flagg (eller høyreklikk)" },
      { keys: ["Piler", "Enter"], text: "Flytt og åpne" },
    ],
    buttons: [
      { label: "Lett", onClick: () => startGame("lett") },
      { label: "Middels", primary: true, onClick: () => startGame("middels") },
      { label: "Vanskelig", onClick: () => startGame("vanskelig") },
    ],
  });
})();
