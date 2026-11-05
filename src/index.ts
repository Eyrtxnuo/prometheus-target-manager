import express, { type Request, type Response, type NextFunction} from 'express';

const app = express();
const PORT = process.env.PORT || 9089;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Hi' });
});


app.post('/targets/create', (req: Request, res: Response) => {

  parseCreationRequest(req.body);
  res.status(201).json({ "end":"a" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if(err instanceof SyntaxError){
    res.status(400).send('{"error":"Invalid body"}');
    return
  }
  console.error(err.stack);
  res.status(500).send('{"error":"Server Error"}');
});

app.listen(PORT, () => {
  console.log(`[server]: Server in esecuzione su http://localhost:${PORT}`);
});



function parseCreationRequest(body: any): Array<PrTarget> {
  let targetObjects = body as Array<PrTarget>;

  if (!Array.isArray(targetObjects)) {
    throw new ParseError("The body is not a valid JSON array")
  }

  targetObjects.forEach(element => {
    if(element.targets == null || !Array.isArray(element.targets))
    {
      throw new ParseError("Parse error")
    }
  });
  console.log('Target ricevuti:', targetObjects);
  throw new Error("Not implemented");
}

class ParseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ParseError";
  }
}

type PrTarget = {
    targets: string[];
    labels: Record<string, string>;
  }