import * as fs from 'fs';
import * as path from 'node:path';
import settings from './settings.js'
import { DELETE_SAFE_WORD, ParseError, RequestToPrTarget, ServerError, type DeleteFormat, type EntryFormat, type FileEntry, type Id, type PrTarget, type TargetFormat } from './types.js';

/** Funzione che esegue l'elenco di richieste di aggiunta/modifica o cancellazione di target.
 * 
 * @param entryList elenco di azioni parsate in formato EntryFormat.
 * @returns l'oggetto da mandare come risposta alla richiesta web, da passare a JSON.stringify o a res.json();
 */
export async function createPrometheusTargets(entryList: Array<EntryFormat>): Promise<Object> {

    var targetList = entryList.filter((e) => e.type == "Target") as TargetFormat[];
    var deleteList = entryList.filter((e) => e.type == "Delete") as DeleteFormat[];

    var nuovi: number = 0;
    var sovrascritti: number = 0;
    var cancellati: number = 0;

    var newtargets = generateJsonFromTargetList(targetList);
    var existTargets = readTargetDirectory().map((f) => {
        return f.name.split(".json")[0]!;
    });

    newtargets.forEach(tar => {
        if (existTargets.includes(tar.id)) {
            sovrascritti++;
        } else {
            nuovi++;
        }
    });
    deleteList.forEach(del => {
        if (existTargets.includes(del.id)) {
            cancellati++;
        }
    })

    var delPromises = deleteList.map(dr => {
        return {
            id: dr.id,
            promise: deleteTarget(dr),
        }
    })
    var addPromises = newtargets.map((fe) => {
        return {
            id: fe.id,
            promise: writeTargetToDirectory(fe),
        }
    })
    var resultsDelPromises = Promise.allSettled(delPromises.map(p => p.promise));
    var resultsAddPromises = Promise.allSettled(addPromises.map(p => p.promise));
    var resultsDel = await resultsDelPromises;
    var resultsAdd = await resultsAddPromises;

    var fails: Array<string> = [];

    resultsDel.forEach((res, index) => {
        if (res.status === "rejected") {
            var id = delPromises.at(index)?.id;
            fails.push(`Failed to remove the [id:${id}] target: ${res.reason}`)
        }
    })
    resultsAdd.forEach((res, index) => {
        if (res.status === "rejected") {
            var id = addPromises.at(index)?.id;
            fails.push(`Failed to add the [id:${id}] target: ${res.reason}`)
        }
    })


    if (fails.length > 0) {
        console.log("Fails: " + fails)
        return {
            "status": "ERR",
            "error": "Failed to add/delete some targets",
            "reasons": fails,
        };
    }
    return {
        "status": "OK",
        "message": `${nuovi} new target added, ${sovrascritti} updated targets, ${cancellati} deleted targets`,
    };
}

/** Funzione che scrive il file JSON di un target nella cartella. 
 * 
 * @param target Oggetto contenente le informazioni del target
 */
export function createSingleTarget(target: TargetFormat) {
    var fe = generateJsonFromTargetList([target]);
    if (fe == undefined || fe.length != 1 || fe[0] == undefined) throw new ParseError("Failed to generate JSON for target")
    writeTargetToDirectory(fe[0]);
}

/** Funzione che genera il contenuto da mettere nei file JSON per ogni target richiesto. Inserisce solo i field targets e labels.
 * 
 * @param targets array di target richiesti
 * @returns array di file entry, cioè un oggetto contenente id del target e il suo JSON.
 */
function generateJsonFromTargetList(targets: Array<TargetFormat>): Array<FileEntry> {
    return targets.map((tar) => {
        return {
            id: tar.id,
            content: JSON.stringify([RequestToPrTarget(tar)])// per ora basta stringify, il filtraggio targets non validi è fatto nella porzione express
        } as FileEntry
    })
}

/** Funzione per leggere l'elenco dei target presenti.
 * Legge la cartella e ritorna tutti gli id(nome senza estensione) dei file json contenuti.
 * @returns array di "directory entry"
 */
function readTargetDirectory(): fs.Dirent<string>[] {
    try {
        var files = fs.readdirSync(settings.TARGETS_DIR, { withFileTypes: true, recursive: false });
        files = files.filter((f) => {
            return f.isFile() && f.name.endsWith(".json"); // filtra solo file .json
        })
        return files;
    } catch (err: any) {
        throw new ServerError(err?.message);// rilancio dell'errore con classe custom
    }
}

/** Funzione che si occupa di scrivere il target json nella cartella di destinazione.
 * Utilizza la tecnica della atomic rename per evitare letture di file parzialmente scritti a prometheus.
 * @param fileEntry entry del file, contiene id (usato per generare il nome del file) e JSON pregenerato.
 * @returns l'id del file, se la scrittura e rename sono andate senza problemi, altrimenti lancia l'eccezione
 */
async function writeTargetToDirectory(fileEntry: FileEntry): Promise<Id> {
    var path = getAbsolutePathById(fileEntry.id);
    var tempPath = path + ".tmp";
    fs.writeFileSync(tempPath, fileEntry.content, { flag: "w+" })//w+ sovrascrive file già presenti.
    fs.renameSync(tempPath, path);
    return fileEntry.id;
}

/**  Funzione che legge il contenuto del file del target id
 * 
 * @param id id del target da leggere
 * @returns contenuto del file o json di errore se il file non esiste.
 */
export async function readTargetById(id: Id): Promise<string> {
    var path = getAbsolutePathById(id);
    if (!fs.existsSync(path)) {
        return JSON.stringify(
            {
                "status": "ERR",
                "error": "Target not found",
            });
    }
    var buffer = fs.readFileSync(path);
    return (new String(buffer)).toString();
}

/** Funzione per ottenere il path dall'id di un target. filtra qualunque id non sia alfanumerico per sicurezza
 * 
 * @param id Id del target di cui si vuole ottenere il path 
 * @returns path sotto forma di string
 */
function getAbsolutePathById(id: Id): string {
    if (!/^[a-zA-Z0-9]+$/.test(id)) {// id deve essere solo alfanumerico, altrimenti blocco con un throw per evitare giochetti con il path
        throw new ParseError(`Invalid ID: ${id}`);
    }
    var absPath = path.resolve(settings.TARGETS_DIR, id + ".json");
    return absPath;
}

/** Funzione che verifica che la richiesta di eliminazione è vailda, se si chiama la funzione che cancella il file. 
 * 
 * @param delReq richiesta (DeleteFormat) di cancellazione
 * @returns Id se tutto è andato liscio, altrimenti throw
 */
async function deleteTarget(delReq: DeleteFormat): Promise<Id> {
    if (!DELETE_SAFE_WORD.match(delReq.delete)) //secondo controllo della safeword.
        throw new ParseError(`Target id: ${delReq.id}  delete request is malformed, delete field should be '${DELETE_SAFE_WORD}`)
    return deleteTargetById(delReq.id);
}

/** Funzione che cancella il file associato al target con id passato.
 * 
 * @param id id del target da eliminare
 * @returns Id se tutto è andato liscio, altrimenti throw
 */
export async function deleteTargetById(id: Id): Promise<Id> {
    var path = getAbsolutePathById(id);
    fs.unlinkSync(path)//unlink è cancella
    return id;
}