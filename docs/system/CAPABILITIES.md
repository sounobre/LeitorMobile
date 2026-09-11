# Capabilities Inventory

## Escopo e método

Inventário funcional reconstruído em 11/09/2026 a partir de `docs/codebase/*` e de uma segunda passagem pelos fontes das superfícies backend, web e mobile. Foram comparados UI/rotas, actions, controllers, services, repositories, migrations, jobs, integrações e testes. Uma capability só foi incluída quando há comportamento funcional observável ou processo operacional acionável; o nome de uma classe, entidade ou endpoint isolado não foi tratado como capability.

### Status

- `VERIFIED`: há caminho implementado e identificável na superfície indicada.
- `PARTIALLY_VERIFIED`: há caminho implementado, mas a ação visível ou o fluxo entre superfícies cobre apenas parte do comportamento esperado/declarável.
- `UNKNOWN_INTENT`: o comportamento implementado é identificável, mas o escopo correto não pode ser determinado sem decisão humana.

Os status não substituem testes E2E: a baseline registra que typecheck, testes Java/mobile/web passaram em seus comandos disponíveis, enquanto não foram demonstrados device Android, E2E de navegador, cobertura ou carga.

## CAP-001 — Autenticação e sessão do usuário

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: o backend autentica e-mail/senha, emite token Bearer com expiração de 30 dias e protege os demais endpoints; web e mobile armazenam uma sessão local e redirecionam para login quando não há sessão válida.

Ator: usuário que possui as credenciais configuradas no backend.

Entrada/gatilho: envio do formulário de login; inicialização da aplicação; ação “Sair”.

Pré-condições: backend acessível e conta existente; o mobile também precisa de uma URL de API configurada ou do fallback Android.

UI/rotas: web `frontend/src/LoginView.tsx`; mobile `/login` e `AuthGate` em `leitor-epub/app/_layout.tsx`.

APIs: `POST /api/auth/login`; `GET /api/auth/me`.

Serviços: `AuthService`, `AuthFilter`, `CurrentUserService`, `SecurityConfig`, `DefaultAccountSeeder`.

Persistência: backend `app_users` e `session_tokens`; web `localStorage` com `leitor.auth.token`/`leitor.auth.user`; mobile `sync_session` em SQLite.

Integrações: não há provedor externo de identidade encontrado.

Resultado observável: login devolve usuário e token; chamadas autenticadas passam; logout remove a sessão local; resposta 401 remove a sessão web.

Estados/caminhos alternativos: o mobile tenta sincronizar após login, mas mantém o login válido se a sincronização inicial estiver offline; a sessão mobile pode apontar para URL informada pelo usuário.

Erros conhecidos: credenciais inválidas produzem 401; token ausente, expirado ou inválido produz 401; web exibe erro de comunicação; mobile exibe erro de login.

Evidências:

- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthFilter.java`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/src/main/resources/db/migration/V2__add_single_account_auth.sql`
- `frontend/src/LoginView.tsx`
- `frontend/src/api.ts`
- `leitor-epub/app/login.tsx`
- `leitor-epub/app/_layout.tsx`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/migrations.ts`

Unknowns:

- `[ASK USER]` A conta padrão é somente um mecanismo de desenvolvimento ou também é o modelo de identidade pretendido para produção?
- `[TODO]` Não foi encontrado fluxo de cadastro, troca de senha, revogação individual ou recuperação de conta.

## CAP-002 — Provisionamento automático da conta padrão

Status: `VERIFIED`

Superfície: `BACKEND`

Descrição observada: no evento `ApplicationReadyEvent`, o backend cria a conta configurada se ela não existir e associa livros legados sem proprietário à conta, evitando associar o mesmo hash duas vezes àquela biblioteca.

Ator: processo de inicialização do backend.

Entrada/gatilho: evento de aplicação pronta.

Pré-condições: banco migrado e propriedades `app.auth.email`/`app.auth.password` resolvidas.

UI/rotas: nenhuma UI encontrada.

APIs: nenhuma API específica; ocorre no boot.

Serviços: `DefaultAccountSeeder.seed()` e `AuthService.ensureDefaultAccount()`.

Persistência: `app_users`, `books.user_id` e `session_tokens` conforme migration V2.

Integrações: PostgreSQL/JPA.

Resultado observável: a conta default pode ser usada no login após o boot; livros antigos sem owner podem ser associados.

Estados/caminhos alternativos: se a conta já existe, o serviço a reutiliza; password hash vazio é preenchido; a associação de livros usa `fileHash` para evitar duplicidade na conta.

Erros conhecidos: falha de banco ou de migration impede o comportamento; não foi encontrado tratamento alternativo no seeder.

Evidências:

- `backend/src/main/java/br/com/leitormobile/auth/DefaultAccountSeeder.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `backend/src/main/java/br/com/leitormobile/auth/AppUser.java`
- `backend/src/main/resources/db/migration/V2__add_single_account_auth.sql`
- `backend/src/main/resources/application.yml`

Unknowns:

- `[ASK USER]` Não é possível determinar pelo código se essa política de conta e migração de livros órfãos é intencional em ambientes não locais.

## CAP-003 — Consultar a biblioteca web

Status: `VERIFIED`

Superfície: `WEB + BACKEND`

Descrição observada: o web carrega livros autenticados, pesquisa por título/autor, mostra título, autor, capa quando disponível, progresso e estado do processamento lexical. O item pode ser aberto para leitura ou ter o menu de ações aberto.

Ator: usuário autenticado no web.

Entrada/gatilho: login concluído, entrada na seção “Biblioteca” ou alteração do campo “Buscar por título ou autor”.

Pré-condições: sessão Bearer válida; a lista pode estar vazia.

UI/rotas: seção `books` de `frontend/src/App.tsx`; `LibraryView` e `BookTile`.

APIs: `GET /api/books?search=...`; `GET /api/books/{id}/cover`.

Serviços: `BookService.list()`; `frontend/src/api.ts` (`listBooks`, `fetchBookCover`).

Persistência: backend tabela `books` e filesystem da capa; o web mantém a lista em estado React.

Integrações: API HTTP e URL de objeto do navegador para a capa.

Resultado observável: resultados filtrados aparecem na grade; a interface informa contagem, progresso e “Conteúdo pendente” quando o arquivo não está disponível.

Estados/caminhos alternativos: biblioteca vazia mostra orientação; pesquisa sem resultados mostra mensagem; falha ao carregar mostra banner de erro; capa ausente usa placeholder.

Erros conhecidos: `BookService` retorna livro não encontrado apenas em ações por ID; falhas HTTP são exibidas pelo web como mensagem de comunicação.

