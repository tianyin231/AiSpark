// aispark.yaml 署名卡 schema v1 —— 全仓唯一的校验规则来源。
// merge-bot（bot/）与展示站（site/）共用此文件，保证「合并即校验，校验即展示」。
// 本文件不依赖任何第三方包：调用方负责把 YAML 解析成对象后传入。

export const SCHEMA_VERSION = 1;
export const LICENSE = 'CC-BY-4.0';
export const TYPE_KEYS = ['frontend', 'tool', 'article', 'image', 'mixed', 'other'];

/** 作品目录名：YYYYMMDD-<模型slug>-<作品slug> */
export const DIR_RE = /^(\d{4})(\d{2})(\d{2})-([a-z0-9][a-z0-9.-]*[a-z0-9])$/;

/** 模型名转 slug：小写，非 [a-z0-9.] 字符折叠为连字符 */
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const isNonEmptyString = (v) => typeof v === 'string' ? v.trim() !== '' : v != null && String(v).trim() !== '';

/**
 * 校验署名卡对象，返回问题列表（空数组即合法）。
 * 署名三要素：模型名 · 工具 · 贡献人。model 与 tool 必填，contributor / provider 选填。
 */
export function validateMeta(meta) {
  const issues = [];
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ['aispark.yaml 不是合法的 YAML 对象'];
  if (meta.schema !== SCHEMA_VERSION) issues.push(`schema 必须为 ${SCHEMA_VERSION}`);
  if (!isNonEmptyString(meta.title)) issues.push('缺少 title');
  if (!TYPE_KEYS.includes(meta.type)) issues.push(`type 不合法：${meta.type ?? '(空)'}，可选 ${TYPE_KEYS.join(' / ')}`);
  if (!isNonEmptyString(meta.created_at)) issues.push('缺少 created_at');
  else if (Number.isNaN(Date.parse(String(meta.created_at)))) issues.push(`created_at 不是合法的 ISO 8601 时间：${meta.created_at}`);

  const a = meta.author;
  if (!a || typeof a !== 'object') {
    issues.push('缺少 author');
  } else {
    if (!isNonEmptyString(a.model)) issues.push('缺少 author.model');
    if (!isNonEmptyString(a.tool)) issues.push('缺少 author.tool');
  }
  if (meta.license != null && meta.license !== LICENSE) issues.push(`license 只允许 ${LICENSE}`);
  if (meta.tags != null && !Array.isArray(meta.tags)) issues.push('tags 必须是列表');
  if (meta.seed?.repo != null && !/^https?:\/\//i.test(String(meta.seed.repo))) issues.push('seed.repo 必须是 http(s) 链接');
  return issues;
}

/** 解析作品目录名，失败返回 null */
export function parseDirName(name) {
  const m = DIR_RE.exec(name);
  if (!m) return null;
  return { y: m[1], m: m[2], d: m[3], rest: m[4] };
}
