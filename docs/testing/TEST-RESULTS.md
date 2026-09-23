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

## TEST-023 confirmed bug — TDD fix

- Status: `PASS` após correção; a detecção histórica `TEST-023 = FAIL` e o `PRODUCT_BUG_CANDIDATE` permanecem registrados na Wave 3D acima.
- Base utilizada: `origin/main` / `97954efab22f41732a05fe0890478c68ff17f9a7`; branch/worktree: `fix/web-reader-progress-state` / `C:\Users\souno\.codex\worktrees\fix-web-reader-progress-state\LeitorMobile`.
- Data/hora UTC do registro: `2026-09-21T19:35:32Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; nenhum backend, migration, SecurityConfig ou AuthFilter foi alterado.

### Root cause

- `updateBookProgress` já retornava o Book atualizado pelo backend, mas `EpubReader` descartava esse retorno.
- `App.books` mantinha o Book stale; ao fechar e reabrir sem reload, `readingBook` recebia o Book antigo sem `lastCfi`, e o reader iniciava no capítulo 1.
- O RED foi revalidado antes do patch: capítulo 1 → capítulo 2 → PATCH `200`/CFI persistido → reabertura same-session no capítulo 1.

### Production change

- Arquivos: `frontend/src/App.tsx` e `frontend/src/EpubReader.tsx`.
- `EpubReader` agora expõe `onProgressUpdated` e encaminha o Book retornado por `updateBookProgress`, mantendo o `.catch(() => undefined)` tolerante.
- `App` substitui somente o Book com o mesmo ID em `books` e em `readingBook`.
- O efeito de abertura continua dependente de `book.id`; o reader não é remontado a cada PATCH. Não houve `listBooks()` adicional, reload, localStorage de CFI ou PATCH duplicado.

### GREEN

- Cenário principal TEST-023: capítulo 1 → `Próxima` → capítulo 2 → CFI mudou/persistiu → fechar → reabrir sem reload → capítulo 2 restaurado.
- TEST-023 completo: total `3`, pass `3`, failures `0`, errors `0`, skipped `0`, exit code `0`; a execução final durou `33.4s`.
- O cenário diagnóstico com reload permaneceu verde como evidência complementar; não foi usado para satisfazer o acceptance path.
- Missing-file permaneceu somente caracterização: runtime `GET /api/books/{id}/file = 401`, UI de erro e retorno à biblioteca passaram.

### Regression

- Frontend build: `npm run build`, exit code `0`.
- Static tests: `node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs`; total `5`, pass `5`, failures `0`, skipped `0`, exit code `0`.
- TEST-001: total `3`, pass `3`, failures `0`, skipped `0`, exit code `0`.
- TEST-013: total `2`, pass `2`, failures `0`, skipped `0`, exit code `0`.
- TEST-020: total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`.
- TEST-023: total `3`, pass `3`, failures `0`, skipped `0`, exit code `0`.

### Final state

- `PRODUCT_BUG reader progress state: CONFIRMED → FIXED`.
- `TEST-023`: historical detection `FAIL`; final status after fix `PASS`.
- `FOLLOW_UP_REQUIRED`: missing-file HTTP `401` em runtime E2E versus `404` no outro boundary/caminho documentado. Não investigado nem alterado nesta branch.
- TEST IDs alterados: somente `TEST-023`; `TEST-009`, `TEST-027`, `TEST-028`, `TEST-029` e `TEST-039` não foram executados.


## Follow-up — missing book file HTTP status

- Classificação: diagnostic probe/follow-up; nenhum novo TEST ID foi criado ou alterado.
- Base utilizada: `origin/main` / `ff7b4691a6ee87a805315a9bde9670585e5d7a28`.
- Branch/worktree: `probe/missing-book-file-http-status` / `C:\Users\souno\.codex\worktrees\probe-missing-book-file-http-status\LeitorMobile`.
- Data/hora UTC do registro: `2026-09-21T22:00:00Z`.
- Database/schema/usuário: `leitor_test` / `public` / `leitor_test_user`; storage temporário; nenhuma produção foi alterada.

### Controls and comparison

- Controle autenticado `GET /api/books`: `200`; a sessão foi aceita.
- Controle autenticado com EPUB existente `GET /api/books/{id}/file`: `200`, `Content-Type: application/epub+zip`.
- Book próprio sem EPUB armazenado em HTTP real: `404`, corpo JSON de erro do Spring.
- A mesma ausência via MockMvc: `404`.
- Requisição sem Bearer para o Book sem EPUB: `401`.

