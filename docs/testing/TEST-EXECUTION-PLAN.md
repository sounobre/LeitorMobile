# Test Execution Plan

> **For agentic workers:** use `superpowers:subagent-driven-development` or `superpowers:executing-plans` when this plan is executed in a later phase. Each wave is an execution gate; this document itself does not implement tests.

**Goal:** Executar incrementalmente os TEST-001–TEST-060 da `TEST-MATRIX`, produzindo estados verificáveis, evidência reproduzível e decisões separadas de correções.

**Architecture:** O plano usa waves por harness, risco e infraestrutura compartilhada. A atribuição primária abaixo coloca cada TEST exatamente uma vez, enquanto algumas waves também aparecem como lentes de dependência (por exemplo, os testes mobile `AUTOMATABLE_NOW` são inventariados na Wave 1 e executados na lane sem device da Wave 4). Nenhuma expectativa normativa é criada fora da matriz.

**Tech Stack:** Java 21/Spring Boot 3.4.5/Maven/JUnit 5/MockMvc/Mockito; PostgreSQL 16/Flyway; Node/npm; React/Vite/TypeScript; Expo 57/React Native 0.86.3/Jest Expo; filesystem local; Playwright CLI apenas para `E2E_WEB`; Android emulator/device e ferramenta compatível ainda não decidida para mobile nativo.

**Spec:** `docs/testing/TEST-STRATEGY.md` e `docs/testing/TEST-MATRIX.md`, contra a baseline congelada em `docs/codebase/*`, `docs/system/SYSTEM-OVERVIEW.md`, `docs/system/CAPABILITIES.md`, `docs/system/API-CATALOG.md` e `docs/system/USER-JOURNEYS.md`.

## Global Constraints

- A `TEST-MATRIX.md` é a fonte de verdade para ID, Purpose, Priority, Level, Surface, Automation status e Expected.
- Esta etapa produz somente plano: não implementar testes, não alterar produção, banco ou migrations, não criar fixtures, não executar Playwright e não criar issues no Linear.
- O texto `Expected` da matriz não pode ser promovido, reescrito ou completado com uma decisão de produto neste plano.
- `CHARACTERIZATION` observa o código atual; `INTENT_REQUIRED` não recebe assertion normativa; `DEFECT_PROBE` não recebe correção implícita.
- Todo resultado futuro deve ser registrado por TEST ID no ledger, com evidência fresca antes de qualquer declaração de conclusão.
- `systematic-debugging` será usado para falha inesperada, comportamento anômalo ou BUG confirmado, antes de propor correção.
- `test-driven-development` será usado somente quando uma anomalia confirmada exigir correção de produção: teste vermelho reproduzível, correção mínima e teste verde.
- `verification-before-completion` será usado antes de declarar TEST ou ticket concluído, exigindo comando completo, saída lida e evidência correspondente.
- `code-review-and-quality` será usado após implementação relevante de teste ou correção, cobrindo correção, legibilidade, arquitetura, segurança e performance.
- `playwright-cli` será usado somente na Wave 3, nos `E2E_WEB` planejados; nunca substitui `E2E_MOBILE` ou `DEVICE`.

## 1. Regras de execução e atribuição dos TESTs

As waves são gates técnicos, não uma fila linear TEST-001 → TEST-060. O trabalho deve avançar quando a saída da wave anterior for revisável, mas lanes independentes podem começar em paralelo depois que seus próprios pré-requisitos estiverem satisfeitos.

### Atribuição primária, sem perda de cobertura

| Wave | Escopo primário | TEST IDs | Quantidade primária |
|---|---|---|---:|
| 0 | Baseline executável de suítes já existentes; não adiciona cenário | — | 0 |
| 1 | `AUTOMATABLE_NOW` de backend/API/operator, mantendo todos os 17 no inventário | TEST-002, TEST-003, TEST-010, TEST-014, TEST-015, TEST-021, TEST-024, TEST-040, TEST-047, TEST-058, TEST-059, TEST-060 | 12 |
| 2 | Probes do `BUG_CANDIDATE` de `queueOrder` | TEST-041, TEST-042 | 2 |
| 3 | Oito `E2E_WEB` e o componente web que compartilha a infraestrutura de fonte/contrato | TEST-001, TEST-009, TEST-013, TEST-020, TEST-023, TEST-027, TEST-028, TEST-029, TEST-039 | 9 |
| 4 | Mobile sem device: existentes, Jest, services/repositories/validation e integração de backup controlável | TEST-012, TEST-018, TEST-026, TEST-031, TEST-035, TEST-037, TEST-049, TEST-050 | 8 |
| 5 | `E2E_MOBILE` e `DEVICE` | TEST-004, TEST-011, TEST-017, TEST-019, TEST-022, TEST-025, TEST-030, TEST-032, TEST-033, TEST-034, TEST-036, TEST-038, TEST-043, TEST-048, TEST-051, TEST-052, TEST-053 | 17 |
| 6 | Integração de jobs e sync compartilhado; intent fica em gate da Wave 8 | TEST-005, TEST-044, TEST-045, TEST-046 | 4 |
| 7 | Startup, Kaikki e recovery operacional não bloqueado por intenção | TEST-054, TEST-056, TEST-057 | 3 |
| 8 | Decisões humanas que liberam assertions normativas | TEST-006, TEST-007, TEST-008, TEST-016, TEST-055 | 5 |

As seguintes sobreposições são deliberadas e não representam testes duplicados:

- A Wave 1 inventaria os 17 `AUTOMATABLE_NOW`; os cinco mobile (`TEST-018`, `TEST-031`, `TEST-035`, `TEST-037`, `TEST-050`) têm execução primária na Wave 4 para manter a separação sem-device.
- A Wave 4 também amplia `TEST-012` e `TEST-026`, classificados como `EXISTING`, e usa `TEST-049` como integração mobile sem device real.
- A Wave 6 observa todos os cenários de sync relevantes; `TEST-006`, `TEST-007`, `TEST-008` e `TEST-016` só podem receber verdict normativo na Wave 8.
- A Wave 7 cobre a lente operacional completa (`TEST-054`–`TEST-060`); `TEST-055` é primário na Wave 8 e `TEST-058`–`TEST-060` são primários na Wave 1.

### Sequência recomendada

1. Fechar a Wave 0 sem alterar nenhum FAIL encontrado.
2. Executar a lane backend/API da Wave 1 e a lane mobile sem device da Wave 4 em paralelo quando o ambiente correspondente estiver disponível.
3. Executar os probes da Wave 2 antes de qualquer aceitação que dependa de ordenação de cards.
4. Preparar uma única infraestrutura web da Wave 3 e priorizar nela os quatro P0: `TEST-001`, `TEST-013`, `TEST-020`, `TEST-023`.
5. Só depois preparar a decisão de ferramenta e o harness da Wave 5.
6. Executar a caracterização cross-surface da Wave 6 antes de usar seus resultados como requisito.
7. Executar a operação sintética da Wave 7 e consolidar perguntas da Wave 8.

## 2. Wave 0 — BASELINE EXECUTÁVEL

### Objetivo e estado inicial

Antes de adicionar qualquer teste, executar em um checkout limpo da baseline os comandos já declarados. Nesta etapa os comandos **não serão executados**. O estado correto agora é `NOT_RUN`; após a execução, cada linha deve ser convertida em `PASS`, `FAIL` ou `BLOCKED`.

Um resultado histórico citado em `docs/codebase/TESTING.md` é evidência anterior, não substitui uma baseline fresca para esta fase. Nenhum FAIL da nova baseline pode ser corrigido automaticamente.

### Pré-requisitos de ambiente

| Recurso | Requisito a verificar na execução futura | Evidência de configuração |
|---|---|---|
| Java/Maven | Java 21 e Maven disponíveis; backend usa Spring Boot 3.4.5 | `backend/pom.xml` |
| Node/npm | Node compatível com web e Node `>=20.19.4` para mobile; npm disponível | `leitor-epub/package.json` (`engines.node`) |
| PostgreSQL | PostgreSQL 16, preferencialmente pelo Compose; banco isolado para a execução | `docker-compose.yml`, `backend/src/main/resources/application.yml` |
| Filesystem | Diretório temporário gravável para livros/capas; nenhum teste deve reutilizar `backend/data/library` sem isolamento explícito | `BookContentService` usa `app.storage-directory`, default `./data/library` |
| Frontend | Dependências instaladas em `frontend/`; Vite servido na porta 5173 quando necessário | `frontend/package.json`, `frontend/vite.config.ts` |
| Expo/Jest | Expo ~57.0.20, React Native 0.86.3, preset `jest-expo`, `testMatch` em `src/**/*.test.ts` | `leitor-epub/package.json` |
| Ollama | Não é pré-requisito para unitários; caso o startup o alcance, registrar configuração, não mascarar indisponibilidade | `application.yml` ativa profile `ollama`; `docker-compose.ollama.yml` é opcional |

Variáveis a fornecer somente no processo de execução futura, sem gravar segredos:

- Backend: `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `PORT`, `CORS_ALLOWED_ORIGINS`, `APP_AUTH_EMAIL`, `APP_AUTH_PASSWORD`.
- Web: `VITE_API_URL`, normalmente `http://localhost:8080/api`.
- Mobile: `EXPO_PUBLIC_API_URL`, normalmente `http://10.0.2.2:8080/api` no emulador Android.
- Storage: `app.storage-directory` apontando para um diretório temporário por run quando a configuração do backend permitir.

O banco de baseline deve ser isolado do banco de desenvolvimento. A criação/reset desse banco pertence à execução futura, não a esta etapa de planejamento; não reaproveitar volume persistente sem registrar o estado e a estratégia de limpeza.

### Comandos planejados

