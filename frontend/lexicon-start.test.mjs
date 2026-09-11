import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerSource = readFileSync(new URL('./src/EpubReader.tsx', import.meta.url), 'utf8');
const openSource = readerSource.slice(readerSource.indexOf('async function open()'), readerSource.indexOf("const bytes = await fetchBookFile", readerSource.indexOf('async function open()')));
const appSource = readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('./src/api.ts', import.meta.url), 'utf8');

assert.doesNotMatch(openSource, /startBookLexicon\(/, 'Abrir um livro não deve iniciar o processamento do léxico.');
assert.match(appSource, /startBookLexicon\(book\.id, true\)/, 'O botão de reprocessar deve solicitar um reprocessamento explícito.');
assert.match(apiSource, /startBookLexicon\(bookId: string, force = false\)/, 'A API deve diferenciar início idempotente de reprocessamento forçado.');
assert.match(apiSource, /force \? '\?force=true' : ''/, 'A API deve enviar a flag force somente no reprocessamento.');

console.log('lexicon-start.test.mjs: ok');
