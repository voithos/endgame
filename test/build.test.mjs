import assert from 'node:assert/strict';
import {access, mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {Script} from 'node:vm';

import {buildProduction, PUBLIC_DIRECTORY} from '../scripts/build.mjs';

const LOCAL_ASSET_PATTERN = /(?:src|href)="((?!https?:)[^"]+\.(?:js|css))"/g;

test('production build', async t => {
    const output = await mkdtemp(join(tmpdir(), 'endgame-build-'));
    t.after(() => rm(output, {recursive: true, force: true}));
    const {jsPath, cssPath} = await buildProduction(output);

    // Only the generated assets are referenced.
    const html = await readFile(join(output, 'index.html'), 'utf8');
    const localUrls =
        [...html.matchAll(LOCAL_ASSET_PATTERN)].map(match => match[1]);
    assert.deepEqual(localUrls, [cssPath, jsPath]);
    await access(join(output, cssPath));

    // Concatenated scripts form a valid classic script containing the app.
    const js = await readFile(join(output, jsPath), 'utf8');
    new Script(js);
    assert.match(js, /window\.endgame\s*=/);

    // Static assets are copied.
    await access(join(output, 'favicon.ico'));
    assert.deepEqual(
        await readdir(join(output, 'data')),
        await readdir(join(PUBLIC_DIRECTORY, 'data')));
});