| Suíte/gate | Diretório | Comando futuro | Resultado exigido após execução |
|---|---|---|---|
| Build backend | `backend/` | `mvn -q -DskipTests package` | `PASS` se exit code 0; `FAIL` para erro reproduzível de build; `BLOCKED` se Java/Maven/dependência indisponível |
| Testes backend existentes | `backend/` | `mvn -q test` | `PASS`/`FAIL`/`BLOCKED`; saída completa e relatório Surefire preservados |
| Build frontend | `frontend/` | `npm run build` | `PASS` se TypeScript/Vite terminarem com exit code 0 |
| Testes web estáticos existentes | `frontend/` | `node --test book-upload.test.mjs card-creation.test.mjs lexicon-entry-contract.test.mjs lexicon-lookup.test.mjs lexicon-start.test.mjs` | `PASS`/`FAIL`/`BLOCKED`; estes testes não são E2E |
| Jest mobile existente | `leitor-epub/` | `npm test -- --runInBand` | `PASS`/`FAIL`/`BLOCKED`; preservar contagem de suites/testes |
| Typecheck mobile | `leitor-epub/` | `npm run typecheck` | `PASS`/`FAIL`/`BLOCKED`; gate de ambiente, não cenário novo |
| Lint mobile | `leitor-epub/` | `npm run lint` | `PASS`/`FAIL`/`BLOCKED`; FAIL existente deve ser evidenciado, não corrigido nesta baseline |

`frontend/src/bookDetails.test.ts` é uma evidência de teste TypeScript existente, mas não está incluído no script `node --test` declarado. Sua cobertura deve ser registrada como existente/adjacente até que um harness explícito seja planejado; não contar como PASS de uma suíte que não foi executada.

### Ledger da baseline

| Suíte | Estado agora | Estado permitido ao fechar Wave 0 | Evidência mínima |
|---|---|---|---|
| Backend build | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, Java/Maven, exit code, log |
| Backend tests | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, Postgres/banco, Surefire/log |
| Frontend build | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, Node/npm, dist/log |
| Web static tests | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, contagem, stdout |
| Mobile Jest | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, Node/npm, suites/testes |
| Mobile typecheck | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando e saída TypeScript |
| Mobile lint | `NOT_RUN` | `PASS`/`FAIL`/`BLOCKED` | comando, erros/warnings completos |

Regra de falha: qualquer FAIL inesperado, erro de build ou comportamento diferente do documentado aciona `systematic-debugging` — ler erro completo, reproduzir, verificar configuração e fluxo de dados, formular uma hipótese única e registrar evidência. A Wave 0 não corrige nem altera a baseline; a decisão posterior pode ser “corrigir”, “aceitar como baseline conhecida” ou “bloquear dependentes”.

## 3. Wave 1 — AUTOMATABLE_NOW

Esta wave identifica todos os 17 cenários com `Automation status: AUTOMATABLE_NOW` e os ordena por P0, P1 e P2. As cinco linhas mobile são descritas aqui para cumprir o inventário completo, mas sua execução primária ocorre na Wave 4, que mantém a separação sem device.

Fila explícita: P0 = `TEST-002`, `TEST-003`, `TEST-010`, `TEST-014`, `TEST-015`, `TEST-018`, `TEST-021`, `TEST-024`, `TEST-040`, `TEST-050`; P1 = `TEST-031`, `TEST-035`, `TEST-037`, `TEST-047`, `TEST-058`; P2 = `TEST-059`, `TEST-060`.

Regra comum das linhas abaixo: nenhuma fixture será criada agora; fixtures futuras devem ser sintéticas, pequenas, determinísticas e não conter segredos. O comando unitário/API deve rodar primeiro e a suíte completa depois. Para cada implementação futura, aplicar `verification-before-completion`; após mudança relevante, aplicar `code-review-and-quality`. `systematic-debugging` só entra em falha inesperada; `test-driven-development` só entra se a investigação confirmar necessidade de correção de produção.

### P0 — primeiro

#### TEST-002 — Login web rejeita credencial inválida

- `Purpose / Priority / Expected`: `ACCEPTANCE / P0`. **Expected (matriz):** “A autenticação falha conforme o contrato observado; não é criada sessão autenticada.”
- **Arquivos:** criar `backend/src/test/java/br/com/leitormobile/auth/AuthControllerTest.java`; não criar teste de UI paralelo.
- **Harness existente:** Spring Boot Test + MockMvc, seguindo `SecurityConfigTest.java`; banco de teste para usuário/credencial.
- **Fixture:** usuário de teste explicitamente provisionado, senha incorreta e e-mail inexistente; não fixar mensagem/status não demonstrados.
- **Comando:** `cd backend; mvn -q -Dtest=AuthControllerTest test`, depois `mvn -q test`.
- **Dependências:** banco PostgreSQL isolado/Flyway e credenciais de teste injetadas; não depende do browser.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` em falha inesperada; TDD somente para bug confirmado.
- **Concluído quando:** os dois casos negativos não criam sessão utilizável, o resultado está no ledger e a suíte backend/regressão foi lida.

#### TEST-003 — API autenticada rejeita token ausente ou inválido

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “O filtro de segurança rejeita a chamada não autenticada conforme o contrato; não há acesso ao owner.”
- **Arquivos:** modificar `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java`; ampliar o teste existente em vez de abrir uma suíte de segurança paralela.
- **Harness existente:** `@SpringBootTest(classes = LeitorBackendApplication.class)`, `@AutoConfigureMockMvc` e MockMvc.
- **Fixture:** request sem Bearer, token malformado e token expirado; manter o caso direto já existente.
- **Comando:** `cd backend; mvn -q -Dtest=SecurityConfigTest test`, depois `mvn -q test`.
- **Dependências:** configuração de segurança e usuário/sessão de teste; não exigir browser.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para divergência inesperada; TDD somente se surgir correção de produção.
- **Concluído quando:** ausência, malformação e expiração não obtêm acesso autenticado, sem remover o caso existente, com evidência dos requests/respostas.

#### TEST-010 — Contrato de listagem web respeita pesquisa e owner

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “A resposta contém apenas itens permitidos ao owner e respeita a busca; capa ausente, inexistente ou não autorizada segue o contrato documentado sem expor arquivo de outro owner.”
- **Arquivos:** criar `backend/src/test/java/br/com/leitormobile/book/BookControllerApiTest.java`; reutilizar este arquivo para os contratos de livros desta wave.
- **Harness existente:** MockMvc/Spring Boot Test para endpoints e PostgreSQL isolado para dois owners.
- **Fixture:** dois owners, livros com títulos/autores distintos, capa disponível/ausente, busca vazia, por título/autor, sem resultado e IDs de outro owner.
- **Comando:** `cd backend; mvn -q -Dtest=BookControllerApiTest test`, depois `mvn -q test`.
- **Dependências:** schema Flyway, storage temporário para capas e sessão Bearer; não afirmar status/mensagem fora do catálogo.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` se houver vazamento/erro inesperado.
- **Concluído quando:** respostas e efeitos confirmam isolamento/filtragem/capa conforme catálogo, sem duplicar o teste de service.

#### TEST-014 — Contrato de criação web do registro e fileHash

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “Request válido cria registro do owner; campos obrigatórios, normalizações/defaults, ownership e duplicidade de fileHash seguem o contrato de API-004. A comparação entre fileHash e SHA-256 do EPUB pertence ao upload de API-005.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/book/BookControllerApiTest.java`.
- **Harness existente:** MockMvc + PostgreSQL/Flyway do harness API de livros.
- **Fixture:** request válido, obrigatórios ausentes, valores normalizáveis, `fileHash` duplicado e tentativa com ownership inválido; não incluir EPUB neste teste.
- **Comando:** `cd backend; mvn -q -Dtest=BookControllerApiTest test`, depois `mvn -q test`.
- **Dependências:** usuário/owner e estado de livro controlados; TEST-015 cobre SHA-256 do conteúdo.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para divergência; TDD só em correção confirmada.
- **Concluído quando:** API-004 fica coberta sem misturar a validação de upload de API-005, e os campos não especificados permanecem observacionais.

#### TEST-015 — Upload web valida ownership, tamanho, hash e caminho

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “Upload válido cujo SHA-256 corresponde ao fileHash persistido armazena o conteúdo permitido; tamanho, SHA-256 divergente, path e ownership inválidos são rejeitados conforme o contrato observado e não confirmam o armazenamento daquele conteúdo.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/book/BookControllerApiTest.java`; usar helper de filesystem de teste apenas dentro da suíte.
- **Harness existente:** MockMvc multipart + `BookContentService` real com diretório temporário + PostgreSQL isolado.
- **Fixture:** EPUB mínimo válido com hash correspondente, hash divergente, arquivo acima de 100 MB, ausente, owner diferente e path fora da raiz; validação estrutural forte fica em TEST-016.
- **Comando:** `cd backend; mvn -q -Dtest=BookControllerApiTest test`, depois `mvn -q test`.
- **Dependências:** registro criado por TEST-014, storage temporário gravável e cleanup por teste.
- **Skills:** `verification-before-completion`, `code-review-and-quality`, `systematic-debugging` para efeitos de arquivo inesperados.
- **Concluído quando:** upload válido deixa efeito observável dentro do root permitido e cada negativo não confirma armazenamento indevido.

#### TEST-021 — Exclusão web isola ownership e rejeita livro ausente/path inseguro

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “Somente o recurso autorizado é removível; livro ausente, owner incorreto, sessão inválida ou path inseguro são rejeitados conforme contrato, sem apagar recurso de outro owner.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java` para ownership/path no service; ampliar `BookControllerApiTest.java` para contrato HTTP, ausência de sessão e owner.
- **Harness existente:** Mockito + filesystem temporário no `BookServiceTest`; MockMvc/PostgreSQL no contrato API.
- **Fixture:** dois owners, livro próprio, alheio, ausente, arquivo fora da raiz, requests autenticados e não autenticados.
- **Comando:** `cd backend; mvn -q -Dtest=BookServiceTest,BookControllerApiTest test`, depois `mvn -q test`.
- **Dependências:** o teste existente de remoção e path externo deve continuar; cleanup nunca deve apagar o diretório de desenvolvimento.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para qualquer remoção fora do escopo.
- **Concluído quando:** service e HTTP isolam owner e não removem recurso em negativo, com o caso existente preservado.

#### TEST-024 — Contrato de download e progresso rejeita acesso/valores inválidos

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “Apenas recurso autorizado com arquivo acessível é entregue; requests inválidos ou não autorizados são rejeitados conforme contrato e não persistem progresso inválido.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/book/BookControllerApiTest.java`.
- **Harness existente:** MockMvc + PostgreSQL/storage temporário.
- **Fixture:** dois owners, arquivo próprio, livro sem arquivo, ID ausente, owner diferente, progresso abaixo/acima do domínio e CFI vazio/inválido.
- **Comando:** `cd backend; mvn -q -Dtest=BookControllerApiTest test`, depois `mvn -q test`.
- **Dependências:** contratos API do catálogo e estado persistido limpo entre casos; não inventar status.
- **Skills:** `verification-before-completion`, `code-review-and-quality`, `systematic-debugging` em persistência indevida.
- **Concluído quando:** somente conteúdo autorizado é entregue e nenhum progresso inválido é persistido.

