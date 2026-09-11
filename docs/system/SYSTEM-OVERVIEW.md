# System Overview

## Escopo e critério de evidência

Este documento descreve o comportamento encontrado no repositório em 11/09/2026. A baseline técnica em `docs/codebase/` foi usada como índice; rotas, telas, controllers, services, jobs, migrations e testes foram percorridos novamente. README e documentos de intenção são citados apenas como intenção declarada quando divergem da implementação.

`VERIFIED` neste documento significa que existe um caminho observável no código, na UI ou no processo operacional correspondente. Não significa que todos os caminhos foram validados em device, E2E ou produção.

## Objetivo observável

O sistema permite a uma pessoa autenticada manter uma biblioteca de livros EPUB, abrir e ler os livros na web ou no aplicativo mobile, registrar posição de leitura, consultar léxico e transformar texto selecionado em cards de estudo. O mobile mantém arquivos e dados de leitura localmente e possui sincronização opcional com o backend; o web usa o backend para livros, conteúdo, progresso, cards e processamento lexical.

Esse objetivo é uma descrição do comportamento implementado, não uma interpretação de negócio. As evidências principais são `frontend/src/App.tsx`, `frontend/src/EpubReader.tsx`, `leitor-epub/app/index.tsx`, `leitor-epub/app/reader/[id].tsx`, `leitor-epub/src/services/sync.ts`, `backend/src/main/java/br/com/leitormobile/book/BookController.java`, `CardController.java` e `LexiconController.java`.

## Principais superfícies

### Backend

É uma API Spring Boot em Java 21 com autenticação stateless Bearer, PostgreSQL/JPA/Flyway e armazenamento de arquivos em `./data/library` por padrão. Os controllers encontrados são:

- `/api/auth`: login e identificação da sessão atual;
- `/api/books`: biblioteca, criação de registros, upload/retorno de EPUB e capa, progresso e exclusão;
- `/api/cards`: fila, criação, edição, arquivamento, desarquivamento e reordenação;
- `/api/books/{bookId}/lexicon`: jobs, status, listagem e lookup lexical;
- `/actuator/health`: health check exposto pela configuração do Actuator.

O backend também processa EPUBs armazenados para criar unidades, sentenças, tokens, lexemes, word forms e vínculos por livro. O processo pode enriquecer candidatos não resolvidos com Ollama local quando a configuração de IA está habilitada.

### Web

É uma aplicação React/TypeScript/Vite com três estados de tela observáveis: login, biblioteca e revisão de cards; o leitor EPUB é aberto como overlay a partir da biblioteca. A biblioteca pode pesquisar, adicionar, abrir, excluir e reprocessar livros. O leitor web baixa o EPUB do backend, usa um bundle local de epub.js/JSZip, acompanha progresso e oferece seleção para consultar o léxico ou criar card.

O botão “Backup” aparece desabilitado com o texto “Em breve”; não foi encontrada implementação web correspondente.

### Mobile

É um aplicativo Expo Router/React Native com rotas `/login`, `/`, `/cards`, `/reader/[id]` e `/backup`. O mobile importa EPUB por Document Picker, valida e armazena o arquivo em área privada do aplicativo, persiste leitura e anotações em SQLite WAL e oferece leitor, busca, sumário, bookmarks, citações/notas, preferências, tradução, lookup, cards e backup/restauração. A tela de login permite informar a URL da API e chama a sincronização inicial quando possível.

## Atores encontrados

- **Usuário autenticado**: informa e-mail/senha, navega na biblioteca, lê, seleciona texto, cria/revisa cards, consulta léxico, usa backup mobile e solicita sincronização.
- **Processo de inicialização do backend**: `DefaultAccountSeeder` garante uma conta configurada e `LexiconJobRecovery` recupera jobs que estavam `QUEUED`/`RUNNING` no boot.
- **Operador/processo de importação lexical**: o script `backend/scripts/import-kaikki.ps1` inicia o backend com propriedades de importação do snapshot Kaikki.
- **Serviços externos ou nativos acionados pelo código**: PostgreSQL, Ollama, Wiktionary, Google Translate/Search, módulos ML Kit e mecanismos de compartilhamento/arquivo do sistema operacional. Eles são integrações, não atores de negócio inferidos.

## Grandes áreas funcionais

