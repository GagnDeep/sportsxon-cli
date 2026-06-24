/** MCP protocol versions the Sportsxon server understands. */
export const SUPPORTED_PROTOCOLS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
] as const;

/** We advertise the latest; the stateless server gates features off the header. */
export const CLIENT_PROTOCOL = "2025-11-25";

/** structuredContent is only returned at or above this version. */
export const STRUCTURED_MIN_PROTOCOL = "2025-06-18";
