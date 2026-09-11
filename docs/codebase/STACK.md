# Technology Stack

## Escopo e regra de evidência

Este mapa descreve o que foi encontrado no repositório em 11/09/2026. Os READMEs são tratados como intenção declarada; os valores abaixo foram confirmados em manifests, configuração ou execução. Artefatos em `target/`, `dist/`, `node_modules/`, `.expo/` e `.gradle/` não são usados como fonte de convenções de código.

## 1) Resumo dos runtimes

| Área | Valor encontrado | Evidência |
|------|------------------|-----------|
| Backend | Java 21; Spring Boot 3.4.5; Maven | `backend/pom.xml` (`java.version`, parent e artifact) |
| Frontend web | TypeScript 5.7.3; React/React DOM 19.2.3; Vite 5.4.15 | `frontend/package.json` |
| App mobile | TypeScript ~6.0.3; Expo ~57.0.20; React Native 0.86.3 | `leitor-epub/package.json` |
| Node do mobile | `>=20.19.4` | `leitor-epub/package.json` (`engines.node`) |
| Android mobile | min/compile/target SDK 29/36/36; Hermes e New Architecture habilitados no projeto gerado | `leitor-epub/app.json`, `leitor-epub/android/gradle.properties` |
| Banco do backend | PostgreSQL 16 no compose; JPA/Hibernate e JdbcTemplate no código | `docker-compose.yml`, `backend/pom.xml`, `backend/src/main/java/br/com/leitormobile/lexicon/DatabaseBackedLexicalDictionary.java` |
| Banco do mobile | SQLite com WAL, foreign keys e FTS habilitado via configuração Expo | `leitor-epub/src/db/migrations.ts`, `leitor-epub/app.json` |
| Orquestração local | Docker Compose para PostgreSQL e, opcionalmente, Ollama | `docker-compose.yml`, `docker-compose.ollama.yml` |

Não há manifesto de stack na raiz: os manifests estão separados em `backend/`, `frontend/` e `leitor-epub/`. O diretório raiz não é um repositório Git; `leitor-epub/` possui um Git próprio.

## 2) Frameworks e dependências de produção

| Dependência | Versão | Papel encontrado | Evidência |
|-------------|--------|------------------|-----------|
| `spring-boot-starter-web` | herdada de Spring Boot 3.4.5 | API HTTP Spring MVC/Tomcat | `backend/pom.xml` |
| `spring-boot-starter-security` | herdada | filtro e cadeia de autenticação | `backend/pom.xml`, `backend/src/main/java/br/com/leitormobile/auth/SecurityConfig.java` |
| `spring-boot-starter-data-jpa` | herdada | entidades/repositórios JPA | `backend/pom.xml`, `backend/src/main/java/br/com/leitormobile/book/Book.java` |
| `spring-boot-starter-validation` | herdada | validação de DTOs HTTP | `backend/pom.xml`, `backend/src/main/java/br/com/leitormobile/book/BookDtos.java` |
| Flyway | herdada de Spring Boot; módulos PostgreSQL presentes | migrations SQL | `backend/pom.xml`, `backend/src/main/resources/db/migration/` |
| PostgreSQL JDBC | runtime | conexão do backend | `backend/pom.xml`, `backend/src/main/resources/application.yml` |
| `spring-boot-starter-actuator` | herdada | endpoints `health` e `info` expostos | `backend/pom.xml`, `backend/src/main/resources/application.yml` |
| React / React DOM | 19.2.3 | UI web | `frontend/package.json` |
| Vite | 5.4.15 | servidor e bundling web | `frontend/package.json`, `frontend/vite.config.ts` |
| Expo / Expo Router | ~57.0.20 / ~57.0.19 | runtime e roteamento mobile | `leitor-epub/package.json`, `leitor-epub/app/_layout.tsx` |
| `expo-sqlite` | ~57.0.2 | persistência local mobile | `leitor-epub/package.json`, `leitor-epub/src/db/migrations.ts` |
| `@epubjs-react-native/core` | 1.4.7 | renderização EPUB mobile | `leitor-epub/package.json`, `leitor-epub/src/reader/EpubReaderSurface.tsx` |
| `jszip` / `fast-xml-parser` | ^3.10.1 / ^5.11.1 | leitura e validação de EPUB/backup mobile | `leitor-epub/package.json`, `leitor-epub/src/services/epubImport.ts` |
| `react-native-webview` | 13.16.1 | WebView usada pelo leitor mobile | `leitor-epub/package.json`, `leitor-epub/patches/@epubjs-react-native+core+1.4.7.patch` |
| Google ML Kit Translate/Language ID | 17.0.3 / 17.0.6 | módulos nativos para tradução/identificação local Android | `leitor-epub/modules/expo-mlkit-language/android/build.gradle` |