Evidências:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookDtos.java`
- `backend/src/main/java/br/com/leitormobile/book/BookRepository.java`

Unknowns:

- `[TODO]` Não foi demonstrado E2E do carregamento da grade ou da capa no navegador.

## CAP-004 — Consultar a biblioteca local mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: o mobile lista livros armazenados no aparelho em grade de duas colunas, pesquisa por título/autor, mostra capa/localização e progresso, oferece refresh e abre detalhes, leitura, reprocessamento ou exclusão.

Ator: usuário autenticado no aplicativo.

Entrada/gatilho: rota `/`; digitação no `Searchbar`; pull-to-refresh; toque ou menu do `BookCard`.

Pré-condições: banco SQLite inicializado; o usuário pode ter zero livros.

UI/rotas: `leitor-epub/app/index.tsx`; `BookCard`, `EmptyLibrary`, `MainMenu`.

APIs: nenhuma API é necessária para carregar a lista local.

Serviços: `listBooks(db, search)` e `removeBook` em `leitor-epub/src/db/repository.ts`.

Persistência: SQLite `books`; capas e EPUBs em `Paths.document`.

Integrações: filesystem privado do aplicativo.

Resultado observável: livros aparecem localmente mesmo sem chamada à API; pesquisa filtra a lista; estado vazio oferece “Importar”.

Estados/caminhos alternativos: sessão remota ausente remove o polling de jobs; lista vazia sem busca mostra `EmptyLibrary`; busca sem resultados mostra mensagem própria.

Erros conhecidos: falha de consulta SQLite aparece no Snackbar; falha de leitura da capa não impede a listagem, segundo o caminho de UI do `BookCard`.

Evidências:

- `leitor-epub/app/index.tsx`
- `leitor-epub/src/components/BookCard.tsx`
- `leitor-epub/src/components/EmptyLibrary.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/migrations.ts`

Unknowns:

- `[TODO]` Não foi demonstrado teste instrumentado da grade, filesystem real ou comportamento em aparelho.

## CAP-005 — Adicionar livro por upload web

Status: `PARTIALLY_VERIFIED`

Superfície: `WEB + BACKEND`

Descrição observada: o web permite selecionar um `.epub`, preencher título, autor e idioma, calcular SHA-256, criar o registro do livro e enviar o arquivo ao backend. Após o upload, inicia o job lexical. Se o upload falhar depois da criação, o web tenta excluir o registro criado.

Ator: usuário autenticado no web.

Entrada/gatilho: botão “Adicionar livro”, formulário e botão “Adicionar livro”.

Pré-condições: arquivo selecionado com extensão `.epub`; sessão válida; backend acessível; o hash enviado deve corresponder ao arquivo recebido, salvo hash `manual:`.

UI/rotas: `BookForm` em `frontend/src/App.tsx`; `frontend/src/bookUpload.ts`.

APIs: `POST /api/books`; `POST /api/books/{id}/content`; depois `POST /api/books/{id}/lexicon/jobs`.

Serviços: `BookService.create()`, `BookContentService.store()`, `LexiconService.start()`; `createBook`, `uploadBookContent`, `startBookLexicon` no web.

Persistência: `books`; `data/library/books/{id}.epub`; capa só é suportada pelo endpoint, não pelo formulário web atual.

Integrações: Web Crypto/SHA-256; filesystem backend.

Resultado observável: livro aparece na biblioteca e o frontend informa que o processamento lexical foi iniciado ou não iniciado.

Estados/caminhos alternativos: título vazio deriva do nome do arquivo; título, autor e idioma são normalizados no backend; criação duplicada por hash retorna conflito; falha posterior dispara tentativa de rollback do registro.

Erros conhecidos: extensão ausente/incorreta; hash divergente; EPUB maior que 100 MB; arquivo/capa não enviados; conflito de hash; falha de armazenamento. O backend não executa as validações de MIME/container/DRM/layout/recurso remoto que existem no importador mobile.

Evidências:

- `frontend/src/App.tsx`
- `frontend/src/bookUpload.ts`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `leitor-epub/src/services/epubImport.ts`
- `docs/codebase/CONCERNS.md`

Unknowns:

- `[ASK USER]` Não é possível saber se o conjunto de validações mobile é requisito obrigatório também para uploads web.
- `[TODO]` Não foi demonstrado fluxo web para envio de capa ou metadados editoriais além de título/autor/idioma.

## CAP-006 — Importar EPUB local com validação de segurança

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: o app abre Document Picker, lê o EPUB, calcula SHA-256, evita duplicata por hash, valida ZIP/CRC, limites de tamanho/entradas, caminhos, MIME `application/epub+zip`, container, OPF/spine, DRM, layout fixo e referências externas, extrai metadados/capa e copia os arquivos para armazenamento privado.

Ator: usuário mobile.

Entrada/gatilho: FAB “Importar”, botão do estado vazio ou importação após escolha de arquivo.

Pré-condições: arquivo escolhido; extensão `.epub`; tamanho máximo de 100 MB; o aparelho deve permitir acesso ao arquivo e escrita em `Paths.document`.

UI/rotas: `/` em `leitor-epub/app/index.tsx`; `EmptyLibrary`; `BookCard` e leitor após importação.

APIs: nenhuma API para a importação local.

Serviços: `importEpub`, `validateEpubArchive`, `deleteBookFiles`, `epubSecurity.ts`.

Persistência: SQLite `books`; `Paths.document/books/{id}.epub`; `Paths.document/covers/{id}.*`.

Integrações: Document Picker, Expo Crypto, JSZip e parser XML.

Resultado observável: livro e metadados aparecem na biblioteca; após importação não duplicada, a tela navega para `/reader/[id]`; duplicata retorna o livro existente sem copiar novamente.

Estados/caminhos alternativos: cancelamento do picker não altera dados; capa é copiada quando identificada; falha após cópia tenta remover arquivos parciais.

Erros conhecidos: arquivo ausente/inacessível; extensão incorreta; >100 MB; ZIP corrompido; CRC inválido; excesso de entradas ou expansão; caminho inseguro; MIME inválido; `container.xml`/OPF/spine ausente; DRM; layout fixo; recurso remoto.

Evidências:

- `leitor-epub/app/index.tsx`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/epubSecurity.ts`
- `leitor-epub/src/services/epubImport.test.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/migrations.ts`
- `leitor-epub/README.md`

Unknowns:

- `[TODO]` Não foi demonstrada matriz de EPUBs em aparelho Android real; o roteiro manual está em `leitor-epub/docs/QA-ANDROID.md`.

## CAP-007 — Remover livro e conteúdo armazenado

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: no web, o usuário confirma “Excluir livro”; o backend remove arquivos gerenciados e registro. No mobile, long press/menu chama confirmação, remove o registro SQLite e depois apaga EPUB/capa locais. O sync mobile não contém exclusão remota de livro.

Ator: usuário autenticado web ou mobile.

Entrada/gatilho: menu web “Excluir livro”; long press/menu mobile “Excluir livro”.

Pré-condições: livro existente; confirmação explícita; web requer sessão; mobile requer registro local.

UI/rotas: `BookTile` em `frontend/src/App.tsx`; `BookCard` e confirmação em `leitor-epub/app/index.tsx`.

APIs: web `DELETE /api/books/{id}`; mobile não chama API para apagar.

Serviços: `BookService.delete()`/`BookContentService.deleteStoredContent()`; `removeBook()`/`deleteBookFiles()`.

Persistência: web `books` e filesystem backend; mobile `books`, registros dependentes por cascade e filesystem privado.

Integrações: somente filesystem local da superfície.

Resultado observável: o livro deixa de aparecer na lista e os arquivos gerenciados são removidos conforme o caminho.

Estados/caminhos alternativos: cancelar confirmação não altera o livro; no mobile a limpeza de arquivos ocorre depois da remoção do registro.

Erros conhecidos: livro inexistente retorna 404 no backend; caminho armazenado fora do diretório permitido ou falha de remoção produz erro backend; falha no Snackbar mobile é tratada no fluxo assíncrono de remoção.

