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

  // Et kort som legger seg over spillflaten (elementet med klassen .board).
  // Brukes til intro («slik styrer du») før spillet starter, og til slutt-/valgskjermer.
  //
  // options:
  //   title:   overskrift
  //   text:    kort tekst (valgfri)
  //   howto:   liste med { keys: ["←", "→"], text: "flytt" } (valgfri)
  //   buttons: liste med { label, primary, onClick }. Kortet lukkes før onClick kalles.
  function showOverlay(container, options) {
    hideOverlay(container);
    const o = document.createElement("div");
    o.className = "overlay";
    const card = document.createElement("div");
    card.className = "overlay-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", options.title);

    const h = document.createElement("h2");
    h.textContent = options.title;
    card.appendChild(h);

    if (options.text) {
      const p = document.createElement("p");
      p.textContent = options.text;
      card.appendChild(p);
    }

    if (options.howto) {
      const ul = document.createElement("ul");
      ul.className = "howto";
      for (const item of options.howto) {
        const li = document.createElement("li");
        const keys = document.createElement("span");
        keys.className = "keys";
        for (const k of item.keys) {
          const kbd = document.createElement("kbd");
          kbd.textContent = k;
          keys.appendChild(kbd);
        }
        const t = document.createElement("span");
        t.textContent = item.text;
        li.append(keys, t);
        ul.appendChild(li);
      }
      card.appendChild(ul);
    }

    const row = document.createElement("div");
    row.className = "controls";
    let first = null;
    for (const b of options.buttons || []) {
      const btn = document.createElement("button");
      btn.className = "btn" + (b.primary ? " primary" : "");
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        hideOverlay(container);
        if (b.onClick) b.onClick();
      });
      row.appendChild(btn);
      if (b.primary && !first) first = btn;
    }
    card.appendChild(row);

    o.appendChild(card);
    container.appendChild(o);
    if (first) first.focus({ preventScroll: true });
    return o;
  }

  function hideOverlay(container) {
    container.querySelectorAll(":scope > .overlay").forEach((n) => n.remove());
  }

  function isOverlayOpen(container) {
    return container.querySelector(":scope > .overlay") !== null;
  }

  window.Common = { getBest, saveBest, randInt, formatTime, showOverlay, hideOverlay, isOverlayOpen };
})();