### Trace

- `BookController.file(id)` foi chamado pelo request autenticado.
- `BookContentService.open(id, false)` foi chamado e emitiu `ResponseStatusException` com status `404 NOT_FOUND` para o EPUB ausente.
- O dispatch de erro ocorreu como `REQUEST → ERROR`, com `/error` envolvido.
- O contexto permaneceu autenticado no request original e no dispatch `ERROR`; o filtro de autenticação de teste registrou os dois estados.
- O status final do HTTP real permaneceu `404`; não houve divergência service/controller → runtime neste harness.

### Verdict

- Verdict: `REFUTED` para a hipótese de conversão genérica do `404` autenticado em `401` pelo boundary HTTP atual.
- Primeiro ponto de divergência: nenhum foi observado na reprodução controlada. O `401` histórico do Playwright não foi reproduzido com o mesmo backend, sessão, storage temporário e HTTP real; permanece uma observação específica de condição/harness anterior, sem evidência suficiente para identificar sua causa exata.
- `PRODUCT_BUG_CANDIDATE`: `NO`.
- Conclusão operacional: o `401` é o comportamento esperado para ausência de autenticação; com sessão válida, o Book próprio sem arquivo retorna `404` tanto em MockMvc quanto em HTTP real.

### Commands and results

- Probe: `mvn -q -Dtest=MissingBookFileHttpStatusProbeTest test`; total `1`, pass `1`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Contrato relacionado: `mvn -q -Dtest=BookControllerApiTest#downloadIsOwnerScopedAndRequiresAnAccessibleManagedFile test`; total `1`, pass `1`, failures `0`, errors `0`, skipped `0`, exit code `0`; MockMvc manteve `404` para o Book próprio sem EPUB.
- TEST-023 permanece `PASS` após o fix de restauração; nenhum outro TEST ID foi executado.
- Arquivos alterados nesta investigação: `MissingBookFileHttpStatusProbeTest.java` e este ledger; nenhum arquivo de produção foi alterado.

## Follow-up correction — missing book file HTTP status

- Classification: corrected diagnostic follow-up; no new TEST ID was created or altered.
- Base: `origin/main` / `122d88a7ec51addd43d90619a2828ca6cd091678`.
- Branch/worktree: `probe/missing-book-file-http-status-v2` / `C:\Users\souno\.codex\worktrees\probe-missing-book-file-http-status-v2\LeitorMobile`.
- Database/schema: `leitor_test` / `public`; owner, session/token and storage were synthetic and isolated.

### Previous probe limitation

- `AuthFilter` production was replaced by a test `@Primary` subclass.
- `shouldNotFilterErrorDispatch()` was forced to `false`.
- The test called `super.doFilterInternal(...)` during `ERROR` dispatch, which could reauthenticate `/error` and mask the production divergence.
- The previous result is therefore reclassified as `INCONCLUSIVE — TEST HARNESS ALTERED AUTH BEHAVIOR`.

### Corrected production-equivalent controls

- A — authenticated `GET /api/books`: `200`.
- B — authenticated `GET /api/books/{id}/file` with EPUB: `200`, `Content-Type: application/epub+zip`.
- C — authenticated own Book without EPUB: run1 `401`, run2 `401`, run3 `401`.
- D — unauthenticated missing-file request: `401`.
- MockMvc authenticated own Book without EPUB: `404` (comparison only).
- Real HTTP decisive result: `401`, repeated consistently across all three C runs.

### Passive tracing

- Used: yes, only after clean C reproduced `401`; a test-only `FilterRegistrationBean` recorded dispatcher, URI, bearer-present boolean, SecurityContext before/after, and response status, then always called `filterChain.doFilter`.
- No `AuthFilter` replacement, `@Primary`, `AuthService` call, SecurityContext write, Authorization-header mutation, response-status mutation, or production dispatcher change was introduced.
- REQUEST: bearer present; the production controller and `BookContentService.open` were called; the request-stage response was `404`.
- ERROR: `/error` involved; bearer present; passive outer-filter context unauthenticated before/after; final response `401`.
- Production AuthFilter ERROR behavior: skipped by the inherited `OncePerRequestFilter` default; v2 did not modify it.
- First divergence: the controller/service path emits `404`, then the `/error` dispatch is handled without an authenticated context and the final HTTP status becomes `401`.

### Verdict

