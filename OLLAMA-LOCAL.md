# Ollama local no Leitor

O backend usa Ollama como provedor local opcional para enriquecer metadados
lexicais. O texto integral do EPUB e os trechos selecionados não são enviados
ao modelo: a chamada contém apenas lema, classe gramatical e frequência.

O perfil `ollama` é opt-in. Sem ele, a preparação do léxico usa somente as
fontes locais e mantém o restante como `UNRESOLVED`.

## Opção A: Ollama instalado no host

Use esta opção quando o serviço Ollama já estiver instalado no Windows,
macOS ou Linux:

```powershell
$env:OLLAMA_NO_CLOUD = "1"
ollama pull qwen3.5:9b
$env:SPRING_PROFILES_ACTIVE = "ollama"
cd backend
mvn spring-boot:run
```

## Opção B: Ollama em Docker

Use esta opção quando o Docker Desktop estiver ativo. Não execute as duas
opções ao mesmo tempo, pois ambas usam a porta local `11434`:

```powershell
docker compose up -d postgres
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d ollama
docker exec leitor-ollama ollama pull qwen3.5:9b
$env:SPRING_PROFILES_ACTIVE = "ollama"
cd backend
mvn spring-boot:run
```

O modelo padrão é `qwen3.5:9b`, validado neste ambiente. Troque-o com
`OLLAMA_MODEL` quando necessário. O perfil chama `/api/chat` com `stream: false`,
temperatura zero e structured output JSON.

O endpoint fica vinculado a `127.0.0.1:11434`. Não o exponha na rede sem
autenticação e uma decisão explícita de implantação. O modo local desabilita
cloud com `OLLAMA_NO_CLOUD=1`; não use modelos com `cloud` no nome nesse perfil.
