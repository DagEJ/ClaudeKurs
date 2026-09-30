// Tegning, input og turflyt for Othello. Reglene og datamaskinen ligger i logic.js.
(function () {
  const GAME_ID = "othello";
  const HUMAN = 0; // mørk
  const CPU = 1; // lys
  const SIZE = Othello.SIZE;
  const CPU_DELAY = 550;
  const PASS_DELAY = 1800; // la meldingen om å stå over bli lest
  const END_DELAY = 1100; // la sluttstillingen vises litt før sluttkortet
  const LEVEL_NAMES = { lett: "lett", middels: "middels", vanskelig: "vanskelig" };
  const COLOR_NAMES = ["mørk", "lys"];

  const el = {
    board: document.getElementById("board"),
    grid: document.getElementById("grid"),
    streak: document.getElementById("streak"),
    best: document.getElementById("best"),
    sides: [document.getElementById("side0"), document.getElementById("side1")],
    counts: [document.getElementById("count0"), document.getElementById("count1")],
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
    levels: [...document.querySelectorAll(".level")],
  };

  let state = null;
  let level = "middels";
  const START_CURSOR = 1 * SIZE + 2; // et lovlig åpningstrekk
  let cursor = START_CURSOR; // valgt rute for tastaturet
  let token = 0; // økes ved nytt parti, så gamle timere ignoreres
  const streaks = { lett: 0, middels: 0, vanskelig: 0 };
  const bestKey = () => GAME_ID + ":" + level;

  // ---------- Brett ----------

  const cells = [];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const b = document.createElement("button");
    b.className = "cell";
    b.dataset.i = i;
    b.addEventListener("click", () => humanPlay(i));
    b.addEventListener("focus", () => { cursor = i; drawCursor(); });
    el.grid.appendChild(b);
    cells.push(b);
  }

  function humanTurn() {
    return state && state.status === "playing" && state.current === HUMAN && !Common.isOverlayOpen(el.board);
  }

  function draw() {
    const mine = humanTurn();
    const legal = new Set(mine ? Othello.legalMoves(state) : []);
    const last = state.last;
    const flipped = new Set(last ? last.flipped : []);
    state.cells.forEach((v, i) => {
      const b = cells[i];
      let cls = "cell";
      if (v !== null) cls += " p" + v;
      if (legal.has(i)) cls += " hint";
      if (last && last.i === i) cls += " last placed";
      if (flipped.has(i)) cls += " flipped";
      if (i === cursor) cls += " sel";
      b.className = cls;
      b.disabled = !legal.has(i);
      const where = "Rad " + (Math.floor(i / SIZE) + 1) + ", kolonne " + ((i % SIZE) + 1) + ": ";
      b.setAttribute("aria-label", where + (v === null ? (legal.has(i) ? "lovlig trekk" : "tom") : COLOR_NAMES[v]));
    });
    const playing = state.status === "playing";
    el.grid.classList.toggle("thinking", playing && state.current === CPU);
    el.sides.forEach((s, p) => s.classList.toggle("turn", playing && state.current === p));
    drawStats();
  }

  function drawCursor() {
    cells.forEach((b, i) => b.classList.toggle("sel", i === cursor));
  }

  function drawStats() {
    const count = Othello.count(state);
    el.counts.forEach((c, p) => (c.textContent = count[p]));
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
      streaks[level] = Othello.nextStreak(streaks[level], "abandon");
    }
    if (newLevel) level = newLevel;
    Common.hideOverlay(el.board);
    token++;
    state = Othello.create();
    cursor = START_CURSOR;
    say("Du er mørk og begynner. Nivå: " + LEVEL_NAMES[level] + ".");
    draw();
  }

  function humanPlay(i) {
    if (!humanTurn()) return;
    if (!Othello.canPlay(state, i)) {
      say("Der kan du ikke legge. Trekket må snu minst én brikke.");
      return;
    }
    cursor = i;
    state = Othello.play(state, i);
    afterMove();
  }

  // Etter et trekk: er partiet slutt, må noen stå over, eller går turen videre?
  function afterMove() {
    if (state.status === "over") return finish();
    if (state.current === CPU) {
      const passed = state.passed === HUMAN;
      if (passed) say("Du har ingen lovlige trekk og må stå over. Datamaskinen trekker igjen.", "pass");
      else say("Datamaskinen tenker …");
      draw();
      later(() => {
        state = Othello.play(state, Othello.chooseMove(state, level, Math.random));
        afterMove();
      }, passed ? PASS_DELAY : CPU_DELAY);
    } else {
      if (state.passed === CPU) say("Datamaskinen har ingen lovlige trekk og må stå over. Din tur igjen.", "pass");
      else say("Din tur.");
      draw();
    }
  }

  function finish() {
    const [you, cpu] = Othello.count(state);
    let result;
    if (state.winner === "draw") result = "draw";
    else result = state.winner === HUMAN ? "win" : "loss";

    streaks[level] = Othello.nextStreak(streaks[level], result);
    const record = result === "win" && Common.saveBest(bestKey(), streaks[level]);
    const best = Common.getBest(bestKey()) || 0;

    const title = { win: "Du vant!", loss: "Datamaskinen vant", draw: "Uavgjort" }[result];
    const score = "Du fikk " + you + " brikker, datamaskinen " + cpu + ". ";
    const text = score + {
      win: "Seiersrekke på " + LEVEL_NAMES[level] + ": " + streaks[level] + "." + (record ? " Ny rekord!" : " Rekord: " + best + "."),
      loss: "Rekken din på " + LEVEL_NAMES[level] + " er nullstilt. Rekord: " + best + ".",
      draw: "Rekken står på " + streaks[level] + ".",
    }[result];

    say(title + " " + you + "–" + cpu + ".", result === "win" ? "good" : result === "loss" ? "bad" : "");
    draw();
    later(() => {
      Common.showOverlay(el.board, {
        title,
        text,
        buttons: [
          { label: "Nytt parti", primary: true, onClick: () => startGame() },
          { label: "Se brettet" },
        ],
      });
    }, END_DELAY);
  }

  // ---------- Input ----------

  el.newGame.addEventListener("click", () => startGame());
  el.levels.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.level !== level || !state || state.status === "over") startGame(b.dataset.level);
    })
  );
  el.grid.addEventListener("pointerdown", () => el.grid.classList.remove("keys"));

  const MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || !state) return;
    const move = MOVES[e.key];
    const onButton = e.target.closest && e.target.closest(".levels, .controls");
    if (onButton && !move) return; // la knapper få Enter og mellomrom
    if (move) {
      e.preventDefault();
      const c = Math.min(SIZE - 1, Math.max(0, (cursor % SIZE) + move[0]));
      const r = Math.min(SIZE - 1, Math.max(0, Math.floor(cursor / SIZE) + move[1]));
      // Markøren styrer nå; slipp fokus på knapper og ruter, så Enter treffer ruten under markøren.
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      cursor = r * SIZE + c;
      el.grid.classList.add("keys");
      drawCursor();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (e.repeat) return;
      el.grid.classList.add("keys");
      humanPlay(cursor);
    }
  });

  // ---------- Start ----------

  state = Othello.create();
  draw();
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Fang datamaskinens brikker mellom dine egne, så snus de. Flest brikker vinner. Du er mørk. Velg nivå:",
    howto: [
      { keys: ["Trykk"], text: "På en rute med prikk" },
      { keys: ["Piler", "Enter"], text: "Flytt markøren og legg" },
    ],
    buttons: [
      { label: "Lett", onClick: () => startGame("lett") },
      { label: "Middels", primary: true, onClick: () => startGame("middels") },
      { label: "Vanskelig", onClick: () => startGame("vanskelig") },
    ],
  });
  draw();
})();
