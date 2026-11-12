import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "quotas-pane.mjs");
const rodar = (cwd, ...args) => execFileSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
const novaPasta = () => mkdtempSync(join(tmpdir(), "quotas-pane-"));

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
    assert.doesNotMatch(texto, /vingador|nick fury|coletor|7420|painel\.sh/i, arquivo);
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
