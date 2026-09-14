# Matriz de Testes

## Escopo

Esta matriz é um plano de validação rastreável à baseline de `docs/codebase/*`, `docs/system/SYSTEM-OVERVIEW.md`, `docs/system/CAPABILITIES.md`, `docs/system/API-CATALOG.md` e `docs/system/USER-JOURNEYS.md`. Ela contém cenários existentes e planejados; nenhum teste é implementado nesta fase.

Os IDs `TEST-XXX` são estáveis. Uma mesma journey pode ter vários testes para happy path, contrato, falha, autorização, persistência, retry/reload, integridade, segurança, conflito ou integração quando a baseline justificar. `Existing Coverage` descreve somente o que já foi encontrado: `DIRECT`, `RELATED` ou `NONE`. `Automation status` descreve prontidão, não execução.

Testes estáticos web que leem arquivos-fonte permanecem testes de contrato/unitários e não são E2E. Comportamentos de `UNKNOWN_INTENT` e o `BUG_CANDIDATE` de `queueOrder` não recebem expected normativo.

## TEST-001 — Login web válido abre a biblioteca

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-001
- CAP-003

Journeys:
- FLOW-001

APIs:
- API-001
- API-002
- API-003

Preconditions:
Backend disponível, conta válida configurada e navegador com armazenamento local limpo.

Test data:
Credencial válida e biblioteca com zero ou mais livros do owner.

Steps:
1. Abrir a aplicação web e enviar o formulário de login.
2. Observar a validação de sessão e a carga da biblioteca.

Expected:
O login retorna sessão, a sessão é mantida pelo web e a biblioteca carregada é exibida.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- RELATED

Existing tests:
- `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java` cobre autenticação da API, não a jornada web completa.

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `frontend/src/LoginView.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`

Notes:
Playwright é planejado para a futura execução web; não executar nesta fase.

## TEST-002 — Login web rejeita credencial inválida

Purpose:
ACCEPTANCE

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-001

Journeys:
- FLOW-001

APIs:
- API-001

Preconditions:
Backend disponível e usuário inexistente ou senha incorreta.

Test data:
E-mail válido com senha incorreta e credencial inexistente.

Steps:
1. Enviar `POST /api/auth/login` com cada credencial negativa.
2. Observar resposta e ausência de sessão utilizável.

Expected:
A autenticação falha conforme o contrato observado; não é criada sessão autenticada.

Expected Basis:
- CAPABILITY
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
AUTOMATABLE_NOW

Evidence:
- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `docs/system/API-CATALOG.md`

Notes:
Não fixar uma mensagem ou status além do que o catálogo demonstrar na execução futura.

## TEST-003 — API autenticada rejeita token ausente ou inválido

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-001
- CAP-003

Journeys:
- FLOW-001

APIs:
- API-003

Preconditions:
Backend disponível e request para biblioteca sem Bearer, com token malformado ou expirado.

Test data:
Requests `GET /api/books` sem header e com tokens inválidos.

Steps:
1. Enviar os requests negativos.
2. Confirmar que nenhum dado de biblioteca é retornado como autenticado.

Expected:
O filtro de segurança rejeita a chamada não autenticada conforme o contrato; não há acesso ao owner.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- DIRECT

Existing tests:
- `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java`

Automation status:
EXISTING

Evidence:
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthFilter.java`

Notes:
Este teste cobre a fronteira backend, não o armazenamento de sessão no mobile.
## TEST-004 — Login mobile persiste sessão antes da área principal

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-001

Journeys:
- FLOW-002

APIs:
- API-001

Preconditions:
Aplicativo instalado, SQLite inicializado, backend disponível e URL de API configurada.

Test data:
Credencial válida e armazenamento local sem sessão anterior.

Steps:
1. Enviar o formulário mobile.
2. Observar o armazenamento da sessão e a navegação para `/`.

Expected:
Login válido cria a sessão local e encaminha o usuário para a área principal. O resultado do sync inicial deve ser observado separadamente, sem ser tratado como critério desta entrada.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/app/login.tsx`
- `leitor-epub/app/_layout.tsx`
- `leitor-epub/src/db/repository.ts`

Notes:
Não usar Playwright como pressuposto para a execução nativa mobile.

## TEST-005 — Observar a tentativa de sync inicial após login mobile

Purpose:
CHARACTERIZATION

Priority:
P0

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-001
- CAP-022

Journeys:
- FLOW-002
- FLOW-018

APIs:
- API-001
- API-003
- API-004
- API-005
- API-008
- API-010
- API-011
- API-012
- API-013
- API-014
- API-015
- API-016
- API-017
- API-018

Preconditions:
Backend, PostgreSQL, SQLite e uma rede controlável disponíveis.

Test data:
Credencial válida, livro/card local e backend com estados correspondentes; repetir com backend offline durante a tentativa inicial.

Steps:
1. Fazer login mobile.
2. Capturar requests, `SyncResult`, sessão e alterações local/remotas.
3. Repetir com uma etapa remota indisponível.

Expected:
Registrar o que o código faz hoje: se a sessão permanece válida, quais entidades são tocadas e como o sync parcial/offline é reportado. Não aprovar aqui política de autoridade, conflito ou escopo de dados.

Expected Basis:
- CHARACTERIZATION_ONLY
- HUMAN_DECISION_REQUIRED

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `leitor-epub/app/login.tsx`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/repository.ts`
- `docs/system/API-CATALOG.md`

Notes:
O comportamento observado não deve virar `ACCEPTANCE` antes da decisão de produto.
## TEST-006 — Política de autoridade em conflito local/remoto

Purpose:
INTENT_REQUIRED

Priority:
P0

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-004
- CAP-010
- CAP-017
- CAP-018
- CAP-022

Journeys:
- FLOW-002
- FLOW-018

APIs:
- API-003
- API-008
- API-010
- API-011
- API-012
- API-013
- API-014
- API-015

Preconditions:
Backend e SQLite com a mesma entidade divergindo nos dois lados e rede controlável.

Test data:
Progresso, card/conteúdo, arquivamento e ordem com timestamps e valores diferentes local/remoto.

Steps:
1. Executar login/sync com os valores divergentes.
2. Capturar requests, valores vencedores e alterações em cada lado.
3. Comparar a observação com a decisão de produto, quando existir.

Expected:
Nenhum vencedor é presumido. Registrar o comportamento atual e deixar o verdict normativo bloqueado até definir autoridade, precedência temporal e política de conflito.

Expected Basis:
- HUMAN_DECISION_REQUIRED
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
BLOCKED_BY_INTENT

Evidence:
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/repository.ts`
- `docs/system/SYSTEM-OVERVIEW.md`
- `docs/codebase/CONCERNS.md`

Notes:
Não transformar o algoritmo observado de merge em `ACCEPTANCE` sem aprovação explícita.
## TEST-007 — Escopo de annotations, bookmarks e preferências no sync

Purpose:
INTENT_REQUIRED

Priority:
P1

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-010
- CAP-011
- CAP-013
- CAP-015
- CAP-022

Journeys:
- FLOW-018

APIs:
- API-003
- API-008
- API-010
- API-011
- API-012
- API-013
- API-014
- API-015

Preconditions:
Dados locais de annotation, bookmark e preferência e uma conta backend sincronizável.

Test data:
Cada tipo com versão local modificada e estado remoto ausente ou divergente.

Steps:
1. Executar sync com cada entidade local.
2. Observar se é enviada, ignorada, removida ou preservada.
3. Registrar a decisão necessária para o comportamento desejado.

Expected:
Não definir expectativa de envio, merge ou descarte. O teste deve documentar o comportamento atual e permanecer bloqueado até decidir se esses dados fazem parte do sync.

Expected Basis:
- HUMAN_DECISION_REQUIRED
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
BLOCKED_BY_INTENT

Evidence:
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/repository.ts`
- `docs/system/CAPABILITIES.md`

Notes:
A baseline registra ausência de merge; isso não é requisito de aceitação.

## TEST-008 — Tratamento de livro somente remoto no sync

Purpose:
INTENT_REQUIRED

Priority:
P1

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-004
- CAP-022

Journeys:
- FLOW-018

APIs:
- API-003
- API-004
- API-005

Preconditions:
Conta autenticada e livro existente somente no backend.

Test data:
Livro remoto com metadados, hash e conteúdo disponíveis; SQLite sem esse livro.

Steps:
1. Executar `syncLibrary`.
2. Observar se o livro e seu conteúdo são baixados, apenas associados ou ignorados.
3. Registrar a decisão de produto correspondente.

Expected:
Nenhuma política de download/associação é presumida. Registrar o comportamento implementado e não classificá-lo como falha ou sucesso de produto antes da decisão.

Expected Basis:
- HUMAN_DECISION_REQUIRED
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
BLOCKED_BY_INTENT

Evidence:
- `leitor-epub/src/services/sync.ts`
- `docs/system/SYSTEM-OVERVIEW.md`
- `docs/codebase/CONCERNS.md`

Notes:
O não-download foi observado na baseline, mas não é expected behavior aprovado.
## TEST-009 — Biblioteca web pesquisa e apresenta capas

Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-003

Journeys:
- FLOW-003

APIs:
- API-003
- API-007

Preconditions:
Sessão web válida, livros com títulos/autores e ao menos uma capa disponível.

Test data:
Coleção com resultado, sem resultado, item sem capa e filtro por título/autor.

Steps:
1. Abrir a biblioteca e aguardar a lista.
2. Pesquisar por título e autor.
3. Observar contagem, estado vazio e placeholder/capa.

Expected:
A grade mostra somente os resultados do filtro, a contagem/estado vazio é coerente e capa ausente não impede o item de aparecer.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`

Notes:
E2E web futuro; não executar navegador nesta etapa.

## TEST-010 — Contrato de listagem web respeita pesquisa e owner

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-003

Journeys:
- FLOW-003

APIs:
- API-003
- API-007

Preconditions:
Dois owners, livros com títulos/autores distintos e capa disponível/ausente.

Test data:
Busca vazia, busca por título/autor, termo sem resultado e IDs de livros de outro owner.

Steps:
1. Chamar `GET /api/books` autenticado com e sem `search`.
2. Chamar `GET /api/books/{id}/cover` para item próprio, ausente e de outro owner.

Expected:
A resposta contém apenas itens permitidos ao owner e respeita a busca; capa ausente, inexistente ou não autorizada segue o contrato documentado sem expor arquivo de outro owner.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
AUTOMATABLE_NOW

Evidence:
- `docs/system/API-CATALOG.md`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`

Notes:
Não fixar status/mensagem não especificados no catálogo.
## TEST-011 — Biblioteca local mobile lista e filtra livros

Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-004

Journeys:
- FLOW-004

APIs:
- NONE

Preconditions:
App instalado, SQLite inicializado e biblioteca local com zero ou mais livros.

Test data:
Livros com títulos/autores distintos, capa disponível/ausente e busca sem resultado.

Steps:
1. Abrir `/` offline.
2. Observar lista, pesquisa, contagem/estado vazio e ações do `BookCard`.

Expected:
A biblioteca é carregada do SQLite sem HTTP obrigatório; filtro, estado vazio e placeholder funcionam conforme a journey.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/components/BookCard.tsx`
- `leitor-epub/src/db/repository.ts`

Notes:
Requer runner mobile compatível com React Native; Playwright não é pressuposto.

## TEST-012 — Migrations SQLite preparam o armazenamento da biblioteca

Purpose:
CONTRACT

Priority:
P1

Level:
UNIT

Surface:
MOBILE

Capabilities:
- CAP-004

Journeys:
- FLOW-004
- FLOW-006

APIs:
- NONE

Preconditions:
Objeto SQLite controlado simulando versões 0, atual e futura.

Test data:
Banco sem schema, banco na versão atual e banco com versão maior que a suportada.

Steps:
1. Executar `migrateDatabase` para cada versão.
2. Verificar pragmas, criação transacional do schema, versão final e rejeição de versão futura.

Expected:
Migrations aplicam o schema observado atomicamente, mantêm a versão suportada e recusam banco de versão futura.

