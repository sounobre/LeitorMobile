# Leitor web

Esta primeira base cria a aplicação web em duas partes:

- `backend`: Java 21, Spring Boot, JPA, Flyway e PostgreSQL;
- `frontend`: React, TypeScript e Vite.

## Executar localmente

1. Suba o banco na raiz:

   ```bash
   docker compose up -d postgres
   ```

2. Inicie a API:

   ```bash
   cd backend
   mvn spring-boot:run
   ```

3. Instale e inicie o frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

A API fica em `http://localhost:8080` e a interface em `http://localhost:5173`.

Esta fatia já persiste livros e cards. O upload seguro do EPUB, o motor epub.js, seleção de texto, citações e backup serão adicionados sobre os contratos existentes.
