import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSubmission, formatReport } from '../src/rules.mjs';

const DIR = 'artifacts/2026/10/20261021-claude-opus-5-5-demo';
const YAML_OK = `schema: 1
title: 演示
type: frontend
created_at: "2026-10-21T10:00:00+08:00"
author:
  model: claude-opus-5-5
  tool: Claude Code
  contributor: tester
`;

/** 构造一次投稿：files 为 {相对路径: 内容} */
function submit(files, { dir = DIR, extraChanges = [], baseDirs = [], modes = {} } = {}) {
  const changes = Object.keys(files).map((p) => ({ status: 'A', path: `${dir}/${p}` })).concat(extraChanges);
  const headTree = Object.entries(files).map(([p, c]) => ({
    path: `${dir}/${p}`,
    mode: modes[p] || '100644',
    size: typeof c === 'number' ? c : Buffer.byteLength(c),
  }));
  return checkSubmission({
    changes,
    headTree,
    readText: (p) => {
      const v = files[p.slice(dir.length + 1)];
      return typeof v === 'string' ? v : null;
    },
    baseHasDir: (d) => baseDirs.includes(d),
  });
}

const base = { 'aispark.yaml': YAML_OK, 'README.md': '# 演示', 'index.html': '<p>hi</p>' };

test('合规投稿通过', () => {
  const r = submit(base);
  assert.equal(r.kind, 'submission');
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
  assert.equal(r.artifacts.length, 1);
});

test('未改动 artifacts/ 的 PR 不是投稿', () => {
  const r = checkSubmission({ changes: [{ status: 'M', path: 'site/x.js' }], headTree: [], readText: () => null, baseHasDir: () => false });
  assert.equal(r.kind, 'not-submission');
  assert.equal(r.ok, false);
});

test('混改 artifacts/ 以外的文件被拒', () => {
  const r = submit(base, { extraChanges: [{ status: 'M', path: 'site/src/x.js' }] });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /以外的文件：site\/src\/x\.js/);
});

test('修改或删除已有文件被拒', () => {
  const r = submit(base, { extraChanges: [
    { status: 'M', path: 'artifacts/2026/10/20261020-other-old/README.md' },
    { status: 'D', path: 'artifacts/2026/10/20261020-other-old/index.html' },
  ] });
  assert.match(r.errors.join(), /不允许修改/);
  assert.match(r.errors.join(), /不允许删除/);
});

test('向已存在的作品目录追加文件被拒', () => {
  const r = submit(base, { baseDirs: [DIR] });
  assert.match(r.errors.join(), /目录已存在/);
});

test('缺少 author.tool 被拒，缺少 contributor 仅提示', () => {
  const noTool = YAML_OK.replace(/  tool: .*\n/, '');
  assert.match(submit({ ...base, 'aispark.yaml': noTool }).errors.join(), /缺少 author\.tool/);

  const noContrib = YAML_OK.replace(/  contributor: .*\n/, '');
  const r = submit({ ...base, 'aispark.yaml': noContrib });
  assert.equal(r.ok, true);
  assert.match(r.warnings.join(), /匿名/);
});

test('缺少署名卡或 README 被拒', () => {
  assert.match(submit({ 'README.md': 'x' }).errors.join(), /缺少 aispark\.yaml/);
  assert.match(submit({ 'aispark.yaml': YAML_OK }).errors.join(), /缺少 README\.md/);
});

test('YAML 语法错误被拒', () => {
  assert.match(submit({ ...base, 'aispark.yaml': 'title: [未闭合' }).errors.join(), /解析失败/);
});

test('目录名不规范被拒', () => {
  const dir = 'artifacts/2026/10/Rain_Poem';
  assert.match(submit(base, { dir }).errors.join(), /目录名不符合/);
});

test('目录日期与年月路径不一致被拒', () => {
  const dir = 'artifacts/2026/09/20261021-claude-opus-5-5-demo';
  assert.match(submit(base, { dir }).errors.join(), /不一致/);
});

test('目录名中的模型 slug 与署名不符被拒', () => {
  const dir = 'artifacts/2026/10/20261021-gpt-5-demo';
  assert.match(submit(base, { dir }).errors.join(), /模型 slug 应为 claude-opus-5-5/);
});

test('超过 50MB 被拒', () => {
  const r = submit({ ...base, 'big.bin': 51 * 1024 * 1024 });
  assert.match(r.errors.join(), /超过 50MB/);
});

test('可执行文件、符号链接被拒', () => {
  assert.match(submit({ ...base, 'setup.exe': 10 }).errors.join(), /可执行文件/);
  assert.match(submit({ ...base, 'link': 'x' }, { modes: { link: '120000' } }).errors.join(), /符号链接/);
});

test('license 只允许 CC-BY-4.0', () => {
  const r = submit({ ...base, 'aispark.yaml': `${YAML_OK}license: MIT\n` });
  assert.match(r.errors.join(), /license 只允许/);
});

test('报告不含 emoji，表格单元格转义竖线与尖括号', () => {
  const y = YAML_OK.replace('title: 演示', 'title: "a|b<script>"');
  const md = formatReport(submit({ ...base, 'aispark.yaml': y }));
  assert.doesNotMatch(md, /\p{Extended_Pictographic}/u);
  assert.match(md, /a\\\|b&lt;script>/);
  assert.match(md, /claude-opus-5-5 · Claude Code · tester/);
});
