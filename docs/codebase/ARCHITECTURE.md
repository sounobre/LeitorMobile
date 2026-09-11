# Architecture

## Escopo e distinção entre intenção e realidade

O documento `docs/leitor-inteligente-copyright-aware-ai.md` é uma proposta arquitetural vinculante para adoção futura, não uma descrição automática do estado atual. A arquitetura abaixo foi reconstruída a partir de classes, rotas, SQL e execução.

## 1) Estilo arquitetural encontrado

- Estilo principal: sistema multiaplicação com backend Spring organizado por pacotes de capacidade (`auth`, `book`, `card`, `lexicon`, `ai`) e dois clientes distintos: SPA web e app mobile local-first.
- Justificativa: controllers delegam a services; services usam repositories/SQL; o mobile usa rotas/telas, services de caso de uso e repository SQLite (`BookController.java`, `BookService.java`, `leitor-epub/app/index.tsx`, `leitor-epub/src/db/repository.ts`).
- Constraints verificáveis: o backend usa PostgreSQL/Flyway (`application.yml`, migrations); o app mobile mantém o EPUB em filesystem privado e dados em SQLite (`epubImport.ts`, `migrations.ts`); jobs de léxico rodam assincronamente no processo (`LexiconJobRunnerOptimized.java`).
- Não foi encontrada uma fila externa, um event bus ou um serviço separado de workers. O comportamento de escala horizontal do job não está especificado: `[TODO]`.

## 2) Fluxos do sistema

### Importação e preparação no mobile

```text
DocumentPicker -> bytes do EPUB -> hash/JSZip/XML -> filesystem privado + SQLite -> Reader WebView -> SQLite local
```

1. `leitor-epub/src/services/epubImport.ts` escolhe um arquivo, lê seus bytes e calcula SHA-256.
2. `validateEpubArchive` verifica estrutura EPUB, caminhos, limites de expansão, DRM/layout fixo e referências remotas.
3. O arquivo é copiado para `Paths.document/books`, a capa para `Paths.document/covers`, e os metadados são inseridos em `books`.
4. `leitor-epub/app/reader/[id].tsx` carrega o livro via `EpubReaderSurface`, que usa `@epubjs-react-native/core` e `useEpubFileSystem`.
5. Posição, annotations, bookmarks, cards, preferências e cache são persistidos por `leitor-epub/src/db/repository.ts`.

### Upload/preparação no web/backend

```text
React App -> POST /api/books -> POST /content -> filesystem backend + PostgreSQL -> POST /lexicon/jobs -> @Async extractor/analyzer -> PostgreSQL -> GET lookup
```

1. `frontend/src/App.tsx` calcula o SHA-256, cria o livro e envia o EPUB multipart.
2. `BookContentService.store` grava o arquivo em `./data/library/books` por padrão, após limite de 100 MB e verificação do hash quando não é manual.
3. `LexiconService.start` cria `LexiconJob` e chama `LexiconJobRunnerOptimized.runAsync`.
4. O runner extrai unidades XHTML/HTML via `EpubTextExtractor`, cria `ReadingUnit`, `Sentence`, `Lexeme`, `WordForm`, `BookLexeme` e `TokenOccurrence`, e faz lookup do dicionário local/catalogado.
5. Candidatos ainda `UNRESOLVED` passam por `AiEnrichmentService`, que envia batches de metadados para `OllamaAiProvider` quando `app.ai.enabled` e provider `ollama` estão ativos.
6. `LexiconController` oferece status/lista/lookup; o web e o mobile consomem a entrada preparada sem uma chamada de IA durante o lookup.

### Sincronização mobile/backend

```text
SQLite sync_session -> GET /books -> matching by fileHash -> upload content/progress -> GET lexicon -> GET/POST/PATCH cards
```

`leitor-epub/src/services/sync.ts` autentica, relaciona IDs locais/remotos, envia livros locais ausentes no backend, mescla progresso por timestamps, baixa o léxico remoto e reconcilia cards. Não há código nessa função para baixar e criar um livro local que exista somente no backend. Annotations, bookmarks e preferências não aparecem no payload de sincronização.

## 3) Responsabilidades