Evidências:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[ASK USER]` Não está definido se apagar localmente deve também solicitar/aplicar exclusão no backend em uma futura sincronização.

## CAP-008 — Ler EPUB no web

Status: `VERIFIED`

Superfície: `WEB + BACKEND`

Descrição observada: ao abrir um livro, o web baixa o arquivo binário do backend, inicializa um bundle local de epub.js/JSZip, renderiza em modo paginado, permite anterior/próxima, acompanha percentual e envia o CFI/progresso ao backend quando a rendition muda.

Ator: usuário autenticado no web.

Entrada/gatilho: clique no tile do livro ou tecla Enter/espaço no tile.

Pré-condições: livro com `fileAvailable`; sessão válida; renderer carregado.

UI/rotas: overlay `EpubReader` em `frontend/src/EpubReader.tsx`; não há rota web separada.

APIs: `GET /api/books/{id}/file`; `PATCH /api/books/{id}/progress`.

Serviços: `fetchBookFile`, `updateBookProgress`; bundle vendor `epubjsBundle`/`jszipBundle`.

Persistência: `books.file_uri`, `books.last_cfi`, `books.progress`, `books.last_opened_at` no backend.

Integrações: browser ArrayBuffer, epub.js e JSZip locais.

Resultado observável: o conteúdo do EPUB aparece no overlay; percentual se atualiza; fechar retorna à biblioteca.

Estados/caminhos alternativos: `display` usa o último CFI quando presente; falha de download/renderer mostra erro e botão “Voltar à biblioteca”; seleção vazia não abre toolbar.

Erros conhecidos: arquivo ausente/indisponível ou renderer não carregado; erros da atualização de progresso são ignorados no callback de relocation.

Evidências:

- `frontend/src/App.tsx`
- `frontend/src/EpubReader.tsx`
- `frontend/src/api.ts`
- `frontend/src/vendor/epubjsBundle.ts`
- `frontend/src/vendor/jszipBundle.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`

Unknowns:

- `[TODO]` Não foi demonstrado comportamento para EPUB inválido no caminho web além do erro de abertura; a validação estrutural forte está somente no importador mobile.

## CAP-009 — Ler EPUB local no mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: a rota lê o registro local, abre o EPUB privado com `@epubjs-react-native/core`, suporta fluxo paginado ou rolagem, swipe quando paginado, temas e conteúdo sem scripts/popups.

Ator: usuário mobile.

Entrada/gatilho: toque no livro da biblioteca ou navegação após importação.

Pré-condições: livro local existente, `fileUri` acessível e SQLite disponível.

UI/rotas: `/reader/[id]`; `EpubReaderSurface`; `useEpubFileSystem`.

APIs: nenhuma API para abrir o arquivo local; sync pode ter criado/atualizado dados antes.

Serviços: `EpubReaderSurface`, `useEpubFileSystem`, `getBook`, `getReaderPreferences`.

Persistência: SQLite `books`, `reader_preferences`, `annotations`, `bookmarks`; EPUB/capa no filesystem privado.

Integrações: epub.js React Native/WebView, filesystem legado adaptado, Expo ReaderProvider.

Resultado observável: conteúdo local aparece no leitor com barra superior/inferior que pode se ocultar automaticamente; voltar retorna à biblioteca.

Estados/caminhos alternativos: livro ausente mostra “Livro não encontrado”; chrome pode ser escondido por toque/tempo; `allowScriptedContent=false` e `allowPopups=false` ficam configurados.

Erros conhecidos: arquivo ausente ou falha do reader chama `onError` e mostra Snackbar; a tela de loading permanece até livro/preferências serem carregados.

Evidências:

- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/reader/useEpubFileSystem.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/app/_layout.tsx`
- `leitor-epub/app.json`

Unknowns:

- `[TODO]` Não foi demonstrado build/device Android nem leitura em todos os formatos aceitos pelo parser.

## CAP-010 — Persistir e restaurar posição de leitura

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: o web salva CFI e progresso quando a rendition muda; o mobile debounces mudanças por 500 ms e faz flush ao sair do estado ativo, fechar a rota ou desmontar. Ambos restauram a posição na próxima abertura.

Ator: usuário que navega no livro.

Entrada/gatilho: mudança de localização/página, slider mobile, saída do leitor ou mudança de estado do app.

Pré-condições: CFI/localização produzidos pelo engine; livro existente.

UI/rotas: `EpubReader` web; barra de progresso e slider em `/reader/[id]` mobile.

APIs: web `PATCH /api/books/{id}/progress`; mobile usa SQLite e, no sync, o mesmo PATCH remoto.

Serviços: `updateBookProgress`; `updateReadingPosition`, `flushPosition`, `mergeBookProgress`.

Persistência: `books.last_cfi`, `progress`, `last_opened_at` no backend e SQLite; mobile também mantém `locations_json`.

Integrações: epub.js/ReaderProvider e AppState mobile.

Resultado observável: percentual/posição reaparecem ao reabrir; sync escolhe posição por timestamp de abertura e pode propagar a posição vencedora.

Estados/caminhos alternativos: se não houver CFI, o mobile não persiste a mudança; slider fica desabilitado com menos de duas localizações; valores são normalizados/clamped.

Erros conhecidos: falhas de PATCH web são ignoradas no callback de relocation; erros SQLite do flush são tratados pelo caminho de mensagem do leitor.

Evidências:

- `frontend/src/EpubReader.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/resources/db/migration/V1__create_library_schema.sql`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/progress.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[ASK USER]` A política de conflito por `lastOpenedAt` é observada no código, mas não há requisito humano que confirme se é a regra de produto desejada.

## CAP-011 — Navegar e pesquisar dentro do livro mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: o leitor oferece anterior/próxima, slider de progresso, sumário (TOC), lista de bookmarks, lista de citações e aba de busca. Itens do TOC, bookmarks, citações e resultados de busca levam o reader ao CFI/href correspondente.

Ator: usuário mobile durante a leitura.

Entrada/gatilho: botões de navegação; botão “sumário e anotações”; botão “Pesquisar no livro”; aba “Busca”; seleção de um resultado/landmark.

Pré-condições: ReaderProvider carregado; TOC/localizações/resultados disponíveis conforme o EPUB e o engine.

UI/rotas: `NavigationDialog`, `EpubReaderSurface`, barra do leitor em `/reader/[id]`.

APIs: nenhuma API; search é executado pelo reader local.

Serviços: `NavigationDialog`; métodos `goTo`, `next`, `previous`, `search` do `ReaderEngine`.

Persistência: bookmarks e annotations são lidos do SQLite; TOC/resultados pertencem ao engine; `locations_json` é salvo.

Integrações: `@epubjs-react-native/core`.

Resultado observável: abas “Sumário”, “Marc.”, “Citações” e “Busca” apresentam itens e navegam o reader.

Estados/caminhos alternativos: sem itens mostra “Nenhum item salvo”; busca vazia orienta digitar; `searchResults` pode estar vazio; no fluxo de seleção “Pesquisar no livro” a aba de busca é aberta.

Erros conhecidos: nenhum erro específico de busca foi demonstrado; falhas genéricas do reader são encaminhadas a `onError`.

Evidências:

- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/NavigationDialog.tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/reader/progress.ts`
- `leitor-epub/src/db/repository.ts`

Unknowns:

- `[TODO]` Não foi demonstrada busca em device nem a cobertura de TOCs EPUB com estruturas incomuns.

## CAP-012 — Configurar a apresentação da leitura mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: o usuário pode escolher fluxo paginado/rolagem, tema claro/sépia/escuro, tamanho de fonte entre 70% e 180%, espaçamento entre linhas, margem, alinhamento esquerdo/justificado e fonte serifada/sem serifa. A alteração é aplicada ao reader e salva.

Ator: usuário mobile durante a leitura.

Entrada/gatilho: botão “Configurações de leitura”; controles do `ReaderSettingsDialog`.

Pré-condições: livro e preferências carregados.

UI/rotas: `ReaderSettingsDialog` e botão de fonte em `/reader/[id]`.

APIs: nenhuma API.

Serviços: `handlePreferencesChange`, `saveReaderPreferences`, `EpubReaderSurface.buildReaderTheme`.

Persistência: SQLite `reader_preferences`.

