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
- Evidência/efeitos: registro criado pertence ao owner da sessão; request não usa campo `owner`; EPUB/SHA não foram incluídos. Uma observação inicial registrou `409`; esse registro foi posteriormente classificado como `TEST_EXPECTATION_ERROR` e superseded pelo hardening abaixo, que confirmou `201` para owners diferentes.
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

## Wave 1C — Card API contracts

- Base utilizada: `origin/main` / `d7a3fc6d7fd89648604721a911cd329e4d862ae2`.
- Branch/worktree: `test/wave-1c-card-contracts` / `D:\LeitorMobile\wave-1c-worktree`.
- Data/hora UTC do registro: `2026-09-18T13:14:00Z`.
- Profile: `test`, ativado por `PostgresIntegrationTestSupport`.
- Database/schema/usuário confirmados antes e depois: `leitor_test` / `public` / `leitor_test_user`; consulta final: `SELECT current_database(), current_schema(), current_user`.
- Fixtures: dois owners, dois livros pertencentes a owners distintos e sessões Bearer sintéticas por teste; nenhum segredo real foi gravado.
- Cleanup: somente IDs de cards/livros e sessões/usuários criados pelo teste.

### TEST-040

- Status: `PASS`.
- Cenários executados: listagem por owner com default/includeArchived, isolamento entre owners, criação válida e defaults para opcionais nulos, validação de `bookId`/`cfiRange`/`selectedText`, livro inexistente/alheio, update próprio e preservação de livro/CFI/capítulo, selectedText inválido, card inexistente/alheio, archive/unarchive com efeitos de estado/listagem, move-to-end com acesso próprio e rejeições de ID/owner/sessão.
- Testes específicos: 5 testes em `backend/src/test/java/br/com/leitormobile/card/CardControllerTest.java`.
- Comando direcionado: `cd backend; mvn -q -Dtest=CardControllerTest test`; exit code `0`; total `5`, pass `5`, failures `0`, errors `0`, skipped `0`.
- Evidência: respostas observadas conforme catálogo: `200` para listagem/mutações válidas, `201` para criação, `400` para Bean Validation, `401` para sessão ausente/inválida e `404` para livro/card inexistente ou pertencente a outro owner. A listagem foi comparada por conjunto de IDs e conteúdo, sem posição.
- Efeitos negativos verificados: nenhuma criação parcial; contagens de cards dos dois owners permaneceram inalteradas nos negativos; card próprio permaneceu inalterado após update inválido/sem autorização; card alheio permaneceu intacto; estados `archived` não mudaram em operações negativas; livro alheio não foi usado para criar card.
- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `43`, pass `43`, failures `0`, errors `0`, skipped `0`; `18` relatórios Surefire em `backend/target/surefire-reports`.
- Regressão inclui os PASS preservados: `TEST-002`, `TEST-003`, `TEST-010`, `TEST-012`, `TEST-014`, `TEST-015`, `TEST-021`, `TEST-024` e `TEST-026`.

### QUEUE_ORDER_OBSERVATION

- Nenhuma observação incidental foi promovida: TEST-040 não inspeciona valor, unicidade, crescimento, posição relativa ou algoritmo de fila. TEST-041 e TEST-042 permanecem fora desta wave.

## Wave 1D-A — Persisted lexicon HTTP contract

