// Upstream's endpoint migration is not yet in npm's 2.0.8 build.
// https://github.com/Migushthe2nd/MsEdgeTTS/blob/master/src/MsEdgeTTS.ts
// Remove this compatibility patch once a published release includes it.
import {readFile,writeFile} from 'node:fs/promises';
const file=new URL('../node_modules/msedge-tts/dist/MsEdgeTTS.js',import.meta.url);
let source=await readFile(file,'utf8');
const old='wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const current='wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
if(source.includes(old)){
 if(!source.includes('?TrustedClientToken=${this.TRUSTED_CLIENT_TOKEN}'))throw new Error('Edge TTS client changed: review upstream compatibility patch.');
 source=source.replace(old,current).replace('?TrustedClientToken=${this.TRUSTED_CLIENT_TOKEN}','?Ocp-Apim-Subscription-Key=${this.TRUSTED_CLIENT_TOKEN}');
 await writeFile(file,source);
}else if(!source.includes(current))throw new Error('Unknown Edge TTS endpoint; review upstream client.');