Integrações: ReaderProvider/WebView para aplicar CSS/theme.

Resultado observável: aparência e fluxo do conteúdo mudam; preferências reaparecem ao reabrir o livro.

Estados/caminhos alternativos: controles de fonte e sliders respeitam os limites codificados; troca de fluxo recria o Reader por `key`.

Erros conhecidos: falha de `saveReaderPreferences` produz mensagem “Não foi possível salvar as preferências.”

Evidências:

- `leitor-epub/src/components/reader/ReaderSettingsDialog.tsx`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/migrations.ts`

Unknowns:

- `[TODO]` Não foi demonstrado se todas as fontes/temas funcionam de forma idêntica nos diferentes engines nativos.

## CAP-013 — Salvar, editar e excluir citações/anotações mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: texto selecionado pode virar destaque/citação com cor e nota opcional de até 4.000 caracteres. Um destaque existente pode ser aberto, editado ou excluído; ele é renderizado no EPUB e aparece na aba “Citações”.

Ator: usuário mobile.

Entrada/gatilho: seleção de texto → “Citação”; toque em annotation; ações “Salvar”, “Excluir” ou “Cancelar”.

Pré-condições: seleção com CFI e texto; reader carregado; SQLite disponível.

UI/rotas: `QuoteDialog`, `NavigationDialog` aba “Citações”, callbacks em `/reader/[id]`.

APIs: nenhuma API de backend é chamada pelo fluxo.

Serviços: `insertAnnotation`, `updateAnnotation`, `deleteAnnotation`, `updateAnnotationSection`; métodos de annotation do `ReaderEngine`.

Persistência: SQLite `annotations`, com cascade por `book_id`; destaque é refletido no estado do reader.

Integrações: `@epubjs-react-native/core` para renderização do highlight.

Resultado observável: destaque colorido e nota podem ser vistos no livro e na lista de citações; mensagem “Citação salva.” é mostrada.

Estados/caminhos alternativos: edição reutiliza o registro; exclusão exige confirmação; cancelar fecha sem salvar.

Erros conhecidos: falha de persistência mostra mensagem de erro; não foi encontrado sync remoto de annotations.

Evidências:

- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/QuoteDialog.tsx`
- `leitor-epub/src/components/reader/NavigationDialog.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/migrations.ts`
- `leitor-epub/src/types/domain.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[ASK USER]` Não é possível saber se citações/notas são deliberadamente locais ou deveriam participar da sincronização.

## CAP-014 — Executar ações sobre texto selecionado

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: no web, seleção no leitor mostra toolbar com prévia, “Local dictionary” e “Criar card”. No mobile, o menu de seleção oferece Card, Dicionário, Traduzir, Citação e Mais; “Mais” oferece copiar, compartilhar, pesquisar no livro, pesquisar na web e abrir tradutor/dicionário externos.

Ator: usuário lendo um EPUB.

Entrada/gatilho: seleção de texto em iframe web ou long press/seleção no reader mobile.

Pré-condições: reader renderizado; texto e CFI selecionados; para ações remotas, sessão/API conforme a ação.

UI/rotas: `frontend/src/EpubReader.tsx`; `EpubReaderSurface`, `MoreActionsDialog` e `LookupDialog` mobile.

APIs: web usa `GET /api/books/{id}/lexicon/lookup` e `POST /api/cards`; mobile usa esses endpoints apenas em caminhos de sync/card web remoto, e usa APIs nativas/externas ou SQLite para as ações locais.

Serviços: `selectionPosition`, `handleSelectionAction`, `clearSelection`, `MoreActionsDialog`.

Persistência: dependendo da ação, `cards`, `annotations`, `lookup_cache` ou clipboard/Share do aparelho; web cria card em `cards` backend.

Integrações: clipboard, Share, Google Search/Translate, Wiktionary e ReaderProvider.

Resultado observável: a toolbar/menu executa a ação escolhida ou abre o diálogo/serviço correspondente.

Estados/caminhos alternativos: seleção vazia é ignorada; mobile limpa a seleção após a ação; consulta sem entrada é bloqueada; links externos passam por confirmação em caminhos do reader.

Erros conhecidos: mensagens de falha de card, consulta, clipboard/share ou reader são exibidas conforme cada fluxo; web não oferece as ações mobile de citação, cópia e compartilhamento.

Evidências:

- `frontend/src/EpubReader.tsx`
- `frontend/src/App.tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/components/reader/MoreActionsDialog.tsx`
- `leitor-epub/app/reader/[id].tsx`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`

Unknowns:

- `[TODO]` Não foi demonstrado E2E de seleção em navegador/WebView.

## CAP-015 — Traduzir texto selecionado no mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: “Traduzir” tenta tradução local via ML Kit com idioma de origem do livro e destino `pt`; o usuário pode editar idiomas, inverter idiomas, repetir, copiar, compartilhar e abrir a URL do tradutor externo. A ação direta também tenta abrir Google Translate quando selecionada.

Ator: usuário mobile.

Entrada/gatilho: seleção → “Traduzir” ou “Mais” → “Abrir tradutor externo”; ações do `LookupDialog`.

Pré-condições: texto não vazio; módulos nativos disponíveis para tradução local; URL externa disponível para fallback.

UI/rotas: `LookupDialog` com `kind='translation'` em `/reader/[id]`.

APIs: nenhuma API backend; o fallback usa URL Google Translate.

Serviços: `translateLocally`, `openGoogleTranslate`, `translateWebUrl`, `runLocalTranslation`.

Persistência: resultado não é salvo em tabela própria; somente ações de copiar/compartilhar saem do app.

Integrações: módulos Expo ML Kit e Google Translate/WebBrowser.

Resultado observável: diálogo mostra resultado, loading, erro e indicador “Resultado salvo no aparelho” somente quando o fluxo de cache aplicável retorna essa informação.

Estados/caminhos alternativos: o usuário pode alterar idioma de origem/destino e trocar os dois; falha local permite “Abrir externo”/“Tentar”.

Erros conhecidos: tradução local indisponível gera mensagem; abertura externa pode falhar e gerar mensagem de link.

Evidências:

- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/reader/LookupDialog.tsx`
- `leitor-epub/src/native/mlkit.ts`
- `leitor-epub/src/native/googleTranslate.ts`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/app.json`

Unknowns:

- `[TODO]` Não foi demonstrado download/instalação dos modelos ML Kit nem comportamento em Android/iOS reais.

## CAP-016 — Consultar léxico e definições

Status: `PARTIALLY_VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: o backend prepara entradas por livro e retorna lemma, POS, formas, definição, tradução PT-BR, IPA, CEFR, frequência, status e senses. O web consulta uma entrada do livro pelo modal de detalhes ou pela seleção do leitor. O mobile consulta primeiro o léxico preparado em SQLite; se não houver definição/tradução, faz fallback à API Wiktionary e grava cache de 30 dias.

Ator: usuário lendo ou conferindo detalhes do processamento.

Entrada/gatilho: web botão “Consultar” no modal ou “Local dictionary” na seleção; mobile seleção → “Dicionário” ou campo de consulta em detalhes.

Pré-condições: livro existente; para o lookup backend, sessão e livro proprietário; para lookup preparado mobile, entrada sincronizada; para Wiktionary, rede.

UI/rotas: web `BookProcessingDetailsModal` e `EpubReader`; mobile `BookProcessingDetailsDialog` e `LookupDialog`.

APIs: backend `GET /api/books/{bookId}/lexicon/lookup?term=...`; `GET /api/books/{bookId}/lexicon` é consumido pelo sync mobile, não pelo lookup interativo mobile.

Serviços: `LexiconService.lookup/list`, `lookupPreparedLexicon`, `cacheRemoteLexicon`, `lookupDictionary`, `sanitizeDefinition`.

