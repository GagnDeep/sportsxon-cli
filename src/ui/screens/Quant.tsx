import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { ScreenProps } from "../App";
import {
  kellyStakes,
  expectedValue,
  arbitrage,
  devig,
  payout,
  oddsView,
} from "../../core/quant";
import { Panel } from "../components/Panel";
import { Bar } from "../components/Bars";
import { usd, pct, cents, pnlColor } from "../theme";

type Tool = "kelly" | "ev" | "arb" | "devig" | "payout" | "convert";
const TOOLS: { id: Tool; label: string }[] = [
  { id: "kelly", label: "Kelly" },
  { id: "ev", label: "EV" },
  { id: "arb", label: "Arb" },
  { id: "devig", label: "De-vig" },
  { id: "payout", label: "Payout" },
  { id: "convert", label: "Convert" },
];

interface FieldDef {
  id: string;
  label: string;
  suffix?: string;
  initial: string;
}
const FIELDS: Record<Tool, FieldDef[]> = {
  kelly: [
    { id: "fair", label: "Fair prob", suffix: "%", initial: "58" },
    { id: "price", label: "Price", suffix: "¢", initial: "50" },
    { id: "bankroll", label: "Bankroll", suffix: "$", initial: "1000" },
  ],
  ev: [
    { id: "fair", label: "Fair prob", suffix: "%", initial: "58" },
    { id: "price", label: "Price", suffix: "¢", initial: "50" },
  ],
  arb: [
    { id: "yes", label: "YES cost", suffix: "¢", initial: "48" },
    { id: "no", label: "NO cost", suffix: "¢", initial: "49" },
    { id: "stake", label: "Total stake", suffix: "$", initial: "100" },
  ],
  devig: [{ id: "probs", label: "Implied %", suffix: "comma list", initial: "55,50" }],
  payout: [
    { id: "price", label: "Price", suffix: "¢", initial: "40" },
    { id: "stake", label: "Stake", suffix: "$", initial: "100" },
  ],
  convert: [{ id: "cents", label: "Price", suffix: "¢", initial: "63" }],
};

export function Quant({ active, lockNav, goTab }: ScreenProps): React.ReactElement {
  const [tool, setTool] = useState<Tool>("kelly");
  const [vals, setVals] = useState<Record<string, string>>(() => seed());
  const [rowIdx, setRowIdx] = useState(0); // 0 = tool selector, 1.. = fields

  const fields = FIELDS[tool];
  const onToolRow = rowIdx === 0;
  const fieldIdx = rowIdx - 1;

  useEffect(() => {
    lockNav(!onToolRow); // typing into a field → suspend global nav
  }, [onToolRow, lockNav]);

  function setVal(id: string, v: string): void {
    setVals((s) => ({ ...s, [id]: v }));
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        if (!onToolRow) return setRowIdx(0);
        return goTab("home");
      }
      if (key.upArrow) return setRowIdx((r) => Math.max(0, r - 1));
      if (key.downArrow || key.tab) return setRowIdx((r) => Math.min(fields.length, r + 1));
      if (onToolRow && (key.leftArrow || key.rightArrow)) {
        const i = TOOLS.findIndex((t) => t.id === tool);
        const next = key.leftArrow ? (i - 1 + TOOLS.length) % TOOLS.length : (i + 1) % TOOLS.length;
        setTool(TOOLS[next]!.id);
        setRowIdx(0);
      }
    },
    { isActive: active },
  );

  const num = (id: string) => Number(vals[id] ?? "") || 0;

  return (
    <Box flexDirection="column">
      <Panel title="🧮 Quant lab" subtitle="prediction-market math">
        <Box marginBottom={1}>
          {TOOLS.map((t) => {
            const on = t.id === tool;
            return (
              <Text key={t.id}>
                <Text
                  color={on ? "black" : onToolRow ? "cyan" : "gray"}
                  backgroundColor={on ? "cyan" : undefined}
                  bold={on}
                >
                  {` ${t.label} `}
                </Text>
                <Text> </Text>
              </Text>
            );
          })}
          <Text dimColor>{onToolRow ? "  ←→ switch" : ""}</Text>
        </Box>

        <Box flexDirection="column">
          {fields.map((f, i) => {
            const selected = fieldIdx === i;
            return (
              <Box key={f.id}>
                <Box width={14}>
                  <Text bold={selected} color={selected ? "cyan" : undefined} dimColor={!selected}>
                    {selected ? "› " : "  "}
                    {f.label}
                  </Text>
                </Box>
                <Box width={14} borderStyle="round" borderColor={selected ? "cyan" : "gray"} paddingX={1} height={1}>
                  <TextInput value={vals[f.id] ?? ""} onChange={(v) => setVal(f.id, v)} focus={selected} placeholder="0" />
                </Box>
                {f.suffix ? <Text dimColor> {f.suffix}</Text> : null}
              </Box>
            );
          })}
        </Box>
      </Panel>

      <Box marginTop={1}>
        <Panel title="= Result" color="green">
          <Results tool={tool} num={num} vals={vals} />
        </Panel>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text dimColor>↑↓ move · ←→ switch tool (top row) · type to edit · esc back</Text>
      </Box>
    </Box>
  );
}