- Status: `PASS`.
- Base utilizada: `origin/main` / `f6b712e072183f56e61b864ee98f9e43ab2cd188`.
- Branch/worktree: `test/wave-1d-a-lexicon-contract` / `D:\LeitorMobile-worktrees\wave-1d-a-lexicon-contract`.
- Data/hora UTC do registro: `2026-09-18T13:56:56Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; confirmados antes e depois com `SELECT current_database(), current_schema(), current_user`.
- Profile: `test`, ativado por `PostgresIntegrationTestSupport`; Flyway validou 6 migrations no banco isolado, sem alteração de migrations.
- Fixtures: dois owners, dois livros de owners distintos e sessões Bearer sintéticas; OWNER_A tem uma entrada completa persistida com dois word forms, dictionary entry, dois senses, frequência 7, `RESOLVED_LOCAL` e `CORE`, além de uma entrada auxiliar; OWNER_B tem livro e entrada lexical distinguível. Nenhum job lexical foi executado e nenhum segredo real foi gravado.
- Cleanup: somente usuários/sessões, livros, BookLexemes, lexemes, word forms, dictionary entry e senses criados pela fixture.

### TEST-047

- Cenários de list: default e `search=`; busca por lemma com trim/case; resultado vazio; `limit=1`; ownership entre os dois livros; livro de outro owner; entradas e IDs comparados por conjunto/conteúdo.
- Campos verificados: `id`, `bookId`, `lemma`, `partOfSpeech`, `wordForms`, `definition`, `translationPtBr`, `ipa`, `cefr`, `bookFrequency`, `firstSentenceId` nulo por ausência de fixture de sentence, `resolutionStatus`, `pedagogicalRelevance` e os dois senses persistidos (`senseKey`, definition e translationPtBr).
- Cenários de lookup: lemma existente; word form existente com trim/case-insensitive; termo inexistente; termo blank; parâmetro `term` ausente; livro inexistente; livro de outro owner; sessão ausente e Bearer inválido.
- Ownership: nenhuma entrada de OWNER_B apareceu nas respostas de OWNER_A; chamadas a livro alheio/inexistente retornaram `404` conforme o fluxo `ownedBook`.
- Ausência: lookup sem match/blank retornou `200` com corpo HTTP vazio na execução real do Spring MVC; o parâmetro ausente retornou `400`. Nenhum payload de ausência foi inventado.
- Efeitos negativos: snapshots de BookLexeme, word forms, dictionary-entry IDs e senses permaneceram iguais antes/depois das leituras e chamadas rejeitadas.
- Comando direcionado: `cd backend; mvn -q -Dtest=LexiconControllerTest test`; exit code `0`; total `5`, pass `5`, failures `0`, errors `0`, skipped `0`.
- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `48`, pass `48`, failures `0`, errors `0`, skipped `0`; `19` relatórios em `backend/target/surefire-reports`.
- Observação de `updatedAt`: o service usa `Instant.now()` na montagem de `EntryResponse`; foi validado somente presença e formato ISO-8601, sem comparação exata.
- Observação documental: API-019 descrevia corpo JSON `null` para ausência, mas o comportamento HTTP observado foi corpo vazio com status `200`; o TEST-047 registra o comportamento efetivo e não altera produção.
- TEST IDs alterados: somente `TEST-047` foi promovido para `PASS`; os PASS anteriores, incluindo `TEST-014`, foram preservados.



## Wave 1D-B — AI provider and exposure

- Status: `PASS`.
- Base utilizada: `origin/main` / `381cfa521b9f9078cd35a5b6a9e79d4571465d48`.
- Branch/worktree: `test/wave-1d-b-ai-contracts` / `D:\LeitorMobile\wave-1d-b-ai-contracts`.
- Data/hora UTC do registro: `2026-09-18T14:25:56Z`.
- Database/schema/usuário da regressão: `leitor_test` / `public` / `leitor_test_user`; identidade confirmada por `SELECT current_database(), current_schema(), current_user`.
- Provider: somente `HttpServer` fake em `127.0.0.1` com porta dinâmica; nenhum Ollama real, porta `11434`, rede externa, OpenRouter ou API paga foi utilizado.

### TEST-058

- Status: `PASS`.
- Cobertura no provider fake: resposta válida equivalente ao contrato `POST /api/chat`, com dois entries e `message.content` JSON estruturado; foram verificados quantidade, lemma, partOfSpeech, definition, translationPtBr, ipa, cefr, senseKey, confidence e os contadores `prompt_eval_count=17` / `eval_count=29`, expostos como input/output tokens.
- Request capturado: método `POST`, path `/api/chat`, model `fake-model`, `stream=false`, messages presentes e `format` contendo o schema de entries.
- Metadata-only: o request contém somente os metadados lexicais observáveis (lemma, POS e `bookFrequency`); o sentinela `PROTECTED_BOOK_EXCERPT_SHOULD_NOT_LEAVE` não apareceu no body. As policies confirmaram candidato válido permitido, `copyrightedTextRequired=false`, excerpts vazios e `totalCharacters=0`.
- Timeout/indisponibilidade: o teste existente `failsWhenOllamaExceedsTheConfiguredReadTimeout` permaneceu verde e confirmou `OllamaUnavailableException`, sem resposta de sucesso. Resposta estruturada inválida também foi caracterizada como `OllamaUnavailableException`.
- Comando dirigido exigido: `cd backend; mvn -q "-Dtest=OllamaAiProviderTest,ExternalAiContextPolicyTest,ExternalAiExposurePolicyTest" test`; total `11`, pass `11`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Testes adicionais justificados pelo plano: `AiEnrichmentServiceTest` executou `2/2`; a extensão verificou que zero candidatos não chama o provider e que um candidato passa pelo caminho metadata-only e chama o provider mockado. Execução combinada: total `13`, pass `13`, failures `0`, errors `0`, skipped `0`, exit code `0`.

### TEST-059

- Status: `PASS`.
- Purpose: `CHARACTERIZATION`; os resultados abaixo documentam o comportamento atual e não o transformam em acceptance futura.
- No-candidate: `decideMetadataOnly(..., 0)` retorna decisão bloqueada, sem excerpts e sem caracteres; `AiEnrichmentService.enrich` retorna antes de chamar provider, progress writer, gate ou repositories.
- Candidato válido: `decideMetadataOnly(..., 2/3)` retorna decisão permitida metadata-only, sem texto protegido; o serviço chama o provider mockado com lemma, POS e frequência, sem contexto de livro.
- Contexto bloqueado: mais de um excerpt, excerpt acima de 600 caracteres, vazio, null ou lista null resultam em decisão bloqueada; nenhum desses excerpts foi enviado a servidor HTTP.
- Exposure: decisão metadata-only não consome bucket; decisão bloqueada não consome bucket; ocorrência curta permitida reserva uma requisição, caracteres, excerpt, source sentence e reading unit; o limite existente continua bloqueando após 20 requisições permitidas. Não foram inventados thresholds.
- Provider-call evidence: o teste unitário mínimo em `AiEnrichmentServiceTest` cobre a decisão no boundary real do serviço; não houve integração adicional nem arquitetura nova.

### Verificação e observações

- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `56`, pass `56`, failures `0`, errors `0`, skipped `0`; `20` relatórios em `backend/target/surefire-reports`. Database/schema/user confirmados como `leitor_test/public/leitor_test_user`.
- O primeiro erro do teste adicional foi classificado como `TEST_INFRASTRUCTURE`: o serviço usa o bridge package-local `br.com.leitormobile.lexicon.OllamaAiProvider`; o harness foi corrigido para esse tipo sem alteração de produção ou de expectations.
- `updatedAt` não é objeto desta wave; não foi criada assertion de timestamp exato.
- TEST IDs alterados: somente `TEST-058` e `TEST-059`; `TEST-060`, `TEST-041` e `TEST-042` permanecem fora do escopo; nenhuma Wave 2 foi iniciada.

## Wave 1D-C — Actuator contract

- Status: `PASS`.
- Base utilizada: `origin/main` / `01880c29e4575f74282de9df80ca4c1b19c2f7c5`.
- Branch/worktree: `test/wave-1d-c-actuator-contract` / `D:\LeitorMobile-worktrees\wave-1d-c-actuator-contract`.
- Data/hora UTC do registro: `2026-09-18T15:38:52Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; identidade confirmada após a regressão por `SELECT current_database(), current_schema(), current_user`.
- Profile: `test`, ativado por `PostgresIntegrationTestSupport`; nenhuma migration, `SecurityConfig` ou `application.yml` foi alterada.

