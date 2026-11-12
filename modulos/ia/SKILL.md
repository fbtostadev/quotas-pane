---
name: quotas-pane
description: Instala e abre o painel de cards de cota (Claude Code, Codex, Antigravity) com botão de refresh num portal do Maestri. Use quando o usuário pedir o painel de quotas/cotas, os cards de cota, ou "abrir as cotas no portal".
---

# quotas-pane no Maestri

Os cards são uma página estática (`file://`) que lê `dados.js` ao lado dela. O portal do Maestri só precisa abrir esse arquivo.
Enquanto o pacote não estiver no npm, o comando é `npx github:fbtostadev/quotas-pane`; depois da publicação, `npx @fbtostadev/quotas-pane`.
Para operar o portal, siga a skill `maestri-portal`; aqui está só o que é específico do painel.

## Antes de começar

1. Confirme que está dentro do Maestri: `maestri list` deve responder. Se `maestri` não estiver no PATH, use `"$MAESTRI_CLI"`.
2. Confirme `node --version` (18 ou mais). Se faltar, pare e diga ao usuário; não instale Node por conta própria.

## Fluxo padrão (demonstração, sem dados reais)

```sh
npx github:fbtostadev/quotas-pane add web
npx github:fbtostadev/quotas-pane demo
npx github:fbtostadev/quotas-pane open --size 1200x560
```

`open` cria o portal "Cotas" conectado ao seu terminal, ou recarrega se ele já existir. Não feche o portal por conta própria.

## Conferir que funcionou

```sh
maestri portal evaluate "Cotas" "JSON.stringify({cards: document.querySelectorAll('#contas-grade > *').length, refresh: !!document.getElementById('refresh')})"
maestri portal screenshot "Cotas"
```

Esperado: `cards` maior que 0 e `refresh` verdadeiro. Abra a imagem da captura e confira os cards; não dê o trabalho por pronto só pelo comando.
Os e-mails aparecem com uma tarja pixelada na cor do texto (cinza-claro no tema escuro). Tarja preta é defeito (ver abaixo).

## Dados reais

Só se o usuário pedir. A página lê `dados.js` no formato descrito no README do pacote (`modulos/demo-contas.json` é um exemplo completo).
Quem grava esse arquivo é a fonte de dados do usuário: pergunte qual é, não invente uma. Depois de gravar, `maestri portal reload "Cotas"` mostra os números.
Se a fonte tiver um endpoint que força uma leitura, a URL vai em `data-refresh-url` no botão `#refresh` de `web/cotas-cards.html`.

## Problemas conhecidos

| Sintoma | Causa | O que fazer |
|---|---|---|
| Portal em branco ou sem cards | `dados.js` ausente ou fora do contrato | `npx github:fbtostadev/quotas-pane demo`, depois `maestri portal reload "Cotas"`; veja `maestri portal logs "Cotas"` depois de `logs-start` |
| Tarja do e-mail preta | `cotas.js` antigo (desenhava a tarja com o card fora do DOM) | `npx github:fbtostadev/quotas-pane add web` para atualizar `cotas.js` |
| "Leitura há N min" nos cards | O `dados.js` não é regravado | Regrave o `dados.js` na sua fonte, ou rode `npx github:fbtostadev/quotas-pane demo` de novo |
| `maestri portal create` recusa o caminho | Caminho relativo | `open` já usa caminho absoluto; ao chamar à mão, use `file:///caminho/absoluto/web/cotas-cards.html` |

## Regras

- Não imprima e-mails reais no chat nem em logs; a tarja existe por isso. Com dados reais, descreva os cards sem copiar o e-mail.
- Ao evaluar JavaScript no portal, não declare variáveis globais com nomes curtos (`el`, `s`): a página guarda o estado numa função fechada, mas o portal injeta as próprias.
- Quando mudar arquivos do `web`, rode `maestri portal reload "Cotas"` e confira de novo por captura de tela.
