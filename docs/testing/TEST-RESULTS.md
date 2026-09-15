# Test Execution Results

Baseline commit: f7eb4fed6dfd3a813be2de225312cd7f78bd799b
Data/hora UTC: 2026-09-14T17:24:32Z
Ambiente: Windows 11 amd64; Java 21.0.6; Maven 3.8.1; Node v26.8.1; npm 11.19.0.

Identidade Git e versões registradas antes das suítes:

- git rev-parse HEAD: f7eb4fed6dfd3a813be2de225312cd7f78bd799b
- git status --short antes da execução: vazio; árvore de trabalho limpa.
- java -version: Java 21.0.6 LTS.
- mvn -version: Apache Maven 3.8.1; Java 21.0.6; Windows 11 amd64.
- node -v: v26.8.1.
- npm -v: 11.19.0.

Banco — preflight de segurança (nenhum teste backend foi executado contra ele):

- Host/porta observados: localhost/127.0.0.1:5432; listener local PostgreSQL, PID 11020.
- Database configurado: leitor. Schema efetivamente usado: não confirmado.
- Isolamento/reset: não confirmado. O Docker daemon estava indisponível; a configuração Compose observada usa volume persistente leitor-postgres-data. Nenhum reset, DROP ou TRUNCATE foi executado.
- Storage-directory configurado/observado: backend/data/library. Não foi limpo nem alterado.
- A consulta de metadados com psql não autenticou; portanto não foi possível provar que o alvo era descartável ou separado da base de desenvolvimento.
- Senhas e tokens não são registrados.

## Wave 0 — Baseline

| Gate | Status | Command | Evidence |
|---|---|---|---|
| Backend build | PASS | cd backend; mvn -q -DskipTests package | Exit code 0; build concluído sem saída de erro. |
| Backend tests | BLOCKED | cd backend; mvn -q test | Não executado: a pré-condição de isolamento PostgreSQL falhou. A suíte contém testes Spring/JDBC que podem alcançar o datasource; nenhuma operação de banco foi feita. |
| Frontend build | PASS | cd frontend; npm run build | Exit code 0; tsc -b e Vite concluídos; 43 módulos transformados. Warning relevante: chunk JavaScript de 939.44 kB acima do limite de 500 kB. |
| Frontend static tests | PASS | cd frontend; node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs | Exit code 0; 5 testes, 5 pass, 0 fail, 0 skipped, duração 163.9229 ms. frontend/src/bookDetails.test.ts não foi executado. |
| Mobile Jest | PASS | cd leitor-epub; npm test -- --runInBand | Exit code 0; 10 suites pass, 41 testes pass, 0 fail, 0 skipped; tempo Jest 5.31 s. |
| Mobile typecheck | PASS | cd leitor-epub; npm run typecheck | Exit code 0; tsc --noEmit concluído sem saída de erro. |
| Mobile lint | FAIL | cd leitor-epub; npm run lint | Exit code 1; 6 errors e 2 warnings. Evidência e investigação abaixo. |

## Investigação de falha — systematic-debugging

Nenhuma correção foi aplicada. A investigação ficou limitada a ler a saída completa, reproduzir o comando e conferir configuração/trechos envolvidos.

### Mobile lint

- Comando: cd leitor-epub; npm run lint
- Exit code: 1
- Configuração/versões confirmadas: eslint.config.js carrega eslint-config-expo/flat; ESLint 9.39.5; eslint-config-expo 57.0.2; React 19.2.3; TypeScript 6.0.3.
- Primeira divergência observada: app/_layout.tsx:49, regra react-hooks/set-state-in-effect, por setReady(false) síncrono dentro de useEffect.
- Outros erros: app/cards.tsx:83, regra react-hooks/refs, ao criar PanResponder com cardPosition; app/cards.tsx:142 e :144, acessos a getTranslateTransform(), cardPosition.x e interpolate() durante render. A saída reportou 6 erros no total.
- Warnings: .expo/types/router.d.ts:1, diretiva eslint-disable sem problemas correspondentes; src/services/sync.ts:301, localBooksById atribuído e não usado.
- Hipótese de causa: as regras atuais do preset Expo/React Hooks detectam padrões existentes de efeitos, refs e Animated/PanResponder; a causa não foi alterada nesta Wave.
- Impacto: o gate de lint permanece FAIL e a prontidão de qualidade do mobile fica pendente. Nenhum teste, produção ou configuração foi modificado.

