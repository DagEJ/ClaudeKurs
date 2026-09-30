// Tegning, input og turflyt for ludo. Reglene ligger i logic.js.
(function () {
  const GAME_ID = "ludo";
  const HUMAN = 0;
  const CPU = 1;
  const PLAYER_COLORS = ["red", "yellow"]; // spiller 0 og 1
  const NAMES = ["Du", "Datamaskinen"];
  const CPU_DELAY = 750;
  const AUTO_DELAY = 400;

  // Fellesbanen: 52 felt med [rad, kolonne] i et 15x15-rutenett, med klokken fra røds start.
  const TRACK = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0], [6, 0],
  ];

  const COLORS = {
    red: {
      start: 0, yard: [0, 0], goal: [7, 6],
      home: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
      slots: [[1, 1], [1, 4], [4, 1], [4, 4]],
    },
    green: {
      start: 13, yard: [0, 9], goal: [6, 7],
      home: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
      slots: [[1, 10], [1, 13], [4, 10], [4, 13]],
    },
    yellow: {
      start: 26, yard: [9, 9], goal: [7, 8],
      home: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
      slots: [[10, 10], [10, 13], [13, 10], [13, 13]],
    },
    blue: {
      start: 39, yard: [9, 0], goal: [8, 7],
      home: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
      slots: [[10, 1], [10, 4], [13, 1], [13, 4]],
    },
  };

  const PIPS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
  };

  const el = {
    board: document.getElementById("ludo"),
    turn: document.getElementById("turn"),
    throws: document.getElementById("throws"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    dice: document.getElementById("dice"),
    roll: document.getElementById("roll"),
    newGame: document.getElementById("new"),
  };

  let state = null;
  let waiting = false; // true mens en forsinket handling venter
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres

  // ---------- Brett ----------

  function place(node, r, c, rows = 1, cols = 1) {
    node.style.gridRow = r + 1 + " / span " + rows;
    node.style.gridColumn = c + 1 + " / span " + cols;
  }

  function div(className, r, c, rows, cols) {
    const d = document.createElement("div");
    d.className = className;
    place(d, r, c, rows, cols);
    el.board.appendChild(d);
    return d;
  }

  function buildBoard() {
    const active = new Set(PLAYER_COLORS);
    const startColor = {};
    for (const [name, info] of Object.entries(COLORS)) {
      const off = active.has(name) ? "" : " inactive";
      div("yard " + name + off, info.yard[0], info.yard[1], 6, 6);
      info.slots.forEach(([r, c]) => div("slot " + name + off, r, c));
      info.home.forEach(([r, c]) => div("cell home " + name + off, r, c));
      startColor[info.start] = name;
    }
    TRACK.forEach(([r, c], i) => {
      const name = startColor[i];
      const off = name && !active.has(name) ? " inactive" : "";
      div(name ? "cell start " + name + off : "cell", r, c);
    });
    div("center", 6, 6, 3, 3);
  }

  function cellFor(colorName, pos, pieceIndex) {
    const info = COLORS[colorName];
    if (pos === Ludo.YARD) return info.slots[pieceIndex];
    if (pos <= Ludo.LAST_TRACK) return TRACK[(info.start + pos) % Ludo.TRACK_LENGTH];
    if (pos < Ludo.GOAL) return info.home[pos - Ludo.LAST_TRACK - 1];
    return info.goal;
  }

  // ---------- Tegning ----------

  function humanCanMove() {
    return !waiting && state.current === HUMAN && state.phase === "move";
  }

  function render() {
    el.board.querySelectorAll(".stack").forEach((n) => n.remove());

    const stacks = new Map();
    state.players.forEach((player, pi) => {
      const color = PLAYER_COLORS[pi];
      player.pieces.forEach((pos, k) => {
        const [r, c] = cellFor(color, pos, k);
        const key = r + "," + c;
        if (!stacks.has(key)) stacks.set(key, { r, c, pieces: [] });
        stacks.get(key).pieces.push({ pi, k, color, done: pos === Ludo.GOAL });
      });
    });

    for (const { r, c, pieces } of stacks.values()) {
      const stack = div("stack" + (pieces.length > 1 ? " multi" : ""), r, c);
      for (const { pi, k, color, done } of pieces) {
        const b = document.createElement("button");
        b.className = "piece " + color + (done ? " done" : "");
        const movable = pi === HUMAN && humanCanMove() && state.legal.includes(k);
        if (movable) b.classList.add("movable");
        b.disabled = !movable;
        b.tabIndex = movable ? 0 : -1;
        if (pi === HUMAN) b.textContent = k + 1;
        b.setAttribute("aria-label", (pi === HUMAN ? "Din brikke " : "Datamaskinens brikke ") + (k + 1));
        if (movable) b.addEventListener("click", () => humanMove(k));
        stack.appendChild(b);
      }
    }

    // Terning
    el.dice.className = "dice " + PLAYER_COLORS[state.current];
    el.dice.innerHTML = "";
    const on = state.dice ? PIPS[state.dice] : [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement("span");
      if (on.includes(i)) s.className = "on";
      el.dice.appendChild(s);
    }
    el.dice.setAttribute("aria-label", state.dice ? "Terningen viser " + state.dice : "Ikke kastet");

    // Status
    el.turn.textContent = state.phase === "over" ? "–" : state.current === HUMAN ? "Du" : "Maskin";
    el.throws.textContent = state.players[HUMAN].throws;
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best + " kast";
    el.roll.disabled = waiting || state.current !== HUMAN || state.phase !== "roll";
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Turflyt ----------

  function later(fn, ms) {
    const t = token;
    waiting = true;
    render();
    setTimeout(() => {
      if (t !== token) return;
      waiting = false;
      fn();
    }, ms);
  }

  function doRoll() {
    const who = state.current;
    const before = state;
    const value = Common.randInt(1, 6);
    state = Ludo.roll(state, value);

    el.dice.classList.remove("rolling");
    void el.dice.offsetWidth; // start animasjonen på nytt
    el.dice.classList.add("rolling");

    const name = NAMES[who];
    if (state.phase === "move") {
      say(who === HUMAN ? "Du slo " + value + ". Velg en brikke." : name + " slo " + value + ".");
    } else if (state.current === who) {
      const again = value === 6 ? "Kast igjen." : "Ingen trekk – " + state.rollsLeft + " forsøk igjen.";
      say(name + " slo " + value + ". " + again);
    } else {
      const noOut = !Ludo.hasPiecesOut(before.players[who]);
      say(name + " slo " + value + (noOut ? " – ingen sekser denne gangen." : " – ingen mulige trekk."));
    }
    next();
  }

  function doMove(piece) {
    const who = state.current;
    const dice = state.dice;
    state = Ludo.move(state, piece);

    const captured = state.events.some((e) => e.type === "capture");
    const scored = state.events.some((e) => e.type === "goal");
    const parts = [];
    if (captured) {
      parts.push(who === HUMAN ? "Du slo ut en av datamaskinens brikker!" : "Datamaskinen slo ut brikken din!");
    }
    if (scored) parts.push(who === HUMAN ? "Brikke i mål!" : "Datamaskinen fikk en brikke i mål.");
    if (state.phase === "roll" && state.current === who && dice === 6) {
      parts.push(who === HUMAN ? "Kast igjen." : "Datamaskinen kaster igjen.");
    }
    if (parts.length === 0) {
      parts.push(who === HUMAN ? "Du flyttet " + dice + " felt." : "Datamaskinen flyttet " + dice + " felt.");
    }
    let kind = "";
    if (who === HUMAN && (captured || scored)) kind = "good";
    if (who === CPU && captured) kind = "bad";
    say(parts.join(" "), kind);
    next();
  }

  function humanMove(piece) {
    if (!humanCanMove() || !state.legal.includes(piece)) return;
    doMove(piece);
  }

  // Bestem hva som skjer etter hver handling.
  function next() {
    render();
    if (state.phase === "over") return finish();

    if (state.current === CPU) {
      later(() => (state.phase === "roll" ? doRoll() : doMove(Ludo.chooseMove(state))), CPU_DELAY);
      return;
    }
    if (state.phase === "move") {
      // Bare ett reelt valg (f.eks. én brikke, eller flere like brikker hjemme): flytt automatisk.
      const choices = new Set(state.legal.map((k) => state.players[HUMAN].pieces[k]));
      if (choices.size === 1) later(() => doMove(state.legal[0]), AUTO_DELAY);
    }
  }

  function finish() {
    render();
    if (state.winner === HUMAN) {
      const throws = state.players[HUMAN].throws;
      const record = Common.saveBest(GAME_ID, throws, false);
      say("Du vant på " + throws + " kast!" + (record ? " Ny rekord!" : ""), "good");
    } else {
      say("Datamaskinen vant denne gangen.", "bad");
    }
    render();
  }

  function newGame() {
    token++;
    waiting = false;
    let a, b;
    do {
      a = Common.randInt(1, 6);
      b = Common.randInt(1, 6);
    } while (a === b);
    const first = a > b ? HUMAN : CPU;
    state = Ludo.create(first, PLAYER_COLORS.map((c) => COLORS[c].start));
    say("Du slo " + a + ", datamaskinen slo " + b + ". " + (first === HUMAN ? "Du begynner!" : "Datamaskinen begynner."));
    next();
  }

  // ---------- Input ----------

  el.roll.addEventListener("click", () => {
    if (!waiting && state.current === HUMAN && state.phase === "roll") doRoll();
  });
  el.newGame.addEventListener("click", newGame);

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      if (!el.roll.disabled) doRoll();
    } else if (/^[1-4]$/.test(e.key)) {
      humanMove(Number(e.key) - 1);
    }
  });

  buildBoard();
  newGame();
})();