Persistência: backend `book_lexemes`, `lexemes`, `word_forms`, `dictionary_entries`, `lexical_senses`; mobile `lexicon_entries` e `lookup_cache`.

Integrações: Wiktionary API no fallback mobile; dicionário local/Kaikki/Ollama no backend.

Resultado observável: definição/tradução e metadados são exibidos; status “RESOLVED_LOCAL”/“UNRESOLVED” pode aparecer; mobile identifica resultados cacheados.

Estados/caminhos alternativos: termo vazio retorna vazio/não executa; lookup sem entrada mostra “Nenhum resultado”; mobile usa Wiktionary se o preparado não possuir conteúdo suficiente.

Erros conhecidos: livro inexistente 404 no backend; Wiktionary indisponível; nenhuma definição encontrada; rede ou API inválida; resultado local sem definição/tradução.

Evidências:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconDtos.java`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `frontend/src/BookProcessingDetailsModal.tsx`
- `frontend/src/EpubReader.tsx`
- `frontend/src/api.ts`
- `leitor-epub/src/services/lexicon.ts`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/src/db/migrations.ts`
- `leitor-epub/app/reader/[id].tsx`

Unknowns:

- `[ASK USER]` Não foi definido se o catálogo local deve ser considerado fonte suficiente quando não houver definição para uma seleção.
- `[TODO]` Não há evidência de lookup Wiktionary no web.

## CAP-017 — Criar card de estudo a partir de texto

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: o web cria card com livro, CFI, texto selecionado, capítulo e campos lexicais obtidos do lookup; o mobile cria card local com UUID, CFI, texto, capítulo e campos lexicais preparados. O mobile pode enviar esse card ao backend durante sync.

Ator: usuário lendo um livro.

Entrada/gatilho: web “Criar card”; mobile seleção → “Card”.

Pré-condições: seleção com texto/CFI; livro existente; web precisa de API autenticada; mobile precisa de SQLite.

UI/rotas: `EpubReader` web; `EpubReaderSurface`/`handleSelectionAction` mobile.

APIs: web `POST /api/cards`; mobile usa `POST /api/cards` durante sincronização, não no gesto local.

Serviços: `CardService.create`, `createCard`; mobile `saveCard`, `appendCard`, `cardFieldsFromLexicon`.

Persistência: backend `cards`; mobile SQLite `cards`; CFI e `book_id` vinculam o card ao livro.

Integrações: léxico preparado local/backend; Crypto UUID mobile.

Resultado observável: card aparece na fila da superfície correspondente; web informa se dados do dicionário foram usados; mobile mostra Snackbar equivalente.

Estados/caminhos alternativos: sem tradução/definição o card ainda é criado com campos vazios; mobile consulta léxico preparado antes de preencher; web pode criar com lookup nulo.

Erros conhecidos: seleção ausente ou ação em progresso não cria; validação backend exige `bookId`, `cfiRange` e `selectedText`; falha SQLite/API produz mensagem.

Evidências:

- `frontend/src/EpubReader.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/CardDtos.java`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/services/lexicon.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[TODO]` O vínculo lexical de cards criado pelo mobile/web não preenche as colunas lexicais adicionais do schema backend no caminho observado.

## CAP-018 — Revisar e manter a fila de cards

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: a fila mostra o próximo card, permite virar frente/verso, ver tradução/definição/contexto/exemplos/relacionadas, editar campos, arquivar e mover para o fim para rever depois. O web usa botões; o mobile usa botões e swipe esquerda/direita.

Ator: usuário autenticado web ou usuário mobile.

Entrada/gatilho: seção “Cards” web; rota `/cards` mobile; toque/flip, “Editar”, “Arquivar”, “Rever depois” ou gesto de swipe.

Pré-condições: cards ativos carregados; fila vazia é possível.

UI/rotas: `CardsView`, `CardEditor` em `frontend/src/App.tsx`; `CardsScreen`, `LearningCard`, `CardEditorDialog` mobile.

APIs: `GET /api/cards`; `PATCH /api/cards/{id}`; `POST /api/cards/{id}/archive`; `POST /api/cards/{id}/move-to-end`; `POST /api/cards/{id}/unarchive` é usado no sync mobile.

Serviços: `CardService`; repository mobile `listCards`, `updateCard`, `archiveCard`, `moveCardToEnd`.

Persistência: backend e SQLite `cards`; `queue_order`, `archived`, timestamps e JSON de exemplos/relacionadas.

Integrações: Animated/PanResponder mobile.

Resultado observável: card arquivado sai da fila ativa; “rever depois” move o card ao final; edição atualiza os campos; fila vazia informa que é preciso selecionar texto.

Estados/caminhos alternativos: frente usa `selectedText`; verso usa tradução ou placeholder; campos opcionais só aparecem quando preenchidos; cards arquivados entram na lista remota quando `includeArchived=true`.

Erros conhecidos: livro/card inexistente retorna 404 backend; campos obrigatórios inválidos são rejeitados; erros locais/remotos aparecem em banner/Snackbar.

Evidências:

- `frontend/src/App.tsx`
- `frontend/src/api.ts`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/resources/db/migration/V1__create_library_schema.sql`
- `leitor-epub/app/cards.tsx`
- `leitor-epub/src/components/CardEditorDialog.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[TODO]` Não foi encontrado UI web ou mobile dedicada para restaurar manualmente um card arquivado; o desarquivamento aparece no caminho de sync.

## CAP-019 — Preparar e acompanhar o léxico de um livro

Status: `VERIFIED`

Superfície: `WEB + MOBILE + BACKEND`

Descrição observada: o upload web inicia automaticamente o job; web e mobile exibem status/fase/progresso, permitem reprocessar e consultam o resultado lexical. O backend extrai texto do EPUB armazenado, analisa unidades/sentenças/tokens, cria lexemes/forms/ocorrências por livro, resolve o dicionário local e tenta enriquecer pendências.

Ator: usuário web/mobile ao adicionar ou reprocessar um livro; runner assíncrono do backend.

Entrada/gatilho: upload web; botão “Reprocessar léxico” web/mobile; seleção web sem entrada pode chamar start não-forçado; polling de status.

Pré-condições: livro proprietário; backend com arquivo EPUB armazenado para processamento; para mobile, sessão remota e mapeamento do livro.

UI/rotas: `BookTile`, `BookProcessingDetailsModal` web; `BookCard`, `BookProcessingDetailsDialog` mobile; biblioteca e leitor web.

APIs: `POST /api/books/{bookId}/lexicon/jobs[?force=true]`; `GET /api/books/{bookId}/lexicon/jobs/latest`; `GET /api/books/{bookId}/lexicon`; `GET /api/books/{bookId}/lexicon/lookup`.

Serviços: `LexiconService`; `LexiconJobRunnerOptimized`; `EpubTextExtractor`; `LexicalAnalyzer`; `LexiconJobRecovery`; `LexiconJobProgressWriter`.

Persistência: `lexicon_jobs`, `reading_units`, `sentences`, `lexemes`, `word_forms`, `book_lexemes`, `token_occurrences`, `dictionary_entries`, `lexical_senses`, `book_senses` e auditoria AI.

Integrações: filesystem EPUB, PostgreSQL/JPA, dicionário local/Kaikki e Ollama quando habilitado.

Resultado observável: status `QUEUED`, `RUNNING`, `COMPLETED` ou `FAILED`, fases de extração/análise/enriquecimento, contadores, mensagem/erro e entradas lexicais.

Estados/caminhos alternativos: sem `force`, job concluído recente é reutilizado; job ativo é devolvido; `force` cria novo job; no boot jobs queued/running são marcados por recovery; falha de Ollama não impede a preparação local.