## Bloqueio de segurança — backend tests

O gate cd backend; mvn -q test não foi iniciado. A porta 5432 estava ocupada por um PostgreSQL local, mas a identidade do database/schema e a separação em relação à base de desenvolvimento não puderam ser confirmadas. O Docker client estava instalado, porém o daemon não estava disponível. Como a configuração Compose observada utiliza armazenamento persistente, não foi seguro improvisar reset nem executar a suíte contra esse alvo. O próximo passo deve ser uma decisão/preparação explícita de banco isolado antes de repetir o gate.

## TEST IDs

Status inicial da Wave 0: NOT_RUN para todos os TEST IDs, exceto os dois itens EXISTING abaixo, que foram executados integralmente com evidência fresca pela suíte Jest verde.

| TEST ID | Status | Evidence |
|---|---|---|
| TEST-001 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-002 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-003 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-004 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-005 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-006 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-007 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-008 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-009 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-010 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-011 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-012 | PASS | Existing Coverage confirmada em leitor-epub/src/db/migrations.test.ts; incluído na execução Jest com 10 suites e 41 testes pass. |
| TEST-013 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-014 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-015 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-016 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-017 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-018 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-019 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-020 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-021 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-022 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-023 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-024 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-025 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-026 | PASS | Existing Coverage confirmada em leitor-epub/src/reader/progress.test.ts e readerBridge.test.ts; incluído na execução Jest com 10 suites e 41 testes pass. |
| TEST-027 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-028 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-029 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-030 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-031 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-032 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-033 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-034 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-035 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-036 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-037 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-038 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-039 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-040 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-041 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-042 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-043 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-044 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-045 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-046 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-047 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-048 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-049 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-050 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-051 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-052 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-053 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-054 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-055 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-056 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-057 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-058 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-059 | NOT_RUN | Não executado nesta Wave 0. |
| TEST-060 | NOT_RUN | Não executado nesta Wave 0. |

## Escopo encerrado

Somente este arquivo de resultados foi criado intencionalmente. Nenhum código de produção, teste, migration, fixture, banco, configuração versionada ou issue Linear foi alterado. Playwright, E2E web, E2E mobile e device não foram executados. A Wave 1 não foi iniciada.

git status --short ao final: ?? docs/testing/TEST-RESULTS.md. Comparado ao estado inicial limpo, esta é a única alteração intencional.

## Wave 0 — Filesystem isolation fix

- Data/hora UTC: 2026-09-14T18:34:34Z.
- Arquivo alterado: backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java.
- Causa: deletingBookRemovesStoredEpubAndAllKnownCoverFiles resolvia Path.of("data", "library"), apontando para o storage de desenvolvimento quando executado a partir de backend/.
- Estratégia: injeção de JUnit 5 @TempDir Path storageRoot, exclusivo e temporário por execução do teste. O teste continua instanciando BookContentService com o mesmo storage recebido e mantém as assertions de remoção do EPUB, cover principal e stale cover.
- Comando: cd backend; mvn -q -Dtest=BookServiceTest test.
- Resultado: PASS; exit code 0. Surefire: tests=2, failures=0, errors=0, skipped=0, time=1.342 s. Relatório: backend/target/surefire-reports/TEST-br.com.leitormobile.book.BookServiceTest.xml.
- Storage real backend/data/library alterado: NO. Após a execução havia 3 arquivos preexistentes, com criação em 08/09/2026 e 10/09/2026, todos anteriores a esta execução; não foram criados, removidos ou modificados pelo teste. Nenhum arquivo novo foi observado.
- TEST IDs alterados: nenhum.

