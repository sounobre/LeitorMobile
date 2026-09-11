# Leitor Inteligente — Arquitetura Copyright-Aware para Uso de IA Externa

**Status:** Proposta arquitetural para adoção  
**Escopo:** Processamento de EPUBs protegidos por direitos autorais e integração com provedores externos de IA, incluindo OpenAI/Luna  
**Objetivo principal:** Permitir a criação antecipada de um dicionário completo do livro e de cards de estudo sem transmitir a obra integral, nem uma reconstrução equivalente da obra, para um provedor externo de IA.

---

## 1. Contexto

O Leitor Inteligente permite que o usuário importe um EPUB em inglês e utilize o conteúdo para preparação linguística, leitura assistida e estudo.

Um dos objetivos centrais do produto é que, **antes mesmo de o usuário começar a ler**, o sistema tenha preparado um **Book Lexicon / Dicionário do Livro** suficientemente completo para que, durante a leitura, tocar em uma palavra abra imediatamente uma entrada já processada.

Exemplo de experiência desejada:

```text
Violet wielded the dagger...
       ↓
usuário toca em "wielded"
       ↓
word form = wielded
lemma = wield
       ↓
entrada lexical já existente
       ↓
abre imediatamente:
- definição
- tradução
- IPA
- áudio
- classe gramatical
- CEFR
- sentidos
- frequência no livro
- informações de estudo
- opção "Adicionar aos estudos"
```

A experiência de leitura **não deve depender de uma chamada em tempo real para IA**.

Ao mesmo tempo, obras comerciais protegidas por direitos autorais não devem ser tratadas como conteúdo automaticamente autorizado para transmissão integral a um serviço externo apenas porque o usuário possui uma cópia legítima do EPUB.

Por isso, a arquitetura deve separar claramente:

1. processamento integral local;
2. enriquecimento lexical por recursos locais/licenciados;
3. uso excepcional e mínimo de IA externa.

---

# 2. Decisão arquitetural principal

## ADR — Conteúdo integral de obras protegidas permanece local

O Leitor Inteligente deve adotar a seguinte regra:

> **O conteúdo integral de EPUBs protegidos por direitos autorais não deve ser transmitido a provedores externos de IA.**

O sistema pode processar localmente 100% da obra para realizar tarefas como:

- extração do EPUB;
- segmentação;
- tokenização;
- sentence splitting;
- lematização;
- POS tagging;
- contagem de frequência;
- identificação de capítulos e Reading Units;
- indexação de ocorrências;
- detecção determinística ou estatística de candidatos linguísticos;
- consulta a recursos lexicais locais ou adequadamente licenciados;
- criação do Book Lexicon;
- seleção dos poucos casos que realmente necessitam de interpretação por IA.

A IA externa deve atuar como **enriquecedor linguístico pontual**, não como processador integral do livro.

---

# 3. Regra de não reconstrução

É insuficiente apenas dividir o livro em chunks pequenos.

O seguinte comportamento deve ser considerado proibido pela arquitetura:

```text
capítulo 1 → IA
capítulo 2 → IA
capítulo 3 → IA
...
capítulo N → IA
```

Mesmo que cada chamada contenha apenas algumas centenas ou milhares de tokens, se o conjunto das chamadas transmite essencialmente toda a obra, o sistema terá enviado o livro integral de forma parcelada.

Portanto:

> **Chunking não deve ser utilizado como mecanismo para contornar a restrição de transmissão integral.**

Também devem ser evitadas estratégias como:

- enviar todas as frases do livro uma a uma;
- enviar três contextos para cada palavra sem necessidade;
- enviar todos os parágrafos apenas porque foram divididos;
- reconstruir progressivamente o livro no histórico de uma conversation/thread;
- armazenar texto integral do EPUB em logs de requests externos;
- enviar capítulos inteiros para classificação;
- usar batch de forma que, no agregado, represente praticamente todo o livro.

---

# 4. Princípio do contexto mínimo necessário

Toda chamada a um provedor externo deve seguir:

> **Enviar somente os metadados e o menor trecho textual necessário para resolver uma tarefa linguística específica.**

A ordem de decisão deve ser:

```text
É possível resolver sem texto do livro?
        │
        ├── SIM → não enviar texto.
        │
        └── NÃO
             ↓
É possível resolver com metadados + uma ocorrência curta?
        │
        ├── SIM → enviar somente essa ocorrência.
        │
        └── NÃO
             ↓
Selecionar o menor contexto adicional tecnicamente necessário.
```