Expected Basis:
- EXISTING_TEST
- CONTRACT

Existing Coverage:
- RELATED

Existing tests:
- `leitor-epub/src/db/migrations.test.ts`

Automation status:
EXISTING

Evidence:
- `leitor-epub/src/db/migrations.ts`
- `leitor-epub/src/db/migrations.test.ts`

Notes:
Este teste cobre pré-condição de armazenamento, não a tela nem `listBooks`.
## TEST-013 — Upload web inicia automaticamente o job lexical

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-003
- CAP-005
- CAP-016
- CAP-019

Journeys:
- FLOW-005

APIs:
- API-004
- API-005
- API-016
- API-017
- API-019

Preconditions:
Sessão web válida, backend com filesystem e runner lexical disponíveis.

Test data:
EPUB mínimo válido com metadados, hash conhecido e termos consultáveis.

Steps:
1. Confirmar “Adicionar livro” com o EPUB selecionado.
2. Observar criação, upload, chamada automática de API-016 e polling de API-017.
3. Após conclusão, consultar um termo por API-019.

Expected:
O frontend cria o registro, envia o EPUB, inicia automaticamente o job sem nova ação manual e acompanha seu estado; após sucesso, lookup responde. Falha do início automático deve permanecer distinguida de falha do upload.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- DIRECT

Existing tests:
- `frontend/book-upload.test.mjs`
- `frontend/src/bookDetails.test.ts`
- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java`

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`

Notes:
 O reprocessamento com `force=true` é cenário separado em TEST-045.

## TEST-014 — Contrato de criação web rejeita duplicidade e hash divergente

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-005

Journeys:
- FLOW-005

APIs:
- API-004

Preconditions:
Backend com owner autenticado e livro existente por hash.

Test data:
Request válido, request com campos normalizáveis, hash duplicado e hash divergente do conteúdo futuro.

Steps:
1. Enviar requests de criação com os dados de cada fixture.
2. Observar entidade criada, normalização e conflito.

Expected:
Request válido cria registro do owner; campos textuais seguem normalização observada; hash duplicado é rejeitado conforme contrato e hash divergente não deve ser aceito como conteúdo correspondente.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
AUTOMATABLE_NOW

Evidence:
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `docs/system/API-CATALOG.md`

Notes:
Não fixar código de erro ou mensagem sem evidência adicional do catálogo/execução.
## TEST-015 — Upload web valida ownership, tamanho, hash e caminho

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-005

Journeys:
- FLOW-005

APIs:
- API-005

Preconditions:
Livro criado para o owner autenticado e storage backend controlável.

Test data:
EPUB válido, arquivo acima de 100 MB, hash divergente, arquivo ausente, owner diferente e caminho fora da raiz permitida.

Steps:
1. Enviar cada variante para `POST /api/books/{id}/content`.
2. Verificar resposta, existência do arquivo gerenciado e isolamento do owner.

Expected:
Upload válido armazena o conteúdo permitido; tamanho/hash/path/ownership inválidos são rejeitados conforme o contrato observado e não confirmam o armazenamento daquele conteúdo.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
AUTOMATABLE_NOW

Evidence:
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `docs/system/API-CATALOG.md`

Notes:
A verificação de estrutura EPUB forte não deve ser presumida neste teste; é tratada separadamente em TEST-016.
## TEST-016 — Decidir paridade de validação EPUB entre upload web e importação mobile

Purpose:
INTENT_REQUIRED

Priority:
P1

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-005
- CAP-006

Journeys:
- FLOW-005
- FLOW-006

APIs:
- API-005

Preconditions:
Upload web e importação mobile disponíveis com fixtures estruturais equivalentes.

Test data:
EPUB com DRM, layout fixo, recurso remoto, MIME/container inválido e ZIP/CRC inválido.

Steps:
1. Submeter cada fixture no upload web e na importação mobile.
2. Registrar divergências de aceitação, rejeição e efeitos persistidos.
3. Aguardar decisão sobre a política web.

Expected:
Registrar o comportamento atual de cada superfície, sem afirmar que o web deve copiar as rejeições do mobile. O expected normativo fica bloqueado até decisão humana sobre a paridade de validação.

Expected Basis:
- HUMAN_DECISION_REQUIRED
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- leitor-epub/src/services/epubImport.test.ts cobre somente o caminho mobile.

Automation status:
- BLOCKED_BY_INTENT

Evidence:
- backend/src/main/java/br/com/leitormobile/book/BookContentService.java
- leitor-epub/src/services/epubImport.ts
- leitor-epub/src/services/epubSecurity.ts
- docs/codebase/CONCERNS.md

Notes:
Não converter a diferença observada em bug ou acceptance sem decisão de produto.

## TEST-017 — Importação mobile aceita EPUB válido e persiste livro

Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-004
- CAP-006

Journeys:
- FLOW-006

APIs:
- NONE

Preconditions:
App com Document Picker, SQLite e filesystem privado disponíveis.

Test data:
EPUB fluido mínimo EPUB 2 e EPUB 3, com e sem capa.

Steps:
1. Selecionar o arquivo pela biblioteca.
2. Aguardar validação, cópia e persistência.
3. Reabrir a biblioteca e o reader.

Expected:
EPUB válido é validado, armazenado no filesystem privado, registrado uma vez no SQLite e fica disponível na biblioteca/reader.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- DIRECT

Existing tests:
- `leitor-epub/src/services/epubImport.test.ts`
- `leitor-epub/src/services/epubSecurity.test.ts`

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/db/repository.ts`

Notes:
A aceitação completa requer device/emulador; testes de serviço existentes não provam picker/filesystem real.

## TEST-018 — Importação mobile rejeita EPUB inválido e inseguro

Purpose:
ACCEPTANCE

Priority:
P0

Level:
UNIT

Surface:
MOBILE

Capabilities:
- CAP-006

Journeys:
- FLOW-006

APIs:
- NONE

Preconditions:
Harness de JSZip/parser e funções de validação disponíveis.

Test data:
ZIP/CRC inválido, arquivo sem MIME/container/OPF/spine, layout fixo, DRM, recurso remoto, path inseguro, limites de entrada/expansão e arquivo acima do limite.

Steps:
1. Executar a validação com cada fixture.
2. Verificar rejeição e ausência de metadados aceitos.

Expected:
Cada condição sustentada pela baseline é rejeitada pelas validações de segurança/importação; nenhum arquivo inválido deve ser tratado como EPUB aceito.

Expected Basis:
- CAPABILITY
- SECURITY_REQUIREMENT
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- `leitor-epub/src/services/epubImport.test.ts`
- `leitor-epub/src/services/epubSecurity.test.ts`

Automation status:
EXISTING

Evidence:
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/epubSecurity.ts`

Notes:
O teste não valida a UI nem a cópia em filesystem real.

## TEST-019 — Importação mobile evita duplicidade e limpa cópia parcial

Purpose:
CONTRACT

Priority:
P1

Level:
DEVICE

Surface:
MOBILE

Capabilities:
- CAP-006

Journeys:
- FLOW-006

APIs:
- NONE

Preconditions:
SQLite e filesystem privado controláveis.

Test data:
Mesmo EPUB duas vezes, falha após cópia do arquivo e falha ao persistir capa/metadados.

Steps:
1. Importar o EPUB pela primeira vez e repetir pelo mesmo hash.
2. Induzir falha após a cópia.
3. Inspecionar registros e arquivos residuais.

Expected:
A segunda importação retorna o livro existente sem duplicar a cópia; em falha parcial, observar e registrar a limpeza implementada sem exigir comportamento não descrito pela baseline.

Expected Basis:
- CAPABILITY
- JOURNEY
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/db/repository.ts`

Notes:
Se a política de cleanup precisar ser normativa, separar decisão de produto de characterization.
## TEST-020 — Exclusão web remove conteúdo e registro

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-007

Journeys:
- FLOW-007

APIs:
- API-009

Preconditions:
Sessão web válida, livro próprio e EPUB/capas no storage backend.

Test data:
Livro com EPUB, capa JPG e possível capa stale PNG.

Steps:
1. Confirmar “Excluir livro” na biblioteca web.
2. Observar request, filesystem backend, registro e lista.

Expected:
O livro deixa de aparecer e conteúdo/registro gerenciados são removidos conforme o caminho web.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- DIRECT

Existing tests:
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java` cobre service/filesystem, não a UI web completa.

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`

Notes:
Futuro E2E web; não assumir que teste mobile cubra este fluxo.
## TEST-021 — Exclusão web isola ownership e rejeita livro ausente/path inseguro

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-007

Journeys:
- FLOW-007

APIs:
- API-009

Preconditions:
Dois owners, livro próprio, livro de outro owner, ID ausente e arquivo fora da raiz permitida.

Test data:
Requests autenticados e não autenticados para cada caso.

Steps:
1. Chamar `DELETE /api/books/{id}` para cada livro/ID.
2. Verificar isolamento, efeito no filesystem e registro.

Expected:
Somente o recurso autorizado é removível; livro ausente, owner incorreto, sessão inválida ou path inseguro são rejeitados conforme contrato, sem apagar recurso de outro owner.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- DIRECT

Existing tests:
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java`

Automation status:
EXISTING

Evidence:
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `docs/system/API-CATALOG.md`

Notes:
O teste existente cobre path externo e remoção; ownership/HTTP devem ser completados.

## TEST-022 — Exclusão local mobile remove registro e arquivos

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-007

Journeys:
- FLOW-027

APIs:
- NONE

Preconditions:
Livro local com registro SQLite, EPUB e capa no filesystem privado.

Test data:
Livro com capa e livro sem capa; confirmação e cancelamento.

Steps:
1. Abrir menu do livro e cancelar uma vez.
2. Confirmar a remoção.
3. Recarregar a biblioteca e inspecionar SQLite/filesystem.

Expected:
Cancelamento não altera o livro; após confirmar, registro, EPUB e capa locais deixam de estar disponíveis e nenhuma chamada HTTP é feita.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/epubImport.ts`

Notes:
A ordem observada de remoção de registro e arquivos deve ser registrada, sem alterar código nesta fase.

## TEST-023 — Reader web abre EPUB e restaura posição

Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-008
- CAP-010

Journeys:
- FLOW-008

APIs:
- API-006
- API-008

Preconditions:
Sessão válida, livro próprio com arquivo EPUB e posição inicial no backend.

Test data:
EPUB mínimo renderizável, livro sem progresso e livro com CFI/progresso salvo.

Steps:
1. Abrir o livro na biblioteca web.
2. Navegar e aguardar atualização de progresso.
3. Fechar e reabrir o livro.

Expected:
O EPUB é renderizado, a navegação altera o estado e a posição persistida é aplicada na reabertura; falha de arquivo mostra o tratamento da UI.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- NONE

Existing tests:
- `leitor-epub/src/reader/progress.test.ts` é mobile e não conta como cobertura web.

Automation status:
REQUIRES_INFRASTRUCTURE

Evidence:
- `frontend/src/EpubReader.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`

Notes:
Playwright é candidato futuro para esta jornada web; não executar agora.

## TEST-024 — Contrato de download e progresso rejeita acesso/valores inválidos

Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-008
- CAP-010

Journeys:
- FLOW-008

APIs:
- API-006
- API-008

Preconditions:
Dois owners, livro próprio com arquivo, livro sem arquivo e sessão válida/ausente.

Test data:
ID inexistente, livro de outro owner, progresso abaixo/acima do domínio e CFI vazio ou inválido conforme DTO.

Steps:
1. Chamar download/progresso com cada combinação autorizada e negativa.
2. Verificar resposta, arquivo entregue e persistência de valores válidos.

Expected:
Apenas recurso autorizado com arquivo acessível é entregue; requests inválidos ou não autorizados são rejeitados conforme contrato e não persistem progresso inválido.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado.

Automation status:
AUTOMATABLE_NOW

Evidence:
- `docs/system/API-CATALOG.md`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`

Notes:
Não inventar status HTTP para casos cuja resposta não esteja explicitada no catálogo.
## TEST-025 — Reader mobile navega, pesquisa e restaura posição

Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-009
- CAP-010
- CAP-011
- CAP-012

