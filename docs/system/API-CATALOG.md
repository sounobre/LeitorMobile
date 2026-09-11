# Catálogo verificável de APIs

## Escopo e critérios

Este catálogo descreve os endpoints HTTP encontrados na implementação atual. As APIs de domínio foram enumeradas a partir de:

- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`;
- `backend/src/main/java/br/com/leitormobile/book/BookController.java`;
- `backend/src/main/java/br/com/leitormobile/card/CardController.java`;
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`.

Também foram incluídos os endpoints web do Spring Boot Actuator que a configuração expõe em `backend/src/main/resources/application.yml`: `health` e `info`.

Não foi encontrado Springdoc/OpenAPI ou anotação de contrato equivalente. Quando o código não fixa o corpo exato de erro, isso é indicado como desconhecido; não foi criado um contrato alternativo.

A base da API de domínio é `/api`. O backend usa a porta configurável por `server.port`, com default `8080`. O web usa `VITE_API_URL`, default `http://localhost:8080/api`. O mobile usa `EXPO_PUBLIC_API_URL`, default `http://10.0.2.2:8080/api`.

## Convenções transversais

- `POST /api/auth/login` e `GET /actuator/health` são permitidos sem autenticação pela `SecurityConfig`.
- Os demais paths encontrados exigem autenticação Bearer; o filtro aceita `Authorization: Bearer <token>`, procura o hash SHA-256 do token e verifica sua expiração.
- O token de sessão criado no login expira em 30 dias. O token bruto é retornado ao cliente; o backend persiste somente o hash em `session_tokens`.
- Recursos de livros/cards/léxico usam consultas com o usuário atual. Livro/card de outro usuário resulta em `404` no service encontrado, além da barreira `401` da segurança.
- Não foi encontrado `@ControllerAdvice` ou `@RestControllerAdvice`. As tabelas de erro abaixo registram somente statuses lançados diretamente pelo código e a rejeição de validações acionadas por `@Valid`; o JSON exato de erro não é um contrato customizado no repositório.
- Preflight `OPTIONS /**` é permitido pela segurança, mas é comportamento de infraestrutura/CORS e não foi tratado como endpoint de domínio.

## APIs de autenticação

## API-001 — Autenticar usuário

Method: `POST`  
Path: `/api/auth/login`

Capability:

- CAP-001

Exposure: `PUBLIC`

Consumers:

- WEB — `frontend/src/api.ts::login` e `frontend/src/LoginView.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::login` e `leitor-epub/app/login.tsx`.

Controller: `AuthController.login`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Content-Type: application/json`.
- Não exige `Authorization`.

### Request body

Schema `AuthDtos.LoginRequest`:

| Campo | Tipo | Obrigatório | Default | Bean Validation/normalização |
|---|---|---:|---|---|
| `email` | string | sim | — | `@NotBlank`; o service aplica `trim()` antes da busca case-insensitive |
| `password` | string | sim | — | `@NotBlank`; o service compara o valor recebido sem trim demonstrado |

O JSON enviado pelos dois clientes contém `email` e `password`.

Response success:

- HTTP `200`.
- Schema `AuthDtos.LoginResponse`:
  - `token`: string Bearer opaco, codificado em Base64 URL sem padding;
  - `user.id`: UUID;
  - `user.email`: string.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | `email` ou `password` em branco/rejeitado por `@Valid` | Spring MVC/Bean Validation; não há handler customizado |
| 401 | usuário inexistente ou senha não confere | `AuthService.invalidCredentials()` |

Side effects:

- Cria um token aleatório e persiste sua versão SHA-256.
- Não cria nem altera livro.
- Não há chamada externa, job ou filesystem.

Persistence:

- Leitura de `app_users`.
- Inserção em `session_tokens`.

Security:

- Endpoint explicitamente `permitAll`.
- A senha é comparada contra hash BCrypt armazenado; o endpoint não retorna a senha.

Idempotency / repeated calls:

- Repetições com credenciais válidas criam tokens distintos, pois cada chamada usa novo valor aleatório.
- Não foi encontrado endpoint de logout/revogação associado a este token.

Tests:

- Nenhum teste de endpoint de login encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthDtos.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthService.java`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/src/main/java/br/com/leitormobile/auth/SessionToken.java`
- `backend/src/main/resources/db/migration/V2__add_single_account_auth.sql`
- `frontend/src/api.ts`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] O JSON produzido pelo mecanismo padrão de erro do Spring não é fixado por código local.
- [TODO] Não foi encontrado teste que valide duração, revogação ou concorrência de tokens via HTTP.

## API-002 — Consultar usuário autenticado

Method: `GET`  
Path: `/api/auth/me`

Capability:

- CAP-001

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::getMe` e `frontend/src/App.tsx`.
- MOBILE — NONE_FOUND; o mobile usa o usuário retornado pelo login e não chama `/auth/me`.

Controller: `AuthController.me`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Schema `AuthDtos.UserResponse`:
  - `id`: UUID;
  - `email`: string.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | token ausente, inválido, expirado ou principal não resolvido | `SecurityConfig`, `AuthFilter` e `CurrentUserService.require()` |

Side effects:

- Nenhum; leitura do usuário atual.

Persistence:

- Leitura de `app_users`.

Security:

- Exige Bearer válido.
- O usuário é obtido do principal criado pelo `AuthFilter`; não há parâmetro de usuário no path.

Idempotency / repeated calls:

- Leitura repetida não altera dados.

Tests:

- Nenhum teste específico de `/api/auth/me` encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/auth/AuthController.java`
- `backend/src/main/java/br/com/leitormobile/auth/CurrentUserService.java`
- `backend/src/main/java/br/com/leitormobile/auth/AuthFilter.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`

Unknowns:

- [TODO] Não foi encontrado teste HTTP para a forma do response ou para token expirado.

## APIs de livros

## API-003 — Listar livros da biblioteca

Method: `GET`  
Path: `/api/books`

Capability:

- CAP-003
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::listBooks` e `frontend/src/App.tsx::loadBooks`.
- MOBILE — `leitor-epub/src/services/sync.ts::syncLibrary`.

Controller: `BookController.list`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| `search` | string | não | `""` | Sem Bean Validation; o service aplica `trim()` e pesquisa por título/autor |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Array de `BookDtos.Response`. Campos:
  - `id` UUID;
  - `fileHash` string;
  - `originalName` string;
  - `title`, `author`, `language` strings;
  - `coverUri` string ou null;
  - `description` e `publisher` strings;
  - `importedAt` e `lastOpenedAt` ISO-8601 ou null;
  - `lastCfi` string ou null;
  - `progress` número decimal;
  - `fileAvailable` e `coverAvailable` booleanos.
- Sem busca, o repository ordena por `lastOpenedAt` desc nulo por último e `importedAt`. Com busca, aplica contains case-insensitive em título/autor.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança/`CurrentUserService.require()` |

