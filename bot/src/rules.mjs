// 机械门卫（merge-bot 第一岗）的规则校验。纯函数：不碰文件系统、不执行 git，方便测试。
// 只认规则：署名 schema、目录命名、只增不改、体积与文件类型限制。
import { parse as parseYaml } from 'yaml';
import { validateMeta, parseDirName, slugify } from '../../schema/aispark.mjs';

export const LIMITS = {
  maxArtifactBytes: 50 * 1024 * 1024, // 单作品 50MB
  maxFilesPerArtifact: 500,
  maxArtifactsPerPR: 10,
};

// 原生可执行文件与安装包：静态站无需它们，一律拒收
const BLOCKED_EXT = /\.(exe|dll|so|dylib|msi|msix|com|scr|bat|cmd|vbs|ps1|apk|ipa|jar|dmg|pkg|deb|rpm|appimage)$/i;
const MODE_SYMLINK = '120000';
const MODE_SUBMODULE = '160000';

const ART_PATH_RE = /^artifacts\/(\d{4})\/(\d{2})\/([^/]+)\/(.+)$/;

/**
 * @param {object} input
 * @param {{status: string, path: string}[]} input.changes  PR 相对合并基点的改动（rename 已拆成 D + A）
 * @param {{path: string, mode: string, size: number}[]} input.headTree  PR head 中新作品目录下的全部条目
 * @param {(path: string) => string | null} input.readText  读取 PR head 中的文件文本
 * @param {(dir: string) => boolean} input.baseHasDir  合并基点中该目录是否已存在
 * @returns {{kind: 'submission' | 'not-submission', ok: boolean, errors: string[], warnings: string[], artifacts: object[]}}
 */
