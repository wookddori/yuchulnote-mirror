/* 업권 탭 · 상태 필터 · 검색을 브라우저에서 처리한다. 외부 호출은 같은 출처의 search-index.json 하나뿐이다.
 * URL 동기화: 업권은 경로(/finance), 상태는 ?s=notice|ing, 검색은 ?q= */
/* 다크 모드 전환: 선택값은 이 브라우저에만 저장한다(localStorage, 쓸 수 없으면 저장하지 않음). 선택이 없으면 기기 설정을 따른다. */
(function () {
  'use strict';
  var KEY = 'theme', root = document.documentElement;
  function stored() { try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; } }
  function system() { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  function current() { return root.getAttribute('data-theme') || system(); }
  var saved = stored();
  if (saved) root.setAttribute('data-theme', saved);
  function paint(btn) {
    var dark = current() === 'dark';
    btn.textContent = dark ? '라이트 모드' : '다크 모드';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.setAttribute('aria-label', dark ? '라이트 모드로 전환' : '다크 모드로 전환');
  }
  function init() {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.hidden = false;
    paint(btn);
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* 저장 실패는 무시 */ }
      paint(btn);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

(function () {
  'use strict';
  if (document.body.getAttribute('data-page') !== 'list') return;

  var STATES = { notice: 'data-notice', ing: 'data-ing' };
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('.month'));
  var input = document.getElementById('q');
  var emptyEl = document.getElementById('empty');
  var statusEl = document.getElementById('result-status');
  var listEl = document.getElementById('list');
  var stateBtn = document.getElementById('state-btn');
  var moreBtn = document.getElementById('more-btn');
  var morePanel = document.getElementById('more-panel');
  var statePanel = document.getElementById('state-panel');
  var stateLabel = document.getElementById('state-label');

  var pathToSector = {};
  tabs.forEach(function (t) {
    pathToSector[new URL(t.href, location.href).pathname.replace(/\.html$/, '')] = t.getAttribute('data-sector');
  });

  var PAGE_SIZES = [10, 20, 50, 100]; // 한 쪽에 보여 줄 개수 선택지(자바스크립트가 꺼져 있으면 전체가 보인다)
  var DEFAULT_SIZE = 20;
  var state = { sector: 'all', s: '', q: '', page: 1, size: DEFAULT_SIZE };
  var pagerEl = document.getElementById('pager');
  var index = null; // slug -> 정규화된 검색 문자열

  function norm(str) {
    return String(str || '').toLowerCase().replace(/[\s·.\-_,()]+/g, '');
  }

  function readUrl() {
    var path = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
    state.sector = pathToSector[path] || document.body.getAttribute('data-sector') || 'all';
    var params = new URLSearchParams(location.search);
    var s = params.get('s');
    state.s = STATES[s] ? s : '';
    state.q = (params.get('q') || '').slice(0, 100);
    var n = parseInt(params.get('n') || '', 10);
    state.size = PAGE_SIZES.indexOf(n) !== -1 ? n : DEFAULT_SIZE;
    var p = parseInt(params.get('p') || '', 10);
    state.page = p > 0 && p < 100000 ? p : 1;
  }

  function buildUrl() {
    var tab = tabs.filter(function (t) { return t.getAttribute('data-sector') === state.sector; })[0];
    var base = tab ? new URL(tab.href, location.href).pathname : '/';
    var params = new URLSearchParams();
    if (state.s) params.set('s', state.s);
    if (state.q) params.set('q', state.q);
    if (state.size !== DEFAULT_SIZE) params.set('n', String(state.size));
    if (state.page > 1) params.set('p', String(state.page));
    var qs = params.toString();
    return base + (qs ? '?' + qs : '');
  }

  function haystack(row) {
    var slug = row.getAttribute('data-slug');
    if (index && index[slug] !== undefined) return index[slug];
    return norm(row.textContent);
  }

  function matchQ(row, terms) {
    if (!terms.length) return true;
    var h = haystack(row);
    return terms.every(function (t) { return h.indexOf(t) !== -1; });
  }
  function matchS(row, s) {
    return !s || row.getAttribute(STATES[s]) === '1';
  }
  function matchSector(row, sector) {
    return sector === 'all' || row.getAttribute('data-sector') === sector;
  }

  function render() {
    var terms = state.q.split(/\s+/).map(norm).filter(Boolean);
    var matchedRows = [];   // 조건에 맞는 행(최신순, 화면 순서)
    var tabCounts = { all: 0 };
    var chipCounts = { all: 0, notice: 0, ing: 0 };

    rows.forEach(function (row) {
      var q = matchQ(row, terms);
      var sec = row.getAttribute('data-sector');
      // 탭 건수: 현재 상태 필터와 검색을 적용한 업권별 건수
      if (q && matchS(row, state.s)) {
        tabCounts.all += 1;
        tabCounts[sec] = (tabCounts[sec] || 0) + 1;
      }
      // 상태 건수: 현재 업권과 검색을 적용한 상태별 건수
      if (q && matchSector(row, state.sector)) {
        chipCounts.all += 1;
        if (row.getAttribute('data-notice') === '1') chipCounts.notice += 1;
        if (row.getAttribute('data-ing') === '1') chipCounts.ing += 1;
      }
      var visible = q && matchSector(row, state.sector) && matchS(row, state.s);
      row.setAttribute('data-match', visible ? '1' : '0');
      if (visible) matchedRows.push(row);
      row.hidden = true;
    });

    // 쪽 나누기: 범위를 벗어난 쪽 번호는 마지막 쪽으로 맞춘다
    var matched = matchedRows.length;
    var pages = Math.max(1, Math.ceil(matched / state.size));
    if (state.page > pages) state.page = pages;
    var from = (state.page - 1) * state.size;
    var pageRows = matchedRows.slice(from, from + state.size);
    pageRows.forEach(function (row) { row.hidden = false; });
    var shown = pageRows.length;

    groups.forEach(function (g) {
      var n = g.querySelectorAll('.row:not([hidden])').length;
      g.hidden = n === 0;
      var c = g.querySelector('[data-month-count]');
      if (c) c.textContent = g.querySelectorAll('.row[data-match="1"]').length;
    });
    renderPager(matched, pages);

    tabs.forEach(function (t) {
      var key = t.getAttribute('data-sector');
      var sel = key === state.sector;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      t.setAttribute('tabindex', sel ? '0' : '-1');
      var c = t.querySelector('[data-count-for]');
      if (c) c.textContent = tabCounts[key] || 0;
      if (sel && listEl) listEl.setAttribute('aria-labelledby', t.id);
    });
    if (moreBtn && morePanel) {
      moreBtn.classList.toggle('on', tabs.some(function (t) { return morePanel.contains(t) && t.getAttribute('data-sector') === state.sector; }));
    }
    chips.forEach(function (ch) {
      var key = ch.getAttribute('data-state');
      var pressed = key === 'all' ? !state.s : state.s === key;
      ch.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      var c = ch.querySelector('[data-count-state]');
      if (c) c.textContent = chipCounts[key] || 0;
    });

    if (stateLabel) {
      var cur = chips.filter(function (ch) { return ch.getAttribute('aria-pressed') === 'true'; })[0];
      stateLabel.textContent = cur ? (cur.getAttribute('data-label') || '') : '';
      if (stateBtn) stateBtn.classList.toggle('on', !!state.s);
    }
    if (emptyEl) emptyEl.hidden = matched !== 0;
    if (statusEl) statusEl.textContent = matched + '건 중 ' + shown + '건 표시 (' + state.page + '/' + pages + '쪽)';
  }

  // 쪽 이동 막대: 이전 · 번호(앞뒤 2쪽과 처음·끝) · 다음, 그리고 보기 개수 선택. 링크는 실제 주소를 가져 새 탭으로도 열 수 있다.
  function pageLink(label, page, size, current) {
    var save = { page: state.page, size: state.size };
    state.page = page;
    state.size = size;
    var href = buildUrl();
    state.page = save.page;
    state.size = save.size;
    if (current) {
      var b = document.createElement('strong');
      b.textContent = label;
      b.setAttribute('aria-current', 'page');
      return b;
    }
    var a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    a.setAttribute('data-page', String(page));
    a.setAttribute('data-size', String(size));
    return a;
  }

  function renderPager(matched, pages) {
    if (!pagerEl) return;
    pagerEl.textContent = '';
    if (matched <= PAGE_SIZES[0]) { pagerEl.hidden = true; return; }
    pagerEl.hidden = false;
    var info = document.createElement('span');
    info.textContent = '총 ' + matched + '건 · ' + state.page + '/' + pages + '쪽';
    pagerEl.appendChild(info);
    if (state.page > 1) pagerEl.appendChild(pageLink('이전', state.page - 1, state.size, false));
    var prev = 0;
    for (var n = 1; n <= pages; n++) {
      if (n !== 1 && n !== pages && Math.abs(n - state.page) > 2) continue;
      if (n - prev > 1) {
        var gap = document.createElement('span');
        gap.textContent = '…';
        pagerEl.appendChild(gap);
      }
      pagerEl.appendChild(pageLink(String(n), n, state.size, n === state.page));
      prev = n;
    }
    if (state.page < pages) pagerEl.appendChild(pageLink('다음', state.page + 1, state.size, false));
    var sizes = document.createElement('span');
    sizes.className = 'sizes';
    sizes.appendChild(document.createTextNode('보기: '));
    PAGE_SIZES.forEach(function (sz) {
      sizes.appendChild(pageLink(String(sz), 1, sz, sz === state.size));
    });
    sizes.appendChild(document.createTextNode('개씩'));
    pagerEl.appendChild(sizes);
  }

  function push(replace) {
    var url = buildUrl();
    if (url === location.pathname + location.search) return;
    try {
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    } catch (e) { /* 파일 미리보기 등에서는 URL 동기화를 건너뛴다 */ }
  }

  function setMore(open) {
    if (!moreBtn || !morePanel) return;
    morePanel.hidden = !open;
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var lab = moreBtn.querySelector('.more-label'); var arr = moreBtn.querySelector('.more-arrow');
    if (lab) lab.textContent = open ? '접기' : '더보기';
    if (arr) arr.textContent = open ? '▴' : '▾';
  }
  if (moreBtn && morePanel) {
    moreBtn.addEventListener('click', function () { setMore(morePanel.hidden); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !morePanel.hidden) { setMore(false); moreBtn.focus(); }
    });
  }

  function selectSector(key, focus) {
    setMore(false);
    state.sector = key;
    state.page = 1;
    push(false);
    render();
    if (focus) {
      tabs.forEach(function (t) { if (t.getAttribute('data-sector') === key) t.focus(); });
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
      ev.preventDefault();
      selectSector(t.getAttribute('data-sector'), false);
    });
    t.addEventListener('keydown', function (ev) {
      var next = -1;
      if (ev.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (ev.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      ev.preventDefault();
      selectSector(tabs[next].getAttribute('data-sector'), true);
    });
  });

  chips.forEach(function (ch) {
    ch.addEventListener('click', function () {
      var key = ch.getAttribute('data-state');
      state.s = key === 'all' || state.s === key ? '' : key;
      state.page = 1;
      push(false);
      render();
      setPanel(false);
      if (stateBtn) stateBtn.focus();
    });
  });

  function setPanel(open) {
    if (!stateBtn || !statePanel) return;
    statePanel.hidden = !open;
    stateBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (stateBtn && statePanel) {
    stateBtn.addEventListener('click', function () { setPanel(statePanel.hidden); });
    document.addEventListener('click', function (ev) {
      if (!statePanel.hidden && !statePanel.contains(ev.target) && !stateBtn.contains(ev.target)) setPanel(false);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !statePanel.hidden) { setPanel(false); stateBtn.focus(); }
    });
  }

  var loading = false;
  function loadIndex() {
    if (index || loading || !window.fetch) return;
    loading = true;
    fetch('/data/search-index.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.items || []);
        var map = {};
        items.forEach(function (it) {
          map[it.slug] = norm([it.org_name, it.title].concat(it.keywords || []).join(' '));
        });
        index = map;
        render();
      })
      .catch(function () { /* 인덱스 실패 시 목록 텍스트로 검색한다 */ });
  }

  input.addEventListener('focus', loadIndex);
  input.addEventListener('input', function () {
    loadIndex();
    state.q = input.value.slice(0, 100);
    state.page = 1;
    push(true);
    render();
  });

  if (pagerEl) {
    pagerEl.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[data-page]') : null;
      if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;   // 새 탭으로 열기는 그대로 둔다
      ev.preventDefault();
      state.page = parseInt(a.getAttribute('data-page'), 10) || 1;
      state.size = parseInt(a.getAttribute('data-size'), 10) || DEFAULT_SIZE;
      push(false);
      render();
      if (listEl && listEl.scrollIntoView) listEl.scrollIntoView({ block: 'start' });
    });
  }

  window.addEventListener('popstate', function () {
    readUrl();
    input.value = state.q;
    render();
  });

  // 수집 지연 배지: 마지막 확인 후 기준 시간이 지났으면 보인다(빌드 시점 값은 시간이 지나면 낡으므로 브라우저에서 다시 판단)
  var fresh = document.getElementById('freshness');
  var badge = document.getElementById('stale-badge');
  if (fresh && badge) {
    var last = Date.parse(fresh.getAttribute('data-last-checked') || '');
    var limit = parseInt(fresh.getAttribute('data-stale-minutes') || '360', 10);
    if (!isNaN(last)) badge.hidden = (Date.now() - last) / 60000 <= limit;
  }

  readUrl();
  input.value = state.q;
  if (state.q) loadIndex();
  render();
})();
