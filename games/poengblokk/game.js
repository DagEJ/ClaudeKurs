// Tegning, input og lagring for Poengblokk. Utregningene ligger i logic.js.
(function () {
  const S = Scorepad;
  const GAME_KEY = "poengblokk:spill";
  const SETUP_KEY = "poengblokk:oppsett";
  const COL_WIDTH = 58; // minste bredde per spiller før tabellen ruller sidelengs
  const MODE_TEXT = { hoyest: "Høyest vinner", lavest: "Lavest vinner", nedtelling: "Nedtelling" };

  const $ = (id) => document.getElementById(id);
  const el = {
    board: $("board"),
    templates: $("templates"),
    modes: [...document.querySelectorAll("#modes .chip")],
    fStart: $("f-start"), fTarget: $("f-target"), fRounds: $("f-rounds"),
    start: $("start"), target: $("target"), rounds: $("rounds"),
    players: $("players"),
    add: $("add"), go: $("go"), back: $("back"),
    summary: $("summary"), table: $("table"),
    next: $("next"), again: $("again"), resume: $("resume"), undo: $("undo"), end: $("end"),
    round: $("round"), message: $("message"), newSetup: $("new"),
  };

  let state = S.restore(Common.load(GAME_KEY)); // spillet som pågår, eller null
  let setup = loadSetup();

  function loadSetup() {
    const saved = Common.load(SETUP_KEY);
    const base = { template: "fritt", mode: "hoyest", start: "501", target: "", maxRounds: "", players: ["", ""] };
    if (!saved || !Array.isArray(saved.players) || !saved.players.length) return base;
    return {
      template: typeof saved.template === "string" ? saved.template : null,
      mode: S.MODES.includes(saved.mode) ? saved.mode : "hoyest",
      start: String(S.posInt(saved.start) || 501),
      target: String(S.posInt(saved.target) || ""),
      maxRounds: String(S.posInt(saved.maxRounds) || ""),
      players: saved.players.slice(0, S.MAX_PLAYERS).map((n) => String(n || "").slice(0, S.MAX_NAME)),
    };
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  function store() {
    Common.save(GAME_KEY, state);
  }

  // ---------- Oppsett ----------

  const templateButtons = S.TEMPLATES.map((t) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = t.name;
    b.addEventListener("click", () => {
      setup.template = t.id;
      setup.mode = t.mode;
      if (t.start) setup.start = String(t.start);
      setup.target = t.target ? String(t.target) : "";
      setup.maxRounds = t.maxRounds ? String(t.maxRounds) : "";
      drawSetup();
    });
    el.templates.appendChild(b);
    return b;
  });

  function drawPlayers() {
    el.players.textContent = "";
    setup.players.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "player";
      const input = document.createElement("input");
      input.className = "box name";
      input.value = name;
      input.maxLength = S.MAX_NAME;
      input.placeholder = "Spiller " + (i + 1);
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Navn på spiller " + (i + 1));
      input.addEventListener("input", () => (setup.players[i] = input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const all = el.players.querySelectorAll(".name");
        if (all[i + 1]) all[i + 1].focus();
        else el.go.focus();
      });
      const remove = document.createElement("button");
      remove.className = "remove";
      remove.textContent = "✕";
      remove.disabled = setup.players.length <= 1;
      remove.setAttribute("aria-label", "Fjern spiller " + (i + 1));
      remove.addEventListener("click", () => {
        setup.players.splice(i, 1);
        drawPlayers();
      });
      row.append(input, remove);
      el.players.appendChild(row);
    });
    el.add.disabled = setup.players.length >= S.MAX_PLAYERS;
  }

  function drawSetup() {
    templateButtons.forEach((b, k) => b.setAttribute("aria-pressed", String(S.TEMPLATES[k].id === setup.template)));
    el.modes.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === setup.mode)));
    const counting = setup.mode === "nedtelling";
    el.fStart.hidden = !counting;
    el.fTarget.hidden = counting;
    el.fRounds.hidden = counting;
    el.start.value = setup.start;
    el.target.value = setup.target;
    el.rounds.value = setup.maxRounds;
    el.back.hidden = !state;
    drawPlayers();
  }

  // Justering etter at en mal er valgt: malen er ikke lenger «ren», så markeringen fjernes.
  function adjusted() {
    setup.template = null;
    templateButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
  }

  el.modes.forEach((b) =>
    b.addEventListener("click", () => {
      if (setup.mode !== b.dataset.mode) adjusted();
      setup.mode = b.dataset.mode;
      drawSetup();
    })
  );
  [["start", "start"], ["target", "target"], ["rounds", "maxRounds"]].forEach(([id, key]) =>
    el[id].addEventListener("input", () => {
      setup[key] = el[id].value;
      adjusted();
    })
  );
  el.add.addEventListener("click", () => {
    if (setup.players.length >= S.MAX_PLAYERS) return;
    setup.players.push("");
    drawPlayers();
    const all = el.players.querySelectorAll(".name");
    all[all.length - 1].focus({ preventScroll: true });
  });

  function showSetup() {
    Common.hideOverlay(el.board);
    el.board.className = "board pboard setup-view";
    el.round.textContent = "–";
    say(state ? "Spillet som pågår, ligger lagret til du trykker Start." : "");
    drawSetup();
  }

  function startGame(config) {
    state = S.create(config);
    store();
    showPad();
    focusDraft(0);
  }

  el.go.addEventListener("click", () => {
    Common.save(SETUP_KEY, setup);
    startGame({ players: setup.players, mode: setup.mode, start: setup.start, target: setup.target, maxRounds: setup.maxRounds });
  });
  el.back.addEventListener("click", () => state && showPad());
  el.newSetup.addEventListener("click", showSetup);

  // ---------- Blokka ----------

  function describe() {
    if (state.mode === "nedtelling") return "Teller ned fra " + state.start + " · først til 0 vinner";
    const parts = [MODE_TEXT[state.mode]];
    if (state.target) parts.push("slutt ved " + state.target + " poeng");
    if (state.maxRounds) parts.push(state.maxRounds + " runder");
    return parts.join(" · ");
  }

  function numInput(round, player, value) {
    const input = document.createElement("input");
    input.className = "num";
    input.type = "number";
    input.inputMode = "numeric";
    input.dataset.r = round;
    input.dataset.p = player;
    input.value = value === null ? "" : value;
    const what = round === "d" ? "denne runden" : "runde " + (Number(round) + 1);
    input.setAttribute("aria-label", state.players[player] + ", " + what);
    return input;
  }

  function row(label, round, values) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "no";
    th.textContent = label;
    tr.appendChild(th);
    values.forEach((v, p) => tr.appendChild(document.createElement("td")).appendChild(numInput(round, p, v)));
    return tr;
  }

  // Bygger hele tabellen. Brukes når antall rader endres; ellers holder det med refresh().
  function buildTable() {
    el.table.textContent = "";
    el.table.style.minWidth = 30 + state.players.length * COL_WIDTH + "px";

    const head = document.createElement("tr");
    head.appendChild(document.createElement("th")).className = "no";
    state.players.forEach((name) => {
      const th = document.createElement("th");
      th.scope = "col";
      const n = document.createElement("span");
      n.className = "pname";
      n.textContent = name;
      const t = document.createElement("strong");
      t.className = "total";
      th.append(n, t);
      head.appendChild(th);
    });
    el.table.createTHead().appendChild(head);

    const body = el.table.createTBody();
    state.rounds.forEach((values, r) => body.appendChild(row(r + 1, r, values)));
    el.table.createTFoot().appendChild(row(state.rounds.length + 1, "d", state.draft));
  }

  function resultText(st) {
    const who = st.winners.map((p) => state.players[p]);
    if (who.length === 1) return who[0] + " vant!";
    return "Delt seier: " + who.slice(0, -1).join(", ") + " og " + who[who.length - 1] + ".";
  }

  // Oppdaterer summer, leder, sprekk, knapper og melding uten å røre feltene det skrives i.
  function refresh() {
    const st = S.status(state);
    const { bust } = S.standing(state);
    const heads = el.table.querySelectorAll("thead th:not(.no)");
    heads.forEach((th, p) => {
      th.classList.toggle("lead", (st.over ? st.winners : st.leaders).includes(p));
      th.querySelector(".total").textContent = st.totals[p];
    });
    el.table.querySelectorAll("tbody .num").forEach((input) => {
      input.classList.toggle("bust", bust[input.dataset.r][input.dataset.p]);
    });

    el.board.classList.toggle("over", st.over);
    el.next.hidden = st.over;
    el.end.hidden = st.over;
    el.again.hidden = !st.over;
    el.resume.hidden = st.reason !== "ended";
    el.undo.disabled = state.rounds.length === 0;
    el.end.disabled = state.rounds.length === 0 && state.draft.every((v) => v === null);
    el.summary.textContent = describe();

    const played = state.rounds.length;
    const current = st.over ? played : played + 1;
    el.round.textContent = state.maxRounds ? current + "/" + state.maxRounds : String(current);

    if (st.over) say(resultText(st), "good");
    else if (state.mode === "nedtelling") say(played ? "Summen viser hvor mye hver har igjen." : "Før det hver spiller fikk i runden. Det trekkes fra " + state.start + ".");
    else say(played ? "" : "Før poengene for første runde, og trykk «Neste runde».");
  }

  function showPad() {
    el.board.className = "board pboard pad-view";
    buildTable();
    refresh();
  }

  function focusDraft(p) {
    const input = el.table.querySelector('tfoot .num[data-p="' + p + '"]');
    if (!input) return;
    input.focus({ preventScroll: true });
    input.scrollIntoView({ block: "nearest" }); // en lang blokk skyver raden som føres, ned på mobil
  }

  function showResult() {
    const st = S.status(state);
    const unit = state.mode === "nedtelling" ? " igjen" : "";
    const list = S.ranking(state).map((r) => r.place + ". " + r.name + " " + r.total + unit).join(" · ");
    Common.showOverlay(el.board, {
      title: st.winners.length === 1 ? state.players[st.winners[0]] + " vant!" : "Delt seier",
      text: list,
      buttons: [
        { label: "Ny omgang", primary: true, onClick: newRound },
        { label: "Se blokka" },
      ],
    });
  }

  function newRound() {
    startGame(S.config(state));
  }

  function commit() {
    const next = S.commitRound(state);
    if (next === state) {
      say("Skriv inn poeng for minst én spiller først.");
      focusDraft(0);
      return;
    }
    const bustNow = S.standing(next).bust[next.rounds.length - 1];
    state = next;
    store();
    buildTable();
    refresh();
    el.table.parentElement.scrollLeft = 0;
    if (S.status(state).over) return showResult();
    const busted = state.players.filter((_, p) => bustNow[p]);
    if (busted.length) say(busted.join(" og ") + " sprakk: mer enn det som var igjen. Runden teller ikke.", "bad");
    focusDraft(0);
  }

  el.table.addEventListener("input", (e) => {
    const input = e.target;
    if (!input.classList || !input.classList.contains("num")) return;
    const p = Number(input.dataset.p);
    state = input.dataset.r === "d" ? S.setDraft(state, p, input.value) : S.setScore(state, Number(input.dataset.r), p, input.value);
    store();
    refresh();
  });

  // Enter: neste spiller i runden som føres, og etter siste spiller føres runden.
  el.table.addEventListener("keydown", (e) => {
    const input = e.target;
    if (e.key !== "Enter" || !input.classList || !input.classList.contains("num")) return;
    e.preventDefault();
    if (input.dataset.r !== "d") return input.blur();
    const p = Number(input.dataset.p);
    if (p + 1 < state.players.length) focusDraft(p + 1);
    else commit();
  });

  // Marker innholdet når et felt velges, så et nytt tall erstatter det gamle.
  el.table.addEventListener("focusin", (e) => {
    if (e.target.classList && e.target.classList.contains("num")) e.target.select();
  });

  el.next.addEventListener("click", commit);
  el.undo.addEventListener("click", () => {
    state = S.removeLastRound(state);
    store();
    buildTable();
    refresh();
  });
  el.end.addEventListener("click", () => {
    state = S.end(S.commitRound(state)); // før med det som alt er skrevet inn
    store();
    buildTable();
    refresh();
    showResult();
  });
  el.resume.addEventListener("click", () => {
    state = S.resume(state);
    store();
    buildTable();
    refresh();
  });
  el.again.addEventListener("click", newRound);

  // ---------- Start ----------

  const HOWTO = [
    { keys: ["Trykk"], text: "Skriv poeng i en rute" },
    { keys: ["Enter"], text: "Neste spiller, og før runden" },
    { keys: ["Trykk"], text: "På et gammelt tall for å rette" },
  ];

  if (state) {
    showPad();
    Common.showOverlay(el.board, {
      title: "Slik bruker du blokka",
      text: "Du har et spill lagret: " + state.players.join(", ") + " – " + state.rounds.length + " runder ført.",
      howto: HOWTO,
      buttons: [
        { label: "Fortsett", primary: true },
        { label: "Nytt oppsett", onClick: showSetup },
      ],
    });
  } else {
    showSetup();
    Common.showOverlay(el.board, {
      title: "Slik bruker du blokka",
      text: "Velg en mal eller still inn selv, skriv inn navnene og trykk Start. Så fører du poeng runde for runde.",
      howto: HOWTO,
      buttons: [{ label: "Kom i gang", primary: true }],
    });
  }
})();
