# Jornadas reais do sistema

## Escopo e método

Este documento reconstrói sequências observáveis a partir da implementação existente. Uma jornada agrupa telas, ações, chamadas HTTP, persistência e processamento assíncrono quando esses elementos formam um fluxo testável; não cria capacidades novas nem trata endpoints isolados como jornadas.

Fontes: `docs/codebase/*`, `docs/system/SYSTEM-OVERVIEW.md`, `docs/system/CAPABILITIES.md`, `docs/system/API-CATALOG.md`, rotas/telas, clients HTTP, services, controllers, persistência e testes. README e documentação histórica não substituem a implementação. Quando a implementação existe mas a intenção não é demonstrável, isso aparece em `Status` ou `Unknowns`.

`Tests` lista testes automatizados relacionados encontrados; a ausência de teste E2E não é tratada como ausência da capacidade.

## FLOW-001 — Login web e abertura da biblioteca

Status: VERIFIED

Actor: usuário web

Surface: WEB

Capabilities:
- CAP-001
- CAP-003

APIs:
- API-001
- API-002
- API-003

Preconditions:
- Aplicação web disponível; usuário informa credenciais.

Start:
Usuário envia o formulário de `LoginView`.

Steps:

1. UI/API: `LoginView` envia `POST /api/auth/login`.
2. Estado local: em sucesso, o client guarda token e usuário no `localStorage`.
3. UI/API: `App` valida com `GET /api/auth/me` e carrega livros com `GET /api/books`.
4. UI: a biblioteca é renderizada após o retorno dos dados.

Expected observable result:
O usuário sai do login e vê a biblioteca carregada.

Alternative paths:
- Sessão existente pode ser validada ao abrir a aplicação.
- Biblioteca vazia produz o estado vazio da UI.

Failure paths:
- Credenciais inválidas, sessão rejeitada ou falha de carregamento mantêm/retornam o estado de login e erro implementado pelo client.

Persisted state:
- Token e usuário no `localStorage`; nenhuma alteração de negócio além da sessão demonstrada.

Evidence:
- `frontend/src/LoginView.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`

Tests:
- `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java` cobre regras relacionadas, mas não o login web completo.

Unknowns:
- Nenhum além da cobertura de execução indicada.

## FLOW-002 — Login mobile e tentativa de sincronização inicial

Status: UNKNOWN_INTENT

Actor: usuário mobile

Surface: CROSS-SURFACE

Capabilities:
- CAP-001
- CAP-022

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
- App instalado; API base, credenciais e SQLite disponíveis.

Start:
Usuário confirma o formulário de `/login`.

Steps:

1. UI/API: `login.tsx` envia login HTTP e recebe a sessão.
2. Persistência: sessão/token são registrados localmente.
3. Processo: a tela tenta `syncLibrary` antes de concluir a entrada na área principal.
4. APIs/estado: o sync pode listar livros, criar livros remotos, enviar conteúdo/progresso, reconciliar cards e solicitar/baixar léxico pelas APIs listadas.
5. UI: o app encaminha para `/`; o código mantém o login válido quando a tentativa inicial de sync falha.

Expected observable result:
O usuário entra na área principal com sessão local; sucesso de sync produz a mensagem/contagem implementada.

Alternative paths:
- Sync inicial pode falhar por rede/backend sem bloquear a sessão local.
- Sync pode não alterar dados quando não detecta diferenças.

Failure paths:
- Login inválido bloqueia o fluxo normal.
- Falha de sync é apresentada sem remover a sessão conforme o client.

Persisted state:
- Sessão no SQLite; dependendo do resultado, livros, conteúdo, progresso, cards, relações remotas e léxico no SQLite/backend.

Evidence:
- `leitor-epub/app/login.tsx`
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/repository.ts`
- `docs/system/API-CATALOG.md`

Tests:
- Não foi encontrado teste automatizado do login seguido de sync inicial.

Unknowns:
- [ASK USER] O código não define fonte autoritativa de dados nem política de conflito local/remoto.
- [ASK USER] O código não demonstra se a ausência de anotações, bookmarks e preferências no sync é requisito ou lacuna.

## FLOW-003 — Consultar a biblioteca web

Status: VERIFIED

Actor: usuário web autenticado

Surface: WEB

Capabilities:
- CAP-003

APIs:
- API-003
- API-007

Preconditions:
- Sessão web válida.

Start:
Usuário abre/atualiza a área principal.

Steps:

1. API: `App` chama `GET /api/books`.
2. UI/estado: livros são renderizados por `BookTile` e o filtro local altera a coleção exibida.
3. API/UI: capas podem ser buscadas com `GET /api/books/{id}/cover`.

Expected observable result:
O usuário vê os livros retornados e capas/metadados disponíveis.

Alternative paths:
- Coleção vazia apresenta estado vazio; capa ausente não elimina necessariamente o item.

Failure paths:
- Erro de autenticação/rede impede ou degrada a carga conforme o estado de erro web.

Persisted state:
- Estado da UI/filtro; nenhuma persistência de negócio local demonstrada.

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`

Tests:
- Não foi encontrado teste da consulta bem-sucedida completa da UI web.

Unknowns:
- Nenhum.

## FLOW-004 — Consultar a biblioteca local mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-004

APIs:
- Nenhuma.

Preconditions:
- SQLite aberto e migrations aplicáveis.

Start:
Usuário abre `/` no mobile.

Steps:

1. UI/estado: a tela chama `listBooks`.
2. Persistência: o repositório consulta livros no SQLite.
3. UI: `BookCard` renderiza a lista e oferece detalhes, reprocessamento e exclusão.

Expected observable result:
Livros presentes no SQLite são exibidos sem consulta HTTP obrigatória para a lista local.

Alternative paths:
- Lista vazia e estados de processamento lexical são mostrados conforme a UI.

Failure paths:
- Erro de SQLite é encaminhado ao tratamento da tela.

Persisted state:
- Leitura das tabelas SQLite locais de livros e estados relacionados.

