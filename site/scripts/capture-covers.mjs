// 构建前给每件含 index.html 的作品截一张封面：public/covers/<作品id>.png（640×400）。
// 展墙上默认只放这张图，悬停或进入单间时才真正运行作品，作品再多也不会卡。
//
// - 只用系统里已有的 Chrome / Edge / Chromium 无头模式，不引入额外依赖；找不到浏览器就跳过，
//   卡片会退回按 id 生成的色块。可用环境变量 CHROME_PATH 指定浏览器。
// - 作品是不可信代码：截图时把所有网络请求指向一个不存在的代理（断网），每次用全新的临时配置目录，
//   单件超时即杀进程。
// - 按作品目录内容哈希缓存（covers/manifest.json），内容没变就不重截；CI 可缓存 public/covers。
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.AISPARK_ARTIFACTS || resolve(here, '../../artifacts'));
const OUT = resolve(here, '../public/covers');
const MANIFEST = join(OUT, 'manifest.json');
const TIMEOUT_MS = 30_000;
const PARALLEL = 3;

function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env && existsSync(env)) return env;
  const pf = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = {
    win32: pf.flatMap((p) => [
      join(p, 'Google/Chrome/Application/chrome.exe'),
      join(p, 'Microsoft/Edge/Application/msedge.exe'),
      join(p, 'Chromium/Application/chrome.exe'),
    ]),
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'],
  }[process.platform] || [];
  return candidates.find((p) => existsSync(p)) || null;
}

/** 含 aispark.yaml 与 index.html 的作品目录 */
function findWorks(root) {
  const works = [];
  const visit = (dir, depth) => {
    if (existsSync(join(dir, 'aispark.yaml'))) {
      if (existsSync(join(dir, 'index.html'))) works.push(dir);
      return;
    }
    if (depth > 3) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!name.startsWith('.') && statSync(full).isDirectory()) visit(full, depth + 1);
    }
  };
  if (existsSync(root)) visit(root, 0);
  return works;
}

function hashDir(dir) {
  const h = createHash('sha1');
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      if (name.startsWith('.')) continue;
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else h.update(name).update(readFileSync(full));
    }
  };
  walk(dir);
  return h.digest('hex');
}

function capture(chrome, dir, target, noSandbox) {
  const profile = mkdtempSync(join(tmpdir(), 'aispark-cover-'));
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    `--user-data-dir=${profile}`,
    '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>', // 断网
    '--window-size=1280,800', '--force-device-scale-factor=0.5',
    '--virtual-time-budget=2500',
    `--screenshot=${target}`,
    ...(noSandbox ? ['--no-sandbox'] : []),
    pathToFileURL(join(dir, 'index.html')).href,
  ];
  return new Promise((done) => {
    const child = spawn(chrome, args, { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.on('error', () => done(false));
    child.on('exit', () => {
      clearTimeout(timer);
      rmSync(profile, { recursive: true, force: true });
      done(existsSync(target) && statSync(target).size > 0);
    });
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const works = findWorks(SRC);
  let manifest = {};
  try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch {}

  // 清理已不存在的作品留下的旧封面
  const ids = new Set(works.map((d) => d.split(/[\\/]/).pop()));
  for (const name of readdirSync(OUT)) {
    if (name.endsWith('.png') && !ids.has(name.slice(0, -4))) rmSync(join(OUT, name), { force: true });
  }
  for (const id of Object.keys(manifest)) if (!ids.has(id)) delete manifest[id];

  const todo = [];
  for (const dir of works) {
    const id = dir.split(/[\\/]/).pop();
    const hash = hashDir(dir);
    const target = join(OUT, `${id}.png`);
    if (manifest[id] === hash && existsSync(target)) continue;
    todo.push({ id, dir, hash, target });
  }
  if (!todo.length) {
    console.log(`[covers] ${works.length} 张封面均为最新`);
    return writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  const chrome = findChrome();
  if (!chrome) {
    console.warn(`[covers] 未找到 Chrome / Edge / Chromium，跳过 ${todo.length} 张封面（可设置 CHROME_PATH）`);
    return writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  }

  // CI 的 Linux 运行器常禁用非特权用户命名空间，Chrome 沙箱起不来时退回 --no-sandbox（已断网）
  let noSandbox = false;
  let ok = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      rmSync(job.target, { force: true });
      let done = await capture(chrome, job.dir, job.target, noSandbox);
      if (!done && !noSandbox && process.platform === 'linux') {
        noSandbox = true;
        done = await capture(chrome, job.dir, job.target, true);
      }
      if (done) { manifest[job.id] = job.hash; ok++; }
      else console.warn(`[covers] 截图失败：${job.id}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`[covers] 新截 ${ok}/${todo.length} 张，共 ${works.length} 件可运行作品`);
}

main().catch((e) => {
  // 封面只是锦上添花，失败不应阻断构建
  console.warn(`[covers] 出错，已跳过：${e.message}`);
});