### TEST-060

- Status: `PASS`.
- Teste: `backend/src/test/java/br/com/leitormobile/health/ActuatorContractTest.java`, 5 métodos; comando direcionado `cd backend; mvn -q -Dtest=ActuatorContractTest test`; exit code `0`; total `5`, pass `5`, failures `0`, errors `0`, skipped `0`.
- Health: request anônimo a `GET /actuator/health` recebeu `200` e payload observado `{"status":"UP"}` quando o datasource de `leitor_test` estava disponível.
- Info: request anônimo a `GET /actuator/info` recebeu `401`; com Bearer sintético válido recebeu `200` e body `{}`; Bearer inválido recebeu `401`. O corpo vazio foi observado porque não há `InfoContributor` customizado exposto na baseline.
- Degradação: exercitada de forma determinística por `HealthIndicator` definido apenas em `@TestConfiguration`, sem substituir o datasource e sem interromper PostgreSQL; o Actuator produziu `503` e `{"status":"DOWN"}`.
- Endpoint não exposto: `GET /actuator/env` com sessão sintética válida recebeu `404`; a exposição permaneceu limitada a `health,info`.
- Fixtures/sessão: usuário e token Bearer sintéticos por teste; somente o hash do token foi persistido; cleanup removeu exclusivamente a sessão e o usuário criados pela classe.
- Regressão completa: `cd backend; mvn -q test`; exit code `0`; total `61`, pass `61`, failures `0`, errors `0`, skipped `0`; `21` relatórios Surefire em `backend/target/surefire-reports`.
- TEST IDs alterados: somente `TEST-060` foi promovido para `PASS`; `TEST-041` e `TEST-042` permanecem `NOT_RUN` e nenhuma Wave 2 foi iniciada.

## Wave 2 — queueOrder defect probes