Evidence:
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/components/BookCard.tsx`
- `leitor-epub/src/db/migrations.ts`

Tests:
- `leitor-epub/src/db/migrations.test.ts` cobre migrations, não a renderização completa.

Unknowns:
- Nenhum.

## FLOW-005 — Adicionar EPUB via web e preparar o léxico

Status: PARTIALLY_VERIFIED

Actor: usuário web autenticado

Surface: WEB

Capabilities:
- CAP-003
- CAP-005
- CAP-016
- CAP-019

APIs:
- API-004
- API-005
- API-016
- API-017
- API-019

Preconditions:
- Sessão válida e arquivo EPUB aceito pelo fluxo web.

Start:
Usuário escolhe um EPUB no formulário de adição.

Steps:

1. UI/entrada: frontend verifica extensão/tamanho e calcula SHA-256.
2. API: cria livro com `POST /api/books`.
3. API/persistência: envia conteúdo com `POST /api/books/{id}/content`; backend grava arquivo/registro.
4. UI/API: usuário inicia job em `POST /api/books/{bookId}/lexicon/jobs`.
5. Processo/persistência: runner assíncrono parseia EPUB e persiste unidades, sentenças, tokens, lexemas/formas e vínculos.
6. UI/API: frontend consulta `GET /api/books/{bookId}/lexicon/jobs/latest` em polling.
7. API/UI: léxico disponível pode ser consultado em `GET /api/books/{bookId}/lexicon/lookup`.

Expected observable result:
Livro aparece, pode ser lido e o modal mostra o job; após sucesso, lookup lexical responde.

Alternative paths:
- Processamento pode ser iniciado depois; job ativo pode ser reutilizado.
- Lookup pode encontrar entrada, não encontrar ou indicar léxico não pronto.

Failure paths:
- Validação/duplicidade/criação/upload ou erro HTTP interrompem a etapa correspondente.
- Falha assíncrona deixa job em erro.

Persisted state:
- Livro/arquivo, job e dados lexicais no backend.

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `frontend/src/BookProcessingDetailsModal.tsx`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`

Tests:
- `frontend/book-upload.test.mjs`
- `frontend/src/bookDetails.test.ts`
- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java`
- `leitor-epub/src/components/bookProcessingDetails.test.ts`

Unknowns:
- [TODO] Não foi encontrado E2E do encadeamento upload → job → polling → lookup em aplicação executando.

## FLOW-006 — Importar EPUB local com validação mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-004
- CAP-006

APIs:
- Nenhuma.

Preconditions:
- Document Picker, SQLite e filesystem privado disponíveis.

Start:
Usuário escolhe importar/adicionar livro na tela principal.

Steps:

1. UI/entrada: `importEpub` abre Document Picker.
2. Estado: serviço calcula/usa hash e verifica duplicidade no SQLite.
3. Validação: ZIP/CRC/estrutura EPUB são verificados; caminhos inseguros, DRM/encriptação não suportada, layout fixo e carregamento remoto são rejeitados.
4. Filesystem/persistência: arquivo aceito é copiado para diretório privado, metadados/capa são preparados e livro é inserido no SQLite.
5. UI: sucesso, duplicidade ou erro são mostrados e o reader pode ser aberto.

Expected observable result:
EPUB aceito aparece na biblioteca e pode ser lido; EPUB rejeitado não é importado.

Alternative paths:
- Cancelamento encerra sem inserir; EPUB 2 e 3 aceitos seguem o mesmo fluxo.

Failure paths:
- ZIP/estrutura inválidos, condição de segurança, cópia ou persistência com falha produzem erro.

Persisted state:
- EPUB/capa no filesystem privado e metadados/hash no SQLite.

Evidence:
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/epubSecurity.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/epubImport.test.ts`
- `leitor-epub/src/services/epubSecurity.test.ts`

Tests:
- `leitor-epub/src/services/epubImport.test.ts`
- `leitor-epub/src/services/epubSecurity.test.ts`
- `leitor-epub/src/db/migrations.test.ts`

Unknowns:
- Nenhum.

## FLOW-007 — Excluir livro e conteúdo armazenado

Status: VERIFIED

Actor: usuário web ou mobile

Surface: CROSS-SURFACE

Capabilities:
- CAP-007

APIs:
- API-009 (web)

Preconditions:
- Livro existe; no web, sessão autenticada.

Start:
Usuário confirma excluir no menu/detalhes do livro.

Steps:

1. Web/API: chama `DELETE /api/books/{id}`.
2. Backend: service remove conteúdo/registro conforme implementação.
3. Mobile: `deleteBookFiles`/`removeBook` removem arquivos locais e registro SQLite.
4. UI: lista é atualizada e o livro deixa de aparecer na superfície da ação.

Expected observable result:
Livro e conteúdo associado deixam de estar disponíveis no caminho confirmado.

Alternative paths:
- Cancelamento não executa remoção; mobile pode remover apenas localmente, sem HTTP.

Failure paths:
- Livro inexistente, sessão inválida ou falha de filesystem/banco resulta em erro.

Persisted state:
- Web: registro/conteúdo backend.
- Mobile: registro SQLite e arquivos privados.

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `leitor-epub/src/components/BookCard.tsx`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/db/repository.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java`

Tests:
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java` cobre remoção/backend relacionada.

Unknowns:
- [ASK USER] Não é demonstrável se exclusões mobile devem ser propagadas ao backend no sync.

## FLOW-008 — Abrir e ler EPUB no web com persistência de posição

Status: VERIFIED

Actor: usuário web autenticado

Surface: WEB

Capabilities:
- CAP-008
- CAP-010

APIs:
- API-006
- API-008

Preconditions:
- Livro/conteúdo no backend e sessão válida.

Start:
Usuário abre o livro na biblioteca web.

Steps:

1. UI/API: solicita `GET /api/books/{id}/file`.
2. UI: `EpubReader` entrega conteúdo ao epub.js e renderiza.
3. UI/estado: navegação altera localização.
4. API/persistência: progresso é enviado por `PATCH /api/books/{id}/progress`.
5. UI/API: ao reabrir, client aplica a posição carregada.

Expected observable result:
EPUB abre no reader web e a posição pode ser restaurada na próxima abertura.

Alternative paths:
- Sem progresso, inicia posição padrão; falha de PATCH pode não impedir leitura já carregada.

Failure paths:
- Livro/arquivo inexistente, acesso não autorizado ou erro de PATCH impede a etapa correspondente.

Persisted state:
- Conteúdo no filesystem backend e progresso na entidade backend.

