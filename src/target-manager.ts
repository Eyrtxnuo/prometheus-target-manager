import * as fs from 'fs';
import settings from './settings.js'
import { RequestToPrTarget, ServerError, type FileEntry, type PrTarget, type RequestFormat } from './types.js';

export function createPrometheusTarget(targetList: Array<RequestFormat>){
    
    console.log(generateJsonFromTargetList(targetList));// [debug]
    console.log(readTargetDirectory());// [debug]


    


}


function generateJsonFromTargetList(targets: Array<RequestFormat>): Array<FileEntry>{ 
    return targets.map((tar)=>{
        return {
            id: tar.id,
            content: JSON.stringify(RequestToPrTarget(tar))// per ora basta stringify, il filtraggio targets non validi è fatto nella porzione express
        } as FileEntry
    })
    throw new Error("uninplemented");
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