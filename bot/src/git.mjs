// git 只读适配层。所有调用都用参数数组（不经 shell），PR 内容只被读取，从不检出或执行。
import { execFileSync } from 'node:child_process';

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });

/** base...head 的改动列表；关闭 rename 检测，让「移动」显示为删除 + 新增 */
export function diffChanges(base, head) {
  const out = git(['diff', '--name-status', '--no-renames', '-z', `${base}...${head}`]);
  const parts = out.split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i < parts.length; i += 2) changes.push({ status: parts[i][0], path: parts[i + 1] });
  return changes;
}

/** head 中某目录下的全部条目（含模式与大小） */
export function lsTree(ref, dir) {
  const out = git(['ls-tree', '-r', '-l', '-z', ref, '--', `${dir}/`]);
  return out
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split('\t');
      const [mode, type, , size] = meta.trim().split(/\s+/);
      return { path, mode, type, size: size === '-' ? 0 : Number(size) };
    });
}

export function readText(ref, path) {
  try {
    return git(['show', `${ref}:${path}`]);
  } catch {
    return null;
  }
}

export function hasPath(ref, path) {
  try {
    git(['cat-file', '-e', `${ref}:${path}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
