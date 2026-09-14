# Estratégia de Testes

## Escopo e baseline

Esta estratégia projeta a validação do sistema implementado sem alterar produção, banco, migrations ou testes. A fonte de rastreabilidade é a baseline atual:

- `docs/codebase/*`
- `docs/system/SYSTEM-OVERVIEW.md`
- `docs/system/CAPABILITIES.md`
- `docs/system/API-CATALOG.md`
- `docs/system/USER-JOURNEYS.md`

A baseline contém 25 capabilities, API-001 a API-021, OUT-001, 27 journeys e zero E2E reais conhecidos. A matriz separa testes já existentes de cenários planejados; planejar um teste não significa implementá-lo nem declarar o comportamento como correto.

## Objetivos

1. Dar cobertura rastreável aos caminhos funcionais observáveis, contratos técnicos, persistência, segurança e integrações.
2. Separar comportamento implementado de comportamento aprovado pelo produto.
3. Priorizar riscos de autenticação, perda/corrupção/exposição de dados, upload, leitura, sincronização e jobs assíncronos.
4. Planejar E2E e device para uma fase posterior, sem executá-los nesta etapa.
5. Manter os testes pequenos e orientados a riscos, evitando combinações sem justificativa na baseline.

## Surfaces

| Surface | Escopo de validação |
|---|---|
| WEB | React/Vite, `App`, biblioteca, upload, reader web, seleção, lookup e fila web. |
| MOBILE | Expo/React Native, SQLite, filesystem privado, reader, seleção, cards, backup e integrações nativas. |
| BACKEND | Controllers, services, repositories, jobs, persistência PostgreSQL/filesystem e contratos HTTP. |
| CROSS-SURFACE | Comportamentos que atravessam mobile local e backend, especialmente sync e léxico compartilhado. |
| BACKEND/OPERATOR | Startup, recovery, importação Kaikki, Ollama local e Actuator observáveis por processo/operador. |

Um teste só cobre uma surface quando executa ou valida código pertencente a ela. Semelhança de conceito não transfere cobertura entre WEB e MOBILE. Um teste estático de fonte pode ser `DIRECT`/`RELATED`, mas nunca é E2E.

## Test Levels

| Level | Uso nesta estratégia | Limite |
|---|---|---|
| UNIT | Função, serviço, policy, repository isolado ou transformação determinística. | Não prova composição de módulos nem runtime completo. |
| COMPONENT | Componente/tela e seus estados com dependências controladas. | Não prova backend/dispositivo real quando mockado. |
| INTEGRATION | Módulos reais juntos, PostgreSQL, filesystem, persistência ou pipeline. | Requer ambiente reprodutível e limpeza de dados. |
| API | Request/response, autenticação, ownership, validação e efeitos dos endpoints. | Não substitui a jornada visual do cliente. |
| E2E_WEB | Navegador real atravessando UI web, API e backend. | Planejado; Playwright é adequado para esta superfície, mas não será executado agora. |
| E2E_MOBILE | Jornada completa do app em ambiente de execução mobile. | Requer ferramenta compatível com React Native e dispositivo/emulador; não presumir Playwright. |
| DEVICE | APIs nativas, WebView, Document Picker, Share, ML Kit, browser e filesystem real. | Requer aparelho/emulador e configuração nativa. |
| OPERATIONAL | Startup, scripts, health, recovery, importadores e providers locais. | Observa processo/configuração, não apenas uma função. |
| MANUAL | Exploração/aceitação em UI, device ou integração externa quando automação não é demonstrada. | Evidência deve registrar dados, ambiente e resultado observado. |

## Test Purpose

| Purpose | Regra de uso |
|---|---|
| ACCEPTANCE | Comportamento funcional válido e verificável pela capability/journey/API, sem depender de intenção aberta. |
| CONTRACT | HTTP, DTO, autenticação, persistência, formato ou integração que deve permanecer consistente. |
| CHARACTERIZATION | Registra comportamento implementado hoje sem promovê-lo automaticamente a regra ideal. |
| DEFECT_PROBE | Confirma ou refuta uma suspeita de defeito; não usa o comportamento suspeito como `Expected` normativo. |
| INTENT_REQUIRED | O resultado correto depende de decisão humana/produto; observa/reproduz sem inventar expected. |

