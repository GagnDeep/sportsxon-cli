import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import SelectInput from "ink-select-input";
import type { RunContext } from "../../context";
import { marketData } from "../../core/exchanges/factory";
import type { MarketRef, Orderbook } from "../../core/exchanges/types";
import { useAsync } from "../hooks";

const cents = (p: number | null | undefined) => (p == null ? "—" : `${Math.round(p * 100)}¢`);

function BookView({ ob }: { ob: Orderbook }): React.ReactElement {
  const rows = Math.max(ob.bids.length, ob.asks.length, 1);
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Box width={20} justifyContent="flex-end">
          <Text bold color="green">
            Bid (size @ price)
          </Text>
        </Box>
        <Text> │ </Text>
        <Box width={20}>
          <Text bold color="red">
            Ask (price · size)
          </Text>
        </Box>
      </Box>
      {Array.from({ length: Math.min(rows, 10) }).map((_, i) => {
        const b = ob.bids[i];
        const a = ob.asks[i];
        return (
          <Box key={i}>
            <Box width={20} justifyContent="flex-end">
              <Text color="green">{b ? `${b.size} @ ${cents(b.price)}` : ""}</Text>
            </Box>
            <Text> │ </Text>
            <Box width={20}>
              <Text color="red">{a ? `${cents(a.price)} · ${a.size}` : ""}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function Markets({ ctx, onBack }: { ctx: RunContext; onBack: () => void }): React.ReactElement {
  const [selected, setSelected] = useState<MarketRef | null>(null);
  const list = useAsync(() => marketData(ctx.venue).listMarkets({ limit: 12 }), [ctx.venue]);
  const book = useAsync<Orderbook | null>(
    async () => (selected ? marketData(ctx.venue).getOrderbook(selected.id) : null),
    [selected?.id],
  );

  useInput((input, key) => {
    if (selected) {
      if (key.escape || input === "b") setSelected(null);
    } else if (key.escape || input === "b") {
      onBack();
    }
  });

  if (selected) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{selected.question}</Text>
        <Text dimColor>
          YES {cents(selected.yesPrice)} · NO {cents(selected.noPrice)} · {selected.id.slice(0, 24)}
        </Text>
        {book.loading ? (
          <Text>
            <Spinner type="dots" /> loading book…
          </Text>
        ) : book.error ? (
          <Text color="red">{book.error}</Text>
        ) : book.data ? (
          <BookView ob={book.data} />
        ) : null}
        <Box marginTop={1}>
          <Text dimColor>press b / esc to go back to the list</Text>
        </Box>
      </Box>
    );
  }

  const items = (list.data ?? []).map((m) => ({
    label: `${cents(m.yesPrice).padStart(4)}  ${m.question.slice(0, 56)}`,
    value: m.id,
    key: m.id,
  }));

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>
        Top {ctx.venue} markets {list.loading ? <Spinner type="dots" /> : null}
      </Text>
      {list.error ? (
        <Text color="red">{list.error}</Text>
      ) : (
        <SelectInput
          items={items}
          limit={10}
          onSelect={(it) => setSelected((list.data ?? []).find((m) => m.id === it.value) ?? null)}
        />
      )}
      <Box marginTop={1}>
        <Text dimColor>↑↓ select · enter for orderbook · esc back · (search: `sportsxon markets --q`)</Text>
      </Box>
    </Box>
  );
}
