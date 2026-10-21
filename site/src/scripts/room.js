// 作品单间：重新运行、全屏、图片灯箱；键盘 ← → 切换作品，Esc 回到展墙。
// 回到展墙时尽量还原离开前的筛选与滚动位置（wall.js 会把展墙网址记在 sessionStorage）。

const stage = document.querySelector('[data-stage]');
const frame = stage?.querySelector('iframe');

document.querySelector('[data-reload]')?.addEventListener('click', () => {
  if (frame) frame.src = frame.src;
});
document.querySelector('[data-full]')?.addEventListener('click', () => {
  stage?.requestFullscreen?.().catch(() => {});
});

/* ---------- 图片灯箱 ---------- */
const lightbox = document.querySelector('[data-lightbox]');
if (lightbox) {
  const img = lightbox.querySelector('img');
  document.querySelectorAll('[data-zoom]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      img.src = a.getAttribute('href');
      img.alt = a.getAttribute('data-alt') || '';
      lightbox.showModal();
    });
  });
  lightbox.addEventListener('click', () => lightbox.close());
}

/* ---------- 回到展墙 ---------- */
const back = document.querySelector('[data-back]');
function savedWall() {
  try { return sessionStorage.getItem('aispark-wall'); } catch (e) { return null; }
}
function goBack(e) {
  if (!back) return;
  const wallPath = new URL(back.href).pathname;
  let ref = null;
  try { ref = document.referrer ? new URL(document.referrer) : null; } catch (err) { /* 无效来源 */ }
  if (ref && ref.origin === location.origin && ref.pathname === wallPath && history.length > 1) {
    e?.preventDefault();
    history.back(); // 直接退回：墙上的筛选、滚动位置都还在
    return;
  }
  const saved = savedWall();
  if (saved && new URL(saved, location.href).pathname === wallPath) {
    e?.preventDefault();
    location.href = saved;
    return;
  }
  if (!e) location.href = back.href;
}
back?.addEventListener('click', goBack);

/* ---------- 键盘 ---------- */
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.fullscreenElement || lightbox?.open) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const a = document.querySelector(e.key === 'ArrowLeft' ? '[data-newer]' : '[data-older]');
    if (a) { e.preventDefault(); location.href = a.href; }
  } else if (e.key === 'Escape') {
    goBack();
  }
});