Evidence:
- `frontend/src/EpubReader.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `leitor-epub/src/reader/progress.test.ts`

Tests:
- `leitor-epub/src/reader/progress.test.ts` cobre conversões de progresso; não foi encontrado E2E do reader web.

Unknowns:
- Nenhum.

## FLOW-009 — Ler EPUB local, navegar e configurar o reader mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-009
- CAP-010
- CAP-011
- CAP-012

APIs:
- Nenhuma.

Preconditions:
- Livro importado, arquivo no filesystem privado e registro no SQLite.

Start:
Usuário abre `/reader/[id]`.

Steps:

1. UI/estado: rota carrega livro, preferências, anotações e bookmarks do SQLite.
2. Filesystem/UI: `EpubReaderSurface` abre o arquivo local.
3. UI: usuário usa TOC, anterior/próximo, pesquisa e navegação.
4. Persistência: eventos de localização e `flushPosition` salvam posição local.
5. UI/persistência: alterações de fonte/tema/tamanho são salvas como preferências.
6. UI: toolbar abre TOC, bookmarks, citações e pesquisa.

Expected observable result:
Livro é lido localmente; navegação, preferências e posição ficam disponíveis ao retornar.

Alternative paths:
- Voltar dispara flush; livro ausente/arquivo inválido segue tratamento da rota.

Failure paths:
- Falha de arquivo, SQLite ou evento inválido da ponte interrompe/degrada leitura.

Persisted state:
- Livro/arquivo, posição, preferências, anotações e bookmarks locais.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/reader/readerBridge.ts`
- `leitor-epub/src/reader/progress.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/reader/progress.test.ts`
- `leitor-epub/src/reader/readerBridge.test.ts`

Tests:
- `leitor-epub/src/reader/progress.test.ts`
- `leitor-epub/src/reader/readerBridge.test.ts`

Unknowns:
- Nenhum.

## FLOW-010 — Selecionar texto no web, consultar léxico e criar card

Status: PARTIALLY_VERIFIED

Actor: usuário web autenticado

Surface: WEB

Capabilities:
- CAP-014
- CAP-016
- CAP-017

APIs:
- API-011
- API-016
- API-019

Preconditions:
- Usuário está lendo livro web e reader fornece seleção.

Start:
Usuário seleciona texto no EPUB web.

Steps:

1. UI: reader expõe ações para a seleção.
2. API/UI: lookup chama `GET /api/books/{bookId}/lexicon/lookup`.
3. UI: mostra resultado, ausência ou léxico indisponível.
4. Processo opcional: frontend pode iniciar job com API-016 quando necessário.
5. UI/API: ao confirmar card, envia `POST /api/cards` com texto/contexto lexical observado.
6. Persistência: backend coloca o card na fila do proprietário.

Expected observable result:
Lookup é mostrado quando disponível e o card confirmado aparece na lista.

Alternative paths:
- Lookup sem entrada; consulta sem criar card; campos lexicais podem ser parciais.

Failure paths:
- Sessão/livro/lexicon inválido ou validação HTTP falha sem confirmar card.

Persisted state:
- Job/lexicon quando acionado e card no backend.

Evidence:
- `frontend/src/EpubReader.tsx`
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `frontend/card-creation.test.mjs`
- `frontend/lexicon-lookup.test.mjs`

Tests:
- `frontend/card-creation.test.mjs`
- `frontend/lexicon-lookup.test.mjs`
- `frontend/lexicon-entry.test.mjs`

Unknowns:
- [TODO] Não foi encontrado E2E de seleção real no epub.js + lookup + criação backend.

## FLOW-011 — Selecionar texto mobile e consultar definição

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-014
- CAP-016

APIs:
- OUT-001 — `GET https://{idioma}.wiktionary.org/w/api.php`

Preconditions:
- Livro aberto, seleção e idioma de consulta disponíveis.

Start:
Usuário escolhe “dicionário” na ação da seleção.

Steps:

1. UI: `handleSelectionAction('dictionary')` chama `runDictionaryLookup`.
2. Persistência/estado: procura primeiro `lexicon_entries` local.
3. Integração: sem definição local utilizável, `lookupDictionary` normaliza termo/idioma e chama OUT-001.
4. Normalização/persistência: resposta é sanitizada/limitada e gravada em `lookup_cache` por 30 dias.
5. UI: `LookupDialog` mostra definição/metadata ou erro/ausência.

Expected observable result:
Definição local ou remota aparece no diálogo e consulta remota bem-sucedida pode ser reutilizada.

Alternative paths:
- Entrada local evita chamada externa; pesquisa/definição externa pode ser aberta pela ação correspondente.

Failure paths:
- Seleção vazia, resposta não-2xx ou página sem definição produzem as mensagens implementadas.

Persisted state:
- Cache lexical no SQLite quando consulta externa é bem-sucedida.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/lookup.test.ts`
- `docs/system/API-CATALOG.md`

Tests:
- `leitor-epub/src/services/lookup.test.ts` cobre normalização/URLs; não integração Wiktionary.

Unknowns:
- [TODO] Disponibilidade e resposta runtime da rede externa não são comprovadas pelos testes locais.

## FLOW-012 — Traduzir texto selecionado no mobile

Status: PARTIALLY_VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-014
- CAP-015

APIs:
- Nenhum endpoint backend.

Preconditions:
- Seleção no reader; tradução local requer módulo ML Kit Android disponível.

Start:
Usuário escolhe “Traduzir” ou a ação de tradução do diálogo.

Steps:

1. UI: seleção é encaminhada pela ação `translate`.
2. Integração/UI: caminho externo abre Google Translate por URL ou módulo nativo Android.
3. Integração local: `translateLocally` usa o módulo Expo/ML Kit, idiomas normalizados e `wifiOnly=true`.
4. UI/estado: diálogo mostra loading, resultado, retry ou erro no caminho local; caminho externo fica no browser/app externo.

Expected observable result:
Texto é encaminhado para tradução externa ou, com runtime Android suportado, retorna tradução local ao diálogo.

Alternative paths:
- Sem módulo Android local, código lança “A tradução local requer o aplicativo Android de desenvolvimento.”.
- Usuário abre tradutor externo pelo diálogo.

Failure paths:
- Falha de browser, app externo, modelo ou módulo ML Kit impede o caminho correspondente.

Persisted state:
- Nenhuma persistência de tradução como entidade de negócio.

Evidence:
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/LookupDialog.tsx`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/src/native/mlkit.ts`
- `leitor-epub/src/native/googleTranslate.ts`
- `leitor-epub/modules/expo-google-translate/android/src/main/java/expo/modules/googletranslate/ExpoGoogleTranslateModule.kt`

Tests:
- `leitor-epub/src/services/lookup.test.ts` cobre URL externa, não módulo/jornada de tradução.

Unknowns:
- [TODO] Não foi executado dispositivo Android com módulo/modelo ML Kit para confirmar o caminho local.

## FLOW-013 — Criar card mobile a partir de seleção

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-014
- CAP-017

APIs:
- Nenhuma.

Preconditions:
- Livro aberto, seleção com CFI e SQLite disponíveis.

Start:
Usuário escolhe “card” nas ações da seleção.

Steps:

1. UI: seleção é encaminhada para `saveCard`.
2. Estado: serviço procura campos lexicais em `lexicon_entries`.
3. Persistência: monta `CardRecord` e chama `insertCard` no SQLite.
4. UI: seleção é limpa e mensagem de sucesso/erro é mostrada.
5. UI/estado: `/cards` lê e mostra os cards locais.

Expected observable result:
Novo card aparece na lista local com texto/CFI e campos disponíveis.

Alternative paths:
- Entrada lexical pode faltar; card usa campos disponíveis.

Failure paths:
- Falha SQLite impede confirmação.

Persisted state:
- Registro de card no SQLite mobile.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/app/cards.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/lexicon.ts`
- `leitor-epub/src/services/lexicon.test.ts`

