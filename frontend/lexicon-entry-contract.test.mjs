import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync(new URL('./src/BookProcessingDetailsModal.tsx', import.meta.url), 'utf8');

assert.match(modalSource, /senses\[0\]\?\.translationPtBr/, 'O modal deve ler a tradução no campo retornado pelo backend.');
assert.doesNotMatch(modalSource, /senses\[0\]\?\.translation\b/, 'O modal não deve usar o campo inexistente translation.');
assert.match(modalSource, /currentEntry\?\.bookFrequency/, 'O modal deve ler a frequência no campo bookFrequency.');
assert.doesNotMatch(modalSource, /currentEntry\?\.frequency\b/, 'O modal deve usar a frequência do livro retornada pelo backend.');

console.log('lexicon-entry-contract.test.mjs: ok');
