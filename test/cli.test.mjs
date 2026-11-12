import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "quotas-pane.mjs");
const novaPasta = () => mkdtempSync(join(tmpdir(), "quotas-pane-"));
/* HOME falso: o install também olha ~/.claude/skills, e o teste não pode mexer na home de quem roda. */
const HOME = novaPasta();
const ambiente = (home) => ({ ...process.env, HOME: home || HOME });
const rodar = (cwd, ...args) => execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ambiente() });
const rodarCom = (cwd, home, ...args) => execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8", env: ambiente(home) });
const PACOTE = join(dirname(CLI), "..");
const doPacote = (nome) => readFileSync(join(PACOTE, "modulos", "web", nome), "utf8");
const escrever = (caminho, texto) => { mkdirSync(dirname(caminho), { recursive: true }); writeFileSync(caminho, texto); };
const anteriores = (dir) => existsSync(join(dir, ".anterior")) ? readdirSync(join(dir, ".anterior")).map((c) => join(dir, ".anterior", c)) : [];

test("add web copia a página e todos os arquivos que ela referencia", () => {
  const cwd = novaPasta();
  rodar(cwd, "add", "web");
  const web = join(cwd, "quotas-pane", "web");
  assert.ok(existsSync(join(web, "cotas-cards.html")));
  const html = readFileSync(join(web, "cotas-cards.html"), "utf8");
  for (const arquivo of ["cartao-cota.css", "prazo.js", "capsula.js", "privacidade.js", "resumo.js", "cotas.js"]) {
    assert.ok(existsSync(join(web, arquivo)), `falta ${arquivo}`);
    assert.ok(html.includes(`"${arquivo}`), `a página não referencia ${arquivo}`);
  }
  for (const icone of ["icone-claude.png", "icone-codex.png", "icone-agy.png"]) assert.ok(existsSync(join(web, icone)), `falta ${icone}`);
});

test("demo grava dados.js válido, com horas relativas a agora", () => {
  const cwd = novaPasta();
  rodar(cwd, "add", "web");
  rodar(cwd, "demo");
  const codigo = readFileSync(join(cwd, "quotas-pane", "web", "dados.js"), "utf8");
  let recebido = null;
  vm.runInNewContext(codigo, { window: { __painelDados: (d) => { recebido = d; } } });
  assert.equal(recebido.contas.lista.length, 6);
  const agora = Date.now() / 1000;
  const lido = recebido.contas.lista[0].lido_em_epoch;
  assert.ok(Math.abs(agora - lido) < 60, "lido_em_epoch deve ser de agora");
});

