import express, { type Request, type Response, type NextFunction } from 'express';
import settings from './settings.js'
import { ParseError, type RequestFormat } from './types.js';
import { createPrometheusTarget } from './target-manager.js';

const app = express();
const PORT = settings.PORT;

app.use((req: Request, res: Response, next: NextFunction) => {
  res.type('json');
  next();
})
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hi' });
});


app.post('/targets/create', (req: Request, res: Response) => {

  let targets = parseCreationRequest(req.body);

  // TODO: manda target parsati alla funzione di creazione target.
  createPrometheusTarget(targets);
  
  res.status(201).json({ "message": "Ok" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ParseError) {
    res.status(400).send({ "error": `[${err.name}] ${err.message}` });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).send('{"error":"Invalid body"}');
    return;
  }
  console.error(err.stack);
  res.status(500).send('{"error":"Server Error"}');
});

app.listen(PORT, () => {
  console.log(`[server]: Server in esecuzione su http://localhost:${PORT}`);
});



function parseCreationRequest(body: unknown): Array<RequestFormat> {
  if (!Array.isArray(body)) {
    throw new ParseError("The body is not a valid JSON array")
  }

  let parsedTargets = body.map((element, index) => {
    if (!isRecord(element)) {
      throw new ParseError(`Target[${index}] is not an object`)
    }

    if (element.id === null || typeof element.id !== 'string' || element.id === "") { // non controllo id duplicato, un id già esistente farà update/override
      throw new ParseError(`Target[${index}] has invalid id`)
    }
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
      targets: element.targets,
      labels: element.labels,
    };
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

