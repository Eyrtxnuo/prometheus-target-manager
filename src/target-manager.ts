import settings from './settings.js'
import type { PrTarget } from './types.js';

export function createPrometheusTarget(targetList: Array<PrTarget>){
    
    generateJsonFromTargetList(targetList);


}


function generateJsonFromTargetList(targets: Array<PrTarget>){
    return JSON.stringify(targets);// per ora basta stringify, il filtraggio targets non validi è fatto nella porzione express
}