Journeys:
- FLOW-009

APIs:
- NONE

Preconditions:
Livro local, EPUB acessível, SQLite inicializado e reader nativo disponível.

Test data:
EPUB com TOC/localizações, posição salva e preferências de fonte/tema/tamanho.

Steps:
1. Abrir `/reader/[id]`, navegar, pesquisar e usar TOC/anterior-próximo.
2. Alterar preferências, sair e reabrir.
3. Observar CFI/progresso e estado local.

Expected:
O livro é lido localmente, navegação/pesquisa/preferências funcionam e posição fica disponível ao retornar, conforme a journey mobile.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- DIRECT

Existing tests:
- `leitor-epub/src/reader/progress.test.ts`
- `leitor-epub/src/reader/readerBridge.test.ts` cobrem unidades, não o reader completo.

Automation status:
REQUIRES_DEVICE

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/db/repository.ts`

Notes:
Requer E2E/device compatível com React Native e WebView; Playwright web não substitui este teste.

## TEST-026 — Contratos de progresso e ponte do reader mobile

Purpose:
CONTRACT

Priority:
P1

Level:
UNIT

Surface:
MOBILE

Capabilities:
- CAP-009
- CAP-010

Journeys:
- FLOW-009

APIs:
- NONE

Preconditions:
Harness Jest mobile disponível.

Test data:
CFIs/progressos válidos, inválidos, vazios e eventos de ponte desconhecidos.

Steps:
1. Executar normalização/localização de progresso.
2. Executar parsing de eventos `Relocated`/seleção inválidos.

Expected:
Valores fora do domínio e mensagens malformadas são tratados como os contratos atuais; eventos válidos são normalizados para o formato do reader.

Expected Basis:
- EXISTING_TEST
- CONTRACT

Existing Coverage:
- DIRECT

Existing tests:
- `leitor-epub/src/reader/progress.test.ts`
- `leitor-epub/src/reader/readerBridge.test.ts`

Automation status:
EXISTING

Evidence:
- `leitor-epub/src/reader/progress.ts`
- `leitor-epub/src/reader/readerBridge.ts`

Notes:
Não é E2E e não prova WebView/filesystem real.




## TEST-027 — Seleção lexical web com resultado e sem resultado
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-014
- CAP-016

Journeys:
- FLOW-010

APIs:
- API-019

Preconditions:
- Usuário autenticado.
- Livro preparado lexicalmente e leitor web disponível.

Test data:
- Termo com entrada lexical.
- Termo sem resultado.

Steps:
1. Selecionar um termo com entrada lexical.
2. Observar o lookup e o painel apresentado.
3. Repetir com termo sem resultado.
4. Registrar a resposta e o estado da UI em ambos os casos.

Expected:
- A seleção consulta o lookup lexical do livro.
- Uma entrada encontrada é apresentada de acordo com o contrato de dados observado.
- A ausência de resultado é tratada conforme o comportamento documentado, sem inventar conteúdo.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- DIRECT
- RELATED

Existing tests:
- frontend/lexicon-lookup.test.mjs — DIRECT, valida estaticamente a leitura de entry.lemma.
- frontend/lexicon-entry-contract.test.mjs — RELATED, valida contrato do modal lexical.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-010.
- docs/system/CAPABILITIES.md — CAP-014 e CAP-016.
- docs/system/API-CATALOG.md — API-019.
- frontend/src/EpubReader.tsx e fluxo lexical.

Notes:
- O teste futuro será E2E_WEB; os testes existentes são estáticos e não são E2E.

## TEST-028 — Seleção lexical web cria card
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-014
- CAP-017

Journeys:
- FLOW-010

APIs:
- API-011
- API-019

Preconditions:
- Usuário autenticado.
- Termo selecionável e lookup lexical disponível.

Test data:
- Seleção com definição/entrada lexical suficiente para o card.
- Identidade do livro e localização da seleção.

Steps:
1. Selecionar um termo no leitor web.
2. Consultar ou observar a entrada lexical.
3. Acionar a criação do card.
4. Verificar o payload enviado e o card apresentado.

Expected:
- A seleção usa o lookup aplicável e envia dados compatíveis com o contrato de criação de card.
- O card criado fica associado ao usuário e ao livro corretos.
- Não se deve assumir uma regra de ordenação de queueOrder além da observação específica dos DEFECT_PROBE.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- DIRECT

Existing tests:
- frontend/card-creation.test.mjs — DIRECT, valida estaticamente lookup e payload de criação.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-010.
- docs/system/API-CATALOG.md — API-011 e API-019.
- frontend/card-creation.test.mjs.
- frontend/src/EpubReader.tsx.

Notes:
- A suíte futura deve separar criação do card da investigação de queueOrder.

## TEST-029 — Contrato dos campos lexicais no modal web
Purpose:
CONTRACT

Priority:
P1

Level:
COMPONENT

Surface:
WEB

Capabilities:
- CAP-016

Journeys:
- FLOW-010

APIs:
- API-019

Preconditions:
- Componente de detalhes do processamento lexical disponível.
- Fixture de entrada lexical com senses e frequency.

Test data:
- Entrada com tradução em senses[0].translationPtBr.
- Entrada com frequency.
- Entrada sem campos opcionais.

Steps:
1. Renderizar o modal com cada entrada.
2. Observar os campos de tradução e frequência.
3. Comparar o acesso aos dados com o contrato vigente.

Expected:
- O componente usa os campos lexicalmente disponíveis sem acessar propriedade inexistente.
- Campos opcionais ausentes seguem o comportamento atual documentado; não inventar fallback normativo.

Expected Basis:
- API_CONTRACT
- EXISTING_TEST

Existing Coverage:
- RELATED

Existing tests:
- frontend/lexicon-entry-contract.test.mjs — RELATED, teste estático de contrato; não é E2E.

Automation status:
- EXISTING

Evidence:
- frontend/lexicon-entry-contract.test.mjs.
- frontend/src/BookProcessingDetailsModal.tsx.
- docs/system/API-CATALOG.md — API-019.

Notes:
- O arquivo referenciado existe fisicamente na baseline.

## TEST-030 — Lookup de dicionário mobile com cache e fallback externo
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-014
- CAP-016

Journeys:
- FLOW-011

APIs:
- OUT-001

Preconditions:
- Leitor mobile aberto com termo pesquisável.
- Cache/dicionário local e conectividade controlada.

Test data:
- Termo presente no índice local.
- Termo ausente localmente, mas existente no Wiktionary.
- Termo sem resultado.

Steps:
1. Consultar termo presente localmente.
2. Consultar termo ausente localmente com conectividade.
3. Repetir sem conectividade.
4. Observar cache, resposta externa e estado de ausência.

Expected:
- O lookup usa o caminho local/externo conforme a implementação e a disponibilidade.
- A chamada externa, quando ocorrer, observa OUT-001.
- Ausência de resultado e indisponibilidade são observadas conforme contratos existentes, sem inventar conteúdo.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/lookup.test.ts — DIRECT, valida a construção da URL externa e caminhos do lookup.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-011.
- docs/system/API-CATALOG.md — OUT-001.
- leitor-epub/src/services/lookup.ts.

Notes:
- A conectividade externa não transforma este cenário em API backend.
## TEST-031 — Contrato do OUT-001: erro, ausência e cache do dicionário
Purpose:
CONTRACT

Priority:
P1

Level:
API

Surface:
MOBILE

Capabilities:
- CAP-016

Journeys:
- FLOW-011

APIs:
- OUT-001

Preconditions:
- Serviço de lookup isolado e resposta HTTP controlável.
- Cache local disponível.

Test data:
- Resposta válida com página.
- HTTP não-2xx.
- Página ausente ou resposta sem entrada.
- Termo repetido para verificar cache.

Steps:
1. Consultar um termo com resposta válida.
2. Repetir com erro não-2xx e página ausente.
3. Repetir uma consulta já armazenada no cache.
4. Registrar URL, tratamento e chamadas observadas.

Expected:
- A URL e o formato da integração seguem OUT-001.
- Erros não-2xx e ausência de página são tratados conforme o comportamento documentado.
- O uso de cache é observado sem inventar política de expiração ou fallback.

Expected Basis:
- API_CONTRACT
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/lookup.test.ts — DIRECT, cobre a URL externa; respostas de erro devem ser ampliadas no futuro.

Automation status:
- AUTOMATABLE_NOW

Evidence:
- docs/system/API-CATALOG.md — OUT-001.
- docs/system/CAPABILITIES.md — CAP-016.
- leitor-epub/src/services/lookup.ts e lookup.test.ts.

Notes:
- Não tratar o endpoint externo como API-001–API-021.

## TEST-032 — Tradução mobile em caminhos local e externo
Purpose:
ACCEPTANCE

Priority:
P2

Level:
DEVICE

Surface:
MOBILE

Capabilities:
- CAP-014
- CAP-015

Journeys:
- FLOW-012

APIs:
- NONE

Preconditions:
- Leitor mobile com seleção de texto.
- Caminhos de tradução e conectividade controlados.

Test data:
- Texto traduzível.
- Texto sem resultado.
- Rede disponível e indisponível.

Steps:
1. Selecionar texto e solicitar tradução.
2. Repetir com ausência de resultado.
3. Repetir offline.
4. Observar resposta, indicação de erro e qualquer cache.

Expected:
- Com texto traduzível e serviço disponível, a tradução é solicitada e o resultado é apresentado conforme CAP-015.
- Para ausência de resultado e indisponibilidade, registrar o comportamento atual sem inventar uma política de fallback.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/lookup.test.ts — DIRECT, cobre a superfície externa relacionada, mas não a jornada completa.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-012.
- docs/system/CAPABILITIES.md — CAP-014 e CAP-015.
- leitor-epub/src/services/lookup.ts.

Notes:
- O expected normativo para fallback/tradução depende da política real do produto.

## TEST-033 — Comportamento de tradução quando a integração está indisponível
Purpose:
CHARACTERIZATION

Priority:
P2

Level:
DEVICE

Surface:
MOBILE

Capabilities:
- CAP-015

Journeys:
- FLOW-012

APIs:
- NONE

Preconditions:
- Serviço de tradução configurado conforme a baseline.
- Rede ou provedor externo indisponível.

Test data:
- Timeout.
- Resposta vazia.
- Erro do provedor.

Steps:
1. Solicitar tradução em cada condição.
2. Observar erro, fallback, cache e estado da UI.
3. Registrar o resultado sem tratá-lo como regra ideal.

Expected:
- O comportamento implementado atualmente é documentado para orientar uma decisão posterior.
- Nenhuma saída suspeita é promovida automaticamente a acceptance.

Expected Basis:
- CHARACTERIZATION_ONLY

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/lookup.test.ts — DIRECT, cobre apenas a parte estática do lookup.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/codebase/CONCERNS.md.
- leitor-epub/src/services/lookup.ts e lookup.test.ts.

Notes:
- Se a política correta for decidida, este cenário pode ser convertido em ACCEPTANCE ou DEFECT_PROBE.

## TEST-034 — Mobile cria card a partir de seleção lexical
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-014
- CAP-017

Journeys:
- FLOW-013

APIs:
- NONE

Preconditions:
- Livro mobile aberto e termo selecionável.
- Dados lexicais locais disponíveis.

Test data:
- Seleção com entrada lexical válida.
- Seleção sem entrada lexical.

Steps:
1. Selecionar termo no leitor mobile.
2. Abrir a ação de criação de card.
3. Confirmar o card.
4. Reabrir a lista local e observar o card.

Expected:
- Um card é criado com os dados da seleção e fica disponível no armazenamento mobile conforme a capability.
- A ausência de entrada lexical é apresentada/tratada conforme o comportamento documentado, sem inventar mensagem.

Expected Basis:
- CAPABILITY
- JOURNEY
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/lexicon.test.ts — DIRECT, cobre unidade lexical relacionada.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-013.
- docs/system/CAPABILITIES.md — CAP-014 e CAP-017.
- leitor-epub/src/services/lexicon.ts.

Notes:
- A validação completa requer dispositivo ou harness mobile equivalente.
## TEST-035 — Contrato de card mobile com dados inválidos ou ausentes
Purpose:
CONTRACT

Priority:
P1

Level:
COMPONENT

Surface:
MOBILE

Capabilities:
- CAP-017

Journeys:
- FLOW-013

APIs:
- NONE

Preconditions:
- Componente/serviço de criação de card isolável.
- SQLite de teste disponível.

Test data:
- Card válido.
- Card sem termo, livro ou dados lexicais obrigatórios.
- Referência de livro/card inexistente.

Steps:
1. Submeter card válido.
2. Submeter cada combinação inválida ou referenciando entidade ausente.
3. Observar validação, persistência e estado resultante.

Expected:
- Entrada válida segue o contrato atual de criação.
- Entrada inválida ou referência ausente é rejeitada/tratada conforme a implementação documentada, sem inventar mensagem ou status.
- Nenhum registro parcial indevido é produzido.

Expected Basis:
- CAPABILITY
- EXISTING_TEST
- API_CONTRACT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste específico de validação de card mobile encontrado.

Automation status:
- AUTOMATABLE_NOW

Evidence:
- docs/system/CAPABILITIES.md — CAP-017.
- leitor-epub/src/services/lexicon.ts.
- leitor-epub/src/db/repository.ts.

Notes:
- Este cenário não presume que a validação web e mobile seja idêntica.

## TEST-036 — Annotations mobile são criadas, editadas e removidas
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-013
- CAP-014

Journeys:
- FLOW-014

APIs:
- NONE

Preconditions:
- Livro aberto no leitor mobile.
- Armazenamento local inicializado.

Test data:
- Seleção com texto e localização.
- Annotation existente para edição e remoção.

Steps:
1. Selecionar texto e criar annotation.
2. Reabrir a posição anotada.
3. Editar o conteúdo.
4. Remover a annotation e recarregar o livro.

Expected:
- A annotation é associada à localização correta, permanece disponível ao reabrir e pode ser editada/removida conforme a capability.
- O estado observado após cada operação é persistido no armazenamento local.

Expected Basis:
- CAPABILITY
- JOURNEY
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/db/repository.test.ts — DIRECT, cobre operações de repositório relacionadas.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-014.
- docs/system/CAPABILITIES.md — CAP-013 e CAP-014.
- leitor-epub/src/db/repository.ts e repository.test.ts.

Notes:
- A unidade de repositório não substitui a validação do gesto/UI no dispositivo.

## TEST-037 — Contrato do repositório de annotations
Purpose:
CONTRACT

Priority:
P1

Level:
UNIT

Surface:
MOBILE

Capabilities:
- CAP-013

Journeys:
- FLOW-014

APIs:
- NONE

Preconditions:
- Harness Jest e banco SQLite de teste disponíveis.

Test data:
- Annotation com CFI/texto válidos.
- IDs inexistentes e atualização sem correspondência.

Steps:
1. Executar criação, leitura, atualização e remoção no repositório.
2. Repetir com identificadores inexistentes.
3. Verificar parâmetros SQL e efeitos persistidos.

Expected:
- O repositório mantém os contratos de parâmetros e persistência já cobertos.
- Casos sem correspondência não criam dados espúrios; o resultado deve seguir o contrato existente.

Expected Basis:
- EXISTING_TEST
- CAPABILITY

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/db/repository.test.ts

Automation status:
- EXISTING

Evidence:
- docs/codebase/TESTING.md.
- leitor-epub/src/db/repository.ts e repository.test.ts.

Notes:
- Não classificar esta unidade como E2E.

## TEST-038 — Bookmark mobile alterna e é reencontrado
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-009
- CAP-011

Journeys:
- FLOW-015

APIs:
- NONE

Preconditions:
- Livro mobile aberto em posição marcada.
- Armazenamento local disponível.

Test data:
- Posição/CFI válida.
- Livro com bookmark existente e livro sem bookmark.

Steps:
1. Alternar bookmark na posição atual.
2. Sair e retornar ao livro.
3. Navegar pela lista/indicador de bookmarks.
4. Alternar novamente para remover.

Expected:
- O resultado observado da alternância e da reabertura corresponde ao contrato de bookmarks definido pela capability.
- O estado permanece associado ao livro correto e não é duplicado indevidamente.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste automatizado aplicável encontrado para FLOW-015.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-015.
- docs/system/CAPABILITIES.md — CAP-009 e CAP-011.
- superfície de bookmarks do leitor mobile.

Notes:
- A baseline não fornece evidência automatizada para esta journey.
## TEST-039 — Ciclo web de cards: listar, editar, arquivar e reordenar
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_WEB

Surface:
WEB

Capabilities:
- CAP-018

Journeys:
- FLOW-016

APIs:
- API-010
- API-012
- API-013
- API-015

Preconditions:
- Usuário autenticado com cards próprios em estados variados.
- Biblioteca web de cards disponível.

Test data:
- Card ativo, arquivado e múltiplos cards ordenáveis.
- Livro/card pertencente a outro usuário e referência ausente.

Steps:
1. Listar cards.
2. Editar um card próprio.
3. Arquivar e desarquivar.
4. Mover um card para o fim e recarregar a lista.
5. Observar ownership e persistência.

Expected:
- Operações permitidas alteram apenas o card próprio e persistem conforme os contratos das rotas.
- Arquivamento e ordenação observados permanecem coerentes após recarregar.
- Casos de recurso ausente ou de outro usuário seguem o contrato sem expor dados.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado; não há teste E2E web de cards na baseline.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-016.
- docs/system/API-CATALOG.md — API-010, API-012, API-013 e API-015.
- superfície de cards web.

Notes:
- A regra suspeita de queueOrder é coberta separadamente pelos TEST-041/TEST-042.

## TEST-040 — Contrato das APIs de cards: ownership, validação e ausência
Purpose:
CONTRACT

Priority:
P0

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-018

Journeys:
- FLOW-016

APIs:
- API-010
- API-012
- API-013
- API-015

Preconditions:
- Dois usuários, cards próprios e alheios, livro existente e inexistente.
- Banco de teste com estados ativo/arquivado.

Test data:
- Payload de card válido e inválido.
- IDs ausentes.
- Transições repetidas de archive/unarchive.
- Card de outro owner.

Steps:
1. Listar cards com cada usuário.
2. Criar/editar card com payloads válidos e inválidos.
3. Arquivar, desarquivar e mover cards próprios.
4. Repetir operações em cards ausentes ou alheios.
5. Verificar dados retornados e persistência.

Expected:
- A listagem e mutações respeitam ownership.
- Payloads inválidos, IDs ausentes e operações não autorizadas seguem o contrato efetivamente documentado.
- Nenhuma resposta deve ser inventada onde a baseline não define status/mensagem.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT
- CAPABILITY

Existing Coverage:
- NONE

Existing tests:
- Nenhum CardServiceTest ou contrato HTTP específico encontrado.

Automation status:
- AUTOMATABLE_NOW

Evidence:
- docs/system/API-CATALOG.md — API-010, API-012, API-013 e API-015.
- docs/codebase/CONCERNS.md — BUG_CANDIDATE de queueOrder.
- backend/src/main/java/br/com/leitormobile/card.

Notes:
- Não transformar a suspeita de duplicidade de queueOrder em expected acceptance.

## TEST-041 — DEFECT_PROBE: criação sequencial de cards e queueOrder
Purpose:
DEFECT_PROBE

Priority:
P1

Level:
INTEGRATION

Surface:
BACKEND

Capabilities:
- CAP-017
- CAP-018

Journeys:
- FLOW-010
- FLOW-016

APIs:
- API-011

Preconditions:
- Backend e banco de teste limpos para um owner.
- Criação de card repetível com dados válidos.

Test data:
- Dois ou mais cards criados sequencialmente para o mesmo owner.
- Dados que permitam distinguir cada card.

Steps:
1. Criar múltiplos cards em sequência.
2. Ler queueOrder e a ordem retornada após cada criação.
3. Verificar se os valores são estritamente crescentes ou se há duplicidade.
4. Repetir, se necessário, com concorrência controlada para caracterizar a suspeita.

Expected:
- Não há expected normativo neste probe.
- Registrar evidência para confirmar ou refutar o BUG_CANDIDATE: ordem estritamente crescente versus queueOrder duplicado.
- Não assumir que a correção correta seja MAX + 1.

Expected Basis:
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste específico de CardService/queueOrder encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/codebase/CONCERNS.md — BUG_CANDIDATE queueOrder.
- backend/src/main/java/br/com/leitormobile/card/CardService.java.
- backend/src/main/java/br/com/leitormobile/card/CardRepository.java.
- docs/system/CAPABILITIES.md — CAP-017 e CAP-018.

Notes:
- Este teste serve para confirmar/refutar a suspeita e não deve bloquear o comportamento em acceptance antes da análise.

## TEST-042 — DEFECT_PROBE: move-to-end e queueOrder
Purpose:
DEFECT_PROBE

Priority:
P1

Level:
INTEGRATION

Surface:
BACKEND

Capabilities:
- CAP-018

Journeys:
- FLOW-016

APIs:
- API-015

Preconditions:
- Owner com pelo menos três cards e queueOrder observável.
- API de move-to-end disponível.

Test data:
- Card no início, no meio e no fim.
- Estado inicial persistido antes da movimentação.

Steps:
1. Registrar a ordem inicial de todos os cards.
2. Executar move-to-end para um card não final.
3. Recarregar a lista e ler queueOrder.
4. Repetir com outro card e observar duplicidades.

Expected:
- Não há expected normativo neste probe.
- Registrar se o card movido fica estritamente após todos os demais ou se ocorre duplicidade/anomalia.
- Não assumir que a correção correta seja MAX + 1.

Expected Basis:
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste específico de move-to-end/queueOrder encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/codebase/CONCERNS.md — BUG_CANDIDATE queueOrder.
- backend/src/main/java/br/com/leitormobile/card/CardService.java.
- backend/src/main/java/br/com/leitormobile/card/CardRepository.java.
- docs/system/API-CATALOG.md — API-015.

Notes:
- Resultado suspeito deve alimentar decisão/fix posterior, não virar requisito implícito.
## TEST-043 — Cards mobile: revisar, editar, arquivar e reordenar
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-018

Journeys:
- FLOW-017

APIs:
- NONE

Preconditions:
- Cards locais em estados ativo e arquivado.
- Armazenamento mobile inicializado.

Test data:
- Vários cards ordenáveis.
- Card editável, arquivado e referência ausente.

Steps:
1. Abrir a área de cards mobile.
2. Editar conteúdo.
3. Arquivar e desarquivar.
4. Reordenar/revisar os cards.
5. Sair e reabrir a área.

Expected:
- As operações locais permitidas persistem e permanecem associadas ao usuário/livro corretos.
- O resultado de ordenação observado após recarregar é registrado conforme a política do produto; não importar regra web sem evidência.

Expected Basis:
- CAPABILITY
- JOURNEY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado para a jornada completa de cards mobile.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-017.
- docs/system/CAPABILITIES.md — CAP-018.
- superfície local de cards mobile.

Notes:
- Testes backend de cards não contam como E2E_MOBILE.

## TEST-044 — Sync: caracterizar entidades suportadas e estados parcial/offline
Purpose:
CHARACTERIZATION

Priority:
P0

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-004
- CAP-010
- CAP-017
- CAP-018
- CAP-019
- CAP-022

Journeys:
- FLOW-018

APIs:
- API-003
- API-004
- API-005
- API-008
- API-010
- API-011
- API-012
- API-013
- API-014
- API-015
- API-016
- API-017
- API-018

Preconditions:
- Usuário com dados locais e remotos controlados.
- Conectividade pode ser interrompida em pontos distintos da sincronização.

Test data:
- Livro/card local e remoto.
- Alterações concorrentes.
- Estado de sync com falha após parte das operações.
- Rede offline e posteriormente restaurada.

Steps:
1. Executar sync online com entidades suportadas.
2. Interromper a rede após uma parte das operações.
3. Alterar os mesmos dados local e remotamente.
4. Retomar a conectividade e registrar reconciliação, retry e duplicidades.
5. Comparar o comportamento observado com o escopo documentado.

Expected:
- Registrar quais entidades são sincronizadas hoje, quais etapas sobrevivem a falha e como o retry ocorre.
- Não afirmar fonte autoritativa, política de conflito ou escopo de annotations/bookmarks/preferences como requisito sem decisão humana.
- Não converter sync parcial/offline observado em acceptance.

Expected Basis:
- CHARACTERIZATION_ONLY
- HUMAN_DECISION_REQUIRED

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste cross-surface aplicável encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-018.
- docs/system/CAPABILITIES.md — CAP-004, CAP-010, CAP-017, CAP-018, CAP-019 e CAP-022.
- docs/codebase/CONCERNS.md — sync omite annotations/bookmarks/preferences.

Notes:
- Este cenário mantém a fronteira entre “o código faz hoje” e “o produto deveria fazer”.

## TEST-045 — Reprocessamento lexical explícito web/mobile e polling
Purpose:
ACCEPTANCE

Priority:
P1

Level:
INTEGRATION

Surface:
CROSS-SURFACE

Capabilities:
- CAP-016
- CAP-019

Journeys:
- FLOW-019

APIs:
- API-016
- API-017

Preconditions:
- Livro com conteúdo e job lexical anterior.
- Usuário autenticado; runner lexical e polling disponíveis.

Test data:
- Job concluído para reprocessamento sem force.
- Job concluído para reprocessamento explícito com force.
- Job em execução e job com falha.

Steps:
1. Abrir os detalhes de processamento.
2. Acionar manualmente reprocessamento explícito.
3. Verificar o parâmetro de force e a criação/seleção do job.
4. Acompanhar polling até estado terminal.
5. Reabrir os detalhes e observar o resultado.

Expected:
- O reprocessamento ocorre somente quando a ação manual explícita é acionada.
- O status observado é acompanhado pelo polling e não é confundido com o início automático do FLOW-005.
- Reuso, novo job e falha seguem os contratos existentes; não inventar recuperação.

Expected Basis:
- CAPABILITY
- JOURNEY
- API_CONTRACT
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- frontend/lexicon-start.test.mjs — DIRECT, contrato estático do início explícito.
- frontend/src/bookDetails.test.ts — DIRECT, comportamento do detalhe.
- backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java — DIRECT.
- leitor-epub/src/components/bookProcessingDetails.test.ts — DIRECT, superfície mobile.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-019.
- docs/system/API-CATALOG.md — API-016 e API-017.
- frontend/src/App.tsx e bookDetails.
- leitor-epub/src/components/bookProcessingDetails.ts.

Notes:
- Os testes existentes são estáticos/unitários; nenhum é E2E real.

## TEST-046 — Persistência, falha e recuperação de jobs lexicais
Purpose:
CONTRACT

Priority:
P1

Level:
INTEGRATION

Surface:
BACKEND

Capabilities:
- CAP-016
- CAP-019

Journeys:
- FLOW-019
- FLOW-023

APIs:
- API-016
- API-017

Preconditions:
- Banco de teste com jobs em estados pending/running/completed/failed/interrupted, conforme entidades reais.
- Runner/recovery isolável.

Test data:
- Job concluído reutilizável.
- Reprocessamento force.
- Job interrompido.
- Falha de processamento.

Steps:
1. Criar ou iniciar job lexical.
2. Observar persistência e consulta do último job.
3. Reprocessar com e sem force.
4. Simular interrupção/falha e executar a rotina de recovery.
5. Consultar o estado final.

Expected:
- Persistência e consulta dos jobs permanecem consistentes com o contrato atual.
- A recuperação marca/expõe o estado observado para job interrompido conforme a implementação coberta.
- Não assumir que qualquer estado de falha seja automaticamente recuperável.

Expected Basis:
- API_CONTRACT
- EXISTING_TEST
- CAPABILITY

Existing Coverage:
- DIRECT

Existing tests:
- backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java
- backend/src/test/java/br/com/leitormobile/lexicon/LexiconJobRecoveryTest.java

Automation status:
- EXISTING

Evidence:
- docs/codebase/TESTING.md.
- docs/system/API-CATALOG.md — API-016 e API-017.
- backend/src/main/java/br/com/leitormobile/lexicon.

Notes:
- A execução de job real com provedores externos continua fora desta matriz de testes existentes.

## TEST-047 — Contrato de lista e lookup lexical persistido
Purpose:
CONTRACT

Priority:
P1

Level:
API

Surface:
BACKEND

Capabilities:
- CAP-016
- CAP-019

Journeys:
- FLOW-019

APIs:
- API-018
- API-019

Preconditions:
- Livro próprio com entradas lexicais persistidas e livro sem resultados.
- Usuário proprietário e não proprietário disponíveis.

Test data:
- Entrada com lemma/senses/frequency.
- Lookup com resultado e sem resultado.
- Livro inexistente e livro de outro owner.

Steps:
1. Consultar a lista lexical.
2. Executar lookup por termo.
3. Repetir com ausência de resultado, livro ausente e owner incorreto.
4. Comparar payloads com a persistência lexical.

Expected:
- Lista e lookup devolvem os campos persistidos conforme o catálogo.
- Ownership e ausência de resultado seguem contratos observados, sem inventar status ou payload.
- Dados usados pela UI são consistentes com o armazenamento lexical.

Expected Basis:
- API_CONTRACT
- CAPABILITY
- SECURITY_REQUIREMENT

Existing Coverage:
- RELATED

Existing tests:
- backend/src/test/java/br/com/leitormobile/lexicon/DatabaseBackedLexicalDictionaryTest.java — RELATED.
- backend/src/test/java/br/com/leitormobile/lexicon/DatabaseBackedLexicalDictionaryBatchTest.java — RELATED.
- backend/src/test/java/br/com/leitormobile/lexicon/LexemeRepositoryQueryTest.java — RELATED.
- backend/src/test/java/br/com/leitormobile/lexicon/DictionaryEntryCacheTest.java — RELATED.

Automation status:
- AUTOMATABLE_NOW

Evidence:
- docs/system/API-CATALOG.md — API-018 e API-019.
- backend/src/main/java/br/com/leitormobile/lexicon.
- docs/system/USER-JOURNEYS.md — FLOW-019.

Notes:
- Cobertura de dicionário interno é relacionada ao endpoint/journey, não prova a UI completa.
## TEST-048 — Exportação de backup mobile e compartilhamento
Purpose:
ACCEPTANCE

Priority:
P1

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-023

Journeys:
- FLOW-020

APIs:
- NONE

Preconditions:
- Biblioteca mobile com dados locais exportáveis.
- Sistema operacional oferece destino de compartilhamento.

Test data:
- Snapshot com livros, cards e metadados.
- Biblioteca vazia.

Steps:
1. Solicitar exportação de backup.
2. Observar arquivo gerado, tamanho e destino.
3. Acionar compartilhamento.
4. Repetir com biblioteca vazia.

Expected:
- A exportação gera o artefato previsto pela capability e o fluxo de compartilhamento o entrega ao sistema operacional.
- O conteúdo exportado é observável e não inclui dados de outro usuário.
- O caso de biblioteca vazia segue o comportamento documentado, sem inventar mensagem.

Expected Basis:
- CAPABILITY
- JOURNEY
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste aplicável encontrado para a UI/OS de exportação.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-020.
- docs/system/CAPABILITIES.md — CAP-023.
- leitor-epub/src/services/backup.ts.

Notes:
- Exige validação em dispositivo porque o compartilhamento é responsabilidade do OS.

## TEST-049 — Integridade e metadados do pacote de backup
Purpose:
CONTRACT

Priority:
P1

Level:
INTEGRATION

Surface:
MOBILE

Capabilities:
- CAP-023

Journeys:
- FLOW-020

APIs:
- NONE

Preconditions:
- Serviço de exportação isolável.
- Diretório de dados de teste controlado.

Test data:
- Snapshot válido com e sem capa.
- Arquivo resultante alterado após exportação.
- Metadados/manifesto observáveis.

Steps:
1. Exportar um snapshot conhecido.
2. Inspecionar JSON/manifesto, arquivos e checksum quando disponíveis.
3. Alterar uma cópia do artefato.
4. Comparar conteúdo e referências.

Expected:
- O pacote contém os dados e metadados que a implementação documenta.
- Alteração do artefato é detectável quando houver mecanismo de integridade documentado.
- Não inventar campos ou algoritmo de checksum ausentes da baseline.

Expected Basis:
- CAPABILITY
- API_CONTRACT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste de exportação encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/CAPABILITIES.md — CAP-023.
- serviços de backup mobile.
- docs/codebase/TESTING.md.

Notes:
- Fixtures de backup devem ser pequenas e sintéticas.

## TEST-050 — Validação de backup inválido no restore
Purpose:
CONTRACT

Priority:
P0

Level:
UNIT

Surface:
MOBILE

Capabilities:
- CAP-023

Journeys:
- FLOW-021

APIs:
- NONE

Preconditions:
- Harness Jest mobile configurado.

Test data:
- Arquivo não-JSON.
- JSON truncado/corrompido.
- Estrutura sem campos obrigatórios.
- Snapshot válido mínimo para controle.

Steps:
1. Submeter cada artefato ao validador de backup.
2. Comparar resultado com o snapshot válido.
3. Verificar que o restore não começa antes de a validação terminar.

Expected:
- Artefatos inválidos são rejeitados pelo validador atual.
- O snapshot válido passa na validação.
- A validação não deve ser confundida com restauração efetiva.

Expected Basis:
- EXISTING_TEST
- CAPABILITY

Existing Coverage:
- DIRECT

Existing tests:
- leitor-epub/src/services/backupValidation.test.ts

Automation status:
- EXISTING

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-021.
- docs/system/CAPABILITIES.md — CAP-023.
- leitor-epub/src/services/backupValidation.ts e backupValidation.test.ts.

Notes:
- O teste existente é unitário, não E2E_MOBILE.

## TEST-051 — Restore mobile substitui snapshot e arquivos locais
Purpose:
ACCEPTANCE

Priority:
P0

Level:
E2E_MOBILE

Surface:
MOBILE

Capabilities:
- CAP-023

Journeys:
- FLOW-021

APIs:
- NONE

Preconditions:
- Biblioteca local existente e backup válido disponível.
- Fluxo de restore acessível no dispositivo.

Test data:
- Backup válido mínimo com livro/capa/card.
- Estado local diferente do backup.
- Backup incompatível ou corrompido para caminho negativo.

Steps:
1. Selecionar backup válido.
2. Confirmar a restauração.
3. Reabrir biblioteca, livro, capa e cards.
4. Repetir com backup inválido e observar que o estado anterior permanece.

Expected:
- Após confirmação, o estado local observado corresponde ao conteúdo restaurado conforme a capability.
- O caminho inválido não substitui o snapshot atual.
- A integridade de referências e arquivos é preservada conforme o contrato documentado.

Expected Basis:
- CAPABILITY
- JOURNEY
- EXISTING_TEST

Existing Coverage:
- RELATED

Existing tests:
- leitor-epub/src/services/backupValidation.test.ts — RELATED, valida somente a etapa de validação.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-021.
- docs/system/CAPABILITIES.md — CAP-023.
- serviços de backup/restore mobile.

Notes:
- Requer dispositivo ou infraestrutura capaz de controlar filesystem local real.

## TEST-052 — Links externos mobile usam allowlist e abrem no OS
Purpose:
ACCEPTANCE

Priority:
P2

Level:
DEVICE

Surface:
MOBILE

Capabilities:
- CAP-024

Journeys:
- FLOW-022

APIs:
- NONE

Preconditions:
- Livro mobile com links externos controlados.
- Dispositivo com handler de URL.

Test data:
- Link HTTPS permitido.
- Link para domínio não permitido.
- Link relativo e texto sem URL.

Steps:
1. Acionar cada link no leitor.
2. Observar validação e chamada ao handler do sistema.
3. Retornar ao app e verificar que a leitura permanece íntegra.

Expected:
- Somente esquemas/domínios permitidos pela implementação são encaminhados ao OS.
- Links não permitidos não são abertos.
- Nenhuma navegação externa deve corromper o estado local do livro.

Expected Basis:
- CAPABILITY
- JOURNEY
- SECURITY_REQUIREMENT

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste automatizado aplicável encontrado para a jornada de abertura no OS.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-022.
- docs/system/CAPABILITIES.md — CAP-024.
- handler de links externos do leitor mobile.

Notes:
- epubSecurity.test.ts valida importação/segurança de EPUB, não conta como cobertura desta journey.

## TEST-053 — Links mobile com esquemas não suportados são bloqueados
Purpose:
CONTRACT

Priority:
P1

Level:
DEVICE

Surface:
MOBILE

Capabilities:
- CAP-024

Journeys:
- FLOW-022

APIs:
- NONE

Preconditions:
- Handler de links isolável ou dispositivo configurado.

Test data:
- javascript:, data:, file:, esquema customizado e HTTPS permitido.

Steps:
1. Submeter cada esquema ao handler.
2. Observar se o OS é chamado.
3. Registrar decisão para cada entrada.

Expected:
- Esquemas não suportados não são encaminhados ao OS.
- O esquema permitido segue o caminho atual documentado.
- Não atribuir ao teste epubSecurity uma cobertura que ele não possui.

Expected Basis:
- SECURITY_REQUIREMENT
- CAPABILITY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste específico de handleExternalLink encontrado.

Automation status:
- REQUIRES_DEVICE

Evidence:
- docs/system/CAPABILITIES.md — CAP-024.
- implementação mobile de handleExternalLink.
- docs/system/USER-JOURNEYS.md — FLOW-022.

Notes:
- O conjunto exato de domínios permitidos deve ser obtido da implementação atual e da decisão de segurança.
## TEST-054 — Startup semeia conta e recupera jobs interrompidos
Purpose:
ACCEPTANCE

Priority:
P1

Level:
OPERATIONAL

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-002
- CAP-019

Journeys:
- FLOW-023

APIs:
- NONE

Preconditions:
- Ambiente operacional de teste com banco e storage controlados.
- Jobs interrompidos e estado de conta conhecidos.

Test data:
- Banco vazio.
- Conta padrão configurada.
- Job lexical interrompido.
- Livro órfão, se a implementação permitir esse estado.

Steps:
1. Iniciar o backend.
2. Observar seed/recovery e logs.
3. Consultar o estado da conta e do job após startup.
4. Verificar efeitos no banco/storage.

Expected:
- As rotinas observadas de seed e recovery executam conforme o comportamento documentado.
- Jobs interrompidos assumem o estado de recuperação coberto pela baseline.
- O resultado da política para conta padrão/livro órfão é registrado sem presumir adequação de produção.

Expected Basis:
- CAPABILITY
- JOURNEY
- EXISTING_TEST
- HUMAN_DECISION_REQUIRED

Existing Coverage:
- DIRECT

Existing tests:
- backend/src/test/java/br/com/leitormobile/lexicon/LexiconJobRecoveryTest.java — DIRECT para recovery; não cobre startup/seed completo.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-023.
- docs/system/CAPABILITIES.md — CAP-002 e CAP-019.
- backend/src/main/java/br/com/leitormobile/config.
- backend/src/main/java/br/com/leitormobile/lexicon.

Notes:
- Seed de conta não deve ser tratado como política de segurança de produção sem decisão explícita.

## TEST-055 — Política da conta padrão e livros órfãos
Purpose:
INTENT_REQUIRED

Priority:
P1

Level:
OPERATIONAL

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-002

Journeys:
- FLOW-023

APIs:
- NONE

Preconditions:
- Ambiente operacional controlado com e sem conta padrão.
- Possibilidade de observar livros sem owner.

Test data:
- Banco vazio.
- Conta padrão existente.
- Livro órfão.
- Configuração de produção e de desenvolvimento, quando disponíveis.

Steps:
1. Iniciar o sistema em cada configuração.
2. Observar criação/uso da conta padrão.
3. Observar tratamento de livro órfão.
4. Registrar o comportamento atual e as perguntas de política.

Expected:
- Documentar o que o código faz hoje.
- Não definir se a conta padrão deve existir em produção nem como livros órfãos devem ser tratados sem decisão humana.
- O cenário permanece bloqueado para acceptance enquanto a intenção não estiver definida.

Expected Basis:
- HUMAN_DECISION_REQUIRED
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste de seeder/política de conta padrão encontrado.

Automation status:
- BLOCKED_BY_INTENT

Evidence:
- docs/codebase/CONCERNS.md.
- docs/system/USER-JOURNEYS.md — FLOW-023.
- configuração e seed do backend.

Notes:
- Este TEST não normaliza credenciais padrão nem ownership implícito.

## TEST-056 — Importação operacional do snapshot Kaikki
Purpose:
ACCEPTANCE

Priority:
P2

Level:
OPERATIONAL

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-021

Journeys:
- FLOW-024

APIs:
- NONE

Preconditions:
- Backend, banco e diretório de ingestão configurados.
- Snapshot pequeno e sintético representativo disponível.

Test data:
- Snapshot Kaikki mínimo com entradas válidas.
- Entradas repetidas para observar idempotência.
- Lote com mais de uma partição/batch.

Steps:
1. Executar a importação.
2. Observar progresso, persistência e logs.
3. Reexecutar o mesmo snapshot.
4. Consultar entradas produzidas e efeitos de duplicidade.

Expected:
- Entradas válidas são importadas conforme a capacidade operacional.
- O resultado da reexecução e a idempotência observada são registrados conforme a implementação, sem inventar garantia.
- O conjunto sintético não inclui dataset grande ou protegido no repositório.

Expected Basis:
- CAPABILITY
- JOURNEY
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste operacional específico de importação Kaikki encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-024.
- docs/system/CAPABILITIES.md — CAP-021.
- importador Kaikki do backend.

Notes:
- Fixture mínima será criada somente em etapa futura de implementação de testes.

## TEST-057 — Snapshot Kaikki inválido e reinício da importação
Purpose:
CONTRACT

Priority:
P2

Level:
OPERATIONAL

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-021

Journeys:
- FLOW-024

APIs:
- NONE

Preconditions:
- Importador Kaikki executável em ambiente isolado.
- Logs e estado persistido observáveis.

Test data:
- JSON truncado.
- Linha/registro com schema inesperado.
- Arquivo ausente.
- Interrupção durante lote.

Steps:
1. Submeter cada condição ao importador.
2. Observar erro, lote parcial e estado persistido.
3. Reiniciar a operação.
4. Registrar se retoma, repete ou exige intervenção.

Expected:
- O importador rejeita ou sinaliza entradas inválidas conforme o comportamento documentado.
- O tratamento de lote parcial/reinício é observado, não inventado como garantia de atomicidade ou retomada.
- Nenhum dataset grande é adicionado nesta fase.

Expected Basis:
- API_CONTRACT
- CHARACTERIZATION_ONLY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste operacional específico encontrado.

Automation status:
- REQUIRES_INFRASTRUCTURE

Evidence:
- docs/codebase/CONCERNS.md.
- docs/system/CAPABILITIES.md — CAP-021.
- importador Kaikki e logs operacionais.

Notes:
- Se o contrato de reinício for decidido, este cenário poderá ganhar expected de acceptance.

## TEST-058 — Contrato do provedor Ollama e timeout
Purpose:
CONTRACT

Priority:
P1

Level:
INTEGRATION

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-020

Journeys:
- FLOW-025

APIs:
- NONE

Preconditions:
- Ollama controlado por mock/fake ou endpoint local.
- Política de exposição de conteúdo configurada.

Test data:
- Resposta válida.
- Timeout/indisponibilidade.
- Conteúdo metadata-only e conteúdo que não deve ser exposto.

Steps:
1. Enviar solicitação ao provider.
2. Observar payload, parsing e resposta.
3. Repetir com timeout e conteúdo restrito.
4. Comparar comportamento com as políticas cobertas.

Expected:
- O provider respeita o contrato de request/response e tratamento de timeout observado.
- A política de metadata-only/exposição é mantida conforme os testes existentes.
- Indisponibilidade não deve ser convertida em expected de sucesso.

Expected Basis:
- EXISTING_TEST
- API_CONTRACT
- SECURITY_REQUIREMENT

Existing Coverage:
- DIRECT

Existing tests:
- backend/src/test/java/br/com/leitormobile/ai/OllamaAiProviderTest.java
- backend/src/test/java/br/com/leitormobile/ai/ExternalAiContextPolicyTest.java
- backend/src/test/java/br/com/leitormobile/ai/ExternalAiExposurePolicyTest.java

Automation status:
- EXISTING

Evidence:
- docs/codebase/TESTING.md.
- docs/system/CAPABILITIES.md — CAP-020.
- backend/src/main/java/br/com/leitormobile/ai.

Notes:
- Ollama não corresponde a uma API-001–API-021 do catálogo público.

## TEST-059 — Caracterização de no-candidate e exposição de IA
Purpose:
CHARACTERIZATION

Priority:
P2

Level:
OPERATIONAL

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-019
- CAP-020

Journeys:
- FLOW-025

APIs:
- NONE

Preconditions:
- Provider e políticas de exposição isoláveis.
- Entrada lexical que produz candidato e entrada sem candidato.

Test data:
- Sem candidato.
- Candidato válido.
- Entrada que exigiria contexto proibido.

Steps:
1. Executar o caminho com cada entrada.
2. Observar se há chamada ao provider, bucket de exposição e resultado.
3. Registrar o comportamento implementado sem tratá-lo como regra ideal.

Expected:
- O comportamento atual de no-candidate e exposição é documentado.
- Não transformar qualquer bloqueio ou ausência atual em acceptance futura sem decisão.

Expected Basis:
- CHARACTERIZATION_ONLY
- EXISTING_TEST

Existing Coverage:
- DIRECT

Existing tests:
- backend/src/test/java/br/com/leitormobile/ai/ExternalAiExposurePolicyTest.java — DIRECT.
- backend/src/test/java/br/com/leitormobile/ai/ExternalAiContextPolicyTest.java — RELATED.

Automation status:
- EXISTING

Evidence:
- docs/codebase/CONCERNS.md.
- testes de política de IA listados acima.
- docs/system/USER-JOURNEYS.md — FLOW-025.

Notes:
- Resultado de caracterização deve permanecer separado de requisito de produto.

## TEST-060 — Contrato de health e info do actuator
Purpose:
CONTRACT

Priority:
P2

Level:
API

Surface:
BACKEND/OPERATOR

Capabilities:
- CAP-025

Journeys:
- FLOW-026

APIs:
- API-020
- API-021

Preconditions:
- Backend em execução em ambiente controlado.
- Configuração de actuator conhecida.

Test data:
- Serviço saudável.
- Dependência indisponível, quando aplicável.
- Requisição autenticada e não autenticada.

Steps:
1. Consultar health.
2. Consultar info.
3. Repetir com configuração/dependência degradada.
4. Observar payload, status e exposição.

Expected:
- Health/info seguem os contratos e a política de exposição efetivamente documentados.
- A degradação é refletida conforme a implementação observada.
- Não inventar campos, status ou disponibilidade pública além da baseline.

Expected Basis:
- API_CONTRACT
- SECURITY_REQUIREMENT
- CAPABILITY

Existing Coverage:
- NONE

Existing tests:
- Nenhum teste específico de API-020/API-021 encontrado.

Automation status:
- AUTOMATABLE_NOW

Evidence:
- docs/system/USER-JOURNEYS.md — FLOW-026.
- docs/system/API-CATALOG.md — API-020 e API-021.
- configuração de actuator do backend.

Notes:
- Este contrato não constitui E2E e não requer Playwright.
## Gap Analysis

### Totais da matriz

- Testes planejados: 60.
- ACCEPTANCE: 27.
- CONTRACT: 22.
- CHARACTERIZATION: 4.
- DEFECT_PROBE: 2.
- INTENT_REQUIRED: 5.

Por prioridade:

- P0: 20.
- P1: 33.
- P2: 7.

Por nível:

- API: 11.
- COMPONENT: 2.
- DEVICE: 5.
- E2E_MOBILE: 12.
- E2E_WEB: 8.
- INTEGRATION: 12.
- OPERATIONAL: 5.
- UNIT: 5.

Por superfície:

- WEB: 9.
- MOBILE: 25.
- BACKEND: 12.
- CROSS-SURFACE: 7.
- BACKEND/OPERATOR: 7.

Por automação:

- EXISTING: 11.
- AUTOMATABLE_NOW: 10.
- REQUIRES_INFRASTRUCTURE: 17.
- REQUIRES_DEVICE: 17.
- BLOCKED_BY_INTENT: 5.
- MANUAL_ONLY: 0.

### Cobertura existente das journeys

Esta classificação é a segunda auditoria da seção Tests em USER-JOURNEYS.md; ela não confunde testes planejados com cobertura já existente:

- Journeys com algum teste DIRECT: 13 — FLOW-005, FLOW-006, FLOW-007, FLOW-009, FLOW-010, FLOW-011, FLOW-012, FLOW-013, FLOW-014, FLOW-019, FLOW-021, FLOW-023 e FLOW-025.
- Journeys somente com teste RELATED: 2 — FLOW-001 e FLOW-004.
- Journeys sem teste automatizado aplicável encontrado: 12 — FLOW-002, FLOW-003, FLOW-008, FLOW-015, FLOW-016, FLOW-017, FLOW-018, FLOW-020, FLOW-022, FLOW-024, FLOW-026 e FLOW-027.
- Jornadas E2E reais encontradas: 0.

Os cenários E2E_WEB, E2E_MOBILE e DEVICE desta matriz são planejamento futuro. Testes estáticos web, testes unitários e testes de serviço permanecem DIRECT/RELATED conforme sua superfície, mas não são E2E.

### Gaps de aceitação e contrato

- Journeys sem ACCEPTANCE test: FLOW-018, FLOW-025 e FLOW-026. FLOW-018 está bloqueado por UNKNOWN_INTENT; FLOW-025 e FLOW-026 têm contratos/caracterizações planejados, mas não recebem acceptance inventado.
- APIs sem teste com Purpose CONTRACT: API-001, API-002, API-011 e API-014.
- OUT-001 possui contrato planejado em TEST-031.
- P0 sem automação existente ou disponível agora: TEST-001, TEST-004, TEST-005, TEST-006, TEST-013, TEST-020, TEST-022, TEST-023, TEST-044 e TEST-051.

### Itens que exigem decisão ou investigação

- DEFECT_PROBE: TEST-041 e TEST-042 para o BUG_CANDIDATE de queueOrder; nenhum define MAX + 1 ou duplicidade como comportamento esperado.
- INTENT_REQUIRED: TEST-006, TEST-007, TEST-008, TEST-016 e TEST-055.
- E2E_WEB planejados: TEST-001, TEST-009, TEST-013, TEST-020, TEST-023, TEST-027, TEST-028 e TEST-039. Playwright é adequado quando a infraestrutura web for criada.
- E2E_MOBILE planejados: TEST-004, TEST-011, TEST-017, TEST-022, TEST-025, TEST-030, TEST-034, TEST-036, TEST-038, TEST-043, TEST-048 e TEST-051.
- DEVICE planejados: TEST-019, TEST-032, TEST-033, TEST-052 e TEST-053.
- Integração CROSS-SURFACE planejada: TEST-005, TEST-006, TEST-007, TEST-008, TEST-016, TEST-044 e TEST-045.
- Para React Native nativo/WebView, Playwright web não é tratado como substituto de DEVICE/E2E_MOBILE.

### Gaps por área

A matriz cobre todos os FLOW-001–FLOW-027 e CAP-001–CAP-025. Todas as API-001–API-021 e OUT-001 aparecem em pelo menos um cenário aplicável. Os itens sem teste existente permanecem explicitamente como NONE; isso é uma lacuna de baseline, não uma afirmação de que a funcionalidade não deve ser testada.

## Validação da matriz

- IDs TEST-001–TEST-060 são únicos e sequenciais.
- Referências de FLOW, CAP, API e OUT usadas nos campos estruturados pertencem à baseline declarada.
- A referência física do contrato lexical é frontend/lexicon-entry-contract.test.mjs, confirmada no workspace.
- FLOW-007 web usa CAP-007/API-009; FLOW-027 mobile usa CAP-007 e APIs NONE.
- FLOW-005 descreve o início automático do job lexical após upload bem-sucedido; o reprocessamento manual está isolado em FLOW-019.
- Nenhum teste mobile foi contado como cobertura web e nenhum teste web como cobertura mobile.
- Nenhum teste estático foi classificado como E2E.
- Nenhum comportamento UNKNOWN_INTENT ou BUG_CANDIDATE foi transformado em expected normativo.
- Nenhum teste, fixture, código de produção, banco ou migration foi criado ou executado nesta etapa.

## Summary Table

| TEST | Purpose | Priority | Level | Surface | FLOW | CAP | API | Automation |
|---|---|---|---|---|---|---|---|---|
| TEST-001 | ACCEPTANCE | P0 | E2E_WEB | WEB | FLOW-001 | CAP-001,CAP-003 | API-001,API-002,API-003 | REQUIRES_INFRASTRUCTURE |
| TEST-002 | ACCEPTANCE | P0 | API | BACKEND | FLOW-001 | CAP-001 | API-001 | AUTOMATABLE_NOW |
| TEST-003 | CONTRACT | P0 | API | BACKEND | FLOW-001 | CAP-001,CAP-003 | API-003 | EXISTING |
| TEST-004 | ACCEPTANCE | P0 | E2E_MOBILE | MOBILE | FLOW-002 | CAP-001 | API-001 | REQUIRES_DEVICE |
| TEST-005 | CHARACTERIZATION | P0 | INTEGRATION | CROSS-SURFACE | FLOW-002,FLOW-018 | CAP-001,CAP-022 | API-001,API-003,API-004,API-005,API-008,API-010,API-011,API-012,API-013,API-014,API-015,API-016,API-017,API-018 | REQUIRES_INFRASTRUCTURE |
| TEST-006 | INTENT_REQUIRED | P0 | INTEGRATION | CROSS-SURFACE | FLOW-002,FLOW-018 | CAP-004,CAP-010,CAP-017,CAP-018,CAP-022 | API-003,API-008,API-010,API-011,API-012,API-013,API-014,API-015 | BLOCKED_BY_INTENT |
| TEST-007 | INTENT_REQUIRED | P1 | INTEGRATION | CROSS-SURFACE | FLOW-018 | CAP-010,CAP-011,CAP-013,CAP-015,CAP-022 | API-003,API-008,API-010,API-011,API-012,API-013,API-014,API-015 | BLOCKED_BY_INTENT |
| TEST-008 | INTENT_REQUIRED | P1 | INTEGRATION | CROSS-SURFACE | FLOW-018 | CAP-004,CAP-022 | API-003,API-004,API-005 | BLOCKED_BY_INTENT |
| TEST-009 | ACCEPTANCE | P1 | E2E_WEB | WEB | FLOW-003 | CAP-003 | API-003,API-007 | REQUIRES_INFRASTRUCTURE |
| TEST-010 | CONTRACT | P0 | API | BACKEND | FLOW-003 | CAP-003 | API-003,API-007 | AUTOMATABLE_NOW |
| TEST-011 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-004 | CAP-004 | NONE | REQUIRES_DEVICE |
| TEST-012 | CONTRACT | P1 | UNIT | MOBILE | FLOW-004,FLOW-006 | CAP-004 | NONE | EXISTING |
| TEST-013 | ACCEPTANCE | P0 | E2E_WEB | WEB | FLOW-005 | CAP-003,CAP-005,CAP-016,CAP-019 | API-004,API-005,API-016,API-017,API-019 | REQUIRES_INFRASTRUCTURE |
| TEST-014 | CONTRACT | P0 | API | BACKEND | FLOW-005 | CAP-005 | API-004 | AUTOMATABLE_NOW |
| TEST-015 | CONTRACT | P0 | API | BACKEND | FLOW-005 | CAP-005 | API-005 | AUTOMATABLE_NOW |
| TEST-016 | INTENT_REQUIRED | P1 | INTEGRATION | CROSS-SURFACE | FLOW-005,FLOW-006 | CAP-005,CAP-006 | API-005 | BLOCKED_BY_INTENT |
| TEST-017 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-006 | CAP-004,CAP-006 | NONE | REQUIRES_DEVICE |
| TEST-018 | ACCEPTANCE | P0 | UNIT | MOBILE | FLOW-006 | CAP-006 | NONE | EXISTING |
| TEST-019 | CONTRACT | P1 | DEVICE | MOBILE | FLOW-006 | CAP-006 | NONE | REQUIRES_DEVICE |
| TEST-020 | ACCEPTANCE | P0 | E2E_WEB | WEB | FLOW-007 | CAP-007 | API-009 | REQUIRES_INFRASTRUCTURE |
| TEST-021 | CONTRACT | P0 | API | BACKEND | FLOW-007 | CAP-007 | API-009 | EXISTING |
| TEST-022 | ACCEPTANCE | P0 | E2E_MOBILE | MOBILE | FLOW-027 | CAP-007 | NONE | REQUIRES_DEVICE |
| TEST-023 | ACCEPTANCE | P0 | E2E_WEB | WEB | FLOW-008 | CAP-008,CAP-010 | API-006,API-008 | REQUIRES_INFRASTRUCTURE |
| TEST-024 | CONTRACT | P0 | API | BACKEND | FLOW-008 | CAP-008,CAP-010 | API-006,API-008 | AUTOMATABLE_NOW |
| TEST-025 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-009 | CAP-009,CAP-010,CAP-011,CAP-012 | NONE | REQUIRES_DEVICE |
| TEST-026 | CONTRACT | P1 | UNIT | MOBILE | FLOW-009 | CAP-009,CAP-010 | NONE | EXISTING |
| TEST-027 | ACCEPTANCE | P1 | E2E_WEB | WEB | FLOW-010 | CAP-014,CAP-016 | API-019 | REQUIRES_INFRASTRUCTURE |
| TEST-028 | ACCEPTANCE | P1 | E2E_WEB | WEB | FLOW-010 | CAP-014,CAP-017 | API-011,API-019 | REQUIRES_INFRASTRUCTURE |
| TEST-029 | CONTRACT | P1 | COMPONENT | WEB | FLOW-010 | CAP-016 | API-019 | EXISTING |
| TEST-030 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-011 | CAP-014,CAP-016 | OUT-001 | REQUIRES_DEVICE |
| TEST-031 | CONTRACT | P1 | API | MOBILE | FLOW-011 | CAP-016 | OUT-001 | AUTOMATABLE_NOW |
| TEST-032 | ACCEPTANCE | P2 | DEVICE | MOBILE | FLOW-012 | CAP-014,CAP-015 | NONE | REQUIRES_DEVICE |
| TEST-033 | CHARACTERIZATION | P2 | DEVICE | MOBILE | FLOW-012 | CAP-015 | NONE | REQUIRES_DEVICE |
| TEST-034 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-013 | CAP-014,CAP-017 | NONE | REQUIRES_DEVICE |
| TEST-035 | CONTRACT | P1 | COMPONENT | MOBILE | FLOW-013 | CAP-017 | NONE | AUTOMATABLE_NOW |
| TEST-036 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-014 | CAP-013,CAP-014 | NONE | REQUIRES_DEVICE |
| TEST-037 | CONTRACT | P1 | UNIT | MOBILE | FLOW-014 | CAP-013 | NONE | EXISTING |
| TEST-038 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-015 | CAP-009,CAP-011 | NONE | REQUIRES_DEVICE |
| TEST-039 | ACCEPTANCE | P1 | E2E_WEB | WEB | FLOW-016 | CAP-018 | API-010,API-012,API-013,API-015 | REQUIRES_INFRASTRUCTURE |
| TEST-040 | CONTRACT | P0 | API | BACKEND | FLOW-016 | CAP-018 | API-010,API-012,API-013,API-015 | AUTOMATABLE_NOW |
| TEST-041 | DEFECT_PROBE | P1 | INTEGRATION | BACKEND | FLOW-010,FLOW-016 | CAP-017,CAP-018 | API-011 | REQUIRES_INFRASTRUCTURE |
| TEST-042 | DEFECT_PROBE | P1 | INTEGRATION | BACKEND | FLOW-016 | CAP-018 | API-015 | REQUIRES_INFRASTRUCTURE |
| TEST-043 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-017 | CAP-018 | NONE | REQUIRES_DEVICE |
| TEST-044 | CHARACTERIZATION | P0 | INTEGRATION | CROSS-SURFACE | FLOW-018 | CAP-004,CAP-010,CAP-017,CAP-018,CAP-019,CAP-022 | API-003,API-004,API-005,API-008,API-010,API-011,API-012,API-013,API-014,API-015,API-016,API-017,API-018 | REQUIRES_INFRASTRUCTURE |
| TEST-045 | ACCEPTANCE | P1 | INTEGRATION | CROSS-SURFACE | FLOW-019 | CAP-016,CAP-019 | API-016,API-017 | REQUIRES_INFRASTRUCTURE |
| TEST-046 | CONTRACT | P1 | INTEGRATION | BACKEND | FLOW-019,FLOW-023 | CAP-016,CAP-019 | API-016,API-017 | EXISTING |
| TEST-047 | CONTRACT | P1 | API | BACKEND | FLOW-019 | CAP-016,CAP-019 | API-018,API-019 | AUTOMATABLE_NOW |
| TEST-048 | ACCEPTANCE | P1 | E2E_MOBILE | MOBILE | FLOW-020 | CAP-023 | NONE | REQUIRES_DEVICE |
| TEST-049 | CONTRACT | P1 | INTEGRATION | MOBILE | FLOW-020 | CAP-023 | NONE | REQUIRES_INFRASTRUCTURE |
| TEST-050 | CONTRACT | P0 | UNIT | MOBILE | FLOW-021 | CAP-023 | NONE | EXISTING |
| TEST-051 | ACCEPTANCE | P0 | E2E_MOBILE | MOBILE | FLOW-021 | CAP-023 | NONE | REQUIRES_DEVICE |
| TEST-052 | ACCEPTANCE | P2 | DEVICE | MOBILE | FLOW-022 | CAP-024 | NONE | REQUIRES_DEVICE |
| TEST-053 | CONTRACT | P1 | DEVICE | MOBILE | FLOW-022 | CAP-024 | NONE | REQUIRES_DEVICE |
| TEST-054 | ACCEPTANCE | P1 | OPERATIONAL | BACKEND/OPERATOR | FLOW-023 | CAP-002,CAP-019 | NONE | REQUIRES_INFRASTRUCTURE |
| TEST-055 | INTENT_REQUIRED | P1 | OPERATIONAL | BACKEND/OPERATOR | FLOW-023 | CAP-002 | NONE | BLOCKED_BY_INTENT |
| TEST-056 | ACCEPTANCE | P2 | OPERATIONAL | BACKEND/OPERATOR | FLOW-024 | CAP-021 | NONE | REQUIRES_INFRASTRUCTURE |
| TEST-057 | CONTRACT | P2 | OPERATIONAL | BACKEND/OPERATOR | FLOW-024 | CAP-021 | NONE | REQUIRES_INFRASTRUCTURE |
| TEST-058 | CONTRACT | P1 | INTEGRATION | BACKEND/OPERATOR | FLOW-025 | CAP-020 | NONE | EXISTING |
| TEST-059 | CHARACTERIZATION | P2 | OPERATIONAL | BACKEND/OPERATOR | FLOW-025 | CAP-019,CAP-020 | NONE | EXISTING |
| TEST-060 | CONTRACT | P2 | API | BACKEND/OPERATOR | FLOW-026 | CAP-025 | API-020,API-021 | AUTOMATABLE_NOW |

### Coverage by Journey

| FLOW | Tests | Highest Priority | E2E planned? |
|---|---|---|---|
| FLOW-001 | TEST-001, TEST-002, TEST-003 | P0 | YES — E2E_WEB |
| FLOW-002 | TEST-004, TEST-005, TEST-006 | P0 | YES — E2E_MOBILE + CROSS-SURFACE |
| FLOW-003 | TEST-009, TEST-010 | P0 | YES — E2E_WEB |
| FLOW-004 | TEST-011, TEST-012 | P1 | YES — E2E_MOBILE |
| FLOW-005 | TEST-013, TEST-014, TEST-015, TEST-016 | P0 | YES — E2E_WEB |
| FLOW-006 | TEST-012, TEST-016, TEST-017, TEST-018, TEST-019 | P0 | YES — E2E_MOBILE/DEVICE |
| FLOW-007 | TEST-020, TEST-021 | P0 | YES — E2E_WEB |
| FLOW-008 | TEST-023, TEST-024 | P0 | YES — E2E_WEB |
| FLOW-009 | TEST-025, TEST-026 | P1 | YES — E2E_MOBILE |
| FLOW-010 | TEST-027, TEST-028, TEST-029, TEST-041 | P1 | YES — E2E_WEB |
| FLOW-011 | TEST-030, TEST-031 | P1 | YES — E2E_MOBILE |
| FLOW-012 | TEST-032, TEST-033 | P2 | YES — DEVICE |
| FLOW-013 | TEST-034, TEST-035 | P1 | YES — E2E_MOBILE |
| FLOW-014 | TEST-036, TEST-037 | P1 | YES — E2E_MOBILE |
| FLOW-015 | TEST-038 | P1 | YES — E2E_MOBILE |
| FLOW-016 | TEST-039, TEST-040, TEST-041, TEST-042 | P0 | YES — E2E_WEB |
| FLOW-017 | TEST-043 | P1 | YES — E2E_MOBILE |
| FLOW-018 | TEST-005, TEST-006, TEST-007, TEST-008, TEST-044 | P0 | NO — CROSS-SURFACE intent/integration first |
| FLOW-019 | TEST-045, TEST-046, TEST-047 | P1 | NO — CROSS-SURFACE integration |
| FLOW-020 | TEST-048, TEST-049 | P1 | YES — E2E_MOBILE |
| FLOW-021 | TEST-050, TEST-051 | P0 | YES — E2E_MOBILE |
| FLOW-022 | TEST-052, TEST-053 | P1 | YES — DEVICE |
| FLOW-023 | TEST-046, TEST-054, TEST-055 | P1 | NO — OPERATIONAL |
| FLOW-024 | TEST-056, TEST-057 | P2 | NO — OPERATIONAL |
| FLOW-025 | TEST-058, TEST-059 | P1 | NO — INTEGRATION/OPERATIONAL |
| FLOW-026 | TEST-060 | P2 | NO — API/OPERATIONAL |
| FLOW-027 | TEST-022 | P0 | YES — E2E_MOBILE |
### Coverage by Capability

| CAP | Tests |
|---|---|
| CAP-001 | TEST-001, TEST-002, TEST-003, TEST-004, TEST-005 |
| CAP-002 | TEST-054, TEST-055 |
| CAP-003 | TEST-001, TEST-003, TEST-009, TEST-010, TEST-013 |
| CAP-004 | TEST-006, TEST-008, TEST-011, TEST-012, TEST-017, TEST-044 |
| CAP-005 | TEST-013, TEST-014, TEST-015, TEST-016 |
| CAP-006 | TEST-016, TEST-017, TEST-018, TEST-019 |
| CAP-007 | TEST-020, TEST-021, TEST-022 |
| CAP-008 | TEST-023, TEST-024 |
| CAP-009 | TEST-025, TEST-026, TEST-038 |
| CAP-010 | TEST-006, TEST-007, TEST-023, TEST-024, TEST-025, TEST-026, TEST-044 |
| CAP-011 | TEST-007, TEST-025, TEST-038 |
| CAP-012 | TEST-025 |
| CAP-013 | TEST-007, TEST-036, TEST-037 |
| CAP-014 | TEST-027, TEST-028, TEST-030, TEST-032, TEST-034, TEST-036 |
| CAP-015 | TEST-007, TEST-032, TEST-033 |
| CAP-016 | TEST-013, TEST-027, TEST-029, TEST-030, TEST-031, TEST-045, TEST-046, TEST-047 |
| CAP-017 | TEST-006, TEST-028, TEST-034, TEST-035, TEST-041, TEST-044 |
| CAP-018 | TEST-006, TEST-039, TEST-040, TEST-041, TEST-042, TEST-043, TEST-044 |
| CAP-019 | TEST-013, TEST-044, TEST-045, TEST-046, TEST-047, TEST-054, TEST-059 |
| CAP-020 | TEST-058, TEST-059 |
| CAP-021 | TEST-056, TEST-057 |
| CAP-022 | TEST-005, TEST-006, TEST-007, TEST-008, TEST-044 |
| CAP-023 | TEST-048, TEST-049, TEST-050, TEST-051 |
| CAP-024 | TEST-052, TEST-053 |
| CAP-025 | TEST-060 |

### Coverage by API

| API | Tests |
|---|---|
| API-001 | TEST-001, TEST-002, TEST-004, TEST-005 |
| API-002 | TEST-001 |
| API-003 | TEST-001, TEST-003, TEST-005, TEST-006, TEST-007, TEST-008, TEST-009, TEST-010, TEST-044 |
| API-004 | TEST-005, TEST-008, TEST-013, TEST-014, TEST-044 |
| API-005 | TEST-005, TEST-008, TEST-013, TEST-015, TEST-016, TEST-044 |
| API-006 | TEST-023, TEST-024 |
| API-007 | TEST-009, TEST-010 |
| API-008 | TEST-005, TEST-006, TEST-007, TEST-023, TEST-024, TEST-044 |
| API-009 | TEST-020, TEST-021 |
| API-010 | TEST-005, TEST-006, TEST-007, TEST-039, TEST-040, TEST-044 |
| API-011 | TEST-005, TEST-006, TEST-007, TEST-028, TEST-041, TEST-044 |
| API-012 | TEST-005, TEST-006, TEST-007, TEST-039, TEST-040, TEST-044 |
| API-013 | TEST-005, TEST-006, TEST-007, TEST-039, TEST-040, TEST-044 |
| API-014 | TEST-005, TEST-006, TEST-007, TEST-044 |
| API-015 | TEST-005, TEST-006, TEST-007, TEST-039, TEST-040, TEST-042, TEST-044 |
| API-016 | TEST-005, TEST-013, TEST-044, TEST-045, TEST-046 |
| API-017 | TEST-005, TEST-013, TEST-044, TEST-045, TEST-046 |
| API-018 | TEST-005, TEST-044, TEST-047 |
| API-019 | TEST-013, TEST-027, TEST-028, TEST-029, TEST-047 |
| API-020 | TEST-060 |
| API-021 | TEST-060 |
| OUT-001 | TEST-030, TEST-031 |

## Final Validation Checklist

- Baseline considerada: 25 capabilities, 27 journeys, API-001 a API-021 e OUT-001.
- A referência física do contrato lexical é frontend/lexicon-entry-contract.test.mjs, confirmada no workspace.
- A matriz inclui cobertura planejada para FLOW-001 a FLOW-027, CAP-001 a CAP-025, API-001 a API-021 e OUT-001.
- O início automático do job lexical está em TEST-013/FLOW-005; o reprocessamento explícito está em TEST-045/FLOW-019.
- FLOW-007 e FLOW-027 permanecem operações independentes por superfície.
- UNKNOWN_INTENT permanece em TEST-006/007/008/016/055; BUG_CANDIDATE permanece em TEST-041/042.
- Nenhum E2E real é afirmado como existente.
- Nenhuma execução de Playwright ou implementação de teste foi realizada.
