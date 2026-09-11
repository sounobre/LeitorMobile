# Leitor EPUB

Aplicativo mobile local-first para EPUB 2/3 fluido sem DRM. A primeira versão é voltada a Android 10 ou superior e já mantém a configuração preparada para iOS.

## O que está implementado

- Biblioteca local em SQLite com WAL, chaves estrangeiras, migrações e consultas parametrizadas.
- Importação pelo seletor do sistema, armazenamento privado, SHA-256 para duplicatas, capa e metadados.
- Validação contra DRM, layout fixo, caminhos maliciosos, ZIP bomb e recursos remotos automáticos.
- Leitura paginada ou em rolagem, temas claro/sépia/noturno, fonte, tamanho, espaçamento, margens e alinhamento.
- Retomada por CFI, progresso incremental, sumário, pesquisa, marcadores, citações coloridas e notas.
- Menu de seleção: Copiar, Citação, Traduzir, Dicionário e Mais.
- Tradução local pelo ML Kit em um módulo Expo Android, com download sob demanda somente por Wi-Fi.
- Wiktionary sanitizado com cache local e fallbacks externos abertos somente após ação do usuário.
- Backup ZIP versionado com checksums, arquivos EPUB, capas e todas as entidades locais.

## Ambiente

- Node.js `20.19.4` ou mais recente (também são aceitas as linhas suportadas 22/24).
- Android Studio com SDK 36 e um dispositivo/emulador API 29 ou superior.
- JDK compatível com o React Native usado pelo Expo SDK 57.

O módulo ML Kit é nativo, portanto o aplicativo **não funciona integralmente no Expo Go**. Use um Development Build.

```sh
npm install
npx expo prebuild --platform android
npm run android
```

Depois que o Development Build estiver instalado:

```sh
npm start
```

## Verificações locais

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

O patch em `patches/@epubjs-react-native+core+1.4.7.patch` é reaplicado pelo `postinstall`. Ele mantém pop-ups e navegação remota bloqueados na WebView e serializa CFIs antes de injetá-los. Não remova o patch ao atualizar o motor: primeiro revalide a política de segurança e a seleção nativa.

## Estrutura

- `app/`: rotas Expo Router da biblioteca, leitor e backup.
- `src/db/`: migrações e repositórios SQLite.
- `src/reader/`: superfície EPUB, adaptador de filesystem e contratos da ponte.
- `src/services/`: importação segura, dicionário e backup.
- `modules/expo-mlkit-language/`: módulo Expo Android para identificação e tradução local.
- `docs/`: privacidade e roteiro de validação Android.

## Release

Os valores `com.example.leitorepub`, `suporte@example.com`, título e ícone são centralizados em `app.json` e devem ser substituídos pelos dados comerciais definitivos antes da Play Store. Os perfis `development`, `preview` e `production` estão em `eas.json`; produção gera AAB.

Não há conta, backend, sincronização, DRM, layout fixo, mídia interativa, leitura em voz alta, analytics de terceiros ou nuvem nesta versão.
