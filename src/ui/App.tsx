import React, { useState } from "react";
import { Box, useApp, useInput } from "ink";
import type { RunContext } from "../context";
import { Header, Footer } from "./components/Header";
import { Home, type Screen } from "./screens/Home";
import { Live } from "./screens/Live";
import { Markets } from "./screens/Markets";
import { Portfolio } from "./screens/Portfolio";

export function App({ ctx }: { ctx: RunContext }): React.ReactElement {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("home");
  const back = () => setScreen("home");

  useInput((input) => {
    if (screen === "home" && input === "q") exit();
  });

  return (
    <Box flexDirection="column">
      <Header ctx={ctx} screen={screen} />
      {screen === "home" && <Home ctx={ctx} onNavigate={setScreen} onQuit={exit} />}
      {screen === "live" && <Live ctx={ctx} onBack={back} />}
      {screen === "markets" && <Markets ctx={ctx} onBack={back} />}
      {screen === "portfolio" && <Portfolio ctx={ctx} onBack={back} />}
      <Footer hint={screen === "home" ? "↑↓ navigate · enter select · q quit" : "esc / b back"} />
    </Box>
  );
}
