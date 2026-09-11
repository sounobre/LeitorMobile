# Codebase Concerns

## Escopo

Esta lista não corrige problemas. Ela registra divergências, riscos técnicos e desconhecidos encontrados em código/configuração/execução. `Suggested action` é uma próxima verificação ou decisão, não uma alteração realizada nesta auditoria.

## 1) Riscos prioritários

| Severidade | Concern | Evidência | Impacto verificável | Suggested action |
|------------|---------|-----------|---------------------|------------------|
| high | Defaults de desenvolvimento para conta e senha estão ativos se as variáveis não forem fornecidas | `backend/src/main/resources/application.yml`, `backend/src/main/java/br/com/leitormobile/auth/DefaultAccountSeeder.java`, `ACCOUNT-SYNC.md` | o backend pode criar a conta `voce@exemplo.com` com `troque-esta-senha`; a própria documentação manda trocar fora da máquina local | `[ASK USER]` definir política de fail-fast/segredo obrigatório para ambientes não locais |
| high | Release Android usa o debug keystore e configuração de assinatura debug | `leitor-epub/android/app/build.gradle` (`release.signingConfig signingConfigs.debug` e comentário de cautela) | um build release pode ser assinado com credencial de desenvolvimento | substituir por keystore de release antes de distribuição; não feito nesta auditoria |
| high | Upload web não reutiliza a validação EPUB forte existente no mobile | `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`, `frontend/src/App.tsx`, `leitor-epub/src/services/epubImport.ts` | endpoint web verifica extensão no frontend, tamanho/hash/path no backend, mas não invoca checagens de mimetype, ZIP, DRM, layout ou recursos remotos | `[ASK USER]` decidir se a política mobile é requisito também para uploads web |
| high | README mobile contradiz o código atual sobre conta/backend/sincronização | `leitor-epub/README.md` diz que não há conta/backend/sync; `leitor-epub/app/login.tsx` e `src/services/sync.ts` implementam os três | operadores podem iniciar o fluxo errado e avaliar o produto contra uma versão histórica | escolher documento autoritativo e atualizar documentação em mudança separada |
| high | `ollama` está ativo por padrão apesar de documentação declarar profile opt-in | `backend/src/main/resources/application.yml` (`profiles.active: ollama`), `application-ollama.yml`, `OLLAMA-LOCAL.md` | uma inicialização padrão tenta habilitar o provider local e o job pode enriquecer candidatos; isso muda o modo operacional documentado | `[ASK USER]` decidir default real antes de qualquer uso fora do desenvolvimento |
| medium | Token de sync mobile é persistido em SQLite comum | `leitor-epub/src/db/migrations.ts` (`sync_session`), `leitor-epub/src/db/repository.ts`, `leitor-epub/src/services/sync.ts` | cópia/backup do banco ou do backup completo pode carregar o Bearer token; não há secure storage encontrado | `[ASK USER]` definir requisito de proteção de sessão e escopo de backup |
| medium | Proteção de exposição acumulada AI é somente memória do processo | `backend/src/main/java/br/com/leitormobile/ai/ExternalAiExposurePolicy.java` | reinício perde buckets; concorrência entre instâncias não compartilha limites | decidir se o limite é apenas guard local ou requisito persistente/distribuído |
| medium | O gateway de contexto AI não é chamado pelo fluxo atual e não grava auditoria | `ExternalAiContextGateway.java` tem `authorize`; `AiEnrichmentService.java` chama `decideMetadataOnly`/`gate.check` e grava `AiRequestAudit` diretamente | o seam de autorização de excerpts existe, mas não há evidência de uso real por chamadas context-bearing; chamadas mobile/web externas ficam fora desse gate | mapear callers efetivos antes de declarar cobertura integral da política |
| medium | Política de sync não cobre todos os dados locais | `leitor-epub/src/services/sync.ts` trata books/progress/content/lexicon/cards; `src/types/domain.ts` e `src/db/repository.ts` também têm annotations, bookmarks e preferences | estado local desses três tipos não é enviado ao backend pelo fluxo encontrado | `[ASK USER]` confirmar se o sync pretendido inclui annotations, bookmarks e preferências |
| low | Arquivo temporário com extensão `.tmp` está junto do código Java | `backend/src/main/java/br/com/leitormobile/lexicon/LexiconService.updated.tmp` | pode confundir revisão, busca e ferramentas; não é um `.java` compilado pelo Maven | confirmar se é artefato intencional e removê-lo em mudança separada, se autorizado |

## 2) Dívida técnica

