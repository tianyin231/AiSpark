// AiSpark 全站交互。所有效果在 prefers-reduced-motion 或触屏设备上自动降级。
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- 主题切换 ---------------- */
function initTheme() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const sync = () => btn.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  sync();
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('aispark-theme', next); } catch {}
    sync();
    window.dispatchEvent(new Event('themechange'));
  });
}

/* ---------------- 自定义光标 ---------------- */
function initCursor() {
  if (!finePointer) return;
  const ring = document.querySelector('.cursor');
  const dot = document.querySelector('.cursor-dot');
  const label = ring?.querySelector('.cursor-label');
  if (!ring || !dot) return;
  root.classList.add('has-cursor');

  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    root.classList.add('cursor-on');
  }, { passive: true });
  document.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
  window.addEventListener('blur', () => root.classList.remove('cursor-on'));
  window.addEventListener('pointerdown', () => root.classList.add('cursor-down'));
  window.addEventListener('pointerup', () => root.classList.remove('cursor-down'));

  const tick = () => {
    rx = reduceMotion ? mx : lerp(rx, mx, 0.2);
    ry = reduceMotion ? my : lerp(ry, my, 0.2);
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // 根据悬停目标切换光标形态
  const INTERACTIVE = 'a, button, [role="button"], summary, select, label, [data-cursor]';
  document.addEventListener('pointerover', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest('iframe')) return root.classList.remove('cursor-on');
    const text = t.closest('input:not([type="checkbox"]):not([type="radio"]), textarea');
    root.classList.toggle('cursor-text', Boolean(text));
    const labeled = t.closest('[data-cursor]');
    if (labeled && labeled.dataset.cursor) {
      label.textContent = labeled.dataset.cursor;
      root.classList.add('cursor-label-on');
      root.classList.remove('cursor-hover');
      return;
    }
    root.classList.remove('cursor-label-on');
    root.classList.toggle('cursor-hover', Boolean(t.closest(INTERACTIVE)) && !text);
  });
  // 进入 iframe 后父页面收不到事件，隐藏自定义光标，交给 iframe 内部
  document.querySelectorAll('iframe').forEach((f) => {
    f.addEventListener('mouseenter', () => root.classList.remove('cursor-on'));
  });
}

/* ---------------- 卡片：3D 倾斜 + 聚光 ---------------- */
function initTilt() {
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt) || 6;
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      if (!finePointer || reduceMotion) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--rx', `${(0.5 - py) * max}deg`);
        el.style.setProperty('--ry', `${(px - 0.5) * max}deg`);
        el.classList.add('is-tilting');
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}

/* ---------------- 磁吸 ---------------- */
function initMagnetic() {
  if (!finePointer || reduceMotion) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const s = Number(el.dataset.magnetic) || 0.3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * s}px, ${y * s}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------------- 按钮填充从指针处扩散 ---------------- */
function initButtonFill() {
  document.querySelectorAll('.btn').forEach((el) => {
    const set = (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--rx', `${e.clientX - r.left}px`);
      el.style.setProperty('--ry', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointerenter', set);
    el.addEventListener('pointerleave', set);
  });
}

/* ---------------- 滚动显现 ---------------- */
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('is-in'));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

/* ---------------- 数字滚动 ---------------- */
function initCount() {
  const els = document.querySelectorAll('[data-count]');
  const run = (el) => {
    const to = Number(el.dataset.count) || 0;
    if (reduceMotion || to === 0) return (el.textContent = String(to));
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
  });
  els.forEach((e) => io.observe(e));
}

