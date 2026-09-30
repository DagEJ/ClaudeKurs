// Spill som vises på forsiden. Legg til ett objekt per spill.
// id må være lik mappenavnet under games/.
//
// Eksempel:
// { id: "snake", title: "Snake", emoji: "🐍", minutes: 3,
//   description: "Spis eplene uten å krasje i deg selv." },

window.GAMES = [
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
