/* 出题引擎：四种练习模式共用一套选题/干扰项逻辑
   —— 干扰项优先取同子类，其次同组，最后同库随机，保证难度来自真实辨析 */
var Quiz = (function () {
  var banks = {};      // id -> bank
  var order = [];      // 题库顺序

  (window.LJTK_BANKS || []).forEach(function (b) {
    banks[b.id] = b;
    order.push(b.id);
  });

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- 索引 ---------- */
  function bankIds() { return order.slice(); }
  function getBank(id) { return banks[id]; }
  function allIds(bankId) { return Object.keys(banks[bankId].words); }

  function groupIndex(bank) {
    if (bank._gidx) return bank._gidx;
    var idx = {};
    bank.groups.forEach(function (g) { idx[g.id] = g; });
    bank._gidx = idx;
    return idx;
  }

  function subIndex(bank) {
    if (bank._sidx) return bank._sidx;
    var idx = {};
    bank.groups.forEach(function (g) {
      g.subs.forEach(function (s) {
        var key = g.id + '|' + s.name;
        idx[key] = s.words;
      });
    });
    bank._sidx = idx;
    return idx;
  }

  function word(w) { return w; }

  function glossOf(w) {
    if (w.gloss) return w.gloss;
    if (w.memo) return w.memo;
    if (w.focus && w.focus.length) return w.focus[0];
    return '';
  }

  /* 同一子类的其他词 —— 最强干扰项 */
  function siblings(w) {
    var bank = banks[w.bank];
    var g = groupIndex(bank)[w.gid];
    if (!g) return [];
    for (var i = 0; i < g.subs.length; i++) {
      if (g.subs[i].name === w.sub) {
        return g.subs[i].words.filter(function (id) { return id !== w.id; });
      }
    }
    return [];
  }

  function groupMates(w) {
    var bank = banks[w.bank];
    var g = groupIndex(bank)[w.gid];
    if (!g) return [];
    var out = [];
    g.subs.forEach(function (s) {
      s.words.forEach(function (id) { if (id !== w.id) out.push(id); });
    });
    return out;
  }

  function distractors(w, n) {
    var bank = banks[w.bank];
    var chosen = [];
    var seenWord = {};
    seenWord[w.w] = 1;

    function take(list) {
      list = shuffle(list.slice());
      for (var i = 0; i < list.length && chosen.length < n; i++) {
        var d = bank.words[list[i]];
        if (!d || seenWord[d.w]) continue;
        seenWord[d.w] = 1;
        chosen.push(d);
      }
    }

    take(siblings(w));
    if (chosen.length < n) take(groupMates(w));
    if (chosen.length < n) {
      var pool = allIds(w.bank).filter(function (id) { return id !== w.id; });
      take(pool);
    }
    return chosen.slice(0, n);
  }

  /* ---------- 题干素材 ---------- */

  /* 从速记/侧重里抠出「常用于…」「形容…」这类搭配线索，用于场景反查 */
  var CLUE_RE = /[（(【]([^）)】]{3,44})[）)】]/g;
  var CLUE_KEY = /(常用于|用于|形容|搭配|多用于|强调|侧重)/;

  function sceneClue(w) {
    var texts = [];
    if (w.memo) texts.push(w.memo);
    if (w.gloss) texts.push(w.gloss);
    if (w.focus) texts = texts.concat(w.focus);
    for (var i = 0; i < texts.length; i++) {
      var t = texts[i] || '';
      var m, re = new RegExp(CLUE_RE.source, 'g');
      while ((m = re.exec(t))) {
        if (CLUE_KEY.test(m[1]) && m[1].length >= 4) {
          return m[1].replace(/^侧重[:：]?/, '').trim();
        }
      }
    }
    return '';
  }

  /* 例句挖空 */
  function blankExample(w) {
    var list = (w.eg || []).concat((w.real || []).slice(0, 2));
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s && s.indexOf(w.w) >= 0) {
        return s.replace(w.w, '____');
      }
    }
    return '';
  }

  /* ---------- 生成题目 ---------- */

  function makeChoice(w) {
    var g = glossOf(w);
    if (!g) return null;
    var ds = distractors(w, 3);
    if (ds.length < 3) return null;
    var opts = shuffle([w].concat(ds));
    return {
      wordId: w.id,
      kicker: '选出与释义相符的成语',
      prompt: g,
      options: opts.map(function (x) { return { id: x.id, text: x.w }; }),
      answerId: w.id,
      explain: explainOf(w)
    };
  }

  function makeScene(w) {
    var clue = sceneClue(w);
    if (!clue) return null;
    var ds = distractors(w, 3);
    if (ds.length < 3) return null;
    var opts = shuffle([w].concat(ds));
    return {
      wordId: w.id,
      kicker: '根据适用对象 / 搭配，选出正确的词',
      prompt: clue,
      options: opts.map(function (x) { return { id: x.id, text: x.w }; }),
      answerId: w.id,
      explain: explainOf(w)
    };
  }

  function makeContext(w) {
    var sent = blankExample(w);
    if (!sent) return null;
    var ds = distractors(w, 3);
    if (ds.length < 3) return null;
    var opts = shuffle([w].concat(ds));
    return {
      wordId: w.id,
      kicker: '给例句填空，选出最合适的词',
      prompt: sent,
      options: opts.map(function (x) { return { id: x.id, text: x.w }; }),
      answerId: w.id,
      explain: explainOf(w)
    };
  }

  function explainOf(w) {
    var parts = [];
    if (w.tone) parts.push('色彩：' + w.tone);
    if (w.gloss) parts.push(w.gloss);
    if (w.focus && w.focus.length) parts.push('侧重：' + w.focus.join(' '));
    if (w.memo && w.memo !== w.gloss) parts.push(w.memo);
    return parts.join('　');
  }

  /* ---------- 组题 ---------- */

  function buildQuestions(mode, pool, n) {
    var maker = mode === 'choice' ? makeChoice
      : mode === 'scene' ? makeScene
      : makeContext;
    var ids = shuffle(pool.slice());
    var out = [], used = {};
    for (var i = 0; i < ids.length && out.length < n; i++) {
      var w = byId(ids[i]);
      if (!w || used[w.id]) continue;
      var q = maker(w);
      if (!q) continue;
      used[w.id] = 1;
      out.push(q);
    }
    return out;
  }

  function byId(id) {
    var bankId = id.split('-')[0];
    var b = banks[bankId];
    return b ? b.words[id] : null;
  }

  /* 连连看：一个子类里取 4~6 对，左右各自打乱 */
  function makeMatch(pool, n) {
    n = n || 5;
    var b = banks[pool.bank];
    var cands = [];
    b.groups.forEach(function (g) {
      if (pool.gid && g.id !== pool.gid) return;
      g.subs.forEach(function (s) {
        if (s.words.length >= 4) {
          cands.push({ gid: g.id, sub: s.name, words: s.words });
        }
      });
    });
    if (!cands.length) return null;

    var picked = pick(cands);
    var ids = shuffle(picked.words.slice()).slice(0, Math.min(n, picked.words.length));
    var pairs = ids.map(function (id) {
      var w = b.words[id];
      return { id: id, w: w.w, gloss: glossOf(w) };
    });
    return {
      sub: picked.sub,
      pairs: pairs,
      left: shuffle(pairs.slice()),
      right: shuffle(pairs.slice())
    };
  }

  return {
    banks: banks,
    bankIds: bankIds,
    getBank: getBank,
    allIds: allIds,
    byId: byId,
    glossOf: glossOf,
    sceneClue: sceneClue,
    blankExample: blankExample,
    buildQuestions: buildQuestions,
    makeMatch: makeMatch,
    shuffle: shuffle,
    pick: pick
  };
})();