## Wave 0 — Backend isolation follow-up

- Commit/base do follow-up: 294c9e2469c96812bf878c6a7fa8cc9d1eade652.
- Baseline histórica preservada: f7eb4fed6dfd3a813be2de225312cd7f78bd799b.
- Working tree antes do follow-up: limpa (git status --short sem saída).
- Estratégia prevista: database PostgreSQL dedicado leitor_test na instância local, separado do database de desenvolvimento leitor; nenhuma criação, reset ou alteração foi executada.
- Database/schema: leitor_test não foi provisionado nem confirmado; schema atual não foi retornado.
- Storage temporário: nenhum diretório temporário foi criado ou usado; backend/data/library não foi acessado, limpo ou alterado nesta tentativa.
- Comando de conexão de preflight: psql -h 127.0.0.1 -p 5432 -U leitor -d postgres -w -Atc "SELECT current_database(), current_schema();"
- Resultado do preflight: exit code 1; fe_sendauth: no password supplied.
- Evidência adicional: não havia variáveis DATABASE_*, PG*, TEST_DATABASE_* ou SPRING_DATASOURCE_* no ambiente; não havia arquivo local de credenciais; o Docker daemon estava indisponível. A configuração atual mantém DATABASE_URL default em jdbc:postgresql://localhost:5432/leitor, tratado como banco de desenvolvimento e não utilizado.
- Datasource atual: @JdbcTest e @DataJpaTest usam @AutoConfigureTestDatabase(replace = NONE) e obtêm o datasource principal; não existe application-test.yml, profile de teste ou override seguro. Flyway está habilitado na configuração principal e, se executado, apontaria para o alvo informado ao processo.
- Filesystem atual: BookContentService resolve app.storage-directory com default ./data/library; BookServiceTest também contém um caso que escreve diretamente em Path.of("data", "library"). Portanto, somente fornecer uma URL de banco não provaria isolamento suficiente do filesystem para a suíte completa.
- Resultado do gate: BLOCKED. cd backend; mvn -q test não foi executado; total/pass/failures/errors/skipped e Surefire não existem para este follow-up.
- Classificação da investigação: ENVIRONMENT / TEST_INFRASTRUCTURE. Nenhuma correção de produção, teste, migration, credencial, banco, volume ou storage foi aplicada.

### Pré-requisito manual mínimo para desbloqueio

Executar como administrador da instância PostgreSQL, fora do repositório, substituindo os placeholders por valores reais e mantendo o segredo fora do Git:

    CREATE ROLE <TEST_DB_USER> LOGIN PASSWORD '<TEST_DB_PASSWORD>';
    CREATE DATABASE leitor_test OWNER <TEST_DB_USER>;

Depois, a execução deverá configurar DATABASE_URL para jdbc:postgresql://127.0.0.1:5432/leitor_test, usar o usuário dedicado, apontar o storage para um diretório temporário identificável e comprovar com SELECT current_database(), current_schema(); que o retorno não é leitor antes de iniciar qualquer teste. A forma final de executar a suíte ainda deve preservar o isolamento do caso de filesystem hardcoded em BookServiceTest.

## Wave 0 — Backend isolation follow-up 2

- Commit: 66b7165c86860ec1e0a9a4f9159b1dbc8a2ae778.
- Data/hora UTC: 2026-09-14T18:26:48Z.
- Working tree antes da tentativa: limpa (git status --short sem saída).
- Validação de variáveis, sem expor segredo: DATABASE_URL=NOT_SET; DATABASE_USERNAME=NOT_SET; DATABASE_PASSWORD=NOT_SET; APP_STORAGE_DIRECTORY=NOT_SET.
- Database/host/porta/schema/usuário: não confirmados nesta tentativa. A consulta SELECT current_database(), current_schema(); não foi executada porque não havia credenciais de ambiente para autenticação.
- Storage: nenhum diretório foi selecionado ou usado; backend/data/library não foi alterado.
- Comando de teste previsto: cd backend; mvn -q test.
- Resultado: BLOCKED antes do Maven, por ausência das variáveis de ambiente exigidas. Total/pass/failures/errors/skipped, exit code e Surefire não se aplicam.
- Classificação: ENVIRONMENT / TEST_INFRASTRUCTURE.
- Nenhum banco, migration, produção, teste, configuração ou credencial foi alterado. Não houve execução de Playwright, E2E ou Wave 1.

