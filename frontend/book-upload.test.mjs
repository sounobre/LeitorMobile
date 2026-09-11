import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8');

assert.match(appSource, /type="file"/i, 'O formulário de livro precisa de um seletor de arquivo.');
assert.match(appSource, /uploadBookContent/, 'O formulário precisa enviar o EPUB para o backend.');

console.log('book-upload.test.mjs: ok');