- Status da wave: `FAIL` por `PRODUCT_BUG_CANDIDATE` confirmado; nenhum arquivo de produção, migration ou schema foi alterado.
- Base utilizada: `origin/main` / `3b80d29201525466306a3114aac7c7990dd61cd3`.
- Branch/worktree: `test/wave-2-queue-order-probes` / `D:\LeitorMobile-worktrees\wave-2-queue-order-probes`.
- Data/hora UTC do registro: `2026-09-18T16:14:44Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; identidade confirmada após os probes.
- Baseline antes dos probes: `mvn -q test`, exit code `0`; total `61`, pass `61`, failures `0`, errors `0`, skipped `0`; `21` relatórios Surefire.

### TEST-041

- Status: `FAIL`.
- Verdict: `CONFIRMED`.
- Fixture: owner sintético, livro autorizado sem cards ativos e sessão Bearer sintética; três criações sequenciais passaram pelo `POST /api/cards`, sem concorrência e sem `sleep`.
- Created cards: `queue-create-card-1` (`fb7339ed-4277-4fc7-8d4e-f60e3ccfbc4e`), `queue-create-card-2` (`352d1777-b36e-45f3-a10e-9d44e54ffa6a`) e `queue-create-card-3` (`7422fd17-46b0-43a1-b943-3aff113b36a3`).
- Valores persistidos: `-1, -1, -1`; os `createdAt` foram distinguíveis e a ordem retornada por `findActive(ownerId)` foi `queue-create-card-1`, `queue-create-card-2`, `queue-create-card-3`, todos com `queueOrder=-1`.
- Diagnostics: `findNextQueueOrder` antes de cada criação `[-1, -1, -1]`; depois de cada criação `[-1, -1, -1]`.
- Primeiro ponto de divergência: `CardRepository.findNextQueueOrder` executa `coalesce(max(c.queueOrder), -1)` e retorna `-1` para o owner vazio; `CardService.create` passa esse retorno diretamente ao construtor `Card`, que persiste o mesmo valor. O valor anômalo surge no boundary repository → service/construtor, antes da listagem.
- Comando: `cd backend; mvn -q -Dtest=CardQueueOrderProbeTest test`; exit code `1`; total `1`, pass `0`, failures `1`, errors `0`, skipped `0`.
- Repetibilidade: uma segunda execução independente reproduziu `-1,-1,-1`; a execução combinada também reproduziu o mesmo resultado.

### TEST-042

- Status: `FAIL`.
- Verdict: `CONFIRMED`.
- Fixture independente: três cards persistidos diretamente pelo harness com `queueOrder` diagnóstico `10,20,30`, todos do mesmo owner/livro; createdAt/updatedAt foram registrados.
- Ordem inicial: `[queue-move-card-a(10), queue-move-card-b(20), queue-move-card-c(30)]` conforme `findActive(ownerId)`; os queueOrders persistidos eram `10,20,30`.
- Operação: `POST /api/cards/{A}/move-to-end` recebeu `200`; `findNextQueueOrder` antes retornou `30`.
- Valores finais: A recebeu `30`, C permaneceu `30`, B permaneceu `20`; `findNextQueueOrder` depois continuou `30`.
- Ordem final: `[queue-move-card-b(20), queue-move-card-a(30), queue-move-card-c(30)]`; o card movido não terminou estritamente após o antigo último e compartilhou `queueOrder=30`.
- Primeiro ponto de divergência: `CardService.moveToEnd` passa diretamente ao `Card.moveToEnd` o `max(queueOrder)=30`; `Card.moveToEnd` persiste esse valor sem distingui-lo do antigo último. `CardRepository.findActive` ordena por `queueOrder asc, createdAt asc`, por isso A, criado antes de C, aparece antes de C no empate.
- Comando: `cd backend; mvn -q -Dtest=CardMoveToEndProbeTest test`; exit code `1`; total `1`, pass `0`, failures `1`, errors `0`, skipped `0`.
- A execução combinada `cd backend; mvn -q "-Dtest=CardQueueOrderProbeTest,CardMoveToEndProbeTest" test` teve exit code `1`; total `2`, pass `0`, failures `2`, errors `0`, skipped `0`.

### BUG_CANDIDATE QUEUE_ORDER

- Status: `CONFIRMED`.
- Observed: criação sequencial sem cards ativos produz `queueOrder=-1` repetido; move-to-end com fixture `10,20,30` produz `30,20,30` e ordem final `B,A,C`.
- Trace: request real → `CardService.create`/`moveToEnd` → `CardRepository.findNextQueueOrder` → valor retornado → `Card` constructor/`Card.moveToEnd` → persistência → `findActive`.
- Hypothesis: os call sites usam o valor retornado pela query de máximo como se ele já fosse um próximo queueOrder distinguível; esta é uma hipótese causal baseada na evidência, não uma prescrição de correção. Nenhuma solução, incluindo `MAX + 1`, foi escolhida ou implementada.

### Verificação e escopo

- `CardControllerTest` após os probes: PASS; `mvn -q -Dtest=CardControllerTest test`; exit code `0`; total `5`, pass `5`, failures `0`, errors `0`, skipped `0`.
- Não foi executado `mvn -q test` após os probes, porque ambos falham intencionalmente para preservar a evidência do defeito confirmado; a baseline limpa de `61/61` está registrada acima.
- TEST IDs alterados: somente `TEST-041` e `TEST-042`; ambos permanecem probes `DEFECT_PROBE`, não acceptance. Nenhuma Wave posterior foi iniciada.

## QueueOrder confirmed bug — TDD fix

- Status: `PASS` após a correção; o histórico RED/CONFIRMED da Wave 2 foi preservado acima.
- Base utilizada: `origin/main` / `e8a3cf309bdfc46eee1b70148af75e1aeb64bac1`.
- Branch/worktree: `fix/queue-order` / `D:\LeitorMobile-worktrees\fix-queue-order`.
- Data/hora UTC do registro: `2026-09-18T17:57:56Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; confirmados após a regressão com `SELECT current_database(), current_schema(), current_user`.

### Root cause