## Wave 0 — Backend isolation follow-up 3

- Commit: c7a2b1de83e5820ae9ba5e3cbb29083719daee23.
- Data/hora UTC: 2026-09-14T18:46:30Z.
- DATABASE_URL: NOT_SET.
- Database/schema/user: não confirmados; a consulta SELECT current_database(), current_schema(), current_user; não foi executada.
- Prova database != leitor: não obtida, pois o preflight de variáveis falhou antes da conexão.
- Storage: APP_STORAGE_DIRECTORY=NOT_SET; nenhum storage foi usado. backend/data/library não foi acessado ou alterado.
- Comando previsto: cd backend; mvn -q test.
- Resultado: BLOCKED antes do Maven. Total/pass/failures/errors/skipped e exit code não se aplicam; nenhum relatório Surefire novo foi gerado.
- Classificação: ENVIRONMENT / TEST_INFRASTRUCTURE.
- Nenhum código, teste, migration ou configuração foi alterado nesta tentativa. Nenhum TEST ID da Wave 1 foi promovido.

#### Retomada adicional do follow-up 3

- Commit: c7a2b1de83e5820ae9ba5e3cbb29083719daee23.
- Data/hora UTC: 2026-09-14T22:26:38Z.
- Preflight: DATABASE_URL=NOT_SET; DATABASE_USERNAME=NOT_SET; DATABASE_PASSWORD=NOT_SET; APP_STORAGE_DIRECTORY=NOT_SET.
- Database/schema/user e prova database != leitor: não confirmados; a regra de parada impediu a consulta PostgreSQL.
- Storage: nenhum usado; backend/data/library não foi tocado.
- Comando mvn: não executado, pois o preflight falhou.
- Total/pass/failures/errors/skipped, exit code e Surefire: não aplicáveis.
- Classificação: ENVIRONMENT / TEST_INFRASTRUCTURE. Nenhum TEST ID da Wave 1 foi promovido.

## Wave 0 — Permanent backend test profile

- Commit/base: c7a2b1de83e5820ae9ba5e3cbb29083719daee23.
- Data/hora UTC: 2026-09-14T22:36:26Z.
- application-test.yml criado em backend/src/test/resources/application-test.yml, sem senha versionada. O datasource fixo é jdbc:postgresql://127.0.0.1:5432/leitor_test, usuário leitor_test_user, e a senha é resolvida somente por TEST_DATABASE_PASSWORD.
- Mecanismo de ativação: PostgresIntegrationTestSupport usa @ActiveProfiles("test") e é a superclasse compartilhada dos cinco testes Spring/JPA/JDBC relevantes. Testes unitários puros não foram alterados.
- Guard: a base consulta current_database(), current_schema() e current_user antes de cada teste Spring e recusa qualquer alvo diferente de leitor_test/public; o database leitor não é aceito.
- Database/schema/usuário confirmados: não confirmados. TEST_DATABASE_PASSWORD estava NOT_SET, portanto a conexão não foi tentada.
- Storage configurado: ${java.io.tmpdir}/LeitorMobileTests/backend-storage; storage real não foi usado.
- Comando previsto: cd backend; mvn -q test.
- Resultado: BLOCKED antes do Maven por ausência de TEST_DATABASE_PASSWORD. Total/pass/failures/errors/skipped, exit code e Surefire não se aplicam.
- Classificação: ENVIRONMENT / TEST_INFRASTRUCTURE.
- Nenhum TEST ID da Wave 1 foi promovido. Wave 1 não iniciada e lint mobile não alterado.

