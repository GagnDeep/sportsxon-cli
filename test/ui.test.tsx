import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../src/ui/App";
import type { RunContext } from "../src/context";

// A localhost:9 base URL makes the live fetch fail fast (caught by useAsync), so
// the test never depends on the network.
const ctx: RunContext = {
  json: false,
  plain: false,
  color: false,
  interactive: true,
  locale: "en",
  venue: "kalshi",
  baseUrl: "http://127.0.0.1:9",
  yes: false,
};

describe("Ink App", () => {
  it("renders the header and the home menu", () => {
    const { lastFrame, unmount } = render(<App ctx={ctx} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("sportsxon");
    expect(frame).toContain("Live scoreboard");
    expect(frame).toContain("Browse markets");
    expect(frame).toContain("Portfolio");
    unmount();
  });
});
