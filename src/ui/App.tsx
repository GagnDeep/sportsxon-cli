import React, { useState, useCallback } from "react";
import { Box, useApp, useInput } from "ink";
import type { RunContext } from "../context";
import type { Venue } from "../core/exchanges/types";
import { TopBar, HintBar, TABS, type Tab } from "./components/StatusBar";
import { HelpOverlay } from "./components/HelpOverlay";
import { useClock } from "./hooks";
import { Home } from "./screens/Home";
import { Live } from "./screens/Live";
import { Markets } from "./screens/Markets";
import { Portfolio } from "./screens/Portfolio";
import { Quant } from "./screens/Quant";

export interface ScreenProps {
  ctx: RunContext;
  /** True when this screen owns keyboard focus (its tab is active and no overlay is up). */
  active: boolean;
  /** Children call this to suspend global nav keys while a text input is focused. */
  lockNav: (locked: boolean) => void;
  /** Switch the active trading venue app-wide. */
  setVenue: (v: Venue) => void;
  /** Jump to another tab (e.g. Markets → Portfolio after a trade). */
  goTab: (t: Tab) => void;
}

const HINTS: Record<Tab, string> = {
  home: "↑↓ select · enter open · 1-5 tabs",
  live: "r refresh · auto every 15s · esc home",
  markets: "↑↓ select · enter book · o order · v venue · / search · r refresh",
  portfolio: "↑↓ positions · r refresh · esc home",
  quant: "↑↓ field · type edit · tab tool · enter compute",
};

export function App({ ctx }: { ctx: RunContext }): React.ReactElement {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  const [venue, setVenueState] = useState<Venue>(ctx.venue);
  const [navLocked, setNavLocked] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const clock = useClock();

  const liveCtx: RunContext = { ...ctx, venue };
  const lockNav = useCallback((locked: boolean) => setNavLocked(locked), []);
  const goTab = useCallback((t: Tab) => {
    setNavLocked(false);
    setTab(t);
  }, []);
  const setVenue = useCallback((v: Venue) => setVenueState(v), []);

  // Global navigation. Disabled while a child text input is focused (navLocked),
  // so typing never triggers a tab jump or quit.
  useInput(
    (input, key) => {
      if (showHelp) {
        if (input === "?" || key.escape || input === "q") setShowHelp(false);
        return;
      }
      if (input === "?") return setShowHelp(true);
      if (input === "q") return exit();
      const idx = TABS.findIndex((t) => t.id === tab);
      if (key.tab && key.shift) return goTab(TABS[(idx - 1 + TABS.length) % TABS.length]!.id);
      if (key.tab) return goTab(TABS[(idx + 1) % TABS.length]!.id);
      const numbered = TABS.find((t) => t.key === input);
      if (numbered) goTab(numbered.id);
    },
    { isActive: !navLocked },
  );

  const screenActive = (t: Tab) => tab === t && !showHelp;
  const common = { ctx: liveCtx, lockNav, setVenue, goTab };

  return (
    <Box flexDirection="column">
      <TopBar ctx={liveCtx} active={tab} clock={clock} />
      {showHelp ? (
        <Box paddingX={1} marginTop={1}>
          <HelpOverlay />
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1} paddingX={1}>
          {tab === "home" && <Home {...common} active={screenActive("home")} />}
          {tab === "live" && <Live {...common} active={screenActive("live")} />}
          {tab === "markets" && <Markets {...common} active={screenActive("markets")} />}
          {tab === "portfolio" && <Portfolio {...common} active={screenActive("portfolio")} />}
          {tab === "quant" && <Quant {...common} active={screenActive("quant")} />}
        </Box>
      )}
      <HintBar hints={showHelp ? "help" : HINTS[tab]} />
    </Box>
  );
}
