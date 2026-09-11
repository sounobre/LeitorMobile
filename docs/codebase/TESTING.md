# Testing Patterns

## 1) Stack e comandos

- Backend: JUnit 5/Spring Boot Test/Mockito via `spring-boot-starter-test`; `@SpringBootTest`, `@JdbcTest`, MockMvc e testes unitários aparecem no código.
- Mobile: Jest com preset `jest-expo` e `testMatch` limitado a `<rootDir>/src/**/*.test.ts`.
- Web: cinco scripts `.mjs` usam `node:assert/strict` e `node:fs`; não há script de testes no manifest.

Comandos declarados:

```bash
# backend
cd backend
mvn -q test

# mobile
cd leitor-epub
npm test -- --runInBand
npm run typecheck
npm run lint

# frontend estático, sem script npm declarado
cd frontend
node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs
```

Não foi encontrado comando de coverage ou threshold nos manifests.

## 2) Organização dos testes

- Backend: `backend/src/test/java/br/com/leitormobile/<capacidade>/`, espelhando os pacotes de produção.
- Mobile: testes co-localizados em `leitor-epub/src/db`, `src/services`, `src/reader` e `src/components`.
- Web: testes estáticos na raiz `frontend/`, lendo `src/App.tsx`, `src/EpubReader.tsx`, `src/api.ts` e `src/BookProcessingDetailsModal.tsx`.
- Setup: não foi encontrado `setupTests`, fixture global ou `src/test/resources` configurado. O log Maven indicou que `backend/src/test/resources` não existe.

## 3) Matriz de escopo

| Escopo | Coberto? | Alvo observado | Notas |
|--------|----------|----------------|-------|
| Unitário backend | sim | policies AI, analyzer, services, provider e regras de filesystem | Mockito e asserções JUnit; `BookServiceTest.java`, `ExternalAiContextPolicyTest.java` |
| Integração backend | sim | contexto Spring, schema PostgreSQL, queries JDBC/JPA, segurança MockMvc | execução depende de PostgreSQL local; `SecurityConfigTest.java`, `DatabaseBackedLexicalDictionaryTest.java` |
| Unitário mobile | sim | migrations, repository SQL, segurança/importação EPUB, backup, lookup, progress, lexicon | 10 suítes encontradas pelo Jest |
| Integração mobile nativa | não demonstrado | ML Kit/Expo modules, WebView, filesystem real | `[TODO]` não há suíte instrumentada Android no repositório |
| E2E web | não demonstrado | login/upload/leitor/cards | os testes web inspecionam texto-fonte, não inicializam navegador/backend |
| E2E mobile | não demonstrado | fluxo de importação, leitura, sync e backup em device | roteiro manual em `leitor-epub/docs/QA-ANDROID.md` |
| Carga/performance | não encontrado | `[TODO]` | scan não detectou benchmark/k6/locust/jmeter |

## 4) Mocking e isolamento

- Backend unitário injeta mocks de repositories/services; testes JDBC usam o schema real PostgreSQL e transações de teste (`DatabaseBackedLexicalDictionaryTest.java`).
- `OllamaAiProviderTest` sobe `HttpServer` local em loopback para verificar timeout de leitura.
- Mobile substitui `SQLiteDatabase` por objetos mínimos e usa `jest.fn()`; `migrations.test.ts` simula transações exclusivas; `repository.test.ts` verifica SQL parametrizado.
- Web não mocka rede: os testes estáticos apenas procuram contratos e trechos na fonte.
- Falha comum observada: o lint mobile não passa com as regras atuais, embora typecheck e Jest passem.

## 5) Sinais de qualidade

Execuções desta auditoria:

- `mvn -q test` em `backend/`: passou; o log confirmou Java 21.0.6, PostgreSQL 16.14 e seis migrations válidas.
- `tsc --noEmit` em `frontend/`: passou.
- `tsc --noEmit` em `leitor-epub/`: passou.
- Cinco testes estáticos web com `node --test`: passaram (`5 pass, 0 fail`).
- Jest mobile direto: passou (`10 suites, 41 tests`).
- ESLint mobile direto: falhou com 6 erros e 2 warnings: `app/_layout.tsx:49`, referências em `app/cards.tsx:83,142,144` e variável não usada em `src/services/sync.ts:301`; há também warning em `.expo/types/router.d.ts`.

Coverage atual: `[TODO]` não foi gerado. Threshold: `[TODO]` não configurado.

Gaps funcionais de teste verificáveis: não há teste do endpoint web de upload rejeitando arquivo não-EPUB/DRM/ZIP bomb; não há teste de sync para annotations/bookmarks/preferences; não há teste do fluxo de `ExternalAiContextGateway` persistindo auditoria.

## 6) Evidências

- `backend/pom.xml`
- `backend/src/test/java/br/com/leitormobile/ai/ExternalAiContextPolicyTest.java`
- `backend/src/test/java/br/com/leitormobile/ai/OllamaAiProviderTest.java`
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java`
- `backend/src/test/java/br/com/leitormobile/lexicon/DatabaseBackedLexicalDictionaryTest.java`
- `frontend/package.json`
- `frontend/*test.mjs`
- `leitor-epub/package.json`
- `leitor-epub/src/db/migrations.test.ts`
- `leitor-epub/docs/QA-ANDROID.md`