## Expected behavior e base da expectativa

Cada entrada informa `Expected Basis` usando somente estas fontes:

- `CAPABILITY`: resultado descrito como capability verificável.
- `JOURNEY`: resultado observável na sequência da journey.
- `API_CONTRACT`: método, rota, request/response, autenticação ou efeito documentado no catálogo.
- `SECURITY_REQUIREMENT`: regra de autorização, isolamento, validação ou proteção sustentada pela implementação/documentação de segurança.
- `EXISTING_TEST`: comportamento já protegido por teste existente, sem elevá-lo a requisito de produto quando a baseline não o faz.
- `CHARACTERIZATION_ONLY`: fato observado que deve ser registrado, não aprovado como requisito.
- `HUMAN_DECISION_REQUIRED`: resultado em aberto; a matriz não inventa vencedor, política ou contrato.

Quando houver `UNKNOWN_INTENT`, divergência documental ou implementação suspeita, o teste será `CHARACTERIZATION`, `DEFECT_PROBE` ou `INTENT_REQUIRED`. Não haverá `ACCEPTANCE` que congele um bug candidato, escolha uma política de sync não decidida ou transforme lacuna de integração em regra.

## Prioridade

- **P0**: autenticação/ownership, criação e armazenamento de livros, exclusão, leitura/progresso, integridade de backup e sync quando há risco de perda, corrupção ou exposição significativa. Falha impede uso básico ou compromete dados.
- **P1**: léxico, cards, importação local, reader mobile, backup operacional e integrações importantes. Falha degrada uma parte relevante, mas não todo o produto.
- **P2**: tradução/links externos, detalhes operacionais, importação de catálogo, health/info, edge cases de menor impacto e observações de comportamento sem decisão.

Prioridade é do cenário, não somente da capability. A existência de uma API não a torna P0; o risco de dados, segurança e bloqueio de uso é o critério.

## Cobertura existente

Cada teste planejado registra:

- `DIRECT`: há teste existente que executa/valida diretamente parte do código da surface/caminho.
- `RELATED`: há teste de unidade/precondição/unidade adjacente pertencente ao fluxo, mas não da jornada completa.
- `NONE`: nenhum teste automatizado aplicável foi encontrado.

`EXISTING` em `Automation status` significa que há arquivo de teste na baseline. Isso não significa E2E, cobertura completa, aprovação de produto ou ausência de gaps. Os testes web atuais leem fonte e são contratos estáticos; os testes unitários/componentes/serviços também não são E2E.

## Automation status

- `EXISTING`: cenário já possui teste encontrado na baseline.
- `AUTOMATABLE_NOW`: pode ser implementado com os harnesses já observados, sem novo ambiente material.
- `REQUIRES_INFRASTRUCTURE`: depende de backend, PostgreSQL, browser, serviço externo, pipeline ou ambiente coordenado ainda não preparado.
- `REQUIRES_DEVICE`: depende de Android/iOS, módulo nativo, WebView, picker, share, browser ou filesystem real.
- `MANUAL_ONLY`: observação/aceitação operacional ou externa sem automação demonstrada nesta baseline.
- `BLOCKED_BY_INTENT`: não pode ter assertion normativa até uma decisão humana.

## Negative scenarios

Entram na matriz somente porque a baseline os sustenta: credencial/token ausente ou inválido; ownership de livro/card; request inválido; EPUB inválido, hash divergente ou duplicidade; arquivo ausente; progresso fora do domínio; card/livro inexistente; lookup sem resultado; job lexical em falha; backup inválido/corrompido; sync parcial/offline; e indisponibilidade de Wiktionary, Ollama, módulos nativos ou serviços de sistema. A expectativa registra rejeição/erro/observação documentada, sem inventar payload, status HTTP ou mensagem não demonstrados.

