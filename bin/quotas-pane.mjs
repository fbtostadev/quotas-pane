#!/usr/bin/env node
// quotas-pane: copia os módulos do painel de cotas para o projeto e abre o portal no Maestri. Só biblioteca padrão do Node.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const AJUDA = `quotas-pane: cards de cota para o portal do Maestri

  quotas-pane list
  quotas-pane add <módulo...> [--dir D]            copia módulos (padrão D=./quotas-pane); sobrescreve
  quotas-pane demo [--dir D]                       grava dados de demonstração em D/web/dados.js
  quotas-pane open [--dir D] [--nome N] [--size LxA]   cria o portal no Maestri, ou recarrega se já existir
`;

const MODULOS = {
  web: { descricao: "os cards e o botão de refresh (página estática)", destino: (dir) => join(dir, "web") },
  ia: { descricao: "skill do Claude Code para instalar e abrir o painel", destino: () => resolve(".claude", "skills", "quotas-pane") },
};

function falhar(mensagem) {
  console.error(`quotas-pane: ${mensagem}`);
  process.exit(1);
}

function lerArgumentos(argv) {
  const posicionais = [];
  const opcoes = { dir: "quotas-pane", nome: "Cotas", size: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const chave = argv[i].slice(2);
      if (!(chave in opcoes)) falhar(`opção desconhecida: ${argv[i]}`);
      if (argv[i + 1] === undefined) falhar(`${argv[i]} precisa de um valor`);
      opcoes[chave] = argv[++i];
    } else posicionais.push(argv[i]);
  }
  return { posicionais, opcoes };
}

function adicionar(nomes, dir) {
  if (!nomes.length) falhar("diga o módulo: " + Object.keys(MODULOS).join(", "));
  for (const nome of nomes) if (!MODULOS[nome]) falhar(`módulo desconhecido: ${nome} (disponíveis: ${Object.keys(MODULOS).join(", ")})`);
  for (const nome of nomes) {
    const destino = MODULOS[nome].destino(resolve(dir));
    mkdirSync(destino, { recursive: true });
    cpSync(join(RAIZ, "modulos", nome), destino, { recursive: true, force: true });
    console.log(`${nome}: copiado para ${destino}`);
  }
}

function demonstracao(dir) {
  const web = join(resolve(dir), "web");
  if (!existsSync(join(web, "cotas-cards.html"))) falhar(`rode primeiro: quotas-pane add web (não achei ${web})`);
  const fixture = JSON.parse(readFileSync(join(RAIZ, "modulos", "demo-contas.json"), "utf8"));
  const deslocamento = Math.floor(Date.now() / 1000) - fixture.generated_at;
  const deslocar = (valor) => {
    if (Array.isArray(valor)) return valor.map(deslocar);
    if (valor && typeof valor === "object") {
      return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, k.endsWith("_epoch") && typeof v === "number" ? v + deslocamento : deslocar(v)]));
    }
    return valor;
  };
  const contas = { consultadas: fixture.consultadas, erro: fixture.erro, intervalos_s: fixture.intervals_s, lista: deslocar(fixture.lista) };
  writeFileSync(join(web, "dados.js"), `window.__painelDados && window.__painelDados(${JSON.stringify({ contas })});\n`);
  console.log(`demo: ${contas.lista.length} contas gravadas em ${join(web, "dados.js")}`);
}

function maestri(...args) {
  const comando = process.env.MAESTRI_CLI || "maestri";
  try {
    return execFileSync(comando, args, { encoding: "utf8" });
  } catch (erro) {
    if (erro.code === "ENOENT") falhar("comando maestri não encontrado: rode dentro de um terminal do Maestri (ou defina MAESTRI_CLI)");
    throw erro;
  }
}

function abrir(dir, nome, size) {
  const pagina = join(resolve(dir), "web", "cotas-cards.html");
  if (!existsSync(pagina)) falhar(`rode primeiro: quotas-pane add web (não achei ${pagina})`);
  const url = pathToFileURL(pagina).href;
  if (maestri("list").includes(`name: "${nome}"`)) {
    maestri("portal", "navigate", nome, url);
    console.log(`open: portal "${nome}" já existia; recarregado em ${url}`);
  } else {
    maestri("portal", "create", url, nome, ...(size ? ["--size", size] : []));
    console.log(`open: portal "${nome}" criado em ${url}`);
  }
}

const [comando, ...resto] = process.argv.slice(2);
const { posicionais, opcoes } = lerArgumentos(resto);
switch (comando) {
  case "list":
    for (const [nome, m] of Object.entries(MODULOS)) console.log(`${nome.padEnd(8)} ${m.descricao}`);
    break;
  case "add": adicionar(posicionais, opcoes.dir); break;
  case "demo": demonstracao(opcoes.dir); break;
  case "open": abrir(opcoes.dir, opcoes.nome, opcoes.size); break;
  default: process.stdout.write(AJUDA); process.exit(comando ? 1 : 0);
}