1. Autenticação e sessão por token.
2. Biblioteca de livros e armazenamento de conteúdo.
3. Leitura EPUB e posição de leitura.
4. Navegação, seleção e recursos de estudo no mobile.
5. Preparação e consulta de léxico por livro.
6. Cards de estudo e fila de revisão.
7. Sincronização parcial entre SQLite mobile e API.
8. Backup/restauração local no mobile.
9. Importação operacional do catálogo lexical Kaikki.
10. Health check e observabilidade básica de jobs/IA.

## Fluxos de alto nível

### Web: login até leitura e card

1. `LoginView` chama `POST /api/auth/login` e grava token/usuário em `localStorage`.
2. `App` valida a sessão com `GET /api/auth/me` e carrega `GET /api/books`.
3. “Adicionar livro” verifica a extensão no navegador, calcula SHA-256, cria o registro com `POST /api/books` e envia o arquivo com `POST /api/books/{id}/content`.
4. Após o upload, o web inicia `POST /api/books/{id}/lexicon/jobs` e consulta o último job a cada dois segundos.
5. Ao abrir um livro, `EpubReader` baixa `GET /api/books/{id}/file`, renderiza o EPUB, salva progresso via `PATCH /api/books/{id}/progress` e busca a capa via `/cover` na biblioteca.
6. A seleção oferece lookup lexical e criação de card por `POST /api/cards`; o card aparece na fila de revisão.

### Mobile: importação local até leitura

1. O usuário seleciona um arquivo no Document Picker.
2. O app verifica extensão, tamanho, hash duplicado, integridade CRC, caminhos, MIME EPUB, container/OPF/spine, DRM, layout fixo e referências remotas.
3. O EPUB e a capa são copiados para `Paths.document`; o registro é gravado em SQLite.
4. A tela da biblioteca abre o leitor local. O leitor grava CFI/progresso, localizações, preferências, annotations, bookmarks e cards no SQLite.
5. A seleção oferece card, dicionário, tradução, citação e “Mais”; o último grupo permite copiar, compartilhar, buscar no livro/web e abrir serviços externos.

### Mobile: sincronização

Após login, `syncLibrary` lista livros remotos, associa livros por `fileHash`, cria no backend livros locais ainda ausentes, faz merge de progresso por timestamp e envia EPUB/capa quando o servidor não os possui. Em seguida baixa o léxico remoto para `lexicon_entries`, reconcilia cards por ID ou identidade `(bookId, cfiRange, selectedText)` e aplica/push alterações conforme timestamps.

O fluxo encontrado não baixa um livro remoto que não exista localmente, nem envia annotations, bookmarks ou preferências. Isso é comportamento observado, não decisão de produto.

### Backend: job lexical

`POST /api/books/{bookId}/lexicon/jobs` cria ou reutiliza o último job conforme `force`. `LexiconJobRunnerOptimized` executa de forma assíncrona: extrai XHTML/HTML do EPUB, divide unidades/sentenças/tokens, analisa lemmas/POS, persiste vínculos e resolve entradas do dicionário local/Kaikki. Candidatos restantes podem passar pelo `AiEnrichmentService`; progresso e falhas ficam no job.

## Integrações relevantes

| Integração | Uso observado | Superfície |
|---|---|---|
| PostgreSQL 16 | Persistência de usuários, livros, cards, jobs e catálogo lexical | Backend |
| Flyway | Migrações V1–V6 e validação do schema | Backend |
| Ollama `/api/chat` | Enriquecimento metadata-only de candidatos lexicais, com prompt JSON | Backend |
| Kaikki/Wiktionary English | Importação de snapshot JSONL/JSONL.GZ para catálogo lexical | Backend/operacional |
| Wiktionary API | Fallback de definição no mobile, com cache de 30 dias | Mobile |
| Google Translate/Search | Fallback ou abertura explícita de serviços externos no mobile | Mobile |
| ML Kit | Tradução e identificação de idioma local no mobile | Mobile nativo |
| epub.js/JSZip | Renderização web e leitura/validação local conforme a superfície | Web/Mobile |
| Filesystem/Share/Document Picker | Arquivos EPUB, capas, backup e compartilhamento | Mobile |

## Dados locais e remotos