- `CardRepository.findNextQueueOrder(ownerId)` retornava `coalesce(max(c.queueOrder), -1)`, embora `CardService.create` e `CardService.moveToEnd` usassem o retorno diretamente como o novo valor de `queueOrder`.
- Com owner sem cards ativos, o retorno era `-1` em todas as criações; com `A=10, B=20, C=30`, move-to-end de A recebia `30`, empatando com C.
- O primeiro ponto de divergência foi o boundary da query do repository para os call sites do service/construtor ou `Card.moveToEnd`; as queries de ownership e ordenação não foram alteradas.

### Production change

- Arquivo: `backend/src/main/java/br/com/leitormobile/card/CardRepository.java`.
- Antes: `coalesce(max(c.queueOrder), -1)`.
- Depois: `coalesce(max(c.queueOrder), -1) + 1`.
- Rationale: centraliza a semântica de “next queue order” no helper já compartilhado, produzindo valor estritamente maior que o máximo ativo; owner sem cards começa em `0`. O filtro `archived = false`, ownership, schema, migrations, queries de listagem e ordenação secundária por `createdAt` foram preservados.
- Nenhum teste adicional de repository foi criado: os probes cobrem diretamente os dois call sites reais e verificam a evidência persistida/ordenada sem duplicar cobertura.

### RED confirmado antes do patch

- `TEST-041 = FAIL / CONFIRMED`: criações sequenciais produziram `queueOrder=[-1,-1,-1]`; `findNextQueueOrder` antes/depois permaneceu `[-1,-1,-1]`.
- `TEST-042 = FAIL / CONFIRMED`: fixture inicial `A=10, B=20, C=30`; após move-to-end(A), `A=30, B=20, C=30` e ordem `[B,A,C]`.
- Comando de revalidação: `cd backend; mvn -q "-Dtest=CardQueueOrderProbeTest,CardMoveToEndProbeTest" test`; total `2`, pass `0`, failures `2`, errors `0`, skipped `0`, exit code `1`.

### GREEN após o patch

- `TEST-041 = PASS`: `queueOrders=[0,1,2]`, com progressão estritamente crescente e ordem persistida correspondente.
- `TEST-042 = PASS`: fixture inicial `A=10, B=20, C=30`; após move-to-end(A), `A=31, B=20, C=30`; A terminou estritamente após B e C em `findActive(ownerId)`.
- Comandos: `cd backend; mvn -q -Dtest=CardQueueOrderProbeTest test`; `cd backend; mvn -q -Dtest=CardMoveToEndProbeTest test`; execução combinada `cd backend; mvn -q "-Dtest=CardQueueOrderProbeTest,CardMoveToEndProbeTest" test`; todos com exit code `0`, total combinado `2`, pass `2`, failures `0`, errors `0`, skipped `0`.
- Contrato relacionado: `CardControllerTest` total `5`, pass `5`, failures `0`, errors `0`, skipped `0`, exit code `0`.

### Regression and final state

- Regressão: `cd backend; mvn -q test`; total `63`, pass `63`, failures `0`, errors `0`, skipped `0`, exit code `0`; `23` relatórios Surefire em `backend/target/surefire-reports`.
- Verificação de identidade: `current_database()=leitor_test`, `current_schema()=public`, `current_user=leitor_test_user`.
- `TEST-041`: status final após fix `PASS`; verdict histórico `CONFIRMED`; bug state `FIXED`.
- `TEST-042`: status final após fix `PASS`; verdict histórico `CONFIRMED`; bug state `FIXED`.
- `BUG_CANDIDATE QUEUE_ORDER: CONFIRMED → FIXED`.
- Nenhuma migration, schema, `CardService`, `Card`, `CardController`, query de listagem ou fixture de probe foi alterada; nenhum push, merge ou Wave 3 foi iniciado.

## Wave 3A — Web E2E foundation

- Status da wave: `PASS` para `TEST-001`; nenhum outro TEST da Wave 3 foi executado.
- Base utilizada: `origin/main` / `32da59467950d2f136fe5cb6149b76f7848763d7`.
- Branch/worktree: `test/wave-3a-web-e2e-login` / `D:\LeitorMobile-worktrees\wave-3a-web-e2e-login`.
- Data/hora UTC do registro: `2026-09-18T18:29:28Z`.
- Playwright: `@playwright/test` `1.62.1` adicionado como devDependency exata local do frontend; `npx --no-install playwright --version` retornou `1.62.1`.
- Browser: Chromium local do Playwright, Chrome for Testing `151.0.7922.34` / Chromium runtime `v1234`; instalado somente o projeto Chromium pelo mecanismo oficial (Chrome for Testing e headless shell); Firefox/WebKit não foram instalados.
- URLs: backend `http://127.0.0.1:8080`; frontend `http://127.0.0.1:5173`; `VITE_API_URL=http://127.0.0.1:8080/api`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; o backend E2E foi iniciado com profile `test` e senha somente via ambiente.
- Conta de teste: `APP_AUTH_EMAIL` e `APP_AUTH_PASSWORD` foram injetados no processo como valores sintéticos gerados por execução; nenhum email/senha/token foi gravado no repositório ou no ledger.
- Storage: `APP_STORAGE_DIRECTORY` apontou para diretório temporário por processo em `%TEMP%/LeitorMobile-wave-3a/<pid>`; o storage de desenvolvimento não foi usado.
- Reset/isolation: cada teste usa contexto de browser novo; antes/depois, o cliente API remove somente livros do owner de teste cujo `fileHash` começa com `wave-3a-test-001-`; a conta sintética é exclusiva da execução.
- Artifacts policy: screenshot `only-on-failure`, trace `retain-on-failure`, video desligado; screenshot/trace foram gerados durante uma falha intermediária e removidos após a correção, sem entrar no commit.

