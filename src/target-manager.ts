import settings from './settings.js'
import { RequestToPrTarget, type FileEntry, type PrTarget, type RequestFormat } from './types.js';

export function createPrometheusTarget(targetList: Array<RequestFormat>){
    
    console.log(generateJsonFromTargetList(targetList));// [debug]


    


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