#### TEST-040 — Contrato das APIs de cards: ownership, validação e ausência

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “A listagem e mutações respeitam ownership. Payloads inválidos, IDs ausentes e operações não autorizadas seguem o contrato efetivamente documentado. Nenhuma resposta deve ser inventada onde a baseline não define status/mensagem.”
- **Arquivos:** criar `backend/src/test/java/br/com/leitormobile/card/CardControllerTest.java`; probes de `queueOrder` ficam em arquivo separado na Wave 2.
- **Harness existente:** MockMvc/Spring Boot Test, repositórios PostgreSQL reais no contrato HTTP.
- **Fixture:** dois usuários, cards próprios/alheios, livro existente/inexistente, estados ativo/arquivado, payload válido/inválido e IDs ausentes.
- **Comando:** `cd backend; mvn -q -Dtest=CardControllerTest test`, depois `mvn -q test`.
- **Dependências:** APIs-010/012/013/015 e ownership; não usar este teste para decidir algoritmo de ordenação.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` em vazamento/anomalia; TDD apenas se BUG confirmado.
- **Concluído quando:** listagem e mutações protegem owner, negativos têm evidência e `queueOrder` permanece fora do Expected normativo.

#### TEST-050 — Validação de backup inválido no restore

- `Purpose / Priority / Expected`: `CONTRACT / P0`. **Expected (matriz):** “Artefatos inválidos são rejeitados pelo validador atual. O snapshot válido passa na validação. A validação não deve ser confundida com restauração efetiva.”
- **Arquivos:** ampliar `leitor-epub/src/services/backupValidation.test.ts`, preservando os casos já existentes.
- **Harness existente:** Jest Expo com funções puras de `backupValidation.ts`; sem dispositivo e sem restore real.
- **Fixture:** bytes/arquivos sintéticos não-JSON, JSON truncado/corrompido, schema incompleto e snapshot válido mínimo; não criar agora.
- **Comando:** `cd leitor-epub; npm test -- --runInBand src/services/backupValidation.test.ts`, depois `npm test -- --runInBand`.
- **Dependências:** schema de snapshot e validação de paths/referências; TEST-051 cobre restauração em device.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; TDD só para correção de produção confirmada; `systematic-debugging` se parser aceitar/rejeitar fora do esperado.
- **Concluído quando:** inválidos são rejeitados, válido passa e nenhum resultado é reportado como restore efetivo.

### P0 — extensão mobile entregue à lane da Wave 4

#### TEST-018 — Importação mobile rejeita EPUB inválido e inseguro

- `Purpose / Priority / Expected`: `ACCEPTANCE / P0` na matriz. **Expected (matriz):** “Cada condição sustentada pela baseline é rejeitada pelas validações de segurança/importação; nenhum arquivo inválido deve ser tratado como EPUB aceito.”
- **Arquivos:** ampliar `leitor-epub/src/services/epubImport.test.ts` e `leitor-epub/src/services/epubSecurity.test.ts`; esta é uma das extensões explícitas da matriz.
- **Harness existente:** Jest Expo, JSZip/parser e funções de importação/segurança isoladas.
- **Fixture:** builders sintéticos para ZIP/CRC inválido, MIME/container/OPF/spine ausente, layout fixo, DRM, recurso remoto, path inseguro, limites de expansão e arquivo acima do limite; não criar agora.
- **Comando:** `cd leitor-epub; npm test -- --runInBand src/services/epubImport.test.ts src/services/epubSecurity.test.ts`, depois suíte completa.
- **Dependências:** somente JS/fixtures in-memory; TEST-017/019 validam picker/filesystem e duplicidade em device.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para aceitação inesperada; TDD somente para bug confirmado.
- **Concluído quando:** todas as condições já sustentadas pela baseline têm casos explícitos, sem transformar cobertura ausente em regra inventada.

### P1 — depois dos P0

#### TEST-031 — Contrato do OUT-001: erro, ausência e cache do dicionário

- `Purpose / Priority / Expected`: `CONTRACT / P1`. **Expected (matriz):** “A URL e o formato da integração seguem OUT-001. Erros não-2xx e ausência de página são tratados conforme o comportamento documentado. O uso de cache é observado sem inventar política de expiração ou fallback.”
- **Arquivos:** ampliar `leitor-epub/src/services/lookup.test.ts`.
- **Harness existente:** Jest Expo com `fetch` controlado e cache local isolado; não classificar OUT-001 como API backend.
- **Fixture:** resposta válida, HTTP não-2xx, página ausente, resposta sem entrada e termo repetido para observar cache.
- **Comando:** `cd leitor-epub; npm test -- --runInBand src/services/lookup.test.ts`, depois suíte completa.
- **Dependências:** `lookup.ts`, `repository.ts` quando o cache real for exercitado; TEST-030 usa a jornada com conectividade/device.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` em URL/cache inesperados.
- **Concluído quando:** URL/formato/erros/cache observados coincidem com OUT-001, sem inventar expiração/fallback.

#### TEST-035 — Contrato de card mobile com dados inválidos ou ausentes

- `Purpose / Priority / Expected`: `CONTRACT / P1`. **Expected (matriz):** “Entrada válida segue o contrato atual de criação. Entrada inválida ou referência ausente é rejeitada/tratada conforme a implementação documentada, sem inventar mensagem ou status. Nenhum registro parcial indevido é produzido.”
- **Arquivos:** criar `leitor-epub/src/components/BookCard.test.ts` ou o teste do componente dono do contrato, mantendo a extensão de serviço em `leitor-epub/src/services/lexicon.test.ts` quando a criação for delegada ao service.
- **Harness existente:** Jest Expo; render controlado do componente com `react-test-renderer` já resolvido no ambiente, ou chamada do boundary de service quando o comportamento não for visual. Não usar device.
- **Fixture:** card válido, ausência de termo/livro/dados lexicais obrigatórios e referências inexistentes; SQLite fake controlado.
- **Comando:** `cd leitor-epub; npm test -- --runInBand src/components/BookCard.test.ts src/services/lexicon.test.ts`, depois suíte completa.
- **Dependências:** `BookCard.tsx`, `lexicon.ts`, repository fake; não presumir paridade com web.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` se houver registro parcial; TDD apenas em correção confirmada.
- **Concluído quando:** estados válidos/negativos são observáveis no boundary correto e não há teste web/mobile duplicado por semelhança.

#### TEST-037 — Contrato do repositório de annotations

- `Purpose / Priority / Expected`: `CONTRACT / P1`. **Expected (matriz):** “O repositório mantém os contratos de parâmetros e persistência já cobertos. Casos sem correspondência não criam dados espúrios; o resultado deve seguir o contrato existente.”
- **Arquivos:** ampliar `leitor-epub/src/db/repository.test.ts`; a matriz identifica esta extensão explicitamente.
- **Harness existente:** Jest Expo com `SQLiteDatabase` fake e asserções de SQL parametrizado já usadas no arquivo.
- **Fixture:** annotation válida, IDs inexistentes e update sem correspondência; incluir read/remove além de insert/update.
- **Comando:** `cd leitor-epub; npm test -- --runInBand src/db/repository.test.ts`, depois suíte completa.
- **Dependências:** `repository.ts`; não acessar SQLite nativo nem alterar migrations.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para SQL/efeitos inesperados.
- **Concluído quando:** insert/update existentes permanecem verdes, read/remove e ausências não criam dados espúrios e o SQL está evidenciado.

#### TEST-047 — Contrato de lista e lookup lexical persistido

- `Purpose / Priority / Expected`: `CONTRACT / P1`. **Expected (matriz):** “Lista e lookup devolvem os campos persistidos conforme o catálogo. Ownership e ausência de resultado seguem contratos observados, sem inventar status ou payload. Dados usados pela UI são consistentes com o armazenamento lexical.”
- **Arquivos:** criar `backend/src/test/java/br/com/leitormobile/lexicon/LexiconControllerTest.java`; manter os testes de dicionário existentes como RELATED, não como substituto HTTP.
- **Harness existente:** MockMvc + PostgreSQL/Flyway com entradas lexicais persistidas e owners distintos.
- **Fixture:** lemma/senses/frequency, resultado/sem resultado, livro inexistente e livro de outro owner.
- **Comando:** `cd backend; mvn -q -Dtest=LexiconControllerTest test`, depois `mvn -q test`.
- **Dependências:** API-018/API-019, entidades lexicais e autenticação; não requer UI.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` em divergência de campos/ownership.
- **Concluído quando:** lista e lookup persistidos têm contrato HTTP rastreável e os dados da UI estão reconciliados com o catálogo.

#### TEST-058 — Contrato do provedor Ollama e timeout

- `Purpose / Priority / Expected`: `CONTRACT / P1`. **Expected (matriz):** “O provider respeita o contrato de request/response e tratamento de timeout observado. A política de metadata-only/exposição é mantida conforme os testes existentes. Indisponibilidade não deve ser convertida em expected de sucesso.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/ai/OllamaAiProviderTest.java`, `ExternalAiContextPolicyTest.java` e `ExternalAiExposurePolicyTest.java`, conforme a seção de extensões da matriz.
- **Harness existente:** `HttpServer` de loopback para provider; Mockito/unidades para policies; provider fake/controlado, não Ollama real nesta lane.
- **Fixture:** resposta JSON válida completa, timeout/indisponibilidade, request metadata-only e conteúdo proibido.
- **Comando:** `cd backend; mvn -q -Dtest=OllamaAiProviderTest,ExternalAiContextPolicyTest,ExternalAiExposurePolicyTest test`, depois `mvn -q test`.
- **Dependências:** propriedades Ollama e policies; integração real com Ollama fica separada na Wave 7.
- **Skills:** `verification-before-completion`, `code-review-and-quality`, `systematic-debugging` para timeout/contrato; TDD somente se a anomalia exigir produção.
- **Concluído quando:** resposta válida, timeout e policies têm evidência, sem depender da disponibilidade externa nem declarar sucesso para indisponibilidade.

### P2 — por último dentro da automação imediata

#### TEST-059 — Caracterização de no-candidate e exposição de IA

- `Purpose / Priority / Expected`: `CHARACTERIZATION / P2`. **Expected (matriz):** “O comportamento atual de no-candidate e exposição é documentado. Não transformar qualquer bloqueio ou ausência atual em acceptance futura sem decisão.”
- **Arquivos:** ampliar `backend/src/test/java/br/com/leitormobile/ai/ExternalAiExposurePolicyTest.java` e `ExternalAiContextPolicyTest.java`, conforme a extensão registrada.
- **Harness existente:** testes unitários de policy/provider com entradas lexicais controladas; não chamar serviço externo real.
- **Fixture:** entrada sem candidato, candidato válido e entrada que exigiria contexto proibido.
- **Comando:** `cd backend; mvn -q -Dtest=ExternalAiExposurePolicyTest,ExternalAiContextPolicyTest test`, depois `mvn -q test`.
- **Dependências:** `CONCERNS.md`, policies atuais e fluxo de enriquecimento; não promover observação a acceptance.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` para comportamento não determinístico.
- **Concluído quando:** comportamento atual é registrado separadamente de requisito, com status/observação no ledger.

