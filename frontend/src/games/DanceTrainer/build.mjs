import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
await build({entryPoints:[path.join(root,'src/main.jsx')],bundle:true,minify:true,format:'esm',jsx:'automatic',outfile:path.resolve(root,'../../../../public/games/DanceTrainer/dance.js')});