### TEST-001

- Status: `PASS`.
- Cenários: login UI válido; sessão persistida em `leitor.auth.token`/`leitor.auth.user` verificada estruturalmente; reload sem retorno ao LoginView; biblioteca vazia com `Sua biblioteca está vazia`; livro sintético sem upload criado por API e exibido com título/autor; logout caracterizado com limpeza do localStorage e reload deslogado; senha inválida caracterizada com `role=alert`, permanência no login e nenhuma sessão local.
- Network endpoints observados: `POST /api/auth/login`, `GET /api/auth/me` e `GET /api/books`; nenhum Authorization/token foi registrado.
- Comando final: `cd frontend; npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/library.spec.ts --grep "TEST-001"`.
- Resultado final: browser Chromium; total `3`, pass `3`, failures `0`, skipped `0`, exit code `0`; duração observada `27.5s` na verificação final.
- Frontend baseline antes e após o E2E: `npm run build` exit code `0` em ambas as execuções; static tests `node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs`, total `5`, pass `5`, failures `0`, skipped `0`, exit code `0` antes e após o E2E.
- Divergências investigadas: a primeira execução omitiu `--config` e falhou com `ECONNREFUSED` porque os webServers não foram carregados; o config ESM foi ajustado para `import.meta.url`; a mensagem textual esperada para login inválido foi removida após observar que o frontend expõe o fallback HTTP `401`. Classificações: `TEST_INFRASTRUCTURE` nas duas primeiras ocorrências de harness/config e `TEST_EXPECTATION_ERROR` na mensagem; nenhuma alteração de produção.
- TEST IDs alterados: somente `TEST-001`; `TEST-009`, `TEST-013`, `TEST-020`, `TEST-023`, `TEST-027`, `TEST-028`, `TEST-029` e `TEST-039` não foram executados.

## Wave 3B — Web EPUB upload and lexical processing

### TEST-013

- Status: `PASS`.
- Base utilizada: `origin/main` / `253bb97f6fe4c5f5978688bad0dde4129337a5e7`.
- Branch/worktree: `test/wave-3b-web-e2e-upload` / `D:\LeitorMobile-worktrees\wave-3b-web-e2e-upload`.
- Data/hora UTC do registro: `2026-09-18T19:52:10Z`.
- Playwright/browser: `@playwright/test` `1.62.1`; Chromium local Playwright, Chromium runtime `v1234`; nenhum Firefox/WebKit ou Ollama real foi usado.
- Ambiente: backend `http://127.0.0.1:8080`, frontend `http://127.0.0.1:5173`, `leitor_test` / `public` / `leitor_test_user`; `APP_AI_ENABLED=false`; storage backend temporário do Playwright; nenhum listener em `11434` após a execução.
- EPUB: fixture programática sintética de `1450` bytes, ZIP EPUB mínimo válido com `mimetype`, container, OPF e XHTML; termos `dragon`, `read` e `book`; arquivo e diretório temporários removidos no cleanup; SHA-256 real `35933801cc56b2500e4a36b25bffdcb876cc0c42a7b39b304d097442e96e40e4`.
- Happy path: pela UI, login, “Adicionar livro”, seleção do EPUB, título/autor e submissão; `POST /api/books` `201`, `POST /api/books/{id}/content` `200`, início automático sem “Reprocessar léxico”, `POST /api/books/{id}/lexicon/jobs` `202`, polling por `GET /api/books/{id}/lexicon/jobs/latest` e estado terminal `COMPLETED`.
- Evidência final do happy path: Book ID `39c87c44-6cac-4793-9dfe-eaa8f59bc3eb`; lookup `GET /api/books/{id}/lexicon/lookup?term=dragon` `200`; `lemma=dragon`, definição/localização/CEFR do dicionário local observados.
- Falha de início automático: caracterização complementar com interceptação exclusiva do `POST /api/books/{id}/lexicon/jobs`, retornando `503` sintético; create/upload permaneceram reais (`201`/`200`) e a UI exibiu “Livro adicionado, mas o processamento não foi iniciado”. Nenhum endpoint de start foi chamado diretamente pelo teste.
- Cleanup: prefixo `wave-3b-test-013-` aplicado ao `originalName` sintético e também aceito no helper API; confirmação final deixou `0` Books da fixture no banco e nenhum arquivo temporário da fixture.
- Baseline antes das alterações: `npm run build` exit `0`; static tests total `5`, pass `5`, failures `0`, skipped `0`, exit `0`; TEST-001 Playwright pre-change terminou com status `passed` e `failedTests=[]`.`r`n- Comandos finais: `npm run build` exit `0`; static tests `node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs`, total `5`, pass `5`, failures `0`, skipped `0`, exit `0`; TEST-001 total `3`, pass `3`, failures `0`, skipped `0`, exit `0`; TEST-013 total `2`, pass `2`, failures `0`, skipped `0`, exit `0`, duração `28.5s`.
- Artefatos: política compartilhada `screenshot=only-on-failure`, `trace=retain-on-failure`, video desligado; screenshots/traces de falhas intermediárias de harness foram usados na investigação e removidos, sem entrar no commit; execução final não produziu falha.
- Divergências investigadas: pré-condição de login ausente, locator exato incompatível com o ícone acessível do botão e cleanup inicial baseado no hash real; classificadas como `TEST_INFRASTRUCTURE`, corrigidas somente nos testes/helpers. O residual identificado foi removido pelo UUID exato da fixture; nenhuma produção foi alterada.
- TEST IDs alterados: somente `TEST-013`; `TEST-009`, `TEST-020`, `TEST-023`, `TEST-027`, `TEST-028`, `TEST-029` e `TEST-039` não foram executados.

