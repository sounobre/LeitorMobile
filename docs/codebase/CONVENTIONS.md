# Coding Conventions

## Nota metodológica

As regras abaixo foram observadas em múltiplos arquivos-fonte e configurações. Onde não existe configuração que imponha uma regra, o texto descreve apenas o padrão observado e marca o desconhecido.

## 1) Nomenclatura

| Item | Regra observada | Exemplo | Evidência |
|------|-----------------|---------|-----------|
| Arquivos Java | PascalCase para tipos; migrations `Vn__snake_description.sql` | `LexiconJobRunnerOptimized.java`, `V3__create_lexicon_schema.sql` | `backend/src/main/java/`, `backend/src/main/resources/db/migration/` |
| Arquivos TS/TSX web | PascalCase para componentes; camelCase para módulos utilitários | `EpubReader.tsx`, `bookUpload.ts` | `frontend/src/` |
| Arquivos TS/TSX mobile | PascalCase para componentes; camelCase para services/repositories; telas de rota em minúsculas | `BookCard.tsx`, `epubImport.ts`, `app/cards.tsx` | `leitor-epub/src/`, `leitor-epub/app/` |
| Métodos/funções | camelCase | `updateReadingPosition`, `lookupPreparedLexicon`, `startBookLexicon` | `leitor-epub/src/db/repository.ts`, `frontend/src/api.ts` |
| Tipos/interfaces | PascalCase; records Java também PascalCase | `LexiconEntry`, `ReaderEngine`, `BookDtos.Response` | `frontend/src/api.ts`, `leitor-epub/src/types/`, `backend/src/main/java/` |
| Constantes | UPPER_SNAKE_CASE para limites e chaves internas | `MAX_EXCERPT_CHARACTERS`, `EPUB_LIMITS` | `backend/src/main/java/br/com/leitormobile/ai/ExternalAiContextPolicy.java`, `leitor-epub/src/services/epubSecurity.ts` |
| Banco/JSON | snake_case em colunas/tabelas; camelCase no DTO/TypeScript | `book_id` ↔ `bookId`, `translation_pt_br` ↔ `translationPtBr` | migrations e `frontend/src/types.ts` |

## 2) Formatação e lint

- Formatter: `[TODO]` Não foi encontrado `.prettierrc`, `prettier.config.*`, Spotless ou configuração equivalente.
- Linter backend: `[TODO]` Não foi encontrado Checkstyle/PMD/Spotless no `pom.xml`.
- Linter web: `[TODO]` Não foi encontrada configuração ESLint no `frontend/`.
- Linter mobile: ESLint flat com `eslint-config-expo`; ignora `node_modules`, `android`, `ios` e `coverage` (`leitor-epub/eslint.config.js`).
- TypeScript web: `strict: true`, `forceConsistentCasingInFileNames: true`, `noEmit: true` (`frontend/tsconfig.app.json`).
- TypeScript mobile: `strict: true`, `noUncheckedIndexedAccess: true`, alias `@/*` (`leitor-epub/tsconfig.json`).
- Comandos declarados: `npm run lint` no mobile; `npm run typecheck` em `leitor-epub`; o web só declara `dev`, `build` e `preview`.

## 3) Imports e módulos

- Backend usa imports Java por pacote, sem alias de compilação observado.
- Web usa imports relativos (`./api`, `./types`) e não declara barrel exports ou aliases em `tsconfig`.
- Mobile usa alias `@/...` para `src`, inclusive dentro de services e telas; o Jest mapeia o mesmo alias (`leitor-epub/package.json`, `leitor-epub/tsconfig.json`).
- Não foi encontrado arquivo de barrel central (`index.ts` para reexportação) nos módulos principais. `[TODO]` confirmar se a ausência é regra ou apenas estado atual.

## 4) Erros e logging

- Backend HTTP usa `ResponseStatusException` com mensagens em português para erros de autenticação, not-found, payload e conteúdo (`AuthService.java`, `BookContentService.java`, `BookService.java`).
- Jobs capturam `Exception`, persistem `FAILED` pelo `LexiconJobProgressWriter` e emitem logs SLF4J estruturados com `jobId`, `bookId`, fase, contagens e duração (`LexiconJobRunnerOptimized.java`).
- Integração Ollama captura `RestClientException` e lança `OllamaUnavailableException`; possui timeout de conexão/leitura em `AiProperties` (`OllamaAiProvider.java`, `AiProperties.java`).
- Mobile captura erros em telas e services; sincronização usa `SyncApiError` com status HTTP (`leitor-epub/src/services/sync.ts`).
- Redação de dados sensíveis: não foi encontrada política geral de redaction. O fluxo AI registra hash do request, contagens e mensagem de erro, mas `[TODO]` validar se todas as mensagens de provider são seguras para logs.

## 5) Convenções de testes

- Backend: testes Java ficam co-localizados por pacote em `backend/src/test/java`; há testes unitários Mockito e testes `@SpringBootTest`, `@JdbcTest` e MockMvc.
- Mobile: testes Jest ficam co-localizados em `src` com sufixo `.test.ts`; o Jest usa `jest-expo` e cobre arquivos `src/**/*.{ts,tsx}` segundo o manifest.
- Web: testes estáticos ficam na raiz `frontend/` com sufixo `.test.mjs`, lendo a fonte com `node:fs`; não há runner configurado em `package.json`.
- Mocking: backend usa Mockito; mobile usa `jest.fn`, fake timers e objetos SQLite mínimos; web não usa mocks de runtime, apenas asserções sobre o texto-fonte.
- Coverage: `[TODO]` não há threshold, relatório ou script de coverage configurado nos manifests examinados.

## 6) Evidências

- `backend/pom.xml`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `frontend/tsconfig.app.json`
- `frontend/package.json`
- `leitor-epub/tsconfig.json`
- `leitor-epub/eslint.config.js`
- `leitor-epub/package.json`
- `leitor-epub/src/services/sync.ts`

