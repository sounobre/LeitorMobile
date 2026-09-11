# Roteiro de validação Android

Executar pelo menos em API 29 e na API estável atual, usando Development Build e também o APK/AAB de release.

## EPUB e retomada

- Importar fixtures EPUB 2 e EPUB 3 com capítulos, imagens locais, CSS, sumário e notas de rodapé.
- Confirmar rejeição de arquivo inválido, DRM, layout fixo, caminho com `..`, recurso remoto e compactação abusiva.
- Tentar importar duas vezes o mesmo arquivo e confirmar que apenas uma entrada existe.
- Abrir, avançar, encerrar o processo pelo sistema e conferir retomada no mesmo CFI.
- Alternar entre paginação e rolagem, orientação retrato/paisagem e todos os temas.

## Seleção

- Selecionar uma palavra, uma frase e um parágrafo; testar Copiar, Citação, Traduzir, Dicionário e Mais.
- Criar destaque, trocar cor, editar nota, tocar novamente no destaque e excluí-lo.
- Verificar que tradução/dicionário preservam a seleção até fechar o painel.
- Sem modelo instalado, testar download em Wi-Fi e falha previsível em rede móvel/offline.
- Confirmar cache do dicionário offline e confirmação antes de abrir links externos.

## Dados e backup

- Criar marcadores, citações e preferências; exportar e restaurar em uma instalação limpa.
- Corromper uma cópia do ZIP e confirmar que a biblioteca existente permanece intacta.
- Encerrar o processo durante importação/restauração e conferir que não há perda dos dados anteriores.

## Acessibilidade e qualidade

- Navegar com TalkBack, fontes do sistema grandes e contraste alto.
- Confirmar rótulos dos controles, ordem de foco e áreas de toque de no mínimo 48 dp.
- Testar rotação, modo escuro do sistema, aparelho com pouco armazenamento e processo recriado.
- No teste interno/fechado, acompanhar crashes, ANRs e Android Vitals antes de promover a versão.