O frontend web não possui dependência de `react-router`; a navegação é estado local em `frontend/src/App.tsx`. O mobile possui rotas Expo Router em `leitor-epub/app/`.

## 3) Toolchain de desenvolvimento

| Ferramenta | Uso encontrado | Evidência |
|------------|----------------|-----------|
| Maven Surefire/Spring Boot Test/JUnit/Mockito | testes Java unitários, web e JDBC | `backend/pom.xml`, `backend/src/test/java/` |
| TypeScript strict | verificação de tipos web e mobile | `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, `leitor-epub/tsconfig.json` |
| ESLint flat config Expo | lint mobile | `leitor-epub/eslint.config.js` |
| Jest Expo | testes mobile | `leitor-epub/package.json`, `leitor-epub/src/**/*.test.ts` |
| Node `node:test` | testes estáticos do frontend | `frontend/*test.mjs` |
| `patch-package` | reaplicação do patch do leitor após instalação | `leitor-epub/package.json`, `leitor-epub/patches/` |

Não foram encontrados arquivos de configuração ESLint/Prettier no frontend web, Checkstyle/Spotless no Maven, nem configuração de CI/CD no scan do repositório.

## 4) Comandos declarados

Backend:

```bash
cd backend
mvn spring-boot:run
mvn -q test
```

Frontend web:

```bash
cd frontend
npm install
npm run dev
npm run build
```

Os cinco testes `.mjs` podem ser executados diretamente com `node --test`; não existe script `test` em `frontend/package.json`.

Mobile:

```bash
cd leitor-epub
npm install
npx expo prebuild --platform android
npm run android
npm start
npm run typecheck
npm run lint
npm test -- --runInBand
```

## 5) Ambiente e configuração

- Configuração do backend: `backend/src/main/resources/application.yml`, `backend/src/main/resources/application-ollama.yml`, `.env.example` e variáveis `DATABASE_*`, `PORT`, `CORS_ALLOWED_ORIGINS`, `APP_AUTH_EMAIL`, `APP_AUTH_PASSWORD`, `OLLAMA_MODEL`, `OLLAMA_MAX_CANDIDATES`.
- Configuração web: `frontend/.env.local` e `VITE_API_URL`, com fallback `http://localhost:8080/api` em `frontend/src/api.ts`.
- Configuração mobile: `leitor-epub/.env.example`, `leitor-epub/.env` e `EXPO_PUBLIC_API_URL`, com fallback Android `http://10.0.2.2:8080/api` em `leitor-epub/src/services/sync.ts`.
- O profile `ollama` está configurado como ativo em `application.yml`; a intenção declarada em `OLLAMA-LOCAL.md` diz que ele seria opt-in. A divergência está registrada em `CONCERNS.md`.
- Não foi encontrado `app.dictionary.*` em `application.yml`; `DictionaryProperties` possui defaults e `DictionaryImportStartup` só importa quando `importOnStartup` estiver habilitado. `TODO`: confirmar o modo operacional usado para importar o catálogo Kaikki em ambientes reais.
- Não há Dockerfile do backend ou frontend. Os únicos serviços Docker declarados são PostgreSQL e Ollama.

## 6) Evidências

- `backend/pom.xml`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-ollama.yml`
- `frontend/package.json`
- `leitor-epub/package.json`
- `leitor-epub/app.json`
- `docker-compose.yml`
- `docker-compose.ollama.yml`

