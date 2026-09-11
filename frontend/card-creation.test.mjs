import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readerSource = readFileSync(new URL('./src/EpubReader.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('./src/api.ts', import.meta.url), 'utf8');
const createCardSource = readerSource.slice(
  readerSource.indexOf('async function handleCreateCard'),
  readerSource.indexOf('\n  return (', readerSource.indexOf('async function handleCreateCard')),
);

assert.match(readerSource, /function lexiconLookupTerm\(selectedText: string\) \{\s*const normalized = selectedText\.trim\(\);\s*return normalized;\s*\}/, 'A consulta lexical deve preservar a seleção inteira, inclusive quando ela for uma frase.');
assert.doesNotMatch(readerSource, /split\(\/\\s\+\/\)\[0\]/, 'A consulta lexical não deve reduzir uma frase à primeira palavra.');
assert.match(createCardSource, /lookupBookLexicon\(book\.id,\s*lexiconLookupTerm\(selection\.text\)\)/, 'A criação do card deve consultar o texto selecionado.');
assert.match(createCardSource, /translation:\s*lexiconTranslation/, 'A criação do card deve enviar a tradução encontrada.');
assert.match(createCardSource, /definition:\s*lexiconDefinition/, 'A criação do card deve enviar a definição encontrada.');
assert.match(apiSource, /translationPtBr:\s*string/, 'O contrato da API deve declarar a tradução retornada pelo backend.');

console.log('card-creation.test.mjs: ok');
