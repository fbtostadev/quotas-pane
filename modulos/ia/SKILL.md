---
name: quotas-pane
description: Instala, atualiza e abre o painel de cards de cota (Claude Code, Codex, Antigravity) com botão de refresh num portal do Maestri. Use quando o usuário pedir o painel de quotas/cotas, os cards de cota, "abrir as cotas no portal", ou quando aparecer o comando npx github:fbtostadev/quotas-pane.
---

# quotas-pane no Maestri

Os cards são uma página estática (`file://`) que lê `dados.js` ao lado dela. O portal do Maestri só precisa abrir esse arquivo.
O pacote é público e só usa a biblioteca padrão do Node: o código está em github.com/fbtostadev/quotas-pane, se quiser lê-lo antes.
Para operar o portal, siga a skill `maestri-portal`; aqui está só o que é específico do painel.

## Instalar ou atualizar: um comando

Na pasta do projeto do usuário (pergunte qual, se não for óbvio; evite a home):

```sh
npx --yes github:fbtostadev/quotas-pane
```

Sem argumentos, o comando faz a instalação completa e é seguro repetir:
- Procura resíduos do painel de cotas na pasta e em `~/.claude/skills`.
- Atualiza instalações anteriores do pacote, guardando antes os arquivos editados em `quotas-pane/.anterior/<data>/`.
- Não toca em painéis de terceiros. Se um deles tiver `dados.js` com cotas reais, os cards passam a lê-lo por link simbólico.
- Grava dados de demonstração se não houver dados, instala esta skill no projeto e abre o portal "Cotas".

**Leia o relatório que ele imprime e repasse ao usuário**: o que foi encontrado, atualizado, guardado e ignorado. Não apague nada de `.anterior/` nem os painéis de terceiros listados.

Se o comando responder "Unknown command" ou algo vindo de `rtk`, um hook de shell está reescrevendo o `npx`. Rode `rtk proxy npx --yes github:fbtostadev/quotas-pane` e avise o usuário do motivo.
Se ele recusar porque a versão instalada é mais nova, o `npx` usou cópia em cache: rode `npx --yes github:fbtostadev/quotas-pane#main`.

Comandos menores, quando o usuário pedir só uma parte: `add web`, `add ia`, `demo`, `open [--nome N] [--size LxA]`, `list`, `help`.

## Conferir que funcionou

```sh
maestri portal evaluate "Cotas" "JSON.stringify({cards: document.querySelectorAll('#contas-grade > *').length, refresh: !!document.getElementById('refresh')})"
maestri portal screenshot "Cotas"
```

Esperado: `cards` maior que 0 e `refresh` verdadeiro. Abra a imagem da captura e confira os cards; não dê o trabalho por pronto só pelo comando.
Os e-mails aparecem com uma tarja pixelada na cor do texto (cinza-claro no tema escuro). Tarja preta é defeito (ver abaixo).

## Dados reais

A página lê `dados.js` no formato descrito no README do pacote (`modulos/demo-contas.json` é um exemplo completo).
Se o `install` ligou os cards ao `dados.js` de um painel já existente, os números vêm do coletor dele; o coletor precisa estar rodando para os números andarem.
Caso contrário, quem grava esse arquivo é a fonte de dados do usuário: pergunte qual é, não invente uma. Depois de gravar, `maestri portal reload "Cotas"` mostra os números.
Se a fonte tiver um endpoint que força uma leitura, a URL vai em `data-refresh-url` no botão `#refresh` de `web/cotas-cards.html`.

## Problemas conhecidos

| Sintoma | Causa | O que fazer |
|---|---|---|
| "Unknown command" ao rodar `npx` | Hook de shell (RTK) reescrevendo o comando | `rtk proxy npx --yes github:fbtostadev/quotas-pane` |
| Portal em branco ou sem cards | `dados.js` ausente ou fora do contrato | `npx --yes github:fbtostadev/quotas-pane demo`, depois `maestri portal reload "Cotas"`; veja `maestri portal logs "Cotas"` depois de `logs-start` |
| Tarja do e-mail preta | `cotas.js` antigo (desenhava a tarja com o card fora do DOM) | Rode o `install` de novo: ele atualiza o `cotas.js` |
| "Leitura há N min" nos cards | O `dados.js` não é regravado | Suba o coletor da fonte ligada, ou rode `demo` de novo |
| Dois painéis de cotas aparecem como skill | Skill antiga `quota-cards` ainda instalada | Rode o `install`: ele a guarda em `.anterior/` |
| `maestri portal create` recusa o caminho | Caminho relativo | `open` já usa caminho absoluto; ao chamar à mão, use `file:///caminho/absoluto/web/cotas-cards.html` |

## Regras

- Não imprima e-mails reais no chat nem em logs; a tarja existe por isso. Com dados reais, descreva os cards sem copiar o e-mail.
- Ao evaluar JavaScript no portal, não declare variáveis globais com nomes curtos (`el`, `s`): a página guarda o estado numa função fechada, mas o portal injeta as próprias.
- Quando mudar arquivos do `web`, rode `maestri portal reload "Cotas"` e confira de novo por captura de tela.
