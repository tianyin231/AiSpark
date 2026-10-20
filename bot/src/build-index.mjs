// 扫描 artifacts/，重新生成 index/timeline.jsonl（每行一件作品，按入馆时间正序）。
// 全量重建而非追加：索引永远与 artifacts 实际内容一致，顺带完成「修漏补错」。
// 用法：node src/build-index.mjs [--root <仓库根目录>] [--check]
//   --check  只比对不写入，索引过期时退出码 1
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { validateMeta, parseDirName } from '../../schema/aispark.mjs';

export function buildIndex(root) {
  const base = join(root, 'artifacts');
  const rows = [];
  const skipped = [];
  if (!existsSync(base)) return { rows, skipped };

  const subdirs = (p) => readdirSync(p).filter((n) => !n.startsWith('.') && statSync(join(p, n)).isDirectory()).sort();
  for (const y of subdirs(base)) {
    for (const m of subdirs(join(base, y))) {
      for (const name of subdirs(join(base, y, m))) {
        const dir = join(base, y, m, name);
        const card = join(dir, 'aispark.yaml');
        if (!existsSync(card)) { skipped.push(`${name}：缺少 aispark.yaml`); continue; }
        let meta;
        try { meta = parseYaml(readFileSync(card, 'utf8')); } catch (e) { skipped.push(`${name}：YAML 解析失败`); continue; }
        const issues = validateMeta(meta);
        if (issues.length || !parseDirName(name)) { skipped.push(`${name}：${issues.join('；') || '目录名不合法'}`); continue; }
        const a = meta.author;
        rows.push({
          id: name,
          path: `artifacts/${y}/${m}/${name}`,
          title: String(meta.title),
          type: meta.type,
          created_at: String(meta.created_at),
          model: String(a.model),
          tool: String(a.tool),
          contributor: a.contributor ? String(a.contributor) : null,
          provider: a.provider ? String(a.provider) : null,
          tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        });
      }
    }
  }
  rows.sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at) || x.id.localeCompare(y.id));
  return { rows, skipped };
}

export const toJsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { root: { type: 'string' }, check: { type: 'boolean' } } });
  const root = resolve(values.root || join(dirname(fileURLToPath(import.meta.url)), '../..'));
  const { rows, skipped } = buildIndex(root);
  for (const s of skipped) console.warn(`[index] 跳过 ${s}`);
  const out = join(root, 'index', 'timeline.jsonl');
  const next = toJsonl(rows);
  const prev = existsSync(out) ? readFileSync(out, 'utf8') : null;
  if (values.check) {
    if (prev !== next) { console.error('[index] timeline.jsonl 已过期，请运行 npm run index'); process.exit(1); }
    console.log(`[index] 索引最新，共 ${rows.length} 件`);
  } else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, next);
    console.log(`[index] ${prev === next ? '无变化' : '已更新'}，共 ${rows.length} 件 -> index/timeline.jsonl`);
  }
}