O `BUG_CANDIDATE` de `queueOrder` recebe somente `DEFECT_PROBE`: criação sequencial e “move to end” devem observar duplicidade/ordenação e confirmar ou refutar a suspeita. A matriz não prescreve `MAX + 1` nem qualquer correção.

## E2E e device roadmap

Os E2E atuais conhecidos são zero. As futuras jornadas WEB devem usar `E2E_WEB` para login/biblioteca, upload, leitura/progresso, seleção/lookup/card, exclusão e fila; Playwright é adequado para o navegador real, mas não será executado nesta fase. As jornadas MOBILE que cruzam telas devem usar `E2E_MOBILE` em runner compatível com React Native e `DEVICE` para picker, filesystem, WebView, ML Kit, Share, browser e navegação nativa. Não se assume que Playwright teste React Native nativo.

As jornadas de sync devem combinar testes `INTEGRATION`/`API` com dados locais e backend controlados, e só receber `ACCEPTANCE` após a política de conflitos ser decidida. Startup, Kaikki, Ollama e Actuator ficam em `OPERATIONAL`; Ollama/Wiktionary e recursos do sistema exigem doubles controlados ou execução manual/device quando a integração real for o objeto da observação.

## Test Data Requirements

Fixtures são requisitos de planejamento; nenhuma é criada nesta fase e nenhum EPUB protegido/dataset grande deve entrar no repositório.

- usuário válido, credencial inválida, token ausente/expirado e usuários/owners distintos;
- EPUB mínimo válido fluido, com e sem capa, versões EPUB 2/3 e arquivo com hash conhecido;
- EPUB inválido: extensão errada, ZIP/CRC inválido, MIME/container/OPF/spine ausente, layout fixo, DRM, recurso remoto, caminho inseguro e arquivo acima do limite;
- livro com arquivo ausente, livro duplicado por hash, hash divergente e livro remoto/local em estados distintos;
- livro lexicalmente preparado, job queued/running/completed/failed e lookup com entrada/sem entrada;
- card simples, card inválido, vários cards com identidades distintas, timestamps e `queueOrder` previamente ocupado;
- annotation, bookmark, preferência e progresso local para os cenários de sync ainda sem política definida;
- backup válido, snapshot vazio, backup corrompido, referências inválidas, path inseguro, checksum/manifest/CRC inválidos;
- snapshot Kaikki mínimo sintético, configuração de importação e resposta Ollama controlada/timeout;
- resposta Wiktionary com extract, página ausente, resposta não-2xx, resposta inválida e cache vigente/expirado;
- ambiente PostgreSQL/filesystem isolado, backend inicializado e aparelho/emulador com permissões nativas para a fase de execução.

## Regras de execução e evidência

Esta fase produz design, não implementação: não executar Playwright, não criar testes, não modificar código de produção, banco ou migrations. Na execução futura, cada resultado deve guardar TEST ID, commit/versão, fixture, ambiente, logs relevantes e artefatos suficientes para reproduzir a observação.

Critérios de saída da próxima fase: toda falha deve apontar para TEST ID e evidence; comportamento de `INTENT_REQUIRED` deve permanecer sem verdict normativo; `DEFECT_PROBE` deve registrar confirmação/refutação; E2E deve declarar a infraestrutura usada; e testes de uma surface não podem ser contados em outra apenas por semelhança de conceito.

## Rastreabilidade e validação desta estratégia

A matriz deve conter pelo menos uma entrada para FLOW-001 a FLOW-027. Todas as CAP-001 a CAP-025 devem aparecer em algum teste ou em teste `INTENT_REQUIRED`. Todas as API-001 a API-021 e OUT-001 devem aparecer quando tecnicamente aplicáveis, com APIs sem consumidor direto explicitamente classificadas como `NONE`/não aplicáveis no próprio cenário. A validação final deve conferir referências de arquivo, IDs e enumerações contra a baseline, sem executar suítes.
