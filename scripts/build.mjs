import * as esbuild from 'esbuild';
import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT_DIRECTORY = fileURLToPath(new URL('../', import.meta.url));
const INDEX_FILE = 'index.html';
const APP_SCRIPT_PATH = 'js/endgame.js';
const BROWSER_TARGET = 'es2015';
const HASH_LENGTH = 10;
const STATIC_ASSETS = ['data', 'favicon.ico'];
const ASSET_BLOCKS = {
    js: /<!-- inject:js -->[\s\S]*?<!-- endinject -->/,
    css: /<!-- inject:css -->[\s\S]*?<!-- endinject -->/
};
const ASSET_PATH_PATTERN = /(?:src|href)="([^"]+)"/g;
const MINIFY_OPTIONS = {
    minify: true,
    legalComments: 'inline'
};

export const PUBLIC_DIRECTORY = join(ROOT_DIRECTORY, 'public');
export const DIST_DIRECTORY = join(ROOT_DIRECTORY, 'dist');
export const APP_OPTIONS = {
    absWorkingDir: ROOT_DIRECTORY,
    entryPoints: ['src/endgame.js'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: BROWSER_TARGET,
    logLevel: 'info'
};

// Read asset paths in their HTML load order.
function assetPaths(html, type) {
    const block = html.match(ASSET_BLOCKS[type]);
    if (!block) {
        throw new Error(`Missing ${type} asset block in public/${INDEX_FILE}`);
    }
    return [...block[0].matchAll(ASSET_PATH_PATTERN)].map(match => match[1]);
}

// Include a content hash in the asset path for cache busting.
function assetPath(code, extension) {
    const hash =
        createHash('sha256').update(code).digest('hex').slice(0, HASH_LENGTH);
    return `${extension}/endgame-${hash}.${extension}`;
}

// Prepare empty output folders.
async function prepareOutputDirectory(outputDirectory) {
    await rm(outputDirectory, {recursive: true, force: true});
    await Promise.all(['js', 'css'].map(
        directory =>
            mkdir(join(outputDirectory, directory), {recursive: true})));
}

// Build production assets and HTML, preserving script load order.
export async function buildProduction(outputDirectory = DIST_DIRECTORY) {
    const html = await readFile(join(PUBLIC_DIRECTORY, INDEX_FILE), 'utf8');
    const scriptPaths = assetPaths(html, 'js');
    const stylePaths = assetPaths(html, 'css');
    if (!scriptPaths.includes(APP_SCRIPT_PATH)) {
        throw new Error(`Missing ${APP_SCRIPT_PATH} in public/${INDEX_FILE}`);
    }

    const appBundle = await esbuild.build({...APP_OPTIONS, write: false});
    const [jsSources, cssSources] = await Promise.all([
        Promise.all(scriptPaths.map(path => {
            if (path === APP_SCRIPT_PATH) {
                return appBundle.outputFiles[0].text;
            }
            return readFile(join(PUBLIC_DIRECTORY, path), 'utf8');
        })),
        Promise.all(stylePaths.map(
            path => readFile(join(PUBLIC_DIRECTORY, path), 'utf8')))
    ]);
    const [js, css] = await Promise.all([
        // Transform without bundling or wrapping so vendor globals stay global.
        esbuild.transform(
            jsSources.join('\n;\n'),
            {...MINIFY_OPTIONS, loader: 'js', target: BROWSER_TARGET}),
        esbuild.transform(
            cssSources.join('\n'), {...MINIFY_OPTIONS, loader: 'css'})
    ]);
    const jsPath = assetPath(js.code, 'js');
    const cssPath = assetPath(css.code, 'css');
    const index =
        html.replace(
                ASSET_BLOCKS.js,
                `<!-- inject:js -->\n        <script src="${
                    jsPath}"></script>\n        <!-- endinject -->`)
            .replace(
                ASSET_BLOCKS.css,
                `<!-- inject:css -->\n        <link rel="stylesheet" href="${
                    cssPath}">\n        <!-- endinject -->`);

    await prepareOutputDirectory(outputDirectory);
    await Promise.all([
        writeFile(join(outputDirectory, jsPath), js.code),
        writeFile(join(outputDirectory, cssPath), css.code),
        writeFile(join(outputDirectory, INDEX_FILE), index),
        ...STATIC_ASSETS.map(
            path =>
                cp(join(PUBLIC_DIRECTORY, path), join(outputDirectory, path),
                   {recursive: true}))
    ]);
    return {jsPath, cssPath};
}

if (process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await buildProduction();
    console.log(`Built ${DIST_DIRECTORY}`);
}
