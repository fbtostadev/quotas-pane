#!/usr/bin/env node
// quotas-pane: instala os cards de cota no projeto (com enxerto sobre instalações anteriores) e abre o portal no Maestri.
// Só biblioteca padrão do Node.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSAO = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")).version;
const MANIFESTO = ".quotas-pane.json";
const COMANDO = "npx --yes github:fbtostadev/quotas-pane";
const AJUDA = `quotas-pane ${VERSAO}: cards de cota para o portal do Maestri

  quotas-pane [install] [--dir D] [--sem-portal]   sem argumentos: instalação completa. Procura resíduos do painel de cotas,
                                                    atualiza instalações anteriores (guarda o que você editou em .anterior/),
                                                    liga os cards ao dados.js de um painel existente ou grava a demonstração,
                                                    instala a skill do Claude Code e abre o portal "Cotas". Seguro repetir.
  quotas-pane list                                 módulos disponíveis
  quotas-pane add <módulo...> [--dir D]            só os módulos pedidos (padrão D=./quotas-pane)
  quotas-pane demo [--dir D]                       grava dados de demonstração em D/web/dados.js
  quotas-pane open [--dir D] [--nome N] [--size LxA]   cria o portal no Maestri, ou recarrega se já existir
  quotas-pane help                                 esta ajuda

Se um hook de shell reescrever o npx ("Unknown command", RTK): rtk proxy npx --yes github:fbtostadev/quotas-pane
`;

const MODULOS = {
  web: "os cards e o botão de refresh (página estática)",
  ia: "skill do Claude Code para instalar e abrir o painel",
};

function falhar(mensagem) {
  console.error(`quotas-pane: ${mensagem}`);
  process.exit(1);
}

function lerArgumentos(argv) {
  const posicionais = [];
  const opcoes = { dir: null, nome: "Cotas", size: null, "sem-portal": false };
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) { posicionais.push(argv[i]); continue; }
    const chave = argv[i].slice(2);
    if (!(chave in opcoes)) falhar(`opção desconhecida: ${argv[i]}`);
    if (typeof opcoes[chave] === "boolean") { opcoes[chave] = true; continue; }
    if (argv[i + 1] === undefined) falhar(`${argv[i]} precisa de um valor`);
    opcoes[chave] = argv[++i];
  }
  return { posicionais, opcoes };
}

/* ---------- utilidades ---------- */
const hash = (caminho) => createHash("sha256").update(readFileSync(caminho)).digest("hex");
const existe = (caminho) => { try { lstatSync(caminho); return true; } catch { return false; } };   // conta link quebrado
const mostrar = (caminho) => relative(process.cwd(), caminho) || ".";
const maisNova = (a, b) => {                       // a > b, em x.y.z
  const [x, y] = [a, b].map((v) => String(v).split(".").map(Number));
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
function arquivosDe(pasta, base = pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivosDe(join(pasta, e.name), base) : [relative(base, join(pasta, e.name))]);
}
function lerTexto(caminho) {
  try { return statSync(caminho).size < 2_000_000 ? readFileSync(caminho, "utf8") : ""; } catch { return ""; }
}