/* ---------------- 顶栏：滚动样式 + 下滑隐藏 ---------------- */
function initHeader() {
  const h = document.querySelector('.site-header');
  const top = document.querySelector('.to-top');
  let last = scrollY;
  const onScroll = () => {
    const y = scrollY;
    h?.classList.toggle('is-scrolled', y > 8);
    h?.classList.toggle('is-hidden', y > 320 && y > last + 2);
    if (y < last - 2) h?.classList.remove('is-hidden');
    last = y;
    if (top) {
      const max = document.documentElement.scrollHeight - innerHeight;
      top.classList.toggle('is-on', y > 600);
      top.style.setProperty('--p', String(max > 0 ? y / max : 0));
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  top?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
}

/* ---------------- 导航指示块跟随悬停 ---------------- */
function initNavInk() {
  const nav = document.querySelector('.nav');
  const ink = nav?.querySelector('.nav-ink');
  if (!nav || !ink) return;
  const links = [...nav.querySelectorAll(':scope > a')];
  const current = links.find((a) => a.getAttribute('aria-current') === 'page');
  const moveTo = (a) => {
    if (!a) return (ink.style.opacity = '0');
    ink.style.left = `${a.offsetLeft}px`;
    ink.style.width = `${a.offsetWidth}px`;
    ink.style.opacity = '1';
  };
  // 首次定位不要动画
  ink.style.transition = 'none';
  moveTo(current);
  requestAnimationFrame(() => (ink.style.transition = ''));
  links.forEach((a) => a.addEventListener('pointerenter', () => moveTo(a)));
  nav.addEventListener('pointerleave', () => moveTo(current));
}

/* ---------------- 首页：墨点场 ---------------- */
function initField() {
  const canvas = document.querySelector('[data-field]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const GAP = 26;
  let W = 0, H = 0, pts = [], color = '#000', accent = '#b8432f';
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  let visible = true, t = 0;

  const readColors = () => {
    const cs = getComputedStyle(root);
    color = cs.getPropertyValue('--ink').trim();
    accent = cs.getPropertyValue('--accent').trim();
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = [];
    for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) pts.push({ x, y, ox: x, oy: y });
  };
  const draw = () => {
    t += 0.006;
    mouse.x = lerp(mouse.x, mouse.tx, 0.12);
    mouse.y = lerp(mouse.y, mouse.ty, 0.12);
    ctx.clearRect(0, 0, W, H);
    const R = 150;
    for (const p of pts) {
      const dx = p.ox - mouse.x, dy = p.oy - mouse.y;
      const d = Math.hypot(dx, dy);
      const f = d < R ? 1 - d / R : 0;
      const wave = reduceMotion ? 0 : Math.sin(p.ox * 0.012 + p.oy * 0.016 + t * 3) * 1.2;
      const push = f * f * 22;
      p.x = lerp(p.x, p.ox + (d ? (dx / d) * push : 0), 0.18);
      p.y = lerp(p.y, p.oy + (d ? (dy / d) * push : 0) + wave, 0.18);
      ctx.globalAlpha = 0.14 + f * 0.7;
      ctx.fillStyle = f > 0.35 ? accent : color;
      const s = 1.1 + f * 1.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (visible && !reduceMotion) requestAnimationFrame(draw);
  };

  readColors();
  resize();
  addEventListener('resize', () => { resize(); if (reduceMotion) draw(); });
  addEventListener('themechange', () => { readColors(); if (reduceMotion) draw(); });
  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
  });
  host.addEventListener('pointerleave', () => { mouse.tx = -9999; mouse.ty = -9999; });
  new IntersectionObserver(([en]) => {
    const was = visible;
    visible = en.isIntersecting;
    if (visible && !was && !reduceMotion) requestAnimationFrame(draw);
  }).observe(canvas);
  requestAnimationFrame(draw);
}

/* ---------------- 首页：时间线进度 + 类型筛选 ---------------- */
function initTimeline() {
  const tl = document.querySelector('[data-timeline]');
  if (!tl) return;
  const months = [...tl.querySelectorAll('[data-month]')];

  const onScroll = () => {
    const r = tl.getBoundingClientRect();
    const mid = innerHeight * 0.5;
    const p = Math.min(1, Math.max(0, (mid - r.top) / r.height));
    tl.style.setProperty('--progress', String(p));
    let active = null;
    for (const m of months) if (m.getBoundingClientRect().top < mid) active = m;
    months.forEach((m) => m.classList.toggle('is-active', m === (active || months[0])));
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  const bar = document.querySelector('[data-filter]');
  if (!bar) return;
  const ink = bar.querySelector('.filter-ink');
  const btns = [...bar.querySelectorAll('button')];
  const empty = document.querySelector('[data-filter-empty]');
  const moveInk = (b) => {
    ink.style.left = `${b.offsetLeft}px`;
    ink.style.width = `${b.offsetWidth}px`;
  };
  ink.style.transition = 'none';
  moveInk(btns.find((b) => b.getAttribute('aria-pressed') === 'true') || btns[0]);
  requestAnimationFrame(() => (ink.style.transition = ''));
  addEventListener('resize', () => moveInk(btns.find((b) => b.getAttribute('aria-pressed') === 'true')));

  btns.forEach((b) => b.addEventListener('click', () => {
    const type = b.dataset.value;
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    moveInk(b);
    let shown = 0;
    months.forEach((m) => {
      let n = 0;
      m.querySelectorAll('[data-card]').forEach((c) => {
        const ok = type === 'all' || c.dataset.type === type;
        c.classList.toggle('is-filtered', !ok);
        if (ok) n++;
      });
      m.hidden = n === 0;
      shown += n;
    });
    if (empty) empty.hidden = shown > 0;
    onScroll();
  }));
}

/* ---------------- 详情页：预览框控制 ---------------- */
function initFrames() {
  document.querySelectorAll('[data-frame]').forEach((box) => {
    const iframe = box.querySelector('iframe');
    box.querySelector('[data-frame-reload]')?.addEventListener('click', () => {
      box.classList.add('is-loading');
      iframe.src = iframe.src;
    });
    iframe?.addEventListener('load', () => box.classList.remove('is-loading'));
    box.querySelector('[data-frame-full]')?.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else box.requestFullscreen?.();
    });
  });
}

