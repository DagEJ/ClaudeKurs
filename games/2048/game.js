// Tegning, input og klokke for 2048. Reglene ligger i logic.js.
(function () {
  const GAME_ID = "2048";
  const TICK_MS = 100;

  const el = {
    board: document.getElementById("board"),
    tiles: document.getElementById("tiles"),
    cells: document.querySelector(".cells"),
    mode: document.getElementById("mode"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    clock: document.getElementById("clock"),
    fill: document.getElementById("clock-fill"),
    time: document.getElementById("time"),
    message: document.getElementById("message"),
    undo: document.getElementById("undo"),
    undos: document.getElementById("undos"),
    newGame: document.getElementById("new"),
  };
  for (let i = 0; i < 16; i++) el.cells.appendChild(document.createElement("div"));

  let state = null;
  const nodes = new Map(); // brikke-id -> DOM-element

  // ---------- Tegning ----------

  function place(node, r, c) {
    node.style.setProperty("--r", r);
    node.style.setProperty("--c", c);
  }

  function drawTiles(fresh) {
    if (fresh) {
      el.tiles.innerHTML = "";
      nodes.clear();
    }
    const last = state.last || {};

    // Brikker som ble slått sammen glir inn i målet og forsvinner.
    for (const x of last.removed || []) {
      const node = nodes.get(x.id);
      if (!node) continue;
      nodes.delete(x.id);
      node.style.zIndex = 0;
      place(node, x.r, x.c);
      setTimeout(() => node.remove(), 120);
    }

    const alive = new Set();
    for (const t of state.tiles) {
      alive.add(t.id);
      let node = nodes.get(t.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "tile" + (fresh ? "" : " new");
        node.appendChild(document.createElement("span"));
        nodes.set(t.id, node);
        el.tiles.appendChild(node);
      } else {
        node.classList.remove("new", "merged");
      }
      place(node, t.r, t.c);
      node.style.zIndex = 1;
      const level = Math.log2(t.v);
      node.dataset.l = level;
      node.classList.toggle("big", level >= 11);
      node.firstChild.textContent = t.v;
      if ((last.merged || []).includes(t.id)) {
        void node.offsetWidth; // start animasjonen på nytt
        node.classList.add("merged");
      }
    }
    // Rydd bort brikker som ikke finnes lenger (f.eks. etter angre).
    for (const [id, node] of nodes) {
      if (!alive.has(id)) {
        node.remove();
        nodes.delete(id);
      }
    }
  }

  function drawStatus() {
    el.score.textContent = state.score;
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best;

    const timed = state.mode === "timed";
    el.mode.textContent = timed ? "Tidsangrep · 2 minutter" : "Fritt spill · uten tid";
    const secs = Math.ceil(state.timeLeft / 1000);
    el.time.textContent = timed ? Common.formatTime(secs) : "∞";
    el.fill.style.transform = "scaleX(" + (timed ? state.timeLeft / Game2048.TIME_MS : 1) + ")";
    el.clock.classList.toggle("warn", timed && state.started && secs <= 15);
    el.clock.classList.toggle("free", !timed);

    el.undos.textContent = state.undosLeft;
    el.undo.disabled = !Game2048.canUndo(state) || Common.isOverlayOpen(el.board);
  }

  function render(fresh) {
    drawTiles(fresh);
    drawStatus();
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Spillflyt ----------

  function newGame() {
    Common.hideOverlay(el.board);
    state = Game2048.newGame(Math.random);
    say("Klokka starter ved første trekk.");
    render(true);
  }

  function move(dir) {
    if (!state || Common.isOverlayOpen(el.board)) return;
    const next = Game2048.step(state, dir, Math.random);
    if (next === state) return;
    state = next;
    render(false);

    if (state.last.goal) say("Du nådde 2048! Fortsett for å nå enda høyere.", "good");
    else if (state.score > 0 && el.message.textContent.startsWith("Klokka")) say("");
    if (state.status === "over") onNoMoves();
  }

  function undo() {
    if (!state || !Game2048.canUndo(state)) return;
    Common.hideOverlay(el.board);
    state = Game2048.undo(state);
    say("Angret ett trekk. " + state.undosLeft + " igjen.");
    render(true);
  }

  function onTimeUp() {
    say("");
    const record = Common.saveBest(GAME_ID, state.timedScore);
    drawStatus();
    Common.showOverlay(el.board, {
      title: "Tiden er ute!",
      text: state.timedScore + " poeng på to minutter." + (record ? " Ny rekord!" : "") +
        " Vil du spille videre på samme brett uten tid?",
      buttons: [
        { label: "Fortsett uten tid", primary: true, onClick: continueFree },
        { label: "Nytt spill", onClick: newGame },
      ],
    });
    drawStatus();
  }

  function continueFree() {
    state = Game2048.continueFree(state);
    say("Fritt spill: ingen klokke. Rekorden gjelder fortsatt poengene etter to minutter.");
    render(false);
  }

  function onNoMoves() {
    say("");
    let text;
    if (state.mode === "timed") {
      const record = Common.saveBest(GAME_ID, state.timedScore);
      text = "Brettet ble fullt før tiden var ute. " + state.score + " poeng." + (record ? " Ny rekord!" : "");
    } else {
      text = "Du endte på " + state.score + " poeng (" + state.timedScore + " etter to minutter).";
    }
    const buttons = [{ label: "Nytt spill", primary: true, onClick: newGame }];
    if (Game2048.canUndo(state)) {
      buttons.push({ label: "Angre siste trekk (" + state.undosLeft + ")", onClick: undo });
    }
    Common.showOverlay(el.board, { title: "Ingen flere trekk", text, buttons });
    drawStatus();
  }

  // Klokka: går bare når siden er synlig og ingen kort er oppe.
  let lastTick = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    if (!state || document.hidden || Common.isOverlayOpen(el.board)) return;
    const before = state.status;
    state = Game2048.tick(state, dt);
    if (before === "playing" && state.status === "timeup") onTimeUp();
    else drawStatus();
  }, TICK_MS);

  // ---------- Input ----------

  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down",
  };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "u") return undo();
    const dir = KEYS[key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  let swipe = null;
  const grid = document.getElementById("grid");
  grid.addEventListener("pointerdown", (e) => {
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  grid.addEventListener("pointerup", (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  });
  grid.addEventListener("pointercancel", () => (swipe = null));

  el.undo.addEventListener("click", undo);
  el.newGame.addEventListener("click", newGame);

  // ---------- Start ----------

  newGame();
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Slå sammen like tall. Du har to minutter fra første trekk, og kan spille videre uten tid etterpå.",
    howto: [
      { keys: ["←", "↑", "→", "↓"], text: "Flytt (eller WASD)" },
      { keys: ["Sveip"], text: "Flytt på touch" },
      { keys: ["U"], text: "Angre (3 per spill)" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: () => drawStatus() }],
  });
  drawStatus();
})();
