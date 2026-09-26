// AiLab · Етап 3 — „Снимки“ (Ден, Източници, Табло, преглед на цял екран) върху Етап 2: начален екран „Табло“ (броячи, решения,
// хора по дни, поток на промените) + „Ден“ от Етап 1 + „Действия“.
// Пази входа, запазеното и service worker-а от Етап 0. ?demo=1 → вградени примерни данни без вход (нищо не отива в облака).
// Правило: всеки текст от базата/потребителя минава през esc(), преди да влезе в HTML.
(function () {
  'use strict';
  var CFG = window.SHTAB_CONFIG || {};
  var QS = location.search || '';
  var DEMO = /[?&]demo=1(&|$)/.test(QS);
  var QS_OBEKT = (/[?&]obekt=(ag|soft)(&|$)/.exec(QS) || [])[1] || null;
  var OBEKT_KOD = 'ag';                // обектът на екран „Ден“ — сменя се от Таблото и от „⇄“ (setObekt)
  var POLL_MS = DEMO ? 5000 : 20000;   // докато денят е отворен: статус, нова версия, опашка
  var STALE_H = 6;                     // източник, по-стар от толкова часа = застарял (кехлибарено)
  var K = { cache: 'ailab_e1_cache', queue: 'ailab_e1_queue', tablo: 'ailab_e2_tablo' };
  var K2 = { obekt: 'ailab_e2_obekt', denObekt: 'ailab_e2_den_obekt', vid: 'ailab_e2_vidyano', vlizal: 'ailab_e2_vlizal' };   // направо в localStorage
  var CACHE_KEY = 'ailab_e0_cache';    // картите от Етап 0
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var screen = $('#screen'), tablo = $('#tablo');
  var db = null, user = null, view = 'boot', api = null, D = null, P = null;
  var S = { dni: [], counts: {}, svezhest: [], deistviq: [], den: null, tochki: [], res: [], openedAt: 0, newVersiq: 0,
    offline: false, dataAt: '', fullOpen: false, showAllActs: false, forceOff: false, pollT: 0, polling: false, tok: 0, sig: '', seen: {},
    okAt: 0, svAt: 0, scrollY: 0, flash: null, actsAt: '', actsOkAt: 0, actsErr: null, actOpen: {} };
  var OBEKT = { ag: ['Амур Гардънс', 'p-ag'], soft: ['Скай Тауърс', 'p-soft'], gm: ['GM общо', 'p-warn'] };
  var SELK = { ag: 'Амур', soft: 'Скай', all: 'Всички' };
  var SELN = { ag: 'Амур Гардънс', soft: 'Скай Тауърс', all: 'двата обекта' };
  // Черта за „Изисква решение“ [К18]: по-старите решения са под „По-стари решения ›“ (РП може да я мести).
  var RESH_OT = DEMO ? '2026-09-01' : '2026-09-16';
  // Таблото: TB (не T — T е локална функция в демото, T0 — часовникът). Отворени решения и поток — по избор (TB.S.ag|soft|all).
  var TB = { sel: 'all', at: '', tok: 0, busy: 0, okAt: 0, hasBase: false, baseErr: null, dni: [], soon: [], odobri: [], closed: {}, inflight: {}, undo: {},
    S: {}, chart: { sel: null, anim: true }, defer: {}, scrollY: 0, shownAt: 0, measured: false, seenBase: '', built: false, io: null, cardSeen: {} };

  // ---------- помощни ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var T0 = Date.now(), DEMO_NOW = Date.parse('2026-09-24T17:42:00+03:00');
  function nowMs() { return DEMO ? DEMO_NOW + (Date.now() - T0) : Date.now(); }
  function now() { return new Date(nowMs()); }
  function nowIso() { return now().toISOString(); }
  function hhmm(d) { d = d || now(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dm(iso) { var d = new Date(iso); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + hhmm(d); }
  var DNI = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];
  var DNI_K = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  var MES = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pl(n, ed, mn) { return n === 1 ? ed : mn; }   // „1 ден“ / „2 дни“
  function parseD(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); }
  function ddmm(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function rel(x) {
    if (!x) return '—';
    var d = new Date(x); if (isNaN(d)) return '—';
    var n = now(); if (sameDay(d, n)) return hhmm(d);
    var y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1); if (sameDay(d, y)) return 'вчера ' + hhmm(d);
    return ddmm(d) + ' ' + hhmm(d);
  }
  function dayTitle(s) { var d = parseD(s); return cap(DNI[d.getDay()]) + ', ' + d.getDate() + ' ' + MES[d.getMonth()]; }
  function exact(d) { return DNI[d.getDay()] + ', ' + d.getDate() + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hhmm(d); }
  function exactShort(d) { return DNI_K[d.getDay()].toLowerCase() + ' ' + ddmm(d) + '.' + d.getFullYear() + ', ' + hhmm(d); }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function isStandalone() { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
  function device() {
    var u = navigator.userAgent || '';
    var k = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : 'компютър';
    return (DEMO ? 'демо · ' : '') + k + (isStandalone() ? ' · иконка' : ' · браузър');
  }
  function stamp(txt, off) { var s = $('#stamp'); $('#stampTxt').textContent = txt; s.classList.toggle('off', !!off); s.setAttribute('aria-label', 'Обнови · ' + txt); }
  // Грешка от базата → обикновен български (техническият текст на английски не стига до екрана).
  function errBg(e) {
    var c = (e && e.code) || '';
    if (e && e.bg) return e.bg;
    if (c === 'GONE') return e.message;
    if (isMissing(e)) return 'базата още не е готова';
    if (isAuth(e)) return 'сесията изтече — влез отново';
    if (isNet(e)) return 'няма връзка с облака';
    if (c === '23503') return 'точката или денят вече ги няма в базата (има нова версия)';
    if (c === '42501' || /row-level security|permission denied/i.test((e && e.message) || '')) return 'нямаш право за този запис';
    if (c === '23505') return 'този запис вече го има';
    if (c === '23502' || c === '23514' || c === '22P02' || c === '22007') return 'непълни или невалидни данни в записа';
    return 'грешка в базата' + (c ? ' (код ' + c + ')' : '');
  }
  // прекъсната заявка (12 с таймаут → AbortError/TimeoutError) = „без покритие“
  function isNet(e) { return S.forceOff || !navigator.onLine || !e || !e.code || /failed to fetch|networkerror|load failed|network request|abort|timeout|timed out/i.test(e.message || ''); }
  function isAuth(e) { return !!e && (e.code === 'PGRST301' || e.code === 'PGRST302' || /jwt/i.test(e.message || '')); }
  function isMissing(e) { return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message || '')); }

  // ---------- мерене само на видимото време ----------
  // Иконката на iPhone се „събужда“ без презареждане: заключен телефон или друго приложение не бива да влиза
  // в „от отваряне до Одобрявам“. Броят се само тиктакания, докато страницата е видима (всяко — до 2 с).
  var ACT = { ms: 0, last: Date.now() };
  function actTick() { var n = Date.now(), d = n - ACT.last; ACT.last = n; if (!document.hidden && d > 0) ACT.ms += Math.min(d, 2000); }
  function activeMs() { actTick(); return ACT.ms; }
  setInterval(actTick, 1000);

  // ---------- запазено на телефона (в демо — само в паметта) ----------
  var MEM = {};
  function sget(k, d) { try { var v = DEMO ? MEM[k] : localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ssetOk(k, v) { try { var s = JSON.stringify(v); if (DEMO) MEM[k] = s; else localStorage.setItem(k, s); return true; } catch (e) { return false; } }
  function sset(k, v) { ssetOk(k, v); }
  // Малки настройки (избор на обект…) — направо в localStorage; в демо с „_demo“, за да не се смесват с истинските.
  function lget(k) { try { return localStorage.getItem(DEMO ? k + '_demo' : k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(DEMO ? k + '_demo' : k, v); } catch (e) {} }

  // ---------- облачната база ----------
  // Без вход (старт без мрежа и без сесия) заявки не тръгват — иначе анонимно четене би върнало „празно“ върху запазеното.
  function R(build) {
    if (!db || !user) return Promise.reject({ message: 'Няма връзка с облака', code: '' });
    try { return Promise.resolve(build()).then(function (r) { if (r.error) throw r.error; return r.data; }); }
    catch (e) { return Promise.reject(e); }
  }
  // Като R(), но пази и общия брой от { count: 'exact' } (заявка 2 на Таблото) [К1].
  function RC(build) {
    if (!db || !user) return Promise.reject({ message: 'Няма връзка с облака', code: '' });
    try { return Promise.resolve(build()).then(function (r) { if (r.error) throw r.error; return { data: r.data || [], count: r.count == null ? null : r.count }; }); }
    catch (e) { return Promise.reject(e); }
  }
  // 12 с таван на заявка: прекъсната = „без покритие“ (isNet)
  function tsig() {
    try { if (window.AbortSignal && AbortSignal.timeout) return AbortSignal.timeout(12000); } catch (e) {}
    if (window.AbortController) { var c = new AbortController(); setTimeout(function () { try { c.abort(); } catch (e) {} }, 12000); return c.signal; }
    return undefined;
  }
  var DNI_COLS = 'id,obekt,data,status,versiq,hesh,rezyume,hora,obnoven,vpisan_pat';
  var TEST_DO = '2001-01-01';   // тестовите дни на пробата (2000-01-01) не се показват
  var CLOSE_VID = { potvardi: 1, popravka: 1, osporva: 1, komentar: 1 };   // тези решения затварят точка „за решение“
  var OPEN_SEL = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red,dni!inner(obekt,data,status,versiq,hesh,obnoven),resheniq(id),deistviq(id)';
  var FEED_COLS = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red';
  var ACT_COLS = 'id,den_id,tochka_id,vid,tekst,chovek,mqsto,srok,izvor,status,sazdadeno,obnoveno';
  var SOON_COLS = 'id,den_id,tochka_id,vid,tekst,chovek,mqsto,srok,status,sazdadeno';
  var SOON_MAX = 50;   // таван на заявка 4; пълен таван → „N+ по-стари без отметка“
  var realApi = {
    dni: function () { return R(function () { return db.from('dni').select(DNI_COLS).eq('obekt', OBEKT_KOD).gte('data', TEST_DO).order('data', { ascending: false }).limit(60); }); },
    // „чакат“ за лентата: точките за решение/непроверени + моите потвърждения и поправки по тях (като на отворения ден)
    counts: function (ids) {
      if (!ids.length) return Promise.resolve({ t: [], r: [] });
      return Promise.all([
        R(function () { return db.from('tochki').select('id,den_id,grupa,istina').in('den_id', ids).in('grupa', ['reshenie', 'neprovereno']); }),
        R(function () { return db.from('resheniq').select('den_id,tochka_id,vid').in('den_id', ids).in('vid', ['potvardi', 'popravka']).not('tochka_id', 'is', null); })
      ]).then(function (rr) { return { t: rr[0] || [], r: rr[1] || [] }; });
    },
    den: function (id) { return R(function () { return db.from('dni').select('*').eq('id', id).maybeSingle(); }); },
    head: function (id) { return R(function () { return db.from('dni').select('id,versiq,status,hesh,obnoven,vpisan_pat').eq('id', id).maybeSingle(); }); },
    tochki: function (id) { return R(function () { return db.from('tochki').select('*').eq('den_id', id).order('red', { ascending: true }).order('id', { ascending: true }); }); },
    istini: function (id) { return R(function () { return db.from('tochki').select('id,istina').eq('den_id', id); }); },
    res: function (id) { return R(function () { return db.from('resheniq').select('id,den_id,tochka_id,vid,tekst,versiq,hesh,kogda,obraboteno,rezultat').eq('den_id', id).order('kogda', { ascending: true }); }); },
    svezhest: function () { return R(function () { return db.from('svezhest').select('izvor,posledno,ok,broi,belejka').abortSignal(tsig()); }); },   // заявка 3
    // заявка 7: един списък за таб „Действия“ и за „Моите действия“ под деня [К10]
    deistviq: function () { return R(function () { return db.from('deistviq').select(ACT_COLS).order('sazdadeno', { ascending: false }).limit(100).abortSignal(tsig()); }); },
    insert: function (tbl, row) { return R(function () { return db.from(tbl).insert(row); }); },
    // ---- Таблото (Етап 2): само SELECT ----
    tDni: function () { return R(function () { return db.from('dni').select('id,obekt,data,status,versiq,hora,obnoven').gte('data', TEST_DO).order('data', { ascending: false }).order('obekt').limit(400).abortSignal(tsig()); }); },
    // заявка 2: отворените решения с една заявка (анти-съединение в PostgREST) + общият брой
    tOpen: function (sel, rg, old) {
      return RC(function () {
        var q = db.from('tochki').select(OPEN_SEL, { count: 'exact' }).eq('grupa', 'reshenie')
          .in('resheniq.vid', ['potvardi', 'popravka', 'osporva', 'komentar']).is('resheniq', null).is('deistviq', null);
        q = old ? q.lt('dni.data', RESH_OT).gte('dni.data', TEST_DO) : q.gte('dni.data', RESH_OT);
        if (sel !== 'all') q = q.eq('dni.obekt', sel);
        return q.order('vajnost', { ascending: false }).order('dni(data)', { ascending: true }).order('red').order('id').range(rg[0], rg[1]).abortSignal(tsig());
      });
    },
    // заявка 4: срок ≤ сега+48 ч, НАЙ-БЛИЗКИТЕ ДО ГРАНИЦАТА ПЪРВО — просрочените растат завинаги (К19) и при възходящ ред
    // 50-те реда биха били само просрочени, а сроковете до 48 ч биха изпаднали от тавана
    tSoon: function () {
      var lim = new Date(nowMs() + 48 * 36e5).toISOString();
      return R(function () { return db.from('deistviq').select(SOON_COLS).eq('status', 'zaqveno').not('srok', 'is', null).lte('srok', lim).order('srok', { ascending: false }).limit(SOON_MAX).abortSignal(tsig()); });
    },
    tOdobri: function () { return R(function () { return db.from('resheniq').select('den_id,versiq').eq('vid', 'odobri').is('obraboteno', null).limit(100).abortSignal(tsig()); }); },
    tFeed: function (ids) {
      if (!ids.length) return Promise.resolve([]);
      return R(function () { return db.from('tochki').select(FEED_COLS).eq('grupa', 'promqna').in('den_id', ids).order('vajnost', { ascending: false }).order('red').order('id').limit(150).abortSignal(tsig()); });
    },
    // ---- Снимки (Етап 3): само SELECT; без таблицата/функцията → тихо без снимки ----
    // С1: всички снимки на деня (паралелно с den/tochki/res, не ги чака)
    snimki: function (id) { return R(function () { return db.from('snimki').select(PH_COLS).eq('den_id', id).order('vreme').order('n').order('id').limit(500).abortSignal(tsig()); }); },
    // С2: снимките на съобщенията от източниците на една точка — по индекса snimki_den (ден + ид) [К9]
    snimkiMsg: function (denId, ids) {
      if (!ids.length) return Promise.resolve([]);
      return R(function () { return db.from('snimki').select(PH_COLS).eq('den_id', denId).in('msg_id', ids).order('vreme').order('n').limit(200).abortSignal(tsig()); });
    },
    // С3: до 4 миниатюри на ден + общ брой, с една заявка (порция от потока на Таблото)
    tPh: function (ids) {
      if (!ids.length) return Promise.resolve([]);
      return R(function () { return db.rpc('snimki_tablo', { ids: ids, na_den: 4 }).abortSignal(tsig()); });
    }
  };

  // ---------- опашка „чака връзка“ (решения, действия, мерене) ----------
  // Всеки запис в опашката: {qid, tbl, row, at (часът на натискане), tt (текстът на точката), err (защо не се записа)}.
  // Запис с текст от РП НИКОГА не се губи: при отказ от базата остава с „err“ и се вижда в лентата горе.
  function queue() { var q = sget(K.queue, []); return Array.isArray(q) ? q : []; }
  function setQueue(q) { sset(K.queue, q); }
  function liveQ() { return queue().filter(function (it) { return !it.err; }); }
  function errQ() { return queue().filter(function (it) { return !!it.err; }); }
  function findQ(qid) { return queue().filter(function (x) { return x.qid === qid; })[0] || null; }
  function dropQ(qid) { setQueue(queue().filter(function (x) { return x.qid !== qid; })); }
  function enqueue(tbl, row, meta, at) {
    var it = { qid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), tbl: tbl, row: row, at: at || nowIso(), tt: (meta && meta.tt) || null };
    var q = queue(); q.push(it); setQueue(q); renderBanners();
    return it;
  }
  function pendingCount() { return liveQ().filter(function (it) { return it.tbl !== 'metriki'; }).length; }
  // Чакалият запис носи часа на натискане, не часа на връзката (одобрено в 21:10 без покритие ≠ одобрено в 07:40).
  function stampRow(it) {
    var r = Object.assign({}, it.row), col = it.tbl === 'deistviq' ? 'sazdadeno' : 'kogda';
    if (r[col] == null) r[col] = it.at;
    return r;
  }
  // Точката (или денят) вече я няма — напр. Claude е поправил текста ѝ в нова версия. Записът се праща без връзката,
  // а текстът на точката влиза в него, за да не се губи за какво е ставало дума.
  function fkFix(tbl, row, e, tt) {
    if (!e || e.code !== '23503') return null;
    var m = ((e.details || '') + ' ' + (e.message || '')), r = Object.assign({}, row);
    if (r.tochka_id != null && !/den_id/.test(m)) {
      r.tochka_id = null;
      if (tbl === 'resheniq' && tt && r.vid !== 'odobri') r.tekst = 'Към точка „' + clip(tt, 300) + '“' + (r.tekst ? ': ' + r.tekst : '');
      return r;
    }
    if (r.den_id != null && tbl !== 'resheniq' && /den_id/.test(m)) { r.den_id = null; return r; }
    return null;
  }
  function insertFk(tbl, row, tt, n) {
    n = n || 0;
    return api.insert(tbl, row).then(function () { return row; }, function (e) {
      var f = n < 2 ? fkFix(tbl, row, e, tt) : null;
      if (f) return insertFk(tbl, f, tt, n + 1);
      throw e;
    });
  }
  function afterSent(it, row0) {
    var row = Object.assign({ id: 'l' + it.qid, kogda: it.at, sazdadeno: it.at, status: 'zaqveno', obraboteno: null, rezultat: null }, row0 || it.row);
    if (it.tbl === 'resheniq' && S.den && row.den_id === S.den.id) S.res.push(row);
    if (it.tbl === 'deistviq') { S.deistviq.unshift(row); if (row.srok && Date.parse(row.srok) <= nowMs() + 48 * 36e5) TB.soon.push(row); }
    if (it.tbl === 'resheniq' && row.vid === 'odobri') TB.odobri.push({ den_id: row.den_id, versiq: row.versiq });
    // Таблото: записът вече е в базата — новите заявки 2 не връщат точката (TB.closed се чисти по-късно) [К23]
    var tid = it.row && it.row.tochka_id;
    if (tid != null && TB.closed[tid] && closingRow(it.tbl, it.row)) TB.closed[tid].sent = nowIso();
  }
  // Праща ред; при липса на покритие го слага в опашката. Връща 'sent' | 'queued'; отхвърля само при истинска грешка от базата
  // (тогава листът с текста остава отворен — нищо не се губи).
  function send(tbl, row, meta) {
    var off = S.forceOff || !navigator.onLine, tt = (meta && meta.tt) || null;
    if (!off && !liveQ().length) {
      var at = nowIso();
      return insertFk(tbl, row, tt).then(function (r2) { afterSent({ qid: Date.now().toString(36), tbl: tbl, row: row, at: at }, r2); return 'sent'; }, function (e) {
        if (isNet(e) || isAuth(e)) { enqueue(tbl, row, meta, at); if (isNet(e)) setOffline(); return 'queued'; }
        throw e;
      });
    }
    var it = enqueue(tbl, row, meta);
    if (off) return Promise.resolve('queued');
    return flush(true).then(function () {
      var x = findQ(it.qid);
      if (!x) return 'sent';
      if (x.err) { dropQ(x.qid); renderBanners(); return Promise.reject({ code: x.code, message: x.err, bg: x.err }); }
      return 'queued';
    });
  }
  var flushing = null;
  function flush(silent) {
    if (flushing) return flushing;
    if (!liveQ().length || S.forceOff || !navigator.onLine || (!DEMO && (!db || !user))) return Promise.resolve();
    flushing = new Promise(function (done) {
      var sent = 0, bad = 0;
      function fin() {
        flushing = null;
        if (sent && !silent) { toast(sent === 1 ? 'Тръгна 1 чакащо' : 'Тръгнаха ' + sent + ' чакащи'); }
        if (bad && !silent) { toast((bad === 1 ? '1 запис не се записа' : bad + ' записа не се записаха') + ' — виж лентата горе', 'bad'); }
        if (sent) saveTablo();
        if (sent || bad) renderCurrent();
        renderBanners(); done();
      }
      (function next() {
        var it = liveQ()[0]; if (!it) { fin(); return; }
        insertFk(it.tbl, stampRow(it), it.tt).then(function (r2) {
          dropQ(it.qid);
          if (it.tbl !== 'metriki') { sent++; afterSent(it, r2); }   // мерането не се брои в „N чакат връзка“
          next();
        }, function (e) {
          if (isNet(e) || isAuth(e)) { fin(); return; }
          if (it.tbl === 'metriki') dropQ(it.qid);
          else {
            setQueue(queue().map(function (x) { return x.qid === it.qid ? Object.assign({}, x, { err: errBg(e), code: e.code || '' }) : x; }));
            bad++;
          }
          next();
        });
      })();
    });
    return flushing;
  }

  // ---------- кеш на данните (без покритие) ----------
  // Кешът на Ден е по обект (ailab_e1_cache_ag / _soft); часът е ISO (показва се с rel()).
  function dayKey(o) { return K.cache + '_' + (o || OBEKT_KOD); }
  function dayCached(o, id) { var c = sget(dayKey(o), null); return !!(c && c.days && c.days[id]); }
  function saveCache() {
    var c = sget(dayKey(), null) || {};
    if (c.obekt !== OBEKT_KOD) c = { obekt: OBEKT_KOD, days: {} };
    c.at = nowIso(); c.dni = S.dni; c.counts = S.counts; c.svezhest = S.svezhest; c.deistviq = S.deistviq.filter(function (a) { return typeof a.id === 'number'; });
    c.last = S.den ? S.den.id : null; c.days = c.days || {};
    if (S.den) {
      // снимките на деня — само пътищата и данните (без подписани адреси), до 120 реда; С1 още не е дошла → старите остават
      var prev = c.days[S.den.id], ph = PH.den === S.den.id && PH.list ? phRows(PH.list) : (prev && prev.snimki) || null;
      c.days[S.den.id] = { den: S.den, tochki: S.tochki, res: S.res, t: Date.now() };
      if (ph) c.days[S.den.id].snimki = ph;
    }
    Object.keys(c.days).sort(function (a, b) { return c.days[b].t - c.days[a].t; }).slice(6).forEach(function (k) { delete c.days[k]; });
    phSetCache(c);
    S.dataAt = c.at;
  }
  // Квота на телефона [К31]: при препълване — нов опит без снимките във всички дни, после както досега.
  function phSetCache(c) {
    if (ssetOk(dayKey(), c)) return;
    Object.keys(c.days || {}).forEach(function (k) { delete c.days[k].snimki; });
    sset(dayKey(), c);
  }
  function fromCache(id) {
    var c = sget(dayKey(), null); if (!c || c.obekt !== OBEKT_KOD) return false;
    S.dni = c.dni || []; S.counts = c.counts || {}; S.svezhest = c.svezhest || []; S.deistviq = c.deistviq || []; S.dataAt = c.at || '';
    var days = c.days || {}, day = days[id || c.last];
    if (!day) { var k = Object.keys(days)[0]; day = k ? days[k] : null; }
    if (day) {
      var same = S.den && S.den.id === day.den.id; S.den = day.den; S.tochki = day.tochki || []; S.res = day.res || []; if (!same) { S.openedAt = activeMs(); S.newVersiq = 0; }
      if (PH.den !== day.den.id) phPick(day.den.id, Array.isArray(day.snimki) ? day.snimki : null);   // снимките — от кеша, веднага
    }
    else { S.den = null; S.tochki = []; S.res = []; }
    return true;
  }
  // Мрежата е обща за трите екрана: печатът и лентите показват данните на ТЕКУЩИЯ екран [К5].
  function setOffline() { S.offline = true; stampNow(); renderCurrent(); }
  function setOnline() { S.offline = false; stampNow(); renderCurrent(); }

  // ---------- зареждане ----------
  function findDni(id) { for (var i = 0; i < S.dni.length; i++) if (S.dni[i].id === id) return S.dni[i]; return null; }
  function findT(id) { for (var i = 0; i < S.tochki.length; i++) if (S.tochki[i].id === id) return S.tochki[i]; return null; }
  function normT(t) {
    if (typeof t.izvori === 'string') { try { t.izvori = JSON.parse(t.izvori); } catch (e) { t.izvori = []; } }
    if (!Array.isArray(t.izvori)) t.izvori = [];
    return t;
  }
  // „чакат“ на ден от лентата — същото правило като на отворения ден: точка за решение/непроверена, която не е
  // проверена и по която РП още не е потвърдил или поправил (и в базата, и в опашката).
  function countMap(c) {
    var own = {}, m = {};
    ((c && c.r) || []).forEach(function (r) { if (r.tochka_id != null) own[r.tochka_id] = 1; });
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.tochka_id != null && (it.row.vid === 'potvardi' || it.row.vid === 'popravka')) own[it.row.tochka_id] = 1; });
    ((c && c.t) || []).forEach(function (t) { if (t.istina !== 'provereno' && !own[t.id]) m[t.den_id] = (m[t.den_id] || 0) + 1; });
    return m;
  }
  function chIds() { return S.dni.filter(function (d) { return d.status === 'chernova'; }).map(function (d) { return d.id; }); }
  // Зарежда екран „Ден“. НЕ сменя изгледа — това прави само go() / входа [К2].
  function boot(keepId, quiet) {
    if (!quiet && view === 'day') stamp('зареждам…');
    var tok = ++S.tok, svF = S.svAt && Date.now() - S.svAt < 60000;   // свежестта от Таблото (< 60 с) не се тегли наново
    return api.dni().then(function (dni) {
      if (tok !== S.tok) return;
      S.dni = dni || []; S.dniPartial = false;
      return Promise.all([api.counts(chIds()), svF ? Promise.resolve(S.svezhest) : api.svezhest(), api.deistviq()]).then(function (rr) {
        if (tok !== S.tok) return;
        S.counts = countMap(rr[0]); S.svezhest = rr[1] || []; S.deistviq = rr[2] || [];
        if (!svF) S.svAt = Date.now();
        S.actsAt = nowIso(); S.actsOkAt = Date.now();
        // денят се зарежда по id и когато не е сред 60-те най-нови [К8]
        var id = keepId || (S.dni[0] ? S.dni[0].id : null);
        if (!id) { S.den = null; S.tochki = []; S.res = []; saveCache(); setOnline(); renderDay(); return; }
        return loadDen(id, tok).catch(function (e) {
          if (e && e.code === 'GONE' && keepId && S.dni[0] && S.dni[0].id !== keepId) { toast('Този ден вече го няма — показвам най-новия.'); return loadDen(S.dni[0].id, tok); }
          throw e;
        });
      });
    }).catch(function (e) {
      if (tok !== S.tok) return;
      if (quiet && (isNet(e) || isAuth(e))) { setOffline(); return; }
      onLoadFail(e, keepId);
    });
  }
  // explicit = РП натисна „Презареди“. Иначе нова версия на СЪЩИЯ ден не подменя показаното (напр. след връзка
  // отново) — остава лентата „Има нова версия“, за да не се одобри неусетно друго от прегледаното.
  function loadDen(id, tok, explicit) {
    phLoad(id);   // С1 — успоредно, не се чака (и при нова версия / презареждане) [§4.1]
    return Promise.all([api.den(id), api.tochki(id), api.res(id)]).then(function (rr) {
      if (tok != null && tok !== S.tok) return;
      if (!rr[0]) throw { message: 'Този ден вече го няма в базата.', code: 'GONE' };
      var same = S.den && S.den.id === id;
      if (same && !explicit && rr[0].versiq > S.den.versiq) {
        applyHead(rr[0]);
        S.res = rr[2] || [];
        var m = {}; (rr[1] || []).forEach(function (t) { m[t.id] = t.istina; });
        S.tochki.forEach(function (t) { if (m[t.id]) t.istina = m[t.id]; });
        saveCache(); setOnline();
        if ($('#groups')) renderLive(); else renderDay();   // напр. връщане от „Карти“ — екранът на деня се рисува наново
        return;
      }
      S.den = rr[0]; S.tochki = (rr[1] || []).map(normT); S.res = rr[2] || []; S.newVersiq = 0;
      if (!same) { S.openedAt = activeMs(); S.fullOpen = false; }
      // денят е от другия обект (напр. ръчно въведен адрес #den/<id>) → Ден минава на неговия обект; лентата идва с проверката
      if (S.den.obekt && S.den.obekt !== OBEKT_KOD && (S.den.obekt === 'ag' || S.den.obekt === 'soft')) {
        OBEKT_KOD = S.den.obekt; lset(K2.denObekt, OBEKT_KOD); S.dni = []; S.counts = {}; S.dniPartial = true;
        if (view === 'day') setBodyO(OBEKT_KOD);
      }
      var row = findDni(id);
      if (row) { row.status = S.den.status; row.versiq = S.den.versiq; }
      else keepDenRow();
      if (!S.seen[id]) { S.seen[id] = 1; send('metriki', { vid: 'pregled_otvoren', stoinost: 1, den_id: id }).catch(function () {}); }
      S.okAt = Date.now();
      saveCache(); setOnline(); renderDay();
      if (!same && view === 'day') window.scrollTo(0, 0);
    });
  }
  // Отвореният ден е извън 60-те най-нови в лентата — добавя се, за да е избран [К8]
  function keepDenRow() {
    var d = S.den; if (!d || findDni(d.id)) return;
    S.dni.push({ id: d.id, obekt: d.obekt, data: d.data, status: d.status, versiq: d.versiq, hesh: d.hesh, rezyume: d.rezyume, hora: d.hora, obnoven: d.obnoven, vpisan_pat: d.vpisan_pat });
    S.dni.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
  }
  function onLoadFail(e, id) {
    if (view !== 'day') return;
    if (isMissing(e)) { renderSetup(); return; }
    if (isAuth(e) && navigator.onLine && !DEMO) { stopPoll(); viewLogin('Сесията изтече — влез отново.'); return; }
    if (isNet(e) || isAuth(e)) {
      if (fromCache(id)) { setOffline(); renderDay(); return; }
      stamp('без връзка', true); stopPoll(); $('#fab').hidden = true;
      screen.innerHTML = '<h1>Няма връзка</h1><p class="muted">Отвори AiLab, когато има покритие.</p><button class="btn" type="button" data-a="retry">Опитай пак</button>';
      return;
    }
    stamp('грешка', true);
    screen.innerHTML = '<h1>Нещо се обърка</h1><div class="err">' + esc(errBg(e)) + '</div><button class="btn" type="button" data-a="retry">Опитай пак</button>' + footer();
  }
  function openDay(id) {
    if (!id) return;
    if (S.den && S.den.id === id) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    // денят, който напускаме, пази в лентата броя „чакат“, който РП е виждал (с неговите потвърждения/поправки)
    var oldId = S.den && S.den.status === 'chernova' ? S.den.id : null, oldN = oldId ? openCount() : 0;
    if (oldId) S.counts[oldId] = oldN;
    if (S.offline || S.forceOff) {
      if (dayCached(OBEKT_KOD, id)) { fromCache(id); if (oldId) S.counts[oldId] = oldN; renderDay(); window.scrollTo(0, 0); }
      else { toast('Този ден не е запазен на телефона — отвори го, когато има покритие.'); if (!$('#groups')) renderDay(); }
      return;
    }
    stamp('зареждам…');
    var tok = ++S.tok;
    loadDen(id, tok).catch(function (e) {
      if (tok !== S.tok) return;
      if (isNet(e)) { setOffline(); openDay(id); }
      else { setOnline(); toast('Не се отвори: ' + errBg(e), 'bad'); if (!$('#groups')) renderDay(); }
    });
  }
  function reloadDen() {
    if (!S.den) return;
    var v = S.newVersiq;
    stamp('зареждам…');
    loadDen(S.den.id, ++S.tok, true).then(function () { if (v) toast('Заредена е версия ' + v); }, function (e) { if (isNet(e)) setOffline(); else toast('Не се зареди: ' + errBg(e), 'bad'); });
  }

  // ---------- проверка на всеки 20 с, докато денят е отворен ----------
  function startPoll() { if (!S.pollT) S.pollT = setInterval(function () { poll(false); }, POLL_MS); }
  function stopPoll() { if (S.pollT) clearInterval(S.pollT); S.pollT = 0; }
  function poll(force) {
    if (view !== 'day' || S.polling || S.forceOff || (!force && document.hidden)) return;
    if (!DEMO && !db) return;
    S.polling = true;
    var done = function () { S.polling = false; };
    if (S.offline || !S.den) { flush().then(function () { return boot(S.den ? S.den.id : null, true); }).then(done, done); return; }
    var id = S.den.id;
    flush().then(function () {
      return Promise.all([api.head(id), api.res(id), api.istini(id), api.svezhest(), api.deistviq(), api.dni()]);
    }).then(function (rr) {
      if (!S.den || S.den.id !== id) return;
      // Лентата с дните: статусите на другите дни + ден, качен, докато екранът е отворен.
      var lst = rr[5] || [], known = {}, had = !S.dniPartial;
      S.dni.forEach(function (d) { known[d.id] = 1; });
      var novi = lst.filter(function (d) { return !known[d.id]; });
      if (lst.length) { S.dni = lst; S.dniPartial = false; keepDenRow(); }
      if (novi.length && had) toast('Качен е нов ден: ' + dayTitle(novi[0].data));
      // „чакат“ на другите дни — при всяка проверка (лаптопът може да е отбелязал точки като проверени)
      api.counts(chIds()).then(function (c) { S.counts = countMap(c); renderStrip(); }, function () {});
      applyHead(rr[0]);
      // моето одобрение, което лаптопът отбеляза като остаряло (докато съм одобрявал, е качена нова версия)
      var bylo = {}; S.res.forEach(function (r) { bylo[r.id] = r.rezultat || ''; });
      var cakah = S.res.some(function (r) { return r.vid === 'odobri' && !r.rezultat; }) || liveQ().some(function (it) { return it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === id; });
      var ostar = (rr[1] || []).some(function (r) { return r.vid === 'odobri' && /остаряла/i.test(r.rezultat || '') && !/остаряла/i.test(bylo[r.id] || ''); });
      if (cakah && ostar) toast('Одобрението не е вписано — има нова версия. Презареди и одобри отново.', 'bad');
      S.res = rr[1] || [];
      var m = {}; (rr[2] || []).forEach(function (x) { m[x.id] = x.istina; });
      S.tochki.forEach(function (t) { if (m[t.id]) t.istina = m[t.id]; });
      S.svezhest = rr[3] || []; S.deistviq = rr[4] || []; S.svAt = Date.now(); S.actsAt = nowIso(); S.actsOkAt = Date.now(); S.okAt = Date.now();
      saveCache(); setOnline(); renderLive();
    }).catch(function (e) { if (isNet(e)) setOffline(); }).then(done, done);
  }
  function applyHead(h) {
    if (!h) return;
    var d = S.den, was = d.status;
    if (h.versiq > d.versiq && S.newVersiq !== h.versiq) {
      S.newVersiq = h.versiq; toast('Има нова версия (v ' + h.versiq + ')');
      // отворен лист „Одобряваш ли…“ за старата версия → вече не предлага одобрение
      if (sheetKind === 'approve') openNewVerSheet();
    }
    d.status = h.status; d.vpisan_pat = h.vpisan_pat;
    if (h.versiq === d.versiq) d.hesh = h.hesh;
    var row = findDni(d.id); if (row) { row.status = h.status; row.versiq = h.versiq; }
    if (was !== 'vpisana' && d.status === 'vpisana') toast('Вписан ✓ — записът е в OneDrive и на компютъра');
  }

  // ---------- групи, точки, моите решения ----------
  var GRUPI = [
    { k: 'promqna', t: 'Какво се промени', s: 'ново, свършено или преместено днес', e: 'Няма промени за този ден.', sh: 'промени' },
    { k: 'reshenie', t: 'Изисква решение', s: 'чака теб: решение, отговор, пари или срок', e: '✅ Нищо не чака решение.', sh: 'за решение' },
    { k: 'neprovereno', t: 'Непроверено', s: 'от един източник, разминаване или липсващи данни', e: '✅ Всичко има потвърждение.', sh: 'непроверени' }
  ];
  function groupsOf() {
    var g = { promqna: [], reshenie: [], neprovereno: [] };
    S.tochki.forEach(function (t) { if (g[t.grupa]) g[t.grupa].push(t); });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return (b.vajnost || 1) - (a.vajnost || 1) || (a.red || 0) - (b.red || 0) || a.id - b.id; }); });
    return g;
  }
  function mine(tid) {
    var o = { ok: null, fix: [] }, bad = false;
    // tekst 'отговорено' = „✓ Отговорено“ на решение (Таблото / заключен ден) — различно от „✓ вярно“ [К20]
    S.res.forEach(function (r) {
      if (r.tochka_id !== tid) return;
      if (r.vid === 'potvardi') o.ok = { at: r.kogda, pend: false, otg: r.tekst === 'отговорено' };
      if (r.vid === 'popravka') o.fix.push({ tekst: r.tekst, at: r.kogda, rez: r.rezultat, pend: false });
    });
    queue().forEach(function (it) {
      if (it.tbl !== 'resheniq' || it.row.tochka_id !== tid) return;
      if (it.row.vid === 'potvardi' && !it.err) o.ok = { at: it.at, pend: true, otg: it.row.tekst === 'отговорено' };
      if (it.row.vid === 'potvardi' && it.err) bad = true;
      if (it.row.vid === 'popravka') o.fix.push({ tekst: it.row.tekst, at: it.at, pend: true, err: it.err || '' });
    });
    // отговорено от Таблото, докато денят тук е от по-старо зареждане (или от кеша) [К23]
    var c = TB.closed[tid];
    if (!o.ok && !bad && c && c.ok) o.ok = { at: c.at, pend: !c.sent && !!TB.inflight[tid], otg: true };
    return o;
  }
  function newPending() { return !!(S.den && S.newVersiq > S.den.versiq); }
  // Одобрен (или чакащ лаптопа) и вписан ден: поправка вече не влиза в записа — картите остават само с „→ Действие“.
  function locked() { return !!S.den && apprState().k !== 'none'; }
  function handled(t) { var m = mine(t.id); return t.istina === 'provereno' || !!m.ok || m.fix.some(function (f) { return !f.err; }); }
  function openCount() { var g = groupsOf(); return g.reshenie.concat(g.neprovereno).filter(function (t) { return !handled(t); }).length; }
  var EMO = [
    [/няма данни|без данни/i, '⚠️'], [/достав|камион|пристига/i, '🚚'], [/кофражист|души|хора|работниц|присъстви/i, '👷'],
    [/акт\s*(№\s*)?\d|актове|чертеж|протокол|документ|писмо|разрешени|заповед/i, '📄'], [/фактур|плащан|оферт|\d\s*(лв|€)|евро/i, '💶'],
    [/кофраж/i, '🪵'], [/армир|арматур/i, '🔩'], [/бетон|кубчет|проби|mpa/i, '🧪'], [/зида|тухл|клинкер/i, '🧱'], [/снимк/i, '📸'], [/напомн/i, '🔔']
  ];
  // Имената на 12-те раздела на дневника и емотиконът на всеки (когато думите в текста не подскажат друг).
  var RAZDELI = ['Управленско резюме', 'Метео', 'Работна ръка', 'Извършени работи', 'Доставки и материали', 'Механизация',
    'Задачи и решения', 'Проблеми и рискове', 'Качество и проби', 'Документи и кореспонденция', 'За потвърждение', 'Източници и статус'];
  var RAZ_EMO = ['📋', '🌡️', '👷', '🏗️', '🚚', '⚙️', '📌', '⚠️', '🧪', '📄', '❓', '🗂️'];
  // Един смисъл = един емотикон навсякъде (Табло И Ден) [К6]: първо думите от EMO, после разделът.
  function emoT(t) {
    var s = t.tekst || '';
    for (var i = 0; i < EMO.length; i++) if (EMO[i][0].test(s)) return EMO[i][1];
    return RAZ_EMO[(t.razdel || 0) - 1] || '🏗️';
  }
  var ISTINA = { saobshteno: ['съобщено', 'p-neutral'], provereno: ['✅ проверено', 'p-ok'], osporeno: ['оспорено', 'p-bad'] };
  var IZ = { teams: ['Тиймс', '💬'], poshta: ['Поща', '✉️'], prisystvia: ['Присъствия', '👷'], intranet: ['Интранет', '🗂️'], server: ['Сървър', '🗄️'] };
  var IZ_RED = ['teams', 'poshta', 'prisystvia', 'intranet', 'server'];
  var TIP_EMO = { 'тиймс': '💬', 'поща': '✉️', 'присъствия': '👷', 'интранет': '🗂️', 'снимка': '📸', 'сървър': '🗄️', 'метео': '🌡️' };
  function tipEmo(tip) { return TIP_EMO[String(tip || '').toLowerCase()] || '📄'; }

  // ---------- екран „Ден“ ----------
  function renderDay() {
    if (view !== 'day') return;   // закъснял отговор на Ден не пише върху друг екран [К2]
    $('#fab').hidden = false;
    startPoll();
    setHash(S.den ? '#den/' + S.den.id : '#den');
    if (!S.dni.length && !S.den) { renderEmpty(); return; }
    screen.innerHTML =
      '<section class="strip-w"><div class="strip-h"><button type="button" class="ochip och-sw" data-a="dObekt" aria-label="' + esc('Обект: ' + OBEKT[OBEKT_KOD][0] + ' — смени') + '">' +
        esc(OBEKT[OBEKT_KOD][0]) + ' <span aria-hidden="true">⇄</span></button><span class="small muted">' + esc(monthLbl()) + '</span></div>' +
      '<div class="strip" id="strip" role="tablist" aria-label="Дни"></div>' +
      '<div class="legend" aria-hidden="true"><span><i class="lg-ch"></i>чернова</span><span><i class="lg-od"></i>одобрен · чака лаптопа</span><span><i class="lg-vp"></i>вписан</span></div></section>' +
      '<div id="fresh"></div><section id="sum"></section><div id="groups" class="groups"></div>' +
      '<section id="ph" class="phs" aria-label="Снимки"></section><section id="full"></section>' +
      '<div id="appr"></div><section id="acts" class="actsec"></section>' + footer();
    renderStrip(); renderFresh(); renderSum(); renderGroups(); renderPh(); renderFull(); renderAppr(); renderActs(); renderBanners();
    var st = $('#strip'), sel = $('.sd.sel');
    if (st && sel) st.scrollLeft = Math.max(0, sel.offsetLeft - (st.clientWidth - sel.offsetWidth) / 2);
    if (S.flash && S.den && S.flash.den === S.den.id) setTimeout(flashPoint, 80);   // от Таблото: точката светва
  }
  // „⇄“ до името на обекта: Ден минава на другия обект.
  function dSwitchObekt() {
    var o = OBEKT_KOD === 'ag' ? 'soft' : 'ag';
    setObekt(o); setBodyO(o);
    screen.innerHTML = '<div class="card pad tb-load"><span class="pulse" aria-hidden="true"></span> Зареждам ' + esc(OBEKT[o][0]) + '…</div>';
    window.scrollTo(0, 0);
    boot(null);
  }
  function monthLbl() { var s = S.den ? S.den.data : (S.dni[0] && S.dni[0].data); if (!s) return ''; var d = parseD(s); return MES[d.getMonth()] + ' ' + d.getFullYear(); }
  function renderLive() {
    if (view !== 'day') return;
    if (!S.den) { if (S.dni.length) renderDay(); else { renderFresh(); renderActs(); renderBanners(); } return; }
    renderStrip(); renderFresh(); renderAppr(); renderActs(); renderBanners();
    var sig = sigOf(); if (sig !== S.sig) { renderSum(); renderGroups(); }
    keepY(['#ph'], renderPh);   // снимките не са в sigOf(): box() пише само при промяна (напр. покритие ⇄ без покритие)
  }
  function sigOf() {
    return JSON.stringify([S.tochki.map(function (t) { return t.istina; }), S.res.map(function (r) { return [r.id, r.rezultat]; }),
      queue().filter(function (x) { return x.tbl === 'resheniq'; }).map(function (x) { return x.qid + (x.err ? '!' : ''); }),
      S.den ? S.den.status : '', locked()]);
  }
  function renderEmpty() {
    screen.innerHTML =
      '<section class="empty"><div class="empty-e" aria-hidden="true">🌙</div><h1>Още няма чернови</h1>' +
      '<p>За ' + esc(OBEKT[OBEKT_KOD][0]) + ' в облака още няма качен ден. Лаптопът качва черновата вечер (около 17:30) — тогава тя се появява тук с резюмето, точките за решение и бутона „Одобрявам“.</p>' +
      '<p class="small muted">Действията (бутонът „+“) работят и сега — не чакат черновата.</p></section>' +
      '<div id="fresh"></div><section id="acts" class="actsec"></section>' + footer();
    renderFresh(); renderActs(); renderBanners();
  }
  function renderSetup() {
    commitUndos(); stopPoll(); view = 'setup'; showBox(); renderTabs(); renderBanners(); $('#fab').hidden = true; stamp('базата не е готова', true);
    screen.innerHTML = '<section class="empty"><div class="empty-e" aria-hidden="true">🛠️</div><h1>Базата още не е готова</h1>' +
      '<p>Таблиците на Етап 1 (дни, точки, решения, действия) още не са създадени в облака. Лаптопът ги създава с <b>002_etap1.sql</b> — после отвори AiLab пак.</p></section>' +
      '<button class="btn" type="button" data-a="retry">Опитай пак</button>' + footer();
  }
  function footer() {
    return '<footer class="foot">' + (DEMO ? demoPanel() : '<button class="btn ghost" type="button" data-a="karti">🔎 Карти и търсене (Етап 0)</button>') + installHint() +
      (DEMO ? '<a class="btn ghost" href="./">Изход от демото</a>' : '<button class="btn ghost" type="button" data-a="logout">Изход</button>') + '</footer>';
  }
  function stripState(x) {
    if (x.status === 'vpisana') return { cls: 'st-vp', mark: '✓', lbl: 'вписан' };
    var cur = S.den && S.den.id === x.id;
    var q = liveQ().some(function (it) { return it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === x.id; });
    if (x.status === 'odobrena' || q || (cur && apprState().k !== 'none')) return { cls: 'st-od', mark: '⏳', lbl: 'одобрен, чака лаптопа' };
    var n = cur ? openCount() : (S.counts[x.id] || 0);
    return { cls: 'st-ch', mark: n ? '<b class="cnt">' + n + '</b>' : '•', lbl: 'чернова' + (n ? ', ' + n + ' чакат' : '') };
  }
  function renderStrip() {
    var el = box('#strip'); if (!el) return;
    var keep = el.scrollLeft;
    el.innerHTML = S.dni.map(function (x) {
      var d = parseD(x.data), sel = !!(S.den && S.den.id === x.id), st = stripState(x);
      return '<button type="button" class="sd ' + st.cls + (sel ? ' sel' : '') + '" role="tab" aria-selected="' + sel + '" data-a="day" data-id="' + esc(x.id) + '" aria-label="' + esc(dayTitle(x.data) + ' — ' + st.lbl) + '">' +
        '<span class="sd-w">' + DNI_K[d.getDay()] + '</span><span class="sd-n">' + d.getDate() + '</span><span class="sd-s">' + st.mark + '</span></button>';
    }).join('');
    el.scrollLeft = keep;
  }
  function fresh(s) { var t = Date.parse(s.posledno); return s.ok !== false && !isNaN(t) && (nowMs() - t) / 3600000 <= STALE_H; }
  function sortSv(list) { return (list || []).slice().sort(function (a, b) { var i = IZ_RED.indexOf(a.izvor), j = IZ_RED.indexOf(b.izvor); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); }
  // sel — контейнерът (Ден: #fresh, Табло: #tb-fresh); compact — 1 ред, по име само застарелите [К3, К17]
  function renderFresh(sel, compact) {
    var el = box(sel || '#fresh'); if (!el) return;
    var list = sortSv(S.svezhest);
    if (!list.length) { el.innerHTML = '<button type="button" class="fresh warn" data-a="fresh">⚠️ Свежест: лаптопът още не е пратил данни за източниците</button>'; return; }
    var okT = list.filter(fresh).map(function (s) { return Date.parse(s.posledno); });
    if (compact) {
      var old = list.filter(function (s) { return !fresh(s); });
      var txt = !old.length ? '✓ Всички ' + list.length + ' източника свежи · до ' + esc(rel(Math.max.apply(null, okT))) :
        (okT.length ? '✓ ' : '⚠️ ') + okT.length + ' от ' + list.length + ' свежи · <span class="fr-old">' +
        old.map(function (s) { return esc(IZ[s.izvor] ? IZ[s.izvor][0] : s.izvor) + ' ⚠️ ' + esc(rel(s.posledno)); }).join(' · ') + '</span>';
      el.innerHTML = '<button type="button" class="fresh one" data-a="fresh" aria-label="Свежест на източниците — подробно"><span class="fr-l">' + txt + '</span><span class="fr-go" aria-hidden="true">›</span></button>';
      return;
    }
    el.innerHTML = '<button type="button" class="fresh" data-a="fresh" aria-label="Свежест на източниците — подробно">' +
      '<span class="fr-u">' + (okT.length ? 'Данни до ' + esc(rel(Math.max.apply(null, okT))) : '⚠️ Няма свежи данни') + '</span>' +
      list.map(function (s) {
        var f = fresh(s), nm = IZ[s.izvor] ? IZ[s.izvor][0] : s.izvor;
        return '<span class="fr ' + (f ? 'ok' : 'old') + '">' + esc(nm) + ' ' + (f ? '✓' : '⚠️') + ' <span class="mono">' + esc(rel(s.posledno)) + '</span></span>';
      }).join('') + '</button>';
  }
  function stPill() {
    var a = apprState();
    if (a.k === 'vpisana') return ['Вписан ✓', 'p-ok'];
    if (a.k === 'pending') return ['Одобрен · чака лаптопа', 'p-warn'];
    if (a.k === 'queued') return ['Одобрен · чака връзка', 'p-warn'];
    return ['Чернова', 'p-mine'];
  }
  function renderSum() {
    var el = box('#sum'); if (!el) return;
    var d = S.den;
    if (!d) { el.className = ''; el.innerHTML = '<div class="card pad">Този ден не е запазен на телефона. Отвори го, когато има покритие.</div>'; return; }
    var g = groupsOf(), p = stPill(), phl = phCur(), phn = phl ? phl.length : 0;
    el.className = 'sum';
    el.innerHTML =
      '<div class="sum-h"><span class="small muted">Чернова от ' + esc(rel(d.obnoven)) + '</span><span class="sum-hr">' +
        (phn ? '<button type="button" class="sum-ph" data-a="phJump" aria-label="' + esc('Снимки: ' + phn + ' — към секцията') + '">📷 ' + phn + ' ›</button>' : '') +
        '<span class="pill ' + p[1] + '">' + esc(p[0]) + ' · v' + esc(d.versiq) + '</span></span></div>' +
      '<h1 class="sum-d">' + esc(dayTitle(d.data)) + '</h1>' +
      '<div class="sum-main"><div class="hora"><span class="hora-n">' + (d.hora == null ? '—' : esc(d.hora)) + '</span><span class="hora-l">👷 души<br>на обекта</span></div>' +
      '<p class="rez">' + esc(d.rezyume || 'Няма резюме.') + '</p></div>' +
      '<div class="stats">' + GRUPI.map(function (G) {
        var n = g[G.k].length;
        return '<button type="button" class="stat g-' + G.k + '" data-a="jump" data-g="' + G.k + '" aria-label="' + esc(G.t + ': ' + n) + '"><b>' + n + '</b><span>' + G.sh + '</span>' +
          (G.k !== 'promqna' && n ? '<em>' + (function () { var l = g[G.k].filter(function (t) { return !handled(t); }).length; return l ? 'чакат ' + l : '✓ отговорено'; })() + '</em>' : '') + '</button>';
      }).join('') + '</div>';
    S.sig = sigOf();
  }
  function renderGroups() {
    var el = box('#groups'); if (!el) return;
    if (!S.den) { el.innerHTML = ''; return; }
    var g = groupsOf(), lk = locked();
    el.innerHTML = (lk ? '<p class="lockline">🔒 ' + (S.den.status === 'vpisana' ? 'Денят е вписан' : 'Денят е одобрен') +
        ' — поправка вече не влиза в записа. Ако нещо не е вярно, добави действие от точката („→ Действие“). Решенията можеш да отбележиш „✓ Отговорено“.</p>' : '') +
      GRUPI.map(function (G) {
        var arr = g[G.k];
        return '<section class="grp g-' + G.k + '" id="g-' + G.k + '" aria-label="' + esc(G.t) + '"><div class="grp-h"><h2>' + G.t + '</h2><span class="grp-n">' + arr.length + '</span></div>' +
          '<p class="grp-s">' + G.s + '</p>' + (arr.length ? arr.map(pointCard).join('') : '<p class="grp-e">' + G.e + '</p>') + '</section>';
      }).join('');
    S.sig = sigOf();
  }
  function pointCard(t) {
    var m = mine(t.id), hot = (t.vajnost || 1) >= 3, ist = ISTINA[t.istina] || ISTINA.saobshteno, izv = t.izvori || [];
    var conf = !!m.ok || t.istina === 'provereno', lk = locked(), otgLk = lk && t.grupa === 'reshenie';
    return '<article class="pc' + (hot ? ' hot' : '') + '" data-tid="' + esc(t.id) + '">' +
      '<div class="pc-b"><span class="pc-e" aria-hidden="true">' + emoT(t) + '</span><p class="pc-t">' + esc(t.tekst) + '</p></div>' +
      m.fix.map(function (f) {
        return '<div class="pc-fix"><b>Твоята поправка:</b> ' + esc(f.tekst) + '<span class="pc-fs">' + (f.err ? '⚠️ не се записа — виж лентата горе' : f.pend ? '⏳ чака връзка' : '⏳ ' + esc(f.rez || 'чака Claude')) + '</span></div>';
      }).join('') +
      '<div class="pc-m"><span class="pill ' + ist[1] + '">' + ist[0] + '</span>' +
        (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') +
        (m.ok ? '<span class="pill p-mine">' + (m.ok.pend ? (m.ok.otg ? '⏳ отговорът чака връзка' : '⏳ потвърждение чака връзка') : (m.ok.otg ? '✓ отговорено от теб' : '✓ потвърдено от теб')) + '</span>' : '') +
        (izv.length
          ? '<button type="button" class="srcb" data-a="src" data-tid="' + esc(t.id) + '" aria-label="Източници: ' + izv.length + '">' + izv.map(function (s) { return '<span class="ref">' + esc(s.n) + '</span>'; }).join('') + '<span class="srcb-l">' + (izv.length === 1 ? 'източник' : 'източника') + ' ›</span></button>'
          : '<span class="pill p-warn">няма източник</span>') +
      '</div>' +
      // решение на заключен ден: [✓ Отговорено][→ Действие] — същите бутони като на Таблото, без „Поправи“ [К22]
      (otgLk ? '<div class="pc-a two"><button type="button" class="pa pa-ok" data-a="ok" data-tid="' + esc(t.id) + '"' + (m.ok ? ' disabled aria-pressed="true"' : '') + '>' + (m.ok ? '✓ отговорено' : '✓ Отговорено') + '</button>' :
      lk ? '<div class="pc-a one">' :
      '<div class="pc-a">' +
        '<button type="button" class="pa pa-ok" data-a="ok" data-tid="' + esc(t.id) + '"' + (conf ? ' disabled' : '') + (m.ok ? ' aria-pressed="true"' : '') + '>' + (m.ok ? '✓ потвърдено' : '✓ вярно') + '</button>' +
        '<button type="button" class="pa" data-a="fix" data-tid="' + esc(t.id) + '">Поправи</button>') +
        '<button type="button" class="pa" data-a="act" data-tid="' + esc(t.id) + '">→ Действие</button>' +
      '</div></article>';
  }
  function rerenderCard(tid) {
    var el = document.querySelector('.pc[data-tid="' + tid + '"]'), t = findT(tid), g = $('#groups');
    if (el && t) el.outerHTML = pointCard(t);
    if (g) g._h = null;   // съдържанието вече не е равно на запомненото
  }
  // Пише в контейнера само ако HTML-ът се е сменил — проверката на 20 с не бива да подменя бутон под пръста.
  function box(sel) {
    var n = $(sel); if (!n) return null;
    return {
      node: n,
      set innerHTML(h) { if (n._h !== h) { n.innerHTML = h; n._h = h; } },
      set className(c) { if (n.className !== c) n.className = c; },
      get scrollLeft() { return n.scrollLeft; },
      set scrollLeft(v) { n.scrollLeft = v; }
    };
  }
  function refMap() { var m = {}; S.tochki.forEach(function (t) { (t.izvori || []).forEach(function (s) { if (s && s.n != null && !m[s.n]) m[s.n] = s; }); }); return m; }
  function renderFull() {
    var el = box('#full'); if (!el) return;
    if (!S.den) { el.innerHTML = ''; return; }
    var md = S.den.zapis_md || '', n = (md.match(/^##\s/mg) || []).length;
    el.className = '';
    el.innerHTML = '<details class="full card" id="fullD"' + (S.fullOpen ? ' open' : '') + '><summary><span>📄 Пълен запис' + (n ? ' (' + n + ' раздела)' : '') + '</span><span class="chev" aria-hidden="true">▾</span></summary>' +
      '<div class="md">' + (md.trim() ? md2html(md, refMap()) : '<p class="muted">Черновата още няма пълен запис.</p>') + '</div></details>';
  }

  // Markdown → прост HTML. Всеки ред се ескейпва ПРЕДИ форматирането; добавят се само фиксирани тагове.
  function inl(s, refs) {
    return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(\d{1,3})\]/g, function (m, n) { return refs && refs[n] ? '<button type="button" class="ref" data-a="ref" data-n="' + n + '" aria-label="Източник ' + n + '">' + n + '</button>' : '<span class="ref">' + n + '</span>'; });
  }
  function md2html(md, refs) {
    var out = [], para = [], list = null, table = null;
    function fP() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function fL() { if (list) { out.push('<' + list.t + '>' + list.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    function fT() {
      if (!table) return;
      var rows = table.rows, head = table.sep ? rows.shift() : null;
      out.push('<div class="tw"><table>' + (head ? '<thead><tr>' + head.map(function (c) { return '<th>' + inl(esc(c), refs) + '</th>'; }).join('') + '</tr></thead>' : '') +
        '<tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inl(esc(c), refs) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
      table = null;
    }
    function fA() { fP(); fL(); fT(); }
    String(md || '').replace(/\r\n?/g, '\n').split('\n').forEach(function (raw) {
      var l = raw.replace(/\s+$/, ''), m;
      if (!l.trim()) { fA(); return; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { fA(); var lv = Math.min(5, m[1].length + 1); out.push('<h' + lv + '>' + inl(esc(m[2]), refs) + '</h' + lv + '>'); return; }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        fP(); fL();
        var cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
        if (cells.every(function (c) { return /^:?-{2,}:?$/.test(c); })) { if (table && table.rows.length === 1) table.sep = true; return; }
        if (!table) table = { rows: [], sep: false };
        table.rows.push(cells); return;
      }
      fT();
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { fA(); out.push('<hr>'); return; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { fP(); if (!list || list.t !== 'ul') { fL(); list = { t: 'ul', items: [] }; } list.items.push(inl(esc(m[1]), refs)); return; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { fP(); if (!list || list.t !== 'ol') { fL(); list = { t: 'ol', items: [] }; } list.items.push(inl(esc(m[1]), refs)); return; }
      if ((m = /^>\s?(.*)$/.exec(l))) { fA(); out.push('<blockquote>' + inl(esc(m[1]), refs) + '</blockquote>'); return; }
      fL(); para.push(inl(esc(l), refs));
    });
    fA();
    return out.join('');
  }

  // ---------- одобрение ----------
  function apprState() {
    var d = S.den; if (!d) return { k: 'none' };
    if (d.status === 'vpisana') return { k: 'vpisana' };
    var q = null;
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === d.id) q = it; });
    if (q && q.row.versiq === d.versiq) return { k: 'queued', at: q.at };
    var last = null;
    S.res.forEach(function (r) { if (r.vid === 'odobri') last = r; });
    if (last && last.versiq === d.versiq && !/остаряла/i.test(last.rezultat || '')) return { k: 'pending', at: last.kogda, rez: last.rezultat || '' };
    if (d.status === 'odobrena') return { k: 'pending', at: null, rez: '' };
    return { k: 'none', old: last };
  }
  function renderAppr() {
    var el = box('#appr'); if (!el) return;
    var d = S.den; if (!d) { el.innerHTML = ''; el.className = ''; return; }
    var a = apprState();
    el.className = 'appr-w' + (a.k === 'none' ? ' sticky' : '');
    if (S.newVersiq > d.versiq) {
      el.className = 'appr-w sticky';
      el.innerHTML = '<div class="appr newv"><div class="appr-row"><span class="appr-big">Има нова версия (v ' + esc(S.newVersiq) + ')</span></div>' +
        '<div class="small">Одобрява се само показаната версия — презареди, за да видиш промените.</div>' +
        '<button type="button" class="btn big" data-a="reload">Презареди</button></div>';
      return;
    }
    if (a.k === 'vpisana') {
      var f = String(d.vpisan_pat || '').split(/[\\/]/).pop();
      el.innerHTML = '<div class="appr vp"><div class="appr-row"><span class="appr-big">Вписан ✓</span><span class="pill p-ok">v' + esc(d.versiq) + '</span></div>' +
        '<ol class="steps"><li class="ok">✓ Одобрено</li><li class="ok">✓ Лаптопът</li><li class="ok">✓ Вписан</li></ol>' +
        '<div class="small muted">' + (f ? '📄 ' + esc(f) + ' · OneDrive и копие на компютъра' : 'Записът е в OneDrive и на компютъра.') + '</div></div>';
      return;
    }
    if (a.k === 'pending' || a.k === 'queued') {
      var q = a.k === 'queued';
      el.innerHTML = '<div class="appr"><div class="appr-row"><span class="appr-big">✅ Одобрено' + (a.at ? ' ' + esc(rel(a.at)) : '') + '</span>' +
        '<span class="pill p-warn">⏳ ' + (q ? 'чака връзка' : 'чака лаптопа') + '</span></div>' +
        '<ol class="steps"><li class="' + (q ? 'wait' : 'ok') + '">' + (q ? '⏳ Изпращане' : '✓ Одобрено') + '</li><li class="' + (q ? '' : 'wait') + '">Лаптопът</li><li>Вписан</li></ol>' +
        (/^конфликт/i.test(a.rez || '') ? '<p class="warnline">⚠️ Лаптопът не може да впише деня: ' + esc(String(a.rez).replace(/^конфликт:\s*/i, '')) + '</p>' : '') +
        '<div class="small muted">' + (q ? 'Одобрението е запазено на телефона и тръгва само, щом има покритие.' : 'Лаптопът пише .md и Word в OneDrive, щом е включен. Проверявам на ' + Math.round(POLL_MS / 1000) + ' с.') + '</div>' +
        nextBtn() + '</div>';
      return;
    }
    var left = openCount();
    el.innerHTML = '<div class="appr">' +
      (a.old ? '<div class="small" style="color:var(--warn-ink);font-weight:600;text-align:center">Одобри v' + esc(a.old.versiq) + ', но сега е v' + esc(d.versiq) + ' — одобри отново.</div>' : '') +
      '<button type="button" class="btn big appr-go" data-a="approve"><span>Одобрявам тази версия</span> <span>(v&nbsp;' + esc(d.versiq) + ')</span></button>' +
      '<div class="appr-s">' + (left ? left + (left === 1 ? ' точка чака' : ' точки чакат') + ' твой отговор' : '✅ Всички точки за решение имат отговор') + '</div></div>';
  }
  // „Следващ за одобрение ›“: най-старият чакащ ден на същия обект — дописаните стари дни се минават подред [К31]
  function nextBtn() {
    var cur = S.den ? S.den.id : null;
    var nx = pendingDays(OBEKT_KOD).filter(function (d) { return d.id !== cur; })[0];
    return nx ? '<button type="button" class="btn ghost next-d" data-a="nextDay" data-id="' + esc(nx.id) + '">Следващ за одобрение: ' + esc(lcDay(nx.data)) + ' ›</button>' : '';
  }
  function openApprove() {
    var d = S.den; if (!d) return;
    var left = openCount();
    openSheet('Одобряваш ли деня?',
      '<div class="ap-sum"><span class="ap-d">' + esc(dayTitle(d.data)) + '</span><span class="ap-v">версия ' + esc(d.versiq) + '</span></div>' +
      '<p>Лаптопът ще впише <b>точно тази версия</b>: запис .md и Word в OneDrive + копие на компютъра.</p>' +
      (left ? '<p class="warnline">⏳ ' + left + (left === 1 ? ' точка е' : ' точки са') + ' без твой отговор — влизат в записа със статуса си („съобщено“, „оспорено“).</p>' : '') +
      '<button type="button" class="btn big" data-a="approveGo">Одобрявам v ' + esc(d.versiq) + '</button>' +
      '<button type="button" class="btn ghost" data-a="close">Още не</button>', 'approve');
  }
  // Докато листът „Одобряваш ли…“ е отворен, лаптопът качи нова версия → листът вече не предлага одобрение.
  function openNewVerSheet() {
    openSheet('Има нова версия',
      '<div class="ap-sum newv"><span class="ap-d">' + esc(dayTitle(S.den.data)) + '</span><span class="ap-v">v ' + esc(S.den.versiq) + ' → v ' + esc(S.newVersiq) + '</span></div>' +
      '<p>Докато гледаше, лаптопът качи <b>версия ' + esc(S.newVersiq) + '</b>. Одобрява се само показаната версия — презареди, виж промените и тогава одобри.</p>' +
      '<button type="button" class="btn big" data-a="reload">Презареди</button>' +
      '<button type="button" class="btn ghost" data-a="close">Затвори</button>', 'newv');
  }
  function doApprove(btn) {
    var d = S.den; if (!d) return;
    if (newPending()) { closeSheet(); toast('Има нова версия — презареди и одобри нея.', 'bad'); renderAppr(); return; }
    btn.disabled = true;
    var sec = Math.max(1, Math.round((activeMs() - S.openedAt) / 1000));
    send('resheniq', { den_id: d.id, vid: 'odobri', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() }).then(function (r) {
      send('metriki', { vid: 'odobrenie_sek', stoinost: sec, den_id: d.id }).catch(function () {});
      closeSheet();
      toast(r === 'sent' ? 'Одобрено ' + hhmm() + ' · чака лаптопа' : 'Одобрено · ⏳ чака връзка');
      renderAppr(); renderStrip(); renderGroups(); renderSum(); renderBanners(); renderTabs();   // значката на „Ден“ — веднага
    }, function (e) { btn.disabled = false; toast('Не се записа: ' + errBg(e), 'bad'); });
  }

  // ---------- решения по точка ----------
  // ✓ вярно и Поправи — само по показаната версия на ден, който още не е одобрен.
  function pointGuard() {
    if (newPending()) { toast('Има нова версия — натисни „Презареди“ първо.', 'bad'); return false; }
    if (locked()) { toast('Денят е одобрен — поправка вече не влиза в записа. Използвай „→ Действие“.', 'bad'); return false; }
    return true;
  }
  // „✓ Отговорено“ на решение е разрешено за всеки статус на деня (и вписан) — вписаният запис не се пипа [К22];
  // „✓ вярно“ / „Поправи“ на другите точки — както в Етап 1.
  function okGuard(tid) {
    var t = findT(tid);
    if (t && t.grupa === 'reshenie') { if (newPending()) { toast('Има нова версия — натисни „Презареди“ първо.', 'bad'); return false; } return true; }
    return pointGuard();
  }
  function doConfirm(tid, btn) {
    var t = findT(tid), d = S.den; if (!t || !d) return;
    var otg = t.grupa === 'reshenie' && locked();
    var row = { den_id: d.id, tochka_id: tid, vid: 'potvardi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    if (otg) row.tekst = 'отговорено';
    btn.disabled = true;
    send('resheniq', row, { tt: t.tekst }).then(function (r) {
      if (t.grupa === 'reshenie') noteClose(tid, d.obekt || OBEKT_KOD, d.data, otg, r);   // Таблото я скрива веднага
      toast(otg ? (r === 'sent' ? 'Отговорено ✓' : 'Отговорено · ⏳ чака връзка') : (r === 'sent' ? 'Потвърдено ✓' : 'Потвърдено · ⏳ чака връзка'));
      rerenderCard(tid); renderStrip(); renderSum(); renderAppr(); renderBanners(); renderTabs();
    }, function (e) { btn.disabled = false; toast('Не се записа: ' + errBg(e), 'bad'); });
  }
  function openFix(tid) {
    var t = findT(tid); if (!t) return;
    openSheet('Поправи точката',
      '<p class="sh-q">' + esc(t.tekst) + '</p>' +
      '<label class="fld">Как е правилно?<textarea id="fixT" rows="4" maxlength="1000" autofocus placeholder="напр. кофражистите са 10 — двама още не са в Присъствия"></textarea></label>' +
      '<div class="err" id="fixE" hidden></div>' +
      '<button type="button" class="btn big" data-a="fixSave" data-tid="' + esc(t.id) + '">Изпрати поправката</button>' +
      '<p class="small muted">Поправката отива при Claude — той я вписва в следващата версия на черновата.</p>');
  }
  function saveFix(tid, btn) {
    var t = findT(tid), tx = ($('#fixT') && $('#fixT').value || '').trim();
    if (!t || !S.den) return;
    if (!tx) { var e = $('#fixE'); e.textContent = 'Напиши как е правилно.'; e.hidden = false; $('#fixT').focus(); return; }
    btn.disabled = true;
    var d = S.den;
    send('resheniq', { den_id: d.id, tochka_id: tid, vid: 'popravka', tekst: tx, versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() }, { tt: t.tekst }).then(function (r) {
      if (t.grupa === 'reshenie') noteClose(tid, d.obekt || OBEKT_KOD, d.data, false, r);
      closeSheet(); toast(r === 'sent' ? 'Поправката е изпратена' : 'Поправката · ⏳ чака връзка');
      rerenderCard(tid); renderStrip(); renderSum(); renderAppr(); renderBanners();
    }, function (e) { btn.disabled = false; var el = $('#fixE'); el.textContent = 'Не се записа: ' + errBg(e); el.hidden = false; });
  }
  function srcItem(s) {
    return '<div class="src-i"><span class="ref">' + esc(s.n) + '</span><div><div class="src-t">' + tipEmo(s.tip) + ' <b>' + esc(s.tip || 'източник') + '</b>' +
      (s.vreme ? ' · <span class="mono">' + esc(s.vreme) + '</span>' : '') + '</div><div>' + esc(s.kratko || '') + '</div>' +
      (s.kade ? '<div class="src-k mono">' + esc(s.kade) + '</div>' : '') + '</div></div>';
  }
  var SRC_NOTE = '<p class="small muted">Оригиналите са в OneDrive, в папката на деня. На телефона — описанието и намалени снимки.</p>';
  // източник от Тиймс → под него ред със снимките на съобщението (празният ред изчезва) [§4.5]
  function srcWithPh(s) { var m = srcMsg(s); return srcItem(s) + (m ? '<div class="src-ph" data-msg="' + esc(m) + '"></div>' : ''); }
  function openSrc(tid) {
    var t = findT(tid); if (!t) return;
    openSheet('Източници (' + t.izvori.length + ')', '<p class="sh-q">' + esc(clip(t.tekst, 220)) + '</p>' + t.izvori.map(srcWithPh).join('') + SRC_NOTE);
    srcPhStart(t.den_id, t.izvori);
  }
  function openRef(n) { var s = refMap()[n]; if (!s) return; openSheet('Източник [' + n + ']', srcWithPh(s)); srcPhStart(S.den ? S.den.id : null, [s]); }
  function openFresh() {
    var list = sortSv(S.svezhest);
    openSheet('Свежест на източниците', (list.length ? list.map(function (s) {
      var f = fresh(s), nm = IZ[s.izvor] || [s.izvor, '•'];
      var p = f ? '<span class="pill p-ok">✓ свеж</span>' : '<span class="pill p-warn">⚠️ ' + (s.ok === false ? 'грешка при събиране' : 'застарял') + '</span>';
      return '<div class="fr-i ' + (f ? 'ok' : 'old') + '"><span class="fr-e" aria-hidden="true">' + nm[1] + '</span><div><div><b>' + esc(nm[0]) + '</b> ' + p + '</div>' +
        '<div class="small muted">последно: <span class="mono">' + esc(s.posledno ? dm(s.posledno) : '—') + '</span>' + (s.broi != null ? ' · ' + esc(s.broi) + ' записа' : '') + '</div>' +
        (s.belejka ? '<div class="small">' + esc(s.belejka) + '</div>' : '') + '</div></div>';
    }).join('') : '<p>Лаптопът още не е пратил данни за свежестта на източниците.</p>') +
      '<p class="small muted">„Няма събития“ не е същото като „няма данни“. Ако източник е застарял (кехлибарено), празен раздел в черновата не значи, че нищо не се е случило — Claude го слага в „Непроверено“.</p>');
  }

  // ---------- „+“: действия ----------
  var VID = { za_men: ['📌', 'За мен'], vazlozhi: ['👷', 'Възложи'], napomni: ['🔔', 'Напомни ми'], sreshta: ['📅', 'Среща'] };
  var VID_SUB = { za_men: 'задача за теб', vazlozhi: 'на човек от екипа', napomni: 'в точен ден и час', sreshta: 'с кого, къде, кога' };
  var FORM = {
    za_men: { t: 'Какво трябва да направиш', ch: null, mq: false, srok: false },
    vazlozhi: { t: 'Какво да се направи', ch: 'На кого', chReq: 'Напиши на кого възлагаш.', mq: false, srok: false },
    napomni: { t: 'За какво да ти напомня', ch: null, mq: false, srok: true },
    sreshta: { t: 'Тема на срещата', ch: 'С кого', chReq: 'Напиши с кого е срещата.', mq: true, srok: true }
  };
  // ctx — от Таблото/Действия: {src, tid, den_id, tekst, o, d, close}; без ctx — от Ден (точка от S.tochki или бутона „+“)
  function openPlus(tid, ctx) {
    var t = !ctx && tid ? findT(tid) : null, tx = ctx ? (ctx.tekst || '') : t ? t.tekst : '';
    P = { tid: ctx ? (ctx.tid || null) : (t ? t.id : null), tekst: tx ? clip(tx, 300) : '', t0: activeMs(), vid: null, srok: undefined, chips: [], ctx: ctx || null };
    renderPlusChooser();
  }
  function renderPlusChooser() {
    if (!P) return;
    P.srok = undefined;
    openSheet('Ново действие', (P.tid ? '<p class="sh-q">От точка: ' + esc(clip(P.tekst, 160)) + '</p>' : '') +
      '<div class="choose">' + ['za_men', 'vazlozhi', 'napomni', 'sreshta'].map(function (k) {
        return '<button type="button" class="ch4 v-' + k + '" data-a="pick" data-v="' + k + '"><span class="ch4-e" aria-hidden="true">' + VID[k][0] + '</span><b>' + VID[k][1] + '</b><span>' + VID_SUB[k] + '</span></button>';
      }).join('') + '</div>' +
      '<p class="small muted">Действията тръгват веднага — не чакат одобрението на деня.</p>');
  }
  function at(d, h, m) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m || 0, 0, 0); }
  function srokChips() {
    var n = now(), out = [];
    if (n.getHours() < 16) out.push(['Днес 17:00', at(n, 17)]);
    var t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    out.push(['Утре 08:00', at(t, 8)], ['Утре 17:00', at(t, 17)]);
    var mo = new Date(t); while (mo.getDay() !== 1) mo.setDate(mo.getDate() + 1);
    var wk = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 7);
    // в неделя „понеделник“ е „утре“, в понеделник — същото като „след седмица“ → без двоен бутон
    if (!sameDay(mo, t) && !sameDay(mo, wk)) out.push(['Понеделник 08:00', at(mo, 8)]);
    out.push(['След седмица', at(wk, 8)]);
    return out;
  }
  function renderPlusForm() {
    if (!P || !FORM[P.vid]) return;
    var v = P.vid, F = FORM[v];
    P.chips = srokChips();
    if (P.srok === undefined) P.srok = F.srok ? P.chips.filter(function (c) { return c[0] === 'Утре 08:00'; })[0][1] : null;
    openSheet(VID[v][0] + ' ' + VID[v][1],
      '<button type="button" class="back" data-a="plusBack">← Друг вид</button>' +
      '<label class="fld">' + F.t + '<textarea id="pfT" rows="3" maxlength="1000"' + (P.tekst ? '' : ' autofocus') + '>' + esc(P.tekst) + '</textarea></label>' +
      (F.ch ? '<label class="fld">' + F.ch + '<input id="pfC" type="text" autocomplete="off" maxlength="120" placeholder="' + (v === 'sreshta' ? 'напр. строителния надзор' : 'напр. ТР на обекта') + '"></label>' : '') +
      (F.mq ? '<label class="fld">Къде (по избор)<input id="pfM" type="text" autocomplete="off" maxlength="160" placeholder="напр. обекта, сграда 2"></label>' : '') +
      '<div class="fld" role="group" aria-label="Срок">' + (F.srok ? 'Кога' : 'Срок (по избор)') +
        '<div class="chips">' + P.chips.map(function (c, i) { return '<button type="button" class="chip" data-a="srok" data-i="' + i + '" aria-pressed="false">' + c[0] + '</button>'; }).join('') +
        (F.srok ? '' : '<button type="button" class="chip" data-a="srok" data-i="none" aria-pressed="false">Без срок</button>') + '</div>' +
        '<div class="dt"><input id="pfD" type="date" aria-label="Дата"><input id="pfH" type="time" aria-label="Час" step="300"></div></div>' +
      '<div class="confirm" id="pfX" aria-live="polite"></div>' +
      '<div class="err" id="pfE" hidden></div>' +
      '<button type="button" class="btn big" data-a="plusSave" id="pfS">Запиши</button>');
    var ta = $('#pfT'); ta.addEventListener('input', function () { P.tekst = ta.value; });
    $('#pfD').addEventListener('input', fromInputs); $('#pfH').addEventListener('input', fromInputs);
    $('#pfD').addEventListener('change', fromInputs); $('#pfH').addEventListener('change', fromInputs);
    syncSrok(true);
  }
  function fromInputs() {
    var dv = $('#pfD').value, hv = $('#pfH').value;
    if (!dv) { P.srok = null; syncSrok(false); return; }
    if (!hv) { hv = '08:00'; $('#pfH').value = hv; }
    var a = dv.split('-'), b = hv.split(':');
    P.srok = new Date(+a[0], +a[1] - 1, +a[2], +b[0], +b[1], 0, 0);
    syncSrok(false);
  }
  function pickSrok(el) {
    var i = el.getAttribute('data-i');
    P.srok = i === 'none' ? null : P.chips[+i][1];
    syncSrok(true);
  }
  function syncSrok(setInputs) {
    var s = P.srok, F = FORM[P.vid], ee = $('#pfE');
    if (ee) ee.hidden = true;
    if (setInputs) { $('#pfD').value = s ? ymd(s) : ''; $('#pfH').value = s ? hhmm(s) : ''; }
    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-a="srok"]'), function (c) {
      var i = c.getAttribute('data-i');
      c.setAttribute('aria-pressed', String(i === 'none' ? !s : !!(s && P.chips[+i] && P.chips[+i][1].getTime() === s.getTime())));
    });
    var x = $('#pfX'), b = $('#pfS');
    if (s) {
      var past = s.getTime() < nowMs() - 60000;
      x.className = 'confirm' + (past ? ' past' : '');
      x.innerHTML = (past ? '⚠️ Тази дата е минала:' : (F.srok ? '📅 Кога — точно:' : '📅 Срок — точно:')) + '<b>' + esc(cap(exact(s))) + '</b>';
      b.textContent = 'Запиши · ' + exactShort(s);
    } else {
      x.className = 'confirm none';
      x.innerHTML = F.srok ? 'Избери ден и час.' : 'Без срок.';
      b.textContent = 'Запиши';
    }
  }
  function savePlus(btn) {
    if (!P || !FORM[P.vid]) return;
    var F = FORM[P.vid], tx = ($('#pfT').value || '').trim(), c = $('#pfC') ? $('#pfC').value.trim() : '', m = $('#pfM') ? $('#pfM').value.trim() : '';
    var err = !tx ? 'Напиши какво.' : (F.chReq && !c) ? F.chReq : (F.srok && !P.srok) ? 'Избери ден и час.' : (P.srok && P.srok.getTime() < nowMs() - 60000) ? 'Срокът е в миналото — избери друга дата.' : '';
    var ee = $('#pfE');
    if (err) { ee.textContent = err; ee.hidden = false; return; }
    ee.hidden = true; btn.disabled = true;
    var ctx = P.ctx, dn = S.den;
    // от Таблото/Действия денят е празен, освен при точка; обектът на „+“ от Таблото — в етикета „ · ag/soft“ [К28]
    var izv = !ctx ? (P.tid ? 'телефон · от точка' : 'телефон · бутон +')
      : ctx.src === 'tablo' ? (ctx.tid ? 'телефон · табло · от точка' : 'телефон · табло · бутон +' + (ctx.o === 'ag' || ctx.o === 'soft' ? ' · ' + ctx.o : ''))
      : 'телефон · действия · бутон +';
    var row = { den_id: ctx ? (ctx.den_id != null ? ctx.den_id : null) : (dn ? dn.id : null), tochka_id: P.tid || null, vid: P.vid, tekst: tx, chovek: c || null, mqsto: m || null,
      srok: P.srok ? P.srok.toISOString() : null, izvor: izv };
    var sec = Math.max(1, Math.round((activeMs() - P.t0) / 1000)), tp = !ctx && P.tid ? findT(P.tid) : null;
    send('deistviq', row).then(function (r) {
      send('metriki', { vid: 'deistvie_sek', stoinost: sec, den_id: row.den_id }).catch(function () {});
      // решение с действие е „отговорено“ — картата на Таблото изчезва [К23]
      if (ctx && ctx.src === 'tablo') { tMeasure(); if (ctx.close && ctx.tid) noteClose(ctx.tid, ctx.o, ctx.d, false, r); }
      else if (tp && tp.grupa === 'reshenie' && dn) noteClose(tp.id, dn.obekt || OBEKT_KOD, dn.data, false, r);
      P = null; closeSheet();
      toast(r === 'sent' ? 'Записано' : 'Записано · ⏳ чака връзка');
      if (view === 'tablo') { renderOpen(true); refillOpen(); }
      renderCurrent();
    }, function (e) { btn.disabled = false; ee.textContent = 'Не се записа: ' + errBg(e); ee.hidden = false; });
  }
  // „Моите действия“ под деня: само действията на ТОЗИ ден + ред към таб „Действия“ [К10]
  function renderActs() {
    var el = box('#acts'); if (!el) return;
    var id = S.den ? S.den.id : null;
    var qa = queue().filter(function (it) { return it.tbl === 'deistviq'; });
    var q = qa.filter(function (it) { return id != null && it.row.den_id === id; }).map(function (it) { return Object.assign({ _pend: true, _err: it.err || '', sazdadeno: it.at, id: 'q' + it.qid }, it.row); }).reverse();
    var list = q.concat(id == null ? [] : S.deistviq.filter(function (a) { return a.den_id === id; })), total = qa.length + S.deistviq.length;
    el.innerHTML = '<div class="acts-h"><h2>Моите действия</h2><span class="grp-n" style="--c:var(--mine)">' + list.length + '</span><span class="small muted">към този ден</span></div>' +
      (list.length ? '<ul class="acts">' + list.map(function (a) { return actRow(a); }).join('') + '</ul>'
        : '<p class="grp-e">' + (id != null ? 'Няма действия към този ден.' : 'Още няма.') + ' Натисни „+“ — действията не чакат одобрението на деня.</p>') +
      '<button type="button" class="btn ghost acts-more" data-a="allActs2">Всички действия (' + total + ') ›</button>';
  }
  // obj: в таб „Действия“ — чип на обекта (+ дата, ако денят е известен); 'soon' — кехлибарен ръб
  function actRow(a, obj) {
    var v = VID[a.vid] || ['•', a.vid];
    var st = a._err ? ['⚠️ не се записа', 'p-bad'] : a._pend ? ['⏳ чака връзка', 'p-warn'] : a.status === 'izpalneno' ? ['✅ изпълнено', 'p-ok'] : a.status === 'greshka' ? ['грешка', 'p-bad'] : ['⏳ заявено', 'p-neutral'];
    var meta = [v[1], a.chovek, a.mqsto, a.srok ? exactShort(new Date(a.srok)) : ''].filter(Boolean).map(esc).join(' · ');
    return '<li class="act' + (a._pend ? ' pend' : '') + (obj === 'soon' ? ' soon' : '') + '"><span class="act-e" aria-hidden="true">' + v[0] + '</span><div class="act-b"><div class="act-t">' + esc(a.tekst) + '</div>' +
      '<div class="act-m">' + (obj ? actObj(a) : '') + '<span class="pill ' + st[1] + '">' + st[0] + '</span>' + meta + '</div></div></li>';
  }

  // ---------- ленти горе, листове, тостове ----------
  function renderBanners() {
    var el = $('#banners'); if (!el) return;
    var h = '', live = view === 'day' || view === 'tablo' || view === 'deistviq';
    if (view === 'day' && S.den && S.newVersiq > S.den.versiq) h += '<div class="bn bn-new"><span>Има нова версия (v ' + esc(S.newVersiq) + ')</span><button type="button" class="bn-b" data-a="reload">Презареди</button></div>';
    if ((S.offline || S.forceOff) && live) {
      var at = view === 'tablo' ? TB.at : view === 'day' ? S.dataAt : (S.actsAt || TB.at);
      var old = !at || nowMs() - Date.parse(at) > 12 * 36e5;   // Таблото/Действия: кехлибарено чак когато запазеното е > 12 ч
      h += '<div class="bn bn-off' + (view !== 'day' && !old ? ' calm' : '') + '">📴 без покритие · данни към ' + esc(at ? rel(at) : '—') + '</div>';
    }
    var n = pendingCount();
    if (n && live) h += '<div class="bn bn-q">⏳ ' + (n === 1 ? '1 чака връзка — тръгва само, щом има покритие' : n + ' чакат връзка — тръгват сами, щом има покритие') + '</div>';
    var ne = errQ().length;
    if (ne && live) h += '<button type="button" class="bn bn-err" data-a="qerr">⚠️ ' + (ne === 1 ? '1 запис не се записа' : ne + ' записа не се записаха') + ' — виж и реши</button>';
    if (el._h !== h) { el.innerHTML = h; el._h = h; }
  }
  // Записи, които базата отказа: текстът на РП стои тук, докато той не реши — „Опитай пак“ или „Махни“.
  var QVID = { odobri: 'Одобрение на деня', potvardi: 'Потвърждение', popravka: 'Поправка', osporva: 'Оспорване', komentar: 'Коментар' };
  function openErrSheet() {
    var list = errQ();
    if (!list.length) { closeSheet(); return; }
    openSheet('Не се записаха (' + list.length + ')', list.map(function (it) {
      var kind = it.tbl === 'deistviq' ? 'Действие · ' + ((VID[it.row.vid] || ['', it.row.vid])[1]) : (QVID[it.row.vid] || it.row.vid);
      return '<div class="qerr-i"><div><b>' + esc(kind) + '</b> <span class="small muted">· ' + esc(dm(it.at)) + '</span></div>' +
        (it.tt ? '<div class="sh-q">Точка: ' + esc(clip(it.tt, 220)) + '</div>' : '') +
        (it.row.tekst ? '<div class="qerr-t">' + esc(it.row.tekst) + '</div>' : '') +
        '<div class="err">Защо: ' + esc(it.err) + '</div>' +
        '<div class="qerr-b"><button type="button" class="btn" data-a="qretry" data-q="' + esc(it.qid) + '">Опитай пак</button>' +
        '<button type="button" class="btn ghost" data-a="qdrop" data-q="' + esc(it.qid) + '">Махни от телефона</button></div></div>';
    }).join('') + '<p class="small muted">Текстът ти остава тук, докато не решиш. Преди „Махни“ можеш да го копираш.</p>', 'qerr');
  }
  function qRetry(qid) {
    setQueue(queue().map(function (x) { return x.qid === qid ? Object.assign({}, x, { err: '', code: '' }) : x; }));
    renderBanners();
    flush().then(function () { if (sheetKind === 'qerr') openErrSheet(); renderCurrent(); });
  }
  // „Махни от телефона“: записът не отива никъде → точката пак е отворена и на Таблото
  function qDrop(qid) {
    var it = findQ(qid), tid = it && it.row ? it.row.tochka_id : null;
    if (tid != null && TB.closed[tid] && closingRow(it.tbl, it.row)) { delete TB.closed[tid]; saveTablo(); }
    dropQ(qid); renderBanners(); renderCurrent(); openErrSheet();
  }
  var sheetEl = null, sheetPrev = null, sheetKind = '';
  function openSheet(title, body, kind) {
    var had = !!sheetEl;
    sheetKind = kind || '';
    if (sheetEl) { sheetEl.remove(); sheetEl = null; }
    if (!had) sheetPrev = document.activeElement;
    var sc = document.createElement('div');
    sc.className = 'scrim'; sc.setAttribute('data-a', 'scrim');
    // „Затвори“ и в дъното на листа — горното „×“ е извън обсега на палеца (без листовете с текст за запис)
    if (!/data-a="(close|plusSave|fixSave)"/.test(body)) body +='<button type="button" class="btn ghost sh-end" data-a="close">Затвори</button>';
    sc.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" tabindex="-1"><div class="sh-h"><h2 id="shT">' + esc(title) + '</h2>' +
      '<button type="button" class="sh-x" data-a="close" aria-label="Затвори">×</button></div><div class="sh-b">' + body + '</div></div>';
    if (had) sc.style.animation = 'none';
    document.body.appendChild(sc); document.body.classList.add('noscroll'); sheetEl = sc;
    var sh = sc.firstChild;
    if (had) sh.style.animation = 'none';
    setTimeout(function () { var f = sh.querySelector('[autofocus]'); try { (f || sh).focus({ preventScroll: true }); } catch (e) {} }, 40);
  }
  function closeSheet() {
    if (!sheetEl) return;
    sheetEl.remove(); sheetEl = null; sheetKind = ''; SP = null;
    if (!PV) document.body.classList.remove('noscroll');   // прегледът и листът се пазят взаимно [К28]
    if (sheetPrev && document.contains(sheetPrev) && sheetPrev.focus) { try { sheetPrev.focus({ preventScroll: true }); } catch (e) {} }
    sheetPrev = null;
  }
  function toast(msg, kind) {
    var box = $('#toasts'); if (!box) return;
    var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 2800);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }
  // Под лепкавата горна част (заглавие + ленти „без покритие“, „чака връзка“…) — отместването е истинската ѝ височина.
  function jump(g) {
    var el = document.getElementById('g-' + g) || document.getElementById(g); if (!el) return;
    var tw = document.querySelector('.topwrap'), off = (tw ? tw.getBoundingClientRect().height : 0) + 10;
    var y = el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - off;
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, y), behavior: calm ? 'auto' : 'smooth' });
  }

  // ---------- снимки (Етап 3) ----------
  // Намалените копия (голяма + миниатюра, без EXIF) са в частната кофа „snimki“; телефонът само чете, с подписани адреси
  // (1 ч, само в паметта). В localStorage и в кеша на Ден/Табло стоят само пътищата. Без таблицата snimki (преди
  // 004_etap3.sql) или без функцията snimki_tablo — тихо: „няма качени снимки“ в Ден, Таблото е без ленти.
  var PH_COLS = 'id,den_id,obekt,data,msg_id,izvor_vid,izvor,avtor,vreme,n,pat,pat_mini,shirina,visochina,opisanie';
  var PH_KEEP = PH_COLS.split(',').filter(function (k) { return k !== 'opisanie'; });   // кешът на Ден — без описанието
  var PH_TB = 'id,msg_id,vreme,n,pat_mini,shirina,visochina'.split(',');                 // лентите на Таблото (и кешът им)
  var PH_PORC = 24, PH_C1_MS = 120000;
  var PH = { tok: 0, den: null, list: null, at: 0, err: null, net: false, shown: PH_PORC };   // снимките на отворения Ден
  var PHM = {}, PHM_K = [];                  // списъци по ден за прегледа от Таблото (само в паметта, до 12 дни)
  var SG = { m: {}, pend: {}, failAt: {}, bad: {}, offBad: {}, retried: {} };   // подписани адреси: pat → {u, exp}
  var SGQ = { set: {}, t: 0 };
  var DEMO_SEEN = {};                        // демо „без покритие“: показаните картинки остават [§4.9]
  var SP = null, spTok = 0;                  // снимките в листа „Източници“
  var PV = null, pvTok = 0;                  // прегледът на цял екран

  // ид на съобщението от източник на точка (само Тиймс; мейлите и Файлове/… — не)
  function srcMsg(s) { var m = s && s.kade ? /Оригинали[\/\\]\d{6}_(\d{10,})_/.exec(String(s.kade)) : null; return m ? m[1] : null; }
  function normPh(r) { r.shirina = +r.shirina || 0; r.visochina = +r.visochina || 0; r.n = +r.n || 1; if (r.msg_id != null) r.msg_id = String(r.msg_id); return r; }
  function phRows(list) { return (list || []).slice(0, 120).map(function (r) { var o = {}; PH_KEEP.forEach(function (k) { o[k] = r[k]; }); return o; }); }
  function phSort(a, b) { return (a.vreme < b.vreme ? -1 : a.vreme > b.vreme ? 1 : 0) || a.n - b.n || a.id - b.id; }
  function phCur() { return S.den && PH.den === S.den.id ? PH.list : null; }
  function phListFor(den) { return PH.den === den && PH.list ? PH.list : (PHM[den] || null); }
  function phMem(den, list) { if (!PHM[den]) { PHM_K.push(den); if (PHM_K.length > 12) delete PHM[PHM_K.shift()]; } PHM[den] = list; }
  function phIdx(list, sid) { for (var i = 0; i < list.length; i++) if (list[i].id === sid) return i; return 0; }
  function phTime(r) { var d = new Date(r && r.vreme); return isNaN(d) ? '' : hhmm(d); }
  function phLbl(i, n, r) { return 'Снимка ' + (i + 1) + ' от ' + n + [phTime(r), r.avtor].filter(Boolean).map(function (x) { return ' · ' + x; }).join(''); }
  function dayCtx(d) { d = d || S.den; return d ? lcDay(d.data) + ' · ' + (OBEKT[d.obekt || OBEKT_KOD] || OBEKT.ag)[0] : ''; }
  // размерите на картинката при дълга страна L (без уголемяване) — за width/height, за да няма скачане
  function phDims(r, L) { var w = +r.shirina || 4, h = +r.visochina || 3, k = Math.min(1, L / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }
  function phMissing(e) { return isMissing(e) || !!(e && e.code === 'PGRST202'); }

  // --- подписани адреси (обща част) ---
  function sgOk(p, ms) { var x = SG.m[p]; return !!(x && x.exp - Date.now() > (ms == null ? 3e5 : ms)); }
  // Без покритие: миниатюрата от кеша на sw.js (ключът е адресът без ?token) [§4.3]
  function offUrl(pat) { return String(CFG.url || '').replace(/\/+$/, '') + '/storage/v1/object/sign/snimki/' + pat + '?token=off'; }
  // Адресът за <img> — само от паметта; нищо не се кърпи в DOM след box() [К23]:
  // низ = адрес · '' = още без адрес (сив фон; подписва се и се рисува пак) · null = сива плочка с 📷
  function srcFor(pat) {
    if (!pat) return null;
    if (DEMO) return offNow() && !DEMO_SEEN[pat] ? null : demoUrl(pat);
    if (SG.bad[pat]) return null;
    if (sgOk(pat)) return SG.m[pat].u;
    var fa = SG.failAt[pat];
    if (offNow() || (fa && Date.now() - fa < 60000) || !db || !user) return SG.offBad[pat] || !/\/mini\//.test(pat) ? null : offUrl(pat);
    sgNeed(pat);
    return '';
  }
  function sgNeed(pat) {
    if (SG.pend[pat] || SGQ.set[pat]) return;
    SGQ.set[pat] = 1;
    if (!SGQ.t) SGQ.t = setTimeout(sgFlush, 0);
  }
  function sgFlush() {
    var ps = Object.keys(SGQ.set); SGQ.set = {}; SGQ.t = 0;
    if (ps.length) sign(ps).then(phRepaint, phRepaint);
  }
  // createSignedUrls не приема abortSignal → таван 12 с [К25]
  function race12(p) {
    return new Promise(function (ok, no) {
      var t = setTimeout(function () { no({ message: 'timeout: подписът не дойде за 12 с', code: '' }); }, 12000);
      Promise.resolve(p).then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); no(e); });
    });
  }
  // sign(paths) → {pat: адрес}: без повторения; от паметта, ако остават > 5 мин; останалите на порции ≤ 50 (С4)
  function sign(paths) {
    var t0 = Date.now(), out = {}, need = [], seen = {};
    (paths || []).forEach(function (p) {
      if (!p || seen[p]) return; seen[p] = 1;
      if (sgOk(p)) out[p] = SG.m[p].u; else need.push(p);
    });
    if (!need.length) return Promise.resolve(out);
    if (DEMO) { need.forEach(function (p) { var u = demoUrl(p); if (u) out[p] = u; }); return Promise.resolve(out); }
    if (!db || !user) { need.forEach(function (p) { SG.failAt[p] = t0; }); return Promise.reject({ message: 'Няма връзка с облака', code: '' }); }
    need.forEach(function (p) { SG.pend[p] = 1; });
    var parts = [];
    for (var i = 0; i < need.length; i += 50) parts.push(need.slice(i, i + 50));
    return Promise.all(parts.map(function (ch) {
      var q;
      try { q = db.storage.from('snimki').createSignedUrls(ch, 3600); } catch (e) { q = Promise.reject(e); }
      return race12(q).then(function (r) {
        if (!r || r.error) throw (r && r.error) || { message: 'подписът не дойде', code: '' };
        var got = {};
        (r.data || []).forEach(function (d, j) {
          var p = d && (d.path || ch[j]); if (!p) return;
          got[p] = 1;
          if (d.error || !d.signedUrl) { SG.bad[p] = 1; return; }   // напр. липсващ файл → сива плочка само за него [К25]
          SG.m[p] = { u: d.signedUrl, exp: t0 + 3600e3 }; out[p] = d.signedUrl;
          delete SG.failAt[p]; delete SG.offBad[p];
        });
        ch.forEach(function (p) { delete SG.pend[p]; if (!got[p]) SG.bad[p] = 1; });
      }, function (e) {
        ch.forEach(function (p) { delete SG.pend[p]; SG.failAt[p] = Date.now(); });
        throw e;
      });
    })).then(function () { return out; });
  }
  // Картинка с грешка: без покритие → сива; изтекъл адрес → еднократно ново подписване; втори неуспех → сива [§4.2]
  // Без покритие се забравя и адресът: иначе при върнато покритие srcFor() дава СЪЩИЯ адрес, HTML-ът не се сменя,
  // box() не пише и плочката остава сива до изтичането на подписа. Така: сива сега → нов подпис и нова <img> после.
  function phImgErr(im) {
    var pat = im.getAttribute('data-p'), src = im.getAttribute('src'), b = im.closest ? im.closest('.ph-t') : null;
    if (!pat || !src) return;
    if (b) b.classList.add('ph-x');
    if (DEMO) return;
    if (/[?&]token=off$/.test(src) || offNow()) { SG.offBad[pat] = 1; delete SG.m[pat]; return; }
    if (!SG.retried[pat]) { SG.retried[pat] = 1; delete SG.m[pat]; sign([pat]).then(phRepaint, phRepaint); return; }
    SG.bad[pat] = 1;
  }
  // След подпис / смяна на покритието: всичко, което показва снимки, се рисува наново (box() пише само разликата)
  // Потокът — и при отложен TB.defer.feed: отложено е само feedReset(); renderFeed() рисува СЪЩИЯ поток, сменят се
  // само адресите в лентите (64 px, нищо не се мести [К11]). Иначе новите порции остават със сиви ленти.
  function phRepaint() {
    if (view === 'day') keepY(['#ph'], renderPh);
    else if (view === 'tablo' && TB.built) renderFeed();
    srcPhFill();
    if (PV) pvPaint();
  }
  // Без скачане под палеца: секция над видимото смени височината → екранът се мести със същото (като [К11] от Етап 2).
  // #ph е с content-visibility:auto — извън екрана браузърът пази старата височина и би „скочил“ чак при връщане нагоре
  // (Safari няма scroll anchoring) → за мерането секцията се рисува истински, после пак auto (помни новата височина).
  function keepY(sels, fn) {
    var b = sels.map(function (s) {
      var n = $(s); if (!n) return null;
      var r = n.getBoundingClientRect(); if (r.top >= 0) return null;
      n.style.contentVisibility = 'visible';
      return { n: n, h: r.height };
    });
    fn();
    var dy = 0;
    b.forEach(function (x) { if (x) dy += x.n.getBoundingClientRect().height - x.h; });
    if (dy) window.scrollBy(0, dy);
    b.forEach(function (x) { if (x) rafX(function () { rafX(function () { x.n.style.contentVisibility = ''; }); }); });
  }
  function phImg(pat, r, low) {
    var u = srcFor(pat), d = phDims(r, 360);
    return { x: u === null, h: '<img alt="" loading="lazy" decoding="async" crossorigin="anonymous"' + (low ? ' fetchpriority="low"' : '') +
      ' width="' + d[0] + '" height="' + d[1] + '" data-p="' + esc(pat) + '"' + (u ? ' src="' + esc(u) + '"' : '') + '>' };
  }

  // --- Ден: С1 и секция „📷 Снимки“ ---
  function phCached(id) {
    var c = sget(dayKey(), null), d = c && c.obekt === OBEKT_KOD && c.days ? c.days[id] : null;
    return d && Array.isArray(d.snimki) ? d.snimki.map(normPh) : null;
  }
  function phPick(id, list) { PH.den = id; PH.list = list || PHM[id] || null; PH.shown = PH_PORC; PH.err = null; PH.net = false; PH.tok++; }
  // С1: при отваряне на деня, „обнови“, нова версия, връщане на покритието и след > 2 мин извън приложението [К30]
  function phLoad(id) {
    if (!id || !api) return;
    if (PH.den !== id) phPick(id, phCached(id));
    if (offNow()) { PH.net = true; return; }
    var tok = ++PH.tok;
    PH.at = Date.now();
    api.snimki(id).then(function (rows) {
      if (tok !== PH.tok || PH.den !== id) return;   // отговор за стар ден — изхвърля се
      PH.list = (rows || []).map(normPh); PH.err = null; PH.net = false;
      phMem(id, PH.list);
      // отворен лист „Източници“ на този ден, напълнен от кеша на телефона, поема прясната С1
      if (SP && +SP.den === +id) { SP.rows = phByMsg(PH.list, SP.msgs); SP.err = null; srcPhFill(); }
      phSaveCache(id);
      phSignDay();
      phShow();
    }, function (e) {
      if (tok !== PH.tok || PH.den !== id) return;
      if (phMissing(e)) { PH.list = []; PH.err = null; }   // таблицата още я няма → тихо „няма снимки“
      else if (isNet(e) || isAuth(e)) PH.net = true;
      else PH.err = e;
      phShow();
    });
  }
  function phShow() {
    if (view !== 'day' || !S.den || S.den.id !== PH.den) return;
    keepY(['#sum', '#ph'], function () { renderSum(); renderPh(); });
  }
  function phSaveCache(id) {
    var c = sget(dayKey(), null); if (!c || c.obekt !== OBEKT_KOD || !c.days || !c.days[id]) return;   // денят още не е в кеша → saveCache() ще го вземе
    c.days[id].snimki = phRows(PH.list);
    phSetCache(c);
  }
  // Един подпис за миниатюрите на ЦЕЛИЯ ден (≤ 50 на порция) — „Още снимки“ не чака мрежа [К24]
  function phSignDay() {
    var l = phCur() || (PH.den ? PH.list : null);
    if (DEMO || !l || !l.length || offNow()) return;
    sign(l.map(function (r) { return r.pat_mini; })).then(phRepaint, phRepaint);
  }
  function renderPh() {
    var el = box('#ph'); if (!el) return;
    if (!S.den) { el.innerHTML = ''; return; }
    if (PH.den !== S.den.id) phLoad(S.den.id);
    var list = PH.list, h = '<div class="grp-h"><h2>📷 Снимки';
    if (!list) {
      h += '</h2></div>';
      if (PH.err) h += '<div class="err">Снимките не се заредиха: ' + esc(errBg(PH.err)) + '</div><button type="button" class="btn ghost" data-a="phRetry">Опитай пак</button>';
      else if (PH.net || offNow()) h += '<p class="grp-e">📴 Снимките — когато има покритие.</p>';
      else h += '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> зареждам…</p>';
      el.innerHTML = h;
      return;
    }
    if (!list.length) { el.innerHTML = '<p class="grp-e">📷 Няма качени снимки за този ден.</p>'; return; }
    var n = list.length, msgs = {}, nm = 0, first = {}, show = Math.min(n, PH.shown), fail = false;
    list.forEach(function (r) { if (!msgs[r.msg_id]) { msgs[r.msg_id] = 1; nm++; } });
    h += ' (' + n + ')</h2></div><p class="grp-s">от Тиймс · ' + n + ' ' + pl(n, 'снимка', 'снимки') + ' в ' + nm + ' ' + pl(nm, 'съобщение', 'съобщения') + '</p><div class="ph-g">';
    list.slice(0, show).forEach(function (r, i) {
      var im = phImg(r.pat_mini, r), tm = phTime(r), fst = !first[r.msg_id];
      first[r.msg_id] = 1;
      if (!DEMO && SG.failAt[r.pat_mini] && !sgOk(r.pat_mini)) fail = true;
      h += '<button type="button" class="ph-t' + (im.x ? ' ph-x' : '') + '" data-a="ph" data-i="' + i + '" aria-label="' + esc(phLbl(i, n, r)) + '">' + im.h +
        (fst && tm ? '<span class="ph-h" aria-hidden="true">' + esc(tm) + '</span>' : '') + '</button>';   // часът — на първата плочка от всяко съобщение
    });
    h += '</div>';
    if (show < n) {
      var rest = n - show, add = Math.min(PH_PORC, rest);
      h += '<button type="button" class="btn ghost ph-more" data-a="phMore">Още снимки (+' + add + (rest > add ? ' · остават ' + (rest - add) : '') + ') ▾</button>';
    }
    if (fail && !offNow()) h += '<div class="ph-err"><span>⚠️ Снимките не се заредиха докрай.</span><button type="button" class="btn ghost" data-a="phRetry">Опитай пак</button></div>';
    el.innerHTML = h;
  }
  function phMore() { PH.shown += PH_PORC; renderPh(); }   // адресите са подписани при отваряне на деня → без заявка
  function phRetry() {
    if (!S.den) return;
    if (!PH.list || PH.err || PH.den !== S.den.id) { PH.err = null; PH.net = false; phLoad(S.den.id); renderPh(); return; }
    PH.list.forEach(function (r) { delete SG.failAt[r.pat_mini]; delete SG.bad[r.pat_mini]; delete SG.offBad[r.pat_mini]; delete SG.retried[r.pat_mini]; });
    phSignDay(); renderPh();
  }
  function phOpen(i) { var l = phCur(); if (l && l[i]) openViewer(l, i, dayCtx(), { a: 'ph', i: i }); }
  function phReset() {
    PH.tok++; PH.den = null; PH.list = null; PH.at = 0; PH.err = null; PH.net = false; PH.shown = PH_PORC;
    PHM = {}; PHM_K = []; SP = null; DEMO_SEEN = {};
    SG.m = {}; SG.pend = {}; SG.failAt = {}; SG.bad = {}; SG.offBad = {}; SG.retried = {};
    closeViewer(true);
    try { if (window.caches) caches.delete('ailab-snimki-v1').catch(function () {}); } catch (e) {}   // снимки след „Изход“ не остават
  }

  // --- лист „Източници“: снимките на всяко съобщение под източника му [§4.5] ---
  function phByMsg(list, msgs) { var o = {}; msgs.forEach(function (m) { o[m] = []; }); (list || []).forEach(function (r) { if (o[r.msg_id]) o[r.msg_id].push(r); }); return o; }
  function srcPhStart(den, izvori) {
    var msgs = [], lbl = {};
    (izvori || []).forEach(function (s) { var m = srcMsg(s); if (m && !lbl[m]) { msgs.push(m); lbl[m] = 'Източник [' + s.n + ']'; } });
    if (!msgs.length || !sheetEl || den == null) { SP = null; return; }
    var tok = ++spTok, have = phListFor(den);
    SP = { el: sheetEl, den: den, msgs: msgs, lbl: lbl, rows: null, err: null, tok: tok };
    // денят е зареден (С1 е дошла) → филтър по msg_id, без заявка; иначе С2 за всички ида наведнъж
    if (have) { SP.rows = phByMsg(have, msgs); srcPhFill(); return; }
    if (offNow()) { SP.err = 'net'; srcPhFill(); return; }
    srcPhFill();
    api.snimkiMsg(den, msgs).then(function (rows) {
      if (!SP || SP.tok !== tok || SP.el !== sheetEl) return;   // листът вече е друг → изхвърля се
      SP.rows = phByMsg((rows || []).map(normPh), msgs); srcPhFill();
    }, function (e) {
      if (!SP || SP.tok !== tok || SP.el !== sheetEl) return;
      if (phMissing(e)) SP.rows = {}; else SP.err = isNet(e) || isAuth(e) ? 'net' : 'err';
      srcPhFill();
    });
  }
  function srcPhFill() {
    if (!SP) return;
    if (!sheetEl || SP.el !== sheetEl) { SP = null; return; }
    Array.prototype.forEach.call(sheetEl.querySelectorAll('.src-ph[data-msg]'), function (c) {
      var m = c.getAttribute('data-msg'), h = '';
      if (SP.err) h = '<p class="src-phl">' + (SP.err === 'net' ? '📴 Снимките — когато има покритие' : '📷 Снимките не се заредиха') + '</p>';
      else if (!SP.rows) h = '<p class="src-phl"><span class="pulse" aria-hidden="true"></span> 📷 зареждам снимките…</p>';
      else {
        var rs = SP.rows[m] || [], n = rs.length, show = Math.min(n, 6);
        h = rs.slice(0, show).map(function (r, i) {
          var im = phImg(r.pat_mini, r);
          return '<button type="button" class="ph-t ph-s' + (im.x ? ' ph-x' : '') + '" data-a="srcPh" data-msg="' + esc(m) + '" data-i="' + i + '" aria-label="' + esc(phLbl(i, n, r)) + '">' + im.h + '</button>';
        }).join('') + (n > 6 ? '<button type="button" class="ph-t ph-s ph-pl" data-a="srcPh" data-msg="' + esc(m) + '" data-i="6" aria-label="' + esc('Още ' + (n - 6) + ' снимки — отвори прегледа') + '">+' + (n - 6) + '</button>' : '');
      }
      if (c._h !== h) { c.innerHTML = h; c._h = h; }
    });
  }
  function srcPhOpen(m, i) {
    if (!SP || !SP.rows || !SP.rows[m] || !SP.rows[m].length) return;
    openViewer(SP.rows[m], i, SP.lbl[m] || '', { a: 'srcPh', msg: m, i: i });
  }

  // --- Табло: лента под датата в потока „Какво се промени“ [§4.6] ---
  // С3 за порцията → f.ph[den_id] = {broi, items} (само пътища — без адреси; живее върху потока f)
  function phMergeFeed(f, ids, rows) {
    if (!f.ph) f.ph = {};
    if (!Array.isArray(rows)) return;   // грешка или липса на С3 = без снимки
    var by = {};
    rows.forEach(function (r) {
      var p = by[r.den_id] || (by[r.den_id] = { broi: +r.broi || 0, items: [] }), x = {};
      PH_TB.forEach(function (c) { x[c] = r[c]; });
      p.items.push(normPh(x));
    });
    ids.forEach(function (id) { if (by[id]) f.ph[id] = by[id]; else delete f.ph[id]; });
  }
  function fdPh(f, r) {
    var p = f.ph && f.ph[r.id]; if (!p || !p.broi || !p.items || !p.items.length) return '';
    var its = p.items.slice(0, 4), more = p.broi - its.length, nm = SELN[r.obekt] || r.obekt;
    return '<div class="fd-ph o-' + esc(r.obekt) + '" role="group" aria-label="' + esc('Снимки · ' + lcDay(r.data) + ' · ' + nm + ': ' + p.broi) + '">' +
      its.map(function (x, i) {
        var im = phImg(x.pat_mini, x, true);
        return '<button type="button" class="ph-t fd-pt' + (im.x ? ' ph-x' : '') + '" data-a="tPh" data-den="' + esc(r.id) + '" data-sid="' + esc(x.id) + '" aria-label="' +
          esc('Снимка ' + (i + 1) + ' от ' + p.broi + ' · ' + phTime(x) + ' · ' + nm) + '">' + im.h + '</button>';
      }).join('') +
      (more > 0 ? '<button type="button" class="fd-pm" data-a="tPhMore" data-o="' + esc(r.obekt) + '" data-den="' + esc(r.id) + '" aria-label="' + esc('Още ' + more + ' снимки — отвори деня') + '">+' + more + '</button>' : '') +
      '</div>';
  }
  // Плочка от лентата → преглед на целия ден от тази снимка; докато С1 чака — увеличената миниатюра + „Зареждам снимките…“
  function tPhOpen(den, sid) {
    if (!den) return;
    var f = selState(TB.sel).feed, p = f && f.ph ? f.ph[den] : null;
    var row = p ? p.items.filter(function (x) { return x.id === sid; })[0] : null;
    var d = dniById(den) || (f ? f.rows.filter(function (x) { return x.id === den; })[0] : null) || {};
    var ctx = d.data ? lcDay(d.data) + ' · ' + (SELN[d.obekt] || '') : '', from = { a: 'tPh', sid: sid };
    var have = phListFor(den);
    if (have && have.length) { openViewer(have, phIdx(have, sid), ctx, from); return; }
    openViewer(row ? [row] : [], 0, ctx, from, true);
    var tok = PV.tok;
    api.snimki(den).then(function (rows) {
      var list = (rows || []).map(normPh);
      phMem(den, list);
      if (!PV || PV.tok !== tok) return;
      PV.loading = false;
      if (!list.length) { PV.err = 'Няма качени снимки за този ден.'; pvPaint(); return; }
      pvSetList(list, phIdx(list, sid));
    }, function (e) {
      if (!PV || PV.tok !== tok) return;
      PV.loading = false;
      PV.err = isNet(e) || isAuth(e) ? '📴 Снимките — когато има покритие.' : phMissing(e) ? 'Няма качени снимки за този ден.' : 'Снимките не се заредиха: ' + errBg(e);
      pvPaint();
    });
  }

  // --- преглед на цял екран [§4.7] ---
  // Родният свайп (scroll-snap), без библиотека. В DOM — най-много 3 картинки със src (текущата ±1).
  function rafX(fn) { return window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(fn, 16); }
  function openViewer(list, i, ctx, from, loading) {
    closeViewer(true);
    var prev = document.activeElement, el = document.createElement('div');
    el.className = 'pv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="pv-top"><span class="pv-n" aria-hidden="true"></span><span class="pv-ctx">' + esc(ctx || '') + '</span>' +
        '<button type="button" class="pv-cl" data-a="pvClose" aria-label="Затвори">×</button></div>' +
      '<div class="pv-tr"></div>' +
      '<div class="pv-bot"><div class="pv-cap"></div><div class="pv-b">' +
        '<button type="button" data-a="pvPrev" aria-label="Предишна снимка">‹</button>' +
        '<button type="button" class="pv-go" data-a="pvClose">Затвори</button>' +
        '<button type="button" data-a="pvNext" aria-label="Следваща снимка">›</button>' +
        '<a class="pv-full" target="_blank" rel="noopener" hidden>⤢ Пълен размер</a></div></div>';
    document.body.appendChild(el); document.body.classList.add('noscroll');
    PV = { el: el, tr: el.querySelector('.pv-tr'), list: [], i: 0, from: from || null, prev: prev, loading: !!loading, err: null, tok: ++pvTok,
      raf: 0, lock: 0, target: null, tgtT: 0, blob: '', blobFor: '' };
    PV.onResize = function () { if (PV) { PV.lock++; pvLeft(); } };   // завъртане → същата снимка [К29]
    window.addEventListener('resize', PV.onResize);
    el.addEventListener('gesturestart', function (e) { e.preventDefault(); });   // Safari: щипването не увеличава страницата [К29]
    PV.tr.addEventListener('scroll', pvScroll, { passive: true });
    pvSetList(list || [], i);
    var tok = PV.tok;
    setTimeout(function () { var b = el.querySelector('.pv-go'); if (PV && PV.tok === tok && b) { try { b.focus({ preventScroll: true }); } catch (e) {} } }, 30);
  }
  function pvSetList(list, i) {
    var p = PV; if (!p) return;
    p.list = list; p.i = Math.max(0, Math.min(i || 0, list.length - 1)); p.lock++; p.target = null;
    p.tr.innerHTML = list.map(function (r, k) {
      var d = phDims(r, 1280);
      return '<div class="pv-s" data-i="' + k + '"><img alt="" decoding="async" crossorigin="anonymous" width="' + d[0] + '" height="' + d[1] + '"' +
        ' style="max-width:100%;max-height:calc(100dvh - 150px);object-fit:contain"><span class="pv-off" hidden>📴 Голямата — когато има покритие</span></div>';
    }).join('');
    Array.prototype.forEach.call(p.tr.children, function (s) {
      s._bad = {};
      var img = s.firstChild;
      img.addEventListener('error', function () { var u = img.getAttribute('src'); if (u) s._bad[u] = 1; img.removeAttribute('src'); s._u = ''; s._big = false; if (PV === p) pvPaint(); });
    });
    // големите на целия списък — с един подпис при отваряне (≤ 50 на порция): свайпът не чака мрежа [К24]
    if (!DEMO && !offNow()) {
      var need = [], tok = p.tok;
      list.forEach(function (r) { if (r.pat && !SG.bad[r.pat]) need.push(r.pat); if (r.pat_mini && !sgOk(r.pat_mini)) need.push(r.pat_mini); });
      if (need.length) sign(need).then(function () { if (PV && PV.tok === tok) phRepaint(); }, function () { if (PV && PV.tok === tok) phRepaint(); });
    }
    pvPaint(); pvLeft();
  }
  // scrollLeft в rAF с временно scroll-snap-type:none — iOS Safari иначе често остава на 0 [К29]
  function pvLeft() {
    var p = PV; if (!p) return;
    rafX(function () {
      if (PV !== p) return;
      var tr = p.tr; tr.style.scrollSnapType = 'none';
      tr.scrollLeft = p.i * tr.clientWidth;
      rafX(function () { if (PV !== p) return; tr.style.scrollSnapType = ''; if (p.lock) p.lock--; });
    });
  }
  function pvScroll() {
    var p = PV; if (!p || p.raf) return;
    p.raf = rafX(function () {
      p.raf = 0;
      if (PV !== p || p.lock) return;
      var w = p.tr.clientWidth || 1, x = p.tr.scrollLeft;
      if (p.target != null) { if (Math.abs(x - p.target * w) > 2 && Date.now() - p.tgtT < 900) return; p.target = null; }
      var k = Math.max(0, Math.min(p.list.length - 1, Math.round(x / w)));
      if (k !== p.i) { p.i = k; pvPaint(); }
    });
  }
  function pvStep(d) {
    var p = PV; if (!p) return;
    var k = Math.max(0, Math.min(p.list.length - 1, p.i + d)); if (k === p.i) return;
    var w = p.tr.clientWidth;
    p.i = k; p.target = k; p.tgtT = Date.now(); pvPaint();
    try { p.tr.scrollTo({ left: k * w, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { p.tr.scrollLeft = k * w; }
  }
  // Голямата: адрес от паметта; няма го (подписът при отваряне е паднал / изтекъл / отворено без покритие) → нов подпис
  // (sgNeed пази от повторения); след неуспех — нов опит чак след 60 с (таймер, за да стане и без свайп).
  function pvBig(r) {
    if (!r || !r.pat) return null;
    if (DEMO) return offNow() && !DEMO_SEEN[r.pat] ? null : demoUrl(r.pat);
    if (SG.bad[r.pat]) return null;
    if (sgOk(r.pat, 60000)) return SG.m[r.pat].u;
    if (!offNow() && db && user) {
      var fa = SG.failAt[r.pat], ago = fa ? Date.now() - fa : 1e9;
      if (ago >= 60000) sgNeed(r.pat); else pvRetryLater(60000 - ago);
    }
    return null;
  }
  function pvRetryLater(ms) {
    var p = PV; if (!p || p.retryT) return;
    p.retryT = setTimeout(function () { p.retryT = 0; if (PV === p) pvPaint(); }, Math.max(1000, ms + 50));
  }
  function pvCap(r) {
    if (!r) return '';
    var iz = r.izvor ? (r.izvor_vid === 'kanal' ? 'канал „' + r.izvor + '“' : r.izvor_vid === 'chat' ? 'чат „' + r.izvor + '“' : r.izvor) : '';
    return esc([r.avtor, phTime(r), iz].filter(Boolean).join(' · ')) + (r.opisanie ? '<div class="pv-op">' + esc(r.opisanie) + '</div>' : '');
  }
  function pvPaint() {
    var p = PV; if (!p) return;
    var n = p.list.length, i = p.i, r = p.list[i];
    p.el.setAttribute('aria-label', n ? 'Снимки · ' + (i + 1) + ' от ' + n : 'Снимки');
    p.el.querySelector('.pv-n').textContent = n && !p.loading ? (i + 1) + ' / ' + n : '';
    var cap = p.el.querySelector('.pv-cap');
    var ch = p.loading ? '<span class="pulse" aria-hidden="true"></span> Зареждам снимките…' : p.err ? esc(p.err) : pvCap(r);
    if (cap._h !== ch) { cap.innerHTML = ch; cap._h = ch; }
    p.el.querySelector('[data-a="pvPrev"]').disabled = i <= 0;
    p.el.querySelector('[data-a="pvNext"]').disabled = i >= n - 1;
    // „⤢ Пълен размер“ — подписаният адрес на голямата в отделен прозорец (там щипването работи) [К35]
    var a = p.el.querySelector('.pv-full'), bu = p.loading ? null : pvBig(r);
    if (bu && DEMO) {   // браузърът не отваря data: адрес в нов прозорец → blob
      if (p.blobFor !== bu) { if (p.blob) { try { URL.revokeObjectURL(p.blob); } catch (e) {} } p.blob = demoBlob(r); p.blobFor = bu; }
      bu = p.blob;
    }
    if (bu) { if (a.getAttribute('href') !== bu) a.setAttribute('href', bu); a.hidden = false; }
    else { a.removeAttribute('href'); a.hidden = true; }
    Array.prototype.forEach.call(p.tr.children, function (s, k) { pvSlide(p, s, k); });
  }
  // Слайд: миниатюрата (вече е в кеша) веднага, разтегната; голямата се тегли встрани и сменя миниатюрата при onload.
  function pvSlide(p, s, k) {
    var img = s.firstChild, off = s.lastChild, r = p.list[k];
    if (!r || Math.abs(k - p.i) > 1) {
      if (img.hasAttribute('src')) img.removeAttribute('src');
      s._u = ''; s._want = ''; s._big = false; off.hidden = true; s.classList.remove('pv-none');
      return;
    }
    var big = pvBig(r), mini = srcFor(r.pat_mini);
    if (mini && s._bad[mini]) mini = null;
    if (big && s._bad[big]) big = null;
    if (!s._big) {
      if (mini && s._u !== mini) { img.src = mini; s._u = mini; }
      if (big && s._want !== big) {
        s._want = big;
        var im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = function () {
          if (PV !== p || s._want !== big || Math.abs(k - p.i) > 1) return;
          img.src = big; s._u = big; s._big = true;
          if (DEMO) DEMO_SEEN[r.pat] = 1;
          off.hidden = true; s.classList.remove('pv-none');
        };
        im.onerror = function () {
          if (PV !== p || s._want !== big) return;
          s._want = '';
          if (!DEMO && !offNow() && !SG.retried[r.pat]) { SG.retried[r.pat] = 1; delete SG.m[r.pat]; sign([r.pat]).then(phRepaint, phRepaint); return; }
          s._bad[big] = 1; pvPaint();
        };
        im.src = big;
      }
    }
    // лентата: без покритие → „когато има покритие“; с покритие, но подписът на голямата е паднал → „опитвам пак“
    var failB = !DEMO && !offNow() && !!SG.failAt[r.pat] && !SG.bad[r.pat];
    var offT = offNow() ? '📴 Голямата — когато има покритие' : 'Голямата не дойде — опитвам пак';
    if (off.textContent !== offT) off.textContent = offT;
    off.hidden = !!(s._big || big || !r.pat || p.loading || !(offNow() || failB));
    s.classList.toggle('pv-none', !s._u && !big && mini === null);
  }
  function pvFromEl(f) {
    if (!f) return null;
    var q = '[data-a="' + f.a + '"]' + (f.i != null ? '[data-i="' + (+f.i) + '"]' : '') + (f.sid != null ? '[data-sid="' + (+f.sid) + '"]' : '');
    var l = document.querySelectorAll(q);
    for (var j = 0; j < l.length; j++) if (f.msg == null || l[j].getAttribute('data-msg') === String(f.msg)) return l[j];
    return null;
  }
  function closeViewer(silent) {
    var p = PV; if (!p) return;
    PV = null;
    window.removeEventListener('resize', p.onResize);
    if (p.retryT) { clearTimeout(p.retryT); p.retryT = 0; }
    if (p.blob) { try { URL.revokeObjectURL(p.blob); } catch (e) {} }
    Array.prototype.forEach.call(p.el.querySelectorAll('img'), function (im) { im.removeAttribute('src'); });
    p.el.remove();
    if (!sheetEl) document.body.classList.remove('noscroll');   // листът под прегледа остава и пази noscroll [К28]
    if (silent) return;
    // фокусът — на плочката, от която е отворен; търси се наново: секцията може да е прерисувана [К29]
    var t = pvFromEl(p.from) || (p.prev && document.contains(p.prev) ? p.prev : null);
    if (t && t.focus) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  }
  // ← / → / Esc; Tab се върти в слоя
  function pvKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeViewer(); return true; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pvStep(-1); return true; }
    if (e.key === 'ArrowRight') { e.preventDefault(); pvStep(1); return true; }
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(PV.el.querySelectorAll('button,a[href]'), function (x) { return !x.disabled && !x.hidden; });
      if (!f.length) { e.preventDefault(); return true; }
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      return true;
    }
    return false;
  }

  // ---------- екран „Табло“ (Етап 2) ----------
  // Един поглед: какво чака теб (дни за одобрение, решения, срокове), хора по дни и поток на промените „като Фейсбук“.
  // При зареждане — само SELECT; запис има само след натиснат бутон (✓ / → Действие / „+“) — през send() и опашката.
  // Таблото живее в #tablo, който не се унищожава при смяна на таба: скролът и заредените порции се пазят [К2].
  var TABS = [['tablo', 'Табло'], ['day', 'Ден'], ['deistviq', 'Действия']];
  var TAB_ICO = {
    tablo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
    day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/></svg>',
    deistviq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5l2 2 3.5-3.5M12.5 8H20M4 16.5l2 2 3.5-3.5M12.5 17H20"/></svg>'
  };
  var STL = { chernova: 'Чернова', odobrena: 'Одобрен', vpisana: 'Вписан ✓' };

  // --- помощни ---
  function lcDay(s) { var d = parseD(s); return DNI_K[d.getDay()].toLowerCase() + ' ' + ddmm(d); }   // „ср 23.09“
  function capDay(s) { var d = parseD(s); return DNI_K[d.getDay()] + ' ' + ddmm(d); }                 // „Ср 23.09“
  // Календарни дни между деня и днес — само през датите: смяната на часа (25.10) не мести числото [К16].
  function daysAgo(s) {
    var d = parseD(s), n = now();
    return Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  }
  function waitPill(s) {
    var n = daysAgo(s);
    return n <= 0 ? ['⏳ от днес', 'p-neutral'] : n === 1 ? ['⏳ от вчера', 'p-neutral'] : ['⏳ чака от ' + n + ' дни', n >= 7 ? 'p-warn' : 'p-neutral'];
  }
  function stale60(t) { return !t || Date.now() - t > 60000; }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function setBodyO(k) { var b = document.body; b.classList.remove('o-ag', 'o-soft', 'o-all'); b.classList.add('o-' + k); }
  function setHash(h) { try { if (location.hash !== h) history.replaceState(null, '', h); } catch (e) {} }
  // Обектът на екран „Ден“ (Таблото има свой избор — TB.sel). Смяна → данните на Ден се нулират.
  function setObekt(o) {
    if (o !== 'ag' && o !== 'soft') return;
    lset(K2.denObekt, o);
    if (o === OBEKT_KOD) return;
    stopPoll();
    OBEKT_KOD = o;
    S.dni = []; S.counts = {}; S.den = null; S.tochki = []; S.res = []; S.newVersiq = 0; S.sig = ''; S.scrollY = 0;
  }
  var MEMV = { vid: '' };   // в демо „последно гледане“ е само в паметта (часовникът на демото тръгва отначало)
  function seenRead() { return DEMO ? MEMV.vid : (lget(K2.vid) || ''); }
  function seenWrite(v) { v = v || nowIso(); if (DEMO) MEMV.vid = v; else lset(K2.vid, v); }
  function isNewDay(r) { return !!(r && r.obnoven && TB.seenBase && Date.parse(r.obnoven) > Date.parse(TB.seenBase)); }
  function selState(s) { return TB.S[s] || (TB.S[s] = { open: null, old: null, feed: null, oseq: 0, fseq: 0 }); }
  function selRows(sel) { return TB.dni.filter(function (d) { return sel === 'all' || d.obekt === sel; }); }
  function dniById(id) { for (var i = 0; i < TB.dni.length; i++) if (TB.dni[i].id === id) return TB.dni[i]; return null; }
  function tBusy() { return !!TB.busy && TB.busy === TB.tok; }
  function scrolledFar() { return view === 'tablo' && (window.pageYOffset || 0) > 200; }
  function offNow() { return !!(S.offline || S.forceOff); }

  // --- навигация: долна лента, адрес, изгледи ---
  function renderTabs() {
    var nav = $('#tabs'); if (!nav) return;
    var on = view === 'tablo' || view === 'day' || view === 'deistviq';
    nav.hidden = !on;
    if (!on) return;
    var nd = pendingDays('all').length, ns = soonInfo().soon;
    var h = TABS.map(function (t) {
      var k = t[0], n = k === 'day' ? nd : k === 'deistviq' ? ns : 0;
      var lbl = t[1] + (!n ? '' : k === 'day' ? ', ' + n + (n === 1 ? ' ден чака' : ' дни чакат') + ' одобрение' : ', ' + n + ' със срок до 48 часа');
      return '<button type="button" class="tab" data-a="tab" data-v="' + k + '"' + (view === k ? ' aria-current="page"' : '') + ' aria-label="' + esc(lbl) + '">' +
        TAB_ICO[k] + '<span>' + t[1] + '</span>' + (n ? '<b class="badge" aria-hidden="true">' + n + '</b>' : '') + '</button>';
    }).join('');
    if (nav._h !== h) { nav.innerHTML = h; nav._h = h; }
  }
  function showBox() { if (tablo) tablo.hidden = view !== 'tablo'; screen.hidden = view === 'tablo'; }
  function parseHash() {
    var h = location.hash || '', m = /^#den\/(\d+)$/.exec(h);
    if (m) return { tab: 'day', id: +m[1] };
    if (h === '#den') return { tab: 'day', id: null };
    if (h === '#deistviq') return { tab: 'deistviq', id: null };
    return { tab: 'tablo', id: null };
  }
  // След вход / при старт: по адреса, иначе Таблото. Извън Таблото — само броячите за значките (заявки 1, 3, 4, 5).
  function routeStart() {
    var h = parseHash();
    // запазеното Табло се чете при всеки старт (и за #den / #deistviq): иначе saveTablo() след заявките за значките
    // би записало празни sel/closed върху него, а Ден не би виждал отметките от Таблото (TB.closed)
    if (!TB.hasBase) tabloFromCache();
    go(h.tab, { den: h.id, force: true });
    if (h.tab !== 'tablo') loadTablo(true);
  }
  function go(tab, o) {
    o = o || {};
    if (tab !== 'tablo' && tab !== 'day' && tab !== 'deistviq') tab = 'tablo';
    if (view === tab && !o.force && !(tab === 'day' && o.den && !(S.den && S.den.id === o.den))) {
      // натиснат активния таб → горе (+ обновяване, ако данните са по-стари от 60 с) — обновяването с палеца
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      if (tab === 'tablo') { if (stale60(TB.okAt)) loadTablo(); else if (anyDefer()) applyDeferred(); }
      else if (tab === 'day') { if (stale60(S.okAt)) poll(true); }
      else if (stale60(S.actsOkAt)) loadActs();
      return;
    }
    leaveView();
    S.tok++; TB.tok++;   // закъснели отговори за стария изглед се изхвърлят [К2]
    view = tab;
    showBox();
    $('#fab').hidden = false;
    renderTabs(); renderBanners(); stampNow();
    if (tab === 'tablo') showTablo();
    else if (tab === 'day') {
      // Ден още не е отварян → обектът на избора на Таблото (ако не е „Всички“), не този от старта (§1)
      if (!o.den && !lget(K2.denObekt) && TB.sel !== 'all') setObekt(TB.sel);
      showDay(o.den || null);
    }
    else showActs();
  }
  function leaveView() {
    commitUndos();
    var y = window.pageYOffset || 0;
    if (view === 'tablo') { TB.scrollY = y; seenWrite(); hidePill(); }
    else if (view === 'day') { S.scrollY = y; stopPoll(); }
  }
  function showTablo() {
    setBodyO(TB.sel); setHash('#tablo');
    TB.shownAt = activeMs(); TB.measured = false;
    TB.seenBase = seenRead();
    if (!TB.seenBase) { TB.seenBase = nowIso(); seenWrite(TB.seenBase); }   // първо отваряне → без „🆕“
    if (!TB.hasBase) tabloFromCache();
    renderTablo(true);
    window.scrollTo(0, TB.scrollY || 0);
    if (anyDefer() && scrolledFar()) showPill(); else if (anyDefer()) applyDeferred();
    if (stale60(TB.okAt)) loadTablo();
    else if (!selState(TB.sel).open) loadSel(TB.sel);
  }
  // Табът „Ден“: последният показан в Ден обект; ако денят вече е зареден — без пълно презареждане.
  function showDay(id) {
    setBodyO(OBEKT_KOD); lset(K2.denObekt, OBEKT_KOD);
    var loading = '<div class="card pad tb-load"><span class="pulse" aria-hidden="true"></span> Зареждам деня…</div>';
    if (id && !(S.den && S.den.id === id)) {
      if (offNow()) {
        if (dayCached(OBEKT_KOD, id)) { fromCache(id); renderDay(); window.scrollTo(0, 0); return; }
        if (S.den) { renderDay(); toast('Този ден не е запазен на телефона — отвори го, когато има покритие.'); return; }
        screen.innerHTML = loading; boot(id); return;
      }
      screen.innerHTML = loading;
      window.scrollTo(0, 0);
      if (S.dni.length && S.den) openDay(id); else boot(id);
      return;
    }
    // само ако денят е зареден: прекъснат boot() (Ден → Табло, преди Ден да се зареди) оставя S.dni без S.den
    if (S.den) {
      renderDay();
      window.scrollTo(0, id ? 0 : (S.scrollY || 0));
      poll(true);
      if (Date.now() - PH.at > PH_C1_MS) phLoad(S.den.id);   // снимките се качват след черновата [К30]
      return;
    }
    screen.innerHTML = loading;
    boot(null);
  }
  function showActs() {
    setBodyO(TB.sel); setHash('#deistviq');
    renderActsTab(); window.scrollTo(0, 0);
    if (stale60(S.actsOkAt)) loadActs();
  }
  function loadActs() {
    if (view === 'deistviq') stamp('обновявам…');
    S.actsErr = null;
    api.deistviq().then(function (a) {
      S.deistviq = a || []; S.actsAt = nowIso(); S.actsOkAt = Date.now();
      if (S.offline && !S.forceOff) setOnline(); else { renderCurrent(); stampNow(); }
    }, function (e) {
      if (isNet(e) || isAuth(e)) { setOffline(); return; }
      S.actsErr = e; renderCurrent();
      stampNow();
      if (view === 'deistviq') toast('Действията не се заредиха: ' + errBg(e), 'bad');
    });
  }
  // Печатът горе: времето на данните на ТЕКУЩИЯ екран.
  function stampNow() {
    if (view !== 'tablo' && view !== 'day' && view !== 'deistviq') return;
    if (view === 'tablo' && tBusy()) { stamp(TB.hasBase ? 'обновявам…' : 'зареждам…'); return; }
    var at = view === 'tablo' ? TB.at : view === 'deistviq' ? (S.actsAt || TB.at) : S.dataAt;
    if (offNow()) { stamp('без покритие · ' + (at ? rel(at) : '—'), true); return; }
    stamp(at ? 'данни към ' + rel(at) + (view === 'tablo' ? ' ↻' : '') : '…');
  }
  function renderCurrent() {
    if (view === 'tablo') renderTabloLive();
    else if (view === 'day') renderLive();
    else if (view === 'deistviq') renderActsTab();
    renderTabs(); renderBanners();
    phRepaint();   // покритие ⇄ без покритие: плочките, листът и прегледът (box() пише само разликата)
  }
  function refreshCurrent() {
    if (view === 'tablo') loadTablo();
    else if (view === 'day') { if (S.den && !S.offline) { poll(true); phLoad(S.den.id); } else boot(S.den ? S.den.id : null, !!S.den); }
    else if (view === 'deistviq') loadActs();
    else if (view === 'karti' && user) loadKarti();
  }

  // --- правила ---
  // Ден „чака одобрение“: чернова, не е тестов, без необработено odobri за същата версия, без такова в опашката (§2.3).
  var ST_RANG = { chernova: 0, odobrena: 1, vpisana: 2 };   // статусът на деня само напредва
  function pendingDays(sel) {
    var odo = {}, q = {}, seen = {}, out = [];
    TB.odobri.forEach(function (r) { odo[r.den_id + ':' + r.versiq] = 1; });
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.vid === 'odobri') q[it.row.den_id] = 1; });
    TB.dni.concat(S.dni).forEach(function (d) {
      if (seen[d.id]) return; seen[d.id] = 1;
      var ob = d.obekt || OBEKT_KOD;
      if (sel !== 'all' && ob !== sel) return;
      // Таблото (TB.dni) и Ден (S.dni / S.den) се обновяват по различно време → печели най-напредналият статус
      // и най-новата версия от всички източници (застарял списък на Ден не връща вписан ден в „чакащи“)
      var st = 'chernova', v = 0;
      [d, dniById(d.id), ob === OBEKT_KOD ? findDni(d.id) : null, (S.den && S.den.id === d.id) ? S.den : null].forEach(function (x) {
        if (!x) return;
        if ((ST_RANG[x.status] || 0) > (ST_RANG[st] || 0)) st = x.status;
        if (+x.versiq > v) v = +x.versiq;
      });
      if (st !== 'chernova' || !(d.data >= TEST_DO) || odo[d.id + ':' + v] || q[d.id]) return;
      if (S.den && S.den.id === d.id && S.res.some(function (r) { return r.vid === 'odobri' && +r.versiq === v && !/остаряла/i.test(r.rezultat || ''); })) return;
      out.push({ id: d.id, obekt: ob, data: d.data });
    });
    return out.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : a.obekt < b.obekt ? -1 : 1; });
  }
  // Срокове: заявени действия за двата обекта; просрочените не са „червени“ и не влизат в значката [К19].
  function soonInfo() {
    var n = nowMs(), lim = n + 48 * 36e5, soon = 0, old = 0;
    var q = liveQ().filter(function (it) { return it.tbl === 'deistviq'; }).map(function (it) { return it.row; });
    TB.soon.concat(q).forEach(function (a) {
      if ((a.status && a.status !== 'zaqveno') || !a.srok) return;
      var t = Date.parse(a.srok); if (isNaN(t)) return;
      if (t > n && t <= lim) soon++; else if (t <= n) old++;
    });
    // заявка 4 е с пълен таван → по-старите в базата може да са повече от показаните (най-близките са първи)
    var more = TB.soon.filter(function (a) { return typeof a.id === 'number'; }).length >= SOON_MAX;
    return { soon: soon, old: old, more: more && old > 0 };
  }
  // Точка „затворена“ от телефона: решение (potvardi/popravka/osporva/komentar) или действие към нея.
  function closingRow(tbl, row) { return !!row && row.tochka_id != null && (tbl === 'deistviq' || (tbl === 'resheniq' && !!CLOSE_VID[row.vid])); }
  function hideInfo() {
    var q = {}, err = {};
    queue().forEach(function (it) { if (!closingRow(it.tbl, it.row)) return; if (it.err) err[it.row.tochka_id] = 1; else q[it.row.tochka_id] = 1; });
    return { q: q, err: err };
  }
  // скрита: в опашката, изпраща се в момента, или в TB.closed (отказаните от базата остават видими с „⚠️ не се записа“)
  function isHid(tid, hi) { return !!(hi.q[tid] || TB.inflight[tid] || (TB.closed[tid] && !hi.err[tid])); }
  function visOpen(o, hi) { return (o.items || []).filter(function (t) { return !isHid(t.id, hi); }); }
  function noteClose(tid, o, d, ok, r) {
    if (tid == null) return;
    TB.closed[tid] = { at: nowIso(), o: o || null, d: d || null, ok: ok ? 1 : 0, sent: r === 'sent' ? nowIso() : null };
    saveTablo();
  }
  // кога записът е стигнал базата (null = още не)
  function closedEff(k, hi) {
    var x = TB.closed[k]; if (!x) return null;
    if (x.sent) return x.sent;
    return (hi.q[k] || TB.inflight[k] || hi.err[k]) ? null : x.at;
  }
  // Броят на екрана = N от базата − скритите, които N още брои (опашка, TB.closed преди заявката) [К23].
  function openTotal(sel, o, hi) {
    var ids = {}, sub = 0;
    (o.items || []).forEach(function (t) { ids[t.id] = 1; if (isHid(t.id, hi)) sub++; });
    Object.keys(TB.closed).forEach(function (k) {
      var x = TB.closed[k];
      if (ids[k] || hi.err[k] || !x.o || !x.d || (sel !== 'all' && x.o !== sel) || x.d < RESH_OT) return;
      var eff = closedEff(k, hi);
      if (!eff || !o.at || eff > o.at) sub++;
    });
    return Math.max(0, (o.total || 0) - sub);
  }
  // Успешна заявка 2: точка, чийто запис е в базата отпреди заявката и не е върната, излиза от TB.closed [К23].
  function clearClosed(o) {
    var hi = hideInfo(), ret = {}, ch = false, n = nowMs();
    (o.items || []).forEach(function (t) { ret[t.id] = 1; });
    Object.keys(TB.closed).forEach(function (k) {
      var x = TB.closed[k], eff = closedEff(k, hi);
      if (!hi.q[k] && x.at && n - Date.parse(x.at) > 7 * 864e5) { delete TB.closed[k]; ch = true; return; }
      if (ret[k] || !eff || !o.at || eff >= o.at) return;
      // по-старите запазени списъци на другите избори още я броят — махаме я и от тях
      ['ag', 'soft', 'all'].forEach(function (s) {
        var oo = TB.S[s] && TB.S[s].open; if (!oo || oo === o || !oo.at || oo.at >= eff) return;
        var i = -1; oo.items.forEach(function (t, j) { if (String(t.id) === String(k)) i = j; });
        if (i >= 0) oo.items.splice(i, 1);
        if (i >= 0 || (x.o && x.d && (s === 'all' || s === x.o) && x.d >= RESH_OT)) oo.total = Math.max(0, (oo.total || 0) - 1);
      });
      // „По-стари решения“ никога не са в основния списък и не се теглят наново → махаме точката и от тях,
      // иначе след изтриването от TB.closed отговорената карта „възкръсва“ като отворена
      ['ag', 'soft', 'all'].forEach(function (s) {
        var ol = TB.S[s] && TB.S[s].old;
        if (ol && ol.items) ol.items = ol.items.filter(function (t) { return String(t.id) !== String(k); });
      });
      delete TB.closed[k]; ch = true;
    });
    return ch;
  }

  // --- зареждане ---
  // Заявки 1, 3, 4, 5 тръгват едновременно, 2 — веднага, 6 — след 1. base=true → само 1, 3, 4, 5 (значките извън Таблото).
  function loadTablo(base) {
    var tok = ++TB.tok, sel = TB.sel, at = nowIso(), prevTop = (selRows(sel)[0] || {}).data || '';
    TB.busy = tok;
    if (view === 'tablo') { stampNow(); renderTbTop(); }
    var pB = Promise.all([api.tDni(), api.svezhest(), api.tSoon(), api.tOdobri()]);
    var pO = base ? Promise.resolve() : loadOpen(sel);
    pB.then(function (rr) {
      if (tok !== TB.tok) return;
      TB.dni = rr[0] || []; S.svezhest = rr[1] || []; S.svAt = Date.now(); TB.soon = rr[2] || []; TB.odobri = rr[3] || [];
      TB.at = at; TB.hasBase = true; TB.baseErr = null;
      if (S.offline && !S.forceOff) S.offline = false;
      if (!base) {
        var top = (selRows(sel)[0] || {}).data || '', newer = !!prevTop && top > prevTop;
        var far = view === 'tablo' ? scrolledFar() : (TB.scrollY || 0) > 200;
        // без скачане под палеца [К11]: скролнат → само числата; графиката и потокът — при връщане горе / „↑ Нови промени“
        if (far && selState(sel).feed) { TB.defer.chart = true; TB.defer.feed = true; if (newer) showPill(); }
        else { renderChart(true); feedReset(sel); }
      }
      if (view === 'tablo') renderTabloLive();
      renderTabs(); renderBanners(); stampNow();
    }, function (e) { if (tok === TB.tok) baseFail(e); });
    Promise.all([pB, pO]).then(function () {
      if (tok !== TB.tok) return;
      TB.busy = 0; TB.okAt = Date.now(); saveTablo(); stampNow();
      if (view === 'tablo') renderTbTop();
    }, function () { if (tok === TB.tok) { TB.busy = 0; stampNow(); if (view === 'tablo') renderTbTop(); } });
  }
  function baseFail(e) {
    TB.busy = 0;
    if (isMissing(e)) { renderSetup(); return; }
    if (isAuth(e) && navigator.onLine && !DEMO && user) { stopPoll(); viewLogin('Сесията изтече — влез отново.'); return; }
    if (isNet(e) || isAuth(e)) { setOffline(); if (view === 'tablo') renderTablo(true); return; }
    TB.baseErr = e; stampNow();
    if (view === 'tablo') renderTbTop();
  }
  // Заявка 2 за избора; отговор за стара заявка на същия избор се изхвърля.
  function loadOpen(sel, force) {   // force — след натискане (Виж всички, Опитай пак, смяна на избора): рисува веднага
    var st = selState(sel), seq = ++st.oseq, at = nowIso(), all = !!(st.open && st.open.all);
    return api.tOpen(sel, [0, all ? 106 : 4], false).then(function (r) {
      if (seq !== st.oseq) return;
      st.open = { items: (r.data || []).map(normT), total: r.count == null ? (r.data || []).length : r.count, all: all, at: at };
      if (clearClosed(st.open)) saveTablo();
      if (sel === TB.sel && view === 'tablo') { renderOpen(!!force); renderTabloCounts(); }
      renderTabs();
    }, function (e) {
      if (seq !== st.oseq) return;
      if (st.open && st.open.loadingAll) { st.open.loadingAll = false; st.open.all = false; }
      if (isNet(e)) setOffline();
      else if (!isMissing(e) && !isAuth(e)) st.open = Object.assign({ items: [], total: 0, all: false, at: null }, st.open || {}, { err: e });
      if (sel === TB.sel && view === 'tablo') { renderOpen(true); renderTabloCounts(); }
    });
  }
  function loadSel(sel) {
    if (offNow()) { if (sel === TB.sel && view === 'tablo') renderTablo(); return; }
    loadOpen(sel, true);
    if (TB.hasBase) feedReset(sel);
  }
  function loadOld(sel) {
    var st = selState(sel), ol = st.old; if (!ol) return;
    var seq = ol.seq = (ol.seq || 0) + 1;
    ol.loading = true; ol.err = null;
    api.tOpen(sel, [0, 106], true).then(function (r) {
      if (st.old !== ol || seq !== ol.seq) return;
      ol.loading = false; ol.items = (r.data || []).map(normT); ol.total = r.count;
      if (sel === TB.sel) renderOpen(true);
    }, function (e) {
      if (st.old !== ol || seq !== ol.seq) return;
      ol.loading = false;
      if (isNet(e)) setOffline(); else ol.err = e;
      if (sel === TB.sel) renderOpen(true);
    });
  }
  // Потокът: порция = следващите 3 реда от списъка с дни на избора (заявка 6). Старият поток стои, докато новият не дойде.
  function feedReset(sel) {
    var st = selState(sel);
    var f = { rows: selRows(sel).slice(), items: [], pos: 0, done: false, loading: false, err: null, chain: 0, seq: ++st.fseq, fresh: true, ph: {} };
    if (!f.rows.length) { f.done = true; f.fresh = false; st.feed = f; if (sel === TB.sel) renderFeed(); return; }
    if (!st.feed) { st.feed = f; f.fresh = false; }
    loadFeedPortion(sel, f, false);
  }
  function loadFeedPortion(sel, f, auto) {
    var st = selState(sel);
    f = f || st.feed;
    if (!f || f.loading || f.done) return;
    var rows = f.rows.slice(f.pos, f.pos + 3);
    if (!rows.length) { f.done = true; if (st.feed === f && sel === TB.sel) renderFeed(); return; }
    if (offNow()) { if (sel === TB.sel) renderFeedEnd(); return; }
    f.loading = true; f.err = null;
    if (st.feed === f && sel === TB.sel) renderFeedEnd();
    var ids = rows.map(function (r) { return r.id; });
    // С3 (снимките) — успоредно с промените; порцията се рисува, когато и двете дойдат (само JSON — подписът не се чака) [К26].
    // Грешка или липса на С3 = без ленти, картите се рисуват нормално.
    Promise.all([api.tFeed(ids), api.tPh(ids).then(null, function () { return null; })]).then(function (rr) {
      var pts = rr[0];
      f.loading = false;
      if (f.seq !== st.fseq || (!f.fresh && st.feed !== f)) return;   // по-ново презареждане на потока
      phMergeFeed(f, ids, rr[1]);
      var have = {}, add = 0;
      f.items.forEach(function (t) { have[t.id] = 1; });
      (pts || []).forEach(function (t) { if (!have[t.id]) { have[t.id] = 1; f.items.push(normT(t)); add++; } });
      f.pos += rows.length; if (f.pos >= f.rows.length) f.done = true;
      if (f.fresh) { f.fresh = false; st.feed = f; }
      f.chain = auto ? f.chain + 1 : 1;
      if (sel === TB.sel) renderFeed();
      saveTablo();
      // порция с < 6 карти → автоматично още една, най-много 3 подред
      if (add < 6 && !f.done && f.chain < 3 && f.items.length < 200) loadFeedPortion(sel, f, true);
    }, function (e) {
      f.loading = false;
      if (f.seq !== st.fseq) return;
      if (f.fresh) {
        f.fresh = false;
        if (st.feed && st.feed !== f) {
          // старият поток остава жив: поема последователността, за да работят пак стражът, „Още ▾“ и „Опитай пак“
          st.feed.seq = st.fseq;
          if (isNet(e)) setOffline(); else st.feed.err = e;
          if (sel === TB.sel) renderFeedEnd();
          return;
        }
        st.feed = f;
      }
      if (isNet(e) || isAuth(e)) setOffline(); else f.err = e;
      if (sel === TB.sel) renderFeed();
    });
  }
  function feedAuto() {
    if (view !== 'tablo') return;
    var st = selState(TB.sel), f = st.feed;
    if (!f || f.loading || f.done || f.err || f.seq !== st.fseq || offNow() || f.items.length >= 200) return;
    loadFeedPortion(TB.sel, f, false);
  }
  function feedNear() { var e = $('#tb-end'); if (e && e.getBoundingClientRect().top < (window.innerHeight || 800) + 600) feedAuto(); }
  function feedMore() {
    var st = selState(TB.sel), f = st.feed;
    if (!f) { feedReset(TB.sel); return; }
    if (offNow()) { toast('Още дни — когато има покритие.'); return; }
    f.err = null; loadFeedPortion(TB.sel, f, false);
  }

  // --- кеш на Таблото: ailab_e2_tablo ---
  function feedForCache(f, max) {
    if (!f) return null;
    var by = {}, out = [], pos = 0;
    f.items.forEach(function (t) { (by[t.den_id] = by[t.den_id] || []).push(t); });
    for (var i = 0; i < f.pos; i++) {
      var its = by[f.rows[i].id] || [];
      if (out.length && out.length + its.length > max) break;
      out = out.concat(its); pos = i + 1;
    }
    // лентите със снимки на кешираните дни — само пътищата, без адреси [§4.6]
    var ph = {};
    for (var j = 0; j < pos; j++) { var k = f.rows[j].id; if (f.ph && f.ph[k]) ph[k] = f.ph[k]; }
    return { rows: f.rows.map(function (r) { return r.id; }), items: out, pos: pos, done: f.done && pos === f.pos, ph: ph };
  }
  function saveTablo(max) {
    if (!TB.hasBase) return;
    max = max == null ? 40 : max;
    var c = { v: 1, at: TB.at, dni: TB.dni, svezhest: S.svezhest, soon: TB.soon.filter(function (a) { return typeof a.id === 'number'; }), odobri: TB.odobri, closed: TB.closed,
      acts: S.deistviq.filter(function (a) { return typeof a.id === 'number'; }).slice(0, 100), actsAt: S.actsAt, sel: {} };
    ['ag', 'soft', 'all'].forEach(function (k) {
      var s = TB.S[k]; if (!s || (!s.open && !s.feed)) return;
      var o = s.open && !s.open.err && s.open.at ? { items: s.open.items, total: s.open.total, all: s.open.all, at: s.open.at } : null;
      c.sel[k] = { at: o ? o.at : null, open: o, feed: max ? feedForCache(s.feed, max) : null };
    });
    if (ssetOk(K.tablo, c)) return;
    if (max > 20) saveTablo(20); else if (max) saveTablo(0);   // квота: потокът до 20 карти, после без поток
  }
  function tabloFromCache() {
    var c = sget(K.tablo, null); if (!c || c.v !== 1 || !Array.isArray(c.dni)) return false;
    TB.dni = c.dni; TB.at = c.at || ''; TB.hasBase = true;
    if (c.svezhest && !S.svezhest.length) S.svezhest = c.svezhest;
    TB.soon = c.soon || []; TB.odobri = c.odobri || []; TB.closed = c.closed || {};
    if (c.acts && !S.deistviq.length) { S.deistviq = c.acts; S.actsAt = c.actsAt || c.at || ''; }
    var by = {}; TB.dni.forEach(function (d) { by[d.id] = d; });
    Object.keys(c.sel || {}).forEach(function (k) {
      var s = c.sel[k], st = selState(k);
      if (s.open && !st.open) st.open = { items: (s.open.items || []).map(normT), total: s.open.total || 0, all: !!s.open.all, at: s.open.at || null };
      if (s.feed && !st.feed) {
        var rows = [], pos = s.feed.pos || 0;
        (s.feed.rows || []).forEach(function (id, i) { if (by[id]) rows.push(by[id]); else if (i < (s.feed.pos || 0)) pos--; });
        st.feed = { rows: rows, items: (s.feed.items || []).map(normT), pos: Math.max(0, pos), done: !!s.feed.done, loading: false, err: null, chain: 0, seq: st.fseq, fresh: false,
          ph: s.feed.ph && typeof s.feed.ph === 'object' ? s.feed.ph : {} };
      }
    });
    return true;
  }

  // --- рисуване ---
  function buildTablo() {
    tablo.innerHTML =
      '<div id="tb-sw"></div><div id="tb-top" class="tb-top"></div><div id="tb-fresh"></div><div id="tb-cnt" class="stats tb-cnt"></div>' +
      '<section class="grp g-reshenie" id="tb-open-s" aria-label="Изисква решение"><div class="grp-h"><h2>Изисква решение</h2><span class="grp-n" id="tb-open-n">…</span></div>' +
        '<p class="grp-s">чака теб: отговор, решение, пари или срок</p><div id="tb-open" class="tb-list"></div></section>' +
      '<section class="grp g-promqna" id="tb-hora-s" aria-label="Хора на обекта"><div class="grp-h"><h2>Хора на обекта</h2><span class="grp-l">14 дни</span></div><div id="tb-hora"></div></section>' +
      '<section class="grp g-promqna" id="tb-feed-s" aria-label="Какво се промени"><div class="grp-h"><h2>Какво се промени</h2></div>' +
        '<p class="grp-s">най-новото горе · превърти за по-старите дни</p><div id="tb-feed" class="tb-list"></div><div id="tb-end" class="tb-end"></div></section>' +
      '<button type="button" class="new-pill" id="tb-new" data-a="tNew" hidden>↑ Нови промени</button>';
    TB.built = true;
    if ('IntersectionObserver' in window) {
      try {
        TB.io = new IntersectionObserver(function (en) { for (var i = 0; i < en.length; i++) if (en[i].isIntersecting) { feedAuto(); break; } }, { rootMargin: '600px' });
        TB.io.observe($('#tb-end'));
      } catch (e) { TB.io = null; }
    }
  }
  // keep — при връщане на таба: отложените (заради скрола) списъци остават отложени, хапчето се показва пак [К11]
  function renderTablo(keep) {
    if (!tablo) return;
    if (!TB.built) buildTablo();
    if (!keep) { TB.defer = {}; hidePill(); }
    var d = TB.defer;
    renderTbSw(); renderTbTop(); renderFresh('#tb-fresh', true); renderTabloCounts();
    if (!d.open) renderOpen(true);
    if (!d.chart) renderChart(true);
    if (!d.feed) renderFeed(); else renderFeedEnd();
  }
  // Смяна от опашката/мрежата: числата винаги; списъкът с решенията — само ако не си скролнал надолу [К11].
  function renderTabloLive() {
    if (view !== 'tablo' || !TB.built) return;
    renderTbSw(); renderTbTop(); renderFresh('#tb-fresh', true); renderTabloCounts(); renderOpen(false); renderFeedEnd();
  }
  function renderTbSw() {
    var el = box('#tb-sw'); if (!el) return;
    el.innerHTML = '<div class="tb-sw" role="group" aria-label="Обект">' + ['ag', 'soft', 'all'].map(function (k) {
      return '<button type="button" class="o-' + k + '" data-a="tSel" data-v="' + k + '" aria-pressed="' + (TB.sel === k) + '"><i aria-hidden="true"></i>' + SELK[k] + '</button>';
    }).join('') + '</div>';
  }
  function offMsg(sel) {
    return '<div class="card pad tb-off"><p>📴 Няма запазени данни за ' + esc(sel === 'all' ? 'двата обекта' : SELK[sel]) + ' — отвори с покритие.</p>' +
      '<button type="button" class="btn" data-a="tRetry" data-s="all">Опитай пак</button></div>';
  }
  function renderTbTop() {
    var el = box('#tb-top'); if (!el) return;
    var sel = TB.sel, st = selState(sel), h = '', show = true;
    var errH = TB.baseErr ? '<div class="err">Таблото не се обнови: ' + esc(errBg(TB.baseErr)) + '</div><button type="button" class="btn ghost" data-a="tRetry" data-s="all">Опитай пак</button>' : '';
    if (!TB.hasBase) {
      show = false;
      h = offNow() && !tBusy() ? offMsg(sel) : errH || '<div class="card pad tb-load"><span class="pulse" aria-hidden="true"></span> Зареждам таблото…</div>';
    } else {
      h = errH;
      if (offNow() && !st.open && !st.feed) { show = false; h += offMsg(sel); }
      else if (!selRows(sel).length) {
        h += '<section class="empty"><div class="empty-e" aria-hidden="true">🌙</div><h1>Още няма качени дни за ' + esc(SELN[sel]) + '</h1>' +
          '<p>Лаптопът качва черновата вечер (около 17:30) — тогава денят се появява тук с решенията, хората и промените.</p>' +
          '<p class="small muted">Действията (бутонът „+“) работят и сега.</p></section>';
      }
    }
    el.innerHTML = h;
    ['#tb-fresh', '#tb-cnt', '#tb-open-s', '#tb-hora-s', '#tb-feed-s'].forEach(function (s) { var n = $(s); if (n && n.hidden === show) n.hidden = !show; });
  }
  function renderTabloCounts() {
    var el = box('#tb-cnt'); if (!el) return;
    var sel = TB.sel, pd = pendingDays(sel), sn = soonInfo(), o = selState(sel).open, hi = hideInfo();
    var nOpen = o && !o.err ? openTotal(sel, o, hi) : null, imp = 0;
    if (o && !o.err) visOpen(o, hi).forEach(function (t) { if ((t.vajnost || 1) >= 3) imp++; });
    var more = o && (o.items || []).length < (o.total || 0) && o.items.length && (o.items[o.items.length - 1].vajnost || 1) >= 3;
    var impS = nOpen == null ? '' : !nOpen ? '✓ няма' : imp ? imp + (more ? '+' : '') + (imp === 1 && !more ? ' важно' : ' важни') : 'без важни';
    // числото и думата се спрягат: „1 ден“, „2 дни“ (пълен таван на заявка 4 → „N+ по-стари“)
    var dL = pl(pd.length, 'ден', 'дни') + ' за одобрение', rL = nOpen == null ? 'решения' : pl(nOpen, 'решение', 'решения');
    var sL = pl(sn.soon, 'срок', 'срокове'), oL = sn.old ? sn.old + (sn.more ? '+ ' : ' ') + (sn.old === 1 && !sn.more ? 'по-старо' : 'по-стари') + ' без отметка' : '';
    el.innerHTML =
      '<button type="button" class="stat k-o" data-a="tWait" aria-label="' + esc(cap(dL) + ': ' + pd.length + (pd.length ? ', най-стар ' + lcDay(pd[0].data) : '')) + '">' +
        '<b>' + pd.length + '</b><span>📄 ' + dL + '</span><em>' + (pd.length ? 'най-стар: ' + esc(lcDay(pd[0].data)) : '✓ няма') + '</em></button>' +
      '<button type="button" class="stat k-mine" data-a="jump" data-g="tb-open-s" aria-label="' + esc(cap(rL) + ': ' + (nOpen == null ? 'няма данни' : nOpen) + (impS ? ', ' + impS : '')) + '">' +
        '<b>' + (nOpen == null ? '—' : nOpen) + '</b><span>⏳ ' + rL + '</span><em>' + esc(impS) + '</em></button>' +
      '<button type="button" class="stat k-warn" data-a="tSoon" aria-label="' + esc(cap(sL) + ' до 48 часа: ' + sn.soon + (oL ? ', ' + oL : '')) + '">' +
        '<b>' + sn.soon + '</b><span>🔔 ' + sL + ' 48 ч</span>' + (oL ? '<em class="gray">' + esc(oL) + '</em>' : '') + '</button>';
    renderOpenN();
  }
  function renderOpenN() {
    var n = $('#tb-open-n'); if (!n) return;
    var o = selState(TB.sel).open, v = o && !o.err ? String(openTotal(TB.sel, o, hideInfo())) : '—';
    if (n.textContent !== v) n.textContent = v;
  }
  function dcCard(t, hi) {
    var d = t.dni || {}, tid = esc(t.id);
    // 4 с „Отмени“ [К21]: картата стои на мястото си (приглушена), сменя се само редът с бутоните —
    // височината не се мени, „Отмени“ излиза точно под палеца, нищо под него не подскача [К11]
    var und = !!TB.undo[t.id];
    var hot = (t.vajnost || 1) >= 3, w = waitPill(d.data), izv = t.izvori || [];
    return '<article class="dc' + (hot ? ' hot' : '') + (und ? ' undoing' : '') + '" data-tid="' + tid + '">' +
      '<button type="button" class="dc-open" data-a="tOpen" data-o="' + esc(d.obekt) + '" data-den="' + esc(t.den_id) + '" data-tid="' + tid + '"' + (und ? ' tabindex="-1" aria-hidden="true"' : '') + '>' +
        '<span class="dc-m"><span class="ochip o-' + esc(d.obekt) + '">' + esc(SELK[d.obekt] || d.obekt) + '</span><span class="dc-d">' + esc(lcDay(d.data)) + '</span>' +
          '<span class="pill ' + w[1] + '">' + w[0] + '</span>' + (isNewDay(d) ? '<span class="pill p-new">🆕</span>' : '') + (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') + '</span>' +
        '<span class="dc-b"><span class="dc-e" aria-hidden="true">' + emoT(t) + '</span><span class="dc-t">' + esc(t.tekst) + '</span></span>' +
        '<span class="sr"> — отвори деня</span></button>' +
      (izv.length && !und ? '<button type="button" class="srcb dc-src" data-a="tSrc" data-tid="' + tid + '" aria-label="Източници: ' + izv.length + '"><span class="ref">' + izv.length + '</span><span class="srcb-l">›</span></button>' : '') +
      (hi.err[t.id] ? '<div class="dc-w"><button type="button" class="dc-errb" data-a="qerr">⚠️ не се записа — виж</button></div>' : '') +
      (und
        ? '<div class="dc-a dc-ua"><span class="dc-u">✓ Отговорено</span>' +
          '<button type="button" class="pa dc-ub" data-a="tUndo" data-tid="' + tid + '">Отмени</button><i class="dc-bar" aria-hidden="true"></i></div>'
        : '<div class="dc-a"><button type="button" class="pa pa-ok" data-a="tOk" data-tid="' + tid + '">✓ Отговорено</button>' +
          '<button type="button" class="pa" data-a="tAct" data-tid="' + tid + '">→ Действие</button></div>') + '</article>';
  }
  function openHtml() {
    var sel = TB.sel, st = selState(sel), o = st.open, hi = hideInfo(), h = '';
    if (!o) return offNow() ? '<p class="grp-e">📴 Решенията ще се покажат, когато има покритие.</p>' : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам решенията…</p>';
    if (o.err) return '<div class="err">Решенията не се заредиха: ' + esc(errBg(o.err)) + '</div><button type="button" class="btn ghost" data-a="tRetry" data-s="open">Опитай пак</button>';
    var vis = visOpen(o, hi), tot = openTotal(sel, o, hi), show = o.all ? vis : vis.slice(0, 5);
    h += show.length ? show.map(function (t) { return dcCard(t, hi); }).join('') : '<p class="grp-e">✅ Нищо не чака решение.</p>';
    if (o.loadingAll) h += '<p class="fd-end"><span class="pulse" aria-hidden="true"></span> Зареждам всички…</p>';
    else if (!o.all && tot > show.length) h += '<button type="button" class="btn ghost" data-a="tMore">Виж всички (' + tot + ')</button>';
    else if (o.all) {
      if ((o.total || 0) > 107) h += '<p class="small muted">Показани са първите 107.</p>';
      if (vis.length > 5) h += '<button type="button" class="btn ghost" data-a="tMore" data-v="less">Покажи по-малко</button>';
    }
    // По-стари решения — под чертата RESH_OT, тегли се чак при натискане [К18]
    var ol = st.old, on = !!(ol && ol.shown);
    h += '<button type="button" class="tb-old" data-a="tOld" aria-expanded="' + on + '"><span>По-стари решения (преди ' + esc(ddmm(parseD(RESH_OT))) + ')</span><span aria-hidden="true">' + (on ? '▴' : '›') + '</span></button>';
    if (on) {
      if (ol.err) h += '<div class="err">Не се заредиха: ' + esc(errBg(ol.err)) + '</div><button type="button" class="btn ghost" data-a="tRetry" data-s="old">Опитай пак</button>';
      else if (!ol.items) h += offNow() && !ol.loading ? '<p class="grp-e">📴 По-старите решения — когато има покритие.</p>' : '<p class="fd-end"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
      else {
        var ov = ol.items.filter(function (t) { return !isHid(t.id, hi); });
        h += ov.length ? ov.map(function (t) { return dcCard(t, hi); }).join('') : '<p class="grp-e">✅ Няма по-стари отворени решения.</p>';
        if ((ol.total || 0) > 107) h += '<p class="small muted">Показани са първите 107.</p>';
      }
    }
    return h;
  }
  function renderOpen(force) {
    var el = box('#tb-open'); if (!el) return;
    var h = openHtml();
    if (!force && el.node._h != null && el.node._h !== h && scrolledFar()) { TB.defer.open = true; showPill(); renderOpenN(); return; }
    TB.defer.open = false;
    el.innerHTML = h;
    // лентата на „Отмени“ тече от натискането, не от последното пречертаване
    Array.prototype.forEach.call(el.node.querySelectorAll('.dc.undoing'), function (a) {
      var u = TB.undo[+a.getAttribute('data-tid')], b = a.querySelector('.dc-bar');
      if (u && b) b.style.animationDuration = Math.max(0, 4000 - (Date.now() - u.t0)) + 'ms';
    });
    // появяване само на нови карти — пречертаването след ✓ / „Отмени“ / дотегляне не мига по всички карти
    Array.prototype.forEach.call(el.node.querySelectorAll('.dc[data-tid]'), function (a) {
      var k = a.getAttribute('data-tid');
      if (!TB.cardSeen[k]) { TB.cardSeen[k] = 1; a.classList.add('new'); }
    });
    renderOpenN();
  }
  function fdCard(t, r) {
    var ist = t.istina && t.istina !== 'saobshteno' ? ISTINA[t.istina] : null, hot = (t.vajnost || 1) >= 3, izv = t.izvori || [];
    var st = r.status === 'vpisana' ? 'вписан ✓' : (r.status === 'odobrena' ? 'одобрен' : 'чернова') + ' v' + r.versiq;
    return '<article class="fd o-' + esc(r.obekt) + '">' +
      '<div class="fd-h"><span class="fd-av" aria-hidden="true">' + emoT(t) + '</span><div class="fd-hm"><div class="fd-t">' + esc(SELN[r.obekt] || r.obekt) + ' · ' + esc(RAZDELI[(t.razdel || 0) - 1] || 'Промяна') + '</div>' +
        '<div class="fd-s">' + esc(lcDay(r.data)) + ' · ' + esc(st) + '</div></div></div>' +
      '<p class="fd-x">' + esc(t.tekst) + '</p>' +
      (ist || hot ? '<div class="fd-p">' + (ist ? '<span class="pill ' + ist[1] + '">' + ist[0] + '</span>' : '') + (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') + '</div>' : '') +
      '<div class="fd-a">' +
        (izv.length ? '<button type="button" class="srcb" data-a="tSrc" data-tid="' + esc(t.id) + '" aria-label="Източници: ' + izv.length + '">' +
          izv.map(function (s) { return '<span class="ref">' + esc(s.n) + '</span>'; }).join('') + '<span class="srcb-l">' + (izv.length === 1 ? 'източник' : 'източника') + ' ›</span></button>'
          : '<span class="fd-ns">няма източник</span>') +
        '<button type="button" class="pa" data-a="tAct" data-tid="' + esc(t.id) + '">→ Действие</button>' +
        '<button type="button" class="pa" data-a="tOpen" data-o="' + esc(r.obekt) + '" data-den="' + esc(r.id) + '" data-tid="' + esc(t.id) + '">Денят ›</button></div></article>';
  }
  // Потокът по групи (една дата = <div class="fd-g">, display:contents — подредбата е същата): пише се само групата,
  // чийто HTML се е сменил — правилото на box(), но за всяко дете. Нова порция или подпис за лентите не пресъздават
  // вече заредените миниатюри и бутоните над пръста (без премигване и без загубен фокус).
  function feedPut(n, parts) {
    var have = {};
    for (var k = n.childNodes.length - 1; k >= 0; k--) { var x = n.childNodes[k]; if (x._g) have[x._g] = x; else n.removeChild(x); }
    parts.forEach(function (p, i) {
      var c = have[p[0]];
      if (c) delete have[p[0]];
      else { c = document.createElement('div'); c.className = 'fd-g'; c._g = p[0]; c._h = null; }
      if (c._h !== p[1]) { c.innerHTML = p[1]; c._h = p[1]; }
      if (n.children[i] !== c) n.insertBefore(c, n.children[i] || null);
    });
    Object.keys(have).forEach(function (g) { n.removeChild(have[g]); });
  }
  function renderFeed() {
    var n = $('#tb-feed'); if (!n) return;
    var f = selState(TB.sel).feed, parts = [], by = {}, kn = {};
    if (f) {
      f.items.forEach(function (t) { (by[t.den_id] = by[t.den_id] || []).push(t); });
      // по дати: разделител → ленти със снимки (Амур преди Скай; само за първите 20 дати — паметта на iPhone) → картите
      var grp = [], cur = null;
      f.rows.slice(0, f.pos).forEach(function (r) {
        var its = by[r.id]; if (!its || !its.length) return;   // дни без промени не се показват (и лентата им я няма)
        if (!cur || cur.data !== r.data) { cur = { data: r.data, rows: [] }; grp.push(cur); }
        cur.rows.push(r);
      });
      grp.forEach(function (g, gi) {
        var nw = f.rows.some(function (x) { return x.data === g.data && isNewDay(x); });
        var h = '<div class="fd-day"><span>' + esc(dayTitle(g.data)) + '</span>' + (nw ? '<span class="pill p-new">🆕 ново</span>' : '') + '</div>';
        if (gi < 20) h += g.rows.slice().sort(function (a, b) { return a.obekt < b.obekt ? -1 : a.obekt > b.obekt ? 1 : 0; }).map(function (r) { return fdPh(f, r); }).join('');
        g.rows.forEach(function (r) {
          var its = by[r.id];
          its.sort(function (a, b) { return (b.vajnost || 1) - (a.vajnost || 1) || (a.red || 0) - (b.red || 0) || a.id - b.id; });
          h += its.map(function (t) { return fdCard(t, r); }).join('');
        });
        var key = g.data + (kn[g.data] ? '~' + kn[g.data] : '');   // същата дата втори път (не бива, но ключът остава уникален)
        kn[g.data] = (kn[g.data] || 0) + 1;
        parts.push([key, h]);
      });
    }
    feedPut(n, parts);
    renderFeedEnd();
  }
  function renderFeedEnd() {
    var el = box('#tb-end'); if (!el) return;
    var f = selState(TB.sel).feed, h = '';
    if (!f) h = offNow() ? '<p class="fd-end">📴 Промените — когато има покритие</p>' : '<p class="fd-end"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
    else if (f.err) h = '<div class="err">Промените не се заредиха: ' + esc(errBg(f.err)) + '</div><button type="button" class="btn ghost" data-a="tRetry" data-s="feed">Опитай пак</button>';
    else if (f.done) {
      var last = f.rows[f.rows.length - 1];
      h = f.items.length ? '<p class="fd-end">Това е всичко' + (last ? ' от ' + esc(lcDay(last.data)) : '') + ' ✅</p>' : '<p class="grp-e">Още няма промени.</p>';
    }
    else if (f.loading) h = '<p class="fd-end"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
    else if (offNow()) h = '<p class="fd-end">📴 Още дни — когато има покритие</p>';
    else h = '<button type="button" class="btn ghost" data-a="tFeedMore">Още ▾</button>';
    el.innerHTML = h;
  }

  // --- „Хора на обекта“: SVG без библиотеки ---
  function horaOf(r) { return r && r.hora != null && r.hora !== '' ? +r.hora : null; }
  // 14 поредни календарни дни, завършващи с най-новия ден на избора (дните — през датите, не през ms) [К16]
  function chartDays(sel) {
    var rows = selRows(sel); if (!rows.length) return null;
    var by = {}; rows.forEach(function (r) { (by[r.data] = by[r.data] || {})[r.obekt] = r; });
    var L = parseD(rows[0].data), out = [];
    for (var i = 13; i >= 0; i--) {
      var dt = new Date(L.getFullYear(), L.getMonth(), L.getDate() - i), k = ymd(dt), m = by[k] || {}, wd = dt.getDay();
      var parts = sel === 'all' ? ['ag', 'soft'] : [sel];
      var vals = parts.map(function (p) { return horaOf(m[p]); }), any = vals.some(function (v) { return v != null; });
      out.push({ k: k, dt: dt, wd: wd, we: wd === 0 || wd === 6, parts: parts, vals: vals, any: any, m: m,
        tot: any ? vals.reduce(function (a, v) { return a + (v || 0); }, 0) : null });
    }
    return out;
  }
  function weekKey(dt) { var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); }
  // средно за седмица (пн–нд): от пн–пт с хора > 0, само дните в обхвата
  function weeksOf(days) {
    var W = {}, order = [];
    days.forEach(function (d, i) {
      var wk = weekKey(d.dt);
      if (!W[wk]) { W[wk] = { k: wk, i0: i, i1: i, v: [], ds: [] }; order.push(W[wk]); }
      var w = W[wk]; w.i1 = i;
      // при „Всички“ денят влиза в средното само ако ВСИЧКИ обекти имат хора (липсващият не е 0 — иначе сборът лъже)
      if (!d.we && d.vals.every(function (v) { return v != null; }) && d.tot > 0) { w.v.push(d.tot); w.ds.push(d.dt); }
    });
    order.forEach(function (w) { w.avg = w.v.length ? w.v.reduce(function (a, b) { return a + b; }, 0) / w.v.length : null; });
    return order;
  }
  function rngLbl(a, b) { return sameDay(a, b) ? ddmm(a) : a.getMonth() === b.getMonth() ? pad(a.getDate()) + '–' + ddmm(b) : ddmm(a) + '–' + ddmm(b); }
  function chartHora(sel, days, selK, ttl) {
    var W = 343, H = 180, ml = 26, mr = 6, mt = 16, mb = 34, pw = W - ml - mr, ph = H - mt - mb, slot = pw / 14, bw = 14, mx = 0, s = '';
    days.forEach(function (d) { if (d.tot != null && d.tot > mx) mx = d.tot; });
    var ymax = Math.max(10, Math.ceil(mx / 10) * 10);
    function y(v) { return mt + ph - v / ymax * ph; }
    function f1(n) { return Math.round(n * 10) / 10; }
    function seg(x, yt, w, h, r) {
      if (h <= 0) return '';
      if (!r || h < r) return 'M' + f1(x) + ',' + f1(yt) + 'h' + w + 'v' + f1(h) + 'h' + (-w) + 'z';
      return 'M' + f1(x) + ',' + f1(yt + h) + 'V' + f1(yt + r) + 'Q' + f1(x) + ',' + f1(yt) + ' ' + f1(x + r) + ',' + f1(yt) + 'H' + f1(x + w - r) +
        'Q' + f1(x + w) + ',' + f1(yt) + ' ' + f1(x + w) + ',' + f1(yt + r) + 'V' + f1(yt + h) + 'Z';
    }
    var selI = -1;
    days.forEach(function (d, i) {
      var x0 = ml + i * slot;
      if (d.we) s += '<rect class="c-we" x="' + f1(x0 + 1) + '" y="' + (mt - 8) + '" width="' + f1(slot - 2) + '" height="' + (H - mt + 6) + '" rx="5"/>';
      if (d.k === selK) { selI = i; s += '<rect class="c-sel" x="' + f1(x0 + 1) + '" y="' + (mt - 8) + '" width="' + f1(slot - 2) + '" height="' + (H - mt + 6) + '" rx="5"/>'; }
    });
    [0, ymax / 2, ymax].forEach(function (v) {
      s += '<line class="c-grid" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + f1(y(v)) + '" y2="' + f1(y(v)) + '"/><text class="c-ax" x="' + (ml - 5) + '" y="' + f1(y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    });
    days.forEach(function (d, i) {
      var cx = ml + i * slot + slot / 2, bx = cx - bw / 2;
      if (!d.any) { if (!d.we) s += '<line class="c-nd" x1="' + f1(bx) + '" x2="' + f1(bx + bw) + '" y1="' + f1(y(0) - 1) + '" y2="' + f1(y(0) - 1) + '"/>'; }   // делник без данни
      else if (!d.tot) s += '<line class="c-zero" x1="' + f1(bx) + '" x2="' + f1(bx + bw) + '" y1="' + f1(y(0) - 1) + '" y2="' + f1(y(0) - 1) + '"/>';
      else {
        var acc = 0, idx = [];
        d.vals.forEach(function (v, j) { if (v > 0) idx.push(j); });
        s += '<g class="gbar' + (i === days.length - 1 ? ' last' : '') + '" style="animation-delay:' + (i * 20) + 'ms">';
        idx.forEach(function (j, n) {
          var v = d.vals[j], yb = y(acc), yt = y(acc + v), gap = n > 0 ? 2 : 0;
          acc += v;
          s += '<path class="c-b' + (sel === 'all' ? ' c-' + d.parts[j] : '') + '" d="' + seg(bx, yt, bw, (yb - yt) - gap, n === idx.length - 1 ? 3 : 0) + '"/>';
        });
        s += '</g>';
      }
      if (d.k === selK && d.tot != null) s += '<text class="c-val" x="' + f1(cx) + '" y="' + f1(y(d.tot) - 5) + '" text-anchor="middle">' + d.tot + '</text>';
      s += '<text class="c-day' + (d.k === selK ? ' on' : '') + (d.we ? ' we' : '') + '" x="' + f1(cx) + '" y="' + (H - mb + 15) + '" text-anchor="middle">' + d.dt.getDate() + '</text>' +
        '<text class="c-wd' + (d.we ? ' we' : '') + '" x="' + f1(cx) + '" y="' + (H - mb + 30) + '" text-anchor="middle">' + DNI_K[d.wd] + '</text>';
    });
    // средно за седмицата — пунктир; надпис само на последната
    var wk = weeksOf(days), lastW = null;
    wk.forEach(function (w) { if (w.avg != null) lastW = w; });
    wk.forEach(function (w) {
      if (w.avg == null) return;
      var x1 = ml + w.i0 * slot + 2, x2 = ml + (w.i1 + 1) * slot - 2, yy = y(w.avg);
      s += '<line class="c-avg" x1="' + f1(x1) + '" x2="' + f1(x2) + '" y1="' + f1(yy) + '" y2="' + f1(yy) + '"/>';
      if (w === lastW) {
        // етикетът (~40 px) не бива да излиза вдясно от графиката: седмица от 1 ден в края (понеделник) → подравнен вдясно
        var ly = yy - 5, endA = x1 + 40 > W - mr, c0 = endA ? w.i1 - 1 : w.i0, c1 = endA ? w.i1 : w.i0 + 1;
        if (selI >= c0 && selI <= c1 && days[selI].tot != null && Math.abs(y(days[selI].tot) - 5 - ly) < 14) ly = Math.min(ly, y(days[selI].tot) - 20);
        s += '<text class="c-avgt" x="' + f1(endA ? x2 : x1) + '" y="' + f1(Math.max(11, ly)) + '" text-anchor="' + (endA ? 'end' : 'start') + '">ср. ' + Math.round(w.avg) + '</text>';
      }
    });
    days.forEach(function (d, i) {
      var lab = lcDay(d.k) + ': ' + (!d.any ? (d.we ? 'почивен, няма данни' : 'няма данни')
        : sel === 'all' ? d.parts.map(function (p, j) { return SELK[p] + ' ' + (d.vals[j] == null ? '—' : d.vals[j]); }).join(', ') + ' — общо ' + d.tot + ' души'
        : d.tot + ' души');
      s += '<rect class="c-hit" x="' + f1(ml + i * slot) + '" y="0" width="' + f1(slot) + '" height="' + H + '" data-a="tBar" data-d="' + d.k + '" role="button" tabindex="0" aria-pressed="' + (d.k === selK) + '" aria-label="' + esc(lab) + '"/>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(ttl) + '">' + s + '</svg>';
  }
  function chartDetail(sel, d) {
    var lbl = '<b>' + esc(capDay(d.k)) + '</b>';
    if (sel === 'all') {
      var a = d.m.ag || null, so = d.m.soft || null, bits = [];
      if (a) bits.push('Амур ' + (horaOf(a) == null ? '—' : horaOf(a)));
      if (so) bits.push('Скай ' + (horaOf(so) == null ? '—' : horaOf(so)));
      return '<div class="hc-d"><div class="hc-dl">' + lbl + ' · ' + (bits.length ? '👷 ' + esc(bits.join(' · ')) + (d.tot != null && bits.length > 1 ? ' · общо <b>' + d.tot + '</b>' : '') : (d.we ? 'почивен ден' : 'няма качен ден')) + '</div>' +
        (a || so ? '<div class="hc-db">' +
          (a ? '<button type="button" class="btn ghost hc-go o-ag" data-a="tOpen" data-o="ag" data-den="' + esc(a.id) + '">Амур ›</button>' : '') +
          (so ? '<button type="button" class="btn ghost hc-go o-soft" data-a="tOpen" data-o="soft" data-den="' + esc(so.id) + '">Скай ›</button>' : '') + '</div>' : '') + '</div>';
    }
    var r = d.m[sel] || null, hv = horaOf(r);
    return '<div class="hc-d"><div class="hc-dl">' + lbl + ' · ' + (r ? (hv == null ? 'няма данни за хора' : '👷 <b>' + hv + '</b> души') + ' · ' + esc(STL[r.status] || r.status) : (d.we ? 'почивен ден' : 'няма качен ден')) + '</div>' +
      (r ? '<div class="hc-db"><button type="button" class="btn ghost hc-go" data-a="tOpen" data-o="' + esc(sel) + '" data-den="' + esc(r.id) + '">Отвори деня ›</button></div>' : '') + '</div>';
  }
  // Подпис с дати, не „тази/миналата седмица“ [К27]
  function chartWeek(days) {
    var wk = weeksOf(days).filter(function (w) { return w.avg != null; });
    if (!wk.length) return '';
    var a = wk[wk.length - 1], b = wk.length > 1 ? wk[wk.length - 2] : null, n = a.v.length, ra = Math.round(a.avg);
    var h = '<b>' + rngLbl(a.ds[0], a.ds[n - 1]) + '</b>: ср. <b>' + ra + '</b> души (' + (n >= 5 ? 'пн–пт' : n + (n === 1 ? ' ден' : ' дни')) + ')';
    var pm = parseD(a.k); pm.setDate(pm.getDate() - 7);
    if (b && b.k === ymd(pm)) {
      var rb = Math.round(b.avg), df = ra - rb;
      h += ' · ' + rngLbl(b.ds[0], b.ds[b.ds.length - 1]) + ': ' + rb + ' · ' + (df > 0 ? '<span class="up">▲ ' + df + '</span>' : df < 0 ? '<span class="dn">▼ ' + (-df) + '</span>' : 'без промяна');
    }
    return '<p class="hc-w">' + h + '</p>';
  }
  function renderChart(force) {
    var el = box('#tb-hora'); if (!el) return;
    if (!force && TB.defer.chart) return;
    TB.defer.chart = false;
    var sel = TB.sel, days = chartDays(sel);
    if (!days || !days.some(function (d) { return d.any; })) { el.innerHTML = '<p class="grp-e">Още няма дни с хора за този период.</p>'; return; }
    var selK = TB.chart.sel && days.some(function (d) { return d.k === TB.chart.sel; }) ? TB.chart.sel : days[days.length - 1].k;
    var sd = days.filter(function (d) { return d.k === selK; })[0];
    var ttl = 'Хора по дни · ' + rngLbl(days[0].dt, days[13].dt);
    var anim = TB.chart.anim && view === 'tablo';   // стълбовете израстват само при първо показване
    if (anim) TB.chart.anim = false;
    el.innerHTML = '<div class="card hc' + (anim ? ' anim' : '') + '"><div class="hc-h"><span class="hc-t">' + esc(ttl) + '</span>' +
      (sel === 'all' ? '<span class="hc-lg"><span><i class="lg-ag"></i>Амур</span><span><i class="lg-soft"></i>Скай</span></span>' : '') + '</div>' +
      chartHora(sel, days, selK, ttl) + chartDetail(sel, sd) + chartWeek(days) + '</div>';
  }
  // „↑ Нови промени“ — под горната лента
  function showPill() {
    var p = $('#tb-new'); if (!p || view !== 'tablo') return;
    var tw = $('.topwrap');
    p.style.top = Math.round((tw ? tw.getBoundingClientRect().bottom : 60) + 8) + 'px';
    p.hidden = false;
  }
  function hidePill() { var p = $('#tb-new'); if (p) p.hidden = true; }
  function anyDefer() { return !!(TB.defer.open || TB.defer.chart || TB.defer.feed); }
  function applyDeferred() {
    var d = TB.defer; TB.defer = {}; hidePill();
    if (d.open) renderOpen(true);
    if (d.chart) renderChart(true);
    if (d.feed) feedReset(TB.sel);
    renderTabloCounts();
  }
  function tNew() {
    window.scrollTo(0, 0);
    TB.defer.open = true; TB.defer.chart = true; TB.defer.feed = true;
    applyDeferred();
  }

  // --- действия от Таблото ---
  function tFind(tid) {
    var found = null;
    [TB.sel, 'ag', 'soft', 'all'].some(function (s) {
      var st = TB.S[s]; if (!st) return false;
      return [st.open && st.open.items, st.old && st.old.items, st.feed && st.feed.items].some(function (l) {
        return (l || []).some(function (t) { if (t.id === tid) { found = t; return true; } return false; });
      });
    });
    return found;
  }
  function tDay(t) {
    if (t.dni) return t.dni;
    var d = dniById(t.den_id); if (d) return d;
    var f = selState(TB.sel).feed, r = f ? f.rows.filter(function (x) { return x.id === t.den_id; })[0] : null;
    return r || {};
  }
  // Мерилото: видимото време от показването на Таблото до първото действие — веднъж на показване [К33].
  function tMeasure() {
    if (TB.measured || view !== 'tablo') return;
    TB.measured = true;
    send('metriki', { vid: 'tablo_sek', stoinost: Math.max(1, Math.round((activeMs() - TB.shownAt) / 1000)), den_id: null }).catch(function () {});
  }
  // ✓ Отговорено: 4 с „Отмени“ преди записа (INSERT-ът е необратим) [К21]
  function tOk(tid) {
    var t = tFind(tid); if (!t || !t.dni || TB.undo[tid]) return;
    tMeasure();
    TB.undo[tid] = { t: t, t0: Date.now(), timer: setTimeout(function () { tCommit(tid); }, 4000) };
    renderOpen(true);
  }
  function tUndo(tid) {
    var u = TB.undo[tid]; if (!u) return;
    clearTimeout(u.timer); delete TB.undo[tid];
    renderOpen(true);
  }
  function commitUndos() { Object.keys(TB.undo).forEach(function (k) { tCommit(+k); }); }
  function tCommit(tid) {
    var u = TB.undo[tid]; if (!u) return;
    clearTimeout(u.timer); delete TB.undo[tid];
    var t = u.t, d = t.dni || {};
    TB.closed[tid] = { at: nowIso(), o: d.obekt || null, d: d.data || null, ok: 1, sent: null };
    TB.inflight[tid] = 1;
    saveTablo(); renderOpen(true); renderTabloCounts(); renderTabs();
    send('resheniq', { den_id: t.den_id, tochka_id: t.id, vid: 'potvardi', tekst: 'отговорено', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() + ' · табло' }, { tt: t.tekst }).then(function (r) {
      delete TB.inflight[tid];
      toast(r === 'sent' ? 'Отговорено ✓' : 'Отговорено · ⏳ чака връзка');
      saveTablo(); renderCurrent();
      if (r === 'sent') refillOpen();
    }, function (e) {
      delete TB.inflight[tid]; delete TB.closed[tid];
      saveTablo(); renderOpen(true); renderCurrent();
      toast('Не се записа: ' + errBg(e), 'bad');
    });
  }
  // След ✓ в списъка остават 4 — дотегля следващото (SELECT след натискане)
  function refillOpen() {
    var st = selState(TB.sel), o = st.open; if (!o || o.all || o.err || offNow()) return;
    var hi = hideInfo();
    if (visOpen(o, hi).length < Math.min(5, openTotal(TB.sel, o, hi))) loadOpen(TB.sel, true);
  }
  function tAct(tid) {
    var t = tFind(tid); if (!t) return;
    var d = tDay(t);
    openPlus(null, { src: 'tablo', tid: t.id, den_id: t.den_id, tekst: t.tekst, o: d.obekt || null, d: d.data || null, close: !!t.dni });
  }
  function tOpenDay(el) {
    var o = el.getAttribute('data-o'), id = +el.getAttribute('data-den') || null, tid = +el.getAttribute('data-tid') || null;
    if (!id || (o !== 'ag' && o !== 'soft')) return;
    goDay(o, id, tid);
  }
  // Ден за обекта и деня на точката: денят е избран в лентата, точката светва под горната лента.
  // ph = true → след рисуването денят се скролва до „📷 Снимки“ („+N“ от лентата на Таблото)
  function goDay(o, id, tid, ph) {
    if (offNow() && !(S.den && S.den.id === id) && !dayCached(o, id)) { toast('Този ден не е запазен на телефона — отвори го, когато има покритие.'); return; }
    tMeasure();
    setObekt(o);
    S.flash = { den: id, tid: tid || null, ph: !!ph };
    go('day', { den: id, force: true });
  }
  function flashPoint() {
    var f = S.flash; if (!f || view !== 'day' || !S.den || S.den.id !== f.den) return;
    S.flash = null;
    if (f.ph) {   // под горната лента, като точката
      var p = $('#ph'); if (!p) return;
      var tw0 = $('.topwrap'), off0 = (tw0 ? tw0.getBoundingClientRect().height : 0) + 10;
      window.scrollTo(0, Math.max(0, p.getBoundingClientRect().top + (window.pageYOffset || 0) - off0));
      return;
    }
    if (!f.tid) return;
    var el = screen.querySelector('.pc[data-tid="' + f.tid + '"]');
    if (!el) { toast('Точката е сменена в нова версия — прегледай деня'); return; }
    var tw = $('.topwrap'), off = (tw ? tw.getBoundingClientRect().height : 0) + 10;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || 0) - off));
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1600);
  }
  function tWait() {
    var pd = pendingDays(TB.sel);
    if (!pd.length) { toast('Няма дни за одобрение ✓'); return; }
    goDay(pd[0].obekt, pd[0].id, null);
  }
  function tSel(v) {
    if ((v !== 'ag' && v !== 'soft' && v !== 'all') || v === TB.sel) return;
    commitUndos();
    TB.sel = v; lset(K2.obekt, v); setBodyO(v);
    TB.chart.sel = null;
    renderTablo(); renderTabs();
    if (!TB.hasBase) { loadTablo(); return; }
    loadSel(v);
  }
  function tMore(v) {
    var o = selState(TB.sel).open; if (!o) return;
    if (v === 'less') {
      o.all = false; renderOpen(true);
      var s = $('#tb-open-s'); if (s && s.getBoundingClientRect().top < 0) jump('tb-open-s');
      return;
    }
    if (offNow()) { toast('Всички решения — когато има покритие.'); return; }
    o.all = true; o.loadingAll = true; renderOpen(true);
    loadOpen(TB.sel, true);   // наново range(0, 106) и подмяна на списъка [К24]
  }
  function tOld() {
    var st = selState(TB.sel);
    if (st.old && st.old.shown) { st.old.shown = false; renderOpen(true); return; }
    if (!st.old) st.old = { items: null, shown: true };
    st.old.shown = true;
    if (!st.old.items && !st.old.loading && !offNow()) loadOld(TB.sel);
    renderOpen(true);
  }
  function tBar(k) {
    if (!k) return;
    var ae = document.activeElement, kb = !!(ae && ae.getAttribute && ae.getAttribute('data-a') === 'tBar');
    TB.chart.sel = k; renderChart(true);
    if (kb) { var r = document.querySelector('#tb-hora .c-hit[data-d="' + k + '"]'); if (r && r.focus) { try { r.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function tRetry(s) {
    var st = selState(TB.sel);
    if (s === 'open') { if (st.open && st.open.err) { if (st.open.at) st.open.err = null; else st.open = null; } renderOpen(true); loadOpen(TB.sel, true); }
    else if (s === 'feed') { if (st.feed) { st.feed.err = null; renderFeedEnd(); loadFeedPortion(TB.sel, st.feed, false); } else feedReset(TB.sel); }
    else if (s === 'old') { if (st.old) { st.old.err = null; loadOld(TB.sel); renderOpen(true); } }
    else { TB.baseErr = null; if (S.forceOff) { toast('Демо: покритието е изключено'); return; } S.offline = false; loadTablo(); }
  }
  function tSrc(tid) {
    var t = tFind(tid); if (!t) return;
    normT(t);
    openSheet('Източници (' + t.izvori.length + ')', '<p class="sh-q">' + esc(clip(t.tekst, 220)) + '</p>' + t.izvori.map(srcWithPh).join('') + SRC_NOTE);
    srcPhStart(t.den_id, t.izvori);
  }
  // „+“ според екрана: от Таблото/Действия денят е празен (обектът — в етикета, [К28])
  function plusCtx() { return view === 'tablo' ? { src: 'tablo', o: TB.sel } : view === 'deistviq' ? { src: 'acts' } : null; }

  // --- екран „Действия“ (минимален) ---
  function actObj(a) {
    var d = a.den_id != null ? (dniById(a.den_id) || (S.den && S.den.id === a.den_id ? S.den : null) || findDni(a.den_id)) : null;
    var o = d ? (d.obekt || OBEKT_KOD) : null;
    if (d && (o === 'ag' || o === 'soft')) return '<button type="button" class="ochip o-' + o + ' och-b" data-a="tOpen" data-o="' + o + '" data-den="' + esc(d.id) + '">' + SELK[o] + ' · ' + esc(ddmm(parseD(d.data))) + '</button>';
    var m = /·\s*(ag|soft)\s*$/.exec(a.izvor || '');
    return m ? '<span class="ochip o-' + m[1] + '">' + SELK[m[1]] + '</span>' : '';
  }
  function renderActsTab() {
    if (view !== 'deistviq') return;
    var n = nowMs(), lim = n + 48 * 36e5;
    var q = queue().filter(function (it) { return it.tbl === 'deistviq'; }).map(function (it) { return Object.assign({ _pend: true, _err: it.err || '', sazdadeno: it.at, id: 'q' + it.qid }, it.row); }).reverse();
    var G = { soon: [], later: [], none: [], err: [], done: [], old: [] };
    S.deistviq.forEach(function (a) {
      var t = a.srok ? Date.parse(a.srok) : NaN;
      if (a.status === 'izpalneno') G.done.push(a);
      else if (a.status === 'greshka') G.err.push(a);
      else if (isNaN(t)) G.none.push(a);
      else if (t <= n) G.old.push(a);
      else if (t <= lim) G.soon.push(a);
      else G.later.push(a);
    });
    function bySrok(x, y) { return Date.parse(x.srok) - Date.parse(y.srok); }
    function byNew(x, y) { var a1 = String(x.obnoveno || x.sazdadeno || ''), b1 = String(y.obnoveno || y.sazdadeno || ''); return a1 < b1 ? 1 : a1 > b1 ? -1 : 0; }
    G.soon.sort(bySrok); G.later.sort(bySrok); G.none.sort(byNew); G.err.sort(byNew); G.done.sort(byNew); G.old.sort(function (x, y) { return bySrok(y, x); });
    function ul(list, k) { return '<ul class="acts">' + list.map(function (a) { return actRow(a, k || 'obj'); }).join('') + '</ul>'; }
    function grp(t, cls, list, k) { return list.length ? '<section class="at-g"><h3 class="at-h ' + cls + '">' + t + ' <span class="at-n">' + list.length + '</span></h3>' + ul(list, k) + '</section>' : ''; }
    function det(id, t, list, note, gray) {
      return list.length ? '<details class="at-d' + (gray ? ' gray' : '') + '" id="' + id + '"' + (S.actOpen[id] ? ' open' : '') + '><summary><span>' + t + ' (' + list.length + ')</span><span class="chev" aria-hidden="true">▾</span></summary>' +
        (note ? '<p class="small muted at-note">' + note + '</p>' : '') + ul(list) + '</details>' : '';
    }
    var total = q.length + S.deistviq.length, got = !!S.actsAt;
    // докато списъкът от базата не е дошъл, празното „Още няма“ би лъгало
    var wait = got ? '' : offNow() ? '<p class="grp-e">📴 Действията — когато има покритие.</p>'
      : S.actsErr ? '<div class="err">Действията не се заредиха: ' + esc(errBg(S.actsErr)) + '</div><button type="button" class="btn ghost" data-a="refresh">Опитай пак</button>'
      : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам действията…</p>';
    screen.innerHTML = '<section class="actsec at">' +
      '<div class="acts-h"><h2>Моите действия</h2><span class="grp-n" style="--c:var(--mine)">' + (got ? total : '…') + '</span></div>' + wait +
      (q.length ? grp('⏳ На телефона — чакат връзка', '', q) : '') +
      grp('🔔 До 48 ч', 'warn', G.soon, 'soon') + grp('📅 Предстоящи', '', G.later) + grp('📌 Без срок', '', G.none) + grp('⚠️ Грешка', 'bad', G.err) +
      det('ad-done', '✅ Изпълнени', G.done.slice(0, 20)) +
      det('ad-old', 'По-стари без отметка', G.old, 'Телефонът още не може да отметне изпълнено — това идва в следващ етап.', true) +
      (total || !got ? '' : '<p class="grp-e">Още няма. Натисни „+“.</p>') + '</section>';
  }

  // ---------- всички натискания ----------
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el || el.disabled) return;
    var a = el.getAttribute('data-a'), tid = +el.getAttribute('data-tid') || null;
    switch (a) {
      case 'scrim': if (e.target === el) closeSheet(); break;
      case 'close': closeSheet(); break;
      case 'day': openDay(+el.getAttribute('data-id')); break;
      case 'fresh': openFresh(); break;
      case 'jump': jump(el.getAttribute('data-g')); break;
      case 'src': openSrc(tid); break;
      case 'ref': openRef(el.getAttribute('data-n')); break;
      case 'ok': if (okGuard(tid)) doConfirm(tid, el); break;
      case 'fix': if (pointGuard()) openFix(tid); break;
      case 'fixSave': saveFix(tid, el); break;
      case 'act': openPlus(tid); break;
      case 'plus': openPlus(null, plusCtx()); break;
      case 'pick': if (P) { P.vid = el.getAttribute('data-v'); renderPlusForm(); } break;
      case 'plusBack': renderPlusChooser(); break;
      case 'srok': pickSrok(el); break;
      case 'plusSave': savePlus(el); break;
      case 'approve': openApprove(); break;
      case 'approveGo': doApprove(el); break;
      case 'reload': closeSheet(); reloadDen(); break;
      case 'qerr': openErrSheet(); break;
      case 'qretry': qRetry(el.getAttribute('data-q')); break;
      case 'qdrop': qDrop(el.getAttribute('data-q')); break;
      case 'allActs': S.showAllActs = !S.showAllActs; renderActs(); break;
      case 'karti': viewKarti(); break;
      case 'back': go('day', { force: true }); break;
      case 'logout': logout(); break;
      case 'retry': if (view === 'day') boot(S.den ? S.den.id : null); else routeStart(); break;
      case 'dNew': closeSheet(); demoNewVersion(); break;
      case 'dOff': demoToggleOff(el); break;
      case 'dReset': demoReset(); break;
      // Етап 2
      case 'tab': go(el.getAttribute('data-v')); break;
      case 'refresh': refreshCurrent(); break;
      case 'tSel': tSel(el.getAttribute('data-v')); break;
      case 'tOk': tOk(tid); break;
      case 'tUndo': tUndo(tid); break;
      case 'tAct': tAct(tid); break;
      case 'tOpen': tOpenDay(el); break;
      case 'tMore': tMore(el.getAttribute('data-v')); break;
      case 'tOld': tOld(); break;
      case 'tBar': tBar(el.getAttribute('data-d')); break;
      case 'tFeedMore': feedMore(); break;
      case 'tNew': tNew(); break;
      case 'tWait': tWait(); break;
      case 'tSoon': go('deistviq'); break;
      case 'tRetry': tRetry(el.getAttribute('data-s')); break;
      case 'tSrc': tSrc(tid); break;
      case 'nextDay': openDay(+el.getAttribute('data-id')); break;
      case 'allActs2': go('deistviq'); break;
      case 'demoSheet': openDemoSheet(); break;
      case 'dDay': closeSheet(); demoNewDay(); break;
      case 'dObekt': dSwitchObekt(); break;
      // Етап 3 — снимки
      case 'ph': phOpen(+el.getAttribute('data-i') || 0); break;
      case 'phMore': phMore(); break;
      case 'phRetry': phRetry(); break;
      case 'phJump': jump('ph'); break;
      case 'srcPh': srcPhOpen(el.getAttribute('data-msg'), +el.getAttribute('data-i') || 0); break;
      case 'tPh': tPhOpen(+el.getAttribute('data-den') || null, +el.getAttribute('data-sid') || null); break;
      case 'tPhMore': { var po = el.getAttribute('data-o'), pd = +el.getAttribute('data-den') || null; if (pd && (po === 'ag' || po === 'soft')) goDay(po, pd, null, true); } break;
      case 'pvPrev': pvStep(-1); break;
      case 'pvNext': pvStep(1); break;
      case 'pvClose': closeViewer(); break;
    }
  });
  // картинките на плочките: грешка → сива / ново подписване; в демото — кои са видени (за „без покритие“)
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-p')) phImgErr(t); }, true);
  document.addEventListener('load', function (e) { var t = e.target; if (DEMO && t && t.tagName === 'IMG' && t.getAttribute('src')) { var p = t.getAttribute('data-p'); if (p) DEMO_SEEN[p] = 1; } }, true);
  document.addEventListener('keydown', function (e) {
    if (PV && pvKey(e)) return;   // прегледът е над листа: Esc затваря първо него [К28]
    if (e.key === 'Escape' && sheetEl) { closeSheet(); return; }
    // колоните на графиката са role="button" (SVG) — Enter/Space избира деня
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('data-a') && t.tagName !== 'BUTTON') {
      e.preventDefault();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  document.addEventListener('toggle', function (e) {
    var id = e.target && e.target.id;
    if (id === 'fullD') S.fullOpen = e.target.open;
    else if (id === 'ad-done' || id === 'ad-old') S.actOpen[id] = e.target.open;
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { commitUndos(); if (view === 'tablo') seenWrite(); return; }   // „Отмени“ не чака скрито приложение
    if (view === 'day') { poll(true); if (S.den && !offNow() && Date.now() - PH.at > PH_C1_MS) phLoad(S.den.id); }   // [К30]
    else if (view === 'tablo' && stale60(TB.okAt)) { TB.seenBase = seenRead() || TB.seenBase; loadTablo(); }
    else if (view === 'deistviq' && stale60(S.actsOkAt)) loadActs();
  });
  window.addEventListener('pagehide', function () { commitUndos(); if (view === 'tablo') seenWrite(); });
  var scT = 0;
  window.addEventListener('scroll', function () {
    if (view !== 'tablo' || scT) return;
    var cb = function () {
      scT = 0;
      if ((window.pageYOffset || 0) < 80 && anyDefer()) applyDeferred();
      feedNear();
    };
    scT = window.requestAnimationFrame ? window.requestAnimationFrame(cb) : setTimeout(cb, 16);
  }, { passive: true });
  // iOS Safari включва :active (видимия отклик на натискане) само ако има слушател за touchstart
  document.addEventListener('touchstart', function () {}, { passive: true });

  // ---------- Вход (Етап 0) ----------
  function viewLogin(msg) {
    if (view === 'tablo') TB.scrollY = window.pageYOffset || 0;
    view = 'login'; stopPoll(); showBox(); renderTabs(); $('#fab').hidden = true; renderBanners();
    stamp('нужен е вход');
    screen.innerHTML =
      '<img src="logo-512.png" alt="AiLab" style="width:132px;height:132px;border-radius:28px;display:block;margin:6px auto 2px;box-shadow:var(--shadow)">' + '<h1 style="text-align:center">Вход</h1>' +
      '<p class="muted small" style="margin:0">Същият имейл и парола, които ти създаде в облачната база на AiLab.</p>' +
      (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
      '<form id="lf" class="card pad" style="display:grid;gap:12px" autocomplete="on">' +
      '<label for="em">Имейл<input id="em" type="email" autocomplete="username" required></label>' +
      '<label for="pw">Парола<input id="pw" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn" id="lb" type="submit">Влез</button></form>' +
      installHint();
    $('#lf').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = $('#lb'); b.disabled = true; b.textContent = 'Влизам…';
      db.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value })
        .then(function (r) {
          if (r.error) { viewLogin(r.error.message === 'Invalid login credentials' ? 'Грешен имейл или парола.' : r.error.message); return; }
          user = r.data.user; S.offline = false; lset(K2.vlizal, '1'); routeStart();   // след вход — по адреса, иначе Таблото
        })
        .catch(function () { viewLogin('Няма връзка с облака. Опитай, когато има покритие.'); });
    });
  }
  function installHint() {
    if (isStandalone() || DEMO) return '';
    return '<div class="hint"><b>Иконка на телефона:</b> в Safari натисни <b>Сподели ⬆</b> → <b>Добави към началния екран</b>. После отваряй AiLab от иконката.</div>';
  }
  // „Изход“ трие и запазеното на телефона (решения, действия, хора) — след изход нищо не се показва без вход.
  // Опашката „чака връзка“ остава (текстът на РП не се губи) и тръгва след нов вход — затова първо питаме.
  function logout() {
    var n = pendingCount();
    if (n && !window.confirm((n === 1 ? '1 запис чака' : n + ' записа чакат') + ' връзка и още не са в облака. Ще тръгнат след нов вход. Излизаш ли?')) return;
    commitUndos(); stopPoll();
    wipeLocal();
    if (!db) { viewLogin(); return; }
    db.auth.signOut().then(function () { user = null; viewLogin(); }, function () { user = null; viewLogin(); });
  }
  function wipeLocal() {
    [K.tablo, K.cache, dayKey('ag'), dayKey('soft'), CACHE_KEY, K2.vlizal].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    if (TB.io) { try { TB.io.disconnect(); } catch (e) {} TB.io = null; }
    TB.dni = []; TB.S = {}; TB.closed = {}; TB.inflight = {}; TB.soon = []; TB.odobri = []; TB.at = ''; TB.okAt = 0; TB.hasBase = false; TB.built = false; TB.defer = {};
    if (tablo) { tablo.innerHTML = ''; tablo._h = null; }
    S.den = null; S.dni = []; S.tochki = []; S.res = []; S.deistviq = []; S.counts = {}; S.svezhest = []; S.svAt = 0;
    S.dataAt = ''; S.actsAt = ''; S.actsOkAt = 0; S.okAt = 0; S.newVersiq = 0; S.sig = '';
    phReset();   // подписаните адреси, кешът с миниатюрите ailab-snimki-v1 и прегледът
  }

  // ---------- Карти и търсене (Етап 0) ----------
  function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function writeCache(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch (e) {} }
  function viewKarti() { leaveView(); view = 'karti'; showBox(); renderTabs(); $('#fab').hidden = true; renderBanners(); loadKarti(); }
  function renderCards(data, fromCacheFlag) {
    var cards = data.cards || [];
    screen.innerHTML = '<button type="button" class="back" data-a="back">← Към деня</button><h1>Карти (Етап 0)</h1>' +
      (fromCacheFlag ? '<div class="hint">📴 Без покритие — показвам запазеното към ' + esc(data.at) + '.</div>' : '') +
      '<div class="row"><input id="q" type="search" placeholder="Търси… напр. кофраж, бетон" autocomplete="off" aria-label="Търсене"></div>' +
      '<div id="res"></div>';
    $('#res').innerHTML = cards.length ? cards.map(card).join('') : '<p class="muted">Още няма карти.</p>';
    wirePhotos(cards, fromCacheFlag);
    $('#q').addEventListener('input', debounce(function (e) { search(e.target.value); }, 350));
    screen.insertAdjacentHTML('beforeend', checksCard(data.checks));
  }
  function card(c) {
    var o = OBEKT[c.obekt] || OBEKT.gm;
    return '<article class="card fact ' + esc(c.obekt) + '">' +
      (c.snimka ? '<div class="photo-ph" data-ph="' + esc(c.snimka) + '">📸 снимка</div>' : '') +
      '<div class="fact-b"><div class="row"><span class="pill ' + o[1] + '">' + o[0] + '</span><span class="muted small">' + esc(c.vid) + ' · ' + dm(c.kogda) + '</span></div>' +
      '<div class="t">' + esc(c.zaglavie) + '</div><div>' + esc(c.tekst) + '</div>' +
      '<div class="muted small">' + esc(c.izvor) + '</div></div></article>';
  }
  function wirePhotos(cards, fromCacheFlag) {
    if (fromCacheFlag || !db) return;
    cards.forEach(function (c) {
      if (!c.snimka) return;
      db.storage.from('snimki').createSignedUrl(c.snimka, 3600).then(function (r) {
        if (r.error || !r.data) return;
        var ph = Array.prototype.filter.call(document.querySelectorAll('[data-ph]'), function (x) { return x.getAttribute('data-ph') === c.snimka; })[0]; if (!ph) return;
        var img = new Image(); img.className = 'photo'; img.alt = 'снимка: ' + c.zaglavie;
        img.onload = function () { ph.replaceWith(img); };
        img.src = r.data.signedUrl;
      });
    });
  }
  function checksCard(ch) {
    if (!ch) return '';
    return '<section class="card pad"><div class="muted small" style="margin-bottom:8px">Проверка на Етап 0</div><ul class="checks">' +
      '<li><span>Вход</span><span class="pill p-ok">✓</span></li>' +
      '<li><span>Четене от облачната база</span><span class="pill ' + (ch.db ? 'p-ok">✓' : 'p-bad">✗') + '</span></li>' +
      '<li><span>Снимка от частната кофа</span><span class="pill ' + (ch.photo === true ? 'p-ok">✓' : ch.photo === false ? 'p-bad">✗' : 'p-warn">…') + '</span></li>' +
      '<li><span>Търсене на кирилица („КОФРАЖ“ = „кофраж“)</span><span class="pill ' + (ch.cyr ? 'p-ok">✓' : 'p-bad">✗') + '</span></li>' +
      '<li><span>Иконка на началния екран</span><span class="pill ' + (isStandalone() ? 'p-ok">✓' : 'p-warn">още не') + '</span></li>' +
      '<li><span>Работа без покритие</span><span class="pill ' + ('serviceWorker' in navigator && navigator.serviceWorker.controller ? 'p-ok">✓ готово' : 'p-warn">след 2-ро отваряне') + '</span></li>' +
      '</ul></section>';
  }
  function debounce(fn, ms) { var t; return function (e) { clearTimeout(t); t = setTimeout(function () { fn(e); }, ms); }; }
  function search(q) {
    q = (q || '').trim();
    var res = $('#res');
    if (!q) { loadKarti(); return; }
    if (!navigator.onLine || !db) { res.innerHTML = '<p class="muted">Търсенето иска покритие.</p>'; return; }
    var pat = '%' + q.replace(/[%_,()]/g, ' ') + '%';
    db.from('karti').select('*').or('zaglavie.ilike.' + pat + ',tekst.ilike.' + pat).order('kogda', { ascending: false }).limit(50)
      .then(function (r) {
        if (view !== 'karti' || !$('#res')) return;
        if (r.error) { res.innerHTML = '<div class="err">' + esc(r.error.message) + '</div>'; return; }
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        res.innerHTML = r.data.length ? r.data.map(function (c) { return card(c).replace(/(<div class="t">)([^<]*)/, function (m, a, b) { return a + b.replace(re, '<mark>$1</mark>'); }); }).join('')
          : '<p class="muted">Нищо за „' + esc(q) + '“.</p>';
      });
  }
  function loadKarti() {
    stamp('зареждам…');
    if (!db) { var c0 = readCache(); if (c0) { stamp('без покритие · ' + c0.at, true); renderCards(c0, true); } else screen.innerHTML = '<button type="button" class="back" data-a="back">← Към деня</button><p class="muted">Картите искат покритие.</p>'; return; }
    Promise.all([
      db.from('karti').select('*').order('kogda', { ascending: false }).limit(20),
      db.from('karti').select('id').ilike('tekst', '%КОФРАЖ%').limit(1)
    ]).then(function (rr) {
      if (view !== 'karti') return;
      var r = rr[0], cyr = rr[1];
      if (r.error) throw r.error;
      var data = { at: hhmm(), cards: r.data, checks: { db: true, cyr: !cyr.error && cyr.data.length > 0, photo: undefined } };
      writeCache(data);
      stamp('данни към ' + data.at);
      renderCards(data, false);
      var withPhoto = r.data.filter(function (c) { return c.snimka; })[0];
      if (withPhoto) db.storage.from('snimki').createSignedUrl(withPhoto.snimka, 60).then(function (s) {
        return fetch(s.data.signedUrl).then(function (h) { data.checks.photo = h.ok; });
      }).catch(function () { data.checks.photo = false; }).then(function () { var sec = document.querySelector('.checks'); if (sec && view === 'karti') sec.closest('section').outerHTML = checksCard(data.checks); });
    }).catch(function () {
      if (view !== 'karti') return;
      var c = readCache();
      if (c) { stamp('без покритие · ' + c.at, true); renderCards(c, true); }
      else { stamp('без връзка', true); screen.innerHTML = '<button type="button" class="back" data-a="back">← Към деня</button><h1>Няма връзка</h1><p class="muted">Отвори картите, когато има покритие.</p>'; }
    });
  }

  // ---------- ДЕМО (?demo=1): вградени примерни данни, „лаптоп“, който отговаря след ~6 с ----------
  // Само измислени данни: роли вместо имена („доставчикът на арматура“, „надзорът“, „проектантът“…), без суми в пари.
  function demoButtons() {
    return '<div class="demo-b"><button type="button" class="btn ghost" data-a="dDay">Лаптопът качва нов ден</button>' +
      (view === 'day' ? '<button type="button" class="btn ghost" data-a="dNew">Лаптопът качва нова версия</button>' : '') +
      '<button type="button" class="btn ghost" data-a="dOff" aria-pressed="' + S.forceOff + '">Без покритие: ' + (S.forceOff ? 'вкл.' : 'изкл.') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dReset">Започни демото отначало</button></div>';
  }
  function demoPanel() {
    return '<section class="demo"><div class="demo-h">Демо режим · примерни данни</div>' +
      '<p>Нищо не отива в облака. Часовникът е спрян на 24.09, 17:42; „лаптопът“ отговаря около 6 с след решение.</p>' + demoButtons() + '</section>';
  }
  function openDemoSheet() {
    if (!DEMO) return;
    openSheet('Демо режим', '<p>Примерни данни — нищо не отива в облака. Часовникът е спрян на 24.09, 17:42; „лаптопът“ отговаря около 6 с след решение.</p>' +
      demoButtons() + '<a class="btn ghost" href="./">Изход от демото</a>', 'demo');
  }
  function demoReset() { try { location.replace(location.pathname + location.search); } catch (e) { location.reload(); } }
  function demoPat(data, v) { return 'OneDrive\\…\\' + data + '\\Дневен запис v' + v + '.md'; }
  function later(fn, ms) {
    return new Promise(function (ok, no) {
      setTimeout(function () {
        if (S.forceOff) { no({ message: 'TypeError: Failed to fetch', code: '' }); return; }
        try { var v = fn(); ok(v == null ? v : JSON.parse(JSON.stringify(v))); } catch (e) { no(e); }
      }, ms == null ? 140 : ms);
    });
  }
  function pick(o, cols) { var r = {}; cols.split(',').forEach(function (c) { r[c] = o[c]; }); return r; }
  function dSort(a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : a.obekt < b.obekt ? -1 : a.obekt > b.obekt ? 1 : 0; }
  function dDen(id) { for (var i = 0; i < D.dni.length; i++) if (D.dni[i].id === id) return D.dni[i]; return null; }
  // Същите функции като realApi и същите правила (вкл. анти-съединението на заявка 2 и RESH_OT).
  var demoApi = {
    dni: function () { return later(function () { return D.dni.filter(function (x) { return x.obekt === OBEKT_KOD; }).sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 60).map(function (x) { return pick(x, DNI_COLS); }); }); },
    counts: function (ids) {
      return later(function () {
        return {
          t: D.tochki.filter(function (t) { return ids.indexOf(t.den_id) >= 0 && (t.grupa === 'reshenie' || t.grupa === 'neprovereno'); }).map(function (t) { return pick(t, 'id,den_id,grupa,istina'); }),
          r: D.resheniq.filter(function (r) { return ids.indexOf(r.den_id) >= 0 && (r.vid === 'potvardi' || r.vid === 'popravka') && r.tochka_id != null; }).map(function (r) { return pick(r, 'den_id,tochka_id,vid'); })
        };
      });
    },
    den: function (id) { return later(function () { return dDen(id); }); },
    head: function (id) { return later(function () { var d = dDen(id); return d ? pick(d, 'id,versiq,status,hesh,obnoven,vpisan_pat') : null; }); },
    tochki: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).sort(function (a, b) { return a.red - b.red || a.id - b.id; }); }); },
    istini: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).map(function (t) { return pick(t, 'id,istina'); }); }); },
    res: function (id) { return later(function () { return D.resheniq.filter(function (r) { return r.den_id === id; }); }); },
    svezhest: function () { return later(function () { return D.svezhest.map(function (s) { return pick(s, 'izvor,posledno,ok,broi,belejka'); }); }); },
    deistviq: function () { return later(function () { return D.deistviq.slice().sort(function (a, b) { return a.sazdadeno < b.sazdadeno ? 1 : -1; }).slice(0, 100).map(function (a) { return pick(a, ACT_COLS); }); }); },
    insert: function (tbl, row) { return later(function () { demoInsert(tbl, row); return null; }, 220); },
    tDni: function () { return later(function () { return D.dni.filter(function (x) { return x.data >= TEST_DO; }).sort(dSort).slice(0, 400).map(function (x) { return pick(x, 'id,obekt,data,status,versiq,hora,obnoven'); }); }); },
    tOpen: function (sel, rg, old) {
      return later(function () {
        var all = D.tochki.filter(function (t) {
          if (t.grupa !== 'reshenie') return false;
          var d = dDen(t.den_id); if (!d) return false;
          if (old ? !(d.data < RESH_OT && d.data >= TEST_DO) : !(d.data >= RESH_OT)) return false;
          if (sel !== 'all' && d.obekt !== sel) return false;
          if (D.resheniq.some(function (r) { return r.tochka_id === t.id && CLOSE_VID[r.vid]; })) return false;   // resheniq=is.null
          if (D.deistviq.some(function (a) { return a.tochka_id === t.id; })) return false;                     // deistviq=is.null
          return true;
        }).sort(function (a, b) {
          var da = dDen(a.den_id).data, dz = dDen(b.den_id).data;
          return (b.vajnost || 1) - (a.vajnost || 1) || (da < dz ? -1 : da > dz ? 1 : 0) || (a.red || 0) - (b.red || 0) || a.id - b.id;
        });
        return { data: all.slice(rg[0], rg[1] + 1).map(function (t) {
          var r = pick(t, FEED_COLS); r.dni = pick(dDen(t.den_id), 'obekt,data,status,versiq,hesh,obnoven'); r.resheniq = []; r.deistviq = []; return r;
        }), count: all.length };
      });
    },
    tSoon: function () {
      return later(function () {
        var lim = nowMs() + 48 * 36e5;
        return D.deistviq.filter(function (a) { return a.status === 'zaqveno' && a.srok && Date.parse(a.srok) <= lim; })
          .sort(function (a, b) { return Date.parse(b.srok) - Date.parse(a.srok); }).slice(0, SOON_MAX).map(function (a) { return pick(a, SOON_COLS); });
      });
    },
    tOdobri: function () { return later(function () { return D.resheniq.filter(function (r) { return r.vid === 'odobri' && !r.obraboteno; }).slice(0, 100).map(function (r) { return pick(r, 'den_id,versiq'); }); }); },
    tFeed: function (ids) {
      return later(function () {
        return D.tochki.filter(function (t) { return t.grupa === 'promqna' && ids.indexOf(t.den_id) >= 0; })
          .sort(function (a, b) { return (b.vajnost || 1) - (a.vajnost || 1) || (a.red || 0) - (b.red || 0) || a.id - b.id; }).slice(0, 150).map(function (t) { return pick(t, FEED_COLS); });
      });
    },
    // Снимки — същата форма и подредба като истинските (С1, С2, С3)
    snimki: function (id) { return later(function () { return D.snimki.filter(function (s) { return s.den_id === id; }).sort(phSort).slice(0, 500).map(function (s) { return pick(s, PH_COLS); }); }); },
    snimkiMsg: function (denId, ids) {
      return later(function () { return D.snimki.filter(function (s) { return s.den_id === denId && ids.indexOf(s.msg_id) >= 0; }).sort(phSort).slice(0, 200).map(function (s) { return pick(s, PH_COLS); }); });
    },
    // като snimki_tablo: първо към „Какво се промени“, в тях първо n = 1 (по една от съобщение) [К33], после по час
    tPh: function (ids) {
      return later(function () {
        var out = [];
        ids.forEach(function (den) {
          var all = D.snimki.filter(function (s) { return s.den_id === den; }), prom = {};
          if (!all.length) return;
          D.tochki.forEach(function (t) { if (t.den_id === den && t.grupa === 'promqna') (t.izvori || []).forEach(function (s) { var m = srcMsg(s); if (m) prom[m] = 1; }); });
          all.sort(function (a, b) { return (prom[b.msg_id] ? 1 : 0) - (prom[a.msg_id] ? 1 : 0) || (b.n === 1 ? 1 : 0) - (a.n === 1 ? 1 : 0) || phSort(a, b); });
          all.slice(0, 4).forEach(function (s) { var r = pick(s, 'den_id,id,msg_id,vreme,n,pat_mini,shirina,visochina'); r.broi = all.length; out.push(r); });
        });
        return out;
      });
    }
  };
  // като истинската база: външните ключове се проверяват (23503), а часът от телефона (kogda/sazdadeno) се пази
  function demoFk(tbl, col, v, ref) {
    return { code: '23503', message: 'insert or update on table "' + tbl + '" violates foreign key constraint "' + tbl + '_' + col + '_fkey"', details: 'Key (' + col + ')=(' + v + ') is not present in table "' + ref + '".' };
  }
  function demoInsert(tbl, row) {
    if (row.den_id != null && !D.dni.some(function (x) { return x.id === row.den_id; })) throw demoFk(tbl, 'den_id', row.den_id, 'dni');
    if (row.tochka_id != null && !D.tochki.some(function (x) { return x.id === row.tochka_id; })) throw demoFk(tbl, 'tochka_id', row.tochka_id, 'tochki');
    var r = Object.assign({ id: ++D.seq }, row);
    if (tbl === 'resheniq') { r.kogda = row.kogda || nowIso(); r.obraboteno = null; r.rezultat = null; D.resheniq.push(r); }
    else if (tbl === 'deistviq') { r.status = 'zaqveno'; r.sazdadeno = row.sazdadeno || nowIso(); D.deistviq.push(r); }
    else if (tbl === 'metriki') { r.kogda = row.kogda || nowIso(); D.metriki.push(r); return; }
    else throw { message: 'непозната таблица', code: 'DEMO' };
    if (!D.lt) D.lt = setTimeout(function () { D.lt = 0; demoLaptop(); }, 6000);
  }
  // Като ailab-rabotnik.ps1: одобрения и потвърждения се обработват; действията НЕ се пипат (няма как да се отметнат) [К19].
  function demoLaptop() {
    var t = nowIso();
    D.resheniq.forEach(function (r) {
      if (r.obraboteno) return;
      var d = dDen(r.den_id);
      if (r.vid === 'odobri' && d) {
        if (r.versiq !== d.versiq) r.rezultat = 'остаряла версия';
        else if (d.status === 'vpisana') r.rezultat = 'вече вписан';
        else { d.status = 'vpisana'; d.vpisan_pat = demoPat(d.data, d.versiq); r.rezultat = 'вписан'; }
      } else if (r.vid === 'potvardi') {
        var tt = D.tochki.filter(function (x) { return x.id === r.tochka_id; })[0]; if (tt) tt.istina = 'provereno'; r.rezultat = tt ? 'потвърдено' : 'точката я няма в текущата версия';
      } else { r.rezultat = 'чака Claude'; return; }   // като ailab-rabotnik: поправките остават необработени за Claude
      r.obraboteno = t;
    });
  }
  function demoNewVersion() {
    if (!S.den) return;
    var d = dDen(S.den.id); if (!d) return;
    if (d.status !== 'chernova') { toast('Одобрен или вписан ден не се пипа — лаптопът само предупреждава.'); return; }
    d.versiq += 1; d.hesh = Math.random().toString(16).slice(2, 10); d.obnoven = nowIso();
    D.tochki.push({ id: ++D.seq, den_id: d.id, razdel: 5, grupa: 'promqna', tekst: 'Доставчикът на арматура потвърди частична доставка — 6 т арматура Ø12 на 29.09, сутринта.', istina: 'saobshteno', vajnost: 2,
      izvori: [{ n: 13, tip: 'Поща', kratko: 'доставчикът на арматура · потвърждение на частична доставка', vreme: hhmm(), kade: 'Поща/' + hhmm().replace(':', '') + '00_доставка_арматура.eml' }], red: 0 });
    d.zapis_md = String(d.zapis_md || '').replace('\n\n## 6. ', '\n- Доставчикът на арматура потвърди частична доставка: 6 т Ø12 на 29.09 [13].\n\n## 6. ');
    // като ailab-kachi-den: точка с променен текст е НОВА точка (старата се трие, връзките към нея стават празни)
    var kr = D.tochki.filter(function (x) { return x.den_id === d.id && /^Кулокран 1 е стоял/.test(x.tekst) && !/механикът потвърди/.test(x.tekst); })[0];
    if (kr) {
      D.tochki = D.tochki.filter(function (x) { return x !== kr; });
      D.resheniq.forEach(function (r) { if (r.tochka_id === kr.id) r.tochka_id = null; });
      D.deistviq.forEach(function (a) { if (a.tochka_id === kr.id) a.tochka_id = null; });
      D.tochki.push(Object.assign({}, kr, { id: ++D.seq, tekst: 'Кулокран 1 е стоял 13:00–15:00 — механикът потвърди смяната на хидравличния маркуч.', istina: 'provereno' }));
    }
    toast('Лаптопът качи v' + d.versiq + ' — телефонът ще я види до ' + Math.round(POLL_MS / 1000) + ' с');
  }
  // „Лаптопът качва нов ден“ → Амур 25.09: +1 ден за одобрение, +1 решение, „🆕“, хапче „↑ Нови промени“ (ако си скролнал).
  function demoNewDay() {
    if (D.dni.some(function (x) { return x.obekt === 'ag' && x.data === '2026-09-25'; })) { toast('Денят 25.09 вече е качен — „Започни демото отначало“ за нов опит.'); return; }
    var nd = dKratak('ag', '2026-09-25', 'chernova', 1, 51, 'Армировката на плоча +9,30 в сграда 2 започна от ос 1. На обекта — 51 души.', [
      [4, 'promqna', 'Сграда 2, плоча +9,30 — армировката започна от ос 1; до обяд стигна ос 3.', 'saobshteno', 2, [dChat(1, 'ТР на обекта · канал на обекта', '12:40')]],
      [5, 'promqna', 'Доставени 6 т арматура Ø12 — първата част от закъснялата доставка.', 'saobshteno', 1, [dMail(2, 'доставчикът на арматура · товарителница', '09:15')]],
      [7, 'reshenie', 'Надзорът иска оглед на армировката на +9,30 преди бетона — да се уговори час за понеделник.', 'saobshteno', 2, [dMail(3, 'надзорът · писмо', '14:05')]]
    ], nowIso());
    dPhSrc(nd, dFirstChat(nd), 3);   // 3 снимки към първата промяна [§4.9]
    toast('Лаптопът качи нов ден: Амур Гардънс · 25.09');
    setTimeout(function () { if (view === 'tablo') loadTablo(); else if (view === 'day') poll(true); else loadTablo(true); }, 700);
  }
  function demoToggleOff() {
    S.forceOff = !S.forceOff;
    Array.prototype.forEach.call(document.querySelectorAll('[data-a="dOff"]'), function (b) { b.setAttribute('aria-pressed', String(S.forceOff)); b.textContent = 'Без покритие: ' + (S.forceOff ? 'вкл.' : 'изкл.'); });
    if (S.forceOff) { setOffline(); toast('Симулирам липса на покритие'); }
    else { S.offline = false; toast('Покритието е обратно'); stampNow(); renderCurrent(); flush().then(function () { refreshCurrent(); }); }
  }
  // --- помощни за примерните данни ---
  function dT(s) { return new Date(s).toISOString(); }
  function dSrc(n, tip, kratko, vreme, kade) { return { n: n, tip: tip, kratko: kratko, vreme: vreme, kade: kade || '' }; }
  function dMail(n, k, v) { return dSrc(n, 'Поща', k, v, 'Поща/' + v.replace(':', '') + '00.eml'); }
  function dChat(n, k, v) { return dSrc(n, 'Тиймс', k, v, 'Оригинали/' + v.replace(':', '') + '00.json'); }
  function dMd(o) { return RAZDELI.map(function (t, i) { return '## ' + (i + 1) + '. ' + t + '\n' + (o[i + 1] || 'Не е постъпила информация.'); }).join('\n\n'); }
  // Източник от Тиймс получава измислено ид на съобщението = моментът му в ms + n на източника — правилото на истинското [К4, К34].
  // Точките се строят преди деня (датата я знае само dAdd) → ид-то се дописва тук; цитирано от две точки — същото ид.
  function dMsgFix(s, data) {
    var m = s && /^Оригинали\/(\d{2})(\d{2})00\.json$/.exec(s.kade || '');
    if (!m) return s;
    s.kade = 'Оригинали/' + m[1] + m[2] + '00_' + (Date.parse(data + 'T' + m[1] + ':' + m[2] + ':00+03:00') + (+s.n || 0)) + '_20260101000000000.json';
    return s;
  }
  function dAdd(obekt, data, status, versiq, hora, rezyume, pts, zapis, hesh, obnoven) {
    var d = { id: ++D.did, obekt: obekt, data: data, status: status, versiq: versiq, hesh: hesh || Math.random().toString(16).slice(2, 10), zapis_md: zapis,
      rezyume: rezyume, hora: hora, sazdaden: dT(data + 'T17:05:00+03:00'), obnoven: obnoven || dT(data + 'T17:20:00+03:00'), vpisan_pat: status === 'vpisana' ? demoPat(data, versiq) : null };
    D.dni.push(d);
    pts.forEach(function (p) { (p[5] || []).forEach(function (s) { dMsgFix(s, data); }); });
    pts.forEach(function (p, i) { D.tochki.push({ id: ++D.tid, den_id: d.id, razdel: p[0], grupa: p[1], tekst: p[2], istina: p[3] || 'saobshteno', vajnost: p[4] || 1, izvori: p[5] || [], red: i + 1 }); });
    return d;
  }
  function dKratak(obekt, data, status, versiq, hora, rez, pts, obnoven) {
    var prom = pts.filter(function (p) { return p[1] !== 'fakt'; }).map(function (p) { return '- ' + p[2]; }).join('\n');
    var wd = parseD(data).getDay(), we = wd === 0 || wd === 6;
    return dAdd(obekt, data, status, versiq, hora, rez, pts, dMd({ 1: rez, 2: 'Сухо, без ограничения за работа.',
      3: hora ? 'Общо ' + hora + ' души по Присъствия.' : we ? 'Неработен ден — на обекта няма хора.' : 'Няма рапорт от Присъствия за деня.',
      4: prom || 'Не е постъпила информация.', 12: 'Всички източници свежи към 17:20.' }), null, obnoven);
  }
  function dResOf(o, data) {
    var d = D.dni.filter(function (x) { return x.obekt === o && x.data === data; })[0];
    return d ? D.tochki.filter(function (t) { return t.den_id === d.id && t.grupa === 'reshenie'; })[0] : null;
  }
  function demoInit() {
    D = { dni: [], tochki: [], resheniq: [], deistviq: [], metriki: [], svezhest: [], snimki: [], seq: 5000, lt: 0, did: 100, tid: 1000, sid: 7000 };
    var HIST = [];   // дните от hist() с индекса си — за снимките [§4.9]
    window.AILAB_DEMO = D;   // само за проверка в браузъра
    var mail = dMail, chat = dChat, src = dSrc, T = dT;
    var agCh = function (n, v) { return chat(n, 'ТР на обекта · канал на обекта', v); };
    var skCh = function (n, v) { return chat(n, 'ТР на обекта · чат „Скай Тауърс“', v); };
    // Общи текстове за историята (въртят се) — без имена на фирми и хора
    var AG_P = [
      [4, 'Кофраж на стените в сграда {b} — затворен до ос {o}.'],
      [4, 'Армировка на плочата в сграда {b} — положена до ос {o}, чака приемане от надзора.'],
      [4, 'Зидария на етаж {e}, сграда {b} — завършени {p}%.'],
      [4, 'Бетон на колоните по ос {o}, сграда {b} — излят, взети пробни кубчета.'],
      [4, 'Фасада на сграда {b} — клинкерът стигна {p}%.'],
      [9, 'ВиК — изпитване на вертикалните щрангове в сграда {b}, без течове.'],
      [4, 'Ел. скари на етаж {e}, сграда {b} — монтирани.']
    ];
    var SK_P = [
      [4, 'Окачена фасада — монтирани панели до ниво {e}.'],
      [6, 'Кулокран 2 — добавена секция, кранът работи на новата височина.'],
      [4, 'Шпакловка на етаж {e} — завършени {p}%.'],
      [5, 'Доставени стъклопакети за ниво {e}.'],
      [4, 'Гипсокартон на етаж {e} — затворени стените в секция {b}.'],
      [4, 'Климатизация — положени тръби до ниво {e}.']
    ];
    var rot = 0;
    function fill(s, i) { return s.replace('{b}', String(1 + i % 4)).replace('{o}', String(2 + i % 7)).replace('{e}', String(2 + i % 9)).replace('{p}', String(35 + (i * 7) % 60)); }
    function dve(o, ist) {
      var L = o === 'ag' ? AG_P : SK_P, out = [];
      for (var j = 0; j < 2; j++) {
        var p = L[rot % L.length], v = (15 + j) + ':' + pad(10 + (rot * 7) % 45);
        out.push([p[0], 'promqna', fill(p[1], rot), ist, 1, [(o === 'ag' ? agCh : skCh)(j + 1, v)]]);
        rot++;
      }
      return out;
    }
    function hist(o, from, to, H, Rz, stOf) {
      for (var dt = parseD(from), end = parseD(to), hi = 0; dt <= end; dt.setDate(dt.getDate() + 1), hi++) {
        var k = ymd(dt), wd = dt.getDay(), we = wd === 0 || wd === 6, h = H[k] == null ? null : H[k], st = stOf(k), ist = st === 'vpisana' ? 'provereno' : 'saobshteno';
        var pts = we && h == null ? [[1, 'fakt', 'Неработен ден, без събития на обекта.', 'provereno', 1, [chat(1, 'охрана · чат на обекта', '19:00')]]] : dve(o, ist);
        if (!we && h == null) pts.push([3, 'neprovereno', 'Няма рапорт от Присъствия за деня — броят хора липсва.', 'saobshteno', 1, []]);
        if (Rz[k]) pts.push([7, 'reshenie', Rz[k][0], 'saobshteno', Rz[k][1], [mail(3, 'кореспонденция по темата', '11:' + pad(10 + wd * 5))]]);
        var rez = we && h == null ? 'Неработен ден.' : h == null ? 'Няма рапорт от Присъствия; работата продължи по графика. ' + pts[0][2] : 'Работен ден — ' + h + ' души. ' + pts[0][2];
        HIST.push({ d: dKratak(o, k, st, st === 'vpisana' ? 1 : 2, h, rez, pts), i: hi, we: we });
      }
    }
    // Амур Гардънс: 26.08–15.09 (вписани). 11.09 (петък) — без рапорт (тест „няма данни“ в делник). Почивни — null, освен сб 05.09.
    hist('ag', '2026-08-26', '2026-09-15', {
      '2026-08-26': 55, '2026-08-27': 57, '2026-08-28': 54, '2026-08-31': 58, '2026-09-01': 60, '2026-09-02': 61, '2026-09-03': 59, '2026-09-04': 56,
      '2026-09-05': 18, '2026-09-07': 62, '2026-09-08': 64, '2026-09-09': 63, '2026-09-10': 63, '2026-09-14': 48, '2026-09-15': 49
    }, {
      '2026-08-28': ['Да се върне ли излишното скеле на доставчика? Стои на обекта от две седмици.', 1],
      '2026-09-02': ['Надзорът иска протокол за заземяването на кулокран 1 преди следващия оглед.', 2],
      '2026-09-04': ['Къде да се складират палетите с клинкер? Площадката до сграда 3 е заета.', 1],
      '2026-09-08': ['Проектантът не е отговорил за отвора в плоча +6,20, ос 4 — армировката там стои. Да го търсим ли през инвеститора?', 3],
      '2026-09-10': ['Подизпълнителят по ВиК пита за мострата на смесителите — одобряваш ли я?', 2],
      '2026-09-14': ['Да се поръча ли втори контейнер за отпадъци? Първият се пълни за два дни.', 1],
      '2026-09-15': ['Инвеститорът пита за графика на асансьорите.', 2]
    }, function () { return 'vpisana'; });
    // Скай Тауърс: 11.09–24.09; 11–22.09 вписани, 23 и 24.09 — чернови.
    hist('soft', '2026-09-11', '2026-09-24', {
      '2026-09-11': 34, '2026-09-14': 36, '2026-09-15': 38, '2026-09-16': 35, '2026-09-17': 37, '2026-09-18': 39,
      '2026-09-21': 36, '2026-09-22': 38, '2026-09-23': 40, '2026-09-24': 38
    }, {
      '2026-09-16': ['Да се уточни графикът на анкерите за окачената фасада с монтажника.', 2],
      '2026-09-18': ['Архитектът предлага друг цвят на фасадните панели на ниво 9 — чака твое решение.', 2],
      '2026-09-22': ['Изтича техническият преглед на кулокран 2 — да се заяви нов преди 30.09.', 2],
      '2026-09-23': ['Сутеренът е наводнен след дъжда — спираме ли довършването там, докато помпите работят?', 3]
    }, function (k) { return k <= '2026-09-22' ? 'vpisana' : 'chernova'; });

    // Амур Гардънс 16–24.09 — основните примери от Етап 1
    dKratak('ag', '2026-09-16', 'vpisana', 2, 46, 'Армировката на плоча +6,20 в сграда 2 е завършена и приета от надзора. Бетонът е насрочен за утре, 07:30.', [
      [4, 'promqna', 'Армировката на плоча +6,20, сграда 2 — завършена и приета от надзора.', 'provereno', 2, [agCh(1, '16:05')]],
      [4, 'promqna', 'Фасада на сграда 3 — клинкерът стигна 60%.', 'provereno', 1, [chat(2, 'бригадир фасада · чат „Амур Гардънс“', '15:40')]],
      [7, 'reshenie', 'Потвърди поръчката на 41 м³ бетон C25/30 за утре, 07:30.', 'provereno', 2, [mail(3, 'бетонов възел · потвърждение на поръчка', '11:20')]]]);
    dKratak('ag', '2026-09-17', 'vpisana', 1, 52, 'Бетонирана плоча +6,20 в сграда 2 — 41 м³, помпа 07:30–12:10. Взети 6 пробни кубчета.', [
      [4, 'promqna', 'Бетонирана плоча +6,20, сграда 2 — 41 м³ C25/30, помпа 07:30–12:10.', 'provereno', 2, [mail(1, 'бетонов възел · 6 товарителници', '12:30')]],
      [9, 'promqna', 'Взети 6 пробни кубчета — за 7 и за 28 дни.', 'provereno', 1, [agCh(2, '12:45')]]]);
    dKratak('ag', '2026-09-18', 'vpisana', 1, 47, 'Доставени 18 т арматура (частична доставка). Надзорът прие армировката на стълбището в сграда 1.', [
      [5, 'promqna', 'Доставени 18 т арматура — частична доставка по поръчката за +9,30.', 'provereno', 2, [mail(1, 'доставчикът на арматура · 2 товарителници', '10:15')]],
      [4, 'promqna', 'Армировката на стълбището в сграда 1 е приета от надзора.', 'provereno', 1, [agCh(2, '14:30')]]]);
    dKratak('ag', '2026-09-19', 'vpisana', 1, 21, 'Съботна смяна — кофражисти и фасада, общо 21 души. Без доставки.', [
      [3, 'promqna', 'Съботна смяна: 12 кофражисти и 9 души на фасадата.', 'provereno', 1, [src(1, 'Присъствия', 'въведено за 2 бригади', '08:05', 'Присъствия/2026-09-19.json')]]]);
    dKratak('ag', '2026-09-20', 'vpisana', 1, null, 'Неработен ден. Охраната докладва спокойна обстановка на обекта.', [
      [1, 'fakt', 'Неработен ден, без събития на обекта.', 'provereno', 1, [chat(1, 'охрана · чат „Амур Гардънс“', '19:00')]]]);
    dKratak('ag', '2026-09-21', 'vpisana', 2, 49, 'Кофражът на стените над +6,20 е затворен. Фасадата на сграда 3 — клинкер до 70%.', [
      [4, 'promqna', 'Кофраж на стените над +6,20, сграда 2 — затворен и проверен.', 'provereno', 1, [agCh(1, '16:12')]],
      [4, 'promqna', 'Фасада на сграда 3 — клинкерът стигна 70%.', 'provereno', 1, [chat(2, 'бригадир фасада · чат „Амур Гардънс“', '16:10')]]]);
    dKratak('ag', '2026-09-22', 'vpisana', 3, 51, 'Започна кофражът на плоча +9,30 в сграда 2 от ос 1. Доставчикът на арматура обеща остатъка за 25.09.', [
      [4, 'promqna', 'Кофраж на плоча +9,30, сграда 2 — започнат от ос 1.', 'provereno', 2, [agCh(1, '07:40')]],
      [5, 'reshenie', 'Доставчикът на арматура обещава остатъка (≈14 т) за 25.09 — да се следи.', 'provereno', 2, [mail(2, 'доставчикът на арматура · потвърждение на срок', '13:20')]]]);
    var d23 = dKratak('ag', '2026-09-23', 'odobrena', 2, 50, 'Кофражът на +9,30 стигна ос 5. Инвеститорът поиска график за фасадата на сграда 4.', [
      [4, 'promqna', 'Кофраж на плоча +9,30, сграда 2 — до ос 5.', 'saobshteno', 2, [agCh(1, '16:50')]],
      [7, 'reshenie', 'Инвеститорът иска график за фасадата на сграда 4 до края на седмицата.', 'saobshteno', 2, [mail(2, 'Инвеститор · писмо', '11:02')]],
      [3, 'neprovereno', 'Присъствия: 50 души, чатът — 49. Разлика от 1 човек при общите работници.', 'osporeno', 1, [src(3, 'Присъствия', 'въведено за 8 бригади', '08:20', 'Присъствия/2026-09-23.json'), chat(4, 'ТР на обекта · сутрешен отчет', '07:35')]]]);
    D.resheniq.push({ id: ++D.seq, den_id: d23.id, tochka_id: null, vid: 'odobri', tekst: null, versiq: 2, hesh: d23.hesh, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-23T19:12:00+03:00'), obraboteno: null, rezultat: null });

    // 24.09 — основният пример: 50 души; кофраж +9,30 сграда 2; доставчикът на арматура закъснява; чат 10 / Присъствия 8 кофражисти.
    var s1 = chat(1, 'ТР на обекта · канал на обекта: „кофражът е до ос 7, на плочата сме 10 кофражисти“', '07:18');
    // [2] — съобщение от Тиймс със снимки (като истинските: kade = Оригинали/…, ид от dMsgFix) → в листа „Източници“ под него има плочки
    var s2 = src(2, 'Снимка', 'ТР на обекта · канал на обекта: снимки от плоча +9,30', '16:40', 'Оригинали/164000.json');
    var s3 = src(3, 'Присъствия', 'бригада кофражисти — 8 души, въведено в 08:10', '08:10', 'Присъствия/2026-09-24.json');
    var s4 = mail(4, 'доставчикът на арматура · писмо за нов срок на арматурата', '11:04');
    var s5 = chat(5, 'ПТО · чат на ПТО: „арматурата няма да дойде преди 01.10“', '11:30');
    var s6 = mail(6, 'бетонов възел · 2 товарителници, 24 м³ C25/30', '10:52');
    var s7 = chat(7, 'бригадир фасада · чат „Амур Гардънс“', '15:02');
    var s8 = src(8, 'Метео', 'прогноза за обекта, публикувана в Тиймс', '06:30', 'Метео/2026-09-24.json');
    var s9 = chat(9, 'механизатор · чат „Амур Гардънс“: „кранът стои, сменяме маркуч“', '13:05');
    var s10 = mail(10, 'подизпълнител кофраж · количествена сметка за поредния акт', '09:41');
    var s11 = mail(11, 'Инвеститор · въпрос за датата на бетона', '16:12');
    var s12 = src(12, 'Поща', 'лаборатория · протокол № 118, 7-дневни кубчета', '14:20', 'Поща/142000_протокол_118.pdf');
    dAdd('ag', '2026-09-24', 'chernova', 3, 50,
      'Нормален работен ден — 50 души. Кофражът на плоча +9,30 в сграда 2 е довършен до ос 7, армировката започва утре. Доставчикът на арматура отлага доставката с 5–10 дни.', [
        [4, 'promqna', 'Сграда 2, плоча +9,30 — кофражът е довършен до ос 7. Армировката започва утре от 07:00.', 'saobshteno', 2, [s1, s2]],
        [5, 'promqna', 'Доставени 24 м³ бетон C25/30 за стълбищната клетка на сграда 1 — 2 миксера, 09:10–10:40.', 'provereno', 1, [s6]],
        [4, 'promqna', 'Сграда 3 — скелето по северната фасада е демонтирано; фасадната бригада минава на сграда 4.', 'saobshteno', 1, [s7]],
        [9, 'promqna', '7-дневните кубчета от плоча +6,20 (бетон от 17.09) дават 31,2 MPa — в норма за C25/30.', 'provereno', 1, [s12]],
        [8, 'reshenie', 'Доставчикът на арматура отлага доставката на арматура Ø12/Ø16 (≈14 т) с 5–10 дни. Чакаме или поръчваме частично от друг доставчик? Бетонът на +9,30 по график е на 02.10.', 'saobshteno', 3, [s4, s5]],
        [10, 'reshenie', 'Подизпълнителят по кофража иска потвърждение на количествата за поредния акт до петък, 25.09.', 'saobshteno', 2, [s10]],
        [7, 'reshenie', 'Инвеститорът пита за нова дата на бетона на +9,30 заради закъснението на арматурата — чака отговор от теб.', 'saobshteno', 2, [s11]],
        [3, 'neprovereno', 'Разлика в броя кофражисти: чатът казва 10, Присъствия — 8. В дневника засега са 8 (по Присъствия).', 'osporeno', 2, [s1, s3]],
        [6, 'neprovereno', 'Кулокран 1 е стоял 13:00–15:00 (смяна на хидравличен маркуч) — само от едно съобщение, механикът не е потвърдил.', 'saobshteno', 2, [s9]],
        [12, 'neprovereno', 'Няма данни от Интранет след вчера, 18:05 — задачите на обекта може да не са отразени.', 'saobshteno', 1, []],
        [2, 'fakt', 'Слънчево, 14–29 °C, вятър до 4 m/s — без ограничения за крана и бетона.', 'provereno', 1, [s8]],
        [3, 'fakt', 'Общо 50 души на обекта по Присъствия, 8 бригади.', 'provereno', 1, [s3]]
      ], dMd({
        1: 'Нормален работен ден, **50 души** на обекта (по Присъствия). Кофражът на плоча +9,30 в сграда 2 е довършен до ос 7; армировката започва утре от 07:00 [1][2].\n**Риск:** доставчикът на арматура отлага арматурата Ø12/Ø16 с 5–10 дни [4][5] — застрашава бетона на +9,30 по график (02.10).',
        2: 'Слънчево, 14–29 °C, вятър до 4 m/s. Без ограничения за крана и бетона [8].',
        3: '| Бригада | Къде | Хора |\n|---|---|---|\n| Кофражисти | плоча +9,30, сграда 2 | 8 (чат: 10) [1][3] |\n| Арматуристи | стълбище, сграда 1 | 6 |\n| Зидари | сграда 3 | 8 |\n| Фасада | сграда 3 → 4 | 9 [7] |\n| Бетонджии | стълбище, сграда 1 | 4 [6] |\n| ВиК | вертикални щрангове | 4 |\n| Електро | ел. инсталация, сграда 1 | 5 |\n| Общи работници | почистване, пренасяне | 6 |\n| **Общо** | | **50** [3] |',
        4: '- Сграда 2, плоча +9,30 — кофражът е довършен до ос 7 [1][2].\n- Сграда 1 — бетон на стълбищната клетка, 24 м³ C25/30 [6].\n- Сграда 3 — демонтирано скелето по северната фасада; бригадата минава на сграда 4 [7].',
        5: '- Бетонов възел — 24 м³ C25/30, 2 миксера, 09:10–10:40 [6].\n- Доставчикът на арматура — доставката на арматура Ø12/Ø16 (≈14 т) се отлага с 5–10 дни [4][5].',
        6: 'Кулокран 1 — стоял 13:00–15:00, смяна на хидравличен маркуч (само от едно съобщение) [9]. Помпа за бетон 09:00–11:00.',
        7: '- **Чака РП:** доставчикът на арматура — чакаме или поръчваме частично от друг доставчик? [4][5]\n- **Чака РП:** количествата за поредния акт — до петък, 25.09 [10].\n- Инвеститорът пита за нова дата на бетона на +9,30 [11].',
        8: '- Закъснението на арматурата може да измести бетона на +9,30 от 02.10 към 07–09.10.\n- Престой на крана 2 ч — кофражистите са пренасяли ръчно [9].',
        9: '7-дневните кубчета от плоча +6,20 (бетон от 17.09) — 31,2 MPa при клас C25/30 [12]. 28-дневните — на 15.10.',
        10: '- Доставчикът на арматура — писмо за новия срок на доставката [4].\n- Подизпълнителят по кофража — количествена сметка за поредния акт [10].\n- Инвеститорът — въпрос за датата на бетона [11].',
        11: '- Броят кофражисти: чат 10 / Присъствия 8 [1][3].\n- Престоят на крана — само от едно съобщение [9].\n- Интранет — няма данни след 23.09, 18:05.',
        12: 'Тиймс ✓ 17:18 · Поща ✓ 17:05 · Присъствия ✓ 16:40 · Сървър ✓ 17:00 · Интранет ⚠️ 23.09 18:05.\nСъобщения: 112 · мейли: 23 · снимки: 14.'
      }), 'a41f9c2e');

    // Затворени решения (§8): с действие, с коментар, с потвърждение — не бива да се виждат в „Изисква решение“.
    var r;
    r = dResOf('ag', '2026-09-02');
    D.deistviq.push({ id: ++D.seq, den_id: r.den_id, tochka_id: r.id, vid: 'vazlozhi', tekst: 'Протокол за заземяването на кулокран 1', chovek: 'ТР на обекта', mqsto: null, srok: T('2026-09-04T17:00:00+03:00'), izvor: 'телефон · от точка', status: 'izpalneno', vanshen_id: 'demo-z1', sazdadeno: T('2026-09-02T18:10:00+03:00'), obnoveno: T('2026-09-04T16:30:00+03:00') });
    r = dResOf('ag', '2026-09-10');
    D.resheniq.push({ id: ++D.seq, den_id: r.den_id, tochka_id: r.id, vid: 'komentar', tekst: 'Мострата е добре — нека поръчат.', versiq: 1, hesh: null, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-10T19:05:00+03:00'), obraboteno: T('2026-09-10T19:30:00+03:00'), rezultat: 'прието' });
    r = dResOf('ag', '2026-09-15'); r.istina = 'provereno';
    D.resheniq.push({ id: ++D.seq, den_id: r.den_id, tochka_id: r.id, vid: 'potvardi', tekst: 'отговорено', versiq: 1, hesh: null, ustroistvo: 'iPhone · иконка · табло', kogda: T('2026-09-15T18:40:00+03:00'), obraboteno: T('2026-09-15T18:45:00+03:00'), rezultat: 'потвърдено' });
    r = dResOf('ag', '2026-09-16');
    D.resheniq.push({ id: ++D.seq, den_id: r.den_id, tochka_id: r.id, vid: 'potvardi', tekst: null, versiq: 2, hesh: null, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-16T17:55:00+03:00'), obraboteno: T('2026-09-16T18:00:00+03:00'), rezultat: 'потвърдено' });
    r = dResOf('soft', '2026-09-16');
    D.deistviq.push({ id: ++D.seq, den_id: r.den_id, tochka_id: r.id, vid: 'napomni', tekst: 'Уточни графика на анкерите с монтажника', chovek: null, mqsto: null, srok: T('2026-09-17T09:00:00+03:00'), izvor: 'телефон · от точка', status: 'izpalneno', vanshen_id: 'demo-z2', sazdadeno: T('2026-09-16T18:20:00+03:00'), obnoveno: T('2026-09-17T09:10:00+03:00') });

    D.svezhest = [
      { izvor: 'teams', posledno: T('2026-09-24T17:18:00+03:00'), ok: true, broi: 112, belejka: 'Тиймс — чатовете и каналите на обекта.' },
      { izvor: 'poshta', posledno: T('2026-09-24T17:05:00+03:00'), ok: true, broi: 23, belejka: null },
      { izvor: 'prisystvia', posledno: T('2026-09-24T16:40:00+03:00'), ok: true, broi: 50, belejka: 'Въведено за 8 бригади.' },
      { izvor: 'intranet', posledno: T('2026-09-23T18:05:00+03:00'), ok: false, broi: 40, belejka: 'Входът е изтекъл — влез отново в Интранета от лаптопа.' },
      { izvor: 'server', posledno: T('2026-09-24T17:00:00+03:00'), ok: true, broi: 14, belejka: 'Снимки и документи от деня.' }
    ];
    D.deistviq.push(
      { id: ++D.seq, den_id: null, tochka_id: null, vid: 'napomni', tekst: 'Обади се на доставчика на арматура за точната дата', chovek: null, mqsto: null, srok: T('2026-09-25T08:30:00+03:00'), izvor: 'телефон · бутон +', status: 'izpalneno', vanshen_id: 'demo-1', sazdadeno: T('2026-09-24T11:40:00+03:00'), obnoveno: T('2026-09-24T11:41:00+03:00') },
      { id: ++D.seq, den_id: null, tochka_id: null, vid: 'vazlozhi', tekst: 'Снимки на плоча +9,30 преди армировката', chovek: 'ТР на обекта', mqsto: null, srok: T('2026-09-25T09:00:00+03:00'), izvor: 'телефон · бутон +', status: 'zaqveno', vanshen_id: null, sazdadeno: T('2026-09-24T16:55:00+03:00'), obnoveno: null },
      { id: ++D.seq, den_id: null, tochka_id: null, vid: 'sreshta', tekst: 'Оглед на кофража с надзора', chovek: 'строителния надзор', mqsto: 'сграда 2, плоча +9,30', srok: T('2026-09-25T14:00:00+03:00'), izvor: 'телефон · бутон +', status: 'zaqveno', vanshen_id: null, sazdadeno: T('2026-09-24T17:02:00+03:00'), obnoveno: null }
    );

    // Снимки (§4.9) — генерирани SVG, нито една истинска; автор = ролята от източника.
    // Амур 24.09: 30 в 6 съобщения (8 · 6 · 5 · 5 · 4 · 2); 8-те — към първия чат-източник на първата промяна, 2-те — към
    // източник [2] на същата промяна (16:40), другите — само снимки.
    var a24 = dDayOf('ag', '2026-09-24');
    dPhSrc(a24, dFirstChat(a24), 8);
    dPhSrc(a24, s2, 2);
    [['08:51', 6, 'ТР на обекта', 'kanal', 'канал на обекта'], ['10:05', 5, 'бригадир фасада', 'chat', 'Амур Гардънс'], ['12:34', 5, 'ТР на обекта', 'kanal', 'канал на обекта'],
      ['14:48', 4, 'механизатор', 'chat', 'Амур Гардънс']].forEach(function (m, j) {
      dPhMsg(a24, String(Date.parse('2026-09-24T' + m[0] + ':00+03:00') + 21 + j), m[1], m[2], m[3], m[4]);
    });
    var a23 = dDayOf('ag', '2026-09-23');
    dPhSrc(a23, dFirstChat(a23), 5);
    // Скай 23.09: нов втори източник (чат, 08:12) на решението „Сутеренът е наводнен…“ — 3 снимки
    var k23 = dDayOf('soft', '2026-09-23'), su = k23 ? D.tochki.filter(function (t) { return t.den_id === k23.id && /^Сутеренът е наводнен/.test(t.tekst); })[0] : null;
    if (su) { var sx = dMsgFix(chat(4, 'ТР на обекта · чат „Скай Тауърс“', '08:12'), k23.data); su.izvori.push(sx); dPhSrc(k23, sx, 3); }
    // останалите дни от hist: i % 4 === 3 ? 0 : 2 + i % 5; Амур 11.09 и почивните — без снимки
    HIST.forEach(function (x) {
      var d = x.d;
      if (x.we || (d.obekt === 'ag' && d.data === '2026-09-11') || (d.obekt === 'soft' && d.data === '2026-09-23')) return;
      dPhSrc(d, dFirstChat(d), x.i % 4 === 3 ? 0 : 2 + x.i % 5);
    });
  }
  // --- демо снимки ---
  function dDayOf(o, data) { return D.dni.filter(function (x) { return x.obekt === o && x.data === data; })[0] || null; }
  function dFirstChat(d) {
    if (!d) return null;
    var t = D.tochki.filter(function (x) { return x.den_id === d.id && x.grupa === 'promqna'; }).sort(function (a, b) { return a.red - b.red || a.id - b.id; })[0];
    return t ? (t.izvori || []).filter(function (s) { return !!srcMsg(s); })[0] || null : null;
  }
  // cnt снимки към съобщението; vreme = моментът на съобщението + 0–40 с; пътищата — като истинските, но .svg и никога не се теглят
  function dPhMsg(d, msgId, cnt, avtor, vid, izvor) {
    if (!d || !cnt) return;
    var t = +msgId + (+msgId % 41) * 1000, base = 'demo/' + d.obekt + '/' + d.data + '/';
    for (var n = 1; n <= cnt; n++) {
      var id = ++D.sid, por = id % 3 === 0;
      D.snimki.push({ id: id, den_id: d.id, obekt: d.obekt, data: d.data, msg_id: String(msgId), izvor_vid: vid, izvor: izvor, avtor: avtor,
        vreme: new Date(t).toISOString(), n: n, pat: base + id + '.svg', pat_mini: base + 'mini/' + id + '.svg',
        shirina: por ? 960 : 1280, visochina: por ? 1280 : 960, opisanie: null });
    }
  }
  // снимки към източник от Тиймс: авторът и чатът — от описанието на източника („роля · канал/чат …“)
  function dPhSrc(d, s, cnt) {
    var m = srcMsg(s); if (!d || !m || !cnt) return;
    var k = String(s.kratko || '').split(' · '), ch = String(k[1] || '').split(':')[0].trim(), q = /^чат „(.+)“$/.exec(ch);
    dPhMsg(d, m, cnt, k[0] || 'ТР на обекта', q || /^чат/.test(ch) ? 'chat' : 'kanal', q ? q[1] : (ch || 'канал на обекта'));
  }
  // Картинка за демото: SVG, детерминистична по id (всяка 3-та — портретна 3:4); небе (по-топло следобед), земя,
  // сграда със скеле · кулокран · армировъчна мрежа · сутерен с вода; рамка в цвета на обекта; „ПРИМЕРНА СНИМКА“ и „демо“.
  var DSVG = {}, DPIC = {}, DPR = {};
  function n1(v) { return Math.round(v * 10) / 10; }
  function demoSvg(r) {
    var id = +r.id; if (DSVG[id]) return DSVG[id];
    var por = id % 3 === 0, W = por ? 300 : 400, H = por ? 400 : 300, k = id % 4, gy = n1(H * (k === 3 ? 0.44 : 0.7));
    var pm = new Date(r.vreme).getHours() >= 13, col = r.obekt === 'soft' ? '#5AAEE6' : '#3EB489', s = '', i, x, y;
    function ln(x1, y1, x2, y2, c, w) { return '<line x1="' + n1(x1) + '" y1="' + n1(y1) + '" x2="' + n1(x2) + '" y2="' + n1(y2) + '" stroke="' + c + '" stroke-width="' + w + '"/>'; }
    function rc(x1, y1, w, h, c, ex) { return '<rect x="' + n1(x1) + '" y="' + n1(y1) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + c + '"' + (ex || '') + '/>'; }
    s += '<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (pm ? '#EFA66A' : '#7FB8E6') + '"/><stop offset="1" stop-color="' + (pm ? '#FBE2C4' : '#DCEEFA') + '"/></linearGradient></defs>' +
      rc(0, 0, W, H, 'url(#n)') + rc(0, gy, W, H - gy, '#A38D70');
    if (k === 0) {   // сграда с решетка от прозорци и скеле
      var bx = W * 0.14, bw = W * 0.5, by = H * 0.26, sx = bx + bw + 8;
      s += rc(bx, by, bw, gy - by, '#CFC8BC', ' stroke="#8E877C"');
      for (y = by + 12; y < gy - 18; y += 26) for (x = bx + 10; x < bx + bw - 16; x += 24) s += rc(x, y, 12, 14, '#5E7486');
      for (i = 0; i < 4; i++) s += ln(sx + i * 12, by - 10, sx + i * 12, gy, '#C7832B', 3);
      for (y = by; y < gy; y += 22) s += ln(sx, y, sx + 36, y, '#C7832B', 2);
    } else if (k === 1) {   // кулокран
      var mx = W * 0.32, tp = H * 0.14;
      s += rc(W * 0.55, gy - H * 0.2, W * 0.3, H * 0.2, '#CFC8BC') + ln(mx, gy, mx, tp, '#E0A11B', 4) + ln(mx + 12, gy, mx + 12, tp, '#E0A11B', 4);
      for (y = gy; y > tp + 18; y -= 18) s += ln(mx, y, mx + 12, y - 18, '#E0A11B', 2);
      s += ln(W * 0.1, tp, W * 0.92, tp, '#E0A11B', 5) + rc(W * 0.1, tp + 2, W * 0.1, 16, '#6B6B6B') + rc(mx - 4, tp + 4, 20, 16, '#3F5A73') +
        ln(W * 0.76, tp, W * 0.76, H * 0.5, '#333333', 1.5) + rc(W * 0.76 - 14, H * 0.5, 28, 14, '#7A5B3A');
    } else if (k === 2) {   // армировъчна мрежа в перспектива
      var y0 = H * 0.4;
      s += '<polygon points="0,' + H + ' ' + W + ',' + H + ' ' + n1(W * 0.86) + ',' + n1(y0) + ' ' + n1(W * 0.14) + ',' + n1(y0) + '" fill="#9C9A96"/>';
      for (i = 0; i <= 12; i++) s += ln(W * i / 12, H, W * 0.14 + W * 0.72 * i / 12, y0, '#7B4A2A', 2);
      for (i = 0; i <= 9; i++) { var fr = Math.pow(i / 9, 1.6), yy = y0 + (H - y0) * fr, lx = W * 0.14 * (1 - fr); s += ln(lx, yy, W - lx, yy, '#7B4A2A', 2); }
    } else {   // сутерен със синя вода
      var px = W * 0.08, pw = W * 0.84, py = gy + 6, ph = H - py - 12, wy = py + ph * 0.42;
      s += rc(px, py, pw, ph, '#5E564D') + rc(px, wy, pw, py + ph - wy, '#3E8FD0', ' fill-opacity="0.9"');
      for (i = 0; i < 4; i++) { var wv = wy + 8 + i * 14; s += '<path d="M' + n1(px + 8) + ' ' + n1(wv) + ' q 12 -6 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke="#A9D3F0" stroke-width="2"/>'; }
      s += rc(px + pw - 40, wy - 26, 26, 26, '#C9502F') + ln(px + pw - 27, wy - 26, px + pw - 27, py - 30, '#333333', 3);
    }
    s += '<rect x="4" y="4" width="' + (W - 8) + '" height="' + (H - 8) + '" rx="6" fill="none" stroke="' + col + '" stroke-width="8"/>' +
      '<text x="' + W / 2 + '" y="' + n1(H * 0.46) + '" text-anchor="middle" font-family="sans-serif" font-size="' + n1(W * 0.2) + '" font-weight="700" fill="#FFFFFF" fill-opacity="0.4" transform="rotate(-18 ' + W / 2 + ' ' + H / 2 + ')">демо</text>' +
      rc(8, H - 36, W - 16, 28, '#000000', ' fill-opacity="0.55"') +
      '<text x="' + W / 2 + '" y="' + (H - 17) + '" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">ПРИМЕРНА СНИМКА · №' + id + '</text>';
    return (DSVG[id] = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + s + '</svg>');
  }
  // Едно и също за голяма и миниатюра (векторна е); sign() в демото връща тези data: адреси — без мрежа.
  function demoPic(r) { var id = +r.id; return DPIC[id] || (DPIC[id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(demoSvg(r))); }
  function demoRow(pat) { var l = (D && D.snimki) || []; for (var i = 0; i < l.length; i++) if (l[i].pat === pat || l[i].pat_mini === pat) return l[i]; return null; }
  function demoUrl(pat) { if (!DEMO || !D) return null; var r = DPR[pat] || (DPR[pat] = demoRow(pat)); return r ? demoPic(r) : null; }
  function demoBlob(r) { try { return URL.createObjectURL(new Blob([demoSvg(r)], { type: 'image/svg+xml' })); } catch (e) { return ''; } }

  // ---------- старт ----------
  // Избор на Таблото: запомнен (първо отваряне — „Всички“); обект на Ден: последният показан. ?obekt= избира и двете и се запомня.
  function initSel() {
    var s = lget(K2.obekt), d = lget(K2.denObekt);
    TB.sel = s === 'ag' || s === 'soft' || s === 'all' ? s : 'all';
    OBEKT_KOD = d === 'ag' || d === 'soft' ? d : (TB.sel !== 'all' ? TB.sel : 'ag');
    if (QS_OBEKT) { TB.sel = QS_OBEKT; OBEKT_KOD = QS_OBEKT; lset(K2.obekt, QS_OBEKT); lset(K2.denObekt, QS_OBEKT); }
  }
  // Кешът на Ден става по обект: еднократно местене на стария общ ключ под ключа на неговия обект.
  function migrateDayCache() {
    if (DEMO) return;
    try {
      var old = localStorage.getItem(K.cache); if (!old) return;
      var c = JSON.parse(old);
      if (c && (c.obekt === 'ag' || c.obekt === 'soft') && !localStorage.getItem(dayKey(c.obekt))) {
        if (c.at && !/T/.test(String(c.at))) c.at = '';   // старият час беше само „ЧЧ:ММ“ без дата
        localStorage.setItem(dayKey(c.obekt), JSON.stringify(c));
      }
      localStorage.removeItem(K.cache);
    } catch (e) {}
  }
  function start() {
    var th = (/[?&]theme=(dark|light)(&|$)/.exec(QS) || [])[1];
    if (th) document.documentElement.setAttribute('data-theme', th);
    initSel(); migrateDayCache();
    setBodyO(TB.sel);
    if (DEMO) { $('#demoPill').hidden = false; api = demoApi; demoInit(); routeStart(); return; }
    api = realApi;
    if (!CFG.url || !CFG.key) { stamp('не е настроено', true); screen.innerHTML = '<h1>AiLab</h1><p class="muted">Приложението още не е свързано с облачната база.</p>'; return; }
    // без мрежа при старт — по адреса, от запазеното (без адрес → Таблото) [К9]; само ако на телефона е влизано (след „Изход“ — не)
    if (!window.supabase) { offStart(); return; }
    db = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    db.auth.getSession().then(function (r) {
      user = r.data && r.data.session ? r.data.session.user : null;
      if (user) { lset(K2.vlizal, '1'); routeStart(); }
      else if (navigator.onLine) viewLogin();
      else offStart();
    }, function () { if (navigator.onLine) viewLogin(); else offStart(); });
  }
  function offStart() {
    S.offline = true;
    if (lget(K2.vlizal)) { routeStart(); return; }
    view = 'nonet'; showBox(); renderTabs(); $('#fab').hidden = true; renderBanners();
    stamp('без покритие', true);
    screen.innerHTML = '<section class="empty"><div class="empty-e" aria-hidden="true">📴</div><h1>Няма връзка</h1>' +
      '<p>Влез, когато има покритие.</p></section><a class="btn" href="./">Опитай пак</a>';
  }
  window.addEventListener('online', function () {
    if (!DEMO && db && !user) {
      if (view === 'login') return;
      db.auth.getSession().then(function (r) {
        user = r.data && r.data.session ? r.data.session.user : null;
        if (user) { S.offline = false; flush().then(refreshCurrent); } else viewLogin();
      });
      return;
    }
    if (view === 'tablo' || view === 'day' || view === 'deistviq') flush().then(function () { refreshCurrent(); });
    else if (view === 'karti' && user) loadKarti();
  });
  window.addEventListener('offline', function () {
    if (view === 'tablo' || view === 'day' || view === 'deistviq') setOffline();
    else if (view === 'karti') { var c = readCache(); stamp('без покритие' + (c ? ' · ' + c.at : ''), true); }
  });
  if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(function () {}); }
  start();
})();
