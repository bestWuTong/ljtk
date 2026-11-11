/* 主逻辑：页签路由、学习浏览、练习浮层、错词本、我的 */
(function () {
  var BANKS = window.LJTK_BANKS || [];
  var bankMap = {};
  BANKS.forEach(function (b) { bankMap[b.id] = b; });

  var state = {
    tab: 'study',
    bank: Store.bank,
    view: 'list',     // list | group
    gid: null,
    query: '',
    blind: false,     // 自测模式：释义先模糊，点一下才看
    gmode: 'card'     // 组内视图：card 卡片 / table 对比
  };

  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function bank() { return bankMap[state.bank]; }

  function groupById(gid) {
    var g = bank().groups;
    for (var i = 0; i < g.length; i++) if (g[i].id === gid) return g[i];
    return null;
  }

  function groupWordIds(g) {
    var out = [];
    g.subs.forEach(function (s) { out = out.concat(s.words); });
    return out;
  }

  function toneClass(t) {
    if (!t) return '';
    if (/贬/.test(t) && !/中/.test(t)) return 'tone-bian';
    if (/褒/.test(t) && !/中/.test(t)) return 'tone-bao';
    return 'tone-mid';
  }

  /* ==================================================================
     学习页
     ================================================================== */
  function renderStudy() {
    var box = $('studyBody');
    var sb = $('searchBar');
    var inGroup = state.view === 'group' && !state.query;
    if (sb) sb.hidden = inGroup;   // 组内不需要搜索框，腾出空间

    if (state.query) { renderSearch(box); return; }
    if (state.view === 'group') { renderGroup(box); return; }

    var b = bank();
    var ids = Object.keys(b.words);
    var seen = Store.seenCount(ids);
    var html = '';
    var idx = 0;

    html += '<div class="sec-head">' +
      '<div><div class="sec-title">' + esc(b.name) + '</div>' +
      '<div class="sec-note">' + b.groups.length + ' 组 · ' + ids.length +
        ' 词 · 已学 ' + seen + '</div></div>' +
      blindChip() +
    '</div>';

    html += resumeBar(b);

    if (b.id === 'c400') {
      var last = '';
      b.groups.forEach(function (g) {
        if (g.chapter !== last) {
          last = g.chapter;
          html += '<div class="chapter-head">' + esc(g.chapter) + '</div>';
        }
        html += groupItemHtml(g, idx++);
      });
    } else {
      b.groups.forEach(function (g) { html += groupItemHtml(g, idx++); });
    }

    box.innerHTML = html;
    bindBlind();

    var resume = box.querySelector('[data-resume]');
    if (resume) {
      resume.addEventListener('click', function () {
        state.view = 'group';
        state.gid = Number(resume.dataset.resume);
        renderStudy();
        $('views').scrollTop = 0;
      });
    }

    box.querySelectorAll('.group-item').forEach(function (el) {
      el.addEventListener('click', function () {
        state.view = 'group';
        state.gid = Number(el.dataset.gid);
        renderStudy();
        $('views').scrollTop = 0;
      });
    });
  }

  /* 自测开关：开着的时候所有释义先模糊 */
  function blindChip() {
    return '<button class="chip-btn' + (state.blind ? ' is-on' : '') +
      '" data-blind title="开启后释义先遮住，点卡片才显示">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/>' +
        '<circle cx="12" cy="12" r="2.6"/></svg>' +
      (state.blind ? '自测中' : '自测') + '</button>';
  }

  function bindBlind(scope) {
    (scope || document).querySelectorAll('[data-blind]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.blind = !state.blind;
        renderStudy();
      });
    });
  }

  /* 继续学习：优先接着学「开了头但没学完」的组，其次是第一个没碰过的 */
  function resumeBar(b) {
    var inProgress = null, fresh = null, allDone = true;
    b.groups.forEach(function (g) {
      var ids = groupWordIds(g);
      var seen = Store.seenCount(ids);
      if (seen < ids.length) allDone = false;
      if (seen > 0 && seen < ids.length && !inProgress) {
        inProgress = { g: g, seen: seen, total: ids.length };
      }
      if (seen === 0 && !fresh) {
        fresh = { g: g, seen: 0, total: ids.length };
      }
    });

    if (allDone) {
      return '<div class="resume-bar is-done">这本题库已经整体过了一轮，去练习巩固 →</div>';
    }

    var next = inProgress || fresh;
    if (!next) return '';

    return '<button class="resume-bar" data-resume="' + next.g.id + '">' +
      '<span class="rb-label">' + (inProgress ? '继续' : '从头开始') + '</span>' +
      '<span class="rb-main">' + esc(next.g.title) + '</span>' +
      '<span class="rb-meta">已学 ' + next.seen + '/' + next.total + '</span>' +
      '<span class="group-chev">›</span>' +
    '</button>';
  }

  function groupItemHtml(g, i) {
    var ids = groupWordIds(g);
    var seen = Store.seenCount(ids);
    var pct = ids.length ? Math.round(seen * 100 / ids.length) : 0;
    var full = pct >= 100;
    var subN = g.subs.filter(function (s) { return s.name; }).length;
    var delay = (i < 10 ? i * 0.025 : 0.25).toFixed(3);
    return '<button class="group-item" data-gid="' + g.id + '" style="--d:' + delay + 's">' +
      '<span class="group-ring' + (full ? ' is-full' : '') + '" style="--p:' + pct + '">' +
        '<span class="group-no">' + (g.no || g.id) + '</span>' +
      '</span>' +
      '<span class="group-main">' +
        '<span class="group-name">' + esc(g.title) + '</span>' +
        '<span class="group-meta">' + (subN ? subN + ' 类 · ' : '') +
          ids.length + ' 词' + (seen > 0 ? ' · 已学 ' + seen : '') + '</span>' +
      '</span>' +
      '<span class="group-chev">›</span>' +
    '</button>';
  }

  function renderGroup(box) {
    var g = groupById(state.gid);
    if (!g) { state.view = 'list'; renderStudy(); return; }
    var b = bank();
    var ids = groupWordIds(g);
    var seen = Store.seenCount(ids);
    var pct = ids.length ? Math.round(seen * 100 / ids.length) : 0;

    var html = '<div class="backbar">' +
      '<button class="back-btn" id="backBtn">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>返回' +
      '</button>' +
      '<div class="group-tools">' +
        blindChip() +
        '<div class="chip-group" id="gmodeSwitch">' +
          '<button class="chip-btn' + (state.gmode === 'card' ? ' is-on' : '') +
            '" data-gmode="card">卡片</button>' +
          '<button class="chip-btn' + (state.gmode === 'table' ? ' is-on' : '') +
            '" data-gmode="table">对比</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="group-progress">' +
      '<span class="gp-text" id="gpText">已学 ' + seen + '/' + ids.length + '</span>' +
      '<div class="progress"><i id="gpBar" style="width:' + pct + '%"></i></div>' +
      '<button class="gp-all" id="gpAll">' +
        (seen >= ids.length ? '全部取消' : '全标已学') + '</button>' +
    '</div>';

    html += state.gmode === 'table'
      ? comparisonHtml(g, b)
      : cardsHtml(g, b);

    html += ctaHtml(g, ids);

    box.innerHTML = html;

    $('backBtn').addEventListener('click', function () {
      state.view = 'list'; state.gid = null;
      renderStudy();
      $('views').scrollTop = 0;
    });

    $('gmodeSwitch').querySelectorAll('.chip-btn').forEach(function (el) {
      el.addEventListener('click', function () {
        state.gmode = el.dataset.gmode;
        renderStudy();
      });
    });

    bindBlind();

    $('gpAll').addEventListener('click', function () {
      var now = Store.seenCount(ids);
      if (now >= ids.length) Store.unmarkMany(ids);
      else Store.markMany(ids);
      renderStudy();
    });

    box.querySelectorAll('[data-gquiz]').forEach(function (el) {
      el.addEventListener('click', function () {
        openQuiz(el.dataset.gquiz, { gid: g.id, ids: ids });
      });
    });
  }

  /* 卡片视图 */
  function cardsHtml(g, b) {
    var html = '';
    var wi = 0;
    g.subs.forEach(function (s) {
      if (s.name) html += '<div class="sub-head">' + esc(s.name) + '</div>';
      s.words.forEach(function (id) {
        var w = b.words[id];
        if (!w) return;
        html += wordCardHtml(w, wi++);
      });
      var firstW = s.words.length ? b.words[s.words[0]] : null;
      if (firstW && firstW.real && firstW.real.length) {
        var list = firstW.real.slice(0, 2);
        html += '<div class="word-card">' +
          '<div class="wlabel">真题语境</div>' +
          '<div class="real-body' + (list.length > 1 ? ' is-collapsed' : '') + '">' +
            list.map(function (t) {
              return '<p class="wtext" style="margin-top:8px">' + esc(t) + '</p>';
            }).join('') +
          '</div>' +
          (list.length > 1
            ? '<button class="link-btn" data-expand>展开第 2 段真题</button>'
            : '') +
        '</div>';
      }
    });
    return html;
  }

  /* 对比视图：同一子类的词并排，只留最能区分的信息 */
  function comparisonHtml(g, b) {
    var html = '';
    var wi = 0;
    g.subs.forEach(function (s) {
      if (s.name) html += '<div class="sub-head">' + esc(s.name) + '</div>';
      html += '<div class="cmp-list">';
      s.words.forEach(function (id) {
        var w = b.words[id];
        if (!w) return;
        var delay = (Math.min(wi, 10) * 0.02).toFixed(3);
        var focus = (w.focus && w.focus.length) ? w.focus.join(' ') : '';
        var memo = (w.memo && w.memo !== w.gloss) ? w.memo : '';
        html += '<div class="cmp-row" style="--d:' + delay + 's">' +
          '<div class="cmp-word">' + esc(w.w) +
            (w.tone ? '<span class="tone ' + toneClass(w.tone) + '">' + esc(w.tone) + '</span>' : '') +
          '</div>' +
          '<div class="cmp-text">' +
            (w.gloss ? '<p>' + esc(w.gloss) + '</p>' : '') +
            (focus ? '<p><b>侧重</b> ' + esc(focus) + '</p>' : '') +
            (memo ? '<p>' + esc(memo) + '</p>' : '') +
          '</div>' +
        '</div>';
        wi++;
      });
      html += '</div>';
    });
    return html;
  }

  /* 组底部：学完直接练这一组 */
  function ctaHtml(g, ids) {
    var b = bank();
    var hasEg = ids.some(function (id) {
      var w = b.words[id];
      return w && w.eg && w.eg.length;
    });
    var hasScene = ids.some(function (id) {
      var w = b.words[id];
      return w && Quiz.sceneClue(w);
    });
    var canMatch = ids.length >= 3;

    return '<div class="cta-card">' +
      '<div class="cta-title">学完就练</div>' +
      '<div class="cta-sub">从这一组的 ' + ids.length +
        ' 个词里抽题，干扰项还是同组的近义词。答错自动进错词本。</div>' +
      '<div class="cta-modes">' +
        '<button class="cta-btn is-main" data-gquiz="choice">练这一组</button>' +
        '<button class="cta-btn" data-gquiz="match"' +
          (canMatch ? '' : ' disabled title="这组词太少，凑不齐配对"') + '>连连看</button>' +
        '<button class="cta-btn" data-gquiz="scene"' +
          (hasScene ? '' : ' disabled title="这组的释义里没有「常用于…」这类线索"') +
          '>场景反查</button>' +
        '<button class="cta-btn" data-gquiz="context"' +
          (hasEg ? '' : ' disabled title="这组没有例句，用不了填空"') +
          '>语境填空</button>' +
      '</div>' +
    '</div>';
  }

  function updateGroupProgress() {
    var g = groupById(state.gid);
    if (!g) return;
    var ids = groupWordIds(g);
    var seen = Store.seenCount(ids);
    var pct = ids.length ? Math.round(seen * 100 / ids.length) : 0;
    var t = $('gpText');
    if (t) t.textContent = '已学 ' + seen + '/' + ids.length;
    var bar = $('gpBar');
    if (bar) bar.style.width = pct + '%';
    var all = $('gpAll');
    if (all) all.textContent = seen >= ids.length ? '全部取消' : '全标已学';
  }

  function wordCardHtml(w, i) {
    var slim = !(w.focus && w.focus.length) && !(w.eg && w.eg.length);
    var n = i || 0;
    var delay = (n < 8 ? n * 0.03 : 0.24).toFixed(3);
    var seen = Store.isSeen(w.id);
    // 搜索结果是"查资料"，不该被自测模糊挡住
    var blind = state.blind && !state.query;

    var html = '<article class="word-card' + (slim ? ' is-slim' : '') +
      (seen ? ' is-seen' : '') + (blind ? ' is-blind' : '') +
      '" data-wid="' + w.id + '" style="--d:' + delay + 's">';

    html += '<div class="word-head"><h3 class="word-h">' + esc(w.w) + '</h3>';
    if (w.tone) html += '<span class="tone ' + toneClass(w.tone) + '">' + esc(w.tone) + '</span>';
    html += '<button class="mark-btn' + (seen ? ' is-on' : '') + '" data-mark="' + w.id +
      '" aria-pressed="' + (seen ? 'true' : 'false') + '" title="标记已学">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
    '</button>';
    html += '</div>';

    if (w.gloss) html += '<p class="word-gloss">' + esc(w.gloss) + '</p>';

    if (w.focus && w.focus.length) {
      html += '<div class="wblock"><span class="wlabel">侧重</span><p class="wtext">' +
        esc(w.focus.join('　')) + '</p></div>';
    }
    if (w.eg && w.eg.length) {
      html += '<div class="wblock"><span class="wlabel">例句</span>' +
        w.eg.map(function (t) { return '<p class="wtext">' + esc(t) + '</p>'; }).join('') +
        '</div>';
    }
    html += '</article>';
    return html;
  }

  /* 学习区点击委托：勾选已学 / 自测时点开释义 / 展开真题 */
  function onStudyClick(e) {
    var mark = e.target.closest('.mark-btn');
    if (mark) {
      e.preventDefault();
      var id = mark.dataset.mark;
      var on = Store.toggleSeen(id);
      mark.classList.toggle('is-on', on);
      mark.setAttribute('aria-pressed', on ? 'true' : 'false');
      var card = mark.closest('.word-card');
      if (card) card.classList.toggle('is-seen', on);
      updateGroupProgress();
      return;
    }

    var exp = e.target.closest('[data-expand]');
    if (exp) {
      var wrap = exp.closest('.word-card');
      var body = wrap && wrap.querySelector('.real-body');
      if (body) body.classList.remove('is-collapsed');
      exp.remove();
      return;
    }

    var blind = e.target.closest('.word-card.is-blind');
    if (blind && !blind.classList.contains('is-revealed')) {
      blind.classList.add('is-revealed');
    }
  }

  /* ---------------- 搜索 ---------------- */
  function renderSearch(box) {
    var q = state.query.trim();
    var b = bank();
    var hit = [];
    Object.keys(b.words).forEach(function (id) {
      var w = b.words[id];
      var hay = (w.w + ' ' + (w.gloss || '') + ' ' + (w.memo || '') + ' ' +
        (w.focus || []).join(' ') + ' ' + (w.eg || []).join(' ')).toLowerCase();
      if (hay.indexOf(q.toLowerCase()) >= 0) hit.push(w);
    });

    var html = '<div class="sec-head"><span class="sec-title">搜索结果</span>' +
      '<span class="sec-note">' + hit.length + ' 条 · ' + esc(b.short) + '</span></div>';

    if (!hit.length) {
      html += '<div class="empty-state"><div class="empty-title">没有找到</div>' +
        '<div class="empty-desc">换个词试试，或者切换题库再搜。</div></div>';
    } else {
      hit.slice(0, 60).forEach(function (w, i) { html += wordCardHtml(w, i); });
      if (hit.length > 60) {
        html += '<p class="sec-note" style="text-align:center;padding:10px">只显示前 60 条</p>';
      }
    }
    box.innerHTML = html;
  }

  /* ==================================================================
     练习页
     ================================================================== */
  var MODES = [
    { id: 'match', name: '连连看', desc: '词与释义两列配对，同组近义词混在一起',
      cls: '', icon: 'M4 7h6M4 12h6M4 17h6M15 7h5M15 12h5M15 17h5' },
    { id: 'choice', name: '释义选词', desc: '给释义，从同组近义词里选出正确的一个',
      cls: 'm-green', icon: 'M4 6h16M4 12h10M4 18h7' },
    { id: 'scene', name: '场景反查', desc: '给「常用于… / 形容…」的线索反推词',
      cls: 'm-orange', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2' },
    { id: 'context', name: '语境填空', desc: '例句挖空，四个近义词里选最贴切的',
      cls: 'm-purple', icon: 'M4 7h16M4 12h9M4 17h6M17 15l3 3-3 3' }
  ];

  function renderPractice() {
    var box = $('practiceBody');
    var b = bank();
    var allIds = Object.keys(b.words);
    var d = Store.daily(b.id, allIds);
    var pct = Math.round(d.done.length * 100 / (d.ids.length || 1));
    var s = Store.stats();

    var html = '';
    html += '<div class="today-card">' +
      '<div class="today-top"><span class="today-title">今日 20 词</span>' +
      '<span class="today-count">' + d.done.length + ' / ' + d.ids.length + '</span></div>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<button class="btn btn-primary btn-block" id="todayStart">' +
        (d.done.length >= d.ids.length ? '今天已完成，再练一轮' : '开始今日任务') +
      '</button>' +
    '</div>';

    html += '<div class="sec-head"><span class="sec-title">专项练习</span>' +
      '<span class="sec-note">' + esc(b.short) + ' · 每轮 10 题</span></div>';
    html += '<div class="mode-grid">';
    MODES.forEach(function (m) {
      var off = (m.id === 'context' && b.id !== 'c400');
      html += '<button class="mode-card ' + m.cls + (off ? ' is-off' : '') +
        '" data-mode="' + m.id + '">' +
        (m.id === 'context' ? '<span class="mode-badge">仅 400 词</span>' : '') +
        '<span class="mode-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + m.icon + '"/></svg></span>' +
        '<span class="mode-name">' + m.name + '</span>' +
        '<span class="mode-desc">' + m.desc + '</span>' +
      '</button>';
    });
    html += '</div>';

    html += '<div class="sec-head"><span class="sec-title">累计</span></div>';
    html += '<div class="result-stats" style="margin-top:0">' +
      statBox(s.todayDone, '今日答题') +
      statBox(s.answered, '累计答题') +
      statBox(s.rate + '%', '正确率') +
    '</div>';

    box.innerHTML = html;

    $('todayStart').addEventListener('click', function () {
      openQuiz('daily');
    });
    box.querySelectorAll('.mode-card').forEach(function (el) {
      el.addEventListener('click', function () {
        if (el.classList.contains('is-off')) {
          toast('语境填空需要切到「超格 400 词」题库');
          return;
        }
        openQuiz(el.dataset.mode);
      });
    });
  }

  function statBox(num, label) {
    return '<div class="stat-box"><div class="stat-num">' + num + '</div>' +
      '<div class="stat-label">' + label + '</div></div>';
  }

  /* ==================================================================
     错词本
     ================================================================== */
  function renderWrong() {
    var box = $('wrongBody');
    var list = Store.wrongList();

    if (!list.length) {
      box.innerHTML = '<div class="empty-state">' +
        '<div class="empty-title">错词本还是空的</div>' +
        '<div class="empty-desc">练习里答错的词会自动收进来，答对两次后自动移出。</div>' +
        '<button class="btn btn-soft" id="goPractice">去做一组练习</button>' +
      '</div>';
      $('goPractice').addEventListener('click', function () { switchTab('practice'); });
      return;
    }

    var html = '<div class="sec-head"><span class="sec-title">错词 ' + list.length + ' 个</span>' +
      '<span class="sec-note">答对 2 次自动移出</span></div>';
    html += '<div style="display:flex;gap:8px;margin-bottom:14px">' +
      '<button class="btn btn-primary" id="wrongPractice" style="flex:1">开始复习</button>' +
      '<button class="btn" id="wrongClear">清空</button>' +
    '</div>';

    list.forEach(function (item) {
      var w = Quiz.byId(item.id);
      if (!w) return;
      html += '<div class="row-card">' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(w.w) + '</div>' +
          '<div class="row-sub">' + esc((Quiz.glossOf(w) || '').slice(0, 42)) + '</div>' +
        '</div>' +
        '<span class="badge">×' + item.n + '</span>' +
        '<button class="quiz-close" data-del="' + item.id + '" title="移出">×</button>' +
      '</div>';
    });

    box.innerHTML = html;

    $('wrongPractice').addEventListener('click', function () {
      var ids = Store.wrongList().map(function (x) { return x.id; });
      if (!ids.length) return;
      openQuiz('wrong', { ids: ids });
    });
    $('wrongClear').addEventListener('click', function () {
      if (confirm('确定清空错词本？')) { Store.clearWrong(); renderWrong(); renderTabsBadge(); }
    });
    box.querySelectorAll('[data-del]').forEach(function (el) {
      el.addEventListener('click', function () {
        var card = el.closest('.row-card');
        var id = el.dataset.del;
        card.classList.add('is-removing');
        setTimeout(function () {
          Store.removeWrong(id);
          card.remove();
          renderTabsBadge();
          var left = box.querySelectorAll('.row-card').length;
          if (!left) renderWrong();
        }, 190);
      });
    });
  }

  /* ==================================================================
     我的
     ================================================================== */
  function renderMe() {
    var box = $('meBody');
    var b = bank();
    var total = Object.keys(b.words).length;
    var seen = Store.seenCount(Object.keys(b.words));
    var s = Store.stats();
    var wrong = Store.wrongCount();

    var html = '';
    html += '<div class="me-grid">' +
      meStat(seen + ' / ' + total, esc(b.short) + ' 已学') +
      meStat(s.answered, '累计答题') +
      meStat(s.rate + '%', '正确率') +
      meStat(s.streak + ' 天', '连续学习') +
    '</div>';

    html += '<div class="sec-head"><span class="sec-title">学习进度</span></div>';
    html += '<div class="progress" style="margin:0 0 16px"><i style="width:' +
      Math.round(seen * 100 / (total || 1)) + '%"></i></div>';

    html += '<div class="sec-head"><span class="sec-title">设置</span></div>';
    html += '<button class="setting-row" id="themeRow"><span>主题</span>' +
      '<span class="setting-val" id="themeVal">亮色</span></button>';
    html += '<button class="setting-row" id="resetRow"><span>清除全部学习数据</span>' +
      '<span class="setting-val">' + wrong + ' 个错词</span></button>';

    html += '<p class="sec-note" style="margin-top:18px;line-height:1.8">' +
      '题库来源：《花生言语1000词特征速记版》《超格言语400词》。' +
      '学习记录只存在这台设备的浏览器里。</p>';

    box.innerHTML = html;
    updateThemeVal();

    $('themeRow').addEventListener('click', function () {
      cycleTheme();
      updateThemeVal();
    });
    $('resetRow').addEventListener('click', function () {
      if (confirm('会清空学习进度和错词本，确定？')) {
        Store.reset();
        renderAll();
        toast('已清除');
      }
    });
  }

  function meStat(num, label) {
    return '<div class="me-stat"><div class="me-num">' + num + '</div>' +
      '<div class="me-label">' + label + '</div></div>';
  }

  /* ==================================================================
     练习浮层
     ================================================================== */
  var session = null;

  function openQuiz(mode, opts) {
    opts = opts || {};
    var sheet = $('sheet');
    sheet.classList.remove('is-out');
    sheet.hidden = false;

    var b = bank();
    var allIds = Object.keys(b.words);

    if (mode === 'match') {
      var m = Quiz.makeMatch({ bank: state.bank, gid: opts.gid }, 5);
      if (!m) { toast('这组词太少，凑不齐配对'); closeSheet(); return; }
      session = {
        mode: 'match', data: m, picked: null, done: 0, wrong: 0,
        t0: Date.now(), scope: opts.gid ? 'group' : 'bank'
      };
      renderMatch();
      return;
    }

    var pool, scope;
    if (mode === 'daily') {
      pool = Store.daily(state.bank, allIds).ids.slice();
      scope = 'daily';
    } else if (mode === 'wrong') {
      pool = (opts.ids || []).slice();
      scope = 'wrong';
    } else if (opts.ids && opts.ids.length) {
      pool = opts.ids.slice();
      scope = 'group';
    } else {
      pool = allIds;
      scope = 'bank';
    }

    var qmode = (mode === 'daily' || mode === 'wrong') ? 'choice' : mode;
    var want = mode === 'daily' ? 20 : 10;
    if (scope === 'group') want = Math.min(want, pool.length);

    var qs = Quiz.buildQuestions(qmode, pool, want);

    if (!qs.length) {
      toast(scope === 'group' ? '这组词凑不出这一类的题' : '这个题库里没凑出合适的题目');
      closeSheet();
      return;
    }

    session = {
      mode: qmode, items: qs, index: 0, right: 0, wrong: 0,
      t0: Date.now(), answered: false,
      isDaily: mode === 'daily', scope: scope
    };
    renderQuestion();
  }

  function closeSheet() {
    var sheet = $('sheet');
    if (sheet.hidden || sheet.classList.contains('is-out')) return;
    if (window.Confetti) Confetti.stop();
    sheet.classList.add('is-out');
    setTimeout(function () {
      sheet.hidden = true;
      sheet.classList.remove('is-out');
      session = null;
      renderAll();
    }, 170);
  }

  function quizHeader(stepText, pct) {
    return '<div class="quiz-top">' +
      '<button class="quiz-close" id="quizClose" title="退出">×</button>' +
      '<div class="quiz-meter"><i style="width:' + pct + '%"></i></div>' +
      '<span class="quiz-step">' + stepText + '</span>' +
    '</div>';
  }

  function renderQuestion() {
    var s = session;
    var q = s.items[s.index];
    var total = s.items.length;
    var pct = Math.round(s.index * 100 / total);

    var html = quizHeader((s.index + 1) + ' / ' + total, pct);
    html += '<div class="quiz-body">';
    html += '<p class="q-kicker">' + esc(q.kicker) + '</p>';
    html += '<div class="q-prompt">' +
      esc(q.prompt).replace(/_{4,}/g, '<span class="q-blank"></span>') + '</div>';
    html += '<div class="opt-list" id="optList">';
    q.options.forEach(function (o, i) {
      html += '<button class="opt" data-id="' + o.id + '" style="--d:' +
        (i * 0.035).toFixed(3) + 's">' +
        '<span class="opt-key">' + 'ABCD'[i] + '</span>' +
        '<span>' + esc(o.text) + '</span>' +
      '</button>';
    });
    html += '</div><div id="fbSlot"></div></div>';
    html += '<div class="quiz-foot" id="quizFoot"></div>';

    $('sheetPanel').innerHTML = html;
    $('quizClose').addEventListener('click', function () {
      if (confirm('退出本轮练习？')) closeSheet();
    });

    $('optList').querySelectorAll('.opt').forEach(function (el) {
      el.addEventListener('click', function () { answer(el.dataset.id); });
    });
  }

  function answer(pickedId) {
    var s = session;
    if (s.answered) return;
    s.answered = true;

    var q = s.items[s.index];
    var ok = pickedId === q.answerId;
    if (ok) s.right += 1; else s.wrong += 1;

    Store.recordAnswer(q.wordId, ok);
    if (s.isDaily) Store.dailyMark(q.wordId);

    var opts = $('optList').querySelectorAll('.opt');
    opts.forEach(function (el) {
      el.disabled = true;
      if (el.dataset.id === q.answerId) el.classList.add('is-right');
      else if (el.dataset.id === pickedId) el.classList.add('is-wrong');
    });

    var w = Quiz.byId(q.wordId);
    var fb = '<div class="feedback">' +
      '<div><b>' + (ok ? '答对了' : '正确答案：' + esc(w ? w.w : '')) + '</b></div>' +
      '<div style="margin-top:6px">' + esc(q.explain || '') + '</div>' +
    '</div>';
    if (w && w.eg && w.eg.length) {
      fb += '<div class="wreal" style="margin-top:10px">' + esc(w.eg[0]) + '</div>';
    }
    $('fbSlot').innerHTML = fb;

    var last = s.index >= s.items.length - 1;
    $('quizFoot').innerHTML = '<button class="btn btn-primary btn-block" id="nextBtn">' +
      (last ? '查看结果' : '下一题') + '</button>';
    $('nextBtn').addEventListener('click', function () {
      if (last) { renderResult(); return; }
      s.index += 1;
      s.answered = false;
      renderQuestion();
      $('sheetPanel').querySelector('.quiz-body').scrollTop = 0;
    });
  }

  /* ---------------- 连连看 ---------------- */
  function renderMatch() {
    var s = session;
    var m = s.data;
    var total = m.pairs.length;
    var pct = Math.round(s.done * 100 / total);

    var html = quizHeader(s.done + ' / ' + total, pct);
    html += '<div class="quiz-body">';
    html += '<p class="q-kicker">连一连：左边选词，右边选释义' +
      (m.group ? ' · ' + esc(m.group) : '') +
      (m.sub ? ' / ' + esc(m.sub) : '') + '</p>';
    html += '<div class="match-board">';
    html += '<div class="match-col" id="colL">';
    m.left.forEach(function (p, i) {
      html += '<button class="match-cell" data-side="l" data-id="' + p.id +
        '" style="--d:' + (i * 0.03).toFixed(3) + 's">' + esc(p.w) + '</button>';
    });
    html += '</div><div class="match-col" id="colR">';
    m.right.forEach(function (p, i) {
      html += '<button class="match-cell side-r" data-side="r" data-id="' + p.id +
        '" style="--d:' + (0.05 + i * 0.03).toFixed(3) + 's">' + esc(p.gloss) + '</button>';
    });
    html += '</div></div>';
    html += '<p class="match-tip" id="matchTip">已配对 ' + s.done + ' / ' + total + '</p>';
    html += '</div><div class="quiz-foot" id="quizFoot"></div>';

    $('sheetPanel').innerHTML = html;
    $('quizClose').addEventListener('click', function () {
      if (confirm('退出本轮练习？')) closeSheet();
    });

    $('sheetPanel').querySelectorAll('.match-cell').forEach(function (el) {
      el.addEventListener('click', function () { onMatchClick(el); });
    });
  }

  function onMatchClick(el) {
    var s = session;
    if (el.classList.contains('is-done')) return;

    if (el.dataset.side === 'l') {
      if (s.picked) s.picked.classList.remove('is-pick');
      s.picked = el;
      el.classList.add('is-pick');
      return;
    }

    // 点右侧：必须已选左边
    if (!s.picked) {
      flashTip('先选左边的词');
      return;
    }

    var leftEl = s.picked;
    if (leftEl.dataset.id === el.dataset.id) {
      leftEl.classList.remove('is-pick');
      leftEl.classList.add('is-hit', 'is-done');
      el.classList.add('is-hit', 'is-done');
      s.picked = null;
      s.done += 1;
      Store.recordAnswer(leftEl.dataset.id, true);
      $('matchTip').textContent = '已配对 ' + s.done + ' / ' + s.data.pairs.length;
      var meter = $('sheetPanel').querySelector('.quiz-meter > i');
      if (meter) meter.style.width = Math.round(s.done * 100 / s.data.pairs.length) + '%';
      if (s.done >= s.data.pairs.length) setTimeout(renderResult, 480);
    } else {
      el.classList.add('is-bad');
      leftEl.classList.remove('is-pick');
      s.wrong += 1;
      Store.recordAnswer(leftEl.dataset.id, false);
      var bad = leftEl;
      setTimeout(function () {
        el.classList.remove('is-bad');
        bad.classList.remove('is-pick');
      }, 460);
      s.picked = null;
      flashTip('不匹配，再试一次');
    }
  }

  function flashTip(msg) {
    var tip = $('matchTip');
    if (!tip) return;
    var old = tip.textContent;
    tip.textContent = msg;
    tip.style.color = 'var(--red)';
    setTimeout(function () {
      tip.textContent = old;
      tip.style.color = '';
    }, 1100);
  }

  /* ---------------- 结算 ---------------- */
  function renderResult() {
    var s = session;
    var total = s.mode === 'match' ? s.data.pairs.length : s.items.length;
    // 连连看里点错不扣分，按「失误次数」算，避免出现负分
    var right = s.mode === 'match' ? Math.max(0, total - s.wrong) : s.right;
    var rate = Math.max(0, Math.min(100, Math.round(right * 100 / (total || 1))));
    var secs = Math.max(1, Math.round((Date.now() - s.t0) / 1000));
    var time = secs >= 60 ? Math.floor(secs / 60) + ' 分 ' + (secs % 60) + ' 秒' : secs + ' 秒';

    var title = rate >= 90 ? '几乎全对' : rate >= 70 ? '还不错' : rate >= 50 ? '还有提升空间' : '这组要再练练';

    var html = '<div class="quiz-top"><button class="quiz-close" id="quizClose">×</button>' +
      '<span class="quiz-step"></span></div>';
    html += '<div class="quiz-body"><div class="result-wrap">';
    html += '<div class="result-ring" id="resultRing">0%</div>';
    html += '<div class="result-title">' + title + '</div>';
    html += '<div class="result-sub">' + total + ' 题 · 用时 ' + time + '</div>';
    html += '<div class="result-stats">' +
      statBox(right, s.mode === 'match' ? '配对成功' : '答对') +
      statBox(s.wrong, s.mode === 'match' ? '失误' : '答错') +
      statBox(Store.wrongCount(), '错词本') +
    '</div>';
    html += '<button class="btn btn-primary btn-block" id="againBtn">再来一轮</button>';
    html += '<button class="btn btn-block" id="doneBtn" style="margin-top:10px">完成</button>';
    html += '</div></div>';

    $('sheetPanel').innerHTML = html;

    // 结果数字从 0 滚上去，和圆环的弹出同步
    var ring = $('resultRing');
    if (ring) {
      var t0 = performance.now(), dur = 460;
      var tick = function (t) {
        var k = Math.min(1, (t - t0) / dur);
        ring.textContent = Math.round(rate * (1 - Math.pow(1 - k, 3))) + '%';
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // 八十分以上放彩带
    if (rate >= 80 && window.Confetti) {
      setTimeout(function () {
        if (!session) return;
        Confetti.fire($('confetti'), null, {});
      }, 180);
    }
    $('quizClose').addEventListener('click', closeSheet);
    $('doneBtn').addEventListener('click', closeSheet);
    $('againBtn').addEventListener('click', function () {
      var mode = s.isDaily ? 'daily' : s.mode;
      // 每日任务重新抽一批，否则会一直练同样的 20 题
      if (s.isDaily) Store.dailyReset(state.bank, Object.keys(bank().words));
      closeSheet();
      setTimeout(function () { openQuiz(mode); }, 200);
    });
  }

  /* ==================================================================
     题库 / 主题 / 页签
     ================================================================== */
  function renderBankMenu() {
    var html = '';
    BANKS.forEach(function (b) {
      var on = b.id === state.bank;
      html += '<button class="bank-item' + (on ? ' is-on' : '') + '" data-bank="' + b.id + '">' +
        '<span class="bank-item-name">' + esc(b.name) +
          (on ? '<svg class="bank-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') +
        '</span>' +
        '<span class="bank-item-meta">' + b.groups.length + ' 组 · ' +
          Object.keys(b.words).length + ' 词</span>' +
      '</button>';
    });
    $('bankMenu').innerHTML = html;
    $('bankMenu').querySelectorAll('.bank-item').forEach(function (el) {
      el.addEventListener('click', function () {
        state.bank = el.dataset.bank;
        Store.setBank(state.bank);
        state.view = 'list';
        state.gid = null;
        state.query = '';
        $('searchInput').value = '';
        $('searchClear').hidden = true;
        $('bankMenu').hidden = true;
        $('bankBtn').setAttribute('aria-expanded', 'false');
        var lbl = $('bankBtnLabel');
        lbl.textContent = bankMap[state.bank].short;
        lbl.classList.remove('is-bump');
        void lbl.offsetWidth;          // 强制重排，让动画能重播
        lbl.classList.add('is-bump');
        renderAll();
      });
    });
  }

  var THEMES = ['light', 'eye', 'dark'];
  var THEME_NAME = { light: '亮色', eye: '护眼', dark: '暗色' };

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var BG = { light: '#f5f5f7', eye: '#dfe9da', dark: '#242428' };
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', BG[t] || BG.light);
    try { localStorage.setItem('ljtk.theme.v1', t); } catch (e) {}
  }

  /* 主题循环：亮 → 护眼 → 暗。手感和 zzll 一致——以点击位置为圆心扩散铺开 */
  function cycleTheme(evt) {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof document.startViewTransition !== 'function') {
      applyTheme(next);
      return;
    }

    var x, y;
    if (evt && typeof evt.clientX === 'number' && (evt.clientX || evt.clientY)) {
      x = evt.clientX;
      y = evt.clientY;
    } else {
      var r = $('themeBtn').getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    var radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    var vt = document.startViewTransition(function () { applyTheme(next); });
    vt.ready.then(function () {
      document.documentElement.animate(
        {
          clipPath: [
            'circle(0px at ' + x + 'px ' + y + 'px)',
            'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
          ]
        },
        {
          duration: 560,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
      if (!$('themeVal')) setTimeout(updateThemeVal, 0);
    }).catch(function () {});
  }

  function updateThemeVal() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var el = $('themeVal');
    if (el) el.textContent = THEME_NAME[cur] || '亮色';
  }

  function renderTabsBadge() {
    var n = Store.wrongCount();
    var dot = $('wrongDot');
    if (dot) dot.hidden = n === 0;
  }

  function renderAll() {
    $('bankBtnLabel').textContent = bankMap[state.bank].short;
    // 菜单的选中勾必须跟着 state.bank 走，否则切库后勾还停在旧题库上
    renderBankMenu();
    if (state.tab === 'study') renderStudy();
    if (state.tab === 'practice') renderPractice();
    if (state.tab === 'wrong') renderWrong();
    if (state.tab === 'me') renderMe();
    renderTabsBadge();
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('is-out'); }, 1550);
    setTimeout(function () { t.remove(); }, 1800);
  }

  /* ==================================================================
     启动
     ================================================================== */
  function init() {
    Store.init();

    var savedTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeVal();
    if (savedTheme) applyTheme(savedTheme);

    $('bankBtn').addEventListener('click', function () {
      var menu = $('bankMenu');
      menu.hidden = !menu.hidden;
      $('bankBtn').setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.bank-switch')) {
        $('bankMenu').hidden = true;
        $('bankBtn').setAttribute('aria-expanded', 'false');
      }
    });

    $('themeBtn').addEventListener('click', function (e) {
      cycleTheme(e);
      setTimeout(updateThemeVal, 0);
    });

    var searchTimer = null;
    $('searchInput').addEventListener('input', function (e) {
      var v = e.target.value;
      $('searchClear').hidden = !v;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.query = v.trim();
        if (state.tab !== 'study') switchTab('study');
        renderStudy();
      }, 180);
    });
    $('searchClear').addEventListener('click', function () {
      $('searchInput').value = '';
      $('searchClear').hidden = true;
      state.query = '';
      renderStudy();
    });

    document.querySelectorAll('.tab').forEach(function (el) {
      el.addEventListener('click', function () { switchTab(el.dataset.tab); });
    });

    $('studyBody').addEventListener('click', onStudyClick);

    document.addEventListener('keydown', onKey);

    renderAll();

    // 启动遮罩：首帧先挡住，等首页渲染完再淡出（最短 240ms，避免一闪而过）
    var boot = $('boot');
    if (boot) {
      var wait = Math.max(0, 240 - performance.now());
      setTimeout(function () {
        boot.classList.add('is-done');
        setTimeout(function () { boot.hidden = true; }, 320);
      }, wait);
    }
  }

  /* 键盘：1-4 选选项，Enter/空格 下一题，Esc 退出（桌面端用） */
  function onKey(e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ($('sheet').hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeSheet();
      return;
    }
    if (/^[1-4]$/.test(e.key)) {
      var opts = document.querySelectorAll('.opt:not([disabled])');
      var idx = Number(e.key) - 1;
      if (opts[idx]) {
        opts[idx].click();
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      var next = $('nextBtn');
      if (next) {
        next.click();
        e.preventDefault();
      }
    }
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(function (el) {
      el.classList.toggle('is-active', el.dataset.tab === tab);
    });
    document.querySelectorAll('.view').forEach(function (el) {
      el.classList.toggle('is-active', el.id === 'view-' + tab);
    });
    $('views').scrollTop = 0;
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
