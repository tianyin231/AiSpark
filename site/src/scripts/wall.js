// 展墙交互：筛选（类型 / 模型 / 工具 / 来源 / 日期 / 搜索）与网址同步、排序与视图、
// 墙上试玩、键盘浏览、右侧缩略地图、随便看看，以及进入单间时的页面过渡。
// 卡片全部在构建时生成，这里只做显示/隐藏与重排：不开脚本也能浏览所有作品。

const wall = document.querySelector('[data-wall]');
if (wall) initWall(wall);

function initWall(wall) {
  const FACETS = { model: '模型', tool: '工具', provider: '来源' };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const head = document.querySelector('[data-head]');
  const emptyEl = wall.querySelector('[data-empty]');
  const searchForm = document.querySelector('[data-search-form]');
  const searchInput = document.querySelector('[data-search-input]');
  const statCount = document.querySelector('[data-stat-count]');
  const chipsEl = document.querySelector('[data-chips]');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const headH = () => head?.offsetHeight || 0;

  const cards = [...wall.querySelectorAll('[data-card]')].map((el, i) => ({
    el,
    i,
    id: el.dataset.id,
    type: el.dataset.type,
    model: el.dataset.model || '',
    tool: el.dataset.tool || '',
    provider: el.dataset.provider || '',
    day: el.dataset.date || '', // 卡片用 data-date；data-day 专指月份标题里的每日方块
    ts: Number(el.dataset.ts) || 0,
    search: el.dataset.search || '',
    live: el.dataset.live || '',
    link: el.querySelector('.card-link'),
    thumb: el.querySelector('.thumb'),
    play: el.querySelector('[data-play]'),
  }));
  const byEl = new Map(cards.map((c) => [c.el, c]));
  const byId = new Map(cards.map((c) => [c.id, c]));
  const months = [...wall.querySelectorAll('[data-month]')].map((el) => ({
    el,
    key: el.dataset.month,
    count: el.querySelector('[data-month-count]'),
    days: [...el.querySelectorAll('[data-day]')],
    cards: cards.filter((c) => c.day.startsWith(`${el.dataset.month}-`)),
  }));
  const typeBtns = [...document.querySelectorAll('[data-type-btn]')];
  const typeKeys = new Set(typeBtns.map((b) => b.dataset.typeBtn));

  /* ---------- 状态与网址 ---------- */
  const state = { q: '', qRaw: '', type: 'all', model: new Set(), tool: new Set(), provider: new Set(), day: '', sort: 'desc', view: 'grid' };
  let renderedSort = 'desc';

  function readURL() {
    const p = new URLSearchParams(location.search);
    state.qRaw = (p.get('q') || '').trim();
    state.q = state.qRaw.toLowerCase();
    state.type = typeKeys.has(p.get('type')) ? p.get('type') : 'all';
    for (const k of Object.keys(FACETS)) state[k] = new Set(p.getAll(k).filter(Boolean));
    state.day = /^\d{4}-\d{2}-\d{2}$/.test(p.get('day') || '') ? p.get('day') : '';
    state.sort = p.get('sort') === 'asc' ? 'asc' : 'desc';
    state.view = p.get('view') === 'list' ? 'list' : 'grid';
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (state.qRaw) p.set('q', state.qRaw);
    if (state.type !== 'all') p.set('type', state.type);
    for (const k of Object.keys(FACETS)) for (const v of state[k]) p.append(k, v);
    if (state.day) p.set('day', state.day);
    if (state.sort === 'asc') p.set('sort', 'asc');
    if (state.view === 'list') p.set('view', 'list');
    const qs = p.toString();
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
    try { sessionStorage.setItem('aispark-wall', location.href); } catch (e) { /* 存不了就算了，单间回墙时退回首页 */ }
  }

  function matches(c, skip) {
    if (skip !== 'type' && state.type !== 'all' && c.type !== state.type) return false;
    for (const k of Object.keys(FACETS)) if (skip !== k && state[k].size && !state[k].has(c[k])) return false;
    if (skip !== 'day' && state.day && c.day !== state.day) return false;
    if (state.q && !state.q.split(/\s+/).every((w) => c.search.includes(w))) return false;
    return true;
  }

  /* ---------- 渲染 ---------- */
  const level = (n) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

  function reorder() {
    const dir = state.sort === 'asc' ? 1 : -1;
    const frag = document.createDocumentFragment();
    for (const m of [...months].sort((a, b) => dir * a.key.localeCompare(b.key))) {
      frag.appendChild(m.el);
      [...m.cards].sort((a, b) => dir * (a.ts - b.ts) || dir * a.id.localeCompare(b.id)).forEach((c) => frag.appendChild(c.el));
    }
    if (emptyEl) frag.appendChild(emptyEl);
    wall.appendChild(frag);
    renderedSort = state.sort;
  }

  function render() {
    let visible = 0;
    for (const c of cards) {
      const ok = matches(c);
      c.el.hidden = !ok;
      if (ok) visible++;
    }
    if (renderedSort !== state.sort) reorder();

    for (const m of months) {
      const shown = m.cards.filter((c) => !c.el.hidden).length;
      m.el.hidden = shown === 0;
      m.count.textContent = `${shown} 件`;
      const perDay = {};
      for (const c of m.cards) if (matches(c, 'day')) perDay[c.day] = (perDay[c.day] || 0) + 1;
      for (const b of m.days) {
        const n = perDay[b.dataset.day] || 0;
        const on = state.day === b.dataset.day;
        const [, mo, d] = b.dataset.day.split('-').map(Number);
        b.dataset.c = String(level(n));
        b.disabled = n === 0 && !on;
        b.setAttribute('aria-pressed', String(on));
        b.title = `${mo} 月 ${d} 日 · ${n} 件`;
        b.setAttribute('aria-label', `${mo} 月 ${d} 日，${n} 件`);
      }
    }

    wall.classList.toggle('is-list', state.view === 'list');
    if (emptyEl) emptyEl.hidden = visible !== 0;
    if (statCount) statCount.textContent = String(visible);

    const typeCount = {};
    let typeTotal = 0;
    for (const c of cards) if (matches(c, 'type')) { typeCount[c.type] = (typeCount[c.type] || 0) + 1; typeTotal++; }
    for (const b of typeBtns) {
      const t = b.dataset.typeBtn;
      const n = t === 'all' ? typeTotal : typeCount[t] || 0;
      b.setAttribute('aria-pressed', String(state.type === t));
      b.classList.toggle('is-zero', n === 0 && state.type !== t);
      const i = b.querySelector('[data-type-count]');
      if (i) i.textContent = String(n);
    }
    for (const seg of ['sort', 'view']) {
      document.querySelectorAll(`[data-${seg}] [data-v]`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state[seg])));
    }
    document.querySelectorAll('[data-facet]').forEach((b) => {
      const n = state[b.dataset.facet].size;
      b.querySelector('[data-facet-count]').textContent = n ? String(n) : '';
    });
    renderChips();
    requestAnimationFrame(buildMap);
  }

  function renderChips() {
    if (!chipsEl) return;
    const out = [];
    for (const [k, label] of Object.entries(FACETS)) {
      for (const v of state[k]) out.push(`<button class="chip" type="button" data-k="${k}" data-v="${esc(v)}" aria-label="移除筛选：${label} ${esc(v)}"><span>${label}</span>${esc(v)} ✕</button>`);
    }
    if (state.day) out.push(`<button class="chip" type="button" data-k="day" data-v="${state.day}" aria-label="移除筛选：日期 ${state.day}"><span>日期</span>${state.day} ✕</button>`);
    chipsEl.innerHTML = out.join('');
  }

  /** 改变筛选后重绘；附近的卡片带上过渡名，让它们平滑移到新位置 */
  function apply({ animate = true } = {}) {
    stopLive();
    writeURL();
    if (!animate || reduceMotion || !document.startViewTransition) return render();
    const named = [];
    const h = innerHeight;
    for (const c of cards) {
      if (c.el.hidden) continue;
      const r = c.el.getBoundingClientRect();
      if (r.bottom > -h * 0.25 && r.top < h * 1.25) {
        c.el.style.viewTransitionName = `card-${c.i}`;
        named.push(c);
      }
    }
    const t = document.startViewTransition(render);
    t.ready.catch(() => {}); // 过渡被跳过（比如紧接着发生了页面跳转）时不报错，内容照样更新
    t.finished.finally(() => named.forEach((c) => (c.el.style.viewTransitionName = '')));
  }

  function resetAll() {
    state.q = state.qRaw = '';
    state.type = 'all';
    state.day = '';
    for (const k of Object.keys(FACETS)) state[k].clear();
    if (searchInput) searchInput.value = '';
    apply();
  }

  /* ---------- 墙上试玩：作品按 1280×800 渲染后等比缩小，移开即停，同时只运行一件 ---------- */
  let liveCard = null;
  let hoverTimer = 0;
  const canHover = matchMedia('(hover: hover)').matches;
  const PLAY_IDLE = canHover ? '悬停试玩' : '▶ 试玩';
  const PLAY_LIVE = canHover ? '试玩中 · 移开即停' : '试玩中 · 点此停止';
  if (!canHover) cards.forEach((c) => c.play && (c.play.textContent = PLAY_IDLE));

  function startLive(c) {
    if (!c || !c.live || liveCard === c || state.view === 'list') return;
    stopLive();
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts allow-pointer-lock'); // 不给 allow-same-origin：作品碰不到本站
    f.setAttribute('referrerpolicy', 'no-referrer');
    f.title = `${c.link.textContent.trim()} 试玩`;
    f.style.transform = `scale(${c.thumb.clientWidth / 1280})`;
    f.src = c.live;
    c.thumb.classList.add('is-loading');
    f.addEventListener('load', () => c.thumb.classList.remove('is-loading'), { once: true });
    c.thumb.appendChild(f);
    c.el.classList.add('is-live');
    if (c.play) c.play.textContent = PLAY_LIVE;
    liveCard = c;
  }
  function stopLive() {
    if (!liveCard) return;
    const c = liveCard;
    liveCard = null;
    c.thumb.querySelector('iframe')?.remove();
    c.thumb.classList.remove('is-loading');
    c.el.classList.remove('is-live');
    if (c.play) c.play.textContent = PLAY_IDLE;
  }

  wall.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-card]');
    if (!el || el.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    const c = byEl.get(el);
    if (c?.live) hoverTimer = setTimeout(() => startLive(c), 420);
  });
  wall.addEventListener('pointerout', (e) => {
    const el = e.target.closest('[data-card]');
    if (!el || el.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    if (liveCard?.el === el) stopLive();
  });

  wall.addEventListener('click', (e) => {
    const day = e.target.closest('button[data-day]');
    if (day) {
      state.day = state.day === day.dataset.day ? '' : day.dataset.day;
      apply();
      return;
    }
    const play = e.target.closest('[data-play]');
    if (play) {
      e.preventDefault();
      const c = byEl.get(play.closest('[data-card]'));
      liveCard === c ? stopLive() : startLive(c);
      return;
    }
    if (e.target.closest('[data-reset]')) resetAll();
  });

  /* ---------- 工具条 ---------- */
  typeBtns.forEach((b) => b.addEventListener('click', () => {
    state.type = b.dataset.typeBtn;
    apply();
  }));
  for (const seg of ['sort', 'view']) {
    document.querySelector(`[data-${seg}]`)?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b || state[seg] === b.dataset.v) return;
      state[seg] = b.dataset.v;
      apply();
    });
  }
  chipsEl?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.k === 'day') state.day = '';
    else state[chip.dataset.k].delete(chip.dataset.v);
    apply();
  });
  document.querySelector('[data-random]')?.addEventListener('click', randomOpen);

  let searchTimer = 0;
  searchForm?.addEventListener('submit', (e) => e.preventDefault());
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.qRaw = searchInput.value.trim();
      state.q = state.qRaw.toLowerCase();
      apply({ animate: false });
    }, 120);
  });

  /* ---------- 模型 / 工具 / 来源筛选面板：可搜索、可多选，数量再多也放得下 ---------- */
  let pop = null;
  let popBtn = null;

  function openPop(btn) {
    const key = btn.dataset.facet;
    if (popBtn === btn) return closePop();
    closePop();
    popBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div');
    pop.className = 'pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', `按${FACETS[key]}筛选`);
    pop.innerHTML = `<input type="search" placeholder="搜索${FACETS[key]}…" aria-label="搜索${FACETS[key]}" autocomplete="off"><ul></ul>`;
    document.body.appendChild(pop);
    const input = pop.querySelector('input');
    const list = pop.querySelector('ul');
    const r = btn.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 6}px`;

    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const counts = new Map();
      for (const c of cards) if (c[key] && matches(c, key)) counts.set(c[key], (counts.get(c[key]) || 0) + 1);
      for (const v of state[key]) if (!counts.has(v)) counts.set(v, 0);
      const rows = [...counts].filter(([v]) => v.toLowerCase().includes(q)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      list.innerHTML = rows.length
        ? rows.map(([v, n]) => {
          const on = state[key].has(v);
          return `<li><button type="button" data-v="${esc(v)}" aria-pressed="${on}"><span class="ck" aria-hidden="true">${on ? '✓' : ''}</span><span>${esc(v)}</span><i>${n}</i></button></li>`;
        }).join('')
        : `<li class="pop-none">没有匹配的${FACETS[key]}</li>`;
    };
    draw();
    input.addEventListener('input', draw);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const v = b.dataset.v;
      state[key].has(v) ? state[key].delete(v) : state[key].add(v);
      apply();
      draw();
      list.querySelector(`[data-v="${CSS.escape(v)}"]`)?.focus();
    });
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePop(); btn.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [input, ...list.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    });
    input.focus();
  }
  function closePop() {
    if (!pop) return;
    pop.remove();
    pop = null;
    popBtn?.setAttribute('aria-expanded', 'false');
    popBtn = null;
  }
  document.querySelectorAll('[data-facet]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    openPop(b);
  }));
  document.addEventListener('click', (e) => {
    if (pop && !pop.contains(e.target)) closePop();
  });
  document.querySelector('.head-tools')?.addEventListener('scroll', closePop, { passive: true });

  /* ---------- 键盘：方向键在墙上移动，空格试玩，R 随便看看 ---------- */
  function focusCard(el) {
    el.querySelector('.card-link')?.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  function moveFocus(key) {
    const list = [...wall.querySelectorAll('[data-card]:not([hidden])')];
    if (!list.length) return false;
    const cur = document.activeElement?.closest?.('[data-card]');
    if (!cur || !wall.contains(cur)) {
      if (key === 'ArrowUp' || key === 'ArrowDown') return false; // 没选中作品时，上下键照常滚动页面
      focusCard(list.find((el) => el.getBoundingClientRect().bottom > headH()) || list[0]);
      return true;
    }
    let target = null;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      target = list[list.indexOf(cur) + (key === 'ArrowRight' ? 1 : -1)];
    } else {
      const r = cur.getBoundingClientRect();
      const down = key === 'ArrowDown';
      const rows = list.map((el) => ({ el, b: el.getBoundingClientRect() })).filter(({ b }) => (down ? b.top > r.top + 4 : b.top < r.top - 4));
      if (rows.length) {
        const rowTop = down ? Math.min(...rows.map((x) => x.b.top)) : Math.max(...rows.map((x) => x.b.top));
        target = rows
          .filter((x) => Math.abs(x.b.top - rowTop) < 4)
          .sort((a, b) => Math.abs(a.b.left - r.left) - Math.abs(b.b.left - r.left))[0].el;
      }
    }
    if (target) focusCard(target);
    return true;
  }
  function randomOpen() {
    const list = cards.filter((c) => !c.el.hidden);
    if (!list.length) return;
    location.href = list[Math.floor(Math.random() * list.length)].link.href;
  }

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || pop) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); randomOpen(); return; }
    if (e.key.startsWith('Arrow')) { if (moveFocus(e.key)) e.preventDefault(); return; }
    const el = document.activeElement?.closest?.('[data-card]');
    const c = el && byEl.get(el);
    if (!c) return;
    if (e.key === ' ') { e.preventDefault(); liveCard === c ? stopLive() : startLive(c); }
    if (e.key === 'Escape') stopLive();
  });

  /* ---------- 右侧缩略地图 ---------- */
  const rail = document.querySelector('[data-rail]');
  const map = document.querySelector('[data-rail-map]');
  const labels = document.querySelector('[data-rail-labels]');
  const vp = document.querySelector('[data-rail-vp]');
  const tip = document.querySelector('[data-rail-tip]');
  let scale = 0.1;
  if (rail) rail.hidden = false;

  function buildMap() {
    if (!map || !rail || getComputedStyle(rail).display === 'none') return;
    map.querySelectorAll('i').forEach((n) => n.remove());
    labels.textContent = '';
    const H = wall.offsetHeight;
    const W = wall.offsetWidth;
    const mh = map.clientHeight;
    const mw = map.clientWidth - 6;
    if (!H || !W || !mh) return;
    scale = Math.min(0.12, mh / H);
    const frag = document.createDocumentFragment();
    for (const c of cards) {
      if (c.el.hidden) continue;
      const h = state.view === 'list' ? c.el.offsetHeight : c.thumb.offsetHeight;
      const tick = document.createElement('i');
      tick.dataset.type = c.type;
      tick.dataset.id = c.id;
      tick.style.cssText = `left:${6 + (c.el.offsetLeft / W) * mw}px;top:${c.el.offsetTop * scale}px;width:${Math.max(2, (c.el.offsetWidth / W) * mw - 2)}px;height:${Math.max(2, h * scale - 1)}px`;
      frag.appendChild(tick);
    }
    map.appendChild(frag);
    let lastY = -99;
    for (const m of months.filter((x) => !x.el.hidden).sort((a, b) => a.el.offsetTop - b.el.offsetTop)) {
      const y = m.el.offsetTop * scale;
      if (y - lastY < 14) continue;
      lastY = y;
      const [yy, mm] = m.key.split('-');
      const s = document.createElement('span');
      s.style.top = `${y + 5}px`;
      s.innerHTML = `${yy}.<b>${mm}</b>`;
      labels.appendChild(s);
    }
    syncViewport();
  }
  function syncViewport() {
    if (!vp) return;
    const top = (headH() - wall.getBoundingClientRect().top) * scale;
    vp.style.top = `${Math.max(0, top)}px`;
    vp.style.height = `${Math.max(14, Math.min(wall.offsetHeight, innerHeight - headH()) * scale)}px`;
  }
  function scrollFromMap(clientY) {
    const y = (clientY - map.getBoundingClientRect().top) / scale;
    const wallTop = wall.getBoundingClientRect().top + scrollY;
    scrollTo({ top: wallTop + y - headH() - (innerHeight - headH()) / 2 });
  }

  if (map) {
    let dragging = false;
    map.addEventListener('pointerdown', (e) => {
      dragging = true;
      map.setPointerCapture(e.pointerId);
      scrollFromMap(e.clientY);
    });
    map.addEventListener('pointerup', () => { dragging = false; });
    map.addEventListener('pointercancel', () => { dragging = false; });
    map.addEventListener('pointermove', (e) => {
      if (dragging) { scrollFromMap(e.clientY); tip.hidden = true; return; }
      // 色块很小，取离指针最近的一块，不要求正好压在上面
      const box = map.getBoundingClientRect();
      const px = e.clientX - box.left;
      const py = e.clientY - box.top;
      let t = null;
      let best = 24 * 24;
      for (const n of map.querySelectorAll('i')) {
        const dx = Math.max(n.offsetLeft - px, 0, px - (n.offsetLeft + n.offsetWidth));
        const dy = Math.max(n.offsetTop - py, 0, py - (n.offsetTop + n.offsetHeight));
        const d = dx * dx + dy * dy * 4;
        if (d < best) { best = d; t = n; }
      }
      map.querySelectorAll('i.is-hot').forEach((n) => n !== t && n.classList.remove('is-hot'));
      const c = t && byId.get(t.dataset.id);
      if (!c) { tip.hidden = true; return; }
      t.classList.add('is-hot');
      if (tip.dataset.id !== c.id) {
        tip.dataset.id = c.id;
        tip.innerHTML = `<div class="tip-thumb"></div><div class="tip-body"><small>${esc(c.el.querySelector('.no')?.textContent || '')}</small>${esc(c.link.textContent.trim())}<small>${esc(c.model)}</small></div>`;
        const media = c.thumb.firstElementChild?.cloneNode(true);
        if (media) {
          media.removeAttribute?.('loading');
          tip.querySelector('.tip-thumb').appendChild(media);
        }
      }
      tip.hidden = false;
      tip.style.left = `${rail.getBoundingClientRect().left - tip.offsetWidth - 12}px`;
      tip.style.top = `${Math.min(innerHeight - tip.offsetHeight - 8, Math.max(8, e.clientY - 60))}px`;
    });
    map.addEventListener('pointerleave', () => {
      tip.hidden = true;
      map.querySelectorAll('i.is-hot').forEach((n) => n.classList.remove('is-hot'));
    });
  }

  addEventListener('scroll', syncViewport, { passive: true });
  let resizeTimer = 0;
  addEventListener('resize', () => {
    closePop();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { stopLive(); buildMap(); }, 150);
  });
  document.fonts?.ready.then(buildMap);

  /* ---------- 键盘提示：只给有鼠标和键盘的设备看，滚到页脚时让开 ---------- */
  const hint = document.querySelector('[data-hint]');
  const foot = document.querySelector('.foot');
  if (hint && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hint.hidden = false;
    if (foot) new IntersectionObserver(([en]) => hint.classList.toggle('is-faded', en.isIntersecting)).observe(foot);
  }

  /* ---------- 页面过渡：进入单间时，被点的缩略图放大成作品画面（返回时的收回见 index.astro 内联脚本） ---------- */
  addEventListener('pageswap', (e) => {
    if (!e.viewTransition) return;
    const m = e.activation?.entry?.url && new URL(e.activation.entry.url).pathname.match(/\/artifact\/([^/]+)\/?$/);
    const c = m && byId.get(decodeURIComponent(m[1]));
    cards.forEach((x) => (x.thumb.style.viewTransitionName = ''));
    if (c && !c.el.hidden) c.thumb.style.viewTransitionName = 'stage';
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // 从往返缓存回来：清掉离开时留下的过渡名，避免下次进入单间时出现两个同名元素
    cards.forEach((x) => (x.thumb.style.viewTransitionName = ''));
    stopLive();
    closePop();
  });

  /* ---------- 启动 ---------- */
  readURL();
  if (searchInput) searchInput.value = state.qRaw;
  render();
  writeURL();
}