O sistema nunca deve começar pela estratégia:

> "Envie contexto e depois veja se precisava."

A estratégia correta é:

> "Tente resolver localmente primeiro; só envie contexto quando houver necessidade concreta."

---

# 5. Objetivo: dicionário completo do livro antes da leitura

A restrição de envio não impede a construção de um dicionário amplo.

O Book Lexicon deve ser produzido primordialmente por processamento local.

Fluxo desejado:

```text
┌─────────────────────────┐
│ EPUB importado          │
│ conteúdo permanece local│
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ Extração e Reading Units│
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ NLP local               │
│ - tokens                │
│ - sentences             │
│ - lemma                 │
│ - POS                   │
│ - frequency             │
│ - occurrences           │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ Recursos lexicais       │
│ locais/licenciados      │
│ - definition            │
│ - translation           │
│ - IPA                   │
│ - CEFR                  │
│ - frequency bands       │
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│ BOOK LEXICON            │
│ milhares de entradas    │
└────────────┬────────────┘
             ↓
       ┌─────┴─────┐
       ↓           ↓
   resolvido    ambíguo
   localmente   / difícil
       ↓           ↓
    pronto     contexto mínimo
                   ↓
                IA externa
                   ↓
             enriquecimento
                   ↓
              Book Lexicon
```

---

# 6. Não confundir Word Form, Lexeme, Sense e Study Card

O sistema não deve criar um card independente para cada forma textual encontrada.

Modelo conceitual:

```text
WORD FORM
wielded
wielding
wields
    ↓
LEXEME
wield#VERB
    ↓
LEXICAL SENSE
wield#VERB#01 = empunhar/manejar
wield#VERB#02 = exercer poder/influência
    ↓
BOOK LEXEME / BOOK SENSE
informação específica daquela obra
    ↓
DICTIONARY ENTRY
entrada navegável durante a leitura
    ↓
STUDY CARD
opcional; somente se selecionado/sugerido
```

### Consequência

Podemos ter, por exemplo:

```text
6.200 entradas no Book Lexicon
850 recomendadas para o nível atual
120 cards ativos no SRS
```

A existência de uma entrada no dicionário **não significa** que ela precise entrar automaticamente no SRS.

---

# 7. Dados que devem ser obtidos sem IA externa sempre que possível

Para cada lexema, tentar preencher localmente:

- lemma;
- POS;
- formas flexionadas;
- IPA;
- definição lexical;
- tradução base;
- CEFR, quando disponível;
- frequência geral;
- frequência no livro;
- capítulos em que aparece;
- quantidade de ocorrências;
- primeira ocorrência;
- Reading Units relacionadas;
- variantes ortográficas;
- morfologia;
- status conhecido/desconhecido do usuário;
- pronúncia/áudio quando a fonte permitir;
- relações lexicais que existam em datasets adequados.

A IA externa não deve ser utilizada apenas porque consegue gerar esses dados.

Se uma fonte determinística adequada existir, ela deve ser preferida.

---

# 8. Casos adequados para IA externa

A IA externa pode ser útil quando houver ambiguidade linguística real.

Exemplos:

### 8.1 Desambiguação semântica

```text
lemma: charge
POS: verb

contexto mínimo:
[uma frase curta necessária para identificar o sentido]

retornar:
- sense_key
- significado contextual
- tradução curta
- confiança
```

### 8.2 Classificação de MWE

```text
candidate: "..."
POS/morphology: ...

contexto mínimo quando necessário

classificar:
- PHRASAL_VERB
- IDIOM
- COLLOCATION
- LITERAL
- OTHER
```

### 8.3 Explicação pedagógica

A partir de uma entrada lexical já resolvida:

```text
lemma: wield
sense: "to hold and use a weapon"
translation: "empunhar"
CEFR: B2
target_user_level: B1

gerar:
- definição em inglês apropriada ao nível
- nuance
- diferenças para sinônimos
- dica de aprendizagem
```

Observe que esse caso pode ser executado **sem enviar qualquer texto da obra**.

### 8.4 Relevância pedagógica

A IA pode receber dados estruturados:

```json
{
  "lemma": "wield",
  "pos": "VERB",
  "cefr": "B2",
  "bookFrequency": 23,
  "generalFrequency": "LOW",
  "userLevel": "B1",
  "alreadyKnown": false
}
```

