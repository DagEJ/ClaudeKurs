// Tegning, input og spill-løkke for Breakout. Reglene og fysikken ligger i logic.js.
(function () {
  const GAME_ID = "breakout";
  const W = Breakout.W;
  const H = Breakout.H;
  const MAX_FRAME = 0.05; // sekunder; lengre pauser mellom bilder klippes, så ballen ikke hopper
  const END_DELAY = 700; // la sluttstillingen vises litt før sluttkortet
  const TAP_SLOP = 10; // px; flytter fingeren mindre enn dette, er det et trykk

  const el = {
    board: document.getElementById("board"),
    canvas: document.getElementById("canvas"),
    score: document.getElementById("score"),
    lives: document.getElementById("lives"),
    level: document.getElementById("level"),
    best: document.getElementById("best"),
    message: document.getElementById("message"),
    pause: document.getElementById("pause"),
    newGame: document.getElementById("new"),
  };
  const ctx = el.canvas.getContext("2d");

  let state = Breakout.create();
  let started = false; // introkortet er lukket og et spill er i gang eller ferdig
  let acc = 0; // tid som ikke er brukt opp i faste steg ennå
  let last = null; // tidspunkt for forrige bilde, null etter pause
  let token = 0; // økes ved nytt spill, så gamle timere ignoreres
  const input = { left: false, right: false, targetX: null, launch: false };

  // ---------- Farger fra shared/style.css ----------

  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    colors = {
      text: v("--text"),
      muted: v("--muted"),
      border: v("--border"),
      accent: v("--accent"),
      onPlayer: v("--on-player"),
      rows: [v("--p-red"), v("--accent"), v("--p-yellow"), v("--p-green"), v("--p-blue"), v("--p-red"), v("--accent")],
    };
  }
  readColors();
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  if (darkQuery) {
    const onChange = () => { readColors(); draw(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener("change", onChange);
    else if (darkQuery.addListener) darkQuery.addListener(onChange);
  }

  // ---------- Størrelse (skarp på skjermer med høy pikseltetthet) ----------

  let scale = 1;
  function resize() {
    const cssW = el.canvas.clientWidth || W;
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = Math.round(cssW * dpr);
    el.canvas.height = Math.round(cssW * (H / W) * dpr);
    scale = el.canvas.width / W;
    draw();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(el.canvas);
  window.addEventListener("resize", resize);

  // ---------- Tegning ----------

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const b of state.bricks) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = colors.rows[b.row % colors.rows.length];
      roundRect(b.x, b.y, b.w, b.h, 3);
      ctx.fill();
      if (b.hp > 1) {
        // Tåler ett treff til: merket med en lys ramme.
        ctx.strokeStyle = colors.onPlayer;
        ctx.lineWidth = 1.5;
        roundRect(b.x + 2.5, b.y + 2.5, b.w - 5, b.h - 5, 2);
        ctx.stroke();
      }
    }

    const p = state.paddle;
    ctx.fillStyle = colors.text;
    roundRect(p.x - p.w / 2, Breakout.PADDLE_Y, p.w, Breakout.PADDLE_H, 4);
    ctx.fill();

    if (state.status !== "over") {
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y, Breakout.BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }

    if (started && state.status === "serve" && !Common.isOverlayOpen(el.board)) {
      ctx.fillStyle = colors.muted;
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Mellomrom eller trykk for å sende ballen", W / 2, Breakout.PADDLE_Y - 60);
    }
  }

  function drawStats() {
    el.score.textContent = state.score;
    el.lives.textContent = state.lives;
    el.level.textContent = state.level;
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best;
    el.pause.disabled = !started || state.status === "over";
    el.board.classList.toggle("live", started && state.status !== "over" && !Common.isOverlayOpen(el.board));
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Løkke ----------

  function running() {
    return started && state.status !== "over" && !document.hidden && !Common.isOverlayOpen(el.board);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running()) {
      last = null;
      acc = 0;
      return;
    }
    const dt = last === null ? 0 : Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
    last = now;
    acc += dt;
    const r = Breakout.advance(state, acc, input, Math.random);
    state = r.state;
    acc = r.rest;
    if (state.status !== "serve") input.launch = false;
    handleEvents(state.events);
    draw();
    drawStats();
  }

  function handleEvents(events) {
    if (!events.length) return;
    if (events.includes("over")) return finish();
    if (events.includes("level")) {
      say("Brett " + state.level + "! Ballen går fortere nå.", "good");
    } else if (events.includes("life")) {
      say(state.lives === 1 ? "Du mistet et liv. Siste liv!" : "Du mistet et liv. " + state.lives + " igjen.", "bad");
    } else if (events.includes("launch")) {
      say("");
    }
  }

  function later(fn, ms) {
    const t = token;
    setTimeout(() => t === token && fn(), ms);
  }

  // ---------- Spillflyt ----------

  function newGame() {
    token++;
    Common.hideOverlay(el.board);
    state = Breakout.create();
    started = true;
    acc = 0;
    last = null;
    input.left = input.right = input.launch = false;
    input.targetX = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    say("Send ballen ut med mellomrom eller et trykk.");
    draw();
    drawStats();
  }

  function finish() {
    const record = state.score > 0 && Common.saveBest(GAME_ID, state.score);
    const best = Common.getBest(GAME_ID);
    const title = "Spillet er over";
    const text =
      "Du fikk " + state.score + " poeng og kom til brett " + state.level + ". " +
      (record ? "Ny rekord!" : "Rekord: " + (best === null ? 0 : best) + ".");
    say(title + ". " + state.score + " poeng.", record ? "good" : "");
    draw();
    drawStats();
    later(() => {
      Common.showOverlay(el.board, {
        title,
        text,
        buttons: [{ label: "Nytt spill", primary: true, onClick: newGame }],
      });
      drawStats();
    }, END_DELAY);
  }

  function pause() {
    if (!started || state.status === "over" || Common.isOverlayOpen(el.board)) return;
    input.left = input.right = input.launch = false;
    Common.showOverlay(el.board, {
      title: "Pause",
      text: "Poeng: " + state.score + ". Liv: " + state.lives + ". Brett: " + state.level + ".",
      buttons: [
        { label: "Fortsett", primary: true, onClick: resume },
        { label: "Nytt spill", onClick: newGame },
      ],
    });
    draw();
    drawStats();
  }

  function resume() {
    last = null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    draw();
    drawStats();
  }

  function requestLaunch() {
    if (running() && state.status === "serve") input.launch = true;
  }

  // ---------- Input ----------

  el.newGame.addEventListener("click", newGame);
  el.pause.addEventListener("click", pause);

  const LEFT = new Set(["ArrowLeft", "a", "A"]);
  const RIGHT = new Set(["ArrowRight", "d", "D"]);

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board) || !started) return;
    if (LEFT.has(e.key)) {
      e.preventDefault();
      input.left = true;
      input.targetX = null; // tastaturet tar over fra pekeren
    } else if (RIGHT.has(e.key)) {
      e.preventDefault();
      input.right = true;
      input.targetX = null;
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault(); // ikke trykk på en knapp som har fokus, og ikke rull siden
      if (!e.repeat) requestLaunch();
    } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      pause();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (LEFT.has(e.key)) input.left = false;
    if (RIGHT.has(e.key)) input.right = false;
  });
  window.addEventListener("blur", () => { input.left = input.right = false; });

  // Mus: racketen følger pekeren. Touch: dra med fingeren. Et kort trykk sender ballen.
  function toField(clientX) {
    const r = el.canvas.getBoundingClientRect();
    return ((clientX - r.left) / (r.width || 1)) * W;
  }
  let down = null; // { id, x, y, moved }
  el.canvas.addEventListener("pointerdown", (e) => {
    if (!running()) return;
    e.preventDefault();
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    try { el.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ikke støttet */ }
    input.targetX = toField(e.clientX);
  });
  el.canvas.addEventListener("pointermove", (e) => {
    if (down && down.id === e.pointerId) {
      if (Math.abs(e.clientX - down.x) > TAP_SLOP || Math.abs(e.clientY - down.y) > TAP_SLOP) down.moved = true;
      input.targetX = toField(e.clientX);
    } else if (e.pointerType === "mouse" && running()) {
      input.targetX = toField(e.clientX);
    }
  });
  function endPointer(e, cancelled) {
    if (!down || down.id !== e.pointerId) return;
    const tap = !cancelled && !down.moved;
    down = null;
    if (tap) requestLaunch();
  }
  el.canvas.addEventListener("pointerup", (e) => endPointer(e, false));
  el.canvas.addEventListener("pointercancel", (e) => endPointer(e, true));

  // Skjult fane: sett spillet på pause, så man selv velger når det skal fortsette.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && started && state.status !== "over") pause();
  });

  // ---------- Start ----------

  resize();
  drawStats();
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Knus alle klossene uten å miste ballen. Du har tre liv, og hvert nytt brett går fortere.",
    howto: [
      { keys: ["←", "→"], text: "Flytt racketen (også A / D)" },
      { keys: ["Mellomrom"], text: "Send ballen ut" },
      { keys: ["Dra"], text: "Flytt racketen (finger eller mus)" },
      { keys: ["Trykk"], text: "Send ballen ut" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: newGame }],
  });
  drawStats();
  requestAnimationFrame(frame);
})();