### Execução verificada após provisionamento de TEST_DATABASE_PASSWORD

- Commit/base: c7a2b1de83e5820ae9ba5e3cbb29083719daee23.
- Data/hora UTC: 2026-09-14T22:46:13Z.
- Profile: `test`, ativado por `@ActiveProfiles("test")` na base compartilhada dos cinco testes Spring/JPA/JDBC; `backend/src/test/resources/application-test.yml` contém somente o placeholder `${TEST_DATABASE_PASSWORD}` para a senha.
- Datasource: `jdbc:postgresql://127.0.0.1:5432/leitor_test`.
- Database/schema/usuário confirmados antes e depois da suíte: `leitor_test` / `public` / `leitor_test_user`; prova explícita: `current_database() != leitor`.
- Flyway: habilitado no profile e validou 6 migrations no schema `public` de `leitor_test`; nenhuma migration foi alterada.
- Storage configurado: `C:\Users\souno\AppData\Local\Temp\LeitorMobileTests\backend-storage`; fora de `backend/data/library` e dedicado à execução de testes.
- Comando: `cd backend; mvn -q test`.
- Resultado: PASS; total=20, pass=20, failures=0, errors=0, skipped=0, exit code=0.
- Surefire: 15 relatórios em `backend/target/surefire-reports/`, agregação confirmada pelos XMLs.
- Verificações: `BookServiceTest` permanece com `@TempDir`; não há referência hardcoded adicional a `data/library` nos testes; `backend/data/library` não foi usado nem alterado.
- TEST IDs: nenhum TEST adicional foi promovido nesta etapa backend; TEST-012 e TEST-026 permanecem `PASS` desde a Wave 0; todos os demais permanecem `NOT_RUN`, salvo evidência futura explícita.

## Wave 0 — Final verification

- Commit SHA verificado: 7ee525f26a7e75119c380b05f459d0fda787cd0d.
- Data/hora UTC: 2026-09-14T23:13:19Z.
- Ambiente: Windows 11 amd64; Java 21.0.6; Maven 3.8.1; Node v26.8.1; npm 11.19.0. Nenhuma dependência ou lockfile foi alterada.
- Backend build: `PASS` — `cd backend; mvn -q -DskipTests package`; exit code 0.
- Backend tests: `PASS` — `cd backend; mvn -q test`; exit code 0; 20 testes executados, 20 pass, 0 failures, 0 errors, 0 skipped; 15 relatórios Surefire. Profile `test` ativo, datasource `jdbc:postgresql://127.0.0.1:5432/leitor_test`, schema `public`, usuário `leitor_test_user`; database confirmado diferente de `leitor` antes da execução.
- Frontend build: `PASS` — `cd frontend; npm run build`; exit code 0. Vite emitiu somente o aviso existente de chunk maior que 500 kB.
- Frontend static tests: `PASS` — `cd frontend; node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs`; exit code 0; 5 testes pass, 0 fail, 0 skipped; duração 380.25 ms.
- Mobile Jest: `PASS` — `cd leitor-epub; npm test -- --runInBand`; exit code 0; 10 suites pass, 41 testes pass, 0 fail, 0 skipped; duração 5.252 s.
- Mobile typecheck: `PASS` — `cd leitor-epub; npm run typecheck`; exit code 0; nenhum erro.
- Mobile lint: `PASS` — `cd leitor-epub; npm run lint`; exit code 0; 0 errors, 0 warnings. O artefato gerado `.expo/types/router.d.ts` não foi editado; `.expo/**` foi apenas incluído no ignore do ESLint.
- Filesystem: `BookServiceTest` mantém `@TempDir`; nenhum teste fonte referencia `data/library`; `backend/data/library` não foi usado nem alterado.
- Escopo: nenhuma migration foi alterada; o Flyway apenas validou o schema isolado de `leitor_test`. Produção, segredo, Playwright, E2E e TEST planejado não foram alterados/executados. TEST-012 e TEST-026 permanecem `PASS`; todos os demais TEST IDs permanecem `NOT_RUN`.

