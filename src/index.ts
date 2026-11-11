import express, { type Request, type Response, type NextFunction } from 'express';
import settings from './settings.js'
import { DELETE_SAFE_WORD, ParseError, type DeleteFormat, type EntryFormat, type TargetFormat } from './types.js';
import { createPrometheusTarget, readTargetById } from './target-manager.js';

const app = express();
const PORT = settings.PORT;

app.use((req: Request, res: Response, next: NextFunction) => {
  res.type('json');
  next();
})
app.use(express.json());
app.use(express.urlencoded());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hi' });
});

app.get('/target/:id', async (req: Request, res: Response) => {
  var id = req.params.id;
  if(typeof id !== "string") throw new ParseError("Id needs to be a string");
  res.send(await readTargetById(id));
});

app.post('/targets/multi', async (req: Request, res: Response) => {

  let targets = parseCreationRequest(req.body);

  // TODO: manda target parsati alla funzione di creazione target.
  var msg = await createPrometheusTarget(targets);

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

app.use((req, res) => {
  res.status(404).json({ 
    "status": "ERR",
    "error": `Cannot ${req.method} ${req.originalUrl}`,
  });
});

app.listen(PORT, () => {
  console.log(`[server]: Server in esecuzione su http://localhost:${PORT}`);
});



function parseCreationRequest(body: unknown): Array<EntryFormat> {
  if (!Array.isArray(body)) {
    throw new ParseError("The body is not a valid JSON array")
  }

  let parsedTargets = body.map((element, index) => {
    if (!isRecord(element)) {
      throw new ParseError(`Target[${index}] is not an object`)
    }

    if (element.id === null || element.id === undefined || typeof element.id !== 'string' || element.id === "") { // non controllo id duplicato, un id già esistente farà update/override
      throw new ParseError(`Target[${index}] has invalid id`)
    }
    //////////////controllo per DeleteFormat
    if (element.delete !== null && element.delete !== undefined) {
      if (typeof element.delete == 'string' && DELETE_SAFE_WORD.match(element.delete)) { // se delete ha il testo sbagliato o non è stringa, considero come formato errato dei dati
        return {
          id: element.id,
          type: "Delete",
          delete:element.delete,
        } as DeleteFormat;
      }else{
        throw new ParseError(`Target[${index}] delete request is malformed, delete field should be '${DELETE_SAFE_WORD}'`);
      }
    }
    ////////////////////////////////////////

    if (!Array.isArray(element.targets) ||
      !element.targets.every(target => typeof target === 'string')
    ) {
      throw new ParseError(`Target[${index}] has invalid target urls`)
    }
    if (element.targets.length === 0) {
      throw new ParseError(`Target[${index}] has no target specified`)
    }

    if (!isRecordAllStrings(element.labels)) {
      throw new ParseError(`Target[${index}] has non-string labels`)
    }

    return {
      id: element.id,
      type: "Target",
      targets: element.targets,
      labels: element.labels,
    } as TargetFormat;
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