#### TEST-060 — Contrato de health e info do actuator

- `Purpose / Priority / Expected`: `CONTRACT / P2`. **Expected (matriz):** “Health/info seguem os contratos e a política de exposição efetivamente documentados. A degradação é refletida conforme a implementação observada. Não inventar campos, status ou disponibilidade pública além da baseline.”
- **Arquivos:** criar `backend/src/test/java/br/com/leitormobile/health/ActuatorContractTest.java` ou pacote de teste alinhado à configuração existente.
- **Harness existente:** Spring Boot Test + MockMvc, com configuração/dependências controladas; não é E2E e não requer Playwright.
- **Fixture:** serviço saudável, dependência indisponível quando aplicável, request autenticado e não autenticado.
- **Comando:** `cd backend; mvn -q -Dtest=ActuatorContractTest test`, depois `mvn -q test`.
- **Dependências:** `management.endpoints.web.exposure.include: health,info`, SecurityConfig e API-020/API-021.
- **Skills:** `verification-before-completion`, `code-review-and-quality`; `systematic-debugging` se exposição/degradação divergir.
- **Concluído quando:** payload/status/exposição observados são registrados sem extrapolar a baseline.

### Extensões obrigatórias de testes existentes

Esta tabela é uma transcrição operacional da seção `Existing tests requiring extension` da matriz. A regra é ampliar o arquivo existente quando ele já é o harness correto; não criar um teste paralelo só para repetir cobertura.

| TEST | Arquivo(s) a ampliar | Lacuna a fechar |
|---|---|---|
| TEST-003 | `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java` | token malformado/expirado e demais casos de acesso não autenticado |
| TEST-018 | `leitor-epub/src/services/epubImport.test.ts`; `epubSecurity.test.ts` | ZIP/CRC, estruturas ausentes e limites do cenário |
| TEST-021 | `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java` | ownership, ausência de autenticação e contrato HTTP |
| TEST-029 | `frontend/lexicon-entry-contract.test.mjs` | renderização/estados opcionais do componente, além do contrato estático |
| TEST-037 | `leitor-epub/src/db/repository.test.ts` | read/remove e IDs inexistentes |
| TEST-046 | `backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java`; `backend/src/test/java/br/com/leitormobile/lexicon/LexiconJobRecoveryTest.java` | persistência completa, latest status, running/failed e integração do runner |
| TEST-050 | `leitor-epub/src/services/backupValidation.test.ts` | parsing inválido e separação da sequência de restore |
| TEST-058 | `OllamaAiProviderTest.java`; `ExternalAiContextPolicyTest.java`; `ExternalAiExposurePolicyTest.java` | resposta válida completa e contrato integrado do provider |
| TEST-059 | `ExternalAiExposurePolicyTest.java`; `ExternalAiContextPolicyTest.java` | no-candidate e decisão de chamar ou não o provider |

## 4. Wave 2 — DEFECT PROBES

`TEST-041` e `TEST-042` investigam o `BUG_CANDIDATE` de `queueOrder`. O objetivo inicial é implementar e executar probes, não corrigir produção.

### TEST-041 — criação sequencial de cards e queueOrder

- `Purpose / Priority / Level / Surface`: `DEFECT_PROBE / P1 / INTEGRATION / BACKEND`.
- **Arquivos/harness:** criar `backend/src/test/java/br/com/leitormobile/card/CardQueueOrderProbeTest.java`, usando backend/banco de teste limpos e criação repetível de cards.
- **Fixture:** dois ou mais cards do mesmo owner, dados distinguíveis; repetir somente com concorrência controlada se a primeira observação exigir caracterização.
- **Comando futuro:** `cd backend; mvn -q -Dtest=CardQueueOrderProbeTest test`.
- **Fluxo obrigatório:** implementar probe → executar → registrar evidência de `queueOrder` e ordem retornada.
- **Expected (matriz, sem alteração):** “Não há expected normativo neste probe. Registrar evidência para confirmar ou refutar o BUG_CANDIDATE: ordem estritamente crescente versus queueOrder duplicado. Não assumir que a correção correta seja MAX + 1.”
- **Dependências:** `CardService.java`, `CardRepository.java`, API-011/CAP-017/CAP-018 e banco limpo. `TEST-040` não decide este comportamento.
- **Skills:** `systematic-debugging` se houver anomalia; `verification-before-completion` para fechar o probe; `code-review-and-quality` após o teste; TDD somente depois de confirmar que há correção de produção necessária.
- **Saídas:** `PASS` pode registrar probe executado e candidato refutado; `FAIL` pode registrar anomalia confirmada; `INCONCLUSIVE` se a evidência não distinguir as hipóteses. Nenhum desses estados autoriza patch automático.

### TEST-042 — move-to-end e queueOrder

- `Purpose / Priority / Level / Surface`: `DEFECT_PROBE / P1 / INTEGRATION / BACKEND`.
- **Arquivos/harness:** criar `backend/src/test/java/br/com/leitormobile/card/CardMoveToEndProbeTest.java`, separado do contrato HTTP e do TEST-041.
- **Fixture:** pelo menos três cards, um no início/meio/fim, estado inicial persistido e movimentação de um card não final; repetir com outro card somente se necessário.
- **Comando futuro:** `cd backend; mvn -q -Dtest=CardMoveToEndProbeTest test`.
- **Fluxo obrigatório:** registrar ordem inicial → executar move-to-end → recarregar lista/valores → registrar duplicidades ou posição observada.
- **Expected (matriz, sem alteração):** “Não há expected normativo neste probe. Registrar se o card movido fica estritamente após todos os demais ou se ocorre duplicidade/anomalia. Não assumir que a correção correta seja MAX + 1.”
- **Dependências:** CardService/CardRepository, API-015 e banco limpo; não depender da ferramenta web.
- **Skills:** `systematic-debugging` para rastrear a origem do valor; `verification-before-completion` e `code-review-and-quality`; `test-driven-development` apenas em etapa posterior de correção confirmada.
- **Saídas:** registrar `CONFIRMED`, `REFUTED` ou `INCONCLUSIVE` como veredicto do probe, junto do Status do ledger; não converter o resultado em acceptance.

Se um probe confirmar anomalia: executar `systematic-debugging` completo, incluindo reprodução, comparação com exemplos funcionais, rastreamento do valor e hipótese única. Só depois propor uma mudança de produção separada, aplicar `test-driven-development` (RED → verificar falha → GREEN mínimo → regressão) e fechar com `verification-before-completion`. O plano não escolhe algoritmo de correção.

## 5. Wave 3 — WEB E2E

### Infraestrutura única para os oito E2E_WEB

Não implementar Playwright nesta etapa. Na execução futura, criar uma infraestrutura compartilhada, não oito harnesses independentes. O componente `TEST-029` usa a mesma organização de dados/contrato web, mas continua `COMPONENT`, não E2E.

**Arquivos futuros planejados:**

- `frontend/e2e/playwright.config.ts`: projeto web, base URL, timeouts, screenshots/traces em falha e diretório de artefatos.
- `frontend/e2e/fixtures/api-seed.ts`: criação idempotente de usuário/livros/cards/jobs via API de teste.
- `frontend/e2e/fixtures/epub.ts`: builder ou arquivo EPUB mínimo conhecido; não criar nesta fase.
- `frontend/e2e/fixtures/reset.ts`: reset da base e do storage isolados, executado antes/depois de cada projeto de dados.
- `frontend/e2e/specs/library.spec.ts`, `upload.spec.ts`, `reader.spec.ts`, `lexicon.spec.ts`, `cards.spec.ts`: agrupar cenários por fluxo, mantendo tags `TEST-XXX` nos nomes.

**Runtime futuro:**

- PostgreSQL de teste isolado em porta/DB conhecidos; não usar o volume de desenvolvimento. Provisionar o schema pelo mecanismo já existente e limpar por run.
- Backend em `http://localhost:8080`, iniciado com `mvn spring-boot:run` no diretório `backend`, `DATABASE_*` apontando ao banco de teste, `CORS_ALLOWED_ORIGINS=http://localhost:5173`, `PORT=8080` e `app.storage-directory` apontando ao storage temporário.
- Frontend Vite em `http://localhost:5173`, iniciado com `npm run dev` no diretório `frontend`, `VITE_API_URL=http://localhost:8080/api`.
- Usuário de teste criado/seeded de forma idempotente com `APP_AUTH_EMAIL`/`APP_AUTH_PASSWORD` fornecidos pelo ambiente; não gravar credenciais no repositório nem no trace.
- Contexto de browser limpo por teste ou estado salvo somente quando a própria jornada validar persistência de sessão. Autenticação poderá ser feita pela UI em `TEST-001` e reutilizada apenas em fixture controlada para os demais, com a origem do estado registrada.
- Fixture EPUB mínima fluida, renderizável e com hash conhecido; uma cópia por teste quando upload/deleção puder alterar o artefato.
- Limpeza: apagar dados do owner de teste, storage temporário e estado do browser após cada cenário; em falha, preservar artefatos de diagnóstico em diretório nomeado pelo TEST ID.
- Evidência em falha: snapshot, screenshot, trace, console, requests/responses relevantes e logs backend; `playwright-cli requests`, `console`, `screenshot` e `tracing-start`/`tracing-stop` só serão usados na execução futura.

**Comandos futuros de coordenação:**

