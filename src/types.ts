export class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}


type Id = string;

export type RequestFormat = PrTarget & {id: Id}

export type PrTarget = {
    targets: string[],
    labels: Record<string, string>,
}

export type FileEntry = {
  id: Id,
  content: string
}



export function RequestToPrTarget(RequestFormat: RequestFormat): PrTarget{
     return {
      targets: RequestFormat.targets,
      labels: RequestFormat.labels,
    };
}