- Verdict: `CONFIRMED`.
- `PRODUCT_BUG_CANDIDATE`: `YES`.
- TEST-023 continues `PASS` independently; no Playwright recheck was executed because the required follow-up rule permits it only when C is consistently `404`.
- Production files changed: `NONE`; `AuthFilter`, `SecurityConfig`, `BookController` and `BookContentService` remain unchanged.
- TEST IDs altered: `NONE`.

### Regression

- Corrected probe: `mvn -q -Dtest=MissingBookFileHttpStatusProbeTest test`; total `1`, pass `1`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Related `BookControllerApiTest`: `mvn -q -Dtest=BookControllerApiTest test`; total `13`, pass `13`, failures `0`, errors `0`, skipped `0`, exit code `0`.
- Backend full regression: `mvn -q test`; total `64`, pass `64`, failures `0`, errors `0`, skipped `0`, exit code `0`; `24` Surefire reports.
- Playwright recheck: not executed because C was `401`, per the requested conditional workflow; TEST-023 expectation and production code were not changed.

## Missing-file HTTP status — confirmed bug TDD fix

- Base: `origin/main` / `3edab74e2ac3e90520cfbe49119affc2fe9c4fe1`.
- Branch/worktree: `fix/http-error-dispatch-security` / `C:\Users\souno\.codex\worktrees\fix-http-error-dispatch-security\LeitorMobile`.
- Database/schema/user: `leitor_test` / `public` / `leitor_test_user`.

### Root cause

- Internal `ERROR` dispatch for `/error` passed through authorization again without the original `SecurityContext`.
- The production `AuthFilter` correctly skipped ERROR dispatch by the inherited `OncePerRequestFilter` default.
- `anyRequest().authenticated()` therefore converted the original authenticated request's `404` into final `401`.

### TDD RED

- Authenticated missing EPUB over real HTTP: `401` (all three runs before the production change).
- Final HTTP: `401`.
- Direct normal REQUEST to `/error` without Bearer: `401`.
- Unauthenticated protected file request: `401`.

### Production change

- File: `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`.
- Added only `dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()` before the existing request matchers.
- This permits the internal ERROR dispatcher type, not `requestMatchers("/error").permitAll()`.
- `AuthFilter`: unchanged.
- `BookContentService`: unchanged.
- No exception handler, URL-wide /error exemption, OPTIONS policy, login policy, actuator policy, or other authorization rule was changed.

### TDD GREEN

- Authenticated `GET /api/books`: `200`.
- Authenticated existing EPUB: `200`.
- Authenticated missing EPUB: run1 `404`, run2 `404`, run3 `404`.
- Unauthenticated protected endpoint: `401`.
- Direct normal REQUEST `GET /error` without Bearer: `401`.
- MockMvc missing EPUB: `404`.

### Error dispatch trace

- REQUEST authenticated: yes; Bearer present; controller and service reached.
- Service status: `ResponseStatusException(404)`.
- ERROR dispatch: `/error` occurred with the Bearer still present.
- AuthFilter rerun: no; it remains skipped for ERROR by production default.
- ERROR authorization: permitted by dispatcher type only.
- Final status: `404`.

### Playwright

- TEST-023 complete: `3/3 PASS`.
- Missing-file HTTP: direct `404`, browser `404`, authorization header present.
- UI error: PASS — “Não foi possível abrir o livro.”
- Return to library: PASS.
- TEST-023 remains PASS; TEST-001, TEST-013 and TEST-020 were not executed because this request prohibits other TEST IDs.

### Regression and security guards

- `mvn -q -Dtest=MissingBookFileHttpStatusProbeTest test`: `1/1` PASS.
- `mvn -q -Dtest=BookControllerApiTest test`: `13/13` PASS.
- `mvn -q test`: total `64`, pass `64`, failures `0`, errors `0`, skipped `0`; `24` Surefire reports.
- Database: `leitor_test`, schema `public`, user `leitor_test_user`.
- Anonymous protected resource: `401`.
- Direct `/error` REQUEST: `401`.
- `/actuator/health`: public and healthy; contract suite passed.
- `/api/auth/login`: policy unchanged; invalid/unknown credentials remain `401` without session creation.

### Verdict

- PRODUCT_BUG HTTP error dispatch: `CONFIRMED → FIXED`.
- No new TEST ID was created or altered.

## Wave 3E — Web library search and covers

### TEST-009

