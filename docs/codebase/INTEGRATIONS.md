# External Integrations

## Regra de classificação

São listados somente endpoints, SDKs, bancos, intents e fontes externas encontradas em código/configuração. Nenhum comportamento foi inferido a partir de nomes de variáveis.

## 1) Inventário

| Sistema | Tipo | Finalidade encontrada | Autenticação | Criticidade observável | Evidência |
|---------|------|-----------------------|--------------|------------------------|-----------|
| PostgreSQL | banco relacional | livros, usuários, sessões, cards, jobs e catálogo lexical | usuário/senha via `DATABASE_*` | alta para backend | `backend/src/main/resources/application.yml`, `backend/src/main/resources/db/migration/` |
| Ollama | HTTP local `/api/chat` | enriquecer candidatos lexicais com metadados estruturados | sem credencial no código; gate exige host local quando `local-only` | opcional no código, ativo pelo profile atual | `backend/src/main/java/br/com/leitormobile/ai/OllamaAiProvider.java`, `application-ollama.yml` |
| Kaikki/Wiktionary | arquivo JSONL/JSONL.GZ local | catálogo lexical, traduções, sentidos, exemplos, pronúncias e relações | download/importação local; URL de fonte registrada | opcional para enriquecer o catálogo | `backend/src/main/java/br/com/leitormobile/lexicon/KaikkiDictionaryImporter.java`, `backend/README-KAIKKI.md` |
| Wiktionary API | HTTP público mobile | fallback de definição quando não há entrada preparada/cache | sem token; request contém termo/idioma | fallback de lookup | `leitor-epub/src/services/lookup.ts` |
| Google Translate app | Android intent | abrir tradução externa após ação explícita do usuário | delegada ao app instalado | fallback/ação explícita | `leitor-epub/modules/expo-google-translate/android/src/main/java/expo/modules/googletranslate/ExpoGoogleTranslateModule.kt` |
| Google Translate web | URL HTTPS | fallback web de tradução | delegada ao navegador | fallback/ação explícita | `leitor-epub/src/services/lookup.ts` |
| Google Search | URL HTTPS | busca/definição externa após ação explícita | delegada ao navegador | fallback/ação explícita | `leitor-epub/src/services/lookup.ts` |
| Google Fonts | CSS remoto | fontes `DM Sans` e `Playfair Display` na web | nenhuma | visual web | `frontend/src/styles.css` |
| Google ML Kit | SDK nativo Android | identificação de idioma e tradução local; modelos podem ser baixados | SDK/serviço Google; `DownloadConditions.requireWifi()` quando solicitado | funcionalidade mobile | `leitor-epub/modules/expo-mlkit-language/android/build.gradle`, `ExpoMlkitLanguageModule.kt` |
| Expo/EAS | build/runtime tooling | empacotamento e builds mobile | configuração EAS contém projectId | desenvolvimento/distribuição | `leitor-epub/eas.json`, `leitor-epub/app.json` |

Não foram encontrados Kafka, RabbitMQ, SQS, Pub/Sub, gateway, service mesh, APM ou tracing distribuído.

## 2) Data stores

| Store | Papel | Camada de acesso | Risco técnico encontrado | Evidência |
|-------|-------|------------------|--------------------------|-----------|
| PostgreSQL | fonte remota para backend web/sync e catálogo lexical | Spring Data JPA, JdbcTemplate, Flyway | depende de conexão disponível no startup; erro histórico em `backend/erro20260909001.txt` quando conexão falhou | `application.yml`, `V1__...sql`, `erro20260909001.txt` |
| Filesystem backend `./data/library` | EPUBs e capas enviados ao backend | `BookContentService` | arquivos grandes e texto protegido ficam no filesystem do servidor; validação web é menor que a mobile | `BookContentService.java`, `docker-compose.yml` não monta esse diretório |
| SQLite mobile `leitor-epub.db` | livros, EPUB paths, annotations, bookmarks, cards, cache e léxico sincronizado | `expo-sqlite` e `src/db/repository.ts` | token de sync também fica na tabela local; backup é não criptografado | `migrations.ts`, `repository.ts`, `backup.ts` |
| Cache mobile | definição Wiktionary por 30 dias e entrada de léxico remoto persistida | `lookup.ts`, `repository.ts`, `services/lexicon.ts` | `upsertLexiconEntries` substitui todo o léxico do livro dentro de transação | `repository.ts` |

