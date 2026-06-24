import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { RunContext } from "../../context";
import type { MarketRef, Orderbook, Outcome, OrderResult, PlaceOrderParams, Side } from "../../core/exchanges/types";
import { exchange } from "../../core/exchanges/factory";
import { simulateFill } from "../../core/paper/engine";
import { estimateFee } from "../../core/quant/fees";
import { centsToProb } from "../../core/quant/odds";
import { Panel } from "../components/Panel";
import { ModeBadge } from "../components/Badges";
import { cents, usd, clip } from "../theme";

type Row = "side" | "outcome" | "type" | "qty" | "limit" | "place";

export function OrderTicket({
  ctx,
  market,
  book,
  active,
  lockNav,
  onClose,
  goPortfolio,
}: {
  ctx: RunContext;
  market: MarketRef;
  book: Orderbook | null;
  active: boolean;
  lockNav: (b: boolean) => void;
  onClose: () => void;
  goPortfolio: () => void;
}): React.ReactElement {
  const [side, setSide] = useState<Side>("BUY");
  const [outcome, setOutcome] = useState<Outcome>("YES");
  const [type, setType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [qty, setQty] = useState("100");
  const [limit, setLimit] = useState("");
  const [row, setRow] = useState<Row>("qty");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The order ticket always holds keyboard focus while open, so lock global nav.
  useEffect(() => {
    lockNav(true);
    return () => lockNav(false);
  }, [lockNav]);

  const rows: Row[] = useMemo(
    () => (type === "LIMIT" ? ["side", "outcome", "type", "qty", "limit", "place"] : ["side", "outcome", "type", "qty", "place"]),
    [type],
  );
  const qtyNum = Math.max(0, Math.floor(Number(qty) || 0));
  const limitProb = limit ? centsToProb(Number(limit) || 0) : undefined;

  const params: PlaceOrderParams = {
    marketId: market.id,
    side,
    outcome,
    type,
    limitPrice: type === "LIMIT" ? limitProb : undefined,
    quantity: qtyNum,
  };

  // Instant local preview from the already-fetched book.
  const preview = useMemo(() => {
    if (!book || qtyNum <= 0) return null;
    const sim = simulateFill(book, params);
    const fee = sim.avgPrice != null ? estimateFee(ctx.venue, sim.filledQty, sim.avgPrice) : 0;
    const cashFlow = side === "BUY" ? sim.notionalUsd + fee : -(sim.notionalUsd - fee);
    return { sim, fee, cashFlow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, side, outcome, type, qty, limit]);

  async function place(): Promise<void> {
    if (busy || result) return;
    if (qtyNum <= 0) {
      setErr("Quantity must be greater than 0.");
      return;
    }
    if (type === "LIMIT" && (!limitProb || limitProb <= 0)) {
      setErr("Enter a limit price in cents (1–99).");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const ex = await exchange(ctx.venue, "paper");
      const res = await ex.placeOrder({ ...params, marketId: market.id });
      setResult(res);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const numericFocused = row === "qty" || row === "limit";
  useInput(
    (input, key) => {
      if (key.escape) return onClose();
      if (result) {
        if (input === "p") return goPortfolio();
        if (key.return || input === "n") return onClose();
        return;
      }
      const i = rows.indexOf(row);
      if (key.upArrow) return setRow(rows[(i - 1 + rows.length) % rows.length]!);
      if (key.downArrow || key.tab) return setRow(rows[(i + 1) % rows.length]!);

      if (!numericFocused && (key.leftArrow || key.rightArrow)) {
        if (row === "side") setSide((s) => (s === "BUY" ? "SELL" : "BUY"));
        else if (row === "outcome") setOutcome((o) => (o === "YES" ? "NO" : "YES"));
        else if (row === "type") setType((t) => (t === "MARKET" ? "LIMIT" : "MARKET"));
        return;
      }
      // Enter on a non-numeric row places the order (numeric rows place via onSubmit).
      if (key.return && !numericFocused) return void place();
    },
    { isActive: active },
  );

  if (result) {
    const filled = result.status === "simulated" || result.filledQty > 0;
    return (
      <Panel title="🧾 Order result" color={filled ? "green" : "yellow"}>
        <Box>
          <ModeBadge mode="paper" />
          <Text>
            {" "}
            {side} {result.filledQty}/{qtyNum} {outcome} @ {cents(result.avgPrice)} — <Text bold>{result.status}</Text>
          </Text>
        </Box>
        <Text dimColor>order {result.orderId}</Text>
        <Box marginTop={1} flexDirection="column">
          <Field label="Fee" value={usd(result.feeUsd)} />
          <Field label="Cash flow" value={result.costUsd >= 0 ? `-${usd(result.costUsd)}` : `+${usd(-result.costUsd)}`} />
          {result.message ? <Field label="Note" value={result.message} /> : null}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>enter/n new order · p portfolio · esc close</Text>
        </Box>
      </Panel>
    );
  }

  return (
    <Panel title="🎟  Order ticket — paper" subtitle={clip(market.question, 40)}>
      <ToggleRow label="Side" value={side} selected={row === "side"} color={side === "BUY" ? "green" : "red"} />
      <ToggleRow label="Outcome" value={outcome} selected={row === "outcome"} color={outcome === "YES" ? "green" : "magenta"} />
      <ToggleRow label="Type" value={type} selected={row === "type"} />
      <InputRow label="Quantity" value={qty} onChange={setQty} onSubmit={place} selected={row === "qty"} suffix="contracts" />
      {type === "LIMIT" ? (
        <InputRow label="Limit ¢" value={limit} onChange={setLimit} onSubmit={place} selected={row === "limit"} suffix="cents 1–99" />
      ) : null}

      <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>Live preview (vs real book)</Text>
        {!book ? (
          <Text dimColor>orderbook unavailable</Text>
        ) : !preview ? (
          <Text dimColor>enter a quantity…</Text>
        ) : (
          <>
            <Field label="Would fill" value={`${preview.sim.filledQty} @ ${cents(preview.sim.avgPrice)} (${preview.sim.status})`} />
            <Field label="Est. fee" value={usd(preview.fee)} />
            <Field
              label={side === "BUY" ? "Est. cost" : "Est. proceeds"}
              value={usd(Math.abs(preview.cashFlow))}
            />
          </>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={row === "place" ? "black" : "cyan"} backgroundColor={row === "place" ? "cyan" : undefined} bold>
          {row === "place" ? " ▶ PLACE PAPER ORDER (enter) " : "  Place paper order  "}
        </Text>
      </Box>
      {err ? <Text color="red">{err}</Text> : busy ? <Text dimColor>placing…</Text> : null}
      <Text dimColor>↑↓ field · ←→ change · enter place · esc cancel · live: use CLI --live</Text>
    </Panel>
  );
}

function ToggleRow({ label, value, selected, color }: { label: string; value: string; selected: boolean; color?: string }): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text bold={selected} color={selected ? "cyan" : undefined} dimColor={!selected}>
          {selected ? "› " : "  "}
          {label}
        </Text>
      </Box>
      <Text color={color} bold>
        ‹ {value} ›
      </Text>
    </Box>
  );
}

function InputRow({
  label,
  value,
  onChange,
  onSubmit,
  selected,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  selected: boolean;
  suffix?: string;
}): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text bold={selected} color={selected ? "cyan" : undefined} dimColor={!selected}>
          {selected ? "› " : "  "}
          {label}
        </Text>
      </Box>
      <Box width={12} borderStyle="round" borderColor={selected ? "cyan" : "gray"} paddingX={1} height={1}>
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus={selected} placeholder="0" />
      </Box>
      {suffix ? <Text dimColor> {suffix}</Text> : null}
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text>{value}</Text>
    </Box>
  );
}