Side effects:

- Nenhum; leitura.

Persistence:

- Leitura de `books` e relacionamento com `app_users`.

Security:

- Exige usuário atual.
- O repository filtra por `owner.id`.

Idempotency / repeated calls:

- Repetições retornam o estado atual; não há cache no código encontrado.

Tests:

- `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java` valida `GET /api/books` sem autenticação e espera HTTP `401`.
- Não foi encontrado teste autenticado que valide o array de livros.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookDtos.java`
- `backend/src/main/java/br/com/leitormobile/book/BookRepository.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`
- `backend/src/test/java/br/com/leitormobile/auth/SecurityConfigTest.java`

Unknowns:

- [TODO] Não foi encontrado contrato de paginação; a resposta é uma lista inteira.
- [TODO] O response expõe `coverUri` como valor persistido, mas os clientes usam o endpoint binário de capa; não há contrato separado para semântica de URL desse campo.

## API-004 — Criar registro de livro

Method: `POST`  
Path: `/api/books`

Capability:

- CAP-005
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::createBook` e fluxo de upload em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::syncLibrary` quando não encontra livro remoto por `fileHash`.

Controller: `BookController.create`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.
- `Content-Type: application/json`.

### Request body

Schema `BookDtos.CreateBookRequest`:

| Campo | Tipo | Obrigatório | Default/normalização |
|---|---|---:|---|
| `originalName` | string | sim | `@NotBlank`; armazenado com `trim()` |
| `fileHash` | string ou null | não | branco/nulo vira `manual:<UUID>`; não há validação de formato |
| `title` | string ou null | não | branco vira nome original sem extensão `.epub` |
| `author` | string ou null | não | branco vira `""` |
| `language` | string ou null | não | branco vira `pt-BR` |
| `coverUri` | string ou null | não | branco vira null |
| `description` | string ou null | não | branco vira `""` |
| `publisher` | string ou null | não | branco vira `""` |

O web envia `originalName`, `fileHash`, `title`, `author` e `language`. O mobile também envia `description` e `publisher`.

Response success:

- HTTP `201 Created`.
- Schema `BookDtos.Response`, igual ao descrito em API-003.
- O campo `fileAvailable` é derivado de `fileUri != null`; `coverAvailable` é derivado de `coverUri != null`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | `originalName` ausente/branco | `@Valid`/Bean Validation |
| 401 | sessão ausente/inválida | segurança/`CurrentUserService.require()` |
| 409 | já existe livro com mesmo hash para o usuário, ou constraint de banco rejeita insert | `BookService`/`DataIntegrityViolationException` |

Side effects:

- Insere registro de livro.
- Não grava EPUB nem capa; isso ocorre em API-005.
- Não inicia job lexical neste método.

Persistence:

- Inserção em `books`.
- Leitura do usuário em `app_users`.
- A migração V1 também criou uma unicidade global para `file_hash`; V2 adiciona índice único por usuário/hash. A combinação efetiva das constraints é uma divergência relevante para duplicidade.

Security:

- Requer usuário atual.
- O `owner` do registro é sempre o usuário autenticado; não é aceito no body.

Idempotency / repeated calls:

- Repetir com mesmo `fileHash` normalmente resulta em `409` para o mesmo owner.
- Com hash ausente, cada chamada gera novo hash `manual:<UUID>` e pode criar outro registro.

Tests:

- Nenhum teste específico do endpoint de criação encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookDtos.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/resources/db/migration/V1__create_library_schema.sql`
- `backend/src/main/resources/db/migration/V2__add_single_account_auth.sql`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foi encontrado limite de tamanho/charset específico para os campos textuais no controller/DTO; limites de coluna estão no modelo/migration.
- [TODO] Não foi executado cenário HTTP que confirme qual constraint de `file_hash` vence quando há owners diferentes.

## API-005 — Armazenar EPUB e/ou capa de livro

Method: `POST`  
Path: `/api/books/{id}/content`

Capability:

- CAP-005
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::uploadBookContent`, chamado pelo fluxo de upload em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::uploadBookContent`, chamado por `syncLibrary`.

Controller: `BookController.uploadContent`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.
- `Content-Type: multipart/form-data` com boundary; o web deixa o browser definir o boundary.
- O mobile envia Bearer e multipart sem definir o header manualmente.

### Request body

Multipart com duas partes opcionais:

| Parte | Tipo | Obrigatório | Validação/normalização |
|---|---|---:|---|
| `epub` | arquivo | não | Se presente, não vazio, máximo de 100 MB; para livro com hash não `manual:`, SHA-256 do conteúdo deve coincidir, case-insensitive |
| `cover` | arquivo | não | Se presente, não vazio; extensão final é derivada do nome/MIME: png/webp/gif ou fallback jpg |

Pelo menos uma parte não vazia é necessária. Não há Bean Validation de MIME, extensão, estrutura ZIP, DRM ou conteúdo EPUB neste controller/service.

Response success:

- HTTP `200`.
- Schema `BookDtos.Response`.
- O EPUB é armazenado em `<storageRoot>/books/{id}.epub`.
- A capa é armazenada em `<storageRoot>/covers/{id}.{jpg|png|webp|gif}`.
- O storage root default é `./data/library`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | nenhuma parte útil enviada | `BookContentService.store` |
| 400 | hash do EPUB diverge de `books.file_hash` | `BookContentService.store` |
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `ownedBook` |
| 413 | EPUB acima de 100 MB | `BookContentService.store` |
| 500 | falha de I/O ao criar/gravar arquivo | `BookContentService.store` |

Side effects:

- Cria diretórios de books/covers se necessário.
- Grava ou sobrescreve o arquivo associado ao UUID.
- Atualiza `file_uri` e/ou `cover_uri` no registro `books`.
- Não inicia job lexical por si só; o web inicia o job depois, e o mobile tenta iniciá-lo depois do upload.

Persistence:

- Atualização de `books`.
- Filesystem backend sob `app.storage-directory`.

Security:

- Exige Bearer e ownership do livro.
- O path persistido é validado na leitura e na exclusão contra o storage root.

Idempotency / repeated calls:

- Repetir a mesma parte grava no mesmo path do livro; não há chave de idempotência explícita.
- Enviar somente capa/EPUB atualiza somente a parte recebida.
- Um EPUB com hash incompatível é rejeitado, exceto para hashes com prefixo `manual:`.

Tests:

- `frontend/book-upload.test.mjs` verifica estaticamente que o fluxo web possui seletor de arquivo e chama `uploadBookContent`.
- Não foi encontrado teste HTTP/backend específico de multipart.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/resources/application.yml`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `frontend/book-upload.test.mjs`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foi encontrado teste que demonstre a resposta multipart completa em runtime.
- [TODO] O endpoint não chama as validações EPUB estruturais mais amplas implementadas no mobile; não há evidência de contrato que exija equivalência.

## API-006 — Baixar EPUB armazenado

Method: `GET`  
Path: `/api/books/{id}/file`

Capability:

- CAP-008

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::fetchBookFile` e `frontend/src/EpubReader.tsx::open`.
- MOBILE — NONE_FOUND; o mobile lê o arquivo do filesystem privado.