## 3) Segredos e credenciais

- Fontes: variáveis de ambiente para banco, CORS, conta padrão e URL/modelo Ollama (`application.yml`, `.env.example`, `application-ollama.yml`); sessão mobile/web usa token Bearer.
- Senha: o backend grava hash BCrypt com custo 12; tokens de sessão são armazenados como SHA-256, com expiração de 30 dias (`SecurityConfig.java`, `AuthService.java`, `SessionToken.java`).
- Hardcoding encontrado: defaults de desenvolvimento de banco e conta aparecem em `application.yml` e `.env.example`; o `app.json` contém package/bundle id e e-mail de suporte de exemplo.
- Rotação/revogação: `[TODO]` não foi encontrado endpoint de logout/revogação individual, nem mecanismo de rotação de credenciais documentado.
- O mobile persiste `token`, `email` e `api_base_url` em `sync_session`; não foi encontrada integração com armazenamento seguro nativo (`migrations.ts`, `repository.ts`).

## 4) Confiabilidade e falhas

- PostgreSQL/Flyway: conexão é necessária para inicialização; `backend/erro20260909001.txt` registra falha de startup por timeout de conexão em uma execução anterior.
- Ollama: timeout configurável de conexão/leitura, resposta estruturada JSON, tratamento de erro; `AiEnrichmentService` registra erro e mantém a preparação lexical local (`AiProperties.java`, `OllamaAiProvider.java`, `AiEnrichmentService.java`).
- Kaikki: importação em chunks transacionais, progresso e limite de erros; `[TODO]` não foi encontrada política de retry automático após erro de batch (`KaikkiDictionaryImporter.java`).
- Sync mobile: erros HTTP viram `SyncApiError`; login continua válido quando a sincronização inicial falha; a tela de biblioteca exibe erro/mensagem (`app/login.tsx`, `app/index.tsx`, `sync.ts`).
- Retry/backoff: não foi encontrado backoff ou circuit breaker. Polling de jobs é periódico no web/mobile (`frontend/src/App.tsx`, `leitor-epub/app/index.tsx`).

## 5) Observabilidade

- Logs: SLF4J registra fases/contagens do job, importação Kaikki e batches Ollama; as mensagens usam campos `jobId`, `bookId`, `batchStart`, `requestHash` e durações (`LexiconJobRunnerOptimized.java`, `AiEnrichmentService.java`).
- Auditoria: `ai_request_audit` guarda provider/model/task, status, contagens de tokens, hash e contagem de excerpt; o fluxo atual de `AiEnrichmentService` grava requests metadata-only (`AiRequestAudit.java`, `V3__create_lexicon_schema.sql`).
- Health: Actuator expõe `health` e `info` (`application.yml`).
- Métricas/tracing: `[TODO]` não foi encontrado exporter, Micrometer customizado, tracing ou endpoint para `ExternalAiExposureMetrics`.
- Gap de visibilidade: `ExternalAiExposurePolicy` mantém métricas em memória e não há endpoint que exponha `metrics(bookId, ...)` (`ExternalAiExposurePolicy.java`).

## 6) Evidências

- `backend/src/main/java/br/com/leitormobile/ai/OllamaAiProvider.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/KaikkiDictionaryImporter.java`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-ollama.yml`
- `leitor-epub/src/services/lookup.ts`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/db/migrations.ts`
- `frontend/src/styles.css`

