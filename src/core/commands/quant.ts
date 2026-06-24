import pc from "picocolors";
import type { RunContext } from "../../context";
import type { CommandOutput } from "../../render/headless";
import { keyValues } from "../../render/tables";
import { CliError, ExitCode } from "../../lib/exit";
import {
  kellyStakes,
  expectedValue,
  arbitrage,
  devig,
  payout,
  oddsView,
  centsToProb,
  type OddsView,
} from "../quant";

function need(name: string, v: number | undefined): number {
  if (v === undefined || Number.isNaN(v)) {
    throw new CliError(`--${name} is required and must be a number.`, ExitCode.USAGE);
  }
  return v;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const usd = (x: number) => `$${x.toFixed(2)}`;
const sign = (x: number) => (x >= 0 ? pc.green : pc.red);

export function runKelly(ctx: RunContext, o: { fair?: number; price?: number; bankroll?: number }): CommandOutput {
  const fair = centsToProb(need("fair", o.fair)); // --fair given as percent
  const price = centsToProb(need("price", o.price)); // --price given as cents
  const k = kellyStakes(fair, price, o.bankroll ?? 1000);
  return {
    data: k,
    render: (color) => {
      const edgeStr = (color ? sign(k.edge) : (s: string) => s)(`${(k.edge * 100).toFixed(1)} pts`);
      if (k.fullFraction <= 0) {
        return (color ? pc.yellow("No bet — Kelly is zero or negative. ") : "No bet — Kelly is zero or negative. ") +
          `At ${(price * 100).toFixed(0)}¢ the price already meets your ${(fair * 100).toFixed(0)}% read.`;
      }
      return keyValues(
        [
          ["Edge", edgeStr],
          ["Full Kelly", `${usd(k.fullStake)}  (${pct(k.fullFraction)} of roll)`],
          ["Half Kelly", `${usd(k.halfStake)}  (${pct(k.halfFraction)})`],
          ["Quarter Kelly", `${usd(k.quarterStake)}  (${pct(k.quarterFraction)})`],
        ],
        color,
      );
    },
  };
}

export function runEv(ctx: RunContext, o: { fair?: number; price?: number }): CommandOutput {
  const fair = centsToProb(need("fair", o.fair));
  const price = centsToProb(need("price", o.price));
  const ev = expectedValue(fair, price);
  return {
    data: ev,
    render: (color) => {
      const paint = (s: string) => (color ? sign(ev.evPerContract)(s) : s);
      return keyValues(
        [
          ["Fair / price", `${pct(ev.fairProb)} vs ${(ev.price * 100).toFixed(0)}¢`],
          ["Edge", `${(ev.edge * 100).toFixed(1)} pts`],
          ["EV / contract", paint(usd(ev.evPerContract))],
          ["EV / $100", paint(usd(ev.evPer100))],
          ["Verdict", ev.positive ? (color ? pc.green("+EV bet") : "+EV bet") : (color ? pc.red("-EV, pass") : "-EV, pass")],
        ],
        color,
      );
    },
  };
}

export function runArb(ctx: RunContext, o: { yes?: number; no?: number; stake?: number }): CommandOutput {
  const yes = centsToProb(need("yes", o.yes));
  const no = centsToProb(need("no", o.no));
  const a = arbitrage(yes, no, o.stake ?? 100);
  return {
    data: a,
    render: (color) =>
      keyValues(
        [
          ["YES + NO cost", `${(a.sumCost * 100).toFixed(1)}¢  ${a.isArb ? (color ? pc.green("(arb!)") : "(arb!)") : color ? pc.red("(no arb)") : "(no arb)"}`],
          ["Stake YES", `${usd(a.yesStake)} @ ${(a.yesCost * 100).toFixed(0)}¢`],
          ["Stake NO", `${usd(a.noStake)} @ ${(a.noCost * 100).toFixed(0)}¢`],
          ["Guaranteed payout", usd(a.payout)],
          ["Locked profit", (color ? sign(a.profit)(usd(a.profit)) : usd(a.profit)) + `  (${pct(a.roi)} ROI)`],
        ],
        color,
      ),
  };
}

export function runDevig(ctx: RunContext, o: { probs?: string }): CommandOutput {
  if (!o.probs) throw new CliError("--probs is required, e.g. --probs 55,50", ExitCode.USAGE);
  const cents = o.probs.split(/[,\s]+/).filter(Boolean).map((s) => Number(s));
  if (cents.some((n) => Number.isNaN(n))) throw new CliError("--probs must be comma-separated numbers (cents).", ExitCode.USAGE);
  const r = devig(cents.map(centsToProb));
  return {
    data: r,
    render: (color) =>
      keyValues(
        [
          ["Overround (vig)", `${(r.overround * 100).toFixed(1)}%`],
          ...r.fair.map((p, i) => [`Fair #${i + 1}`, `${(p * 100).toFixed(1)}%  (${Math.round(p * 100)}¢)`] as [string, string]),
        ],
        color,
      ),
  };
}

export function runPayout(ctx: RunContext, o: { price?: number; stake?: number }): CommandOutput {
  const price = centsToProb(need("price", o.price));
  const r = payout(price, need("stake", o.stake));
  return {
    data: r,
    render: (color) =>
      keyValues(
        [
          ["Contracts", String(r.contracts)],
          ["Max payout (YES)", usd(r.maxPayout)],
          ["Profit if YES", color ? pc.green(usd(r.profitIfYes)) : usd(r.profitIfYes)],
          ["Profit if NO", color ? pc.red(usd(r.profitIfNo)) : usd(r.profitIfNo)],
          ["ROI", pct(r.roi)],
          ["Break-even", `${Math.round(r.breakEvenProb * 100)}¢`],
        ],
        color,
      ),
  };
}

export function runConvert(ctx: RunContext, o: { prob?: number; cents?: number; decimal?: number; american?: number }): CommandOutput {
  let view: OddsView;
  if (o.cents !== undefined) view = oddsView(centsToProb(o.cents));
  else if (o.prob !== undefined) view = oddsView(o.prob / 100);
  else if (o.decimal !== undefined) view = oddsView(o.decimal > 0 ? 1 / o.decimal : 0);
  else if (o.american !== undefined) view = oddsView(oddsView(0).probability); // placeholder, replaced below
  else throw new CliError("Provide one of --prob, --cents, --decimal, --american.", ExitCode.USAGE);

  if (o.american !== undefined) {
    const a = o.american;
    const prob = a > 0 ? 100 / (a + 100) : -a / (-a + 100);
    view = oddsView(prob);
  }
  return {
    data: view,
    render: (color) =>
      keyValues(
        [
          ["Probability", `${(view.probability * 100).toFixed(1)}%`],
          ["Cents", `${view.cents}¢`],
          ["Decimal", view.decimal.toFixed(3)],
          ["American", view.american > 0 ? `+${view.american}` : String(view.american)],
        ],
        color,
      ),
  };
}
