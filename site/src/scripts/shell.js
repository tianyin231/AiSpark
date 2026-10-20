// AiSpark 外壳交互：主题切换、主页筛选/搜索/排序/时间轴、详情页预览框与复制。
// 保持轻量：无自定义光标、无倾斜特效，全部服务于「找作品、看作品」。

/* ---------- 主题 ---------- */
const rootEl = document.documentElement;
const themeBtn = document.querySelector('[data-theme-toggle]');
function syncThemeBtn() {
  if (themeBtn) themeBtn.setAttribute('aria-pressed', String(rootEl.dataset.theme === 'dark'));
}
syncThemeBtn();
themeBtn?.addEventListener('click', () => {
  const next = rootEl.dataset.theme === 'dark' ? 'light' : 'dark';
  rootEl.dataset.theme = next;
  try { localStorage.setItem('aispark-theme', next); } catch (e) {}
  syncThemeBtn();
});

/* ---------- 复制按钮（详情页署名卡 / 关于页代码块） ---------- */
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const target = document.querySelector(btn.getAttribute('data-copy'));
    if (!target) return;
    const label = btn.querySelector('[data-copy-label]');
    try {
      await navigator.clipboard.writeText(target.innerText);
      if (label) {
        const old = label.textContent;
        label.textContent = '已复制';
        setTimeout(() => { label.textContent = old; }, 1600);
      }
    } catch (e) { /* 剪贴板不可用时静默 */ }
  });
});

/* ---------- 详情页：预览框 ---------- */
const frame = document.querySelector('[data-frame]');
if (frame) {
  const iframe = frame.querySelector('iframe');
  iframe?.addEventListener('load', () => frame.classList.remove('is-loading'));
  document.querySelector('[data-frame-reload]')?.addEventListener('click', () => {
    if (!iframe) return;
    frame.classList.add('is-loading');
    iframe.src = iframe.src;
  });
  document.querySelector('[data-frame-full]')?.addEventListener('click', () => {
    if (frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
  });
}

/* ---------- 详情页：图片灯箱 ---------- */
const lightbox = document.querySelector('[data-lightbox]');
if (lightbox) {
  const lbImg = lightbox.querySelector('img');
  document.querySelectorAll('[data-zoom]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.getAttribute('data-alt') || '';
      lightbox.showModal();
    });
  });
  lightbox.addEventListener('click', () => lightbox.close());
}

/* ---------- 通用：滚动定位 + 当前位置高亮 ----------
   链接侧：[data-spy-link="key"]；目标侧：[data-spy-target="key"] */
const mainScroll = document.querySelector('.main-scroll');
const spyLinks = document.querySelectorAll('[data-spy-link]');
if (mainScroll && spyLinks.length) {
  const linkByKey = new Map();
  spyLinks.forEach((l) => {
    linkByKey.set(l.getAttribute('data-spy-link'), l);
    l.addEventListener('click', (e) => {
      const key = l.getAttribute('data-spy-link');
      const target = document.querySelector(`[data-spy-target="${key}"]`);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const key = en.target.getAttribute('data-spy-target');
      spyLinks.forEach((l) => l.classList.toggle('is-active', l.getAttribute('data-spy-link') === key));
      // 只在侧栏容器内部微调滚动，别用 scrollIntoView（会连带滚主区和侧栏整体）
      const link = linkByKey.get(key);
      const scroller = link?.closest('.side-scroll');
      if (link && scroller) {
        const r = link.getBoundingClientRect();
        const c = scroller.getBoundingClientRect();
        if (r.top < c.top || r.bottom > c.bottom) {
          scroller.scrollBy({ top: r.top - c.top - 10, behavior: 'smooth' });
        }
      }
    }
  }, { root: mainScroll, rootMargin: '-70px 0px -65% 0px', threshold: 0 });
  document.querySelectorAll('[data-spy-target]').forEach((t) => spy.observe(t));
}

/* ---------- 主页：搜索 + 类型/模型筛选 + 排序 ---------- */
const cardsRoot = document.querySelector('[data-groups]');
if (cardsRoot) {
  const state = { q: '', type: 'all', model: 'all', sort: 'desc' };
  const cards = [...document.querySelectorAll('[data-card]')];
  const groups = [...document.querySelectorAll('[data-month-group]')];
  const countLabel = document.querySelector('[data-count-label]');
  const emptyEl = document.querySelector('[data-empty-filter]');

  function apply() {
    let visible = 0;
    for (const card of cards) {
      const ok =
        (state.type === 'all' || card.dataset.type === state.type) &&
        (state.model === 'all' || card.dataset.model === state.model) &&
        (!state.q || (card.dataset.search || '').includes(state.q));
      card.classList.toggle('is-hidden', !ok);
      if (ok) visible++;
    }
    for (const g of groups) {
      const any = [...g.querySelectorAll('[data-card]')].some((c) => !c.classList.contains('is-hidden'));
      g.classList.toggle('is-hidden', !any);
    }
    if (countLabel) countLabel.textContent = `${visible} 件作品`;
    if (emptyEl) emptyEl.hidden = visible !== 0;
  }

  function radio(attr, key) {
    document.querySelectorAll(`[${attr}]`).forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`[${attr}]`).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        state[key] = btn.getAttribute(attr);
        apply();
      });
    });
  }
  radio('data-filter-type', 'type');
  radio('data-filter-model', 'model');

  const searchInput = document.querySelector('[data-search-input]');
  searchInput?.addEventListener('input', () => {
    state.q = searchInput.value.trim().toLowerCase();
    apply();
  });

  const sortBtn = document.querySelector('[data-sort-toggle]');
  const sortLabel = document.querySelector('[data-sort-label]');
  sortBtn?.addEventListener('click', () => {
    state.sort = state.sort === 'desc' ? 'asc' : 'desc';
    const dir = state.sort === 'desc' ? -1 : 1;
    if (sortLabel) sortLabel.textContent = state.sort === 'desc' ? '最新在前' : '最早在前';
    groups.sort((a, b) => dir * a.dataset.month.localeCompare(b.dataset.month));
    groups.forEach((g) => {
      const grid = g.querySelector('[data-group-grid]');
      const cs = [...grid.querySelectorAll('[data-card]')];
      cs.sort((a, b) => dir * (Number(a.dataset.ts) - Number(b.dataset.ts)));
      cs.forEach((c) => grid.appendChild(c));
      cardsRoot.appendChild(g);
    });
  });

  apply();
}