```text
docker compose up -d postgres
cd backend && mvn spring-boot:run
cd frontend && npm run dev
playwright-cli open http://localhost:5173
playwright-cli tracing-start
playwright-cli snapshot
playwright-cli tracing-stop
playwright-cli close
```

O bloco acima é um roteiro futuro, não uma execução desta etapa. A runner deve verificar health do backend, conectividade do banco e readiness do Vite antes de abrir o browser. Se a ferramenta global não existir, seguir a decisão do `playwright-cli` skill (`npx --no-install playwright --version` antes de qualquer instalação); não instalar dependência agora.

### Ordem de execução web

1. `TEST-001` (P0): login, sessão web e biblioteca.
2. `TEST-013` (P0): registro, upload, início automático, polling e lookup.
3. `TEST-020` (P0): exclusão de registro, EPUB e capas.
4. `TEST-023` (P0): renderização, progresso e restauração.
5. `TEST-009` (P1): pesquisa/capas.
6. `TEST-027` e `TEST-028` (P1): seleção lexical e criação de card.
7. `TEST-029` (P1): componente/modal; ampliar `frontend/lexicon-entry-contract.test.mjs` e adicionar harness de componente, sem contar o static test como E2E.
8. `TEST-039` (P1): ciclo de cards; não embutir nele a decisão/probe de `queueOrder`.

### Identidade dos oito E2E_WEB e Expected preservado

| TEST | Purpose / Priority | Arquivos/harness planejados | Fixture/dependência principal | Expected da matriz |
|---|---|---|---|---|
| TEST-001 | ACCEPTANCE / P0 | `frontend/e2e/specs/library.spec.ts`; Playwright CLI | usuário válido, biblioteca vazia/não vazia, storage limpo | O login retorna sessão, a sessão é mantida pelo web e a biblioteca carregada é exibida. |
| TEST-009 | ACCEPTANCE / P1 | `library.spec.ts`; mesma infraestrutura | títulos/autores, capa disponível/ausente, busca sem resultado | A grade mostra somente os resultados do filtro, a contagem/estado vazio é coerente e capa ausente não impede o item de aparecer. |
| TEST-013 | ACCEPTANCE / P0 | `upload.spec.ts`; API seed + upload real | EPUB mínimo, hash conhecido, runner lexical e polling | O frontend cria o registro, envia o EPUB, inicia automaticamente o job sem nova ação manual e acompanha seu estado; após sucesso, lookup responde. Falha do início automático deve permanecer distinguida de falha do upload. |
| TEST-020 | ACCEPTANCE / P0 | `library.spec.ts` ou `upload.spec.ts`; storage observável | EPUB, JPG e capa stale PNG | O livro deixa de aparecer e conteúdo/registro gerenciados são removidos conforme o caminho web. |
| TEST-023 | ACCEPTANCE / P0 | `reader.spec.ts`; browser real | EPUB renderizável, sem progresso e com CFI salvo | O EPUB é renderizado, a navegação altera o estado e a posição persistida é aplicada na reabertura; falha de arquivo mostra o tratamento da UI. |
| TEST-027 | ACCEPTANCE / P1 | `lexicon.spec.ts`; browser real + dados lexicais | termo com entrada e sem resultado | A seleção consulta o lookup lexical do livro. Uma entrada encontrada é apresentada de acordo com o contrato de dados observado. A ausência de resultado é tratada conforme o comportamento documentado, sem inventar conteúdo. |
| TEST-028 | ACCEPTANCE / P1 | `lexicon.spec.ts`; API de criação observável | seleção com definição/localização e livro correto | A seleção usa o lookup aplicável e envia dados compatíveis com o contrato de criação de card. O card criado fica associado ao usuário e ao livro corretos. Não se deve assumir uma regra de ordenação de queueOrder além da observação específica dos DEFECT_PROBE. |
| TEST-039 | ACCEPTANCE / P1 | `cards.spec.ts`; dados de cards ativos/arquivados | múltiplos cards, outro owner e referência ausente | Operações permitidas alteram apenas o card próprio e persistem conforme os contratos das rotas. Arquivamento e movimento para o fim permanecem coerentes após recarregar. Casos de recurso ausente ou de outro usuário seguem o contrato sem expor dados. |

Skills: em todos os oito, `playwright-cli` somente aqui; `verification-before-completion` antes de fechar cada TEST; `code-review-and-quality` após mudança relevante de specs/harness; `systematic-debugging` para falha inesperada. Nenhum E2E web deve ser usado para afirmar cobertura mobile.

## 6. Wave 4 — MOBILE AUTOMATIZÁVEL SEM DEVICE

Esta wave é a lane de execução sem Android real. Ela recebe os cinco mobile `AUTOMATABLE_NOW` inventariados na Wave 1, amplia os dois `EXISTING` (`TEST-012`, `TEST-026`) e prepara `TEST-049`, que é integração mobile com diretório controlado, mas não precisa de OS real.

| TEST | Escopo/harness futuro | Extensão ou arquivo | Fixture | Critério de saída |
|---|---|---|---|---|
| TEST-012 | Jest Expo, SQLite fake, migrations isoladas | manter `leitor-epub/src/db/migrations.test.ts` | versões 0/atual/futura e transações | migration atomicamente observável, versão futura recusada; não alterar migration |
| TEST-018 | Jest Expo, JSZip/parser | ampliar `epubImport.test.ts` e `epubSecurity.test.ts` | inválidos sintéticos listados na Wave 1 | todos os negativos sustentados são rejeitados |
| TEST-026 | Jest Expo, funções de progresso/bridge | manter/ampliar `leitor-epub/src/reader/progress.test.ts` e `readerBridge.test.ts` | progresso fora do domínio, mensagens válidas/malformadas | normalização/tratamento atual preservado |
| TEST-031 | Jest Expo + fetch/cache fake | ampliar `leitor-epub/src/services/lookup.test.ts` | OUT-001 válido, não-2xx, ausência, repetição | contrato observado sem inventar fallback/expiração |
| TEST-035 | Jest Expo + renderer/boundary controlado | criar teste de `BookCard` com extensão de `lexicon.test.ts` se necessário | card válido/inválido/referência ausente | nenhum registro parcial indevido |
| TEST-037 | Jest Expo + SQLite fake | ampliar `leitor-epub/src/db/repository.test.ts` | read/remove/IDs ausentes | parâmetros e persistência sem dados espúrios |
| TEST-049 | Jest/integração com filesystem temporário | criar teste do serviço de backup, sem device | snapshot pequeno, capa, artefato alterado, manifest | metadados e integridade somente conforme implementação documentada |
| TEST-050 | Jest Expo, validação pura | ampliar `backupValidation.test.ts` | não-JSON, truncado, schema inválido, válido mínimo | validação separada de restore |

Expected preservado literalmente para os cenários que não são repetidos na Wave 1:

- `TEST-012`: “Migrations aplicam o schema observado atomicamente, mantêm a versão suportada e recusam banco de versão futura.”
- `TEST-026`: “Valores fora do domínio e mensagens malformadas são tratados como os contratos atuais; eventos válidos são normalizados para o formato do reader.”
- `TEST-029`: “O componente usa os campos lexicalmente disponíveis sem acessar propriedade inexistente. Campos opcionais ausentes seguem o comportamento atual documentado; não inventar fallback normativo.”
- `TEST-049`: “O pacote contém os dados e metadados que a implementação documenta. Alteração do artefato é detectável quando houver mecanismo de integridade documentado. Não inventar campos ou algoritmo de checksum ausentes da baseline.”

Comandos por lane: `cd leitor-epub; npm test -- --runInBand src/db/migrations.test.ts src/reader/progress.test.ts src/reader/readerBridge.test.ts src/services/epubImport.test.ts src/services/epubSecurity.test.ts src/services/lookup.test.ts src/services/backupValidation.test.ts src/services/lexicon.test.ts; npm run typecheck; npm test -- --runInBand`. Não executar `npm run android` nesta wave. Caso o renderer de componente não seja deterministicamente resolvido pela instalação declarada, registrar `BLOCKED` no teste de componente e abrir decisão de harness; não ocultar a lacuna com teste estático de outra surface.

## 7. Wave 5 — MOBILE DEVICE / E2E

### Escopo

| Grupo | TEST IDs | Requisito de runtime |
|---|---|---|
| `E2E_MOBILE` | TEST-004, TEST-011, TEST-017, TEST-022, TEST-025, TEST-030, TEST-034, TEST-036, TEST-038, TEST-043, TEST-048, TEST-051 | app Expo/React Native em dev build, SQLite e filesystem locais; backend apenas quando o cenário o declarar |
| `DEVICE` | TEST-019, TEST-032, TEST-033, TEST-052, TEST-053 | Android emulator ou aparelho físico; módulos/handlers nativos reais |

### TOOL_DECISION_REQUIRED

Não escolher Playwright para React Native nativo. Antes de implementar E2E mobile, executar uma spike de compatibilidade contra Expo ~57.0.20, React Native 0.86.3, Hermes/New Architecture, Expo Router, SQLite, WebView e módulos nativos do projeto (`DocumentPicker`, `FileSystem`, `Sharing`, ML Kit, Linking/browser).

Opções a comparar na decisão futura:

- **Detox:** runner gray-box nativo para React Native; exige build Android/iOS configurada e sincronização com runtime. Verificar compatibilidade com dev build, WebView e intents que saem do app.
- **Maestro:** runner black-box orientado a accessibility/UI; tende a exigir menos acoplamento ao JS, mas deve provar interação com WebView, picker/share e retorno de apps externos.
- **Appium:** WebDriver amplo para Android, WebView e contextos externos; exige driver/device/servidor adicionais e maior custo operacional.
- **Playwright CLI:** adequado à Wave 3 para browser web; não atende as telas RN nativas, SQLite nativo, Document Picker, Share, ML Kit ou Linking.

Critérios mínimos para escolher: instalar e abrir um dev build; localizar/acionar controles Expo Router; importar EPUB pelo Document Picker; observar arquivo no filesystem privado; interagir com WebView; exercitar SQLite; capturar retorno de Share/browser/Linking; controlar permissões/rede; executar em API 29 e API estável; produzir screenshot/log/trace sem depender de um dataset grande. Até essa spike passar, registrar `TOOL_DECISION_REQUIRED` e manter os 17 IDs da Wave 5 planejados, não implementados.

