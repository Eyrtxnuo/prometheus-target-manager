import express, { type Request, type Response, type NextFunction } from 'express';
import settings from './settings.js'
import { DELETE_SAFE_WORD, ParseError, type DeleteFormat, type EntryFormat, type TargetFormat } from './types.js';
import { createPrometheusTargets, createSingleTarget, deleteTargetById, readTargetById } from './target-manager.js';

const app = express();
const PORT = settings.PORT;

// Middleware che forza gli header per rispondere in JSON
app.use((req: Request, res: Response, next: NextFunction) => {
  res.type('json');
  next();
})
app.use(express.json()); // Middleware Parser JSON
app.use(express.urlencoded()); // Middleware Parser url, per /target/:id

// Route radice, risponde un messaggio fisso per dimostrare che è funzionante
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hi' });
});

/** Route getter dei target
 * usa il segmento :id come identificativo alfanumerico per leggere il target, ritorna il contenuto puro del file json.
 * (il file json è un array di oggetti, e avrà sempre un solo elemento)
 */
app.get('/target/:id', async (req: Request, res: Response) => {
  var id = req.params.id;
  if (typeof id !== "string") throw new ParseError("Id needs to be a string");
  res.send(await readTargetById(id));
});

/** Route per aggiungere un target
 * Il body della richiesta deve essere un target di prometheus (formato json dei file_sd_config) singolo.
 * NON deve essere in un array. L'oggetto della richiesta deve avere:
 * {
 *    "id":"alfanumerico",
 *    "targets" : [
 *          "array di endpoint",
 *          "devono essere stringhe",
 *          "necessita almeno un endpoint"
 *    ],
 *    "labels" : {
 *        "deve esistere":"ma può essere un oggetto vuoto{}",
 *        "accetta solo":"stringhe",
 *        "supporta le":"meta label",
 *        "__metrics_path__": "/esempio/per/cambiare/path"
 *    },
 *    "qualunque altro campo":"verrà ignorato e non aggiunto al file JSON"
 * }
 * inviare un id già usato comporterà la sovrascrittura del target vecchio.
 */
app.post('/target/', async (req: Request, res: Response) => {
  var entry = parseTargetEntry(req.body);
  if(entry.type == "Delete" || entry.type !== "Target"){
    throw new ParseError("Parse exception");
  }
  createSingleTarget(entry as TargetFormat);
  res.send('{"status": "Ok", "message":"Target created succesfully"}');
});

/** Route delete dei target
 * usa il segmento :id come identificativo alfanumerico per cancellare il target.
 */
app.delete('/target/:id', async (req: Request, res: Response) => {
  var id = req.params.id;
  if (typeof id !== "string") throw new ParseError("Id needs to be a string");
  deleteTargetById(id);
  res.send('{"status": "Ok", "message":"Target deleted succesfully"}');
});

/** Route per gestire più target in una sola richiesta.
 * Il body della richiesta deve essere un array json [], e può contenere oggetti di due tipi:
 * 1 - vedere POST /target/, aggiunta o sovrascrittura di un target.
 * 2 - oggetto eliminazione: 
 * {
 *    "id":"da eliminare",
 *    "delete":"ConfirmDeletion"
 * }
 * "delete" deve contenere quella esatta stringa, altrimenti viene ignorata la richiesta.
 */
app.post('/targets/multi', async (req: Request, res: Response) => {

  let targets = parseCreationRequest(req.body);

  // TODO: manda target parsati alla funzione di creazione target.
  var msg = await createPrometheusTargets(targets);

  res.status(201).json(msg);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ParseError) {
    res.status(400).send({ "status": "ERR", "error": `[${err.name}] ${err.message}` });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).send('{"status": "ERR", "error":"Invalid body"}');
    return;
  }
  console.error(err.stack);
  res.status(500).send('{"status": "ERR", "error":"Server Error"}');
});

// Override dell'errore 404 in HTML di default
app.use((req, res) => {
  res.status(404).json({
    "status": "ERR",
    "error": `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`[server]: Server in esecuzione su http://localhost:${PORT}`);
});


// Funzione che prende il body dell'endpoint /targets/multi, ne verifica la validità, e trasforma in array di entry validi da essere eseguiti.
function parseCreationRequest(body: unknown): Array<EntryFormat> {
  if (!Array.isArray(body)) {
    throw new ParseError("The body is not a valid JSON array")
  }

  let parsedTargets = body.map((element, index) => {
    try {
      return parseTargetEntry(element);
    } catch (error: any) {
      if (error instanceof ParseError) {
        error.message = `Target[${index}] ` + error.message;
      }
      throw error;// modifica il messaggio di errore e rilancia 
    }

  });

  if (parsedTargets.length < 1) {
    throw new ParseError("No target specified")
  }

  return parsedTargets;
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

function isRecordAllStrings(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return (
    (proto === null || proto === Object.prototype) &&
    Object.values(value).every(item => typeof item === 'string')
  );
}


// Funzione  che fa il parsing della singola entry dell'array di /targets/multi, oppure del body di POST /target, ne verifica la validità, e genera un oggetto TargetFormat o DeleteFormat in base al tipo di body.
// Attenzione, mandare DeleteFormat a POST /target non è valido e viene considerato sintassi errata.
function parseTargetEntry(element: Object): EntryFormat {
  if (!isRecord(element)) {
    throw new ParseError(`Is not an object`)
  }

  if (element.id === null || element.id === undefined || typeof element.id !== 'string' || element.id === "") { // non controllo id duplicato, un id già esistente farà update/override
    throw new ParseError(`Has invalid id`)
  }
  //////////////controllo per DeleteFormat
  if (element.delete !== null && element.delete !== undefined) {
    if (typeof element.delete == 'string' && DELETE_SAFE_WORD.match(element.delete)) { // se delete ha il testo sbagliato o non è stringa, considero come formato errato dei dati
      return {
        id: element.id,
        type: "Delete",
        delete: element.delete,
      } as DeleteFormat;
    } else {
      throw new ParseError(`Delete request is malformed, delete field should be '${DELETE_SAFE_WORD}'`);
    }
  }
  ////////////////////////////////////////

  if (!Array.isArray(element.targets) ||
    !element.targets.every(target => typeof target === 'string')
  ) {
    throw new ParseError(`Has invalid target urls`)
  }
  if (element.targets.length === 0) {
    throw new ParseError(`Has no target specified`)
  }

  if (!isRecordAllStrings(element.labels)) {
    throw new ParseError(`Has non-string labels`)
  }

  return {
    id: element.id,
    type: "Target",
    targets: element.targets,
    labels: element.labels,
  } as TargetFormat;
}

