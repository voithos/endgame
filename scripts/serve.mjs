import * as esbuild from 'esbuild';
import {join} from 'node:path';

import {APP_OPTIONS, DIST_DIRECTORY, PUBLIC_DIRECTORY} from './build.mjs';

const HOST = 'localhost';
const DEFAULT_PORT = 3000;
const preview = process.argv.includes('--preview');
const directory = preview ? DIST_DIRECTORY : PUBLIC_DIRECTORY;

// Preview serves existing files; development also builds the app bundle.
// esbuild's own serve banner is silenced since it lists 127.0.0.1, which
// Firebase Auth does not authorize by default.
const context = await esbuild.context({
    ...(preview ? {write: false} : {
        ...APP_OPTIONS,
        outfile: join(PUBLIC_DIRECTORY, 'js/endgame.js'),
        sourcemap: true
    }),
    logLevel: 'warning'
});
if (!preview) {
    await context.watch();
}

const {port} = await context.serve({
    servedir: directory,
    host: HOST,
    port: Number(process.env.PORT || DEFAULT_PORT)
});
console.log(`Serving ${directory} at http://${HOST}:${port}/`);
console.log('Refresh the browser after changes. Press Ctrl+C to stop.');