/* ---------- resíduos ---------- */
/* Varre a pasta atual (até 4 níveis) e ~/.claude/skills atrás de qualquer coisa do painel de cotas. Só lê. */
const PULAR = new Set(["node_modules", ".git", "Library", ".Trash", ".npm", ".cache", "DerivedData", ".anterior", "Applications", "Movies", "Music", "Pictures"]);
function procurarResiduos(raiz) {
  const achados = [];
  let visitadas = 0;
  const visitar = (pasta, nivel) => {
    if (nivel > 4 || ++visitadas > 30000) return;
    let entradas;
    try { entradas = readdirSync(pasta, { withFileTypes: true }); } catch { return; }
    const nomes = new Set(entradas.map((e) => e.name));
    if (nomes.has(MANIFESTO)) achados.push({ tipo: "pacote", dir: pasta });
    else if (nomes.has("web") && existsSync(join(pasta, "web", "cotas-cards.html"))) achados.push({ tipo: "pacote-antigo", dir: pasta });
    else if (nomes.has("cotas.js") && !nomes.has("cotas-cards.html") && lerTexto(join(pasta, "cotas.js")).includes("__painelContas")) {
      const dados = join(pasta, "dados.js");
      achados.push({ tipo: "terceiro", dir: pasta, dados: lerTexto(dados).includes('"contas"') ? dados : null });
    } else if (nomes.has("package.json") && /"name"\s*:\s*"quota-board"/.test(lerTexto(join(pasta, "package.json")))) {
      achados.push({ tipo: "terceiro", dir: pasta, dados: null });
    }
    if (pasta.endsWith(join(".claude", "skills")) && nomes.has("quota-cards")) achados.push({ tipo: "skill-antiga", dir: join(pasta, "quota-cards") });
    for (const e of entradas) if (e.isDirectory() && !PULAR.has(e.name)) visitar(join(pasta, e.name), nivel + 1);
  };
  visitar(raiz, 0);
  const skillsDaHome = join(homedir(), ".claude", "skills");
  if (!raiz.startsWith(skillsDaHome) && !skillsDaHome.startsWith(raiz + sep) && existsSync(join(skillsDaHome, "quota-cards"))) {
    achados.push({ tipo: "skill-antiga", dir: join(skillsDaHome, "quota-cards") });
  }
  return achados;
}

/* ---------- enxerto ---------- */
function carimbo() { return new Date().toISOString().slice(0, 19).replace(/:/g, "-"); }
function guardar(dir, momento, origem, destinoRelativo) {
  const destino = join(dir, ".anterior", momento, destinoRelativo);
  mkdirSync(dirname(destino), { recursive: true });
  renameSync(origem, destino);
  return destino;
}

/* Instala ou atualiza dir/web. Arquivo do pacote editado pelo usuário é guardado antes; instalação sem manifesto vai inteira
   para .anterior; o dados.js nunca é sobrescrito. */
function enxertarWeb(dir, momento, relatorio) {
  const caminhoManifesto = join(dir, MANIFESTO);
  const manifesto = existsSync(caminhoManifesto) ? JSON.parse(readFileSync(caminhoManifesto, "utf8")) : null;
  if (manifesto && maisNova(manifesto.versao, VERSAO)) {
    falhar(`a versão instalada em ${mostrar(dir)} (${manifesto.versao}) é mais nova que esta (${VERSAO}). O npx usou uma cópia em cache: rode ${COMANDO}#main`);
  }
  const web = join(dir, "web"), origem = join(RAIZ, "modulos", "web");
  const novos = arquivosDe(origem);
  let dadosAntigos = null;
  if (existsSync(web) && !manifesto) {
    const guardada = guardar(dir, momento, web, "web");
    relatorio.guardados.push(`${mostrar(web)} inteira (instalação sem manifesto) → ${mostrar(guardada)}`);
    if (existe(join(guardada, "dados.js"))) dadosAntigos = join(guardada, "dados.js");
  } else if (manifesto) {
    for (const rel of novos) {
      const atual = join(web, rel);
      if (!existsSync(atual)) continue;
      const h = hash(atual);
      if (h !== manifesto.arquivos?.[`web/${rel}`] && h !== hash(join(origem, rel))) {
        const guardado = join(dir, ".anterior", momento, "web", rel);
        mkdirSync(dirname(guardado), { recursive: true });
        cpSync(atual, guardado);
        relatorio.guardados.push(`${mostrar(atual)} (editado por você) → ${mostrar(guardado)}`);
      }
    }
  }
  mkdirSync(web, { recursive: true });
  cpSync(origem, web, { recursive: true, force: true });
  if (dadosAntigos) cpSync(dadosAntigos, join(web, "dados.js"), { verbatimSymlinks: true });
  const arquivos = Object.fromEntries(novos.map((rel) => [`web/${rel}`, hash(join(origem, rel))]));
  writeFileSync(caminhoManifesto, JSON.stringify({ versao: VERSAO, instalado_em: new Date().toISOString(), arquivos }, null, 2) + "\n");
  const acao = !manifesto ? "instalados" : manifesto.versao === VERSAO ? "conferidos e repostos" : `atualizados de ${manifesto.versao} para`;
  relatorio.feitos.push(`cards ${acao} ${VERSAO} em ${mostrar(web)}`);
}

