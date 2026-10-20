// 把仓库根目录的 artifacts/ 原样复制到 public/raw/，作为作品产物的静态托管目录。
// Git 仓库是唯一事实来源，public/raw 是构建产物，不入库。
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.env.AISPARK_ARTIFACTS || resolve(here, '../../artifacts'));
const dest = resolve(here, '../public/raw');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
  console.log(`[sync] ${src} -> ${dest}`);
} else {
  console.warn(`[sync] 未找到 artifacts 目录：${src}`);
}
