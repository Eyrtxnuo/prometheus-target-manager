import process from 'node:process';
// "singleton" che legge le variabili d'ambiente.
class Settings {  
    public readonly PORT = Number(process.env.PORT) || 9089;
    public readonly TARGETS_DIR = process.env.INTERNAL_TARGETS_DIR ?? '/etc/prometheus/targets';
}
export default new Settings();