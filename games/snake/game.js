// Tegning, input og spill-løkke for Snake. Reglene ligger i Snake.js.
(function () {
  const GAME_ID = "snake";
  const MAX_DT = 100; // klipp store tidssprang (f.eks. etter pause eller treg maskin)
  const SWIPE_MIN = 24; // px før en sveip teller

  const el = {
    board: document.getElementById("board"),
    canvas: document.getElementById("canvas"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    speed: document.getElementById("speed"),
    message: document.getElementById("message"),
    pause: document.getElementById("pause"),
    newGame: document.getElementById("new"),
  };
  const ctx = el.canvas.getContext("2d");

  let state = null;
  let dirty = true; // tegn på nytt ved neste bilde

  // ---------- Farger fra shared/style.css ----------

  let colors = {};
  function readColors() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    colors = {
      surface: v("--surface"),
      bg: v("--bg"),
      border: v("--border"),
      snake: v("--p-green"),
      head: v("--good"),
      apple: v("--p-red"),
      leaf: v("--p-green"),
      eye: v("--on-player"),
      pupil: v("--disc-dark"),
      bad: v("--bad"),
    };
    dirty = true;
  }
  readColors();
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", readColors);
    else if (mq.addListener) mq.addListener(readColors);
  }

  // ---------- Størrelse (skarp på skjermer med høy tetthet) ----------

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = el.canvas.clientWidth;
    const px = Math.max(1, Math.round(w * dpr));
    if (el.canvas.width !== px || el.canvas.height !== px) {
      el.canvas.width = px;
      el.canvas.height = px;
    }
    dirty = true;
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(el.canvas);
  window.addEventListener("resize", resize);
  resize();

  // ---------- Tegning ----------

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function draw() {
    const W = el.canvas.width;
    const cell = W / state.cols;
    ctx.clearRect(0, 0, W, W);

    // Rutemønster
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = colors.bg;
    for (let y = 0; y < state.rows; y++) {
      for (let x = (y % 2); x < state.cols; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
    }

    // Eple
    if (state.apple) {
      const cx = (state.apple.x + 0.5) * cell;
      const cy = (state.apple.y + 0.55) * cell;
      ctx.fillStyle = colors.apple;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.leaf;
      ctx.beginPath();
      ctx.ellipse(cx + cell * 0.1, cy - cell * 0.38, cell * 0.14, cell * 0.07, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Slange: kropp som runde ruter, med «bro» mellom naboer så den henger sammen.
    const pad = cell * 0.1;
    const snake = state.snake;
    ctx.fillStyle = colors.snake;
    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      ctx.fillStyle = i === 0 ? colors.head : colors.snake;
      roundRect(p.x * cell + pad, p.y * cell + pad, cell - 2 * pad, cell - 2 * pad, cell * 0.28);
      if (i > 0) {
        // Fra midten av denne ruta til midten av neste (mot hodet).
        const q = snake[i - 1];
        ctx.fillStyle = colors.snake;
        if (p.y === q.y) ctx.fillRect((Math.min(p.x, q.x) + 0.5) * cell, p.y * cell + pad, cell, cell - 2 * pad);
        else ctx.fillRect(p.x * cell + pad, (Math.min(p.y, q.y) + 0.5) * cell, cell - 2 * pad, cell);
      }
    }

    // Øyne i fartsretningen
    const head = snake[0];
    const d = Snake.DIRS[state.dir];
    const hx = (head.x + 0.5) * cell;
    const hy = (head.y + 0.5) * cell;
    for (const side of [-1, 1]) {
      const ex = hx + d.x * cell * 0.14 + d.y * side * cell * 0.2;
      const ey = hy + d.y * cell * 0.14 - d.x * side * cell * 0.2;
      ctx.fillStyle = colors.eye;
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.pupil;
      ctx.beginPath();
      ctx.arc(ex + d.x * cell * 0.04, ey + d.y * cell * 0.04, cell * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    // Krasj: rød ring rundt hodet
    if (state.status === "over") {
      ctx.strokeStyle = colors.bad;
      ctx.lineWidth = Math.max(2, cell * 0.12);
      ctx.beginPath();
      ctx.arc(hx, hy, cell * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawStatus() {
    el.score.textContent = state.score;
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best;
    const level = 1 + Math.round((Snake.START_INTERVAL - Snake.interval(state.score)) / Snake.INTERVAL_STEP);
    const maxLevel = 1 + Math.round((Snake.START_INTERVAL - Snake.MIN_INTERVAL) / Snake.INTERVAL_STEP);
    el.speed.textContent = level >= maxLevel ? "Fart " + level + " · full fart" : "Fart " + level;
    el.pause.disabled = state.status !== "playing" || Common.isOverlayOpen(el.board);
  }

  function say(text, kind = "") {
    el.message.className = "message " + kind;
    el.message.textContent = text;
  }

  // ---------- Spillflyt ----------

  function newGame() {
    Common.hideOverlay(el.board);
    blurButtons();
    state = Snake.newGame(Math.random);
    say("Trykk en piltast eller sveip for å starte.");
    dirty = true;
    drawStatus();
  }

  function turn(dir) {
    if (!state || Common.isOverlayOpen(el.board)) return;
    const before = state.status;
    state = Snake.turn(state, dir);
    if (before === "ready" && state.status === "playing") {
      say("");
      drawStatus();
    }
  }

  function pause() {
    if (!state || state.status !== "playing" || Common.isOverlayOpen(el.board)) return;
    Common.showOverlay(el.board, {
      title: "Pause",
      text: state.score + (state.score === 1 ? " eple" : " epler") + " så langt.",
      buttons: [
        { label: "Fortsett", primary: true, onClick: resume },
        { label: "Nytt spill", onClick: newGame },
      ],
    });
    drawStatus();
  }

  function resume() {
    blurButtons();
    drawStatus();
  }

  function onEnd() {
    const n = state.score;
    const record = n > 0 && Common.saveBest(GAME_ID, n);
    const apples = n + (n === 1 ? " eple" : " epler");
    let title;
    let text;
    if (state.status === "won") {
      title = "Hele brettet er fullt!";
      text = "Du spiste " + apples + " og fylte alle rutene.";
    } else {
      title = state.crash && state.crash.reason === "wall" ? "Krasj i veggen!" : "Du bet deg selv!";
      text = "Du spiste " + apples + ", og slangen ble " + state.snake.length + " ruter lang.";
    }
    if (record) text += " Ny rekord!";
    say(record ? "Ny rekord: " + apples + "!" : "", record ? "good" : "");
    drawStatus();
    Common.showOverlay(el.board, {
      title,
      text,
      buttons: [{ label: "Nytt spill", primary: true, onClick: newGame }],
    });
    drawStatus();
  }

  // ---------- Løkke ----------
  // Står stille når siden er skjult eller et kort er oppe.

  let last = null;
  function frame(now) {
    const dt = last === null ? 0 : Math.min(MAX_DT, Math.max(0, now - last));
    last = now;
    if (state && state.status === "playing" && !document.hidden && !Common.isOverlayOpen(el.board)) {
      const before = state;
      state = Snake.step(state, dt, Math.random);
      if (state.snake !== before.snake || state.status !== before.status) {
        dirty = true;
        if (state.score !== before.score) drawStatus();
        if (state.status !== "playing") onEnd();
      }
    }
    if (dirty && state) {
      draw();
      dirty = false;
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });

  // ---------- Input ----------

  const KEYS = {
    ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
    a: "left", d: "right", w: "up", s: "down",
  };

  function blurButtons() {
    const a = document.activeElement;
    if (a && a.tagName === "BUTTON") a.blur();
  }

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (Common.isOverlayOpen(el.board)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === " " || key === "p") {
      if (state && state.status === "playing") {
        e.preventDefault();
        pause();
      }
      return;
    }
    const dir = KEYS[key];
    if (!dir) return;
    e.preventDefault();
    turn(dir);
  });

  // Sveip: svingen teller så snart fingeren har flyttet seg langt nok,
  // og et nytt sveip kan starte der den er, så flere svinger i ett drag virker.
  let swipe = null;
  el.board.addEventListener("pointerdown", (e) => {
    if (Common.isOverlayOpen(el.board)) return;
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  el.board.addEventListener("pointermove", (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    swipe.x = e.clientX;
    swipe.y = e.clientY;
  });
  const endSwipe = () => (swipe = null);
  el.board.addEventListener("pointerup", endSwipe);
  el.board.addEventListener("pointercancel", endSwipe);
  // Hindre at sveip ruller eller zoomer siden (i tillegg til touch-action: none).
  el.board.addEventListener("touchmove", (e) => {
    if (!Common.isOverlayOpen(el.board)) e.preventDefault();
  }, { passive: false });

  el.pause.addEventListener("click", pause);
  el.newGame.addEventListener("click", newGame);

  // Kun for automatiske tester i nettleser: les tilstanden (ikke endre den).
  window.SnakeDebug = { get state() { return state; } };

  // ---------- Start ----------

  newGame();
  Common.showOverlay(el.board, {
    title: "Slik spiller du",
    text: "Spis eplene og bli lang. Krasjer du i kanten eller i deg selv, er spillet slutt. Farten øker for hvert eple.",
    howto: [
      { keys: ["←", "↑", "→", "↓"], text: "Sving (eller WASD)" },
      { keys: ["Sveip"], text: "Sving på touch" },
      { keys: ["Mellomrom"], text: "Pause" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: () => drawStatus() }],
  });
  drawStatus();
  requestAnimationFrame(frame);
})();