Controller: `BookController.file`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Corpo binário `Resource`.
- `Content-Type: application/epub+zip`.
- `Content-Disposition: inline; filename="<originalName>"`, com aspas removidas do nome.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário, URI ausente, path fora do storage root ou arquivo não regular | `BookContentService.open` |

Side effects:

- Nenhum; leitura de filesystem.

Persistence:

- Leitura de `books`.
- Leitura do arquivo sob `data/library/books` ou storage configurado.

Security:

- Bearer obrigatório.
- Ownership é verificado antes de abrir o path.
- O service normaliza o path e exige que ele esteja sob o storage root.

Idempotency / repeated calls:

- Repetições retornam o arquivo atual; não alteram timestamps do livro.

Tests:

- Nenhum teste específico de download HTTP encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `frontend/src/api.ts`
- `frontend/src/EpubReader.tsx`

Unknowns:

- [TODO] Não foi encontrado teste que valide headers e media type em runtime.

## API-007 — Baixar capa armazenada

Method: `GET`  
Path: `/api/books/{id}/cover`

Capability:

- CAP-003

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::fetchBookCover` e `frontend/src/App.tsx::BookTile`.
- MOBILE — NONE_FOUND; capas são lidas do filesystem local no fluxo mobile.

Controller: `BookController.cover`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Corpo binário `Resource`.
- Media type é obtido por `Files.probeContentType`, com fallback `image/jpeg`.
- `Content-Disposition` é inline; o nome deriva do nome original do livro trocando `.epub` por `.jpg`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário, capa ausente, path fora do storage root ou arquivo não regular | `BookContentService.open` |

Side effects:

- Nenhum; leitura de filesystem.

Persistence:

- Leitura de `books` e do arquivo de capa.

Security:

- Bearer e ownership do livro são obrigatórios.

Idempotency / repeated calls:

- Repetições são leituras sem alteração de banco.

Tests:

- Nenhum teste específico de capa HTTP encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`

Unknowns:

- [TODO] Não foi encontrado teste que valide o media type efetivo para cada extensão.

## API-008 — Atualizar progresso de leitura

Method: `PATCH`  
Path: `/api/books/{id}/progress`

Capability:

- CAP-010
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::updateBookProgress` e callback de progresso em `frontend/src/EpubReader.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::mergeBookProgress`, quando a posição local vence.

Controller: `BookController.updateProgress`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.
- `Content-Type: application/json`.

### Request body

Schema `BookDtos.ProgressRequest`:

| Campo | Tipo | Obrigatório | Default/normalização |
|---|---|---:|---|
| `lastCfi` | string ou null | não | atribuído diretamente; null é aceito |
| `progress` | decimal ou null | não | `@DecimalMin("0.0")` e `@DecimalMax("1.0")` quando presente; null preserva o valor anterior |

O service ainda limita o decimal ao intervalo 0..1 e sempre atualiza `lastOpenedAt` para o instante atual.

Response success:

- HTTP `200`.
- Schema `BookDtos.Response`.
- `lastCfi`, `progress` e `lastOpenedAt` refletem o novo estado.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | `progress` fora de 0..1 ou body inválido | `@Valid`/Bean Validation |
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `BookService.updateProgress` |

Side effects:

- Atualiza posição e progresso do livro.
- Atualiza `last_opened_at`.
- Nenhum filesystem, job ou chamada externa.

Persistence:

- Atualização de `books`.

Security:

- Bearer e ownership do livro.
- Não há autorização por CFI além do ownership encontrado.

Idempotency / repeated calls:

- Repetir o mesmo body ainda altera `lastOpenedAt`, portanto não é idempotente no estado completo.
- O mobile decide localmente se envia a posição usando timestamps; essa política não está no backend.

Tests:

- Não foi encontrado teste específico do endpoint de progresso.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookDtos.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/Book.java`
- `frontend/src/api.ts`
- `frontend/src/EpubReader.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] O campo local `locations_json` existe na entidade/migration, mas não é aceito nem retornado por este endpoint.
- [TODO] Não foi encontrado teste HTTP de conflito entre duas posições.

## API-009 — Excluir livro e conteúdo associado

Method: `DELETE`  
Path: `/api/books/{id}`

Capability:

- CAP-007

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::deleteBook` e ações de exclusão em `frontend/src/App.tsx`.
- MOBILE — NONE_FOUND; o mobile remove livros localmente e o sync não envia DELETE remoto.

Controller: `BookController.delete`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `204 No Content`.
- Sem corpo.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `BookService.delete` |
| 500 | conteúdo persistido fora do diretório permitido ou falha ao removê-lo | `BookContentService.deleteStoredContent` |

Side effects:

- Remove EPUB e capas conhecidas do filesystem, incluindo extensões antigas conhecidas.
- Remove o registro `books`.
- Migrations definem `ON DELETE CASCADE` para cards, dados de leitura e dados lexicais relacionados ao livro.
- Não inicia job nem chamada externa.

Persistence:

- Exclusão em `books`.
- Cascades de banco alcançam, conforme migrations, `cards`, `annotations`, `bookmarks`, `lexicon_jobs`, `reading_units`, `book_lexemes` e ocorrências/relacionamentos dependentes.
- Filesystem sob diretórios gerenciados.

Security:

- Bearer e ownership obrigatórios.
- O service valida paths antes de chamar `repository.deleteById`.

Idempotency / repeated calls:

- Primeira exclusão remove os dados; repetição para o mesmo UUID encontra ausência e retorna `404`.
- Se houver path inválido, o teste demonstra que o registro não é excluído.

Tests:

- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java` verifica remoção de EPUB/capas e falha segura quando o conteúdo está fora do storage.

Evidence:

- `backend/src/main/java/br/com/leitormobile/book/BookController.java`
- `backend/src/main/java/br/com/leitormobile/book/BookService.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/resources/db/migration/V1__create_library_schema.sql`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `backend/src/test/java/br/com/leitormobile/book/BookServiceTest.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`

Unknowns:

- [TODO] Não foi encontrado teste de integração que confirme todas as cascades no PostgreSQL real.

## APIs de cards

## API-010 — Listar cards

Method: `GET`  
Path: `/api/cards`

Capability:

- CAP-018
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::listCards` e carregamento de cards em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::syncLibrary`.

Controller: `CardController.list`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| `includeArchived` | boolean | não | `false` | Conversão Spring; sem Bean Validation |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Array de `CardDtos.Response`:
  - `id` e `bookId` UUID;
  - `bookTitle`, `cfiRange`, `selectedText`, `translation`, `pronunciation`, `partOfSpeech`, `definition`, `background`, `chapterTitle` strings;
  - `examples` e `relatedWords` arrays de string;
  - `queueOrder` inteiro;
  - `archived` boolean;
  - `createdAt` e `updatedAt` ISO-8601.
- Com `false`, o repository retorna somente não arquivados, ordenados por fila/criação. Com `true`, retorna todos do owner, arquivados depois dos ativos.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança/`CurrentUserService.require()` |

Side effects:

- Nenhum; leitura.

Persistence:

- Leitura de `cards` e `books` para título/ownership.

Security:

- Filtra por `book.owner.id`; não aceita `bookId` de outro usuário como filtro público.

Idempotency / repeated calls:

- Leitura repetida sem efeitos.

Tests:

- Nenhum teste específico do endpoint de listagem encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/CardDtos.java`
- `backend/src/main/java/br/com/leitormobile/card/CardRepository.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não há paginação; o retorno é uma lista inteira por usuário.

## API-011 — Criar card de estudo

Method: `POST`  
Path: `/api/cards`

Capability:

- CAP-017
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::createCard`, chamado por `frontend/src/EpubReader.tsx::handleCreateCard`.
- MOBILE — `leitor-epub/src/services/sync.ts::syncLibrary`, quando publica card local sem mapeamento remoto.

Controller: `CardController.create`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.
- `Content-Type: application/json`.

### Request body

Schema `CardDtos.CreateRequest`:

| Campo | Tipo | Obrigatório | Default/normalização |
|---|---|---:|---|
| `bookId` | UUID | sim | `@NotNull` |
| `cfiRange` | string | sim | `@NotBlank` |
| `selectedText` | string | sim | `@NotBlank` |
| `chapterTitle` | string ou null | não | null vira `""` |
| `translation` | string ou null | não | null vira `""` no entity |
| `pronunciation` | string ou null | não | null vira `""` |
| `partOfSpeech` | string ou null | não | null vira `""` |
| `definition` | string ou null | não | null vira `""` |
| `background` | string ou null | não | null vira `""` |
| `examples` | array de string ou null | não | null vira `[]` |
| `relatedWords` | array de string ou null | não | null vira `[]` |

O service verifica o livro pelo `bookId` e owner antes de criar o card. `queueOrder` é obtido de `findNextQueueOrder`; o código atribui diretamente o inteiro retornado (máximo ativo ou `-1` quando não há card).

Response success:

- HTTP `201 Created`.
- Schema `CardDtos.Response`, com todos os campos do card e título do livro.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | campos obrigatórios ausentes/brancos, ou `bookId` nulo | `@Valid`/Bean Validation |
| 401 | sessão ausente/inválida | segurança |
| 404 | `bookId` não pertence ao usuário ou não existe | `CardService.create` |

Side effects:

- Insere card e preenche defaults para strings/listas nulas.
- Atualiza timestamps de criação/atualização da entidade.
- Não há filesystem/job/chamada externa no backend.

Persistence:

- Leitura de `books`.
- Inserção em `cards`.

Security:

- O livro de referência deve pertencer ao usuário atual.
- Não há autorização separada por papel/role.

Idempotency / repeated calls:

- Repetir a mesma requisição cria cards distintos; não há deduplicação por CFI/texto.

Tests:

- `frontend/card-creation.test.mjs` verifica que o reader consulta léxico e monta o payload de criação de card; não é teste HTTP.
- Não foi encontrado teste backend específico de criação de card.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardDtos.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/Card.java`
- `frontend/src/api.ts`
- `frontend/src/EpubReader.tsx`
- `frontend/card-creation.test.mjs`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foram encontrados limites Bean Validation para tamanho dos campos/listas.
- [TODO] O vínculo lexical opcional presente na migration de cards não é preenchido por este DTO/service.

## API-012 — Atualizar conteúdo de card

Method: `PATCH`  
Path: `/api/cards/{id}`

Capability:

- CAP-018
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::updateCard` e editor em `frontend/src/App.tsx`.
- MOBILE — NONE_FOUND como chamada remota direta; o mobile atualiza localmente e o sync publica por este endpoint em `leitor-epub/src/services/sync.ts::pushLocalCardWithBook`.

Controller: `CardController.update`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.
- `Content-Type: application/json`.

### Request body

Schema `CardDtos.UpdateRequest`:

| Campo | Tipo | Obrigatório | Default/normalização |
|---|---|---:|---|
| `selectedText` | string | sim | `@NotBlank`; atribuído como recebido |
| `translation` | string ou null | não | null vira `""` |
| `pronunciation` | string ou null | não | null vira `""` |
| `partOfSpeech` | string ou null | não | null vira `""` |
| `definition` | string ou null | não | null vira `""` |
| `background` | string ou null | não | null vira `""` |
| `examples` | array de string ou null | não | null vira `[]` |
| `relatedWords` | array de string ou null | não | null vira `[]` |

`bookId`, `cfiRange` e `chapterTitle` não fazem parte do request de update e permanecem como estavam.

Response success:

- HTTP `200`.
- Schema `CardDtos.Response`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | `selectedText` ausente/branco | `@Valid`/Bean Validation |
| 401 | sessão ausente/inválida | segurança |
| 404 | card não pertence a livro do usuário | `CardService.find` |

Side effects:

- Atualiza campos de conteúdo e `updatedAt`.
- Não altera book/CFI/chapter no DTO.
- Nenhuma chamada externa ou filesystem.

Persistence:

- Atualização em `cards`.

Security:

- Ownership é resolvido por `card.book.owner.id`.

Idempotency / repeated calls:

- Conteúdo igual ainda atualiza `updatedAt`; não é idempotente no timestamp.

Tests:

- Não foi encontrado teste específico deste PATCH HTTP.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardDtos.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/Card.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não há limite validado para tamanho de texto ou quantidade de exemplos/related words.

## API-013 — Arquivar card

Method: `POST`  
Path: `/api/cards/{id}/archive`

Capability:

- CAP-018
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::archiveCard` e ação em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::pushLocalCardWithBook` quando o estado local muda para arquivado.

Controller: `CardController.archive`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Schema `CardDtos.Response` com `archived=true`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | card não pertence a livro do usuário | `CardService.find` |

Side effects:

- Define `archived=true`.
- Atualiza `updatedAt`.
- Não inicia job/chamada externa.

Persistence:

- Atualização em `cards`.

Security:

- Bearer e ownership do card.

Idempotency / repeated calls:

- Mantém arquivado em chamadas repetidas, mas atualiza `updatedAt` a cada chamada.

Tests:

- Não foi encontrado teste específico do endpoint; há lógica local mobile de arquivamento em `leitor-epub/src/db/repository.ts`, que não chama esta API.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/Card.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foi encontrado teste de ownership para este endpoint.

## API-014 — Desarquivar card

Method: `POST`  
Path: `/api/cards/{id}/unarchive`

Capability:

- CAP-018
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — NONE_FOUND; não há wrapper correspondente em `frontend/src/api.ts`.
- MOBILE — `leitor-epub/src/services/sync.ts::pushLocalCardWithBook` quando o estado local muda para não arquivado.

Controller: `CardController.unarchive`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Schema `CardDtos.Response` com `archived=false`.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | card não pertence a livro do usuário | `CardService.find` |

Side effects:

- Define `archived=false`.
- Atualiza `updatedAt`.

Persistence:

- Atualização em `cards`.

Security:

- Bearer e ownership do card.

Idempotency / repeated calls:

- Mantém desarquivado em chamadas repetidas, mas atualiza `updatedAt`.

Tests:

- Nenhum teste específico do endpoint encontrado.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/Card.java`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] A inexistência de wrapper web é observada no cliente; a intenção de oferecer a operação no web não está declarada.

## API-015 — Mover card para o fim da fila

Method: `POST`  
Path: `/api/cards/{id}/move-to-end`

Capability:

- CAP-018
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::moveCardToEnd` e ação em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::pushLocalCardWithBook` quando card não arquivado e ordem diverge.

Controller: `CardController.moveToEnd`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `id` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Schema `CardDtos.Response`.
- `queueOrder` recebe o valor retornado por `findNextQueueOrder` e `updatedAt` é atualizado.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | card não pertence a livro do usuário | `CardService.find` |

Side effects:

- Atualiza `cards.queue_order` e `updated_at`.
- Não há chamada externa/job.

Persistence:

- Leitura de cards ativos para calcular ordem.
- Atualização em `cards`.

Security:

- O card deve pertencer ao usuário.
- Não há verificação adicional de que o card esteja ativo antes de alterar a ordem.

Idempotency / repeated calls:

- Chamadas repetidas recalculam a ordem a partir da fila ativa e atualizam timestamp; não há idempotency key.

Tests:

- Não foi encontrado teste específico deste endpoint.

Evidence:

- `backend/src/main/java/br/com/leitormobile/card/CardController.java`
- `backend/src/main/java/br/com/leitormobile/card/CardService.java`
- `backend/src/main/java/br/com/leitormobile/card/CardRepository.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foi encontrado teste de concorrência/reordenação de cards.

## APIs de léxico

## API-016 — Iniciar ou solicitar processamento lexical

Method: `POST`  
Path: `/api/books/{bookId}/lexicon/jobs`

Capability:

- CAP-019
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::startBookLexicon`, fluxo de upload e reprocessamento em `frontend/src/App.tsx`; seleção do reader também pode iniciar o job.
- MOBILE — `leitor-epub/src/services/sync.ts::reprocessBookLexicon` e `syncLibrary` após upload.

Controller: `LexiconController.start`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `bookId` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| `force` | boolean | não | `false` | Conversão Spring; sem Bean Validation |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `202 Accepted`.
- Schema `LexiconDtos.JobResponse`:
  - `id`, `bookId` UUID;
  - `status`, `phase` strings, inicialmente `QUEUED`;
  - `progress` decimal, inicialmente zero;
  - `processedUnits`, `totalUnits`, `processedTokens`, `totalLexemes` inteiros;
  - `message` e `errorMessage` string ou null;
  - `createdAt`, `startedAt`, `finishedAt` ISO-8601 ou null.
- Se já houver job `QUEUED`/`RUNNING`, retorna o ativo sem criar outro.
- Sem `force`, um último job `COMPLETED` é retornado sem novo processamento.
- Com `force=true`, um novo job é salvo mesmo havendo completed anterior.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança/`CurrentUserService.require()` |
| 404 | livro não pertence ao usuário ou não existe | `LexiconService.ownedBook` |

Side effects:

- Pode inserir em `lexicon_jobs`.
- Chama `runner.runAsync`; o runner @Async lê o EPUB, extrai unidades, analisa tokens, atualiza progresso e persiste dados lexicais.
- Pode chamar Ollama local durante enriquecimento quando o profile/configuração estiver ativo.
- O job pode terminar em `COMPLETED` ou `FAILED`; falha do processamento é registrada no próprio job.

Persistence:

- Inserção/atualização de `lexicon_jobs`.
- O processamento assíncrono pode afetar `reading_units`, `sentences`, `lexemes`, `word_forms`, `book_lexemes`, `token_occurrences`, `dictionary_entries`, `lexical_senses` e `ai_request_audit`.
- Lê EPUB no filesystem do backend.

Security:

- Bearer e ownership do livro.
- Não foi encontrada autorização por papel.

Idempotency / repeated calls:

- Possui idempotência de job ativo e de último job completed quando `force=false`.
- `force=true` cria nova execução.
- O cliente web envia `force=true` somente no reprocessamento explícito; o mobile não envia a flag no caminho observado.

Tests:

- `backend/src/test/java/br/com/leitormobile/lexicon/LexiconServiceTest.java` valida não criar novo job após completed e criar quando force.
- `frontend/lexicon-start.test.mjs` valida o uso de `force=true` e a ausência de início automático ao abrir o livro.
- Os testes são service/static; não foi encontrado teste HTTP do controller.

Evidence:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconDtos.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/AiEnrichmentService.java`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/EpubReader.tsx`
- `frontend/lexicon-start.test.mjs`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] Não foi encontrado teste de runtime para o retorno imediato `202` ou para polling durante transição de status.
- [TODO] O resultado depende de arquivo EPUB armazenado; não há erro HTTP específico no controller para falha assíncrona, pois a falha é gravada no job.

## API-017 — Consultar último status do processamento lexical

Method: `GET`  
Path: `/api/books/{bookId}/lexicon/jobs/latest`

Capability:

- CAP-019
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::getBookLexiconJob` e polling em `frontend/src/App.tsx`.
- MOBILE — `leitor-epub/src/services/sync.ts::getBookLexiconJob` e polling/estado em `leitor-epub/app/index.tsx`.

Controller: `LexiconController.status`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `bookId` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- `LexiconDtos.JobResponse` quando existe job.
- Corpo JSON `null` quando o livro existe mas ainda não há job.
- Campos do job são os descritos em API-016.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `LexiconService.ownedBook` |

Side effects:

- Nenhum; leitura do último job.

Persistence:

- Leitura de `books` e `lexicon_jobs`.

Security:

- Bearer e ownership do livro.

Idempotency / repeated calls:

- Leituras repetidas não alteram o job.

Tests:

- `frontend/src/bookDetails.test.ts` verifica a interpretação de campos de `LexiconJob` no frontend, mas não faz chamada HTTP.
- Não foi encontrado teste de endpoint.

Evidence:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconDtos.java`
- `frontend/src/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/bookDetails.test.ts`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/app/index.tsx`

Unknowns:

- [TODO] Não foi encontrado contrato de cache/polling no backend; os intervalos são decisões dos clientes.
- [TODO] Não foi executada chamada para confirmar se o framework serializa o retorno inexistente exatamente como JSON `null` em todas as configurações.

