/**
 * Classe di errore custom. express fa rendering dell'errore custom.
 * Viene lanciato in tutti i casi la richiesta non è valida
 */
export class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Classe di errore custom. express fa rendering dell'errore custom.
 * Viene lanciato quando avviene una eccezione nell'esecuzione della richiesta o quando c'è una situazione non gestibile.
 */
export class ServerError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ServerError";
  }
}

/**
 * Tipo per l'id, semplicemente un alias di string
 */
export type Id = string;

/**
 * Header per gli entry che express passa al target-manager.ts, obbligatori id e type della richiesta
 */
type EntryHeader = {id: Id, type: "Target" | "Delete"};

/**
 * Formato di una richiesta di aggiunta/aggiornamento di un target, contiene l'header e i campi del target JSON
 */
export type TargetFormat = EntryHeader & PrTarget;
/**
 * Formato di una richiesta di cancellazione di un target, contiene l'header e "delete", che deve contenere DELETE_SAFE_WORD
 */
export type DeleteFormat = EntryHeader & {delete:string};

/**
 * Contenitore per entrambi i tipi di richiesta
 */
export type EntryFormat = TargetFormat | DeleteFormat;

/**
 * "struct" equivalente ai field di un target prometheus in JSON
 */
export type PrTarget = {
    targets: string[],
    labels: Record<string, string>,
}

/**
 * Entry utilizzata per passare il JSON pregenerato insieme all'id di un target per la creazione.
 */
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