- Status: `PASS`.
- Base: `origin/main` / `b61ce9ad1f72d393b38de115874ec47328055575`.
- Branch/worktree: `test/wave-3e-web-library-search` / `C:/Users/souno/.codex/worktrees/wave-3e-web-library-search/LeitorMobile`.
- Fixture books: `wave-3e-test-009-` prefix; Wave 3E Dragon Atlas (Ari Vale, cover present), Wave 3E Quiet Harbor (Mira SearchAuthor, no cover), Wave 3E Unrelated Chronicle (Elsewhere Writer, no cover).
- Initial state: `3 resultados`; all three fixture tiles were visible.
- Cover-present result: `coverAvailable=true`, `GET /api/books/{id}/cover = 200`, accessible image `Capa de Wave 3E Dragon Atlas` visible.
- Cover-absent result: `coverAvailable=false`; Quiet Harbor remained visible with title and author and had no `<img>`.
- Title search: `Dragon Atlas` returned only Dragon Atlas; count `1 resultados`.
- Author search: `Mira SearchAuthor` returned only Quiet Harbor; count `1 resultados`; the no-cover item remained visible.
- Case-insensitive characterization: `mira searchauthor` returned Quiet Harbor; count `1 resultados`.
- Zero-result state: `wave-3e-no-such-book` returned `0 resultados` with “Nenhum livro encontrado” and “Tente outro título ou autor.”.
- Clear-search state: clearing the field returned all three fixture books and `3 resultados`.
- Network evidence (method/path/status only): `GET /api/books 200`; `GET /api/books?search=Dragon%20Atlas 200`; `GET /api/books?search=Mira%20SearchAuthor 200`; `GET /api/books?search=mira%20searchauthor 200`; `GET /api/books?search=wave-3e-no-such-book 200`; `GET /api/books 200`; `GET /api/books/{id}/cover 200`.
- Focused execution: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/library.spec.ts --grep "TEST-009"`; Chromium, total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`, duration `25.7s`.
- Baseline: frontend build passed; static contracts `5/5`; TEST-001 `3/3`, TEST-013 `2/2`, TEST-020 `1/1`, TEST-023 `3/3`.
- Final regression: build passed; static contracts `5/5`; TEST-001 `3/3`, TEST-009 `1/1`, TEST-013 `2/2`, TEST-020 `1/1`, TEST-023 `3/3`.
- Cleanup: only `wave-3e-test-009-` fixture books were deleted through the normal API cleanup flow; no storage-wide deletion was used.
- Production files changed: `NONE`.
- TEST IDs altered: `TEST-009` only; TEST-001, TEST-013, TEST-020 and TEST-023 remain PASS.

## Wave 3F — Web lexical selection and card creation

### TEST-027

