import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerSource = readFileSync(new URL('./src/EpubReader.tsx', import.meta.url), 'utf8');

assert.match(readerSource, /entry\.lemma/, 'A mensagem do dicionário deve usar o campo lemma retornado pela API.');
assert.doesNotMatch(readerSource, /first\.term|entry\.term/, 'A mensagem do dicionário não deve usar o campo inexistente term.');

console.log('lexicon-lookup.test.mjs: ok');
