// 全站通用：顶栏高度、深浅色切换、复制按钮、按「/」聚焦搜索。

const root = document.documentElement;
const head = document.querySelector('[data-head]');

/* ---------- 顶栏高度：供 scroll-padding 与缩略地图定位 ---------- */
function syncHead() {
  if (head) root.style.setProperty('--head-h', `${head.offsetHeight}px`);
}
syncHead();
addEventListener('resize', syncHead);

/* ---------- 深浅色：未手动选择时跟随系统 ---------- */
const themeBtn = document.querySelector('[data-theme-toggle]');
const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
const syncTheme = () => themeBtn?.setAttribute('aria-pressed', String(isDark()));
syncTheme();
themeBtn?.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('aispark-theme', next); } catch (e) { /* 隐私模式下存不了，本次有效即可 */ }
  syncTheme();
});

/* ---------- 复制：data-copy="#选择器" 复制该元素文字，或 data-copy-text 直接给文字 ---------- */
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sel = btn.getAttribute('data-copy');
    const text = btn.getAttribute('data-copy-text') ?? (sel ? document.querySelector(sel)?.innerText : '');
    if (!text) return;
    const label = btn.querySelector('[data-copy-label]') || btn;
    const old = label.textContent;
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = '已复制';
    } catch (e) {
      label.textContent = '复制失败，请手动选择';
    }
    setTimeout(() => { label.textContent = old; }, 1600);
  });
});

/* ---------- 「/」聚焦搜索 ---------- */
const searchInput = document.querySelector('[data-search-input]');
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  searchInput?.focus();
  searchInput?.select();
});
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') searchInput.blur();
});