### Agrupamento por dependência nativa

- **Sessão/biblioteca/importação/exclusão:** `TEST-004`, `TEST-011`, `TEST-017`, `TEST-019`, `TEST-022`; requerem SQLite, Document Picker/filesystem e reset de instalação.
- **Reader/WebView/progresso:** `TEST-025`, com `TEST-026` já coberto sem device; requer EPUB local, WebView, rotação/retomada e filesystem.
- **Lookup/card/annotations/bookmark:** `TEST-030`, `TEST-034`, `TEST-036`, `TEST-038`, `TEST-043`; requer seleção real, SQLite e rede controlável quando fallback externo for exercitado.
- **Backup/share/restore:** `TEST-048`, `TEST-051`, com `TEST-049`/`TEST-050` preparados sem device; requer filesystem, Share, instalação limpa e reset seguro.
- **Tradução/OS:** `TEST-032`, `TEST-033`, `TEST-052`, `TEST-053`; requer ML Kit/provider ou fallback observável, WebView/browser/Linking e handlers do OS.

O roteiro `leitor-epub/docs/QA-ANDROID.md` deve ser usado como checklist de execução futura, incluindo API 29 e API estável, dev build e release, rotação, TalkBack, armazenamento reduzido e processo recriado. Nenhum desses passos será executado nesta etapa.

### Expected preservado para os cenários mobile/device

Os seguintes Expected permanecem exatamente os da matriz e só podem ser verdictados no harness compatível:

- `TEST-004`: “Login válido cria a sessão local e encaminha o usuário para a área principal. O resultado do sync inicial deve ser observado separadamente, sem ser tratado como critério desta entrada.”
- `TEST-011`: “A biblioteca é carregada do SQLite sem HTTP obrigatório; filtro, estado vazio e placeholder funcionam conforme a journey.”
- `TEST-017`: “EPUB válido é validado, armazenado no filesystem privado, registrado uma vez no SQLite e fica disponível na biblioteca/reader.”
- `TEST-019`: “A segunda importação retorna o livro existente sem duplicar a cópia; em falha parcial, observar e registrar a limpeza implementada sem exigir comportamento não descrito pela baseline.”
- `TEST-022`: “Cancelamento não altera o livro; após confirmar, registro, EPUB e capa locais deixam de estar disponíveis e nenhuma chamada HTTP é feita.”
- `TEST-025`: “O livro é lido localmente, navegação/pesquisa/preferências funcionam e posição fica disponível ao retornar, conforme a journey mobile.”
- `TEST-030`: “O lookup usa o caminho local/externo conforme a implementação e a disponibilidade. A chamada externa, quando ocorrer, observa OUT-001. Ausência de resultado e indisponibilidade são observadas conforme contratos existentes, sem inventar conteúdo.”
- `TEST-032`: “Com texto traduzível e serviço disponível, a tradução é solicitada e o resultado é apresentado conforme CAP-015. Para ausência de resultado e indisponibilidade, registrar o comportamento atual sem inventar uma política de fallback.”
- `TEST-033`: “O comportamento implementado atualmente é documentado para orientar uma decisão posterior. Nenhuma saída suspeita é promovida automaticamente a acceptance.”
- `TEST-034`: “Um card é criado com os dados da seleção e fica disponível no armazenamento mobile conforme a capability. A ausência de entrada lexical é apresentada/tratada conforme o comportamento documentado, sem inventar mensagem.”
- `TEST-036`: “A annotation é associada à localização correta, permanece disponível ao reabrir e pode ser editada/removida conforme a capability. O estado observado após cada operação é persistido no armazenamento local.”
- `TEST-038`: “O resultado observado da alternância e da reabertura corresponde ao contrato de bookmarks definido pela capability. O estado permanece associado ao livro correto e não é duplicado indevidamente.”
- `TEST-043`: “As operações locais permitidas persistem e permanecem associadas ao usuário/livro corretos. O resultado de ordenação observado após recarregar é registrado conforme a política do produto; não importar regra web sem evidência.”
- `TEST-048`: “A exportação gera o artefato previsto pela capability e o fluxo de compartilhamento o entrega ao sistema operacional. O conteúdo exportado é observável e não inclui dados de outro usuário. O caso de biblioteca vazia segue o comportamento documentado, sem inventar mensagem.”
- `TEST-051`: “Após confirmação, o estado local observado corresponde ao conteúdo restaurado conforme a capability. O caminho inválido não substitui o snapshot atual. A integridade de referências e arquivos é preservada conforme o contrato documentado.”
- `TEST-052`: “Somente schemes/protocolos suportados pela implementação são encaminhados ao OS. Schemes/protocolos não suportados não são abertos. Nenhuma navegação externa deve corromper o estado local do livro.”
- `TEST-053`: “Schemes/protocolos não suportados não são encaminhados ao OS. http, https, mailto e tel seguem o caminho suportado observado na implementação. Não atribuir ao teste epubSecurity uma cobertura que ele não possui.”

Skills: `verification-before-completion` fecha cada cenário com comando/log/screenshot; `code-review-and-quality` revisa mudanças de teste/harness; `systematic-debugging` investiga falhas inesperadas; `test-driven-development` só se um BUG confirmado exigir produção. Playwright não entra nesta wave.

## 8. Wave 6 — CROSS-SURFACE / SYNC

### Ambiente reproduzível

Preparar uma composição controlável contendo backend Spring, PostgreSQL isolado, SQLite mobile controlado, dados locais/remotos distintos, rede que possa ser interrompida em pontos determinados e reset antes/depois. O storage backend deve ser temporário; o SQLite deve começar de snapshot conhecido; requests, `SyncResult`, sessão e alterações em cada lado devem ser capturados.

### Lanes

- **Caracterização primária:** `TEST-005` observa sync inicial após login e `TEST-044` observa entidades/etapas, parcialidade, offline e retry. Ambos podem executar mesmo sem decisão de autoridade, escopo de annotations/bookmarks/preferences ou download remoto.
- **Integração de reprocessamento:** `TEST-045` valida ação manual explícita, polling, reuso/force e falha; não confundir com início automático de `TEST-013`.
- **Persistência de jobs:** `TEST-046` amplia `LexiconServiceTest.java` e `LexiconJobRecoveryTest.java` para latest status, running/failed/interrupted e runner; não tratar todo FAIL como recuperável.
- **Gate de intenção:** `TEST-006`, `TEST-007`, `TEST-008` e `TEST-016` podem ter observação técnica preparatória nesta wave, mas o verdict normativo pertence à Wave 8. Eles não bloqueiam `TEST-005`/`TEST-044` quando for possível somente observar o comportamento.

Expected preservado:

- `TEST-005`: “Registrar o que o código faz hoje: se a sessão permanece válida, quais entidades são tocadas e como o sync parcial/offline é reportado. Não aprovar aqui política de autoridade, conflito ou escopo de dados.”
- `TEST-044`: “Registrar quais entidades são sincronizadas hoje, quais etapas sobrevivem a falha e como o retry ocorre. Não afirmar fonte autoritativa, política de conflito ou escopo de annotations/bookmarks/preferences como requisito sem decisão humana. Não converter sync parcial/offline observado em acceptance.”
- `TEST-045`: “O reprocessamento ocorre somente quando a ação manual explícita é acionada. O status observado é acompanhado pelo polling e não é confundido com o início automático do FLOW-005. Reuso, novo job e falha seguem os contratos existentes; não inventar recuperação.”
- `TEST-046`: “Persistência e consulta dos jobs permanecem consistentes com o contrato atual. A recuperação marca/expõe o estado observado para job interrompido conforme a implementação coberta. Não assumir que qualquer estado de falha seja automaticamente recuperável.”

Skills: `systematic-debugging` para falha de boundary/rede/estado e para qualquer comportamento anômalo; `verification-before-completion` após cada matriz de interrupção; `code-review-and-quality` após harness/teste relevante; TDD apenas para correção separada de BUG confirmado.

## 9. Wave 7 — OPERATIONAL

Agrupar startup/recovery, Kaikki, Ollama e Actuator por dependência operacional. Usar fixtures sintéticas pequenas e provider controlado; não exigir dataset Kaikki real de gigabytes para automação.

| Lane | TEST IDs | Execução futura | Regra de isolamento |
|---|---|---|---|
| Startup/recovery | TEST-054 e a observação de TEST-055 | iniciar backend com banco/storage controlados, conta/job conhecidos, registrar logs e estados | seed de conta não é política de produção; TEST-055 continua bloqueado |
| Kaikki válido | TEST-056 | `cd backend; .\\scripts\\import-kaikki.ps1 -InputFile ..\\fixtures\\qa\\kaikki-small.jsonl -MaxRecords 100` em banco de teste | snapshot mínimo com entradas válidas/repetidas e mais de um batch; não baixar nem versionar snapshot grande |
| Kaikki inválido/restart | TEST-057 | mesmo importador com JSON truncado, schema inesperado, ausente e interrupção controlada | observar sinalização/lote parcial/reinício; não inventar atomicidade/retomada |
| Provider fake | TEST-058 e TEST-059 | `HttpServer` local/fake com resposta válida, timeout, ausência e exposição bloqueada | fake é o caminho determinístico; não depender de Ollama real para contrato |
| Ollama real controlado | complemento operacional posterior de TEST-058/059 | `docker compose -f docker-compose.ollama.yml up -d` e endpoint loopback somente quando a integração real for o objeto | modelo/configuração/tempo registrados; indisponibilidade não vira PASS |
| Actuator | TEST-060 | backend controlado + MockMvc/HTTP de health/info | confirmar exposição real, autenticação e degradação sem inventar payload |

Expected preservado:

- `TEST-054`: “As rotinas observadas de seed e recovery executam conforme o comportamento documentado. Jobs interrompidos assumem o estado de recuperação coberto pela baseline. O resultado da política para conta padrão/livro órfão é registrado sem presumir adequação de produção.”
- `TEST-056`: “Entradas válidas são importadas conforme a capacidade operacional. O resultado da reexecução e a idempotência observada são registrados conforme a implementação, sem inventar garantia. O conjunto sintético não inclui dataset grande ou protegido no repositório.”
- `TEST-057`: “O importador rejeita ou sinaliza entradas inválidas conforme o comportamento documentado. O tratamento de lote parcial/reinício é observado, não inventado como garantia de atomicidade ou retomada. Nenhum dataset grande é adicionado nesta fase.”