## API-018 — Listar entradas lexicais de um livro

Method: `GET`  
Path: `/api/books/{bookId}/lexicon`

Capability:

- CAP-016
- CAP-022

Exposure: `AUTHENTICATED`

Consumers:

- WEB — NONE_FOUND; o web consulta lookup individual e status, mas não chama o endpoint de lista lexical.
- MOBILE — `leitor-epub/src/services/sync.ts::syncLibrary`, que envia `?limit=5000` para baixar o léxico remoto.

Controller: `LexiconController.list`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `bookId` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| `search` | string | não | `""` | trim + lower; filtro contains no lemma |
| `limit` | int | não | `2000` | Sem Bean Validation; service limita efetivamente entre 1 e 2000 |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- Array de `LexiconDtos.EntryResponse`:
  - `id`, `bookId` UUID;
  - `lemma`, `partOfSpeech` strings;
  - `wordForms` array de string;
  - `definition`, `translationPtBr`, `ipa`, `cefr` strings;
  - `bookFrequency` inteiro;
  - `firstSentenceId` UUID ou null;
  - `resolutionStatus` e `pedagogicalRelevance` strings;
  - `senses` array de `SenseResponse` com `id`, `senseKey`, `definition`, `translationPtBr`;
  - `updatedAt` ISO-8601.
- O service ordena a origem por frequência desc/lemma asc e depois aplica o filtro/limit.
- `updatedAt` é preenchido com `Instant.now()` durante a montagem do response; não é lido de um campo da entidade nesse caminho.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `LexiconService.ownedBook` |

Side effects:

- Nenhum; leitura.

Persistence:

- Leitura de `books`, `book_lexemes`, `lexemes`, `word_forms`, `dictionary_entries` e `lexical_senses`.

Security:

- Ownership do livro é verificado antes da consulta.
- Não há autorização por papel.

Idempotency / repeated calls:

- Leitura repetida não altera o catálogo.
- Limite maior que 2000 é silenciosamente reduzido para 2000.

Tests:

- `frontend/lexicon-entry-contract.test.mjs` verifica campos usados pelo modal contra o contrato retornado; não chama a API.
- Não foi encontrado teste de endpoint ou de clamp de `limit`.

Evidence:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconDtos.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconRepositories.java`
- `frontend/lexicon-entry-contract.test.mjs`
- `leitor-epub/src/services/sync.ts`

Unknowns:

- [TODO] O cliente mobile envia `limit=5000`, mas o backend nunca retorna mais de 2000; não há evidência de que esse limite efetivo seja intencional.
- [TODO] Não foi encontrado endpoint de paginação/cursor.

## API-019 — Consultar entrada lexical por termo

Method: `GET`  
Path: `/api/books/{bookId}/lexicon/lookup`

Capability:

- CAP-014
- CAP-016

Exposure: `AUTHENTICATED`

Consumers:

- WEB — `frontend/src/api.ts::lookupBookLexicon`, chamado por `frontend/src/EpubReader.tsx` e `frontend/src/BookProcessingDetailsModal.tsx`.
- MOBILE — NONE_FOUND; o reader mobile consulta cache SQLite/endpoint externo, não este backend lookup.

Controller: `LexiconController.lookup`.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| `bookId` | UUID | sim | Conversão pelo `@PathVariable` |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| `term` | string | sim | — | `@RequestParam` obrigatório; branco retorna JSON `null` |
| — | — | — | — | Não há outros |

### Headers relevantes

- `Authorization: Bearer <token>`.

### Request body

- Nenhum.

Response success:

- HTTP `200`.
- `LexiconDtos.EntryResponse` quando há match por lemma ou word form, com prioridade da query do repository por frequência.
- Corpo JSON `null` quando `term` é branco ou não há entrada.
- Schema de entrada é o descrito em API-018.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 400 | parâmetro obrigatório `term` ausente, conforme binding Spring; body exato não customizado | Spring MVC |
| 401 | sessão ausente/inválida | segurança |
| 404 | livro não pertence ao usuário ou não existe | `LexiconService.ownedBook` |

Side effects:

- Nenhum; leitura.

Persistence:

- Leitura de `books`, `book_lexemes`, `lexemes`, `word_forms`, `dictionary_entries` e `lexical_senses`.

Security:

- Bearer e ownership do livro.
- O termo não permite acessar léxico de outro livro sem ownership válido.

Idempotency / repeated calls:

- Leitura repetida não altera dados.
- O service aplica `trim()` antes do lookup; o repository compara lemma/form case-insensitive.

Tests:

- `frontend/lexicon-lookup.test.mjs` verifica o uso de `entry.lemma` no reader.
- `frontend/card-creation.test.mjs` verifica lookup do texto selecionado antes da criação do card.
- `frontend/lexicon-entry-contract.test.mjs` verifica campos de senses/frequência usados pelo modal.
- Não foi encontrado teste HTTP do endpoint.

Evidence:

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconController.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconDtos.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconRepositories.java`
- `frontend/src/api.ts`
- `frontend/src/EpubReader.tsx`
- `frontend/src/BookProcessingDetailsModal.tsx`
- `frontend/lexicon-lookup.test.mjs`

Unknowns:

- [TODO] Não foi encontrado teste que confirme o body JSON `null` para termo sem match.
- [TODO] O frontend web declara um tipo `LexiconEntry` parcial e não declara todos os campos presentes no DTO (`id`, `bookId` e `updatedAt`).

## APIs operacionais

## API-020 — Verificar saúde operacional do backend

Method: `GET`  
Path: `/actuator/health`

Capability:

- CAP-025

Exposure: `OPERATIONAL`

Consumers:

- EXTERNAL/OPERATOR — nenhum consumidor interno identificado; o endpoint pode ser consultado por monitor/operador, mas não foi encontrado deployment ou monitor no repositório.
- WEB — NONE_FOUND.
- MOBILE — NONE_FOUND.

Controller: Spring Boot Actuator auto-configurado; nenhum controller da aplicação para este path.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- Nenhum header de autenticação é necessário pela `SecurityConfig`.
- Outros headers seguem o Actuator/Spring Boot.

### Request body

- Nenhum.

Response success:

- Endpoint Actuator exposto pela propriedade `management.endpoints.web.exposure.include`.
- O status de sucesso e o schema detalhado dos health indicators não são sobrescritos por código da aplicação.
- Nenhum health contributor customizado foi encontrado.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| — | Nenhuma resposta de erro HTTP foi demonstrada por teste/execução nesta auditoria | Não determinado |

Side effects:

- Nenhuma alteração de aplicação, banco ou filesystem demonstrada.

Persistence:

- Nenhuma tabela/entidade de aplicação afetada.

Security:

- `/actuator/health` está em `permitAll`.
- A exposição web é configurada em `application.yml`.