Tests:
- `leitor-epub/src/services/lexicon.test.ts` cobre derivação lexical, não interação completa mobile.

Unknowns:
- [ASK USER] Não é demonstrado se card mobile deve ser equivalente ao card web antes do sync.

## FLOW-014 — Criar, editar e excluir citação/anotação mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-013
- CAP-014

APIs:
- Nenhuma.

Preconditions:
- Livro aberto e seleção com CFI disponível.

Start:
Usuário escolhe “citação”.

Steps:

1. UI: `QuoteDialog` abre com texto/CFI.
2. Persistência/UI: nova citação chama `insertAnnotation`, grava SQLite e marca reader.
3. UI: pressionar anotação carrega registro e abre edição.
4. Persistência: edição chama `updateAnnotation`/`updateAnnotationSection`.
5. Persistência/UI: excluir chama `deleteAnnotation` e remove marca.

Expected observable result:
Citação aparece no reader/área local, pode ser editada e desaparece após exclusão.

Alternative paths:
- Cancelamento não persiste; anotação existente segue caminho de edição.

Failure paths:
- Validação/SQLite com falha deixa operação sem confirmação.

Persisted state:
- Anotação, texto, CFI, nota/seção e timestamps no SQLite.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/QuoteDialog.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/repository.test.ts`

Tests:
- `leitor-epub/src/db/repository.test.ts` cobre criação/atualização de anotações.

Unknowns:
- [ASK USER] Não foi encontrada sincronização de anotações; não é demonstrável se a intenção é local-only ou se há lacuna.

## FLOW-015 — Criar e revisitar bookmarks no reader mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-009
- CAP-011

APIs:
- Nenhuma.

Preconditions:
- Livro aberto e CFI corrente.

Start:
Usuário pressiona bookmark no toolbar.

Steps:

1. UI/estado: `toggleBookmark` obtém CFI.
2. Persistência: sem bookmark chama `insertBookmark`; existente chama `deleteBookmarkByCfi`.
3. UI: estado visual é atualizado.
4. UI/estado: aba bookmarks do `NavigationDialog` carrega lista local e pode navegar ao CFI.

Expected observable result:
Bookmark é alternado e aparece/desaparece na lista local.

Alternative paths:
- Pressão repetida no CFI remove; consulta pode ocorrer sem alterar posição.

Failure paths:
- CFI ausente ou falha SQLite impede persistência.

Persisted state:
- Bookmark/CFI/metadados no SQLite.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/NavigationDialog.tsx`
- `leitor-epub/src/db/repository.ts`

Tests:
- Não foi encontrado teste específico de bookmark.

Unknowns:
- [ASK USER] Sync não inclui bookmarks no merge observado; não é demonstrável se devem permanecer locais.

## FLOW-016 — Revisar e manter a fila de cards web

Status: PARTIALLY_VERIFIED

Actor: usuário web autenticado

Surface: WEB

Capabilities:
- CAP-018

APIs:
- API-010
- API-012
- API-013
- API-015

Preconditions:
- Sessão válida e cards do proprietário existentes ou fila vazia.

Start:
Usuário abre a área web de cards.

Steps:

1. API/UI: `GET /api/cards` carrega fila/filtro.
2. UI: usuário vira card para revisão.
3. API/persistência: edição chama `PATCH /api/cards/{id}`.
4. API/persistência: arquivar chama `POST /api/cards/{id}/archive`; o catálogo de API registra API-014 como consumidor mobile, não como chamada desta jornada web.
5. API/estado: mover ao fim chama `POST /api/cards/{id}/move-to-end`.

Expected observable result:
Fila, conteúdo, arquivamento e ordem refletem o estado retornado pelo backend.

Alternative paths:
- Fila vazia; filtro pode incluir arquivados; operações podem ser independentes.

Failure paths:
- Ownership/sessão/card inválidos ou validação retornam erro.
- Achado de `queueOrder` pode afetar a ordem observada.