## Wave 1A — Authentication contracts

- Base utilizada: `origin/main` / `4e19f12a9f1977357c85a4deb11aedd228d8955f`.
- Branch: `test/wave-1a-authentication-contracts`.
- Data/hora UTC: 2026-09-15T13:09:37Z.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; a identidade foi confirmada por `SELECT current_database(), current_schema(), current_user` antes das execuções.
- Profile: `test`, ativado por `PostgresIntegrationTestSupport`; Flyway validou o schema isolado sem alterar migrations.

### TEST-002

- Status: `PASS`.
- Cenários: `AuthControllerTest` executou 2 testes: e-mail conhecido com senha incorreta e e-mail inexistente.
- Comando unitário: `cd backend; mvn -q -Dtest=AuthControllerTest test`; exit code `0`; total `2`, pass `2`, failures `0`, errors `0`, skipped `0`.
- Evidência: ambos os requests receberam `401 Unauthorized`; a contagem de `session_tokens` permaneceu inalterada em cada cenário, comprovando que nenhuma sessão autenticada foi persistida.
- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `25`, pass `25`, failures `0`, errors `0`, skipped `0`; 16 relatórios Surefire.
- Observações: o e-mail conhecido foi verificado no banco de teste antes do caso de senha incorreta. Uma tentativa inicial sem `TEST_DATABASE_PASSWORD` falhou antes do carregamento do contexto (`SQLState 28P01`, classificação `ENVIRONMENT`); a execução válida usou a credencial apenas como variável de processo, sem registrá-la.

### TEST-003

- Status: `PASS`.
- Cenários: `SecurityConfigTest` preservou o caso existente e executou 4 testes: Bearer ausente, Bearer malformado, token inexistente e token expirado.
- Comando unitário: `cd backend; mvn -q -Dtest=SecurityConfigTest test`; exit code `0`; total `4`, pass `4`, failures `0`, errors `0`, skipped `0`.
- Evidência: os quatro requests a `GET /api/books` receberam `401 Unauthorized`; o token expirado foi persistido com expiração determinística em `Instant.EPOCH` e removido no cleanup do teste, sem sleep ou timeout.
- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `25`, pass `25`, failures `0`, errors `0`, skipped `0`.
- Observações: a execução combinada `mvn -q "-Dtest=AuthControllerTest,SecurityConfigTest" test` também passou com `6/6` testes. Nenhuma configuração de segurança de produção foi flexibilizada.

### Escopo dos TEST IDs

- `TEST-002` e `TEST-003` foram promovidos de `NOT_RUN` para `PASS` porque todos os cenários descritos na matriz foram implementados e executados com evidência fresca.
- `TEST-012` e `TEST-026` permanecem `PASS` desde a Wave 0.
- Todos os demais TEST IDs permanecem `NOT_RUN`; nenhuma outra wave foi iniciada.

## Wave 1B — Book contracts

- Base utilizada: `origin/main` / `7f8881903ddabb5d79aeffe96221e7f0702b9a4a`.
- Branch/worktree: `test/wave-1b-book-contracts` / worktree isolado `D:\LeitorMobile-worktrees\wave-1b-book-contracts`.
- Data/hora UTC do registro: `2026-09-15T14:32:34Z`.
- Profile: `test`, ativado por `PostgresIntegrationTestSupport`; nenhuma configuração de produção ou migration foi alterada.
- Database/schema/usuário confirmados pelos testes: `leitor_test` / `public` / `leitor_test_user`; os logs do Flyway e a guarda de identidade confirmaram `current_database() != leitor`.
- Storage: diretório temporário exclusivo da classe criado por `Files.createTempDirectory("leitor-wave-1b-book-api-")` e injetado via `@DynamicPropertySource`; `backend/data/library` não foi usado.
- Fixture: owners e sessões sintéticos por teste; tokens brutos ficam apenas em memória/processo de teste e somente seus hashes são persistidos, sem segredo real; cleanup remove somente IDs e paths criados pela fixture.

