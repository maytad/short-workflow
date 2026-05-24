export type TerminalWorkflowFailureOutput = Record<string, unknown>;

export class TerminalWorkflowError extends Error {
  readonly output: TerminalWorkflowFailureOutput;

  constructor(message: string, output: TerminalWorkflowFailureOutput) {
    super(message);
    this.name = "TerminalWorkflowError";
    this.output = output;
  }
}

export function isTerminalWorkflowError(error: unknown): error is TerminalWorkflowError {
  return error instanceof TerminalWorkflowError;
}
