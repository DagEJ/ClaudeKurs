# 2048 – spilleregler

## Grunnreglene

- Spillet foregår på et brett med 4 × 4 ruter.
- Hvert trekk skyver **alle** brikkene så langt de kommer i én retning: opp, ned, venstre eller høyre.
- To brikker med samme tall som møtes, slås sammen til én brikke med summen (2 + 2 = 4, 4 + 4 = 8 osv.). Summen legges til poengene.
- En brikke kan bare slås sammen én gang per trekk: `2 2 4` til venstre blir `4 4`, ikke `8`.
- Er det tre like på rad, slås de to nærmest veggen sammen først.
- Etter hvert trekk som flytter noe, dukker det opp en ny brikke i en tilfeldig tom rute: 2 (90 %) eller 4 (10 %).
- Et trekk som ikke flytter noen brikker, teller ikke og gir ingen ny brikke.
- Målet er å lage en brikke med 2048. Spillet er over når brettet er fullt og ingen naboer er like.

## Vår versjon

- **Tidsangrep:** spillet starter med **2 minutter**. Klokka starter ved første trekk og står stille når siden er skjult eller et kort er oppe.
- **Når tiden er ute:** poengene på det tidspunktet er resultatet og teller for rekorden. Du får så et valg:
  - **Fortsett uten tid:** spill videre på samme brett så lenge du vil (fritt spill). Poengene fortsetter å øke, men rekorden endres ikke.
  - **Nytt spill.**
- **Angre:** tre angre-trekk per spill (tasten U eller knappen). Angre virker også når det ikke er flere trekk, og kan redde spillet.
- **Brettet blir fullt før tiden er ute:** poengene teller som resultat med én gang.
- **2048 er ikke slutten:** du får beskjed når du når 2048, og spiller videre.
- **Rekord:** flest poeng etter to minutter.
- **Styring:** piltaster eller WASD, sveip på touch. Et kort med styringen vises før spillet starter.
