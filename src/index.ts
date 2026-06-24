import { buildProgram } from "./cli";

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });
  try {
    await program.parseAsync(argv);
  } catch (e) {
    // commander throws on parse/usage errors; it has already printed help.
    process.stderr.write(`${(e as Error)?.message ?? String(e)}\n`);
    process.exitCode = process.exitCode || 2;
  }
}

main();
