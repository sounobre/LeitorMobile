import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const apiSource = readFileSync(new URL('./src/api.ts', import.meta.url), 'utf8');

assert.match(apiSource, /async function requestNullable<[^>]+>\(/, 'api.ts must define an explicit nullable response helper.');
assert.match(apiSource, /return requestNullable<LexiconJob>\(/, 'getBookLexiconJob must use the nullable helper.');
assert.match(apiSource, /return requestNullable<LexiconEntry>\(/, 'lookupBookLexicon must use the nullable helper.');
assert.match(apiSource, /if \(!body\.trim\(\)\) return null/, 'nullable helper must map an empty successful body to null.');

const requestStart = apiSource.indexOf('async function request<T>');
const nullableStart = apiSource.indexOf('async function requestNullable<T>');
assert.ok(requestStart >= 0 && nullableStart > requestStart, 'request helpers must have an explicit order.');
const strictRequestSource = apiSource.slice(requestStart, nullableStart);
assert.doesNotMatch(strictRequestSource, /!body\.trim\(\).*return null/, 'generic request must not silently accept empty success bodies.');

console.log('nullable-api-response.test.mjs: ok');