| Item | Por que existe/estado | Onde | Risco se ignorado | Suggested fix |
|------|----------------------|------|------------------|---------------|
| Modelo lexical parcialmente conectado | migration adiciona `cards.source_type`, `cards.lexeme_id`, `cards.book_lexeme_id`; `Card.java` não mapeia esses campos | `V3__create_lexicon_schema.sql`, `Card.java` | cards não têm vínculo de domínio verificável com lexemes/book lexemes; evolução pode divergir do schema | revisar o modelo antes de alterar migrations |
| `BookSense` sem fluxo de persistência | entidade/tabela existem, mas o runner cria `DictionaryEntry`/`LexicalSense` e não cria `BookSense` | `BookSense.java`, `LexiconJobRunnerOptimized.java`, `V3__...sql` | sentidos específicos do livro permanecem sem contagem/confiança/status preenchidos | mapear requisito de sense resolution e testes |
| Analisador lexical heurístico | lematização remove sufixos por regras simples e POS usa sufixos | `LexicalAnalyzer.java` | flexões/lemmas e POS podem não representar todas as ocorrências; downstream depende desses valores | medir contra corpus/fixtures antes de trocar algoritmo |
| Dois runners e dois providers Ollama | `@Primary`/bridge/guard selecionam implementações entre classes duplicadas | `LexiconJobRunner.java`, `LexiconJobRunnerOptimized.java`, `ai/OllamaAiProvider.java`, `lexicon/OllamaAiProvider.java`, `OllamaComponentCollisionGuard.java` | aumenta complexidade de boot e risco de comportamento divergente entre código legado/otimizado | `[ASK USER]` escolher implementação canônica após confirmar cobertura |
| Contratos web/mobile não são um schema compartilhado | tipos são duplicados nos clientes e DTOs Java não geram contrato | `frontend/src/api.ts`, `leitor-epub/src/types/lexicon.ts`, `LexiconDtos.java` | mudanças de campos podem quebrar um cliente silenciosamente | introduzir contrato versionado se isso for requisito |

## 3) Segurança

| Risco | OWASP | Evidência | Mitigação atual | Gap |
|-------|-------|-----------|----------------|-----|
| Debug keystore em release | A05 / gestão de configuração | `leitor-epub/android/app/build.gradle` | comentário alerta que é cautela de produção | assinatura de produção não configurada |
| Credenciais padrão previsíveis | A07 | `application.yml`, `AuthService.java` | BCrypt para armazenamento e variáveis configuráveis | defaults não falham quando ausentes |
| Backup sem criptografia | N/A / exposição de dados | `leitor-epub/src/services/backup.ts`, `docs/PRIVACIDADE.md`, `app/backup.tsx` | usuário escolhe destino; checksums e validação antes da restauração | qualquer arquivo exportado contém EPUB/anotações sem criptografia |
| Upload web com validação menor que mobile | A04/A08 | `BookContentService.java` versus `epubSecurity.ts` | limite/hash/path do filesystem backend | sem validação EPUB estrutural/DRM/remoto no endpoint |
| CSRF desabilitado | A05 | `SecurityConfig.java` | API é stateless e usa Bearer | `[TODO]` confirmar deployment e política de origem; CORS permite origens configuráveis |
| Token local em SQLite | A07 | `sync_session` em `migrations.ts` | token não é armazenado em claro no backend; mobile necessita dele para sync | ausência de secure storage nativo encontrada |

## 4) Performance e escala

| Concern | Evidência | Sintoma atual | Risco de escala | Suggested improvement |
|---------|-----------|---------------|----------------|---------------------|
| Pré-leitura do EPUB para formar o conjunto de termos | `LexiconJobRunnerOptimized.java` coleta todos os tokens/unidades antes de `dictionaryCache.prime` | mantém estruturas e textos extraídos em memória do job | livros grandes pressionam heap; `EpubTextExtractor` também materializa unidades/sentenças | medir memória e definir streaming/limites explícitos |
| Importação completa de arquivo de dicionário local | `KaikkiDictionaryImporter.java`, arquivos Kaikki grandes encontrados pelo scan | hash e leitura streaming, mas chunks montam listas de entradas/SQL | custo de disco/tempo e janela de startup se habilitado | executar em comando operacional separado e observar batches |
| Job assíncrono dentro do processo | `@Async` em `LexiconJobRunnerOptimized` | status é persistido, mas execução não usa fila | reinício interrompe jobs; múltiplas instâncias não têm coordenação | decidir executor/queue/recovery antes de escalar |
| Polling por livro | `frontend/src/App.tsx` a cada 2s; `leitor-epub/app/index.tsx` a cada 2.5s | uma requisição por livro a cada intervalo enquanto tela está ativa | bibliotecas grandes multiplicam requests | definir endpoint agregado ou backoff se necessário |
| Guard AI e cache de dicionário locais à instância | `ExternalAiExposurePolicy.java`, `LexicalDictionaryCache.java` | estado não compartilhado entre instâncias/jobs | duplicação de requests e limites inconsistentes | persistir apenas se requisito de multi-instância for confirmado |

## 5) Áreas frágeis / churn

