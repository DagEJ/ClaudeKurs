// Tegning og input for Yatzy. Reglene ligger i logic.js.
(function () {
  const GAME_ID = "yatzy";
  const ROLL_MS = 250; // terningene rister litt
  const END_DELAY = 700; // la skjemaet vises litt før sluttkortet
  const ROUNDS = Yatzy.CATEGORIES.length;
  // Hvilke av de ni prikkplassene (3 × 3) som er på for hver verdi.
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  const el = {
    board: document.getElementById("board"),
    dice: document.getElementById("dice"),
    roll: document.getElementById("roll"),
    upper: document.getElementById("upper"),
    lower: document.getElementById("lower"),
    round: document.getElementById("round"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    newGame: document.getElementById("new"),
  };

  let state = null;
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres
  const dice = []; // terningknappene
  const rows = {}; // feltknappene, per felt-id
  const sums = {}; // sum, bonus og totalt

  // ---------- Bygg siden (én gang) ----------

  function makeRow(tag, cls, name) {
    const r = document.createElement(tag);
    r.className = "row " + cls;
    const n = document.createElement("span");
    n.textContent = name;
    const p = document.createElement("span");
    p.className = "pts";
    r.append(n, p);
    return r;
  }

  function build() {
    for (let i = 0; i < Yatzy.DICE; i++) {
      const b = document.createElement("button");
      b.className = "die";
      b.dataset.i = i;
      for (let k = 0; k < 9; k++) b.appendChild(document.createElement("span"));
      b.addEventListener("click", () => hold(i));
      el.dice.appendChild(b);
      dice.push(b);
    }
    for (const c of Yatzy.CATEGORIES) {
      const b = makeRow("button", "open", c.name);
      b.dataset.id = c.id;
      b.addEventListener("click", () => place(c.id));
      (c.upper ? el.upper : el.lower).appendChild(b);
      rows[c.id] = b;
    }
    sums.upper = makeRow("div", "sum", "Sum");
    sums.bonus = makeRow("div", "sum", "Bonus");
    sums.total = makeRow("div", "sum total", "Totalt");
    el.upper.append(sums.upper, sums.bonus, sums.total);
  }

  // ---------- Tegning ----------

  function draw() {
    const playing = state.status === "playing";
    const canHold = Yatzy.canHold(state);

    dice.forEach((b, i) => {
      const v = state.dice ? state.dice[i] : 0;
      const held = v > 0 && state.held[i] && canHold;
      b.className = "die" + (v ? "" : " blank") + (held ? " held" : "");
      b.disabled = !canHold;
      b.setAttribute("aria-pressed", String(held));
      b.setAttribute("aria-label", "Terning " + (i + 1) + ": " + (v ? v + (held ? ", holdt" : "") : "ikke kastet"));
      const on = PIPS[v] || [];
      [...b.children].forEach((s, k) => s.classList.toggle("on", on.includes(k)));
    });

    const left = state.rollsLeft;
    el.roll.disabled = !Yatzy.canRoll(state);
    el.roll.textContent = !playing
      ? "Ferdig"
      : left === 0
        ? "Velg et felt"
        : state.dice
          ? "Kast igjen (" + left + " igjen)"
          : "Kast terningene";

    const pot = Yatzy.potential(state);
    for (const c of Yatzy.CATEGORIES) {
      const b = rows[c.id];
      const filled = state.scores[c.id] !== null;
      const value = filled ? state.scores[c.id] : c.id in pot ? pot[c.id] : null;
      b.className = "row " + (filled ? "filled" : "open") + (value === 0 ? " zero" : "");
      b.disabled = !Yatzy.canPlace(state, c.id);
      b.lastChild.textContent = value === null ? "" : String(value);
      b.setAttribute(
        "aria-label",
        c.name + ": " + (filled ? value + " poeng" : value === null ? "ledig" : "ledig, gir " + value + " poeng")
      );
    }

    const upper = Yatzy.upperSum(state);
    const bonus = Yatzy.bonus(state);
    sums.upper.lastChild.textContent = upper + "/" + Yatzy.BONUS_LIMIT;
    sums.bonus.lastChild.textContent = String(bonus);
    sums.bonus.classList.toggle("good", bonus > 0);
    sums.total.lastChild.textContent = String(Yatzy.total(state));

    el.round.textContent = state.round + "/" + ROUNDS;
    el.score.textContent = Yatzy.total(state);
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best;
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Spillflyt ----------

  function startGame() {
    Common.hideOverlay(el.board);
    token++;
    state = Yatzy.create();
    say("Kast terningene for å starte.");
    draw();
  }

  function canPlay() {
    return state && state.status === "playing" && !Common.isOverlayOpen(el.board);
  }

  function roll() {
    if (!canPlay() || !Yatzy.canRoll(state)) return;
    const before = state;
    state = Yatzy.roll(state, Math.random);
    draw();
    dice.forEach((b, i) => {
      if (before.dice && before.held[i]) return;
      b.classList.remove("rolling");
      void b.offsetWidth; // start animasjonen på nytt
      b.classList.add("rolling");
    });
    const t = token;
    setTimeout(() => t === token && dice.forEach((b) => b.classList.remove("rolling")), ROLL_MS);
    say(
      state.rollsLeft > 0
        ? "Hold terningene du vil beholde, og kast igjen – eller velg et felt."
        : "Ingen kast igjen. Velg et felt."
    );
  }

  function hold(i) {
    if (!canPlay()) return;
    state = Yatzy.toggleHold(state, i);
    draw();
  }

  function place(id) {
    if (!canPlay() || !Yatzy.canPlace(state, id)) return;
    const name = Yatzy.CATEGORIES.find((c) => c.id === id).name;
    const hadBonus = Yatzy.bonus(state) > 0;
    state = Yatzy.place(state, id);
    const pts = state.scores[id];
    const gotBonus = !hadBonus && Yatzy.bonus(state) > 0;
    draw();
    if (state.status === "over") return finish();
    say(
      name + ": " + pts + " poeng." + (gotBonus ? " Bonus! +50." : "") + " Kast for runde " + state.round + ".",
      gotBonus ? "good" : ""
    );
    el.roll.focus({ preventScroll: true });
  }

  function finish() {
    const total = Yatzy.total(state);
    const previous = Common.getBest(GAME_ID);
    const record = Common.saveBest(GAME_ID, total, true);
    draw();
    say("Ferdig! Du fikk " + total + " poeng.", "good");
    const text =
      "Du fikk " + total + " poeng" + (Yatzy.bonus(state) ? ", med bonus" : "") + ". " +
      (record
        ? previous === null ? "Det er din første rekord!" : "Ny rekord! Den gamle var " + previous + "."
        : "Rekorden er " + previous + ".");
    const t = token;
    setTimeout(() => {
      if (t !== token) return;
      Common.showOverlay(el.board, {
        title: record ? "Ny rekord!" : "Skjemaet er fullt",
        text,
        buttons: [
          { label: "Nytt spill", primary: true, onClick: startGame },
          { label: "Se skjemaet" },
        ],
      });
    }, END_DELAY);
  }

  // ---------- Input ----------

  el.roll.addEventListener("click", roll);
  el.newGame.addEventListener("click", startGame);

  // Piltastene flytter mellom de ledige feltene.
  function moveFocus(step) {
    const free = Yatzy.CATEGORIES.map((c) => rows[c.id]).filter((b) => !b.disabled);
    if (!free.length) return;
    const at = free.indexOf(document.activeElement);
    const next = at < 0 ? (step > 0 ? 0 : free.length - 1) : (at + step + free.length) % free.length;
    free[next].focus({ preventScroll: true });
  }

  const inBoard = (e) => e.target.closest && e.target.closest("#board button");

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || !state) return;
    if (e.target.closest && e.target.closest(".controls")) return; // la «Nytt spill» få tastene sine
    if (e.key === " " || e.key === "k" || e.key === "K") {
      e.preventDefault(); // mellomrom kaster alltid, også når en terning eller et felt har fokus
      if (!e.repeat) roll();
    } else if (e.key === "Enter") {
      if (inBoard(e)) return; // knappen med fokus trykkes
      e.preventDefault();
      if (!e.repeat) roll();
    } else if (e.key >= "1" && e.key <= "5") {
      e.preventDefault();
      if (!e.repeat) hold(Number(e.key) - 1);
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(-1);
    }
  });
  // Mellomrom skal ikke også «klikke» på knappen som har fokus.
  document.addEventListener("keyup", (e) => {
    if (e.key === " " && inBoard(e) && !Common.isOverlayOpen(el.board)) e.preventDefault();
  });

  // ---------- Start ----------

  build();
  startGame();
  say("");
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Kast inntil tre ganger per runde, hold terningene du vil beholde, og skriv resultatet i et ledig felt. 15 runder – få flest mulig poeng.",
    howto: [
      { keys: ["Kast", "Mellomrom"], text: "Kast terningene" },
      { keys: ["Trykk", "1–5"], text: "Hold en terning" },
      { keys: ["Trykk", "Piler", "Enter"], text: "Velg felt" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: () => say("Kast terningene for å starte.") }],
  });
})();
