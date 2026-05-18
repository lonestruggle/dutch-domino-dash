## Nieuwe claim-fase voor "Wega di sen"

Vervangt de huidige vrije claim (iedereen klikt op eigen stenen) door een **gestuurde aftel-pop-up** die alle spelers samen doorloopt.

### Volgorde van te claimen stenen
Server berekent eenmalig per ronde, in deze vaste volgorde:

1. **Dubbels hoog → laag**: 6-6, 5-5, 4-4, 3-3, 2-2, 1-1, 0-0
2. **Niet-dubbels hoog → laag** (op som, bij gelijke som hoogste pip eerst): 6-5, 6-4, 6-3, 5-4, 6-2, 5-3, 6-1, 5-2, 4-3, 6-0, 5-1, 4-2, 5-0, 4-1, 3-2, 4-0, 3-1, 2-1, 3-0, 2-0, 1-0

> **Vraag ter bevestiging**: je schreef "5-5 t/m 1-1" en "6-5 t/m 1-0". Ik ga ervan uit dat dit een typo is en dat **6-6 en 0-0 wel meedoen** (standaard Wega di sen). Laat me weten als dat anders moet.

### Mechaniek per steen (3 seconden timer)

```text
[Pop-up volledig scherm]
  "Wie heeft de 6-6?"           <-- huidige steen groot in beeld
  [██████░░░░] 3s aftellen
  
  Speler-acties:
   - Heeft steen in hand → grote "Claim 6-6!" knop pulseert
   - Heeft steen NIET    → knop disabled, "Wachten..."
  
  Bot-acties (server timer):
   - 0-300ms willekeurig delay
   - 95% kans: claimt automatisch
   - 5% kans: verzuimt (bewust niets doen)
```

### Wat gebeurt er bij timeout?
- Server logt **wie de steen in zijn hand had** (de "verzuimer").
- Pop-up rolt door naar de volgende steen, zónder direct te straffen.

### Wat gebeurt er bij een claim?
Server checkt of er een eerdere verzuimer bestaat (iemand met een hogere steen die niet claimde):

- **Geen verzuimer** → claimer wint, wordt starter, spel begint.
- **Wel verzuimer** → spel wordt stilgelegd:
  - Grote rode overlay: *"Spel stilgelegd! [Naam] heeft verzuimd de [6-6] tijdig te claimen!"*
  - Misgelopen steen flitst rood naast naam verzuimer.
  - **Boete**: verzuimer betaalt `stake` aan **elke andere speler** aan tafel (4 spelers, inzet 10 → verzuimer betaalt 30).
  - Ronde eindigt direct, geen spel.

### Bot-foutkans (admin instelbaar)
- Nieuwe app-setting `wega_bot_claim_chance` (default 0.95).
- Bewerkbaar via bestaand admin-instellingenscherm.

### Technische uitvoering

**Database (1 migratie):**
- `lobbies.wega_claim_sequence jsonb` — gegenereerde volgorde van stenen voor deze ronde.
- `lobbies.wega_claim_index int` — huidige positie in de sequence.
- `lobbies.wega_claim_started_at timestamptz` — start huidige 3s timer.
- `lobbies.wega_claim_missed jsonb` — `[{position, tile, expired_at}]` per gemiste steen.
- App-setting `wega_bot_claim_chance` (numeric, 0.95).

**Nieuwe/aangepaste RPC's:**
- `wega_start_claim_phase(_lobby_id)` — bouwt sequence o.b.v. wie wat in zijn hand heeft, zet index=0.
- `wega_claim_current(_lobby_id, _actor_position)` — vervangt `wega_claim_starter`. Valideert dat caller de huidige steen heeft; bij verzuimer triggert blocked-ronde + boete-uitkering aan andere spelers; anders → starter gezet, fase → playing.
- `wega_advance_claim(_lobby_id)` — door host-client aangeroepen na 3s timeout; schuift index op, logt verzuimer indien iemand de steen had.

**Frontend:**
- `WegaPhaseOverlay.tsx` claiming_starter-blok herschreven: toont 1 steen + timer + claim-knop, geen handweergave meer.
- Nieuwe `WegaBlockedOverlay.tsx` voor de rode "Spel stilgelegd"-melding.
- `Game.tsx` bot-orchestrator uitgebreid: bot roept `wega_claim_current` aan met 0-300ms delay als hij de huidige steen heeft, met `Math.random() < botClaimChance`.
- Host-client driver `wega_advance_claim` zodra `now - wega_claim_started_at > 3s`.

### Wat ik NIET doe (jouw eerdere keuzes blijven staan)
- Geen autoplaatsen van starter.
- Solo-test mode (1 mens + bots) blijft zoals nu.