Erros conhecidos: EPUB ausente, arquivo inválido/ilegível, XML interno inválido, limite de documento, falha de banco e falhas de provider produzem status/log de falha conforme a etapa.

Evidências:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunner.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/EpubTextExtractor.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexicalAnalyzer.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRecovery.java`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `backend/src/main/resources/db/migration/V4__add_lexicon_job_observability.sql`
- `frontend/src/App.tsx`
- `frontend/src/BookProcessingDetailsModal.tsx`
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/components/BookProcessingDetailsDialog.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- `[TODO]` Não foi demonstrado comportamento sob concorrência, reinício durante processamento ou carga de livros grandes em produção.
- `[ASK USER]` A fila/job no mesmo processo e o reprocessamento destrutivo são compatíveis com a operação desejada?

## CAP-020 — Enriquecer candidatos lexicais com Ollama local

Status: `VERIFIED`

Superfície: `BACKEND`

Descrição observada: quando AI está habilitada, provider é `ollama` e há candidatos não resolvidos, o backend envia batches de até 20 contendo lemma, POS e frequência ao endpoint local `/api/chat`. A resposta JSON fornece definição, tradução PT-BR, IPA, CEFR, sense key e confiança; o resultado é aplicado ao dicionário/senses e auditado.

Ator: job lexical do backend.

Entrada/gatilho: etapa de enrichment no `LexiconJobRunnerOptimized`.

Pré-condições: `app.ai.enabled=true`, provider `ollama`, URL/modelo configurados, candidatos não resolvidos; a configuração atual ativa profile `ollama` por padrão.

UI/rotas: não há tela específica de configuração/execução AI; o progresso aparece na UI de processamento lexical.

APIs: integração externa `POST {ollama.base-url}/api/chat`; não há endpoint público separado de AI.

Serviços: `AiEnrichmentService`, `ai.OllamaAiProvider`, `ExternalAiContextPolicy`, `CopyrightPrivacyGate`, `AiRequestAudit`.

Persistência: `dictionary_entries`, `lexical_senses`, `book_lexemes`, `ai_request_audit`.

Integrações: Ollama em `127.0.0.1:11434` por padrão; prompt e schema JSON são construídos pelo backend.

Resultado observável: entradas antes `UNRESOLVED` podem tornar-se `RESOLVED_LOCAL`; auditoria registra provider/model/task/status/hash/tokens e `usedCopyrightedExcerpt=false`.

Estados/caminhos alternativos: sem AI/provider/candidatos, enrichment não executa; timeout/resposta vazia/JSON inválido gera auditoria `ERROR` e o job lexical local continua.

Erros conhecidos: Ollama indisponível, base URL/modelo vazios, timeout de conexão/leitura, resposta vazia ou JSON inválido.

Evidências:

- `backend/src/main/java/br/com/leitormobile/lexicon/AiEnrichmentService.java`
- `backend/src/main/java/br/com/leitormobile/ai/OllamaAiProvider.java`
- `backend/src/main/java/br/com/leitormobile/ai/AiProperties.java`
- `backend/src/main/java/br/com/leitormobile/ai/CopyrightPrivacyGate.java`
- `backend/src/main/java/br/com/leitormobile/ai/ExternalAiContextPolicy.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-ollama.yml`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `docs/codebase/INTEGRATIONS.md`
- `OLLAMA-LOCAL.md`

Unknowns:

- `[ASK USER]` A ativação default do profile Ollama é intencional ou deve ser opt-in?
- `[TODO]` Não foi encontrado caller atual do `ExternalAiContextGateway` para chamadas que carreguem contexto de livro.

## CAP-021 — Importar catálogo lexical Kaikki/Wiktionary

Status: `VERIFIED`

Superfície: `BACKEND`

Descrição observada: o backend consegue importar snapshot JSONL/JSONL.GZ inglês do Kaikki em chunks transacionais, filtrando idioma, normalizando POS, forms e senses e persistindo traduções PT, pronúncias, exemplos, relações, hash, licença, progresso e erros. A importação pode ser acionada pelo script PowerShell com propriedades de startup ou pelo `DictionaryImportStartup` quando configurado.

Ator: operador/processo de inicialização do backend.

Entrada/gatilho: `backend/scripts/import-kaikki.ps1` ou `app.dictionary.import-on-startup=true` com `app.dictionary.import-file`.

Pré-condições: arquivo local existente; PostgreSQL/migrations; parâmetros de chunk/erro válidos.

UI/rotas: nenhuma UI ou controller público encontrado.

APIs: nenhuma API pública; o script inicia `mvn spring-boot:run` com argumentos.

Serviços: `KaikkiDictionaryImporter`, `DictionaryImportStartup`, `DictionaryProperties`.

Persistência: `dictionary_sources`, `dictionary_import_batches`, `lexemes`, `word_forms`, `dictionary_entries`, `lexical_senses`, `dictionary_translations`, `dictionary_pronunciations`, `lexical_examples`, `lexical_relations`.

Integrações: snapshot Kaikki/Wiktionary e URLs de homepage/licença registradas no banco.

Resultado observável: batch fica `RUNNING`, `PARTIAL`, `COMPLETED` ou falho conforme a execução; contadores e hash ficam registrados.

Estados/caminhos alternativos: batch concluído com mesmo hash é pulado; `max-records` gera `PARTIAL`; registros inválidos incrementam erro até `max-errors`; `.gz` é descompactado em streaming.

Erros conhecidos: arquivo inexistente; erro de parse/registro; limite de erros excedido; propriedade de importação sem arquivo; falha de banco.

Evidências:

- `backend/scripts/import-kaikki.ps1`
- `backend/src/main/java/br/com/leitormobile/lexicon/KaikkiDictionaryImporter.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/DictionaryImportStartup.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/DictionaryProperties.java`
- `backend/src/main/resources/db/migration/V5__create_dictionary_catalog.sql`
- `backend/src/main/resources/db/migration/V6__optimize_lexical_lookup.sql`
- `backend/README-KAIKKI.md`

Unknowns:

- `[ASK USER]` Não é possível determinar se a importação ocorre somente em manutenção/desenvolvimento ou como parte do boot de produção.
- `[TODO]` Não foi localizado no YAML padrão um bloco `app.dictionary.*` que habilite a importação.

## CAP-022 — Sincronizar biblioteca mobile com o backend

Status: `UNKNOWN_INTENT`

Superfície: `MOBILE + BACKEND`

Descrição observada: após login, o mobile sincroniza livros locais por `fileHash`, cria livros remotos ausentes, envia EPUB/capa ausentes, faz merge de progresso por timestamps, inicia job lexical remoto, baixa entradas lexicais e reconcilia cards por ID ou identidade. A API fornece os endpoints usados por esse fluxo.

Ator: usuário mobile autenticado; backend remoto.

Entrada/gatilho: login mobile (tentativa inicial), menu “Sincronizar agora”, reprocessamento que precisa de mapeamento remoto.

Pré-condições: sessão com token/URL; rede; arquivos locais necessários para upload; backend e PostgreSQL operacionais.

UI/rotas: `/login`, `/` e `MainMenu`; não há botão de sync no web.

APIs: `GET/POST /api/books`; `POST /api/books/{id}/content`; `PATCH /api/books/{id}/progress`; `POST/GET /api/books/{id}/lexicon/jobs`; `GET /api/books/{id}/lexicon`; `GET/POST/PATCH /api/cards`; `POST /api/cards/{id}/archive`; `/unarchive`; `/move-to-end`.

Serviços: `syncLibrary`, `mergeBookProgress`, `uploadBookContent`, `pushLocalCardWithBook`, `login`, `logout`.

Persistência: mobile `sync_session`, `sync_entity_map`, `books`, `cards`, `lexicon_entries`; backend livros/cards/lexicon.

Integrações: fetch HTTP Bearer, filesystem mobile e API backend.

Resultado observável: Snackbar informa quantidade sincronizada de livros/cards; dados remotos e locais são atualizados conforme regras de merge.

Estados/caminhos alternativos: login continua válido quando sync inicial falha; livro local sem remoto é criado; remote vence posição/card quando timestamp é mais recente; livro remoto sem correspondente local não é baixado/criado localmente; annotations, bookmarks e preferências não são enviados.

Erros conhecidos: sem sessão retorna 401 local; arquivo EPUB/capa ausente impede upload; API pode devolver erro HTTP; falhas de lexicon durante pull são absorvidas para a próxima sincronização; ausência de remote book impede reprocessamento.

Evidências:

- `leitor-epub/src/services/sync.ts`
- `leitor-epub/app/login.tsx`
- `leitor-epub/app/index.tsx`
- `leitor-epub/src/components/MainMenu.tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/db/migrations.ts`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `ACCOUNT-SYNC.md`
- `docs/codebase/CONCERNS.md`

Unknowns:

- `[ASK USER]` O escopo parcial observado é a sincronização correta do produto ou faltam annotations, bookmarks, preferências, downloads remotos e exclusões?
- `[ASK USER]` Qual é a fonte autoritativa de dados durante conflitos entre backend e armazenamento local?

## CAP-023 — Criar e restaurar backup completo mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: o app exporta snapshot local e EPUBs/capas para ZIP, grava manifest com SHA-256, compartilha o arquivo pelo sistema e permite selecionar ZIP, validar estrutura/tamanho/checksums/schema/referências e confirmar substituição da biblioteca antes de restaurar.

Ator: usuário mobile.

Entrada/gatilho: menu “Backup e restauração”; botões “Criar e compartilhar” e “Selecionar backup”; confirmação “Restaurar”.

Pré-condições: banco e arquivos locais acessíveis; para exportar, Sharing disponível; para restaurar, ZIP dentro dos limites e íntegro.

UI/rotas: `/backup`; `BackupScreen`.

APIs: nenhuma API remota.

Serviços: `createAndShareBackup`, `pickAndValidateBackup`, `restoreValidatedBackup`, `exportSnapshot`, `replaceSnapshot`.

Persistência: SQLite snapshot de books/annotations/bookmarks/cards/preferences/lookup cache/lexicon; EPUB/capas em ZIP e depois filesystem privado.

Integrações: Document Picker, JSZip, Expo Crypto, Expo Sharing e Zod.

Resultado observável: arquivo ZIP é compartilhado; após confirmação a biblioteca local é substituída e a tela informa a quantidade restaurada.

Estados/caminhos alternativos: cancelamento do picker/confirmação não altera a biblioteca; validação ocorre antes da confirmação; arquivos antigos são limpos após o novo snapshot ser aplicado, com cleanup best-effort.

Erros conhecidos: backup >700 MB; expansão >1,5 GB; excesso de entradas; ZIP corrompido; manifest/library ausentes; checksum incorreto; schema/referência inválida; arquivo de livro/capa ausente; Sharing indisponível.

Evidências:

- `leitor-epub/app/backup.tsx`
- `leitor-epub/src/services/backup.ts`
- `leitor-epub/src/services/backupValidation.ts`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/types/domain.ts`
- `leitor-epub/docs/PRIVACIDADE.md`