Persisted state:
- Card, arquivamento e `queueOrder` no backend.

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/CardRepository.java`
- `docs/codebase/CONCERNS.md`

Tests:
- Não foi encontrado teste específico da fila HTTP/UI.

Unknowns:
- [TODO] Runtime ainda não confirmou o efeito prático da duplicação de `queueOrder`.

## FLOW-017 — Revisar e manter cards locais mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-018

APIs:
- Nenhuma.

Preconditions:
- Cards locais existentes ou fila vazia.

Start:
Usuário abre `/cards`.

Steps:

1. UI/estado: tela lista cards SQLite e controla frente/verso.
2. UI: usuário revisa texto/tradução.
3. Persistência: edição usa `CardEditorDialog`/`updateCard`.
4. Persistência: arquivar usa `archiveCard`; fim usa `moveCardToEnd`.
5. UI: lista local é atualizada.

Expected observable result:
Cards podem ser revisados, editados, arquivados e reordenados sem HTTP imediato.

Alternative paths:
- Fila vazia; alterações ficam locais até sync posterior.

Failure paths:
- Falha SQLite mostra erro e não confirma alteração.

Persisted state:
- Campos, arquivamento e ordem no SQLite.

Evidence:
- `leitor-epub/app/cards.tsx`
- `leitor-epub/src/components/CardEditorDialog.tsx`
- `leitor-epub/src/db/repository.ts`

Tests:
- Não foi encontrado teste específico das operações locais de cards.

Unknowns:
- [ASK USER] Equivalência de ordem/estado com a fila web depende da política de sync não definida.

## FLOW-018 — Sincronizar biblioteca mobile com o backend

Status: UNKNOWN_INTENT

Actor: usuário mobile ou ação de sync

Surface: CROSS-SURFACE

Capabilities:
- CAP-004
- CAP-010
- CAP-017
- CAP-018
- CAP-019
- CAP-022

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
- Sessão válida, SQLite e rede/backend disponíveis para etapas remotas.

Start:
Usuário aciona sync ou login dispara tentativa inicial.

Steps:

1. API: `syncLibrary` lista remotos com `GET /api/books`.
2. Reconciliação: relaciona por `fileHash`; pode criar remoto com `POST /api/books`.
3. Conteúdo: envia EPUB local por API-005 quando necessário.
4. Progresso: compara timestamps e atualiza API-008 quando aplicável.
5. Cards: lista/reconcilia/cria/atualiza/arquiva/move usando API-010–API-015.
6. Léxico: solicita job, consulta status e baixa entradas com API-016–API-018.
7. Persistência: atualiza livros, mapa remoto, cards, progresso, lexicon entries e estado de sync no SQLite.
8. UI: mostra `SyncResult`/mensagem.

Expected observable result:
Dados contemplados pelo algoritmo são reconciliados entre SQLite/backend e o resultado é informado.

Alternative paths:
- Offline mantém dados locais e mostra falha; remoto sem local não é baixado; dados já iguais podem ser ignorados.

Failure paths:
- Token, rede, conteúdo ou etapa lexical inválidos podem produzir sync parcial/erro.

Persisted state:
- SQLite mobile e entidades backend tocadas pelas APIs.

Evidence:
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/app/index.tsx`
- `leitor-epub/app/login.tsx`
- `leitor-epub/src/db/repository.ts`
- `docs/system/API-CATALOG.md`
- `ACCOUNT-SYNC.md`

Tests:
- Não foi encontrado teste automatizado do serviço ou fluxo cross-surface completo.

Unknowns:
- [ASK USER] Fonte autoritativa geral e política de conflitos não são definidas.
- [ASK USER] Ausência de merge para anotações, bookmarks e preferências pode ser requisito ou lacuna.
- [ASK USER] Não é possível classificar como desejado o não-download de livros exclusivamente remotos.

## FLOW-019 — Reprocessar e acompanhar o léxico de um livro

Status: VERIFIED

Actor: usuário web/mobile autenticado; backend assíncrono

Surface: CROSS-SURFACE

Capabilities:
- CAP-016
- CAP-019

APIs:
- API-016
- API-017

Preconditions:
- Livro conhecido pelo backend e conteúdo acessível.

Start:
Usuário escolhe reprocessar no detalhe/card do livro.

Steps:

1. Web/API: botão chama API-016, com força quando o client usa essa opção.
2. Mobile/API: `BookCard` prepara vínculo/sync necessário e chama API-016 conforme seu fluxo.
3. Backend: service cria/reutiliza job e runner assíncrono processa EPUB.
4. Persistência: entidades lexicais e status/progresso do job são atualizados.
5. UI/API: surfaces consultam API-017 e exibem estado/detalhes.

Expected observable result:
Novo/reutilizado job fica visível como processamento, sucesso ou erro; após sucesso, léxico está disponível.

Alternative paths:
- Job ativo reutilizado; job concluído/erro reiniciado por ação; mobile pode criar vínculo antes.

Failure paths:
- Livro/arquivo/sessão inválidos ou falha no pipeline geram erro/estado de erro.

Persisted state:
- Jobs/entidades lexicais backend; entradas podem ser baixadas no SQLite pelo sync.

Evidence:
- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `leitor-epub/src/components/BookCard.tsx`
- `leitor-epub/src/services/sync.ts`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`

Tests:
- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java`
- `leitor-epub/src/components/bookProcessingDetails.test.ts`

Unknowns:
- [TODO] Não foi encontrado E2E da ação + job assíncrono + consulta final.

## FLOW-020 — Exportar backup completo mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-023

APIs:
- Nenhuma.

Preconditions:
- SQLite/filesystem e compartilhamento Expo disponíveis.

Start:
Usuário abre `/backup` e escolhe exportar.

Steps:

1. UI: chama `createAndShareBackup`.
2. Persistência: `exportSnapshot` lê snapshot e arquivos EPUB/capas.
3. Filesystem: `JSZip` cria ZIP com EPUBs, capas, `library.json`, `manifest.json` e checksums.
4. Integração: arquivo é escrito e entregue ao compartilhamento Expo.
5. UI: sucesso/caminho/erro é mostrado.

Expected observable result:
Usuário recebe ZIP compartilhável com o snapshot/arquivos contemplados.

Alternative paths:
- Snapshot vazio pode ser exportado; compartilhamento pode ser cancelado/indisponível.

Failure paths:
- Falha ao ler, zipar, escrever ou compartilhar não confirma exportação.

Persisted state:
- ZIP no filesystem local/temporário do app conforme retenção do runtime.

Evidence:
- `leitor-epub/app/backup.tsx`
- `leitor-epub/src/services/backup.ts`
- `leitor-epub/src/services/backupValidation.ts`
- `leitor-epub/src/db/repository.ts`

Tests:
- `leitor-epub/src/services/backupValidation.test.ts` cobre validação, não export/share completo.

Unknowns:
- [TODO] Retenção do ZIP após compartilhamento depende do sistema operacional e não é demonstrada.

## FLOW-021 — Restaurar backup mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-023

APIs:
- Nenhuma.

Preconditions:
- ZIP compatível, espaço/permissão para substituir snapshot.

Start:
Usuário escolhe restaurar e seleciona ZIP.

Steps:

1. UI/entrada: `pickAndValidateBackup` recebe arquivo.
2. Validação: tamanho, CRC, entries, tamanho expandido, manifest, schema, checksums e referências são verificados.
3. UI: confirmação mostra contagem de livros.
4. Persistência/filesystem: após confirmação, `replaceSnapshot` substitui SQLite e restaura arquivos.
5. UI: sucesso; biblioteca/cards refletem snapshot.

