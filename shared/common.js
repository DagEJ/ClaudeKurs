// Felles hjelpefunksjoner for alle spill. Tilgjengelig som window.Common.
(function () {
  const PREFIX = "claudekurs:";

  // Beste resultat per spill. higherIsBetter=false for f.eks. tid.
  function getBest(gameId) {
    try {
      const raw = localStorage.getItem(PREFIX + gameId + ":best");
      return raw === null ? null : Number(raw);
    } catch (e) {
      return null;
    }
  }

  // Lagrer resultatet hvis det er ny rekord. Returnerer true ved ny rekord.
  function saveBest(gameId, score, higherIsBetter = true) {
    const best = getBest(gameId);
    const isRecord =
      best === null || (higherIsBetter ? score > best : score < best);
    if (isRecord) {
      try {
        localStorage.setItem(PREFIX + gameId + ":best", String(score));
      } catch (e) {
        /* localStorage utilgjengelig – rekorden gjelder bare denne økten */
      }
    }
    return isRecord;
  }

  // Heltall i [min, max], begge inkludert.
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 83 sekunder -> "1:23"
  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  window.Common = { getBest, saveBest, randInt, formatTime };
})();
