// Spill som vises på forsiden. Legg til ett objekt per spill.
// id må være lik mappenavnet under games/.
//
// Eksempel:
// { id: "snake", title: "Snake", emoji: "🐍", minutes: 3,
//   description: "Spis eplene uten å krasje i deg selv." },

window.GAMES = [
  { id: "breakout", title: "Breakout", emoji: "🧱", minutes: 3,
    description: "Knus alle klossene med ballen. Tre liv, og hvert nytt brett går fortere – hvor mange poeng klarer du?" },
  { id: "snake", title: "Snake", emoji: "🐍", minutes: 3,
    description: "Spis eplene og bli lang uten å krasje i kanten eller i deg selv. Farten øker for hvert eple." },
  { id: "asteroider", title: "Asteroider", emoji: "☄️", minutes: 3,
    description: "Snu skipet og skyt asteroidene før de treffer deg. Store deler seg, små gir flest poeng – bølgene blir stadig raskere." },
  { id: "poengblokk", title: "Poengblokk", emoji: "📝",
    description: "Før poeng for kortspill, minigolf, dart og annet. Maler, nedtelling fra 501 og automatisk sum og vinner." },
  { id: "slagskip", title: "Slagskip", emoji: "🚢", minutes: 4,
    description: "Legg ut flåten din og senk datamaskinens skip før den senker dine. Treff gir nytt skudd – tre nivåer." },
  { id: "othello", title: "Othello", emoji: "⚫", minutes: 4,
    description: "Fang og snu datamaskinens brikker på et 6×6-brett. Tre nivåer – hvor lang seiersrekke klarer du?" },
  { id: "yatzy", title: "Yatzy", emoji: "🎯", minutes: 5,
    description: "Fem terninger, tre kast og 15 felt. Hold de beste og jakt på høyest mulig poengsum." },
  { id: "minesveiper", title: "Minesveiper", emoji: "💣", minutes: 3,
    description: "Rydd brettet uten å treffe en mine. Første klikk er alltid trygt – tre nivåer, raskeste tid teller." },
  { id: "fire-pa-rad", title: "Fire på rad", emoji: "🔴", minutes: 3,
    description: "Få fire på rad før datamaskinen. Tre nivåer – hvor lang seiersrekke klarer du?" },
  { id: "2048", title: "2048", emoji: "🔢", minutes: 2,
    description: "Slå sammen like tall på to minutter. Når tiden er ute, kan du spille videre." },
  { id: "ludo", title: "Ludo", emoji: "🎲", minutes: 15,
    description: "Klassisk ludo mot datamaskinen. Få alle fire brikkene i mål først." },
];