Expected observable result:
Backup válido confirmado substitui dados locais; inválido/cancelado não é aplicado.

Alternative paths:
- Cancelamento na seleção/confirmação não altera snapshot; backup vazio consistente pode ser aceito.

Failure paths:
- Path/CRC/manifest/schema/checksum/referência inválidos ou limites excedidos são rejeitados; falha de aplicação não confirma restauração.

Persisted state:
- SQLite e EPUBs/capas locais substituídos pelos dados validados.

Evidence:
- `leitor-epub/app/backup.tsx`
- `leitor-epub/src/services/backup.ts`
- `leitor-epub/src/services/backupValidation.ts`
- `leitor-epub/src/services/backupValidation.test.ts`

Tests:
- `leitor-epub/src/services/backupValidation.test.ts`

Unknowns:
- [TODO] Não foi encontrado teste da restauração completa com SQLite/filesystem reais.

## FLOW-022 — Abrir links externos referenciados no EPUB mobile

Status: VERIFIED

Actor: usuário mobile

Surface: MOBILE

Capabilities:
- CAP-024

APIs:
- Nenhuma API backend.

Preconditions:
- Reader encontrou link e o esquema passa pelo filtro.

Start:
Usuário toca no link externo.

Steps:

1. UI: reader chama `handleExternalLink`.
2. Segurança/UI: esquema é validado e confirmação é apresentada.
3. Integração: HTTP(S) usa `WebBrowser`; esquemas de comunicação aceitos usam `Linking`.
4. Resultado: sistema operacional/app externo assume o link.

Expected observable result:
Link permitido abre após confirmação; não permitido não é executado.

Alternative paths:
- Cancelamento não abre; links de pesquisa/definição usam URLs dos serviços de lookup.

Failure paths:
- Esquema não permitido ou falha de browser/linking gera rejeição/erro.

Persisted state:
- Nenhuma persistência de negócio.

Evidence:
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/MoreActionsDialog.tsx`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/src/services/epubSecurity.test.ts`

Tests:
- `leitor-epub/src/services/epubSecurity.test.ts` cobre distinção de links; não abertura OS completa.

Unknowns:
- [TODO] Disponibilidade dos apps/browser no dispositivo não é verificável pelo código.

## FLOW-023 — Inicializar conta padrão e recuperar jobs interrompidos

Status: VERIFIED

Actor: processo backend/operador

Surface: BACKEND/OPERATOR

Capabilities:
- CAP-002
- CAP-019

APIs:
- Nenhuma.

Preconditions:
- Spring alcança eventos de startup e banco está configurado.

Start:
Backend dispara `ApplicationReadyEvent`.

Steps:

1. Processo/persistência: `DefaultAccountSeeder` chama `AuthService.ensureDefaultAccount`.
2. Processo/persistência: `LexiconJobRecovery` marca jobs lexicais interrompíveis como falhos.
3. Observação: efeitos podem ser observados no banco/logs/status posteriores; não há UI de usuário.

Expected observable result:
Conta padrão é criada/reutilizada e jobs interrompidos não permanecem nos estados recuperados conforme a rotina.

Alternative paths:
- Conta já existe; nenhum job interrompido produz nenhuma alteração de recovery.

Failure paths:
- Falha de banco/configuração interrompe listener ou registra erro de startup.

Persisted state:
- Conta e estados de jobs no banco backend.

Evidence:
- `backend/src/main/java/br/com/leitormobile/auth/DefaultAccountSeeder.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRecovery.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRepository.java`
- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconJobRecoveryTest.java`

Tests:
- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconJobRecoveryTest.java`.
- Não foi encontrado teste específico do seeder.

Unknowns:
- [ASK USER] A intenção de produto para a conta padrão não é demonstrada pelo código.

## FLOW-024 — Importar catálogo lexical Kaikki/Wiktionary

Status: VERIFIED

Actor: operador/processo backend

Surface: BACKEND/OPERATOR

Capabilities:
- CAP-021

APIs:
- Nenhuma API pública inicia diretamente o importador.

Preconditions:
- Importador habilitado/configurado no startup e dataset disponível.

Start:
Backend inicia com as propriedades do importador/script operacional.

Steps:

1. Processo: `DictionaryImportStartup` executa como `ApplicationRunner` quando habilitado.
2. Entrada: importador lê Kaikki/Wiktionary, aplica hash/estado e percorre lotes.
3. Normalização: registros são filtrados/normalizados para o modelo lexical.
4. Persistência: entradas, sentidos, metadata e estado de batch são gravados.
5. Resultado: catálogo alimenta consultas e pipeline lexical.

Expected observable result:
Dados lexicais ficam disponíveis após conclusão; logs/estado de batch permitem observar o processamento conforme implementado.

Alternative paths:
- Hash/estado pode pular dataset já processado; limites podem produzir importação parcial configurada.

Failure paths:
- Dataset ausente, JSON/configuração inválidos ou erro de persistência interrompem/retornam erro.

Persisted state:
- Tabelas de catálogo e estado de importação/batch no backend.

Evidence:
- `backend/src/main/java/br/com/leitormobile/lexicon/DictionaryImportStartup.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/KaikkiDictionaryImporter.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/DictionaryImportBatchRepository.java`
- `tools/import-kaikki.ps1`
- `docs/codebase/INTEGRATIONS.md`

Tests:
- Não foi encontrado teste automatizado específico do fluxo completo Kaikki.

Unknowns:
- [TODO] Dataset efetivo e resultado de uma execução real não são demonstrados pelo código isolado.

## FLOW-025 — Enriquecer candidatos lexicais com Ollama local

Status: PARTIALLY_VERIFIED

Actor: processo backend; operador configura execução

Surface: BACKEND/OPERATOR

Capabilities:
- CAP-019
- CAP-020

APIs:
- API-016 (gatilho)
- API-017 (observação)

Preconditions:
- Job lexical em processamento, enriquecimento habilitado e Ollama local configurado/disponível.

Start:
Pipeline encontra candidato não resolvido pelo dicionário local.

Steps:

1. Processo: runner seleciona candidatos, aplica limites/batches e política de contexto.
2. Integração: `OllamaAiProvider` envia requisição ao endpoint local `/api/chat`.
3. Normalização/persistência: resposta é interpretada e resultados válidos/auditoria são gravados.
4. Job: progresso/resultado fica observável por API-017.

Expected observable result:
Quando disponível, candidato é enriquecido e job registra etapa/progresso; sem candidato/local resolve, não há chamada de IA.

Alternative paths:
- IA desabilitada/sem candidatos; timeout/erro pode ser registrado e tratado pelo runner conforme o código.

Failure paths:
- Ollama indisponível, resposta inválida ou política de exposição impedem/falham a etapa.

Persisted state:
- Dados lexicais, auditoria/estado e progresso do job no backend.

Evidence:
- `backend/src/main/java/br/com/leitormobile/ai/OllamaAiProvider.java`
- `backend/src/main/java/br/com/leitormobile/ai/ExternalAiContextPolicy.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `OLLAMA-LOCAL.md`
- `docker-compose.ollama.yml`
- `backend/src/test/java/br/com/leitormobile/ai/OllamaAiProviderTest.java`
- `backend/src/test/java/br/com/leitormobile/ai/ExternalAiContextPolicyTest.java`

Tests:
- `backend/src/test/java/br/com/leitormobile/ai/OllamaAiProviderTest.java`
- `backend/src/test/java/br/com/leitormobile/ai/ExternalAiContextPolicyTest.java`
- `backend/src/test/java/br/com/leitormobile/ai/ExternalAiExposurePolicyTest.java`

Unknowns:
- [TODO] Ollama não foi executado nesta auditoria; disponibilidade/latência/resposta runtime permanecem não verificadas.

## FLOW-026 — Verificar health operacional do backend

Status: VERIFIED

Actor: operador/monitor/cliente operacional

Surface: BACKEND/OPERATOR

Capabilities:
- CAP-025

APIs:
- API-020
- API-021

Preconditions:
- Backend em execução e Actuator configurado.

Start:
Monitor chama endpoint operacional.

Steps:

1. API/security: `GET /actuator/health` é permitido sem autenticação.
2. Resultado: Actuator produz status conforme indicadores disponíveis.
3. API/security: `GET /actuator/info` é endpoint relacionado sujeito à autenticação global observada.

Expected observable result:
Monitor recebe health público; cliente autenticado pode consultar info.

Alternative paths:
- Health pode retornar estado não saudável; info sem autenticação é rejeitado.

Failure paths:
- Backend indisponível não responde; regras impedem info não autorizado.

Persisted state:
- Nenhuma alteração de banco/filesystem demonstrada.

Evidence:
- `backend/src/main/resources/application.yml`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/pom.xml`
- `docs/system/API-CATALOG.md`

Tests:
- Não foi encontrado teste específico dos endpoints Actuator.

Unknowns:
- [TODO] Payload/status efetivo depende da execução e dos indicadores do ambiente.

## Rastreabilidade FLOW → capability/API

| FLOW | Nome | Surface | Capabilities | APIs |
|---|---|---|---|---|
| FLOW-001 | Login web e abertura da biblioteca | WEB | CAP-001, CAP-003 | API-001, API-002, API-003 |
| FLOW-002 | Login mobile e tentativa de sincronização inicial | CROSS-SURFACE | CAP-001, CAP-022 | API-001, API-003–API-005, API-008, API-010–API-018 |
| FLOW-003 | Consultar a biblioteca web | WEB | CAP-003 | API-003, API-007 |
| FLOW-004 | Consultar a biblioteca local mobile | MOBILE | CAP-004 | — |
| FLOW-005 | Adicionar EPUB via web e preparar o léxico | WEB | CAP-003, CAP-005, CAP-016, CAP-019 | API-004, API-005, API-016, API-017, API-019 |
| FLOW-006 | Importar EPUB local com validação mobile | MOBILE | CAP-004, CAP-006 | — |
| FLOW-007 | Excluir livro e conteúdo armazenado | CROSS-SURFACE | CAP-007 | API-009 |
| FLOW-008 | Abrir e ler EPUB no web com persistência de posição | WEB | CAP-008, CAP-010 | API-006, API-008 |
| FLOW-009 | Ler EPUB local, navegar e configurar o reader mobile | MOBILE | CAP-009, CAP-010, CAP-011, CAP-012 | — |
| FLOW-010 | Selecionar texto no web, consultar léxico e criar card | WEB | CAP-014, CAP-016, CAP-017 | API-011, API-016, API-019 |
| FLOW-011 | Selecionar texto mobile e consultar definição | MOBILE | CAP-014, CAP-016 | OUT-001 |
| FLOW-012 | Traduzir texto selecionado no mobile | MOBILE | CAP-014, CAP-015 | — |
| FLOW-013 | Criar card mobile a partir de seleção | MOBILE | CAP-014, CAP-017 | — |
| FLOW-014 | Criar, editar e excluir citação/anotação mobile | MOBILE | CAP-013, CAP-014 | — |
| FLOW-015 | Criar e revisitar bookmarks no reader mobile | MOBILE | CAP-009, CAP-011 | — |
| FLOW-016 | Revisar e manter a fila de cards web | WEB | CAP-018 | API-010, API-012, API-013, API-015 |
| FLOW-017 | Revisar e manter cards locais mobile | MOBILE | CAP-018 | — |
| FLOW-018 | Sincronizar biblioteca mobile com o backend | CROSS-SURFACE | CAP-004, CAP-010, CAP-017, CAP-018, CAP-019, CAP-022 | API-003–API-005, API-008, API-010–API-018 |
| FLOW-019 | Reprocessar e acompanhar o léxico de um livro | CROSS-SURFACE | CAP-016, CAP-019 | API-016, API-017 |
| FLOW-020 | Exportar backup completo mobile | MOBILE | CAP-023 | — |
| FLOW-021 | Restaurar backup mobile | MOBILE | CAP-023 | — |
| FLOW-022 | Abrir links externos referenciados no EPUB mobile | MOBILE | CAP-024 | — |
| FLOW-023 | Inicializar conta padrão e recuperar jobs interrompidos | BACKEND/OPERATOR | CAP-002, CAP-019 | — |
| FLOW-024 | Importar catálogo lexical Kaikki/Wiktionary | BACKEND/OPERATOR | CAP-021 | — |
| FLOW-025 | Enriquecer candidatos lexicais com Ollama local | BACKEND/OPERATOR | CAP-019, CAP-020 | API-016, API-017 |
| FLOW-026 | Verificar health operacional do backend | BACKEND/OPERATOR | CAP-025 | API-020, API-021 |

