// Tegning, input og turflyt for Fire på rad. Reglene og datamaskinen ligger i logic.js.
(function () {
  const GAME_ID = "fire-pa-rad";
  const HUMAN = 0;
  const CPU = 1;
  const CPU_DELAY = 450;
  const END_DELAY = 1100; // la vinnerrekken vises litt før sluttkortet
  const LEVEL_NAMES = { lett: "lett", middels: "middels", vanskelig: "vanskelig" };

  const el = {
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
    levels: [...document.querySelectorAll(".level")],
  };

  let state = null;
  let level = "middels";
  let cursor = 3; // valgt kolonne for tastaturet
  let token = 0; // økes ved nytt parti, så gamle timere ignoreres
  const streaks = { lett: 0, middels: 0, vanskelig: 0 };
  const bestKey = () => GAME_ID + ":" + level;

  // ---------- Brett ----------

  const cols = [];
  for (let c = 0; c < FourInARow.COLS; c++) {
    const b = document.createElement("button");
    b.className = "col";
    b.setAttribute("aria-label", "Kolonne " + (c + 1));
    const preview = document.createElement("div");
    preview.className = "preview";
    const holes = document.createElement("div");
    holes.className = "holes";
    const slots = [];
    for (let r = 0; r < FourInARow.ROWS; r++) {
      const s = document.createElement("span");
      s.className = "slot";
      holes.appendChild(s);
      slots.push(s);
    }
    b.append(preview, holes);
    b.addEventListener("click", () => humanDrop(c));
    b.addEventListener("mouseenter", () => { cursor = c; drawCursor(); });
    el.grid.appendChild(b);
    cols.push({ button: b, slots });
  }

  function humanTurn() {
    return state && state.status === "playing" && state.current === HUMAN && !Common.isOverlayOpen(el.board);
  }

  function draw(animate) {
    const win = new Set((state.line || []).map(([c, r]) => c + "," + r));
    cols.forEach(({ button, slots }, c) => {
      slots.forEach((s, r) => {
        const p = state.cols[c][r];
        s.className = "slot" + (p === undefined ? "" : " p" + p);
        if (state.last && state.last.c === c && state.last.r === r) {
          s.classList.add("last");
          if (animate) {
            s.style.setProperty("--fall", FourInARow.ROWS - r);
            s.classList.add("drop");
          }
        }
        if (win.has(c + "," + r)) s.classList.add("win");
      });
      button.disabled = !humanTurn() || !FourInARow.canDrop(state, c);
      const label = "Kolonne " + (c + 1) + (state.cols[c].length >= FourInARow.ROWS ? ", full" : "");
      button.setAttribute("aria-label", label);
    });
    el.grid.classList.toggle("your-turn", humanTurn());
    el.grid.classList.toggle("thinking", state.status === "playing" && state.current === CPU);
    drawCursor();
    drawStats();
  }

  function drawCursor() {
    cols.forEach(({ button }, c) => button.classList.toggle("sel", c === cursor));
  }

  function drawStats() {
    el.streak.textContent = streaks[level];
    el.best.textContent = Common.getBest(bestKey()) || 0;
    el.levels.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Turflyt ----------

  function later(fn, ms) {
    const t = token;
    setTimeout(() => t === token && fn(), ms);
  }

  function startGame(newLevel) {
    // Å forlate et parti som er i gang, teller som tap for seiersrekken.
    if (state && state.status === "playing" && state.moves > 0) {
      streaks[level] = FourInARow.nextStreak(streaks[level], "abandon");
    }
    if (newLevel) level = newLevel;
    Common.hideOverlay(el.board);
    token++;
    const first = Math.random() < 0.5 ? HUMAN : CPU;
    state = FourInARow.create(first);
    say((first === HUMAN ? "Du begynner." : "Datamaskinen begynner.") + " Nivå: " + LEVEL_NAMES[level] + ".");
    draw(false);
    if (first === CPU) cpuTurn();
  }

  function humanDrop(c) {
    if (!humanTurn() || !FourInARow.canDrop(state, c)) return;
    cursor = c;
    state = FourInARow.drop(state, c);
    draw(true);
    if (state.status === "over") return finish();
    cpuTurn();
  }

  function cpuTurn() {
    say("Datamaskinen tenker …");
    draw(false);
    later(() => {
      const c = FourInARow.chooseMove(state, level, Math.random);
      state = FourInARow.drop(state, c);
      draw(true);
      if (state.status === "over") return finish();
      say("Din tur.");
      draw(false);
    }, CPU_DELAY);
  }

  function finish() {
    let result;
    if (state.winner === "draw") result = "draw";
    else result = state.winner === HUMAN ? "win" : "loss";

    streaks[level] = FourInARow.nextStreak(streaks[level], result);
    const record = result === "win" && Common.saveBest(bestKey(), streaks[level]);
    const best = Common.getBest(bestKey()) || 0;

    const title = { win: "Du vant!", loss: "Datamaskinen vant", draw: "Uavgjort" }[result];
    const text = {
      win: "Seiersrekke på " + LEVEL_NAMES[level] + ": " + streaks[level] + "." + (record ? " Ny rekord!" : " Rekord: " + best + "."),
      loss: "Rekken din på " + LEVEL_NAMES[level] + " er nullstilt. Rekord: " + best + ".",
      draw: "Brettet ble fullt. Rekken står på " + streaks[level] + ".",
    }[result];

    say(title, result === "win" ? "good" : result === "loss" ? "bad" : "");
    draw(false);
    later(() => {
      Common.showOverlay(el.board, {
        title,
        text,
        buttons: [{ label: "Nytt parti", primary: true, onClick: () => startGame() }],
      });
      draw(false);
    }, END_DELAY);
  }

  // ---------- Input ----------

  el.newGame.addEventListener("click", () => startGame());
  el.levels.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.level !== level || !state || state.status === "over") startGame(b.dataset.level);
    })
  );

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || !state) return;
    if (e.target.closest && e.target.closest(".levels, .controls")) return; // la knapper få tastene sine
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      cursor = (cursor + (e.key === "ArrowLeft" ? -1 : 1) + FourInARow.COLS) % FourInARow.COLS;
      drawCursor();
    } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      humanDrop(cursor);
    } else if (/^[1-7]$/.test(e.key)) {
      humanDrop(Number(e.key) - 1);
    }
  });

  // ---------- Start ----------

  state = FourInARow.create(HUMAN);
  draw(false);
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Få fire på rad før datamaskinen. Du er rød. Velg nivå:",
    howto: [
      { keys: ["←", "→", "Enter"], text: "Velg kolonne og slipp" },
      { keys: ["1", "–", "7"], text: "Slipp rett i en kolonne" },
      { keys: ["Trykk"], text: "På en kolonne (touch og mus)" },
    ],
    buttons: [
      { label: "Lett", onClick: () => startGame("lett") },
      { label: "Middels", primary: true, onClick: () => startGame("middels") },
      { label: "Vanskelig", onClick: () => startGame("vanskelig") },
    ],
  });
  draw(false);
})();
