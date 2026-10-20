// 统一处理 base 路径，保证部署到子路径（如 GitHub Pages）时链接正确。
const BASE = (import.meta.env?.BASE_URL || '/').replace(/\/+$/, '');

/** 站内链接：url('/artifact/x') -> '/base/artifact/x' */
export function url(path = '/') {
  const p = String(path).startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}` || '/';
}

/** 作品原始文件：rawUrl('2026/10/dir', 'index.html') */
export function rawUrl(relDir, file = '') {
  const parts = [...relDir.split('/'), ...String(file).split('/')]
    .filter(Boolean)
    .map(encodeURIComponent);
  return url(`/raw/${parts.join('/')}${file ? '' : '/'}`);
}