Unknowns:

- `[ASK USER]` O backup não criptografado é aceitável para os dados e tokens atualmente incluídos no snapshot?
- `[TODO]` Não há backup web implementado; o botão web está desabilitado.

## CAP-024 — Abrir links externos referenciados no EPUB mobile

Status: `VERIFIED`

Superfície: `MOBILE`

Descrição observada: quando o EPUB solicita link externo, o reader aceita somente esquemas `http`, `https`, `mailto` ou `tel`, pede confirmação e abre WebBrowser/Linking conforme o esquema. Esquemas diferentes são rejeitados.

Ator: usuário mobile durante a leitura.

Entrada/gatilho: toque em link externo no conteúdo do EPUB.

Pré-condições: URL recebida pelo engine; confirmação do usuário para abrir.

UI/rotas: `ReaderExperience.handleExternalLink`; reader local.

APIs: nenhuma API backend.

Serviços: `handleExternalLink`, `WebBrowser.openBrowserAsync`, `Linking.openURL`.

Persistência: nenhuma.

Integrações: WebBrowser/Linking do sistema.

Resultado observável: diálogo “Abrir link externo?” e abertura após “Abrir”; esquema não permitido gera mensagem.

Estados/caminhos alternativos: cancelar não abre; `http/https` usa browser embutido, `mailto/tel` usa Linking; falha de abertura gera Snackbar.

Erros conhecidos: esquema não permitido; falha ao abrir o destino externo.

Evidências:

- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/services/epubSecurity.ts`
- `leitor-epub/src/components/reader/MoreActionsDialog.tsx`

Unknowns:

- `[TODO]` Não foi demonstrado teste de links em WebView/device; a validação encontrada é por esquema e não por reputação do domínio.

## CAP-025 — Expor health check operacional do backend

Status: `VERIFIED`

Superfície: `BACKEND`

Descrição observada: o Actuator expõe `GET /actuator/health` sem autenticação; a configuração também restringe os endpoints Actuator expostos a `health` e `info`.

Ator: monitor, operador ou processo de infraestrutura; nenhum consumidor de repositório foi identificado.

Entrada/gatilho: requisição HTTP ao endpoint.

Pré-condições: backend em execução.

UI/rotas: nenhuma UI do produto encontrada.

APIs: `GET /actuator/health`.

Serviços: Spring Boot Actuator/configuração `management.endpoints.web.exposure`.

Persistência: não altera dados.

Integrações: estado de componentes monitorados pelo Actuator, conforme configuração efetiva.

Resultado observável: resposta de health do Actuator.

Estados/caminhos alternativos: endpoint é permit-all; demais endpoints não expostos pela configuração encontrada.

Erros conhecidos: backend indisponível ou componente de health com falha; não foi observado contrato de resposta em execução nesta etapa.

Evidências:

- `backend/src/main/resources/application.yml`
- `backend/pom.xml`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `docs/codebase/INTEGRATIONS.md`
- `docs/codebase/TESTING.md`

Unknowns:

- `[TODO]` Não foi encontrado consumidor de health no repositório, deployment, dashboard ou contrato de readiness.

## Inventário de endpoints e relação com capabilities

Esta seção evita transformar endpoints em capabilities adicionais. Os paths abaixo foram reconciliados com os 25 itens anteriores.

| Path | Consumidor encontrado | Capability(s) |
|---|---|---|
| `POST /api/auth/login` | web `api.ts`; mobile `sync.ts` | CAP-001 |
| `GET /api/auth/me` | web `api.ts` | CAP-001 |
| `GET /api/books` | web `api.ts`; mobile `sync.ts` | CAP-003, CAP-022 |
| `POST /api/books` | web `api.ts`; mobile `sync.ts` | CAP-005, CAP-022 |
| `POST /api/books/{id}/content` | web `api.ts`; mobile `sync.ts` | CAP-005, CAP-022 |
| `GET /api/books/{id}/file` | web `api.ts`/`EpubReader` | CAP-008 |
| `GET /api/books/{id}/cover` | web `api.ts`/`BookTile` | CAP-003 |
| `PATCH /api/books/{id}/progress` | web `api.ts`; mobile `sync.ts` | CAP-010, CAP-022 |
| `DELETE /api/books/{id}` | web `api.ts` | CAP-007 |
| `GET /api/cards` | web `api.ts`; mobile `sync.ts` | CAP-018, CAP-022 |
| `POST /api/cards` | web `EpubReader`/`api.ts`; mobile `sync.ts` | CAP-017, CAP-022 |
| `PATCH /api/cards/{id}` | web `api.ts`; mobile `sync.ts` | CAP-018, CAP-022 |
| `POST /api/cards/{id}/archive` | web `api.ts`; mobile `sync.ts` | CAP-018, CAP-022 |
| `POST /api/cards/{id}/unarchive` | mobile `sync.ts` | CAP-018, CAP-022 |
| `POST /api/cards/{id}/move-to-end` | web `api.ts`; mobile `sync.ts` | CAP-018, CAP-022 |
| `POST /api/books/{bookId}/lexicon/jobs` | web `api.ts`; mobile `sync.ts`/`index.tsx` | CAP-019, CAP-022 |
| `GET /api/books/{bookId}/lexicon/jobs/latest` | web `api.ts`; mobile `sync.ts`/`index.tsx` | CAP-019 |
| `GET /api/books/{bookId}/lexicon` | mobile `sync.ts` | CAP-016, CAP-022 |
| `GET /api/books/{bookId}/lexicon/lookup` | web `api.ts`/`EpubReader`/details modal | CAP-014, CAP-016 |
| `GET /actuator/health` | consumidor interno não identificado | CAP-025 |

## Achados que não viraram capability

### Ações de UI sem implementação completa ou sem backend correspondente

- Web: “Backup” aparece no menu lateral como botão `disabled` com texto “Em breve”; não há serviço/API web correspondente. Foi registrado como unknown/partial em CAP-023, não como capability web.
- Web: a seleção oferece apenas lookup lexical e criação de card; as ações mobile de citação, nota, copiar, compartilhar, tradução local e dicionário Wiktionary não aparecem no web.
- Mobile: importar, ler, citar, bookmark, preferências e backup funcionam localmente sem endpoint backend; não devem ser classificados como capabilities web/backend.

### Endpoints sem capability ou consumidor identificado

- Não foi encontrado endpoint de domínio dos controllers sem associação a uma capability ou consumidor listado acima.
- `GET /actuator/health` possui capability operacional CAP-025, mas não há consumidor específico no repositório; deployment/monitor externo é desconhecido.

### Classes/estruturas que não foram promovidas isoladamente

- `ExternalAiContextGateway`, `ExternalAiExposurePolicy` e `ExternalAiExposureMetrics` foram tratados como implementação/política de CAP-020, não como capability independente, pois nenhum caller de contexto protegido foi encontrado.
- `BookSense`, colunas lexicais adicionais de `cards`, tabelas backend de annotations/bookmarks/preferences e a arquitetura copyright-aware foram registrados como dados/gaps, não como funcionalidades ativas separadas quando não havia fluxo completo demonstrado.

## Reconciliação independente

### Segunda passagem realizada

- Rotas/telas web: `LoginView`, `App`, `LibraryView`, `BookForm`, `CardsView`, `CardEditor`, `BookProcessingDetailsModal` e `EpubReader` foram percorridos novamente.
- Rotas/telas mobile: `_layout`, `/login`, `/`, `/cards`, `/reader/[id]`, `/backup`, `MainMenu`, `BookCard`, diálogos de processamento/card/reader, `EpubReaderSurface` e filesystem foram percorridos novamente.
- Controllers backend: `AuthController`, `BookController`, `CardController` e `LexiconController`, além do Actuator configurado, foram conferidos contra a tabela de endpoints.
- Services/repositorios: autenticação, livros/conteúdo, cards, lexicon, sync, importação EPUB, lookup, backup e repositories SQLite foram conferidos contra as capabilities.
- Background/operacional: `LexiconJobRunnerOptimized`, `LexiconJobRecovery`, `AiEnrichmentService`, `DictionaryImportStartup` e `import-kaikki.ps1` foram conferidos.
- Migrations: V1–V6 backend e schema SQLite versão 6 foram comparados com a seção de persistência.
- Testes: a baseline `docs/codebase/TESTING.md` e os arquivos de teste encontrados foram usados para identificar comportamentos exercitados e gaps; nenhum teste novo foi criado.

### Totais

- Total: **25 capabilities**.
- `VERIFIED`: **22**.
- `PARTIALLY_VERIFIED`: **2** — CAP-005, CAP-016.
- `UNKNOWN_INTENT`: **1** — CAP-022.

| Superfície | Capabilities |
|---|---|
| `BACKEND` | CAP-002, CAP-020, CAP-021, CAP-025 |
| `WEB + BACKEND` | CAP-003, CAP-005, CAP-008 |
| `MOBILE` | CAP-004, CAP-006, CAP-009, CAP-011, CAP-012, CAP-013, CAP-015, CAP-023, CAP-024 |
| `MOBILE + BACKEND` | CAP-022 |
| `WEB + MOBILE + BACKEND` | CAP-001, CAP-007, CAP-010, CAP-014, CAP-016, CAP-017, CAP-018, CAP-019 |

### Diferenças funcionais relevantes web/mobile

| Área | Web | Mobile |
|---|---|---|
| Origem do livro | upload remoto | importação local validada |
| Validação EPUB | extensão no cliente, tamanho/hash no backend | ZIP/CRC, limites, paths, MIME, DRM, layout e recursos remotos |
| Conteúdo | download da API para o browser | arquivo privado local |
| Leitor | paginado, anterior/próxima, progresso, lookup, card | paginado/rolagem, temas, fontes, TOC, busca, bookmarks, citações, notas, tradução, dicionário e links |
| Cards | backend, botões de revisão | SQLite, botões e swipe; backend somente via sync |
| Léxico | consulta API | consulta cache local, com Wiktionary fallback |
| Backup | ação visível desabilitada | ZIP completo implementado |
| Sync | atua como consumidor inexistente; não há fluxo web | login, sync inicial e “Sincronizar agora” |
| Dados locais de leitura | sem UI/fluxo web para annotations/bookmarks/preferences | persistidos localmente; não enviados pelo sync observado |

### Perguntas `[ASK USER]`

1. `[ASK USER]` Qual é a fonte autoritativa de dados durante conflitos entre backend e armazenamento local?
2. `[ASK USER]` O escopo atual de sync é deliberadamente books/progresso/conteúdo/léxico/cards, ou faltam annotations, bookmarks, preferências, downloads remotos e exclusões?
3. `[ASK USER]` O profile Ollama deve permanecer ativo por padrão ou ser explicitamente opt-in?
4. `[ASK USER]` A validação EPUB forte do mobile também é requisito do upload web/backend?
5. `[ASK USER]` O backup mobile sem criptografia e o armazenamento do token em SQLite são aceitáveis?
6. `[ASK USER]` Citações, bookmarks e preferências devem continuar somente locais?
7. `[ASK USER]` O importador Kaikki e o seed de conta são operações de desenvolvimento, instalação ou produção?

## Evidências gerais

- `docs/codebase/ARCHITECTURE.md` (baseline técnica de arquitetura)
- `docs/codebase/STACK.md`
- `docs/codebase/STRUCTURE.md`
- `docs/codebase/INTEGRATIONS.md`
- `docs/codebase/TESTING.md`
- `docs/codebase/CONCERNS.md`
- `backend/src/main/java/br/com/leitormobile/`
- `backend/src/main/resources/db/migration/`
- `frontend/src/`
- `leitor-epub/app/`
- `leitor-epub/src/`
