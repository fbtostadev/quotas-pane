# quotasPane (`@fbtostadev/quotas-pane`)

Cards de cota de contas de IA (Claude Code, Codex, Antigravity) com botão de refresh, prontos para abrir num **portal do Maestri**.
Cada card mostra, por conta, o uso e o tempo decorrido das janelas de 5 horas e da Semana (cápsula de uso e tempo), o prazo
("deve durar até perto de…") e uma tarja de privacidade sobre o miolo do e-mail.

**A régua de tempo (barra de horas) é parte obrigatória do card e aparece sempre**, em toda janela e em todo estado:
- com o período conhecido (`renova_epoch` no futuro), mostra o decorrido, a agulha do agora e os cortes (5 de 1 h nas 5 horas, 7 de 24 h na Semana), mesmo com a leitura de uso velha, porque o tempo vem do relógio e não da leitura;
- sem período conhecido (sem `renova_epoch`, período já renovado ou prazo provisório), aparece vazia, com os cortes e sem agulha.

Os cards descendem do card H1 do `quota-board` (MIT, ver `LICENSE`).

## Instalação (uma linha)

Requer Node 18+ e o Maestri com o comando `maestri` no PATH. O repositório é público: não precisa de credencial.
Rode na pasta do projeto onde os cards devem ficar:

```sh
npx --yes github:fbtostadev/quotas-pane
```

Sem argumentos, o comando faz a instalação completa (`install`):

1. **Procura resíduos** do painel de cotas na pasta atual (até 4 níveis, sem `node_modules`, `.git` e `Library`) e na skill do usuário (`~/.claude/skills`).
2. **Atualiza o que é do pacote** (enxerto): uma instalação anterior do `quotas-pane` ou do antigo `quota-cards` recebe os arquivos novos no lugar.
   - Arquivo que você editou é guardado antes de ser trocado, em `quotas-pane/.anterior/<data>/`.
   - Instalação antiga sem manifesto (anterior à 0.2.0) vai inteira para `.anterior/` e é reinstalada.
   - O `dados.js` existente nunca é sobrescrito.
   - A skill antiga `quota-cards` vai para `.anterior/` (duas skills do mesmo painel confundiriam o Claude).
3. **Não mexe em painéis de terceiros** (Overview-Painel, quota-board, cotas-dashboard): só os lista. Se um deles tiver um `dados.js` com o bloco `contas` e você ainda não tiver dados, os cards passam a ler esse arquivo por um link simbólico. Assim aparecem as cotas reais do coletor que já roda na máquina.
4. **Sem dados, grava a demonstração** em `web/dados.js`.
5. **Instala a skill** `quotas-pane` em `./.claude/skills/quotas-pane`.
6. **Abre o portal** "Cotas" no Maestri, ou recarrega se já existir. Fora do Maestri, só mostra o comando.

No fim, o comando imprime um relatório: o que encontrou, o que atualizou, o que guardou e o que deixou como estava.
Rodar de novo é seguro e é o jeito de atualizar. A versão instalada fica em `quotas-pane/.quotas-pane.json`.
O comando se recusa a trocar uma versão instalada mais nova pela que está rodando. Isso acontece quando o `npx` usa uma cópia velha em cache; nesse caso, rode `npx --yes github:fbtostadev/quotas-pane#main`.

Depois que o pacote for publicado no npm, o prefixo vira `npx @fbtostadev/quotas-pane`. Para fixar uma versão: `npx github:fbtostadev/quotas-pane#<tag>`.

### Se o `npx` der "Unknown command"

Algum hook de shell está reescrevendo o comando. O RTK, por exemplo, troca `npx …` por `rtk npx …` e não entende `github:…`. Passe o comando direto:

```sh
rtk proxy npx --yes github:fbtostadev/quotas-pane
```

## Módulos

Para instalar só uma parte, use `add`. Cada módulo é uma pasta copiada para o seu projeto. Você pode editar os arquivos; não há dependência em tempo de execução.

| Módulo | O que é | Pasta |
|---|---|---|
| `web` | Os cards e o botão de refresh: `cotas-cards.html`, `cartao-cota.css`, `cotas.js` e os módulos puros `prazo.js`, `capsula.js`, `privacidade.js`, `resumo.js`, mais os ícones. Sem build, sem rede: abre por `file://`. | `./quotas-pane/web` |
| `ia` | Skill para o Claude Code instalar e abrir os cards no Maestri sem você explicar nada. | `./.claude/skills/quotas-pane` |

Comandos:

```sh
npx --yes github:fbtostadev/quotas-pane [install] [--dir D] [--sem-portal]   # instalação completa (padrão)
npx --yes github:fbtostadev/quotas-pane list                                 # módulos disponíveis
npx --yes github:fbtostadev/quotas-pane add <módulo...> [--dir D]            # só os módulos pedidos, com o mesmo enxerto do install
npx --yes github:fbtostadev/quotas-pane demo [--dir D]                       # dados de demonstração, com as horas deslocadas para agora
npx --yes github:fbtostadev/quotas-pane open [--dir D] [--nome N] [--size LxA]   # cria o portal, ou recarrega se já existir
npx --yes github:fbtostadev/quotas-pane help                                 # esta lista
```

## Contrato dos dados

A página não faz rede para ler dados. Ela carrega `dados.js` (ao lado dela, a cada 5 s) e espera:

```js
window.__painelDados && window.__painelDados({ contas: { consultadas: true, erro: null, lista: [ /* contas */ ] } });
```

Cada conta de `contas.lista` tem `id`, `ferramenta` (`claude`, `codex` ou `agy`), `ferramenta_nome`, `email`, `plano`, `situacao`, `lido_em_epoch` e `barras`.
Cada barra tem `tipo` (`5h` ou `semana`), `usado_pct`, `renova_epoch`, `janela_min`, `provisorio` e `grupo_rotulo` (aba do card; vazio no grupo principal).
O formato completo está em `modulos/demo-contas.json` (uma fixture de 6 contas). Qualquer fonte que grave esse arquivo serve: um script seu, um cron, um agente.

O botão de refresh lê o `dados.js` de novo. Se a sua fonte tem um endpoint que força uma leitura nova, ponha a URL em `data-refresh-url` no botão `#refresh`: ela recebe um POST antes da releitura.

## Para a IA (Claude Code)

`install` (ou `add ia`) instala a skill `quotas-pane`, que ensina o Claude a instalar, abrir o portal, conferir e resolver problemas comuns.
A skill se apoia na skill `maestri-portal` do Maestri (`maestri portal create/navigate/evaluate/screenshot`).

## Por que npm/npx e não só um .zip

Ver `DISTRIBUICAO.md`.

## Testes

```sh
npm test
```
