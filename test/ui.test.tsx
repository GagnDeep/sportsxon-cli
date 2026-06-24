import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../src/ui/App";
import type { RunContext } from "../src/context";

// A localhost:9 base URL makes the live fetch fail fast (caught by useAsync), so
// the tests never depend on the network.
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

const tick = () => new Promise((r) => setTimeout(r, 40));

describe("Ink App", () => {
  it("renders the brand, the tab strip and the home dashboard", async () => {
    const { lastFrame, unmount } = render(<App ctx={ctx} />);
    await tick();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("sportsxon");
    expect(frame).toContain("Home");
    expect(frame).toContain("Live");
    expect(frame).toContain("Markets");
    expect(frame).toContain("Portfolio");
    expect(frame).toContain("Quant");
    expect(frame).toContain("Paper account");
    expect(frame).toContain("Quick actions");
    unmount();
  });

  it("switches to the Quant tab and computes Kelly live", async () => {
    const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
    await tick();
    stdin.write("5"); // jump to Quant
    await tick();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Quant lab");
    expect(frame).toContain("Kelly");
    expect(frame).toContain("Result");
    unmount();
  });

  it("shows the help overlay on '?'", async () => {
    const { lastFrame, stdin, unmount } = render(<App ctx={ctx} />);
    await tick();
    stdin.write("?");
    await tick();
    expect(lastFrame() ?? "").toContain("keyboard reference");
    unmount();
  });
});
