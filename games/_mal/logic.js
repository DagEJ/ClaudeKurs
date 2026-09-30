// Ren spill-logikk for malen «Klikk-sprint».
// Ingen DOM og ingen klokke her: tid sendes inn som millisekunder.

const ClickSprint = {
  DURATION_MS: 10000,

  // Tilstand før spillet er startet.
  create() {
    return { status: "ready", score: 0, remainingMs: ClickSprint.DURATION_MS };
  },

  start(state) {
    return { ...state, status: "playing", score: 0, remainingMs: ClickSprint.DURATION_MS };
  },

  // Et klikk teller bare mens spillet pågår.
  click(state) {
    if (state.status !== "playing") return state;
    return { ...state, score: state.score + 1 };
  },

  // Flytt tiden fremover med dtMs millisekunder.
  tick(state, dtMs) {
    if (state.status !== "playing") return state;
    const remainingMs = Math.max(0, state.remainingMs - dtMs);
    return {
      ...state,
      remainingMs,
      status: remainingMs === 0 ? "over" : "playing",
    };
  },
};

if (typeof module !== "undefined") module.exports = ClickSprint;
