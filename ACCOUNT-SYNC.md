# Conta e sincronização

A primeira versão web/mobile usa uma única conta, mas o banco já relaciona os livros à tabela `app_users` para permitir várias contas depois.

## Backend

Defina a conta inicial antes de iniciar a API:

```powershell
$env:APP_AUTH_EMAIL="seu-email@example.com"
$env:APP_AUTH_PASSWORD="uma-senha-forte"
```

Se essas variáveis não forem definidas, os valores de desenvolvimento são `voce@exemplo.com` e `troque-esta-senha`. Troque-os antes de usar fora da máquina local.

## Web

O frontend usa `VITE_API_URL` quando definido; caso contrário, usa `http://localhost:8080/api`. O token fica no `localStorage` do navegador e é enviado como Bearer para os endpoints protegidos.

## Mobile

Copie `.env.example` para `.env` dentro de `leitor-epub` e coloque o IP do computador:

```text
EXPO_PUBLIC_API_URL=http://192.168.0.103:8080/api
```

O emulador Android usa `http://10.0.2.2:8080/api` por padrão. No celular físico, computador e aparelho precisam estar na mesma rede Wi-Fi e o firewall do Windows deve permitir a porta 8080.

Depois do login, o mobile envia livros, progresso e cards para a API. A leitura e o banco local continuam disponíveis no aparelho quando a rede estiver indisponível.
