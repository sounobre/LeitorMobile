# Codebase Structure

## Regra de leitura

O repositório raiz contém três aplicações/áreas de execução. A existência de um README é intenção declarada; a finalidade abaixo vem da localização, imports, controllers, rotas e migrations encontrados.

## 1) Mapa de alto nível

| Caminho | Finalidade encontrada | Evidência |
|---------|------------------------|-----------|
| `backend/` | API Spring Boot, persistência PostgreSQL/Flyway, autenticação, ingestão de EPUB, léxico e Ollama | `backend/pom.xml`, `backend/src/main/java/br/com/leitormobile/LeitorBackendApplication.java` |
| `backend/src/main/java/br/com/leitormobile/auth/` | usuário, sessão Bearer, filtro e endpoints de login | `backend/src/main/java/br/com/leitormobile/auth/` |
| `backend/src/main/java/br/com/leitormobile/book/` | livros, upload/abertura de conteúdo e progresso | `backend/src/main/java/br/com/leitormobile/book/BookController.java`, `BookContentService.java` |
| `backend/src/main/java/br/com/leitormobile/card/` | cards relacionados a livros, fila e arquivamento | `backend/src/main/java/br/com/leitormobile/card/CardController.java`, `CardService.java` |
| `backend/src/main/java/br/com/leitormobile/lexicon/` | extração EPUB, tokenização/lematização heurística, catálogo, jobs e lookup do léxico | `backend/src/main/java/br/com/leitormobile/lexicon/` |
| `backend/src/main/java/br/com/leitormobile/ai/` | propriedades, provider Ollama e políticas de contexto/exposição | `backend/src/main/java/br/com/leitormobile/ai/` |
| `backend/src/main/resources/db/migration/` | seis migrations Flyway do schema relacional | `backend/src/main/resources/db/migration/V1__create_library_schema.sql` a `V6__optimize_lexical_lookup.sql` |
| `backend/data/` e `data/` | snapshots/arquivos de dicionário e dados de biblioteca encontrados no workspace | árvore do scan; `backend/README-KAIKKI.md` |
| `frontend/` | SPA web Vite/React/TypeScript | `frontend/package.json`, `frontend/src/main.tsx` |
| `frontend/src/` | estado da aplicação, chamadas HTTP, biblioteca, cards, leitor web e tipos | `frontend/src/App.tsx`, `frontend/src/api.ts` |
| `leitor-epub/app/` | telas e rotas Expo Router: login, biblioteca, cards, leitor e backup | `leitor-epub/app/_layout.tsx` |
| `leitor-epub/src/db/` | migrations e repositório SQLite | `leitor-epub/src/db/migrations.ts`, `repository.ts` |
| `leitor-epub/src/services/` | importação/segurança EPUB, lookup, backup, léxico e sincronização | `leitor-epub/src/services/` |
| `leitor-epub/src/reader/` | superfície do leitor, filesystem adapter, progresso e bridge | `leitor-epub/src/reader/` |
| `leitor-epub/modules/` | módulos Expo nativos Android para ML Kit, Google Translate intent e modo imersivo | `leitor-epub/modules/` |
| `leitor-epub/android/` | projeto Android gerado/autolinking/Gradle | `leitor-epub/android/settings.gradle`, `app/build.gradle` |
| `docs/` | documentação de intenção existente e documentação produzida por esta auditoria | `docs/leitor-inteligente-copyright-aware-ai.md`, `docs/codebase/` |
| `.agents/`, `.github/` | tooling/arquivos auxiliares encontrados; não foram identificados como runtime do produto | árvore do scan |

`target/`, `frontend/dist/`, `node_modules/`, `leitor-epub/.expo/`, `leitor-epub/android/.gradle/` e demais saídas geradas não são tratados como módulos-fonte.

## 2) Entradas

- Runtime backend: `backend/src/main/java/br/com/leitormobile/LeitorBackendApplication.java`, método `main`, iniciado pelo plugin Spring Boot do `backend/pom.xml`.
- API backend: controllers `/api/auth`, `/api/books`, `/api/cards` e `/api/books/{bookId}/lexicon`, em `AuthController.java`, `BookController.java`, `CardController.java` e `LexiconController.java`.
- Runtime web: `frontend/index.html` carrega `frontend/src/main.tsx`; `frontend/vite.config.ts` configura Vite na porta 5173.
- Runtime mobile: `leitor-epub/package.json` define `main: expo-router/entry`; `leitor-epub/app/_layout.tsx` monta providers, SQLite e `AuthGate`.
- Entrada de dados mobile: `leitor-epub/app/index.tsx` chama `importEpub`, e `app/reader/[id].tsx` abre o arquivo local.
- Entrada CLI do catálogo: `backend/scripts/import-kaikki.ps1`, conforme `backend/README-KAIKKI.md`; a importação também pode ser iniciada em startup se `app.dictionary.import-on-startup` estiver configurado, mas essa configuração não aparece nos YAML versionados.
- Entradas secundárias (workers/queues): não há worker ou fila independente; o job de léxico é disparado com `@Async` em `LexiconJobRunnerOptimized.java`.

## 3) Fronteiras de módulos

| Fronteira | Pertence aqui | Não foi encontrado aqui |
|-----------|---------------|--------------------------|
| Controllers HTTP backend | parsing de request, status e delegação para services | regras de persistência detalhadas ou chamadas diretas ao banco fora dos services/repositories |
| Services backend | autenticação, livros, cards, job de léxico e integração AI | `TODO`: não há um contrato formal impedindo lógica de domínio adicional nos services |
| Repositories/migrations backend | acesso JPA/JDBC e schema PostgreSQL | UI ou chamadas de provider externo |
| `leitor-epub/src/services` | casos de uso locais e sincronização HTTP | renderização de componentes |
| `leitor-epub/src/db` | SQL SQLite, mapeamento de rows e snapshots | chamadas HTTP externas |
| `leitor-epub/src/reader` | ponte/engine e estado de leitura | persistência de cards e annotations, que fica nos repositories/telas |
| `frontend/src/api.ts` | transporte HTTP e sessão web | apresentação visual |
| `frontend/src/*.tsx` | telas/estado/apresentação web | acesso SQL direto |

## 4) Organização e nomenclatura

- Backend: pacotes e diretórios em minúsculas (`auth`, `book`, `lexicon`), classes Java em PascalCase (`BookController`, `LexiconJobRunnerOptimized`), migrations em `Vn__descricao.sql`.
- Web: componentes React em PascalCase (`EpubReader.tsx`, `BookProcessingDetailsModal.tsx`); utilitários em camelCase (`bookUpload.ts`, `bookDetails.ts`); testes web no diretório `frontend/` com sufixo `.test.mjs` ou em `src` com `.test.ts`.
- Mobile: telas de rota em `app/` com nomes de rota (`index.tsx`, `cards.tsx`, `reader/[id].tsx`); componentes em PascalCase; services e repositories em camelCase; testes co-localizados com `.test.ts`.
- Alias mobile: `@/*` aponta para `leitor-epub/src/*`, conforme `leitor-epub/tsconfig.json` e `package.json` (`moduleNameMapper` do Jest). O frontend web usa imports relativos e não declara `paths`.

## 5) Evidências

- `backend/src/main/java/br/com/leitormobile/LeitorBackendApplication.java`
- `backend/src/main/java/br/com/leitormobile/*/` controllers e services
- `frontend/index.html`
- `frontend/src/main.tsx`
- `leitor-epub/app/_layout.tsx`
- `leitor-epub/src/db/migrations.ts`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/tsconfig.json`

