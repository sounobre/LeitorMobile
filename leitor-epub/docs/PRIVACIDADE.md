# Política de privacidade — rascunho para publicação

Última atualização: 5 de setembro de 2026.

O Leitor EPUB funciona prioritariamente no aparelho. Livros importados, capas, posição de leitura, preferências, marcadores, citações, notas e histórico de dicionário ficam no armazenamento privado do aplicativo. Não é necessário criar conta e o aplicativo não possui backend próprio nem SDK de analytics de terceiros.

## Acesso a arquivos

O usuário escolhe cada EPUB ou backup pelo seletor de documentos do sistema. O aplicativo copia o item escolhido para sua área privada e não solicita acesso amplo ao armazenamento.

## Tradução e dicionário

A tradução usa modelos do Google ML Kit executados no aparelho. Quando um modelo ainda não estiver instalado, o componente do Google poderá baixá-lo; por padrão o aplicativo exige uma conexão Wi-Fi para esse download. O texto traduzido permanece no aparelho.

As consultas ao dicionário enviam o termo selecionado e o código do idioma para a edição correspondente do Wiktionary. A definição retornada é sanitizada e pode ser mantida temporariamente no cache local para uso offline. O uso do fallback “pesquisar na web”, de tradutores externos ou de links presentes no livro somente ocorre após ação explícita do usuário e está sujeito à política do serviço aberto.

## Backup

O backup é um ZIP versionado e **não criptografado**. Ele pode conter os livros e todas as anotações. O usuário escolhe onde compartilhá-lo ou salvá-lo e é responsável por protegê-lo. A restauração valida versão, caminhos e checksums antes de substituir os dados locais.

## Exclusão

Livros podem ser removidos individualmente dentro do aplicativo. A desinstalação remove os dados privados mantidos pelo aplicativo, salvo quando o sistema operacional ou o usuário conservar um backup externo.

## Contato

Antes da publicação, substitua este parágrafo e `suporte@example.com` em `app.json` pelo canal oficial de suporte e informe a entidade responsável pelo aplicativo.
