# quotasPane (`@fbtostadev/quotas-pane`)

Cards de cota de contas de IA (Claude Code, Codex, Antigravity) com botão de refresh, prontos para abrir num **portal do Maestri**.
Cada card mostra, por conta, o uso e o tempo decorrido das janelas de 5 horas e da Semana (cápsula de uso e tempo), o prazo
("deve durar até perto de…") e uma tarja de privacidade sobre o miolo do e-mail.

Os cards descendem do card H1 do `quota-board` (MIT, ver `LICENSE`).

## Instalação (uma linha)

Requer Node 18+ e o Maestri com o comando `maestri` no PATH. O repositório é público: não precisa de credencial.

```sh
npx github:fbtostadev/quotas-pane add web ia   # cards + refresh, e a skill do Claude Code
npx github:fbtostadev/quotas-pane demo         # grava dados de demonstração em ./quotas-pane/web/dados.js
npx github:fbtostadev/quotas-pane open         # abre um portal do Maestri chamado "Cotas"
```

Depois que o pacote for publicado no npm, o prefixo vira `npx @fbtostadev/quotas-pane`. Para fixar uma versão: `npx github:fbtostadev/quotas-pane#<tag>`.

## Módulos

Cada módulo é uma pasta copiada para o seu projeto. Você pode editar os arquivos; não há dependência em tempo de execução.

| Módulo | O que é | Pasta |
|---|---|---|
| `web` | Os cards e o botão de refresh: `cotas-cards.html`, `cartao-cota.css`, `cotas.js` e os módulos puros `prazo.js`, `capsula.js`, `privacidade.js`, `resumo.js`, mais os ícones. Sem build, sem rede: abre por `file://`. | `./quotas-pane/web` |
| `ia` | Skill para o Claude Code instalar e abrir os cards no Maestri sem você explicar nada. | `./.claude/skills/quotas-pane` |

Comandos:

```sh
npx github:fbtostadev/quotas-pane list                          # módulos disponíveis
npx github:fbtostadev/quotas-pane add <módulo...> [--dir D]     # copia módulos (padrão: ./quotas-pane); sobrescreve o que já existe
npx github:fbtostadev/quotas-pane demo [--dir D]                # dados de demonstração, com as horas deslocadas para agora
npx github:fbtostadev/quotas-pane open [--dir D] [--nome N] [--size LxA]   # cria o portal, ou recarrega se já existir
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

`npx github:fbtostadev/quotas-pane add ia` instala a skill `quotas-pane`, que ensina o Claude a instalar, abrir o portal, conferir e resolver problemas comuns.
A skill se apoia na skill `maestri-portal` do Maestri (`maestri portal create/navigate/evaluate/screenshot`).

## Por que npm/npx e não só um .zip

Ver `DISTRIBUICAO.md`.

## Testes

```sh
npm test
```
