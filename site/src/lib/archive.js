// 读取仓库根目录 artifacts/，解析每件作品的 aispark.yaml，构建时生成史书数据。
// 校验规则来自 schema/aispark.mjs，与 merge-bot 共用：署名不全的作品不会出现在展示站上。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateMeta, DIR_RE } from '../../../schema/aispark.mjs';
import { excerpt, paragraphs } from './markdown.js';
import { termOf } from './calendar.js';

export const ARTIFACTS_DIR = resolve(
  process.env.AISPARK_ARTIFACTS || resolve(process.cwd(), '../artifacts'),
);

// 构建前由 scripts/capture-covers.mjs 生成的前端作品封面截图
const COVERS_DIR = resolve(process.cwd(), 'public/covers');

export const TYPES = {
  frontend: { label: '前端', en: 'Frontend' },
  tool: { label: '工具', en: 'Tool' },
  article: { label: '文字', en: 'Article' },
  image: { label: '图片', en: 'Image' },
  mixed: { label: '混合', en: 'Mixed' },
  other: { label: '其他', en: 'Other' },
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

function walkFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full, base));
    else out.push({ path: relative(base, full).split(sep).join('/'), size: st.size });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** 找出所有含 aispark.yaml 的作品目录 */
function findArtifactDirs(root) {
  const dirs = [];
  if (!existsSync(root)) return dirs;
  const visit = (dir, depth) => {
    if (existsSync(join(dir, 'aispark.yaml'))) return dirs.push(dir);
    if (depth > 3) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!name.startsWith('.') && statSync(full).isDirectory()) visit(full, depth + 1);
    }
  };
  visit(root, 0);
  return dirs;
}

/** 校验署名卡，返回问题列表（空数组即合法）。规则见 schema/aispark.mjs */
export const validate = validateMeta;

/** 没有封面也没有截图时的兜底色块：按作品 id 稳定生成，同一件作品每次构建都一样 */
function artFor(id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = (k) => ((h >>> k) & 0xff) / 255;
  const hue = Math.floor(r(0) * 360);
  const ang = Math.floor(r(8) * 180);
  const x = Math.floor(20 + r(16) * 60);
  const y = Math.floor(20 + r(24) * 60);
  return `radial-gradient(circle at ${x}% ${y}%, hsl(${hue} 80% 66%) 0 16%, transparent 17%), linear-gradient(${ang}deg, hsl(${hue + 200} 42% 18%), hsl(${hue + 240} 48% 32%))`;
}

function parseDate(createdAt, dirName) {
  const m = String(createdAt || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  const d = m || dirName.match(DIR_RE);
  if (!d) return null;
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const time = m && m[4] ? `${m[4]}:${m[5]}` : '';
  const ts = Date.parse(createdAt) || Date.UTC(y, mo - 1, da);
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  return { y, m: mo, d: da, time, ts, iso, term: termOf(mo, da) };
}

function load() {
  const items = [];
  for (const dir of findArtifactDirs(ARTIFACTS_DIR)) {
    const id = dir.split(sep).pop();
    const relDir = relative(ARTIFACTS_DIR, dir).split(sep).join('/');
    const rawYaml = readFileSync(join(dir, 'aispark.yaml'), 'utf8');
    let meta;
    try {
      meta = parseYaml(rawYaml);
    } catch (e) {
      console.warn(`[archive] 跳过 ${id}：YAML 解析失败 ${e.message}`);
      continue;
    }
    const issues = validate(meta);
    if (issues.length) {
      console.warn(`[archive] 跳过 ${id}：${issues.join('；')}`);
      continue;
    }
    const date = parseDate(meta.created_at, id);
    if (!date) {
      console.warn(`[archive] 跳过 ${id}：无法确定日期`);
      continue;
    }
    const files = walkFiles(dir);
    const readmePath = join(dir, 'README.md');
    const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
    const images = files.filter((f) => IMAGE_EXT.test(f.path)).map((f) => f.path);
    const hasIndex = files.some((f) => f.path === 'index.html');
    const cover = meta.cover && images.includes(meta.cover) ? meta.cover : meta.type === 'image' ? images[0] : null;
    const shot = hasIndex && existsSync(join(COVERS_DIR, `${id}.png`)) ? `/covers/${id}.png` : null;

    items.push({
      id,
      relDir,
      title: String(meta.title),
      type: meta.type,
      typeLabel: TYPES[meta.type].label,
      typeEn: TYPES[meta.type].en,
      createdAt: String(meta.created_at || ''),
      date,
      author: {
        model: String(meta.author.model),
        tool: String(meta.author.tool),
        contributor: meta.author.contributor ? String(meta.author.contributor) : '匿名',
        anonymous: !meta.author.contributor,
        provider: meta.author.provider ? String(meta.author.provider) : '',
      },
      seed: meta.seed || null,
      description: meta.description ? String(meta.description) : excerpt(readme),
      excerpt: excerpt(readme, 120),
      tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
      readme,
      rawYaml,
      files,
      images,
      hasIndex,
      cover,
      shot,
      paras: paragraphs(readme, 3),
      art: artFor(id),
      glyph: Array.from(String(meta.title).trim())[0] || '·',
    });
  }

  // 编号按入馆先后：最早的为 No.001
  items.sort((a, b) => a.date.ts - b.date.ts || a.id.localeCompare(b.id));
  items.forEach((it, i) => {
    it.no = String(i + 1).padStart(3, '0');
    it.prevId = items[i - 1]?.id || null;
    it.nextId = items[i + 1]?.id || null;
  });
  return items.reverse();
}

let cache = null;
/** 全部作品，按时间倒序 */
export function getArtifacts() {
  if (import.meta.env?.DEV) return load();
  return (cache ??= load());
}

export function getArtifact(id) {
  return getArtifacts().find((a) => a.id === id) || null;
}

/** 按 年-月 分组（倒序） */
export function groupByMonth(items) {
  const groups = new Map();
  for (const it of items) {
    const key = `${it.date.y}-${String(it.date.m).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, { key, y: it.date.y, m: it.date.m, items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.values()];
}

export function getStats(items) {
  const models = new Set(items.map((i) => i.author.model));
  const tools = new Set(items.map((i) => i.author.tool));
  const contributors = new Set(items.filter((i) => !i.author.anonymous).map((i) => i.author.contributor));
  const first = items[items.length - 1];
  const latest = items[0];
  const typeCount = {};
  for (const i of items) typeCount[i.type] = (typeCount[i.type] || 0) + 1;
  return {
    total: items.length,
    models: models.size,
    tools: tools.size,
    contributors: contributors.size,
    since: first ? first.date : null,
    latest: latest ? latest.date : null,
    typeCount,
  };
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