e classificar:

```text
ESSENTIAL
RECOMMENDED
OPTIONAL
IGNORE
```

Nenhum trecho protegido precisa ser enviado.

---

# 9. Casos inadequados para IA externa

A aplicação não deve enviar:

- EPUB completo;
- arquivo original;
- texto completo de um capítulo;
- Reading Unit extensa sem necessidade específica;
- todos os parágrafos do livro;
- resumo baseado em transmissão integral do conteúdo;
- sequência de requests que cubra praticamente 100% do texto;
- coleção de contextos que permita reconstruir substancialmente a obra;
- conteúdo protegido apenas para reduzir trabalho de implementação local.

---

# 10. Política de seleção de contexto

Criar um componente dedicado, por exemplo:

```text
ExternalAiContextPolicy
```

Responsabilidades:

1. decidir se o request precisa de conteúdo da obra;
2. impedir envio quando metadados forem suficientes;
3. selecionar a menor ocorrência adequada;
4. limitar quantidade de ocorrências;
5. limitar tamanho textual;
6. registrar a justificativa técnica;
7. impedir envio acumulado indevido;
8. remover contexto desnecessário;
9. impedir capítulos/Reading Units completos;
10. produzir métricas auditáveis.

Exemplo de API interna:

```java
ExternalContextDecision decide(
    LinguisticTask task,
    Lexeme lexeme,
    List<Occurrence> occurrences
);
```

Resultado:

```java
ExternalContextDecision {
    boolean externalAiRequired;
    boolean copyrightedTextRequired;
    String justification;
    List<SelectedExcerpt> excerpts;
    int totalCharacters;
}
```

---

# 11. Privacy / Copyright Gate

Antes de qualquer integração externa, introduzir um gate:

```text
Linguistic Task
      ↓
CanResolveLocally?
      ↓
    YES ─────────────→ LOCAL
      │
      NO
      ↓
External AI useful?
      ↓
    NO ──────────────→ LOCAL / DEFERRED
      │
      YES
      ↓
Does request need book text?
      ↓
    NO ──────────────→ metadata-only request
      │
      YES
      ↓
Select minimum excerpt
      ↓
Copyright/Privacy Gate
      ↓
External provider
```

---

# 12. Estratégia para criação antecipada dos cards

O objetivo é que tocar em uma palavra durante a leitura não exija IA.

Pipeline de preparação:

```text
IMPORT
  ↓
EXTRACT
  ↓
TOKENIZE
  ↓
NORMALIZE
  ↓
LEMMA + POS
  ↓
BOOK FREQUENCY
  ↓
LEXICON LOOKUP
  ↓
SENSE RESOLUTION
  ↓
PEDAGOGICAL ENRICHMENT
  ↓
BOOK LEXICON READY
  ↓
CARD CANDIDATES
  ↓
READING READY
```

Durante a leitura:

```text
tap("wielded")
   ↓
resolve form → wield#VERB
   ↓
resolve contextual sense
   ↓
GET local dictionary entry
   ↓
render immediately
```

Nenhuma chamada obrigatória a Luna/OpenAI deve acontecer nesse fluxo.

---

# 13. Possível modelo de persistência

Exemplo conceitual:

```text
book
reading_unit
sentence
token_occurrence

lexeme
word_form
lexical_sense

book_lexeme
book_sense
book_sense_occurrence

dictionary_entry
dictionary_enrichment

study_card
user_lexeme_mastery
user_sense_mastery

external_ai_request_audit
```

### external_ai_request_audit

Sugestão de campos:

```text
id
book_id
provider
model
task_type
lexeme_id
sense_id
used_copyrighted_excerpt
excerpt_character_count
excerpt_count
reason
input_token_count
output_token_count
created_at
```

Não armazenar obrigatoriamente o conteúdo textual enviado.

Preferir armazenar:

- identificador/hash;
- tamanho;
- razão;
- origem;
- metadados de auditoria.

---

# 14. Controle de exposição acumulada

Além do limite por request, o sistema deve observar o agregado.

Exemplo de métricas:

```text
external_ai_excerpt_requests
external_ai_excerpt_characters
external_ai_unique_source_sentences
external_ai_unique_reading_units
external_ai_book_coverage_ratio
```