## Wave 3C — Web book deletion

### TEST-020

- Status: `PASS`.
- Base utilizada: `origin/main` / `8a648f31765589020325d47c4cf5362a09a899f7`.
- Branch/worktree: `test/wave-3c-web-e2e-delete` / `D:\LeitorMobile-worktrees\wave-3c-web-e2e-delete`.
- Data/hora UTC do registro: `2026-09-18T21:12:12Z`.
- Ambiente: Playwright `1.62.1`, Chromium local (`v1234`), backend `http://127.0.0.1:8080`, frontend `http://127.0.0.1:5173`, database `leitor_test`, schema `public`, usuário `leitor_test_user`, `APP_AI_ENABLED=false`; nenhum storage de desenvolvimento ou Ollama foi usado.
- Storage: o config de Playwright compartilha `E2E_STORAGE_DIRECTORY` com `APP_STORAGE_DIRECTORY`; o path observado foi `%TEMP%/LeitorMobile-wave-3c/<worker-pid>`, exatamente o mesmo path usado pelo backend e pelo teste. O storage de desenvolvimento `backend/data/library` não foi tocado.
- Fixture: Book sintético com prefixo `wave-3c-test-020-`, EPUB mínimo real gerado por `createSyntheticEpub()` e hash SHA-256 calculado sobre os bytes; upload multipart real de EPUB e capa JPG sintética; capa stale PNG criada diretamente no storage; sentinel PNG não pertencente ao Book. Não houve job lexical.
- Book ID da verificação final: `2fa2c459-22b6-42e3-a971-b480f73ebb2e`.
- Filesystem pré-delete: `books/{id}.epub`, `covers/{id}.jpg`, `covers/{id}.png` e `covers/wave-3c-unrelated-sentinel.png` existiam.
- Caminho web: login, biblioteca, “Opcoes do livro”, “Excluir livro” e confirmação nativa `window.confirm`; a exclusão não foi chamada diretamente pela API. Request observado: `DELETE /api/books/{id}` com HTTP `204`.
- Resultado UI/DB: o título deixou de aparecer e a biblioteca ficou vazia; `listBooks()` autenticado não retornou o `bookId`.
- Filesystem pós-delete: EPUB, JPG atual e PNG stale não existiam; o sentinel continuou existindo. O cleanup final removeu o sentinel e qualquer residual da fixture.
- Comandos focados/finais: `node_modules/.bin/playwright.cmd test --config=e2e/playwright.config.ts e2e/specs/library.spec.ts --grep "TEST-020"`; execução focada final total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`, duração `23.3s`.
- Regressão web: `npm run build` exit `0`; static tests total `5`, pass `5`, failures `0`, skipped `0`, exit `0`; TEST-001 total `3`, pass `3`, failures `0`, skipped `0`, exit `0`, duração `26.7s`; TEST-013 total `2`, pass `2`, failures `0`, skipped `0`, exit `0`, duração `25.5s`; TEST-020 total `1`, pass `1`, failures `0`, skipped `0`, exit `0`.
- Artefatos: screenshot `only-on-failure`, trace `retain-on-failure`, video desligado; as duas falhas intermediárias foram classificadas como `TEST_INFRASTRUCTURE` (expressão de fixture atravessada pelo shell e sincronização do dialog) e corrigidas no harness; a verificação final não produziu falha/artifact pendente.
- Arquivos alterados: somente harness/spec/fixture E2E e este ledger; nenhum arquivo de produção backend/frontend foi alterado.
- TEST IDs alterados: somente `TEST-020`; `TEST-009`, `TEST-023`, `TEST-027`, `TEST-028`, `TEST-029` e `TEST-039` não foram executados. `TEST-001` e `TEST-013` foram somente revalidados como regressão e permanecem `PASS`.

## Wave 3D — Web EPUB reader and progress

### TEST-023

- Status: `FAIL` — `PRODUCT_BUG_CANDIDATE` confirmado no caminho principal de restauração na mesma sessão.
- Base utilizada: `origin/main` / `87cae1e92272d0db1f5cefd93379853de152216b`; branch/worktree: `test/wave-3d-web-e2e-reader` / `D:\LeitorMobile-worktrees\wave-3d-web-e2e-reader`.
- Data/hora UTC do registro: `2026-09-18T22:28:49Z`.
- Ambiente: Playwright `1.62.1`, Chromium local (`v1234`), backend `http://127.0.0.1:8080`, frontend `http://127.0.0.1:5173`, database `leitor_test`, schema `public`, usuário `leitor_test_user`, `APP_AI_ENABLED=false`; nenhum Ollama, rede externa ou storage de desenvolvimento foi usado.
- Fixture: EPUB sintético mínimo com SHA-256 real, três itens no spine e sentinelas `WAVE3D_CHAPTER_ONE_SENTINEL`, `WAVE3D_CHAPTER_TWO_SENTINEL` e `WAVE3D_CHAPTER_THREE_SENTINEL`; prefixo de cleanup `wave-3d-test-023-`; nenhum material protegido.

