import * as fs from 'fs';
import * as path from 'node:path';
import settings from './settings.js'
import { DELETE_SAFE_WORD, ParseError, RequestToPrTarget, ServerError, type DeleteFormat, type EntryFormat, type FileEntry, type Id, type PrTarget, type TargetFormat } from './types.js';
import { fail } from 'node:assert';
import { rejects } from 'assert';
import { deflateRaw } from 'zlib';

export async function createPrometheusTarget(entryList: Array<EntryFormat>): Promise<Object>{

    
    // console.log(generateJsonFromTargetList(targetList));// [debug]
    // console.log(readTargetDirectory());// [debug]
    var targetList = entryList.filter((e)=>e.type=="Target") as TargetFormat[];
    var deleteList = entryList.filter((e)=>e.type=="Delete") as DeleteFormat[];

    var nuovi: number = 0;
    var sovrascritti: number = 0;
    var cancellati: number = 0;

    var newtargets = generateJsonFromTargetList(targetList);
    var existTargets = readTargetDirectory().map((f)=>{
        return f.name.split(".json")[0]!;
    });

    newtargets.forEach(tar => {
        if(existTargets.includes(tar.id)){
            sovrascritti++;
        }else{
            nuovi++;
        }
    });
    deleteList.forEach(del => {
        if(existTargets.includes(del.id)){
            cancellati++;
        }
    })

    var delPromises = deleteList.map(dr=>{
        return {
            id: dr.id,
            promise: deleteTarget(dr),
        }
    })
    var addPromises = newtargets.map((fe)=>{
        return {
            id: fe.id,
            promise: writeTargetToDirectory(fe),
        }
    })
    var resultsDelPromises = Promise.allSettled(delPromises.map(p=>p.promise));
    var resultsAddPromises = Promise.allSettled(addPromises.map(p=>p.promise));
    var resultsDel = await resultsDelPromises;
    var resultsAdd = await resultsAddPromises;
    
    var fails: Array<string> = [];

    resultsDel.forEach((res, index)=>{
        if(res.status === "rejected"){
            var id = delPromises.at(index)?.id;
            fails.push(`Failed to remove the [id:${id}] target: ${res.reason}`)
        }
    })
    resultsAdd.forEach((res, index)=>{
        if(res.status === "rejected"){
            var id = addPromises.at(index)?.id;
            fails.push(`Failed to add the [id:${id}] target: ${res.reason}`)
        }
    })


    if(fails.length>0){
        console.log("Fails: "+fails)
        return {
            "status": "ERR",
            "error":"Failed to add/delete some targets",
            "reasons":fails,
        };
    }
    return {
            "status": "OK",
            "message":`${nuovi} new target added, ${sovrascritti} updated targets`,
        };
}


function generateJsonFromTargetList(targets: Array<TargetFormat>): Array<FileEntry>{ 
    return targets.map((tar)=>{
        return {
            id: tar.id,
            content: JSON.stringify(RequestToPrTarget(tar))// per ora basta stringify, il filtraggio targets non validi è fatto nella porzione express
        } as FileEntry
    })
}

function readTargetDirectory() {
  try {
    var files = fs.readdirSync(settings.TARGETS_DIR, {withFileTypes:true, recursive:false});
    files = files.filter((f)=>{
        return f.isFile() && f.name.endsWith(".json"); // filtra solo file .json
    })
    return files;
  } catch (err: any) {
    throw new ServerError(err?.message);// rilancio dell'errore con classe custom
  }
}

async function writeTargetToDirectory(fileEntry: FileEntry): Promise<Id> {
    var path = getAbsolutePathById(fileEntry.id);
    fs.writeFileSync(path, fileEntry.content, {flag:"w+"})//w+ sovrascrive file già presenti.
    return fileEntry.id;  
}

function getAbsolutePathById(id: string): string{
    if(!/^[a-zA-Z0-9]+$/.test(id)){// id deve essere solo alfanumerico, altrimenti blocco con un throw per evitare giochetti con il path
        throw new ParseError(`Invalid ID: ${id}`);
    }
    var absPath = path.resolve(settings.TARGETS_DIR, id+".json");
    return absPath;
}

async function deleteTarget(delReq: DeleteFormat): Promise<Id> {
    if(!DELETE_SAFE_WORD.match(delReq.delete)) //secondo controllo della safeword.
        throw new ParseError(`Target id: ${delReq.id}  delete request is malformed, delete field should be '${DELETE_SAFE_WORD}`) 
    var path = getAbsolutePathById(delReq.id);
    fs.unlinkSync(path)//unlink è cancella
    return delReq.id;
}
