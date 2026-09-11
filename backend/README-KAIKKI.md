# Importação do Kaikki/Wiktionary

O backend importa o JSONL do Kaikki em streaming para o PostgreSQL. O snapshot não deve ser versionado no Git.

## Teste pequeno

Com um arquivo local, importe somente os primeiros registros:

```powershell
.\scripts\import-kaikki.ps1 -InputFile D:\LeitorMobile\data\kaikki\kaikki.org-dictionary-English.jsonl -MaxRecords 1000
```

## Carga completa

O snapshot específico de inglês pode ter vários gigabytes. Baixe-o apenas quando houver espaço e tempo disponíveis:

```powershell
.\scripts\import-kaikki.ps1 -Download
```

As tabelas de controle registram fonte, versão, hash, licença, progresso e erros em `dictionary_sources` e `dictionary_import_batches`.

O conteúdo derivado do Wiktionary segue CC BY-SA/GFDL. A aplicação deve manter os créditos e o link da licença em sua documentação ou tela de informações. Áudios e outros materiais externos devem ser tratados conforme suas licenças individuais.
