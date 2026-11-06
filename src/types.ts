export class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}

export type PrTarget = {
  targets: string[];
  labels: Record<string, string>;
}