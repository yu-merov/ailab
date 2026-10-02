// AiLab · Етап 4 — „Преглед и задачи“: 4 таба (Табло · Преглед · Задачи · Настройки), подредба по дата, свиване на минатите
// точки, „✎ Поясни“, снимки към точките, целият текст на източниците, задачи с полетата на Интранета, „Поискай информация“.
// Върху Етап 3 („Снимки“), Етап 2 („Табло“) и Етап 1 („Ден“ — сега „Преглед“). Пази входа, запазеното и service worker-а.
// ?demo=1 → вградени примерни данни без вход (нищо не отива в облака).
// Правило: всеки текст от базата/потребителя минава през esc(), преди да влезе в HTML.
(function () {
  'use strict';
  var CFG = window.SHTAB_CONFIG || {};
  var QS = location.search || '';
  var DEMO = /[?&]demo=1(&|$)/.test(QS);
  // Тема и размер на текста — ПРЕДИ първото рисуване (без бяло премигване в тъмна тема); ?theme= в адреса е с предимство.
  function lraw(k) { try { return localStorage.getItem(DEMO ? k + '_demo' : k); } catch (e) { return null; } }
  var QS_TEMA = (/[?&]theme=(dark|light)(&|$)/.exec(QS) || [])[1] || null;
  var FS = { n: 1, l: 1.12, xl: 1.25 };
  function applyLook() {
    var t = QS_TEMA || lraw('ailab_e4_tema'), de = document.documentElement;
    if (t === 'dark' || t === 'light') de.setAttribute('data-theme', t); else de.removeAttribute('data-theme');
    var z = lraw('ailab_e4_zoom'); z = FS[z] ? z : 'n';
    de.style.setProperty('--fs', String(FS[z])); de.setAttribute('data-fs', z);
  }
  applyLook();
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
    okAt: 0, svAt: 0, scrollY: 0, flash: null, actsAt: '', actsOkAt: 0, actsErr: null, actOpen: {},
    // Етап 4: отметките „Готово/Отмени/Бележка“ (deistviq_bel), свитите „Решени/Прегледани“, филтърът в Задачи, „Всички снимки на деня“
    bel: [], revOpen: {}, revCard: {}, zadF: 'all', zadDone: false, phOpen: false, setupFrom: 'tablo', kartiFrom: 'nastroiki', actsT: 0 };
  var OBEKT = { ag: ['Амур Гардънс', 'p-ag'], soft: ['Скай Тауърс', 'p-soft'], gm: ['GM общо', 'p-warn'] };
  var SELK = { ag: 'Амур', soft: 'Скай', all: 'Всички' };
  var SELN = { ag: 'Амур Гардънс', soft: 'Скай Тауърс', all: 'двата обекта' };
  // Черта за „Изисква решение“ [К18]: по-старите решения са под „По-стари решения ›“ (РП може да я мести).
  var RESH_OT = DEMO ? '2026-09-01' : '2026-09-16';
  // Таблото: TB (не T — T е локална функция в демото, T0 — часовникът). Отворени решения и поток — по избор (TB.S.ag|soft|all).
  var TB = { sel: 'all', at: '', tok: 0, busy: 0, okAt: 0, hasBase: false, baseErr: null, dni: [], soon: [], odobri: [], closed: {}, inflight: {},
    S: {}, chart: { sel: null, anim: true }, defer: {}, scrollY: 0, shownAt: 0, measured: false, seenBase: '', built: false, io: null, cardSeen: {}, feedOt: {} };

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
  // Липсваща колона (преди 005_etap4.sql): заявката/записът се повтаря със старите колони — тихо.
  function isNoCol(e) { return !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(e.message || '')); }

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
  function ljget(k, d) { try { var v = lget(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ljset(k, v) { try { lset(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- Етап 4: подредба по дата (всеки списък поотделно; помни се на телефона) ----------
  var RED_K = { resh: 'ailab_e4_red_resh', potok: 'ailab_e4_red_potok', dni: 'ailab_e4_red_dni', zad: 'ailab_e4_red_zad' };
  var RED_DEF = { resh: 'stari', potok: 'novi', dni: 'novi', zad: 'novi' };   // = поведението досега
  var RED_IME = { resh: 'Табло · Изисква решение', potok: 'Табло · Какво се промени', dni: 'Преглед · лентата с дните', zad: 'Задачи' };
  function red(k) { var v = lget(RED_K[k]); return v === 'novi' || v === 'stari' ? v : RED_DEF[k]; }
  function redChip(k) {
    var n = red(k) === 'novi';
    return '<button type="button" class="red-chip" data-a="red" data-k="' + k + '" aria-pressed="' + !n + '" aria-label="Подредба: ' + (n ? 'нови първо' : 'стари първо') + ' — смени">' +
      (n ? 'Нови първо' : 'Стари първо') + ' <span aria-hidden="true">⇅</span></button>';
  }
  // „✓ Видях“ — само отметка на телефона (без запис в базата) [К25]: {<den_id>: {<tid>: ISO}}, до 60 дни, трие се при „Изход“
  var K4 = { vid: 'ailab_e4_vidyano', sp: 'ailab_e4_spisaci', hora: 'ailab_e4_hora', cel: 'ailab_e4_za_men_cel', start: 'ailab_e4_obekt_start', tema: 'ailab_e4_tema', zoom: 'ailab_e4_zoom' };
  function vidAll() { var v = ljget(K4.vid, {}); return v && typeof v === 'object' ? v : {}; }
  function vidOf(den, tid) { var v = vidAll()[den]; return v && v[tid] ? v[tid] : null; }
  function vidMark(den, tids) {
    var v = vidAll(), at = nowIso(), lim = nowMs() - 60 * 864e5;
    v[den] = v[den] || {};
    tids.forEach(function (t) { v[den][t] = at; });
    Object.keys(v).forEach(function (d) { var mx = 0; Object.keys(v[d] || {}).forEach(function (t) { mx = Math.max(mx, Date.parse(v[d][t]) || 0); }); if (mx < lim) delete v[d]; });
    ljset(K4.vid, v);
  }
  function vidUnmark(den, tids) { var v = vidAll(); if (!v[den]) return; tids.forEach(function (t) { delete v[den][t]; }); ljset(K4.vid, v); }

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
  var ANSW = { potvardi: 1, popravka: 1, komentar: 1 };                     // „чака отговор“: точката има мой отговор (✓, поправка, разяснение)
  var OPEN_SEL = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red,dni!inner(obekt,data,status,versiq,hesh,obnoven),resheniq(id),deistviq(id,status)';
  var FEED_COLS = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red';
  var ACT_COLS = 'id,den_id,tochka_id,vid,tekst,chovek,mqsto,srok,izvor,status,sazdadeno,obnoveno';
  var ACT_E4 = ',obekt,cel,danni,razqsnenie,zamenq,belejka,vanshen_id,vanshen_url,klient_id,opit';   // колоните от 005_etap4.sql
  var SOON_MAX = 50;   // таван на заявка 4
  // „Отворена задача“ (броячи, срокове) и „Чака теб“ [§2.1.2]; телефонът показва думите само от ST [К33]
  var OTV = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'vpisano'];
  var CHAKA_TEB = ['dopalni', 'greshka'];
  var CLOSES_DEI = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'vpisano', 'izpalneno', 'greshka'];   // затварят решение (без otmeneno) [К11]
  var BEL_COLS = 'id,deistvie_id,vid,tekst,kogda,obraboteno,rezultat,klient_id';
  var SAOB_COLS = 'id,den_id,data,kluch,vid,vreme,avtor,izvor_vid,izvor,tema,otgovor,do_kopie,tekst,link,snimki_broi,failove,original_url,belejka';
  var SP_COLS = 'vid,stoinost,ime,grupa,obekt,red,skrit,aktiven,obnoveno';
  var E4 = { act: true };   // false → колоните на Етап 4 ги няма (преди 005): заявките на задачите минават на старите [§2]
  function actCols() { return ACT_COLS + (E4.act ? ACT_E4 : ''); }
  // 7а/7б със старите колони при 42703 (един път — после направо старите до следващото отваряне)
  function actQ(build) {
    return R(function () { return build(actCols()); }).then(null, function (e) {
      if (!E4.act || !isNoCol(e)) throw e;
      E4.act = false;
      return R(function () { return build(ACT_COLS); });
    });
  }
  var realApi = {
    dni: function () { return R(function () { return db.from('dni').select(DNI_COLS).eq('obekt', OBEKT_KOD).gte('data', TEST_DO).order('data', { ascending: false }).limit(60); }); },
    // „чакат“ за лентата: точките за решение/непроверени + моите потвърждения и поправки по тях (като на отворения ден)
    counts: function (ids) {
      if (!ids.length) return Promise.resolve({ t: [], r: [] });
      return Promise.all([
        R(function () { return db.from('tochki').select('id,den_id,grupa,istina').in('den_id', ids).in('grupa', ['reshenie', 'neprovereno']); }),
        R(function () { return db.from('resheniq').select('den_id,tochka_id,vid').in('den_id', ids).in('vid', ['potvardi', 'popravka', 'komentar']).not('tochka_id', 'is', null); })
      ]).then(function (rr) { return { t: rr[0] || [], r: rr[1] || [] }; });
    },
    den: function (id) { return R(function () { return db.from('dni').select('*').eq('id', id).maybeSingle(); }); },
    head: function (id) { return R(function () { return db.from('dni').select('id,versiq,status,hesh,obnoven,vpisan_pat').eq('id', id).maybeSingle(); }); },
    tochki: function (id) { return R(function () { return db.from('tochki').select('*').eq('den_id', id).order('red', { ascending: true }).order('id', { ascending: true }); }); },
    istini: function (id) { return R(function () { return db.from('tochki').select('id,istina').eq('den_id', id); }); },
    res: function (id) { return R(function () { return db.from('resheniq').select('id,den_id,tochka_id,vid,tekst,versiq,hesh,kogda,obraboteno,rezultat').eq('den_id', id).order('kogda', { ascending: true }); }); },
    svezhest: function () { return R(function () { return db.from('svezhest').select('izvor,posledno,ok,broi,belejka').abortSignal(tsig()); }); },   // заявка 3
    // заявки 7а (всички отворени + грешки) · 7б (последните 30 приключени) · 8 (отметките) [К9]; преди 005 — старата заявка 7
    deistviq: function () {
      var p7 = actQ(function (c) {
        if (c === ACT_COLS) return db.from('deistviq').select(c).order('sazdadeno', { ascending: false }).limit(100).abortSignal(tsig());
        return db.from('deistviq').select(c).in('status', OTV.concat(['greshka'])).order('sazdadeno', { ascending: false }).limit(500).abortSignal(tsig());
      }).then(function (a) {
        if (!E4.act) return a || [];
        return R(function () { return db.from('deistviq').select(actCols()).in('status', ['izpalneno', 'otmeneno']).order('obnoveno', { ascending: false, nullsFirst: false }).limit(30).abortSignal(tsig()); })
          .then(function (b) { return (a || []).concat(b || []); });
      });
      var p8 = R(function () { return db.from('deistviq_bel').select(BEL_COLS).order('kogda', { ascending: false }).limit(200).abortSignal(tsig()); })
        .then(null, function (e) { if (isMissing(e) || isNoCol(e)) return []; throw e; });
      return Promise.all([p7, p8]).then(function (rr) { return { rows: rr[0], bel: rr[1] }; });
    },
    // проверката на 20 с в Преглед: само задачите на деня (не целия списък) [К9]
    dayActs: function (id) { return actQ(function (c) { return db.from('deistviq').select(c).eq('den_id', id).limit(100).abortSignal(tsig()); }); },
    // deistviq — с .select('id'): телефонът знае номера на реда веднага [К20]
    insert: function (tbl, row) { return R(function () { var q = db.from(tbl).insert(row); return tbl === 'deistviq' ? q.select('id') : q; }); },
    // ---- Етап 4: само SELECT; без таблиците → тихо ----
    // М1: целият текст на съобщенията-източници (по ключ в целия обект — има препратки към друг ден) [§7.2]
    saob: function (obekt, keys) {
      if (!keys.length) return Promise.resolve([]);
      return R(function () { var q = db.from('saobshteniq').select(SAOB_COLS).in('kluch', keys); if (obekt) q = q.eq('obekt', obekt); return q.limit(40).abortSignal(tsig()); });
    },
    // М2: „Съседни съобщения“ — до 3 преди и 3 след в същия чат/канал в същия ден [§7.4]
    saobOkolo: function (den, izvor, t) {
      function q(op, asc) { return R(function () { return db.from('saobshteniq').select('id,kluch,vreme,avtor,tekst,tema').eq('den_id', den).eq('izvor', izvor)[op]('vreme', t).order('vreme', { ascending: asc }).limit(3).abortSignal(tsig()); }); }
      return Promise.all([q('lt', false), q('gt', true)]).then(function (rr) { return { pred: (rr[0] || []).reverse(), sled: rr[1] || [] }; });
    },
    // файловете на деня (връзките към OneDrive на „Файлове/…“ източниците) [И6]
    saobFiles: function (den) { return R(function () { return db.from('saobshteniq').select('den_id,kluch,failove').eq('den_id', den).neq('failove', '[]').limit(80).abortSignal(tsig()); }); },
    spisaci: function () { return R(function () { return db.from('intranet_spisaci').select(SP_COLS).order('vid').order('red').limit(1000).abortSignal(tsig()); }); },
    // С5: снимките на видимите карти в „Изисква решение“ [§6.2]
    phMsgs: function (denIds, msgIds) {
      if (!denIds.length || !msgIds.length) return Promise.resolve([]);
      return R(function () { return db.from('snimki').select('id,den_id,msg_id,vreme,n,pat,pat_mini,shirina,visochina,avtor').in('den_id', denIds).in('msg_id', msgIds).order('vreme').order('n').limit(300).abortSignal(tsig()); });
    },
    mqsto: function () { return R(function () { return db.rpc('mqsto_snimki').abortSignal(tsig()); }).then(function (r) { return Array.isArray(r) ? r[0] || null : r; }); },
    // ---- Таблото (Етап 2): само SELECT ----
    tDni: function () { return R(function () { return db.from('dni').select('id,obekt,data,status,versiq,hora,obnoven').gte('data', TEST_DO).order('data', { ascending: false }).order('obekt').limit(400).abortSignal(tsig()); }); },
    // заявка 2: отворените решения с една заявка (анти-съединение в PostgREST) + общият брой
    tOpen: function (sel, rg, old) {
      return RC(function () {
        // отменена задача не затваря решението [К11]: анти-съединението брои само задачи в другите състояния
        var q = db.from('tochki').select(OPEN_SEL, { count: 'exact' }).eq('grupa', 'reshenie')
          .in('resheniq.vid', ['potvardi', 'popravka', 'osporva', 'komentar']).is('resheniq', null)
          .in('deistviq.status', CLOSES_DEI).is('deistviq', null);
        q = old ? q.lt('dni.data', RESH_OT).gte('dni.data', TEST_DO) : q.gte('dni.data', RESH_OT);
        if (sel !== 'all') q = q.eq('dni.obekt', sel);
        // ⚠️ важните винаги най-горе; после по дата според подредбата (§4)
        return q.order('vajnost', { ascending: false }).order('dni(data)', { ascending: red('resh') === 'stari' }).order('red').order('id').range(rg[0], rg[1]).abortSignal(tsig());
      });
    },
    // заявка 4: отворените със срок ≤ сега+48 ч + „Чака теб“ (dopalni, greshka) — значката на Задачи е вярна още при старт [К10];
    // най-близките до границата първо (просрочените растат) — таванът не изрязва сроковете до 48 ч
    tSoon: function () {
      var lim = new Date(nowMs() + 48 * 36e5).toISOString();
      return actQ(function (c) {
        return db.from('deistviq').select(c)
          .or('and(srok.lte.' + lim + ',status.in.(' + OTV.join(',') + ')),status.in.(' + CHAKA_TEB.join(',') + ')')
          .order('srok', { ascending: false, nullsFirst: false }).limit(SOON_MAX).abortSignal(tsig());
      });
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
  function newQid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // Ключът на натискането [К1]: всеки ред към resheniq/deistviq/deistviq_bel носи klient_id = qid (същият при всеки повторен опит)
  // → изгубен отговор + повторно изпращане дава 23505 („вече е там“), а не втори ред / втора задача в Интранета.
  var KID_T = { resheniq: 1, deistviq: 1, deistviq_bel: 1 };
  function enqueue(tbl, row, meta, at, qid) {
    qid = qid || newQid();
    if (KID_T[tbl] && row && row.klient_id == null && /^[0-9a-z]{8,40}$/.test(qid)) row = Object.assign({}, row, { klient_id: qid });
    var it = { qid: qid, tbl: tbl, row: row, at: at || nowIso(), tt: (meta && meta.tt) || null };
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
  var E4_ROW = ['obekt', 'cel', 'danni', 'razqsnenie', 'zamenq', 'klient_id'];
  // → {row (както е записан), id (deistviq — номерът от .select('id')), dup (вече беше там)}
  function insertFk(tbl, row, tt, n) {
    n = n || 0;
    return api.insert(tbl, row).then(function (d) {
      return { row: row, id: Array.isArray(d) && d[0] && d[0].id != null ? d[0].id : null };
    }, function (e) {
      // вече е там: отговорът на по-ранното изпращане със същия ключ се е изгубил [К1]
      if (e && e.code === '23505' && /klient_id/.test((e.message || '') + ' ' + (e.details || ''))) return { row: row, id: null, dup: true };
      // преди 005_etap4.sql: без новите колони (работникът прави такава заявка „✎ допълни“ — мисълта не се губи)
      if (n < 3 && isNoCol(e) && E4_ROW.some(function (k) { return k in row; })) {
        var r = Object.assign({}, row); E4_ROW.forEach(function (k) { delete r[k]; });
        if (tbl === 'deistviq') E4.act = false;
        return insertFk(tbl, r, tt, n + 1);
      }
      var f = n < 3 ? fkFix(tbl, row, e, tt) : null;
      if (f) return insertFk(tbl, f, tt, n + 1);
      if (tbl === 'deistviq_bel' && isMissing(e)) e.bg = 'базата още не е готова за „Готово / Отмени / Бележка“ — лаптопът я обновява';
      else if (tbl === 'deistviq' && e && e.code === '23514' && /deistviq_(vid|status)_check/.test(e.message || '')) e.bg = 'базата още не приема този вид задача — лаптопът я обновява';
      throw e;
    });
  }
  function afterSent(it, res) {
    res = res || {};
    var row = Object.assign({ id: 'l' + it.qid, kogda: it.at, sazdadeno: it.at, status: 'zaqveno', obraboteno: null, rezultat: null }, res.row || it.row);
    if (res.id != null) row.id = res.id;
    function has(l) { return !!row.klient_id && l.some(function (x) { return x.klient_id === row.klient_id; }); }
    if (it.tbl === 'resheniq' && S.den && row.den_id === S.den.id && !has(S.res)) S.res.push(row);
    if (it.tbl === 'deistviq' && !has(S.deistviq)) S.deistviq.unshift(row);
    if (it.tbl === 'deistviq_bel' && !has(S.bel)) S.bel.unshift(row);
    if (it.tbl === 'resheniq' && row.vid === 'odobri') TB.odobri.push({ den_id: row.den_id, versiq: row.versiq });
    // Таблото: записът вече е в базата — новите заявки 2 не връщат точката (TB.closed се чисти по-късно) [К23]
    var tid = it.row && it.row.tochka_id;
    if (tid != null && TB.closed[tid] && closingRow(it.tbl, it.row)) TB.closed[tid].sent = nowIso();
  }
  // Праща ред: ПЪРВО в опашката (синхронно в localStorage — iOS може да замрази страницата насред заявката [К22]), после flush().
  // С klient_id двойното изпращане е безвредно [К1]. Връща 'sent' | 'queued'; отхвърля само при истинска грешка от базата:
  // o.keep = false (по подразбиране) → записът излиза от опашката (листът с текста е още отворен — нищо не се губи);
  // o.keep = true (след 5 с „Отмени“ листът вече е затворен) → остава в опашката с грешката (лентата „не се записа — виж“).
  var FL = { net: false };
  function send(tbl, row, meta, o) {
    o = o || {};
    var it = enqueue(tbl, row, meta, o.at, o.qid);
    if (S.forceOff || !navigator.onLine || (!DEMO && (!db || !user))) return Promise.resolve('queued');
    FL.net = false;
    return flush(true).then(function () {
      var x = findQ(it.qid);
      if (!x) return 'sent';
      if (x.err) {
        if (!o.keep) { dropQ(x.qid); renderBanners(); }
        return Promise.reject({ code: x.code, message: x.err, bg: x.err, kept: !!o.keep });
      }
      if (FL.net && !S.offline) setOffline();
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
          if (isNet(e) || isAuth(e)) { if (isNet(e)) FL.net = true; fin(); return; }
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
    c.bel = S.bel.filter(function (b) { return typeof b.id === 'number'; });
    c.last = S.den ? S.den.id : null; c.days = c.days || {};
    if (S.den) {
      // снимките на деня — само пътищата и данните (без подписани адреси), до 120 реда; С1 още не е дошла → старите остават
      var prev = c.days[S.den.id], ph = PH.den === S.den.id && PH.list ? phRows(PH.list) : (prev && prev.snimki) || null;
      // отворените вече съобщения на деня — до 40, текстът до 1 500 зн. [§7.3]
      var sb = saobForDay(S.den.id, S.den.obekt || OBEKT_KOD);
      if (!sb.length && prev && prev.saob) sb = prev.saob;
      c.days[S.den.id] = { den: S.den, tochki: S.tochki, res: S.res, t: Date.now() };
      if (ph) c.days[S.den.id].snimki = ph;
      if (sb.length) c.days[S.den.id].saob = sb;
    }
    Object.keys(c.days).sort(function (a, b) { return c.days[b].t - c.days[a].t; }).slice(6).forEach(function (k) { delete c.days[k]; });
    phSetCache(c);
    S.dataAt = c.at;
  }
  // Квота на телефона [К31]: при препълване — първо без текстовете на съобщенията, после без снимките, после както досега.
  function phSetCache(c) {
    if (ssetOk(dayKey(), c)) return;
    Object.keys(c.days || {}).forEach(function (k) { delete c.days[k].saob; });
    if (ssetOk(dayKey(), c)) return;
    Object.keys(c.days || {}).forEach(function (k) { delete c.days[k].snimki; });
    sset(dayKey(), c);
  }
  function fromCache(id) {
    var c = sget(dayKey(), null); if (!c || c.obekt !== OBEKT_KOD) return false;
    S.dni = c.dni || []; S.counts = c.counts || {}; S.svezhest = c.svezhest || []; S.deistviq = c.deistviq || []; S.dataAt = c.at || '';
    if (Array.isArray(c.bel) && !S.bel.length) S.bel = c.bel;
    var days = c.days || {}, day = days[id || c.last];
    if (!day) { var k = Object.keys(days)[0]; day = k ? days[k] : null; }
    if (day) {
      var same = S.den && S.den.id === day.den.id; S.den = day.den; S.tochki = day.tochki || []; S.res = day.res || []; if (!same) { S.openedAt = activeMs(); S.newVersiq = 0; }
      if (PH.den !== day.den.id) phPick(day.den.id, Array.isArray(day.snimki) ? day.snimki : null);   // снимките — от кеша, веднага
      saobPut(day.saob, day.den.obekt || OBEKT_KOD, true);
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
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.tochka_id != null && ANSW[it.row.vid]) own[it.row.tochka_id] = 1; });
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
        S.counts = countMap(rr[0]); S.svezhest = rr[1] || []; setActs(rr[2]);
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
      // „прегледът е отворен“ — записва се при първото натискане в деня, не при зареждане (при зареждане не се пише нищо — А19)
      if (!S.seen[id]) { S.seen[id] = 1; S.seenPend = id; }
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
      screen.innerHTML = scrHead('day') + '<section class="empty"><div class="empty-e" aria-hidden="true">📴</div><h1>Няма връзка</h1><p>Отвори AiLab, когато има покритие.</p></section>' + smallFoot(true);
      return;
    }
    stamp('грешка', true);
    screen.innerHTML = scrHead('day') + '<h1>Нещо се обърка</h1><div class="err">' + esc(errBg(e)) + '</div><button class="btn" type="button" data-a="retry">Опитай пак</button>';
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
      return Promise.all([api.head(id), api.res(id), api.istini(id), api.svezhest(), api.dayActs(id), api.dni()]);
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
      // задачите на деня подменят само своите редове в общия списък (целият списък — при Задачи, старт и на 2 мин) [К9]
      var dayA = rr[4] || [], seenA = {};
      dayA.forEach(function (a) { seenA[a.id] = 1; });
      S.deistviq = S.deistviq.filter(function (a) { return !(typeof a.id === 'number' && (a.den_id === id || seenA[a.id])) && !(a.klient_id && dayA.some(function (x) { return x.klient_id === a.klient_id; })); }).concat(dayA);
      S.svezhest = rr[3] || []; S.svAt = Date.now(); S.okAt = Date.now();
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
  // Моите записи по точка: ✓ (potvardi), поправки, разяснения (komentar) — от базата и от опашката; err = отказан запис.
  function mine(tid, q) {
    var o = { ok: null, fix: [], kom: [], err: false, osp: false, dn: null }, bad = false;   // dn: последното 📘/🚫 (true/false) или null
    // tekst 'отговорено' = „✓ Отговорено“ на решение (Таблото / заключен ден) — различно от „✓ вярно“ [К20]
    S.res.forEach(function (r) {
      if (r.tochka_id !== tid) return;
      if (r.vid === 'potvardi') o.ok = { at: r.kogda, pend: false, otg: r.tekst === 'отговорено' };
      if (r.vid === 'popravka') o.fix.push({ tekst: r.tekst, at: r.kogda, rez: r.rezultat, pend: false });
      if (r.vid === 'komentar') o.kom.push({ tekst: r.tekst, at: r.kogda, rez: r.rezultat, pend: false });
      if (r.vid === 'osporva') o.osp = true;
      if (r.vid === 'izkljuchi' || r.vid === 'vkljuchi') o.dn = r.vid === 'vkljuchi';
    });
    (q || queue()).forEach(function (it) {
      if (it.tbl !== 'resheniq' || it.row.tochka_id !== tid) return;
      if (it.err) o.err = true;
      if (it.row.vid === 'potvardi' && !it.err) o.ok = { at: it.at, pend: true, otg: it.row.tekst === 'отговорено' };
      if (it.row.vid === 'potvardi' && it.err) bad = true;
      if (it.row.vid === 'popravka') o.fix.push({ tekst: it.row.tekst, at: it.at, pend: true, err: it.err || '' });
      if (it.row.vid === 'komentar') o.kom.push({ tekst: it.row.tekst, at: it.at, pend: true, err: it.err || '' });
      if ((it.row.vid === 'izkljuchi' || it.row.vid === 'vkljuchi') && !it.err) o.dn = it.row.vid === 'vkljuchi';
    });
    // отговорено от Таблото, докато денят тук е от по-старо зареждане (или от кеша) [К23]
    var c = TB.closed[tid];
    if (!o.ok && !bad && c && c.ok) o.ok = { at: c.at, pend: !c.sent && !!TB.inflight[tid], otg: true };
    return o;
  }
  // 📘 В дневника / 🚫 Не за дневника: моят последен избор, иначе tochki.v_dnevnika (по подразбиране — в дневника).
  // Точка без k (стара чернова без ⟦k⟧ в записа) не може да се изключи — работникът нямаше да знае кои редове.
  function vDn(t, q) { var d = mine(t.id, q).dn; return d !== null ? d : t.v_dnevnika !== false; }
  function dnMozhe(t) { return t.k != null; }
  function newPending() { return !!(S.den && S.newVersiq > S.den.versiq); }
  // Одобрен (или чакащ лаптопа) и вписан ден: поправка вече не влиза в записа — картите остават с „✓ Видях“, „✎ Поясни“ (разяснение) и „→ Задача“.
  function locked() { return !!S.den && apprState().k !== 'none'; }
  function okNoErr(l) { return l.some(function (f) { return !f.err; }); }
  // „чака отговор“ (лентата с дните, листът „Одобряваш ли…“): решение/непроверено без мой отговор — както досега [К25]
  function handled(t) { var m = mine(t.id); return t.istina === 'provereno' || !!m.ok || okNoErr(m.fix) || okNoErr(m.kom); }
  function openCount() { var g = groupsOf(); return g.reshenie.concat(g.neprovereno).filter(function (t) { return !handled(t); }).length; }
  // Задачите към точка (базата + опашката, без отказаните); отменените се връщат отделно — те вече не затварят точката [К11]
  function tasksOf(tid, q) {
    var out = [];
    (q || queue()).forEach(function (it) { if (it.tbl === 'deistviq' && it.row.tochka_id === tid && !it.err) out.push(Object.assign({ _pend: true, _qid: it.qid, sazdadeno: it.at, id: 'q' + it.qid, status: 'zaqveno' }, it.row)); });
    S.deistviq.forEach(function (a) { if (a.tochka_id === tid && !out.some(function (x) { return x.klient_id && x.klient_id === a.klient_id; })) out.push(a); });
    return out;
  }
  function errOf(tid, q) { return (q || queue()).some(function (it) { return it.err && it.row && it.row.tochka_id === tid && (it.tbl === 'resheniq' || it.tbl === 'deistviq'); }); }
  // „Прегледана“ [§5.1]: мой запис (✓/поправка/разяснение/оспорване), задача към нея (без отменените), затворена от Таблото,
  // или локалното „✓ Видях“ (само промени/непроверени). istina='provereno' сама по себе си НЕ прави точката прегледана.
  function pregledana(t, q) {
    q = q || queue();
    var m = mine(t.id, q);
    if (m.ok || okNoErr(m.fix) || okNoErr(m.kom) || m.osp || m.dn === false) return true;
    if (tasksOf(t.id, q).some(function (a) { return a.status !== 'otmeneno'; })) return true;
    if (TB.closed[t.id] && !errOf(t.id, q)) return true;
    if (t.grupa !== 'reshenie' && S.den && vidOf(S.den.id, t.id)) return true;
    return false;
  }
  function undoing(t) { return !!UNDO['pc:' + t.id]; }
  // „остават N“ — непрегледаните във всичките три групи (плочките, „Следващ ›“); различно от „чакат отговор“ [К25]
  function ostavat(list, q) { q = q || queue(); return list.filter(function (t) { return !pregledana(t, q) && !undoing(t); }).length; }
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
  var IZ = { teams: ['Тиймс', '💬'], poshta: ['Поща', '✉️'], prisystvia: ['Присъствия', '👷'], intranet: ['Интранет', '🗂️'], server: ['Сървър', '🗄️'], laptop: ['Лаптоп', '💻'] };
  var IZ_RED = ['teams', 'poshta', 'prisystvia', 'intranet', 'server', 'laptop'];
  var TIP_EMO = { 'тиймс': '💬', 'поща': '✉️', 'присъствия': '👷', 'интранет': '🗂️', 'снимка': '📸', 'сървър': '🗄️', 'метео': '🌡️' };
  function tipEmo(tip) { return TIP_EMO[String(tip || '').toLowerCase()] || '📄'; }

  // ---------- заглавие на всеки екран: името + едно изречение „какво е това“ (§3.2) ----------
  var SCR = {
    tablo: ['Табло', 'Какво става на обектите и какво чака теб'],
    day: ['Преглед', 'Черновата на деня: мини по точките и одобри'],
    deistviq: ['Задачи', 'Каквото си поискал: за теб, възложени, напомняния, срещи, искания — и докъде са стигнали'],
    nastroiki: ['Настройки', 'Как изглежда и как работи AiLab на този телефон']
  };
  function scrHead(k) { return '<header class="scr-h"><h1>' + SCR[k][0] + '</h1><p>' + SCR[k][1] + '</p></header>'; }
  // Малък колонтитул само за екраните без път до Настройки (базата не е готова, няма връзка) [К29]
  function smallFoot(retry) {
    return '<footer class="foot">' + (retry ? '<button class="btn" type="button" data-a="retry">Опитай пак</button>' : '') +
      (DEMO ? '<a class="btn ghost" href="./">Изход от демото</a>' : '<button class="btn ghost" type="button" data-a="logout">Изход</button>') + '</footer>';
  }

  // ---------- екран „Преглед“ (досега „Ден“) ----------
  function renderDay() {
    if (view !== 'day') return;   // закъснял отговор на Ден не пише върху друг екран [К2]
    $('#fab').hidden = false;
    startPoll();
    setHash(S.den ? '#pregled/' + S.den.id : '#pregled');
    if (!S.dni.length && !S.den) { renderEmpty(); return; }
    screen.innerHTML = scrHead('day') +
      '<section class="strip-w"><div class="strip-h"><button type="button" class="ochip och-sw" data-a="dObekt" aria-label="' + esc('Обект: ' + OBEKT[OBEKT_KOD][0] + ' — смени') + '">' +
        esc(OBEKT[OBEKT_KOD][0]) + ' <span aria-hidden="true">⇄</span></button><span class="strip-r"><span class="small muted">' + esc(monthLbl()) + '</span><span id="redDni">' + redChip('dni') + '</span></span></div>' +
      '<div class="strip" id="strip" role="tablist" aria-label="Дни"></div>' +
      '<div class="legend" aria-hidden="true"><span><i class="lg-ch"></i>чернова</span><span><i class="lg-od"></i>одобрен · чака лаптопа</span><span><i class="lg-vp"></i>вписан</span></div></section>' +
      '<div id="fresh"></div><section id="sum"></section><div id="groups" class="groups"></div>' +
      '<section id="ph" class="phs-w" aria-label="Всички снимки на деня"></section><section id="full"></section>' +
      '<div id="appr"></div><div id="apprNx"></div><section id="acts" class="actsec"></section>';
    renderStrip(); renderFresh(); renderSum(); renderGroups(); renderPh(); renderFull(); renderAppr(); renderActs(); renderBanners();
    centerStrip();
    if (S.flash && S.den && S.flash.den === S.den.id) setTimeout(flashPoint, 80);   // от Таблото: точката светва
  }
  // Избраният ден — в средата на лентата (и при „Стари първо“)
  function centerStrip() {
    var st = $('#strip'), sel = $('.sd.sel');
    if (st && sel) st.scrollLeft = Math.max(0, sel.offsetLeft - (st.clientWidth - sel.offsetWidth) / 2);
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
    var sig = sigOf(); if (sig !== S.sig) keepAnchor(function () { renderSum(); renderGroups(); });
    keepY(['#ph'], renderPh);   // снимките: box() пише само при промяна (напр. покритие ⇄ без покритие)
  }
  // Подписът на „какво е на екрана“: проверката на 20 с не подменя картите под пръста без нужда (правилото на box()) [§5.3 т.6]
  function sigOf() {
    var q = queue();
    return JSON.stringify([S.tochki.map(function (t) { return t.istina; }), S.res.map(function (r) { return [r.id, r.rezultat]; }),
      q.filter(function (x) { return x.tbl === 'resheniq' || x.tbl === 'deistviq' || x.tbl === 'deistviq_bel'; }).map(function (x) { return x.qid + (x.err ? '!' : ''); }),
      S.deistviq.filter(function (a) { return a.tochka_id != null; }).map(function (a) { return a.id + ':' + a.status; }),
      S.den ? S.den.status : '', locked(), S.den ? vidAll()[S.den.id] || null : null, Object.keys(UNDO).sort(),
      S.den && PH.den === S.den.id && PH.list ? PH.list.length : -1, S.revOpen, S.revCard, newPending()]);
  }
  // Без скачане под палеца: първият видим елемент на #groups остава на същото място след пречертаването [К23, Е2-К11].
  // skip — картата, която излиза (над видимото): котвата е следващият елемент.
  function keepAnchor(fn, skip) {
    var tw = $('.topwrap'), top = tw ? tw.getBoundingClientRect().bottom : 0, a = null, y0 = 0;
    var els = document.querySelectorAll('#groups [data-anc]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-anc'); if (skip != null && k === 'p' + skip) continue;
      var r = els[i].getBoundingClientRect(); if (r.bottom > top + 2) { a = k; y0 = r.top; break; }
    }
    fn();
    if (!a || (window.pageYOffset || 0) <= 0 && skip == null) return;
    var n = document.querySelector('#groups [data-anc="' + a + '"]'); if (!n) return;
    var dy = n.getBoundingClientRect().top - y0;
    if (Math.abs(dy) >= 1) window.scrollBy(0, dy);
  }
  function renderEmpty() {
    screen.innerHTML = scrHead('day') +
      '<section class="empty"><div class="empty-e" aria-hidden="true">🌙</div><h1>Още няма чернови</h1>' +
      '<p>За ' + esc(OBEKT[OBEKT_KOD][0]) + ' в облака още няма качен ден. Лаптопът качва черновата вечер (около 17:30) — тогава тя се появява тук с резюмето, точките за решение и бутона „Одобрявам“.</p>' +
      '<p class="small muted">Задачите (бутонът „+“) работят и сега — не чакат черновата.</p></section>' +
      '<div id="fresh"></div><section id="acts" class="actsec"></section>';
    renderFresh(); renderActs(); renderBanners();
  }
  // Лентата с табовете остава и тук: Табло/Преглед/Задачи показват същото съобщение, Настройки работи без база [К29]
  function renderSetup() {
    commitUndos(); stopPoll();
    if (view !== 'setup' && view !== 'nastroiki') S.setupFrom = view === 'tablo' || view === 'day' || view === 'deistviq' ? view : S.setupFrom;
    view = 'setup'; showBox(); renderTabs(); renderBanners(); $('#fab').hidden = true; stamp('базата не е готова', true);
    screen.innerHTML = '<section class="empty"><div class="empty-e" aria-hidden="true">🛠️</div><h1>Базата още не е готова</h1>' +
      '<p>Таблиците на Етап 1 (дни, точки, решения, задачи) още не са създадени в облака. Лаптопът ги създава с <b>002_etap1.sql</b> — после отвори AiLab пак.</p></section>' +
      smallFoot(true);
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
    var keep = el.scrollLeft, list = red('dni') === 'stari' ? S.dni.slice().reverse() : S.dni;   // „Стари първо“ — най-старият вляво (§4)
    el.innerHTML = list.map(function (x) {
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
    var g = groupsOf(), p = stPill(), phl = phCur(), phn = phl ? phl.length : 0, q = queue();
    el.className = 'sum';
    el.innerHTML =
      '<div class="sum-h"><span class="small muted">Чернова от ' + esc(rel(d.obnoven)) + '</span><span class="sum-hr">' +
        (phn ? '<button type="button" class="sum-ph" data-a="phJump" aria-label="' + esc('Снимки: ' + phn + ' — към секцията') + '">📷 ' + phn + ' ›</button>' : '') +
        '<span class="pill ' + p[1] + '">' + esc(p[0]) + ' · v' + esc(d.versiq) + '</span></span></div>' +
      '<h2 class="sum-d">' + esc(dayTitle(d.data)) + '</h2>' +
      '<div class="sum-main"><div class="hora"><span class="hora-n">' + (d.hora == null ? '—' : esc(d.hora)) + '</span><span class="hora-l">👷 души<br>на обекта</span></div>' +
      '<p class="rez">' + esc(d.rezyume || 'Няма резюме.') + '</p></div>' +
      // и трите плочки: „остават N“ (непрегледани) или „✓ всичко“ — потокът има край [§5.5]
      '<div class="stats">' + GRUPI.map(function (G) {
        var n = g[G.k].length, l = ostavat(g[G.k], q);
        return '<button type="button" class="stat g-' + G.k + '" data-a="jump" data-g="' + G.k + '" aria-label="' + esc(G.t + ': ' + n + (n ? (l ? ', остават ' + l : ', всичко е прегледано') : '')) + '"><b>' + n + '</b><span>' + G.sh + '</span>' +
          (n ? '<em class="' + (l ? '' : 'ok') + '">' + (l ? 'остават ' + l : '✓ всичко') + '</em>' : '') + '</button>';
      }).join('') + '</div>';
    S.sig = sigOf();
  }
  // Групите: непрегледаните карти горе (подредбата не се мени), „✓ Видях останалите (N)“ за промените/непроверените,
  // най-долу свитото „✓ Решени (N)“ / „✓ Прегледани (N)“ [§5.2–5.3]. Всяка група се пише отделно (box() за всяко дете).
  function renderGroups() {
    var el = $('#groups'); if (!el) return;
    if (!S.den) { if (el._h !== '') { el.innerHTML = ''; el._h = ''; } return; }
    var g = groupsOf(), lk = locked(), q = queue();
    if (el._h !== 'grp') {
      el.innerHTML = '<p class="lockline" id="g-lock" hidden></p>' + GRUPI.map(function (G) {
        return '<section class="grp g-' + G.k + '" id="g-' + G.k + '" aria-label="' + esc(G.t) + '"></section>';
      }).join('');
      el._h = 'grp';
    }
    var ll = $('#g-lock'), lh = lk ? '🔒 ' + (S.den.status === 'vpisana' ? 'Денят е вписан' : 'Денят е одобрен') +
      ' — поправка вече не влиза в записа. Можеш да отбележиш „✓ Видях“, да добавиш разяснение („✎ Поясни“) или задача („→ Задача“). Решенията — „✓ Отговорено“.' : '';
    if (ll && ll._h !== lh) { ll.textContent = lh; ll.hidden = !lh; ll._h = lh; }
    GRUPI.forEach(function (G) {
      var sec = document.getElementById('g-' + G.k); if (!sec) return;
      var h = grpHtml(G, g[G.k], q);
      if (sec._h !== h) { sec.innerHTML = h; sec._h = h; }
    });
    // лентите „Отмени“ текат от натискането, не от последното пречертаване
    Array.prototype.forEach.call(el.querySelectorAll('[data-ub]'), function (b) {
      var u = UNDO[b.getAttribute('data-ub')]; if (u) b.style.animationDuration = Math.max(0, UNDO_MS - (Date.now() - u.t0)) + 'ms';
    });
    S.sig = sigOf();
  }
  function grpHtml(G, arr, q) {
    var open = [], rev = [];
    arr.forEach(function (t) { if (pregledana(t, q) && !undoing(t)) rev.push(t); else open.push(t); });
    var left = open.filter(function (t) { return !undoing(t); }).length;
    var h = '<div class="grp-h" data-anc="g' + G.k + '"><h2>' + G.t + '</h2><span class="grp-n">' + arr.length + '</span>' +
      (arr.length ? '<span class="grp-l' + (left ? '' : ' ok') + '">' + (left ? 'остават ' + left + ' от ' + arr.length : '✓ всичко') + '</span>' : '') + '</div>' +
      '<p class="grp-s">' + G.s + '</p>';
    if (!arr.length) return h + '<p class="grp-e">' + G.e + '</p>';
    h += open.map(function (t) { return pointCard(t); }).join('');
    // „✓ Видях останалите (N)“ — 1 докосване вместо N (само промени и непроверени) [К25]
    var gu = UNDO['grp:' + G.k];
    if (G.k !== 'reshenie' && (gu || left > 1)) {
      h += gu ? '<div class="seen-all undoing"><span>' + esc(gu.lbl) + '</span><button type="button" class="pa" data-a="undo" data-k="grp:' + G.k + '">Отмени</button><i class="u-bar" data-ub="grp:' + G.k + '" aria-hidden="true"></i></div>'
        : '<button type="button" class="btn ghost seen-all" data-a="seenAll" data-g="' + G.k + '">✓ Видях останалите (' + left + ')</button>';
    }
    if (!open.length && !rev.length) return h;
    if (rev.length) {
      rev.sort(function (a, b) { var x = revInfo(a, q).at, y = revInfo(b, q).at; return x < y ? 1 : x > y ? -1 : 0; });   // последното горе
      var on = !!S.revOpen[G.k], nm = G.k === 'reshenie' ? 'Решени' : 'Прегледани';
      h += '<div class="rev"><button type="button" class="rev-h" data-a="revGrp" data-g="' + G.k + '" aria-expanded="' + on + '" data-anc="r' + G.k + '"><span>✓ ' + nm + ' (' + rev.length + ')</span><span class="chev" aria-hidden="true">▾</span></button>' +
        (on ? rev.map(function (t) { return S.revCard[t.id] ? pointCard(t, true) : revRow(t, q); }).join('') : '') + '</div>';
    }
    return h;
  }
  // Какво съм направил с точката — за свития ред и за подредбата в „Решени/Прегледани“
  function revInfo(t, q) {
    var m = mine(t.id, q), ts = tasksOf(t.id, q).filter(function (a) { return a.status !== 'otmeneno'; }), lk = locked(), at = '', r;
    function mx(x) { if (x && String(x) > at) at = String(x); }
    if (m.ok) mx(m.ok.at); m.fix.forEach(function (f) { mx(f.at); }); m.kom.forEach(function (f) { mx(f.at); }); ts.forEach(function (a) { mx(a.sazdadeno); });
    if (TB.closed[t.id]) mx(TB.closed[t.id].at);
    var vd = S.den ? vidOf(S.den.id, t.id) : null; mx(vd);
    var f = m.fix.filter(function (x) { return !x.err; }).pop(), k = m.kom.filter(function (x) { return !x.err; }).pop();
    if (f) r = { ico: '✎', st: 'поправка · ' + (f.pend ? 'чака връзка' : (f.rez || 'чака Claude')) };
    else if (k) r = { ico: '💬', st: 'разяснение · ' + (k.pend ? 'чака връзка' : (lk && (!k.rez || /чака Claude/i.test(k.rez)) ? 'записано' : (k.rez || 'чака Claude'))) };
    else if (m.dn === false) r = { ico: '🚫', st: 'не за дневника' };
    else if (ts.length) { var a = ts[0], v = VID[a.vid] || ['📌', 'задача']; r = { ico: v[0], st: v[1] + ' · ' + stOf(a)[0] }; }
    else if (m.ok) r = { ico: '✓', st: (m.ok.otg ? 'отговорено' : 'вярно') + (m.ok.pend ? ' · чака връзка' : '') };
    else if (TB.closed[t.id]) r = { ico: '✓', st: 'отговорено от Таблото' };
    else r = { ico: '✓', st: 'видях' };
    r.at = at;
    return r;
  }
  // Свит ред (≥ 48 px, цял бутон): знак + емотикон + ~70 знака + „ · състояние“ (+ „📷 N“) → тап разгъва на място
  function revRow(t, q) {
    var r = revInfo(t, q), ph = tPhotos(t), n = ph ? ph.length : 0;
    return '<button type="button" class="rev-r" data-a="revCard" data-tid="' + esc(t.id) + '" aria-expanded="false" data-anc="v' + esc(t.id) + '">' +
      '<span class="rev-i" aria-hidden="true">' + r.ico + '</span><span class="rev-t"><span aria-hidden="true">' + emoT(t) + '</span> ' + esc(clip(t.tekst, 70)) +
      ' <span class="rev-s">· ' + esc(r.st) + (n ? ' · 📷 ' + n : '') + '</span></span></button>';
  }
  // Карта на точка. rv = разгъната от „Решени/Прегледани“ (горе — свиващият ред). Бутоните — по групата и деня [§5.2].
  function pointCard(t, rv) {
    var q = queue(), m = mine(t.id, q), hot = (t.vajnost || 1) >= 3, ist = ISTINA[t.istina] || ISTINA.saobshteno, izv = t.izvori || [];
    var lk = locked(), res = t.grupa === 'reshenie', u = UNDO['pc:' + t.id], tid = esc(t.id), err = errOf(t.id, q);
    var ph = tPhotos(t), ts = tasksOf(t.id, q), wp = res ? waitPill(S.den ? S.den.data : '') : null;
    var vd0 = vDn(t, q), dnB = !dnMozhe(t) ? '' : lk
      ? (vd0 ? '' : '<span class="pill p-izk">🚫 не за дневника</span>')
      : '<button type="button" class="pill pc-dn' + (vd0 ? '' : ' off') + '" data-a="dn" data-tid="' + tid + '" aria-pressed="' + !vd0 + '">' + (vd0 ? '📘 в дневника' : '🚫 не за дневника · върни') + '</button>';
    var head = rv ? '<button type="button" class="rev-r on" data-a="revCard" data-tid="' + tid + '" aria-expanded="true"><span class="rev-i" aria-hidden="true">' + revInfo(t, q).ico + '</span>' +
      '<span class="rev-t">' + esc(revInfo(t, q).st) + '</span><span class="chev" aria-hidden="true">▴</span></button>' : '';
    var b1;
    if (res) b1 = '<button type="button" class="pa pa-ok" data-a="ok" data-tid="' + tid + '"' + (m.ok ? ' disabled aria-pressed="true"' : '') + '>' + (m.ok ? '✓ отговорено' : '✓ Отговорено') + '</button>';
    else if (!lk && t.istina !== 'provereno') b1 = '<button type="button" class="pa pa-ok" data-a="ok" data-tid="' + tid + '"' + (m.ok ? ' disabled aria-pressed="true"' : '') + '>' + (m.ok ? '✓ вярно' : '✓ Вярно') + '</button>';
    else { var vd = S.den && vidOf(S.den.id, t.id); b1 = '<button type="button" class="pa pa-ok" data-a="seen" data-tid="' + tid + '"' + (vd ? ' disabled aria-pressed="true"' : '') + '>' + (vd ? '✓ видях' : '✓ Видях') + '</button>'; }
    return '<article class="pc' + (hot ? ' hot' : '') + (u ? ' undoing' : '') + (vd0 ? '' : ' izk') + (rv ? ' rv' : (!u && !pregledana(t, q) ? ' nx' : '')) + '" data-tid="' + tid + '"' + (rv ? '' : ' data-anc="p' + tid + '"') + '>' + head +
      '<div class="pc-in">' +
      (wp ? '<div class="pc-w"><span class="pill ' + wp[1] + '">' + wp[0] + '</span>' + (err ? '<button type="button" class="pill p-warn pc-errb" data-a="qerr">⚠️ не се записа — виж</button>' : '') + '</div>'
        : err ? '<div class="pc-w"><button type="button" class="pill p-warn pc-errb" data-a="qerr">⚠️ не се записа — виж</button></div>' : '') +
      '<div class="pc-b"><span class="pc-e" aria-hidden="true">' + emoT(t) + '</span><p class="pc-t">' + esc(t.tekst) + '</p></div>' +
      (ph && ph.length ? phRowHtml(ph, 'pcPh', 'data-tid="' + tid + '"') : '') +
      m.fix.map(function (f) {
        return '<div class="pc-fix"><b>✎ Твоята поправка:</b> ' + esc(f.tekst) + '<span class="pc-fs">' + (f.err ? '⚠️ не се записа — виж лентата горе' : f.pend ? '⏳ чака връзка' : '⏳ ' + esc(f.rez || 'чака Claude')) + '</span></div>';
      }).join('') +
      m.kom.map(function (f) {
        // разяснение на заключен ден: Claude не обработва вписани дни → „💬 записано“, не „чака Claude“ завинаги [К26]
        return '<div class="pc-fix kom"><b>💬 Твоето разяснение:</b> ' + esc(f.tekst) + '<span class="pc-fs">' + (f.err ? '⚠️ не се записа — виж лентата горе' : f.pend ? '⏳ чака връзка' : lk && (!f.rez || /чака Claude/i.test(f.rez)) ? '💬 записано' : f.rez ? esc(f.rez) : '⏳ чака Claude') + '</span></div>';
      }).join('') +
      ts.map(function (a) {
        var v = VID[a.vid] || ['📌', 'Задача'], s = stOf(a);
        return '<button type="button" class="pc-task" data-a="zad" data-id="' + esc(a.id) + '"><span aria-hidden="true">' + v[0] + '</span> <span class="pc-tt">' + esc(v[1]) + ': ' + esc(clip(a.tekst, 80)) + '</span> <span class="pill ' + s[1] + '">' + esc(s[0]) + '</span></button>';
      }).join('') +
      '<div class="pc-m"><span class="pill ' + ist[1] + '">' + ist[0] + '</span>' +
        (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') +
        (m.ok ? '<span class="pill p-mine">' + (m.ok.pend ? (m.ok.otg ? '⏳ отговорът чака връзка' : '⏳ потвърждение чака връзка') : (m.ok.otg ? '✓ отговорено от теб' : '✓ вярно от теб')) + '</span>' : '') + dnB +
        (izv.length
          ? '<button type="button" class="srcb" data-a="src" data-tid="' + tid + '" aria-label="Източници: ' + izv.length + '">' + izv.map(function (s) { return '<span class="ref">' + esc(s.n) + '</span>'; }).join('') + '<span class="srcb-l">' + (izv.length === 1 ? 'източник' : 'източника') + ' ›</span></button>'
          : '<span class="pill p-warn">няма източник</span>') +
      '</div></div>' +
      // 5 с „Отмени“: картата стои на мястото си (приглушена), сменя се само редът с бутоните — височината не се мени [§5.3]
      (u ? '<div class="pc-a pc-ua"><span class="pc-u">' + esc(u.lbl) + '</span><button type="button" class="pa pc-ub" data-a="undo" data-k="pc:' + tid + '">Отмени</button><i class="u-bar" data-ub="pc:' + tid + '" aria-hidden="true"></i></div>'
        : '<div class="pc-a">' + b1 +
          '<button type="button" class="pa" data-a="fix" data-tid="' + tid + '">✎ Поясни</button>' +
          '<button type="button" class="pa" data-a="act" data-tid="' + tid + '">→ Задача</button></div>') + '</article>';
  }
  function rerenderCard(tid) { keepAnchor(function () { renderGroups(); }); }
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
    var ch = zapisChist(S.den.zapis_md || ''), md = ch.md, n = (md.match(/^##\s/mg) || []).length;
    el.className = '';
    el.innerHTML = '<details class="full card" id="fullD"' + (S.fullOpen ? ' open' : '') + '><summary><span>📄 Пълен запис' + (n ? ' (' + n + ' раздела)' : '') + '</span><span class="chev" aria-hidden="true">▾</span></summary>' +
      (ch.skriti ? '<p class="md-izk">🚫 ' + ch.skriti + (ch.skriti === 1 ? ' ред не влиза' : ' реда не влизат') + ' в дневника (точки „не за дневника“) — по-долу е записът, както ще се впише.</p>' : '') +
      '<div class="md">' + (md.trim() ? md2html(md, refMap()) : '<p class="muted">Черновата още няма пълен запис.</p>') + '</div></details>';
  }
  // Същото правило като ailab-lib.ps1 → ConvertTo-AiZapisChist: вън са редовете САМО от изключени точки, после ⟦…⟧ се махат.
  var MARK_RE = /\s*⟦\s*(\d{1,3}(?:\s*,\s*\d{1,3})*)\s*⟧/g;
  function zapisChist(md) {
    var q = queue(), izk = {}, ima = false, skriti = 0;
    S.tochki.forEach(function (t) { if (t.k != null && !vDn(t, q)) { izk[t.k] = true; ima = true; } });
    var red = [];
    md.split('\n').forEach(function (l) {
      var ks = [], m; MARK_RE.lastIndex = 0;
      while ((m = MARK_RE.exec(l))) m[1].split(',').forEach(function (k) { ks.push(+k.trim()); });
      if (ima && ks.length && ks.every(function (k) { return izk[k]; })) { skriti++; return; }
      red.push(l.replace(MARK_RE, '').replace(/\s+$/, ''));
    });
    var out = [];
    for (var i = 0; i < red.length; i++) {
      out.push(red[i]);
      if (/^## \d{1,2}\. /.test(red[i])) {
        var j = i + 1, im = false;
        while (j < red.length && !/^## \d{1,2}\. /.test(red[j])) { if (red[j].trim() && red[j].trim() !== '---') { im = true; break; } j++; }
        if (!im) out.push('- Не е постъпила информация.');
      }
    }
    return { md: out.join('\n'), skriti: skriti };
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
    var nx = box('#apprNx');
    var d = S.den; if (!d) { el.innerHTML = ''; el.className = ''; if (nx) nx.innerHTML = ''; return; }
    var a = apprState();
    if (nx) nx.innerHTML = '';
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
    // Един ред под палеца [К24]: „Следващ › · N“ вляво, „Одобрявам vN“ вдясно; когато няма непрегледани — „✓ Прегледа всичко“,
    // а под лентата (не в нея) — „Следващ за одобрение“ [§5.5, И1]
    var left = openCount(), g = groupsOf(), ost = ostavat(g.promqna.concat(g.reshenie, g.neprovereno));
    el.innerHTML = '<div class="appr">' +
      (a.old ? '<div class="small" style="color:var(--warn-ink);font-weight:600;text-align:center">Одобри v' + esc(a.old.versiq) + ', но сега е v' + esc(d.versiq) + ' — одобри отново.</div>' : '') +
      '<div class="appr-r">' +
        // думи към числата: вляво — колко остават за ПРЕГЛЕД; вдясно — колко са БЕЗ ОТГОВОР (прегледано ≠ отговорено)
        (ost ? '<button type="button" class="btn ghost appr-nx" data-a="nextRev" aria-label="Следваща непрегледана точка, остават ' + ost + '">Още ' + ost + ' за преглед ›</button>'
          : '<button type="button" class="btn ghost appr-nx done" data-a="nextRev" aria-label="Прегледа всичко за деня">✓ Прегледа всичко</button>') +
        '<button type="button" class="btn appr-go" data-a="approve" aria-label="' + esc('Одобрявам тази версия (v ' + d.versiq + ')' + (left ? ', ' + left + ' без твой отговор' : '')) + '">' +
          '<span class="appr-gl">Одобрявам v' + esc(d.versiq) + '</span><span class="appr-gs">' + (left ? left + ' без твой отговор' : '✓ всички с отговор') + '</span></button>' +
      '</div></div>';
    if (nx && !ost) nx.innerHTML = nextBtn();
  }
  // „Следващ ›“: следващата непрегледана карта след текущото място (после отначало), светва [И1]
  function nextRev() {
    var l = Array.prototype.slice.call(document.querySelectorAll('#groups .pc.nx'));
    if (!l.length) { toast('✓ Прегледа всичко за деня'); var n0 = $('#apprNx .next-d'); if (n0) n0.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); return; }
    var tw = $('.topwrap'), top = (tw ? tw.getBoundingClientRect().bottom : 0) + 16;
    var el = l.filter(function (x) { return x.getBoundingClientRect().top > top; })[0] || l[0];
    var off = (tw ? tw.getBoundingClientRect().height : 0) + 10;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || 0) - off), behavior: reduced() ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1600);
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

  // ---------- 5 с „Отмени“ — общо за Преглед, Табло и Задачи (правило 8: всичко се отменя до 5 с) ----------
  // u = {key, kind: 'pc' (карта в Преглед) | 'grp' („Видях останалите“) | 'dc' (карта на Таблото) | 'toast', lbl, tid,
  //      tbl/row/meta — записът, или run() — само на телефона; pre() — точно преди записа; done(r), fail(e); redo() — „Отмени“ връща листа}
  var UNDO = {}, UNDO_MS = 2000;   // РП 28.09: 2 с вместо 5 с
  function undoStart(u) {
    if (UNDO[u.key]) undoCommit(u.key);
    u.t0 = Date.now(); u.at = nowIso(); u.qid = newQid();
    u.timer = setTimeout(function () { undoCommit(u.key); }, UNDO_MS);
    UNDO[u.key] = u;
    undoPaint(u, 'start');
  }
  function undoCancel(key) {
    var u = UNDO[key]; if (!u) return;
    clearTimeout(u.timer); delete UNDO[key];
    undoPaint(u, 'cancel');
    if (u.redo) u.redo();   // „Отмени“ след лист → листът се връща с написания текст (записът с текст от РП не се губи) [К22]
  }
  // След 5 с, при скриване, смяна на таб/ден: ПЪРВО опашката (синхронно в localStorage), после мрежата [К22]
  function undoCommit(key) {
    var u = UNDO[key]; if (!u) return;
    clearTimeout(u.timer); delete UNDO[key];
    if (u.pre) u.pre();
    if (u.run) { u.run(); undoPaint(u, 'commit'); return; }
    var p = send(u.tbl, u.row, u.meta, { qid: u.qid, at: u.at, keep: true });
    undoPaint(u, 'commit');
    p.then(function (r) { if (u.done) u.done(r); if (r === 'queued') toast((u.lbl || 'Записано') + ' · ⏳ чака връзка'); renderTabs(); },
      function (e) { if (u.fail) u.fail(e); toast('Не се записа: ' + errBg(e) + ' — виж лентата горе', 'bad'); renderCurrent(); });
  }
  function commitUndos() { Object.keys(UNDO).forEach(undoCommit); }
  function undoPaint(u, ph) {
    if (u.kind === 'toast') { if (ph === 'start') toastUndo(u); else toastUndoEnd(u.key); }
    // листът „❓ Искането е записано“ е още отворен, а записът тръгна (скрито приложение) → бутонът отменя вече записаната задача
    if (ph === 'commit' && sheetKind === 'isk' && ISK && ISK.key === u.key && sheetEl) { var ib = sheetEl.querySelector('[data-a="iskUndo"]'); if (ib) ib.textContent = 'Отмени задачата'; }
    if (view === 'day' && (u.kind === 'pc' || u.kind === 'grp')) {
      if (ph === 'commit' && u.kind === 'pc') pcLeave(u.tid);
      else keepAnchor(function () { renderSum(); renderGroups(); });
      renderAppr(); renderStrip();
    }
    if (view === 'tablo' && u.kind === 'dc') { renderOpen(true); renderTabloCounts(); }
    if (ph !== 'start') { renderTabs(); if (view === 'deistviq') renderActsTab(); else if (view === 'day') renderActs(); }
  }
  // Тост с „Отмени“ (записи без карта) — натиска се: .toast.undo е с pointer-events:auto [К23]
  function toastUndo(u) {
    var bx = $('#toasts'); if (!bx) return;
    var t = document.createElement('div'); t.className = 'toast undo'; t.setAttribute('data-uk', u.key);
    t.innerHTML = '<span class="tu-l">' + esc(u.lbl) + '</span><button type="button" class="tu-b" data-a="undo" data-k="' + esc(u.key) + '">Отмени</button><i class="u-bar" aria-hidden="true"></i>';
    bx.appendChild(t);
  }
  function toastUndoEnd(k) {
    Array.prototype.forEach.call(document.querySelectorAll('.toast.undo'), function (t) {
      if (t.getAttribute('data-uk') !== k) return;
      t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    });
  }
  // Картата излиза от списъка (свиване 180 ms) и се появява в „✓ Решени/Прегледани“; над видимото — без анимация и
  // екранът не мърда (котвата е следващият елемент) [К23]
  function pcLeave(tid) {
    var el = document.querySelector('#groups .pc[data-tid="' + tid + '"]:not(.rv)'), tw = $('.topwrap'), top = tw ? tw.getBoundingClientRect().bottom : 0;
    var all = function () { renderSum(); renderGroups(); renderAppr(); renderStrip(); };
    if (!el) { keepAnchor(all); return; }
    var r = el.getBoundingClientRect();
    if (r.bottom <= top) { keepAnchor(all, tid); return; }
    if (reduced()) { keepAnchor(all); return; }
    el.style.height = r.height + 'px'; void el.offsetHeight;
    el.classList.add('leaving'); el.style.height = '0px';
    setTimeout(function () { if (view === 'day') keepAnchor(all); }, 190);
  }

  // ---------- решения по точка (Преглед) ----------
  // ✓ Отговорено (решение, всеки ден — вписаният запис не се пипа) · ✓ Вярно (незаключен ден) · ✓ Видях (само на телефона) [§5.2]
  function pcOk(tid) {
    var t = findT(tid), d = S.den; if (!t || !d || UNDO['pc:' + tid]) return;
    if (newPending()) { toast('Има нова версия — натисни „Презареди“ първо.', 'bad'); return; }
    var res = t.grupa === 'reshenie';
    if (!res && (locked() || t.istina === 'provereno')) { pcSeen(tid); return; }
    var row = { den_id: d.id, tochka_id: tid, vid: 'potvardi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    if (res) row.tekst = 'отговорено';
    var o = d.obekt || OBEKT_KOD, data = d.data;
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: res ? '✓ Отговорено' : '✓ Вярно', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      pre: function () { if (res) noteClose(tid, o, data, true, null); } });   // Таблото я скрива веднага
  }
  // 📘 ⇄ 🚫 — пише 'izkljuchi' / 'vkljuchi' в resheniq (тригерът в базата сменя tochki.v_dnevnika веднага) [007]
  function pcDn(tid) {
    var t = findT(tid), d = S.den; if (!t || !d || UNDO['pc:' + tid] || !dnMozhe(t)) return;
    if (newPending()) { toast('Има нова версия — натисни „Презареди“ първо.', 'bad'); return; }
    if (locked()) { toast('Денят е одобрен — записът вече не се мени.', 'bad'); return; }
    var vk = !vDn(t);   // сега е изключена → връщам я
    var row = { den_id: d.id, tochka_id: tid, vid: vk ? 'vkljuchi' : 'izkljuchi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: vk ? '📘 Пак в дневника' : '🚫 Не за дневника', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      done: function () { renderFull(); } });
  }
  // „✓ Видях“ — локална отметка: не твърди „вярно“, не пише в базата и по вписан ден [К25]
  function pcSeen(tid) {
    var d = S.den; if (!d || UNDO['pc:' + tid]) return;
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: '✓ Видях', run: function () { vidMark(d.id, [tid]); } });
  }
  function pcSeenAll(g) {
    var d = S.den; if (!d || !groupsOf()[g]) return;
    var q = queue(), ids = groupsOf()[g].filter(function (t) { return !pregledana(t, q) && !undoing(t); }).map(function (t) { return t.id; });
    if (!ids.length) return;
    undoStart({ key: 'grp:' + g, kind: 'grp', lbl: '✓ Видях ' + ids.length, run: function () { vidMark(d.id, ids); } });
  }

  // ---------- „✎ Поясни“ — поправка или разяснение към точка (т. 2.4) — от Преглед и от Таблото [§5.4, К27] ----------
  var PY = null;
  function pyLock(from, d) {
    if (from === 'pc') return newPending() ? 'nova' : locked() ? 'lk' : '';
    return d && d.status && d.status !== 'chernova' ? 'lk' : '';
  }
  function openPoyasni(t, d, from, mode, text) {
    var lk = pyLock(from, d);
    mode = lk ? 'komentar' : (mode || 'popravka');
    PY = { t: t, d: d, from: from, mode: mode, lk: lk };
    openSheet('Поясни точката',
      '<p class="sh-q">' + esc(clip(t.tekst, 300)) + '</p>' +
      '<div class="frm-seg two" role="radiogroup" aria-label="Какво добавяш">' +
        '<button type="button" role="radio" data-a="pyMode" data-m="popravka" aria-checked="' + (mode === 'popravka') + '"' + (lk ? ' disabled' : '') + '><b>Поправка</b><span>нещо е грешно</span></button>' +
        '<button type="button" role="radio" data-a="pyMode" data-m="komentar" aria-checked="' + (mode === 'komentar') + '"><b>Разяснение</b><span>добавям контекст</span></button></div>' +
      (lk === 'lk' ? '<p class="warnline">Денят е одобрен — поправка вече не влиза в записа. Разяснението се пази в AiLab към точката.</p>'
        : lk === 'nova' ? '<p class="warnline">Има нова версия — поправка се пише само към показаната. Презареди за поправка; разяснението се пази към точката.</p>' : '') +
      '<label class="fld"><span id="pyL">' + (mode === 'popravka' ? 'Как е правилно?' : 'Разяснение') + '</span>' +
        '<textarea id="pyT" rows="4" maxlength="1000" autofocus enterkeyhint="done" placeholder="' + (mode === 'popravka' ? 'напр. кофражистите са 10 — двама още не са в Присъствия' : 'напр. уговорено е по телефона — чакаме писмото') + '">' + esc(text || '') + '</textarea></label>' +
      '<div class="cnt250" id="pyC" aria-live="polite"></div>' +
      '<p class="small muted" id="pyN">' + pyNote(mode, lk) + '</p>' +
      '<div class="sh-save"><div class="err" id="pyE" hidden></div><button type="button" class="btn big" data-a="pySave">Запиши</button></div>', 'py');
    pyCount();
  }
  function pyNote(mode, lk) {
    return mode === 'popravka' ? 'Поправката отива при Claude — той я вписва в следващата версия на черновата.'
      : lk ? 'Разяснението остава в AiLab към точката — вписаният запис не се пипа.' : 'Разяснението отива при Claude заедно с точката (не сменя текста ѝ сам).';
  }
  function pyCount() { var ta = $('#pyT'), c = $('#pyC'); if (ta && c) { var n = 1000 - ta.value.length; c.textContent = 'остават ' + n; c.classList.toggle('low', n < 20); } }
  function pyMode(m) {
    if (!PY || (m === 'popravka' && PY.lk)) return;
    PY.mode = m;
    Array.prototype.forEach.call(document.querySelectorAll('[data-a="pyMode"]'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-m') === m)); });
    var l = $('#pyL'), n = $('#pyN'), ta = $('#pyT');
    if (l) l.textContent = m === 'popravka' ? 'Как е правилно?' : 'Разяснение';
    if (n) n.textContent = pyNote(m, PY.lk);
    if (ta) ta.placeholder = m === 'popravka' ? 'напр. кофражистите са 10 — двама още не са в Присъствия' : 'напр. уговорено е по телефона — чакаме писмото';
  }
  function pySave() {
    var P0 = PY; if (!P0) return;
    var tx = (($('#pyT') && $('#pyT').value) || '').trim(), ee = $('#pyE');
    if (!tx) { ee.textContent = P0.mode === 'popravka' ? 'Напиши как е правилно.' : 'Напиши разяснението.'; ee.hidden = false; $('#pyT').focus(); return; }
    var t = P0.t, d = P0.d || {}, mode = P0.mode;
    var row = { den_id: d.id != null ? d.id : t.den_id, tochka_id: t.id, vid: mode, tekst: tx, versiq: d.versiq != null ? d.versiq : null, hesh: d.hesh || null, ustroistvo: device() + (P0.from === 'dc' ? ' · табло' : '') };
    PY = null; closeSheet();
    var lbl = mode === 'popravka' ? '✎ Поправка' : '💬 Разяснение';
    var redo = function () { openPoyasni(t, d, P0.from, mode, tx); };
    if (P0.from === 'dc') { dcStart(t, lbl, 'resheniq', row, redo); return; }
    undoStart({ key: 'pc:' + t.id, kind: 'pc', tid: t.id, lbl: lbl, tbl: 'resheniq', row: row, meta: { tt: t.tekst }, redo: redo,
      pre: function () { if (t.grupa === 'reshenie') noteClose(t.id, d.obekt || OBEKT_KOD, d.data, false, null); } });
  }
  // ---------- „Източници“: целият текст на съобщението/мейла, снимките му, файловете, Тиймс, мейл [§7] ----------
  // Адресите се рисуват само ако минат проверката (иначе — нищо): Тиймс съобщение, OneDrive (без името на фирмата в кода),
  // mailto: само към адреса на подателя. В демото — 'demo:' → тост.
  var TEAMS_RE = /^https:\/\/teams\.microsoft\.com\/l\/message\//;
  var OD_RE = /^https:\/\/[a-z0-9-]+-my[.]sharepoint[.]com\//;
  var MAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
  function okTeams(u) { return TEAMS_RE.test(String(u || '')) || (DEMO && u === 'demo:'); }
  function okOd(u) { return OD_RE.test(String(u || '')) || (DEMO && u === 'demo:'); }
  function extA(u, cls, lbl, kind) {
    if (DEMO && u === 'demo:') return '<button type="button" class="' + cls + '" data-a="demoLink" data-k="' + kind + '">' + lbl + '</button>';
    return '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + lbl + '</a>';
  }
  // ключът на съобщението: Тиймс → msg_id; мейл → името на файла в Оригинали (и от друг ден: ../<ден>/Оригинали/…) [§7.2]
  function srcKey(s) {
    var m = srcMsg(s); if (m) return m;
    var k = s && s.kade ? /Оригинали[\/\\](\d{4}-\d{2}-\d{2}_\d{6}_mail\.txt)$/.exec(String(s.kade)) : null;
    return k ? k[1] : null;
  }
  function normPat(p) { return String(p || '').replace(/%20/g, ' ').replace(/\\/g, '/').replace(/^(?:\.\.\/[^\/]+\/)?Файлове\//, '').trim(); }
  function srcFile(s) { var m = s && s.kade ? /(?:^|[\/\\])Файлове[\/\\](.+)$/.exec(String(s.kade)) : null; return m ? normPat(m[1]) : null; }
  // SAOB: kluch → редовете (по един на ден); [] = проверено, няма го. Само в паметта + кешът на Ден (отворените на деня).
  var SAOB = {}, srcTok = 0, SRC = null;
  function saobPick(k, den) { var l = SAOB[k]; if (!l || !l.length) return null; return l.filter(function (r) { return r.den_id === den; })[0] || l[0]; }
  function saobPut(rows, o, soft) {
    (rows || []).forEach(function (r) {
      if (!r || !r.kluch) return;
      if (typeof r.failove === 'string') { try { r.failove = JSON.parse(r.failove); } catch (e) { r.failove = []; } }
      var l = SAOB[r.kluch] || (SAOB[r.kluch] = []), i = -1;
      l.forEach(function (x, j) { if (x.den_id === r.den_id) i = j; });
      if (i < 0) l.push(r); else if (!soft) l[i] = r;
    });
  }
  // за кеша на Ден: съобщенията на деня, отворени досега — до 40, текстът до 1 500 зн. [§7.3]
  function saobForDay(den) {
    var out = [];
    Object.keys(SAOB).forEach(function (k) { (SAOB[k] || []).forEach(function (r) { if (r.den_id === den && out.length < 40) out.push(Object.assign({}, r, { tekst: clip(r.tekst || '', 1500) })); }); });
    return out;
  }
  function saobFromDayCache(den) {
    var c = sget(dayKey(), null), d = c && c.days ? c.days[den] : null;
    if (d && d.saob) saobPut(d.saob, null, true);
  }
  // техническият път (s.kade, напр. „Оригинали/065412_…json“) не се показва — за РП е шум; името на файл излиза в реда 📎 отдолу
  function srcItem(s) {
    return '<div class="src-i"><span class="ref">' + esc(s.n) + '</span><div><div class="src-t">' + tipEmo(s.tip) + ' <b>' + esc(s.tip || 'източник') + '</b>' +
      (s.vreme ? ' · <span class="mono">' + esc(s.vreme) + '</span>' : '') + '</div><div>' + esc(s.kratko || '') + '</div></div></div>';
  }
  // t — точката; den/o — денят и обектът ѝ (от Преглед или от Таблото). Една заявка М1 за всички източници.
  function openSources(t, den, o) {
    normT(t);
    var izv = t.izvori || [];
    openSheet('Източници (' + izv.length + ')', '<p class="sh-q">' + esc(clip(t.tekst, 220)) + '</p>' +
      izv.map(function (s, i) { var m = srcMsg(s); return '<div class="src-card" data-si="' + i + '"><div class="src-in"></div>' + (m ? '<div class="src-ph" data-msg="' + esc(m) + '"></div>' : '') + '<div class="src-ft"></div></div>'; }).join('') +
      '<p class="small muted">Оригиналите са в OneDrive, в папката на деня. Тук — текстът и намалени снимки.</p>', 'src');
    SRC = { el: sheetEl, tok: ++srcTok, t: t, den: den, o: o || null, izv: izv, st: 'load', full: {}, okolo: {}, files: null, fst: null };
    srcPhStart(den, izv);   // Етап 3: снимките под всеки Тиймс източник
    srcLoad();
    srcFill();
  }
  function openSrc(tid) { var t = findT(tid); if (t) openSources(t, t.den_id, S.den ? S.den.obekt || OBEKT_KOD : OBEKT_KOD); }
  function openRef(n) {
    var s = refMap()[n]; if (!s || !S.den) return;
    openSources({ id: null, den_id: S.den.id, tekst: 'Източник [' + n + '] от пълния запис', izvori: [s] }, S.den.id, S.den.obekt || OBEKT_KOD);
  }
  function srcLoad() {
    var x = SRC; if (!x) return;
    var keys = [], hasF = x.izv.some(function (s) { return !!srcFile(s); });
    x.izv.forEach(function (s) { var k = srcKey(s); if (k && keys.indexOf(k) < 0) keys.push(k); });
    var need = keys.filter(function (k) { return SAOB[k] === undefined; });
    if (offNow()) {
      saobFromDayCache(x.den);
      need = need.filter(function (k) { return SAOB[k] === undefined; });
      x.st = need.length ? 'net' : 'ok'; x.fst = hasF ? 'net' : null;
      return;
    }
    var tok = x.tok;
    if (!need.length) x.st = 'ok';
    else api.saob(x.o, need).then(function (rows) {
      saobPut(rows, x.o);
      need.forEach(function (k) { if (SAOB[k] === undefined) SAOB[k] = []; });
      if (S.den && S.den.id === x.den) saveCache();
      if (!SRC || SRC.tok !== tok) return;
      SRC.st = 'ok'; srcFill();
    }, function (e) {
      if (isMissing(e) || isNoCol(e)) need.forEach(function (k) { SAOB[k] = []; });   // преди 005 — тихо „още не е в облака“
      if (!SRC || SRC.tok !== tok) return;
      SRC.st = isMissing(e) || isNoCol(e) ? 'ok' : (isNet(e) || isAuth(e)) ? 'net' : 'err';
      srcFill();
    });
    if (hasF && x.den != null) {
      x.fst = 'load';
      api.saobFiles(x.den).then(function (rows) {
        var m = {};
        (rows || []).forEach(function (r) {
          var fl = r.failove; if (typeof fl === 'string') { try { fl = JSON.parse(fl); } catch (e) { fl = []; } }
          (Array.isArray(fl) ? fl : []).forEach(function (f) { if (f && f.pat) m[normPat(f.pat)] = f; if (f && f.ime && !m[f.ime]) m[f.ime] = f; });
        });
        if (!SRC || SRC.tok !== tok) return;
        SRC.files = m; SRC.fst = 'ok'; srcFill();
      }, function (e) { if (!SRC || SRC.tok !== tok) return; SRC.files = {}; SRC.fst = isNet(e) ? 'net' : 'ok'; srcFill(); });
    }
  }
  function srcFill() {
    var x = SRC; if (!x) return;
    if (!sheetEl || x.el !== sheetEl) { SRC = null; return; }
    Array.prototype.forEach.call(sheetEl.querySelectorAll('.src-card[data-si]'), function (c) {
      var i = +c.getAttribute('data-si'), s = x.izv[i]; if (!s) return;
      var p = srcParts(s, i, x);
      putH(c.querySelector('.src-in'), p[0]); putH(c.querySelector('.src-ft'), p[1]);
    });
  }
  function putH(n, h) { if (n && n._h !== h) { n.innerHTML = h; n._h = h; } }
  function fileLine(f) {
    if (!f) return '';
    var nm = f.ime || String(f.pat || '').split('/').pop() || 'файл';
    return '<div class="src-fl">📎 <span>' + esc(nm) + '</span> — ' + (okOd(f.url) ? extA(f.url, 'lnk', 'Отвори ›', 'od') : f.pat === null ? '<span class="muted">само линк в съобщението</span>' : '<span class="muted">във Файлове на деня</span>') + '</div>';
  }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : hhmm(d); }
  function srcParts(s, i, x) {
    var k = srcKey(s), f = srcFile(s), r = k ? saobPick(k, x.den) : null, ref = '<span class="ref">' + esc(s.n) + '</span>';
    if (r) {
      var mail = r.vid === 'mail';
      var hd = mail ? '✉️ Мейл · ' + hm(r.vreme) + (r.avtor ? ' · ' + r.avtor : '')
        : '💬 ' + (r.izvor_vid === 'kanal' ? 'Тиймс канал' : 'Тиймс чат') + ' · ' + hm(r.vreme) + (r.avtor ? ' · ' + r.avtor : '') + (r.izvor ? ' · „' + r.izvor + '“' : '');
      var h = '<div class="src-hd">' + ref + '<span>' + esc(hd) + '</span></div>';
      if (r.otgovor) h += '<div class="src-ot">' + esc(r.otgovor) + '</div>';
      if (mail) { if (r.tema) h += '<div class="src-tm">Тема: <b>' + esc(r.tema) + '</b></div>'; if (r.do_kopie) h += '<div class="src-dk">' + esc(r.do_kopie) + '</div>'; }
      else if (r.tema) h += '<div class="src-tm"><b>' + esc(r.tema) + '</b></div>';
      var tx = String(r.tekst || ''), long = tx.length > 1200 && !x.full[i];
      h += tx ? '<div class="src-tx">' + esc(long ? clip(tx, 1200) : tx) + '</div>' : '<div class="src-tx muted">(без текст — само снимки или файл)</div>';
      if (long) h += '<button type="button" class="lnk" data-a="srcFull" data-si="' + i + '">Покажи целия ▾</button>';
      if (r.belejka) h += '<div class="small muted">' + esc(r.belejka) + '</div>';
      (Array.isArray(r.failove) ? r.failove : []).forEach(function (fl) { h += fileLine(fl); });
      var b = '';
      if (!mail && okTeams(r.link)) {
        b += extA(r.link, 'btn ghost sb', 'Отвори в Тиймс ›', 'teams');
        // от иконата на началния екран iOS често отваря https:// в браузърен лист → и msteams:// (кой остава — проба на iPhone) [К36]
        b += r.link === 'demo:' ? extA('demo:', 'btn ghost sb sm', 'В приложението Тиймс ›', 'teams') : '<a class="btn ghost sb sm" href="' + esc('msteams://' + r.link.replace(/^https:\/\//, '')) + '">В приложението Тиймс ›</a>';
      }
      if (mail && okOd(r.original_url)) b += extA(r.original_url, 'btn ghost sb', 'Целият мейл ›', 'od');
      if (mail && r.tema) b += '<button type="button" class="btn ghost sb" data-a="copyTema" data-si="' + i + '">Копирай темата</button>';
      if (!mail && r.izvor && r.den_id != null) b += '<button type="button" class="btn ghost sb" data-a="okolo" data-si="' + i + '" aria-expanded="' + !!(x.okolo[i] && x.okolo[i].on) + '">Съседни съобщения ' + (x.okolo[i] && x.okolo[i].on ? '▴' : '▾') + '</button>';
      if (x.t && x.t.id != null) b += '<button type="button" class="btn ghost sb" data-a="iskSrc" data-si="' + i + '">❓ Поискай информация</button>';
      return [h, '<div class="src-b">' + b + '</div>' + okoloHtml(i, x)];
    }
    var base = srcItem(s);
    if (f) {
      var fm = x.files ? (x.files[f] || x.files[f.split('/').pop()]) : null;
      base += fm && okOd(fm.url) ? '<div class="src-fl">📎 <span>' + esc(fm.ime || f) + '</span> — ' + extA(fm.url, 'lnk', 'Отвори ›', 'od') + '</div>'
        : x.fst === 'load' ? '<p class="src-phl"><span class="pulse" aria-hidden="true"></span> търся файла…</p>'
        : '<p class="src-phl">📎 <b>' + esc(f.split('/').pop()) + '</b> — в OneDrive, папка „Файлове“ на деня.</p>';
    }
    if (k) {
      base += x.st === 'load' ? '<p class="src-phl"><span class="pulse" aria-hidden="true"></span> зареждам текста…</p>'
        : x.st === 'net' ? '<p class="src-phl">📴 Целият текст — когато има покритие</p>'
        : x.st === 'err' ? '<p class="src-phl">Текстът не се зареди — <button type="button" class="lnk" data-a="srcRetry">Опитай пак</button></p>'
        : '<p class="src-phl">Целият текст още не е в облака — лаптопът го качва вечер.</p>';
    }
    return [base, k && x.t && x.t.id != null ? '<div class="src-b"><button type="button" class="btn ghost sb" data-a="iskSrc" data-si="' + i + '">❓ Поискай информация</button></div>' : ''];
  }
  function srcRetry() { if (!SRC) return; SRC.st = 'load'; SRC.izv.forEach(function (s) { var k = srcKey(s); if (k && SAOB[k] && !SAOB[k].length) delete SAOB[k]; }); srcFill(); srcLoad(); }
  function srcFullT(i) { if (!SRC) return; SRC.full[i] = true; srcFill(); }
  function srcRow(i) { var x = SRC; if (!x) return null; var s = x.izv[i], k = s ? srcKey(s) : null; return k ? saobPick(k, x.den) : null; }
  function copyTema(i) {
    var r = srcRow(i); if (!r) return;
    var t = String(r.tema || '').replace(/^\s*((re|fw|fwd|aw|wg|отг|пр)\s*:\s*)+/i, '').trim();   // без „RE:/FW:/Fwd:“ — търси по-добре в Outlook [К36]
    copyText(t).then(function (ok) { toast(ok ? 'Темата е копирана — постави я в търсенето на Outlook' : 'Не можах да копирам — задръж върху темата'); });
  }
  function copyText(s) {
    function old() {
      try { var ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(function () { return true; }, function () { return old(); }); } catch (e) {}
    return Promise.resolve(old());
  }
  // „Съседни съобщения ▾“ — до 3 преди и 3 след от същия чат/канал в същия ден; тап → целият текст [§7.4, И3]
  function okoloHtml(i, x) {
    var o = x.okolo[i]; if (!o || !o.on) return '';
    if (o.st === 'load') return '<div class="okolo"><p class="src-phl"><span class="pulse" aria-hidden="true"></span> зареждам…</p></div>';
    if (o.st === 'net') return '<div class="okolo"><p class="src-phl">📴 Съседните съобщения — когато има покритие</p></div>';
    if (o.st === 'err') return '<div class="okolo"><p class="src-phl">Не се заредиха.</p></div>';
    function row(m) {
      var full = o.full[m.kluch], tx = String(m.tekst || '') || (m.tema ? '**' + m.tema + '**' : '(снимки)');
      return '<button type="button" class="ok-i" data-a="okoloFull" data-si="' + i + '" data-k="' + esc(m.kluch) + '"><span class="mono">' + esc(hm(m.vreme)) + '</span> <b>' + esc(m.avtor || '') + '</b> ' +
        esc(full ? tx : clip(tx, 300)) + '</button>';
    }
    return '<div class="okolo">' + (o.pred.length ? o.pred.map(row).join('') : '<p class="small muted">Няма по-ранни в този чат за деня.</p>') +
      '<div class="ok-me">▸ това съобщение</div>' + (o.sled.length ? o.sled.map(row).join('') : '<p class="small muted">Няма по-късни в този чат за деня.</p>') + '</div>';
  }
  function okoloT(i) {
    var x = SRC, r = srcRow(i); if (!x || !r) return;
    var o = x.okolo[i];
    if (o && o.st && o.st !== 'net' && o.st !== 'err') { o.on = !o.on; srcFill(); return; }
    o = x.okolo[i] = { on: true, st: 'load', pred: [], sled: [], full: {} };
    srcFill();
    if (offNow()) { o.st = 'net'; srcFill(); return; }
    var tok = x.tok;
    api.saobOkolo(r.den_id, r.izvor, r.vreme).then(function (res) {
      if (!SRC || SRC.tok !== tok) return;
      o.pred = res.pred || []; o.sled = res.sled || []; o.st = 'ok'; srcFill();
    }, function (e) { if (!SRC || SRC.tok !== tok) return; o.st = isNet(e) || isAuth(e) ? 'net' : 'err'; srcFill(); });
  }
  function okoloFull(i, k) { var o = SRC && SRC.okolo[i]; if (!o) return; o.full[k] = !o.full[k]; srcFill(); }
  // „❓ Поискай информация“ от източника → формата „Искане“ с „До кого“ = авторът, нишката = чатът, „Относно“ + 80 знака [§7.1]
  function iskSrc(i) {
    var x = SRC; if (!x || !x.t) return;
    var s = x.izv[i], k = s ? srcKey(s) : null, r = k ? saobPick(k, x.den) : null, t = x.t;
    var avtor = r ? (r.avtor || '') : String(s && s.kratko || '').split(' · ')[0];
    var ctx = { src: 'isk', tid: t.id, den_id: x.den, tekst: t.tekst, o: x.o, izvori: t.izvori,
      isk: { avtor: avtor, nishka: r ? (r.vid === 'mail' ? 'имейл' : (r.izvor || '')) : (/^Поща$/i.test(s && s.tip || '') ? 'имейл' : ''), izvor_vid: r ? (r.vid === 'mail' ? 'mail' : r.izvor_vid) : null, kluch: k,
        link: r && r.vid !== 'mail' && okTeams(r.link) ? r.link : null, mail: r && r.vid === 'mail' && MAIL_RE.test(String(r.avtor || '').trim()) ? { adr: String(r.avtor).trim(), tema: r.tema || '' } : null } };
    openPlus(null, ctx, 'iskane');
  }

  // ---------- свежест на източниците (лист и картата в Настройки) ----------
  function freshHtml() {
    var list = sortSv(S.svezhest);
    return (list.length ? list.map(function (s) {
      var f = fresh(s), nm = IZ[s.izvor] || [s.izvor, '•'];
      var p = f ? '<span class="pill p-ok">✓ свеж</span>' : '<span class="pill p-warn">⚠️ ' + (s.ok === false ? 'грешка при събиране' : 'застарял') + '</span>';
      return '<div class="fr-i ' + (f ? 'ok' : 'old') + '"><span class="fr-e" aria-hidden="true">' + nm[1] + '</span><div><div><b>' + esc(nm[0]) + '</b> ' + p + '</div>' +
        '<div class="small muted">последно: <span class="mono">' + esc(s.posledno ? dm(s.posledno) : '—') + '</span>' + (s.broi != null ? ' · ' + esc(s.broi) + ' записа' : '') + '</div>' +
        (s.belejka ? '<div class="small">' + esc(s.belejka) + '</div>' : '') + '</div></div>';
    }).join('') : '<p>Лаптопът още не е пратил данни за свежестта на източниците.</p>');
  }
  function openFresh() {
    openSheet('Свежест на източниците', freshHtml() +
      '<p class="small muted">„Няма събития“ не е същото като „няма данни“. Ако източник е застарял (кехлибарено), празен раздел в черновата не значи, че нищо не се е случило — Claude го слага в „Непроверено“.</p>');
  }

  // ---------- списъците на Интранета (хора, теми, приоритети) — кеш на телефона, по-стар от 24 ч → тегли във фона [§8.2.2] ----------
  var SPL = { rows: null, at: 0, st: '', busy: false };
  function spInit() {
    if (SPL.rows) return;
    var c = sget(K4.sp, null);
    if (c && Array.isArray(c.rows)) { SPL.rows = c.rows; SPL.at = c.at || 0; SPL.st = 'ok'; }
  }
  function spisaciLoad(force) {
    spInit();
    if (SPL.busy || (!force && SPL.rows && Date.now() - SPL.at < 24 * 36e5)) return;
    if (offNow()) { if (!SPL.rows) SPL.st = 'net'; return; }
    SPL.busy = true;
    var sp0 = spOk();
    api.spisaci().then(function (rows) {
      SPL.busy = false; SPL.rows = rows || []; SPL.at = Date.now(); SPL.st = 'ok';
      sset(K4.sp, { at: SPL.at, rows: SPL.rows });
      // формата се пречертава само ако видимото се сменя (списъкът се е появил); иначе — само подсказките
      if (P && sheetKind === 'form') { if (spOk() !== sp0) plusRefresh(); else plusHintsOnly(); }
      if (view === 'nastroiki') renderNastroiki();
    }, function (e) {
      SPL.busy = false;
      if (!SPL.rows) SPL.st = isMissing(e) || isNoCol(e) ? 'missing' : (isNet(e) || isAuth(e)) ? 'net' : 'err';
      if (P && sheetKind === 'form' && !sp0) plusRefresh();   // „Зареждам списъка…“ → причината
    });
  }
  function spOk() { spInit(); return !!(SPL.rows && SPL.rows.some(function (r) { return r.vid === 'chovek'; })); }
  function spHora() { return (SPL.rows || []).filter(function (r) { return r.vid === 'chovek' && !r.skrit && r.aktiven !== false; }); }
  function spAz() { var a = (SPL.rows || []).filter(function (r) { return r.vid === 'az'; })[0]; if (!a) return null; var p = spHora().filter(function (h) { return h.stoinost === a.stoinost; })[0]; return { id: String(a.stoinost), ime: a.ime, grupa: p ? p.grupa : null }; }
  function spTemi() { return (SPL.rows || []).filter(function (r) { return r.vid === 'tema' && r.aktiven !== false; }); }
  function spTemaOf(o) { if (o !== 'ag' && o !== 'soft') return null; var t = spTemi().filter(function (r) { return r.obekt === o; })[0]; return t ? t.stoinost : null; }
  var PRIO = [['normal', 'нормален'], ['high', 'с приоритет'], ['urgent', 'спешно']];
  function prioIme(k) { var p = (SPL.rows || []).filter(function (r) { return r.vid === 'prioritet' && r.stoinost === k; })[0]; return p ? p.ime : (PRIO.filter(function (x) { return x[0] === k; })[0] || ['', k])[1]; }
  function spObnoveno() { var mx = ''; (SPL.rows || []).forEach(function (r) { if (r.obnoveno && r.obnoveno > mx) mx = r.obnoveno; }); return mx; }

  // Имената в Тиймс са на латиница, в Интранета — на кирилица: сравнение по „скелет“ [К34] — малки букви, кирилицата на
  // латиница (ж→zh, ц→ts, ч→ch, ш→sh, щ→sht, ъ→a, ю→yu, я→ya, й→y, х→h), после iya→ia, kh→h, ts→c, y→i, само букви.
  var TRL = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
    'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y', 'ю': 'yu', 'я': 'ya', 'ѝ': 'i', 'ё': 'yo', 'э': 'e', 'ы': 'i' };
  function skel(s) {
    s = String(s || '').toLowerCase().replace(/[а-яѝёэы]/g, function (c) { return TRL[c] || c; });
    return s.replace(/iya/g, 'ia').replace(/kh/g, 'h').replace(/ts/g, 'c').replace(/y/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function skelW(s) { return skel(s).split(' ').filter(Boolean); }
  // съвпадение = всички думи от едната страна ги има в другата (редът няма значение)
  function skelMatch(a, b) {
    var A = skelW(a), B = skelW(b); if (!A.length || !B.length) return false;
    function sub(x, y) { return x.every(function (w) { return y.indexOf(w) >= 0; }); }
    return sub(A, B) || sub(B, A);
  }
  // „От източника“: точно едно съвпадение в списъка на автор на източник → подсказка (нищо не се избира само) [§8.2.3]
  function srcHint(avtori) {
    var out = [], hora = spHora();
    (avtori || []).forEach(function (a) {
      if (!a) return;
      var m = hora.filter(function (h) { return skelMatch(a, h.ime); });
      if (m.length === 1 && !out.some(function (x) { return x.stoinost === m[0].stoinost; })) out.push(m[0]);
    });
    return out.slice(0, 3);
  }
  // търсене на хора: по скелет (и на латиница „georgi“ → „Георги“), по име и отдел; без съвпадение — прощава една буква
  function lev1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, d = 0;
    while (i < la && j < lb) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
    return d + (la - i) + (lb - j) <= 1;
  }
  function spFind(q, excl) {
    var qs = skel(q), qw = qs.split(' ').filter(Boolean); if (!qw.length) return [];
    var hora = spHora().filter(function (h) { return !excl || !excl[h.stoinost]; });
    var hit = hora.filter(function (h) {
      var s = skel(h.ime + ' ' + (h.grupa || '')), w = s.split(' ');
      return s.indexOf(qs) >= 0 || qw.every(function (x) { return w.some(function (y) { return y.indexOf(x) === 0; }); });
    });
    if (hit.length || qs.length < 3) return hit;
    return hora.filter(function (h) {
      var w = skelW(h.ime + ' ' + (h.grupa || ''));
      return qw.every(function (x) { return w.some(function (y) { return lev1(x, y.slice(0, x.length)); }); });
    });
  }

  // ---------- „+“: нова задача (за мен, възложи, напомни ми, среща, поискай информация) [§8] ----------
  var VID = { za_men: ['📌', 'За мен'], vazlozhi: ['👷', 'Възложи'], napomni: ['🔔', 'Напомни ми'], sreshta: ['📅', 'Среща'], iskane: ['❓', 'Поискай информация'] };
  var VID_SUB = { za_men: 'задача за теб — в To Do или в Интранета', vazlozhi: 'задача в Интранета за колега', napomni: 'в точен ден и час', sreshta: 'кога, къде, с кого', iskane: 'питаш някого за липсващото' };
  var VID_MN = { za_men: 'За мен', vazlozhi: 'Възложени', napomni: 'Напомняния', sreshta: 'Срещи', iskane: 'Искания' };
  // честните редове „как“ — от една константа, за да се сменят на едно място след решението на РП (§17 В2–В4) [К35]
  var KAK_NAPOMNQNE = 'Засега няма звън — ще я видиш в Табло и в значката на Задачи, когато наближи. Как да звъни — ще решиш (Настройки → Как ми напомняш).';
  var KAK_SRESHTA = 'Какво става: засега само се записва в AiLab и се вижда в Задачи (филтър Срещи) и в Табло, когато наближи. Покана до хората и календар — ще решиш.';
  var KAK_ISKANE = 'Как стига до човека: ще се реши (отговор в Тиймс, имейл или коментар в Интранета). Засега се пази тук.';
  var TODO_LOCK = '🔒 To Do чака разрешение в Microsoft — задачата се пази в AiLab, докато то бъде дадено.';
  // ctx — от Таблото/Задачи/източник: {src, tid, den_id, tekst, o, d, close, izvori, isk}; без ctx — от Преглед (точка или „+“)
  function openPlus(tid, ctx, vid) {
    var t = !ctx && tid ? findT(tid) : null, tx = ctx ? (ctx.tekst || '') : t ? t.tekst : '';
    var o = ctx ? (ctx.o === 'ag' || ctx.o === 'soft' ? ctx.o : null) : (S.den ? (S.den.obekt || OBEKT_KOD) : OBEKT_KOD);
    P = { tid: ctx ? (ctx.tid || null) : (t ? t.id : null), tekst: tx ? String(tx) : '', t0: activeMs(), vid: null, ctx: ctx || null, o: o, oFix: !!o,
      den_id: ctx ? (ctx.den_id != null ? ctx.den_id : null) : (t ? t.den_id : (S.den ? S.den.id : null)),
      izvori: ctx ? (ctx.izvori || null) : (t ? t.izvori : null), fs: {}, f: null, zamenq: null, avtori: [] };
    spisaciLoad(false);
    plusSrcLoad();
    if (vid) { plusPick(vid); return; }
    renderPlusChooser();
  }
  function renderPlusChooser() {
    if (!P) return;
    openSheet(P.zamenq ? 'Промени задачата' : 'Нова задача', (P.tid ? '<p class="sh-q">От точка: ' + esc(clip(P.tekst, 160)) + '</p>' : '') +
      '<div class="choose">' + ['za_men', 'vazlozhi', 'napomni', 'sreshta', 'iskane'].map(function (k) {
        return '<button type="button" class="ch4 v-' + k + '" data-a="pick" data-v="' + k + '"><span class="ch4-e" aria-hidden="true">' + VID[k][0] + '</span><b>' + VID[k][1] + '</b><span>' + VID_SUB[k] + '</span></button>';
      }).join('') + '</div>' +
      '<p class="small muted">Задачите тръгват веднага — не чакат одобрението на деня.</p>', 'plus');
  }
  // авторите на източниците на точката — за подсказката „От източника“ (заявка М1 само ако текстовете още ги няма)
  function plusSrcLoad() {
    var x = P; if (!x || !x.izvori || !x.izvori.length) return;
    var keys = [];
    x.izvori.forEach(function (s) { var k = srcKey(s); if (k && keys.indexOf(k) < 0) keys.push(k); });
    function fill() {
      var av = [];
      keys.forEach(function (k) { var r = saobPick(k, x.den_id); if (r && r.avtor && r.vid !== 'mail' && av.indexOf(r.avtor) < 0) av.push(r.avtor); });
      var ch = (x.avtori || []).join('\n') !== av.join('\n');
      x.avtori = av;
      return ch;
    }
    fill();
    var need = keys.filter(function (k) { return SAOB[k] === undefined; });
    if (!need.length || offNow()) return;
    api.saob(x.o, need).then(function (rows) {
      saobPut(rows, x.o); need.forEach(function (k) { if (SAOB[k] === undefined) SAOB[k] = []; });
      if (P !== x) return;
      // само нови автори сменят видимото (подсказката „От източника“) — и тогава само подсказките, не целия лист
      if (fill() && sheetKind === 'form') plusHintsOnly();
    }, function (e) { if (isMissing(e) || isNoCol(e)) need.forEach(function (k) { SAOB[k] = []; }); });
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
  // Краен срок в Интранета: „Утре · Петък · След седмица“ — без „Днес“, докато работникът тръгва само вечер [К15];
  // в петък „Петък“ = следващият петък
  function kraenChips() {
    var n = now(), d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var ut = new Date(d0); ut.setDate(ut.getDate() + 1);
    var pt = new Date(d0); do { pt.setDate(pt.getDate() + 1); } while (pt.getDay() !== 5);
    var wk = new Date(d0); wk.setDate(wk.getDate() + 7);
    // без два бутона с една и съща дата: в четвъртък „Петък“ = „Утре“, в петък (следващият) „Петък“ = „След седмица“
    var out = [['Утре', ymd(ut)]];
    if (ymd(pt) !== ymd(ut) && ymd(pt) !== ymd(wk)) out.push(['Петък', ymd(pt)]);
    out.push(['След седмица', ymd(wk)]);
    return out;
  }
  function daysTo(s) { var d = parseD(s), n = now(); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); }
  function kraenLbl(s) {
    var d = parseD(s), k = daysTo(s);
    return DNI[d.getDay()] + ', ' + d.getDate() + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear() + ' (' + (k === 0 ? 'днес' : k === 1 ? 'след 1 ден' : k > 1 ? 'след ' + k + ' дни' : 'мина') + ')';
  }
  // „един ред“ за Интранета: нови редове, табулации, NBSP → интервал; броят се както в Интранета — .length (UTF-16) [К14]
  function oneLine(s) { return String(s || '').replace(/[\r\n\t\xA0\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' '); }
  function plusPick(v) {
    if (!P || !VID[v]) return;
    P.vid = v;
    var f = P.fs[v] || (P.fs[v] = {});
    if (!f._init) {
      f._init = 1;
      var tx = P.tekst || '';
      f.razq = '';
      if (v === 'za_men' || v === 'vazlozhi') {
        f.opis = clip(oneLine(tx).trim(), 250); f.na = null; f.ekip = []; f.prio = 'normal'; f.kraen = null; f.kraenI = null; f.tema = null; f.naTxt = '';
        if (v === 'za_men') { f.cel = lget(K4.cel) === 'todo' ? 'todo' : 'intranet'; f.srok = null; }
      }
      if (v === 'napomni') { f.kakvo = tx; f.srok = srokChips().filter(function (c) { return c[0] === 'Утре 08:00'; })[0][1]; }
      if (v === 'sreshta') { f.tema = tx ? clip(oneLine(tx).trim(), 200) : ''; f.hora = []; f.kade = ''; f.srok = srokChips().filter(function (c) { return c[0] === 'Утре 08:00'; })[0][1]; f.kolko = 60; }
      if (v === 'iskane') {
        var isk = P.ctx && P.ctx.isk ? P.ctx.isk : null;
        f.kakvo = tx ? 'Относно „' + clip(oneLine(tx).trim(), 80) + '“: ' : ''; f.srok = null;
        f.do = isk && isk.avtor ? { ime: isk.avtor } : null;
        f.nishka = isk ? isk.nishka : ''; f.izvor_vid = isk ? isk.izvor_vid : null; f.kluch = isk ? isk.kluch : null;
        if (!isk) iskFromPoint(f);
      }
    }
    P.f = f;
    renderPlusForm();
  }
  // Искане от точка без избран източник: нишката — чатът/каналът на първия Тиймс източник (или „имейл“ при мейл)
  function iskFromPoint(f) {
    var izv = (P && P.izvori) || [], s = izv.filter(function (x) { return !!srcKey(x); })[0];
    if (!s) return;
    var k = srcKey(s), r = saobPick(k, P.den_id);
    f.kluch = k;
    if (r) { f.nishka = r.vid === 'mail' ? 'имейл' : (r.izvor || ''); f.izvor_vid = r.vid === 'mail' ? 'mail' : r.izvor_vid; if (!f.do && r.avtor) f.do = { ime: r.avtor }; }
    else f.nishka = /_mail\.txt$/.test(k) ? 'имейл' : '';
  }
  function plusIntranet() { return P && (P.vid === 'vazlozhi' || (P.vid === 'za_men' && P.f && P.f.cel === 'intranet')); }
  // Формата. keep = пречертаване на място (след избор на човек, списък, подсказка) — скролът на листа се пази.
  function renderPlusForm(keep) {
    if (!P || !VID[P.vid]) return;
    var v = P.vid, f = P.f, sh = sheetEl && sheetEl.firstChild, sy = keep && sh ? sh.scrollTop : 0;
    // полето с фокуса (търсене на хора или поле от формата) и мястото на курсора — връщат се след пречертаването
    var ae = keep && sh && document.activeElement && sh.contains(document.activeElement) ? document.activeElement : null;
    var foc = ae && ae.getAttribute ? (ae.getAttribute('data-pks') ? '[data-pks="' + ae.getAttribute('data-pks') + '"]' : ae.getAttribute('data-f') ? '[data-f="' + ae.getAttribute('data-f') + '"]' : ae.id === 'pfD' || ae.id === 'pfH' ? '#' + ae.id : null) : null;
    // бутон с фокус (клавиатура на компютър) — същият бутон след пречертаването, за да не се губи мястото
    if (!foc && ae && ae.tagName === 'BUTTON' && ae.getAttribute('data-a')) foc = ['data-a', 'data-k', 'data-v', 'data-i', 'data-pk'].map(function (n) { var x = ae.getAttribute(n); return x == null ? '' : '[' + n + '="' + String(x).replace(/["\\]/g, '') + '"]'; }).join('');
    var s0 = null, s1 = null; try { if (ae && typeof ae.selectionStart === 'number') { s0 = ae.selectionStart; s1 = ae.selectionEnd; } } catch (e) {}
    if (P) P.redo = false;
    var intr = plusIntranet(), sp = spOk(), h = '';
    if (!P.zamenq) h += '<button type="button" class="back" data-a="plusBack">← Друг вид</button>';
    else h += '<p class="sh-q">Промяна на задача №' + esc(P.zamenq) + ' — записва се като нова заявка, която заменя старата.</p>';
    if (P.tid && !P.zamenq) h += '<p class="sh-q">От точка: ' + esc(clip(P.tekst, 140)) + '</p>';
    if (v === 'za_men') {
      h += '<div class="frm-seg two" role="radiogroup" aria-label="Къде да отиде">' +
        '<button type="button" role="radio" data-a="fSeg" data-k="cel" data-v="todo" aria-checked="' + (f.cel === 'todo') + '"><b>To Do</b><span>лично, в Microsoft</span></button>' +
        '<button type="button" role="radio" data-a="fSeg" data-k="cel" data-v="intranet" aria-checked="' + (f.cel === 'intranet') + '"><b>Интранет</b><span>с всички полета</span></button></div>';
    }
    // обект: от контекста; ако е „Всички“/неизвестен и задачата е за Интранета → избор, задължителен [§8.2]
    if (intr && !P.oFix) {
      h += '<div class="fld" role="group" aria-label="Обект"><span>Обект' + (P.o ? '' : ' <span class="req">— избери</span>') + '</span>' +
        '<div class="frm-seg two o-seg">' + ['ag', 'soft'].map(function (k) { return '<button type="button" role="radio" class="o-' + k + '" data-a="fObekt" data-v="' + k + '" aria-checked="' + (P.o === k) + '"><i aria-hidden="true"></i>' + OBEKT[k][0] + '</button>'; }).join('') + '</div></div>';
    }
    if (intr) h += intranetFields(f, v, sp);
    else if (v === 'za_men') {
      h += '<p class="warnline calm">' + TODO_LOCK + '</p>' +
        '<label class="fld">Какво<textarea data-f="opis" data-one="1" rows="2" maxlength="250" enterkeyhint="done"' + (f.opis ? '' : ' autofocus') + '>' + esc(f.opis || '') + '</textarea></label>' +
        '<div class="cnt250" data-cnt="opis"></div>' + srokBlock('Срок (по избор)', false);
    } else if (v === 'napomni') {
      h += '<label class="fld">За какво да ти напомня<textarea data-f="kakvo" rows="3" maxlength="1000"' + (f.kakvo ? '' : ' autofocus') + '>' + esc(f.kakvo || '') + '</textarea></label>' +
        srokBlock('Кога', true) + '<p class="kak">' + KAK_NAPOMNQNE + '</p>';
    } else if (v === 'sreshta') {
      h += '<label class="fld">Тема на срещата<input type="text" data-f="tema" maxlength="200" autocomplete="off" enterkeyhint="done" value="' + esc(f.tema || '') + '"' + (f.tema ? '' : ' autofocus') + '></label>' +
        '<div class="fld">С кого' + pickerHtml('hora', { multi: true, free: true, lbl: 'С кого — търси или напиши', ph: sp ? 'търси по име или отдел, или напиши' : 'напиши с кого' }) + '</div>' +
        '<label class="fld">Къде (по избор)<input type="text" data-f="kade" maxlength="160" autocomplete="off" enterkeyhint="done" placeholder="напр. обекта, сграда 2" value="' + esc(f.kade || '') + '"></label>' +
        srokBlock('Кога', true) +
        '<div class="fld" role="group" aria-label="Колко">Колко<div class="chips">' + [[30, '30 мин'], [60, '1 ч'], [90, '1,5 ч'], [120, '2 ч']].map(function (c) {
          return '<button type="button" class="chip" data-a="fSeg" data-k="kolko" data-v="' + c[0] + '" aria-pressed="' + (+f.kolko === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div></div>' +
        '<p class="kak">' + KAK_SRESHTA + '</p>';
    } else if (v === 'iskane') {
      h += '<label class="fld">Какво питаш<textarea data-f="kakvo" rows="3" maxlength="1000"' + (f.kakvo ? '' : ' autofocus') + '>' + esc(f.kakvo || '') + '</textarea></label>' +
        '<div class="fld">До кого' + pickerHtml('do', { multi: false, free: true, lbl: 'До кого — търси или напиши', ph: sp ? 'търси по име или отдел, или напиши' : 'напиши до кого' }) + '</div>' +
        '<label class="fld">Къде — нишката<input type="text" data-f="nishka" maxlength="160" autocomplete="off" enterkeyhint="done" placeholder="чатът / каналът или „имейл“" value="' + esc(f.nishka || '') + '"></label>' +
        srokBlock('Отговор до (по избор)', false) + '<p class="kak">' + KAK_ISKANE + '</p>';
    }
    if (v !== 'iskane') {
      h += '<label class="fld">Разяснение (по избор)<textarea data-f="razq" rows="2" maxlength="1000">' + esc(f.razq || '') + '</textarea></label>' +
        (intr ? '<p class="small muted">Отива като първи коментар в задачата — виждат го участниците в нея.</p>' : '');
    }
    var draft = intr && !sp;
    h += '<div class="sh-save"><div class="err" id="pfE" hidden></div>' +
      (draft ? '<button type="button" class="btn big" data-a="plusDraft">Запиши като чернова</button>' + (v === 'za_men' ? '<button type="button" class="btn ghost" data-a="plusTodo">Запиши като To Do</button>' : '')
        : '<button type="button" class="btn big" data-a="plusSave" id="pfS">Запиши</button>') + '</div>';
    openSheet(VID[v][0] + ' ' + VID[v][1], h, 'form', !!keep);
    plusSync();
    if (keep && sheetEl) {
      sheetEl.firstChild.scrollTop = sy;
      if (foc) { var fi = sheetEl.querySelector(foc); if (fi && !fi.disabled) quietFocus(fi, s0, s1); }
    }
  }
  // Пречертаване „отвън“ (списъкът с хора, текстовете на източниците дойдоха): докато РП пише, се обновяват само
  // подсказките „От източника“, а целият лист — при следващото пречертаване от негов тап (P.redo) [К31]
  function plusRefresh() {
    if (!P || sheetKind !== 'form') return;
    if (sheetTyping()) { P.redo = true; plusHintsOnly(); return; }
    renderPlusForm(true);
  }
  function plusHintsOnly() {
    if (!sheetEl || !P || !P.f) return;
    Array.prototype.forEach.call(sheetEl.querySelectorAll('.pick[data-pk]'), function (b) {
      var pk = b.getAttribute('data-pk'), old = b.querySelector('.pk-hint'), h = pkHints(pk, pkSel(pk));
      if (old) old.parentNode.removeChild(old);
      if (h) b.insertAdjacentHTML('beforeend', h);
    });
  }
  function intranetFields(f, v, sp) {
    var h = '<label class="fld">Описание на задачата<textarea data-f="opis" data-one="1" rows="3" maxlength="250" enterkeyhint="done"' + (f.opis ? '' : ' autofocus') + '>' + esc(f.opis || '') + '</textarea></label>' +
      '<div class="cnt250" data-cnt="opis" aria-live="polite"></div>';
    if (!sp) {
      // без списък: полетата за Интранета са неактивни; мисълта от обекта не се губи — „Запиши като чернова“ [К19]
      h += '<p class="warnline">' + (SPL.st === 'missing' ? 'Списъкът с хора още не е качен (лаптопът).' : SPL.busy ? 'Зареждам списъка с хора…' : 'Списъкът с хора — когато има покритие.') +
        ' Можеш да я запишеш като чернова — после я довършваш от Задачи („✎ допълни“).</p>' +
        (v === 'vazlozhi' ? '<label class="fld">На кого (свободен текст)<input type="text" data-f="naTxt" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="напр. ТР на обекта" value="' + esc(f.naTxt || '') + '"></label>' : '');
      return h;
    }
    var az = spAz(), spo = spObnoveno();
    if (spo && nowMs() - Date.parse(spo) > 30 * 864e5) h += '<p class="warnline">Списъкът с хора е от ' + esc(ddmm(new Date(spo))) + ' (преди повече от 30 дни) — лаптопът го обновява в понеделник.</p>';
    h += '<div class="fld">Отговорник' + (v === 'za_men'
      ? (az ? '<div class="pick"><span class="chip-x off">' + esc(az.ime) + (az.grupa ? ' <small>· ' + esc(az.grupa) + '</small>' : '') + '</span></div>' : '<p class="warnline">Списъкът още не знае кой си ти — запиши като To Do или като чернова.</p>')
      : pickerHtml('na', { multi: false, free: false, lbl: 'Отговорник — търси', ph: 'търси по име или отдел' })) + '</div>';
    var temi = spTemi(), tsel = f.tema || spTemaOf(P.o) || '';
    h += '<label class="fld">Тема<select data-f="tema"><option value=""' + (tsel ? '' : ' selected') + '>— избери —</option>' + temi.map(function (t) {
      return '<option value="' + esc(t.stoinost) + '"' + (t.stoinost === tsel ? ' selected' : '') + '>' + esc(t.ime) + '</option>'; }).join('') + '</select></label>';
    h += '<div class="fld">Екип (по избор)' + pickerHtml('ekip', { multi: true, free: false, lbl: 'Екип — търси', ph: 'добави от екипа' }) + '</div>';
    h += '<div class="fld" role="group" aria-label="Приоритет">Приоритет<div class="frm-seg three">' + PRIO.map(function (p) {
      return '<button type="button" role="radio" data-a="fSeg" data-k="prio" data-v="' + p[0] + '" aria-checked="' + (f.prio === p[0]) + '">' + esc(prioIme(p[0])) + '</button>'; }).join('') + '</div></div>';
    var kc = kraenChips(), td = ymd(now());
    h += '<div class="fld" role="group" aria-label="Краен срок">Краен срок<div class="chips">' + kc.map(function (c, i) {
      return '<button type="button" class="chip" data-a="kraen" data-i="' + i + '" aria-pressed="' + (f.kraenI === i && f.kraen === c[1]) + '">' + c[0] + '</button>'; }).join('') + '</div>' +
      '<input type="date" data-f="kraen" min="' + td + '" aria-label="Краен срок — дата" value="' + esc(f.kraen || '') + '"></div>' +
      '<div class="confirm" id="pfKX" aria-live="polite"></div>';
    return h;
  }
  // Срок с ден и час (напомни, среща, To Do, „отговор до“) — чиповете и полетата от Етап 1
  function srokBlock(lbl, req) {
    P.chips = srokChips();
    return '<div class="fld" role="group" aria-label="' + esc(lbl) + '">' + lbl +
      '<div class="chips">' + P.chips.map(function (c, i) { return '<button type="button" class="chip" data-a="srok" data-i="' + i + '" aria-pressed="false">' + c[0] + '</button>'; }).join('') +
      (req ? '' : '<button type="button" class="chip" data-a="srok" data-i="none" aria-pressed="false">Без срок</button>') + '</div>' +
      '<div class="dt"><input id="pfD" type="date" aria-label="Дата"><input id="pfH" type="time" aria-label="Час" step="300"></div></div>' +
      '<div class="confirm" id="pfX" aria-live="polite"></div>';
  }
  // Търсене на хора (Отговорник, Екип, С кого, До кого): избраните — чипове с „×“; резултатите — до 8 (до 5 с отворена клавиатура) [К31]
  function pkSel(pk) { var f = P && P.f; if (!f) return []; return pk === 'na' ? (f.na ? [f.na] : []) : pk === 'do' ? (f.do ? [f.do] : []) : (f[pk] || []); }
  function pickerHtml(pk, o) {
    var sel = pkSel(pk), sp = spOk();
    P.pk = P.pk || {}; P.pk[pk] = o;
    return '<div class="pick" data-pk="' + pk + '">' +
      (sel.length ? '<div class="pick-s">' + sel.map(function (p, i) {
        return '<span class="chip-x">' + esc(p.ime) + (p.grupa ? ' <small>· ' + esc(p.grupa) + '</small>' : '') + (p.id ? '' : ' <small>(свободен текст)</small>') +
          '<button type="button" data-a="pkDel" data-pk="' + pk + '" data-i="' + i + '" aria-label="' + esc('Махни ' + p.ime) + '">×</button></span>';
      }).join('') + '</div>' : '') +
      (o.multi || !sel.length ? '<input type="search" class="pick-q" data-pks="' + pk + '" placeholder="' + esc(o.ph) + '" autocomplete="off" enterkeyhint="done" aria-label="' + esc(o.lbl) + '"' + (!sp && !o.free ? ' disabled' : '') + '>' : '') +
      '<div class="pick-r" id="pkR-' + pk + '" hidden></div>' + pkHints(pk, sel) + '</div>';
  }
  // „От източника: <име> · <отдел>“ — под полето, докато не е избран човек от списъка [§8.2.3]
  function pkHints(pk, sel) {
    if (pk !== 'na' && pk !== 'do' && pk !== 'hora') return '';
    if (sel.some(function (p) { return p.id; }) && pk !== 'hora') return '';
    var av = (P.avtori || []).slice();
    if (pk === 'do' && P.f.do && !P.f.do.id) av.unshift(P.f.do.ime);
    var hs = srcHint(av).filter(function (h) { return !sel.some(function (p) { return p.id === h.stoinost; }); });
    return hs.length ? '<div class="pk-hint">' + hs.map(function (h) {
      return '<button type="button" class="pk-i hint" data-a="pkPick" data-pk="' + pk + '" data-id="' + esc(h.stoinost) + '">' + (P.ctx && P.ctx.src === 'zad' ? 'От старата заявка' : 'От източника') + ': <b>' + esc(h.ime) + '</b>' + (h.grupa ? ' · ' + esc(h.grupa) : '') + '</button>';
    }).join('') + '</div>' : '';
  }
  function pkResults(pk) {
    var box0 = document.getElementById('pkR-' + pk), inp = sheetEl ? sheetEl.querySelector('[data-pks="' + pk + '"]') : null;
    if (!box0 || !inp || !P) return;
    var q = inp.value.trim(), o = (P.pk || {})[pk] || {}, sel = pkSel(pk), excl = {}, h = '';
    sel.forEach(function (p) { if (p.id) excl[p.id] = 1; });
    if (pk === 'ekip' && P.f.na) excl[P.f.na.id] = 1;
    var kb = window.visualViewport ? window.visualViewport.height < window.innerHeight - 120 : false, lim = kb || document.activeElement === inp ? 5 : 8;
    function item(r) { return '<button type="button" class="pk-i" data-a="pkPick" data-pk="' + pk + '" data-id="' + esc(r.stoinost) + '">' + esc(r.ime) + (r.grupa ? ' <span>· ' + esc(r.grupa) + '</span>' : '') + '</button>'; }
    if (!q) {
      var rec = (ljget(K4.hora, []) || []).map(function (id) { return spHora().filter(function (x) { return x.stoinost === id; })[0]; }).filter(function (r) { return r && !excl[r.stoinost]; }).slice(0, 5);
      if (rec.length) h += '<div class="pk-g">Последно избирани</div>' + rec.map(item).join('');
    } else {
      var m = spFind(q, excl).slice(0, lim);
      h += m.map(item).join('');
      if (o.free) h += '<button type="button" class="pk-i free" data-a="pkFree" data-pk="' + pk + '">＋ „' + esc(clip(q, 60)) + '“ <span>(свободен текст)</span></button>';
      else if (!m.length) h += '<p class="pk-n">Няма такъв в списъка.</p>';
    }
    box0.innerHTML = h; box0.hidden = !h;
  }
  function pkPerson(id) { var r = spHora().filter(function (x) { return x.stoinost === String(id); })[0]; return r ? { id: String(r.stoinost), ime: r.ime, grupa: r.grupa || null } : null; }
  function pkAdd(pk, p) {
    var f = P && P.f; if (!f || !p) return;
    if (pk === 'na') { f.na = p; f.ekip = (f.ekip || []).filter(function (x) { return x.id !== p.id; }); }
    else if (pk === 'do') f.do = p;
    else { f[pk] = f[pk] || []; if (!f[pk].some(function (x) { return (p.id && x.id === p.id) || (!p.id && !x.id && x.ime === p.ime); })) f[pk].push(p); }
    renderPlusForm(true);
    if (pk === 'ekip' || pk === 'hora') { var fi = sheetEl && sheetEl.querySelector('[data-pks="' + pk + '"]'); if (fi && document.activeElement !== fi) quietFocus(fi); }
  }
  function pkDel(pk, i) {
    var f = P && P.f; if (!f) return;
    if (pk === 'na') f.na = null; else if (pk === 'do') f.do = null; else (f[pk] || []).splice(+i, 1);
    renderPlusForm(true);
  }
  // стойностите на полетата → P.f (без пречертаване: фокусът и клавиатурата остават)
  function formInput(el) {
    if (!P || !P.f) return;
    var k = el.getAttribute('data-f'), v = el.value;
    if (el.getAttribute('data-one')) {
      var n = oneLine(v);
      if (n !== v) { var p = el.selectionStart; el.value = n; try { el.setSelectionRange(p, p); } catch (e) {} v = n; }
    }
    if (k === 'kraen') { P.f.kraen = v || null; P.f.kraenI = null; plusSync(); return; }
    P.f[k] = v;
    if (k === 'opis') plusCnt();
    if (k === 'tema') P.f.temaRuchno = true;
  }
  function plusCnt() {
    var c = sheetEl && sheetEl.querySelector('[data-cnt="opis"]'), f = P && P.f; if (!c || !f) return;
    var n = 250 - String(f.opis || '').length;
    c.textContent = 'остават ' + Math.max(0, n); c.classList.toggle('low', n < 20);
  }
  // синхронизира чиповете, потвърждението на срока и броячите след рисуване/избор
  function plusSync() {
    if (!P || !P.f) return;
    var f = P.f;
    plusCnt();
    if ($('#pfD')) {
      $('#pfD').value = f.srok ? ymd(f.srok) : ''; $('#pfH').value = f.srok ? hhmm(f.srok) : '';
      syncSrok();
    }
    var kx = $('#pfKX');
    if (kx) {
      Array.prototype.forEach.call(document.querySelectorAll('.chip[data-a="kraen"]'), function (c) { var i = +c.getAttribute('data-i'); c.setAttribute('aria-pressed', String(f.kraenI === i && !!f.kraen)); });
      if (!f.kraen) { kx.className = 'confirm none'; kx.innerHTML = 'Избери краен срок.'; }
      else {
        var k = daysTo(f.kraen);
        kx.className = 'confirm' + (k < 0 ? ' past' : k === 0 ? ' warn' : '');
        kx.innerHTML = (k < 0 ? '⚠️ Крайният срок е минал:' : 'Краен срок — точно:') + '<b>' + esc(cap(kraenLbl(f.kraen))) + '</b>' +
          (k === 0 ? '<span class="kx-w">Лаптопът вписва вечер — срок „днес“ ще е минал, преди задачата да стигне до колегата.</span>' : '');
      }
    }
  }
  function fromInputs() {
    var dv = $('#pfD').value, hv = $('#pfH').value;
    if (!dv) { P.f.srok = null; syncSrok(); return; }
    if (!hv) { hv = '08:00'; $('#pfH').value = hv; }
    var a = dv.split('-'), b = hv.split(':');
    P.f.srok = new Date(+a[0], +a[1] - 1, +a[2], +b[0], +b[1], 0, 0);
    syncSrok();
  }
  function pickSrok(el) {
    var i = el.getAttribute('data-i');
    P.f.srok = i === 'none' ? null : P.chips[+i][1];
    $('#pfD').value = P.f.srok ? ymd(P.f.srok) : ''; $('#pfH').value = P.f.srok ? hhmm(P.f.srok) : '';
    syncSrok();
  }
  function syncSrok() {
    var s = P.f.srok, ee = $('#pfE'), req = P.vid === 'napomni' || P.vid === 'sreshta';
    if (ee) ee.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-a="srok"]'), function (c) {
      var i = c.getAttribute('data-i');
      c.setAttribute('aria-pressed', String(i === 'none' ? !s : !!(s && P.chips[+i] && P.chips[+i][1].getTime() === s.getTime())));
    });
    var x = $('#pfX'); if (!x) return;
    if (s) {
      var past = s.getTime() < nowMs() - 60000;
      x.className = 'confirm' + (past ? ' past' : '');
      x.innerHTML = (past ? '⚠️ Тази дата е минала:' : (req ? '📅 Кога — точно:' : '📅 Срок — точно:')) + '<b>' + esc(cap(exact(s))) + '</b>';
    } else {
      x.className = 'confirm none';
      x.innerHTML = req ? 'Избери ден и час.' : 'Без срок.';
    }
  }
  function plusErr(msg) { var ee = $('#pfE'); if (!ee) return; ee.textContent = msg; ee.hidden = false; try { ee.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  function izvLbl() {
    var ctx = P.ctx;
    // обектът е в колоната obekt; етикетът „ · ag/soft“ остава за старите версии и за базата преди 005 [К28]
    var o = P.o === 'ag' || P.o === 'soft' ? ' · ' + P.o : '';
    if (!ctx) return P.tid ? 'телефон · от точка' : 'телефон · бутон +' + o;
    if (ctx.src === 'tablo') return ctx.tid ? 'телефон · табло · от точка' : 'телефон · табло · бутон +' + o;
    if (ctx.src === 'isk') return 'телефон · от източник';
    if (ctx.src === 'zad') return 'телефон · задачи · промяна';
    return 'телефон · задачи · бутон +' + o;
  }
  // Запис: draft — „Запиши като чернова“ (без списък: cel=null → „✎ допълни“) [К19]; todo — „Запиши като To Do“
  function savePlus(mode) {
    if (!P || !P.vid || !P.f) return;
    var v = P.vid, f = P.f, err = '', row, intr = plusIntranet() && mode !== 'todo';
    var base = { den_id: P.den_id, tochka_id: P.tid || null, vid: v, izvor: izvLbl(), obekt: P.o === 'ag' || P.o === 'soft' ? P.o : null };
    if (P.zamenq) base.zamenq = P.zamenq;
    var opis = oneLine(f.opis || '').trim();
    if (v === 'za_men' || v === 'vazlozhi') {
      if (mode === 'todo' || (v === 'za_men' && f.cel === 'todo')) {
        if (!opis) err = 'Напиши какво.';
        else if (opis.length > 250) err = 'Текстът е над 250 знака.';
        else if (f.srok && f.srok.getTime() < nowMs() - 60000) err = 'Срокът е в миналото — избери друга дата.';
        row = Object.assign(base, { vid: 'za_men', tekst: opis, srok: f.srok ? f.srok.toISOString() : null, cel: 'todo', danni: { vazhno: false }, razqsnenie: (f.razq || '').trim() || null });
      } else if (mode === 'draft') {
        if (!opis) err = 'Опиши задачата.';
        row = Object.assign(base, { tekst: opis, chovek: (f.naTxt || '').trim() || null, cel: null, razqsnenie: (f.razq || '').trim() || null });
      } else {
        var az = v === 'za_men' ? spAz() : null, na = v === 'za_men' ? az : f.na, tema = f.tema || spTemaOf(P.o) || '';
        if (!P.o) err = 'Избери обект.';
        else if (!opis) err = 'Опиши задачата.';
        else if (opis.length > 250) err = 'Описанието е над 250 знака.';
        else if (!na) err = v === 'za_men' ? 'Списъкът още не знае кой си ти — запиши като To Do.' : 'Избери отговорник.';
        else if (!tema) err = 'Избери тема.';
        else if (!f.kraen) err = 'Избери краен срок.';
        else if (daysTo(f.kraen) < 0) err = 'Крайният срок е минал — избери друга дата.';
        if (!err) {
          var kd = parseD(f.kraen);
          row = Object.assign(base, { tekst: opis, chovek: na.ime, srok: at(kd, 17).toISOString(), cel: 'intranet', razqsnenie: (f.razq || '').trim() || null,
            danni: { manager: { id: String(na.id), ime: na.ime }, tema: tema, ekip: (f.ekip || []).map(function (p) { return { id: String(p.id), ime: p.ime }; }), prioritet: f.prio || 'normal', kraen_srok: f.kraen } });
        }
      }
    } else if (v === 'napomni') {
      var kk = (f.kakvo || '').trim();
      if (!kk) err = 'Напиши за какво.'; else if (!f.srok) err = 'Избери ден и час.'; else if (f.srok.getTime() < nowMs() - 60000) err = 'Часът е в миналото — избери друг.';
      row = Object.assign(base, { tekst: kk, srok: f.srok ? f.srok.toISOString() : null, cel: null, razqsnenie: (f.razq || '').trim() || null });
    } else if (v === 'sreshta') {
      var tm = (f.tema || '').trim(), hora = f.hora || [];
      if (!tm) err = 'Напиши темата.'; else if (!hora.length) err = 'Добави с кого е срещата.'; else if (!f.srok) err = 'Избери кога.'; else if (f.srok.getTime() < nowMs() - 60000) err = 'Часът е в миналото — избери друг.';
      row = Object.assign(base, { tekst: tm, chovek: hora.map(function (p) { return p.ime; }).join(', ') || null, mqsto: (f.kade || '').trim() || null, srok: f.srok ? f.srok.toISOString() : null, cel: null,
        razqsnenie: (f.razq || '').trim() || null, danni: { prodalzhitelnost_min: +f.kolko || 60, uchastnici: hora.map(function (p) { return p.id ? { id: String(p.id), ime: p.ime } : { ime: p.ime }; }) } });
    } else if (v === 'iskane') {
      var kv = (f.kakvo || '').trim();
      if (!kv || /^Относно „[^“]*“:\s*$/.test(kv)) err = 'Напиши какво питаш.'; else if (!f.do) err = 'Напиши до кого.'; else if (f.srok && f.srok.getTime() < nowMs() - 60000) err = 'Срокът е в миналото.';
      row = Object.assign(base, { tekst: kv, chovek: f.do ? f.do.ime : null, srok: f.srok ? f.srok.toISOString() : null, cel: null,
        danni: { do: f.do && f.do.id ? { id: String(f.do.id), ime: f.do.ime } : null, nishka: (f.nishka || '').trim() || null, izvor_vid: f.izvor_vid || null, kluch: f.kluch || null } });
    }
    if (err) { plusErr(err); return; }
    if (v === 'za_men' && mode !== 'todo' && mode !== 'draft') lset(K4.cel, 'intranet');
    if (v === 'za_men' && (mode === 'todo' || f.cel === 'todo')) lset(K4.cel, 'todo');
    // „Последно избирани“ — до 5
    var ids = [f.na && f.na.id, f.do && f.do.id].concat((f.ekip || []).map(function (p) { return p.id; }), (f.hora || []).map(function (p) { return p.id; })).filter(Boolean);
    if (ids.length) { var rc = ljget(K4.hora, []) || []; ids.forEach(function (id) { rc = [String(id)].concat(rc.filter(function (x) { return x !== String(id); })); }); ljset(K4.hora, rc.slice(0, 5)); }
    plusCommit(row, intr);
  }
  // след „Запиши“: листът се затваря → 5 с „Отмени“ (на картата, ако е от точка; иначе тост) → запис. „Отмени“ връща формата [§8.2, К22]
  function plusCommit(row, intr) {
    var Ps = P, ctx = Ps.ctx, sec = Math.max(1, Math.round((activeMs() - Ps.t0) / 1000)), v = Ps.vid;
    var lbl = VID[v][0] + ' ' + (v === 'iskane' ? 'Искане' : VID[v][1]) + (intr ? ' · Интранет' : '');
    P = null; closeSheet();
    var redo = function () { P = Ps; P.t0 = activeMs(); renderPlusForm(); };
    var metr = function () { send('metriki', { vid: 'deistvie_sek', stoinost: sec, den_id: row.den_id }).catch(function () {}); };
    var key;
    if (ctx && ctx.src === 'tablo' && ctx.close && ctx.tid) {
      var t = tFind(ctx.tid);
      if (t) { key = 'dc:' + t.id; dcStart(t, lbl, 'deistviq', row, redo, null, metr); }
    }
    if (!key && Ps.tid && view === 'day' && findT(Ps.tid)) {
      var tp = findT(Ps.tid), dn = S.den;
      key = 'pc:' + tp.id;
      undoStart({ key: key, kind: 'pc', tid: tp.id, lbl: lbl, tbl: 'deistviq', row: row, redo: redo,
        pre: function () { metr(); if (tp.grupa === 'reshenie' && dn) noteClose(tp.id, dn.obekt || OBEKT_KOD, dn.data, false, null); } });
    }
    if (!key) {
      key = 'z:' + newQid();
      undoStart({ key: key, kind: 'toast', lbl: 'Записано · ' + lbl, tbl: 'deistviq', row: row, redo: redo,
        pre: function () { metr(); if (ctx && ctx.src === 'tablo') tMeasure(); if (ctx && ctx.tid && ctx.close) noteClose(ctx.tid, ctx.o, ctx.d, false, null); },
        done: function () { if (view === 'tablo') { renderOpen(true); refillOpen(); } } });
    }
    if (v === 'iskane') iskDone(row, Ps, key);
  }
  // „Поискай информация“ стига до човека още днес: РП праща сам (правилото „ти одобряваш“) — без разрешения в Microsoft [И7]
  function iskDone(row, Ps, key) {
    var isk = Ps.ctx && Ps.ctx.isk, f = Ps.fs.iskane || {}, link = isk && isk.link, mail = isk && isk.mail;
    if (!link && !mail && f.kluch) {
      var r = saobPick(f.kluch, Ps.den_id);
      if (r && r.vid !== 'mail' && okTeams(r.link)) link = r.link;
      if (r && r.vid === 'mail' && MAIL_RE.test(String(r.avtor || '').trim())) mail = { adr: String(r.avtor).trim(), tema: r.tema || '' };
    }
    if (!link && !mail) return;
    var ime = row.chovek ? String(row.chovek).split(' ')[0] : '', q = row.tekst || '';
    var msg = (ime ? ime + ', ' : '') + (/^Относно/.test(q) ? q.charAt(0).toLowerCase() + q.slice(1) : 'относно „' + clip(oneLine(Ps.tekst).trim(), 80) + '“: ' + q);
    var u0 = UNDO[key];
    ISK = { msg: msg, key: key, qid: u0 ? u0.qid : null };
    var b = link
      ? (link === 'demo:' ? '<button type="button" class="btn big" data-a="iskGo">Копирай и отвори чата ›</button>' : '<a class="btn big" href="' + esc(link) + '" target="_blank" rel="noopener" data-a="iskGo">Копирай и отвори чата ›</a>')
      : '<a class="btn big" href="' + esc('mailto:' + encodeURIComponent(mail.adr) + '?subject=' + encodeURIComponent('RE: ' + String(mail.tema || '').replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '')) + '&body=' + encodeURIComponent(q)) + '" data-a="iskMail">Отговори с мейл ›</a>';
    openSheet('❓ Искането е записано', '<p class="sh-q">' + esc(clip(q, 300)) + '</p>' +
      '<p>' + (link ? 'Въпросът отива в клипборда и се отваря чатът на съобщението — постави и прати сам.' : 'Отваря се пощата на телефона с готова чернова до подателя — прати сам.') + '</p>' + b +
      '<button type="button" class="btn ghost" data-a="iskUndo">' + (u0 ? 'Отмени искането' : 'Отмени задачата') + '</button>' +
      '<button type="button" class="btn ghost" data-a="close">Готово</button>' +
      '<p class="small muted">Нищо не се праща от AiLab. Искането стои в Задачи (Искания).</p>', 'isk');
    iskPause();
  }
  var ISK = null;
  // Докато листът „❓ Искането е записано“ покрива картата, 5-те секунди „Отмени“ не текат; тръгват отначало, щом листът се затвори.
  // Скриване на приложението (отваря се чатът) пак записва веднага (първо опашката [К22]) — тогава бутонът става „Отмени задачата“.
  function undoBars(key) {
    var l = Array.prototype.slice.call(document.querySelectorAll('[data-ub]')).filter(function (b) { return b.getAttribute('data-ub') === key; });
    Array.prototype.forEach.call(document.querySelectorAll('.toast.undo'), function (t) { if (t.getAttribute('data-uk') === key) { var b = t.querySelector('.u-bar'); if (b) l.push(b); } });
    return l;
  }
  function iskPause() {
    var u = ISK && UNDO[ISK.key]; if (!u || u.paused) return;
    clearTimeout(u.timer); u.timer = null; u.paused = true;
    undoBars(u.key).forEach(function (b) { b.style.animationPlayState = 'paused'; });
  }
  function iskResume() {
    var x = ISK; ISK = null;
    var u = x && UNDO[x.key]; if (!u || !u.paused) return;
    u.paused = false; u.t0 = Date.now();
    u.timer = setTimeout(function () { undoCommit(u.key); }, UNDO_MS);
    undoBars(u.key).forEach(function (b) { var n = b.cloneNode(false); n.style.animationPlayState = ''; n.style.animationDuration = UNDO_MS + 'ms'; b.parentNode.replaceChild(n, b); });
  }
  function iskUndo() {
    var x = ISK; if (!x) { closeSheet(); return; }
    if (UNDO[x.key]) { ISK = null; undoCancel(x.key); return; }   // още в 5-те секунди → нищо не е тръгнало
    iskOtmeni(x.qid);
  }
  // записът вече е тръгнал: на телефона (опашката) → маха се; в базата → „Отмени“ за реда (deistviq_bel) с 5 с „Отмени“
  function iskOtmeni(qid) {
    if (!qid) { closeSheet(); toast('Искането вече е записано — отмени го от Задачи.', 'bad'); return; }
    var inQ = queue().filter(function (it) { return it.tbl === 'deistviq' && it.row && it.row.klient_id === qid; })[0];
    if (inQ && flushing) { flushing.then(function () { iskOtmeni(qid); }, function () { iskOtmeni(qid); }); return; }   // изпраща се в момента — изчаква
    if (inQ) { dropQ(inQ.qid); ISK = null; closeSheet(); toast('Искането още не беше тръгнало — махнато е'); renderBanners(); renderCurrent(); return; }
    var a = zadRows().filter(function (r) { return r.klient_id === qid && typeof r.id === 'number'; })[0];
    if (a) { ISK = null; toast('Вече беше записано — отменям го'); zadBelStart(a, 'otmeni'); return; }
    ISK = null; closeSheet(); toast('Искането вече е записано — отмени го от Задачи.', 'bad');
  }
  function iskGo(el, e) {
    if (!ISK) return;
    copyText(ISK.msg);
    if (el.tagName !== 'A') { if (e) e.preventDefault(); toast('Въпросът е копиран · в демото няма истински Тиймс'); }
  }

  // ---------- Задачи: думите на състоянията — само от тук [К33] ----------
  var ST = {
    zaqveno: ['⏳ заявено · чака лаптопа', 'p-neutral'], proba: ['🧪 готова — така ще я впиша ›', 'p-mine'], dopalni: ['✎ допълни', 'p-warn'],
    chaka_reshenie: ['❔ начинът още не е избран', 'p-neutral'], chaka_razreshenie: ['🔒 чака разрешение в Microsoft', 'p-neutral'],
    vpisano: ['📤 вписано · Интранет №', 'p-ok'], izpalneno: ['✅ изпълнено', 'p-ok'], otmeneno: ['✕ отменено', 'p-neutral'], zameneno: ['✕ заменено', 'p-neutral'],
    greshka: ['⚠️ не стана: ', 'p-warn'], pend: ['⏳ на телефона — чака връзка', 'p-warn'], err: ['⚠️ не се записа — виж', 'p-warn'],
    lokal: ['⏳ отбелязано — чака лаптопа', 'p-neutral'], prosr: ['просрочено', 'p-warn']
  };
  function isProba(a) { return a.status === 'zaqveno' && /^🧪/.test(a.belejka || ''); }
  function stOf(a) {
    if (a._err) return ST.err;
    if (a._pend) return ST.pend;
    if (lokalClosed(a)) return ST.lokal;
    if (a.status === 'zaqveno') return isProba(a) ? ST.proba : ST.zaqveno;
    if (a.status === 'vpisano') return [ST.vpisano[0] + (a.vanshen_id || '?') + ' ›', ST.vpisano[1]];
    if (a.status === 'otmeneno') return /замен/i.test(a.belejka || '') ? ST.zameneno : ST.otmeneno;
    if (a.status === 'greshka') return [ST.greshka[0] + clip(a.belejka || 'виж бележката', 60), ST.greshka[1]];
    return ST[a.status] || [a.status || '—', 'p-neutral'];
  }
  // отметките към задача: базата + опашката (без отказаните)
  function belOf(id) {
    var out = S.bel.filter(function (b) { return b.deistvie_id === id; });
    queue().forEach(function (it) { if (it.tbl === 'deistviq_bel' && !it.err && it.row.deistvie_id === id && !out.some(function (b) { return b.klient_id && b.klient_id === it.row.klient_id; })) out.push(Object.assign({ _pend: true, kogda: it.at, obraboteno: null, rezultat: null }, it.row)); });
    return out;
  }
  // Местно затваряне [К21]: необработена „Готово/Отмени“ или по-нов ред, който я заменя → „Приключени“, без броене
  function lokalClosed(a) {
    if (typeof a.id !== 'number' || (OTV.indexOf(a.status) < 0 && a.status !== 'greshka')) return null;
    var b = belOf(a.id).filter(function (x) { return (x.vid === 'gotovo' || x.vid === 'otmeni') && !x.obraboteno; })[0];
    if (b) return b.vid;
    var zam = S.deistviq.some(function (x) { return x.zamenq === a.id && x.status !== 'otmeneno'; }) ||
      queue().some(function (it) { return it.tbl === 'deistviq' && !it.err && it.row.zamenq === a.id; });
    return zam ? 'zamenena' : null;
  }
  // Всички задачи: опашката на телефона + базата (7а/7б и заявка 4 на Таблото — по-прясната печели)
  function zadRows() {
    var out = [], seenK = {}, by = {};
    queue().forEach(function (it) {
      if (it.tbl !== 'deistviq') return;
      var r = Object.assign({ _q: true, _pend: !it.err, _err: it.err || '', _qid: it.qid, sazdadeno: it.at, id: 'q' + it.qid, status: 'zaqveno' }, it.row);
      out.push(r); if (r.klient_id) seenK[r.klient_id] = 1;
    });
    var tbNew = TB.okAt > S.actsOkAt;
    function add(a, pref) { if (a.klient_id && seenK[a.klient_id]) return; var k = String(a.id); if (!by[k] || pref) by[k] = a; }
    S.deistviq.forEach(function (a) { add(a, !tbNew); });
    TB.soon.forEach(function (a) { add(a, tbNew); });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out;
  }
  function zadFind(id) { var s = String(id); return zadRows().filter(function (a) { return String(a.id) === s; })[0] || null; }
  // четирите групи — по това какво трябва да направи РП [К32]
  function zadGroup(a) {
    if (a._err) return 'wait';
    if (a._q) return 'q';
    if (lokalClosed(a) || a.status === 'izpalneno' || a.status === 'otmeneno') return 'done';
    if (CHAKA_TEB.indexOf(a.status) >= 0) return 'wait';
    var t = a.srok ? Date.parse(a.srok) : NaN;
    if (!isNaN(t) && t <= nowMs() + 48 * 36e5) return 'soon';
    return 'move';
  }
  // Значката на Задачи = „Чака теб“ + „До 48 ч и просрочени“ (без дубли) [§8.3]; броячът на Таблото — до 48 ч + просрочени
  function zadStats() {
    var n = nowMs(), o = { wait: 0, soon: 0, old: 0 };
    zadRows().forEach(function (a) {
      var g = zadGroup(a);
      if (g === 'wait') o.wait++;
      else if (g === 'soon' || (g === 'q' && a.srok && Date.parse(a.srok) <= n + 48 * 36e5)) { o.soon++; if (Date.parse(a.srok) < n) o.old++; }
    });
    return o;
  }
  function objOf(a) {
    if (a.obekt === 'ag' || a.obekt === 'soft') return a.obekt;
    var d = a.den_id != null ? (dniById(a.den_id) || (S.den && S.den.id === a.den_id ? S.den : null) || findDni(a.den_id)) : null;
    if (d && (d.obekt === 'ag' || d.obekt === 'soft')) return d.obekt;
    var m = /·\s*(ag|soft)\s*$/.exec(a.izvor || '');
    return m ? m[1] : null;
  }
  function srokLbl(a) {
    if (!a.srok) return '';
    var d = new Date(a.srok); if (isNaN(d)) return '';
    if (a.cel === 'intranet') return 'до ' + lcDay(a.danni && a.danni.kraen_srok ? a.danni.kraen_srok : ymd(d));
    return (a.vid === 'napomni' || a.vid === 'sreshta' ? '' : 'до ') + lcDay(ymd(d)) + ', ' + hhmm(d);
  }
  // „с“ / „със“: пред дума, която започва със „с“ или „з“ — „със“ (правописът)
  function sas(s) { return /^\s*[сзsz]/i.test(String(s || '')) ? 'със ' : 'с '; }
  function actRow(a) {
    var v = VID[a.vid] || ['•', a.vid], s = stOf(a), o = objOf(a), g = zadGroup(a);
    var over = g === 'soon' && a.srok && Date.parse(a.srok) < nowMs();
    var cel = a.cel === 'intranet' ? 'Интранет' : a.cel === 'todo' ? 'To Do' : '';
    var who = a.chovek ? (a.vid === 'iskane' ? 'до ' : a.vid === 'sreshta' ? sas(a.chovek) : '') + a.chovek : '';
    return '<li class="act' + (a._q ? ' pend' : '') + (over || g === 'wait' ? ' soon' : '') + (g === 'done' ? ' done' : '') + '"><button type="button" class="act-btn" data-a="zad" data-id="' + esc(a.id) + '">' +
      '<span class="act-e" aria-hidden="true">' + v[0] + '</span><span class="act-b"><span class="act-t">' + esc(a.tekst) + '</span>' +
      '<span class="act-m">' + (o ? '<span class="ochip o-' + o + '">' + SELK[o] + '</span>' : '') + (cel ? '<span class="act-c">' + cel + '</span>' : '') +
        esc([who, srokLbl(a)].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="act-p"><span class="pill ' + s[1] + '">' + esc(s[0]) + '</span>' + (over ? '<span class="pill ' + ST.prosr[1] + '">' + ST.prosr[0] + '</span>' : '') + '</span></span></button></li>';
  }
  // „Задачи от този ден (N)“ под деня + „Всички задачи ›“ [§3.2]
  function renderActs() {
    var el = box('#acts'); if (!el) return;
    var id = S.den ? S.den.id : null;
    var list = id == null ? [] : zadRows().filter(function (a) { return a.den_id === id; }).sort(function (a, b) { return String(b.sazdadeno || '') < String(a.sazdadeno || '') ? -1 : 1; });
    var z = zadStats();
    el.innerHTML = '<div class="acts-h"><h2>Задачи от този ден</h2><span class="grp-n" style="--c:var(--mine)">' + list.length + '</span></div>' +
      (list.length ? '<ul class="acts">' + list.map(actRow).join('') + '</ul>'
        : '<p class="grp-e">' + (id != null ? 'Няма задачи към този ден.' : 'Още няма.') + ' Натисни „+“ или „→ Задача“ на точка — задачите не чакат одобрението на деня.</p>') +
      '<button type="button" class="btn ghost acts-more" data-a="allActs2">Всички задачи' + (z.wait + z.soon ? ' · ' + (z.wait + z.soon) + ' чакат теб или скоро' : '') + ' ›</button>';
  }


  // ---------- ленти горе, листове, тостове ----------
  function renderBanners() {
    var el = $('#banners'); if (!el) return;
    var h = '', live = view === 'day' || view === 'tablo' || view === 'deistviq' || view === 'nastroiki';
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
      var kind = it.tbl === 'deistviq' ? 'Задача · ' + ((VID[it.row.vid] || ['', it.row.vid])[1])
        : it.tbl === 'deistviq_bel' ? 'Задача №' + it.row.deistvie_id + ' · ' + (it.row.vid === 'gotovo' ? 'Готово' : it.row.vid === 'otmeni' ? 'Отмени' : 'Лична бележка')
        : (QVID[it.row.vid] || it.row.vid);
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
  // keepFocus — пречертаване на същия лист (renderPlusForm(true)): без фокусиране след 40 ms, иначе на iPhone клавиатурата
  // пада след всеки избран човек, а празното описание „краде“ фокуса при тап на избор (фокусът се връща от извикващия)
  function openSheet(title, body, kind, keepFocus) {
    var had = !!sheetEl;
    if (had && sheetKind === 'isk') iskResume();   // „❓ Искането е записано“ се сменя с друг лист → 5-те секунди „Отмени“ текат пак
    sheetKind = kind || '';
    if (sheetEl) { sheetEl.remove(); sheetEl = null; }
    if (!had) sheetPrev = document.activeElement;
    var sc = document.createElement('div');
    sc.className = 'scrim'; sc.setAttribute('data-a', 'scrim');
    // „Затвори“ и в дъното на листа — горното „×“ е извън обсега на палеца (без листовете с текст за запис)
    if (!/data-a="(close|plusSave|plusDraft|pySave|belSave)"/.test(body)) body += '<button type="button" class="btn ghost sh-end" data-a="close">Затвори</button>';
    sc.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" tabindex="-1"><div class="sh-h"><h2 id="shT">' + esc(title) + '</h2>' +
      '<button type="button" class="sh-x" data-a="close" aria-label="Затвори">×</button></div><div class="sh-b">' + body + '</div></div>';
    if (had) sc.style.animation = 'none';
    document.body.appendChild(sc); document.body.classList.add('noscroll'); sheetEl = sc;
    var sh = sc.firstChild;
    if (had) sh.style.animation = 'none';
    if (!keepFocus) setTimeout(function () { if (sheetEl !== sc) return; var f = sh.querySelector('[autofocus]'); try { (f || sh).focus({ preventScroll: true }); } catch (e) {} }, 40);
    vvFit();
  }
  function closeSheet() {
    if (!sheetEl) return;
    if (sheetKind === 'isk') iskResume();
    sheetEl.remove(); sheetEl = null; sheetKind = ''; SP = null; SRC = null; PY = null;
    if (!PV) document.body.classList.remove('noscroll');   // прегледът и листът се пазят взаимно [К28]
    if (sheetPrev && document.contains(sheetPrev) && sheetPrev.focus) { try { sheetPrev.focus({ preventScroll: true }); } catch (e) {} }
    sheetPrev = null;
  }
  // iPhone (Safari и иконата на началния екран): клавиатурата свива само видимата част (visualViewport), а не position:fixed
  // и dvh → листът с форма се събира точно във видимото над клавиатурата и залепеният „Запиши“ остава видим [К31, А12]
  function vvFit() {
    var sc = sheetEl, vv = window.visualViewport; if (!sc) return;
    var sh = sc.firstChild, form = sheetKind === 'form' || sheetKind === 'py' || sheetKind === 'bel';
    var on = !!(vv && form && (window.innerHeight - vv.height > 80 || vv.offsetTop > 0));
    sc.style.top = on ? Math.round(vv.offsetTop) + 'px' : '';
    sc.style.bottom = on ? 'auto' : '';
    sc.style.height = on ? Math.round(vv.height) + 'px' : '';
    if (sh) sh.style.maxHeight = on ? Math.max(200, Math.round(vv.height) - 8) + 'px' : '';
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', vvFit); window.visualViewport.addEventListener('scroll', vvFit); }
  // поле във формата на листа има фокус (пише се) → листът не се пречертава целият (клавиатурата би паднала насред думата)
  function sheetTyping() {
    var a = document.activeElement;
    return !!(sheetEl && a && a !== sheetEl.firstChild && sheetEl.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  // връщане на фокуса след пречертаване — без „скрол в средата“ от слушателя focusin (листът не подскача)
  var QF = null;
  function quietFocus(el, s0, s1) {
    if (!el || !el.focus) return;
    QF = el;
    try { el.focus({ preventScroll: true }); } catch (e) {}
    QF = null;
    if (s0 != null && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(s0, s1 != null ? s1 : s0); } catch (e) {} }
  }
  function toast(msg, kind) {
    var box = $('#toasts'); if (!box) return;
    var t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.textContent = msg;
    box.appendChild(t);
    var pl0 = box.querySelectorAll('.toast:not(.undo)');   // тостовете с „Отмени“ не се изтласкват
    for (var i = 0; i < pl0.length - 3; i++) box.removeChild(pl0[i]);
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
    if (view === 'day') { keepAnchor(renderGroups); keepY(['#ph'], renderPh); }
    else if (view === 'tablo' && TB.built) { renderFeed(); if (!scrolledFar()) renderOpen(true); }
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
  // С1 дойде: редът миниатюри във всяка карта се появява чак сега — без скачане под палеца [§6.1, Е2-К11]
  function phShow() {
    if (view !== 'day' || !S.den || S.den.id !== PH.den) return;
    keepAnchor(function () { renderSum(); renderGroups(); });
    keepY(['#ph'], renderPh);
    phSignDay();
  }
  // снимките на точката = снимките на деня от съобщенията-източници (без нова заявка) [§6.1]
  function tPhotos(t) {
    var l = phCur(); if (!l || !t) return null;
    var ms = {}, any = false;
    (t.izvori || []).forEach(function (s) { var m = srcMsg(s); if (m) { ms[m] = 1; any = true; } });
    return any ? l.filter(function (r) { return ms[r.msg_id]; }) : [];
  }
  // ред от до 4 плочки 56×56 + „+N“ (от 5-тата) — в картите на Преглед и на Таблото
  function phRowHtml(list, a, attrs, total) {
    var n = total || list.length;
    return '<div class="pc-ph">' + list.slice(0, 4).map(function (r, i) {
      var im = phImg(r.pat_mini, r, true);
      return '<button type="button" class="ph-t pc-pt' + (im.x ? ' ph-x' : '') + '" data-a="' + a + '" ' + attrs + ' data-i="' + i + '" aria-label="' + esc(phLbl(i, n, r)) + '">' + im.h + '</button>';
    }).join('') + (n > 4 ? '<button type="button" class="ph-t pc-pt ph-pl" data-a="' + a + '" ' + attrs + ' data-i="4" aria-label="' + esc('Още ' + (n - 4) + ' снимки — отвори прегледа') + '">+' + (n - 4) + '</button>' : '') + '</div>';
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
    // „📷 Всички снимки на деня (N)“ — свита по подразбиране; снимките са и в картите на точките [§6.3]
    var n = list.length, msgs = {}, nm = 0, first = {}, show = Math.min(n, PH.shown), fail = false, vT = {}, bez = 0;
    list.forEach(function (r) { if (!msgs[r.msg_id]) { msgs[r.msg_id] = 1; nm++; } });
    S.tochki.forEach(function (t) { (t.izvori || []).forEach(function (s) { var m = srcMsg(s); if (m) vT[m] = 1; }); });
    list.forEach(function (r) { if (!vT[r.msg_id]) bez++; });
    var sub = 'в ' + nm + ' ' + pl(nm, 'съобщение', 'съобщения') + (bez ? ' · ' + bez + ' без точка' : ' · всички са към точки');
    if (!S.phOpen) {
      el.innerHTML = '<details class="phs" id="phD"><summary><span class="phs-t">📷 Всички снимки на деня (' + n + ')</span><span class="chev" aria-hidden="true">▾</span><span class="phs-s">' + sub + '</span></summary></details>';
      return;
    }
    h = '<details class="phs" id="phD" open><summary><span class="phs-t">📷 Всички снимки на деня (' + n + ')</span><span class="chev" aria-hidden="true">▾</span><span class="phs-s">' + sub + '</span></summary><div class="ph-g">';
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
    el.innerHTML = h + '</details>';
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
    var q = '[data-a="' + f.a + '"]' + (f.i != null ? '[data-i="' + (+f.i) + '"]' : '') + (f.sid != null ? '[data-sid="' + (+f.sid) + '"]' : '') + (f.tid != null ? '[data-tid="' + (+f.tid) + '"]' : '');
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
  // При зареждане — само SELECT; запис има само след натиснат бутон (✓ / → Задача / „+“) — през send() и опашката.
  // Таблото живее в #tablo, който не се унищожава при смяна на таба: скролът и заредените порции се пазят [К2].
  // 4 таба с 4 различни силуета: дъга (уред) · висок лист с лупа (без ✓ [К28]) · редове с квадратчета · зъбно колело [§3.1].
  // Вътрешните имена на изгледите остават (day = Преглед, deistviq = Задачи). Класът „f“ = плътен фон (15 %) на активния таб.
  var TABS = [['tablo', 'Табло'], ['day', 'Преглед'], ['deistviq', 'Задачи'], ['nastroiki', 'Настройки']];
  var TAB_ICO = {
    tablo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="f" d="M3.5 17.5a8.5 8.5 0 0 1 17 0z"/><path d="M3.5 17.5a8.5 8.5 0 0 1 17 0M5.9 12.3l1.3.8M12 9v1.5M18.1 12.3l-1.3.8M12 17.5l3.7-4.4"/><circle cx="12" cy="17.5" r="1.4" fill="currentColor"/></svg>',
    day: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="f" d="M5.5 2.8h8.7l3.3 3.3v6.6a4 4 0 0 0-5.6 6.3v2.2H5.5z"/><path d="M11.9 21.2H5.5V2.8h8.7l3.3 3.3v6.4M8.5 8h6M8.5 11.5h4"/><circle cx="16" cy="16.8" r="3.1"/><path d="M18.3 19.1l2.4 2.4"/></svg>',
    deistviq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect class="f" x="3.2" y="3.8" width="4.8" height="4.8" rx="1"/><rect x="3.2" y="3.8" width="4.8" height="4.8" rx="1"/><path d="M4.3 6.2l1.1 1.1 1.8-2"/><rect x="3.2" y="10" width="4.8" height="4.8" rx="1"/><rect x="3.2" y="16.2" width="4.8" height="4.8" rx="1"/><path d="M11 6.2h9.8M11 12.4h9.8M11 18.6h9.8"/></svg>',
    nastroiki: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="f" d="M10.3 2.8h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><path d="M10.3 2.8h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/><circle cx="12" cy="12" r="3"/></svg>'
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
  function tabCur() { return view === 'setup' ? S.setupFrom : view; }
  function renderTabs() {
    var nav = $('#tabs'); if (!nav) return;
    var on = view === 'tablo' || view === 'day' || view === 'deistviq' || view === 'nastroiki' || view === 'setup';
    nav.hidden = !on;
    if (!on) return;
    var nd = pendingDays('all').length, z = zadStats(), nz = z.wait + z.soon, cur = tabCur();
    var h = TABS.map(function (t) {
      var k = t[0], n = k === 'day' ? nd : k === 'deistviq' ? nz : 0;
      var lbl = t[1] + (!n ? '' : k === 'day' ? ', ' + n + (n === 1 ? ' ден чака' : ' дни чакат') + ' одобрение'
        : ', ' + (z.wait ? z.wait + ' ' + pl(z.wait, 'чака', 'чакат') + ' теб' : '') + (z.wait && z.soon ? ' и ' : '') + (z.soon ? z.soon + ' със срок до 48 часа' : ''));
      return '<button type="button" class="tab" data-a="tab" data-v="' + k + '"' + (cur === k ? ' aria-current="page"' : '') + ' aria-label="' + esc(lbl) + '">' +
        TAB_ICO[k] + '<span>' + t[1] + '</span>' + (n ? '<b class="badge" aria-hidden="true">' + n + '</b>' : '') + '</button>';
    }).join('');
    if (nav._h !== h) { nav.innerHTML = h; nav._h = h; }
  }
  function showBox() { if (tablo) tablo.hidden = view !== 'tablo'; screen.hidden = view === 'tablo'; }
  // Нови адреси: #pregled, #pregled/<id>, #zadachi, #nastroiki; старите #den, #den/<id>, #deistviq продължават да работят [§3.3]
  function parseHash() {
    var h = location.hash || '', m = /^#(?:pregled|den)\/(\d+)$/.exec(h);
    if (m) return { tab: 'day', id: +m[1] };
    if (h === '#pregled' || h === '#den') return { tab: 'day', id: null };
    if (h === '#zadachi' || h === '#deistviq') return { tab: 'deistviq', id: null };
    if (h === '#nastroiki') return { tab: 'nastroiki', id: null };
    return { tab: 'tablo', id: null };
  }
  // След вход / при старт: по адреса, иначе Таблото. Извън Таблото — броячите за значките (заявки 1, 3, 4, 5) +
  // задачите (7а/7б/8), за да е вярна значката на Задачи още при старт [К10]
  function routeStart() {
    var h = parseHash();
    // запазеното Табло се чете при всеки старт (и за #pregled / #zadachi): иначе saveTablo() след заявките за значките
    // би записало празни sel/closed върху него, а Преглед не би виждал отметките от Таблото (TB.closed)
    if (!TB.hasBase) tabloFromCache();
    go(h.tab, { den: h.id, force: true });
    if (h.tab !== 'tablo') loadTablo(true);
    if (h.tab !== 'deistviq') loadActs(true);
  }
  var VIEWS = { tablo: 1, day: 1, deistviq: 1, nastroiki: 1 };
  function go(tab, o) {
    o = o || {};
    if (!VIEWS[tab]) tab = 'tablo';
    if (view === tab && !o.force && !(tab === 'day' && o.den && !(S.den && S.den.id === o.den))) {
      // натиснат активния таб → горе (+ обновяване, ако данните са по-стари от 60 с) — обновяването с палеца
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      if (tab === 'tablo') { if (stale60(TB.okAt)) loadTablo(); else if (anyDefer()) applyDeferred(); }
      else if (tab === 'day') { if (stale60(S.okAt)) poll(true); }
      else if (tab === 'deistviq') { if (stale60(S.actsOkAt)) loadActs(); }
      else renderNastroiki();
      return;
    }
    leaveView();
    S.tok++; TB.tok++;   // закъснели отговори за стария изглед се изхвърлят [К2]
    view = tab;
    showBox();
    $('#fab').hidden = tab === 'nastroiki';   // „+“ е скрит на Настройки
    renderTabs(); renderBanners(); stampNow();
    if (tab === 'tablo') showTablo();
    else if (tab === 'day') {
      // Преглед още не е отварян → обектът на избора на Таблото (ако не е „Всички“), не този от старта (§1)
      if (!o.den && !lget(K2.denObekt) && TB.sel !== 'all') setObekt(TB.sel);
      showDay(o.den || null);
    }
    else if (tab === 'deistviq') showActs();
    else showNastroiki();
  }
  function leaveView() {
    commitUndos();
    var y = window.pageYOffset || 0;
    if (view === 'tablo') { TB.scrollY = y; seenWrite(); hidePill(); }
    else if (view === 'day') { S.scrollY = y; stopPoll(); }
    else if (view === 'deistviq') { S.zadY = y; }
    actsTimer(false);
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
  // Табът „Преглед“: последният показан обект; ако денят вече е зареден — без пълно презареждане.
  function showDay(id) {
    setBodyO(OBEKT_KOD); lset(K2.denObekt, OBEKT_KOD);
    var loading = scrHead('day') + '<div class="card pad tb-load"><span class="pulse" aria-hidden="true"></span> Зареждам деня…</div>';
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
    // само ако денят е зареден: прекъснат boot() (Преглед → Табло, преди да се зареди) оставя S.dni без S.den
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
    setBodyO(TB.sel); setHash('#zadachi');
    renderActsTab(); window.scrollTo(0, 0);
    if (stale60(S.actsOkAt)) loadActs();
    actsTimer(true);
  }
  // 7а/7б/8 — при отваряне на Задачи, при старт и на всеки 2 мин, докато Задачи е отворен [К9]
  function actsTimer(on) {
    if (S.actsT) { clearInterval(S.actsT); S.actsT = 0; }
    if (on) S.actsT = setInterval(function () { if (view === 'deistviq' && !document.hidden && !offNow()) loadActs(true); }, 120000);
  }
  function setActs(x) {
    if (!x) return;
    if (Array.isArray(x)) { S.deistviq = x; return; }
    S.deistviq = x.rows || []; S.bel = x.bel || [];
  }
  function loadActs(quiet) {
    if (view === 'deistviq' && !quiet) stamp('обновявам…');
    S.actsErr = null;
    api.deistviq().then(function (a) {
      setActs(a); S.actsAt = nowIso(); S.actsOkAt = Date.now();
      if (S.offline && !S.forceOff) setOnline(); else { renderCurrent(); stampNow(); }
      saveTablo();
    }, function (e) {
      if (isNet(e) || isAuth(e)) { if (!quiet) setOffline(); return; }
      if (isMissing(e)) { if (view === 'deistviq') renderSetup(); return; }
      S.actsErr = e; renderCurrent();
      stampNow();
      if (view === 'deistviq' && !quiet) toast('Задачите не се заредиха: ' + errBg(e), 'bad');
    });
  }
  // Печатът горе: времето на данните на ТЕКУЩИЯ екран (Настройки — „данни към“ на Таблото).
  function stampNow() {
    if (view !== 'tablo' && view !== 'day' && view !== 'deistviq' && view !== 'nastroiki') return;
    if (view === 'tablo' && tBusy()) { stamp(TB.hasBase ? 'обновявам…' : 'зареждам…'); return; }
    var at = view === 'day' ? S.dataAt : view === 'deistviq' ? (S.actsAt || TB.at) : TB.at;
    if (offNow()) { stamp('без покритие · ' + (at ? rel(at) : '—'), true); return; }
    stamp(at ? 'данни към ' + rel(at) + (view === 'tablo' ? ' ↻' : '') : '…');
  }
  function renderCurrent() {
    if (view === 'tablo') renderTabloLive();
    else if (view === 'day') renderLive();
    else if (view === 'deistviq') renderActsTab();
    else if (view === 'nastroiki') renderNastroiki();
    renderTabs(); renderBanners();
    if (sheetKind === 'zad' && ZS) openZad(ZS.id, true);   // отвореният лист на задача следи състоянието ѝ
    phRepaint();   // покритие ⇄ без покритие: плочките, листът и прегледът (box() пише само разликата)
  }
  function refreshCurrent() {
    if (view === 'tablo') loadTablo();
    else if (view === 'day') { if (S.den && !S.offline) { poll(true); phLoad(S.den.id); } else boot(S.den ? S.den.id : null, !!S.den); }
    else if (view === 'deistviq') loadActs();
    else if (view === 'nastroiki') { loadTablo(true); loadActs(true); NS.mqAt = 0; renderNastroiki(); }
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
      // върната от заявката, макар записът да е в базата отпреди нея → вече не я затваря (напр. отменена задача) [К11]
      if (ret[k] && eff && o.at && Date.parse(eff) < Date.parse(o.at) - 2000) { delete TB.closed[k]; ch = true; return; }
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
        if (far && selState(sel).feed) { TB.defer.chart = true; TB.defer.feed = true; if (newer && red('potok') !== 'stari') showPill(); }
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
      var oldPh = st.open && st.open.ph ? st.open.ph : {};
      st.open = { items: (r.data || []).map(normT), total: r.count == null ? (r.data || []).length : r.count, all: all, at: at, ph: oldPh };
      if (clearClosed(st.open)) saveTablo();
      if (sel === TB.sel && view === 'tablo') { renderOpen(!!force); renderTabloCounts(); }
      renderTabs();
      phOpenLoad(sel, st.open);
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
  // Дните на потока по подредбата: „Нови първо“ — от най-новия; „Стари първо“ — от „Започни от“ (по подразбиране най-стария) [§4.1]
  function feedRows(sel) {
    var rows = selRows(sel).slice();
    if (red('potok') !== 'stari') return rows;
    rows.reverse();
    var ot = TB.feedOt[sel];
    return ot ? rows.filter(function (r) { return r.data >= ot; }) : rows;
  }
  function feedKey(sel) { return red('potok') + ':' + (red('potok') === 'stari' ? (TB.feedOt[sel] || '') : ''); }
  function feedReset(sel) {
    var st = selState(sel);
    var f = { rows: feedRows(sel), items: [], pos: 0, done: false, loading: false, err: null, chain: 0, seq: ++st.fseq, fresh: true, ph: {}, key: feedKey(sel) };
    if (st.feed && st.feed.key !== f.key) st.feed = null;   // друга подредба → старият поток не стои „до новия“
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
    return { rows: f.rows.map(function (r) { return r.id; }), items: out, pos: pos, done: f.done && pos === f.pos, ph: ph, key: f.key || 'novi:' };
  }
  // снимките на картите в „Изисква решение“ — само пътищата, до 4 на карта (+ общия брой) [§6.2]
  function openPhCache(ph) {
    var o = {};
    Object.keys(ph || {}).forEach(function (k) { var l = ph[k] || []; o[k] = { n: l.n || l.length, l: l.slice(0, 4).map(function (r) { var x = {}; PH_TB.forEach(function (c) { x[c] = r[c]; }); return x; }) }; });
    return o;
  }
  function openPhFromCache(c) {
    var o = {};
    Object.keys(c || {}).forEach(function (k) { var x = c[k]; if (x && Array.isArray(x.l)) { var l = x.l.map(normPh); l.n = x.n || l.length; o[k] = l; } });
    return o;
  }
  function saveTablo(max) {
    if (!TB.hasBase) return;
    max = max == null ? 40 : max;
    var c = { v: 1, at: TB.at, dni: TB.dni, svezhest: S.svezhest, soon: TB.soon.filter(function (a) { return typeof a.id === 'number'; }), odobri: TB.odobri, closed: TB.closed,
      acts: S.deistviq.filter(function (a) { return typeof a.id === 'number'; }).slice(0, 200), actsAt: S.actsAt, bel: S.bel.filter(function (b) { return typeof b.id === 'number'; }).slice(0, 200),
      feedOt: TB.feedOt, sel: {} };
    ['ag', 'soft', 'all'].forEach(function (k) {
      var s = TB.S[k]; if (!s || (!s.open && !s.feed)) return;
      var o = s.open && !s.open.err && s.open.at ? { items: s.open.items, total: s.open.total, all: s.open.all, at: s.open.at, ph: max ? openPhCache(s.open.ph) : {} } : null;
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
    if (Array.isArray(c.bel) && !S.bel.length) S.bel = c.bel;
    if (c.feedOt && typeof c.feedOt === 'object') TB.feedOt = c.feedOt;
    var by = {}; TB.dni.forEach(function (d) { by[d.id] = d; });
    Object.keys(c.sel || {}).forEach(function (k) {
      var s = c.sel[k], st = selState(k);
      if (s.open && !st.open) st.open = { items: (s.open.items || []).map(normT), total: s.open.total || 0, all: !!s.open.all, at: s.open.at || null, ph: openPhFromCache(s.open.ph) };
      if (s.feed && !st.feed && (s.feed.key || 'novi:') === feedKey(k)) {
        var rows = [], pos = s.feed.pos || 0;
        (s.feed.rows || []).forEach(function (id, i) { if (by[id]) rows.push(by[id]); else if (i < (s.feed.pos || 0)) pos--; });
        st.feed = { rows: rows, items: (s.feed.items || []).map(normT), pos: Math.max(0, pos), done: !!s.feed.done, loading: false, err: null, chain: 0, seq: st.fseq, fresh: false,
          ph: s.feed.ph && typeof s.feed.ph === 'object' ? s.feed.ph : {}, key: s.feed.key || 'novi:' };
      }
    });
    return true;
  }

  // --- рисуване ---
  function buildTablo() {
    tablo.innerHTML = scrHead('tablo') +
      '<div id="tb-sw"></div><div id="tb-top" class="tb-top"></div><div id="tb-fresh"></div><div id="tb-cnt" class="stats tb-cnt"></div>' +
      '<section class="grp g-reshenie" id="tb-open-s" aria-label="Изисква решение"><div class="grp-h"><h2>Изисква решение</h2><span class="grp-n" id="tb-open-n">…</span><span class="grp-rc" id="tb-red-resh"></span></div>' +
        '<p class="grp-s">чака теб: отговор, решение, пари или срок</p><div id="tb-open" class="tb-list"></div></section>' +
      '<section class="grp g-promqna" id="tb-hora-s" aria-label="Хора на обекта"><div class="grp-h"><h2>Хора на обекта</h2><span class="grp-l">14 дни</span></div><div id="tb-hora"></div></section>' +
      '<section class="grp g-promqna" id="tb-feed-s" aria-label="Какво се промени"><div class="grp-h"><h2>Какво се промени</h2><span class="grp-rc" id="tb-red-potok"></span></div>' +
        '<p class="grp-s" id="tb-feed-sub"></p><div id="tb-ot"></div><div id="tb-feed" class="tb-list"></div><div id="tb-end" class="tb-end"></div></section>' +
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
    renderTbSw(); renderTbTop(); renderFresh('#tb-fresh', true); renderTabloCounts(); renderTbRed();
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
    var sel = TB.sel, pd = pendingDays(sel), sn = zadStats(), o = selState(sel).open, hi = hideInfo();
    var nOpen = o && !o.err ? openTotal(sel, o, hi) : null, imp = 0;
    if (o && !o.err) visOpen(o, hi).forEach(function (t) { if ((t.vajnost || 1) >= 3) imp++; });
    var more = o && (o.items || []).length < (o.total || 0) && o.items.length && (o.items[o.items.length - 1].vajnost || 1) >= 3;
    var impS = nOpen == null ? '' : !nOpen ? '✓ няма' : imp ? imp + (more ? '+' : '') + (imp === 1 && !more ? ' важно' : ' важни') : 'без важни';
    // числото и думата се спрягат: „1 ден“, „2 дни“; „🔔 задачи до 48 ч“ включва и просрочените (под-ред кехлибарено) [§8.3]
    var dL = pl(pd.length, 'ден', 'дни') + ' за одобрение', rL = nOpen == null ? 'решения' : pl(nOpen, 'решение', 'решения');
    var sL = pl(sn.soon, 'задача', 'задачи'), oL = sn.old ? sn.old + ' ' + pl(sn.old, 'просрочена', 'просрочени') : (sn.wait ? sn.wait + ' ' + pl(sn.wait, 'чака', 'чакат') + ' теб' : '');
    el.innerHTML =
      '<button type="button" class="stat k-o" data-a="tWait" aria-label="' + esc(cap(dL) + ': ' + pd.length + (pd.length ? ', най-стар ' + lcDay(pd[0].data) : '')) + '">' +
        '<b>' + pd.length + '</b><span>📄 ' + dL + '</span><em>' + (pd.length ? 'най-стар: ' + esc(lcDay(pd[0].data)) : '✓ няма') + '</em></button>' +
      '<button type="button" class="stat k-mine" data-a="jump" data-g="tb-open-s" aria-label="' + esc(cap(rL) + ': ' + (nOpen == null ? 'няма данни' : nOpen) + (impS ? ', ' + impS : '')) + '">' +
        '<b>' + (nOpen == null ? '—' : nOpen) + '</b><span>⏳ ' + rL + '</span><em>' + esc(impS) + '</em></button>' +
      '<button type="button" class="stat k-warn" data-a="tSoon" aria-label="' + esc(cap(sL) + ' до 48 часа: ' + sn.soon + (oL ? ', ' + oL : '')) + '">' +
        '<b>' + sn.soon + '</b><span>🔔 ' + sL + ' до 48 ч</span>' + (oL ? '<em class="' + (sn.old ? 'amber' : 'gray') + '">' + esc(oL) + '</em>' : '') + '</button>';
    renderOpenN();
  }
  function renderTbRed() {
    var a = box('#tb-red-resh'), b = box('#tb-red-potok'), s = box('#tb-feed-sub'), ot = box('#tb-ot'), st = red('potok') === 'stari';
    if (a) a.innerHTML = redChip('resh');
    if (b) b.innerHTML = redChip('potok');
    if (s) s.innerHTML = st ? 'най-старото горе · превърти за по-новите дни' : 'най-новото горе · превърти за по-старите дни';
    if (!ot) return;
    if (!st) { ot.innerHTML = ''; return; }
    // „Започни от: [ср 26.08 ▾]“ — дните на избора; по подразбиране най-старият [§4.1]
    var ds = [], seen = {};
    selRows(TB.sel).slice().reverse().forEach(function (r) { if (!seen[r.data]) { seen[r.data] = 1; ds.push(r.data); } });
    var cur = TB.feedOt[TB.sel] || ds[0] || '';
    ot.innerHTML = ds.length ? '<label class="tb-ot"><span>Започни от:</span><select data-ch="feedOt" aria-label="Започни от ден">' + ds.map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === cur ? ' selected' : '') + '>' + esc(lcDay(d)) + '</option>'; }).join('') + '</select></label>' : '';
  }
  function feedOtSet(v) {
    var ds = selRows(TB.sel).map(function (r) { return r.data; }).sort();
    if (!v || v === ds[0]) delete TB.feedOt[TB.sel]; else TB.feedOt[TB.sel] = v;
    selState(TB.sel).feed = null; feedReset(TB.sel); renderFeed(); saveTablo();
  }
  // Подредбата на един списък се сменя веднага и се помни; същите 4 превключвателя са и в Настройки [§4]
  function redSet(k, v) {
    lset(RED_K[k], v);
    if (k === 'resh') {
      ['ag', 'soft', 'all'].forEach(function (s) { var st = TB.S[s]; if (!st) return; if (st.open && st.open.items) st.open.items.sort(openCmp); st.old = null; });
      if (view === 'tablo') { renderOpen(true); renderTbRed(); }
      if (TB.hasBase && !offNow()) loadOpen(TB.sel, true);
      saveTablo();
    } else if (k === 'potok') {
      ['ag', 'soft', 'all'].forEach(function (s) { if (TB.S[s]) TB.S[s].feed = null; });
      if (TB.hasBase) { feedReset(TB.sel); if (view === 'tablo') { renderTbRed(); renderFeed(); } }
      saveTablo();
    } else if (k === 'dni') { var c = box('#redDni'); if (c) c.innerHTML = redChip('dni'); renderStrip(); centerStrip(); }
    else if (k === 'zad') renderActsTab();
    if (view === 'nastroiki') renderNastroiki();
  }
  function redToggle(k) { redSet(k, red(k) === 'novi' ? 'stari' : 'novi'); }
  // локалната подредба на решенията до новия отговор: ⚠️ важните винаги горе, после датата по избора
  function openCmp(a, b) {
    var da = (a.dni && a.dni.data) || '', db = (b.dni && b.dni.data) || '', s = red('resh') === 'stari' ? 1 : -1;
    return (b.vajnost || 1) - (a.vajnost || 1) || (da < db ? -s : da > db ? s : 0) || (a.red || 0) - (b.red || 0) || a.id - b.id;
  }
  function renderOpenN() {
    var n = $('#tb-open-n'); if (!n) return;
    var o = selState(TB.sel).open, v = o && !o.err ? String(openTotal(TB.sel, o, hideInfo())) : '—';
    if (n.textContent !== v) n.textContent = v;
  }
  function dcCard(t, hi, ph) {
    var d = t.dni || {}, tid = esc(t.id);
    // 5 с „Отмени“ [К21, правило 8]: картата стои на мястото си (приглушена), сменя се само редът с бутоните —
    // височината не се мени, „Отмени“ излиза точно под палеца, нищо под него не подскача [К11]
    var u = UNDO['dc:' + t.id], und = !!u, pl0 = ph && ph[t.id];
    var hot = (t.vajnost || 1) >= 3, w = waitPill(d.data), izv = t.izvori || [];
    return '<article class="dc' + (hot ? ' hot' : '') + (und ? ' undoing' : '') + '" data-tid="' + tid + '">' +
      '<button type="button" class="dc-open" data-a="tOpen" data-o="' + esc(d.obekt) + '" data-den="' + esc(t.den_id) + '" data-tid="' + tid + '"' + (und ? ' tabindex="-1" aria-hidden="true"' : '') + '>' +
        '<span class="dc-m"><span class="ochip o-' + esc(d.obekt) + '">' + esc(SELK[d.obekt] || d.obekt) + '</span><span class="dc-d">' + esc(lcDay(d.data)) + '</span>' +
          '<span class="pill ' + w[1] + '">' + w[0] + '</span>' + (isNewDay(d) ? '<span class="pill p-new">🆕</span>' : '') + (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') + '</span>' +
        '<span class="dc-b"><span class="dc-e" aria-hidden="true">' + emoT(t) + '</span><span class="dc-t">' + esc(t.tekst) + '</span></span>' +
        '<span class="sr"> — отвори деня</span></button>' +
      (izv.length && !und ? '<button type="button" class="srcb dc-src" data-a="tSrc" data-tid="' + tid + '" aria-label="Източници: ' + izv.length + '"><span class="ref">' + izv.length + '</span><span class="srcb-l">›</span></button>' : '') +
      // снимките на картата (С5) — до 4 + „+N“; тап → прегледът само на тях [§6.2]
      (pl0 && pl0.length && !und ? phRowHtml(pl0, 'dcPh', 'data-tid="' + tid + '"', pl0.n) : '') +
      (hi.err[t.id] ? '<div class="dc-w"><button type="button" class="dc-errb" data-a="qerr">⚠️ не се записа — виж</button></div>' : '') +
      (und
        ? '<div class="dc-a dc-ua"><span class="dc-u">' + esc(u.lbl) + '</span>' +
          '<button type="button" class="pa dc-ub" data-a="undo" data-k="dc:' + tid + '">Отмени</button><i class="u-bar" data-ub="dc:' + tid + '" aria-hidden="true"></i></div>'
        // същите три бутона като в Преглед — полето за разяснение е там, където РП решава [К27]
        : '<div class="dc-a three"><button type="button" class="pa pa-ok" data-a="tOk" data-tid="' + tid + '">✓ Отговорено</button>' +
          '<button type="button" class="pa" data-a="tFix" data-tid="' + tid + '">✎ Поясни</button>' +
          '<button type="button" class="pa" data-a="tAct" data-tid="' + tid + '">→ Задача</button></div>') + '</article>';
  }
  function openHtml() {
    var sel = TB.sel, st = selState(sel), o = st.open, hi = hideInfo(), h = '';
    if (!o) return offNow() ? '<p class="grp-e">📴 Решенията ще се покажат, когато има покритие.</p>' : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам решенията…</p>';
    if (o.err) return '<div class="err">Решенията не се заредиха: ' + esc(errBg(o.err)) + '</div><button type="button" class="btn ghost" data-a="tRetry" data-s="open">Опитай пак</button>';
    var vis = visOpen(o, hi), tot = openTotal(sel, o, hi), show = o.all ? vis : vis.slice(0, 5);
    // картите в „Отмени“ остават на мястото си, макар точката вече да е „скрита“ (записът е в опашката след 5-те с)
    h += show.length ? show.map(function (t) { return dcCard(t, hi, o.ph); }).join('') : '<p class="grp-e">✅ Нищо не чака решение.</p>';
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
  function renderOpen(force, quiet) {   // quiet — само снимки: отлага се, но без хапчето „↑ Нови промени“
    var el = box('#tb-open'); if (!el) return;
    var h = openHtml();
    if (!force && el.node._h != null && el.node._h !== h && scrolledFar()) { TB.defer.open = true; if (!quiet) showPill(); renderOpenN(); return; }
    TB.defer.open = false;
    el.innerHTML = h;
    // лентата на „Отмени“ тече от натискането, не от последното пречертаване
    Array.prototype.forEach.call(el.node.querySelectorAll('[data-ub]'), function (b) {
      var u = UNDO[b.getAttribute('data-ub')];
      if (u) b.style.animationDuration = Math.max(0, UNDO_MS - (Date.now() - u.t0)) + 'ms';
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
        '<button type="button" class="pa" data-a="tAct" data-tid="' + esc(t.id) + '">→ Задача</button>' +
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
      h = f.items.length ? '<p class="fd-end">Това е всичко' + (last ? (f.key && f.key.indexOf('stari') === 0 ? ' до ' : ' от ') + esc(lcDay(last.data)) : '') + ' ✅</p>' : '<p class="grp-e">Още няма промени.</p>';
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
  // Карта в „Изисква решение“: ✓ Отговорено / ✎ Поясни / → Задача — 5 с „Отмени“ преди записа (INSERT-ът е необратим) [К21, К27]
  // extraPre — напр. мерането на задачата (записва се чак ако не е отменено)
  function dcStart(t, lbl, tbl, row, redo, meta, extraPre) {
    var d = t.dni || tDay(t) || {}, tid = t.id;
    tMeasure();
    undoStart({ key: 'dc:' + tid, kind: 'dc', tid: tid, lbl: lbl, tbl: tbl, row: row, meta: meta || { tt: t.tekst }, redo: redo,
      pre: function () {
        if (extraPre) extraPre();
        TB.closed[tid] = { at: nowIso(), o: d.obekt || null, d: d.data || null, ok: row.vid === 'potvardi' ? 1 : 0, sent: null };
        TB.inflight[tid] = 1; saveTablo();
      },
      done: function (r) { delete TB.inflight[tid]; saveTablo(); renderCurrent(); if (r === 'sent') refillOpen(); },
      fail: function () { delete TB.inflight[tid]; saveTablo(); if (view === 'tablo') renderOpen(true); } });
  }
  function tOk(tid) {
    var t = tFind(tid); if (!t || !t.dni || UNDO['dc:' + tid]) return;
    var d = t.dni;
    dcStart(t, '✓ Отговорено', 'resheniq', { den_id: t.den_id, tochka_id: t.id, vid: 'potvardi', tekst: 'отговорено', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() + ' · табло' });
  }
  // „✎ Поясни“ от Таблото — същият лист; денят е известен от t.dni [К27]
  function tFix(tid) {
    var t = tFind(tid); if (!t || UNDO['dc:' + tid]) return;
    var d = t.dni || tDay(t) || {};
    openPoyasni(t, { id: t.den_id, obekt: d.obekt, data: d.data, versiq: d.versiq, hesh: d.hesh, status: d.status }, 'dc');
  }
  // С5: снимките на видимите карти в „Изисква решение“ — една заявка за всички (по msg_id от източниците) [§6.2]
  function phOpenLoad(sel, o) {
    if (!o || !o.items || offNow()) return;
    var dens = [], msgs = [], by = {};
    o.items.slice(0, o.all ? 107 : 5).forEach(function (t) {
      (t.izvori || []).forEach(function (s) { var m = srcMsg(s); if (m) { if (msgs.indexOf(m) < 0) msgs.push(m); (by[m] = by[m] || []).push(t.id); } });
      if (dens.indexOf(t.den_id) < 0) dens.push(t.den_id);
    });
    if (!msgs.length) return;
    api.phMsgs(dens, msgs).then(function (rows) {
      var ph = {};
      (rows || []).forEach(function (r) {
        normPh(r);
        (by[r.msg_id] || []).forEach(function (tid) {
          var t = o.items.filter(function (x) { return x.id === tid; })[0]; if (!t || t.den_id !== r.den_id) return;
          (ph[tid] = ph[tid] || []).push(r);
        });
      });
      Object.keys(ph).forEach(function (k) { ph[k].n = ph[k].length; });
      o.ph = ph;
      saveTablo();
      // първо подписът на миниатюрите (една заявка), после картите — иначе второ пречертаване с адресите
      var pats = [];
      Object.keys(ph).forEach(function (k) { ph[k].slice(0, 4).forEach(function (r) { if (r.pat_mini) pats.push(r.pat_mini); }); });
      var go2 = function () { if (sel === TB.sel && view === 'tablo') renderOpen(false, true); };   // скролнат надолу → чак при връщане горе [Е2-К11]
      if (!pats.length || DEMO) go2(); else sign(pats).then(go2, go2);
    }, function () {});
  }
  function dcPhOpen(tid, i) {
    var o = selState(TB.sel).open, l = o && o.ph ? o.ph[tid] : null, t = tFind(tid);
    if (!l || !l.length) return;
    openViewer(l, i, 'Решение · ' + clip(t ? t.tekst : '', 40), { a: 'dcPh', tid: tid, i: i });
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
    if (UNDO['dc:' + tid]) return;
    openPlus(null, { src: 'tablo', tid: t.id, den_id: t.den_id, tekst: t.tekst, o: d.obekt || null, d: d.data || null, close: !!t.dni, izvori: t.izvori || [] });
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
    var d = tDay(t);
    openSources(t, t.den_id, d.obekt || null);
  }
  // „+“ според екрана: от Таблото/Задачи денят е празен (обектът — от избора на Таблото; при „Всички“ — избор във формата)
  function plusCtx() { return view === 'tablo' ? { src: 'tablo', o: TB.sel } : view === 'deistviq' ? { src: 'acts' } : null; }

  // ---------- таб „Задачи“: 4 групи по това какво трябва да направиш ти; подробностите — в пила [§8.3, К32] ----------
  var ZF = [['all', 'Всички'], ['za_men', 'За мен'], ['vazlozhi', 'Възложени'], ['napomni', 'Напомняния'], ['sreshta', 'Срещи'], ['iskane', 'Искания']];
  function renderActsTab() {
    if (view !== 'deistviq') return;
    if (!$('#zad')) screen.innerHTML = scrHead('deistviq') + '<div id="zad" class="zad"></div>';
    var el = box('#zad'); if (!el) return;
    var all = zadRows(), f = S.zadF, rd = red('zad') === 'stari' ? 1 : -1, cnt = { all: 0 }, G = { q: [], wait: [], soon: [], move: [], done: [] };
    all.forEach(function (a) {
      var g = zadGroup(a);
      if (g !== 'done') { cnt.all++; cnt[a.vid] = (cnt[a.vid] || 0) + 1; }
      if (f !== 'all' && a.vid !== f) return;
      G[g].push(a);
    });
    function bySaz(x, y) { var a1 = String(x.sazdadeno || ''), b1 = String(y.sazdadeno || ''); return a1 < b1 ? -rd : a1 > b1 ? rd : 0; }
    G.q.sort(bySaz); G.wait.sort(bySaz); G.move.sort(bySaz);
    G.soon.sort(function (x, y) { return Date.parse(x.srok) - Date.parse(y.srok); });   // най-спешното първо — винаги
    G.done.sort(function (x, y) { var a1 = String(x.obnoveno || x.sazdadeno || ''), b1 = String(y.obnoveno || y.sazdadeno || ''); return a1 < b1 ? 1 : a1 > b1 ? -1 : 0; });
    var got = !!S.actsAt;
    var wait = got ? '' : offNow() ? '<p class="grp-e">📴 Задачите — когато има покритие.</p>'
      : S.actsErr ? '<div class="err">Задачите не се заредиха: ' + esc(errBg(S.actsErr)) + '</div><button type="button" class="btn ghost" data-a="refresh">Опитай пак</button>'
      : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам задачите…</p>';
    function ul(list) { return '<ul class="acts">' + list.map(actRow).join('') + '</ul>'; }
    function grp(t, sub, cls, list) {
      return list.length ? '<section class="zad-g ' + cls + '"><h3 class="at-h">' + t + ' <span class="at-n">' + list.length + '</span></h3>' + (sub ? '<p class="zad-s">' + sub + '</p>' : '') + ul(list) + '</section>' : '';
    }
    var done = G.done.slice(0, 30), any = G.q.length + G.wait.length + G.soon.length + G.move.length;
    el.innerHTML = '<div class="zad-top"><div class="zad-f" role="group" aria-label="Кои задачи">' + ZF.map(function (z) {
        var n = cnt[z[0]] || 0; if (z[0] !== 'all' && !n && f !== z[0]) return '';
        return '<button type="button" class="chip" data-a="zadF" data-v="' + z[0] + '" aria-pressed="' + (f === z[0]) + '">' + z[1] + ' <span class="cn">' + n + '</span></button>';
      }).join('') + '</div>' + redChip('zad') + '</div>' + wait +
      grp('⏳ На телефона — чакат връзка', 'тръгват сами, щом има покритие', 'pend', G.q) +
      grp('⚠️ Чака теб', 'не стана, ✎ допълни или не се записа — отвори и реши', 'warn', G.wait) +
      grp('🔔 До 48 ч и просрочени', 'най-спешното първо', 'soon', G.soon) +
      grp('⏳ В движение', 'нищо не чака теб — пилът казва докъде е стигнала', '', G.move) +
      (done.length ? '<details class="at-d gray" id="zad-done"' + (S.zadDone ? ' open' : '') + '><summary><span>✅ Приключени (последните ' + done.length + ')</span><span class="chev" aria-hidden="true">▾</span></summary>' + ul(done) + '</details>' : '') +
      (got && !any && !done.length ? '<p class="grp-e">' + (f === 'all' ? 'Още няма задачи. Натисни „+“.' : 'Няма такива задачи.') + '</p>' : '') +
      (got && !any && done.length ? '<p class="grp-e">✅ Нищо не е отворено' + (f === 'all' ? '' : ' от този вид') + '.</p>' : '');
  }

  // ---------- листът на една задача [§8.4] ----------
  var ZS = null;   // {id, confirm}
  function okZadUrl(u) { return /^https:\/\//.test(String(u || '')) || (DEMO && /^#demo-/.test(String(u || ''))); }
  function zadLink(u, lbl, cls) {
    if (DEMO && /^#demo-/.test(String(u))) return '<button type="button" class="' + cls + '" data-a="demoLink" data-k="intranet">' + lbl + '</button>';
    return '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + lbl + '</a>';
  }
  function danniOf(a) { var d = a.danni; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } } return d && typeof d === 'object' ? d : {}; }
  function zadFields(a) {
    var d = danniOf(a), o = objOf(a), out = [];
    if (o) out.push(['Обект', OBEKT[o][0]]);
    if (a.cel === 'intranet') {
      out.push(['Къде', 'Интранет']);
      if (d.manager) out.push(['Отговорник', d.manager.ime]);
      if (d.tema) out.push(['Тема', d.tema]);
      if (d.ekip && d.ekip.length) out.push(['Екип', d.ekip.map(function (p) { return p.ime; }).join(', ')]);
      out.push(['Приоритет', prioIme(d.prioritet || 'normal')]);
      if (d.kraen_srok) { var kd = parseD(d.kraen_srok); out.push(['Краен срок', DNI_K[kd.getDay()].toLowerCase() + ' ' + ddmm(kd) + '.' + kd.getFullYear()]); }
    } else if (a.cel === 'todo') {
      out.push(['Къде', 'To Do (Microsoft)']);
      if (a.srok) out.push(['Срок', cap(exact(new Date(a.srok)))]);
    } else if (a.vid === 'napomni') { if (a.srok) out.push(['Кога', cap(exact(new Date(a.srok)))]); }
    else if (a.vid === 'sreshta') {
      if (a.chovek) out.push(['С кого', a.chovek]);
      if (a.mqsto) out.push(['Къде', a.mqsto]);
      if (a.srok) out.push(['Кога', cap(exact(new Date(a.srok)))]);
      if (d.prodalzhitelnost_min) out.push(['Колко', (+d.prodalzhitelnost_min % 60 ? (+d.prodalzhitelnost_min / 60).toFixed(1).replace('.', ',') : +d.prodalzhitelnost_min / 60) + ' ч']);
    } else if (a.vid === 'iskane') {
      if (a.chovek) out.push(['До кого', a.chovek]);
      if (d.nishka) out.push(['Къде', d.nishka]);
      if (a.srok) out.push(['Отговор до', cap(exact(new Date(a.srok)))]);
    } else {
      if (a.chovek) out.push([a.vid === 'vazlozhi' ? 'На кого' : 'Кой', a.chovek]);
      if (a.mqsto) out.push(['Къде', a.mqsto]);
      if (a.srok) out.push(['Срок', cap(exact(new Date(a.srok)))]);
    }
    return out;
  }
  // веригата: „Заявено 27.09 18:02 → 🧪 проба 18:05: … → Вписано №7612 (18:20) → Изпълнено“ + отметките с резултата
  function zadChain(a) {
    var out = ['Заявено ' + (a.sazdadeno ? dm(a.sazdadeno) : '—') + (a._pend ? ' · на телефона, чака връзка' : '')];
    if (a.zamenq) out.push('Заменя задача №' + a.zamenq);
    // пробата е цялата в кутията „🧪 Готова — така ще я впиша“ горе — тук само кога
    if (isProba(a)) { var pm = /^🧪\s*проба\s+(\d{1,2}:\d{2})/.exec(a.belejka || ''); out.push((a.obnoveno ? dm(a.obnoveno) + ' · ' : '') + '🧪 проба' + (pm ? ' ' + pm[1] : '') + ' — виж горе'); }
    else if (a.belejka) out.push((a.obnoveno ? dm(a.obnoveno) + ' · ' : '') + a.belejka);
    if (a.status === 'vpisano') out.push('📤 Вписано в Интранета №' + (a.vanshen_id || '?'));
    if (a.status === 'izpalneno') out.push('✅ Изпълнено' + (a.obnoveno ? ' ' + dm(a.obnoveno) : ''));
    if (a.status === 'otmeneno') out.push(/замен/i.test(a.belejka || '') ? '✕ Заменено' : '✕ Отменено');
    if (typeof a.id === 'number') belOf(a.id).slice().sort(function (x, y) { return String(x.kogda || '') < String(y.kogda || '') ? -1 : 1; }).forEach(function (b) {
      var nm = b.vid === 'gotovo' ? '✓ Готово' : b.vid === 'otmeni' ? '✕ Отмени' : '📝 Лична бележка';
      out.push(nm + ' ' + (b.kogda ? dm(b.kogda) : '') + (b.vid === 'belejka' && b.tekst ? ': „' + clip(b.tekst, 200) + '“' : '') + ' · ' +
        (b._pend ? 'чака връзка' : b.rezultat ? b.rezultat : b.obraboteno ? 'обработено' : b.vid === 'belejka' ? 'записано в AiLab' : 'чака лаптопа'));
    });
    return out;
  }
  function openZad(id, live) {
    var a = zadFind(id);
    if (!a) { if (live) { ZS = null; closeSheet(); } else toast('Задачата вече я няма в списъка.'); return; }
    var conf = !!(live && ZS && ZS.confirm && ZS.id === String(a.id)), ZS0h = live && ZS && ZS.id === String(a.id) ? ZS.h : null;
    ZS = { id: String(a.id), confirm: conf };
    var v = VID[a.vid] || ['•', 'Задача'], s = stOf(a), lc = lokalClosed(a), g = zadGroup(a), num = typeof a.id === 'number';
    var over = g === 'soon' && a.srok && Date.parse(a.srok) < nowMs();
    // в самия лист пилът не се натиска → без „ ›“
    var h = '<p class="zd-t">' + esc(a.tekst) + '</p><div class="zd-p"><span class="pill ' + s[1] + '">' + esc(String(s[0]).replace(/\s*›\s*$/, '')) + '</span>' + (over ? '<span class="pill ' + ST.prosr[1] + '">' + ST.prosr[0] + '</span>' : '') + '</div>';
    var fl = zadFields(a);
    if (fl.length) h += '<dl class="zd-f">' + fl.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    if (a.razqsnenie) h += '<div class="zd-r"><b>Разяснение:</b> ' + esc(a.razqsnenie) + (a.cel === 'intranet' ? '<div class="small muted">Отива като първи коментар в задачата, когато решиш (въпрос към теб).</div>' : '') + '</div>';
    if (isProba(a)) h += '<div class="zd-proba"><b>🧪 Готова — така ще я впиша:</b><div>' + esc(String(a.belejka).replace(/^🧪\s*/, '')) + '</div><div class="small muted">В Интранета нищо не е изпратено — вписването започва след твоето „да“ в чата с Claude.</div></div>';
    h += '<div class="zd-ch"><div class="zd-chh">Докъде стигна</div><ol class="zd-chain">' + zadChain(a).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
    var b = '';
    if (a._q) {
      // ред, който още не е стигнал до облака: не е пратен → нищо не се отменя в базата [К20]
      b += (a._err ? '<p class="err">Базата отказа записа: ' + esc(a._err) + '</p><button type="button" class="btn" data-a="qretry" data-q="' + esc(a._qid) + '">Опитай пак</button>'
        : '<p class="small muted">Още не е пратена — тръгва сама, щом има покритие.</p>') +
        '<button type="button" class="btn ghost" data-a="zDrop" data-q="' + esc(a._qid) + '">Махни от телефона</button>';
    } else if (!num) {
      b += '<p class="small muted">Записана е — номерът ѝ идва при следващото обновяване; тогава тук ще са „Готово“, „Промени“ и „Отмени“.</p>';
    } else if (conf) {
      b += '<p class="warnline">Да я отменя ли? Лаптопът я затваря в AiLab' + (a.status === 'vpisano' ? ' — вписаната в Интранета отменяш там.' : '.') + '</p>' +
        '<button type="button" class="btn big" data-a="zOtmeniDa">Да, отмени задачата</button><button type="button" class="btn ghost" data-a="zOtmeniNe">Не</button>';
    } else {
      var open = OTV.indexOf(a.status) >= 0 || a.status === 'greshka', canEdit = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'greshka'].indexOf(a.status) >= 0;
      if (open && !lc) {
        if (a.status === 'dopalni') b += '<button type="button" class="btn big" data-a="zEdit">✎ Допълни</button>';
        b += '<button type="button" class="btn ' + (a.status === 'dopalni' ? 'ghost' : 'big') + '" data-a="zGotovo">Готово ✓</button>';
        if (a.status === 'vpisano' && okZadUrl(a.vanshen_url)) b += '<p class="small">В Интранета я отбележи като завършена ти: ' + zadLink(a.vanshen_url, 'отвори ›', 'lnk') + '</p>';
        if (canEdit && a.status !== 'dopalni') b += '<button type="button" class="btn ghost" data-a="zEdit">Промени</button>';
        if (canEdit) b += '<button type="button" class="btn ghost" data-a="zOtmeni">Отмени задачата</button>';
        if (a.status === 'vpisano') b += '<p class="small muted">Вписана в Интранета — промени я там.</p>';
      } else if (lc) b += '<p class="small muted">⏳ Отбелязано — лаптопът ще я затвори при следващото обработване.</p>';
      // лична бележка — остава в AiLab, никога не отива сама в Интранета [К17]
      b += '<button type="button" class="btn ghost" data-a="zBel">Лична бележка</button>';
      if (okZadUrl(a.vanshen_url)) b += zadLink(a.vanshen_url, 'Отвори в Интранета ›', 'btn ghost');
      if (a.tochka_id != null && a.den_id != null && objOf(a)) b += '<button type="button" class="btn ghost" data-a="zTochka">Към точката ›</button>';
    }
    h += '<div class="zd-b">' + b + '</div>';
    if (live && sheetKind === 'zad' && ZS0h === h) { ZS.h = h; return; }   // пречертаване само при промяна (скролът в листа остава)
    ZS.h = h;
    openSheet(v[0] + ' ' + (v[1] === 'Поискай информация' ? 'Искане за информация' : v[1]) + (num ? ' · №' + a.id : ''), h, 'zad');
  }
  function zadBelStart(a, vid, tekst) {
    ZS = null; closeSheet();
    var lbl = vid === 'gotovo' ? '✓ Готово' : vid === 'otmeni' ? '✕ Задачата е отменена' : '📝 Бележката е записана';
    var row = { deistvie_id: a.id, vid: vid, ustroistvo: device() };
    if (tekst) row.tekst = tekst;
    undoStart({ key: 'b:' + a.id + ':' + vid + ':' + Date.now().toString(36), kind: 'toast', lbl: lbl, tbl: 'deistviq_bel', row: row,
      redo: vid === 'belejka' ? function () { openBelejka(a, tekst); } : function () { openZad(a.id); },
      done: function () { renderCurrent(); } });
  }
  function openBelejka(a, text) {
    ZS = null;
    openSheet('📝 Лична бележка', '<p class="sh-q">' + esc(clip(a.tekst, 200)) + '</p>' +
      '<label class="fld">Бележка<textarea id="belT" rows="4" maxlength="1000" autofocus>' + esc(text || '') + '</textarea></label>' +
      '<p class="small muted">Остава в AiLab — не отива в Интранета и не я виждат колегите.</p>' +
      '<div class="sh-save"><div class="err" id="belE" hidden></div><button type="button" class="btn big" data-a="belSave" data-id="' + esc(a.id) + '">Запиши</button></div>', 'bel');
  }
  // „Промени“ / „Допълни“: формата, попълнена от реда → „Запиши“ = нов ред със zamenq (телефонът не променя редове) [§8.4]
  function zadEdit(a) {
    ZS = null; closeSheet();
    var o = objOf(a), d = danniOf(a), v = a.vid;
    P = { tid: a.tochka_id || null, tekst: a.tekst || '', t0: activeMs(), vid: null, ctx: { src: 'zad' }, o: o, oFix: !!o, den_id: a.den_id != null ? a.den_id : null,
      izvori: null, fs: {}, f: null, zamenq: a.id, avtori: [] };
    var tp = a.tochka_id && S.den && S.den.id === a.den_id ? findT(a.tochka_id) : null; if (tp) P.izvori = tp.izvori;
    var f = P.fs[v] = { _init: 1, razq: a.razqsnenie || '' };
    function dt(x) { return x ? new Date(x) : null; }
    if (v === 'za_men' || v === 'vazlozhi') {
      f.opis = clip(oneLine(a.tekst || '').trim(), 250); f.ekip = (d.ekip || []).map(function (p) { return { id: String(p.id), ime: p.ime }; });
      f.prio = d.prioritet || 'normal'; f.kraen = d.kraen_srok || null; f.kraenI = null; f.tema = d.tema || null; f.temaRuchno = !!d.tema; f.naTxt = a.chovek || '';
      f.na = d.manager ? { id: String(d.manager.id), ime: d.manager.ime } : null;
      if (v === 'za_men') { f.cel = a.cel === 'todo' ? 'todo' : 'intranet'; f.srok = a.cel === 'todo' ? dt(a.srok) : null; }
      if (!f.na && a.chovek) P.avtori = [a.chovek];   // старата заявка без данни: подсказка по „На кого“
    } else if (v === 'napomni') { f.kakvo = a.tekst; f.srok = dt(a.srok); }
    else if (v === 'sreshta') { f.tema = a.tekst; f.hora = (d.uchastnici || []).map(function (p) { return p.id ? { id: String(p.id), ime: p.ime } : { ime: p.ime }; }); if (!f.hora.length && a.chovek) f.hora = [{ ime: a.chovek }]; f.kade = a.mqsto || ''; f.srok = dt(a.srok); f.kolko = +d.prodalzhitelnost_min || 60; }
    else if (v === 'iskane') { f.kakvo = a.tekst; f.do = d.do ? { id: String(d.do.id), ime: d.do.ime } : (a.chovek ? { ime: a.chovek } : null); f.nishka = d.nishka || ''; f.izvor_vid = d.izvor_vid || null; f.kluch = d.kluch || null; f.srok = dt(a.srok); }
    spisaciLoad(false);
    plusPick(v);
  }

  // ---------- таб „Настройки“ — само на този телефон; нищо не пише в базата [§10, К7] ----------
  var NS = { mq: null, mqAt: 0, mqErr: null, busy: false };
  function showNastroiki() {
    setBodyO(TB.sel); setHash('#nastroiki');
    renderNastroiki(); window.scrollTo(0, 0);
    spisaciLoad(false);
    if (Date.now() - NS.mqAt > 36e5) mqLoad();
  }
  function mqLoad() {
    if (NS.busy || offNow() || (!DEMO && (!db || !user))) return;
    NS.busy = true;
    api.mqsto().then(function (r) { NS.busy = false; NS.mq = r; NS.mqAt = Date.now(); NS.mqErr = null; renderNastroiki(); },
      function (e) { NS.busy = false; NS.mqErr = e; NS.mqAt = Date.now(); renderNastroiki(); });
  }
  function nsSeg(k, cur, opts, lbl) {
    return '<div class="frm-seg n' + opts.length + '" role="radiogroup" aria-label="' + esc(lbl) + '">' + opts.map(function (o) {
      return '<button type="button" role="radio" data-a="nsSet" data-k="' + k + '" data-v="' + o[0] + '" aria-checked="' + (cur === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function nsCard(t, sub, body) { return '<section class="nas-c"><h2>' + t + '</h2>' + (sub ? '<p class="nas-s">' + sub + '</p>' : '') + body + '</section>'; }
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function mqHtml() {
    if (!NS.mq) {
      if (NS.mqErr) return '<p class="small muted">' + (isMissing(NS.mqErr) || NS.mqErr.code === 'PGRST202' ? 'Още не е готово в базата (лаптопът я обновява).' : isNet(NS.mqErr) ? '📴 Когато има покритие.' : 'Не се зареди: ' + esc(errBg(NS.mqErr))) + '</p>';
      return offNow() ? '<p class="small muted">📴 Когато има покритие.</p>' : '<p class="small muted"><span class="pulse" aria-hidden="true"></span> зареждам…</p>';
    }
    var b = +NS.mq.bajta || 0, n = +NS.mq.broi || 0, mb = b / 1048576, pr = Math.min(100, mb / 1024 * 100), warn = pr > 80;
    return '<div class="nas-mq' + (warn ? ' warn' : '') + '"><div>📷 <b>' + Math.round(mb) + ' MB</b> от 1 GB · ' + fmtN(n) + ' ' + pl(n, 'снимка', 'снимки') + '</div>' +
      '<div class="mq-bar" role="img" aria-label="' + esc(Math.round(pr) + ' % от 1 GB') + '"><i style="width:' + pr.toFixed(1) + '%"></i><em style="left:' + (900 / 1024 * 100).toFixed(1) + '%"></em></div>' +
      '<div class="small muted">Чертичката е 900 MB — там лаптопът спира да качва нови снимки.' + (warn ? ' <b class="amber">Над 80 % — време е да се реши какво да се чисти.</b>' : '') + '</div></div>';
  }
  function renderNastroiki() {
    if (view !== 'nastroiki') return;
    if (!$('#nas')) screen.innerHTML = scrHead('nastroiki') + '<div id="nas" class="nas"></div>';
    var el = box('#nas'); if (!el) return;
    var st = lget(K4.start) || 'posledno', tema = lget(K4.tema) || 'auto', zoom = lget(K4.zoom) || 'n';
    var az = S.deistviq.concat(TB.soon).reduce(function (m, a) { var x = a.obnoveno || ''; return x > m ? x : m; }, ''), sp = spObnoveno(), spOld = sp && nowMs() - Date.parse(sp) > 30 * 864e5;
    var h = nsCard('Обект при отваряне', 'За Таблото. Преглед отваря последния гледан обект.', nsSeg('start', st, [['posledno', 'Последен'], ['ag', 'Амур'], ['soft', 'Скай'], ['all', 'Всички']], 'Обект при отваряне'));
    h += nsCard('Подредба по дата', 'Всеки списък помни своята. Същият бутон стои и до самия списък.', ['resh', 'potok', 'dni', 'zad'].map(function (k) {
      return '<div class="nas-r"><span>' + esc(RED_IME[k]) + '</span>' + redChip(k) + '</div>'; }).join(''));
    h += nsCard('Тема', QS_TEMA ? 'Адресът задава тема (?theme=) — тя е с предимство.' : '', nsSeg('tema', tema, [['auto', 'Като телефона'], ['light', 'Светла'], ['dark', 'Тъмна']], 'Тема'));
    h += nsCard('Размер на текста', 'Уголемява само текста — бутоните и лентите остават на място.', nsSeg('zoom', zoom, [['n', 'Нормален'], ['l', 'По-голям'], ['xl', 'Най-голям']], 'Размер на текста'));
    h += nsCard('Как ми напомняш', 'Ще се реши — въпрос към теб', '<ol class="nas-l">' +
      '<li>To Do с напомняне <span class="muted">(иска разрешение в Microsoft)</span></li>' +
      '<li>Събитие с аларма в Outlook календара <span class="muted">(разрешение)</span></li>' +
      '<li>Известие от AiLab на телефона <span class="muted">(от иконата на началния екран; нужен е малък „изпращач“ в облака)</span></li>' +
      '<li>Само в сводката 07:30 / 16:30</li>' +
      '<li>Файл за календара на телефона <span class="muted">(.ics с аларма — без разрешение; ако пробата на iPhone мине)</span></li></ol>' +
      '<p class="small muted">Докато решиш: напомнянето се вижда в Табло и в значката на Задачи, без звън.</p>');
    h += nsCard('Свежест на източниците', '', freshHtml() +
      '<div class="nas-r2">Задачите: лаптопът ги обработи последно ' + (az ? '<b>' + esc(rel(az)) + '</b>' : '<span class="muted">— (още не)</span>') + '</div>' +
      '<div class="nas-r2' + (spOld ? ' amber' : '') + '">Списъкът с хора от Интранета: ' + (sp ? 'от <b>' + esc(rel(sp)) + '</b>' + (spOld ? ' — по-стар от 30 дни' : '') : '<span class="muted">' + (SPL.st === 'missing' ? 'още не е качен (лаптопът)' : 'още не е зареден') + '</span>') + '</div>');
    h += nsCard('Място за снимки', '', mqHtml());
    h += nsCard('Версия и данни', '', '<ul class="nas-v"><li>AiLab · Етап 4 · кеш ailab-e5-v1</li><li>Данни към ' + esc(TB.at ? rel(TB.at) : '—') + '</li><li>Чакат връзка: ' + pendingCount() + '</li>' +
      '<li>' + (isStandalone() ? 'Инсталирано като иконка ✓' : 'Съвет: в Safari натисни <b>Сподели ⬆</b> → <b>Добави към началния екран</b>.') + '</li></ul>');
    h += nsCard('Още', '', '<div class="nas-b">' + (DEMO ? '' : '<button class="btn ghost" type="button" data-a="karti">🔎 Карти и търсене (Етап 0)</button>') + (DEMO ? demoPanel() : '') +
      (DEMO ? '<a class="btn ghost" href="./">Изход от демото</a>' : '<button class="btn ghost" type="button" data-a="logout">Изход</button>') + '</div>');
    el.innerHTML = h;
  }
  function nsSet(k, v) {
    if (k === 'start') lset(K4.start, v === 'posledno' ? '' : v);
    else if (k === 'tema') { lset(K4.tema, v === 'auto' ? '' : v); applyLook(); }
    else if (k === 'zoom') { lset(K4.zoom, v); applyLook(); }
    renderNastroiki();
  }

  // ---------- всички натискания ----------
  function pcPhOpen(tid, i) {
    var t = findT(tid), l = t ? tPhotos(t) : null;
    if (l && l.length) openViewer(l, i, 'Точка · ' + clip(t.tekst, 40), { a: 'pcPh', tid: tid, i: i });
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el || el.disabled) return;
    var a = el.getAttribute('data-a'), tid = +el.getAttribute('data-tid') || null, pk = el.getAttribute('data-pk');
    if (S.seenPend && view === 'day' && S.den && S.den.id === S.seenPend && a !== 'tab') { var sp0 = S.seenPend; S.seenPend = null; send('metriki', { vid: 'pregled_otvoren', stoinost: 1, den_id: sp0 }).catch(function () {}); }
    switch (a) {
      case 'scrim': if (e.target === el) closeSheet(); break;
      case 'close': closeSheet(); break;
      case 'day': commitUndos(); openDay(+el.getAttribute('data-id')); break;
      case 'fresh': openFresh(); break;
      case 'jump': jump(el.getAttribute('data-g')); break;
      case 'src': openSrc(tid); break;
      case 'ref': openRef(el.getAttribute('data-n')); break;
      // Етап 4 — Преглед
      case 'ok': pcOk(tid); break;
      case 'seen': pcSeen(tid); break;
      case 'dn': pcDn(tid); break;
      case 'seenAll': pcSeenAll(el.getAttribute('data-g')); break;
      case 'fix': { var tf = findT(tid); if (tf && S.den && !UNDO['pc:' + tid]) openPoyasni(tf, S.den, 'pc'); } break;
      case 'act': if (!UNDO['pc:' + tid]) openPlus(tid); break;
      case 'undo': undoCancel(el.getAttribute('data-k')); break;
      case 'revGrp': { var gk = el.getAttribute('data-g'); S.revOpen[gk] = !S.revOpen[gk]; keepAnchor(renderGroups); } break;
      case 'revCard': S.revCard[tid] = !S.revCard[tid]; keepAnchor(renderGroups); break;
      case 'pcPh': pcPhOpen(tid, +el.getAttribute('data-i') || 0); break;
      case 'nextRev': nextRev(); break;
      case 'red': redToggle(el.getAttribute('data-k')); break;
      case 'pyMode': pyMode(el.getAttribute('data-m')); break;
      case 'pySave': pySave(); break;
      // „+“ и формите
      case 'plus': openPlus(null, plusCtx()); break;
      case 'pick': if (P) plusPick(el.getAttribute('data-v')); break;
      case 'plusBack': if (P) { P.vid = null; renderPlusChooser(); } break;
      case 'srok': pickSrok(el); break;
      case 'kraen': if (P && P.f) { var kc = kraenChips()[+el.getAttribute('data-i')]; if (kc) { P.f.kraen = kc[1]; P.f.kraenI = +el.getAttribute('data-i'); var ki = sheetEl && sheetEl.querySelector('[data-f="kraen"]'); if (ki) ki.value = kc[1]; plusSync(); } } break;
      case 'fSeg': if (P && P.f) { var fk = el.getAttribute('data-k'), fv = el.getAttribute('data-v'); P.f[fk] = fk === 'kolko' ? +fv : fv; if (fk === 'cel') lset(K4.cel, fv); renderPlusForm(true); } break;
      case 'fObekt': if (P && P.f) { P.o = el.getAttribute('data-v'); if (!P.f.temaRuchno) P.f.tema = null; renderPlusForm(true); } break;
      case 'plusSave': savePlus(); break;
      case 'plusDraft': savePlus('draft'); break;
      case 'plusTodo': savePlus('todo'); break;
      case 'pkPick': pkAdd(pk, pkPerson(el.getAttribute('data-id'))); break;
      case 'pkFree': { var pq = sheetEl && sheetEl.querySelector('[data-pks="' + pk + '"]'), pv = pq ? pq.value.trim() : ''; if (pv) pkAdd(pk, { ime: clip(pv, 120) }); } break;
      case 'pkDel': pkDel(pk, el.getAttribute('data-i')); break;
      // източници
      case 'srcFull': srcFullT(+el.getAttribute('data-si')); break;
      case 'srcRetry': srcRetry(); break;
      case 'copyTema': copyTema(+el.getAttribute('data-si')); break;
      case 'okolo': okoloT(+el.getAttribute('data-si')); break;
      case 'okoloFull': okoloFull(+el.getAttribute('data-si'), el.getAttribute('data-k')); break;
      case 'iskSrc': iskSrc(+el.getAttribute('data-si')); break;
      case 'iskGo': iskGo(el, e); break;
      case 'iskUndo': iskUndo(); break;
      case 'demoLink': e.preventDefault(); { var dk = el.getAttribute('data-k'); toast(dk === 'teams' ? 'В демото няма истински Тиймс' : dk === 'intranet' ? 'В демото няма истински Интранет' : 'В демото няма OneDrive'); } break;
      // задачи
      case 'zad': openZad(el.getAttribute('data-id')); break;
      case 'zadF': S.zadF = el.getAttribute('data-v') || 'all'; renderActsTab(); break;
      case 'zGotovo': { var zg = ZS && zadFind(ZS.id); if (zg) zadBelStart(zg, 'gotovo'); } break;
      case 'zOtmeni': if (ZS) { ZS.confirm = true; openZad(ZS.id, true); } break;
      case 'zOtmeniNe': if (ZS) { ZS.confirm = false; openZad(ZS.id, true); } break;
      case 'zOtmeniDa': { var zo = ZS && zadFind(ZS.id); if (zo) zadBelStart(zo, 'otmeni'); } break;
      case 'zEdit': { var ze = ZS && zadFind(ZS.id); if (ze) zadEdit(ze); } break;
      case 'zBel': { var zb = ZS && zadFind(ZS.id); if (zb) openBelejka(zb, ''); } break;
      case 'belSave': { var bt = (($('#belT') && $('#belT').value) || '').trim(), ba = zadFind(el.getAttribute('data-id')); if (!bt) { var be = $('#belE'); be.textContent = 'Напиши бележката.'; be.hidden = false; break; } if (ba) zadBelStart(ba, 'belejka', bt); } break;
      case 'zTochka': { var zt = ZS && zadFind(ZS.id); if (zt) { ZS = null; closeSheet(); goDay(objOf(zt), zt.den_id, zt.tochka_id); } } break;
      case 'zDrop': dropQ(el.getAttribute('data-q')); ZS = null; closeSheet(); renderCurrent(); toast('Махнато от телефона — не е пратено никъде.'); break;
      // настройки
      case 'nsSet': nsSet(el.getAttribute('data-k'), el.getAttribute('data-v')); break;
      case 'approve': openApprove(); break;
      case 'approveGo': doApprove(el); break;
      case 'reload': closeSheet(); reloadDen(); break;
      case 'qerr': openErrSheet(); break;
      case 'qretry': qRetry(el.getAttribute('data-q')); break;
      case 'qdrop': qDrop(el.getAttribute('data-q')); break;
      case 'karti': S.kartiFrom = view === 'karti' ? S.kartiFrom : view; viewKarti(); break;
      case 'back': go(VIEWS[S.kartiFrom] ? S.kartiFrom : 'nastroiki', { force: true }); break;
      case 'logout': logout(); break;
      case 'retry': if (view === 'day') boot(S.den ? S.den.id : null); else routeStart(); break;
      case 'dNew': closeSheet(); demoNewVersion(); break;
      case 'dOff': demoToggleOff(el); break;
      case 'dReset': demoReset(); break;
      case 'dZad': closeSheet(); demoZadachi(); break;
      case 'dVpisva': closeSheet(); demoVpisva(); break;
      case 'dLose': D.loseNext = !D.loseNext; el.setAttribute('aria-pressed', String(D.loseNext)); el.textContent = demoLoseLbl(); break;
      case 'dHide': closeSheet(); demoHide(); break;
      case 'dSp': demoSpisaci(el); break;
      // Етап 2
      case 'tab': go(el.getAttribute('data-v')); break;
      case 'refresh': refreshCurrent(); break;
      case 'tSel': tSel(el.getAttribute('data-v')); break;
      case 'tOk': tOk(tid); break;
      case 'tFix': tFix(tid); break;
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
      case 'dObekt': commitUndos(); dSwitchObekt(); break;
      // Етап 3 — снимки
      case 'ph': phOpen(+el.getAttribute('data-i') || 0); break;
      case 'phMore': phMore(); break;
      case 'phRetry': phRetry(); break;
      case 'phJump': S.phOpen = true; renderPh(); jump('ph'); break;
      case 'srcPh': srcPhOpen(el.getAttribute('data-msg'), +el.getAttribute('data-i') || 0); break;
      case 'dcPh': dcPhOpen(tid, +el.getAttribute('data-i') || 0); break;
      case 'tPh': tPhOpen(+el.getAttribute('data-den') || null, +el.getAttribute('data-sid') || null); break;
      case 'tPhMore': { var po = el.getAttribute('data-o'), pd = +el.getAttribute('data-den') || null; if (pd && (po === 'ag' || po === 'soft')) goDay(po, pd, null, true); } break;
      case 'pvPrev': pvStep(-1); break;
      case 'pvNext': pvStep(1); break;
      case 'pvClose': closeViewer(); break;
    }
  });
  // полетата на формите → P.f без пречертаване (фокусът и клавиатурата остават)
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-f')) formInput(t);
    else if (t.getAttribute('data-pks')) pkResults(t.getAttribute('data-pks'));
    else if (t.id === 'pyT') pyCount();
    else if ((t.id === 'pfD' || t.id === 'pfH') && P && P.f) fromInputs();
  });
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.getAttribute) return;
    if ((t.id === 'pfD' || t.id === 'pfH') && P && P.f) fromInputs();
    else if (t.getAttribute('data-f')) formInput(t);
    else if (t.getAttribute('data-ch') === 'feedOt') feedOtSet(t.value);
  });
  // лист с форма на iPhone: фокусираното поле — във видимото над клавиатурата [К31]; търсенето показва резултати при фокус
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || !t.closest || !sheetEl || !sheetEl.contains(t)) return;
    if (t.getAttribute('data-pks')) pkResults(t.getAttribute('data-pks'));
    if (t === QF) return;   // фокусът е върнат след пречертаване — полето вече е на мястото си
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (sheetKind === 'form' || sheetKind === 'py' || sheetKind === 'bel')) setTimeout(function () { if (document.activeElement === t) { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} } }, 320);
  });
  // отложеното пречертаване на формата (P.redo) — чак когато РП спре да пише и не натиска нищо (иначе тапът би „изчезнал“)
  var PDOWN = false;
  document.addEventListener('pointerdown', function () { PDOWN = true; }, true);
  document.addEventListener('pointerup', function () { setTimeout(function () { PDOWN = false; }, 0); }, true);
  document.addEventListener('pointercancel', function () { PDOWN = false; }, true);
  document.addEventListener('focusout', function (e) {
    if (!P || !P.redo || sheetKind !== 'form' || !sheetEl || !sheetEl.contains(e.target)) return;
    setTimeout(function () { if (P && P.redo && sheetKind === 'form' && !sheetTyping() && !PDOWN) renderPlusForm(true); }, 450);
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target; if (!t || !t.getAttribute || !t.getAttribute('data-pks')) return;
    var pk = t.getAttribute('data-pks');
    setTimeout(function () {
      var r = document.getElementById('pkR-' + pk), ae = document.activeElement;
      if (r && !(ae && ae.closest && ae.closest('.pick[data-pk="' + pk + '"]'))) r.hidden = true;
    }, 260);
  });
  document.addEventListener('keydown', function (e) {
    if (PV && pvKey(e)) return;   // прегледът е над листа: Esc затваря първо него [К28]
    if (e.key === 'Escape' && sheetEl) { closeSheet(); return; }
    var t = e.target;
    // описанието за Интранета е един ред: Enter = „готово“ (enterkeyhint="done")
    if (e.key === 'Enter' && t && t.getAttribute && (t.getAttribute('data-one') || t.getAttribute('data-pks') || (t.tagName === 'INPUT' && t.getAttribute('data-f')))) {
      e.preventDefault();
      if (t.getAttribute('data-pks')) { var r = document.getElementById('pkR-' + t.getAttribute('data-pks')), b1 = r && r.querySelector('.pk-i'); if (b1 && r.querySelectorAll('.pk-i').length === 1) { b1.click(); return; } }
      t.blur(); return;
    }
    // колоните на графиката са role="button" (SVG) — Enter/Space избира деня
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('data-a') && t.tagName !== 'BUTTON') {
      e.preventDefault();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  document.addEventListener('toggle', function (e) {
    var id = e.target && e.target.id;
    if (id === 'fullD') S.fullOpen = e.target.open;
    else if (id === 'zad-done') S.zadDone = e.target.open;
    else if (id === 'phD' && S.phOpen !== e.target.open) { S.phOpen = e.target.open; renderPh(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { commitUndos(); if (view === 'tablo') seenWrite(); return; }   // „Отмени“ не чака скрито приложение (първо опашката [К22])
    if (liveQ().length && !offNow()) flush();   // записите, влезли в опашката при скриването, тръгват при връщане
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
    // Етап 4: списъкът с хора, „последно избирани“, „✓ Видях“ (и вариантите _demo) — без темата и размера (те са на устройството)
    [K4.sp, K4.hora, K4.vid, K4.cel, K4.start].concat(Object.keys(RED_K).map(function (k) { return RED_K[k]; })).forEach(function (k) { try { localStorage.removeItem(k); localStorage.removeItem(k + '_demo'); } catch (e) {} });
    SPL.rows = null; SPL.at = 0; SPL.st = ''; SAOB = {}; S.bel = []; NS.mq = null; NS.mqAt = 0;
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
    screen.innerHTML = '<button type="button" class="back" data-a="back">← Назад</button><h1>Карти (Етап 0)</h1>' +
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
    if (!db) { var c0 = readCache(); if (c0) { stamp('без покритие · ' + c0.at, true); renderCards(c0, true); } else screen.innerHTML = '<button type="button" class="back" data-a="back">← Назад</button><p class="muted">Картите искат покритие.</p>'; return; }
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
      else { stamp('без връзка', true); screen.innerHTML = '<button type="button" class="back" data-a="back">← Назад</button><h1>Няма връзка</h1><p class="muted">Отвори картите, когато има покритие.</p>'; }
    });
  }

  // ---------- ДЕМО (?demo=1): вградени примерни данни, „лаптоп“, който отговаря след ~6 с ----------
  // Само измислени данни: роли вместо имена („доставчикът на арматура“, „надзорът“, „проектантът“…), без суми в пари.
  function demoLoseLbl() { return 'Следващият запис: изгубен отговор — ' + (D && D.loseNext ? 'вкл.' : 'изкл.'); }
  function demoButtons() {
    return '<div class="demo-b"><button type="button" class="btn ghost" data-a="dDay">Лаптопът качва нов ден</button>' +
      (view === 'day' ? '<button type="button" class="btn ghost" data-a="dNew">Лаптопът качва нова версия</button>' : '') +
      '<button type="button" class="btn ghost" data-a="dZad">Лаптопът обработва задачите (проба)</button>' +
      '<button type="button" class="btn ghost" data-a="dVpisva">Лаптопът вписва (демо)</button>' +
      '<button type="button" class="btn ghost" data-a="dOff" aria-pressed="' + S.forceOff + '">Без покритие: ' + (S.forceOff ? 'вкл.' : 'изкл.') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dLose" aria-pressed="' + !!(D && D.loseNext) + '">' + demoLoseLbl() + '</button>' +
      '<button type="button" class="btn ghost" data-a="dHide">Телефонът се заключва (скриване)</button>' +
      '<button type="button" class="btn ghost" data-a="dSp">Изчисти списъка с хора на телефона</button>' +
      '<button type="button" class="btn ghost" data-a="dReset">Започни демото отначало</button></div>';
  }
  function demoPanel() {
    return '<section class="demo"><div class="demo-h">Демо режим · примерни данни</div>' +
      '<p>Нищо не отива в облака. Часовникът е спрян на 24.09, 17:42; „лаптопът“ отговаря около 6 с след решение, а задачите обработва с бутона тук.</p>' + demoButtons() + '</section>';
  }
  function openDemoSheet() {
    if (!DEMO) return;
    openSheet('Демо режим', '<p>Примерни данни — нищо не отива в облака. Часовникът е спрян на 24.09, 17:42; „лаптопът“ отговаря около 6 с след решение, а задачите обработва с бутона.</p>' +
      demoButtons() + '<a class="btn ghost" href="./">Изход от демото</a>', 'demo');
  }
  // отначало: и отметките „✓ Видях“, „последно избирани“ и изборът To Do/Интранет на демото (подредбата, темата и размерът остават)
  function demoReset() {
    ['ailab_e4_vidyano', 'ailab_e4_hora', 'ailab_e4_za_men_cel'].forEach(function (k) { try { localStorage.removeItem(k + '_demo'); } catch (e) {} });
    try { location.replace(location.pathname + location.search); } catch (e) { location.reload(); }
  }
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
          r: D.resheniq.filter(function (r) { return ids.indexOf(r.den_id) >= 0 && ANSW[r.vid] && r.tochka_id != null; }).map(function (r) { return pick(r, 'den_id,tochka_id,vid'); })
        };
      });
    },
    den: function (id) { return later(function () { return dDen(id); }); },
    head: function (id) { return later(function () { var d = dDen(id); return d ? pick(d, 'id,versiq,status,hesh,obnoven,vpisan_pat') : null; }); },
    tochki: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).sort(function (a, b) { return a.red - b.red || a.id - b.id; }); }); },
    istini: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).map(function (t) { return pick(t, 'id,istina'); }); }); },
    res: function (id) { return later(function () { return D.resheniq.filter(function (r) { return r.den_id === id; }); }); },
    svezhest: function () { return later(function () { return D.svezhest.map(function (s) { return pick(s, 'izvor,posledno,ok,broi,belejka'); }); }); },
    // 7а (отворените + грешките) · 7б (последните 30 приключени) · 8 (отметките) — като истинските [К9]
    deistviq: function () {
      return later(function () {
        var c = actCols(), open = OTV.concat(['greshka']);
        var a = D.deistviq.filter(function (x) { return open.indexOf(x.status) >= 0; }).sort(function (x, y) { return x.sazdadeno < y.sazdadeno ? 1 : -1; }).slice(0, 500);
        var b = D.deistviq.filter(function (x) { return x.status === 'izpalneno' || x.status === 'otmeneno'; }).sort(function (x, y) { return String(x.obnoveno || '') < String(y.obnoveno || '') ? 1 : -1; }).slice(0, 30);
        return { rows: a.concat(b).map(function (x) { return pick(x, c); }), bel: D.deistviq_bel.slice().sort(function (x, y) { return x.kogda < y.kogda ? 1 : -1; }).slice(0, 200).map(function (x) { return pick(x, BEL_COLS); }) };
      });
    },
    dayActs: function (id) { return later(function () { return D.deistviq.filter(function (x) { return x.den_id === id; }).map(function (x) { return pick(x, actCols()); }); }); },
    // като базата: повторен klient_id → 23505 [К1]; „изгубен отговор“ (демо панел) — записът е в базата, отговорът не стига
    insert: function (tbl, row) {
      return later(function () { var r = demoInsert(tbl, row); return tbl === 'deistviq' && r ? [{ id: r.id }] : null; }, 220).then(function (v) {
        if (D.loseNext && tbl !== 'metriki') {
          D.loseNext = false;
          Array.prototype.forEach.call(document.querySelectorAll('[data-a="dLose"]'), function (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = demoLoseLbl(); });
          setTimeout(function () { toast('Демо: покритието се върна — опашката тръгва пак'); S.offline = false; flush().then(function () { renderCurrent(); stampNow(); }); }, 2500);
          throw { message: 'TypeError: Load failed', code: '' };
        }
        return v;
      });
    },
    tDni: function () { return later(function () { return D.dni.filter(function (x) { return x.data >= TEST_DO; }).sort(dSort).slice(0, 400).map(function (x) { return pick(x, 'id,obekt,data,status,versiq,hora,obnoven'); }); }); },
    tOpen: function (sel, rg, old) {
      return later(function () {
        var st = red('resh') === 'stari' ? 1 : -1;
        var all = D.tochki.filter(function (t) {
          if (t.grupa !== 'reshenie') return false;
          var d = dDen(t.den_id); if (!d) return false;
          if (old ? !(d.data < RESH_OT && d.data >= TEST_DO) : !(d.data >= RESH_OT)) return false;
          if (sel !== 'all' && d.obekt !== sel) return false;
          if (D.resheniq.some(function (r) { return r.tochka_id === t.id && CLOSE_VID[r.vid]; })) return false;   // resheniq=is.null
          if (D.deistviq.some(function (a) { return a.tochka_id === t.id && CLOSES_DEI.indexOf(a.status) >= 0; })) return false;   // отменена задача не затваря [К11]
          return true;
        }).sort(function (a, b) {
          var da = dDen(a.den_id).data, dz = dDen(b.den_id).data;
          return (b.vajnost || 1) - (a.vajnost || 1) || (da < dz ? -st : da > dz ? st : 0) || (a.red || 0) - (b.red || 0) || a.id - b.id;
        });
        return { data: all.slice(rg[0], rg[1] + 1).map(function (t) {
          var r = pick(t, FEED_COLS); r.dni = pick(dDen(t.den_id), 'obekt,data,status,versiq,hesh,obnoven'); r.resheniq = []; r.deistviq = []; return r;
        }), count: all.length };
      });
    },
    tSoon: function () {
      return later(function () {
        var lim = nowMs() + 48 * 36e5;
        return D.deistviq.filter(function (a) { return (OTV.indexOf(a.status) >= 0 && a.srok && Date.parse(a.srok) <= lim) || CHAKA_TEB.indexOf(a.status) >= 0; })
          .sort(function (a, b) { return (b.srok ? Date.parse(b.srok) : -1e15) - (a.srok ? Date.parse(a.srok) : -1e15); }).slice(0, SOON_MAX).map(function (a) { return pick(a, actCols()); });
      });
    },
    tOdobri: function () { return later(function () { return D.resheniq.filter(function (r) { return r.vid === 'odobri' && !r.obraboteno; }).slice(0, 100).map(function (r) { return pick(r, 'den_id,versiq'); }); }); },
    tFeed: function (ids) {
      return later(function () {
        return D.tochki.filter(function (t) { return t.grupa === 'promqna' && ids.indexOf(t.den_id) >= 0; })
          .sort(function (a, b) { return (b.vajnost || 1) - (a.vajnost || 1) || (a.red || 0) - (b.red || 0) || a.id - b.id; }).slice(0, 150).map(function (t) { return pick(t, FEED_COLS); });
      });
    },
    // Снимки — същата форма и подредба като истинските (С1, С2, С3, С5)
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
    },
    phMsgs: function (denIds, msgIds) {
      return later(function () { return D.snimki.filter(function (s) { return denIds.indexOf(s.den_id) >= 0 && msgIds.indexOf(s.msg_id) >= 0; }).sort(phSort).slice(0, 300).map(function (s) { return pick(s, 'id,den_id,msg_id,vreme,n,pat,pat_mini,shirina,visochina,avtor'); }); });
    },
    // Етап 4: съобщенията, съседните, файловете, списъците, мястото за снимки
    saob: function (obekt, keys) { return later(function () { return D.saobshteniq.filter(function (r) { return keys.indexOf(r.kluch) >= 0 && (!obekt || r.obekt === obekt); }).slice(0, 40).map(function (r) { return pick(r, SAOB_COLS); }); }); },
    saobOkolo: function (den, izvor, t) {
      return later(function () {
        var l = D.saobshteniq.filter(function (r) { return r.den_id === den && r.izvor === izvor; });
        var pr = l.filter(function (r) { return r.vreme < t; }).sort(function (a, b) { return a.vreme < b.vreme ? 1 : -1; }).slice(0, 3).reverse();
        var sl = l.filter(function (r) { return r.vreme > t; }).sort(function (a, b) { return a.vreme < b.vreme ? -1 : 1; }).slice(0, 3);
        function p(r) { return pick(r, 'id,kluch,vreme,avtor,tekst,tema'); }
        return { pred: pr.map(p), sled: sl.map(p) };
      });
    },
    saobFiles: function (den) { return later(function () { return D.saobshteniq.filter(function (r) { return r.den_id === den && r.failove && r.failove.length; }).map(function (r) { return pick(r, 'den_id,kluch,failove'); }); }); },
    spisaci: function () { return later(function () { return D.intranet_spisaci.map(function (r) { return pick(r, SP_COLS); }); }); },
    mqsto: function () { return later(function () { return { broi: 1468, bajta: 261095424 }; }); }
  };
  // като истинската база: външните ключове се проверяват (23503), klient_id е уникален (23505), часът от телефона се пази
  function demoFk(tbl, col, v, ref) {
    return { code: '23503', message: 'insert or update on table "' + tbl + '" violates foreign key constraint "' + tbl + '_' + col + '_fkey"', details: 'Key (' + col + ')=(' + v + ') is not present in table "' + ref + '".' };
  }
  function demoInsert(tbl, row) {
    var T = tbl === 'resheniq' ? D.resheniq : tbl === 'deistviq' ? D.deistviq : tbl === 'deistviq_bel' ? D.deistviq_bel : null;
    if (T && row.klient_id && T.some(function (x) { return x.klient_id === row.klient_id; }))
      throw { code: '23505', message: 'duplicate key value violates unique constraint "' + tbl + '_klient_id_key"', details: 'Key (klient_id)=(' + row.klient_id + ') already exists.' };
    if (row.den_id != null && !D.dni.some(function (x) { return x.id === row.den_id; })) throw demoFk(tbl, 'den_id', row.den_id, 'dni');
    if (row.tochka_id != null && !D.tochki.some(function (x) { return x.id === row.tochka_id; })) throw demoFk(tbl, 'tochka_id', row.tochka_id, 'tochki');
    if (tbl === 'deistviq_bel' && !D.deistviq.some(function (x) { return x.id === row.deistvie_id; })) throw demoFk(tbl, 'deistvie_id', row.deistvie_id, 'deistviq');
    var r = Object.assign({ id: ++D.seq }, row);
    if (tbl === 'resheniq') { r.kogda = row.kogda || nowIso(); r.obraboteno = null; r.rezultat = null; D.resheniq.push(r); }
    else if (tbl === 'deistviq') { r.status = 'zaqveno'; r.sazdadeno = row.sazdadeno || nowIso(); r.obnoveno = null; r.belejka = null; r.vanshen_id = null; r.vanshen_url = null; r.opit = null; D.deistviq.push(r); return r; }
    else if (tbl === 'deistviq_bel') { r.kogda = row.kogda || nowIso(); r.obraboteno = null; r.rezultat = null; D.deistviq_bel.push(r); return r; }
    else if (tbl === 'metriki') { r.kogda = row.kogda || nowIso(); D.metriki.push(r); return r; }
    else throw { message: 'непозната таблица', code: 'DEMO' };
    if (!D.lt) D.lt = setTimeout(function () { D.lt = 0; demoLaptop(); }, 6000);
    return r;
  }
  // Като ailab-rabotnik.ps1: одобрения и потвърждения се обработват; задачите — отделно (demoZadachi, от демо панела).
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
      } else { r.rezultat = 'чака Claude'; return; }   // като ailab-rabotnik: поправките и разясненията остават необработени за Claude
      r.obraboteno = t;
    });
  }
  // Като ailab-zadachi.ps1 в режим ПРОБА (§9.3.2), в твърдия ред [К3]: отмени/готово → замени → преходи в AiLab → Интранет последен.
  // Нищо не отива в Интранета — „🧪 готова — така ще я впиша“ с всички полета.
  function demoZadachi() {
    var t = nowIso(), hm0 = hhmm(), n = { proba: 0, dop: 0, resh: 0, razr: 0, otm: 0, izp: 0, gr: 0, bel: 0 };
    var NV = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'greshka'];
    function byId(id) { return D.deistviq.filter(function (a) { return a.id === id; })[0] || null; }
    function note(a, b) { a.belejka = b; a.obnoveno = t; }
    D.deistviq_bel.filter(function (b) { return !b.obraboteno && (b.vid === 'gotovo' || b.vid === 'otmeni'); }).sort(function (x, y) { return x.id - y.id; }).forEach(function (b) {
      var a = byId(b.deistvie_id); b.obraboteno = t; n.bel++;
      if (!a) { b.rezultat = 'задачата я няма'; return; }
      if (b.vid === 'gotovo') {
        if (OTV.indexOf(a.status) >= 0 || a.status === 'greshka') { a.status = 'izpalneno'; a.obnoveno = t; n.izp++; b.rezultat = a.vanshen_id ? 'отбелязано в AiLab; в Интранета я маркирай като завършена ти' : 'отбелязано като изпълнена'; }
        else b.rezultat = 'вече е приключена';
      } else if (NV.indexOf(a.status) >= 0) { a.status = 'otmeneno'; a.obnoveno = t; n.otm++; b.rezultat = 'отменена'; }
      else if (a.status === 'vpisano') b.rezultat = 'вписана в Интранета като №' + a.vanshen_id + ' — AiLab не трие; отмени я там';
      else b.rezultat = 'вече е приключена';
    });
    D.deistviq.filter(function (y) { return y.status === 'zaqveno' && y.zamenq; }).forEach(function (y) {
      var x = byId(y.zamenq); if (!x) return;
      if (NV.indexOf(x.status) >= 0) { x.status = 'otmeneno'; note(x, 'заменена от №' + y.id); n.otm++; }
      else if (x.status === 'vpisano') { y.status = 'greshka'; note(y, '№' + x.id + ' вече е в Интранета (№' + x.vanshen_id + ') — промени я там; AiLab не пипа вписани задачи'); n.gr++; }
    });
    D.deistviq.filter(function (a) { return a.status === 'zaqveno'; }).forEach(function (a) {
      if ((a.vid === 'za_men' || a.vid === 'vazlozhi') && !a.cel) { a.status = 'dopalni'; note(a, 'липсват данни за Интранета — отвори я в Задачи → Допълни'); n.dop++; }
      else if (a.cel === 'todo') { a.status = 'chaka_razreshenie'; note(a, 'To Do иска разрешение Tasks.ReadWrite (още не е дадено)'); n.razr++; }
      else if (a.vid === 'napomni' || a.vid === 'sreshta' || a.vid === 'iskane') { a.status = 'chaka_reshenie'; note(a, 'начинът още не е решен (въпрос към РП)'); n.resh++; }
    });
    var hora = D.intranet_spisaci.filter(function (r) { return r.vid === 'chovek' && r.aktiven !== false; });
    D.deistviq.filter(function (a) { return a.status === 'zaqveno' && a.cel === 'intranet' && !a.opit && !D.deistviq.some(function (y) { return y.zamenq === a.id && y.status !== 'otmeneno'; }); }).forEach(function (a) {
      var d = a.danni || {}, err = '', tx = oneLine(a.tekst || '').trim();
      function inL(id) { return hora.some(function (h) { return h.stoinost === String(id); }); }
      if (!d.manager || !inL(d.manager.id)) err = 'отговорникът го няма в списъка на Интранета';
      else if ((d.ekip || []).some(function (p) { return !inL(p.id); })) err = 'човек от екипа го няма в списъка на Интранета';
      else if (!D.intranet_spisaci.some(function (r) { return r.vid === 'tema' && r.stoinost === d.tema; })) err = 'темата я няма в списъка на Интранета';
      else if (!d.kraen_srok || daysTo(d.kraen_srok) < 0) err = 'Срокът (' + (d.kraen_srok ? ddmm(parseD(d.kraen_srok)) : '—') + ') мина, преди да я впиша — Промени срока';
      else if (!tx || tx.length > 250) err = 'описанието трябва да е 1–250 знака';
      if (err) { a.status = 'greshka'; note(a, err); n.gr++; return; }
      var kd = parseD(d.kraen_srok), dn = daysTo(d.kraen_srok);
      note(a, '🧪 проба ' + hm0 + ': би вписал → Отговорник: ' + d.manager.ime + '; Тема: ' + d.tema + '; Екип: ' + ((d.ekip || []).map(function (p) { return p.ime; }).join(', ') || '—') +
        '; Приоритет: ' + prioIme(d.prioritet || 'normal') + '; Краен срок: ' + ddmm(kd) + '.' + kd.getFullYear() + ' (' + dn + ' ' + pl(dn, 'ден', 'дни') + '); Описание: „' + tx + '“ (' + tx.length + ' зн.)' +
        (a.razqsnenie ? '; Коментар: „' + clip(a.razqsnenie, 120) + '“ (би добавил)' : ''));
      n.proba++;
    });
    D.deistviq_bel.filter(function (b) { return !b.obraboteno && b.vid === 'belejka'; }).forEach(function (b) { b.obraboteno = t; b.rezultat = 'записано'; n.bel++; });
    toast('Лаптопът (проба): готови ' + n.proba + ' · допълни ' + n.dop + ' · чакат решение ' + n.resh + ' · разрешение ' + n.razr + ' · отменени ' + n.otm + ' · изпълнени ' + n.izp + ' · грешки ' + n.gr);
    demoRefresh();
  }
  // „Лаптопът вписва (демо)“ → първата „🧪 готова“ задача за Интранета става вписана (№demo-70xx)
  function demoVpisva() {
    var a = D.deistviq.filter(function (x) { return isProba(x) && x.cel === 'intranet'; })[0];
    if (!a) { toast('Няма готова задача — първо „Лаптопът обработва задачите“.'); return; }
    D.vp = (D.vp || 10) + 1;
    a.status = 'vpisano'; a.vanshen_id = 'demo-70' + D.vp; a.vanshen_url = '#demo-70' + D.vp; a.opit = nowIso(); a.belejka = 'вписана ' + hhmm(); a.obnoveno = nowIso();
    toast('Вписана в Интранета (демо): №' + a.vanshen_id);
    demoRefresh();
  }
  function demoRefresh() {
    setTimeout(function () {
      loadActs(true);
      loadTablo();   // и заявка 2 — отменена задача връща решението си [К11]
      if (view === 'day') poll(true);
    }, 300);
  }
  // „Телефонът се заключва“: същото като visibilitychange → hidden — „Отмени“ се затваря, записът първо влиза в опашката [К22]
  function demoHide() {
    var n = Object.keys(UNDO).length;
    commitUndos();
    toast(n ? 'Скрито: ' + n + ' ' + pl(n, 'запис влезе', 'записа влязоха') + ' в опашката преди изпращането' : 'Скрито — нямаше чакащо „Отмени“');
  }
  function demoSpisaci() {
    SPL.rows = null; SPL.at = 0; SPL.st = ''; sset(K4.sp, null);
    toast('Списъкът с хора е изчистен от телефона' + (S.forceOff ? ' — без покритие формата ще предложи „Запиши като чернова“' : ''));
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
    // мейл: като истинските — Оригинали/<дата>_<ЧЧММСС по UTC>_mail.txt (ключът на съобщението) [§7.2]
    var ml = s && /^Поща\/(\d{2})(\d{2})00\.eml$/.exec(s.kade || '');
    if (ml) {
      var u = new Date(Date.parse(data + 'T' + ml[1] + ':' + ml[2] + ':00+03:00'));
      s.kade = 'Оригинали/' + data + '_' + pad(u.getUTCHours()) + pad(u.getUTCMinutes()) + pad((+s.n || 0) % 60) + '_mail.txt';
      return s;
    }
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
    pts.forEach(function (p, i) { D.tochki.push({ id: ++D.tid, den_id: d.id, razdel: p[0], grupa: p[1], tekst: p[2], istina: p[3] || 'saobshteno', vajnost: p[4] || 1, izvori: p[5] || [], red: i + 1, k: i + 1, v_dnevnika: true }); });
    return d;
  }
  function dKratak(obekt, data, status, versiq, hora, rez, pts, obnoven) {
    var prom = pts.map(function (p, i) { return p[1] === 'fakt' ? '' : '- ' + p[2] + ' ⟦' + (i + 1) + '⟧'; }).filter(Boolean).join('\n');
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
    D = { dni: [], tochki: [], resheniq: [], deistviq: [], metriki: [], svezhest: [], snimki: [], deistviq_bel: [], saobshteniq: [], intranet_spisaci: [], loseNext: false, seq: 5000, lt: 0, did: 100, tid: 1000, sid: 7000 };
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
    var s12 = src(12, 'Файл', 'лаборатория · протокол № 118, 7-дневни кубчета', '14:20', 'Файлове/Протокол-118-демо.pdf');
    dAdd('ag', '2026-09-24', 'chernova', 3, 50,
      'Нормален работен ден — 50 души. Кофражът на плоча +9,30 в сграда 2 е довършен до ос 7, армировката започва утре. Доставчикът на арматура отлага доставката с 5–10 дни.', [
        [4, 'promqna', 'Сграда 2, плоча +9,30 — кофражът е довършен до ос 7. Армировката започва утре от 07:00.', 'saobshteno', 2, [s1, s2]],
        [5, 'promqna', 'Доставени 24 м³ бетон C25/30 за стълбищната клетка на сграда 1 — 2 миксера, 09:10–10:40.', 'provereno', 1, [s6]],
        [4, 'promqna', 'Сграда 3 — скелето по северната фасада е демонтирано; фасадната бригада минава на сграда 4.', 'saobshteno', 1, [s7]],
        [9, 'promqna', '7-дневните кубчета от плоча +6,20 (бетон от 17.09) дават 31,2 MPa — в норма за C25/30.', 'provereno', 1, [s12]],
        [8, 'reshenie', 'Доставчикът на арматура отлага доставката на арматура Ø12/Ø16 (≈14 т) с 5–10 дни. Чакаме или поръчваме частично от друг доставчик? Бетонът на +9,30 по график е на 02.10.', 'saobshteno', 3, [s4, s5]],
        [10, 'reshenie', 'Подизпълнителят по кофража иска потвърждение на количествата за поредния акт до петък, 25.09.', 'saobshteno', 2, [s10]],
        [7, 'reshenie', 'Инвеститорът пита за нова дата на бетона на +9,30 заради закъснението на арматурата — чака отговор от теб. Иска и писмено потвърждение, че фасадата на сграда 4 остава по график, и кога точно ще е огледът на армировката с надзора, за да планира своя технически контрол на обекта.', 'saobshteno', 2, [s11]],
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
    demoE4(d23, dDayOf('ag', '2026-09-24'), k23, { s1: s1, s2: s2, s4: s4, s5: s5, s6: s6, s7: s7, s9: s9, s10: s10, s11: s11 });
  }
  // ---- Етап 4 (§12): текстовете на съобщенията, списъците на Интранета, задачите във всяко състояние — всичко измислено ----
  function demoE4(d23, a24, k23, SS) {
    var T = dT;
    D.saobshteniq = []; D.deistviq_bel = []; D.intranet_spisaci = [];
    var ADR = { 'доставчикът на арматура': 'dostavchik', 'Инвеститор': 'investitor', 'бетонов възел': 'beton', 'подизпълнител кофраж': 'kofrazh', 'надзорът': 'nadzor', 'кореспонденция по темата': 'pismo' };
    function sbRow(d, s, tochka, o) {
      var k = srcKey(s); if (!k || !d || D.saobshteniq.some(function (r) { return r.kluch === k && r.den_id === d.id; })) return null;
      var mail = /_mail\.txt$/.test(k), parts = String(s.kratko || '').split(' · '), role = parts[0] || 'ТР на обекта';
      var ch = String(parts[1] || '').split(':')[0].trim(), izv = ch.replace(/^чат\s+„(.+)“$/, '$1') || 'канал на обекта';
      var r = { id: ++D.seq, den_id: d.id, obekt: d.obekt, data: d.data, kluch: k, vid: mail ? 'mail' : 'teams', msg_id: mail ? null : k,
        vreme: mail ? T(d.data + 'T' + (s.vreme || '12:00') + ':00+03:00') : new Date(+k).toISOString(),
        avtor: mail ? (ADR[role] || 'obekt') + '@primer.test' : role, izvor_vid: mail ? 'mail' : (/^канал/.test(ch) ? 'kanal' : 'chat'), izvor: mail ? null : izv,
        tema: mail ? 'Относно: ' + clip(parts[1] || 'писмо', 60) : null, otgovor: null, do_kopie: mail ? 'Копие: tr@primer.test' : null,
        tekst: (mail ? 'Здравейте,\n\n' : 'Колеги, ') + (tochka ? tochka.charAt(0).toLowerCase() + tochka.slice(1) : 'по темата от днес.') + (mail ? '\n\nМоля за обратна връзка.\n\nПоздрави' : ' Ако нещо се промени, пиша тук.'),
        link: mail ? null : 'demo:', snimki_broi: D.snimki.filter(function (x) { return x.msg_id === k; }).length, failove: [], original_url: mail ? 'demo:' : null, belejka: null };
      Object.assign(r, o || {});
      D.saobshteniq.push(r);
      return r;
    }
    var DLG = 'Уважаеми колеги,\n\nВъв връзка със забавянето на доставката на арматура Ø12/Ø16 молим да ни изпратите нова дата за бетонирането на плоча +9,30 в сграда 2. ' +
      'Нашият технически контрол трябва да присъства при огледа на армировката, затова ни трябват поне два работни дни предизвестие. ' +
      'Молим също за писмено потвърждение, че графикът на фасадата на сграда 4 не се променя, както и за кратка информация кои дейности ще се изпълняват, докато чакате арматурата.\n\n' +
      'Разбираме, че закъснението не е по ваша вина, но за нас е важно да знаем дали крайният срок на сградата остава същият и какви мерки предвиждате — ' +
      'например частична доставка от друг доставчик или пренареждане на работите по другите сгради. Ако решите да поръчвате частично, молим да ни уведомите преди поръчката, за да съгласуваме количествата.\n\n' +
      'Нашият представител ще бъде на обекта в понеделник от 10:00 и може да участва в оглед заедно с надзора. Ако часът не е удобен, предложете друг в рамките на седмицата. ' +
      'Молим протоколите от пробните кубчета да бъдат качени в общата папка до края на седмицата, за да ги прегледа и проектантът.\n\n' +
      'Благодарим за бързите отговори досега. Очакваме новата дата и плана за следващите две седмици до сряда. При въпроси се обадете на нашия технически ръководител — той е в течение с всички подробности по доставката и по огледа.\n\n' +
      'С уважение,\nот името на инвеститора';
    var SPEC = [
      [SS.s1, { tema: 'Кофраж +9,30', tekst: 'Добро утро. Кофражът на плоча +9,30 в сграда 2 е затворен до ос 7. На плочата сме 10 кофражисти — двама са от вчерашната смяна и още не са въведени в Присъствия. Армировката започва утре от 07:00, ако кранът е свободен.' }],
      [SS.s2, { tema: 'Снимки +9,30', tekst: 'Снимки от плоча +9,30 — кофражът е готов за приемане. Ос 7 е последната за днес, остатъкът — утре сутринта.' }],
      [SS.s4, { avtor: 'dostavchik@primer.test', tema: 'RE: Уточнение за доставката', do_kopie: 'Копие: pto@primer.test · tr@primer.test',
        tekst: 'Здравейте,\n\nПоради забавяне при производителя остатъкът от арматурата Ø12/Ø16 (около 14 т) ще бъде доставен с 5 до 10 работни дни закъснение. Първата част можем да изпратим на 29.09.\n\nМоля да потвърдите дали приемате частична доставка.\n\nПоздрави,\nотдел „Доставки“' }],
      [SS.s5, { avtor: 'Demo Tehnik', otgovor: '↳ отговор на ТР на обекта (11:12)', izvor: 'чат на ПТО', izvor_vid: 'chat', tekst: 'Арматурата няма да дойде преди 01.10 — писмото от доставчика е във входящата поща. Предлагам да поръчаме частично от друг доставчик само за +9,30.' }],
      [SS.s6, { avtor: 'beton@primer.test', tema: 'Товарителници 24.09', tekst: 'Здравейте,\n\nИзпратени са 2 миксера C25/30 — общо 24 м³, в 09:10 и 10:05. Товарителниците са в прикачения файл.\n\nПоздрави', failove: [{ ime: 'Товарителници-демо.pdf', pat: 'Файлове/Товарителници-демо.pdf', url: 'demo:' }] }],
      [SS.s7, { tekst: 'Скелето по северната фасада на сграда 3 е демонтирано. Утре бригадата минава на сграда 4 — трябва ни място за палетите с клинкер.' }],
      [SS.s9, { tekst: 'Кранът стои — сменяме хидравличния маркуч. Около два часа, после продължаваме с кофража.' }],
      [SS.s10, { avtor: 'kofrazh@primer.test', tema: 'Количествена сметка — пореден акт', tekst: 'Здравейте,\n\nИзпращаме количествената сметка за поредния акт. Моля за потвърждение на количествата до петък, 25.09.\n\nПоздрави', failove: [{ ime: 'Протокол-демо.xlsx', pat: 'Файлове/Протокол-демо.xlsx', url: 'demo:' }] }],
      [SS.s11, { avtor: 'investitor@primer.test', tema: 'Дата на бетона +9,30', tekst: DLG }]
    ];
    function specOf(s) { for (var i = 0; i < SPEC.length; i++) if (SPEC[i][0] === s) return SPEC[i][1]; return null; }
    // Амур 23–24.09 и Скай 23.09: ред за всеки Тиймс/мейл източник; за другите дни — без редове („още не е в облака“)
    [a24, d23, k23].forEach(function (d) {
      if (!d) return;
      D.tochki.filter(function (t) { return t.den_id === d.id; }).forEach(function (t) {
        (t.izvori || []).forEach(function (s) { sbRow(d, s, t.tekst, specOf(s)); });
      });
    });
    // писмо на лабораторията с протокола (файлът — източник [12] на 24.09)
    if (a24) D.saobshteniq.push({ id: ++D.seq, den_id: a24.id, obekt: 'ag', data: a24.data, kluch: '2026-09-24_112000_mail.txt', vid: 'mail', msg_id: null, vreme: T('2026-09-24T14:20:00+03:00'),
      avtor: 'laboratoria@primer.test', izvor_vid: 'mail', izvor: null, tema: 'Протокол № 118', otgovor: null, do_kopie: null, tekst: 'Здравейте,\n\nПрилагаме протокол № 118 за 7-дневните кубчета.\n\nПоздрави',
      link: null, snimki_broi: 0, failove: [{ ime: 'Протокол-118-демо.pdf', pat: 'Файлове/Протокол-118-демо.pdf', url: 'demo:' }], original_url: 'demo:', belejka: null });
    // „Съседни съобщения“: по 4 преди и след 07:18 в канала на обекта на Амур 24.09
    if (a24) ['06:40', '06:52', '07:02', '07:10', '07:25', '07:40', '07:55', '08:05'].forEach(function (hm, i) {
      var ms = Date.parse('2026-09-24T' + hm + ':00+03:00') + 50 + i;
      var tx = ['Колеги, кранът е свободен от 07:00.', 'Бетонджиите са на стълбището в сграда 1.', 'Доставката на кофражни платна е за 09:00.', 'Кой поема приемането на бетона днес?',
        'Приемам бетона аз — на портала съм в 09:00.', 'На +9,30 липсват две разпънки при ос 5.', 'Разпънките са качени — може да се продължава.', 'Метеото е спокойно, без ограничения за крана.'][i];
      D.saobshteniq.push({ id: ++D.seq, den_id: a24.id, obekt: 'ag', data: a24.data, kluch: String(ms), vid: 'teams', msg_id: String(ms), vreme: new Date(ms).toISOString(),
        avtor: i % 2 ? 'бригадир кофраж' : 'ТР на обекта', izvor_vid: 'kanal', izvor: 'канал на обекта', tema: null, otgovor: null, do_kopie: null, tekst: tx, link: 'demo:', snimki_broi: 0, failove: [], original_url: null, belejka: null });
    });
    // списъците на Интранета: 14 измислени души в 4 отдела (без „Тестови потребители“ [К8]); „Демо Техник“ ↔ автора „Demo Tehnik“ (§8.2.3)
    var R0 = T('2026-09-21T20:00:00+03:00'), rr = 0;
    function sp(vid, st, ime, gr, ob) { D.intranet_spisaci.push({ vid: vid, stoinost: st, ime: ime, grupa: gr || null, obekt: ob || null, red: ++rr, skrit: false, aktiven: true, obnoveno: R0 }); }
    [['Строителство', [['101', 'Техн. ръководител (демо)'], ['102', 'Бригадир кофраж (демо)'], ['103', 'Бригадир фасада (демо)'], ['104', 'Механизатор (демо)']]],
      ['МЕП', [['111', 'Координатор МЕП (демо)'], ['112', 'Инж. Електро (демо)'], ['113', 'Инж. ОВК (демо)']]],
      ['ВиК', [['121', 'Инж. ВиК (демо)'], ['122', 'Водопроводчик (демо)'], ['123', 'Монтажник ВиК (демо)']]],
      ['ПТО', [['2', 'Ти (демо)'], ['131', 'Демо Техник'], ['132', 'Инж. ПТО (демо)'], ['133', 'Сметчик (демо)']]]].forEach(function (g) { g[1].forEach(function (p) { sp('chovek', p[0], p[1], g[0]); }); });
    sp('az', '2', 'Ти (демо)');
    [['Амур Гардънс', 'ag'], ['Скай Тауърс', 'soft'], ['Обект Демо', null]].forEach(function (t) { sp('tema', t[0], t[0], null, t[1]); });
    PRIO.forEach(function (p) { sp('prioritet', p[0], p[1]); });
    // задачите — по една във всяко състояние (§12)
    function Z(o) {
      return Object.assign({ id: ++D.seq, den_id: null, tochka_id: null, chovek: null, mqsto: null, srok: null, izvor: 'телефон · бутон +', status: 'zaqveno', vanshen_id: null,
        sazdadeno: T('2026-09-24T09:00:00+03:00'), obnoveno: null, obekt: null, cel: null, danni: null, razqsnenie: null, zamenq: null, belejka: null, vanshen_url: null, klient_id: null, opit: null }, o);
    }
    function M(id, ime) { return { id: id, ime: ime }; }
    var zV = Z({ vid: 'vazlozhi', obekt: 'ag', cel: 'intranet', den_id: d23 ? d23.id : null, tekst: 'Изпрати на инвеститора графика за фасадата на сграда 4', chovek: 'Техн. ръководител (демо)',
      srok: T('2026-09-25T17:00:00+03:00'), status: 'vpisano', vanshen_id: 'demo-7001', vanshen_url: '#demo-7001', belejka: 'вписана 18:20', razqsnenie: 'Графикът да покрива и скелето.',
      danni: { manager: M('101', 'Техн. ръководител (демо)'), tema: 'Амур Гардънс', ekip: [M('103', 'Бригадир фасада (демо)')], prioritet: 'high', kraen_srok: '2026-09-25' },
      opit: T('2026-09-23T18:19:00+03:00'), sazdadeno: T('2026-09-23T18:02:00+03:00'), obnoveno: T('2026-09-23T18:20:00+03:00') });
    var zDop = Z({ vid: 'vazlozhi', tekst: 'Уточни с доставчика на арматура точната дата на остатъка', chovek: 'Инж. ПТО', srok: T('2026-09-26T12:00:00+03:00'), status: 'dopalni', izvor: 'телефон · табло · бутон + · ag',
      belejka: 'липсват данни за Интранета — отвори я в Задачи → Допълни', sazdadeno: T('2026-09-22T18:30:00+03:00'), obnoveno: T('2026-09-22T21:05:00+03:00') });
    var zTodo = Z({ vid: 'za_men', cel: 'todo', obekt: 'ag', tekst: 'Прегледай офертата за скелето на сграда 4', srok: T('2026-09-28T09:00:00+03:00'), status: 'chaka_razreshenie', danni: { vazhno: false },
      belejka: 'To Do иска разрешение Tasks.ReadWrite (още не е дадено)', sazdadeno: T('2026-09-23T19:40:00+03:00'), obnoveno: T('2026-09-23T21:05:00+03:00') });
    var zNap = Z({ vid: 'napomni', obekt: 'soft', den_id: k23 ? k23.id : null, tekst: 'Провери дали помпите в сутерена работят', srok: T('2026-09-25T08:00:00+03:00'), status: 'chaka_reshenie',
      belejka: 'начинът още не е решен (въпрос към РП)', sazdadeno: T('2026-09-23T20:10:00+03:00'), obnoveno: T('2026-09-23T21:05:00+03:00') });
    var zOld = Z({ vid: 'vazlozhi', cel: 'intranet', obekt: 'ag', tekst: 'Поръчай втори контейнер за отпадъци', chovek: 'Бригадир кофраж (демо)', srok: T('2026-09-28T17:00:00+03:00'), status: 'otmeneno',
      danni: { manager: M('102', 'Бригадир кофраж (демо)'), tema: 'Амур Гардънс', ekip: [], prioritet: 'normal', kraen_srok: '2026-09-28' }, sazdadeno: T('2026-09-24T08:10:00+03:00'), obnoveno: T('2026-09-24T12:30:00+03:00') });
    var zNew = Z({ vid: 'vazlozhi', cel: 'intranet', obekt: 'ag', zamenq: zOld.id, tekst: 'Поръчай втори контейнер за отпадъци — за сгради 2 и 3', chovek: 'Техн. ръководител (демо)', srok: T('2026-09-29T17:00:00+03:00'),
      danni: { manager: M('101', 'Техн. ръководител (демо)'), tema: 'Амур Гардънс', ekip: [M('102', 'Бригадир кофраж (демо)')], prioritet: 'normal', kraen_srok: '2026-09-29' }, sazdadeno: T('2026-09-24T12:05:00+03:00'), obnoveno: T('2026-09-24T12:30:00+03:00') });
    zOld.belejka = 'заменена от №' + zNew.id;
    zNew.belejka = '🧪 проба 12:30: би вписал → Отговорник: Техн. ръководител (демо); Тема: Амур Гардънс; Екип: Бригадир кофраж (демо); Приоритет: нормален; Краен срок: 29.09.2026 (5 дни); Описание: „' + zNew.tekst + '“ (' + zNew.tekst.length + ' зн.)';
    var zGr = Z({ vid: 'vazlozhi', cel: 'intranet', obekt: 'soft', tekst: 'Протокол за заземяването на кулокран 2', chovek: 'Механизатор (демо)', srok: T('2026-09-30T17:00:00+03:00'), status: 'greshka', opit: T('2026-09-23T21:04:00+03:00'),
      danni: { manager: M('104', 'Механизатор (демо)'), tema: 'Скай Тауърс', ekip: [], prioritet: 'urgent', kraen_srok: '2026-09-30' },
      belejka: 'изпратена, но не намерих номера — провери в Интранета (не пращам втори път)', sazdadeno: T('2026-09-23T17:50:00+03:00'), obnoveno: T('2026-09-23T21:05:00+03:00') });
    var zIsk = Z({ vid: 'iskane', obekt: 'ag', den_id: a24 ? a24.id : null, tekst: 'Относно „арматурата“: кога точно идва остатъкът — 29.09 или 01.10?', chovek: 'Demo Tehnik', srok: T('2026-09-25T12:00:00+03:00'), status: 'chaka_reshenie',
      belejka: 'начинът още не е решен (въпрос към РП)', danni: { do: M('131', 'Демо Техник'), nishka: 'чат на ПТО', izvor_vid: 'chat', kluch: srcKey(SS.s5) }, sazdadeno: T('2026-09-24T11:45:00+03:00'), obnoveno: T('2026-09-24T12:30:00+03:00') });
    var zPros = Z({ vid: 'za_men', cel: 'intranet', obekt: 'ag', tekst: 'Подпиши протокола за приемане на армировката на стълбището', chovek: 'Ти (демо)', srok: T('2026-09-22T17:00:00+03:00'), status: 'vpisano',
      vanshen_id: 'demo-6990', vanshen_url: '#demo-6990', belejka: 'вписана 21:04', danni: { manager: M('2', 'Ти (демо)'), tema: 'Амур Гардънс', ekip: [], prioritet: 'normal', kraen_srok: '2026-09-22' },
      opit: T('2026-09-18T21:03:00+03:00'), sazdadeno: T('2026-09-18T18:00:00+03:00'), obnoveno: T('2026-09-18T21:04:00+03:00') });
    D.deistviq.push(zV, zDop, zTodo, zNap, zOld, zNew, zGr, zIsk, zPros);
    // една необработена „Готово“ — към „Снимки на плоча +9,30 преди армировката“
    var sn = D.deistviq.filter(function (a) { return /^Снимки на плоча/.test(a.tekst); })[0];
    if (sn) D.deistviq_bel.push({ id: ++D.seq, deistvie_id: sn.id, vid: 'gotovo', tekst: null, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-24T17:30:00+03:00'), obraboteno: null, rezultat: null, klient_id: null });
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
    var s = lget(K2.obekt), d = lget(K2.denObekt), st = lget(K4.start);
    if (st === 'ag' || st === 'soft' || st === 'all') s = st;   // Настройки → „Обект при отваряне“ (иначе — последно избрания)
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