`TEST-058`, `TEST-059` e `TEST-060` têm Expected e critérios detalhados na Wave 1; a Wave 7 apenas define sua execução operacional/fake versus real. `systematic-debugging` é obrigatório para startup/integração inesperada; `verification-before-completion` e `code-review-and-quality` fecham a evidência; TDD só segue BUG confirmado.

## 10. Wave 8 — INTENT_REQUIRED

Esta wave lista todos os cinco `BLOCKED_BY_INTENT`. Ela produz perguntas de decisão e não respostas. A observação técnica correspondente pode ser executada antes, nas Waves 6/7, sem transformar o comportamento atual em requisito.

### TEST-006 — Política de autoridade em conflito local/remoto

- **Decisão a perguntar:** Qual é a autoridade por entidade (progresso, card/conteúdo, arquivamento e ordem), há precedência temporal/tie-break determinístico e existe resolução manual?
- **Evidência existente:** `leitor-epub/src/services/sync.ts`, `leitor-epub/src/db/repository.ts`, `docs/system/SYSTEM-OVERVIEW.md`, `docs/codebase/CONCERNS.md`.
- **Comportamento atual conhecido:** há algoritmo de sync/merge observado no código, mas nenhum vencedor local/remoto, precedência temporal ou política de conflito aprovada.
- **Alternativas observáveis:** remoto vence; local vence; last-write-wins por timestamp; política híbrida por entidade; conflito preservado para resolução manual. Estas são alternativas para decisão, não recomendação.
- **TESTs dependentes:** `TEST-005` e `TEST-044` podem caracterizar sem bloquear; `TEST-006`, `TEST-007` e `TEST-008` compartilham a decisão. Acceptance futura de sync não deve ser fechada antes dela.
- **Risco de adiar:** P0; sincronização pode perder, sobrescrever ou apresentar dados divergentes e não há verdict de produto defensável.
- **Expected (matriz):** “Nenhum vencedor é presumido. Registrar o comportamento atual e deixar o verdict normativo bloqueado até definir autoridade, precedência temporal e política de conflito.”

### TEST-007 — Escopo de annotations, bookmarks e preferências no sync

- **Decisão a perguntar:** Annotations, bookmarks e preferências pertencem ao sync? Se sim, qual semântica de envio, merge, ausência remota, remoção e conflito?
- **Evidência existente:** `leitor-epub/src/services/sync.ts`, `leitor-epub/src/db/repository.ts`, `docs/system/CAPABILITIES.md`.
- **Comportamento atual conhecido:** a baseline registra ausência de merge dessas entidades no fluxo encontrado; isso não é requisito aprovado.
- **Alternativas observáveis:** sync completo; somente algumas entidades; estado local-only; envio opt-in; preservação sem remoção; merge definido por entidade. Nenhuma alternativa é escolhida aqui.
- **TESTs dependentes:** `TEST-005`, `TEST-007` e `TEST-044` podem observar; cenários de sync de aceitação e qualquer expansão de dados cross-surface dependem da decisão. `TEST-036`, `TEST-038`, `TEST-048` e `TEST-051` continuam testando seus próprios boundaries locais/backup, sem importar a decisão como Expected.
- **Risco de adiar:** P1; usuários podem supor persistência remota de estado que atualmente não é enviado, ou uma futura implementação pode descartar dados.
- **Expected (matriz):** “Não definir expectativa de envio, merge ou descarte. O teste deve documentar o comportamento atual e permanecer bloqueado até decidir se esses dados fazem parte do sync.”

### TEST-008 — Tratamento de livro somente remoto no sync

- **Decisão a perguntar:** Um livro somente remoto deve ser baixado automaticamente, associado apenas por metadados, ignorado até ação explícita, ou tratado por outra política?
- **Evidência existente:** `leitor-epub/src/services/sync.ts`, `docs/system/SYSTEM-OVERVIEW.md`, `docs/codebase/CONCERNS.md`.
- **Comportamento atual conhecido:** não-download foi observado na baseline, mas não foi aprovado como comportamento de produto.
- **Alternativas observáveis:** download automático de conteúdo; associação de metadados sem EPUB; ignorar até importação local; ação manual de download; download condicionado à rede/armazenamento. Não escolher.
- **TESTs dependentes:** `TEST-005`, `TEST-008` e `TEST-044` podem registrar observação; futuras assertions de `FLOW-018` dependem da decisão, enquanto login/sessão isolados não devem ser bloqueados.
- **Risco de adiar:** P1; a biblioteca pode divergir entre surfaces e o usuário pode interpretar ausência remota como perda de dados.
- **Expected (matriz):** “Nenhuma política de download/associação é presumida. Registrar o comportamento implementado e não classificá-lo como falha ou sucesso de produto antes da decisão.”

### TEST-016 — Paridade de validação EPUB web/mobile

- **Decisão a perguntar:** Upload web/backend deve aplicar exatamente as rejeições estruturais/de segurança do mobile, uma política mínima comum com extensões por plataforma, ou políticas deliberadamente distintas?
- **Evidência existente:** `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`, `leitor-epub/src/services/epubImport.ts`, `leitor-epub/src/services/epubSecurity.ts`, `docs/codebase/CONCERNS.md`.
- **Comportamento atual conhecido:** web valida extensão no frontend e tamanho/hash/path no backend; mobile tem checagens de MIME/container, ZIP, DRM, layout e recursos remotos; a diferença foi observada, não classificada como bug.
- **Alternativas observáveis:** paridade estrita; mínimo comum + regras adicionais móveis; políticas específicas web/mobile documentadas; validação web delegada a serviço compartilhado. Não escolher neste plano.
- **TESTs dependentes:** `TEST-013`, `TEST-015`, `TEST-016`, `TEST-017`, `TEST-018` e `TEST-019`; os testes existentes mobile podem caracterizar, mas não transferem Expected para web.
- **Risco de adiar:** P1/high security; usuários podem enviar no web arquivos que o mobile rejeitaria, ou uma correção prematura pode quebrar compatibilidade legítima.
- **Expected (matriz):** “Registrar o comportamento atual de cada superfície, sem afirmar que o web deve copiar as rejeições do mobile. O expected normativo fica bloqueado até decisão humana sobre a paridade de validação.”

### TEST-055 — Política da conta padrão e livros órfãos

- **Decisão a perguntar:** A conta padrão pode existir em produção? Quais segredos/seed são obrigatórios? E qual política deve tratar livro sem owner: rejeitar, quarentenar, reassociar, migrar ou preservar para investigação?
- **Evidência existente:** `docs/codebase/CONCERNS.md`, `docs/system/USER-JOURNEYS.md` (FLOW-023), configuração e seed do backend, especialmente `application.yml`/configuração de conta.
- **Comportamento atual conhecido:** defaults de desenvolvimento podem criar `voce@exemplo.com`/senha default quando variáveis não são fornecidas; não há política aprovada de produção ou de livro órfão.
- **Alternativas observáveis:** seed dev-only; fail-fast sem credenciais; bootstrap operacional explícito; quarentena de órfãos; reassociação auditada; preservação/erro; remoção somente por decisão. Não escolher.
- **TESTs dependentes:** `TEST-054` compartilha startup/seed/recovery e deve separar observação de acceptance; `TEST-001`, `TEST-002` e `TEST-004` podem usar credenciais QA injetadas e não precisam bloquear se a política não for seu objeto.
- **Risco de adiar:** P1/high security/ownership; ambiente pode iniciar com credenciais previsíveis ou tratar dados órfãos de maneira irreversível.
- **Expected (matriz):** “Documentar o que o código faz hoje. Não definir se a conta padrão deve existir em produção nem como livros órfãos devem ser tratados sem decisão humana. O cenário permanece bloqueado para acceptance enquanto a intenção não estiver definida.”

Saída da Wave 8: perguntas respondidas por decisão humana rastreável, sem editar Expected da matriz. Só depois da decisão deve ser criado um plano de mudança/acceptance separado; estes itens são candidatos a tickets de decisão, não implementação automática.

## 11. Dependency graph

```text
BASELINE (Wave 0)
├── backend build/test harness ──► API/contract tests (Wave 1)
│                                  ├── card probes (Wave 2)
│                                  ├── job persistence/recovery (Wave 6)
│                                  └── operational startup/Actuator (Wave 7)
├── web data + isolated PostgreSQL + filesystem
│        └── single Vite/backend harness ──► Playwright E2E_WEB (Wave 3)
├── mobile Jest/SQLite/JSZip existing harness (Wave 0/4)
│        ├── no-device services/repositories/validation (Wave 4)
│        └── mobile fixtures ──► device harness/tool decision ──► E2E_MOBILE/DEVICE (Wave 5)
├── backend + PostgreSQL + controlled SQLite + controllable network
│        └── sync characterization (Wave 6)
│             ├── independent observation: TEST-005/TEST-044
│             └── intent gate: TEST-006/007/008/016 (Wave 8)
└── synthetic Kaikki / fake Ollama / Actuator runtime (Wave 7)
```

Independências intencionais:

- Wave 1 API/backend e Wave 4 mobile Jest não precisam esperar Playwright, device ou sync.
- Wave 2 só precisa do backend/cards e pode rodar antes da infraestrutura web.
- Wave 3 precisa backend/PostgreSQL/filesystem/Vite, mas não precisa de Android.
- Wave 5 depende da decisão de ferramenta/device, não da decisão de conflito de sync para cenários que não exercitam sync.
- Wave 6 precisa de dados/remotes/rede controláveis, mas seus `CHARACTERIZATION` não precisam aguardar a Wave 8.
- Wave 7 usa fixtures sintéticas e pode rodar sem o dataset Kaikki real e sem Ollama real quando o fake cobre o contrato.

## 12. Tickets futuros candidatos para o Linear

Nenhum ticket será criado nesta etapa. Os agrupamentos abaixo são propostas de unidades independentes e revisáveis; não criar uma issue por TEST automaticamente.