- Status: `FAIL` — `PRODUCT_BUG_CANDIDATE` confirmed in the production UI path; the harness remained production-equivalent.
- Base: `origin/main` / `931ad5e1f405ecec3ea742104e1878aad3d6ece6`.
- Fixture: isolated `wave-3f-test-027-` book with deterministic EPUB containing `The dragon crossed the silver moonspire.`; lexical job reached `COMPLETED`.
- Selection: `dragon` was selected from the real EPUB iframe through DOM Range/Selection and epub.js `selected`; toolbar appeared with the exact preview and actions.
- Found lookup: `GET /api/books/{id}/lexicon/lookup?term=dragon` returned `200`; body lemma `dragon`, translation `dragão`, nonblank local definition; UI displayed `dragon: dragão`.
- Missing selection: exact `silver moonspire` preview and lookup request were observed; `GET /api/books/{id}/lexicon/lookup?term=silver%20moonspire` returned `200` with an empty body, interpreted as `null` by the test-only API helper.
- Missing-result UI: expected `No definition is prepared for this selection yet.` was not displayed. Production `frontend/src/api.ts` attempted `response.json()` on the empty successful body; EpubReader displayed `Unexpected end of JSON input` instead. No translation or definition was invented.
- AI: `APP_AI_ENABLED=false`; no Ollama or external network was used.
- Focused isolated command: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/lexical-selection.spec.ts --grep "TEST-027"`; total `1`, pass `0`, failures `1`, skipped `0`, exit code `1`, test duration about `9.2s`.
- Network evidence (method/path/status only): file `GET .../file 200`; found lookup `GET .../lexicon/lookup?term=dragon 200`; missing lookup `GET .../lexicon/lookup?term=silver%20moonspire 200`.
- Cleanup: only the `wave-3f-test-027-` fixture book was removed through the normal API flow.

### TEST-028

- Status: `PASS`.
- Fixture: independent `wave-3f-test-028-` book and lexical job; no dependency on TEST-027 execution.
- Selection: exact `selectedText=dragon`; toolbar originated from the real EPUB selection path.
- Lookup: `GET /api/books/{id}/lexicon/lookup?term=dragon` returned `200`; response values were used for translation, definition, pronunciation, and part of speech.
- Card creation: UI click on `Criar card` produced `POST /api/cards` status `201`.
- Payload: fixture `bookId`, `selectedText=dragon`, nonblank real `cfiRange`, nonblank chapter title, translation `dragão`, definition/pronunciation/partOfSpeech equal to the real lookup response, `background=""`, `examples=[]`, `relatedWords=[]`; no queueOrder assumption.
- Persistence: `GET /api/cards` returned the active card (`cardId=55effd23-6d10-4361-8f1d-2b6d2ea79fc1` in the combined run), owner-scoped to the fixture book.
- UI presentation: creation status was shown; toolbar cleared; Cards view showed front `dragon`; flip showed `dragão` and the lexical definition.
- Network evidence (method/path/status only): file `GET .../file 200`; lookup `GET .../lexicon/lookup?term=dragon 200`; create `POST /api/cards 201`; list `GET /api/cards?includeArchived=false 200`.
- Focused isolated command: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/lexical-selection.spec.ts --grep "TEST-028"`; total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`, duration `27.2s`.
- Cleanup: only the `wave-3f-test-028-` fixture book was removed; related cards were removed by the normal book cascade and verified absent.

### Combined and regression verification

- Combined command: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/lexical-selection.spec.ts --grep "TEST-027|TEST-028"`; total `2`, pass `1`, failures `1`, skipped `0`, exit code `1`, duration `37.3s`.
- `npm run build`: passed.
- Static contracts (`book-upload.test.mjs`, `card-creation.test.mjs`, `lexicon-entry-contract.test.mjs`, `lexicon-lookup.test.mjs`, `lexicon-start.test.mjs`): total `5`, pass `5`, failures `0`, skipped `0`.
- TEST-001: `3/3 PASS`.
- TEST-009: `1/1 PASS`.
- TEST-013: `2/2 PASS`.
- TEST-020: `1/1 PASS`.
- TEST-023: `3/3 PASS`.
- Production files changed: `NONE`.
- TEST IDs altered: `TEST-027` and `TEST-028` only. TEST-029 and TEST-039 were not executed.

### Verdict

- `PRODUCT_BUG_CANDIDATE`: `YES` — missing lexical lookup returns successful HTTP 200 with an empty body, while the production client requires JSON and surfaces a parsing error instead of the intended empty-result message.
- `TEST_INFRASTRUCTURE`: no remaining selection-harness issue; the real iframe selection and epub.js toolbar path were exercised.
- Recommendation: `DO NOT MERGE — bug fix required`.

## TEST-027 confirmed bug — nullable API response TDD fix

- Base: branch `fix/web-nullable-api-response` created from RED commit `24984dcbf58dbb449d63693e257f6c1ab7998179`.

### Root cause

- The generic frontend `request<T>()` called `response.json()` for every successful non-204 response.
- `LexiconService.lookup(...)` and `LexiconService.status(...)` return `null` when no entry/job exists; Spring exposed that runtime contract as HTTP `200` with an empty body.
- The empty lookup body therefore raised `Unexpected end of JSON input` before EpubReader could handle `!entry`.

### TDD RED

- TEST-027 before the fix: `FAIL`.
- Found lookup: HTTP `200`, lemma `dragon`, translation `dragão`, UI `dragon: dragão`.
- Missing lookup: HTTP `200`, empty body for `silver moonspire`.
- UI result: `Unexpected end of JSON input` instead of the intended empty-result message.
- The nullable static contract also failed because `requestNullable` did not exist.

### Production change

- File changed: `frontend/src/api.ts` only.
- Added shared `requestResponse(...)` for headers, auth-session cleanup on `401`, and HTTP error handling.
- Kept generic `request<T>()` strict: `204` remains `undefined`; other successful responses still require JSON.
- Added `requestNullable<T>()`: successful empty body becomes `null`; JSON body becomes `T`; HTTP errors preserve the existing error behavior.
- `lookupBookLexicon(...)` now uses `requestNullable<LexiconEntry>(...)`.
- `getBookLexiconJob(...)` now uses `requestNullable<LexiconJob>(...)`.
- No changes to EpubReader, Card code, backend, database, migrations, or security configuration.