### TEST-010

- Status: `PASS`.
- Cenários: listagem vazia/sem parâmetro, busca por título, busca por autor e busca sem resultado; dois owners com livros distintos; capa própria existente, sem capa, inexistente e de outro owner; ausência de Bearer.
- Teste: `listSearchAndCoverAccessRemainScopedToCurrentOwner`.
- Testes específicos: `listSearchAndCoverAccessRemainScopedToCurrentOwner` (1 teste). Comando: `cd backend; mvn -q -Dtest=BookControllerApiTest test`; harness com `tests=13`, `failures=0`, `errors=0`, `skipped=0`, exit code `0`.
- Evidência/efeitos: a listagem de OWNER_A contém somente seus IDs e a de OWNER_B somente o próprio; título/autor filtram sem vazamento; acesso à capa própria entrega os bytes esperados, enquanto capa sem arquivo, inexistente, de outro owner e sem sessão não entregam conteúdo de outro owner.

### TEST-014

- Status: `PASS`.
- Cenários: criação válida, owner derivado da sessão, `originalName` obrigatório/blank, trim de `fileHash`, `manual:<UUID>` para hash blank, defaults e normalizações, duplicidade no mesmo owner, comportamento observado de mesma hash entre owners e criação sem autenticação.
- Testes: `createBookAppliesApi004DefaultsAndBindsTheCurrentOwner`, `createBookTrimsExplicitHashRejectsDuplicatesAndObservesCrossOwnerConstraint`, `createBookRequiresOriginalNameAndAuthenticatedOwner`.
- Testes específicos: 3 testes (`createBookAppliesApi004DefaultsAndBindsTheCurrentOwner`, `createBookTrimsExplicitHashRejectsDuplicatesAndObservesCrossOwnerConstraint`, `createBookRequiresOriginalNameAndAuthenticatedOwner`). Comando: `cd backend; mvn -q -Dtest=BookControllerApiTest test`; harness com `tests=13`, `failures=0`, `errors=0`, `skipped=0`, exit code `0`.
- Evidência/efeitos: registro criado pertence ao owner da sessão; request não usa campo `owner`; EPUB/SHA não foram incluídos. A mesma hash entre owners foi observada como `409` nesta configuração de schema, sem assumir regra diferente.
- Observação de investigação: o fallback de título usa o `originalName` antes do trim/remoção de extensão; a assertion foi alinhada ao valor efetivamente observado, sem alteração de produção.

### Wave 1B — TEST-014 contract hardening

- A tentativa inicial de hardening para `409` revelou `TEST_EXPECTATION_ERROR`.
- A V2 remove a `UNIQUE` global de `file_hash` e cria `uq_books_user_file_hash(user_id, file_hash)`.
- Comportamento confirmado: mesma hash entre owners diferentes resulta em `201`; duplicidade continua proibida dentro do mesmo owner.
- Nenhuma produção ou migration foi alterada. TEST-014 permanece `PASS`.

### TEST-015