function seed(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const defs of Object.values(FIELDS)) for (const f of defs) out[f.id] = out[f.id] ?? f.initial;
  return out;
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box>
      <Box width={18}>
        <Text dimColor>{label}</Text>
      </Box>
      {typeof children === "string" ? <Text>{children}</Text> : children}
    </Box>
  );
}

function Results({ tool, num, vals }: { tool: Tool; num: (id: string) => number; vals: Record<string, string> }): React.ReactElement {
  if (tool === "kelly") {
    const r = kellyStakes(num("fair") / 100, num("price") / 100, num("bankroll"));
    const edgeColor = pnlColor(r.edge);
    return (
      <Box flexDirection="column">
        <Row label="Edge">
          <Text color={edgeColor}>{(r.edge * 100).toFixed(2)} pts</Text>
        </Row>
        <Row label="Full Kelly">
          <Box>
            <Bar value={r.fullFraction} max={1} width={14} color="green" />
            <Text> {pct(r.fullFraction)} · {usd(r.fullStake)}</Text>
          </Box>
        </Row>
        <Row label="½ Kelly">
          <Text>{pct(r.halfFraction)} · {usd(r.halfStake)}</Text>
        </Row>
        <Row label="¼ Kelly">
          <Text>{pct(r.quarterFraction)} · {usd(r.quarterStake)}</Text>
        </Row>
        {r.edge <= 0 ? <Text color="red">No edge — Kelly says don't bet.</Text> : null}
      </Box>
    );
  }
  if (tool === "ev") {
    const r = expectedValue(num("fair") / 100, num("price") / 100);
    return (
      <Box flexDirection="column">
        <Row label="Edge">
          <Text color={pnlColor(r.edge)}>{(r.edge * 100).toFixed(2)} pts</Text>
        </Row>
        <Row label="EV / contract">
          <Text color={pnlColor(r.evPerContract)}>{usd(r.evPerContract)}</Text>
        </Row>
        <Row label="EV / $100">
          <Text color={pnlColor(r.evPer100)}>{usd(r.evPer100)}</Text>
        </Row>
        <Row label="Verdict">
          <Text color={r.positive ? "green" : "red"}>{r.positive ? "+EV — value buy" : "−EV — skip"}</Text>
        </Row>
      </Box>
    );
  }
  if (tool === "arb") {
    const r = arbitrage(num("yes") / 100, num("no") / 100, num("stake"));
    return (
      <Box flexDirection="column">
        <Row label="Cost sum">
          <Text color={r.isArb ? "green" : "red"}>{(r.sumCost * 100).toFixed(1)}¢ {r.isArb ? "(< $1 ✓)" : "(≥ $1 ✗)"}</Text>
        </Row>
        <Row label="Stake YES / NO">
          <Text>{usd(r.yesStake)} / {usd(r.noStake)}</Text>
        </Row>
        <Row label="Guaranteed payout">
          <Text>{usd(r.payout)}</Text>
        </Row>
        <Row label="Profit / ROI">
          <Text color={pnlColor(r.profit)}>{usd(r.profit)} · {pct(r.roi, 2)}</Text>
        </Row>
        {!r.isArb ? <Text color="red">No risk-free arbitrage at these prices.</Text> : null}
      </Box>
    );
  }
  if (tool === "devig") {
    const probs = String(vals["probs"] ?? "")
      .split(",")
      .map((s) => Number(s.trim()) / 100)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (probs.length < 2) return <Text dimColor>Enter ≥2 implied percentages, e.g. 55,50</Text>;
    const r = devig(probs);
    return (
      <Box flexDirection="column">
        <Row label="Overround (vig)">
          <Text color={r.overround > 0 ? "yellow" : "green"}>{(r.overround * 100).toFixed(2)}%</Text>
        </Row>
        {r.fair.map((p, i) => (
          <Row key={i} label={`Fair #${i + 1}`}>
            <Text>{pct(p, 2)} ({cents(p)})</Text>
          </Row>
        ))}
      </Box>
    );
  }
  if (tool === "payout") {
    const r = payout(num("price") / 100, num("stake"));
    return (
      <Box flexDirection="column">
        <Row label="Contracts">
          <Text>{r.contracts}</Text>
        </Row>
        <Row label="Max payout">
          <Text>{usd(r.maxPayout)}</Text>
        </Row>
        <Row label="Profit if YES">
          <Text color="green">{usd(r.profitIfYes)}</Text>
        </Row>
        <Row label="Loss if NO">
          <Text color="red">{usd(r.profitIfNo)}</Text>
        </Row>
        <Row label="ROI · break-even">
          <Text>{pct(r.roi, 1)} · {cents(r.breakEvenProb)}</Text>
        </Row>
      </Box>
    );
  }
  // convert
  const v = oddsView(num("cents") / 100);
  return (
    <Box flexDirection="column">
      <Row label="Probability">
        <Text>{pct(v.probability, 1)}</Text>
      </Row>
      <Row label="Cents">
        <Text>{v.cents}¢</Text>
      </Row>
      <Row label="Decimal odds">
        <Text>{v.decimal.toFixed(3)}</Text>
      </Row>
      <Row label="American">
        <Text>{v.american > 0 ? `+${v.american}` : v.american}</Text>
      </Row>
    </Box>
  );
}