### GREEN

- TEST-027: `PASS`; total `1`, pass `1`, failures `0`, skipped `0`, isolated duration `30.5s`.
- Found result: lookup `200`; UI `dragon: dragão`.
- Missing result: lookup `200` with empty body; frontend value `null`.
- UI result: `No definition is prepared for this selection yet.`; prior `dragão` content did not leak.
- `Unexpected end of JSON input`: absent.
- TEST-028: `PASS`; POST `/api/cards = 201`, card persisted, front `dragon`, back `dragão` plus definition.

### No-job nullable contract

- A newly uploaded Book with no lexical job returned the observed nullable runtime contract through `GET /api/books/{id}/lexicon/jobs/latest`: HTTP `200`, empty body; the fixture parser resolved `null` before the job was started.
- The frontend static contract verifies that `getBookLexiconJob` is wired to `requestNullable<LexiconJob>`.

### Verification

- Combined TEST-027 + TEST-028: `2/2 PASS`.
- Build: `npm run build` passed.
- Static contracts: `6/6 PASS`, including `nullable-api-response.test.mjs`.
- TEST-001: `3/3 PASS`.
- TEST-009: `1/1 PASS`.
- TEST-013: `2/2 PASS`.
- TEST-020: `1/1 PASS`.
- TEST-023: `3/3 PASS`.
- TEST-029 and TEST-039 were not executed.

### Verdict

- `PRODUCT_BUG nullable API response`: `CONFIRMED → FIXED`.
- TEST-027 historical detection: `FAIL`; final status: `PASS`.
- TEST-028: `PASS`.

## Wave 3G — Web lexical modal component

### TEST-029

