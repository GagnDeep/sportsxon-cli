import readline from "node:readline";

/**
 * Prompt on stderr (so stdout stays clean for JSON) and read one line from
 * stdin. Used only in interactive mode for live-trade confirmations.
 */
export function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Require the user to type an exact phrase to proceed. */
export async function confirmPhrase(expected: string, question: string): Promise<boolean> {
  const answer = await promptLine(question);
  return answer === expected;
}