/* ---------------- 复制 ---------------- */
function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.querySelector('[data-copy-label]') || btn;
    const original = label.textContent;
    btn.addEventListener('click', async () => {
      const src = document.querySelector(btn.dataset.copy);
      if (!src) return;
      try {
        await navigator.clipboard.writeText(src.textContent);
        label.textContent = '已复制';
      } catch {
        const r = document.createRange();
        r.selectNodeContents(src);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        label.textContent = '已选中';
      }
      btn.classList.add('is-done');
      setTimeout(() => { label.textContent = original; btn.classList.remove('is-done'); }, 1800);
    });
  });
}

/* ---------------- 图片灯箱 ---------------- */
function initLightbox() {
  const dlg = document.querySelector('[data-lightbox]');
  if (!dlg) return;
  const img = dlg.querySelector('img');
  document.querySelectorAll('[data-zoom]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    img.src = a.getAttribute('href');
    img.alt = a.dataset.alt || '';
    dlg.showModal();
  }));
  dlg.addEventListener('click', () => dlg.close());
}

/* ---------------- 说明页：目录高亮 ---------------- */
function initToc() {
  const toc = document.querySelector('[data-toc]');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a')];
  const ink = toc.querySelector('.toc-ink');
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const set = (a) => {
    links.forEach((l) => l.classList.toggle('is-active', l === a));
    if (ink && a) { ink.style.top = `${a.offsetTop}px`; ink.style.height = `${a.offsetHeight}px`; }
  };
  const sections = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const onScroll = () => {
    let cur = sections[0];
    for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.3) cur = s;
    set(map.get(cur?.id));
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------------- 启动 ---------------- */
initTheme();
initCursor();
initTilt();
initMagnetic();
initButtonFill();
initReveal();
initCount();
initHeader();
initNavInk();
initField();
initTimeline();
initFrames();
initCopy();
initLightbox();
initToc();