function instalarSkill(relatorio) {
  const destino = resolve(".claude", "skills", "quotas-pane");
  mkdirSync(destino, { recursive: true });
  cpSync(join(RAIZ, "modulos", "ia"), destino, { recursive: true, force: true });
  relatorio.feitos.push(`skill do Claude Code em ${mostrar(destino)}`);
}

function gravarDemo(dir) {
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
  const destino = join(dir, "web", "dados.js");
  writeFileSync(destino, `window.__painelDados && window.__painelDados(${JSON.stringify({ contas })});\n`);
  return { destino, quantas: contas.lista.length };
}

/* ---------- Maestri ---------- */
function maestri(...args) {
  return execFileSync(process.env.MAESTRI_CLI || "maestri", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function abrirPortal(dir, nome, size) {
  const url = pathToFileURL(join(dir, "web", "cotas-cards.html")).href;
  if (maestri("list").includes(`name: "${nome}"`)) { maestri("portal", "navigate", nome, url); return `portal "${nome}" recarregado`; }
  maestri("portal", "create", url, nome, ...(size ? ["--size", size] : []));
  return `portal "${nome}" criado`;
}

/* ---------- comandos ---------- */
function instalar(opcoes) {
  const relatorio = { encontrados: [], feitos: [], guardados: [], ignorados: [] };
  const achados = procurarResiduos(process.cwd());
  const momento = carimbo();
  const proprias = achados.filter((a) => a.tipo === "pacote" || a.tipo === "pacote-antigo")
    .sort((a, b) => a.dir.split(sep).length - b.dir.split(sep).length);
  const dir = opcoes.dir ? resolve(opcoes.dir) : (proprias[0]?.dir || resolve("quotas-pane"));
  for (const a of achados) {
    const onde = a.dir.startsWith(homedir()) && !a.dir.startsWith(process.cwd()) ? a.dir.replace(homedir(), "~") : mostrar(a.dir);
    if (a.tipo === "pacote") relatorio.encontrados.push(`instalação do quotas-pane em ${onde}`);
    if (a.tipo === "pacote-antigo") relatorio.encontrados.push(`instalação antiga, sem manifesto, em ${onde}`);
    if (a.tipo === "skill-antiga") relatorio.encontrados.push(`skill antiga quota-cards em ${onde}`);
    if (a.tipo === "terceiro") {
      relatorio.encontrados.push(`painel de cotas de terceiros em ${onde}${a.dados ? " (com dados.js de cotas)" : ""}`);
      relatorio.ignorados.push(`${onde}: não é deste pacote, ficou como estava`);
    }
  }
  for (const outra of proprias.filter((a) => a.dir !== dir)) relatorio.ignorados.push(`${mostrar(outra.dir)}: outra instalação; rode com --dir para atualizá-la`);

  enxertarWeb(dir, momento, relatorio);

  const dados = join(dir, "web", "dados.js");
  const fonte = achados.find((a) => a.tipo === "terceiro" && a.dados);
  if (existe(dados)) relatorio.feitos.push(`dados.js mantido (${lstatSync(dados).isSymbolicLink() ? "link para outra fonte" : "seu arquivo"})`);
  else if (fonte) { symlinkSync(fonte.dados, dados); relatorio.feitos.push(`cards lendo as cotas reais de ${mostrar(fonte.dados)} (link simbólico)`); }
  else { const { quantas } = gravarDemo(dir); relatorio.feitos.push(`dados de demonstração (${quantas} contas) em ${mostrar(dados)}`); }

  for (const skill of achados.filter((a) => a.tipo === "skill-antiga")) {
    const guardada = guardar(dir, momento, skill.dir, join("skills", `quota-cards-${relatorio.guardados.length + 1}`));
    relatorio.guardados.push(`skill antiga ${skill.dir.replace(homedir(), "~")} → ${mostrar(guardada)}`);
  }
  instalarSkill(relatorio);

  let portal;
  if (opcoes["sem-portal"]) portal = `portal não aberto (--sem-portal). Para abrir: ${COMANDO} open${opcoes.dir ? ` --dir ${opcoes.dir}` : ""}`;
  else {
    try { portal = abrirPortal(dir, opcoes.nome, opcoes.size || "1200x560"); }
    catch { portal = `portal não aberto: o comando maestri não respondeu. Rode dentro de um terminal do Maestri: ${COMANDO} open`; }
  }

  const bloco = (titulo, itens) => itens.length ? `\n${titulo}\n${itens.map((i) => `  - ${i}`).join("\n")}` : "";
  console.log(`Relatório do quotas-pane ${VERSAO}` +
    bloco("Encontrado:", relatorio.encontrados.length ? relatorio.encontrados : ["nenhum resíduo do painel de cotas"]) +
    bloco("Feito:", relatorio.feitos) +
    bloco("Guardado (nada foi apagado):", relatorio.guardados) +
    bloco("Deixado como estava:", relatorio.ignorados) +
    `\nPortal: ${portal}`);
}

function adicionar(nomes, opcoes) {
  if (!nomes.length) falhar("diga o módulo: " + Object.keys(MODULOS).join(", "));
  for (const nome of nomes) if (!MODULOS[nome]) falhar(`módulo desconhecido: ${nome} (disponíveis: ${Object.keys(MODULOS).join(", ")})`);
  const relatorio = { feitos: [], guardados: [] };
  const dir = resolve(opcoes.dir || "quotas-pane");
  if (nomes.includes("web")) enxertarWeb(dir, carimbo(), relatorio);
  if (nomes.includes("ia")) instalarSkill(relatorio);
  for (const linha of [...relatorio.feitos, ...relatorio.guardados.map((g) => `guardado: ${g}`)]) console.log(linha);
}

function demonstracao(opcoes) {
  const dir = resolve(opcoes.dir || "quotas-pane");
  if (!existsSync(join(dir, "web", "cotas-cards.html"))) falhar(`rode primeiro: ${COMANDO} (não achei ${join(dir, "web")})`);
  const { destino, quantas } = gravarDemo(dir);
  console.log(`demo: ${quantas} contas gravadas em ${destino}`);
}

function abrir(opcoes) {
  const dir = resolve(opcoes.dir || "quotas-pane");
  if (!existsSync(join(dir, "web", "cotas-cards.html"))) falhar(`rode primeiro: ${COMANDO} (não achei ${join(dir, "web")})`);
  try { console.log(`open: ${abrirPortal(dir, opcoes.nome, opcoes.size)}`); }
  catch (erro) {
    if (erro.code === "ENOENT") falhar("comando maestri não encontrado: rode dentro de um terminal do Maestri (ou defina MAESTRI_CLI)");
    throw erro;
  }
}

const argv = process.argv.slice(2);
const comando = argv[0] && !argv[0].startsWith("--") ? argv[0] : "install";
const { posicionais, opcoes } = lerArgumentos(comando === argv[0] ? argv.slice(1) : argv);
switch (comando) {
  case "install": instalar(opcoes); break;
  case "list": for (const [nome, descricao] of Object.entries(MODULOS)) console.log(`${nome.padEnd(8)} ${descricao}`); break;
  case "add": adicionar(posicionais, opcoes); break;
  case "demo": demonstracao(opcoes); break;
  case "open": abrir(opcoes); break;
  case "help": case "ajuda": process.stdout.write(AJUDA); break;
  default: process.stderr.write(`comando desconhecido: ${comando}\n\n${AJUDA}`); process.exit(1);
}