export function checkSubmission({ changes, headTree, readText, baseHasDir }) {
  const errors = [];
  const warnings = [];
  const artifacts = [];

  const touchesArtifacts = changes.some((c) => c.path.startsWith('artifacts/'));
  if (!touchesArtifacts) {
    return { kind: 'not-submission', ok: false, errors: ['本 PR 未改动 artifacts/，不是作品投稿，需人工处理'], warnings, artifacts };
  }

  // 1. 只增不改：所有改动必须是 artifacts/ 下的新增文件
  const dirs = new Map(); // 'artifacts/YYYY/MM/name' -> {y, m, name}
  for (const c of changes) {
    const m = ART_PATH_RE.exec(c.path);
    if (!m) {
      errors.push(`不允许改动 artifacts/年/月/作品目录/ 以外的文件：${c.path}`);
      continue;
    }
    if (c.status !== 'A') {
      errors.push(`只允许新增文件，不允许${c.status === 'D' ? '删除' : '修改'}：${c.path}`);
      continue;
    }
    const dir = `artifacts/${m[1]}/${m[2]}/${m[3]}`;
    if (!dirs.has(dir)) dirs.set(dir, { y: m[1], m: m[2], name: m[3] });
  }

  if (dirs.size > LIMITS.maxArtifactsPerPR) {
    errors.push(`单个 PR 最多投稿 ${LIMITS.maxArtifactsPerPR} 件作品，本 PR 有 ${dirs.size} 件`);
  }

  // 2. 逐个作品目录校验
  for (const [dir, info] of dirs) {
    const tag = `[${info.name}]`;
    if (baseHasDir(dir)) {
      errors.push(`${tag} 目录已存在于主仓库，不能向他人或已入馆作品追加文件`);
      continue;
    }

    const parsed = parseDirName(info.name);
    if (!parsed) {
      errors.push(`${tag} 目录名不符合 YYYYMMDD-<模型slug>-<作品slug>（只能用小写字母、数字、点和连字符）`);
    } else if (parsed.y !== info.y || parsed.m !== info.m) {
      errors.push(`${tag} 目录日期 ${parsed.y}${parsed.m} 与所在路径 ${info.y}/${info.m} 不一致`);
    }

    const entries = headTree.filter((e) => e.path.startsWith(`${dir}/`));
    const rel = (p) => p.slice(dir.length + 1);
    const files = new Set(entries.map((e) => rel(e.path)));

    for (const e of entries) {
      if (e.mode === MODE_SYMLINK) errors.push(`${tag} 不允许符号链接：${rel(e.path)}`);
      if (e.mode === MODE_SUBMODULE) errors.push(`${tag} 不允许子模块：${rel(e.path)}`);
      if (BLOCKED_EXT.test(e.path)) errors.push(`${tag} 不允许可执行文件或安装包：${rel(e.path)}`);
    }
    if (entries.length > LIMITS.maxFilesPerArtifact) {
      errors.push(`${tag} 文件数 ${entries.length} 超过上限 ${LIMITS.maxFilesPerArtifact}`);
    }
    const total = entries.reduce((s, e) => s + (Number(e.size) || 0), 0);
    if (total > LIMITS.maxArtifactBytes) {
      errors.push(`${tag} 总大小 ${(total / 1024 / 1024).toFixed(1)}MB 超过 50MB 上限，大文件请放外链`);
    }

    if (!files.has('README.md')) errors.push(`${tag} 缺少 README.md（作品自述）`);
    if (!files.has('aispark.yaml')) {
      errors.push(`${tag} 缺少 aispark.yaml（署名卡）`);
      continue;
    }

    let meta;
    try {
      meta = parseYaml(readText(`${dir}/aispark.yaml`) ?? '');
    } catch (e) {
      errors.push(`${tag} aispark.yaml 解析失败：${e.message.split('\n')[0]}`);
      continue;
    }
    const issues = validateMeta(meta);
    for (const i of issues) errors.push(`${tag} ${i}`);
    if (issues.length) continue;

    // 3. 目录名与署名卡交叉核对
    if (parsed) {
      const modelSlug = slugify(meta.author.model);
      if (!parsed.rest.startsWith(`${modelSlug}-`) || parsed.rest.length <= modelSlug.length + 1) {
        errors.push(`${tag} 目录名中的模型 slug 应为 ${modelSlug}，即 ${parsed.y}${parsed.m}${parsed.d}-${modelSlug}-<作品slug>`);
      }
      const created = String(meta.created_at).slice(0, 10).replace(/-/g, '');
      if (created !== `${parsed.y}${parsed.m}${parsed.d}`) {
        warnings.push(`${tag} created_at 日期 ${created} 与目录日期 ${parsed.y}${parsed.m}${parsed.d} 不同（时区差异可忽略）`);
      }
    }
    if (meta.type === 'frontend' && !files.has('index.html')) {
      warnings.push(`${tag} 前端类作品建议提供 index.html，否则展示站无法在线运行`);
    }
    if (!meta.author.contributor) warnings.push(`${tag} 未填写 author.contributor，将显示为「匿名」`);

    artifacts.push({ dir, id: info.name, meta, files: entries.length, bytes: total });
  }

  return { kind: 'submission', ok: errors.length === 0, errors, warnings, artifacts };
}

/** 生成 PR 评论（Markdown，中文，无 emoji） */
export function formatReport(result) {
  const lines = ['<!-- aispark-merge-bot -->', '### AiSpark 机械门卫', ''];
  if (result.kind === 'not-submission') {
    lines.push('本 PR 没有改动 `artifacts/`，不属于作品投稿，**不会自动合并**，将由馆主人工处理。');
    return lines.join('\n');
  }
  lines.push(result.ok ? '**校验通过**，作品将自动入馆。' : '**校验未通过**，请按下列问题修改后重新推送，修改后会自动复查。');
  lines.push('');
  if (result.errors.length) {
    lines.push('**问题**', '');
    for (const e of result.errors) lines.push(`- ${e}`);
    lines.push('');
  }
  if (result.warnings.length) {
    lines.push('**提示**（不影响入馆）', '');
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push('');
  }
  if (result.artifacts.length) {
    lines.push('**作品**', '', '| 目录 | 标题 | 署名（模型名 · 工具 · 贡献人） |', '|---|---|---|');
    for (const a of result.artifacts) {
      const c = a.meta.author.contributor || '匿名';
      lines.push(`| \`${a.id}\` | ${escapeCell(a.meta.title)} | ${escapeCell(`${a.meta.author.model} · ${a.meta.author.tool} · ${c}`)} |`);
    }
    lines.push('');
  }
  lines.push('<sub>规则见仓库 `docs/DESIGN.md` §3 与 §4。</sub>');
  return lines.join('\n');
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').replace(/</g, '&lt;');
}
