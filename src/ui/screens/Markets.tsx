import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import TextInput from "ink-text-input";
import type { ScreenProps } from "../App";
import { marketData } from "../../core/exchanges/factory";
import type { MarketRef, Orderbook } from "../../core/exchanges/types";
import { useAsync } from "../hooks";
import { Panel } from "../components/Panel";
import { DepthRow } from "../components/Bars";
import { VenueBadge } from "../components/Badges";
import { OrderTicket } from "./OrderTicket";
import { cents, compactUsd, clip, glyph } from "../theme";

const PAGE = 12;

export function Markets({ ctx, active, lockNav, setVenue, goTab }: ScreenProps): React.ReactElement {
  const [view, setView] = useState<"list" | "book" | "ticket">("list");
  const [sel, setSel] = useState(0);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(0);

  const list = useAsync(
    () => marketData(ctx.venue).listMarkets({ q: query || undefined, limit: 60 }),
    [ctx.venue, query, manual],
  );
  const markets = list.data ?? [];
  const selected = markets[sel] ?? null;

  const book = useAsync<Orderbook | null>(
    async () => (view !== "list" && selected ? marketData(ctx.venue).getOrderbook(selected.id) : null),
    [view === "list" ? "" : selected?.id, view],
  );

  // Keep selection in range as the list changes.
  useEffect(() => {
    if (sel >= markets.length) setSel(Math.max(0, markets.length - 1));
  }, [markets.length, sel]);

  // Lock global nav while the search field is focused.
  useEffect(() => {
    lockNav(searching);
  }, [searching, lockNav]);

  // ---- list keys ----
  useInput(
    (input, key) => {
      if (key.upArrow) return setSel((s) => Math.max(0, s - 1));
      if (key.downArrow) return setSel((s) => Math.min(markets.length - 1, s + 1));
      if (key.return && selected) return setView("book");
      if (input === "o" && selected) return setView("ticket");
      if (input === "v") return setVenue(ctx.venue === "kalshi" ? "polymarket" : "kalshi");
      if (input === "r") return setManual((n) => n + 1);
      if (input === "/") {
        setDraft(query);
        setSearching(true);
      }
      if (key.escape || input === "b") goTab("home");
    },
    { isActive: active && view === "list" && !searching },
  );

  // ---- search keys ----
  useInput(
    (_input, key) => {
      if (key.escape) {
        setSearching(false);
        setDraft(query);
      }
    },
    { isActive: active && view === "list" && searching },
  );

  // ---- book keys ----
  useInput(
    (input, key) => {
      if (key.escape || input === "b") return setView("list");
      if (input === "o") return setView("ticket");
      if (input === "r") return setManual((n) => n + 1);
    },
    { isActive: active && view === "book" },
  );

  if (view === "ticket" && selected) {
    return (
      <OrderTicket
        ctx={ctx}
        market={selected}
        book={book.data ?? null}
        active={active}
        lockNav={lockNav}
        onClose={() => setView("book")}
        goPortfolio={() => goTab("portfolio")}
      />
    );
  }

  if (view === "book" && selected) {
    return <BookView ctx={ctx} market={selected} book={book.data ?? null} loading={book.loading} error={book.error} />;
  }

  // ---- list view ----
  const start = Math.min(Math.max(0, sel - Math.floor(PAGE / 2)), Math.max(0, markets.length - PAGE));
  const visible = markets.slice(start, start + PAGE);

  return (
    <Panel title="💹 Markets" subtitle={list.loading ? "loading…" : `${markets.length} markets`}>
      <Box marginBottom={1}>
        <VenueBadge venue={ctx.venue} />
        <Text dimColor> · press v to switch · </Text>
        {searching ? (
          <Box>
            <Text color="cyan">/ </Text>
            <TextInput
              value={draft}
              onChange={setDraft}
              focus={searching}
              placeholder="type to search, enter to apply…"
              onSubmit={() => {
                setQuery(draft.trim());
                setSel(0);
                setSearching(false);
              }}
            />
          </Box>
        ) : (
          <Text dimColor>{query ? `filter: "${query}" (/ to edit)` : "/ to search"}</Text>
        )}
      </Box>
      {list.loading && list.loads === 0 ? (
        <Text>
          <Spinner type="dots" /> loading {ctx.venue} markets…
        </Text>
      ) : list.error ? (
        <Text color="red">{list.error}</Text>
      ) : markets.length === 0 ? (
        <Text dimColor>No markets found{query ? ` for "${query}"` : ""}.</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={2} />
            <Box width={5} justifyContent="flex-end">
              <Text bold dimColor>
                YES
              </Text>
            </Box>
            <Box width={5} justifyContent="flex-end" marginRight={1}>
              <Text bold dimColor>
                NO
              </Text>
            </Box>
            <Box width={8} justifyContent="flex-end" marginRight={1}>
              <Text bold dimColor>
                VOL
              </Text>
            </Box>
            <Text bold dimColor>
              MARKET
            </Text>
          </Box>
          {visible.map((m, i) => {
            const idx = start + i;
            const on = idx === sel;
            return (
              <Box key={m.id}>
                <Box width={2}>
                  <Text color="cyan">{on ? glyph.arrowR : " "}</Text>
                </Box>
                <Box width={5} justifyContent="flex-end">
                  <Text color={on ? "black" : "green"} backgroundColor={on ? "cyan" : undefined} bold={on}>
                    {cents(m.yesPrice)}
                  </Text>
                </Box>
                <Box width={5} justifyContent="flex-end" marginRight={1}>
                  <Text color={on ? "black" : "red"} backgroundColor={on ? "cyan" : undefined}>
                    {cents(m.noPrice)}
                  </Text>
                </Box>
                <Box width={8} justifyContent="flex-end" marginRight={1}>
                  <Text dimColor>{compactUsd(m.volumeUsd)}</Text>
                </Box>
                <Text bold={on}>{clip(m.question, 52)}</Text>
              </Box>
            );
          })}
          {markets.length > PAGE ? (
            <Text dimColor>
              {start + 1}–{Math.min(start + PAGE, markets.length)} of {markets.length}
            </Text>
          ) : null}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>↑↓ select · enter orderbook · o order ticket · v venue · / search · r refresh</Text>
      </Box>
    </Panel>
  );
}

function BookView({
  ctx,
  market,
  book,
  loading,
  error,
}: {
  ctx: ScreenProps["ctx"];
  market: MarketRef;
  book: Orderbook | null;
  loading: boolean;
  error?: string;
}): React.ReactElement {
  const bestBid = book?.bids[0]?.price ?? null;
  const bestAsk = book?.asks[0]?.price ?? null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
  const maxSize = book ? Math.max(1, ...book.bids.slice(0, 8).map((l) => l.size), ...book.asks.slice(0, 8).map((l) => l.size)) : 1;

  return (
    <Panel title={`📖 ${clip(market.question, 46)}`} subtitle={ctx.venue}>
      <Box>
        <Box width={18}>
          <Text dimColor>YES </Text>
          <Text color="green" bold>
            {cents(market.yesPrice)}
          </Text>
          <Text dimColor> · NO </Text>
          <Text color="red" bold>
            {cents(market.noPrice)}
          </Text>
        </Box>
        <Text dimColor> vol {compactUsd(market.volumeUsd)}</Text>
        {market.closeTime ? <Text dimColor> · closes {clip(market.closeTime, 16)}</Text> : null}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          mid {cents(mid)} · spread {spread != null ? `${(spread * 100).toFixed(1)}¢` : "—"} · id {clip(market.id, 18)}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Box width={6} justifyContent="flex-end">
            <Text bold dimColor>
              bid
            </Text>
          </Box>
          <Box width={16} justifyContent="center">
            <Text bold color="green">
              depth
            </Text>
          </Box>
          <Box width={12} justifyContent="center">
            <Text bold dimColor>
              price
            </Text>
          </Box>
          <Box width={16} justifyContent="center">
            <Text bold color="red">
              depth
            </Text>
          </Box>
          <Box width={6}>
            <Text bold dimColor>
              {" "}
              ask
            </Text>
          </Box>
        </Box>
        {loading ? (
          <Text>
            <Spinner type="dots" /> loading book…
          </Text>
        ) : error ? (
          <Text color="red">{error}</Text>
        ) : !book ? (
          <Text dimColor>No orderbook.</Text>
        ) : (
          Array.from({ length: Math.min(8, Math.max(book.bids.length, book.asks.length, 1)) }).map((_, i) => {
            const b = book.bids[i];
            const a = book.asks[i];
            return (
              <DepthRow
                key={i}
                bidSize={b?.size}
                bidPrice={b ? cents(b.price) : undefined}
                askSize={a?.size}
                askPrice={a ? cents(a.price) : undefined}
                maxSize={maxSize}
              />
            );
          })
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>o order ticket · r refresh · esc/b back to list</Text>
      </Box>
    </Panel>
  );
}