## Rastreabilidade capability → FLOWs

| CAP | FLOWs relacionados |
|---|---|
| CAP-001 | FLOW-001, FLOW-002 |
| CAP-002 | FLOW-023 |
| CAP-003 | FLOW-001, FLOW-003, FLOW-005 |
| CAP-004 | FLOW-004, FLOW-006, FLOW-018 |
| CAP-005 | FLOW-005 |
| CAP-006 | FLOW-006 |
| CAP-007 | FLOW-007 |
| CAP-008 | FLOW-008 |
| CAP-009 | FLOW-009, FLOW-015 |
| CAP-010 | FLOW-008, FLOW-009, FLOW-018 |
| CAP-011 | FLOW-009, FLOW-015 |
| CAP-012 | FLOW-009 |
| CAP-013 | FLOW-014 |
| CAP-014 | FLOW-010, FLOW-011, FLOW-012, FLOW-013, FLOW-014 |
| CAP-015 | FLOW-012 |
| CAP-016 | FLOW-005, FLOW-010, FLOW-011, FLOW-019 |
| CAP-017 | FLOW-010, FLOW-013, FLOW-018 |
| CAP-018 | FLOW-016, FLOW-017, FLOW-018 |
| CAP-019 | FLOW-005, FLOW-018, FLOW-019, FLOW-023, FLOW-025 |
| CAP-020 | FLOW-025 |
| CAP-021 | FLOW-024 |
| CAP-022 | FLOW-002, FLOW-018 |
| CAP-023 | FLOW-020, FLOW-021 |
| CAP-024 | FLOW-022 |
| CAP-025 | FLOW-026 |

Nenhuma das 25 capabilities ficou sem análise. CAP-002, CAP-020, CAP-021 e CAP-025 são predominantemente operacionais/internas; por isso suas jornadas são de backend/operador.

## Auditoria final de cobertura

### Totais

- Total de journeys: **26**.
- VERIFIED: **19** — FLOW-001, FLOW-003, FLOW-004, FLOW-006, FLOW-007, FLOW-008, FLOW-009, FLOW-011, FLOW-013, FLOW-014, FLOW-015, FLOW-017, FLOW-019, FLOW-020, FLOW-021, FLOW-022, FLOW-023, FLOW-024, FLOW-026.
- PARTIALLY_VERIFIED: **5** — FLOW-005, FLOW-010, FLOW-012, FLOW-016, FLOW-025.
- UNKNOWN_INTENT: **2** — FLOW-002, FLOW-018.

### Classificação por superfície

- WEB: **6** — FLOW-001, FLOW-003, FLOW-005, FLOW-008, FLOW-010, FLOW-016.
- MOBILE: **12** — FLOW-004, FLOW-006, FLOW-009, FLOW-011, FLOW-012, FLOW-013, FLOW-014, FLOW-015, FLOW-017, FLOW-020, FLOW-021, FLOW-022.
- CROSS-SURFACE: **4** — FLOW-002, FLOW-007, FLOW-018, FLOW-019.
- BACKEND/OPERATOR: **4** — FLOW-023, FLOW-024, FLOW-025, FLOW-026.

### Cobertura de capabilities e APIs

- Capabilities sem journey: **nenhuma**; todas as 25 aparecem na matriz capability → FLOWs.
- APIs sem journey: **nenhuma**; API-001 a API-021 aparecem nas jornadas individuais/matriz.
- OUT-001: coberto por FLOW-011, com CAP-016 como capability funcional principal e CAP-014 como contexto de seleção.

### Jornadas sem teste automatizado relacionado conhecido

Considerando “teste conhecido” como teste automatizado relacionado ao fluxo, não como prova de E2E completo:

- FLOW-002, FLOW-004, FLOW-012, FLOW-013, FLOW-015, FLOW-016, FLOW-017, FLOW-018, FLOW-020, FLOW-022, FLOW-024 e FLOW-026.

Total: **12 journeys** sem teste automatizado relacionado conhecido.

### Diferenças relevantes entre web e mobile

- Web lê livros/progresso por backend; mobile lê EPUB do filesystem privado e salva posição/preferências no SQLite.
- Web mantém cards por APIs backend; mobile cria/mantém cards localmente e reconcilia posteriormente.
- Web faz upload e inicia jobs lexicais; mobile importa EPUB localmente e pode sincronizar conteúdo/job depois.
- Web consulta léxico pelo backend; mobile procura primeiro em léxico/cache SQLite e pode chamar OUT-001 diretamente.
- Citações/anotações e bookmarks têm implementação local mobile; não foi encontrado consumidor web equivalente nem merge dessas entidades no sync observado.
- Backup/restore está no mobile; o botão de backup web encontrado não possui backend correspondente implementado.

### Pontos que permanecem desconhecidos

- Fonte autoritativa e política de conflito local/remoto.
- Intenção para exclusões, anotações, bookmarks, preferências e livros remotos não baixados no sync.
- Intenção de produto da conta padrão de startup.
- Resultado runtime de Wiktionary, ML Kit, Google Translate, Ollama e indicadores Actuator.
- Cobertura E2E dos fluxos encadeados; testes encontrados são majoritariamente unitários, estáticos ou de componentes/serviços.



## Auditoria explícita de rotas

A segunda passagem considerou as superfícies de rota encontradas na baseline:

- Web: não foi encontrada uma tabela de rotas separada; `frontend/src/App.tsx` alterna as superfícies de login, biblioteca, reader, processamento e cards. Essas entradas aparecem em FLOW-001, FLOW-003, FLOW-005, FLOW-008, FLOW-010 e FLOW-016.
- Mobile `/login`: FLOW-002.
- Mobile `/`: FLOW-002 e FLOW-004.
- Mobile `/cards`: FLOW-013 e FLOW-017.
- Mobile `/reader/[id]`: FLOW-009, FLOW-011, FLOW-012, FLOW-013, FLOW-014, FLOW-015 e FLOW-022.
- Mobile `/backup`: FLOW-020 e FLOW-021.

Nenhuma rota mobile encontrada na baseline ficou sem jornada relacionada. As jornadas web e backend também foram rechecadas contra os controllers e a matriz de APIs abaixo.