| Dado | Web/backend | Mobile local | Sincronização encontrada |
|---|---|---|---|
| Livro e metadados | `books` no PostgreSQL | `books` no SQLite | Associação por hash; criação remota e envio de conteúdo local |
| EPUB/capa | filesystem do backend | `Paths.document` | Mobile envia quando remoto não possui; download remoto para mobile não encontrado |
| Posição | `books.last_cfi`, `progress` | mesmas informações em SQLite | Merge por `lastOpenedAt`; progresso remoto ou local pode vencer |
| Léxico | tabelas lexicais PostgreSQL | `lexicon_entries` | Mobile baixa lista remota e substitui o léxico do livro local |
| Cards | `cards` PostgreSQL | `cards` SQLite | Reconciliação de conteúdo, arquivado e ordem |
| Annotations/bookmarks/preferências | tabelas backend existem em V1, mas não há fluxo de sync encontrado | persistidos localmente | Não enviados pelo `syncLibrary` encontrado |
| Lookup Wiktionary | Não usado pelo web | `lookup_cache` SQLite | Não sincronizado |

## Diferenças relevantes entre web e mobile

| Tema | Web | Mobile |
|---|---|---|
| Entrada do livro | Upload do arquivo para o backend; checagem de extensão no frontend e tamanho/hash no backend | Importação local com validação estrutural e de segurança mais ampla |
| Conteúdo | EPUB é baixado da API e renderizado no navegador | EPUB é lido da área privada do app |
| Reader | Paginação, anterior/próxima, progresso, seleção, lookup lexical e card | Paginação/rolagem, temas/fontes, TOC, busca, bookmarks, citações, notas, tradução, dicionário e links |
| Léxico na leitura | Consulta endpoint de lookup | Consulta cache lexical local; fallback Wiktionary |
| Cards | Fila remota, flip, edição, “rever depois” e arquivamento | Fila SQLite, flip, detalhes, edição e gestos de swipe |
| Backup | UI visível, desabilitada, sem fluxo encontrado | Exportação/restauração ZIP implementada |
| Sync | Não há botão/fluxo de sincronização no web; ele é a API consumida pelo mobile | Login e “Sincronizar agora” chamam a API |
| Dados de leitura | O backend possui tabelas de annotations/bookmarks/preferences, mas o web não as usa | Esses dados funcionam localmente |

## Intenção declarada versus implementação

- `leitor-epub/README.md` e `leitor-epub/docs/PRIVACIDADE.md` declaram ausência de conta/backend/sync; o código atual contém login, SQLite `sync_session`, `syncLibrary` e endpoints autenticados.
- `OLLAMA-LOCAL.md` descreve profile opt-in; `application.yml` ativa `ollama` por padrão.
- `README-WEB.md` descreve upload seguro, seleção, citações e backup como itens a adicionar; upload, leitura/seleção e léxico já aparecem no web, enquanto citações e backup estão no mobile. O upload web não executa a validação EPUB do mobile.
- `ACCOUNT-SYNC.md` descreve livros/progresso/cards; o código também sincroniza léxico e não sincroniza annotations, bookmarks ou preferências.
- `docs/leitor-inteligente-copyright-aware-ai.md` descreve uma arquitetura-alvo; há classes de policy/gate/auditoria, mas nenhum caller atual do `ExternalAiContextGateway` foi encontrado e o caminho de enriquecimento observado é metadata-only.

## Unknowns dependentes de intenção humana

1. `[ASK USER]` Qual é a fonte autoritativa de dados durante conflitos entre backend e armazenamento local?
2. `[ASK USER]` O escopo pretendido de sincronização inclui annotations, bookmarks e preferências?
3. `[ASK USER]` O profile Ollama deve ser ativo por padrão ou explicitamente opt-in?
4. `[ASK USER]` A validação EPUB aplicada no mobile é requisito funcional obrigatório para o upload web/backend?
5. `[ASK USER]` O backup mobile não criptografado e o armazenamento local do token são aceitáveis no escopo atual?
6. `[ASK USER]` O importador Kaikki e o seed de conta são operações de desenvolvimento, instalação ou produção?

## Evidências principais

- `docs/codebase/STACK.md`
- `docs/codebase/ARCHITECTURE.md`
- `docs/codebase/INTEGRATIONS.md`
- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `frontend/src/App.tsx`
- `frontend/src/EpubReader.tsx`
- `frontend/src/api.ts`
- `leitor-epub/app/index.tsx`
- `leitor-epub/app/cards.tsx`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/components/MainMenu.tsx`
- `leitor-epub/src/reader/EpubReaderSurface.tsx`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/services/backup.ts`