Idempotency / repeated calls:

- Não há estado de aplicação alterado pelo endpoint segundo o código encontrado.

Tests:

- Nenhum teste específico do Actuator health encontrado.

Evidence:

- `backend/src/main/resources/application.yml`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/pom.xml`
- `docs/codebase/INTEGRATIONS.md`

Unknowns:

- [TODO] Não foi executado o backend contra uma instância operacional para confirmar payload/status de cada health indicator.
- [TODO] Não foi encontrado consumidor de infraestrutura no repositório.

## API-021 — Expor informações operacionais do backend

Method: `GET`  
Path: `/actuator/info`

Capability:

- CAP-025

Exposure: `OPERATIONAL`

Consumers:

- EXTERNAL/OPERATOR — NONE_FOUND no repositório.
- WEB — NONE_FOUND.
- MOBILE — NONE_FOUND.

Controller: Spring Boot Actuator auto-configurado; nenhum controller da aplicação para este path.

Request:

### Path params

| Nome | Tipo | Obrigatório | Validação |
|---|---|---:|---|
| — | — | — | Não há |

### Query params

| Nome | Tipo | Obrigatório | Default | Validação |
|---|---|---:|---|---|
| — | — | — | — | Não há |

### Headers relevantes

- `Authorization: Bearer <token>` é necessário pela regra `anyRequest().authenticated()`; somente health, login e OPTIONS são permitidos sem autenticação.
- Outros headers seguem o Actuator/Spring Boot.

### Request body

- Nenhum.

Response success:

- O path é exposto pela configuração `include: health,info`.
- O payload é produzido pelo Actuator info endpoint.
- Nenhum contributor `InfoContributor` da aplicação ou schema customizado foi encontrado; os campos exatos não são determináveis somente pelo repositório.

Error responses:

| HTTP | Condição | Origem |
|---:|---|---|
| 401 | chamada sem Bearer válido, pela regra global de segurança | `SecurityConfig`/`AuthFilter` |

Side effects:

- Nenhum side effect de aplicação encontrado.

Persistence:

- Nenhuma tabela/entidade de aplicação afetada pelo código encontrado.

Security:

- Exposição operacional, mas autenticação requerida pela regra global.
- Não há endpoint público específico para info.

Idempotency / repeated calls:

- Não altera dados de aplicação segundo o código encontrado.

Tests:

- Nenhum teste específico do Actuator info encontrado.

Evidence:

- `backend/src/main/resources/application.yml`
- `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java`
- `backend/pom.xml`

Unknowns:

- [TODO] Não foi executado o endpoint para determinar o JSON final.
- [TODO] Não foi localizado consumer, deployment ou dashboard.
- [TODO] A baseline funcional descreve explicitamente health em CAP-025, mas não descreve um capability separado para info; nenhum CAP novo foi criado.

## Integração HTTP externa observada no mobile

Esta chamada não é endpoint do backend Leitor e não entra na contagem de API-001 a API-021. Ela foi registrada porque é uma chamada HTTP adicional encontrada fora do serviço de sync.

### OUT-001 — Consulta de definição no Wiktionary

Method: `GET`  
URL observada: `https://{normalizedLanguage}.wiktionary.org/w/api.php`.

Consumer:

- MOBILE — `leitor-epub/src/services/lookup.ts::lookupDictionary`.

Capability principal:

- CAP-016 — Consultar léxico e definições.

Capability relacionada:

- CAP-014 — Executar ações sobre texto selecionado; no mobile, o lookup parte da seleção no reader.

Request:

- Query `action=query`, `prop=extracts`, `exintro=1`, `explaintext=1`, `redirects=1`, `format=json`, `origin=*` e `titles=<term>`.
- O idioma é normalizado localmente; o termo é trimado, espaços são compactados e o tamanho é limitado a 200 caracteres.
- Header `Accept: application/json`.
- Antes da chamada, o mobile procura cache SQLite válido por 30 dias.

Response observada no código:

- JSON com `query.pages[*].extract` e indicação opcional `missing`.
- O texto passa por sanitização de HTML/controles e limite de 8.000 caracteres.
- Resultado novo é persistido em `lookup_cache`.

Errors demonstrados:

- Resposta HTTP não-2xx vira erro “O dicionário está indisponível no momento.”
- Página ausente/sem extract vira erro de definição não encontrada.
- Termo vazio falha antes da chamada.

Integrações/effects:

- Wiktionary por HTTPS.
- SQLite mobile: leitura/escrita em `lookup_cache`.
- Não há endpoint backend correspondente.

Evidence:

- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/app/reader/[id].tsx`
- `leitor-epub/src/db/repository.ts`
- `leitor-epub/src/services/lexicon.ts`

Outros URLs externos encontrados no mobile (`dictionaryWebUrl`, `translateWebUrl` e `searchWebUrl`) apenas constroem links para Google que são abertos por ação de UI; não fazem chamada fetch própria e não foram catalogados como APIs.

## API Coverage Summary

- Total de endpoints backend catalogados: **21** — 19 endpoints de domínio + 2 endpoints Actuator expostos por configuração.
- Públicos por `SecurityConfig`: **2** — API-001 e API-020.
- Autenticados por `SecurityConfig`: **19** — API-002 a API-019 e API-021.
- Operacionais: **2** — API-020 e API-021. Esta classificação é semântica e se sobrepõe à autenticação de API-021.
- Consumidos pelo web: **17** — API-001 a API-013, além de API-015, API-016, API-017 e API-019.
- Consumidos pelo mobile: **14** — API-001, API-003, API-004, API-005, API-008, API-010 a API-018.
- Consumidos por ambos: **12** — API-001, API-003, API-004, API-005, API-008, API-010, API-011, API-012, API-013, API-015, API-016 e API-017.
- Sem consumidor encontrado no repositório: **2** — API-020 e API-021.
- Sem teste relacionado encontrado: **13** — API-001, API-002, API-004, API-006, API-007, API-008, API-010, API-012, API-013, API-014, API-015, API-020 e API-021.
- Teste direto HTTP de endpoint encontrado: **1** — API-003, somente cenário não autenticado. Os demais testes listados por API são unitários ou verificações estáticas de cliente.

## Divergences

### Chamada de cliente sem endpoint correspondente

- `leitor-epub/src/services/lookup.ts::lookupDictionary` chama Wiktionary diretamente; não há controller backend correspondente. É uma integração externa observada e foi registrada como OUT-001.
- Não foram encontradas chamadas fetch/axios de domínio no frontend fora do wrapper de `frontend/src/api.ts`. O `XMLHttpRequest` encontrado em `frontend/src/vendor/epubjsBundle.ts` pertence ao bundle de epub.js e não foi demonstrado como chamada de API do Leitor.

### Endpoint sem consumidor identificado

- API-020 e API-021 estão expostos, mas não possuem caller web/mobile nem monitor/deployment encontrado.
- API-021 é protegido por autenticação apesar de ser operacional; isso é consequência da regra global, não de consumer identificado.

### Request do cliente incompatível ou normalizado pelo backend

- Nenhum request do web/mobile usa campo que não exista no DTO correspondente.
- API-018: o mobile envia `limit=5000`, enquanto o service limita efetivamente o resultado a 2000. É uma divergência de expectativa de limite, não um erro de binding.
- API-004: o tipo TypeScript web exige `title`, `author` e `language`, enquanto o DTO backend aceita esses campos ausentes e aplica defaults. O cliente é mais restritivo que o backend.
- API-005: o mobile envia partes `epub` e `cover`, ambas aceitas; o web envia somente `epub`, também aceito.
- API-019: `term` é obrigatório no backend, e o web sempre o inclui no wrapper observado.

### Response esperado pelo cliente diferente do DTO

- O tipo `LexiconEntry` em `frontend/src/api.ts` não declara `id`, `bookId` e `updatedAt`, embora o backend sempre os inclua em `EntryResponse`. O cliente usa um subconjunto; não foi encontrado erro runtime demonstrando quebra.
- O tipo `LexiconJob` do web não declara os timestamps `createdAt`, `startedAt` e `finishedAt` presentes no DTO; novamente, o cliente usa subconjunto.
- O tipo `RemoteBook` mobile não reproduz todos os campos do `BookDtos.Response`, mas declara os campos usados no sync, incluindo `fileAvailable` e `coverAvailable`.
- Não foi encontrada incompatibilidade de tipo demonstrada para os demais responses.

### Documentação/OpenAPI divergente do código

- Não foram encontrados Springdoc, OpenAPI, Swagger ou anotações de contrato no backend.
- `leitor-epub/README.md` declara historicamente que não há conta/backend/sync, enquanto `login.tsx`, `sync.ts` e os controllers implementam esses fluxos.
- `ACCOUNT-SYNC.md` descreve livros/progresso/cards; o sync implementado também chama o léxico.
- O catálogo presente é baseado nos controllers/DTOs/configuração e não em README histórico.

### Autenticação divergente entre consumidor e backend

- Web e mobile usam `Authorization: Bearer` nos endpoints autenticados observados.
- O mobile não chama `/api/auth/me`; isso é diferença de consumo, não falha de autenticação.
- API-020 é pública e API-021 é autenticada pela regra global; não foi encontrado consumer que documente essa diferença.
- Não há evidência de cookies/sessão HTTP sendo usados pelos clientes.

### Endpoints sem testes

- Somente `SecurityConfigTest` testa uma rota HTTP diretamente: `GET /api/books` sem token.
- Não foram encontrados testes HTTP para login, usuário, CRUD de livros/cards, conteúdo binário, progresso, léxico ou Actuator.
- Os testes de service/static-client relacionados estão discriminados em cada API.

### Endpoints aparentemente mortos

- API-020 e API-021 não possuem consumidor interno conhecido, mas seus papéis de monitoramento/infraestrutura não podem ser classificados como mortos sem evidência de deployment/observabilidade.
- API-014 não possui wrapper web, mas é consumido pelo sync mobile.
- API-018 não possui consumer web, mas é consumido pelo sync mobile.
- Nenhum endpoint de domínio de controller ficou sem capability existente.

### CAPABILITY_CANDIDATE

CAPABILITY_CANDIDATE:

- Exposição de informações operacionais via `GET /actuator/info` — evidência: `backend/src/main/resources/application.yml` e dependência Actuator em `backend/pom.xml`. Não foi criada capability nova; a relação foi mantida junto de CAP-025 para rastreabilidade operacional e o gap de escopo foi preservado como unknown.

## Matriz de rastreabilidade

| API | Método/Path | Capability | Web | Mobile | Testado |
|---|---|---|---:|---:|---|
| API-001 | POST /api/auth/login | CAP-001 | sim | sim | não |
| API-002 | GET /api/auth/me | CAP-001 | sim | não | não |
| API-003 | GET /api/books | CAP-003, CAP-022 | sim | sim | sim — SecurityConfigTest, 401 |
| API-004 | POST /api/books | CAP-005, CAP-022 | sim | sim | não |
| API-005 | POST /api/books/{id}/content | CAP-005, CAP-022 | sim | sim | sim — book-upload.test.mjs, estático |
| API-006 | GET /api/books/{id}/file | CAP-008 | sim | não | não |
| API-007 | GET /api/books/{id}/cover | CAP-003 | sim | não | não |
| API-008 | PATCH /api/books/{id}/progress | CAP-010, CAP-022 | sim | sim | não |
| API-009 | DELETE /api/books/{id} | CAP-007 | sim | não | sim — BookServiceTest, service |
| API-010 | GET /api/cards | CAP-018, CAP-022 | sim | sim | não |
| API-011 | POST /api/cards | CAP-017, CAP-022 | sim | sim | sim — card-creation.test.mjs, estático |
| API-012 | PATCH /api/cards/{id} | CAP-018, CAP-022 | sim | sim via sync | não |
| API-013 | POST /api/cards/{id}/archive | CAP-018, CAP-022 | sim | sim via sync | não |
| API-014 | POST /api/cards/{id}/unarchive | CAP-018, CAP-022 | não | sim via sync | não |
| API-015 | POST /api/cards/{id}/move-to-end | CAP-018, CAP-022 | sim | sim via sync | não |
| API-016 | POST /api/books/{bookId}/lexicon/jobs | CAP-019, CAP-022 | sim | sim | sim — LexiconServiceTest/lexicon-start.test.mjs |
| API-017 | GET /api/books/{bookId}/lexicon/jobs/latest | CAP-019, CAP-022 | sim | sim | sim — bookDetails.test.ts, contrato local |
| API-018 | GET /api/books/{bookId}/lexicon | CAP-016, CAP-022 | não | sim | sim — lexicon-entry-contract.test.mjs, estático |
| API-019 | GET /api/books/{bookId}/lexicon/lookup | CAP-014, CAP-016 | sim | não | sim — lexicon-lookup/card-creation/entry-contract, estáticos |
| API-020 | GET /actuator/health | CAP-025 | não | não | não |
| API-021 | GET /actuator/info | CAP-025 | não | não | não |

## Evidências gerais

- `docs/codebase/ARCHITECTURE.md`
- `docs/codebase/STACK.md`
- `docs/codebase/STRUCTURE.md`
- `docs/codebase/INTEGRATIONS.md`
- `docs/codebase/TESTING.md`
- `docs/codebase/CONCERNS.md`
- `docs/system/SYSTEM-OVERVIEW.md`
- `docs/system/CAPABILITIES.md`
- `backend/src/main/java/br/com/leitormobile`
- `backend/src/main/resources/db/migration`
- `backend/src/main/resources/application.yml`
- `frontend/src/api.ts`
- `frontend/src`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/services/lookup.ts`
