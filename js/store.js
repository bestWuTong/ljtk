/* 本地存储：题库选择、学习记录、错词本、每日任务、统计
   全部落在 localStorage 一个键下，隐私模式下读写失败也不影响使用。 */
var Store = (function () {
  var KEY = 'ljtk.v1';

  var DEFAULT = {
    bank: 'c400',
    seen: {},      // wordId -> 首次学习时间戳
    wrong: {},     // wordId -> { n: 错次, last: 时间戳, right: 答对次数 }
    daily: null,   // { date, ids, done }
    stats: { answered: 0, right: 0, days: {}, lastDay: '', streak: 0 }
  };

  var state = null;

  function today() {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      var obj = JSON.parse(raw);
      var s = JSON.parse(JSON.stringify(DEFAULT));
      for (var k in obj) if (obj[k] != null) s[k] = obj[k];
      return s;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function init() {
    state = load();
    tickStreak();
    return state;
  }

  state = load();

  /* 连续天数：隔天访问就续上，断两天以上归 1 */
  function tickStreak() {
    var t = today();
    var st = state.stats;
    if (st.lastDay === t) return;
    if (!st.lastDay) {
      st.streak = 1;
    } else {
      var a = new Date(st.lastDay + 'T00:00:00');
      var b = new Date(t + 'T00:00:00');
      var diff = Math.round((b - a) / 86400000);
      st.streak = diff === 1 ? (st.streak || 0) + 1 : 1;
    }
    st.lastDay = t;
    save();
  }

  return {
    init: init,
    today: today,

    get bank() { return state.bank; },
    setBank: function (id) { state.bank = id; save(); },

    /* 学习记录 */
    markSeen: function (id) {
      if (!state.seen[id]) { state.seen[id] = Date.now(); save(); }
    },
    isSeen: function (id) { return !!state.seen[id]; },
    seenCount: function (ids) {
      var n = 0;
      for (var i = 0; i < ids.length; i++) if (state.seen[ids[i]]) n++;
      return n;
    },

    /* 错词本 */
    addWrong: function (id) {
      var w = state.wrong[id] || { n: 0, right: 0, last: 0 };
      w.n += 1;
      w.last = Date.now();
      state.wrong[id] = w;
      save();
    },
    markRight: function (id) {
      var w = state.wrong[id];
      if (!w) return;
      w.right += 1;
      if (w.right >= 2) delete state.wrong[id];
      save();
    },
    removeWrong: function (id) { delete state.wrong[id]; save(); },
    clearWrong: function () { state.wrong = {}; save(); },
    wrongList: function () {
      return Object.keys(state.wrong)
        .map(function (id) { return { id: id, n: state.wrong[id].n, last: state.wrong[id].last }; })
        .sort(function (a, b) { return b.last - a.last; });
    },
    wrongCount: function () { return Object.keys(state.wrong).length; },

    /* 答题统计 */
    recordAnswer: function (id, ok) {
      state.stats.answered += 1;
      if (ok) state.stats.right += 1;
      var t = today();
      var d = state.stats.days[t] || { a: 0, r: 0 };
      d.a += 1;
      if (ok) d.r += 1;
      state.stats.days[t] = d;
      if (ok) this.markRight(id); else this.addWrong(id);
      save();
    },
    stats: function () {
      var st = state.stats;
      return {
        answered: st.answered,
        right: st.right,
        rate: st.answered ? Math.round(st.right * 100 / st.answered) : 0,
        streak: st.streak || 0,
        todayDone: (st.days[today()] || { a: 0 }).a
      };
    },

    /* 每日 20 词：未学优先，其次错词，最后随机复习 */
    daily: function (allIds) {
      var t = today();
      if (state.daily && state.daily.date === t) return state.daily;
      var unseen = [], review = [];
      for (var i = 0; i < allIds.length; i++) {
        if (!state.seen[allIds[i]]) unseen.push(allIds[i]);
        else review.push(allIds[i]);
      }
      shuffle(unseen); shuffle(review);
      var picked = unseen.slice(0, 20);
      if (picked.length < 20) picked = picked.concat(review.slice(0, 20 - picked.length));
      state.daily = { date: t, ids: picked, done: [] };
      save();
      return state.daily;
    },
    dailyMark: function (id) {
      var d = state.daily;
      if (!d) return;
      if (d.done.indexOf(id) < 0) { d.done.push(id); save(); }
    },

    reset: function () {
      state = JSON.parse(JSON.stringify(DEFAULT));
      save();
    }
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
})();
