// 端到端：在临时 git 仓库里模拟 main 与投稿分支，运行真实的 validate-pr CLI 与索引生成。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, toJsonl } from '../src/build-index.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '../src/validate-pr.mjs');
let repo;

// 不改动全局 git 配置：身份只通过 -c 传给本次调用
const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' });
const put = (p, c) => { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), c); };
const card = (model, tool = 'Claude Code') => `schema: 1\ntitle: T\ntype: article\ncreated_at: "2026-10-21T10:00:00+08:00"\nauthor:\n  model: ${model}\n  tool: ${tool}\n`;
const run = (head) => spawnSync(process.execPath, [CLI, '--base', 'main', '--head', head], { cwd: repo, encoding: 'utf8' });

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'aispark-e2e-'));
  git('init', '-q', '-b', 'main');
  put('artifacts/2026/10/20261020-m1-old/aispark.yaml', card('m1'));
  put('artifacts/2026/10/20261020-m1-old/README.md', 'old');
  put('site/a.txt', 'site');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
});
after(() => rmSync(repo, { recursive: true, force: true }));

function branch(name, fn) {
  git('checkout', '-q', '-b', name, 'main');
  fn();
  git('add', '-A');
  git('commit', '-q', '-m', name);
  git('checkout', '-q', 'main');
}

test('合规投稿：退出码 0', () => {
  branch('ok', () => {
    put('artifacts/2026/10/20261021-m2-new/aispark.yaml', card('m2'));
    put('artifacts/2026/10/20261021-m2-new/README.md', 'new');
  });
  const r = run('ok');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /校验通过/);
});

test('修改他人作品：退出码 1', () => {
  branch('tamper', () => put('artifacts/2026/10/20261020-m1-old/README.md', 'hacked'));
  const r = run('tamper');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /不允许修改/);
});

test('移动（rename）他人作品被识别为删除：退出码 1', () => {
  branch('move', () => {
    git('mv', 'artifacts/2026/10/20261020-m1-old', 'artifacts/2026/10/20261021-m1-moved');
  });
  const r = run('move');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /不允许删除/);
});

test('非投稿 PR：退出码 2', () => {
  branch('site', () => put('site/a.txt', 'changed'));
  assert.equal(run('site').status, 2);
});

test('索引：只收录合规作品，按时间正序', () => {
  git('checkout', '-q', 'ok');
  put('artifacts/2026/10/20261021-bad/aispark.yaml', 'schema: 1\ntitle: x\n'); // 不合规，不进索引
  const { rows, skipped } = buildIndex(repo);
  assert.deepEqual(rows.map((r) => r.id), ['20261020-m1-old', '20261021-m2-new']);
  assert.equal(rows[1].tool, 'Claude Code');
  assert.equal(rows[1].contributor, null);
  assert.equal(skipped.length, 1);
  const lines = toJsonl(rows).trim().split('\n');
  assert.equal(JSON.parse(lines[0]).path, 'artifacts/2026/10/20261020-m1-old');
  git('checkout', '-q', 'main');
});
