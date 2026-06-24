---
name: sportsxon-prediction-markets
description: Use when finding edge, sizing bets, or evaluating prediction-market trades — turning a fair probability into expected value and a Kelly stake, de-vigging sportsbook odds, spotting cross-venue arbitrage, tracking closing-line value, and managing a bankroll. Uses the sportsxon CLI quant tools.
---

# Sportsxon — prediction-market quant & strategy

The whole game is: **estimate a fair probability, compare it to the market price, and only bet when the edge survives fees — then size with discipline.** The sportsxon CLI ships the math; this skill is the workflow.

## The edge-finding loop

1. **Form a fair probability** for an outcome. Use World Cup 2026 data (form, squad, H2H, standings via the *sportsxon-wc26* skill) and/or de-vigged sportsbook odds.
2. **Read the market price** (`sportsxon market <id>` / `book <id>`) — the implied probability.
3. **Compute edge & EV.** Edge = fair − price. Positive expected value means fair > price (for YES).
4. **Size with Kelly** (fractional), within your bankroll and the per-order cap.
5. **Execute** (paper first — see *sportsxon-paper-trading*), then **track CLV** to see if you beat the closing line.

## CLI quant tools (all support `--json`)

```bash
sportsxon ev     --fair 58 --price 50            # edge, EV/contract, EV per $100
sportsxon kelly  --fair 58 --price 50 --bankroll 1000   # full/½/¼ Kelly stakes
sportsxon arb    --cost-yes 48 --cost-no 49      # two-leg risk-free check + sizing
sportsxon devig  --probs 55,50                   # strip the vig → fair probabilities
sportsxon payout --price 40 --stake 100          # contracts, max payout, ROI, break-even
sportsxon convert --cents 63                     # ¢ ↔ prob ↔ decimal ↔ American
```

Inputs: `--fair`/`--probs` are **percent**, `--price`/`--cost-*` are **cents**, stakes/bankroll are **dollars**.

## Kelly, sanely

```
edge b = (1/price) − 1          # net decimal odds
f* = (b·p − (1−p)) / b          # full-Kelly fraction of bankroll (0 if no edge)
```

Full Kelly maximises long-run growth but is brutally volatile and unforgiving of a mis-estimated `p`. **Default to ¼–½ Kelly.** If `sportsxon kelly` returns 0, there is no edge — don't bet.

## De-vigging

Sportsbook implied probabilities sum to > 1 (the overround/vig). `sportsxon devig --probs 55,50` normalises them to sum to 1, giving the book's *fair* estimate — a strong prior for your `--fair`.

## Cross-venue arbitrage

Because Kalshi and Polymarket are separate books, the **same event** can be mispriced across them. Buying YES on one and NO on the other for a combined cost < $1 locks a risk-free profit:

```bash
# YES @ 48¢ on venue A, NO @ 49¢ on venue B → sum 97¢ < $1 → arb
sportsxon arb --cost-yes 48 --cost-no 49 --stake 100
```

Always net **fees and slippage** (run `quote` on each leg) — thin arbs evaporate after costs.

## Closing-line value (CLV)

The price at close is the market's best estimate. Consistently buying **below** the closing price (for YES) is the strongest evidence your process has edge, independent of any single result. Record entry price vs closing price over many bets.

## Worked example (paper)

```bash
sportsxon search "argentina"                       # find the team/market
sportsxon markets --venue kalshi --q "argentina"   # get the market id + price
sportsxon devig --probs 60,44                       # book-implied → fair ≈ 0.577
sportsxon ev    --fair 58 --price 50 --json         # confirm +EV
sportsxon kelly --fair 58 --price 50 --bankroll 1000  # → size at ¼ Kelly
sportsxon buy <id> --venue kalshi --qty <¼-kelly contracts>   # PAPER
```

## Risk management

- Bet a **fraction** of edge (¼–½ Kelly); never full Kelly on an estimate.
- Respect the per-order and position caps; diversify across uncorrelated events.
- Fees turn small edges negative — model them every time.
- Track results honestly (CLV + realized P&L via `sportsxon portfolio`). Not financial advice.