O objetivo é detectar situações em que chamadas individualmente pequenas estejam, em conjunto, cobrindo uma parcela excessiva da obra.

### Regra conceitual

> Não basta que cada request seja pequeno; a estratégia inteira também deve ser minimizadora.

Não definir neste ADR um percentual jurídico arbitrário como "X% é permitido".

Qualquer threshold técnico futuro deve funcionar como **proteção conservadora de engenharia**, não como declaração de limite legal.

---

# 15. Estratégia de fallback

Se uma entrada não puder ser resolvida adequadamente sem enviar contexto excessivo:

1. manter a definição lexical genérica;
2. marcar o sentido como `UNRESOLVED`;
3. permitir resolução local posterior;
4. opcionalmente resolver quando o usuário estiver lendo aquele trecho;
5. nunca aumentar automaticamente o contexto até chegar a capítulo/livro completo.

Exemplo:

```text
sense_resolution_status:
- RESOLVED_LOCAL
- RESOLVED_EXTERNAL_MIN_CONTEXT
- UNRESOLVED
- USER_CONFIRMED
```

---

# 16. Regras específicas para prompts enviados à IA

Prompts não devem solicitar reprodução da obra.

Evitar:

```text
"Continue o trecho."
"Retorne o parágrafo completo."
"Reproduza o contexto."
"Mostre todas as frases em que isso ocorre."
"Reconstrua a cena."
```

Preferir respostas estruturadas e mínimas:

```json
{
  "sense": "hold_and_use_weapon",
  "translationPtBr": "empunhar",
  "cefr": "B2",
  "confidence": 0.96
}
```

---

# 17. Outputs também devem ser minimizados

Mesmo quando um pequeno trecho for usado como Input, o sistema não deve pedir que o modelo devolva esse trecho.

O output ideal é:

- classificação;
- identificador de sentido;
- definição;
- tradução curta;
- explicação pedagógica;
- dados estruturados.

Não:

- reprodução do capítulo;
- reprodução da cena;
- grandes citações;
- reconstrução textual.

---

# 18. Separação entre dicionário e conteúdo do livro

Uma entrada persistida não deve funcionar como cópia do livro.

Exemplo adequado:

```text
WIELD

POS: verb
IPA: /wiːld/
PT-BR: empunhar; manejar
CEFR: B2

Sense 1:
to hold and use a weapon or tool

Book frequency: 23
Status: Recommended
```

O sistema pode referenciar internamente a ocorrência original por ID:

```text
first_occurrence_sentence_id = 9812
```

O texto original permanece na base local associada ao EPUB do usuário.

---

# 19. Critérios de aceite arquiteturais

A implementação será considerada aderente quando:

- [ ] o EPUB original nunca for enviado ao provedor externo;
- [ ] capítulos completos não forem enviados;
- [ ] Reading Units completas não forem enviadas automaticamente;
- [ ] chunking não puder ser usado para transmitir progressivamente toda a obra;
- [ ] toda chamada externa passar por um `ExternalAiContextPolicy`;
- [ ] tarefas metadata-only não carregarem texto da obra;
- [ ] contexto textual só for incluído quando tecnicamente necessário;
- [ ] o contexto selecionado for mínimo;
- [ ] houver métricas de exposição acumulada;
- [ ] o Book Lexicon puder ser criado majoritariamente sem IA externa;
- [ ] o card abrir durante a leitura sem depender de chamada externa;
- [ ] `DictionaryEntry` e `StudyCard` forem conceitos distintos;
- [ ] flexões apontarem para lexemas;
- [ ] lexemas puderem possuir múltiplos sentidos;
- [ ] respostas externas utilizarem preferencialmente structured output;
- [ ] logs não armazenarem inadvertidamente capítulos ou grandes trechos;
- [ ] falha de IA não impedir o usuário de ler o livro;
- [ ] entradas não resolvidas puderem permanecer como `UNRESOLVED`.

---

# 20. Testes obrigatórios

## Teste 1 — palavra conhecida

Entrada:

```text
dragon
```

Esperado:

```text
resolved locally
external API calls = 0
```

## Teste 2 — geração pedagógica sem contexto

Entrada:

```text
lemma = wield
sense = hold_and_use_weapon
target_level = B1
```

Esperado:

```text
external request allowed
copyrighted excerpt = false
```

## Teste 3 — ambiguidade contextual

Entrada:

```text
lemma = charge
multiple candidate senses
```

Esperado:

```text
local resolution fails
one minimal occurrence selected
external request allowed
full ReadingUnit NOT included
```

## Teste 4 — tentativa de capítulo

Entrada:

```text
task asks to send entire chapter
```

Esperado:

```text
BLOCKED_BY_EXTERNAL_CONTENT_POLICY
```

## Teste 5 — transmissão progressiva

Simular centenas de requests pequenos que, no agregado, tentem cobrir grande parte da obra.

Esperado:

```text
aggregate exposure protection triggered
requests blocked/degraded
```

## Teste 6 — leitura offline

Usuário toca em uma palavra cujo dicionário já foi preparado.

Esperado:

```text
dictionary displayed locally
external API calls = 0
```

---

# 21. Requisito não funcional sugerido

## NFR-COPYRIGHT-001 — Copyright-Aware External AI

**Descrição**

O conteúdo integral de obras protegidas importadas pelo usuário deve permanecer sob processamento local. Integrações com provedores externos de IA devem receber apenas dados estruturados e, quando indispensável para uma tarefa linguística específica, o menor trecho textual necessário.

**Regras**

1. Nenhum EPUB original pode ser transmitido.
2. Nenhum capítulo completo pode ser transmitido.
3. Chunking não pode resultar em transmissão progressiva da obra integral.
4. Metadata-only deve ser o comportamento padrão.
5. Contexto textual é exceção.
6. Toda exceção deve passar pelo External AI Context Policy.
7. A aplicação deve medir exposição acumulada por livro.
8. Falha ou bloqueio da IA externa não pode impedir leitura.
9. Logs devem ser tratados para evitar persistência acidental de conteúdo protegido.
10. O sistema não deve afirmar que determinada porcentagem de uma obra é juridicamente segura.

---

# 22. Requisito funcional sugerido

## FR-LEXICON-001 — Pré-geração do Book Lexicon

Ao preparar um livro, o sistema deve construir um Book Lexicon contendo todas as entradas lexicais identificáveis, independentemente de elas serem recomendadas para estudo.

Cada entrada deve ser associável a:

- lemma;
- POS;
- word forms;
- lexical senses;
- frequência no livro;
- ocorrências locais;
- CEFR quando disponível;
- definição;
- tradução;
- pronúncia/IPA quando disponível;
- status de resolução;
- relevância pedagógica;
- domínio do usuário.

O sistema deve distinguir:

```text
existir no dicionário
        ≠
ser recomendado
        ≠
virar card
        ≠
estar ativo no SRS
```

---

# 23. Resultado arquitetural esperado

A arquitetura final deve permitir simultaneamente:

### Completude

O sistema percorre **100% do EPUB localmente**.

### Instantaneidade

O dicionário já está preparado quando o usuário toca em uma palavra.

### Personalização

O sistema pode selecionar apenas o que o aluno ainda não domina.

### Eficiência

IA externa é usada somente onde agrega valor.

### Baixo custo

Grande parte do processamento não consome tokens de IA.

### Menor exposição de conteúdo

O livro não é transmitido integralmente, nem diretamente nem por chunking progressivo.

### Evolução

Após vários livros, o Book Lexicon pode alimentar um **Personal Lexicon** compartilhado entre obras:

```text
wield

books encountered: 4
total encounters: 47
dictionary opens: 4
SRS accuracy: 92%
mastery: MASTERED
```

O próximo livro pode aproveitar esse domínio sem recriar o mesmo aprendizado.

---

# 24. Orientação para implementação

Esta decisão deve ser tratada como **arquitetural e transversal**.

Antes de implementar integração com Luna/OpenAI, revisar:

- modelo de dados atual;
- pipeline atual de EPUB;
- ReadingUnit;
- entidades de vocabulário/cards existentes;
- serviços de NLP;
- integrações de IA;
- logs;
- cache;
- persistência de prompts/responses.

O objetivo inicial **não é reescrever o sistema**.

Primeiro:

1. mapear o estado atual;
2. identificar gaps contra este ADR;
3. propor a menor evolução arquitetural;
4. definir migrations necessárias;
5. dividir em histórias pequenas;
6. somente depois implementar.

---

# 25. Nota jurídica e de produto

Este documento estabelece uma **política conservadora de engenharia e produto**, e não constitui parecer jurídico.

A motivação inclui:

- os termos aplicáveis à API da OpenAI atribuírem ao cliente responsabilidade por possuir os direitos, licenças e permissões necessários sobre o Input;
- a legislação brasileira de direitos autorais prever limitações específicas, inclusive referências a pequenos trechos em determinadas situações, sem estabelecer uma autorização genérica para envio integral de livros comerciais a serviços externos.

Para produto comercial ou distribuição a terceiros, qualquer interpretação jurídica definitiva deve ser validada por profissional especializado.

---

# 26. Fontes normativas consultadas

Consultadas em setembro de 2026:

1. **OpenAI — Contrato de Prestação de Serviços**, especialmente a seção de Conteúdo do Cliente e obrigações relativas ao Input.
2. **OpenAI — Termos de Serviço**, seção aplicável à API.
3. **Brasil — Lei nº 9.610/1998**, especialmente arts. 5º, 7º e 46.

Essas fontes devem ser verificadas novamente caso a implementação seja transformada em produto comercial, pois termos de serviço e legislação aplicável podem mudar.

---

# 27. Prompt recomendado para o Codex

Use este documento como decisão arquitetural vinculante para a próxima análise.

```text
Analise o repositório atual do Leitor Inteligente à luz do documento
"Leitor Inteligente — Arquitetura Copyright-Aware para Uso de IA Externa".

IMPORTANTE:
- Não implemente código ainda.
- Não altere arquivos ainda.
- Não assuma que a arquitetura descrita no documento já existe.
- Faça grounding no código real do repositório.
- Considere o documento como arquitetura-alvo, não como descrição do estado atual.

Quero que você:

1. Mapeie o pipeline atual de importação e processamento de EPUB.
2. Identifique onde o texto integral do livro é armazenado/processado.
3. Mapeie todas as integrações atuais com LLMs/IA externa.
4. Identifique exatamente quais partes do conteúdo são enviadas hoje a provedores externos.
5. Mapeie o modelo atual de:
   - ReadingUnit;
   - tokens/ocorrências;
   - vocabulário;
   - lemma/POS;
   - sentidos lexicais;
   - dictionary entries;
   - cards;
   - SRS;
   - domínio do usuário.
6. Verifique se DictionaryEntry e StudyCard estão corretamente separados.
7. Verifique se word forms, lexemes e lexical senses estão corretamente modelados.
8. Compare o estado atual com todos os requisitos e critérios de aceite do documento.
9. Classifique cada requisito como:
   - IMPLEMENTED;
   - PARTIAL;
   - MISSING;
   - CONFLICTING.
10. Para cada conclusão, cite os arquivos/classes/métodos/tabelas reais que servem de evidência.
11. Identifique qualquer fluxo que possa transmitir:
    - EPUB completo;
    - capítulo;
    - ReadingUnit extensa;
    - sequência de chunks que, no agregado, cubra substancialmente a obra.
12. Proponha uma arquitetura mínima para introduzir:
    - ExternalAiContextPolicy;
    - Copyright/Privacy Gate;
    - metadata-only requests por padrão;
    - seleção de contexto mínimo;
    - controle de exposição acumulada;
    - auditoria de chamadas externas.
13. Avalie como construir antecipadamente o Book Lexicon completo sem transformar cada entrada em StudyCard.
14. Identifique quais dados podem ser resolvidos localmente e quais realmente justificam IA externa.
15. Proponha a decomposição da evolução em histórias pequenas e independentes.

Entregue como resultado:

A. CURRENT_STATE.md
B. GAP_ANALYSIS.md
C. TARGET_ARCHITECTURE.md
D. IMPLEMENTATION_ROADMAP.md
E. FEATURE_MAP.md

Não implemente até que esses artefatos sejam revisados e aprovados.

Regra fundamental:
o processamento local pode percorrer 100% do EPUB, mas a arquitetura não deve depender de transmitir a obra integral — direta ou progressivamente por chunks — para Luna/OpenAI ou qualquer outro provedor externo.
```

---

## Decisão resumida

> **O Leitor Inteligente deve conhecer o livro inteiro sem exigir que a IA externa conheça o livro inteiro.**

O EPUB é processado integralmente **localmente**.

A IA externa recebe prioritariamente **dados estruturados** e, somente quando indispensável, **contexto textual mínimo** para uma tarefa linguística específica.

O resultado é um Book Lexicon amplo, antecipado e instantâneo durante a leitura, com uso de IA externo controlado, auditável e minimizado.
