// Tegning, input og spill-løkke for malen «Klikk-sprint».
(function () {
  const GAME_ID = "_mal"; // bytt til mappenavnet når du kopierer malen

  const el = {
    time: document.getElementById("time"),
    score: document.getElementById("score"),
    best: document.getElementById("best"),
    target: document.getElementById("target"),
    message: document.getElementById("message"),
    start: document.getElementById("start"),
  };

  let state = ClickSprint.create();
  let lastTime = 0;

  function render() {
    el.time.textContent = Math.ceil(state.remainingMs / 1000);
    el.score.textContent = state.score;
    const best = Common.getBest(GAME_ID);
    el.best.textContent = best === null ? "–" : best;
    el.target.disabled = state.status !== "playing";
    el.start.disabled = state.status === "playing";
  }

  function loop(now) {
    state = ClickSprint.tick(state, now - lastTime);
    lastTime = now;
    render();
    if (state.status === "playing") {
      requestAnimationFrame(loop);
    } else {
      finish();
    }
  }

  function finish() {
    const record = Common.saveBest(GAME_ID, state.score);
    el.message.className = "message " + (record ? "good" : "");
    el.message.textContent = record
      ? "Ny rekord: " + state.score + " klikk!"
      : "Du fikk " + state.score + " klikk.";
    el.start.textContent = "Spill igjen";
    render();
  }

  function start() {
    state = ClickSprint.start(state);
    el.message.className = "message";
    el.message.textContent = "Klikk, klikk, klikk!";
    lastTime = performance.now();
    render();
    el.target.focus();
    requestAnimationFrame(loop);
  }

  function hit() {
    state = ClickSprint.click(state);
    render();
  }

  el.start.addEventListener("click", start);
  el.target.addEventListener("click", hit);
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || Common.isOverlayOpen(board)) return;
    e.preventDefault();
    if (state.status === "playing") hit();
    else if (!e.repeat) start();
  });

  // Kort med styringen før spillet starter (se CLAUDE.md).
  const board = document.querySelector(".board");
  render();
  Common.showOverlay(board, {
    title: "Slik spiller du",
    text: "Klikk så mange ganger du kan på 10 sekunder.",
    howto: [
      { keys: ["Mellomrom"], text: "Klikk" },
      { keys: ["Trykk"], text: "Trykk på den store knappen" },
    ],
    buttons: [{ label: "Start", primary: true, onClick: start }],
  });
})();