#### Acceptance path

- First open: `GET /api/books/{id}/file` recebeu `200`; o primeiro capítulo foi renderizado dentro do iframe do epub.js; `CFI_1` foi não blank e tratado como string opaca; o primeiro `PATCH /api/books/{id}/progress` recebeu `200` e o progress observado ficou em `[0,1]`.
- Navigation: o clique em `Próxima` renderizou o segundo capítulo; um novo `PATCH /api/books/{id}/progress` recebeu `200`; `CFI_2 != CFI_1`; a API confirmou `lastCfi=CFI_2` e `progress` persistido em `[0,1]`.
- Same-session reopen: o reader foi fechado e reaberto pelo fluxo normal, sem `page.reload()`, sem PATCH manual e sem atualizar localStorage. O segundo capítulo não foi restaurado; a assertion principal falhou de forma determinística. Portanto o TEST-023 não pode ser promovido para PASS.
- Primeiro ponto de divergência: `EpubReader` capturou `relocated` e persistiu `CFI_2` via `PATCH`; o backend manteve o estado salvo. Ao fechar, `App` não atualiza o item correspondente em `books`; ao reabrir na mesma sessão, `readingBook` ainda contém o Book antigo sem `lastCfi`, e `EpubReader` chama `rendition.display(undefined)`, iniciando no capítulo 1.

#### Diagnostic and missing-file characterization

- Diagnostic reload: executado somente após a falha principal. Após `page.reload()`, o Book foi recarregado do backend e o capítulo 2 foi restaurado (`reloadRestore=YES`). Isso confirma a persistência backend, mas não transforma a falha de same-session reopen em PASS.
- Missing file: o Book sem EPUB recebeu `GET /api/books/{id}/file` `401` tanto pelo helper autenticado quanto pelo browser autenticado (`authHeaderPresent=true`); a UI mostrou `Não foi possível abrir o livro.` e permitiu `Voltar à biblioteca`. O código/backend test existente documenta `404` para a ausência de arquivo em outro boundary, então a diferença runtime `401` vs `404` foi registrada sem inventar expectation nem alterar produção.
- Repetibilidade: a execução completa foi repetida duas vezes; em ambas o cenário principal falhou e os dois cenários de diagnóstico/caracterização passaram. A execução final focada teve total `3`, pass `2`, failures `1`, errors `0`, skipped `0`, exit code `1`.
- Comando focado: `cd frontend; node_modules/.bin/playwright.cmd test --config=e2e/playwright.config.ts e2e/specs/reader.spec.ts --grep "TEST-023" --reporter=line`; duração observada `54.5s` na segunda confirmação.
- Regressão da fundação após as alterações: TEST-001 total `3`, pass `3`, failures `0`, skipped `0`, exit code `0`; TEST-013 total `2`, pass `2`, failures `0`, skipped `0`, exit code `0`; TEST-020 total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`.
- TEST IDs alterados: somente `TEST-023`; `TEST-009`, `TEST-027`, `TEST-028`, `TEST-029` e `TEST-039` não foram executados. `TEST-001`, `TEST-013` e `TEST-020` foram apenas revalidados.
- Classificações: restauração na mesma sessão = `PRODUCT_BUG_CANDIDATE`; diferença de status no missing-file = divergência de contrato/runtime observada, sem mudança de expectation ou produção; nenhuma mudança de produção foi feita.
