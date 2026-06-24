import React from "react";
import type { RunContext } from "../context";

/**
 * Lazily boot the Ink TUI. This module (and Ink/React) is only ever imported in
 * interactive mode, so headless/agent invocations never load React or touch
 * terminal raw-mode.
 */
export async function launchTui(ctx: RunContext): Promise<void> {
  const { render } = await import("ink");
  const { App } = await import("./App");
  const instance = render(React.createElement(App, { ctx }));
  await instance.waitUntilExit();
}