| Título candidato | TEST IDs | Prioridade | Dependências | Surface | Definição de pronto |
|---|---|---|---|---|---|
| `[QA-BASELINE] Executar baseline das suítes existentes` | baseline; TEST-012, TEST-026 como existentes | P0 | runtimes Java/Maven/Node/npm/Expo e PostgreSQL | BACKEND / WEB / MOBILE | ledger preenchido com PASS/FAIL/BLOCKED por suíte, logs preservados e FAILs encaminhados sem correção automática |
| `[QA-INFRA] Criar harness HTTP do backend com PostgreSQL e storage isolados` | TEST-002, TEST-003, TEST-010, TEST-014, TEST-015, TEST-021, TEST-024, TEST-040, TEST-047, TEST-060 | P0 | Wave 0 PASS/BLOCKED entendido | BACKEND / BACKEND-OPERATOR | MockMvc/API e banco/storage de teste reproduzíveis, cleanup seguro, comandos documentados e revisão concluída |
| `[QA-BACKEND] Ampliar contratos de segurança, livros, cards e léxico` | TEST-003, TEST-010, TEST-014, TEST-015, TEST-021, TEST-024, TEST-040, TEST-047 | P0 | harness HTTP | BACKEND | cada TEST possui método rastreável, positivos/negativos da matriz, evidência e regressão verde ou FAIL documentado |
| `[QA-PROBE] Investigar queueOrder de criação e move-to-end` | TEST-041, TEST-042 | P1 | banco/harness de cards | BACKEND | probes executados, CONFIRMED/REFUTED/INCONCLUSIVE registrado, sem patch implícito; eventual correção é ticket separado |
| `[QA-MOBILE] Consolidar Jest sem device e extensões existentes` | TEST-012, TEST-018, TEST-026, TEST-031, TEST-035, TEST-037, TEST-049, TEST-050 | P0/P1 | Jest Expo e fixture builders pequenos | MOBILE | suíte sem device reproduzível, extensões existentes aproveitadas, sem migrations/prod alteradas pela tarefa |
| `[QA-WEB-E2E] Criar infraestrutura Playwright única para jornadas web` | TEST-001, TEST-009, TEST-013, TEST-020, TEST-023, TEST-027, TEST-028, TEST-029, TEST-039 | P0/P1 | backend/PostgreSQL/Vite/storage e dados web | WEB | oito E2E_WEB executam com seed/reset/auth/EPUB e artefatos screenshot/trace/log em falha; TEST-029 segue COMPONENT |
| `[QA-MOBILE-DEVICE] Decidir e provar ferramenta E2E nativa` | TEST-004, TEST-011, TEST-017, TEST-019, TEST-022, TEST-025, TEST-030, TEST-032, TEST-033, TEST-034, TEST-036, TEST-038, TEST-043, TEST-048, TEST-051, TEST-052, TEST-053 | P0/P1/P2 | dev build, API 29/estável, emulator/device e spike de compatibilidade | MOBILE | `TOOL_DECISION_REQUIRED` resolvido por evidência de compatibilidade ou mantido bloqueado com comparação registrada; nenhum Playwright indevido |
| `[QA-SYNC] Caracterizar sync, reprocessamento e jobs` | TEST-005, TEST-044, TEST-045, TEST-046 | P0/P1 | backend/Postgres/SQLite/rede controlável | CROSS-SURFACE / BACKEND | estados, requests, retry, jobs e falhas observados com reset; intent separado e sem acceptance inventado |
| `[QA-OP] Operacionalizar Kaikki com fixtures sintéticas e recovery` | TEST-054, TEST-056, TEST-057 | P1/P2 | banco/storage/logs e snapshot sintético pequeno | BACKEND/OPERATOR | startup/recovery/import/restart observáveis, sem dataset grande no repo e sem garantia inventada |
| `[QA-AI] Provar provider Ollama com fake e policies` | TEST-058, TEST-059 | P1/P2 | `HttpServer` fake; Ollama real opcional | BACKEND/OPERATOR | resposta válida, timeout, no-candidate e policies cobertos; provider real separado e evidenciado |
| `[DECISION] Definir conflitos, sync, paridade EPUB e conta padrão` | TEST-006, TEST-007, TEST-008, TEST-016, TEST-055 | P0/P1 | caracterizações correspondentes e decisão humana | CROSS-SURFACE / BACKEND-OPERATOR | perguntas respondidas por decisão registrada; nenhum Expected da matriz reescrito sem aprovação |

## 13. Execution Ledger futuro

Planejar `docs/testing/TEST-RESULTS.md` como um registro versionado, sem criar o arquivo agora. Deve existir uma entrada para cada TEST ID, mesmo antes de executar:

```markdown
## TEST-XXX
- Status: NOT_RUN | PASS | FAIL | BLOCKED | INCONCLUSIVE
- Commit: SHA do checkout executado
- Data/hora UTC: timestamp ISO-8601 da execução
- Ambiente: OS, versões Java/Node/npm, banco, app/device/browser e portas
- Comando: comando completo executado
- Fixture: nome, versão e hash da fixture; caminho fora do repositório quando sensível
- Evidência: log, relatório, screenshot, trace, snapshot, request ou arquivo preservado
- Bug/issue relacionado: ID relacionado ou `none`
- Observação/verdict: comportamento observado e decisão, sem alterar Expected
```

Semântica:

- `NOT_RUN`: ainda não executado.
- `PASS`: Expected da matriz satisfeito com evidência; para `DEFECT_PROBE`, probe concluído e candidato refutado.
- `FAIL`: Expected violado ou anomalia confirmada pelo probe; registrar evidência, sem corrigir automaticamente.
- `BLOCKED`: ambiente, ferramenta, device ou decisão humana impede execução/verdict.
- `INCONCLUSIVE`: executado, mas observação não permite concluir o verdict normativo/probe.

Para `CHARACTERIZATION`, registrar observação e manter o status sem convertê-la em acceptance. Para `INTENT_REQUIRED`, uma observação pode ser registrada como `INCONCLUSIVE` enquanto a decisão estiver aberta. Para `DEFECT_PROBE`, preencher também `CONFIRMED`, `REFUTED` ou `INCONCLUSIVE` na Observação/verdict.

## 14. Validação final do plano

### Cobertura numérica preservada da matriz

| Dimensão | Contagem preservada |
|---|---|
| IDs | TEST-001–TEST-060, únicos e sequenciais |
| Purpose | ACCEPTANCE 27; CONTRACT 22; CHARACTERIZATION 4; DEFECT_PROBE 2; INTENT_REQUIRED 5 |
| Priority | P0 20; P1 33; P2 7 |
| Level | API 11; COMPONENT 2; DEVICE 5; E2E_MOBILE 12; E2E_WEB 8; INTEGRATION 12; OPERATIONAL 5; UNIT 5 |
| Surface | WEB 9; MOBILE 25; BACKEND 12; CROSS-SURFACE 7; BACKEND/OPERATOR 7 |
| Automation status | EXISTING 2; AUTOMATABLE_NOW 17; REQUIRES_INFRASTRUCTURE 19; REQUIRES_DEVICE 17; BLOCKED_BY_INTENT 5; MANUAL_ONLY 0 |

### Checklist de rastreabilidade

- [x] TEST-001–TEST-060 aparecem na atribuição primária ou nas waves/lentes correspondentes; nenhum ID foi omitido.
- [x] Os 17 `AUTOMATABLE_NOW` foram identificados e ordenados P0 → P1 → P2; os cinco mobile estão explicitamente entregues à lane da Wave 4.
- [x] Os dois `DEFECT_PROBE` (`TEST-041`, `TEST-042`) têm fluxo probe → execução → evidência, sem prescrever algoritmo de correção.
- [x] Todos os oito `E2E_WEB` (`TEST-001`, `TEST-009`, `TEST-013`, `TEST-020`, `TEST-023`, `TEST-027`, `TEST-028`, `TEST-039`) usam uma infraestrutura Playwright futura única; `TEST-029` é COMPONENT separado.
- [x] Nenhum `E2E_MOBILE` ou `DEVICE` foi colocado no Playwright web; a Wave 5 marca `TOOL_DECISION_REQUIRED` até provar compatibilidade nativa.
- [x] `Existing tests requiring extension` foi transcrito e cada extensão evita paralelo desnecessário.
- [x] Os cinco `BLOCKED_BY_INTENT` (`TEST-006`, `TEST-007`, `TEST-008`, `TEST-016`, `TEST-055`) têm pergunta, evidência, comportamento atual, alternativas, dependentes e risco, sem resposta prescrita.
- [x] `Expected` foi preservado literalmente nas seções detalhadas; a matriz continua a fonte de verdade.
- [x] Nenhum teste, fixture, código de produção, banco ou migration foi criado/alterado por este plano; nenhuma execução de Playwright foi realizada.

## Resultado esperado ao iniciar a execução

- **Número de waves:** 9, numeradas Wave 0 a Wave 8.
- **Quantidade de TESTs por atribuição primária:** Wave 0 = 0; Wave 1 = 12; Wave 2 = 2; Wave 3 = 9; Wave 4 = 8; Wave 5 = 17; Wave 6 = 4; Wave 7 = 3; Wave 8 = 5. Total = 60.
- **Escopos sobrepostos de planejamento:** Wave 1 inventaria 17 `AUTOMATABLE_NOW`; Wave 4 detalha os 8 mobile sem device; Wave 6 observa os 8 cenários de integração/sync; Wave 7 observa os 7 cenários operacionais; Wave 8 é o gate dos cinco itens de intenção. Esses números são lentes e não devem ser somados ao total primário.
- **Dependências principais:** baseline → harness backend/API; baseline → Jest mobile → fixtures mobile → decisão de ferramenta/device; backend/PostgreSQL/Vite/storage → Playwright web; backend/PostgreSQL/SQLite/rede → sync; fixtures sintéticas → Kaikki/Ollama/Actuator.
- **Primeiro conjunto recomendado:** Wave 0; em seguida TEST-002, TEST-003, TEST-010, TEST-014, TEST-015, TEST-021, TEST-024, TEST-040, TEST-047, TEST-050 e as extensões existentes que o harness suportar, mantendo P0 primeiro.
- **Tickets candidatos para Linear:** os agrupamentos `[QA-BASELINE]`, `[QA-INFRA]`, `[QA-BACKEND]`, `[QA-PROBE]`, `[QA-MOBILE]`, `[QA-WEB-E2E]`, `[QA-MOBILE-DEVICE]`, `[QA-SYNC]`, `[QA-OP]`, `[QA-AI]` e `[DECISION]`, somente após esta etapa e sem criação automática.

Este arquivo encerra a etapa de planejamento. A execução deve parar aqui até uma fase posterior autorizar implementação, fixtures, execução de suítes ou criação de tickets.