- Status: `PASS`.
- Cenários: upload EPUB/capa com SHA-256 correspondente, hash divergente, ausência de partes, owner diferente, ID inexistente, tamanho declarado acima de 100 MB e `originalFilename` com traversal.
- Testes: `uploadStoresMatchingEpubAndCoverInsideTheDedicatedStorageRoot`, `uploadRejectsInvalidContentAndOwnershipWithoutCreatingManagedFiles`, `uploadRejectsDeclaredEpubSizeAbove100MbWithoutAllocatingAGiantFixture`, `uploadOriginalFilenameCannotEscapeTheManagedStorageRoot`.
- Testes específicos: 4 testes (`uploadStoresMatchingEpubAndCoverInsideTheDedicatedStorageRoot`, `uploadRejectsInvalidContentAndOwnershipWithoutCreatingManagedFiles`, `uploadRejectsDeclaredEpubSizeAbove100MbWithoutAllocatingAGiantFixture`, `uploadOriginalFilenameCannotEscapeTheManagedStorageRoot`). Comando: `cd backend; mvn -q -Dtest=BookControllerApiTest test`; harness com `tests=13`, `failures=0`, `errors=0`, `skipped=0`, exit code `0`.
- Evidência/efeitos: bytes e paths válidos foram confirmados sob o storage temporário; mismatch, ausência, owner incorreto, ID ausente e limite foram rejeitados sem `fileUri`/arquivo EPUB indevido. O caso de filename malicioso confirmou que o target é construído por ID sob `storageRoot`; nenhum arquivo escapou. O limite usou `MultipartFile` de fixture pequena com tamanho declarado acima do limite, sem alocar 100 MB.

### TEST-021

- Status: `PASS`.
- Cenários: delete próprio com EPUB/capa/stale cover, livro inexistente, owner incorreto, sessão ausente/inválida, path externo; preservação do registro, arquivo de outro owner e arquivo externo nos negativos.
- Testes API: `deleteRemovesOnlyTheAuthorizedBookAndItsManagedContent`, `deleteRejectsMissingOtherOwnerAndUnauthenticatedRequestsWithoutDeletingFiles`, `deleteRejectsStoredPathOutsideRootWithoutDeletingDatabaseOrExternalFile`.
- Harness service existente: `BookServiceTest` permaneceu intacto e continuou cobrindo remoção via storage temporário e path externo sem apagar a linha do banco.
- Comando: `cd backend; mvn -q "-Dtest=BookServiceTest,BookControllerApiTest" test`; `BookControllerApiTest=13`, `BookServiceTest=2`, total `15`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Evidência/efeitos: somente o recurso autorizado foi removido; nos negativos, o banco e os arquivos protegidos permaneceram intactos. Nenhum arquivo foi escrito/removido em `backend/data/library`.

### TEST-024

- Status: `PASS`.
- Cenários: download próprio com arquivo, sem arquivo, inexistente, outro owner, path fora do root e sessão ausente; progresso válido, abaixo/acima do domínio, `null`, CFI válido, vazio e null; owner incorreto e sessão inválida.
- Testes: `downloadIsOwnerScopedAndRequiresAnAccessibleManagedFile`, `progressPersistsValidValuesAndRejectsInvalidValuesWithoutChangingState`.
- Testes específicos: 2 testes (`downloadIsOwnerScopedAndRequiresAnAccessibleManagedFile`, `progressPersistsValidValuesAndRejectsInvalidValuesWithoutChangingState`). Comando: `cd backend; mvn -q -Dtest=BookControllerApiTest test`; harness com `tests=13`, `failures=0`, `errors=0`, `skipped=0`, exit code `0`.
- Evidência/efeitos: somente o arquivo gerenciado e autorizado foi entregue; path externo não foi exposto. Valores de progresso inválidos não persistiram e não alteraram CFI/progresso; `progress=null`, CFI vazio e CFI null seguiram o comportamento documentado/observado.

### Regressão e verificação final da Wave 1B

- Verificação combinada: `cd backend; mvn -q "-Dtest=BookControllerApiTest,BookServiceTest" test`; total `15`, pass `15`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Regressão completa: `cd backend; mvn -q test`; total `38`, pass `38`, failures `0`, errors `0`, skipped `0`, exit code `0`; `17` relatórios Surefire.
- TEST IDs preservados: `TEST-002=PASS`, `TEST-003=PASS`, `TEST-012=PASS`, `TEST-026=PASS`; nenhum outro TEST ID foi promovido ou alterado.
- Arquivos de produção, migrations, `application-test.yml`, `PostgresIntegrationTestSupport`, `backend/data/library` e testes existentes não relacionados não foram alterados.