- Status: `PASS`.
- Level: `COMPONENT`; Purpose `CONTRACT`; Priority `P1`; Surface `WEB`.
- Base: `origin/main` at `02628dd3acba2c7bed7ebf8ffd7c5665b2e52b63`; branch `test/wave-3g-lexicon-modal-component`.
- Harness: Vite-only page plus Playwright Chromium component driver; `BookProcessingDetailsModal` was rendered directly with controlled props. `App` was not rendered.
- Backend used: `NO`; database used: `NO`; API network calls: `NONE` — the spec recorded zero `/api/` requests.
- Synthetic job: fixed `COMPLETED` job; synthetic book title `TEST-029 Lexical Modal`.
- Sense fixture: lemma `dragon`; top-level `translationPtBr=''` and `definition=''`; `senses[0].translationPtBr='tradução por sentido'`; `senses[0].definition='definition from sense'`; `bookFrequency=7`; part of speech `noun`; IPA `/ˈdræɡən/`; CEFR `A2`; status `RESOLVED_LOCAL`; one sense.
- Sense fixture result: the real component interaction `input → Consultar → local onLookup Promise → render` showed `dragon`, `noun · 7 ocorrências`, `definition from sense`, `tradução por sentido`, `/ˈdræɡən/`, `A2`, `RESOLVED_LOCAL`, and `1 sentido(s) catalogado(s)`.
- Optional-fields fixture: lemma `mystery`, `partOfSpeech=null`, `senses=[]`, and optional lexical fields absent. Observed current behavior: `Classe não informada`, `0 ocorrências`, `Sem definição disponível.`, `Sem tradução disponível.`, `—` for IPA/CEFR, `UNRESOLVED`, and `0 sentido(s) catalogado(s)`.
- Null lookup: not covered; the modal-specific TEST-029 scope used the found-entry and optional-fields fixtures. Error lookup: not covered.
- Static contract: `lexicon-entry-contract.test.mjs` remains green and verifies `senses[0]?.translationPtBr`, `bookFrequency`, and the absence of `senses[0]?.translation` and `currentEntry?.frequency`.
- Focused component command: `npx --no-install playwright test --config=component-tests/playwright.config.ts component-tests/lexicon-modal.spec.ts --grep TEST-029`; Chromium, total `2`, pass `2`, failures `0`, skipped `0`, exit code `0`, final duration `4.4s`.
- Baseline/final build: `npm run build` exit code `0`.
- Static tests: six tests, six pass, zero failures, zero skipped, exit code `0`.
- Lexical E2E regressions: TEST-027 total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`, duration `42.4s`; TEST-028 total `1`, pass `1`, failures `0`, skipped `0`, exit code `0`, duration `36.5s`.
- TEST-027 network evidence remained found lookup `200`, missing lookup `200` with empty body, and the expected no-result handling; TEST-028 retained real card creation `201` and owner-scoped card listing `200`.
- Production files changed: `NONE`.
- TEST IDs altered: `TEST-029` only. TEST-027 and TEST-028 were reexecuted only as related regression; TEST-039 was not executed.

### Verdict

- `PRODUCT_BUG_CANDIDATE`: none.
- `TEST_INFRASTRUCTURE`: none; the component was isolated from `App`, backend, database, and external network.
- Recommendation: `MERGE SAFE`.

## Wave 3H — Web cards lifecycle

### TEST-039

- Status: `PASS`.
- Base: `origin/main` / `3ae005f98ea1991a24667f88b7e15583b4d621e6`.
- Branch/worktree: `test/wave-3h-web-cards-lifecycle` / `D:\LeitorMobile\frontend\dist\wave-3h-worktree`.
- Own fixture: one Book created by API only to satisfy the card foreign key; title `Wave 3H Cards Lifecycle`, own fixture prefix `wave-3h-test-039-`.
- Own cards: CARD-A `wave-3h-alpha`, CARD-B `wave-3h-beta`, CARD-C `wave-3h-gamma` created in that order by API; CARD-D `wave-3h-archived` created and archived by API before the UI opened.
- Pre-UI API: `GET /api/cards?includeArchived=false` returned A/B/C only; `GET /api/cards?includeArchived=true` returned A/B/C/D and D was archived. No value, formula, uniqueness, or consecutiveness assertion was made for `queueOrder`.
- Initial UI: Cards navigation issued `GET /api/cards?includeArchived=false = 200`; heading `Cards de estudo`; current A `wave-3h-alpha`; counter `3 na fila`; archived D was not visible.
- Flip: the real card view showed A's `alpha traduzido` and `alpha definition`.
- Edit UI: `Editar` changed selected text to `wave-3h-alpha-edited`, translation to `alpha editado`, and definition to `alpha edited definition`; UI `PATCH /api/cards/{A}` returned `200`; modal closed and the UI updated.
- Edit persistence: API verification found the edited fields on A; navigating `Biblioteca → Cards` triggered a fresh active-card GET and A remained edited.
- Archive UI: `Arquivar` on A used `POST /api/cards/{A}/archive = 200`; active UI became B with `2 na fila`; active API list excluded A and includeArchived API list showed A archived.
- Archive persistence: navigating `Biblioteca → Cards` triggered another active-card GET; A stayed out and B remained current.
- Move-to-end UI: `Rever depois` on B used `POST /api/cards/{B}/move-to-end = 200`; immediate next card was C.
- Move persistence: API active order had C before B, and after another `Biblioteca → Cards` reload the UI still showed C; API order still had C before B.
- Missing resource: one authenticated `PATCH /api/cards/{missing}` returned `404`; response contained no card payload or other-owner card data.
- Cross-owner fixture: PostgreSQL test-only seed created one synthetic `app_users`, one `books`, and one `cards` row with generated UUIDs and `wave-3h-test-039-other-<uuid>@example.test`; the principal user's `GET /api/cards?includeArchived=true` did not expose it.
- Cross-owner mutation: principal-user `PATCH /api/cards/{other}` returned `404`; the response contained no card payload; direct DB verification confirmed the other card remained with `selected_text=wave-3h-other-owner-card`.
- Direct PostgreSQL use: `TEST FIXTURE ONLY`; host `127.0.0.1`, database `leitor_test`, user `leitor_test_user`, password passed only through `PGPASSWORD`; `psql --version` returned `16.14`.
- Network evidence (method/path/status only): UI list `GET /api/cards?includeArchived=false = 200` on initial/edit/archive/move reloads; `PATCH /api/cards/{A} = 200`; `POST /api/cards/{A}/archive = 200`; `POST /api/cards/{B}/move-to-end = 200`; negative list `GET /api/cards?includeArchived=true = 200`; missing and cross-owner `PATCH /api/cards/{id} = 404`.
- UI evidence: initial A / 3 na fila; after edit A-edited; after archive B / 2 na fila; after move C; after reload C.
- Numeric `queueOrder` assertions: `NONE`.
- Cleanup: own Book removed through API with FK cascade; fixture cards absent; other-owner user removed by exact generated owner ID with cascade; final fixture absence confirmed; no truncate or whole-database cleanup.
- Focused command: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/cards.spec.ts --grep "TEST-039"`; Chromium, total `2`, pass `2`, failures `0`, skipped `0`, exit code `0`, duration `36.0s`.
- Production files changed: `NONE`.
- TEST IDs altered: `TEST-039` only.

