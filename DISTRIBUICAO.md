# Distribuição

**Escolhido: `@fbtostadev/quotas-pane`, pacote npm com escopo, sem dependências, usado por `npx` no estilo "copiar para o projeto". Antes de publicar no registro, a equipe usa `npx github:fbtostadev/quotas-pane`. O .zip fica como cópia offline.**

## Comparação

| Opção | Granularidade | Atualização | Atrito para o colaborador | Problema |
|---|---|---|---|---|
| **npx + copiar módulos (escolhido)** | Alta: `add web`, `add ia` | Rodar o `add` de novo, numa versão fixada | Uma linha | Exige Node 18+ (quem usa Claude Code e Maestri em geral já tem) |
| npm como dependência (`import`) | Média | `npm update` | Baixa | Os cards são HTML + JS sem build, abertos por `file://` no portal: não há o que importar. Cada ajuste vira um fork do pacote |
| .zip | Nenhuma: tudo ou nada | Manual, sem versão | Baixa na primeira vez | Cada colaborador fica numa versão; sem `list`/`add`; o AI não tem um comando único para seguir |
| Repositório git (clone) | Baixa | `git pull` | Média | Traz testes e histórico que o colaborador não precisa; mistura código do pacote com o dele |
| Plugin do Claude Code (marketplace) | Alta para a skill | `plugin update` | Baixa | Só entrega a skill, não os arquivos da página. Vale como **complemento** para o módulo `ia` |

## Por que "copiar" e não "depender"

- A página é um artefato estático que o Maestri abre por `file://`. Não existe bundler nem `node_modules` nesse caminho.
- Cada equipe vai querer ajustar cor, textos e grupos de conta. Com os arquivos na pasta do projeto, a edição é direta e não há "versão do pacote" para brigar.
- O comando `add` sobrescreve: atualizar é rodar de novo numa versão fixada.

## Granularidade

Dois módulos independentes:

1. `web`: os cards e o refresh. Funciona sozinho com `demo` ou com qualquer gerador de `dados.js` que siga o contrato do README.
2. `ia`: skill de instalação e operação para o Claude Code.

Dentro de `web`, os módulos puros (`prazo.js`, `capsula.js`, `privacidade.js`, `resumo.js`) não tocam no DOM; `cotas.js` é o único que desenha. Quem quiser trocar a aparência troca `cotas.js` + `cartao-cota.css` e mantém as regras de prazo e de privacidade.

## Como publicar

- **Sem registro:** `npx github:fbtostadev/quotas-pane add web` (o repositório `fbtostadev/quotas-pane` é público, então não precisa de credencial).
- **Registro npm:** `npm publish`. O `publishConfig.access` está `restricted` (escopo privado, exige plano pago do npm); para um pacote público, troque para `public`. Ao publicar, o prefixo dos comandos vira `npx @fbtostadev/quotas-pane`.
- **Offline:** o .zip contém a mesma árvore; `node bin/quotas-pane.mjs add web` dentro dele equivale ao `npx`.
