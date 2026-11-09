import * as fs from 'fs';
import * as path from 'node:path';
import settings from './settings.js'
import { ParseError, RequestToPrTarget, ServerError, type FileEntry, type PrTarget, type RequestFormat } from './types.js';
import { fail } from 'node:assert';
import { rejects } from 'assert';

export async function createPrometheusTarget(targetList: Array<RequestFormat>): Promise<Object>{
    
    // console.log(generateJsonFromTargetList(targetList));// [debug]
    // console.log(readTargetDirectory());// [debug]

    var nuovi: number = 0;
    var sovrascritti: number = 0;

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
    //writeTargetToDirectory(newtargets[0]!);
    var promises = newtargets.map((fe)=>{
        return writeTargetToDirectory(fe);
    })
    var results = await Promise.allSettled(promises);
    var fails: Array<string> = [];
    results.forEach((res, index)=>{
        if(res.status === "rejected"){
            fails.push(`Failed to add the [${index}] target: ${res.reason}`)
        }
    })


    if(fails.length>0){
        console.log("Fails: "+fails)
        return {
            "status": "ERR",
            "error":"Failed to add some targets",
            "reasons":fails
        };
    }
    return {
            "status": "OK",
            "message":`${nuovi} new target added, ${sovrascritti} updated targets`
        };
}


function generateJsonFromTargetList(targets: Array<RequestFormat>): Array<FileEntry>{ 
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

async function writeTargetToDirectory(fileEntry: FileEntry) {
    var path = getEntryAbsolutePath(fileEntry);
    fs.writeFileSync(path, fileEntry.content, {flag:"w+"})//w+ sovrascrive file già presenti.
    return;
}

function getEntryAbsolutePath(fileEntry:FileEntry): string{
    if(!/^[a-zA-Z0-9]+$/.test(fileEntry.id)){// id deve essere solo alfanumerico, altrimenti blocco con un throw per evitare giochetti con il path
        throw new ParseError(`Invalid ID: ${fileEntry.id}`);
    }
    var absPath = path.resolve(settings.TARGETS_DIR, fileEntry.id+".json");
    return absPath;
}