## Wave 3 — Closure

- Final build: `npm run build` exit code `0`.
- Static tests: `book-upload.test.mjs`, `card-creation.test.mjs`, `lexicon-entry-contract.test.mjs`, `lexicon-lookup.test.mjs`, `lexicon-start.test.mjs`, `nullable-api-response.test.mjs`; total `6`, pass `6`, failures `0`, skipped `0`, exit code `0`.
- Final E2E_WEB regression command: `npx --no-install playwright test --config=e2e/playwright.config.ts e2e/specs/library.spec.ts e2e/specs/upload.spec.ts e2e/specs/reader.spec.ts e2e/specs/lexical-selection.spec.ts e2e/specs/cards.spec.ts --grep "TEST-001|TEST-009|TEST-013|TEST-020|TEST-023|TEST-027|TEST-028|TEST-039"`; Chromium, total `14`, pass `14`, failures `0`, skipped `0`, exit code `0`, duration `56.6s`.
- Final component regression: `npx --no-install playwright test --config=component-tests/playwright.config.ts component-tests/lexicon-modal.spec.ts --grep "TEST-029"`; Chromium, total `2`, pass `2`, failures `0`, skipped `0`, exit code `0`, duration `4.3s`.
- TEST-001: `PASS`.
- TEST-009: `PASS`.
- TEST-013: `PASS`.
- TEST-020: `PASS`.
- TEST-023: `PASS`.
- TEST-027: `PASS`.
- TEST-028: `PASS`.
- TEST-029: `PASS`.
- TEST-039: `PASS`.
- Wave 3 final: `9/9 PASS`.
- Bugs discovered during Wave 3 and already fixed: reader same-session progress/CFI stale state; HTTP ERROR dispatch `404 → 401`; nullable frontend API responses.
- QueueOrder was discovered in Wave 2 and is not attributed to Wave 3; TEST-041/TEST-042 remain the numeric queue-order coverage.
- `PRODUCT_BUG_CANDIDATE`: none.
- `SECURITY_BUG_CANDIDATE`: none; owner list isolation, missing resource behavior, and cross-owner mutation were verified.
- `TEST_INFRASTRUCTURE`: none in final execution; initial local Playwright CLI absence was resolved by installing the locked frontend dev dependencies in the isolated worktree, with no source or production change.
- Recommendation: `WAVE 3 COMPLETE — MERGE SAFE`.

## Wave 4 preflight — Jest discovery infrastructure fix

- Previous result: Wave 4A `BLOCKED` / `TEST_INFRASTRUCTURE`.
- Root cause: the configured `<rootDir>/src/**/*.test.ts` was expanded to an absolute Windows glob with mixed path separators, so Jest discovered zero tests.
- Before: `jest --listTests` returned `0`; the filesystem contained exactly 10 `src/**/*.test.ts` files.
- Production change: `NONE`.
- Test infrastructure change: `leitor-epub/package.json` now scopes Jest with `roots: ["<rootDir>/src"]` and uses the relative `testMatch: ["**/*.test.ts"]`.
- After: `jest --listTests` returned exactly `10`; all paths were under `leitor-epub/src`, with none from `node_modules`, `build`, `dist`, or `android`.
- Full baseline: `npm test -- --runInBand` — `10` suites, `41` tests, `41` passed, `0` failures, `0` skipped, exit code `0`; Jest duration `6.035s`.
- Typecheck: `npm run typecheck` — PASS, exit code `0`.
- Explicit runner check: `src/db/migrations.test.ts` — `1` suite, `2` tests passed; runner and transform were functional after discovery was fixed.
- Import-focused preflight: `src/services/epubImport.test.ts` and `src/services/epubSecurity.test.ts` — `2` suites, `17` tests passed, `0` failures, `0` skipped, exit code `0`; Jest duration `7.019s`.
- Dependency changes: none; no dependency installation was performed for this fix and `package-lock.json` is unchanged.
- Device/emulator/Android: not used.
- TEST IDs altered: `NONE`.
- `TEST-018`: `NOT EXECUTED` as Wave 4A.
- `TEST-050`: `NOT EXECUTED` as Wave 4A.
- `TEST_INFRASTRUCTURE`: discovery fix verified; no production behavior was changed.
- Recommendation: retry Wave 4A from updated main; do not resume Wave 4A in this infrastructure-fix branch.