test("add ia instala a skill no projeto", () => {
  const cwd = novaPasta();
  rodar(cwd, "add", "ia");
  const skill = readFileSync(join(cwd, ".claude", "skills", "quotas-pane", "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: quotas-pane/);
});

test("módulo desconhecido falha com mensagem", () => {
  const cwd = novaPasta();
  assert.throws(() => execFileSync("node", [CLI, "add", "nada"], { cwd, encoding: "utf8", stdio: "pipe" }), /desconhecido/);
});

test("o pacote só fala dos cards: sem coletor, Vingadores ou porta fixa", () => {
  const raiz = join(dirname(CLI), "..");
  const arquivos = [];
  const varrer = (pasta) => {
    for (const nome of readdirSync(pasta)) {
      if (nome === ".git" || nome === "node_modules" || nome === "test" || nome === "LICENSE") continue;
      const caminho = join(pasta, nome);
      statSync(caminho).isDirectory() ? varrer(caminho) : arquivos.push(caminho);
    }
  };
  varrer(raiz);
  assert.ok(!existsSync(join(raiz, "modulos", "coletor")));
  for (const arquivo of arquivos.filter((a) => /\.(js|mjs|css|html|md|json)$/.test(a) && !a.endsWith("DISTRIBUICAO.md"))) {
    const texto = readFileSync(arquivo, "utf8");
    assert.doesNotMatch(texto, /vingador|nick fury|7420|painel\.sh|add coletor|modulos\/coletor/i, arquivo);
  }
});

test("o botão de refresh lê o dados.js de novo quando não há data-refresh-url", () => {
  const cwd = novaPasta();
  rodar(cwd, "add", "web");
  const html = readFileSync(join(cwd, "quotas-pane", "web", "cotas-cards.html"), "utf8");
  assert.match(html, /id="refresh"/);
  assert.match(html, /dataset\.refreshUrl/);
  assert.match(html, /MINIMO_GIRO_MS/);
  assert.match(html, /consultando: true/);
});

test("sem argumentos faz a instalação completa: web, manifesto, demo e skill", () => {
  const cwd = novaPasta();
  const saida = rodar(cwd, "--sem-portal");
  const dir = join(cwd, "quotas-pane");
  assert.ok(existsSync(join(dir, "web", "cotas-cards.html")));
  const manifesto = JSON.parse(readFileSync(join(dir, ".quotas-pane.json"), "utf8"));
  assert.equal(manifesto.versao, JSON.parse(readFileSync(join(PACOTE, "package.json"), "utf8")).version);
  assert.ok(manifesto.arquivos["web/cotas.js"]);
  assert.ok(existsSync(join(dir, "web", "dados.js")), "sem dados, grava a demonstração");
  assert.ok(existsSync(join(cwd, ".claude", "skills", "quotas-pane", "SKILL.md")));
  assert.match(saida, /Relatório/);
  assert.match(saida, /portal não aberto/i);
});

test("reinstalar guarda o arquivo editado, troca pelo novo e não toca no dados.js", () => {
  const cwd = novaPasta();
  rodar(cwd, "install", "--sem-portal");
  const web = join(cwd, "quotas-pane", "web");
  writeFileSync(join(web, "cotas.js"), "/* editado pelo usuário */");
  writeFileSync(join(web, "dados.js"), "/* dados meus */");
  const saida = rodar(cwd, "install", "--sem-portal");
  assert.equal(readFileSync(join(web, "cotas.js"), "utf8"), doPacote("cotas.js"));
  assert.equal(readFileSync(join(web, "dados.js"), "utf8"), "/* dados meus */");
  const [guardado] = anteriores(join(cwd, "quotas-pane"));
  assert.equal(readFileSync(join(guardado, "web", "cotas.js"), "utf8"), "/* editado pelo usuário */");
  assert.match(saida, /cotas\.js/);
});

test("reinstalar sem edições não guarda nada", () => {
  const cwd = novaPasta();
  rodar(cwd, "install", "--sem-portal");
  rodar(cwd, "install", "--sem-portal");
  assert.equal(anteriores(join(cwd, "quotas-pane")).length, 0);
});

test("instalação antiga sem manifesto vai inteira para .anterior e o dados.js volta", () => {
  const cwd = novaPasta();
  const web = join(cwd, "quota-cards", "web");
  escrever(join(web, "cotas-cards.html"), "<!doctype html><title>Cotas — cards</title>");
  escrever(join(web, "cotas.js"), "/* versão antiga com a tarja preta */");
  escrever(join(web, "dados.js"), "/* dados antigos */");
  const saida = rodar(cwd, "--sem-portal");
  assert.equal(readFileSync(join(web, "cotas.js"), "utf8"), doPacote("cotas.js"), "atualiza no lugar onde já estava");
  assert.equal(readFileSync(join(web, "dados.js"), "utf8"), "/* dados antigos */");
  assert.ok(existsSync(join(cwd, "quota-cards", ".quotas-pane.json")));
  const [guardado] = anteriores(join(cwd, "quota-cards"));
  assert.equal(readFileSync(join(guardado, "web", "cotas.js"), "utf8"), "/* versão antiga com a tarja preta */");
  assert.ok(!existsSync(join(cwd, "quotas-pane")), "não cria uma segunda instalação");
  assert.match(saida, /sem manifesto/);
});

test("painel de terceiros não é tocado; o dados.js dele com cotas vira a fonte dos cards", () => {
  const cwd = novaPasta();
  const publico = join(cwd, "Overview-Painel", "publico");
  const arquivos = {
    "index.html": "<!doctype html><title>Painel</title>",
    "cotas.js": "window.__painelContas = { desenhar: function () {} };",
    "dados.js": 'window.__painelDados && window.__painelDados({"contas": {"lista": []}});',
  };
  for (const [nome, texto] of Object.entries(arquivos)) escrever(join(publico, nome), texto);
  escrever(join(cwd, "quota-board", "package.json"), JSON.stringify({ name: "quota-board" }));
  const saida = rodar(cwd, "--sem-portal");
  for (const [nome, texto] of Object.entries(arquivos)) assert.equal(readFileSync(join(publico, nome), "utf8"), texto, `${nome} intacto`);
  const dados = join(cwd, "quotas-pane", "web", "dados.js");
  assert.ok(lstatSync(dados).isSymbolicLink());
  assert.equal(realpathSync(readlinkSync(dados)), realpathSync(join(publico, "dados.js")));
  assert.match(saida, /Overview-Painel/);
  assert.match(saida, /quota-board/);
});

test("skill antiga quota-cards, no projeto e na home, vai para .anterior", () => {
  const cwd = novaPasta(), home = novaPasta();
  escrever(join(cwd, ".claude", "skills", "quota-cards", "SKILL.md"), "---\nname: quota-cards\n---\n");
  escrever(join(home, ".claude", "skills", "quota-cards", "SKILL.md"), "---\nname: quota-cards\n---\n");
  rodarCom(cwd, home, "--sem-portal");
  assert.ok(!existsSync(join(cwd, ".claude", "skills", "quota-cards")));
  assert.ok(!existsSync(join(home, ".claude", "skills", "quota-cards")));
  const [guardado] = anteriores(join(cwd, "quotas-pane"));
  assert.equal(readdirSync(join(guardado, "skills")).length, 2);
});

test("recusa trocar uma versão instalada mais nova e indica o #main", () => {
  const cwd = novaPasta();
  rodar(cwd, "--sem-portal");
  const manifesto = join(cwd, "quotas-pane", ".quotas-pane.json");
  writeFileSync(manifesto, JSON.stringify({ ...JSON.parse(readFileSync(manifesto, "utf8")), versao: "99.0.0" }));
  assert.throws(() => execFileSync("node", [CLI, "--sem-portal"], { cwd, encoding: "utf8", stdio: "pipe", env: ambiente() }), /#main/);
});

test("help mostra que sem argumentos é a instalação", () => {
  const saida = rodar(novaPasta(), "help");
  assert.match(saida, /sem argumentos/i);
  assert.match(saida, /rtk proxy npx/);
});

/* ---------- a régua de tempo (barra de horas) é obrigatória ---------- */
const carregarPrazo = () => { const ctx = { window: {} }; vm.runInNewContext(doPacote("prazo.js"), ctx); return ctx.window.Prazo; };
const AGORA = 1_800_000_000;
const barra5h = (extra) => ({ tipo: "5h", janela_min: 300, usado_pct: 40, renova_epoch: AGORA + 2 * 3600, provisorio: false, ...extra });

test("com o período no futuro há tempo, mesmo com a leitura de uso velha", () => {
  const Prazo = carregarPrazo();
  const d = Prazo.descrever(barra5h(), AGORA, { velha: true });
  assert.equal(d.estado, "anterior");
  assert.equal(d.sufixo, " usado antes");
  assert.equal(Math.round(d.tempo), 60, "3 h de 5 h decorridas");
  assert.match(d.termina, /termina em 2 h/);
  assert.equal(Math.round(Prazo.descrever(barra5h({ usado_pct: null }), AGORA).tempo), 60, "sem dado de uso, o tempo continua");
});

test("sem período conhecido não há tempo inventado", () => {
  const Prazo = carregarPrazo();
  assert.equal(Prazo.descrever(barra5h({ renova_epoch: AGORA - 60 }), AGORA).tempo, null, "período já renovado");
  assert.equal(Prazo.descrever(barra5h({ renova_epoch: null }), AGORA).tempo, null, "sem renova_epoch");
  const provisorio = Prazo.descrever(barra5h({ usado_pct: 0, provisorio: true }), AGORA);
  assert.equal(provisorio.tempo, null, "prazo provisório");
  assert.equal(provisorio.estado, "sem-periodo");
  assert.equal(Prazo.descrever(barra5h({ usado_pct: 0, provisorio: true }), AGORA, { velha: true }).tempo, null, "prazo provisório com leitura velha");
});

test("o card nunca esconde a régua: sem tempo, ela fica vazia e só a agulha e o decorrido somem", () => {
  const cotas = doPacote("cotas.js"), css = doPacote("cartao-cota.css");
  assert.match(cotas, /<div class="regua">/, "a régua nasce visível");
  assert.match(cotas, /<span class="tempo-nome">Tempo<\/span>/, "o nome Tempo nasce visível");
  assert.doesNotMatch(cotas, /oculto\(barra\.(regua|nomeTempo)|regua\.hidden|sem-regua/);
  assert.doesNotMatch(css, /sem-regua|\.regua\[hidden\]/);
  assert.match(css, /\.visual\.sem-tempo \.agulha, \.visual\.sem-tempo \.decorrido \{ display: none; \}/);
});