| Área | Por que frágil | Sinal de churn | Estratégia segura |
|------|----------------|----------------|------------------|
| `leitor-epub/app/reader/[id].tsx` | concentra leitura, seleção, tradução, dicionário, cards, annotations, navegação e links externos | aparece no histórico recente do Git mobile junto com a maior parte do app | mudanças pequenas, testes de device e fixtures do QA |
| `leitor-epub/src/db/repository.ts` e `migrations.ts` | schema, mapeamentos, sync IDs e snapshot no mesmo boundary | ambos estão modificados no working tree e no commit inicial recente | migration incremental + testes de upgrade/restore |
| `leitor-epub/src/services/sync.ts` | reconciliação de livros, progresso, lexicon e cards em um único fluxo | arquivo não rastreado no working tree e incluído no churn do commit recente | testes por entidade e cenários offline/colisão |
| `backend/src/main/java/br/com/leitormobile/lexicon/` | classes novas/legadas/bridge e pipeline de alto volume | histórico Git do backend raiz indisponível; o root não é Git; mobile tem só três commits | usar evidência de execução e não assumir churn do backend; `[TODO]` obter histórico do backend |

## 6) Divergências entre intenção declarada e implementação

1. `leitor-epub/README.md` declara “não há conta, backend, sincronização”; implementação possui `app/login.tsx`, `src/services/sync.ts`, tabelas `sync_session`/`sync_entity_map` e endpoints backend de autenticação/livros/cards.
2. `OLLAMA-LOCAL.md` declara profile `ollama` opt-in; `application.yml` define `spring.profiles.active: ollama`.
3. `README-WEB.md` descreve books/cards como fatia inicial e diz que upload seguro, seleção, citações e backup seriam adicionados; hoje há upload, leitor/seleção e léxico no web, enquanto citações/backup estão implementados no mobile. O backend web não executa a mesma validação EPUB do mobile.
4. `ACCOUNT-SYNC.md` documenta sync de livros/progresso/cards; o código também sincroniza o léxico, mas não sincroniza annotations, bookmarks ou preferências.
5. `docs/leitor-inteligente-copyright-aware-ai.md` exige `ExternalAiContextPolicy`, gate, metadata-only, contexto mínimo, exposição acumulada e auditoria; existem classes/tabela correspondentes, mas o fluxo atual de enriquecimento usa apenas metadata-only, o gateway não tem caller encontrado e a exposição agregada é em memória.
6. `leitor-epub/README.md` declara `Node.js 20.19.4 ou mais recente`; isso é suportado pelo `engines` do package, mas a execução desta auditoria usou Node instalado no host e não validou todos os requisitos Android/SDK em um device. `TODO`: executar matriz de release do `QA-ANDROID.md`.

## 7) `[ASK USER]` Perguntas de intenção

1. [ASK USER] Qual superfície é autoritativa para a auditoria: web + backend + mobile sincronizado, ou o mobile local-first como produto principal?
2. [ASK USER] O profile Ollama deve permanecer ativo por padrão em desenvolvimento ou precisa ser explicitamente habilitado?
3. [ASK USER] A validação de EPUB do mobile deve ser requisito obrigatório também para upload via web/backend?
4. [ASK USER] O sync deve incluir annotations, bookmarks e preferências, ou books/progresso/cards/léxico são deliberadamente o escopo atual?
5. [ASK USER] Antes de release, qual é a política aprovada para segredos, conta inicial, armazenamento seguro do token mobile, backup não criptografado e assinatura Android?
6. [ASK USER] O modelo alvo precisa separar formalmente `DictionaryEntry`, `BookSense` e `StudyCard` com vínculos lexicais, ou as colunas lexicais adicionadas a `cards` são legado não utilizado?
7. [ASK USER] Pode ser obtido o histórico Git do backend/root para uma análise real de churn? O comando no root retornou “not a git repository”; somente `leitor-epub/.git` está disponível.

## 8) Evidências

- `backend/src/main/resources/application.yml`
- `backend/src/main/java/br/com/leitormobile/book/BookContentService.java`
- `backend/src/main/java/br/com/leitormobile/ai/ExternalAiContextGateway.java`
- `backend/src/main/java/br/com/leitormobile/ai/ExternalAiExposurePolicy.java`
- `backend/src/main/java/br/com/leitormobile/lexicon/AiEnrichmentService.java`
- `backend/src/main/resources/db/migration/V3__create_lexicon_schema.sql`
- `leitor-epub/README.md`
- `leitor-epub/app/login.tsx`
- `leitor-epub/src/services/sync.ts`
- `leitor-epub/src/services/epubImport.ts`
- `leitor-epub/src/services/epubSecurity.ts`
- `leitor-epub/android/app/build.gradle`
- `docs/leitor-inteligente-copyright-aware-ai.md`
- `leitor-epub/docs/QA-ANDROID.md`

