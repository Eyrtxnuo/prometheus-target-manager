export class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}


export type RequestFormat = {
    id: string,
    targets: string[],
    labels: Record<string, string>
}

export type PrTarget = {
    targets: string[],
    labels: Record<string, string>,
}

export function RequestToPrTarget(RequestFormat: RequestFormat): PrTarget{
     return {
      targets: RequestFormat.targets,
      labels: RequestFormat.labels,
    };
}