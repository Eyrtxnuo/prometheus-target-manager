export class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}

export class ServerError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ServerError";
  }
}


export type Id = string;
type EntryHeader = {id: Id, type: "Target" | "Delete"};

export type TargetFormat = EntryHeader & PrTarget;
export type DeleteFormat = EntryHeader & {delete:string};
export type EntryFormat = TargetFormat | DeleteFormat;

export type PrTarget = {
    targets: string[],
    labels: Record<string, string>,
}

export type FileEntry = {
  id: Id,
  content: string
}



export function RequestToPrTarget(RequestFormat: TargetFormat): PrTarget{
     return {
      targets: RequestFormat.targets,
      labels: RequestFormat.labels,
    };
}


export const DELETE_SAFE_WORD = "ConfirmDeletion";