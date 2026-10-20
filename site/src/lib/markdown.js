// README 渲染。作品 README 来自任意投稿者，必须视为不可信输入：
// - 原始 HTML 一律转义为文本，不在主站同源下执行；
// - 链接只放行 http(s)/mailto 与相对路径，其余协议替换为 '#'；
// - 相对路径（图片、链接）改写到该作品的 raw 目录。
import { Marked } from 'marked';
import { rawUrl } from './url.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveHref(href, relDir) {
  const h = String(href || '').trim();
  if (!h) return '#';
  if (h.startsWith('#')) return h;
  if (/^(https?:|mailto:)/i.test(h)) return h;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//')) return '#'; // javascript:, data: 等
  const clean = h.replace(/^\.\//, '').replace(/^\/+/, '');
  if (clean.split('/').includes('..')) return '#'; // 不允许跳出作品目录
  return rawUrl(relDir, clean);
}

export function renderMarkdown(src, relDir, { stripTitle } = {}) {
  const md = new Marked({ gfm: true, breaks: false });
  md.use({
    renderer: {
      html({ text }) {
        return escapeHtml(text);
      },
      link({ href, title, tokens }) {
        const target = resolveHref(href, relDir);
        const external = /^https?:/i.test(target);
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        const ext = external ? ' target="_blank" rel="noopener noreferrer nofollow"' : '';
        return `<a href="${escapeHtml(target)}"${t}${ext}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        const target = resolveHref(href, relDir);
        if (/^https?:/i.test(target)) {
          // 外链图片可能被用来追踪访客，只显示为链接
          return `<a href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(text || target)}</a>`;
        }
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(target)}" alt="${escapeHtml(text || '')}"${t} loading="lazy" />`;
      },
    },
  });

  const tokens = md.lexer(String(src || ''));
  if (stripTitle) {
    const i = tokens.findIndex((t) => t.type !== 'space');
    if (i >= 0 && tokens[i].type === 'heading' && tokens[i].depth === 1) tokens.splice(i, 1);
  }
  return md.parser(tokens);
}

/** 纯文本摘要：取第一段正文 */
export function excerpt(src, max = 96) {
  const body = String(src || '')
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|>|-|\*|\||!\[|\d+\.)/.test(p));
  if (!body) return '';
  const text = body.replace(/[`*_~\[\]]/g, '').replace(/\(([^)]*)\)/g, '').replace(/\s+/g, ' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