| Módulo | Possui | Não possui/encontrado | Evidência |
|--------|--------|----------------------|-----------|
| `auth` | login, hash de senha, token Bearer e usuário atual | conta multiusuário completa ou refresh/revogação de token encontrados | `AuthService.java`, `AuthFilter.java`, `SecurityConfig.java` |
| `book` | metadata, progresso, paths de conteúdo e upload/abertura | validação ZIP/DRM equivalente à do mobile no endpoint web | `BookContentService.java`, `epubImport.ts` |
| `card` | entidade independente com texto selecionado, campos lexicais, fila e archive | vínculo JPA efetivo com `Lexeme`/`BookLexeme` apesar das colunas SQL adicionadas | `Card.java`, `V3__create_lexicon_schema.sql` |
| `lexicon` | pipeline de extração, normalização heurística, catálogo local/Kaikki, job e lookup | tokenização NLP robusta ou persistência do texto integral de sentença | `EpubTextExtractor.java`, `LexicalAnalyzer.java`, `Sentence.java` |
| `ai` | provider Ollama, structured output, gate, limite de contexto e guard de exposição em memória | provider externo além de Ollama ou caller atual de `ExternalAiContextGateway` encontrados | `OllamaAiProvider.java`, `ExternalAiContextGateway.java`, `AiEnrichmentService.java` |
| mobile `src/db` | SQLite, snapshots, cache e IDs de sync | sincronização de annotations/bookmarks/preferences encontrada | `repository.ts`, `sync.ts` |
| mobile `src/services/lookup` | fallback Wiktionary e URLs externas após ação do usuário | controle pelo gate do backend para essas chamadas mobile | `lookup.ts`, `app/reader/[id].tsx` |

## 4) Padrões reutilizados

| Padrão | Local | Evidência/efeito encontrado |
|--------|-------|----------------------------|
| Repository | interfaces Spring Data e `leitor-epub/src/db/repository.ts` | centraliza queries JPA/SQL e mapeamento de dados |
| Service layer | `BookService`, `CardService`, `LexiconService`, `AuthService` | concentra transações e orquestração |
| Adapter | `DatabaseBackedLexicalDictionary` sobre `LocalLexicalDictionary`; `useEpubFileSystem` sobre APIs legacy | combina catálogo SQL com fallback e adapta filesystem ao leitor |
| Async job + checkpoint | `@Async` em `LexiconJobRunnerOptimized` e `REQUIRES_NEW` em `LexiconJobProgressWriter` | permite polling de status durante processamento |
| Cache | `LexicalDictionaryCache`, `DictionaryEntryCache`, SQLite `lookup_cache`/`lexicon_entries` | reduz lookups repetidos e mantém resultados locais |
| Policy/Gate | `ExternalAiContextPolicy`, `ExternalAiExposurePolicy`, `CopyrightPrivacyGate` | define autorização técnica para contexto AI; o gateway não é usado no fluxo atual de enriquecimento |

## 5) Riscos arquiteturais conhecidos

- A validação forte de EPUB existe no mobile, mas o upload web grava o arquivo sem chamar `epubSecurity`; isso deixa duas políticas de ingestão diferentes (`BookContentService.java` versus `epubImport.ts`).
- O guard de exposição AI é um `ConcurrentHashMap` em memória; reinício do backend elimina o agregado. A tabela `ai_request_audit` registra batches metadata-only do serviço, não reservas feitas pelo gateway.
- A estrutura de alvo propõe DictionaryEntry/StudyCard, flexões, sentidos e exposição auditável; a implementação possui parte das tabelas/entidades, mas `BookSense` não é populado pelo runner e `Card` não usa as colunas lexicais adicionadas na migration.
- O job é assíncrono dentro do mesmo processo e o fluxo força apagamento/recriação de ocorrências, book lexemes e reading units antes de processar; `[ASK USER]` decidir política desejada para concorrência/reprocessamento em produção.

## 6) Evidências

- `backend/src/main/java/br/com/leitormobile/lexicon/LexiconJobRunnerOptimized.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/EpubTextExtractor.java`
- `backend/src/main/java/br/com/leitormobile/ai/AiEnrichmentService.java`
- `backend/src/main/java/br/com/leitormobile/ai/ExternalAiContextGateway.java`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/repository.ts`
- `frontend/src/App.tsx`

