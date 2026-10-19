// AiLab · Стъпка 1а (tools\STAPKA1A-SPEC.md, ЧАСТ А) — „Събрано до …“, нова версия без загуба на отговорите, „↳ продължение“, закъснели,
// приложенията, времето, мерене. Решение 1 на РП (19.10, „В“): черновата на днешния ден в 19:00 и обновяване в 22:45. Върху Етап 6:
// AiLab · Етап 6 (tools\ETAP6-SPEC.md, ЧАСТ А) — „🗂️ Източниците на деня“, връзките между източниците, „✉ Питай по мейл“, 🚫 в Табло,
// без чакане след действие (лентата „Отмени“), свежест по графика, „📄 Пълен запис“ = Word, „📥 Днес досега“. Върху Етап 5.2 (F11, §5.10).
// AiLab · Етап 5 — Присъствия (графика 30 д / 90 д / Всичко, карта „👷 Присъствия“), Интранетът в „Задачи“, „📘/🚫“ и в
// „Пълен запис“ (фактите), широк екран ≥ 1100 px (Преглед 3 колони, Табло 2, Задачи 2). ETAP5-SPEC.md §6.
// Върху Етап 4 („Преглед и задачи“: 4 таба, подредба, „✎ Поясни“, източници, задачи с полетата на Интранета), Етап 3 („Снимки“),
// Етап 2 („Табло“) и Етап 1 („Ден“ — сега „Преглед“). Пази входа, запазеното и service worker-а.
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
    S: {}, chart: { sel: null, anim: true, cat: null, geo: null }, defer: {}, scrollY: 0, shownAt: 0, measured: false, seenBase: '', built: false, io: null, cardSeen: {}, feedOt: {}, zap: {}, zapAsk: {} };
  // Етап 5: новите ключове в localStorage (lget/lset добавят „_demo“ в демото); „Изход“ ги трие [§6.6]
  var K5 = { hora: 'ailab_e5_hora', obh: 'ailab_e5_hora_obhvat', iz: 'ailab_e5_intranet', izg: 'ailab_e5_zad_izgled' };
  // Етап 6: филтърът в „Източниците на деня“ и „Това съм аз“ (адресите на РП) — с „_demo“ в демото; „Изход“ ги трие [ETAP6 §5.12]
  var K6 = { iztF: 'ailab_e6_izt_f', az: 'ailab_e6_az_mail' };
  // Широк екран [§6.2, К32]: ≥ 1100 px × размера на текста → body.wide; под прага DOM-ът и CSS-ът са както досега
  var WIDE = false, WIDE_MQ = null;

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
  function ljsetOk(k, v) { try { localStorage.setItem(DEMO ? k + '_demo' : k, JSON.stringify(v)); return true; } catch (e) { return false; } }

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
  var ANS4 = { potvardi: 1, popravka: 1, komentar: 1, osporva: 1 };         // 1а [§6.1]: отговорите, които важат за един текст на точката
  // Етап 6 [§5.1]: + k, v_dnevnika — за „🚫 Не включвай“ в Табло (zapis_md НЕ — тегли се отделно с tZap); без колоните → старата заявка
  var OPEN_SEL = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red,k,v_dnevnika,dni!inner(obekt,data,status,versiq,hesh,obnoven),resheniq(id),deistviq(id,status)';
  var OPEN_SEL0 = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red,dni!inner(obekt,data,status,versiq,hesh,obnoven),resheniq(id),deistviq(id,status)';
  var E6 = { open: true };   // false → tochki.k/v_dnevnika ги няма (42703): заявка 2 минава на старите колони
  var FEED_COLS = 'id,den_id,razdel,tekst,istina,vajnost,izvori,red';
  var ACT_COLS = 'id,den_id,tochka_id,vid,tekst,chovek,mqsto,srok,izvor,status,sazdadeno,obnoveno';
  var ACT_E4 = ',obekt,cel,danni,razqsnenie,zamenq,belejka,vanshen_id,vanshen_url,klient_id,opit';   // колоните от 005_etap4.sql
  var SOON_MAX = 50;   // таван на заявка 4
  // „Отворена задача“ (броячи, срокове) и „Чака теб“ [§2.1.2]; телефонът показва думите само от ST [К33]
  // Етап 6: + chaka_otgovor — „✉ чака отговор“ (питане по мейл; сменя го само лаптопът) [§2.3, §5.1]
  var OTV = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'vpisano', 'chaka_otgovor'];
  var CHAKA_TEB = ['dopalni', 'greshka'];
  var CLOSES_DEI = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'vpisano', 'izpalneno', 'greshka', 'chaka_otgovor'];   // затварят решение (без otmeneno) [К11]
  var BEL_COLS = 'id,deistvie_id,vid,tekst,kogda,obraboteno,rezultat,klient_id';
  var SAOB_COLS = 'id,den_id,data,kluch,vid,vreme,avtor,izvor_vid,izvor,tema,otgovor,do_kopie,tekst,link,snimki_broi,failove,original_url,belejka';
  var SP_COLS = 'vid,stoinost,ime,grupa,obekt,red,skrit,aktiven,obnoveno';
  // Етап 5 (008_etap5.sql): Интранетът — копие на „Моите задачи“ (без отпечатъците); адресът идва само от link [§3.3]
  var IZ_COLS = 'tid,opisanie,tema,obekt,otgovornik,vazlozhil,ekip,prioritet,srok,status,sazdadena,zavarshena,na_men,ot_men,v_ekipa,komentari,kontrolni,link,detajli_v,vidqna_posledno,obnoveno';
  var E4 = { act: true };   // false → колоните на Етап 4 ги няма (преди 005): заявките на задачите минават на старите [§2]
  // Стъпка 1а (010_stapka1a.sql): без новите колони → тихо старите заявки (isNoCol), досегашното поведение [1а §6]
  var E1A = { head: true, cnt: true, pris: true };
  var HEAD0 = 'id,versiq,status,hesh,obnoven,vpisan_pat';
  var DOK_COLS = 'id,kade,ime,razshirenie,status,prichina,kratko,vajen,podatel,tema,vreme,url';
  var DOK_OT = DEMO ? '2026-09-01' : '2026-10-01';   // регистърът на приложенията — от еднократното прочитане [1а §6.8]
  function isoMinus(ms) { return new Date(nowMs() - ms).toISOString(); }
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
    // 1а [§6.1]: + tochki.obnovena_v и resheniq.versiq — отговор за стар текст пак „чака“; без колоните → старата заявка
    counts: function (ids) {
      if (!ids.length) return Promise.resolve({ t: [], r: [] });
      var self = this, nov = E1A.cnt;
      return Promise.all([
        R(function () { return db.from('tochki').select('id,den_id,grupa,istina' + (nov ? ',obnovena_v' : '')).in('den_id', ids).in('grupa', ['reshenie', 'neprovereno']); }),
        R(function () { return db.from('resheniq').select('den_id,tochka_id,vid' + (nov ? ',versiq' : '')).in('den_id', ids).in('vid', ['potvardi', 'popravka', 'komentar']).not('tochka_id', 'is', null); })
      ]).then(function (rr) { return { t: rr[0] || [], r: rr[1] || [] }; }, function (e) {
        if (!nov || !isNoCol(e)) throw e;
        E1A.cnt = false; return self.counts(ids);
      });
    },
    den: function (id) { return R(function () { return db.from('dni').select('*').eq('id', id).maybeSingle(); }); },
    // 1а [§6.1]: + sabrano, promeni (новата версия казва какво е сменено, още преди презареждането)
    head: function (id) {
      if (!E1A.head) return R(function () { return db.from('dni').select(HEAD0).eq('id', id).maybeSingle(); });
      return R(function () { return db.from('dni').select(HEAD0 + ',sabrano,promeni').eq('id', id).maybeSingle(); }).then(null, function (e) {
        if (!isNoCol(e)) throw e;
        E1A.head = false; return R(function () { return db.from('dni').select(HEAD0).eq('id', id).maybeSingle(); });
      });
    },
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
      var self = this;
      return self.tOpen1(sel, rg, old, E6.open ? OPEN_SEL : OPEN_SEL0).then(null, function (e) {
        if (!E6.open || !isNoCol(e)) throw e;
        E6.open = false;   // преди колоните k/v_dnevnika — тихо старата заявка (без 🚫 в Табло)
        return self.tOpen1(sel, rg, old, OPEN_SEL0);
      });
    },
    tOpen1: function (sel, rg, old, cols) {
      return RC(function () {
        // отменена задача не затваря решението [К11]: анти-съединението брои само задачи в другите състояния
        var q = db.from('tochki').select(cols, { count: 'exact' }).eq('grupa', 'reshenie')
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
    },
    // ---- Етап 5: само SELECT; без таблиците (преди 008_etap5.sql) → тихо, досегашното поведение ----
    // Присъствия: числата на всички дни — страница rg (базата връща най-много 1000 реда) [К4]; obnoveno_ot не се тегли [К33]
    pris: function (rg) { return R(function () { return db.from('prisystvie').select('obekt,data,obshto,neto').eq('v_izvora', true).order('data', { ascending: true }).order('obekt', { ascending: true }).range(rg[0], rg[1]).abortSignal(tsig()); }); },
    // разбивката на един ден — само при показване/тап [§6.3]
    // 1а [§6.1]: + sinhr (кога е дошъл в базата — „въведени след черновата“); без колоната → obnoveno_v
    prisDen: function (o, d) {
      function q(c) { return R(function () { return db.from('prisystvie').select(c).eq('obekt', o).eq('data', d).eq('v_izvora', true).limit(1).abortSignal(tsig()); }).then(function (r) { return Array.isArray(r) ? r[0] || null : r; }); }
      var c0 = 'obekt,data,po_brigadi,obshto,neto,obnoveno_v';
      if (!E1A.pris) return q(c0);
      return q(c0 + ',sinhr').then(null, function (e) { if (!isNoCol(e)) throw e; E1A.pris = false; return q(c0); });
    },
    // Интранетът: задачите в списъка на РП — страница rg [§6.4, К4]
    izad: function (rg) { return R(function () { return db.from('intranet_zadachi').select(IZ_COLS).eq('v_spisaka', true).order('tid', { ascending: true }).range(rg[0], rg[1]).abortSignal(tsig()); }); },
    // ---- Етап 6 (009_etap6.sql): само SELECT; без таблицата/изгледа → тихо „още не е в облака“ [ETAP6 §5.1] ----
    // „Източниците на деня“: ключовете на деня — броевете в заглавията и „неизползвани“ (една малка заявка при отваряне на деня)
    saobDenK: function (den) { return R(function () { return db.from('saobshteniq').select('id,kluch,vid,vreme').eq('den_id', den).order('vreme').order('id').limit(1000).abortSignal(tsig()); }); },
    // целите редове — по 30, при разгъване (по ид: „Неизползвани“ и „Всички“ теглят точно показаните)
    saobDen: function (den, vid, rg) { return R(function () { return db.from('saobshteniq').select(SAOB_COLS).eq('den_id', den).eq('vid', vid).order('vreme').order('id').range(rg[0], rg[1]).abortSignal(tsig()); }); },
    saobIds: function (ids) {
      if (!ids.length) return Promise.resolve([]);
      return R(function () { return db.from('saobshteniq').select(SAOB_COLS).in('id', ids).order('vreme').order('id').limit(60).abortSignal(tsig()); });
    },
    // F12 [§5.14]: съобщенията на днешния ден преди черновата — по (обект, дата), без den_id (2.7);
    // 1а [§6.1]: днешният ден ВЕЧЕ има чернова (19:00) → всички съобщения на деня (-Dnes им дава den_id), без филтъра
    saobDnesK: function (o, data, vse) { return R(function () { var q = db.from('saobshteniq').select('id,kluch,vid,vreme').eq('obekt', o).eq('data', data); if (!vse) q = q.is('den_id', null); return q.order('vreme').order('id').limit(1000).abortSignal(tsig()); }); },
    // ---- Стъпка 1а (010_stapka1a.sql): само SELECT; без таблицата/колоните → тихо досегашното [1а §6.1] ----
    // „След черновата е дошло“: съобщенията на (обект, ден), качени в базата след снимката „събрано до“
    slednoBroi: function (o, data, ot) {
      return R(function () { return db.from('saobshteniq').select('vid').eq('obekt', o).eq('data', data).gt('sazdadeno', ot).limit(500).abortSignal(tsig()); })
        .then(function (rows) { var x = { teams: 0, mail: 0 }; (rows || []).forEach(function (r) { if (r.vid === 'mail') x.mail++; else if (r.vid === 'teams') x.teams++; }); return x; });
    },
    // регистърът на приложенията: на деня (лентата, листът) и всички от DOK_OT (Настройки › 📎 Приложенията)
    dokDen: function (o, data) { return R(function () { return db.from('dokumenti').select(DOK_COLS).eq('obekt', o).eq('data', data).limit(300).abortSignal(tsig()); }); },
    // броевете в Настройки — само obekt,status, по страници (allPages): регистърът расте ~15 файла на ден и минава 1000 до декември
    dokVsichki: function (ot, rg) { return R(function () { return db.from('dokumenti').select('obekt,status').gte('data', ot).order('id').range(rg[0], rg[1]).abortSignal(tsig()); }); },
    // листовете „Не може — защо“ / „Непрочетени“ — само редовете с тези статуси (не изрязък от всички), по страници
    dokSt: function (ot, sts, rg) { return R(function () { return db.from('dokumenti').select(DOK_COLS + ',obekt,data').gte('data', ot).in('status', sts).order('data', { ascending: false }).order('id').range(rg[0], rg[1]).abortSignal(tsig()); }); },
    // закъснелите за одобрен ден — в по-късните чернови на обекта (sabrano.zakasneli[ден]), до 21 дни напред [§4.4]
    zakasneliZa: function (o, data) {
      var d = parseD(data); d.setDate(d.getDate() + 21);
      return R(function () { return db.from('dni').select('id,data,sabrano').eq('obekt', o).gt('data', data).lte('data', ymd(d)).limit(40).abortSignal(tsig()); });
    },
    // мерилото: минутите по екран и ръчните „извън AiLab“ за последните 8 дни; началото на седмицата — първият ред aktivno_*
    vremeSedm: function (ot) { return R(function () { return db.from('metriki').select('vid,stoinost,kogda').or('vid.like.aktivno%,vid.like.izvan%').gte('kogda', ot).limit(2000).abortSignal(tsig()); }); },
    merStart: function () { return R(function () { return db.from('metriki').select('kogda').like('vid', 'aktivno%').order('kogda', { ascending: true }).limit(1).abortSignal(tsig()); }); },
    // движението в Интранета за деня (пише го само лаптопът) [§2.1]
    dvizh: function (o, data) {
      return R(function () {
        return db.from('intranet_dvizhenie').select('id,tid,obekt,vid,staro,novo,opisanie,otgovornik,srok,status,data_sabitie,tochnost,okno_ot,okno_do')
          .eq('data_sabitie', data).eq('obekt', o).order('okno_do').order('id').limit(200).abortSignal(tsig());
      });
    },
    // адресната книга от архива — само в паметта, веднъж на сесия, при първото „✉ Питай“ [§2.4]
    adresi: function () { return R(function () { return db.from('adresnik').select('adres,ime,broi,posledno').order('broi', { ascending: false }).limit(1000).abortSignal(tsig()); }); },
    // записът на видимите дни (≤ 10) — кои ⟦k⟧ имат свой ред (за 🚫 в Табло) [§5.5]
    tZap: function (ids) {
      if (!ids.length) return Promise.resolve([]);
      return R(function () { return db.from('dni').select('id,zapis_md').in('id', ids.slice(0, 10)).abortSignal(tsig()); });
    }
  };
  // Всички страници по 1000 реда, докато дойде непълна [К4]
  var PAGE = 1000;
  function allPages(fn) {
    var out = [];
    function next(a) {
      return fn([a, a + PAGE - 1]).then(function (rows) {
        rows = rows || []; out = out.concat(rows);
        return rows.length < PAGE || out.length >= 50000 ? out : next(a + PAGE);
      });
    }
    return next(0);
  }

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
  // hold (Етап 6, §5.6): записът влиза в опашката ВЕДНАГА, но „задържан“ (hold = кога е задържан, ≠ 0) — броячите, групите,
  // Табло и „Одобрявам“ го виждат като направен от първия миг; тръгва чак от undoCommit(). Опашката е JSON → никога Infinity.
  function enqueue(tbl, row, meta, at, qid, hold) {
    qid = qid || newQid();
    if (KID_T[tbl] && row && row.klient_id == null && /^[0-9a-z]{8,40}$/.test(qid)) row = Object.assign({}, row, { klient_id: qid });
    var it = { qid: qid, tbl: tbl, row: row, at: at || nowIso(), tt: (meta && meta.tt) || null };
    if (meta && meta.kind) it.kind = meta.kind;
    if (hold) it.hold = Date.now();
    var q = queue(); q.push(it); setQueue(q); renderBanners();
    return it;
  }
  function isHeld(it) { return !!(it && it.hold); }
  // задържаният НЕ е „чака връзка“: горната лента, Настройки и ⏳ по картите го прескачат [§5.6 т.3]
  function pendingCount() { return liveQ().filter(function (it) { return it.tbl !== 'metriki' && !isHeld(it); }).length; }
  // Задържан от затворен прозорец на AiLab (убит насред 5-те с) → пуска се, щом е по-стар от 10 мин; своите (в UNDO) — никога [§5.6 т.9]
  function heldOrphans() {
    var own = {}, ch = false, n = Date.now();
    Object.keys(UNDO).forEach(function (k) { if (UNDO[k].qid) own[UNDO[k].qid] = 1; });
    var q = queue().map(function (it) {
      if (!isHeld(it) || own[it.qid] || n - it.hold <= 600000) return it;
      ch = true; var x = Object.assign({}, it); delete x.hold; delete x.pauza; return x;
    });
    if (ch) setQueue(q);
    return ch;
  }
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
    if (tbl === 'resheniq' && row && row.vid === 'vrazka_ne') return null;   // 1а [§4.6]: махната точка → не се праща наново (flush го маха тихо)
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
      // преди 009_etap6.sql: „➕ Включи в дневника“ (vid dobavi) още не се приема [ETAP6 §2.2]
      else if (tbl === 'resheniq' && e && e.code === '23514' && /resheniq_(vid|dobavi)_check/.test(e.message || '')) e.bg = 'базата още не приема „➕ Включи в дневника“ — лаптопът я обновява';
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
    commitUndos();   // §5.6 т.8: чакащото „Отмени“ тръгва първо — редът в опашката се пази [К2], flush не спира на задържан ред
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
  // Праща по реда и СПИРА на първия задържан (hold) — него го пуска само undoCommit() [§5.6 т.2]
  function flush(silent) {
    if (flushing) return flushing;
    heldOrphans();
    var lq = liveQ();
    if (!lq.length || isHeld(lq[0]) || S.forceOff || !navigator.onLine || (!DEMO && (!db || !user))) return Promise.resolve();
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
        var it = liveQ()[0]; if (!it || isHeld(it)) { fin(); return; }
        insertFk(it.tbl, stampRow(it), it.tt).then(function (r2) {
          dropQ(it.qid);
          if (it.tbl !== 'metriki') { sent++; afterSent(it, r2); }   // мерането не се брои в „N чакат връзка“
          next();
        }, function (e) {
          if (isNet(e) || isAuth(e)) { if (isNet(e)) FL.net = true; fin(); return; }
          // 1а [§6]: мерилото и „✕ не е продължение“ — отказ преди 010 (23514) или махната точка (23503) → тихо вън от опашката
          if (it.tbl === 'metriki' && e && e.code === '23514' && /^(aktivno|izvan)_/.test((it.row && it.row.vid) || '')) MER.off = true;
          if (it.tbl === 'metriki' || (it.tbl === 'resheniq' && it.row && it.row.vid === 'vrazka_ne' && e && (e.code === '23514' || e.code === '23503'))) dropQ(it.qid);
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
  // 1а [§6.1]: own = най-новата версия, за която съм отговорил (без колоната versiq — „безкрайно нова“, както досега);
  // точка, обновена след отговора ми (obnovena_v > версията му), пак „чака“
  function countMap(c) {
    var own = {}, m = {};
    function put(tid, v) { v = v == null ? 1e9 : +v; if (own[tid] == null || v > own[tid]) own[tid] = v; }
    ((c && c.r) || []).forEach(function (r) { if (r.tochka_id != null) put(r.tochka_id, r.versiq); });
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.tochka_id != null && ANSW[it.row.vid]) put(it.row.tochka_id, it.row.versiq); });
    ((c && c.t) || []).forEach(function (t) { if (t.istina !== 'provereno' && !(own[t.id] != null && own[t.id] >= (+t.obnovena_v || 0))) m[t.den_id] = (m[t.den_id] || 0) + 1; });
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
        prisMaybe();
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
  // explicit = РП натисна „Покажи новата версия“. Иначе нова версия на СЪЩИЯ ден не подменя показаното (напр. след връзка
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
      S.den = rr[0]; S.tochki = (rr[1] || []).map(normT); S.res = rr[2] || []; S.newVersiq = 0; S.newHead = null;
      den1aLoad();   // 1а: „събрано до“ — след черновата, приложенията на деня, закъснелите (само SELECT, успоредно)
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
    loadDen(S.den.id, ++S.tok, true).then(function () { if (v) toast(viToast()); }, function (e) { if (isNet(e)) setOffline(); else toast('Не се зареди: ' + errBg(e), 'bad'); });
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
      if (cakah && ostar) toast('Одобрението не е вписано — има нова версия. Покажи новата версия и одобри отново.', 'bad');
      S.res = rr[1] || [];
      var m = {}; (rr[2] || []).forEach(function (x) { m[x.id] = x.istina; });
      S.tochki.forEach(function (t) { if (m[t.id]) t.istina = m[t.id]; });
      // задачите на деня подменят само своите редове в общия списък (целият списък — при Задачи, старт и на 2 мин) [К9]
      var dayA = rr[4] || [], seenA = {};
      dayA.forEach(function (a) { seenA[a.id] = 1; });
      S.deistviq = S.deistviq.filter(function (a) { return !(typeof a.id === 'number' && (a.den_id === id || seenA[a.id])) && !(a.klient_id && dayA.some(function (x) { return x.klient_id === a.klient_id; })); }).concat(dayA);
      S.svezhest = rr[3] || []; S.svAt = Date.now(); S.okAt = Date.now();
      prisMaybe();
      den1aLoad(true);   // 1а: „след черновата е дошло“ — на всяка проверка (20 с), само за чернова със „събрано до“
      saveCache(); setOnline(); renderLive();
    }).catch(function (e) { if (isNet(e)) setOffline(); }).then(done, done);
  }
  function applyHead(h) {
    if (!h) return;
    var d = S.den, was = d.status;
    if (h.versiq > d.versiq) S.newHead = h;   // 1а [§6.4]: какво носи новата версия (promeni, sabrano) — за единния текст
    if (h.versiq > d.versiq && S.newVersiq !== h.versiq) {
      S.newVersiq = h.versiq; toast(nvTxt());
      // отворен лист „Одобряваш ли…“ за старата версия → вече не предлага одобрение (листът за новата версия — същият текст)
      if (sheetKind === 'approve' || sheetKind === 'sab') openNewVerSheet();
    }
    d.status = h.status; d.vpisan_pat = h.vpisan_pat;
    if (h.versiq === d.versiq) {
      d.hesh = h.hesh;
      // 1а: „събрано до“ се сменя и без нова версия (проверено — нищо ново); без колоните ключовете ги няма → нищо не се пипа
      if (h.sabrano !== undefined) d.sabrano = h.sabrano;
      if (h.promeni !== undefined) d.promeni = h.promeni;
    }
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
    var o = { ok: null, fix: [], kom: [], err: false, osp: false, dn: null, dnNe: null, ans: false, ansV: -1 }, bad = false;   // dn: последното 📘/🚫 (true/false) или null
    // 1а [§6.1]: ans/ansV — има ли мой ✓/✎/разяснение/оспорване и най-новата версия, за която е (за „отговор за стар текст“)
    function ansAt(vid, v) { if (ANS4[vid]) { o.ans = true; o.ansV = Math.max(o.ansV, v == null ? 1e9 : +v); } }
    // 📘/🚫 [К1, К2]: състоянието = последният ПРИЛОЖЕН избор по kogda (S.res е по kogda); последно вкараният (по id),
    // който тригерът НЕ е приложил („денят е одобрен“, „точката я няма“, „по-късен избор“) → dnNe — вижда се в картата
    var dnL = null, dnLast = null;
    // tekst 'отговорено' = „✓ Отговорено“ на решение (Таблото / заключен ден) — различно от „✓ вярно“ [К20]
    S.res.forEach(function (r) {
      if (r.tochka_id !== tid) return;
      ansAt(r.vid, r.versiq);
      if (r.vid === 'potvardi') o.ok = { at: r.kogda, pend: false, otg: r.tekst === 'отговорено' };
      if (r.vid === 'popravka') o.fix.push({ tekst: r.tekst, at: r.kogda, rez: r.rezultat, pend: false });
      if (r.vid === 'komentar') o.kom.push({ tekst: r.tekst, at: r.kogda, rez: r.rezultat, pend: false });
      if (r.vid === 'osporva') o.osp = true;
      if (r.vid === 'izkljuchi' || r.vid === 'vkljuchi') {
        if (!dnNeOf(r.rezultat)) dnL = r;
        if (!dnLast || insN(r) >= insN(dnLast)) dnLast = r;
      }
    });
    if (dnL) o.dn = dnL.vid === 'vkljuchi';
    if (dnLast && dnNeOf(dnLast.rezultat)) o.dnNe = { vid: dnLast.vid, why: dnNeOf(dnLast.rezultat) };
    // задържаният (5-те с „Отмени“) е направен, НЕ „чака връзка“ — без ⏳ [§5.6 т.3]
    (q || queue()).forEach(function (it) {
      if (it.tbl !== 'resheniq' || it.row.tochka_id !== tid) return;
      var pd = !isHeld(it);
      if (it.err) o.err = true;
      else ansAt(it.row.vid, it.row.versiq);
      if (it.row.vid === 'potvardi' && !it.err) o.ok = { at: it.at, pend: pd, otg: it.row.tekst === 'отговорено' };
      if (it.row.vid === 'potvardi' && it.err) bad = true;
      if (it.row.vid === 'popravka') o.fix.push({ tekst: it.row.tekst, at: it.at, pend: pd, err: it.err || '' });
      if (it.row.vid === 'komentar') o.kom.push({ tekst: it.row.tekst, at: it.at, pend: pd, err: it.err || '' });
      if ((it.row.vid === 'izkljuchi' || it.row.vid === 'vkljuchi') && !it.err) { o.dn = it.row.vid === 'vkljuchi'; o.dnNe = null; }
    });
    // отговорено от Таблото, докато денят тук е от по-старо зареждане (или от кеша) [К23]
    var c = TB.closed[tid];
    if (!o.ok && !bad && c && c.ok) o.ok = { at: c.at, pend: !c.sent && !!TB.inflight[tid], otg: true };
    return o;
  }
  // 📘 В дневника / 🚫 Не за дневника: моят последен избор, иначе tochki.v_dnevnika (по подразбиране — в дневника).
  // Точка без k (стара чернова без ⟦k⟧ в записа) не може да се изключи — работникът нямаше да знае кои редове.
  // Точка с k, който не стои в нито един ред на записа (напр. точка от раздел 12 — там номер не се слага), също не може:
  // работникът няма какво да махне → вместо бутон — сив пил „няма свой ред в записа“ (dnBezRed).
  function vDn(t, q) { var d = mine(t.id, q).dn; return d !== null ? d : t.v_dnevnika !== false; }
  var DNK = { md: null, ks: {} };   // номерата ⟦k⟧ в записа на деня — смятат се веднъж за текста
  function dnKs() {
    var md = String((S.den && S.den.zapis_md) || '');
    if (DNK.md !== md) {
      var ks = {};
      md.split('\n').forEach(function (l) { mdKs(l).forEach(function (k) { ks[k] = true; }); });
      DNK = { md: md, ks: ks };
    }
    return DNK.ks;
  }
  function dnMozhe(t) { return t.k != null && !!dnKs()[t.k]; }
  function dnBezRed(t) { return t.k != null && !dnKs()[t.k]; }
  // rezultat на izkljuchi/vkljuchi, който казва „не е сменено“ (тригерът в 007/008) → кратката причина, иначе ''
  function dnNeOf(rez) {
    var s = String(rez || '');
    if (/по-късен избор/i.test(s)) return 'по-късен избор вече е приложен';
    if (/няма я/i.test(s)) return 'точката я няма в текущата версия';
    if (/одобрен.*не е сменено|не е сменено/i.test(s)) return 'денят вече е одобрен';
    return '';
  }
  function insN(r) { return typeof r.id === 'number' ? r.id : Infinity; }   // ред от телефона (още без номер) = най-новият
  function findTk(k) { for (var i = 0; i < S.tochki.length; i++) if (S.tochki[i].k === k) return S.tochki[i]; return null; }
  function newPending() { return !!(S.den && S.newVersiq > S.den.versiq); }
  // Одобрен (или чакащ лаптопа) и вписан ден: поправка вече не влиза в записа — картите остават с „✓ Видях“, „✎ Поясни“ (разяснение) и „→ Задача“.
  function locked() { return !!S.den && apprState().k !== 'none'; }
  function okNoErr(l) { return l.some(function (f) { return !f.err; }); }
  // „чака отговор“ (лентата с дните, листът „Одобряваш ли…“): решение/непроверено без мой отговор — както досега [К25]
  function handled(t) { if (mineStar(t)) return false; var m = mine(t.id); return t.istina === 'provereno' || !!m.ok || okNoErr(m.fix) || okNoErr(m.kom); }
  // 1а [§4.2, §6.1]: мой отговор за СТАР текст — точката е обновена (obnovena_v) след версията на последния ми ✓/✎/разяснение/оспорване.
  // Отговорът остава на точката (същият ред по k), но не важи за новия текст → пак „за преглед“, докато не дам нов (или 🚫).
  // На одобрен/вписан ден — не (там вече няма какво да се потвърждава).
  function mineStar(t, q) {
    if (!t || t.obnovena_v == null || !S.den || locked()) return false;
    var m = mine(t.id, q);
    return m.ans && m.ansV < +t.obnovena_v;
  }
  function openCount() { var g = groupsOf(); return g.reshenie.concat(g.neprovereno).filter(function (t) { return !handled(t); }).length; }
  // Задачите към точка (базата + опашката, без отказаните); отменените се връщат отделно — те вече не затварят точката [К11]
  function tasksOf(tid, q) {
    var out = [];
    (q || queue()).forEach(function (it) { if (it.tbl === 'deistviq' && it.row.tochka_id === tid && !it.err) out.push(Object.assign({ _pend: !isHeld(it), _held: isHeld(it), _qid: it.qid, sazdadeno: it.at, id: 'q' + it.qid, status: 'zaqveno' }, it.row)); });
    S.deistviq.forEach(function (a) { if (a.tochka_id === tid && !out.some(function (x) { return x.klient_id && x.klient_id === a.klient_id; })) out.push(a); });
    return out;
  }
  function errOf(tid, q) { return (q || queue()).some(function (it) { return it.err && it.row && it.row.tochka_id === tid && (it.tbl === 'resheniq' || it.tbl === 'deistviq'); }); }
  // „Прегледана“ [§5.1]: мой запис (✓/поправка/разяснение/оспорване), задача към нея (без отменените), затворена от Таблото,
  // или локалното „✓ Видях“ (само промени/непроверени). istina='provereno' сама по себе си НЕ прави точката прегледана.
  // 🚫 „не за дневника“ прави прегледана само точка, която не чака отговор: решението остава отворено, докато не отговориш
  // (иначе отива в „✓ Решени“ без отговор, а Таблото и „Одобрявам“ го броят за отворено).
  function pregledana(t, q) {
    q = q || queue();
    var m = mine(t.id, q);
    if (m.dn === false && t.grupa !== 'reshenie') return true;
    if (mineStar(t, q)) return false;   // 1а: отговорът ми е за стар текст → пак за преглед (и задача не стига — текстът не е видян)
    if (m.ok || okNoErr(m.fix) || okNoErr(m.kom) || m.osp) return true;
    if (tasksOf(t.id, q).some(function (a) { return a.status !== 'otmeneno'; })) return true;
    if (TB.closed[t.id] && !errOf(t.id, q)) return true;
    if (t.grupa !== 'reshenie' && S.den && vidOf(S.den.id, t.id)) return true;
    return false;
  }
  // Етап 6: действието се вижда ВЕДНАГА — задържаният запис е в опашката, mine()/tasksOf() го виждат → картата вече е прегледана;
  // undoing(t) е истина, докато „Отмени“ е в лентата долу (само за сведение) [§5.6 т.11]
  function undoing(t) { return !!UNDO['pc:' + t.id]; }
  // „остават N“ — непрегледаните във всичките три групи (плочките, „Следващ ›“); различно от „чакат отговор“ [К25]
  function ostavat(list, q) { q = q || queue(); return list.filter(function (t) { return !pregledana(t, q); }).length; }
  var EMO = [
    [/няма данни|без данни/i, '⚠️'], [/достав|камион|пристига/i, '🚚'], [/кофражист|души|хора|работниц|присъстви/i, '👷'],
    [/акт\s*(№\s*)?\d|актове|чертеж|протокол|документ|писмо|разрешени|заповед/i, '📄'], [/фактур|плащан|оферт|\d\s*(лв|€)|евро/i, '💶'],
    [/кофраж/i, '🪵'], [/армир|арматур/i, '🔩'], [/бетон|кубчет|проби|mpa/i, '🧪'], [/зида|тухл|клинкер/i, '🧱'], [/снимк/i, '📸'], [/напомн/i, '🔔']
  ];
  // Имената на 12-те раздела на дневника — точно като в CHERNOVA-INSTRUKCII.md — и емотиконът на всеки по смисъл
  // (когато думите в текста не подскажат друг) [ETAP6 §5.1]
  var RAZDELI = ['Управленско резюме', 'Метеорологични и площадкови условия', 'Работна сила', 'Изпълнени дейности', 'Качество, приемания и бележки',
    'Доставки и материали', 'Задачи и срокове', 'Проблеми и отворени въпроси', 'Важна информация за ръководството', 'План за следващия ден',
    'Данни за потвърждение', 'Източници и статус'];
  var RAZ_EMO = ['📋', '🌡️', '👷', '🏗️', '🧪', '🚚', '📌', '⚠️', '❗', '📅', '❓', '🗂️'];
  // Един смисъл = един емотикон навсякъде (Табло И Ден) [К6]: първо думите от EMO, после разделът.
  function emoT(t) {
    var s = t.tekst || '';
    for (var i = 0; i < EMO.length; i++) if (EMO[i][0].test(s)) return EMO[i][1];
    return RAZ_EMO[(t.razdel || 0) - 1] || '🏗️';
  }
  var ISTINA = { saobshteno: ['съобщено', 'p-neutral'], provereno: ['✅ проверено', 'p-ok'], osporeno: ['оспорено', 'p-bad'] };
  // 1а [§4.7, §6.1]: + Приложения, C: и Чернова (пишат ги лаптопът/пазачът); те не застаряват по часа и не се броят в „N от M свежи“
  var IZ = { teams: ['Тиймс', '💬'], poshta: ['Поща', '✉️'], prisystvia: ['Присъствия', '👷'], intranet: ['Интранет', '🗂️'], server: ['Сървър', '🗄️'], laptop: ['Лаптоп', '💻'],
    prilojeniq: ['Приложения', '📎'], disk: ['C:', '💽'], chernova: ['Чернова', '📝'] };
  var IZ_RED = ['teams', 'poshta', 'intranet', 'prisystvia', 'prilojeniq', 'laptop', 'disk', 'chernova', 'server'];
  var SV_NEBROI = { disk: 1, chernova: 1, laptop: 1, prilojeniq: 1 };
  // Каналът на източник по истинските tip („Тиймс чат“, „Тиймс канал“, „Мейл“, „Протокол“, „Присъствия“, „Интранет“) [ETAP6 §5.3]:
  // чат + канал = един канал (Тиймс); 1а [§4.5]: „Метео“ — времето (Open-Meteo, модел за града); всичко друго — файл
  function kanalOf(tip) {
    var s = String(tip || '').trim();
    return /^тиймс/i.test(s) ? 'teams' : /^(мейл|поща)/i.test(s) ? 'mail' : /^интранет/i.test(s) ? 'intranet' : /^присъствия/i.test(s) ? 'pris' : /^метео/i.test(s) ? 'meteo' : 'file';
  }
  var KANAL = { teams: ['💬', 'Тиймс'], mail: ['✉️', 'мейл'], intranet: ['🗂️', 'Интранет'], pris: ['👷', 'Присъствия'], meteo: ['🌡️', 'времето'], file: ['📄', 'файл'] };
  var KANAL_RED = ['teams', 'mail', 'intranet', 'pris', 'meteo', 'file'];
  function tipEmo(tip) { return KANAL[kanalOf(tip)][0]; }
  // различните канали на източниците, в реда Тиймс, мейл, Интранет, Присъствия, файл
  function kanali(izv) { var m = {}; (izv || []).forEach(function (s) { m[kanalOf(s && s.tip)] = 1; }); return KANAL_RED.filter(function (k) { return m[k]; }); }
  // Бутонът „Източници“: от ≥ 2 канала → иконите + „N източника ›“; от един канал — номерата, както досега [§5.3 а]
  // kind: 'pc' (Преглед), 'fd' (Промени в Табло), 'dc' (решение в Табло — малък бутон горе вдясно)
  function srcBtn(izv, tid, a, kind) {
    var ch = kanali(izv), n = izv.length, lbl = n === 1 ? 'източник' : 'източника';
    if (ch.length >= 2) {
      return '<button type="button" class="srcb mk' + (kind === 'dc' ? ' dc-src' : '') + '" data-a="' + a + '" data-tid="' + esc(tid) + '" aria-label="' + esc('Източници: ' + n + ' — ' + ch.map(function (k) { return KANAL[k][1]; }).join(', ')) + '">' +
        '<span class="srcb-e" aria-hidden="true">' + ch.map(function (k) { return KANAL[k][0]; }).join('') + '</span><span class="srcb-n">' + n + (kind === 'dc' ? '' : ' ' + lbl) + '</span><span class="srcb-l">›</span></button>';
    }
    if (kind === 'dc') return '<button type="button" class="srcb dc-src" data-a="' + a + '" data-tid="' + esc(tid) + '" aria-label="Източници: ' + n + '"><span class="ref">' + n + '</span><span class="srcb-l">›</span></button>';
    return '<button type="button" class="srcb" data-a="' + a + '" data-tid="' + esc(tid) + '" aria-label="Източници: ' + n + '">' + izv.map(function (s) { return '<span class="ref">' + esc(s.n) + '</span>'; }).join('') + '<span class="srcb-l">' + lbl + ' ›</span></button>';
  }

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
    var och = '<button type="button" class="ochip och-sw" data-a="dObekt" aria-label="' + esc('Обект: ' + OBEKT[OBEKT_KOD][0] + ' — смени') + '">' + esc(OBEKT[OBEKT_KOD][0]) + ' <span aria-hidden="true">⇄</span></button>';
    var leg = '<div class="legend" aria-hidden="true"><span><i class="lg-ch"></i>чернова</span><span><i class="lg-od"></i>одобрен · чака лаптопа</span><span><i class="lg-vp"></i>вписан</span></div>';
    if (WIDE) {
      // широк екран [§6.2]: дните (вертикален списък, собствен скрол) · денят (скролва страницата) · „Избрана точка“ (собствен скрол)
      panPoint();
      screen.innerHTML = scrHead('day') + '<div class="pv3">' +
        '<aside class="pv3-d" aria-label="Дни"><div class="dl-h">' + och + '<span id="redDni">' + redChip('dni') + '</span></div>' +
          '<div class="dl" id="strip" role="tablist" aria-label="Дни" aria-orientation="vertical"></div>' + leg + '</aside>' +
        '<div class="pv3-m"><div id="fresh"></div><section id="sum"></section><section id="pris" class="pris-w"></section><div id="verInfo"></div><div id="groups" class="groups"></div>' +
          '<section id="full"></section><section id="izt" class="izt-w" aria-label="Източниците на деня"></section><div id="appr"></div><div id="apprNx"></div><section id="acts" class="actsec"></section></div>' +
        '<aside class="pv3-p" id="pan" aria-label="Избрана точка"><div id="panT"></div><section id="ph" class="phs-w" aria-label="Всички снимки на деня"></section></aside></div>';
    } else {
      screen.innerHTML = scrHead('day') +
        '<section class="strip-w"><div class="strip-h">' + och + '<span class="strip-r"><span class="small muted">' + esc(monthLbl()) + '</span><span id="redDni">' + redChip('dni') + '</span></span></div>' +
        '<div class="strip" id="strip" role="tablist" aria-label="Дни"></div>' + leg + '</section>' +
        '<div id="fresh"></div><section id="sum"></section><section id="pris" class="pris-w"></section><div id="verInfo"></div><div id="groups" class="groups"></div>' +
        '<section id="ph" class="phs-w" aria-label="Всички снимки на деня"></section><section id="full"></section>' +
        '<section id="izt" class="izt-w" aria-label="Източниците на деня"></section>' +
        '<div id="appr"></div><div id="apprNx"></div><section id="acts" class="actsec"></section>';
    }
    renderStrip(); renderFresh(); renderSum(); renderPris(); renderVerInfo(); renderGroups(); renderPh(); renderFull(); renderIzt(); renderAppr(); renderActs(); renderBanners();
    if (WIDE) renderPan(true);
    centerStrip();
    if (S.flash && S.den && S.flash.den === S.den.id) setTimeout(flashPoint, 80);   // от Таблото: точката светва
  }
  // Избраният ден — в средата на лентата (и при „Стари първо“); на широк екран — в средата на колоната с дните
  function centerStrip() {
    var st = $('#strip'), sel = $('#strip .sel');
    if (!st || !sel) return;
    if (WIDE) { var c = st.closest('.pv3-d'); if (c) c.scrollTop = Math.max(0, sel.offsetTop - (c.clientHeight - sel.offsetHeight) / 2); return; }
    st.scrollLeft = Math.max(0, sel.offsetLeft - (st.clientWidth - sel.offsetWidth) / 2);
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
    var sig = sigOf(), ch = sig !== S.sig;
    // картата „👷 Присъствия“ и „Пълен запис“ (📘/🚫 от другото устройство) — box() пише само разликата
    keepAnchor(function () { if (ch) { renderSum(); renderGroups(); } renderPris(); renderVerInfo(); if (ch) renderFull(); renderIzt(); });
    keepY(['#ph'], renderPh);   // снимките: box() пише само при промяна (напр. покритие ⇄ без покритие)
    if (WIDE) renderPan();
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
      '<p>За ' + esc(OBEKT[OBEKT_KOD][0]) + ' в облака още няма качен ден. Лаптопът пише черновата на деня в 19:00 и я обновява в 22:45 — тогава тя се появява тук с резюмето, точките за решение и бутона „Одобрявам“.</p>' +
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
    if (x.status === 'vpisana') return { cls: 'st-vp', mark: '✓', lbl: 'вписан', n: 0 };
    var cur = S.den && S.den.id === x.id;
    var q = liveQ().some(function (it) { return it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === x.id; });
    if (x.status === 'odobrena' || q || (cur && apprState().k !== 'none')) return { cls: 'st-od', mark: '⏳', lbl: 'одобрен, чака лаптопа', n: 0 };
    var n = cur ? openCount() : (S.counts[x.id] || 0);
    return { cls: 'st-ch', mark: n ? '<b class="cnt">' + n + '</b>' : '•', lbl: 'чернова' + (n ? ', ' + n + ' чакат' : ''), n: n };
  }
  // Широк екран: дните — вертикален списък със заглавия по месеци; хората — нето от Присъствия, иначе dni.hora [§6.2, §6.3]
  function stripWide(list) {
    var mo = '';
    return list.map(function (x) {
      var d = parseD(x.data), sel = !!(S.den && S.den.id === x.id), st = stripState(x), m = cap(MES[d.getMonth()]) + ' ' + d.getFullYear();
      var pr = prisOf(x.obekt || OBEKT_KOD, x.data), hv = pr ? pr.neto : horaOf(x);
      var h = m !== mo ? '<div class="dl-m" role="presentation">' + esc(m) + '</div>' : '';
      mo = m;
      return h + '<button type="button" class="dl-i ' + st.cls + (sel ? ' sel' : '') + '" role="tab" aria-selected="' + sel + '" data-a="day" data-id="' + esc(x.id) + '" aria-label="' +
        esc(dayTitle(x.data) + ' — ' + st.lbl + (hv != null ? ', ' + hv + ' души' + (pr ? ' по Присъствия' : '') : '')) + '">' +
        '<span class="dl-d"><b>' + DNI_K[d.getDay()] + '</b> ' + ddmm(d) + '</span>' +
        '<span class="dl-s">' + (st.cls === 'st-vp' ? '✓ вписан' : st.cls === 'st-od' ? '⏳ одобрен' : st.n ? '<b class="cnt">' + st.n + '</b> чакат' : 'чернова') + '</span>' +
        '<span class="dl-p">' + (hv != null ? '👷 ' + hv : '') + '</span></button>';
    }).join('');
  }
  function renderStrip() {
    var el = box('#strip'); if (!el) return;
    var keep = el.scrollLeft, list = red('dni') === 'stari' ? S.dni.slice().reverse() : S.dni;   // „Стари първо“ — най-старият вляво (§4)
    if (WIDE) { el.innerHTML = stripWide(list); return; }
    el.innerHTML = list.map(function (x) {
      var d = parseD(x.data), sel = !!(S.den && S.den.id === x.id), st = stripState(x);
      return '<button type="button" class="sd ' + st.cls + (sel ? ' sel' : '') + '" role="tab" aria-selected="' + sel + '" data-a="day" data-id="' + esc(x.id) + '" aria-label="' + esc(dayTitle(x.data) + ' — ' + st.lbl) + '">' +
        '<span class="sd-w">' + DNI_K[d.getDay()] + '</span><span class="sd-n">' + d.getDate() + '</span><span class="sd-s">' + st.mark + '</span></button>';
    }).join('');
    el.scrollLeft = keep;
  }
  // Свежест по истинския график [ETAP6 §3.5, §5.7 — с ПРОМЯНАТА 08.10]: Тиймс, Поща, Присъствия, Интранет ги чете пазачът на 2 ч
  // (07–21) + сутрешният пуск → денем (09:30–20:59) застарял при > 3 ч от последното четене; нощем (21:00–09:29) — само ако след
  // 07:00 на последния работен ден (сега ≥ 21:00 → днес 07:00; сега < 09:30 → вчера 07:00) няма четене, т.е. целия ден нищо не е
  // четено; винаги — при ok = false. ПОПРАВКА 13.10 (беше 17:00): лаптопът спал вечерта и събуден нощем → до 07:00 няма четене
  // (пазачът не чете 21:00–06:59) и ⚠️ стоеше цяла нощ, без РП да може нещо [§3.5, F9].
  // Сървърът (и лаптопът) — по старото правило (STALE_H). T = „сега“ в ms; при спящ лаптоп — часът, в който е заспал.
  var SV_GRAF = { teams: 1, poshta: 1, prisystvia: 1, intranet: 1 };
  function svOld(s, T) {
    T = T == null ? nowMs() : T;
    var t = s ? Date.parse(s.posledno) : NaN;
    if (!s || s.ok === false || isNaN(t)) return true;
    if (!SV_GRAF[s.izvor]) return (T - t) / 3600000 > STALE_H;
    var d = new Date(T), m = d.getHours() * 60 + d.getMinutes();
    if (m >= 570 && m < 1260) return T - t > 3 * 36e5;
    return t < new Date(d.getFullYear(), d.getMonth(), d.getDate() - (m < 570 ? 1 : 0), 7, 0, 0, 0).getTime();
  }
  function fresh(s) { return !svOld(s); }
  // Лаптопът спи: пазачът пише svezhest.laptop на 2 мин — по-старо от 15 мин → {spi, ot: 'ЧЧ:ММ' / 'вчера ЧЧ:ММ' / 'ДД.ММ ЧЧ:ММ', T} [§3.5]
  function svSpi() {
    var s = svOf('laptop'), t = s ? Date.parse(s.posledno) : NaN;
    if (isNaN(t) || nowMs() - t <= 15 * 60000) return { spi: false, T: nowMs() };
    var d = new Date(t), n = now(), y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    return { spi: true, T: t, ot: sameDay(d, n) ? hhmm(d) : sameDay(d, y) ? 'вчера ' + hhmm(d) : ddmm(d) + ' ' + hhmm(d) };
  }
  function spiTxt(sp) { return '💻 Лаптопът спи от ' + sp.ot + ' — данните ще се обновят, щом се включи'; }
  // застарял: при спящ лаптоп — само ако е бил застарял още към заспиването (кехлибарено); иначе — по графика
  function svWarn(s, sp) { return sp.spi ? s.izvor !== 'laptop' && svOld(s, sp.T) : svOld(s); }
  function sortSv(list) { return (list || []).slice().sort(function (a, b) { var i = IZ_RED.indexOf(a.izvor), j = IZ_RED.indexOf(b.izvor); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); }); }
  // sel — контейнерът (Ден: #fresh, Табло: #tb-fresh); compact — 1 ред, по име само застарелите [К3, К17]
  // 1а [§4.7]: свободното място на C: — кехлибарено под 15 GB, червено под 8 GB (без значение колко е стар редът)
  function diskLvl(s) { var g = s ? +s.broi : NaN; return !s || s.broi == null || isNaN(g) ? 0 : g < 8 ? 2 : g < 15 ? 1 : 0; }
  function diskHtml(s) { var l = diskLvl(s); return l ? '<span class="fr-disk' + (l > 1 ? ' bad' : '') + '">💽 C: ' + esc(Math.floor(+s.broi)) + ' GB ⚠️</span>' : ''; }
  function renderFresh(sel, compact) {
    var el = box(sel || '#fresh'); if (!el) return;
    if (!sel && view === 'day' && sabOn()) { renderSab(el); return; }   // 1а [§6.2]: чернова със „събрано до“ → лентата „📥 Събрано до …“
    // 1а [§6.7]: C:, Чернова, Лаптоп и Приложения не се броят в „N от M свежи“; C: — само при < 15 GB
    var all = sortSv(S.svezhest), list = all.filter(function (s) { return !SV_NEBROI[s.izvor]; }), dk = diskHtml(svOf('disk'));
    if (!list.length) { el.innerHTML = '<button type="button" class="fresh warn" data-a="fresh">⚠️ Свежест: лаптопът още не е пратил данни за източниците</button>'; return; }
    var sp = svSpi();
    if (sp.spi) {
      // лаптопът спи → ЕДИН спокоен сив ред (без ⚠️) + кехлибарено само застарялото още преди заспиването [§5.7]
      var old0 = list.filter(function (s) { return svWarn(s, sp); });
      var oh = old0.map(function (s) { return esc(IZ[s.izvor] ? IZ[s.izvor][0] : s.izvor) + ' ⚠️ ' + esc(rel(s.posledno)); });
      if (compact) {
        el.innerHTML = '<button type="button" class="fresh one sleep" data-a="fresh" aria-label="Свежест на източниците — подробно"><span class="fr-l">' + esc(spiTxt(sp)) +
          (oh.length ? ' · <span class="fr-old">' + oh.join(' · ') + '</span>' : '') + (dk ? ' · ' + dk : '') + '</span><span class="fr-go" aria-hidden="true">›</span></button>';
        return;
      }
      el.innerHTML = '<button type="button" class="fresh sleep" data-a="fresh" aria-label="Свежест на източниците — подробно"><span class="fr-u">' + esc(spiTxt(sp)) + '</span>' +
        old0.map(function (s, i) { return '<span class="fr old">' + oh[i].replace(' ⚠️ ', ' ⚠️ <span class="mono">') + '</span></span>'; }).join('') + (dk ? '<span class="fr">' + dk + '</span>' : '') + '</button>';
      return;
    }
    var okT = list.filter(fresh).map(function (s) { return Date.parse(s.posledno); });
    if (compact) {
      var old = list.filter(function (s) { return !fresh(s); });
      var txt = !old.length ? '✓ Всички ' + list.length + ' източника свежи · до ' + esc(rel(Math.max.apply(null, okT))) :
        (okT.length ? '✓ ' : '⚠️ ') + okT.length + ' от ' + list.length + ' свежи · <span class="fr-old">' +
        old.map(function (s) { return esc(IZ[s.izvor] ? IZ[s.izvor][0] : s.izvor) + ' ⚠️ ' + esc(rel(s.posledno)); }).join(' · ') + '</span>';
      el.innerHTML = '<button type="button" class="fresh one" data-a="fresh" aria-label="Свежест на източниците — подробно"><span class="fr-l">' + txt + (dk ? ' · ' + dk : '') + '</span><span class="fr-go" aria-hidden="true">›</span></button>';
      return;
    }
    el.innerHTML = '<button type="button" class="fresh" data-a="fresh" aria-label="Свежест на източниците — подробно">' +
      '<span class="fr-u">' + (okT.length ? 'Данни до ' + esc(rel(Math.max.apply(null, okT))) : '⚠️ Няма свежи данни') + '</span>' +
      list.map(function (s) {
        var f = fresh(s), nm = IZ[s.izvor] ? IZ[s.izvor][0] : s.izvor;
        return '<span class="fr ' + (f ? 'ok' : 'old') + '">' + esc(nm) + ' ' + (f ? '✓' : '⚠️') + ' <span class="mono">' + esc(rel(s.posledno)) + '</span></span>';
      }).join('') + (dk ? '<span class="fr">' + dk + '</span>' : '') + '</button>';
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
    S.sig = sigOf();
  }
  function grpHtml(G, arr, q) {
    var open = [], rev = [];
    // Етап 6 [§5.6]: прегледаната карта отива в „Прегледани“ веднага (и докато „Отмени“ е в лентата долу)
    arr.forEach(function (t) { if (pregledana(t, q)) rev.push(t); else open.push(t); });
    var left = open.length;
    var h = '<div class="grp-h" data-anc="g' + G.k + '"><h2>' + G.t + '</h2><span class="grp-n">' + arr.length + '</span>' +
      (arr.length ? '<span class="grp-l' + (left ? '' : ' ok') + '">' + (left ? 'остават ' + left + ' от ' + arr.length : '✓ всичко') + '</span>' : '') + '</div>' +
      '<p class="grp-s">' + G.s + '</p>';
    if (!arr.length) return h + '<p class="grp-e">' + G.e + '</p>';
    h += open.map(function (t) { return pointCard(t); }).join('');
    // „✓ Видях останалите (N)“ — 1 докосване вместо N (само промени и непроверени) [К25]; „Отмени“ — в лентата долу [§5.6]
    if (G.k !== 'reshenie' && left > 1) h += '<button type="button" class="btn ghost seen-all" data-a="seenAll" data-g="' + G.k + '">✓ Видях останалите (' + left + ')</button>';
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
    else if (ts.length) { var a = ts[0], v = vidIme(a) || ['📌', 'задача']; r = { ico: v[0], st: v[1] + ' · ' + stOf(a)[0] }; }
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
    var lk = locked(), res = t.grupa === 'reshenie', tid = esc(t.id), err = errOf(t.id, q);
    var ph = tPhotos(t), ts = tasksOf(t.id, q), wp = res ? waitPill(S.den ? S.den.data : '') : null;
    // долу в реда с етикетите: заключен ден / ред без номер → старият пил; иначе само състоянието „🚫 няма да влезе“ (бутонът е в реда с действията)
    var vd0 = vDn(t, q), dnB = (lk || dnBezRed(t)) ? dnBtn(t, vd0, lk) : (vd0 ? '' : '<span class="pill p-izk">🚫 няма да влезе в дневника</span>'), wsel = WIDE && view === 'day';
    var head = rv ? '<button type="button" class="rev-r on" data-a="revCard" data-tid="' + tid + '" aria-expanded="true"><span class="rev-i" aria-hidden="true">' + revInfo(t, q).ico + '</span>' +
      '<span class="rev-t">' + esc(revInfo(t, q).st) + '</span><span class="chev" aria-hidden="true">▴</span></button>' : '';
    var b1, star = mineStar(t, q);
    // 1а [§6.4]: отговорът ми е за стар текст → „✓ Още е вярно“ (нов ✓ за показаната версия)
    if (star) b1 = '<button type="button" class="pa pa-ok pa-star" data-a="okStar" data-tid="' + tid + '">✓ Още е вярно</button>';
    else if (res) b1 = '<button type="button" class="pa pa-ok" data-a="ok" data-tid="' + tid + '"' + (m.ok ? ' disabled aria-pressed="true"' : '') + '>' + (m.ok ? '✓ отговорено' : '✓ Отговорено') + '</button>';
    else if (!lk && t.istina !== 'provereno') b1 = '<button type="button" class="pa pa-ok" data-a="ok" data-tid="' + tid + '"' + (m.ok ? ' disabled aria-pressed="true"' : '') + '>' + (m.ok ? '✓ вярно' : '✓ Вярно') + '</button>';
    else { var vd = S.den && vidOf(S.den.id, t.id); b1 = '<button type="button" class="pa pa-ok" data-a="seen" data-tid="' + tid + '"' + (vd ? ' disabled aria-pressed="true"' : '') + '>' + (vd ? '✓ видях' : '✓ Видях') + '</button>'; }
    // широк екран: клик върху картата (не върху бутон) → панелът „Избрана точка“ [§6.2]
    return '<article class="pc' + (hot ? ' hot' : '') + (vd0 ? '' : ' izk') + (rv ? ' rv' : (!pregledana(t, q) ? ' nx' : '')) + (wsel && S.selT === t.id ? ' sel' : '') + '" data-tid="' + tid + '"' + (rv ? '' : ' data-anc="p' + tid + '"') + (wsel ? ' data-a="pcSel"' : '') + '>' + head +
      '<div class="pc-in">' +
      (wp ? '<div class="pc-w"><span class="pill ' + wp[1] + '">' + wp[0] + '</span>' + (err ? '<button type="button" class="pill p-warn pc-errb" data-a="qerr">⚠️ не се записа — виж</button>' : '') + '</div>'
        : err ? '<div class="pc-w"><button type="button" class="pill p-warn pc-errb" data-a="qerr">⚠️ не се записа — виж</button></div>' : '') +
      '<div class="pc-b"><span class="pc-e" aria-hidden="true">' + emoT(t) + '</span><p class="pc-t">' + esc(t.tekst) + '</p></div>' +
      wasHtml(t, m) + prdHtml(t, q) +   // 1а: „беше: …“ (обновена точка с мой отговор) · „↳ продължение на …“
      (ph && ph.length ? phRowHtml(ph, 'pcPh', 'data-tid="' + tid + '"') : '') +
      m.fix.map(function (f) {
        return '<div class="pc-fix"><b>✎ Твоята поправка:</b> ' + esc(f.tekst) + '<span class="pc-fs">' + (f.err ? '⚠️ не се записа — виж лентата горе' : f.pend ? '⏳ чака връзка' : '⏳ ' + esc(f.rez || 'чака Claude')) + '</span></div>';
      }).join('') +
      m.kom.map(function (f) {
        // разяснение на заключен ден: Claude не обработва вписани дни → „💬 записано“, не „чака Claude“ завинаги [К26]
        return '<div class="pc-fix kom"><b>💬 Твоето разяснение:</b> ' + esc(f.tekst) + '<span class="pc-fs">' + (f.err ? '⚠️ не се записа — виж лентата горе' : f.pend ? '⏳ чака връзка' : lk && (!f.rez || /чака Claude/i.test(f.rez)) ? '💬 записано' : f.rez ? esc(f.rez) : '⏳ чака Claude') + '</span></div>';
      }).join('') +
      ts.map(function (a) {
        var v = vidIme(a) || ['📌', 'Задача'], s = stOf(a);
        return '<button type="button" class="pc-task" data-a="zad" data-id="' + esc(a.id) + '"><span aria-hidden="true">' + v[0] + '</span> <span class="pc-tt">' + esc(v[1]) + ': ' + esc(clip(a.tekst, 80)) + '</span> <span class="pill ' + s[1] + '">' + esc(s[0]) + '</span></button>';
      }).join('') +
      '<div class="pc-m">' + verPills(t) + '<span class="pill ' + ist[1] + '">' + ist[0] + '</span>' +
        (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') +
        (star ? '<span class="pill p-warn">✓ беше за v' + esc(m.ansV) + ' — още ли е вярно?</span>'
          : m.ok ? '<span class="pill p-mine">' + (m.ok.pend ? (m.ok.otg ? '⏳ отговорът чака връзка' : '⏳ потвърждение чака връзка') : (m.ok.otg ? '✓ отговорено от теб' : '✓ вярно от теб')) + '</span>' : '') + dnB + (m.dnNe && dnMozhe(t) ? dnNeHtml(m.dnNe) : '') +
        izPillsHtml(t) + prisPillHtml(t) +
        (izv.length ? srcBtn(izv, t.id, 'src', 'pc') : '<span class="pill p-warn">няма източник</span>') +
      '</div></div>' +
      // Етап 6 [§5.6]: без приглушена карта с „Отмени“ — действието се вижда веднага, „Отмени“ е в лентата долу.
      // Редът с действията (375 px): ред 1 — ✓ · ✎ · →; ред 2 — само на чернова, когато 🚫 се полага [§5.5]
      '<div class="pc-a">' + b1 +
        '<button type="button" class="pa" data-a="fix" data-tid="' + tid + '">✎ Поясни</button>' +
        '<button type="button" class="pa" data-a="act" data-tid="' + tid + '">→ Задача</button>' +
        // 07.10: ясен бутон на свой ред (сивият пил долу не се разпознаваше като бутон)
        (!lk && dnMozhe(t) ? '<button type="button" class="pa pa-dn' + (vd0 ? '' : ' off') + '" data-a="dn" data-tid="' + tid + '" aria-pressed="' + !vd0 + '" aria-label="' + (vd0 ? 'Не включвай в дневника' : 'Върни в дневника') + '">' + (vd0 ? '🚫 Не включвай в дневника' : '📘 Върни в дневника') + '</button>' : '') +
      '</div></article>';
  }
  // F2 (б) [§5.3]: пил „🗂️ #7888“ (до 3 на карта) — от източник „Интранет“ с tid и от текста САМО с контекст („задача …“, „Интранет …“) и
  // само ако числото е задача в списъка на Интранета (голо „№ 4521“ може да е фактура/акт/протокол); тап → листът на задачата
  var IZ_TXT_RE = /(?:задача|Интранет)[^0-9]{0,12}(?:№|#)?\s?(\d{4,5})/gi;
  function izTids(t) {
    var out = [];
    function add(n) { if (n && out.indexOf(n) < 0) out.push(n); }
    (t.izvori || []).forEach(function (s) { if (s && kanalOf(s.tip) === 'intranet' && /^\d{1,6}$/.test(String(s.tid == null ? '' : s.tid))) add(+s.tid); });
    var tx = String(t.tekst || ''), m;
    IZ_TXT_RE.lastIndex = 0;
    if (IZ_TXT_RE.test(tx)) {
      // списъкът от Етап 5 — при нужда (кешът му важи); след неуспех — не пак от рисуването (без порой от заявки)
      izInit(); if (!IZT.rows && !IZT.busy && !IZT.st) izLoad();
      IZ_TXT_RE.lastIndex = 0;
      while ((m = IZ_TXT_RE.exec(tx))) { if (izFind(+m[1])) add(+m[1]); }
    }
    IZ_TXT_RE.lastIndex = 0;
    return out.slice(0, 3);
  }
  function izPillsHtml(t) {
    return izTids(t).map(function (n) { return '<button type="button" class="pill p-iz" data-a="izad" data-tid="' + n + '" aria-label="' + esc('Задача от Интранета №' + n + ' — отвори') + '">🗂️ #' + n + '</button>'; }).join('');
  }
  // F2 (в): пил „👷 Присъствия: нето N“ — САМО на една точка на деня: с източник от Присъствия, иначе първата от раздел 3 с
  // числото на хората в текста; кехлибарено „≠ M в деня“, ако черновата казва друго [§5.3 в]
  function prisPillT() {
    var d = S.den; if (!d || !prisOk()) return null;
    var p = prisOf(d.obekt || OBEKT_KOD, d.data); if (!p) return null;
    var hv = horaOf(d), cards = S.tochki.filter(function (t) { return t.grupa !== 'fakt'; });
    var a = cards.filter(function (t) { return (t.izvori || []).some(function (s) { return kanalOf(s && s.tip) === 'pris'; }); })[0];
    if (!a) {
      var nums = [p.neto].concat(hv != null && hv !== p.neto ? [hv] : []);
      a = cards.filter(function (t) { return t.razdel === 3 && nums.some(function (n) { return new RegExp('(^|[^0-9])' + n + '([^0-9]|$)').test(String(t.tekst || '')); }); })[0];
    }
    return a ? { tid: a.id, p: p, hv: hv } : null;
  }
  function prisPillHtml(t) {
    var x = PPT.den === (S.den && S.den.id) && PPT.sig === prisSig() ? PPT.v : (PPT = { den: S.den && S.den.id, sig: prisSig(), v: prisPillT() }).v;
    if (!x || x.tid !== t.id) return '';
    var raz = x.hv != null && x.hv !== x.p.neto;
    return '<button type="button" class="pill ' + (raz ? 'p-warn' : 'p-neutral') + ' p-pris" data-a="prisT">👷 Присъствия: нето ' + x.p.neto + (raz ? ' ≠ ' + x.hv + ' в деня' : '') + '</button>';
  }
  var PPT = { den: null, sig: '', v: null };
  function prisSig() { var d = S.den; if (!d) return ''; var p = prisOk() ? prisOf(d.obekt || OBEKT_KOD, d.data) : null; return d.versiq + ':' + (p ? p.neto : '-') + ':' + d.hora + ':' + S.tochki.length; }
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
  // „📄 Пълен запис“ = както ще се впише. Ред с маркер на точка с k е докосваем → „От кои точки е този ред“ (📘/🚫 и за
  // фактите, които нямат карта) [§6.1 т.1]; „Покажи и изключените“ — задраскани, докосваеми за връщане [т.2].
  function renderFull() {
    var el = box('#full'); if (!el) return;
    if (!S.den) { el.innerHTML = ''; return; }
    var show = !!S.izkShow, ch = zapisChist(S.den.zapis_md || ''), tk = {}, tap = false;
    S.tochki.forEach(function (t) { if (t.k != null) tk[t.k] = 1; });
    var items = ch.redove.filter(function (x) { return show || !x.izk; });
    items.forEach(function (x) { x.tap = !!(x.ks.length && x.ks.some(function (k) { return tk[k]; })); if (x.tap) tap = true; });
    var n = (ch.chist.match(/^##\s/mg) || []).length, nIz = ch.skriti + ch.avto;   // заглавието брои ОСТАНАЛИТЕ раздели [§5.8]
    var izB = '<button type="button" class="lnk md-izk-b" data-a="mdIzk" aria-pressed="' + show + '">' + (show ? 'Скрий изключените' : 'Покажи и изключените (' + nIz + ')') + '</button>';
    el.className = '';
    el.innerHTML = '<details class="full card" id="fullD"' + (S.fullOpen ? ' open' : '') + '><summary><span>📄 Пълен запис' + (n ? ' (' + n + ' ' + pl(n, 'раздел', 'раздела') + ')' : '') + '</span><span class="chev" aria-hidden="true">▾</span></summary>' +
      (ch.skriti ? '<div class="md-izk"><span>🚫 ' + ch.skriti + (ch.skriti === 1 ? ' ред не влиза' : ' реда не влизат') + ' в дневника (точки „не за дневника“) — по-долу е записът, както ще се впише.</span>' + izB + '</div>'
        // само празни раздели/заместители (махат се сами — както в Word) → спокоен ред, не кехлибарен
        : ch.avto ? '<div class="md-izk calm"><span>' + (ch.razdeli ? ch.razdeli + ' ' + pl(ch.razdeli, 'празен раздел не се пише', 'празни раздела не се пишат') : 'Празните редове не се пишат') + ' — по-долу е записът, както ще се впише в Word.</span>' + izB + '</div>' : '') +
      (ch.err ? '<p class="warnline md-err">⚠️ В записа има счупен маркер ⟦…⟧ — лаптопът няма да впише деня, докато Claude не го поправи.</p>' : '') +
      (tap ? '<p class="md-tip small muted">Докосни ред, за да видиш от коя точка е — и дали влиза в дневника.</p>' : '') +
      '<div class="md">' + (ch.chist.trim() ? md2html(items, refMap()) : '<p class="muted">Черновата още няма пълен запис.</p>') + '</div></details>';
  }
  // ⟦k⟧ — същият регекс като ailab-lib.ps1 $script:AiMarkerRe [§3.1]
  var MARK_RE = /\s*⟦\s*(\d{1,3}(?:\s*,\s*\d{1,3})*)\s*⟧/g;
  var TBL_RE = /^\s*\|.*\|\s*$/;
  function mdKs(l) {
    var ks = [], m; MARK_RE.lastIndex = 0;
    while ((m = MARK_RE.exec(l))) m[1].split(',').forEach(function (k) { ks.push(+k.trim()); });
    MARK_RE.lastIndex = 0;
    return ks;
  }
  function tblSep(t) { return t.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').every(function (c) { return /^\s*:?-{2,}:?\s*$/.test(c); }); }
  // ред от таблица при махането — както Test-AiTablRed и build-master-docx.ps1: започва с „|“ (затварящото „|“ не е задължително)
  function tblRed(t) { return /^\s*\|/.test(t); }
  // етикет: ред, който завършва на „:“, или цял **…** (Word го прави удебелено подзаглавие) — без заглавия и таблици [К8]
  // (същото като Test-AiEtiket в ailab-lib.ps1)
  function mdEtiket(t) { var s = t.trim(); return !!s && !/^#/.test(s) && !tblRed(s) && (/:$/.test(s) || /^\*\*.+\*\*$/.test(s)); }
  // „📄 Пълен запис“ = точно това, което отива в .md и Word: махането при вписване, едно и също с Get-AiZapisChist
  // (ailab-lib.ps1) и tools\markeri-primeri.json [К10] — правилата на ETAP6-SPEC §3.4; izk = {k: true}. Ред: 1 → 7 → 2 → 6/6б → 3 → 4 → 5.
  //  1) ред с ⟦…⟧ вън, само ако ВСИЧКИТЕ му номера са изключени;
  //  7) заместителите вън: ред в раздели 1–11 без ⟦…⟧, който (след „- “/„* “/„• “ и крайната точка) е точно „Не е постъпила
  //     информация“, „Няма постъпила информация“, „Няма информация“, „Няма данни“, „Няма“, „Без информация“, „—“, „–“, „-“, „n/a“;
  //  2) таблица (поредни редове, започващи с „|“; глава = първият ред) без нито един останал ред с данни → вън цялата
  //     (вкл. таблица само с глава и разделител);
  //  6) етикет („…:“ или цял **…**), под който (до празен ред/заглавие/„---“/следващ етикет) е ИМАЛО редове и всички са махнати → вън;
  //  6б) етикет БЕЗ свой ⟦k⟧, под който няма нищо, а следващият непразен ОСТАНАЛ ред е „## “, „---“ или краят → вън (отдолу нагоре;
  //     етикет със свой неизключен ⟦k⟧ никога — той е ред-факт);
  //  3) раздел „## N. …“ (N = 1…11) без останал ред със съдържание (празните и „---“ не са) → вън целият, заглавието с празните му
  //     редове и „---“; номерата на останалите НЕ се сменят (О1); раздел 12 — никога;
  //  4) от останалите — маркерите и интервалите в края; поредни празни редове → един; празните в началото и в края → вън;
  //  5) останал ⟦ или ⟧ → err (лаптопът не пише).
  // o.star — старото правило (Етап 5: без 7, 6б, новото 2 и новото 3; празен раздел → „- Не е постъпила информация.“) — за дни,
  // вписани преди Етап 6 със заместител в записа: същото като вече написания Word [§3.4 „Вече вписани дни“].
  // → { chist, redove: [{t, ks, izk, r1 (т. 1), auto (7, 2, 6, 3), pr (заглавие на празен раздел)}] — всички редове по реда им,
  //     skriti (т. 1), avto (махнатите сами, без празните), razdeli (махнатите раздели), err }
  var ZAMEST = ['не е постъпила информация', 'няма постъпила информация', 'няма информация', 'няма данни', 'няма', 'без информация', '—', '–', '-', 'n/a'];
  // заместител — като Test-AiZamestitel: ред БЕЗ ⟦/⟧ (и счупен маркер не е), точно един от списъка; дали е в 1–11 гледа викащият
  function zamest(raw) {
    var s = String(raw == null ? '' : raw);
    if (/[⟦⟧]/.test(s)) return false;
    var t = s.trim().replace(/^[-*•]\s+/, '').replace(/\.$/, '').trim();
    return !!t && ZAMEST.indexOf(t.toLowerCase()) >= 0;
  }
  // записът има ли заместител в раздели 1–11 (т.е. е от преди Етап 6)
  function imaZamest(md) {
    var r = 0;
    return String(md || '').replace(/\r\n?/g, '\n').split('\n').some(function (l) {
      var m = /^## (\d{1,2})\. /.exec(l); if (m) { r = +m[1]; return false; }
      return r >= 1 && r <= 11 && zamest(l);
    });
  }
  function zapisMahni(md, izk, o) {
    if (o && o.star) return zapisMahniStar(md, izk);
    izk = izk || {};
    var ima = Object.keys(izk).length > 0, i, j, x, g;
    var raw = String(md == null ? '' : md).replace(/\r\n?/g, '\n').replace(/\u0000/g, '').split('\n'), n = raw.length;
    var L = raw.map(function (l) { return { t: l.replace(MARK_RE, '').replace(/\s+$/, ''), ks: mdKs(l), izk: false }; });
    var razd = [], glavi = [], tek = 0, nR = 0;
    for (i = 0; i < n; i++) { var mh = /^## (\d{1,2})\. /.exec(raw[i]); if (mh) { tek = +mh[1]; glavi.push(i); } razd.push(tek); }
    function van(y) { if (!y.izk) { y.izk = true; y.auto = true; } }
    // 1) редовете само от изключени точки
    // e1 = махнат ЗАРАДИ изключване от РП (т. 1 или таблица с данни, махнати по т. 1) — за т. 6 при етикет със свой ⟦k⟧ [поправка 13.10]
    if (ima) L.forEach(function (y) { if (y.ks.length && y.ks.every(function (k) { return izk[k]; })) { y.izk = true; y.r1 = true; y.e1 = true; } });
    // 7) заместителите в раздели 1–11
    for (i = 0; i < n; i++) { if (!L[i].izk && razd[i] >= 1 && razd[i] <= 11 && !/^## \d{1,2}\. /.test(raw[i]) && zamest(raw[i])) van(L[i]); }
    // 2) таблица без нито един останал ред с данни (вкл. само глава и разделител)
    for (i = 0; i < n;) {
      if (!tblRed(L[i].t)) { i++; continue; }
      j = i; while (j < n && tblRed(L[j].t)) j++;
      var ost = 0, danni = 0;
      for (x = i + 1; x < j; x++) if (!tblSep(L[x].t)) { danni++; if (!L[x].izk) ost++; }
      if (!ost) for (x = i; x < j; x++) { van(L[x]); if (danni) L[x].e1 = true; }   // с данни → махнати са по т. 1
      i = j;
    }
    // 6) и 6б) етикетите — отдолу нагоре (6б гледа следващия ОСТАНАЛ ред)
    function krai(y) { var s = y.t.trim(); return !s || /^#/.test(s) || /^-{3,}$/.test(s) || mdEtiket(y.t); }
    for (i = n - 1; i >= 0; i--) {
      if (L[i].izk || !mdEtiket(L[i].t)) continue;
      var had = 0, left = 0, neE1 = 0;
      for (j = i + 1; j < n; j++) { if (krai(L[j])) break; had++; if (!L[j].izk) left++; else if (!L[j].e1) neE1++; }
      // етикет със свой НЕизключен ⟦k⟧ е ред-факт: вън само ако всичко под него е махнато заради изключване (не по 7 или 2) [§3.4]
      if (had && !left) { if (!L[i].ks.some(function (k) { return !izk[k]; }) || !neE1) van(L[i]); continue; }
      if (!had && !L[i].ks.length) {
        var y = i + 1;
        while (y < n && (L[y].izk || !raw[y].trim())) y++;
        if (y >= n || raw[y].indexOf('## ') === 0 || /^-{3,}$/.test(L[y].t.trim())) van(L[i]);
      }
    }
    // 3) празен раздел 1–11 → вън целият; раздел 12 — никога
    for (g = 0; g < glavi.length; g++) {
      var h = glavi[g]; if (razd[h] < 1 || razd[h] > 11) continue;
      var kraj = g + 1 < glavi.length ? glavi[g + 1] : n, im = false;
      for (x = h + 1; x < kraj; x++) { var s0 = L[x].izk ? '' : L[x].t.trim(); if (s0 && !/^-{3,}$/.test(s0)) { im = true; break; } }
      if (!im) { for (x = h; x < kraj; x++) van(L[x]); L[h].pr = true; nR++; }
    }
    // 4) останалите — поредни празни → един; без празни в началото и в края
    var out = [];
    L.forEach(function (y) {
      if (y.izk) return;
      if (!y.t.trim()) { if (!out.length || out[out.length - 1] === '') return; out.push(''); return; }
      out.push(y.t);
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    var chist = out.join('\n');
    return { chist: chist, md: chist, redove: L, skriti: L.filter(function (y) { return y.r1; }).length,
      avto: L.filter(function (y) { return y.auto && y.t.trim(); }).length, razdeli: nR, err: /[⟦⟧]/.test(chist) };
  }
  // Старото правило (Етап 5, ETAP5 §3.1) — БЕЗ ПРОМЯНА; само за дни, вписани преди Етап 6 (= Get-AiZapisChist -Star):
  //  1) ред с маркери вън, само ако ВСИЧКИТЕ му номера са изключени; 4) от останалите — маркерите и интервалите в края;
  //  2) таблица, която е имала ред с данни и всичките са махнати → цялата; 6) етикет, на който са махнати всички редове под него → вън;
  //  3) раздел „## N. …“ без съдържание → „- Не е постъпила информация.“ веднага след заглавието; 5) останал ⟦ или ⟧ → err.
  function zapisMahniStar(md, izk) {
    var ima = Object.keys(izk || {}).length > 0, i, j, x;
    var L = String(md == null ? '' : md).replace(/\r\n?/g, '\n').replace(/\u0000/g, '').split('\n').map(function (l) {
      var ks = mdKs(l), out = ima && ks.length > 0 && ks.every(function (k) { return izk[k]; });
      return { t: l.replace(MARK_RE, '').replace(/\s+$/, ''), ks: ks, izk: out, r1: out };
    });
    var skriti = L.filter(function (y) { return y.r1; }).length;
    // 2) глава = винаги първият ред (и без разделител), разделителите (|---|) навсякъде не са данни — както ConvertTo-AiZapisChist
    for (i = 0; i < L.length;) {
      if (!tblRed(L[i].t)) { i++; continue; }
      j = i; while (j < L.length && tblRed(L[j].t)) j++;
      var danni = 0, ost = 0;
      for (x = i + 1; x < j; x++) { if (!tblSep(L[x].t)) { danni++; if (!L[x].izk) ost++; } }
      if (danni > 0 && !ost) for (x = i; x < j; x++) L[x].izk = true;
      i = j;
    }
    // 6) обхватът на етикета спира на празен ред, заглавие, „---“ или следващ етикет (Test-AiEtiketKrai)
    for (i = 0; i < L.length; i++) {
      if (L[i].izk || !mdEtiket(L[i].t)) continue;
      var had = 0, left = 0;
      for (j = i + 1; j < L.length; j++) {
        var s = L[j].t.trim();
        if (!s || /^#/.test(s) || /^-{3,}$/.test(s) || mdEtiket(L[j].t)) break;
        had++; if (!L[j].izk) left++;
      }
      if (had && !left) L[i].izk = true;
    }
    var R = [];
    for (i = 0; i < L.length; i++) {
      R.push(L[i]);
      if (!L[i].izk && /^## \d{1,2}\. /.test(L[i].t)) {
        var im = false;
        // само останалите редове (като Get-AiZapisChistStar — махнатият ред не спира търсенето)
        for (j = i + 1; j < L.length; j++) { if (L[j].izk) continue; if (/^## \d{1,2}\. /.test(L[j].t)) break; if (L[j].t.trim() && L[j].t.trim() !== '---') { im = true; break; } }
        if (!im) R.push({ t: '- Не е постъпила информация.', ks: [], izk: false, auto: true });
      }
    }
    var chist = R.filter(function (y) { return !y.izk; }).map(function (y) { return y.t; }).join('\n');
    return { chist: chist, md: chist, redove: R, skriti: skriti, avto: 0, razdeli: 0, err: /[⟦⟧]/.test(chist) };
  }
  // Вписан ден със заместител в записа (вписан преди Етап 6) → по старото правило, за да е същото като Word [§3.4, §5.8]
  function zapisStar(d, md) { return !!d && d.status === 'vpisana' && imaZamest(md); }
  function zapisChist(md) {
    var q = queue(), izk = {};
    S.tochki.forEach(function (t) { if (t.k != null && !vDn(t, q)) izk[t.k] = true; });
    return zapisMahni(md, izk, { star: zapisStar(S.den, md) });
  }
  // Проба срещу tools\markeri-primeri.json [К10] — само в демото: window.AILAB_MARKERI(primeri) → [{i, ime, ok, poluchi, ochakvano}];
  // приема {md, izk, ochakvano} и формата на файла {vhod, izkl, izhod, greshka} (целия файл — и {sluchai: […]}); star — старото правило.
  // Същият вход в ConvertTo-AiZapisChist трябва да даде същото.
  // само в демото, за проверка в браузъра: опашката (задържаните — с hold/pauza) [ETAP6 §5.13 т.3, т.10]
  if (DEMO) window.AILAB_Q = function () { return queue(); };  if (DEMO) window.AILAB_MARKERI = function (primeri, star) {
    if (primeri && !Array.isArray(primeri) && Array.isArray(primeri.sluchai)) primeri = primeri.sluchai;
    return (primeri || []).map(function (p, i) {
      var iz = {}; (p.izk || p.izkl || []).forEach(function (k) { iz[+k] = true; });
      var vh = p.md != null ? p.md : p.vhod, oc = p.ochakvano != null ? p.ochakvano : p.izhod;
      var r = zapisMahni(String(vh || '').replace(/\r\n?/g, '\n'), iz, { star: !!star }), o = oc != null ? String(oc).replace(/\r\n?/g, '\n') : null;
      var ok = p.greshka ? r.err === true : o == null ? null : !r.err && r.chist === o;
      return { i: i, ime: p.ime || '', ok: ok, err: r.err, poluchi: r.chist, ochakvano: o };
    });
  };

  // Markdown → прост HTML. Всеки ред се ескейпва ПРЕДИ форматирането; добавят се само фиксирани тагове.
  function inl(s, refs) {
    return s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[(\d{1,3})\]/g, function (m, n) { return refs && refs[n] ? '<button type="button" class="ref" data-a="ref" data-n="' + n + '" aria-label="Източник ' + n + '">' + n + '</button>' : '<span class="ref">' + n + '</span>'; });
  }
  // md — текст или редовете от zapisMahni ({t, ks, izk, tap}): ред с tap носи data-k (атрибут на <li>/<tr>/<p>) — маркерите не се виждат;
  // izk — задраскан (.md-izk-r, „Покажи и изключените“)
  function md2html(md, refs) {
    var out = [], para = [], list = null, table = null;
    var items = Array.isArray(md) ? md : String(md || '').replace(/\r\n?/g, '\n').split('\n').map(function (l) { return { t: l }; });
    function at(x) {
      var c = (x.tap ? 'mk' : '') + (x.izk ? ' md-izk-r' : '');
      return (c.trim() ? ' class="' + c.trim() + '"' : '') + (x.tap ? ' data-a="mdK" data-k="' + esc(x.ks.join(',')) + '"' : '');
    }
    function fP() { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } }
    function fL() { if (list) { out.push('<' + list.t + '>' + list.items.map(function (x) { return '<li' + x.a + '>' + x.h + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    function fT() {
      if (!table) return;
      var rows = table.rows, head = table.sep ? rows.shift() : null;
      out.push('<div class="tw"><table>' + (head ? '<thead><tr' + head.a + '>' + head.c.map(function (c) { return '<th>' + inl(esc(c), refs) + '</th>'; }).join('') + '</tr></thead>' : '') +
        '<tbody>' + rows.map(function (r) { return '<tr' + r.a + '>' + r.c.map(function (c) { return '<td>' + inl(esc(c), refs) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
      table = null;
    }
    function fA() { fP(); fL(); fT(); }
    items.forEach(function (x) {
      var l = String(x.t || '').replace(/\s+$/, ''), m, a = at(x);
      if (!l.trim()) { fA(); return; }
      // махнато заглавие на празен раздел — задраскано + „празен раздел — не влиза“ [ETAP6 §5.8]
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { fA(); var lv = Math.min(5, m[1].length + 1); out.push('<h' + lv + (x.izk ? ' class="md-izk-r"' : '') + '>' + inl(esc(m[2]), refs) + (x.pr ? ' <span class="md-pr">празен раздел — не влиза</span>' : '') + '</h' + lv + '>'); return; }
      if (TBL_RE.test(l)) {
        fP(); fL();
        var cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
        if (cells.every(function (c) { return /^:?-{2,}:?$/.test(c); })) { if (table && table.rows.length === 1) table.sep = true; return; }
        if (!table) table = { rows: [], sep: false };
        table.rows.push({ c: cells, a: a }); return;
      }
      fT();
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { fA(); out.push('<hr>'); return; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { fP(); if (!list || list.t !== 'ul') { fL(); list = { t: 'ul', items: [] }; } list.items.push({ h: inl(esc(m[1]), refs), a: a }); return; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { fP(); if (!list || list.t !== 'ol') { fL(); list = { t: 'ol', items: [] }; } list.items.push({ h: inl(esc(m[1]), refs), a: a }); return; }
      if ((m = /^>\s?(.*)$/.exec(l))) { fA(); out.push('<blockquote' + a + '>' + inl(esc(m[1]), refs) + '</blockquote>'); return; }
      fL();
      // ред с маркер (или задраскан) — свой <p>, за да е докосваем сам [§6.1 т.1]
      if (a) { fP(); out.push('<p' + a + '>' + inl(esc(l), refs) + '</p>'); return; }
      para.push(inl(esc(l), refs));
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
      // 1а [§6.4]: един текст навсякъде — „🔄 Дойде по-нова версия … — отговорите ти са запазени“
      el.className = 'appr-w sticky';
      el.innerHTML = '<div class="appr newv"><div class="appr-row"><span class="appr-big nv-t">' + esc(nvTxt()) + '</span></div>' +
        '<div class="small">' + esc(NV_MALKO) + '</div>' +
        '<button type="button" class="btn big" data-a="reload">Покажи новата версия</button></div>';
      return;
    }
    if (a.k === 'vpisana') {
      var f = String(d.vpisan_pat || '').split(/[\\/]/).pop();
      el.innerHTML = '<div class="appr vp"><div class="appr-row"><span class="appr-big">Вписан ✓</span><span class="pill p-ok">v' + esc(d.versiq) + '</span></div>' +
        '<ol class="steps"><li class="ok">✓ Одобрено</li><li class="ok">✓ Лаптопът</li><li class="ok">✓ Вписан</li></ol>' +
        '<div class="small muted">' + (f ? '📄 ' + esc(f) + ' · OneDrive и копие на компютъра' : 'Записът е в OneDrive и на компютъра.') + '</div>' + zakLine(d) + '</div>';
      return;
    }
    if (a.k === 'pending' || a.k === 'queued') {
      var q = a.k === 'queued';
      el.innerHTML = '<div class="appr"><div class="appr-row"><span class="appr-big">✅ Одобрено' + (a.at ? ' ' + esc(rel(a.at)) : '') + '</span>' +
        '<span class="pill p-warn">⏳ ' + (q ? 'чака връзка' : 'чака лаптопа') + '</span></div>' +
        '<ol class="steps"><li class="' + (q ? 'wait' : 'ok') + '">' + (q ? '⏳ Изпращане' : '✓ Одобрено') + '</li><li class="' + (q ? '' : 'wait') + '">Лаптопът</li><li>Вписан</li></ol>' +
        (/^конфликт/i.test(a.rez || '') ? '<p class="warnline">⚠️ Лаптопът не може да впише деня: ' + esc(String(a.rez).replace(/^конфликт:\s*/i, '')) + '</p>' : '') +
        '<div class="small muted">' + (q ? 'Одобрението е запазено на телефона и тръгва само, щом има покритие.' : 'Лаптопът пише .md и Word в OneDrive, щом е включен. Проверявам на ' + Math.round(POLL_MS / 1000) + ' с.') + '</div>' +
        zakLine(d) + nextBtn() + '</div>';
      return;
    }
    // Един ред под палеца [К24]: „Следващ › · N“ вляво, „Одобрявам vN“ вдясно; когато няма непрегледани — „✓ Прегледа всичко“,
    // а под лентата (не в нея) — „Следващ за одобрение“ [§5.5, И1]
    var left = openCount(), g = groupsOf(), ost = ostavat(g.promqna.concat(g.reshenie, g.neprovereno)), q0 = queue();
    var nIz = S.tochki.filter(function (t) { return dnMozhe(t) && !vDn(t, q0); }).length;   // „N няма да влязат в дневника“ [А]
    el.innerHTML = '<div class="appr">' +
      (a.old ? '<div class="small" style="color:var(--warn-ink);font-weight:600;text-align:center">Одобри v' + esc(a.old.versiq) + ', но сега е v' + esc(d.versiq) + ' — одобри отново.</div>' : '') +
      (nIz ? '<div class="appr-iz">🚫 ' + nIz + ' ' + pl(nIz, 'точка няма да влезе', 'точки няма да влязат') + ' в дневника</div>' : '') +
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
    if (WIDE) panSelect(+el.getAttribute('data-tid'));   // широк екран: и панелът минава на нея
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
    commitUndos();   // чакащ 🚫 (2 с „Отмени“) влиза в опашката ПРЕДИ одобрението — опашката е по ред [К2]
    var left = openCount(), ch = zapisChist(d.zapis_md || ''), nDob = dobaviCakat(d.id), sb = sabOf(d);
    var head = '<div class="ap-sum"><span class="ap-d">' + esc(dayTitle(d.data)) + '</span><span class="ap-v">версия ' + esc(d.versiq) + '</span></div>' +
      '<p>Лаптопът ще впише <b>точно тази версия</b>: запис .md и Word в OneDrive + копие на компютъра.</p>';
    // „без твой отговор“ брои и точките с отговор за стар текст (1а [§6.1])
    var mid = (left ? '<p class="warnline">⏳ ' + left + (left === 1 ? ' точка е' : ' точки са') + ' без твой отговор — влизат в записа със статуса си („съобщено“, „оспорено“).</p>' : '') +
      (ch.skriti ? '<p class="small">🚫 ' + ch.skriti + (ch.skriti === 1 ? ' ред не влиза' : ' реда не влизат') + ' в дневника (точки „не за дневника“).</p>' : '') +
      (sb && d.status === 'chernova' && !(prisOk() && prisOf(d.obekt || OBEKT_KOD, d.data)) ? '' : prisApprLine(d));   // 1а: „няма запис“ вече е горе в липсите
    if (!sb || d.status !== 'chernova') {
      // ден без „събрано до“ (качен преди Стъпка 1а) — досегашният лист с един бутон
      openSheet('Одобряваш ли деня?', head +
        // „➕ Включи в дневника“, които още чакат следващата версия — одобрението сега ги изпуска [ETAP6 §3.1]
        (nDob ? '<p class="warnline">➕ ' + nDob + ' ' + pl(nDob, 'съобщение чака да влезе', 'съобщения чакат да влязат') + ' — следващата версия ' + pl(nDob, 'го добавя', 'ги добавя') + ' в този ден. Ако одобриш сега, няма да ' + pl(nDob, 'влезе', 'влязат') + '.</p>' : '') +
        mid +
        '<button type="button" class="btn big" data-a="approveGo">' + (nDob ? 'Одобри без тях' : 'Одобрявам v ' + esc(d.versiq)) + '</button>' +
        '<button type="button" class="btn ghost" data-a="close">Още не</button>', 'approve');
      return;
    }
    // 1а [§6.3, §4.3, §4.9]: „Събрано до …“ горе (свито), липсите, отговорите за стар текст, ненанесените поправки, трите бутона
    var L = lipsi(d), nd = nextPisana(d), dd = dvDat(d.data, true), kg = slednaV(d), st = starPts(), fx = fixCakat(d), full = !L.length;
    var fxT = fx ? '✎ ' + fx + ' ' + pl(fx, 'твоя поправка още не е', 'твои поправки още не са') + ' в текста — ' +
      (full ? pl(fx, 'влиза', 'влизат') + ' в черновата на ' + nd + ' като „Поправка към записа за ' + dd + '“.'
        : 'с „Одобри и добави …“ ' + pl(fx, 'влиза', 'влизат') + ' в черновата на ' + nd + ' като „Поправка към записа за ' + dd + '“; с „Одобри така“ ' + pl(fx, 'остава', 'остават') + ' само като урок.') : '';
    var btns = full
      ? '<button type="button" class="btn big" data-a="approveGo" data-t="dobavi">Одобрявам v' + esc(d.versiq) + '</button>' +
        '<button type="button" class="btn ghost" data-a="close">Още не</button>'
      : '<div class="ap-bt"><button type="button" class="btn big" data-a="approveGo" data-t="dobavi">Одобри и добави късните в ' + esc(nd) + '</button>' +
          '<p class="small muted">Вписва се сега. Каквото дойде после за ' + esc(dd) + ' (Присъствия, късни съобщения, приложения) и твоите ненанесени поправки влизат в черновата на ' + esc(nd) + ' като „Закъснели за ' + esc(dd) + '“.</p></div>' +
        '<div class="ap-bt"><button type="button" class="btn ghost" data-a="approveGo" data-t="taka">Одобри така</button>' +
          '<p class="small muted">Вписва се сега. Каквото дойде после, остава само в AiLab.</p></div>' +
        '<div class="ap-bt"><button type="button" class="btn ghost" data-a="apWait">Изчакай</button>' +
          '<p class="small muted">Нищо не се записва. Следващата версия (' + esc(kg) + ') добавя липсващото и пази отговорите ти.</p></div>';
    openSheet('Одобряваш ли деня?', head + sabApTop(d, L) +
      (nDob ? '<p class="warnline">➕ ' + nDob + ' ' + pl(nDob, 'съобщение чака', 'съобщения чакат') + ' — ако одобриш с „' + (full ? 'Одобрявам' : 'Одобри и добави …') + '“, ' + pl(nDob, 'влиза', 'влизат') + ' в черновата на ' + esc(nd) + ' като закъснели.</p>' : '') +
      mid +
      (st.length ? '<button type="button" class="ap-li" data-a="starGo">🔄 ' + st.length + ' ' + pl(st.length, 'точка е сменена', 'точки са сменени') + ' след твоя отговор ›</button>' : '') +
      (fxT ? '<p class="warnline calm">' + esc(fxT) + '</p>' : '') + btns, 'approve');
  }
  // Докато листът „Одобряваш ли…“ е отворен, лаптопът качи нова версия → листът вече не предлага одобрение.
  // 1а [§6.4]: същият текст като горната лента и тоста
  function openNewVerSheet() {
    openSheet('Дойде по-нова версия',
      '<div class="ap-sum newv"><span class="ap-d">' + esc(dayTitle(S.den.data)) + '</span><span class="ap-v">v ' + esc(S.den.versiq) + ' → v ' + esc(S.newVersiq) + '</span></div>' +
      '<p class="nv-t"><b>' + esc(nvTxt()) + '</b></p><p class="small muted">' + esc(NV_MALKO) + '</p>' +
      '<button type="button" class="btn big" data-a="reload">Покажи новата версия</button>' +
      '<button type="button" class="btn ghost" data-a="close">Затвори</button>', 'newv');
  }
  // 1а [§4.3]: tekst — 'добави утре' (основният / „Одобрявам vN“ при пълно) · 'така' · без tekst — ден отпреди Стъпка 1а
  function doApprove(btn) {
    var d = S.den; if (!d) return;
    commitUndos();   // [К2] — и тук: изборите преди одобрението
    if (newPending()) { closeSheet(); toast('Има нова версия — покажи я и одобри нея.', 'bad'); renderAppr(); return; }
    var tk = btn.getAttribute('data-t'), row = { den_id: d.id, vid: 'odobri', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    if (tk === 'dobavi') row.tekst = 'добави утре'; else if (tk === 'taka') row.tekst = 'така';
    var bs = sheetEl ? sheetEl.querySelectorAll('[data-a="approveGo"],[data-a="apWait"]') : [btn];
    Array.prototype.forEach.call(bs, function (b) { b.disabled = true; });
    var sec = Math.max(1, Math.round((activeMs() - S.openedAt) / 1000));
    send('resheniq', row).then(function (r) {
      send('metriki', { vid: 'odobrenie_sek', stoinost: sec, den_id: d.id }).catch(function () {});
      closeSheet();
      toast(r === 'sent' ? 'Одобрено ' + hhmm() + ' · чака лаптопа' : 'Одобрено · ⏳ чака връзка');
      renderAppr(); renderStrip(); renderGroups(); renderSum(); renderBanners(); renderTabs();   // значката на „Ден“ — веднага
    }, function (e) { Array.prototype.forEach.call(bs, function (b) { b.disabled = false; }); toast('Не се записа: ' + errBg(e), 'bad'); });
  }

  // ======================================================================================================================
  // ---------- Стъпка 1а (STAPKA1A-SPEC.md, ЧАСТ А) — „Събрано до …“, версиите, „↳“, закъснелите, приложенията, мерене ----------
  // Всичко ново в базата (dni.sabrano/promeni, tochki.vav_versiq/obnovena_v/predishen_tekst/prodalzhenie, dokumenti, новите
  // редове на svezhest/metriki) телефонът само ЧЕТЕ; пише само resheniq (vrazka_ne, odobri с tekst) и metriki (aktivno_*, izvan_*).
  // Без 010 (колоните/таблицата ги няма) → тихо досегашното поведение.
  // ======================================================================================================================
  var NV_MALKO = 'Одобрява се само показаната версия. Твоите ✓, ✎, → и 🚫 остават на същите точки; сменените точки ще ги видиш отново.';
  var VIDW = { palna: 'пълна', obnovqvane: 'обновяване', dobavka: 'сутрешна добавка', nagonvane: 'наваксване (лаптопът беше изключен)', zakasneli: 'със закъснелите' };
  function jObj(x) { if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = null; } } return x && typeof x === 'object' && !Array.isArray(x) ? x : null; }
  function sabOf(d) { var s = d ? jObj(d.sabrano) : null; return s && s.vzeto ? s : null; }
  function promOf(d) { return d ? jObj(d.promeni) : null; }
  function sabOn() { var d = S.den; return !!(d && d.status === 'chernova' && sabOf(d)); }
  function minOf(d) { return d.getHours() * 60 + d.getMinutes(); }
  function hmIso(iso) { var d = new Date(iso); return isNaN(d) ? '' : hhmm(d); }

  // ---- 1а [§6.4]: нова версия — един текст навсякъде (горната лента, тостът, листът, лентата долу) ----
  function nvTxt() {
    var h = S.newHead || {}, v = S.newVersiq || h.versiq, t = h.obnoven ? hmIso(h.obnoven) : '', sb = jObj(h.sabrano), pr = jObj(h.promeni);
    var nm = pr && +pr.v === +v ? (pr.mahnati || []).filter(function (x) { return x && x.otgovor; }).length : 0;
    // и моите отговори за показаната версия, чиято точка вече я няма (ON DELETE SET NULL) — когато promeni липсва
    var d0 = S.den, nn = d0 ? S.res.filter(function (r) { return r.tochka_id == null && ANS4[r.vid] && +r.versiq === +d0.versiq; }).length : 0;
    nm = Math.max(nm, nn);
    return '🔄 Дойде по-нова версия (v' + v + (t ? ', ' + t : '') + (sb && sb.chas && sb.vid === 'obnovqvane' ? ', обновяване от ' + sb.chas : '') + ') — отговорите ти са запазени' +
      (nm ? ' (на ' + nm + ' ' + pl(nm, 'махната точка', 'махнати точки') + ' — не; виж ' + pl(nm, 'коя', 'кои') + ')' : '') + '.';
  }
  // какво носи показаната версия: promeni (ако е за нея), иначе — от vav_versiq/obnovena_v на точките
  function viData(d) {
    d = d || S.den; if (!d || +d.versiq <= 1 || !S.tochki.some(function (t) { return t.k != null; })) return null;
    var v = +d.versiq, p = promOf(d), novi, obn, mah = [];
    if (p && +p.v === v) { novi = (p.novi || []).length; obn = (p.obnoveni || []).length; mah = (p.mahnati || []).filter(function (x) { return x && typeof x === 'object'; }); }
    else { novi = S.tochki.filter(function (t) { return +t.vav_versiq === v; }).length; obn = S.tochki.filter(function (t) { return +t.obnovena_v === v; }).length; }
    if (!novi && !obn && !mah.length) return null;
    var q = queue(), star = S.tochki.filter(function (t) { return +t.obnovena_v === v && mineStar(t, q); }).length;
    return { v: v, novi: novi, obn: obn, mah: mah, star: star };
  }
  function viCnt(x) {
    return [x.novi + ' ' + pl(x.novi, 'нова', 'нови'), x.obn + ' ' + pl(x.obn, 'обновена', 'обновени')].concat(x.mah.length ? [x.mah.length + ' ' + pl(x.mah.length, 'махната', 'махнати')] : []).join(' · ');
  }
  function viToast() { var x = viData(); return x ? 'Показана е v' + x.v + ' — ' + viCnt(x) + '.' : 'Показана е v' + (S.den ? S.den.versiq : '') + '.'; }
  // карта #verInfo над групите (до следващата версия; „✕“ я скрива за тази версия — в паметта)
  var VI = { skrit: {}, i: 0, key: '' };
  function renderVerInfo() {
    var el = box('#verInfo'); if (!el) return;
    var d = S.den, x = d && !newPending() ? viData(d) : null;
    if (!x || VI.skrit[d.id + ':' + x.v]) { el.innerHTML = ''; return; }
    var sb = sabOf(d), hd = '🔄 v' + x.v + ' от ' + rel(d.obnoven) + (sb && sb.chas && sb.vid ? ' (' + (VIDW[sb.vid] || 'версия') + ' от ' + sb.chas + ')' : '') + ': ' + viCnt(x) + '.';
    el.innerHTML = '<section class="vi" aria-label="Какво е новото във версията"><div class="vi-h"><p><b>' + esc(hd) + '</b> Отговорите ти са запазени' +
        (x.star ? '; ' + x.star + ' от обновените ' + pl(x.star, 'я виж', 'ги виж') + ' отново.' : '.') + '</p>' +
        '<button type="button" class="vi-x" data-a="viX" aria-label="Скрий за тази версия">✕</button></div>' +
      (x.obn ? '<button type="button" class="btn ghost sb vi-go" data-a="viGo">Покажи обновените ›</button>' : '') +
      x.mah.map(function (m) { return '<p class="vi-m">Махната: „' + esc(clip(m.tekst || ('точка ' + m.k), 120)) + '“' + (m.otgovor ? ' · имаше твой отговор' : '') + '</p>'; }).join('') + '</section>';
  }
  // „Покажи обновените ›“ — всяко натискане: следващата обновена точка (разгъва „Прегледани“, светва; факт → редът в „Пълен запис“)
  function viGo() {
    var d = S.den; if (!d) return;
    var l = S.tochki.filter(function (t) { return +t.obnovena_v === +d.versiq; }).sort(function (a, b) { return (a.red || 0) - (b.red || 0) || a.id - b.id; });
    if (!l.length) return;
    var k = d.id + ':' + d.versiq; if (VI.key !== k) { VI.key = k; VI.i = 0; }
    var t = l[VI.i % l.length]; VI.i++;
    pointGo(t);
  }
  // точката на екрана: разгъва свитата карта, светва; факт (без карта) → редът му в „📄 Пълен запис“
  function pointGo(t) {
    if (!t) return;
    if (t.grupa === 'fakt' || !GRUPI.some(function (G) { return G.k === t.grupa; })) { fullGo(t); return; }
    if (pregledana(t)) { S.revOpen[t.grupa] = true; S.revCard[t.id] = true; renderGroups(); }
    var el = document.querySelector('#groups .pc[data-tid="' + t.id + '"]');
    if (!el) { toast('Картата я няма в тази версия'); return; }
    flashEl(el);
    if (WIDE) panSelect(t.id);
  }
  // точките с мой отговор за стар текст (листът „Одобряваш ли…“ › „🔄 N точки са сменени след твоя отговор ›“)
  function starPts() { var q = queue(); return S.tochki.filter(function (t) { return mineStar(t, q); }).sort(function (a, b) { return (a.red || 0) - (b.red || 0) || a.id - b.id; }); }
  function starGo() { var l = starPts(); closeSheet(); if (l.length) setTimeout(function () { pointGo(l[0]); }, 60); }
  // „✓ Още е вярно“ — нов ✓ за показаната версия (старият остава в базата; работникът не прави стария ✓ „проверено“ за новия текст)
  function pcOkStar(tid) {
    var t = findT(tid), d = S.den; if (!t || !d) return;
    if (newPending()) { toast('Има нова версия — натисни „Покажи новата версия“ първо.', 'bad'); return; }
    var res = t.grupa === 'reshenie', o = d.obekt || OBEKT_KOD, data = d.data;
    var row = { den_id: d.id, tochka_id: tid, vid: 'potvardi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    if (res) row.tekst = 'отговорено';
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: '✓ Още е вярно', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      now: function () { if (res) noteClose(tid, o, data, true, null); }, back: function () { if (res) unClose(tid); } });
  }
  // пиловете на картата: 🆕 нова / 🔄 обновена във vN · ⏰ закъснели за ДД.ММ · ✎ поправка към записа за ДД.ММ [§6.4, §6.6]
  var ZAK_RE = /^\s*Закъснели за (\d{1,2}\.\d{1,2})/i, POPR_RE = /^\s*Поправка към записа за (\d{1,2}\.\d{1,2})/i;
  function verPills(t) {
    var d = S.den, h = ''; if (!d) return '';
    if (t.k != null && +d.versiq > 1) {
      if (+t.vav_versiq === +d.versiq) h += '<span class="pill p-nov">🆕 нова във v' + esc(d.versiq) + '</span>';
      else if (+t.obnovena_v === +d.versiq) h += '<span class="pill p-nov">🔄 обновена във v' + esc(d.versiq) + '</span>';
    }
    var tx = String(t.tekst || ''), m = POPR_RE.exec(tx), z = ZAK_RE.exec(tx), den = (t.izvori || []).filter(function (s) { return s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.den || '')); })[0];
    if (m) h += '<span class="pill p-zak">✎ поправка към записа за ' + esc(m[1]) + '</span>';
    else if (z || den) h += '<span class="pill p-zak">⏰ закъснели за ' + esc(z ? z[1] : dvDat(den.den, true)) + '</span>';
    return h;
  }
  // „беше: …“ — предишният текст на обновена точка, ако съм отговорил по нея (сив, малък; „Покажи целия“ над 160)
  var WAS = {};
  function wasHtml(t, m) {
    var d = S.den; if (!d || +t.obnovena_v !== +d.versiq || !t.predishen_tekst || !(m.ans || m.ok)) return '';
    var p = String(t.predishen_tekst), lng = p.length > 160 && !WAS[t.id];
    return '<p class="pc-was">беше: „' + esc(lng ? clip(p, 160) : p) + '“' + (lng ? ' <button type="button" class="lnk" data-a="wasFull" data-tid="' + esc(t.id) + '">Покажи целия</button>' : '') + '</p>';
  }

  // ---- 1а [§6.5, §4.6]: „↳ продължение на …“ (само в AiLab; „✕“ маха връзката с едно докосване) ----
  function prdOf(t) { var p = t ? jObj(t.prodalzhenie) : null; return p && p.kratko && (p.tid != null || (p.data && p.k != null)) ? p : null; }
  function vrazkaNe(t, q) {
    if (S.res.some(function (r) { return r.vid === 'vrazka_ne' && r.tochka_id === t.id; })) return true;
    return (q || queue()).some(function (it) { return it.tbl === 'resheniq' && it.row && it.row.vid === 'vrazka_ne' && it.row.tochka_id === t.id; });
  }
  function prdHtml(t, q) {
    var p = prdOf(t); if (!p || vrazkaNe(t, q)) return '';
    var lbl = p.tid != null ? String(p.kratko) : dvDat(p.data, true) + ' ' + p.kratko;
    return '<div class="prd"><button type="button" class="prd-l" data-a="prd" data-tid="' + esc(t.id) + '"><span aria-hidden="true">↳</span> продължение на: ' + esc(lbl) + ' ›</button>' +
      '<button type="button" class="prd-x" data-a="prdNe" data-tid="' + esc(t.id) + '" aria-label="Не е продължение — махни връзката">✕</button></div>';
  }
  function prdGo(tid) {
    var t = findT(tid), p = prdOf(t); if (!p) return;
    if (p.tid != null) { izadGo(+p.tid); return; }
    var o = S.den ? S.den.obekt || OBEKT_KOD : OBEKT_KOD;
    var x = S.dni.filter(function (r) { return r.data === p.data && (r.obekt || o) === o; })[0], id = x ? x.id : (p.den_id != null ? +p.den_id : null);
    if (!id) { toast('Денят ' + dvDat(p.data, true) + ' не е в списъка.'); return; }
    commitUndos();
    S.flash = { den: id, tid: p.tochka_id != null ? +p.tochka_id : null, k: +p.k };
    if (S.den && S.den.id === id) { flashPoint(); return; }
    openDay(id);
  }
  function prdNe(tid) {
    var t = findT(tid), d = S.den; if (!t || !d) return;
    if (newPending()) { toast('Има нова версия — натисни „Покажи новата версия“ първо.', 'bad'); return; }
    var row = { den_id: d.id, tochka_id: tid, vid: 'vrazka_ne', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    undoStart({ key: 'prd:' + tid, kind: 'prd', tid: tid, lbl: '↳ Връзката е махната', tbl: 'resheniq', row: row, meta: { tt: t.tekst } });
  }

  // ---- 1а [§6.1]: данните на деня — „след черновата е дошло“, приложенията на деня, закъснелите (само в паметта) ----
  var SLED = {}, DOK = { den: {}, all: null, allSt: '', allAt: 0, allErr: null, lst: {} }, ZAK = {};
  function den1aLoad(poll) {
    var d = S.den; if (!d || !api) return;
    var sb = sabOf(d), o = d.obekt || OBEKT_KOD;
    if (d.status === 'chernova' && sb) { sledLoad(d, sb.vzeto); dokLoad(d, !poll); }
    else if (d.status !== 'chernova') { zakLoad(d, !poll); if (sb) sledLoad(d, sb.vzeto); }
  }
  function den1aPaint(id) {
    if (view !== 'day' || !S.den || S.den.id !== id) return;
    renderFresh(); renderAppr();
    if (sheetKind === 'sab') sabSheetPaint();
    if (sheetKind === 'dokd') dokDenPaint();
  }
  function sledLoad(d, ot) {
    var o = d.obekt || OBEKT_KOD, id = d.id, x = SLED[id];
    if (!ot || offNow() || (!DEMO && (!db || !user))) { if (!x || x.ot !== ot) SLED[id] = { ot: ot, st: 'net' }; return; }
    if (x && x.busy) return;
    SLED[id] = Object.assign(x && x.ot === ot ? x : { ot: ot }, { busy: true });
    api.slednoBroi(o, d.data, ot).then(function (r) { SLED[id] = { ot: ot, st: 'ok', teams: r.teams, mail: r.mail, at: Date.now() }; den1aPaint(id); },
      function (e) { SLED[id] = Object.assign(SLED[id] || {}, { ot: ot, busy: false, st: isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err' }); den1aPaint(id); });
  }
  function sledOf(d) { var x = d && SLED[d.id], sb = sabOf(d); return x && sb && x.ot === sb.vzeto ? x : null; }
  function dokKey(d) { return (d.obekt || OBEKT_KOD) + ':' + d.data; }
  function dokLoad(d, force) {
    var k = dokKey(d), x = DOK.den[k];
    if (x && (x.busy || (!force && Date.now() - (x.at || 0) < 300000))) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { if (!x) DOK.den[k] = { st: 'net', at: 0 }; return; }
    DOK.den[k] = Object.assign(x || {}, { busy: true });
    api.dokDen(d.obekt || OBEKT_KOD, d.data).then(function (rows) { DOK.den[k] = { rows: rows || [], st: 'ok', at: Date.now() }; den1aPaint(d.id); },
      function (e) { DOK.den[k] = Object.assign(DOK.den[k] || {}, { busy: false, at: Date.now(), st: isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err' }); den1aPaint(d.id); });
  }
  function dokOf(d) { var x = d ? DOK.den[dokKey(d)] : null; return x && x.st === 'ok' ? x.rows : null; }
  function dokBroi(rows) {
    var b = { n: 0, prochet: 0, samo_ime: 0, ne_moje: 0, otlojen: 0, nov: 0 };
    (rows || []).forEach(function (r) { b.n++; if (b[r.status] != null) b[r.status]++; });
    return b;
  }
  // „непрочетени“ = nov + otlojen (и двете чакат следващия пуск, §4.8) — едно число навсякъде: „непрочетени 3 (2 отложени)“
  function dokNp(b) { var n = b.nov + b.otlojen; return 'непрочетени ' + n + (b.otlojen ? ' (' + b.otlojen + ' ' + pl(b.otlojen, 'отложен', 'отложени') + ')' : ''); }
  function zakLoad(d, force) {
    var k = dokKey(d), x = ZAK[k];
    if (x && (x.busy || (!force && Date.now() - (x.at || 0) < 300000))) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) return;
    ZAK[k] = Object.assign(x || {}, { busy: true });
    api.zakasneliZa(d.obekt || OBEKT_KOD, d.data).then(function (rows) { ZAK[k] = { rows: rows || [], st: 'ok', at: Date.now() }; den1aPaint(d.id); },
      function (e) { ZAK[k] = { rows: [], st: isMissing(e) || isNoCol(e) ? 'missing' : 'err', at: Date.now() }; den1aPaint(d.id); });
  }

  // ---- 1а [§4.9]: липсите — само такива, които следващата версия може да оправи; информацията (не може, вход в Интранета) — отделно ----
  var IZ_SAB = [['teams', '💬', 'Тиймс'], ['poshta', '✉️', 'Поща'], ['intranet', '🗂️', 'Интранет'], ['prisystvia', '👷', 'Присъствия'], ['prilojeniq', '📎', 'Приложения']];
  function izVhod() { var s = svOf('intranet'); return !!(s && s.ok === false && /вход|влез/i.test(String(s.belejka || ''))); }
  function prisVav(d) {   // кога са въведени Присъствията (sinhr, иначе obnoveno_v) — от разбивката на деня
    var o = d.obekt || OBEKT_KOD, p = prisOf(o, d.data); if (!p) return null;
    var det = prisDet(o, d.data); return det ? (det.sinhr || det.obnoveno_v || null) : null;
  }
  function lipsi(d) {
    var sb = sabOf(d); if (!sb) return [];
    var out = [], iz = sb.izvori || {}, o = d.obekt || OBEKT_KOD, vz = Date.parse(sb.vzeto), sp = svSpi(), ch = svOf('chernova');
    if (sp.spi) out.push({ k: 'spi', txt: '💻 Лаптопът е изключен от ' + sp.ot + ' — след това нищо не се събира' });
    if (ch && ch.ok === false) out.push({ k: 'cikal', txt: '⚠️ ' + (ch.belejka || 'черновата не е минала') });
    var pz = iz.prisystvia || {}, p = prisOk() ? prisOf(o, d.data) : null, pv = p ? prisVav(d) : null;
    if (!p && !pz.ima_zapis) out.push({ k: 'pris0', txt: '👷 Присъствия: още няма запис' });
    else if (p && pv && Date.parse(pv) > vz) out.push({ k: 'pris1', txt: '👷 Присъствия са въведени след черновата (' + hmIso(pv) + ')' });
    var sl = sledOf(d);
    if (!offNow() && sl && sl.st === 'ok' && sl.teams + sl.mail > 0) out.push({ k: 'sled', txt: 'След черновата: 💬 ' + sl.teams + ' · ✉️ ' + sl.mail });
    var db0 = dokBroi(dokOf(d)), nn = db0.nov + db0.otlojen;
    if (nn) out.push({ k: 'dok', txt: '📎 ' + nn + ' ' + pl(nn, 'още не е прочетено', 'още не са прочетени') });
    // Интранетът е четен > 3 ч преди снимката, а днес още може да се чете (до 19:59, на 2 ч) → чакането го оправя
    var ix = iz.intranet, it0 = ix && ix.posledno ? Date.parse(ix.posledno) : NaN;
    if (ix && ix.ok !== false && !isNaN(it0) && vz - it0 > 3 * 36e5 && daysAgo(d.data) <= 0 && minOf(now()) < 19 * 60 + 30) out.push({ k: 'iz:intranet', txt: '🗂️ Интранет от ' + hmIso(ix.posledno) });
    IZ_SAB.forEach(function (z) {
      var x = iz[z[0]]; if (!x || x.ok !== false) return;
      if (z[0] === 'intranet' && izVhod()) return;   // иска действие от РП — само информация
      out.push({ k: 'iz:' + z[0], txt: '⚠️ ' + z[2] + ' не е чело' });
    });
    return out;
  }
  function lipsiInfo(d) {
    var out = [], b = dokBroi(dokOf(d)), sl = sledOf(d);
    if (b.ne_moje) out.push('📎 ' + b.ne_moje + ' не може (виж защо) ›');
    if (izVhod()) out.push('🗂️ Интранетът иска вход — влез отново в Интранета от лаптопа');
    if (offNow() || !sl || sl.st === 'net') out.push('📴 Новото след черновата — когато има покритие');
    return out;
  }
  // „<кога>“ — следващата версия на деня [§4.9] (по часа на устройството)
  function techeOt(c) { var m = /тече от (\d{1,2}:\d{2})/.exec(String((c && c.belejka) || '')); return m ? m[1] : (c && c.posledno ? hmIso(c.posledno) : ''); }
  function slednaV(d) {
    var c = svOf('chernova'), sp = svSpi(), m = minOf(now()), dd = daysAgo(d.data);
    if (c && +c.broi === 1 && !sp.spi) return 'тече сега (от ' + techeOt(c) + ')';
    if (sp.spi) return dd <= 0 ? 'щом лаптопът се включи до 22:45 — веднага; иначе в 09:00 (само ако дойде нещо ново)' : 'в 09:00, ако лаптопът е включен';
    if (dd <= 0) return m < 18 * 60 + 55 ? 'днес в 19:00' : m < 22 * 60 + 40 ? 'днес в 22:45' : 'утре в 09:00 (само ако дойде нещо ново)';
    if (dd === 1) return m < 8 * 60 + 55 ? 'днес в 09:00 (само ако дойде нещо ново)' : 'утре в 09:00 (само ако дойде нещо ново)';
    return 'при сутрешното наваксване (09:00)';
  }
  // „следващата писана чернова“ (ДД.ММ в бутона) [§4.3]: днешният ден → утре; по-стар, днешният на обекта още не е одобрен и сега < 22:40 → днес
  function dnesOdobren(o) {
    var t = ymd(now()), r = TB.dni.concat(S.dni).filter(function (x) { return x.data === t && (x.obekt || OBEKT_KOD) === o; })[0];
    if (!r) return false;
    return r.status !== 'chernova' || liveQ().some(function (it) { return it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === r.id; });
  }
  function nextPisanaD(d) {
    var n = now(), t = ymd(n), tom = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
    if (d.data >= t) return tom;
    return !dnesOdobren(d.obekt || OBEKT_KOD) && minOf(n) < 22 * 60 + 40 ? new Date(n.getFullYear(), n.getMonth(), n.getDate()) : tom;
  }
  function nextPisana(d) { return ddmm(nextPisanaD(d)); }
  // ненанесените ✎ (поправки, разяснения, оспорвания) на деня — базата + опашката [§6.3]
  function fixCakat(d) {
    var n = 0, kl = {};
    queue().forEach(function (it) { if (it.tbl === 'resheniq' && !it.err && it.row && it.row.den_id === d.id && /^(popravka|komentar|osporva)$/.test(it.row.vid)) { n++; if (it.row.klient_id) kl[it.row.klient_id] = 1; } });
    S.res.forEach(function (r) { if (r.den_id === d.id && /^(popravka|komentar|osporva)$/.test(r.vid) && !r.obraboteno && !(r.klient_id && kl[r.klient_id])) n++; });
    return n;
  }

  // ---- 1а [§6.2]: лентата „📥 Събрано до …“ (Преглед, чернова със sabrano) ----
  function sabState(d) {
    var c = svOf('chernova'), sp = svSpi(), L = lipsi(d);
    if (c && +c.broi === 1 && !sp.spi) {
      var obn = /обнов|добав|сутрин/i.test(String(c.belejka || ''));
      return { txt: '⏳ ' + (obn ? 'Обновяване' : 'Пълна чернова') + ' тече от ' + techeOt(c) + ' — обикновено до ' + (obn ? 15 : 30) + ' мин', warn: false, L: L };
    }
    if (sp.spi) return { txt: '💻 Лаптопът е изключен от ' + sp.ot + ' — след това нищо не се събира', warn: true, next: true, L: L };
    if (c && c.ok === false) return { txt: '⚠️ ' + (c.belejka || 'черновата не е минала'), warn: true, next: true, L: L };
    var l2 = L.filter(function (x) { return x.k !== 'spi' && x.k !== 'cikal'; });
    if (l2.length) return { txt: l2.slice(0, 2).map(function (x) { return x.txt; }).join(' · ') + (l2.length > 2 ? ' +' + (l2.length - 2) : ''), warn: true, next: true, L: L };
    return { txt: '✓ Всичко за деня е събрано', warn: false, ok: true, L: L };
  }
  function renderSab(el) {
    var d = S.den, sb = sabOf(d), st = sabState(d), inf = lipsiInfo(d);   // сивите редове (не може, вход, 📴) — информация, не липса
    el.innerHTML = '<button type="button" class="fresh sab' + (st.warn ? ' warn' : '') + '" data-a="sabrano" aria-label="Събрано до ' + esc(rel(sb.vzeto)) + ' — подробно">' +
      '<span class="sab-1">📥 Събрано до ' + esc(rel(sb.vzeto)) + ' · v' + esc(d.versiq) + ' от ' + esc(rel(d.obnoven)) + '</span>' +
      '<span class="sab-2">' + esc(st.txt) + '</span>' +
      (inf.length ? '<span class="sab-i">' + inf.map(esc).join(' · ') + '</span>' : '') +
      (st.next ? '<span class="sab-n">Следваща версия: ' + esc(slednaV(d)) + '</span>' : '') +
      '<span class="fr-go" aria-hidden="true">›</span></button>';
  }
  // „Черновата: v2 — обновяване, 22:58“ / „· проверено 22:47 — нищо ново“ / „(пускът от 19:00 тръгна в 20:41 — лаптопът беше изключен)“
  function verRed(d, sb) {
    var s = 'v' + d.versiq + (sb.vid ? ' — ' + (VIDW[sb.vid] || sb.vid) : '') + ', ' + rel(d.obnoven);
    if (sb.provereno) return s + ' · проверено ' + rel(sb.provereno) + ' — нищо ново';
    var tr = sb.tragnal ? new Date(sb.tragnal) : null, m = /^(\d{1,2}):(\d{2})$/.exec(String(sb.chas || ''));
    if (tr && !isNaN(tr) && m) {
      var base = new Date(tr.getFullYear(), tr.getMonth(), tr.getDate(), +m[1], +m[2]);
      if (tr - base > 30 * 60000) s += ' (пускът от ' + sb.chas + ' тръгна в ' + hhmm(tr) + ' — лаптопът беше изключен)';
    }
    return s;
  }
  function sabRow(e, ime, val, cls, a) {
    var h = '<span class="sab-e" aria-hidden="true">' + e + '</span><span class="sab-k">' + ime + '</span><span class="sab-v">' + val + '</span>';
    return a ? '<button type="button" class="sab-r' + (cls ? ' ' + cls : '') + '" data-a="' + a + '">' + h + '<span class="sab-go" aria-hidden="true">›</span></button>' : '<div class="sab-r' + (cls ? ' ' + cls : '') + '">' + h + '</div>';
  }
  // горната част на листа „Събрано до …“ (и разгънатото „Подробно“ в „Одобряваш ли деня?“) [§6.3]
  function sabTop(d, zagl) {
    var sb = sabOf(d); if (!sb) return '';
    var iz = sb.izvori || {}, sp = svSpi(), o = d.obekt || OBEKT_KOD, h = '';
    if (zagl) h += '<div class="ap-sum"><span class="ap-d">' + esc(dayTitle(d.data)) + '</span><span class="ap-v">v' + esc(d.versiq) + '</span></div>';
    if (sp.spi) h += '<p class="fr-sleep">💻 Лаптопът е изключен от ' + esc(sp.ot) + ' — данните след това не са събрани; черновата е от ' + esc(rel(d.obnoven)) + '.</p>';
    h += '<p class="sab-ch"><b>Черновата:</b> ' + esc(verRed(d, sb)) + '</p><div class="sab-l"><div class="sab-t">Събрано до ' + esc(rel(sb.vzeto)) + ':</div>';
    [['teams', '💬', 'Тиймс'], ['poshta', '✉️', 'Поща'], ['intranet', '🗂️', 'Интранет']].forEach(function (z) {
      var x = iz[z[0]];
      var v = !x ? '—' : (x.posledno ? esc(rel(x.posledno)) + ' ' : '') + (x.ok === false ? (z[0] === 'intranet' && izVhod() ? '⚠️ иска вход — влез отново от лаптопа' : '⚠️ не е чело') : '✓') + (z[0] === 'intranet' ? ' · чете се до 20:00' : '');
      h += sabRow(z[1], z[2], v, x && x.ok === false ? 'warn' : '');
    });
    var pz = iz.prisystvia || {}, p = prisOk() ? prisOf(o, d.data) : null, pv = p ? prisVav(d) : null, pt, pc = '';
    if (!p && !pz.ima_zapis) { pt = '⚠️ още няма запис за деня'; pc = 'warn'; }
    else if (p && pv && Date.parse(pv) > Date.parse(sb.vzeto)) { pt = 'въведени след черновата (' + esc(hmIso(pv)) + ') — влизат в следващата версия'; pc = 'warn'; }
    else if (p) pt = (pv ? 'въведени ' + esc(rel(pv)) + ' · ' : '') + 'нето ' + esc(p.neto) + ' ✓';
    else pt = (pz.vavedeno ? 'въведени ' + esc(rel(pz.vavedeno)) + ' · ' : '') + (pz.neto != null ? 'нето ' + esc(pz.neto) + ' ' : '') + '✓';
    h += sabRow('👷', 'Присъствия', pt, pc);
    var dx = DOK.den[dokKey(d)], rows = dokOf(d), b = dokBroi(rows);
    if (rows) h += sabRow('📎', 'Приложения', !b.n ? 'няма за деня' : b.n + ' · прочетени ' + b.prochet + (b.samo_ime ? ' · само по име ' + b.samo_ime : '') + (b.ne_moje ? ' · не може ' + b.ne_moje : '') +
      (b.nov + b.otlojen ? ' · ' + dokNp(b) : ''), b.nov + b.otlojen ? 'warn' : '', b.n ? 'dokDen' : '');
    else h += sabRow('📎', 'Приложения', dx && dx.st === 'missing' ? 'регистърът още не е в облака' : dx && dx.st === 'net' ? '📴 когато има покритие' : dx && dx.st === 'err' ? 'не се заредиха' : '<span class="pulse" aria-hidden="true"></span>', '');
    var mt = iz.meteo || {};
    h += sabRow('🌡️', 'Времето', mt.ok ? esc(mt.mqsto || 'модел за града') + ' ✓' : 'няма — раздел 2 е по съобщенията', '');
    h += '</div>';
    var sl = sledOf(d);
    h += offNow() || !sl || sl.st === 'net' ? '<p class="sab-sl">📴 Новото след черновата — когато има покритие.</p>'
      : sl.st !== 'ok' ? (sl.busy ? '<p class="sab-sl"><span class="pulse" aria-hidden="true"></span> проверявам дошлото след черновата…</p>' : '')
      : sl.teams + sl.mail ? '<p class="sab-sl warnline">След черновата е дошло: 💬 ' + sl.teams + ' · ✉️ ' + sl.mail + ' — влизат в следващата версия (' + esc(slednaV(d)) + ').</p>'
      : '<p class="sab-sl">Нищо ново след черновата.</p>';
    return h;
  }
  function openSab() {
    var d = S.den; if (!d || !sabOf(d)) return;
    dokLoad(d); sledLoad(d, sabOf(d).vzeto);
    openSheet('Събрано до ' + rel(sabOf(d).vzeto), '<div id="sabB" class="sab-sh">' + sabTop(d, true) + '</div>', 'sab');
  }
  function sabSheetPaint() { var b = sheetEl && sheetKind === 'sab' ? sheetEl.querySelector('#sabB') : null; if (b && S.den) putH(b, sabTop(S.den, true)); }
  // „Одобряваш ли деня?“ — горната част, свита до „Събрано до“ + редовете с ⚠️; „Подробно ›“ я разгъва
  function sabApTop(d, L) {
    var sb = sabOf(d);
    return '<div class="ap-sab"><div class="ap-sab1">📥 Събрано до ' + esc(rel(sb.vzeto)) + ' · v' + esc(d.versiq) + ' от ' + esc(rel(d.obnoven)) + '</div>' +
      (L.length ? L.map(function (x) { return '<p class="ap-lp">' + esc(x.txt) + '</p>'; }).join('') : '<p class="ap-lp ok">✓ Всичко за деня е събрано</p>') +
      '<details class="ap-det"><summary>Подробно ›</summary><div class="sab-sh">' + sabTop(d, false) + '</div></details></div>';
  }
  function apWait() {
    var d = S.den; closeSheet();
    if (d) toast('Добре — следващата версия идва ' + slednaV(d) + '. Отговорите ти остават.');
  }

  // ---- 1а [§4.4, §6.6]: одобрен/вписан ден — закъснелите („влязоха в …“ / „остават само в AiLab“ / „влиза в следващата чернова“) ----
  function zakLine(d) {
    if (!d || d.status === 'chernova' && apprState().k === 'none') return '';
    var last = null; S.res.forEach(function (r) { if (r.den_id === d.id && r.vid === 'odobri') last = r; });
    liveQ().forEach(function (it) { if (it.tbl === 'resheniq' && it.row.vid === 'odobri' && it.row.den_id === d.id) last = it.row; });
    var z = ZAK[dokKey(d)], n = 0, kam = null;
    (z && z.rows || []).forEach(function (r) {
      var s = jObj(r.sabrano), x = s && jObj(s.zakasneli) ? jObj(s.zakasneli)[d.data] : null;
      if (x && +x.n > 0) { n += +x.n; if (!kam || r.data < kam.data) kam = r; }
    });
    if (n && kam) return '<button type="button" class="zak-l" data-a="day" data-id="' + esc(kam.id) + '">⏰ ' + n + ' ' + pl(n, 'закъсняло нещо', 'закъснели неща') + ' за този ден ' + pl(n, 'влезе', 'влязоха') + ' в ' + esc(dvDat(kam.data, true)) + ' ›</button>';
    var sb = sabOf(d); if (!sb || !last) return '';
    var tk = last.tekst;
    if (tk === 'добави утре') {
      var dn = ymd(nextPisanaD(d)) === ymd(now());
      return '<p class="zak-p">⏰ Каквото дойде за този ден, влиза в следващата чернова (' + (dn ? 'тази вечер' : 'утре в 19:00') + ').</p>';
    }
    var sl = sledOf(d);
    return sl && sl.st === 'ok' && sl.teams + sl.mail ? '<p class="zak-p">След одобрението са дошли: 💬 ' + sl.teams + ' · ✉️ ' + sl.mail + ' — остават само в AiLab.</p>' : '';
  }

  // ---- 1а [§6.8]: „📎 Приложенията“ — регистърът (Настройки, листовете „не може — защо“, „непрочетени“, „на деня“) ----
  var DOK_ST = { prochet: 'прочетен', samo_ime: 'само по име', ne_moje: 'не може', otlojen: 'отложен', nov: 'непрочетен' };
  // броевете: obekt,status на всички редове от DOK_OT, по страници — без таван (1000 реда стигат само до декември)
  function dokAllLoad(force) {
    if (DOK.allBusy || (!force && DOK.all && Date.now() - DOK.allAt < 300000)) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { if (!DOK.all) DOK.allSt = 'net'; return; }
    DOK.allBusy = true;
    allPages(function (rg) { return api.dokVsichki(DOK_OT, rg); }).then(function (rows) { DOK.allBusy = false; DOK.all = rows || []; DOK.allSt = 'ok'; DOK.allAt = Date.now(); dokAllPaint(); },
      function (e) { DOK.allBusy = false; DOK.allSt = isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err'; DOK.allErr = e; DOK.allAt = Date.now(); dokAllPaint(); });
  }
  // листовете — своя заявка само за своите статуси (не изрязък от броевете): старите „не може“ не отпадат
  var DOK_LST = { ne: ['ne_moje'], nov: ['nov', 'otlojen'] };
  function dokLstLoad(v, force) {
    var x = DOK.lst[v];
    if (!DOK_LST[v] || (x && (x.busy || (!force && x.rows && Date.now() - (x.at || 0) < 300000)))) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { DOK.lst[v] = Object.assign(x || {}, { st: 'net' }); return; }
    DOK.lst[v] = Object.assign(x || {}, { busy: true });
    allPages(function (rg) { return api.dokSt(DOK_OT, DOK_LST[v], rg); }).then(function (rows) { DOK.lst[v] = { rows: rows || [], st: 'ok', at: Date.now() }; dokAllPaint(); },
      function (e) { DOK.lst[v] = Object.assign(DOK.lst[v] || {}, { busy: false, at: Date.now(), err: e, st: isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err' }); dokAllPaint(); });
  }
  function dokAllPaint() {
    if (view === 'nastroiki') renderNastroiki();
    if (sheetKind === 'dok' && DOK.sh) dokSheet(DOK.sh, true);
  }
  function dokMsg(st, err) {
    if (st === 'missing') return '<p class="small muted">Регистърът на приложенията още не е в облака.</p>';
    if (st === 'net') return '<p class="small muted">📴 Когато има покритие.</p>';
    if (st === 'err') return '<p class="small muted">Не се зареди: ' + esc(errBg(err)) + '</p>';
    return '<p class="small muted"><span class="pulse" aria-hidden="true"></span> зареждам…</p>';
  }
  function dokAllHtml() {
    if (!DOK.all) return dokMsg(DOK.allSt, DOK.allErr);
    var b = dokBroi(DOK.all), ag = DOK.all.filter(function (r) { return r.obekt === 'ag'; }).length, sk = DOK.all.filter(function (r) { return r.obekt === 'soft'; }).length, ob = b.n - ag - sk, nn = b.nov + b.otlojen;
    return '<p class="dok-s">' + ['Амур ' + ag, 'Скай ' + sk].concat(ob ? ['Общо ' + ob] : []).concat(['прочетени ' + b.prochet, 'само по име ' + b.samo_ime, 'не може ' + b.ne_moje, dokNp(b)]).join(' · ') + '</p>' +
      '<div class="dok-b"><button type="button" class="btn ghost sb" data-a="dokSh" data-v="ne"' + (b.ne_moje ? '' : ' disabled') + '>Не може — защо (' + b.ne_moje + ') ›</button>' +
      '<button type="button" class="btn ghost sb" data-a="dokSh" data-v="nov"' + (nn ? '' : ' disabled') + '>Непрочетени (' + nn + ') ›</button></div>' +
      '<p class="small muted">Всеки файл от мейлите и Тиймс получава статус, когато лаптопът пише черновата: прочетен, само по име (чертеж, снимка, архив) или „не може“ с причината. Непрочетените (и отложените заради тавана 12 на ден) ги чете следващият пуск.</p>';
  }
  function dokIme(r) { return r.ime || String(r.kade || '').split('/').pop(); }
  function dokRow(r, sDen, kr) {
    var o = r.obekt ? (r.obekt === 'ag' ? 'Амур' : r.obekt === 'soft' ? 'Скай' : 'Общо') : '';
    var hd = (sDen ? '' : dvDat(r.data, true) + ' · ' + (o ? o + ' · ' : '')) + '📄 ' + dokIme(r);
    var mt = [r.podatel, r.tema ? '„' + r.tema + '“' : ''].filter(Boolean).join(' ');
    return '<div class="dok-r"><div class="dok-h">' + esc(hd) + (r.vajen ? ' <span class="pill p-warn">важен</span>' : '') + '</div>' +
      (mt ? '<div class="small muted">' + esc(mt) + '</div>' : '') +
      (kr && r.status === 'prochet' && r.kratko ? '<div class="small">' + esc(r.kratko) + '</div>' : '') +
      (r.status !== 'prochet' ? '<div class="small"><b>' + esc(DOK_ST[r.status] || r.status) + '</b>' + (r.prichina ? ' — ' + esc(r.prichina) : '') + '</div>' : '') +
      (okOd(r.url) ? '<div class="dok-a">' + extA(r.url, 'btn ghost sb', 'Отвори ›', 'od') + '</div>' : '') + '</div>';
  }
  // групи по причина: „Сканиран — нечетим (5)“ …
  function dokGrupi(rows, kr, sDen) {
    var g = {}, red = [];
    rows.forEach(function (r) { var k = String(r.prichina || DOK_ST[r.status] || '—').trim(); if (!g[k]) { g[k] = []; red.push(k); } g[k].push(r); });
    red.sort(function (a, b) { return g[b].length - g[a].length; });
    return red.map(function (k) { return '<h3 class="dok-g">' + esc(cap(k)) + ' (' + g[k].length + ')</h3>' + g[k].map(function (r) { return dokRow(r, sDen, kr); }).join(''); }).join('');
  }
  function dokSheet(v, live) {
    DOK.sh = v;
    if (!live) { dokLstLoad(v); dokAllLoad(); }
    var x = DOK.lst[v];
    var body = x && x.rows ? (x.rows.length ? dokGrupi(x.rows, false, false) : '<p class="grp-e">Няма.</p>') : dokMsg(x && !x.busy ? x.st : '', x && x.err);
    if (live) { var b = sheetEl && sheetKind === 'dok' ? sheetEl.querySelector('#dokB') : null; if (b) putH(b, body); return; }
    openSheet(v === 'ne' ? '📎 Не може — защо' : '📎 Непрочетени приложения', '<div id="dokB" class="dok-l">' + body + '</div>', 'dok');
  }
  // „📎 Приложенията на деня“ (от листа „Събрано до …“): същите редове само за деня, с kratko за прочетените
  function dokDenBody() {
    var d = S.den, rows = d ? dokOf(d) : null;
    if (!rows) return '<p class="small muted">' + (d && DOK.den[dokKey(d)] && DOK.den[dokKey(d)].st === 'missing' ? 'Регистърът на приложенията още не е в облака.' : '<span class="pulse" aria-hidden="true"></span> зареждам…') + '</p>';
    if (!rows.length) return '<p class="grp-e">Няма приложения за деня.</p>';
    var ord = { nov: 0, otlojen: 1, ne_moje: 2, samo_ime: 3, prochet: 4 };
    return rows.slice().sort(function (a, b) { return (ord[a.status] || 0) - (ord[b.status] || 0) || String(a.vreme || '').localeCompare(String(b.vreme || '')); }).map(function (r) { return dokRow(r, true, true); }).join('');
  }
  function openDokDen() { var d = S.den; if (!d) return; dokLoad(d); openSheet('📎 Приложенията на деня', '<div id="dokdB" class="dok-l">' + dokDenBody() + '</div>', 'dokd'); }
  function dokDenPaint() { var b = sheetEl && sheetKind === 'dokd' ? sheetEl.querySelector('#dokdB') : null; if (b) putH(b, dokDenBody()); }

  // ---- 1а [§6.9, §4.10]: мерене — САМО колко време е отворен всеки екран, докато се ползва (без паузи над 2 мин) ----
  // SES — текущият отрязък; при смяна на екран/ден, скриване и на 10 мин → един ред metriki (≥ 5 с), kogda = краят на отрязъка
  var SES = { v: '', den: null, ms: 0, poslDok: 0, last: Date.now(), t10: Date.now() };
  var MER = { rows: null, st: '', at: 0, start: null, startSt: '', off: false, zatv: {} };
  var MER_V = { pregled: 'Преглед', tablo: 'Табло', zadachi: 'Задачи', nastroiki: 'Настройки' };
  function sesKey() { return view === 'day' ? 'pregled' : view === 'tablo' ? 'tablo' : view === 'deistviq' ? 'zadachi' : view === 'nastroiki' ? 'nastroiki' : ''; }
  function sesAkt() { SES.poslDok = Date.now(); }
  function sesTick() {
    var n = Date.now(), dt = n - SES.last, k = sesKey(), dn = k === 'pregled' && S.den ? S.den.id : null;
    SES.last = n;
    if (k !== SES.v || dn !== SES.den) { sesFlush(); SES.v = k; SES.den = dn; }
    else if (k && !document.hidden && dt > 0 && n - SES.poslDok <= 120000) SES.ms += Math.min(dt, 2000);
    if (n - SES.t10 >= 600000) { SES.t10 = n; sesFlush(); }
  }
  function sesFlush() {
    if (SES.ms >= 5000 && SES.v && !MER.off) {
      var row = { vid: 'aktivno_' + SES.v + '_sek', stoinost: Math.min(Math.round(SES.ms / 1000), 3600), den_id: SES.v === 'pregled' ? SES.den : null, kogda: nowIso() };
      enqueue('metriki', row);   // не през send(): мерилото не бива да затваря чакащо „Отмени“ (commitUndos)
      if (MER.rows) MER.rows.push({ vid: row.vid, stoinost: row.stoinost, kogda: row.kogda });
      if (!offNow()) flush(true);
    }
    SES.ms = 0;
  }
  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (ev) { document.addEventListener(ev, sesAkt, { passive: true, capture: true }); });
  window.addEventListener('scroll', sesAkt, { passive: true });
  setInterval(sesTick, 1000);
  function merLoad(force) {
    if (MER.busy || (!force && MER.rows && Date.now() - MER.at < 120000)) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { if (!MER.rows) MER.st = 'net'; return; }
    MER.busy = true;
    var ot = new Date(nowMs() - 8 * 864e5).toISOString();
    api.vremeSedm(ot).then(function (rows) { MER.busy = false; MER.rows = rows || []; MER.st = 'ok'; MER.at = Date.now(); if (view === 'nastroiki') renderNastroiki(); },
      function (e) { MER.busy = false; MER.st = isMissing(e) || isNoCol(e) ? 'missing' : 'err'; MER.at = Date.now(); if (view === 'nastroiki') renderNastroiki(); });
  }
  // началото на седмицата на изходното мерене = първият ред aktivno_* (публикуването на 1а); няма → днес [§6.9, §8 т.6]
  function merStartLoad() {
    if (MER.startSt || offNow() || !api || (!DEMO && (!db || !user))) return;
    MER.startSt = 'load';
    api.merStart().then(function (r) { var x = Array.isArray(r) && r[0] ? new Date(r[0].kogda) : null; MER.start = x && !isNaN(x) ? ymd(x) : ymd(now()); MER.startSt = 'ok'; renderIzvan(); },
      function (e) { MER.startSt = isNet(e) || isAuth(e) ? '' : 'err'; });   // отказ/грешка → без картата до следващото отваряне (без порой от заявки)
  }
  function merSedmica() {
    if (!MER.start) return false;
    var s = parseD(MER.start), e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6), t = ymd(now());
    return t >= MER.start && t <= ymd(e);
  }
  function merDni() {
    var by = {};
    function put(dkey, vid, st, kogda) {
      var x = by[dkey] || (by[dkey] = { a: {}, sum: 0, iz: {} });
      var m = /^aktivno_(\w+)_sek$/.exec(vid), z = /^izvan_(\w+)_min$/.exec(vid);
      if (m) { x.a[m[1]] = (x.a[m[1]] || 0) + (+st || 0); x.sum += +st || 0; }
      else if (z) { if (!x.iz[z[1]] || kogda > x.iz[z[1]].k) x.iz[z[1]] = { v: +st || 0, k: kogda }; }
    }
    (MER.rows || []).forEach(function (r) { var d = new Date(r.kogda); if (!isNaN(d)) put(ymd(d), r.vid, r.stoinost, r.kogda); });
    if (SES.v && SES.ms >= 1000) put(ymd(now()), 'aktivno_' + SES.v + '_sek', Math.round(SES.ms / 1000), nowIso());   // текущият отрязък
    return by;
  }
  function mn(sec) { return Math.round((sec || 0) / 60); }
  function merHtml() {
    if (MER.off) return '<p class="small muted">Мерилото още не е готово в базата (лаптопът я обновява).</p>';
    if (!MER.rows) return MER.st === 'net' ? '<p class="small muted">📴 Когато има покритие.</p>' : MER.st === 'missing' || MER.st === 'err' ? '<p class="small muted">Не се зареди — опитай по-късно.</p>' : '<p class="small muted"><span class="pulse" aria-hidden="true"></span> зареждам…</p>';
    var by = merDni(), t = ymd(now()), x = by[t] || { a: {}, sum: 0, iz: {} }, ot = ymd(new Date(nowMs() - 6 * 864e5));
    var dnes = 'Днес: ' + mn(x.sum) + ' мин' + ['pregled', 'tablo', 'zadachi', 'nastroiki'].filter(function (k) { return x.a[k] >= 30; }).map(function (k) { return ' · ' + MER_V[k] + ' ' + mn(x.a[k]); }).join('');
    var dni = Object.keys(by).filter(function (k) { return k >= ot && k <= t && by[k].sum > 0; }), sum = 0, pr = 0;
    dni.forEach(function (k) { sum += by[k].sum; if (by[k].a.pregled) pr++; });
    // ръчните числа: средното за всеки вид — по дните, в които е попълнен (празното поле не е 0)
    var izd = Object.keys(by).filter(function (k) { return k >= ot && k <= t && Object.keys(by[k].iz).length; }), iz = { intranet: 0, poshta: 0, dokladi: 0 }, izn = { intranet: 0, poshta: 0, dokladi: 0 };
    izd.forEach(function (k) { Object.keys(iz).forEach(function (z) { if (by[k].iz[z]) { iz[z] += by[k].iz[z].v; izn[z]++; } }); });
    Object.keys(iz).forEach(function (z) { iz[z] = izn[z] ? iz[z] / izn[z] : 0; });
    var n = izd.length;
    return '<p class="mer-1"><b>' + esc(dnes) + '</b></p>' +
      '<p class="mer-2">' + (dni.length ? 'Последните 7 дни: средно ' + mn(sum / dni.length) + ' мин на ден (' + pr + ' ' + pl(pr, 'ден', 'дни') + ' с преглед)' : 'Последните 7 дни: още няма измерено.') + '</p>' +
      (n ? '<p class="mer-2">Извън AiLab (по твоите числа): средно Интранет ' + Math.round(iz.intranet) + ' · мейли ' + Math.round(iz.poshta) + ' · доклади ' + Math.round(iz.dokladi) + ' мин на ден (' + n + ' ' + pl(n, 'ден', 'дни') + ')</p>' : '') +
      '<p class="small muted">Мери се само колко време екранът е отворен, докато го ползваш (без паузи над 2 минути). Нищо друго не се записва.</p>';
  }
  // „⏱ Днес извън AiLab“ — тиха карта в Таблото: само в седмицата на мерене, след 18:00, ако не е записана/отказана за деня
  function izvanKey() { return 'ailab-izvan-' + ymd(now()); }
  function izvanZatv() { var k = izvanKey(); if (MER.zatv[k]) return true; try { return !!lget(k); } catch (e) { return false; } }
  function izvanVidim() {
    if (MER.off || izvanZatv()) return false;
    if (DEMO && D && D.izvanForce) return true;
    if (!MER.start) { merStartLoad(); return false; }
    return merSedmica() && minOf(now()) >= 18 * 60;
  }
  function renderIzvan() {
    var el = box('#tb-izvan'); if (!el) return;
    if (!izvanVidim()) { el.innerHTML = ''; return; }
    el.innerHTML = '<section class="izv" aria-label="Днес извън AiLab"><h2>⏱ Днес извън AiLab <span class="muted">(по желание, ≈ 10 с)</span></h2>' +
      '<p class="small muted">Колко минути днес отидоха за тези неща — за седмицата на изходното мерене. Празно поле — нищо не се записва.</p>' +
      '<div class="izv-f">' + [['intranet', 'Интранет'], ['poshta', 'Мейли'], ['dokladi', 'Доклади']].map(function (z) {
        return '<label class="izv-l"><span>' + z[1] + '</span><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" id="izv-' + z[0] + '" aria-label="' + z[1] + ', минути" placeholder="мин"></label>';
      }).join('') + '</div><div class="err" id="izvE" hidden></div>' +
      '<div class="izv-b"><button type="button" class="btn" data-a="izvanSave">Запиши</button><button type="button" class="btn ghost" data-a="izvanNe">Не днес</button></div></section>';
  }
  function izvanZatvori() { var k = izvanKey(); MER.zatv[k] = true; lset(k, '1'); if (D) D.izvanForce = false; renderIzvan(); }
  function izvanSave() {
    var vals = {}, bad = false, ee = $('#izvE');
    ['intranet', 'poshta', 'dokladi'].forEach(function (z) {
      var i = $('#izv-' + z), v = i ? String(i.value || '').trim() : '';
      if (!v) return;
      if (!/^\d{1,3}$/.test(v) || +v > 600) { bad = true; return; }
      vals[z] = +v;
    });
    if (bad) { if (ee) { ee.textContent = 'Само цели минути от 0 до 600.'; ee.hidden = false; } return; }
    var ks = Object.keys(vals);
    if (!ks.length) { if (ee) { ee.textContent = 'Попълни поне едно число — или „Не днес“.'; ee.hidden = false; } return; }
    var n = now(), kg = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0).toISOString();   // 12:00 на деня — редът е за деня
    ks.forEach(function (z) {
      var row = { vid: 'izvan_' + z + '_min', stoinost: vals[z], den_id: null, kogda: kg };
      enqueue('metriki', row); if (MER.rows) MER.rows.push({ vid: row.vid, stoinost: row.stoinost, kogda: kg });
    });
    if (!offNow()) flush(true);
    izvanZatvori();
    toast('Записано — благодаря');
  }

  // ---------- Етап 6 [§5.6, F8]: без чакане след действие — „Отмени“ в ЕДНА лента долу ~5 с (правило 8) ----------
  // u = {key, kind: 'pc' (карта в Преглед) | 'grp' („Видях останалите“) | 'dc' (решение в Табло) | 'dn' (🚫 в Табло) | 'toast', lbl, tid,
  //      tbl/row/meta — записът, или run() — само на телефона; now() — веднага (напр. noteClose); back() — обратното на now/run
  //      при „Отмени“; pre() — точно преди изпращането (метрики); done(r), fail(e); redo() — „Отмени“ връща листа с текста [К22]}
  // Записът влиза в опашката ВЕДНАГА като задържан → картата отива в крайното си състояние веднага, броячите го броят;
  // тръгва от undoCommit(): след UNDO_MS, при скриване, смяна на таб/ден/обект, „Одобрявам“, всеки друг send().
  var UNDO = {}, UNDO_MS = 5000;   // РП избра 2 с на 28.09, защото картата чакаше; сега нищо не чака — лентата само стои долу 5 с (О6)
  var SHU = null;                  // „Отмени“ на отворения лист („❓ Искането е записано“, „✉ Питай“) — на пауза, докато листът е отворен
  function undoStart(u) {
    commitUndos();   // едно „Отмени“ наведнъж: чакащото досега тръгва (лентата показва новото)
    u.t0 = Date.now(); u.at = nowIso(); u.qid = newQid();
    UNDO[u.key] = u;
    if (u.tbl) enqueue(u.tbl, u.row, u.meta, u.at, u.qid, true);   // в опашката от първия миг — задържан [т.1]
    if (u.now) u.now();
    if (u.run) u.run();
    u.timer = setTimeout(function () { undoCommit(u.key); }, UNDO_MS);
    undoPaint(u, 'start');
  }
  function undoCancel(key) {
    var u = UNDO[key]; if (!u) return;
    clearTimeout(u.timer); delete UNDO[key];
    if (SHU === key) SHU = null;
    if (u.tbl) {
      var it = findQ(u.qid);
      // вече е пуснат (или изпратен) → нищо не се връща [т.6]
      if (!it || !isHeld(it)) { undoPaint(u, 'commit'); toast('Вече е записано — отмени от Задачи'); return; }
      dropQ(u.qid);
    }
    if (u.back) u.back();
    undoPaint(u, 'cancel');
    if (u.redo) u.redo();   // „Отмени“ след лист → листът се връща с написания текст (записът с текст от РП не се губи) [К22]
  }
  // задържаният → пуснат (hold и pauza вън); редът в опашката е същият [К2]
  function unHold(qid) {
    setQueue(queue().map(function (x) { if (x.qid !== qid) return x; var y = Object.assign({}, x); delete y.hold; delete y.pauza; return y; }));
  }
  // flush, докато записът тръгне (или остане по истинска причина): flush може вече да тече и да е спрял на него, преди да е пуснат
  function flushFor(qid, n) {
    return flush(true).then(function () {
      var x = findQ(qid);
      if (x && !x.err && !isHeld(x) && (n || 0) < 3 && !FL.net && !offNow() && navigator.onLine && (DEMO || (db && user))) return flushFor(qid, (n || 0) + 1);
    });
  }
  // След 5 с, при скриване, смяна на таб/ден: пуска задържания (вече е в опашката — НИКОГА второ enqueue), после мрежата [т.7, К22]
  function undoCommit(key) {
    var u = UNDO[key]; if (!u) return;
    clearTimeout(u.timer); delete UNDO[key];
    if (SHU === key) SHU = null;
    if (!u.tbl) { undoPaint(u, 'commit'); return; }
    if (findQ(u.qid)) unHold(u.qid);
    if (u.pre) u.pre();
    undoPaint(u, 'commit');
    FL.net = false;
    flushFor(u.qid).then(function () {
      var x = findQ(u.qid);
      if (!x) { if (u.done) u.done('sent'); renderTabs(); return; }
      if (x.err) { if (u.fail) u.fail({ code: x.code, message: x.err, bg: x.err }); toast('Не се записа: ' + x.err + ' — виж лентата горе', 'bad'); renderCurrent(); return; }
      if (u.done) u.done('queued');
      if (offNow() || FL.net || !navigator.onLine) { if (FL.net && !S.offline) setOffline(); toast((u.lbl || 'Записано') + ' · ⏳ чака връзка'); }
      renderTabs(); renderBanners();
    });
  }
  function commitUndos() { Object.keys(UNDO).forEach(undoCommit); }
  // Пауза, докато листът над записа е отворен (pauza в опашката само за сведение — flush и без това не го праща) [т.10]
  function undoPause(key) {
    var u = UNDO[key]; if (!u || u.paused) return;
    clearTimeout(u.timer); u.timer = null; u.paused = true;
    if (u.tbl) setQueue(queue().map(function (x) { return x.qid === u.qid ? Object.assign({}, x, { pauza: true }) : x; }));
    ubPaint(true);
  }
  function undoResume(key) {
    var u = UNDO[key]; if (!u || !u.paused) return;
    u.paused = false; u.t0 = Date.now();
    if (u.tbl) setQueue(queue().map(function (x) { if (x.qid !== u.qid) return x; var y = Object.assign({}, x); delete y.pauza; return y; }));
    u.timer = setTimeout(function () { undoCommit(u.key); }, UNDO_MS);
    ubPaint(true);
  }
  // Лентата #undoBar — една, над табовете; показва последното чакащо „Отмени“; докато е видима, екранът получава отстъп долу [т.5]
  function ubEl() {
    var b = document.getElementById('undoBar');
    if (!b) { b = document.createElement('div'); b.id = 'undoBar'; b.className = 'undobar'; b.setAttribute('role', 'status'); b.hidden = true; document.body.appendChild(b); }
    return b;
  }
  function ubPaint(force) {
    var u = null, b = ubEl();
    Object.keys(UNDO).forEach(function (k) { if (!u || UNDO[k].t0 >= u.t0) u = UNDO[k]; });
    if (!u) { if (!b.hidden) { b.hidden = true; b._k = null; b.innerHTML = ''; document.body.classList.remove('ub-on'); } return; }
    var k = u.key + ':' + u.t0;
    if (force || b._k !== k) {
      b._k = k;
      b.innerHTML = '<span class="ub-l">' + esc(u.lbl) + '</span><button type="button" class="ub-b" data-a="undo" data-k="' + esc(u.key) + '">Отмени</button>' +
        '<i class="ub-p' + (u.paused ? ' pz' : '') + '" style="animation-duration:' + Math.max(0, UNDO_MS - (Date.now() - u.t0)) + 'ms" aria-hidden="true"></i>';
    }
    b.hidden = false; document.body.classList.add('ub-on');
    document.documentElement.style.setProperty('--ubh', Math.round(b.getBoundingClientRect().height || 56) + 'px');
  }
  // Начало/отмяна: картата отива в крайното си състояние ВЕДНАГА (или се връща); пускане: само лентата и значките [т.4]
  function undoPaint(u, ph) {
    ubPaint();
    // листът „❓ Искането е записано“ е още отворен, а записът тръгна (скрито приложение) → бутонът отменя вече записаната задача
    if (ph === 'commit' && sheetKind === 'isk' && ISK && ISK.key === u.key && sheetEl) { var ib = sheetEl.querySelector('[data-a="iskUndo"]'); if (ib) ib.textContent = 'Отмени задачата'; }
    if (ph === 'commit') { renderTabs(); renderBanners(); if (view === 'deistviq') renderActsTab(); else if (view === 'day') { renderActs(); renderIzt(); } return; }
    if (view === 'day') {
      var t = u.kind === 'pc' && u.tid != null ? findT(u.tid) : null;
      // картата излиза веднага (свиване 180 ms) → „Прегледани“; плочките „остават N“ и лентата — без да чакат свиването
      if (ph === 'start' && t && pregledana(t)) { renderSum(); renderAppr(); renderStrip(); pcLeave(u.tid); }
      else keepAnchor(function () { renderSum(); renderGroups(); });
      renderAppr(); renderStrip(); renderFull(); renderIzt(); renderActs();
      if (WIDE) renderPan();
    }
    if (sheetKind === 'mdk') mdkRefresh();
    if (view === 'deistviq') { renderActsTab(); }
    if (view === 'tablo') { renderOpen(true); renderTabloCounts(); }
    renderTabs(); renderBanners();
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
    var t = findT(tid), d = S.den; if (!t || !d) return;
    if (newPending()) { toast('Има нова версия — натисни „Покажи новата версия“ първо.', 'bad'); return; }
    var res = t.grupa === 'reshenie';
    if (!res && (locked() || t.istina === 'provereno')) { pcSeen(tid); return; }
    if (mine(tid).ok) return;   // вече е потвърдено (и задържаното в опашката)
    var row = { den_id: d.id, tochka_id: tid, vid: 'potvardi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    if (res) row.tekst = 'отговорено';
    var o = d.obekt || OBEKT_KOD, data = d.data;
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: res ? '✓ Отговорено' : '✓ Вярно', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      now: function () { if (res) noteClose(tid, o, data, true, null); },   // Таблото я скрива веднага
      back: function () { if (res) unClose(tid); } });
  }
  // „Отмени“ на затваряне, което още не е стигнало базата → решението пак е отворено и на Таблото
  function unClose(tid) { var c = TB.closed[tid]; if (c && !c.sent) { delete TB.closed[tid]; saveTablo(); } }
  // 📘 ⇄ 🚫 — пише 'izkljuchi' / 'vkljuchi' в resheniq (тригерът в базата сменя tochki.v_dnevnika веднага) [007]
  function pcDn(tid) {
    var t = findT(tid), d = S.den; if (!t || !d || !dnMozhe(t)) return;
    if (newPending()) { toast('Има нова версия — натисни „Покажи новата версия“ първо.', 'bad'); return; }
    if (locked()) { dnLkToast(); return; }
    var vk = !vDn(t);   // сега е изключена → връщам я
    var row = { den_id: d.id, tochka_id: tid, vid: vk ? 'vkljuchi' : 'izkljuchi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: vk ? '📘 Пак в дневника' : '🚫 Не за дневника', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      done: function () { renderFull(); } });
    // ред, който носи и други точки „в дневника“, остава в записа — един тост, не лист [§6.1 т.3, Р4]
    if (!vk) { var o2 = dnShared(t); if (o2) toast('Редът остава — носи и: „' + clip(o2, 48) + '“'); }
  }
  // Друга точка „в дневника“ на ред, който носи и тази → началото на текста ѝ (или null)
  function dnShared(t) {
    var q = queue(), out = null;
    String((S.den && S.den.zapis_md) || '').split('\n').some(function (l) {
      var ks = mdKs(l); if (ks.indexOf(t.k) < 0) return false;
      return ks.some(function (k) {
        if (k === t.k) return false;
        var o = findTk(k);
        if (!o) { out = 'ред без точка №' + k; return true; }
        if (vDn(o, q)) { out = o.tekst; return true; }
        return false;
      });
    });
    return out;
  }
  // Бутонът 📘/🚫: на одобрен/вписан ден — неактивен пил „… · вписан — промяна само с нова версия“ [§6.1 т.4]
  function dnBtn(t, vd, lk) {
    // k без свой ред в записа → нищо не може да се махне; сив пил вместо бутон (тап → обяснение)
    if (dnBezRed(t)) return '<button type="button" class="pill pc-dn lk" data-a="dnBez" aria-disabled="true">' + (vd ? '' : '🚫 · ') + 'няма свой ред в записа' + (vd ? '' : ' — нищо не се маха') + '</button>';
    if (!dnMozhe(t)) return '';
    if (lk) return '<button type="button" class="pill pc-dn lk' + (vd ? '' : ' off') + '" data-a="dnLk" aria-disabled="true">' + (vd ? '📘 в дневника' : '🚫 не за дневника') +
      ' · ' + (S.den && S.den.status === 'vpisana' ? 'вписан' : 'одобрен') + ' — промяна само с нова версия</button>';
    return '<button type="button" class="pill pc-dn' + (vd ? '' : ' off') + '" data-a="dn" data-tid="' + esc(t.id) + '" aria-pressed="' + !vd + '">' + (vd ? '📘 в дневника' : '🚫 не за дневника · върни') + '</button>';
  }
  function dnLkToast() {
    toast(S.den && S.den.status === 'vpisana' ? 'Денят е вписан — Word не се пипа. За промяна: „✎ Поясни“ и Claude ще предложи нова версия.'
      : 'Денят е одобрен — записът вече не се мени. За промяна: „✎ Поясни“ и Claude ще предложи нова версия.');
  }
  // изборът ми не е приложен от базата (тригерът) → кехлибарен ред, не тих пил [§6.1 т.8, К1, К2]
  function dnNeHtml(ne) {
    return '<p class="dn-ne">' + (ne.vid === 'vkljuchi' ? '📘' : '🚫') + ' не е приложено — ' + esc(ne.why) +
      (/няма я/.test(ne.why) ? ' · <button type="button" class="lnk" data-a="reload">Покажи новата версия и избери пак</button>' : '') + '</p>';
  }
  // ---- „Пълен запис“: тап на ред → лист „От кои точки е този ред“ [§6.1 т.1] ----
  var MK = null;   // {ks}
  function openMdK(ks) {
    var pts = ks.map(findTk).filter(function (t) { return t && dnMozhe(t); });
    if (!pts.length || !S.den) return;
    MK = { ks: ks, den: S.den.id };
    openSheet(pts.length === 1 ? 'От коя точка е този ред' : 'От кои точки е този ред', '<div id="mkB">' + mdkBody() + '</div>', 'mdk');
  }
  var GR_IME = { promqna: 'промяна', reshenie: 'за решение', neprovereno: 'непроверено', fakt: 'факт' };
  function mdkBody() {
    if (!MK || !S.den || S.den.id !== MK.den) return '<p class="muted">Денят е сменен.</p>';
    var lk = locked(), q = queue(), seen = {}, pts = [];
    MK.ks.forEach(function (k) { var t = findTk(k); if (t && dnMozhe(t) && !seen[t.id]) { seen[t.id] = 1; pts.push(t); } });
    return pts.map(function (t) {
      var vd = vDn(t, q), m = mine(t.id, q);
      // Етап 6: изборът се вижда веднага; „Отмени“ — в лентата долу [§5.6 т.11]
      return '<div class="mk-i' + (vd ? '' : ' izk') + '"><div class="mk-h"><span aria-hidden="true">' + emoT(t) + '</span><span class="pill p-neutral">' + esc(GR_IME[t.grupa] || t.grupa || 'точка') + '</span>' +
          (t.grupa !== 'fakt' ? '<span class="small muted">има карта в групите</span>' : '') + '</div>' +
        '<p class="mk-t">' + esc(t.tekst) + '</p>' + (m.dnNe ? dnNeHtml(m.dnNe) : '') +
        '<div class="mk-b">' + dnBtn(t, vd, lk) + '</div></div>';
    }).join('') + (MK.ks.length > 1 ? '<p class="small muted">Ред с няколко точки остава в записа, докато поне една е „в дневника“.</p>' : '');
  }
  function mdkRefresh() { var b = sheetKind === 'mdk' && sheetEl ? sheetEl.querySelector('#mkB') : null; if (b) putH(b, mdkBody()); }
  // „✓ Видях“ — локална отметка: не твърди „вярно“, не пише в базата и по вписан ден [К25]
  function pcSeen(tid) {
    var d = S.den; if (!d || vidOf(d.id, tid)) return;
    undoStart({ key: 'pc:' + tid, kind: 'pc', tid: tid, lbl: '✓ Видях', run: function () { vidMark(d.id, [tid]); }, back: function () { vidUnmark(d.id, [tid]); } });
  }
  function pcSeenAll(g) {
    var d = S.den; if (!d || !groupsOf()[g]) return;
    var q = queue(), ids = groupsOf()[g].filter(function (t) { return !pregledana(t, q); }).map(function (t) { return t.id; });
    if (!ids.length) return;
    undoStart({ key: 'grp:' + g, kind: 'grp', lbl: '✓ Видях ' + ids.length, run: function () { vidMark(d.id, ids); }, back: function () { vidUnmark(d.id, ids); } });
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
        : lk === 'nova' ? '<p class="warnline">Има нова версия — поправка се пише само към показаната. Натисни „Покажи новата версия“ за поправка; разяснението се пази към точката.</p>' : '') +
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
      now: function () { if (t.grupa === 'reshenie') noteClose(t.id, d.obekt || OBEKT_KOD, d.data, false, null); },
      back: function () { if (t.grupa === 'reshenie') unClose(t.id); } });
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
  // 1а [§4.4, §4.5]: „от ДД.ММ“ — източник от друг ден (закъснелите); „Метео“ — модел за града, без „Отвори“
  function srcDen(s) { return s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.den || '')) ? ' от ' + dvDat(s.den, true) : ''; }
  function srcItem(s) {
    if (kanalOf(s.tip) === 'meteo') return '<div class="src-i"><span class="ref">' + esc(s.n) + '</span><div><div class="src-t">🌡️ <b>' + esc(s.kratko || 'Метео') + '</b> — модел за града, не измерване на обекта' +
      (s.vreme ? ' · <span class="mono">' + esc(s.vreme) + '</span>' : '') + '</div></div></div>';
    return '<div class="src-i"><span class="ref">' + esc(s.n) + '</span><div><div class="src-t">' + tipEmo(s.tip) + ' <b>' + esc(s.tip || 'източник') + '</b>' +
      (s.vreme ? ' · <span class="mono">' + esc(s.vreme) + '</span>' : '') + esc(srcDen(s)) + '</div><div>' + esc(s.kratko || '') + '</div></div></div>';
  }
  // t — точката; den/o — денят и обектът ѝ (от Преглед или от Таблото). Една заявка М1 за всички източници.
  // Същото съдържание и в панела „Избрана точка“ на широк екран (SRC.el = панелът, не листът) [§6.2]
  function srcCardsHtml(izv) {
    return izv.map(function (s, i) { var m = srcMsg(s); return '<div class="src-card" data-si="' + i + '"><div class="src-in"></div>' + (m ? '<div class="src-ph" data-msg="' + esc(m) + '"></div>' : '') + '<div class="src-ft"></div></div>'; }).join('');
  }
  function srcInit(el, t, den, o) {
    normT(t);
    var izv = t.izvori || [];
    SRC = { el: el, tok: ++srcTok, t: t, den: den, o: o || null, izv: izv, st: 'load', full: {}, okolo: {}, files: null, fst: null };
    srcPhStart(den, izv, el);   // Етап 3: снимките под всеки Тиймс източник
    srcLoad();
    srcFill();
  }
  function openSources(t, den, o) {
    normT(t);
    var izv = t.izvori || [];
    openSheet('Източници (' + izv.length + ')', '<p class="sh-q">' + esc(clip(t.tekst, 220)) + '</p>' + srcCardsHtml(izv) +
      '<p class="small muted">Оригиналите са в OneDrive, в папката на деня. Тук — текстът и намалени снимки.</p>', 'src');
    srcInit(sheetEl, t, den, o);
  }
  function openSrc(tid) { var t = findT(tid); if (t) openSources(t, t.den_id, S.den ? S.den.obekt || OBEKT_KOD : OBEKT_KOD); }

  // ---------- широк екран: панел „Избрана точка“ (Преглед, 3-та колона) [§6.2] ----------
  // Избор: клик върху картата (не върху бутон) или „N източника ›“; по подразбиране — първата непрегледана карта.
  function panPoint() {
    if (!S.den) return null;
    if (S.selDen !== S.den.id) { S.selDen = S.den.id; S.selT = null; }
    var t = S.selT != null ? findT(S.selT) : null;
    if (!t || t.grupa === 'fakt') {
      var g = groupsOf(), q = queue(), all = g.promqna.concat(g.reshenie, g.neprovereno);
      t = all.filter(function (x) { return !pregledana(x, q); })[0] || all[0] || null;
      S.selT = t ? t.id : null;
    }
    return t;
  }
  function panSelect(tid) {
    if (!WIDE || view !== 'day' || !S.den) return false;
    var t = findT(tid); if (!t) return false;
    S.selT = t.id; S.selDen = S.den.id;
    Array.prototype.forEach.call(document.querySelectorAll('#groups .pc.sel'), function (n) { n.classList.remove('sel'); });
    Array.prototype.forEach.call(document.querySelectorAll('#groups .pc[data-tid="' + t.id + '"]'), function (n) { n.classList.add('sel'); });
    renderPan(true);
    var p = $('#pan'); if (p) p.scrollTop = 0;
    return true;
  }
  function renderPan(force) {
    var el = $('#panT'); if (!el || !WIDE) return;
    var t = panPoint(), key = t && S.den ? t.id + ':' + S.den.versiq + ':' + t.istina + ':' + (prdOf(t) && !vrazkaNe(t) ? 1 : 0) : '';
    if (!force && el._k === key) { panPhFill(); return; }
    el._k = key; el._h = null;
    if (!t) { el.innerHTML = '<div class="pan-c"><p class="grp-e">Няма точки за този ден — само „📄 Пълен запис“.</p></div>'; return; }
    var G = GRUPI.filter(function (x) { return x.k === t.grupa; })[0], ist = ISTINA[t.istina] || ISTINA.saobshteno, izv = t.izvori || [], hot = (t.vajnost || 1) >= 3;
    el.innerHTML = '<div class="pan-c g-' + esc(t.grupa) + '"><div class="pan-h"><span class="pan-l">Избрана точка</span>' + (G ? '<span class="pan-g">' + esc(G.t) + '</span>' : '') + '</div>' +
      '<div class="pan-t"><span class="pc-e" aria-hidden="true">' + emoT(t) + '</span><p>' + esc(t.tekst) + '</p></div>' + prdHtml(t) +
      '<div class="pan-p">' + verPills(t) + '<span class="pill ' + ist[1] + '">' + ist[0] + '</span>' + (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') + '</div>' +
      '<div id="panPh"></div>' +
      // Етап 6 [§5.4]: „✉ Питай“ и „→ Задача“ и от панела „Избрана точка“
      '<div class="pan-a"><button type="button" class="btn ghost sb" data-a="pitaiT" data-tid="' + esc(t.id) + '">✉ Питай по мейл</button>' +
        '<button type="button" class="btn ghost sb" data-a="act" data-tid="' + esc(t.id) + '">→ Задача</button></div></div>' +
      '<h3 class="pan-s">Източници' + (izv.length ? ' (' + izv.length + ')' : '') + '</h3>' +
      (izv.length ? '<div class="pan-src" id="panSrc">' + srcCardsHtml(izv) + '</div><p class="small muted">Оригиналите са в OneDrive, в папката на деня.</p>' : '<p class="grp-e">Точката няма източник.</p>');
    panPhFill();
    var ps = $('#panSrc');
    if (ps) srcInit(ps, t, t.den_id, S.den.obekt || OBEKT_KOD);
    else if (SRC && SRC.el && !document.contains(SRC.el)) SRC = null;
  }
  // снимките на точката — мрежа (до 12 + „+N“); тап → прегледът само на тях
  function panPhFill() {
    var b = box('#panPh'); if (!b) return;
    var t = S.selT != null ? findT(S.selT) : null, ph = t ? tPhotos(t) : null, n = ph ? ph.length : 0;
    if (!n) { b.innerHTML = ''; return; }
    b.innerHTML = '<div class="pan-phh">📷 ' + n + ' ' + pl(n, 'снимка', 'снимки') + ' към точката</div><div class="ph-g">' + ph.slice(0, 12).map(function (r, i) {
      var im = phImg(r.pat_mini, r);
      return '<button type="button" class="ph-t' + (im.x ? ' ph-x' : '') + '" data-a="pcPh" data-tid="' + esc(t.id) + '" data-i="' + i + '" aria-label="' + esc(phLbl(i, n, r)) + '">' + im.h + '</button>';
    }).join('') + (n > 12 ? '<button type="button" class="ph-t ph-pl" data-a="pcPh" data-tid="' + esc(t.id) + '" data-i="12" aria-label="' + esc('Още ' + (n - 12) + ' снимки') + '">+' + (n - 12) + '</button>' : '') + '</div>';
  }
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
    if (!x.el || !document.contains(x.el)) { SRC = null; return; }   // листът е затворен / панелът е пречертан
    Array.prototype.forEach.call(x.el.querySelectorAll('.src-card[data-si]'), function (c) {
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
    if (kanalOf(s.tip) === 'meteo') return [srcItem(s), ''];   // 1а [§4.5]: времето — само редът, без „Отвори“ и без „Поискай информация“
    if (r) {
      var mail = r.vid === 'mail', od = srcDen(s);
      var hd = mail ? '✉️ Мейл · ' + hm(r.vreme) + od + (r.avtor ? ' · ' + r.avtor : '')
        : '💬 ' + (r.izvor_vid === 'kanal' ? 'Тиймс канал' : 'Тиймс чат') + ' · ' + hm(r.vreme) + od + (r.avtor ? ' · ' + r.avtor : '') + (r.izvor ? ' · „' + r.izvor + '“' : '');
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
    // Етап 6 [§3.3, §5.3 б]: източник „Интранет“ с tid → „🗂️ Интранет · #7888“ + „Задачата ›“
    if (kanalOf(s.tip) === 'intranet' && /^\d{1,6}$/.test(String(s.tid == null ? '' : s.tid))) {
      izInit(); var izr = izFind(+s.tid);
      return ['<div class="src-i"><span class="ref">' + esc(s.n) + '</span><div><div class="src-t">🗂️ <b>Интранет · #' + esc(s.tid) + '</b>' + (s.vreme ? ' · <span class="mono">' + esc(s.vreme) + '</span>' : '') + '</div>' +
        (izr ? '<div>' + esc(izr.opisanie) + ' <span class="pill ' + (IZ_ST[izr.status] || 'p-neutral') + '">' + esc(izr.status || '—') + '</span></div>' : '') + '</div></div>',
        '<div class="src-b"><button type="button" class="btn ghost sb" data-a="izad" data-tid="' + esc(s.tid) + '">Задачата ›</button></div>'];
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
      isk: { avtor: avtor, nishka: r ? (r.vid === 'mail' ? 'имейл' : (r.izvor || '')) : (kanalOf(s && s.tip) === 'mail' ? 'имейл' : ''), izvor_vid: r ? (r.vid === 'mail' ? 'mail' : r.izvor_vid) : null, kluch: k,
        link: r && r.vid !== 'mail' && okTeams(r.link) ? r.link : null, mail: r && r.vid === 'mail' && MAIL_RE.test(String(r.avtor || '').trim()) ? { adr: String(r.avtor).trim(), tema: r.tema || '' } : null } };
    openPlus(null, ctx, 'iskane');
  }

  // ---------- Етап 6 [§5.2, F1]: „🗂️ Източниците на деня“ — всичко, дошло за деня, и къде е влязло ----------
  // Един компонент за Преглед (#izt, контекст 'd:<den_id>') и за листа „📥 Днес досега“ (контекст 'n:<обект>:<дата>', само четене,
  // §5.14). При отваряне — само ключовете на деня (една малка заявка, за броевете); редовете — при разгъване, по 30 [§5.2, Р11];
  // движението в Интранета — при разгъване. Нищо ново в кеша на Ден — само в паметта (+ SAOB, за листа „Източници“).
  var IZ6 = {}, IZ6_STR = 30, IZTS = null;   // IZTS — контекстът на отворения лист „📥 Днес досега“
  var IZ6_B = { teams: ['💬', 'Тиймс'], mail: ['✉️', 'Мейл'] };
  function iztF() { return lget(K6.iztF) === 'vsichki' ? 'vsichki' : 'neizp'; }   // по подразбиране — „Неизползвани“ (въпросът на РП)
  function iztX(key, o) {
    if (IZ6[key]) return IZ6[key];
    var ks = Object.keys(IZ6);   // паметта на iPhone: до 12 дни (най-старият отворен излиза)
    if (ks.length >= 12) delete IZ6[ks.filter(function (k) { return k !== IZTS; })[0]];
    return (IZ6[key] = Object.assign({ key: key, k: null, kSt: '', kErr: null, kAt: 0, kTok: 0, open: {}, shown: { teams: IZ6_STR, mail: IZ6_STR },
      full: {}, rows: {}, rSt: {}, rAt: {}, rErr: null, dv: null, dvSt: '', dvErr: null, dvAt: 0 }, o));
  }
  function iztDen() { var d = S.den; return d ? iztX('d:' + d.id, { mode: 'den', den: d.id, o: d.obekt || OBEKT_KOD, data: d.data }) : null; }
  function iztRecent(x) { var y = now(); y.setDate(y.getDate() - 1); return !!x.data && x.data >= ymd(y); }
  // ключовете (id, kluch, vid, vreme) — една малка заявка; без покритие — „📴“; повторен опит най-рано след 30 с (без порой)
  function iztKLoad(x, force) {
    if (!x || x.kSt === 'load') return;
    if (!force && (x.k || x.kSt === 'missing' || ((x.kSt === 'net' || x.kSt === 'err') && Date.now() - x.kAt < 30000))) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { if (!x.k) x.kSt = 'net'; x.kAt = Date.now(); return; }
    var tok = ++x.kTok; x.kSt = 'load'; x.kErr = null;
    (x.mode === 'dnes' ? api.saobDnesK(x.o, x.data, !!x.vse) : api.saobDenK(x.den)).then(function (rows) {
      if (tok !== x.kTok) return;
      x.k = rows || []; x.kSt = 'ok'; x.kAt = Date.now(); iztPaint(x);
    }, function (e) {
      if (tok !== x.kTok) return;
      x.kSt = isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err'; x.kErr = e; x.kAt = Date.now(); iztPaint(x);
    });
  }
  // целите редове на показаните (по ид, до 30 наведнъж) → и в SAOB (същите отварят „N източника ›“ без нова заявка)
  function iztRowsLoad(x, b, ids) {
    var need = ids.filter(function (id) { return !x.rows[id]; }).slice(0, IZ6_STR);
    if (!need.length || x.rSt[b] === 'load') return;
    if ((x.rSt[b] === 'net' || x.rSt[b] === 'err') && Date.now() - (x.rAt[b] || 0) < 30000) return;
    if (offNow()) { x.rSt[b] = 'net'; x.rAt[b] = Date.now(); return; }
    x.rSt[b] = 'load';
    api.saobIds(need).then(function (rows) {
      (rows || []).forEach(function (r) { x.rows[r.id] = r; });
      need.forEach(function (id) { if (!x.rows[id]) x.rows[id] = { id: id, _nema: true }; });   // изтрит междувременно — не се тегли пак
      saobPut(rows, x.o);
      x.rSt[b] = 'ok'; iztPaint(x);
    }, function (e) { x.rSt[b] = isNet(e) || isAuth(e) ? 'net' : 'err'; x.rAt[b] = Date.now(); x.rErr = e; iztPaint(x); });
  }
  function iztDvLoad(x, force) {
    if (!x || x.dvSt === 'load' || (!force && (x.dv || x.dvSt === 'missing' || ((x.dvSt === 'net' || x.dvSt === 'err') && Date.now() - x.dvAt < 30000)))) return;
    if (offNow() || !api || (!DEMO && (!db || !user))) { if (!x.dv) x.dvSt = 'net'; x.dvAt = Date.now(); return; }
    x.dvSt = 'load';
    api.dvizh(x.o, x.data).then(function (rows) { x.dv = rows || []; x.dvSt = 'ok'; iztIzList(x.dv); iztPaint(x); },
      function (e) { x.dvSt = isMissing(e) || isNoCol(e) ? 'missing' : isNet(e) || isAuth(e) ? 'net' : 'err'; x.dvErr = e; x.dvAt = Date.now(); iztPaint(x); });
  }
  // „създадена ЧЧ:ММ“ на новата задача (tochna) идва от списъка на Интранета (Етап 5) — при нова сесия той още не е зареден →
  // теглим го веднъж (кешът му важи; след неуспех — не пак, без порой); izPaint() дорисува блока [§5.2, ПОПРАВКА 13.10]
  function iztIzList(dv) {
    if (!dv.some(function (r) { return r.tochnost === 'tochna'; })) return;
    izInit(); if (!IZT.rows && !IZT.busy && !IZT.st) izLoad();
  }
  function iztPaint(x) {
    if (x.mode === 'den') { if (view === 'day' && S.den && 'd:' + S.den.id === x.key) renderIzt(); return; }
    if (sheetKind === 'izt' && IZTS === x.key) iztSheetPaint();
    if (view === 'tablo') renderDnes();
  }
  // ключ на съобщение → точките му; tid → точките с източник „Интранет“ (§3.3 — покритието е по tid) — само текущата версия
  function iztUsed(x) {
    var u = { k: {}, iz: {} };
    if (x.mode !== 'den' || !S.den || S.den.id !== x.den) return u;
    function put(m, k, t) { var l = m[k] || (m[k] = []); if (l.indexOf(t) < 0) l.push(t); }
    S.tochki.forEach(function (t) {
      (t.izvori || []).forEach(function (s) {
        var k = srcKey(s); if (k) put(u.k, k, t);
        if (s && kanalOf(s.tip) === 'intranet' && /^\d{1,6}$/.test(String(s.tid == null ? '' : s.tid))) put(u.iz, +s.tid, t);
      });
    });
    return u;
  }
  function iztSt(st, e, xk, what) {
    if (st === 'missing') return '<p class="izt-e">' + what + ' още не са в облака.</p>';
    if (st === 'net') return '<p class="izt-e">📴 ' + what + ' — когато има покритие.</p>';
    if (st === 'err') return '<div class="err">Не се заредиха: ' + esc(errBg(e)) + '</div><button type="button" class="btn ghost izt-r" data-a="iztRetry" data-x="' + esc(xk) + '">Опитай пак</button>';
    return '<p class="izt-e"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
  }
  function renderIzt() {
    var el = box('#izt'); if (!el) return;
    var x = view === 'day' ? iztDen() : null;
    if (!x) { el.innerHTML = ''; return; }
    iztKLoad(x);
    el.innerHTML = '<div class="izt card"><div class="izt-hh"><h2>🗂️ Източниците на деня</h2>' +
      '<button type="button" class="izt-i" data-a="kakDn" aria-label="Как се прави дневникът">ⓘ</button></div>' +
      '<p class="izt-s">Всичко, което е дошло за деня — и къде е влязло.</p>' + iztBody(x) + '</div>';
  }
  function iztBody(x) {
    var u = iztUsed(x), h = '';
    if (x.k && !x.k.length && x.mode === 'den' && iztRecent(x)) h += '<p class="izt-e">Черновата за деня се пише в 19:00.</p>';
    return h + iztBlock(x, 'teams', u) + iztBlock(x, 'mail', u) + iztBlockIz(x, u) + iztPrisRow(x);
  }
  function iztHdr(x, b, lbl, on, off) {
    return '<button type="button" class="izt-b" data-a="iztTgl" data-x="' + esc(x.key) + '" data-b="' + b + '" aria-expanded="' + !!on + '"' + (off ? ' disabled' : '') + '>' +
      '<span class="izt-c" aria-hidden="true">' + (on ? '▾' : '▸') + '</span><span class="izt-l">' + lbl + '</span></button>';
  }
  // Тиймс / Мейл: „💬 Тиймс (41) · 12 не са използвани“; разгънат — „Неизползвани N · Всички N“, редове по час, по 30
  function iztBlock(x, b, u) {
    var B = IZ6_B[b], all = x.k ? x.k.filter(function (r) { return r.vid === b; }) : null, dn = x.mode === 'den';
    var nU = all && dn ? all.filter(function (r) { return !u.k[r.kluch]; }).length : 0, off = !!all && !all.length, on = !!x.open[b] && !off;
    var lbl = B[0] + ' ' + B[1] + (all ? ' (' + all.length + ')' : x.kSt === 'net' || x.kSt === 'missing' || x.kSt === 'err' ? '' : ' …') +
      (nU ? ' · ' + nU + ' ' + pl(nU, 'не е използвано', 'не са използвани') : '');
    var h = iztHdr(x, b, esc(lbl), on, off);
    if (!on) return h;
    if (!all) return h + '<div class="izt-in">' + iztSt(x.kSt, x.kErr, x.key, 'Съобщенията') + '</div>';
    var f = dn ? iztF() : 'vsichki', L = all.filter(function (r) { return f === 'vsichki' || !u.k[r.kluch]; });
    var c = '';
    if (dn) c += '<div class="izt-f" role="group" aria-label="Кои съобщения">' +
      '<button type="button" class="chip" data-a="iztF" data-v="neizp" aria-pressed="' + (f === 'neizp') + '">Неизползвани <span class="cn">' + nU + '</span></button>' +
      '<button type="button" class="chip" data-a="iztF" data-v="vsichki" aria-pressed="' + (f === 'vsichki') + '">Всички <span class="cn">' + all.length + '</span></button></div>';
    if (!L.length) return h + '<div class="izt-in">' + c + '<p class="izt-e">✓ Всичко от ' + (b === 'teams' ? 'Тиймс' : 'мейла') + ' е влязло в точки.</p></div>';
    var n = Math.min(x.shown[b] || IZ6_STR, L.length), ids = L.slice(0, n).map(function (r) { return r.id; });
    iztRowsLoad(x, b, ids);
    c += '<div class="izt-ls">' + ids.map(function (id) { var r = x.rows[id]; return r && !r._nema ? iztRow(x, r, u) : ''; }).join('') + '</div>';
    var miss = ids.filter(function (id) { return !x.rows[id]; }).length;
    if (miss) c += x.rSt[b] === 'net' ? '<p class="izt-e">📴 Съобщенията — когато има покритие.</p>'
      : x.rSt[b] === 'err' ? '<div class="err">Не се заредиха: ' + esc(errBg(x.rErr)) + '</div><button type="button" class="btn ghost izt-r" data-a="iztRetry" data-x="' + esc(x.key) + '" data-b="' + b + '">Опитай пак</button>'
      : '<p class="izt-e"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
    else if (L.length > n) c += '<button type="button" class="btn ghost izt-more" data-a="iztMore" data-x="' + esc(x.key) + '" data-b="' + b + '">Покажи още ' + Math.min(IZ6_STR, L.length - n) + ' (остават ' + (L.length - n) + ')</button>';
    return h + '<div class="izt-in">' + c + '</div>';
  }
  function iztRow(x, r, u) {
    var mail = r.vid === 'mail', xk = esc(x.key), fl = Array.isArray(r.failove) ? r.failove.length : 0;
    var hd = mail ? '✉️ ' + hm(r.vreme) + ' · ' + (r.avtor || '—') + (r.tema ? ' · „' + clip(r.tema, 80) + '“' : '')
      : '💬 ' + hm(r.vreme) + ' · ' + (r.avtor || '—') + (r.izvor ? ' · ' + r.izvor : '');
    // до 6 реда (≈ 260 зн. на телефона); по-дълъг → свит + „Покажи целия ›“ (празните редове в свития изглед — един)
    var tx = String(r.tekst || ''), lng = !x.full[r.id] && (tx.length > 260 || tx.split('\n').length > 6);
    var b = '';
    if (!mail && okTeams(r.link)) b += extA(r.link, 'btn ghost sb', 'Отвори в Тиймс ›', 'teams');
    if (mail && okOd(r.original_url)) b += extA(r.original_url, 'btn ghost sb', 'Целият мейл ›', 'od');
    if (x.mode === 'dnes') b += '<button type="button" class="btn ghost sb" data-a="iztPitai" data-x="' + xk + '" data-id="' + esc(r.id) + '">✉ Питай</button>';
    return '<article class="iz6-r" data-id="' + esc(r.id) + '"><div class="iz6-hd">' + esc(hd) + '</div>' +
      (tx ? '<div class="iz6-tx' + (lng ? ' cl' : '') + '">' + esc(lng ? clip(tx.replace(/\n\s*\n+/g, '\n'), 400) : tx) + '</div>'
        : '<div class="iz6-tx muted">' + (r.snimki_broi ? '(само снимки)' : '(без текст)') + '</div>') +
      (lng ? '<button type="button" class="lnk" data-a="iztFull" data-x="' + xk + '" data-id="' + esc(r.id) + '">Покажи целия ›</button>' : '') +
      (r.snimki_broi || fl ? '<div class="iz6-m">' + (r.snimki_broi ? '📷 ' + esc(r.snimki_broi) + ' ' + pl(+r.snimki_broi, 'снимка', 'снимки') : '') + (r.snimki_broi && fl ? ' · ' : '') + (fl ? '📎 ' + fl + ' ' + pl(fl, 'файл', 'файла') : '') + '</div>' : '') +
      iztStatus(x, r.kluch, u.k[r.kluch], false) + (b ? '<div class="iz6-b">' + b + '</div>' : '') + '</article>';
  }
  // „→ влязло в“ / „не е използвано · ➕“ / „⏳ ще се добави…“ / „✓ добавено в черновата ›“ / „✕ …“ [§3.1, §5.2]
  function iztStatus(x, key, pts, info) {
    if (x.mode !== 'den' || !key) return '';
    var ds = dobState(x.den, key), d = S.den;
    if (ds && ds.st === 'ok') return '<button type="button" class="iz6-go ok" data-a="iztDobGo" data-k="' + (ds.k != null ? ds.k : '') + '">✓ добавено в черновата ›</button>';
    if (pts && pts.length) return pts.map(function (t) {
      return '<button type="button" class="iz6-go" data-a="iztGo" data-tid="' + esc(t.id) + '">→ влязло в: „' + esc(clip(t.tekst, 60)) + '“' + (vDn(t) ? '' : ' (не влиза в дневника)') + ' ›</button>';
    }).join('');
    if (info) return '';
    if (ds && ds.st === 'pend') return '<p class="iz6-p">⏳ ще се добави в този ден със следващата версия' + (d && d.id === x.den ? ' (' + esc(slednaV(d)) + ')' : '') + ' — после одобряваш нея</p>';
    if (ds && ds.st === 'err') return '<button type="button" class="iz6-p warn" data-a="qerr">⚠️ не се записа — виж</button>';
    if (ds && ds.st === 'ne') return '<p class="iz6-p ne">✕ ' + esc(ds.rez) + '</p>';
    if (!d || d.id !== x.den) return '';
    if (locked() || d.status !== 'chernova') return '<p class="iz6-p">не е използвано · ' + (d.status === 'vpisana' ? 'Денят е вписан' : 'Денят е одобрен') + ' — записът вече не се мени.</p>';
    return '<div class="iz6-n"><span>не е използвано</span><button type="button" class="iz6-dob" data-a="iztDob" data-k="' + esc(key) + '">➕ Включи в дневника</button></div>';
  }
  // „➕ Включи в дневника“ за ключа на деня: опашката (и задържаният), иначе последното dobavi в S.res [§3.1]
  function dobState(den, key) {
    var st = null, last = null;
    queue().forEach(function (it) { if (it.tbl === 'resheniq' && it.row && it.row.vid === 'dobavi' && it.row.den_id === den && it.row.tekst === key) st = it.err ? { st: 'err' } : { st: 'pend' }; });
    if (st) return st;
    if (S.den && S.den.id === den) S.res.forEach(function (r) { if (r.vid === 'dobavi' && r.tekst === key) last = r; });
    if (!last) return null;
    if (!last.obraboteno && (!last.rezultat || /чака Claude/i.test(last.rezultat))) return { st: 'pend' };   // необработено (и „чака Claude“)
    var rz = String(last.rezultat || ''), m = /точка\s+(\d+)/i.exec(rz);
    if (/^(нанесено|вече е)/i.test(rz)) return { st: 'ok', k: m ? +m[1] : null };
    return { st: 'ne', rez: rz || 'не е нанесено' };
  }
  // колко „➕“ още чакат следващата версия (22:45 / 09:00) (опашката + необработените в базата) — за листа „Одобряваш ли деня?“ [§3.1]
  function dobaviCakat(den) {
    var n = 0, kl = {};
    queue().forEach(function (it) { if (it.tbl === 'resheniq' && !it.err && it.row && it.row.vid === 'dobavi' && it.row.den_id === den) { n++; if (it.row.klient_id) kl[it.row.klient_id] = 1; } });
    if (S.den && S.den.id === den) S.res.forEach(function (r) { if (r.vid === 'dobavi' && !r.obraboteno && (!r.rezultat || /чака Claude/i.test(r.rezultat)) && !(r.klient_id && kl[r.klient_id])) n++; });
    return n;
  }
  function iztRowOf(key) { var x = iztDen(), out = null; if (!x) return null; Object.keys(x.rows).forEach(function (id) { if (x.rows[id].kluch === key) out = x.rows[id]; }); return out; }
  function iztDob(key) {
    var d = S.den, x = iztDen(); if (!d || !x || !key) return;
    if (locked() || d.status !== 'chernova') { dnLkToast(); return; }
    if (newPending()) { toast('Има нова версия — натисни „Покажи новата версия“ първо.', 'bad'); return; }
    if (dobState(d.id, key)) return;
    var tt, m = /^iz:(\d+)$/.exec(key);
    if (m) { var dv = (x.dv || []).filter(function (r) { return String(r.id) === m[1]; })[0]; tt = dv ? 'Интранет #' + dv.tid + ' · ' + dvKakvo(dv) : key; }
    else { var r = iztRowOf(key); tt = r ? hm(r.vreme) + ' · ' + (r.avtor || '') + ': ' + clip(oneLine(r.tekst || r.tema || '').trim(), 160) : key; }
    var row = { den_id: d.id, tochka_id: null, vid: 'dobavi', tekst: key, versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() };
    undoStart({ key: 'dob:' + key, kind: 'toast', lbl: '➕ Ще се добави в този ден', tbl: 'resheniq', row: row, meta: { tt: tt } });
  }
  // „→ влязло в“: картата на екрана, светва 1,5 с (и в свитите „Прегледани“); факт (без карта) → редът му в „📄 Пълен запис“ [§5.2]
  function iztGo(tid) {
    var t = findT(tid); if (!t) return;
    if (t.grupa === 'fakt' || !GRUPI.some(function (G) { return G.k === t.grupa; })) { fullGo(t); return; }
    if (pregledana(t)) { S.revOpen[t.grupa] = true; S.revCard[t.id] = true; renderGroups(); }
    var el = document.querySelector('#groups .pc[data-tid="' + t.id + '"]');
    if (!el) { toast('Картата я няма в тази версия'); return; }
    flashEl(el);
    if (WIDE) panSelect(t.id);
  }
  function fullGo(t) {
    if (t.k == null) { toast('Фактът няма свой ред в пълния запис.'); return; }
    if (!vDn(t)) S.izkShow = true;   // не влиза в дневника → редът е задраскан, но да се вижда
    S.fullOpen = true; renderFull();
    var l = Array.prototype.filter.call(document.querySelectorAll('#full [data-k]'), function (n) { return String(n.getAttribute('data-k')).split(',').indexOf(String(t.k)) >= 0; })[0];
    if (!l) { var fd = $('#fullD'); if (fd) flashEl(fd); toast('Редът не е в пълния запис на тази версия.'); return; }
    flashEl(l);
  }
  function flashEl(el) {
    var tw = $('.topwrap'), off = (tw ? tw.getBoundingClientRect().height : 0) + 12;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || 0) - off), behavior: reduced() ? 'auto' : 'smooth' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 1600);
  }
  function iztDobGo(k) {
    var t = k ? findTk(+k) : null;
    if (!t) { toast(S.newVersiq > (S.den ? S.den.versiq : 0) ? 'Точката е в новата версия — натисни „Покажи новата версия“.' : 'Точката я няма в тази версия.'); return; }
    iztGo(t.id);
  }
  // Интранет: „#7888 · описание“ / „статус: Текуща → Завършена · между 12:03 и 14:05“ [§3.2, §5.2]
  var DV_INFO = { izchezna: 'вече не е в списъка', varnata: 'върната в списъка', poqvi: 'появи се в списъка (стара задача)' };
  function dvDat(s, kr) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + (kr ? '' : '.' + m[1]) : '—'; }
  function dvKakvo(r) {
    var a = r.staro, b = r.novo;
    switch (r.vid) {
      case 'nova': return 'нова задача' + (r.otgovornik ? ' · отговорник ' + r.otgovornik : '') + (r.srok ? ' · срок ' + dvDat(r.srok, true) : '');
      case 'status': return 'статус: ' + (a || '—') + ' → ' + (b || '—');
      case 'zavarshena': return 'завършена' + (a ? ' (беше: ' + a + ')' : '');
      case 'srok': return !a ? 'поставен срок ' + dvDat(b) : !b ? 'срокът е махнат (беше ' + dvDat(a) + ')' : 'срок: ' + dvDat(a) + ' → ' + dvDat(b);
      case 'otgovornik': return 'отговорник: ' + (a || '—') + ' → ' + (b || '—');
      case 'komentari': return 'нов коментар';
    }
    return DV_INFO[r.vid] || r.vid;
  }
  function dvKoga(r) {
    if (r.tochnost === 'tochna') { izInit(); var iz = izFind(r.tid); return iz && iz.sazdadena ? 'създадена ' + hm(iz.sazdadena) : ''; }
    var b = new Date(r.okno_do), a = r.okno_ot ? new Date(r.okno_ot) : null, d0 = parseD(r.data_sabitie);
    function f(d) { return isNaN(d) ? '—' : sameDay(d, d0) ? hhmm(d) : ddmm(d) + ' ' + hhmm(d); }
    return a && !isNaN(a) ? 'между ' + f(a) + ' и ' + f(b) : 'видяно ' + f(b);
  }
  function iztBlockIz(x, u) {
    var on = !!x.open.iz, h = iztHdr(x, 'iz', '🗂️ Интранет' + (x.dv ? ' (' + x.dv.length + ')' : ''), on, false);
    if (!on) return h;
    var c;
    if (!x.dv) c = x.dvSt === 'missing' ? '<p class="izt-e">Движението в Интранета още не е в облака — лаптопът го събира.</p>'
      : x.dvSt === 'net' ? '<p class="izt-e">📴 Движението в Интранета — когато има покритие.</p>'
      : x.dvSt === 'err' ? '<div class="err">Не се зареди: ' + esc(errBg(x.dvErr)) + '</div><button type="button" class="btn ghost izt-r" data-a="iztRetry" data-x="' + esc(x.key) + '" data-b="iz">Опитай пак</button>'
      : '<p class="izt-e"><span class="pulse" aria-hidden="true"></span> Зареждам…</p>';
    else if (!x.dv.length) c = '<p class="izt-e">Няма движение по задачите за този ден.</p>';
    else c = '<div class="izt-ls">' + x.dv.map(function (r) {
      var info = !!DV_INFO[r.vid], kg = dvKoga(r);
      return '<article class="iz6-r' + (info ? ' siv' : '') + '"><div class="iz6-hd iz6-iz"><b>#' + esc(r.tid) + '</b> · ' + esc(r.opisanie || '') + '</div>' +
        '<div class="iz6-dv">' + esc(dvKakvo(r)) + (kg ? ' · <span class="muted">' + esc(kg) + '</span>' : '') + '</div>' +
        iztStatus(x, 'iz:' + r.id, u.iz[+r.tid], info) +
        '<div class="iz6-b"><button type="button" class="btn ghost sb" data-a="izad" data-tid="' + esc(r.tid) + '">Задачата ›</button></div></article>';
    }).join('') + '</div>';
    return h + '<div class="izt-in">' + c + '</div>';
  }
  // Присъствия — не е блок със съдържание: картата „👷 Присъствия“ вече е над картите; тап → скрол до нея с подсветка
  function iztPrisRow(x) {
    if (!prisOk()) return '';
    var p = prisOf(x.o, x.data), lbl = '👷 Присъствия · ' + (p ? 'нето ' + p.neto + ' · общо ' + p.obshto : 'няма запис за деня');
    if (x.mode !== 'den') return '<div class="izt-b st"><span class="izt-c" aria-hidden="true">▸</span><span class="izt-l">' + esc(lbl) + '</span></div>';
    return '<button type="button" class="izt-b" data-a="iztPris"><span class="izt-c" aria-hidden="true">▸</span><span class="izt-l">' + esc(lbl) + ' ›</span></button>';
  }
  function iztPris() { var p = $('#pris .pris-c') || $('#pris'); if (p) flashEl(p); }
  function iztTgl(xk, b) {
    var x = IZ6[xk]; if (!x) return;
    x.open[b] = !x.open[b];
    if (x.open[b] && b === 'iz') iztDvLoad(x);
    if (x.open[b] && !x.k) iztKLoad(x, x.kSt !== 'load');
    iztPaint(x);
  }
  function iztRetry(xk, b) {
    var x = IZ6[xk]; if (!x) return;
    if (b === 'iz') { x.dvSt = ''; iztDvLoad(x, true); }
    else if (b) { x.rSt[b] = ''; x.rAt[b] = 0; }
    else iztKLoad(x, true);
    iztPaint(x);
  }
  function iztMore(xk, b) { var x = IZ6[xk]; if (!x) return; x.shown[b] = (x.shown[b] || IZ6_STR) + IZ6_STR; iztPaint(x); }
  function iztFull(xk, id) { var x = IZ6[xk]; if (!x) return; x.full[id] = true; iztPaint(x); }
  function iztFSet(v) {
    lset(K6.iztF, v === 'vsichki' ? 'vsichki' : '');
    Object.keys(IZ6).forEach(function (k) { IZ6[k].shown = { teams: IZ6_STR, mail: IZ6_STR }; });
    renderIzt();
  }

  // ---------- Етап 6 [§5.14, F12]: „📥 Днес досега“ на Таблото — съобщенията на днешния ден преди черновата (по обект + дата) ----------
  // 1а [§6.1, §6.10]: днешният ден вече има чернова (19:00) → всички съобщения на деня (ключът е друг — „:v“), картата казва „черновата vN е готова ›“
  function dnesDen(o) { var t = ymd(now()); return TB.dni.concat(S.dni).filter(function (x) { return x.data === t && (x.obekt || OBEKT_KOD) === o; })[0] || null; }
  function dnesX(o) { var d = ymd(now()), dn = dnesDen(o); return iztX('n:' + o + ':' + d + (dn ? ':v' : ''), { mode: 'dnes', den: null, o: o, data: d, vse: !!dn }); }
  function dnesLoad() { ['ag', 'soft'].forEach(function (o) { var x = dnesX(o); if (!x.k || Date.now() - x.kAt > 60000) iztKLoad(x, true); }); }
  function renderDnes() {
    var el = box('#tb-dnes'); if (!el) return;
    var os = TB.sel === 'all' ? ['ag', 'soft'] : [TB.sel];
    var sv = ['teams', 'poshta'].map(svOf).filter(Boolean).map(function (s) { return Date.parse(s.posledno); }).filter(function (t) { return !isNaN(t); });
    var ob = sv.length ? rel(new Date(Math.max.apply(null, sv)).toISOString()) : '—';
    el.innerHTML = os.map(function (o) {
      var x = dnesX(o), k = x.k, dn = dnesDen(o);
      if (!k && (x.kSt === 'missing' || (x.kSt === 'net' && offNow()))) return '';
      var nt = k ? k.filter(function (r) { return r.vid === 'teams'; }).length : null, nm = k ? k.filter(function (r) { return r.vid === 'mail'; }).length : null;
      var b = '<button type="button" class="dnes o-' + o + '" data-a="dnesOpen" data-o="' + o + '" aria-label="' + esc('Днес досега, ' + OBEKT[o][0] + ': Тиймс ' + (nt == null ? '—' : nt) + ', мейли ' + (nm == null ? '—' : nm) + ', обновено ' + ob) + '">' +
        '<span class="ochip o-' + o + '">' + SELK[o] + '</span><span class="dnes-t">📥 Днес досега: 💬 ' + (nt == null ? '…' : nt) + ' · ✉️ ' + (nm == null ? '…' : nm) +
        ' · <span class="muted">обновено ' + esc(ob) + '</span></span><span class="dnes-go" aria-hidden="true">›</span></button>';
      return dn ? '<div class="dnes-w">' + b + '<button type="button" class="dnes-ch o-' + o + '" data-a="dnesDen" data-o="' + o + '" data-id="' + esc(dn.id) + '">· черновата v' + esc(dn.versiq) + ' е готова ›</button></div>' : b;
    }).join('');
  }
  function dnesZt() {
    var m = minOf(now());
    return m < 19 * 60 ? 'В 19:00 това влиза в черновата на деня.' : m < 22 * 60 + 45 ? 'Новото след черновата влиза в обновяването в 22:45.' : 'Новото влиза в сутрешната добавка (09:00), ако не си одобрил.';
  }
  function openDnes(o) {
    if (o !== 'ag' && o !== 'soft') return;
    var x = dnesX(o);
    IZTS = x.key;
    x.open.teams = x.open.teams !== false; x.open.mail = x.open.mail !== false;   // в листа — разгънати
    iztKLoad(x, true);
    openSheet('📥 Днес досега · ' + OBEKT[o][0], '<p class="small muted izt-zt">' + esc(dnesZt()) + '</p><div id="iztS" class="izt sh">' + iztBody(x) + '</div>', 'izt');
  }
  function iztSheetPaint() { var x = IZTS && IZ6[IZTS], b = sheetEl && sheetKind === 'izt' ? sheetEl.querySelector('#iztS') : null; if (x && b) putH(b, iztBody(x)); }
  function iztPitai(xk, id) {
    var x = IZ6[xk], r = x && x.rows[id]; if (!r || r._nema) return;
    openPitai({ t: null, tid: null, den_id: null, o: x.o, data: x.data, rows: [r], fakt: (r.tema ? r.tema + ': ' : '') + oneLine(r.tekst || '').trim(), ctx: { src: 'dnes' } });
  }

  // ---------- Етап 6 [§5.9, F6]: „Как се прави дневникът“ — карта в Настройки и същото в лист от ⓘ ----------
  var KAK_DN = [
    ['Какво влиза в дневника.', '„📄 Пълен запис“ е точно това, което отива в Word. Всяка карта е един или няколко реда в него. Карта с „🚫 Не включвай“ не влиза. Празен раздел не се пише изобщо.'],
    // 1а [§6.10]: Решение 1 на РП (19.10, „В“) — точният текст от спецификацията
    ['Кога се пише.', 'В 19:00 лаптопът събира днешния ден (Тиймс, мейлите и приложенията им, Присъствия, Интранета, времето) и пише черновата: първият помощник пише, вторият проверява ред по ред, третият поправя. В 22:45 само я обновява с новото след 19:00 (обикновено Присъствията на Амур и късни мейли) — номерата на точките и твоите отговори остават. В 09:00 на другия ден: ако за вчера е дошло още нещо и още не си одобрил — малка добавка. Ако си одобрил с „Одобри и добави …“, късните неща и твоите поправки, пратени точно преди одобрението, влизат в следващата чернова като „Закъснели за …“ / „Поправка към записа за …“. Лаптопът трябва да е включен вечер; ако е изключен, черновата тръгва, щом се включи (до 22:45 — същата вечер; иначе на сутринта само ако има нещо ново).'],
    ['Резюмето.', 'В Word раздел 1 „Управленско резюме“ е няколко кратки реда с най-важното от деня (пари, срокове, инвеститор, безопасност, спиране на работа). Всеки ред идва от картите под него — махнеш ли карта с „🚫“, махаш и реда ѝ в резюмето. Горе на деня в AiLab има и 1–2 изречения само за теб — те не отиват в Word.'],
    ['Интранетът.', 'Движението по задачите за обекта влиза в раздел 7 „Задачи и срокове“: завършена задача, сменен срок, отговорник или статус — всяко на свой кратък ред, който можеш да махнеш поотделно; новите задачи — един общ ред с номерата им (важната нова задача — на свой ред). Най-много 8 реда на ден; пълният списък е в „🗂️ Източниците на деня“ › Интранет. Коментарите в Интранета AiLab не ги вижда.'],
    ['Какво НЕ влиза.', 'Поздрави, „ок“, уточнения без нов факт, повторения; съобщения, които не са станали точка. Виж ги в „🗂️ Източниците на деня“ — ако нещо липсва, „➕ Включи в дневника“: следващата версия (22:45 или 09:00) го добавя в същия ден като нова версия. Не одобрявай деня преди това — иначе няма да влезе.'],
    ['Броят хора', 'е нетото от Присъствия. Ако там няма запис — по сутрешния рапорт.'],
    ['Времето', 'в раздел 2 е от Open-Meteo — модел за града на обекта, не измерване на площадката.']
  ];
  function kakDnHtml() { return '<div class="kak-dn">' + KAK_DN.map(function (p) { return '<p><b>' + esc(p[0]) + '</b> ' + esc(p[1]) + '</p>'; }).join('') + '</div>'; }
  function openKakDn() { openSheet('Как се прави дневникът', kakDnHtml(), 'kak'); }

  // ---------- Етап 6 [§5.4, F4]: „✉ Питай по мейл“ — мейл до избран човек: „има ли отговор / развитие?“ ----------
  // Първият избор в листа „→ Задача“ (без нов бутон на картата). AiLab само отваря чернова (mailto: / Outlook) — праща РП.
  // Задачата „искане“ (danni.kanal = 'mail', ключът е adresati — не do) се записва при ПЪРВОТО натискане на бутон; листът остава
  // отворен, „Отмени“ в лентата е на пауза, докато листът е отворен [§5.6 т.10]. Адресната книга — само в паметта [§7].
  var ADR = null, ADR_ST = '', PIT = null, PT_SRC = 0;
  var MAIL_G = /[^\s@<>"',;:\[\]]+@[^\s@<>"',;:\[\]]+\.[a-z]{2,}/gi;
  // име → сравнимо: малки букви, кирилицата → латиница (обтекаемата система — TRL), без точки и двойни интервали
  function nmNorm(s) { return String(s || '').toLowerCase().replace(/[а-яѝёэы]/g, function (c) { return TRL[c] || c; }).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function adrLoad() {
    if (ADR || ADR_ST === 'load' || ADR_ST === 'missing' || !api) return;
    if (offNow() || (!DEMO && (!db || !user))) { ADR_ST = 'net'; return; }
    ADR_ST = 'load';
    api.adresi().then(function (rows) {
      ADR = (rows || []).map(function (r) { return { adres: String(r.adres || '').trim().toLowerCase(), ime: r.ime || null, broi: +r.broi || 0, n: nmNorm(r.ime) }; })
        .filter(function (r) { return MAIL_RE.test(r.adres); });
      ADR_ST = 'ok'; ptChips();
    }, function (e) { ADR_ST = isMissing(e) || isNoCol(e) ? 'missing' : 'err'; ptChips(); });
  }
  function adrIme(a) { a = String(a || '').toLowerCase(); var r = ADR ? ADR.filter(function (y) { return y.adres === a; })[0] : null; return r ? r.ime : null; }
  // Тиймс име → адрес: точно (след нормализиране) → първа буква + фамилия („D. Tehnik“) → резервно фамилията (≥ 4 букви) в адреса
  function adrByName(ime) {
    var n = nmNorm(ime), w = n.split(' ').filter(Boolean);
    if (!ADR || !w.length) return [];
    var ex = ADR.filter(function (a) { return a.n && a.n === n; });
    if (ex.length) return [ex[0]];
    if (w.length >= 2) {
      var ini = ADR.filter(function (a) { var v = a.n ? a.n.split(' ') : []; return v.length >= 2 && v[v.length - 1] === w[w.length - 1] && v[0].charAt(0) === w[0].charAt(0); });
      if (ini.length) return [ini[0]];
    }
    var fam = w[w.length - 1];
    return fam.length >= 4 ? ADR.filter(function (a) { return a.adres.split('@')[0].indexOf(fam) >= 0; }).slice(0, 2).map(function (a) { return Object.assign({ fam: true }, a); }) : [];
  }
  // без самия РП: адрес с име = името от Интранета (vid 'az'), запомнените с „Това съм аз“, адресът на входа
  function ptAz() {
    var m = {}, az = spAz(), an = az ? nmNorm(az.ime) : '';
    (ljget(K6.az, []) || []).forEach(function (a) { m[String(a).toLowerCase()] = 1; });
    if (user && user.email) m[String(user.email).toLowerCase()] = 1;
    if (an && ADR) ADR.forEach(function (a) { if (a.n && a.n === an) m[a.adres] = 1; });
    return { adr: m, ime: an };
  }
  // редовете на източниците (съобщенията) — от SAOB; без ред → името от „kratko“ (за търсене по име)
  function ptRows(x) {
    if (x.rows) return x.rows;
    var out = [];
    (x.izv || []).forEach(function (s) {
      var ch = kanalOf(s && s.tip); if (ch !== 'teams' && ch !== 'mail') return;
      var k = srcKey(s), r = k ? saobPick(k, x.den_id) : null;
      if (r) { if (out.indexOf(r) < 0) out.push(r); return; }
      var nm = String(s.kratko || '').split(' · ')[0].trim();
      if (nm && (!k || SAOB[k])) out.push({ vid: 'teams', avtor: nm, _kr: true });
    });
    return out;
  }
  // „Кому“: авторите на източниците (мейл — адресът; Тиймс — по име от книгата), после „Копие:“ — до 6, без повторения
  function ptSugg(x) {
    var out = [], seen = {}, noA = [], az = ptAz(), kop = [];
    function add(a, ime, src, fam) {
      a = String(a || '').trim().toLowerCase();
      if (!MAIL_RE.test(a) || seen[a] || az.adr[a] || out.length >= 6) return;
      seen[a] = 1; out.push({ adres: a, ime: ime || null, src: src, fam: !!fam });
    }
    ptRows(x).forEach(function (r) {
      if (r.vid === 'mail') {
        add(r.avtor, adrIme(r.avtor), 'avtor');
        (String(r.do_kopie || '').match(MAIL_G) || []).forEach(function (a) { kop.push(a); });
        return;
      }
      var nm = String(r.avtor || '').trim();
      if (!nm || /^workflows$/i.test(nm) || (az.ime && nmNorm(nm) === az.ime)) return;   // ботът и самият РП — не
      var f = adrByName(nm);
      if (!f.length) { if (ADR && !r._kr && noA.indexOf(nm) < 0) noA.push(nm); return; }
      f.forEach(function (a) { add(a.adres, a.ime || nm, 'avtor', a.fam); });
    });
    kop.forEach(function (a) { add(a, adrIme(a), 'kopie'); });
    return { list: out, noA: noA.slice(0, 3) };
  }
  // текстовете по подразбиране [§5.4]
  function ptDat(x) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x.data || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function ptKoi(x) { var o = x.o ? OBEKT[x.o][0] : '', d = ptDat(x); return [o, d].filter(Boolean).join(', '); }
  function ptTemaDef(x) { var k = ptKoi(x); return 'Въпрос: ' + clip(oneLine(x.fakt).trim(), 60) + (k ? ' (' + k + ')' : ''); }
  function ptTekstDef(x) {
    var d = ptDat(x), o = x.o ? OBEKT[x.o][0] : '';
    return 'Здравейте,\n\nВъв връзка с ' + (d ? d + (o ? ' (' + o + ')' : '') + ': ' : '') + '„' + clip(oneLine(x.fakt).trim(), 400) + '“\n\n' +
      'Има ли отговор или развитие по въпроса? Ако има документ или нов срок — моля, изпратете ги.\n\nБлагодаря!';
  }
  // o: {t, tid, den_id, o, data, izv | rows, fakt, ctx, zamenq, adresati, tema, k}
  function openPitai(o) {
    PIT = { tid: o.tid || null, k: o.k != null ? o.k : (o.t && o.t.k != null ? o.t.k : null), den_id: o.den_id != null ? o.den_id : null, o: o.o === 'ag' || o.o === 'soft' ? o.o : null,
      data: o.data || null, izv: o.izv || (o.t && o.t.izvori) || [], rows: o.rows || null, fakt: String(o.fakt || (o.t && o.t.tekst) || ''), ctx: o.ctx || null, zamenq: o.zamenq || null,
      sel: {}, init: false, pre: Array.isArray(o.adresati) ? o.adresati : null, sug: null, key: null, ruchno: '', tema: '', tekst: '' };
    PIT.tema = o.tema || ptTemaDef(PIT); PIT.tekst = ptTekstDef(PIT);
    spisaciLoad(false); adrLoad(); ptSrcLoad(PIT);
    ptOpen();
  }
  function ptOpen() {
    var x = PIT, ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
    openSheet('✉ Питай за развитие', '<p class="sh-q">' + esc(clip(x.fakt, 300)) + '</p>' +
      '<div class="fld" role="group" aria-label="Кому">Кому<div id="ptK" class="pt-k"></div>' +
        '<input type="email" inputmode="email" id="ptTo" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="адрес@… — може няколко, с „;“" aria-label="Друг адрес" value="' + esc(x.ruchno) + '"></div>' +
      '<label class="fld">Тема<input type="text" id="ptTema" maxlength="200" autocomplete="off" value="' + esc(x.tema) + '"></label>' +
      '<label class="fld">Текст<textarea id="ptTx" rows="8">' + esc(x.tekst) + '</textarea></label>' +
      '<div class="err" id="ptE" hidden></div><p class="pt-ok" id="ptS"' + (x.key ? '' : ' hidden') + '>✓ Въпросът е записан в Задачи › Искания</p>' +
      '<button type="button" class="btn big" data-a="ptGo" data-k="mail">Отвори в пощата ›</button>' +
      (ios ? '<button type="button" class="lnk pt-ol" data-a="ptGo" data-k="ol">в Outlook ›</button>' : '') +
      '<button type="button" class="btn ghost" data-a="ptGo" data-k="copy">Копирай текста</button>' +
      '<p class="small muted">Нищо не се праща от AiLab — пращаш ти от Outlook. Въпросът се пази в Задачи › Искания и сутрешният пуск отбелязва, когато дойде отговор.</p>', 'pitai');
    ptChips();
  }
  // текстовете на източниците (авторите, „Копие:“) — заявка М1 само за липсващите
  function ptSrcLoad(x) {
    if (x.rows) return;
    var keys = [];
    (x.izv || []).forEach(function (s) { var k = srcKey(s); if (k && keys.indexOf(k) < 0 && SAOB[k] === undefined) keys.push(k); });
    if (!keys.length || offNow() || !api) return;
    PT_SRC++;
    api.saob(x.o, keys).then(function (rows) {
      PT_SRC--; saobPut(rows, x.o); keys.forEach(function (k) { if (SAOB[k] === undefined) SAOB[k] = []; }); if (PIT === x) ptChips();
    }, function (e) { PT_SRC--; if (isMissing(e) || isNoCol(e)) keys.forEach(function (k) { SAOB[k] = []; }); if (PIT === x) ptChips(); });
  }
  // чиповете „Кому“ — само тази част се пречертава (написаното в полетата остава)
  function ptChips() {
    var b = sheetEl && sheetKind === 'pitai' ? sheetEl.querySelector('#ptK') : null, x = PIT;
    if (!b || !x) return;
    var s = ptSugg(x), busy = ADR_ST === 'load' || PT_SRC > 0;
    (x.pre || []).slice().reverse().forEach(function (a) { var ad = String(a && a.adres || '').toLowerCase(); if (MAIL_RE.test(ad) && !s.list.some(function (y) { return y.adres === ad; })) s.list.unshift({ adres: ad, ime: a.ime || null, src: 'staro' }); });
    x.sug = s;
    // предварително избран — първият останал с адрес; чак когато книгата и източниците са дошли (иначе редът се мени) [§5.4]
    if (!x.init && (!busy || x.pre)) {
      x.init = true;
      if (x.pre) x.pre.forEach(function (a) { if (a && a.adres) x.sel[String(a.adres).toLowerCase()] = true; });
      else if (s.list.length) x.sel[s.list[0].adres] = true;
    }
    var h = s.list.map(function (c, i) {
      var on = !!x.sel[c.adres];
      return '<span class="pt-cw"><button type="button" class="chip pt-c" data-a="ptChip" data-i="' + i + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + esc(c.ime ? c.ime + ' · ' + c.adres : c.adres) + (c.fam ? ' (по фамилия)' : '') + '</button>' +
        '<button type="button" class="lnk pt-az" data-a="ptAzSet" data-i="' + i + '" aria-label="' + esc('Това съм аз — ' + c.adres) + '">Това съм аз</button></span>';
    }).join('') + s.noA.map(function (n) { return '<span class="chip pt-c off" aria-disabled="true">' + esc(n) + ' — няма мейл в архива</span>'; }).join('');
    if (!s.list.length && !s.noA.length) h += busy ? '<p class="small muted"><span class="pulse" aria-hidden="true"></span> търся адресите…</p>' : '<p class="small muted">Няма предложения — напиши адреса.</p>';
    putH(b, h);
  }
  function ptChip(i) { var x = PIT, c = x && x.sug && x.sug.list[+i]; if (!c) return; x.init = true; x.sel[c.adres] = !x.sel[c.adres]; ptChips(); }
  function ptAzSet(i) {
    var x = PIT, c = x && x.sug && x.sug.list[+i]; if (!c) return;
    var l = ljget(K6.az, []) || []; if (l.indexOf(c.adres) < 0) l.push(c.adres); ljset(K6.az, l.slice(-20));
    delete x.sel[c.adres]; x.init = true; ptChips();
    toast('Запомних — „' + c.adres + '“ вече не се предлага.');
  }
  function ptRead() {
    var x = PIT, ee = $('#ptE'); if (!x || !ee) return null;
    x.ruchno = ($('#ptTo') && $('#ptTo').value) || ''; x.tema = (($('#ptTema') && $('#ptTema').value) || '').trim(); x.tekst = ($('#ptTx') && $('#ptTx').value) || '';
    var adrs = [], bad = null;
    (x.sug ? x.sug.list : []).forEach(function (c) { if (x.sel[c.adres] && adrs.indexOf(c.adres) < 0) adrs.push(c.adres); });
    x.ruchno.split(/[;,\s]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (a) {
      if (!MAIL_RE.test(a)) { if (!bad) bad = a; } else if (adrs.indexOf(a.toLowerCase()) < 0) adrs.push(a.toLowerCase());
    });
    function err(m) { ee.textContent = m; ee.hidden = false; try { ee.scrollIntoView({ block: 'nearest' }); } catch (e) {} return null; }
    if (bad) return err('Адресът „' + clip(bad, 60) + '“ не изглежда като мейл.');
    if (!adrs.length) return err('Избери или напиши до кого.');
    if (!x.tema) return err('Напиши тема.');
    ee.hidden = true;
    return { adrs: adrs, tema: x.tema, tx: x.tekst };
  }
  // адресът на писмото: всеки адрес — encodeURIComponent поотделно, с некодирана „,“; новите редове — %0D%0A; таван 1 900 знака
  // (Chrome на Windows не подава по-дълъг адрес): първо се реже фактът в текста, после — само Кому и Тема, текстът в клипборда [§5.4]
  function ptUrl(kind, adrs, tema, tx, fakt) {
    function mk(body) {
      var to = adrs.map(encodeURIComponent).join(','), q = 'subject=' + encodeURIComponent(tema) + (body != null ? '&body=' + encodeURIComponent(String(body).replace(/\r?\n/g, '\r\n')) : '');
      return kind === 'ol' ? 'ms-outlook://compose?to=' + to + '&' + q : 'mailto:' + to + '?' + q;
    }
    var u = mk(tx); if (u.length <= 1900) return { url: u };
    var f = clip(oneLine(fakt).trim(), 400), q0 = '„' + f + '“';
    if (f && tx.indexOf(q0) >= 0) {
      for (var n = f.length - 40; n >= 40; n -= 40) { var u2 = mk(tx.replace(q0, '„' + clip(f, n) + '“')); if (u2.length <= 1900) return { url: u2 }; }
    }
    return { url: mk(null), copy: tx };
  }
  function ptNav(url) {
    if (DEMO) { window.AILAB_PITAI_URL = url; toast('Демо: тук се отваря пощата с готова чернова (адресът е ' + url.length + ' знака).'); return; }
    var a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove();
  }
  // първото натискане на бутон → задачата (втори ред не се прави); после — пощата / клипборда
  function ptGo(kind) {
    var x = PIT; if (!x) return;
    var v = ptRead(); if (!v) return;
    ptRecord(x, v);
    if (kind === 'copy') {
      copyText('Кому: ' + v.adrs.join('; ') + '\nТема: ' + v.tema + '\n\n' + v.tx).then(function (ok) { toast(ok ? 'Копирано — постави в Outlook.' : 'Не можах да копирам — задръж върху текста и го копирай.'); });
      return;
    }
    var r = ptUrl(kind, v.adrs, v.tema, v.tx, x.fakt);
    if (r.copy) copyText(r.copy).then(function () {});
    ptNav(r.url);
    if (r.copy) toast('Текстът е дълъг — копиран е, постави го в писмото (Ctrl+V).');
  }
  function ptRecord(x, v) {
    if (x.key) return;
    var ad = v.adrs.map(function (a) { var c = (x.sug ? x.sug.list : []).filter(function (y) { return y.adres === a; })[0]; return { adres: a, ime: (c && c.ime) || adrIme(a) || null }; });
    var k1 = (x.rows && x.rows[0] && x.rows[0].kluch) || (x.izv || []).map(srcKey).filter(Boolean)[0] || null;
    var row = { den_id: x.den_id, tochka_id: x.tid || null, vid: 'iskane', tekst: 'Въпрос до ' + v.adrs[0] + ': ' + clip(oneLine(x.fakt).trim(), 160), chovek: v.adrs[0], srok: null,
      izvor: 'AiLab · Питай', obekt: x.o, cel: null, danni: { kanal: 'mail', adresati: ad, tema: v.tema, pitano: nowIso(), kluch: k1, tochka_k: x.k != null ? x.k : null } };
    if (x.zamenq) row.zamenq = x.zamenq;
    var redo = function () {
      x.key = null;
      if (PIT === x && sheetKind === 'pitai') { var s = $('#ptS'); if (s) s.hidden = true; return; }
      PIT = x; ptOpen();   // „Отмени“ след затворен лист → листът се връща с написаното [К22]
    };
    x.key = zadaStart(row, '✉ Питане записано', x.tid, x.ctx && x.ctx.src === 'tablo' ? x.ctx : (x.ctx && x.ctx.src === 'zad' ? null : x.ctx), redo, null);
    shuPause(x.key);
    var s0 = $('#ptS'); if (s0) s0.hidden = false;
  }
  // „→ Задача“ → „✉ Питай по мейл“: от точка в Преглед, от решение/промяна в Табло, от панела „Избрана точка“
  function pitaiFromPlus() {
    var p = P; if (!p) return;
    P = null;
    var ctx = p.ctx, t = !ctx && p.tid ? findT(p.tid) : null;
    openPitai({ t: t, tid: p.tid, den_id: p.den_id, o: p.o, data: ctx ? (ctx.d || null) : (S.den ? S.den.data : null), izv: p.izvori || [], fakt: p.tekst, ctx: ctx,
      k: ctx && ctx.k != null ? ctx.k : (t ? t.k : null) });
  }
  function pitaiT(tid) { var t = findT(tid), d = S.den; if (!t || !d) return; openPitai({ t: t, tid: t.id, den_id: d.id, o: d.obekt || OBEKT_KOD, data: d.data, izv: t.izvori || [], fakt: t.tekst }); }
  // „Промени“ на питане по мейл → същият лист с данните му (не формата „Искане“ — тя чете danni.do.id) [§5.4]
  function openPitaiZad(a) {
    var d = danniOf(a), t = a.tochka_id != null ? (findT(a.tochka_id) || tFind(a.tochka_id)) : null;
    var dn = a.den_id != null ? (dniById(a.den_id) || findDni(a.den_id) || (S.den && S.den.id === a.den_id ? S.den : null)) : null;
    openPitai({ t: t, tid: a.tochka_id || null, den_id: a.den_id != null ? a.den_id : null, o: objOf(a), data: dn ? dn.data : null, izv: t ? t.izvori || [] : [],
      fakt: t ? t.tekst : String(a.tekst || '').replace(/^Въпрос до [^:]+:\s*/, ''), ctx: { src: 'zad' }, zamenq: a.id, adresati: d.adresati, tema: d.tema, k: d.tochka_k });
  }

  // ---------- свежест на източниците (лист и картата в Настройки) ----------
  function freshHtml() {
    var list = sortSv(S.svezhest), sp = svSpi();
    // лаптопът спи → един сив ред горе; кехлибарено само застарялото преди заспиването, останалите — с часа си, без ⚠️ [§5.7]
    return (sp.spi && list.length ? '<p class="fr-sleep">' + esc(spiTxt(sp)) + '</p>' : '') + (list.length ? list.map(function (s) {
      var old = svWarn(s, sp), nm = IZ[s.izvor] || [s.izvor, '•'], p, cls, ime = esc(nm[0]), br = s.broi != null ? ' · ' + esc(s.broi) + ' записа' : '';
      if (s.izvor === 'disk') {   // 1а [§4.7, §6.7]: по нивото, не по часа
        var dl = diskLvl(s); old = dl > 0; br = '';
        ime = 'C: ' + (s.broi != null ? esc(Math.floor(+s.broi)) + ' GB' : '—');
        p = dl === 2 ? '<span class="pill p-bad">⚠️ под 8 GB — освободи място</span>' : dl === 1 ? '<span class="pill p-warn">⚠️ под 15 GB</span>' : '<span class="pill p-ok">✓</span>';
        cls = dl === 2 ? 'old bad' : dl === 1 ? 'old' : 'ok';
      } else if (s.izvor === 'chernova' || s.izvor === 'prilojeniq') {   // кехлибарено само при ok = false; „чака отворен Outlook“ — неутрално
        old = s.ok === false; br = s.izvor === 'prilojeniq' && s.broi != null ? ' · днес свалени ' + esc(s.broi) : '';
        p = old ? '<span class="pill p-warn">⚠️ ' + (s.izvor === 'chernova' ? 'внимание' : 'грешка при сваляне') + '</span>'
          : s.izvor === 'chernova' && +s.broi === 1 ? '<span class="pill p-neutral">⏳ тече</span>' : '<span class="pill p-neutral">✓</span>';
        cls = old ? 'old' : 'calm';
      } else {
        p = old ? '<span class="pill p-warn">⚠️ ' + (s.ok === false ? 'грешка при събиране' : 'застарял') + '</span>'
          : sp.spi ? (s.izvor === 'laptop' ? '<span class="pill p-neutral">💤 спи</span>' : '') : '<span class="pill p-ok">✓ свеж</span>';
        cls = old ? 'old' : sp.spi ? 'calm' : 'ok';
      }
      return '<div class="fr-i ' + cls + '"><span class="fr-e" aria-hidden="true">' + nm[1] + '</span><div><div><b>' + ime + '</b> ' + p + '</div>' +
        '<div class="small muted">последно: <span class="mono">' + esc(s.posledno ? dm(s.posledno) : '—') + '</span>' + br + '</div>' +
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
  // знакът и името на задачата; питането по мейл („✉ Питай“) е „искане“ с danni.kanal = 'mail' [ETAP6 §3.6]
  function vidIme(a) { return isPitai(a) ? ['✉', 'Питане по мейл'] : VID[a.vid] || null; }
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
      // Етап 6 [§5.4]: „✉ Питай по мейл“ — първият избор, когато задачата е от точка (без нов бутон на картата)
      '<div class="choose">' + (P.tid && P.tekst && !P.zamenq ? '<button type="button" class="ch4 v-pitai" data-a="pitai"><span class="ch4-e" aria-hidden="true">✉️</span><b>Питай по мейл</b>' +
        '<span>мейл до избран човек: има ли отговор или развитие — AiLab следи отговора</span></button>' : '') + ['za_men', 'vazlozhi', 'napomni', 'sreshta', 'iskane'].map(function (k) {
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
  // след „Запиши“: листът се затваря → записът е в опашката веднага (задържан), „Отмени“ ~5 с в лентата долу. „Отмени“ връща формата [§8.2, К22, ETAP6 §5.6]
  function plusCommit(row, intr) {
    var Ps = P, ctx = Ps.ctx, sec = Math.max(1, Math.round((activeMs() - Ps.t0) / 1000)), v = Ps.vid;
    var lbl = VID[v][0] + ' ' + (v === 'iskane' ? 'Искане' : VID[v][1]) + (intr ? ' · Интранет' : '');
    P = null; closeSheet();
    var redo = function () { P = Ps; P.t0 = activeMs(); renderPlusForm(); };
    var metr = function () { send('metriki', { vid: 'deistvie_sek', stoinost: sec, den_id: row.den_id }).catch(function () {}); };
    var key = zadaStart(row, lbl, Ps.tid, ctx, redo, metr);
    if (v === 'iskane') iskDone(row, Ps, key);
  }
  // Задача към точка (или без) — на картата в Табло (dc), в Преглед (pc) или само с лентата (z:…); общо за „+“, „→ Задача“ и „✉ Питай“
  function zadaStart(row, lbl, tid, ctx, redo, metr) {
    var key;
    if (ctx && ctx.src === 'tablo' && ctx.close && ctx.tid) {
      var t = tFind(ctx.tid);
      if (t) { key = 'dc:' + t.id; dcStart(t, lbl, 'deistviq', row, redo, null, metr); }
    }
    if (!key && tid && view === 'day' && findT(tid)) {
      var tp = findT(tid), dn = S.den;
      key = 'pc:' + tp.id;
      undoStart({ key: key, kind: 'pc', tid: tp.id, lbl: lbl, tbl: 'deistviq', row: row, redo: redo,
        now: function () { if (tp.grupa === 'reshenie' && dn) noteClose(tp.id, dn.obekt || OBEKT_KOD, dn.data, false, null); },
        back: function () { if (tp.grupa === 'reshenie') unClose(tp.id); },
        pre: function () { if (metr) metr(); } });
    }
    if (!key) {
      key = 'z:' + newQid();
      undoStart({ key: key, kind: 'toast', lbl: lbl, tbl: 'deistviq', row: row, redo: redo,
        now: function () { if (ctx && ctx.tid && ctx.close) noteClose(ctx.tid, ctx.o, ctx.d, false, null); },
        back: function () { if (ctx && ctx.tid && ctx.close) unClose(ctx.tid); },
        pre: function () { if (metr) metr(); if (ctx && ctx.src === 'tablo') tMeasure(); },
        done: function () { if (view === 'tablo') { renderOpen(true); refillOpen(); } } });
    }
    return key;
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
    shuPause(key);
  }
  var ISK = null;
  // Докато листът („❓ Искането е записано“, „✉ Питай“) покрива картата, 5-те секунди „Отмени“ не текат (pauza в опашката);
  // тръгват отначало, щом листът се затвори. Скриване на приложението (отваря се чатът/пощата) пак записва веднага [К22, §5.6 т.10].
  function shuPause(key) { if (!UNDO[key]) return; SHU = key; undoPause(key); }
  function shuRelease() { var k = SHU; SHU = null; if (k) undoResume(k); }
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
    lokal: ['⏳ отбелязано — чака лаптопа', 'p-neutral'], prosr: ['просрочено', 'p-warn'],
    chaka_otgovor: ['✉ чака отговор', 'p-neutral']   // Етап 6: питане по мейл [§2.3]
  };
  function isProba(a) { return a.status === 'zaqveno' && /^🧪/.test(a.belejka || ''); }
  // „✉ Питай по мейл“ — задача „искане“ с danni.kanal = 'mail' [ETAP6 §3.6]
  function isPitai(a) { return !!a && a.vid === 'iskane' && danniOf(a).kanal === 'mail'; }
  function stOf(a) {
    if (a._err) return ST.err;
    if (a._pend) return ST.pend;
    if (lokalClosed(a)) return ST.lokal;
    // питане по мейл: „✉ чака отговор · от ДД.ММ“ (кехлибарено от 7 дни: „✉ чака отговор N дни“); отговорено → „✅ отговорено“ [§5.1]
    if (isPitai(a) && (a.status === 'zaqveno' || a.status === 'chaka_otgovor')) {
      var pt = danniOf(a).pitano || a.sazdadeno, pd = pt ? new Date(pt) : null, dn = pd && !isNaN(pd) ? daysAgo(ymd(pd)) : 0;
      return dn >= 7 ? ['✉ чака отговор ' + dn + ' дни', 'p-warn'] : [ST.chaka_otgovor[0] + (pd && !isNaN(pd) ? ' · от ' + ddmm(pd) : ''), ST.chaka_otgovor[1]];
    }
    if (isPitai(a) && a.status === 'izpalneno') return ['✅ отговорено' + (a.obnoveno ? ' ' + dm(a.obnoveno) : ''), 'p-ok'];
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
    // задържаният (5-те с „Отмени“) не е „на телефона — чака връзка“: показва се като направен [§5.6 т.3]
    queue().forEach(function (it) {
      if (it.tbl !== 'deistviq') return;
      var h = isHeld(it);
      var r = Object.assign({ _q: !h, _held: h, _pend: !it.err && !h, _err: it.err || '', _qid: it.qid, sazdadeno: it.at, id: 'q' + it.qid, status: 'zaqveno' }, it.row);
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
    var v = vidIme(a) || ['•', a.vid], s = stOf(a), o = objOf(a), g = zadGroup(a);
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
    // 1а [§6.4]: един текст навсякъде (лентата, тостът, листът, долу) — „отговорите ти са запазени“
    if (view === 'day' && S.den && S.newVersiq > S.den.versiq) h += '<div class="bn bn-new"><span>' + esc(nvTxt()) + '</span><button type="button" class="bn-b" data-a="reload">Покажи новата версия</button></div>';
    if ((S.offline || S.forceOff) && live) {
      var at = view === 'tablo' ? TB.at : view === 'day' ? S.dataAt : (S.actsAt || TB.at);
      var old = !at || nowMs() - Date.parse(at) > 12 * 36e5;   // Таблото/Действия: кехлибарено чак когато запазеното е > 12 ч
      h += '<div class="bn bn-off' + (view !== 'day' && !old ? ' calm' : '') + '">📴 без покритие · данни към ' + esc(at ? rel(at) : '—') + '</div>';
    }
    var n = pendingCount();
    if (n && live) h += '<div class="bn bn-q">⏳ ' + (n === 1 ? '1 чака връзка — тръгва само, щом има покритие' : n + ' чакат връзка — тръгват сами, щом има покритие') + '</div>';
    var ne = errQ().length;
    if (ne && live) h += '<button type="button" class="bn bn-err" data-a="qerr">⚠️ ' + (ne === 1 ? '1 запис не се записа' : ne + ' записа не се записаха') + ' — виж и реши</button>';
    if (el._h !== h) { el.innerHTML = h; el._h = h; twSync(); }
  }
  // Записи, които базата отказа: текстът на РП стои тук, докато той не реши — „Опитай пак“ или „Махни“.
  var QVID = { odobri: 'Одобрение на деня', potvardi: 'Потвърждение', popravka: 'Поправка', osporva: 'Оспорване', komentar: 'Коментар',
    izkljuchi: 'Не за дневника', vkljuchi: 'Пак в дневника', dobavi: 'Включване в дневника', vrazka_ne: 'Махната връзка' };
  function openErrSheet() {
    var list = errQ();
    if (!list.length) { closeSheet(); return; }
    openSheet('Не се записаха (' + list.length + ')', list.map(function (it) {
      var kind = it.tbl === 'deistviq' ? 'Задача · ' + ((VID[it.row.vid] || ['', it.row.vid])[1])
        : it.tbl === 'deistviq_bel' ? 'Задача №' + it.row.deistvie_id + ' · ' + (it.row.vid === 'gotovo' ? 'Готово' : it.row.vid === 'otmeni' ? 'Отмени' : 'Лична бележка')
        : (QVID[it.row.vid] || it.row.vid);
      // „➕ Включи в дневника“: часът и началото на съобщението вместо точката (tekst е само ключът) [ETAP6 §5.1]
      var dob = it.tbl === 'resheniq' && it.row.vid === 'dobavi';
      return '<div class="qerr-i"><div><b>' + esc(kind) + '</b> <span class="small muted">· ' + esc(dm(it.at)) + '</span></div>' +
        (it.tt ? '<div class="sh-q">' + (dob ? 'Съобщение: ' : 'Точка: ') + esc(clip(it.tt, 220)) + '</div>' : '') +
        (it.row.tekst && !dob ? '<div class="qerr-t">' + esc(it.row.tekst) + '</div>' : '') +
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
    // листът над записа се сменя с друг → 5-те секунди „Отмени“ текат пак
    if (had) { shuRelease(); if (sheetKind === 'isk') ISK = null; if (sheetKind === 'pitai' && kind !== 'pitai') PIT = null; if (sheetKind === 'izt' && kind !== 'izt') IZTS = null; }
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
    shuRelease();
    if (sheetKind === 'isk') ISK = null;
    if (sheetKind === 'pitai') PIT = null;
    if (sheetKind === 'izt') IZTS = null;
    // източниците/снимките на панела „Избрана точка“ (широк екран) остават — махат се само тези на листа
    if (SP && SP.el === sheetEl) SP = null;
    if (SRC && SRC.el === sheetEl) SRC = null;
    sheetEl.remove(); sheetEl = null; sheetKind = ''; PY = null; MK = null;
    if (!PV) document.body.classList.remove('noscroll');   // прегледът и листът се пазят взаимно [К28]
    if (sheetPrev && document.contains(sheetPrev) && sheetPrev.focus) { try { sheetPrev.focus({ preventScroll: true }); } catch (e) {} }
    sheetPrev = null;
    // листът „Източници“ беше над панела → панелът си взима обратно източниците
    if (WIDE && view === 'day' && $('#panSrc') && (!SRC || SRC.el !== $('#panSrc'))) renderPan(true);
  }
  // iPhone (Safari и иконата на началния екран): клавиатурата свива само видимата част (visualViewport), а не position:fixed
  // и dvh → листът с форма се събира точно във видимото над клавиатурата и залепеният „Запиши“ остава видим [К31, А12]
  function vvFit() {
    var sc = sheetEl, vv = window.visualViewport; if (!sc) return;
    var sh = sc.firstChild, form = sheetKind === 'form' || sheetKind === 'py' || sheetKind === 'bel' || sheetKind === 'pitai';
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
    if (view === 'day') { keepAnchor(renderGroups); keepY(['#ph'], renderPh); if (WIDE) panPhFill(); }
    else if (view === 'tablo' && TB.built) { renderFeed(); if (!scrolledFar() || WIDE) renderOpen(true); }
    srcPhFill();
    if (PV) pvPaint();
  }
  // Без скачане под палеца: секция над видимото смени височината → екранът се мести със същото (като [К11] от Етап 2).
  // #ph е с content-visibility:auto — извън екрана браузърът пази старата височина и би „скочил“ чак при връщане нагоре
  // (Safari няма scroll anchoring) → за мерането секцията се рисува истински, после пак auto (помни новата височина).
  function keepY(sels, fn) {
    var b = sels.map(function (s) {
      var n = $(s); if (!n || (WIDE && n.closest('.pv3-p'))) return null;   // широк екран: снимките са в панела със собствен скрол
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
    if (WIDE) panPhFill();
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
  function srcPhStart(den, izvori, el) {
    var msgs = [], lbl = {};
    el = el || sheetEl;
    (izvori || []).forEach(function (s) { var m = srcMsg(s); if (m && !lbl[m]) { msgs.push(m); lbl[m] = 'Източник [' + s.n + ']'; } });
    if (!msgs.length || !el || den == null) { SP = null; return; }
    var tok = ++spTok, have = phListFor(den);
    SP = { el: el, den: den, msgs: msgs, lbl: lbl, rows: null, err: null, tok: tok };
    // денят е зареден (С1 е дошла) → филтър по msg_id, без заявка; иначе С2 за всички ида наведнъж
    if (have) { SP.rows = phByMsg(have, msgs); srcPhFill(); return; }
    if (offNow()) { SP.err = 'net'; srcPhFill(); return; }
    srcPhFill();
    api.snimkiMsg(den, msgs).then(function (rows) {
      if (!SP || SP.tok !== tok || SP.el !== el) return;   // листът/панелът вече е друг → изхвърля се
      SP.rows = phByMsg((rows || []).map(normPh), msgs); srcPhFill();
    }, function (e) {
      if (!SP || SP.tok !== tok || SP.el !== el) return;
      if (phMissing(e)) SP.rows = {}; else SP.err = isNet(e) || isAuth(e) ? 'net' : 'err';
      srcPhFill();
    });
  }
  function srcPhFill() {
    if (!SP) return;
    if (!SP.el || !document.contains(SP.el)) { SP = null; return; }
    Array.prototype.forEach.call(SP.el.querySelectorAll('.src-ph[data-msg]'), function (c) {
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
    S.dni = []; S.counts = {}; S.den = null; S.tochki = []; S.res = []; S.newVersiq = 0; S.newHead = null; S.sig = ''; S.scrollY = 0;
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
  function showBox() { if (tablo) tablo.hidden = view !== 'tablo'; screen.hidden = view === 'tablo'; document.body.setAttribute('data-v', view); }
  // --- широк екран (≥ 1100 px × размера на текста) [§6.2, К32] ---
  // При смяна (прозорец, размер на текста) изгледът се рисува наново; избраният ден, точка и задача се пазят.
  function wideNow() { var z = lraw('ailab_e4_zoom'); return (window.innerWidth || document.documentElement.clientWidth || 0) >= 1100 * (FS[z] || 1); }
  function twSync() { var tw = $('.topwrap'); if (tw) document.documentElement.style.setProperty('--tw', Math.round(tw.getBoundingClientRect().height) + 'px'); }
  function wideCheck() {
    var w = wideNow();
    twSync();
    if (w === WIDE) return;
    // отворен лист, който на широкия екран е панел → затваря се, а изборът минава в панела
    var srcT = w && sheetKind === 'src' && view === 'day' && SRC && SRC.t && SRC.t.id != null ? SRC.t.id : null;
    var zs = w && sheetKind === 'zad' && view === 'deistviq' && ZS ? ZS.id : null;
    var izs = w && sheetKind === 'izad' && view === 'deistviq' ? IZT.sel : null;
    if (srcT != null || zs != null || izs != null) closeSheet();
    if (srcT != null) S.selT = srcT;
    if (zs != null) S.zadSel = String(zs);
    WIDE = w;
    document.body.classList.toggle('wide', w);
    if (view === 'day') { if (S.den || S.dni.length) renderDay(); }
    else if (view === 'deistviq') renderActsTab();
    else if (view === 'tablo' && TB.built) { renderTablo(true); if (anyDefer() && !scrolledFar()) applyDeferred(); }
    hidePill();
    twSync();
  }
  var wideT = 0;
  window.addEventListener('resize', function () { if (wideT) return; wideT = setTimeout(function () { wideT = 0; wideCheck(); }, 60); });
  try { WIDE_MQ = window.matchMedia('(min-width:1100px)'); if (WIDE_MQ.addEventListener) WIDE_MQ.addEventListener('change', wideCheck); else if (WIDE_MQ.addListener) WIDE_MQ.addListener(wideCheck); } catch (e) {}
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
    sesTick(); sesFlush();   // 1а [§6.9]: отрязъкът на мерилото — на екрана, който напускаме (преди смяната)
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
    else { if (!selState(TB.sel).open) loadSel(TB.sel); dnesLoad(); }
    prisLoad();   // Присъствия — при отваряне на Таблото (≤ 1 на 10 мин) [К21]
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
    izLoad();   // Интранетът (≤ 1 на 10 мин) — и за числото в превключвателя
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
    else if (sheetKind === 'izad' && IZT.sel != null) openIzad(IZT.sel, true);
    else if (sheetKind === 'mdk') mdkRefresh();
    phRepaint();   // покритие ⇄ без покритие: плочките, листът и прегледът (box() пише само разликата)
  }
  function refreshCurrent() {
    if (view === 'tablo') loadTablo();
    else if (view === 'day') { if (S.den && !S.offline) { poll(true); phLoad(S.den.id); } else boot(S.den ? S.den.id : null, !!S.den); }
    else if (view === 'deistviq') { loadActs(); if (zadIzg() === 'intranet') izLoad(true); }
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
        if (far && selState(sel).feed) { if (WIDE) renderChart(true); else TB.defer.chart = true; TB.defer.feed = true; if (newer && red('potok') !== 'stari') showPill(); }
        else { renderChart(true); feedReset(sel); }
      }
      prisMaybe();   // Присъствия — при смяна на svezhest.prisystvia.posledno (≤ 1 на 10 мин) [К21]
      if (view === 'tablo') dnesLoad();   // Етап 6 [§5.14]: „📥 Днес досега“ — една малка заявка на обект (≤ 1 на минута)
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
      tZapLoad(st.open);   // Етап 6: кои ⟦k⟧ имат свой ред — за 🚫 в картите [§5.5]
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
    // .tb2 / .tb2-l / .tb2-r — само за широкия екран (2 колони); на телефона са display:contents → подредбата е както досега
    tablo.innerHTML = scrHead('tablo') +
      '<div id="tb-sw"></div><div id="tb-top" class="tb-top"></div><div id="tb-fresh"></div><div id="tb-cnt" class="stats tb-cnt"></div><div id="tb-dnes" class="tb-dnes"></div><div id="tb-izvan"></div>' +
      '<div class="tb2"><div class="tb2-l">' +
      '<section class="grp g-reshenie" id="tb-open-s" aria-label="Изисква решение"><div class="grp-h"><h2>Изисква решение</h2><span class="grp-n" id="tb-open-n">…</span><span class="grp-rc" id="tb-red-resh"></span></div>' +
        '<p class="grp-s">чака теб: отговор, решение, пари или срок</p><div id="tb-open" class="tb-list"></div></section>' +
      '<section class="grp g-promqna" id="tb-hora-s" aria-label="Хора на обекта"><div class="grp-h"><h2>Хора на обекта</h2><span class="grp-l" id="tb-hora-l">по Присъствия</span></div><div id="tb-hora"></div></section>' +
      '</div><div class="tb2-r">' +
      '<section class="grp g-promqna" id="tb-feed-s" aria-label="Какво се промени"><div class="grp-h"><h2>Какво се промени</h2><span class="grp-rc" id="tb-red-potok"></span></div>' +
        '<p class="grp-s" id="tb-feed-sub"></p><div id="tb-ot"></div><div id="tb-feed" class="tb-list"></div><div id="tb-end" class="tb-end"></div></section>' +
      '</div></div>' +
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
    renderTbSw(); renderTbTop(); renderFresh('#tb-fresh', true); renderTabloCounts(); renderDnes(); renderIzvan(); renderTbRed();
    if (!d.open) renderOpen(true);
    if (!d.chart) renderChart(true);
    if (!d.feed) renderFeed(); else renderFeedEnd();
  }
  // Смяна от опашката/мрежата: числата винаги; списъкът с решенията — само ако не си скролнал надолу [К11].
  function renderTabloLive() {
    if (view !== 'tablo' || !TB.built) return;
    renderTbSw(); renderTbTop(); renderFresh('#tb-fresh', true); renderTabloCounts(); renderDnes(); renderIzvan(); renderOpen(false); renderFeedEnd();
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
          '<p>Лаптопът пише черновата на деня в 19:00 и я обновява в 22:45 — тогава денят се появява тук с решенията, хората и промените.</p>' +
          '<p class="small muted">Действията (бутонът „+“) работят и сега.</p></section>';
      }
    }
    el.innerHTML = h;
    ['#tb-fresh', '#tb-cnt', '#tb-dnes', '#tb-izvan', '#tb-open-s', '#tb-hora-s', '#tb-feed-s'].forEach(function (s) { var n = $(s); if (n && n.hidden === show) n.hidden = !show; });
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
    var d = t.dni || {}, tid = esc(t.id), pl0 = ph && ph[t.id];
    var hot = (t.vajnost || 1) >= 3, w = waitPill(d.data), izv = t.izvori || [];
    // Етап 6 [§5.5]: 🚫 Не включвай — на чернова, ако k има свой ред в записа на деня (tZap); ред 2 на цял ред, както в Преглед
    var dn = dcMozhe(t), vd = dn ? dcVd(t) : true, mc = kanali(izv).length >= 2;
    return '<article class="dc' + (hot ? ' hot' : '') + (dn && !vd ? ' izk' : '') + (mc ? ' mk' : '') + '" data-tid="' + tid + '">' +
      '<button type="button" class="dc-open" data-a="tOpen" data-o="' + esc(d.obekt) + '" data-den="' + esc(t.den_id) + '" data-tid="' + tid + '">' +
        '<span class="dc-m"><span class="ochip o-' + esc(d.obekt) + '">' + esc(SELK[d.obekt] || d.obekt) + '</span><span class="dc-d">' + esc(lcDay(d.data)) + '</span>' +
          '<span class="pill ' + w[1] + '">' + w[0] + '</span>' + (isNewDay(d) ? '<span class="pill p-new">🆕</span>' : '') + (hot ? '<span class="pill p-bad">⚠️ важно</span>' : '') +
          (dn && !vd ? '<span class="pill p-izk">🚫 няма да влезе в дневника</span>' : '') + '</span>' +
        '<span class="dc-b"><span class="dc-e" aria-hidden="true">' + emoT(t) + '</span><span class="dc-t">' + esc(t.tekst) + '</span></span>' +
        '<span class="sr"> — отвори деня</span></button>' +
      (izv.length ? srcBtn(izv, t.id, 'tSrc', 'dc') : '') +
      // снимките на картата (С5) — до 4 + „+N“; тап → прегледът само на тях [§6.2]
      (pl0 && pl0.length ? phRowHtml(pl0, 'dcPh', 'data-tid="' + tid + '"', pl0.n) : '') +
      (hi.err[t.id] ? '<div class="dc-w"><button type="button" class="dc-errb" data-a="qerr">⚠️ не се записа — виж</button></div>' : '') +
      // същите бутони като в Преглед — полето за разяснение е там, където РП решава [К27]; „Отмени“ — в лентата долу [§5.6]
      '<div class="dc-a three"><button type="button" class="pa pa-ok" data-a="tOk" data-tid="' + tid + '">✓ Отговорено</button>' +
        '<button type="button" class="pa" data-a="tFix" data-tid="' + tid + '">✎ Поясни</button>' +
        '<button type="button" class="pa" data-a="tAct" data-tid="' + tid + '">→ Задача</button>' +
        (dn ? '<button type="button" class="pa pa-dn' + (vd ? '' : ' off') + '" data-a="tDn" data-tid="' + tid + '" aria-pressed="' + !vd + '" aria-label="' + (vd ? 'Не включвай в дневника' : 'Върни в дневника') + '">' + (vd ? '🚫 Не включвай в дневника' : '📘 Върни в дневника') + '</button>' : '') +
      '</div></article>';
  }
  // ---- Етап 6 [§5.5]: „🚫 Не включвай“ в Табло ----
  // кои ⟦k⟧ имат свой ред в записа на видимите дни-чернови (tZap, ≤ 10 дни, веднъж) — само в паметта: TB.zap[den] = {k: true}
  function dcMozhe(t) { var d = t.dni, z = TB.zap[tZapK(t)]; return !!(t.k != null && d && d.status === 'chernova' && z && z[t.k]); }
  // „в дневника ли е“: последният избор в опашката (и задържаният), иначе Преглед за същия ден, иначе tochki.v_dnevnika
  function dcVd(t) {
    var v = null;
    queue().forEach(function (it) { if (it.tbl === 'resheniq' && !it.err && it.row.tochka_id === t.id && (it.row.vid === 'izkljuchi' || it.row.vid === 'vkljuchi')) v = it.row.vid === 'vkljuchi'; });
    if (v !== null) return v;
    if (S.den && S.den.id === t.den_id) { var p = findT(t.id); if (p) return vDn(p); }
    return t.v_dnevnika !== false;
  }
  // ключът е денят + версията: нова версия на черновата → записът се тегли наново (≤ 10 дни на заявка)
  function tZapK(t) { return t.den_id + ':' + (t.dni ? t.dni.versiq : ''); }
  function tZapLoad(o) {
    if (!o || !o.items || offNow() || !E6.open) return;
    var ids = [], ver = {};
    (o.all ? o.items : o.items.slice(0, 5)).forEach(function (t) {
      var zk = tZapK(t);
      if (t.k != null && t.dni && t.dni.status === 'chernova' && !TB.zap[zk] && !TB.zapAsk[zk] && ids.indexOf(t.den_id) < 0) { ids.push(t.den_id); ver[t.den_id] = zk; }
    });
    ids = ids.slice(0, 10);
    if (!ids.length) return;
    ids.forEach(function (id) { TB.zapAsk[ver[id]] = 1; });
    api.tZap(ids).then(function (rows) {
      (rows || []).forEach(function (r) {
        var ks = {};
        String(r.zapis_md || '').split('\n').forEach(function (l) { mdKs(l).forEach(function (k) { ks[k] = true; }); });
        if (ver[r.id]) TB.zap[ver[r.id]] = ks;
      });
      ids.forEach(function (id) { if (!TB.zap[ver[id]]) TB.zap[ver[id]] = {}; });
      if (view === 'tablo') renderOpen(false, true);
    }, function () { ids.forEach(function (id) { delete TB.zapAsk[ver[id]]; }); });
  }
  // новото v_dnevnika (след като записът е в базата) — във всички копия на точката в Таблото и в Преглед
  function tSetVd(tid, v) {
    ['ag', 'soft', 'all'].forEach(function (s) {
      var st = TB.S[s]; if (!st) return;
      [st.open && st.open.items, st.old && st.old.items].forEach(function (l) { (l || []).forEach(function (t) { if (t.id === tid) t.v_dnevnika = v; }); });
    });
  }
  function tDn(tid) {
    var t = tFind(tid); if (!t || !t.dni || !dcMozhe(t)) return;
    var d = t.dni, vk = !dcVd(t);   // сега е изключена → връщам я
    var row = { den_id: t.den_id, tochka_id: t.id, vid: vk ? 'vkljuchi' : 'izkljuchi', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() + ' · табло' };
    tMeasure();
    // картата НЕ се затваря — решението остава отворено, както в Преглед; без тоста dnShared (той е само в Преглед)
    undoStart({ key: 'dn:' + tid, kind: 'dn', tid: tid, lbl: vk ? '📘 Пак в дневника' : '🚫 Не за дневника', tbl: 'resheniq', row: row, meta: { tt: t.tekst },
      done: function (r) { if (r === 'sent') tSetVd(tid, vk); if (view === 'tablo') renderOpen(true); } });
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
    // на широк екран решенията са в лепкавата лява колона (винаги видими) → без отлагане
    if (!force && !WIDE && el.node._h != null && el.node._h !== h && scrolledFar()) { TB.defer.open = true; if (!quiet) showPill(); renderOpenN(); return; }
    TB.defer.open = false;
    el.innerHTML = h;
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
      // Етап 6 [§5.5]: ред 1 — бутонът на източниците (цял ред); ред 2 — „→ Задача“ · „Денят ›“
      '<div class="fd-a">' + (izv.length ? srcBtn(izv, t.id, 'tSrc', 'fd') : '<span class="fd-ns">няма източник</span>') + '</div>' +
      '<div class="fd-a two">' +
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

  // ---------- Етап 5: Присъствия — копие в prisystvie (пише само лаптопът; телефонът чете) [§6.3] ----------
  // Меродавно за броя хора. Без таблицата (преди 008) или без ред за деня → досегашното поведение по dni.hora — тихо.
  var PRIS = { rows: null, by: {}, first: {}, last: {}, at: 0, atIso: '', sv: '', st: '', busy: false, det: {}, detK: [], detSt: {} };
  function ldel(k) { try { localStorage.removeItem(DEMO ? k + '_demo' : k); } catch (e) {} }
  function prisSetRows(rows) {
    PRIS.rows = []; PRIS.by = {}; PRIS.first = {}; PRIS.last = {};
    (rows || []).forEach(function (r) {
      var k = String((r && r.data) || '').slice(0, 10);
      if (!r || (r.obekt !== 'ag' && r.obekt !== 'soft') || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var x = { obekt: r.obekt, data: k, obshto: +r.obshto || 0, neto: +r.neto || 0 };
      PRIS.rows.push(x); PRIS.by[x.obekt + ':' + k] = x;
      if (!PRIS.first[x.obekt] || k < PRIS.first[x.obekt]) PRIS.first[x.obekt] = k;
      if (!PRIS.last[x.obekt] || k > PRIS.last[x.obekt]) PRIS.last[x.obekt] = k;
    });
  }
  // кеш за без покритие: само obekt, data, obshto, neto (ailab_e5_hora)
  function prisInit() {
    if (PRIS.rows || PRIS.st === 'missing' || PRIS.inited) return;
    PRIS.inited = true;
    var c = ljget(K5.hora, null);
    if (c && Array.isArray(c.rows)) { prisSetRows(c.rows); PRIS.atIso = c.at || ''; PRIS.sv = c.sv || ''; }
  }
  function prisOk() { prisInit(); return !!PRIS.rows && PRIS.st !== 'missing'; }
  function prisOf(o, k) { return prisOk() ? PRIS.by[o + ':' + k] || null : null; }
  function svOf(iz) { return (S.svezhest || []).filter(function (s) { return s.izvor === iz; })[0] || null; }
  // При отваряне на Таблото и при смяна на svezhest.prisystvia.posledno — най-често веднъж на 10 мин [К21]; по страници [К4]
  function prisLoad(force) {
    prisInit();
    if (PRIS.busy || !api || offNow() || (!DEMO && (!db || !user))) return;
    if (!force && PRIS.at && Date.now() - PRIS.at < 600000) return;
    PRIS.busy = true; PRIS.at = Date.now();
    allPages(api.pris).then(function (rows) {
      var sv = svOf('prisystvia');
      PRIS.busy = false; PRIS.st = 'ok'; PRIS.atIso = nowIso(); PRIS.sv = sv ? String(sv.posledno || '') : PRIS.sv;
      var old = PRIS.by;
      prisSetRows(rows);
      // разбивка, чиито числа са сменени → тегли се наново при показване
      Object.keys(PRIS.det).forEach(function (k) { var a = old[k], b = PRIS.by[k]; if (!b || !a || a.obshto !== b.obshto || a.neto !== b.neto) delete PRIS.det[k]; });
      if (!ljsetOk(K5.hora, { at: PRIS.atIso, sv: PRIS.sv, rows: PRIS.rows })) ldel(K5.hora);
      prisPaint();
    }, function (e) {
      PRIS.busy = false;
      if (isMissing(e) || isNoCol(e)) { PRIS.st = 'missing'; PRIS.rows = null; PRIS.by = {}; ldel(K5.hora); prisPaint(); return; }
      PRIS.st = isNet(e) || isAuth(e) ? 'net' : 'err';
      if (PRIS.st === 'net') PRIS.at = 0;   // с покритие — пак при следващия повод
    });
  }
  function prisMaybe() { var s = svOf('prisystvia'), p = s ? String(s.posledno || '') : ''; if (p && p !== PRIS.sv) prisLoad(); }
  function prisPaint() {
    if (view === 'tablo' && TB.built) { if (scrolledFar() && !WIDE) TB.defer.chart = true; else renderChart(true); }
    else if (view === 'day') { renderStrip(); keepAnchor(renderPris); renderFresh(); if (sheetKind === 'sab') sabSheetPaint(); }   // 1а: „Събрано до“ — Присъствия
  }
  // разбивката на един ден (po_brigadi) — само при показване; паметта пази последните 30
  function prisDet(o, k, noLoad) {
    var key = o + ':' + k;
    if (Object.prototype.hasOwnProperty.call(PRIS.det, key)) return PRIS.det[key];
    if (!noLoad) prisDetLoad(o, k);
    return undefined;
  }
  function prisDetLoad(o, k) {
    var key = o + ':' + k, st = PRIS.detSt[key];
    if (!api || (!DEMO && (!db || !user))) return;
    if (st && st.s === 'load') return;
    if (offNow()) { PRIS.detSt[key] = { s: 'net', t: Date.now() }; return; }
    if (st && st.s === 'err' && Date.now() - st.t < 60000) return;
    PRIS.detSt[key] = { s: 'load', t: Date.now() };
    api.prisDen(o, k).then(function (r) {
      delete PRIS.detSt[key];
      if (r && typeof r.po_brigadi === 'string') { try { r.po_brigadi = JSON.parse(r.po_brigadi); } catch (e) { r.po_brigadi = []; } }
      if (r && !Array.isArray(r.po_brigadi)) r.po_brigadi = [];
      if (!Object.prototype.hasOwnProperty.call(PRIS.det, key)) { PRIS.detK.push(key); if (PRIS.detK.length > 30) delete PRIS.det[PRIS.detK.shift()]; }
      PRIS.det[key] = r || null;
      prisDetPaint(o, k);
    }, function (e) {
      PRIS.detSt[key] = { s: isNet(e) || isAuth(e) ? 'net' : 'err', t: Date.now() };
      if (isMissing(e)) { PRIS.st = 'missing'; PRIS.rows = null; }
      prisDetPaint(o, k);
    });
  }
  function prisDetPaint(o, k) {
    if (view === 'day' && S.den && (S.den.obekt || OBEKT_KOD) === o && S.den.data === k) { keepAnchor(renderPris); renderFresh(); if (sheetKind === 'sab') sabSheetPaint(); }
    if (view === 'tablo' && TB.chart.geo) hcDetPaint(false);
    if (sheetKind === 'pris' && PRS && PRS.o === o && PRS.k === k) prisSheet(o, k, true);
  }
  // категориите на деня: сбор по kategoriq (празната — „Без категория“, накрая при равно), низходящо; имената — както в Присъствия
  function prisCats(pb) {
    var m = {}, out = [];
    (pb || []).forEach(function (b) {
      if (!b || !(+b.broi > 0)) return;
      var c = b.kategoriq == null ? '' : String(b.kategoriq).trim();
      if (!Object.prototype.hasOwnProperty.call(m, c)) { m[c] = { kat: c, ime: c || 'Без категория', broi: 0, br: [] }; out.push(m[c]); }
      m[c].broi += +b.broi; m[c].br.push(b);
    });
    return out.sort(function (a, b) { return b.broi - a.broi || (a.kat === '' ? 1 : b.kat === '' ? -1 : a.ime < b.ime ? -1 : a.ime > b.ime ? 1 : 0); });
  }
  // Карта „👷 Присъствия“ в Преглед, веднага след резюмето [§6.3]
  function renderPris() {
    var el = box('#pris'); if (!el) return;
    var d = S.den;
    if (!d || !prisOk()) { el.innerHTML = ''; return; }
    var o = d.obekt || OBEKT_KOD, p = prisOf(o, d.data), hv = horaOf(d);
    if (!p) { el.innerHTML = '<div class="pris-c none">👷 Присъствия: още няма запис за този ден</div>'; return; }
    var det = prisDet(o, d.data), cats = det && Array.isArray(det.po_brigadi) ? prisCats(det.po_brigadi) : null, st = PRIS.detSt[o + ':' + d.data];
    var cmp = hv === p.neto ? '<span class="pris-ok">✓ черновата е по Присъствия</span>'
      : '<span class="pris-df">Черновата: ' + (hv == null ? 'без число' : hv + ' — разлика ' + Math.abs(p.neto - hv)) + '</span>';
    el.innerHTML = '<button type="button" class="pris-c" data-a="prisT" aria-label="' + esc('Присъствия: нето ' + p.neto + ', общо ' + p.obshto + ' — таблицата по бригади') + '">' +
      '<span class="pris-1">👷 Присъствия: нето <b>' + p.neto + '</b> · общо ' + p.obshto + '</span>' +
      (cats && cats.length ? '<span class="pris-cs">' + cats.slice(0, 4).map(function (c) { return '<span class="pris-ch">' + esc(c.ime) + ' ' + c.broi + '</span>'; }).join('') + (cats.length > 4 ? '<span class="pris-ch more">+' + (cats.length - 4) + '</span>' : '') + '</span>'
        : det === undefined && !(st && st.s !== 'load') ? '<span class="pris-cs small muted"><span class="pulse" aria-hidden="true"></span> категориите…</span>' : '') +
      '<span class="pris-2">' + cmp + (det && det.obnoveno_v ? '<span class="small muted">въведено ' + esc(dm(det.obnoveno_v)) + '</span>' : '') + '</span>' +
      '<span class="pris-go" aria-hidden="true">›</span></button>';
  }
  // Листът (на широк екран — прозорец): таблицата по бригади — Категория · Бригада · Брой · в нето
  var PRS = null;
  function prisSheet(o, k, live) {
    var p = prisOf(o, k); if (!p) return;
    PRS = { o: o, k: k };
    var det = prisDet(o, k), st = PRIS.detSt[o + ':' + k], pb = det && Array.isArray(det.po_brigadi) ? det.po_brigadi : null, dr = S.den && S.den.data === k ? horaOf(S.den) : null;
    var rows = pb ? pb.filter(function (b) { return +b.broi > 0; }) : [];
    var body = '<div class="ap-sum o-' + o + '"><span class="ap-d">' + esc(capDay(k)) + ' · ' + esc(OBEKT[o][0]) + '</span><span class="ap-v">нето ' + p.neto + ' · общо ' + p.obshto + '</span></div>' +
      (dr != null && dr !== p.neto ? '<p class="warnline">👷 Черновата: ' + dr + ' · Присъствия: ' + p.neto + ' — разлика ' + Math.abs(dr - p.neto) + '</p>' : '') +
      (pb ? (rows.length ? '<div class="tw"><table class="pris-t"><thead><tr><th>Категория</th><th>Бригада</th><th class="n">Брой</th><th>В нето</th></tr></thead><tbody>' + rows.map(function (b) {
          return '<tr' + (b.net === false ? ' class="nn"' : '') + '><td>' + esc(b.kategoriq || 'Без категория') + '</td><td>' + esc(b.ime) + (b.chasove ? '<div class="small muted mono">' + esc(b.chasove) + '</div>' : '') + '</td><td class="n">' + esc(b.broi) + '</td><td>' + (b.net === false ? 'не' : 'да') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">Няма бригади с хора за деня.</p>')
        : st && st.s === 'net' ? '<p class="grp-e">📴 Разбивката — когато има покритие.</p>' : st && st.s === 'err' ? '<p class="grp-e">Разбивката не се зареди.</p>'
        : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам бригадите…</p>') +
      (det && det.obnoveno_v ? '<p class="small muted">Въведено в Присъствия: ' + esc(dm(det.obnoveno_v)) + '</p>' : '') +
      '<p class="small muted">Меродавно за броя хора е приложението Присъствия — AiLab само го показва.</p>';
    if (live) { var b = sheetEl && sheetKind === 'pris' ? sheetEl.querySelector('.sh-b') : null; if (b) { putH(b, body + '<button type="button" class="btn ghost sh-end" data-a="close">Затвори</button>'); } return; }
    openSheet('👷 Присъствия по бригади', body, 'pris');
  }
  // листът „Одобряваш ли…“: разлика с Присъствия или „няма запис“ — не спира одобрението [§6.3]
  function prisApprLine(d) {
    if (!prisOk()) return '';
    var p = prisOf(d.obekt || OBEKT_KOD, d.data), hv = horaOf(d);
    if (!p) return '<p class="small muted">👷 Присъствия: няма запис за деня</p>';
    return hv !== p.neto ? '<p class="warnline">👷 Хора: черновата ' + (hv == null ? '—' : hv) + ' · Присъствия ' + p.neto + '</p>' : '';
  }

  // --- „Хора на обекта“: SVG без библиотеки — по Присъствия (нето), 30 д / 90 д / Всичко [§6.3] ---
  // Стълб = нето от Присъствия; ден без Присъствия, но с dni.hora → кух стълб („по черновата“); без таблицата — по dni.hora
  // (плътно, както преди). Цялата графика е една зона за пръста: тап/плъзгане → най-близкият ден/седмица; „‹ ›“ отдолу [К19].
  function horaOf(r) { return r && r.hora != null && r.hora !== '' ? +r.hora : null; }
  function hcObh() { var v = lget(K5.obh); return v === '90' || v === 'all' ? v : '30'; }
  var MES_K = MES.map(function (m) { return m.slice(0, 3); });
  function r1(v) { return Math.round(v * 10) / 10; }
  function hcData(sel) {
    var parts = sel === 'all' ? ['ag', 'soft'] : [sel], ok = prisOk(), dm = {}, first = {}, last = '', f0 = '';
    TB.dni.forEach(function (r) {
      if (parts.indexOf(r.obekt) < 0 || !(r.data >= TEST_DO)) return;
      dm[r.obekt + ':' + r.data] = r;
      if (r.data > last) last = r.data;
      if (horaOf(r) != null && (!first[r.obekt] || r.data < first[r.obekt])) first[r.obekt] = r.data;
    });
    if (ok) parts.forEach(function (p) {
      var f = PRIS.first[p], l = PRIS.last[p];
      if (f && (!first[p] || f < first[p])) first[p] = f;
      if (l && l > last) last = l;
    });
    parts.forEach(function (p) { if (first[p] && (!f0 || first[p] < f0)) f0 = first[p]; });
    if (!last || !f0) return null;
    return { sel: sel, parts: parts, ok: ok, dm: dm, first: first, last: last, f0: f0 };
  }
  function hcDay(D, dt) {
    var k = ymd(dt), wd = dt.getDay(), vals = [], src = [], any = false, all = true, hol = false, m = {};
    D.parts.forEach(function (p) {
      var pr = D.ok ? PRIS.by[p + ':' + k] : null, r = D.dm[p + ':' + k] || null, h = horaOf(r), v = null, s = null;
      m[p] = r;
      if (pr) { v = pr.neto; s = 'p'; }
      else if (h != null) { v = h; s = D.ok ? 'd' : 'p'; if (D.ok) hol = true; }
      else if (D.parts.length > 1 && (!D.first[p] || k < D.first[p])) { v = 0; s = 'pre'; }   // обектът още не е започнал — 0, не „няма данни“ [К20]
      vals.push(v); src.push(s);
      if (v != null && s !== 'pre') any = true;
      if (v == null) all = false;
    });
    return { k: k, dt: dt, wd: wd, we: wd === 0 || wd === 6, parts: D.parts, vals: vals, src: src, any: any, all: all, hol: hol, m: m,
      tot: any ? vals.reduce(function (a, v) { return a + (v || 0); }, 0) : null };
  }
  // календарните дни на обхвата (през датите, не през ms [К16]); „Всичко“ — от понеделника на първата седмица
  function hcDays(D, obh) {
    var L = parseD(D.last), n = obh === '90' ? 90 : obh === '30' ? 30 : 0, out = [];
    var s0 = n ? new Date(L.getFullYear(), L.getMonth(), L.getDate() - n + 1) : parseD(D.f0);
    if (!n) s0.setDate(s0.getDate() - (s0.getDay() + 6) % 7);
    for (var dt = s0; dt <= L; dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + 1)) out.push(hcDay(D, dt));
    return out;
  }
  // „Всичко“: седмичен стълб = средно пн–пт с нето > 0 (при „Всички“ — само дни с число за всеки обект; „още не е започнал“ = 0)
  function hcWeeks(days) {
    var W = {}, order = [];
    days.forEach(function (d) {
      var wk = weekKey(d.dt), w = W[wk];
      if (!w) { w = W[wk] = { k: wk, dt: parseD(wk), days: [], v: [], pv: d.parts.map(function () { return []; }), nh: 0, parts: d.parts }; order.push(w); }
      w.days.push(d);
      if (!d.we && d.all && d.tot > 0) { w.v.push(d.tot); d.vals.forEach(function (v, j) { w.pv[j].push(v || 0); }); if (d.hol) w.nh++; }
    });
    order.forEach(function (w) {
      var n = w.v.length;
      function avg(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
      w.n = n; w.any = n > 0; w.we = false;
      w.tot = avg(w.v); w.min = n ? Math.min.apply(null, w.v) : null; w.max = n ? Math.max.apply(null, w.v) : null;
      w.vals = w.pv.map(avg); w.hol = n > 0 && w.nh === n;
      w.src = w.vals.map(function () { return w.hol ? 'd' : 'p'; });
    });
    return order;
  }
  function weekKey(dt) { var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); }
  // средно за седмица (пн–нд): от пн–пт с хора > 0, само дните в обхвата (30 д — пунктирът и подписът отдолу)
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
  function hcIdx(items, k, obh) {
    if (!k) return -1;
    var key = obh === 'all' ? weekKey(parseD(k)) : k;
    for (var i = 0; i < items.length; i++) if (items[i].k === key) return i;
    return -1;
  }
  var HC_W = 343, HC_H = 180;
  function hcSvg(sel, items, obh, ttl) {
    var W = HC_W, H = HC_H, ml = 26, mr = 6, mt = 18, mb = 22, pw = W - ml - mr, ph = H - mt - mb, n = items.length, slot = pw / Math.max(1, n);
    var d30 = obh === '30', bw = d30 ? Math.min(14, Math.max(3, slot * 0.68)) : Math.max(1.2, Math.min(10, slot * 0.74)), mx = 0, s = '', avgL = null;
    items.forEach(function (d) { if (d.tot != null && d.tot > mx) mx = d.tot; });
    var ymax = Math.max(10, Math.ceil(mx / 10) * 10);
    function y(v) { return mt + ph - v / ymax * ph; }
    function seg(x, yt, w, h, r) {
      if (h <= 0) return '';
      if (!r || h < r) return 'M' + r1(x) + ',' + r1(yt) + 'h' + r1(w) + 'v' + r1(h) + 'h' + r1(-w) + 'z';
      return 'M' + r1(x) + ',' + r1(yt + h) + 'V' + r1(yt + r) + 'Q' + r1(x) + ',' + r1(yt) + ' ' + r1(x + r) + ',' + r1(yt) + 'H' + r1(x + w - r) +
        'Q' + r1(x + w) + ',' + r1(yt) + ' ' + r1(x + w) + ',' + r1(yt + r) + 'V' + r1(yt + h) + 'Z';
    }
    if (d30) items.forEach(function (d, i) { if (d.we) s += '<rect class="c-we" x="' + r1(ml + i * slot + 0.5) + '" y="' + (mt - 8) + '" width="' + r1(Math.max(1, slot - 1)) + '" height="' + (ph + 12) + '" rx="3"/>'; });
    s += '<g class="c-selg"></g>';
    [0, ymax / 2, ymax].forEach(function (v) {
      s += '<line class="c-grid" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + r1(y(v)) + '" y2="' + r1(y(v)) + '"/><text class="c-ax" x="' + (ml - 5) + '" y="' + r1(y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    });
    items.forEach(function (d, i) {
      var cx = ml + i * slot + slot / 2, bx = cx - bw / 2;
      if (!d.any) { if (d30 && !d.we) s += '<line class="c-nd" x1="' + r1(bx) + '" x2="' + r1(bx + bw) + '" y1="' + r1(y(0) - 1) + '" y2="' + r1(y(0) - 1) + '"/>'; return; }   // делник без данни
      if (!d.tot) { if (d30) s += '<line class="c-zero" x1="' + r1(bx) + '" x2="' + r1(bx + bw) + '" y1="' + r1(y(0) - 1) + '" y2="' + r1(y(0) - 1) + '"/>'; return; }
      var acc = 0, idx = [];
      d.vals.forEach(function (v, j) { if (v > 0) idx.push(j); });
      s += '<g class="gbar' + (i === n - 1 ? ' last' : '') + '"' + (d30 ? ' style="animation-delay:' + (i * 12) + 'ms"' : '') + '>';
      idx.forEach(function (j, q) {
        var v = d.vals[j], yb = y(acc), yt = y(acc + v), gap = q > 0 && d30 ? 2 : 0;
        acc += v;
        s += '<path class="c-b' + (sel === 'all' ? ' c-' + d.parts[j] : '') + (d.src[j] === 'd' ? ' hol' : '') + '" d="' + seg(bx, yt, bw, (yb - yt) - gap, q === idx.length - 1 && d30 ? 3 : 0) + '"/>';
      });
      s += '</g>';
    });
    // 30 д: средно за седмицата — пунктир; надпис само на последната (както досега)
    if (d30) {
      var wk = weeksOf(items), lastW = null;
      wk.forEach(function (w) { if (w.avg != null) lastW = w; });
      wk.forEach(function (w) {
        if (w.avg == null) return;
        var x1 = ml + w.i0 * slot + 1, x2 = ml + (w.i1 + 1) * slot - 1, yy = y(w.avg);
        s += '<line class="c-avg" x1="' + r1(x1) + '" x2="' + r1(x2) + '" y1="' + r1(yy) + '" y2="' + r1(yy) + '"/>';
        if (w === lastW) {
          var endA = x1 + 40 > W - mr;
          avgL = { x0: endA ? x2 - 44 : x1, x1: endA ? x2 : x1 + 44, y: Math.max(11, yy - 5) };
          s += '<text class="c-avgt" x="' + r1(endA ? x2 : x1) + '" y="' + r1(Math.max(11, yy - 5)) + '" text-anchor="' + (endA ? 'end' : 'start') + '">ср. ' + Math.round(w.avg) + '</text>';
        }
      });
    }
    // надписи: 30 д — датата на всеки 7-и ден + последния; 90 д — 1-во число на месеца; Всичко — месеци/години (без застъпване)
    var cand = [];
    items.forEach(function (d, i) {
      var cx = ml + i * slot + slot / 2;
      if (d30) { if ((n - 1 - i) % 7 === 0) cand.push([cx, ddmm(d.dt), 0]); return; }
      if (obh === '90') { if (d.dt.getDate() === 1) cand.push([cx, MES_K[d.dt.getMonth()], 1]); return; }
      var th = new Date(d.dt.getFullYear(), d.dt.getMonth(), d.dt.getDate() + 3), pv = i ? new Date(items[i - 1].dt.getFullYear(), items[i - 1].dt.getMonth(), items[i - 1].dt.getDate() + 3) : null;
      if (!pv || pv.getMonth() !== th.getMonth()) cand.push([cx, th.getMonth() === 0 || !pv ? String(th.getFullYear()) : MES_K[th.getMonth()], 1]);
    });
    // първо годините (по-важни), после месеците/датите — само там, където не се застъпват
    var put = [];
    [true, false].forEach(function (god) {
      cand.forEach(function (c) {
        if (/^\d{4}$/.test(c[1]) !== god) return;
        var w = c[1].length * 6.6, x = Math.min(Math.max(c[0], ml + w / 2 - 4), W - mr - w / 2 + 2);
        if (put.some(function (p) { return x - w / 2 < p[1] + 5 && x + w / 2 > p[0] - 5; })) return;
        put.push([x - w / 2, x + w / 2]);
        if (c[2]) s += '<line class="c-tick" x1="' + r1(c[0]) + '" x2="' + r1(c[0]) + '" y1="' + r1(y(0)) + '" y2="' + r1(y(0) + 4) + '"/>';
        s += '<text class="c-day' + (god && obh === 'all' ? ' yr' : '') + '" x="' + r1(x) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(c[1]) + '</text>';
      });
    });
    s += '<g class="c-selv"></g><rect class="hc-hit" x="' + ml + '" y="0" width="' + r1(pw) + '" height="' + H + '"/>';
    TB.chart.geo = { W: W, H: H, ml: ml, mt: mt, ph: ph, slot: slot, ymax: ymax, items: items, obh: obh, sel: sel, ttl: ttl, i: -1, avgL: avgL };
    return '<svg class="hc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" tabindex="0" aria-label="' + esc(ttl) + '">' + s + '</svg>';
  }
  function hcSelBg(g, i) {
    var w = Math.max(g.slot, 5), cx = g.ml + i * g.slot + g.slot / 2;
    return '<rect class="c-sel" x="' + r1(cx - w / 2) + '" y="' + (g.mt - 10) + '" width="' + r1(w) + '" height="' + r1(g.ph + 14) + '" rx="' + (w > 8 ? 5 : 2) + '"/>';
  }
  function hcSelVal(g, i) {
    var d = g.items[i]; if (!d || !d.any || d.tot == null) return '';
    var cx = g.ml + i * g.slot + g.slot / 2, t = String(Math.round(d.tot)), w = t.length * 7.5;
    var x = Math.min(Math.max(cx, g.ml + w / 2), g.W - 4 - w / 2), yy = g.mt + g.ph - d.tot / g.ymax * g.ph - 6, a = g.avgL;
    // не върху надписа „ср. N“ на последната седмица — над него (или под, ако няма място)
    if (a && x + w / 2 > a.x0 && x - w / 2 < a.x1 && Math.abs(yy - a.y) < 13) yy = a.y - 14 >= 11 ? a.y - 14 : a.y + 15;
    return '<text class="c-val" x="' + r1(x) + '" y="' + r1(Math.max(11, yy)) + '" text-anchor="middle">' + t + '</text>';
  }
  function hcNavLbl(g, i) {
    var d = g.items[i]; if (!d) return '';
    if (g.obh === 'all') { var a = d.days[0].dt, b = d.days[d.days.length - 1].dt; return 'Седмица ' + rngLbl(a, b) + '.' + b.getFullYear(); }
    return capDay(d.k);
  }
  // Избор без пречертаване на графиката (плъзгането не губи пръста): само слоят с избора, „‹ ›“ и подробностите
  function hcSelect(i, drag, force) {
    var g = TB.chart.geo; if (!g || !g.items.length) return;
    i = Math.max(0, Math.min(g.items.length - 1, i));
    var it = g.items[i];
    if (g.obh === 'all') { if (!TB.chart.sel || weekKey(parseD(TB.chart.sel)) !== it.k) TB.chart.sel = it.k; }
    else TB.chart.sel = it.k;
    if (g.i === i && !force) return;
    if (g.i !== i && g.i >= 0) TB.chart.cat = null;
    g.i = i;
    var sg = document.querySelector('#tb-hora .c-selg'), sv = document.querySelector('#tb-hora .c-selv'), svg = document.querySelector('#tb-hora .hc-svg');
    if (sg) sg.innerHTML = hcSelBg(g, i);
    if (sv) sv.innerHTML = hcSelVal(g, i);
    if (svg) svg.setAttribute('aria-label', g.ttl + ' · избран: ' + hcNavLbl(g, i));
    hcNavPaint(); hcDetPaint(drag);
  }
  function hcStep(d) {
    var g = TB.chart.geo; if (!g) return;
    var ae = document.activeElement, nb = ae && ae.getAttribute && ae.getAttribute('data-a') === 'hcStep';
    hcSelect(g.i + d, false);
    if (nb) { var b = document.querySelector('#hc-nav [data-d="' + (d < 0 ? -1 : 1) + '"]'); if (b && !b.disabled) { try { b.focus({ preventScroll: true }); } catch (e) {} } }
  }
  function hcNavPaint() {
    var g = TB.chart.geo, n = $('#hc-nav'); if (!g || !n) return;
    var i = g.i, wk = g.obh === 'all';
    putH(n, '<button type="button" class="hc-nb" data-a="hcStep" data-d="-1"' + (i <= 0 ? ' disabled' : '') + ' aria-label="' + (wk ? 'Предишна седмица' : 'Предишен ден') + '">‹</button>' +
      '<span class="hc-nl">' + esc(hcNavLbl(g, i)) + '</span>' +
      '<button type="button" class="hc-nb" data-a="hcStep" data-d="1"' + (i >= g.items.length - 1 ? ' disabled' : '') + ' aria-label="' + (wk ? 'Следваща седмица' : 'Следващ ден') + '">›</button>');
  }
  var HCT = 0, HCD = null;
  // при плъзгане — без заявки за разбивката; тя идва, когато пръстът спре
  function hcDetPaint(drag) {
    var g = TB.chart.geo, n = $('#hc-det'); if (!g || !n || g.i < 0) return;
    putH(n, hcDetHtml(g, g.i, !!drag));
    clearTimeout(HCT);
    if (drag) HCT = setTimeout(function () { if (!HCD) hcDetPaint(false); }, 300);
  }
  function hcDetHtml(g, i, noLoad) {
    var d = g.items[i]; if (!d) return '';
    if (g.obh === 'all') {
      if (!d.n) return '<p class="hc-dl muted">Няма делници с хора в тази седмица.</p>';
      return '<p class="hc-dl">средно <b>' + Math.round(d.tot) + '</b> души на делник · най-малко ' + d.min + ', най-много ' + d.max + ' · ' + d.n + ' ' + pl(d.n, 'ден', 'дни') + (d.hol ? ' · по черновата' : '') + '</p>' +
        (d.parts.length > 1 ? '<p class="hc-dl small">' + d.parts.map(function (p, j) { return SELK[p] + ' ' + (d.vals[j] == null ? '—' : Math.round(d.vals[j])); }).join(' · ') + '</p>' : '');
    }
    return d.parts.map(function (p, j) { return hcDayObj(d, p, j, noLoad); }).join('');
  }
  function hcDayObj(d, p, j, noLoad) {
    var k = d.k, pr = prisOf(p, k), r = d.m[p], hv = horaOf(r), multi = d.parts.length > 1, h = '';
    var head = multi ? '<span class="ochip o-' + p + '">' + SELK[p] + '</span> ' : '';
    if (pr) {
      h += '<p class="hc-dl">' + head + '👷 нето <b>' + pr.neto + '</b> · общо ' + pr.obshto + '</p>';
      var det = prisDet(p, k, noLoad), st = PRIS.detSt[p + ':' + k];
      if (det && Array.isArray(det.po_brigadi)) {
        var nn = det.po_brigadi.filter(function (b) { return b.net === false && +b.broi > 0; });
        if (nn.length) h += '<p class="hc-nn">не влизат в нето: ' + esc(nn.map(function (b) { return b.ime + ' ' + b.broi; }).join(', ')) + '</p>';
        h += hcCats(p, k, det.po_brigadi);
      } else if (det === undefined) {
        h += st && st.s === 'net' ? '<p class="small muted">📴 Разбивката — когато има покритие</p>' : st && st.s === 'err' ? '<p class="small muted">Разбивката не се зареди.</p>'
          : '<p class="small muted"><span class="pulse" aria-hidden="true"></span> разбивката по бригади…</p>';
      }
      if (hv != null && hv !== pr.neto) h += '<p class="hc-dr">по черновата: ' + hv + ' ⚠ разлика ' + Math.abs(hv - pr.neto) + '</p>';
    } else if (hv != null) {
      h += '<p class="hc-dl">' + head + '👷 по черновата <b>' + hv + '</b>' + (prisOk() ? ' · <span class="muted">в Присъствия няма запис</span>' : ' души') + '</p>';
    } else if (d.src[j] === 'pre') h += '<p class="hc-dl muted">' + head + 'още не е започнал</p>';
    else h += '<p class="hc-dl muted">' + head + (d.we ? 'почивен ден' : r ? 'няма данни за хора' : 'няма качен ден') + '</p>';
    if (r) h += '<button type="button" class="btn ghost hc-go' + (multi ? ' o-' + p : '') + '" data-a="tOpen" data-o="' + p + '" data-den="' + esc(r.id) + '">' + (multi ? SELK[p] + ' · отвори деня ›' : 'Отвори деня ›') + '</button>';
    return '<div class="hc-o o-' + p + '">' + h + '</div>';
  }
  // категориите (сбор, низходящо); тап → бригадите ѝ с броя и часовете — имената точно както в Присъствия [К22]
  function hcCats(p, k, pb) {
    var cats = prisCats(pb), key0 = p + ':' + k + ':', open = null;
    if (!cats.length) return '';
    // чипове (компактно на телефона); отворената категория — списък с бригадите под тях
    var h = '<div class="hc-cats">' + cats.map(function (c) {
      var key = key0 + c.kat, on = TB.chart.cat === key;
      if (on) open = c;
      return '<button type="button" class="hc-cat" data-a="hcCat" data-c="' + esc(key) + '" aria-expanded="' + on + '"><span>' + esc(c.ime) + '</span><b>' + c.broi + '</b></button>';
    }).join('') + '</div>';
    if (open) h += '<ul class="hc-br" aria-label="' + esc(open.ime) + '">' + open.br.map(function (b) {
      return '<li><span>' + esc(b.ime) + (b.net === false ? ' <small>· не влиза в нето</small>' : '') + (b.chasove ? ' <small class="mono">' + esc(b.chasove) + '</small>' : '') + '</span><b>' + esc(b.broi) + '</b></li>';
    }).join('') + '</ul>';
    return h;
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
    var lb = $('#tb-hora-l'), lt = prisOk() ? 'по Присъствия' : 'по черновите';
    if (lb && lb.textContent !== lt) lb.textContent = lt;
    var sel = TB.sel, D = hcData(sel), obh = hcObh();
    var chips = '<div class="hc-ob" role="group" aria-label="Обхват на графиката">' + [['30', '30 д'], ['90', '90 д'], ['all', 'Всичко']].map(function (c) {
      return '<button type="button" class="chip" data-a="hcObh" data-v="' + c[0] + '" aria-pressed="' + (obh === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>';
    var days = D ? hcDays(D, obh) : [], items = obh === 'all' ? hcWeeks(days) : days;
    if (!items.some(function (d) { return d.any; })) {
      TB.chart.geo = null;
      el.innerHTML = '<div class="card hc">' + chips + '<p class="grp-e hc-e">Още няма дни с хора за този период.</p></div>';
      return;
    }
    var i = hcIdx(items, TB.chart.sel, obh);
    if (i < 0) { for (i = items.length - 1; i > 0 && !items[i].any; i--) {} TB.chart.sel = items[i].k; }
    var a = items[0], b = items[items.length - 1];
    var ttl = obh === 'all' ? 'Средно на делник по седмици · ' + MES_K[a.dt.getMonth()] + ' ' + a.dt.getFullYear() + ' – ' + MES_K[b.dt.getMonth()] + ' ' + b.dt.getFullYear()
      : 'Хора по дни · ' + rngLbl(a.dt, b.dt);
    var anim = TB.chart.anim && view === 'tablo' && obh === '30';   // стълбовете израстват само при първо показване
    if (anim) TB.chart.anim = false;
    var hol = items.some(function (d) { return d.hol; });
    var lg = (sel === 'all' ? '<span><i class="lg-ag"></i>Амур</span><span><i class="lg-soft"></i>Скай</span>' : '') + (hol ? '<span><i class="lg-hol"></i>по черновата</span>' : '');
    var svg = hcSvg(sel, items, obh, ttl);
    el.innerHTML = '<div class="card hc' + (anim ? ' anim' : '') + '"><div class="hc-h"><span class="hc-t">' + esc(ttl) + '</span>' + (lg ? '<span class="hc-lg">' + lg + '</span>' : '') + '</div>' +
      chips + svg + '<div class="hc-nav" id="hc-nav"></div><div class="hc-det" id="hc-det"></div>' + (obh === '30' ? chartWeek(days) : '') + '</div>';
    hcSelect(i, false, true);
  }
  function hcObhSet(v) {
    if (v !== '30' && v !== '90' && v !== 'all') return;
    lset(K5.obh, v); TB.chart.cat = null;
    renderChart(true);
  }
  function hcPickX(cx, drag) {
    var g = TB.chart.geo, svg = document.querySelector('#tb-hora .hc-svg'); if (!g || !svg) return;
    var r = svg.getBoundingClientRect(); if (!r.width) return;
    hcSelect(Math.floor(((cx - r.left) / r.width * g.W - g.ml) / g.slot), drag);
  }
  document.addEventListener('pointerdown', function (e) {
    var h = e.target && e.target.closest ? e.target.closest('#tb-hora .hc-hit') : null;
    if (!h || (e.button != null && e.button > 0)) return;
    HCD = { id: e.pointerId };
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
    hcPickX(e.clientX, true);
  });
  document.addEventListener('pointermove', function (e) { if (HCD && e.pointerId === HCD.id) hcPickX(e.clientX, true); });
  function hcEnd(e) { if (HCD && (!e || e.pointerId === HCD.id)) { HCD = null; hcDetPaint(false); } }
  document.addEventListener('pointerup', hcEnd);
  document.addEventListener('pointercancel', hcEnd);
  // „↑ Нови промени“ — под горната лента
  function showPill() {
    var p = $('#tb-new'); if (!p || view !== 'tablo') return;
    var tw = $('.topwrap'), fs = WIDE ? $('#tb-feed-s') : null;
    p.style.top = Math.round((tw ? tw.getBoundingClientRect().bottom : 60) + 8) + 'px';
    // широк екран: над колоната с потока, не в средата на страницата [К32]
    if (fs) { var r = fs.getBoundingClientRect(); p.style.left = Math.round(r.left + r.width / 2) + 'px'; } else p.style.left = '';
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
  // Етап 6 [§5.6]: картата излиза ВЕДНАГА (записът е задържан в опашката → hideInfo я скрива); „Отмени“ я връща
  function dcStart(t, lbl, tbl, row, redo, meta, extraPre) {
    var d = t.dni || tDay(t) || {}, tid = t.id;
    tMeasure();
    undoStart({ key: 'dc:' + tid, kind: 'dc', tid: tid, lbl: lbl, tbl: tbl, row: row, meta: meta || { tt: t.tekst }, redo: redo,
      now: function () { TB.closed[tid] = { at: nowIso(), o: d.obekt || null, d: d.data || null, ok: row.vid === 'potvardi' ? 1 : 0, sent: null }; saveTablo(); },
      back: function () { unClose(tid); },
      pre: function () { if (extraPre) extraPre(); TB.inflight[tid] = 1; },
      done: function (r) { delete TB.inflight[tid]; saveTablo(); renderCurrent(); if (r === 'sent') refillOpen(); },
      fail: function () { delete TB.inflight[tid]; saveTablo(); if (view === 'tablo') renderOpen(true); } });
  }
  function tOk(tid) {
    var t = tFind(tid); if (!t || !t.dni) return;
    var d = t.dni;
    dcStart(t, '✓ Отговорено', 'resheniq', { den_id: t.den_id, tochka_id: t.id, vid: 'potvardi', tekst: 'отговорено', versiq: d.versiq, hesh: d.hesh || null, ustroistvo: device() + ' · табло' });
  }
  // „✎ Поясни“ от Таблото — същият лист; денят е известен от t.dni [К27]
  function tFix(tid) {
    var t = tFind(tid); if (!t) return;
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
    openPlus(null, { src: 'tablo', tid: t.id, den_id: t.den_id, tekst: t.tekst, o: d.obekt || null, d: d.data || null, close: !!t.dni, izvori: t.izvori || [], k: t.k });
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
    if (!f.tid && f.k == null) return;
    // 1а [§6.5]: „↳ продължение на …“ — по ид на точката, иначе по k; свита в „Прегледани“ → разгъва се; факт → редът в „Пълен запис“
    var t = f.tid ? findT(f.tid) : null;
    if (!t && f.k != null) t = findTk(f.k);
    if (t && t.grupa !== 'fakt' && GRUPI.some(function (G) { return G.k === t.grupa; }) && pregledana(t)) { S.revOpen[t.grupa] = true; S.revCard[t.id] = true; renderGroups(); }
    if (t && (t.grupa === 'fakt' || !GRUPI.some(function (G) { return G.k === t.grupa; }))) { fullGo(t); return; }
    var el = t ? screen.querySelector('#groups .pc[data-tid="' + t.id + '"]') : null;
    if (!el) { toast('Точката е сменена в нова версия — прегледай деня'); return; }
    var tw = $('.topwrap'), off = (tw ? tw.getBoundingClientRect().height : 0) + 10;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + (window.pageYOffset || 0) - off));
    if (WIDE) panSelect(t.id);
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
    var w = WIDE;
    // широк екран: списъкът | панел с избраната задача [§6.2]; горе — превключвателят AiLab / Интранет [§6.4]
    if (!$('#zadW') || screen._w !== w) {
      screen.innerHTML = scrHead('deistviq') + '<div id="zadSw"></div>' + (w
        ? '<div class="zad2" id="zadW"><div id="zad" class="zad"></div><aside class="zpan" id="zadPan" aria-label="Избраната задача"></aside></div>'
        : '<div id="zadW"><div id="zad" class="zad"></div></div>');
      screen._w = w;
    }
    var sw = box('#zadSw'); if (sw) sw.innerHTML = zadSwHtml();
    var el = box('#zad'); if (!el) return;
    if (zadIzg() === 'intranet') { el.innerHTML = izHtml(); if (w) renderZadPan(); zadMarkSel(); return; }
    renderActsAilab(el);
    if (w) renderZadPan();
    zadMarkSel();
  }
  function renderActsAilab(el) {
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

  // ---------- Етап 5: Интранетът в „Задачи“ — копие intranet_zadachi (пише само лаптопът; само четене) [§6.4] ----------
  // Ролите идват готови (na_men, ot_men, v_ekipa) — името на РП не се сравнява тук; адресът — само от link [§3.3].
  var IZT = { rows: null, at: 0, atIso: '', st: '', busy: false, err: null, f: 'na_men', o: 'all', sel: null, cache: false, inited: false };
  var IZ_ST = { 'Текуща': 'p-neutral', 'Стартирала': 'p-blue', 'Мониторинг': 'p-blue', 'Чака одобрение': 'p-warn', 'За санкция': 'p-bad', 'Завършена': 'p-ok' };
  var IZ_F = [['na_men', 'На мен'], ['ot_men', 'От мен'], ['prosr', 'Просрочени'], ['v_ekipa', 'В екипа'], ['done', 'Завършени']];
  var IZ_O = [['all', 'Всички'], ['ag', 'Амур'], ['soft', 'Скай'], ['drugi', 'Други']];
  function izNorm(r) {
    if (typeof r.ekip === 'string') { try { r.ekip = JSON.parse(r.ekip); } catch (e) { r.ekip = []; } }
    if (!Array.isArray(r.ekip)) r.ekip = [];
    r.tid = +r.tid;
    return r;
  }
  function izInit() {
    if (IZT.inited) return;
    IZT.inited = true;
    var c = ljget(K5.iz, null);
    if (c && Array.isArray(c.rows) && !IZT.rows) { IZT.rows = c.rows.map(izNorm); IZT.atIso = c.at || ''; IZT.cache = true; }
  }
  function izOpen(r) { return r.status !== 'Завършена'; }
  function izSrok(r) { return r.srok ? String(r.srok).slice(0, 10) : ''; }
  // „днес“ = местната дата; оставащите/просрочените дни — от srok, тук [К23]
  function izOver(r) { var s = izSrok(r); return izOpen(r) && !!s && s < ymd(now()); }
  function izFind(tid) { var l = IZT.rows || []; for (var i = 0; i < l.length; i++) if (l[i].tid === +tid) return l[i]; return null; }
  function izOt(r) { return /^\s*интранет\s*$/i.test(String(r.vazlozhil || '')) ? 'автоматична' : (r.vazlozhil || '—'); }
  function izDoneCmp(a, b) {
    var x = String(a.zavarshena || ''), y = String(b.zavarshena || '');
    if (x !== y) return x < y ? 1 : -1;
    var p = String(a.sazdadena || ''), q = String(b.sazdadena || '');
    return p < q ? 1 : p > q ? -1 : 0;
  }
  // При отваряне на Задачи (и „↻“); най-често на 10 мин — лаптопът го обновява на 2 ч [§4.3]
  function izLoad(force) {
    izInit();
    if (IZT.busy || !api || (!DEMO && (!db || !user))) return;
    if (offNow()) { if (!IZT.rows && IZT.st !== 'missing') IZT.st = 'net'; return; }
    if (!force && IZT.at && Date.now() - IZT.at < 600000) return;
    IZT.busy = true; IZT.at = Date.now();
    allPages(api.izad).then(function (rows) {
      IZT.busy = false; IZT.st = 'ok'; IZT.err = null; IZT.rows = (rows || []).map(izNorm); IZT.atIso = nowIso(); IZT.cache = false;
      // кешът на телефона — само отворените + последните 30 завършени (трие се при „Изход“) [§8]
      var keep = IZT.rows.filter(izOpen).concat(IZT.rows.filter(function (r) { return !izOpen(r); }).sort(izDoneCmp).slice(0, 30));
      if (!ljsetOk(K5.iz, { at: IZT.atIso, rows: keep })) ldel(K5.iz);
      izPaint();
    }, function (e) {
      IZT.busy = false;
      if (isMissing(e) || isNoCol(e)) { IZT.st = 'missing'; IZT.rows = null; ldel(K5.iz); }
      else { IZT.st = isNet(e) || isAuth(e) ? 'net' : 'err'; IZT.err = e; if (IZT.st === 'net') IZT.at = 0; }
      izPaint();
    });
  }
  function izPaint() {
    if (view === 'deistviq') renderActsTab();
    if (sheetKind === 'zad' && ZS) openZad(ZS.id, true);
    if (sheetKind === 'izad' && IZT.sel != null) openIzad(IZT.sel, true);
    // Етап 6: пил „🗂️ #7888“ / „Задачата ›“ натиснат, докато списъкът още се зарежда → листът се отваря сега
    if (IZT.after != null) { var ta = IZT.after; IZT.after = null; if (IZT.rows) openIzad(ta); }
    if (view === 'day' && S.den) { keepAnchor(function () { renderGroups(); }); renderIzt(); }   // пиловете „🗂️ #…“ по текста — след списъка
    if (sheetKind === 'izt') iztSheetPaint();   // „📥 Днес досега“ — „създадена ЧЧ:ММ“ в блока Интранет, щом списъкът дойде
  }
  // Етап 6 [§5.3 б]: листът на задача от Интранета и от Преглед/Табло — списъкът (Етап 5) се зарежда при нужда, кешът му важи
  function izadGo(tid) {
    izInit();
    if (izFind(tid) || IZT.st === 'missing' || offNow()) { openIzad(tid); return; }
    if (IZT.busy || !IZT.rows) { IZT.after = tid; izLoad(!IZT.busy); toast('Зареждам задачите от Интранета…'); return; }
    openIzad(tid);
  }
  function zadIzg() { return IZT.st !== 'missing' && lget(K5.izg) === 'intranet' ? 'intranet' : 'ailab'; }
  function izObOk(r, o) { return o === 'all' ? true : o === 'drugi' ? !(r.obekt === 'ag' || r.obekt === 'soft') : r.obekt === o; }
  // N — само отворените; M (превключвателят) = отворените „на мен“ + просрочените „от мен“
  function izCounts(o) {
    var c = { na_men: 0, ot_men: 0, prosr: 0, v_ekipa: 0, m: 0 };
    (IZT.rows || []).forEach(function (r) {
      if (!izOpen(r)) return;
      if (r.na_men || (r.ot_men && izOver(r))) c.m++;
      if (o && !izObOk(r, o)) return;
      if (r.na_men) c.na_men++;
      if (r.ot_men) c.ot_men++;
      if (r.v_ekipa) c.v_ekipa++;
      if (izOver(r)) c.prosr++;
    });
    return c;
  }
  function zadSwHtml() {
    if (IZT.st === 'missing') return '';   // таблицата още я няма — тихо, както досега
    izInit();
    var z = zadStats(), n = z.wait + z.soon, m = IZT.rows ? izCounts().m : 0, cur = zadIzg();
    return '<div class="zad-sw" role="group" aria-label="Кои задачи">' +
      '<button type="button" data-a="zadSw" data-v="ailab" aria-pressed="' + (cur === 'ailab') + '">📌 AiLab' + (n ? ' <span class="cn">' + n + '</span>' : '') + '</button>' +
      '<button type="button" data-a="zadSw" data-v="intranet" aria-pressed="' + (cur === 'intranet') + '">🗂️ Интранет' + (m ? ' <span class="cn">' + m + '</span>' : '') + '</button></div>';
  }
  function izList() {
    var f = IZT.f, o = IZT.o, rows = (IZT.rows || []).filter(function (r) { return izObOk(r, o); });
    if (f === 'done') return rows.filter(function (r) { return !izOpen(r); }).sort(izDoneCmp).slice(0, 30);
    rows = rows.filter(function (r) { return izOpen(r) && (f === 'na_men' ? r.na_men : f === 'ot_men' ? r.ot_men : f === 'v_ekipa' ? r.v_ekipa : izOver(r)); });
    // срокът възходящо (просрочените първи), без срок — накрая; при равен срок — по-новата първа
    return rows.sort(function (a, b) {
      var x = izSrok(a), y = izSrok(b);
      if (x !== y) return !x ? 1 : !y ? -1 : x < y ? -1 : 1;
      var p = String(a.sazdadena || ''), q = String(b.sazdadena || '');
      return p < q ? 1 : p > q ? -1 : 0;
    });
  }
  function izSrokLbl(r) {
    var s = izSrok(r); if (!s) return '';
    if (!izOpen(r)) return 'срок ' + ddmm(parseD(s));
    var k = daysTo(s);
    return k < 0 ? '<span class="amber">просрочена ' + (-k) + ' ' + pl(-k, 'ден', 'дни') + '</span>' : 'до ' + ddmm(parseD(s)) + (k === 0 ? ' (днес)' : k === 1 ? ' (утре)' : '');
  }
  function izAilab(tid) { var s = String(tid); return zadRows().filter(function (a) { return !a._q && a.vanshen_id != null && String(a.vanshen_id) === s; })[0] || null; }
  function izRow(r) {
    var o = r.obekt === 'ag' || r.obekt === 'soft' ? r.obekt : 'all', f = IZT.f, ai = izAilab(r.tid), sr = izSrokLbl(r);
    var who = f === 'ot_men' || (f !== 'na_men' && !r.na_men) ? (r.otgovornik ? '→ ' + r.otgovornik : '') : 'от ' + izOt(r);
    return '<li class="act iz o-' + o + (izOpen(r) ? '' : ' done') + '"><button type="button" class="act-btn" data-a="izad" data-tid="' + esc(r.tid) + '">' +
      '<span class="iz-dot" aria-hidden="true"></span><span class="act-b"><span class="act-t">' + esc(r.opisanie) + '</span>' +
      '<span class="act-m">' + esc(who) + (who && sr ? ' · ' : '') + sr + '</span>' +
      '<span class="act-p"><span class="pill ' + (IZ_ST[r.status] || 'p-neutral') + '">' + esc(r.status || '—') + '</span>' + (ai && typeof ai.id === 'number' ? '<span class="pill p-mine">AiLab №' + esc(ai.id) + '</span>' : '') + '</span></span></button></li>';
  }
  function agoTxt(t) {
    if (isNaN(t)) return '—';
    var m = Math.round((nowMs() - t) / 60000);
    return m < 1 ? 'току-що' : m < 60 ? 'преди ' + m + ' мин' : m < 1440 ? 'преди ' + Math.round(m / 60) + ' ч' : rel(new Date(t).toISOString());
  }
  // свежестта — по графика (svOld, ETAP6 §3.5); лаптопът спи → сивият ред + кехлибарено само ако е застарял преди заспиването;
  // „входът не мина“ остава винаги (иска действие от РП) [§5.7]
  function izFresh() {
    var s = svOf('intranet');
    if (!s) return '<p class="iz-fr">Интранет: лаптопът още не е пратил данни.</p>';
    var t = Date.parse(s.posledno), sp = svSpi(), vhod = s.ok === false && /вход/i.test(s.belejka || '');
    var amb = svWarn(s, sp);
    var txt = vhod ? 'Интранет: входът не мина — влез отново в Интранета от лаптопа' : 'Интранет: обновено ' + agoTxt(t) + (s.ok === false ? ' · ⚠️ грешка при събиране' : '');
    return (sp.spi ? '<p class="iz-fr sleep">' + esc(spiTxt(sp)) + '</p>' : '') + '<p class="iz-fr' + (amb ? ' warn' : '') + '">' + esc(txt) + '</p>';
  }
  function izHtml() {
    izInit();
    var h = izFresh();
    if (!IZT.rows) {
      return h + (IZT.st === 'missing' ? '<p class="grp-e">Интранетът още не е в облака — лаптопът го качва.</p>'
        : offNow() || IZT.st === 'net' ? '<p class="grp-e">📴 Задачите от Интранета — когато има покритие.</p>'
        : IZT.st === 'err' ? '<div class="err">Не се заредиха: ' + esc(errBg(IZT.err)) + '</div><button type="button" class="btn ghost" data-a="izRetry">Опитай пак</button>'
        : '<p class="grp-e"><span class="pulse" aria-hidden="true"></span> Зареждам задачите от Интранета…</p>');
    }
    if (offNow() || IZT.cache) h += '<p class="iz-off small muted">📴 от ' + esc(rel(IZT.atIso)) + '</p>';
    var c = izCounts(IZT.o), l = izList();
    h += '<div class="zad-f iz-f" role="group" aria-label="Роля">' + IZ_F.map(function (x) {
      var n = x[0] === 'done' ? null : c[x[0]];
      return '<button type="button" class="chip' + (x[0] === 'prosr' && n ? ' amb' : '') + '" data-a="izF" data-v="' + x[0] + '" aria-pressed="' + (IZT.f === x[0]) + '">' + x[1] + (n != null ? ' <span class="cn">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div><div class="zad-f iz-o" role="group" aria-label="Обект">' + IZ_O.map(function (x) {
      return '<button type="button" class="chip sm' + (x[0] === 'ag' || x[0] === 'soft' ? ' o-' + x[0] : '') + '" data-a="izO" data-v="' + x[0] + '" aria-pressed="' + (IZT.o === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    h += l.length ? '<ul class="acts">' + l.map(izRow).join('') + '</ul>'
      : '<p class="grp-e">' + (IZT.f === 'done' ? 'Няма завършени задачи.' : IZT.f === 'prosr' ? '✅ Нищо не е просрочено.' : 'Няма отворени задачи тук.') + '</p>';
    return h;
  }
  // подробностите — лист (телефон) или панелът вдясно (широк екран)
  function izDetHtml(r) {
    var fl = [], s = izSrok(r), ai = izAilab(r.tid), k = s ? daysTo(s) : null, upd = r.vidqna_posledno || r.obnoveno;
    fl.push(['Обект', r.obekt === 'ag' || r.obekt === 'soft' ? OBEKT[r.obekt][0] : 'друг / неизвестен']);
    if (r.tema) fl.push(['Тема', r.tema]);
    fl.push(['Отговорник', r.otgovornik || '—']);
    fl.push(['Възложил', izOt(r)]);
    if (r.ekip.length) fl.push(['Екип', r.ekip.join(', ')]);
    if (r.prioritet) fl.push(['Приоритет', prioIme(r.prioritet)]);
    if (r.sazdadena) fl.push(['Създадена', exactShort(new Date(r.sazdadena))]);
    if (s) { var sd = parseD(s); fl.push(['Краен срок', DNI_K[sd.getDay()].toLowerCase() + ' ' + ddmm(sd) + '.' + sd.getFullYear() + (izOpen(r) ? ' (' + (k < 0 ? 'просрочена ' + (-k) + ' ' + pl(-k, 'ден', 'дни') : k === 0 ? 'днес' : k === 1 ? 'утре' : 'след ' + k + ' дни') + ')' : '')]); }
    fl.push(['Статус', r.status || '—']);
    if (r.komentari != null) fl.push(['Коментари', String(r.komentari)]);
    if (r.kontrolni) fl.push(['Контролни точки', r.kontrolni]);
    return '<p class="zd-t">' + esc(r.opisanie) + '</p><div class="zd-p"><span class="pill ' + (IZ_ST[r.status] || 'p-neutral') + '">' + esc(r.status || '—') + '</span>' +
        (izOver(r) ? '<span class="pill p-warn">просрочена</span>' : '') + (r.na_men ? '<span class="pill p-neutral">на мен</span>' : '') + (r.ot_men ? '<span class="pill p-neutral">от мен</span>' : '') + '</div>' +
      '<dl class="zd-f">' + fl.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
      (upd ? '<p class="small muted">Обновено от Интранета ' + esc(agoTxt(Date.parse(upd))) + ' · №' + esc(r.tid) + '</p>' : '') +
      '<div class="zd-b">' + (okZadUrl(r.link) ? zadLink(r.link, 'Отвори в Интранета ›', 'btn') : '') +
        (ai && typeof ai.id === 'number' ? '<button type="button" class="btn ghost" data-a="izAilab" data-id="' + esc(ai.id) + '">Задачата в AiLab ›</button>' : '') + '</div>';
  }
  function openIzad(tid, live) {
    var r = izFind(tid);
    if (!r) { if (live) { if (sheetKind === 'izad') closeSheet(); } else toast('Задачата вече я няма в списъка.'); return; }
    IZT.sel = r.tid;
    if (zadPanMode()) { renderZadPan(); zadMarkSel(); return; }
    var h = izDetHtml(r);
    if (live && sheetKind === 'izad' && sheetEl && sheetEl._izh === h) return;
    openSheet('🗂️ Интранет · №' + r.tid, h, 'izad');
    if (sheetEl) sheetEl._izh = h;
  }
  // ---- широк екран: панелът вдясно в „Задачи“ ----
  function zadPanMode() { return WIDE && view === 'deistviq' && !!$('#zadPan'); }
  function zadVisible() {   // AiLab задачите в реда на списъка (за избора по подразбиране)
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#zad [data-a="zad"]'), function (b) { out.push(b.getAttribute('data-id')); });
    return out;
  }
  function renderZadPan() {
    var el = $('#zadPan'); if (!el || !zadPanMode()) return;
    if (zadIzg() === 'intranet') {
      var r = IZT.sel != null ? izFind(IZT.sel) : null;
      if (!r && IZT.rows) { r = izList()[0] || null; IZT.sel = r ? r.tid : null; }
      putH(el, r ? '<div class="zpan-h">🗂️ Интранет · №' + esc(r.tid) + '</div>' + izDetHtml(r) : '<p class="grp-e">Избери задача отляво.</p>');
      return;
    }
    var a = S.zadSel != null ? zadFind(S.zadSel) : null;
    if (!a) { var v = zadVisible()[0]; a = v != null ? zadFind(v) : null; S.zadSel = a ? String(a.id) : null; }
    if (!a) { ZS = null; putH(el, '<p class="grp-e">Избери задача отляво.</p>'); return; }
    openZad(a.id, true);
  }
  function zadMarkSel() {
    if (!WIDE || view !== 'deistviq') return;
    var iz = zadIzg() === 'intranet', s = iz ? IZT.sel : S.zadSel;
    Array.prototype.forEach.call(document.querySelectorAll('#zad .act.sel'), function (n) { n.classList.remove('sel'); });
    if (s == null) return;
    var b = document.querySelector('#zad [data-a="' + (iz ? 'izad' : 'zad') + '"][data-' + (iz ? 'tid' : 'id') + '="' + String(s).replace(/["\\]/g, '') + '"]');
    if (b && b.parentNode) b.parentNode.classList.add('sel');
  }
  // текущата задача на листа/панела (бутоните в панела работят и след „Затвори“ на друг лист)
  function zadCur() {
    if (ZS) return zadFind(ZS.id);
    if (zadPanMode() && S.zadSel != null) { var a = zadFind(S.zadSel); if (a) ZS = { id: String(a.id), confirm: false, pan: true }; return a; }
    return null;
  }

  // ---------- листът на една задача [§8.4] ----------
  var ZS = null;   // {id, confirm}
  function okZadUrl(u) { return /^https:\/\//.test(String(u || '')) || (DEMO && /^#demo-/.test(String(u || ''))); }
  // Етап 5.2: на лаптопа връзката към Интранета отива в ЕДИН отделен прозорец (data-a="izWin"; „izOpen“ е друго) [ETAP6 §5.10]
  function zadLink(u, lbl, cls) {
    if (DEMO && /^#demo-/.test(String(u))) return '<button type="button" class="' + cls + '" data-a="demoLink" data-k="intranet" data-u="' + esc(u) + '">' + lbl + '</button>';
    return '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="noopener" data-a="izWin">' + lbl + '</a>';
  }
  // лаптоп = не телефон/таблет (и iPad, който се представя като Mac) и с мишка [ETAP6 §5.10]
  function naLaptopa() {
    var ua = navigator.userAgent || '';
    return !/iPhone|iPad|iPod|Android/i.test(ua) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) &&
      !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  }
  // Препратка към прозореца: втората задача отива в същия и излиза отпред; затворен ръчно → следващият клик отваря нов.
  // opener НЕ се маха (за разлика от §5.10): без него Chrome забранява смяната на адреса (и затварянето), щом прозорецът
  // вече е на Интранета — „SecurityError … does not have permission to navigate the target frame“ (проба в Chrome, 08.10).
  // Адресът е само https от link на Интранета [Е5 §3.3]. Не се разчита на търсене по име [ETAP6 §5.10]
  var IZW = null;
  function izWinDemo(w, tid) {   // демо: прозорецът остава about:blank, само текст (през textContent)
    try {
      w.document.title = 'Интранет (демо)';
      var b = w.document.body || w.document.documentElement.appendChild(w.document.createElement('body'));
      b.style.cssText = 'font:18px/1.5 system-ui,sans-serif;margin:0;padding:48px 32px;color:#1f2937;background:#fff';
      b.textContent = 'Демо: тук ще се отвори задача №' + (tid || '—') + ' от Интранета.';
    } catch (e) {}
  }
  function izWinGo(w, u, demoTid) {   // адресът (или демо текстът) в прозореца + отпред; false = Chrome не позволи
    if (demoTid !== undefined) izWinDemo(w, demoTid);
    else { try { w.location.href = u; } catch (e) { return false; } }
    try { w.focus(); } catch (e) {}
    return true;
  }
  function openIzWin(u, demoTid) {
    var demo = demoTid !== undefined;
    if (IZW && !IZW.closed && izWinGo(IZW, u, demoTid)) return;
    var sc = window.screen || {}, aw = sc.availWidth || 1280, ah = sc.availHeight || 800;
    var W = Math.round(aw * 0.9), H = Math.round(ah * 0.9);
    var L = (sc.availLeft || 0) + Math.round((aw - W) / 2), T = (sc.availTop || 0) + Math.round((ah - H) / 2);
    var w = null;
    try { w = window.open('', 'ailab-intranet', 'popup,width=' + W + ',height=' + H + ',left=' + L + ',top=' + T); } catch (e) { w = null; }
    if (!w) {   // Chrome спря прозореца → обичайният нов раздел
      IZW = null;
      if (demo) { toast('В демото няма истински Интранет'); return; }
      window.open(u, '_blank', 'noopener');
      toast('Chrome спря прозореца — отворих в нов раздел.');
      return;
    }
    IZW = w;
    try { w.moveTo(L, T); w.resizeTo(W, H); } catch (e) {}
    if (!izWinGo(w, u, demoTid)) { IZW = null; window.open(u, '_blank', 'noopener'); }
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
    } else if (a.vid === 'iskane' && d.kanal === 'mail') {
      // „✉ Питай по мейл“ — ключът е adresati (не do) [ETAP6 §3.6]
      var ad = Array.isArray(d.adresati) ? d.adresati : [];
      out.push(['Кому', ad.length ? ad.map(function (x) { return x && x.ime ? x.ime + ' · ' + x.adres : (x && x.adres) || ''; }).join(', ') : (a.chovek || '—')]);
      if (d.tema) out.push(['Тема', d.tema]);
      if (d.pitano) out.push(['Питано', cap(exact(new Date(d.pitano)))]);
      out.push(['Как', 'мейл от Outlook; сутрешният пуск отбелязва отговора']);
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
    var a = zadFind(id), pan = zadPanMode() && (view === 'deistviq');
    if (!a) {
      if (pan) { S.zadSel = null; ZS = null; putH($('#zadPan'), '<p class="grp-e">Задачата вече я няма в списъка.</p>'); return; }
      if (live) { ZS = null; closeSheet(); } else toast('Задачата вече я няма в списъка.'); return;
    }
    var conf = !!(live && ZS && ZS.confirm && ZS.id === String(a.id)), ZS0h = live && ZS && ZS.id === String(a.id) ? ZS.h : null;
    ZS = { id: String(a.id), confirm: conf, pan: pan };
    var v = VID[a.vid] || ['•', 'Задача'], s = stOf(a), lc = lokalClosed(a), g = zadGroup(a), num = typeof a.id === 'number';
    var over = g === 'soon' && a.srok && Date.parse(a.srok) < nowMs();
    // в самия лист пилът не се натиска → без „ ›“
    var h = '<p class="zd-t">' + esc(a.tekst) + '</p><div class="zd-p"><span class="pill ' + s[1] + '">' + esc(String(s[0]).replace(/\s*›\s*$/, '')) + '</span>' + (over ? '<span class="pill ' + ST.prosr[1] + '">' + ST.prosr[0] + '</span>' : '') + '</div>';
    // Етап 5: същата задача в копието на Интранета (по vanshen_id = tid) [§6.4]
    var izr = a.vanshen_id != null && /^\d+$/.test(String(a.vanshen_id)) ? (izInit(), izFind(+a.vanshen_id)) : null;
    if (izr) h += '<p class="zd-iz">🗂️ В Интранета: <b>' + esc(izr.status || '—') + '</b>' + (izSrok(izr) ? ' · срок ' + esc(ddmm(parseD(izSrok(izr)))) : '') + (izOver(izr) ? ' · <span class="amber">просрочена</span>' : '') + '</p>';
    var fl = zadFields(a);
    if (fl.length) h += '<dl class="zd-f">' + fl.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    if (a.razqsnenie) h += '<div class="zd-r"><b>Разяснение:</b> ' + esc(a.razqsnenie) + (a.cel === 'intranet' ? '<div class="small muted">Отива като първи коментар в задачата, когато решиш (въпрос към теб).</div>' : '') + '</div>';
    if (isProba(a)) h += '<div class="zd-proba"><b>🧪 Готова — така ще я впиша:</b><div>' + esc(String(a.belejka).replace(/^🧪\s*/, '')) + '</div><div class="small muted">В Интранета нищо не е изпратено — вписването започва след твоето „да“ в чата с Claude.</div></div>';
    h += '<div class="zd-ch"><div class="zd-chh">Докъде стигна</div><ol class="zd-chain">' + zadChain(a).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></div>';
    var b = '', pendU = num && Object.keys(UNDO).some(function (k) { return k.indexOf('b:' + a.id + ':') === 0; });
    if (pendU || a._held) {
      b += '<p class="small muted">⏳ Записва се — „Отмени“ е в лентата долу.</p>';
    } else if (a._q) {
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
      // питането по мейл се отменя и в „✉ чака отговор“ (лаптопът обработва отметките и там) [§3.6]; „Промени“ → листът „✉ Питай“
      var open = OTV.indexOf(a.status) >= 0 || a.status === 'greshka', canEdit = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'greshka'].indexOf(a.status) >= 0 || (isPitai(a) && a.status === 'chaka_otgovor');
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
    var ttl = (isPitai(a) ? '✉ Питане по мейл' : v[0] + ' ' + (v[1] === 'Поискай информация' ? 'Искане за информация' : v[1])) + (num ? ' · №' + a.id : '');
    if (pan) { S.zadSel = String(a.id); ZS.h = h; putH($('#zadPan'), '<div class="zpan-h">' + esc(ttl) + '</div>' + h); zadMarkSel(); return; }   // широк екран — панелът
    if (live && sheetKind === 'zad' && ZS0h === h) { ZS.h = h; return; }   // пречертаване само при промяна (скролът в листа остава)
    ZS.h = h;
    openSheet(ttl, h, 'zad');
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
    if (isPitai(a)) { openPitaiZad(a); return; }   // питане по мейл → листът „✉ Питай“ с данните ѝ, не формата „Искане“ [§5.4]
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
    dokAllLoad(); merLoad();   // 1а [§6.8, §6.9]: регистърът на приложенията и минутите — само при отваряне на Настройки
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
    h += nsCard('Как се прави дневникът', 'Какво влиза в Word и кога се пише', kakDnHtml());   // Етап 6 [§5.9, F6]; 1а [§6.10]
    h += nsCard('Свежест на източниците', '', freshHtml() +
      '<div class="nas-r2">Задачите: лаптопът ги обработи последно ' + (az ? '<b>' + esc(rel(az)) + '</b>' : '<span class="muted">— (още не)</span>') + '</div>' +
      '<div class="nas-r2' + (spOld ? ' amber' : '') + '">Списъкът с хора от Интранета: ' + (sp ? 'от <b>' + esc(rel(sp)) + '</b>' + (spOld ? ' — по-стар от 30 дни' : '') : '<span class="muted">' + (SPL.st === 'missing' ? 'още не е качен (лаптопът)' : 'още не е зареден') + '</span>') + '</div>');
    h += nsCard('📎 Приложенията (от ' + dvDat(DOK_OT, true) + ')', '', dokAllHtml());   // 1а [§6.8]
    h += nsCard('Място за снимки', '', mqHtml());
    h += nsCard('⏱ Колко време отива в AiLab', '', merHtml());   // 1а [§6.9]
    h += nsCard('Версия и данни', '', '<ul class="nas-v"><li>AiLab · Стъпка 1а (19.10) · кеш ailab-1a-v1</li><li>Данни към ' + esc(TB.at ? rel(TB.at) : '—') + '</li><li>Чакат връзка: ' + pendingCount() + '</li>' +
      '<li>' + (isStandalone() ? 'Инсталирано като иконка ✓' : 'Съвет: в Safari натисни <b>Сподели ⬆</b> → <b>Добави към началния екран</b>.') + '</li></ul>');
    h += nsCard('Още', '', '<div class="nas-b">' + (DEMO ? '' : '<button class="btn ghost" type="button" data-a="karti">🔎 Карти и търсене (Етап 0)</button>') + (DEMO ? demoPanel() : '') +
      (DEMO ? '<a class="btn ghost" href="./">Изход от демото</a>' : '<button class="btn ghost" type="button" data-a="logout">Изход</button>') + '</div>');
    el.innerHTML = h;
  }
  function nsSet(k, v) {
    if (k === 'start') lset(K4.start, v === 'posledno' ? '' : v);
    else if (k === 'tema') { lset(K4.tema, v === 'auto' ? '' : v); applyLook(); }
    else if (k === 'zoom') { lset(K4.zoom, v); applyLook(); wideCheck(); }   // прагът на широкия екран расте с текста [К32]
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
      case 'src': if (!(WIDE && view === 'day' && panSelect(tid))) openSrc(tid); break;   // широк екран — панелът, не лист [§6.2]
      case 'ref': openRef(el.getAttribute('data-n')); break;
      // Етап 4 — Преглед
      case 'ok': pcOk(tid); break;
      case 'seen': pcSeen(tid); break;
      case 'dn': pcDn(tid); break;
      // Етап 5 — „📘/🚫“ в „Пълен запис“, вписан ден, широкият екран, Присъствия
      case 'dnLk': dnLkToast(); break;
      case 'dnBez': toast('Тази точка няма свой ред с номер в пълния запис (напр. е от раздел 12) — „🚫 Не за дневника“ няма какво да махне. Ако не бива да влиза: „✎ Поясни“.'); break;
      case 'mdK': if (!e.target.closest('a')) openMdK(String(el.getAttribute('data-k') || '').split(',').map(function (x) { return +x; }).filter(function (x) { return x > 0; })); break;
      case 'mdIzk': S.izkShow = !S.izkShow; renderFull(); break;
      case 'pcSel': panSelect(tid); break;
      case 'prisT': if (S.den) prisSheet(S.den.obekt || OBEKT_KOD, S.den.data); break;
      case 'seenAll': pcSeenAll(el.getAttribute('data-g')); break;
      case 'fix': { var tf = findT(tid); if (tf && S.den) openPoyasni(tf, S.den, 'pc'); } break;
      case 'act': openPlus(tid); break;   // Етап 6: „Отмени“ е в лентата — картата не е заключена [§5.6]
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
      case 'izWin':   // Етап 5.2: Ctrl/Shift/среден клик и телефонът — обичайната връзка; лаптопът — отделният прозорец [ETAP6 §5.10]
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1 || !naLaptopa()) break;
        e.preventDefault(); openIzWin(el.getAttribute('href'));
        break;
      case 'demoLink': e.preventDefault(); { var dk = el.getAttribute('data-k');
        if (dk === 'intranet' && naLaptopa() && !(e.ctrlKey || e.metaKey || e.shiftKey)) { var du = el.getAttribute('data-u') || ''; openIzWin(du, (/(\d+)$/.exec(du) || [])[1] || ''); break; }
        toast(dk === 'teams' ? 'В демото няма истински Тиймс' : dk === 'intranet' ? 'В демото няма истински Интранет' : 'В демото няма OneDrive'); } break;
      // задачи
      case 'zad': openZad(el.getAttribute('data-id')); break;
      case 'zadF': S.zadF = el.getAttribute('data-v') || 'all'; renderActsTab(); break;
      // Етап 5 — Интранетът в „Задачи“
      case 'zadSw': { var zv = el.getAttribute('data-v') === 'intranet' ? 'intranet' : 'ailab'; lset(K5.izg, zv === 'intranet' ? 'intranet' : ''); if (zv === 'intranet') izLoad(); renderActsTab(); } break;
      case 'izF': IZT.f = el.getAttribute('data-v') || 'na_men'; if (WIDE) IZT.sel = null; renderActsTab(); break;
      case 'izO': IZT.o = el.getAttribute('data-v') || 'all'; if (WIDE) IZT.sel = null; renderActsTab(); break;
      case 'izad': izadGo(+el.getAttribute('data-tid')); break;
      case 'izRetry': izLoad(true); renderActsTab(); break;
      case 'izAilab': {
        var zi = el.getAttribute('data-id');
        if (zadPanMode()) { lset(K5.izg, ''); S.zadSel = zi; renderActsTab(); }
        else { closeSheet(); openZad(zi); }
      } break;
      case 'zGotovo': { var zg = zadCur(); if (zg) zadBelStart(zg, 'gotovo'); } break;
      case 'zOtmeni': if (zadCur()) { ZS.confirm = true; openZad(ZS.id, true); } break;
      case 'zOtmeniNe': if (zadCur()) { ZS.confirm = false; openZad(ZS.id, true); } break;
      case 'zOtmeniDa': { var zo = zadCur(); if (zo) zadBelStart(zo, 'otmeni'); } break;
      case 'zEdit': { var ze = zadCur(); if (ze) zadEdit(ze); } break;
      case 'zBel': { var zb = zadCur(); if (zb) openBelejka(zb, ''); } break;
      case 'belSave': { var bt = (($('#belT') && $('#belT').value) || '').trim(), ba = zadFind(el.getAttribute('data-id')); if (!bt) { var be = $('#belE'); be.textContent = 'Напиши бележката.'; be.hidden = false; break; } if (ba) zadBelStart(ba, 'belejka', bt); } break;
      case 'zTochka': { var zt = zadCur(); if (zt) { ZS = null; closeSheet(); goDay(objOf(zt), zt.den_id, zt.tochka_id); } } break;
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
      case 'dPrisNo': demoPrisNo(el); break;
      case 'dPrisLong': demoPrisLong(el); break;
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
      // Етап 5 — графиката „Хора на обекта“
      case 'hcObh': hcObhSet(el.getAttribute('data-v')); break;
      case 'hcStep': hcStep(+el.getAttribute('data-d') || 0); break;
      case 'hcCat': { var ck = el.getAttribute('data-c'); TB.chart.cat = TB.chart.cat === ck ? null : ck; hcDetPaint(false); } break;
      case 'tFeedMore': feedMore(); break;
      case 'tNew': tNew(); break;
      case 'tWait': tWait(); break;
      case 'tSoon': go('deistviq'); break;
      case 'tRetry': tRetry(el.getAttribute('data-s')); break;
      case 'tSrc': tSrc(tid); break;
      // Етап 6 — 🚫 в Табло, „🗂️ Източниците на деня“, „📥 Днес досега“, „✉ Питай“, „Как се прави дневникът“
      case 'tDn': tDn(tid); break;
      case 'kakDn': openKakDn(); break;
      case 'iztTgl': iztTgl(el.getAttribute('data-x'), el.getAttribute('data-b')); break;
      case 'iztF': iztFSet(el.getAttribute('data-v')); break;
      case 'iztMore': iztMore(el.getAttribute('data-x'), el.getAttribute('data-b')); break;
      case 'iztFull': iztFull(el.getAttribute('data-x'), +el.getAttribute('data-id')); break;
      case 'iztRetry': iztRetry(el.getAttribute('data-x'), el.getAttribute('data-b')); break;
      case 'iztGo': iztGo(tid); break;
      case 'iztDob': iztDob(el.getAttribute('data-k')); break;
      case 'iztDobGo': iztDobGo(el.getAttribute('data-k')); break;
      case 'iztPris': iztPris(); break;
      case 'iztPitai': iztPitai(el.getAttribute('data-x'), +el.getAttribute('data-id')); break;
      case 'dnesOpen': openDnes(el.getAttribute('data-o')); break;
      // Стъпка 1а — „Събрано до …“, версиите, „↳“, приложенията, мерене
      case 'sabrano': openSab(); break;
      case 'okStar': pcOkStar(tid); break;
      case 'prd': prdGo(tid); break;
      case 'prdNe': prdNe(tid); break;
      case 'viX': if (S.den) { VI.skrit[S.den.id + ':' + S.den.versiq] = true; renderVerInfo(); } break;
      case 'viGo': viGo(); break;
      case 'wasFull': WAS[tid] = true; keepAnchor(renderGroups); if (WIDE) renderPan(true); break;
      case 'starGo': starGo(); break;
      case 'apWait': apWait(); break;
      case 'dokDen': openDokDen(); break;
      case 'dokSh': dokSheet(el.getAttribute('data-v') === 'ne' ? 'ne' : 'nov'); break;
      case 'dnesDen': { var dno = el.getAttribute('data-o'), dni0 = +el.getAttribute('data-id') || null; if (dni0 && (dno === 'ag' || dno === 'soft')) goDay(dno, dni0, null); } break;
      case 'izvanSave': izvanSave(); break;
      case 'izvanNe': izvanZatvori(); toast('Добре — до утре'); break;
      case 'dPrisSled': demoPrisSled(el); break;
      case 'dDisk': demoDisk(el); break;
      case 'dCikalNe': demoCikal(el, 'ne'); break;
      case 'dCikalTece': demoCikal(el, 'tece'); break;
      case 'dIzvan': D.izvanForce = true; MER.zatv = {}; ldel(izvanKey()); closeSheet(); go('tablo'); setTimeout(renderIzvan, 50); toast('Демо: картата „Днес извън AiLab“ е в Таблото'); break;
      case 'dDokNo': demoDokNo(el); break;
      case 'dSledNo': demoSledNo(el); break;
      case 'pitai': pitaiFromPlus(); break;
      case 'pitaiT': pitaiT(tid); break;
      case 'ptGo': ptGo(el.getAttribute('data-k')); break;
      case 'ptChip': ptChip(el.getAttribute('data-i')); break;
      case 'ptAzSet': ptAzSet(el.getAttribute('data-i')); break;
      case 'dSpi': demoSpi(el); break;
      case 'dTeamsV': demoTeamsV(el); break;
      case 'dE6No': demoE6No(el); break;
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
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (sheetKind === 'form' || sheetKind === 'py' || sheetKind === 'bel' || sheetKind === 'pitai')) setTimeout(function () { if (document.activeElement === t) { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} } }, 320);
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
    // елемент с role="button", който не е <button> — Enter/Space го натиска
    if ((e.key === 'Enter' || e.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('data-a') && t.tagName !== 'BUTTON') {
      e.preventDefault();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return;
    }
    // графиката „Хора на обекта“: ←/→ — предишен/следващ ден (седмица); на широк екран — навсякъде в Таблото [К19]
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && view === 'tablo' && TB.chart.geo && !sheetEl && !e.altKey && !e.ctrlKey && !e.metaKey) {
      var inC = t && t.closest && t.closest('#tb-hora'), typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '');
      if (!typing && (inC || WIDE)) { e.preventDefault(); hcStep(e.key === 'ArrowLeft' ? -1 : 1); }
    }
  });
  document.addEventListener('toggle', function (e) {
    var id = e.target && e.target.id;
    if (id === 'fullD') S.fullOpen = e.target.open;
    else if (id === 'zad-done') S.zadDone = e.target.open;
    else if (id === 'phD' && S.phOpen !== e.target.open) { S.phOpen = e.target.open; renderPh(); }
  }, true);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { commitUndos(); if (view === 'tablo') seenWrite(); sesTick(); sesFlush(); return; }   // „Отмени“ не чака скрито приложение (първо опашката [К22]); 1а: отрязъкът на мерилото
    if (liveQ().length && !offNow()) flush();   // записите, влезли в опашката при скриването, тръгват при връщане
    if (view === 'day') { poll(true); if (S.den && !offNow() && Date.now() - PH.at > PH_C1_MS) phLoad(S.den.id); }   // [К30]
    else if (view === 'tablo' && stale60(TB.okAt)) { TB.seenBase = seenRead() || TB.seenBase; loadTablo(); }
    else if (view === 'deistviq' && stale60(S.actsOkAt)) loadActs();
  });
  window.addEventListener('pagehide', function () { commitUndos(); if (view === 'tablo') seenWrite(); sesFlush(); });
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
    // Етап 5: Присъствия, Интранетът, обхватът на графиката, изгледът в Задачи [§6.6]
    [K5.hora, K5.obh, K5.iz, K5.izg].forEach(function (k) { try { localStorage.removeItem(k); localStorage.removeItem(k + '_demo'); } catch (e) {} });
    // Етап 6: филтърът на „Източниците на деня“, „Това съм аз“; паметта — адресната книга, източниците на деня, прозорецът [§5.12]
    [K6.iztF, K6.az].forEach(function (k) { try { localStorage.removeItem(k); localStorage.removeItem(k + '_demo'); } catch (e) {} });
    ADR = null; ADR_ST = ''; PIT = null; IZ6 = {}; IZTS = null; IZW = null; TB.zap = {}; TB.zapAsk = {};
    PRIS.rows = null; PRIS.by = {}; PRIS.first = {}; PRIS.last = {}; PRIS.at = 0; PRIS.sv = ''; PRIS.st = ''; PRIS.det = {}; PRIS.detK = []; PRIS.detSt = {}; PRIS.inited = false;
    IZT.rows = null; IZT.at = 0; IZT.st = ''; IZT.sel = null; IZT.inited = false; IZT.cache = false;
    S.selT = null; S.selDen = null; S.zadSel = null;
    SPL.rows = null; SPL.at = 0; SPL.st = ''; SAOB = {}; S.bel = []; NS.mq = null; NS.mqAt = 0;
    if (TB.io) { try { TB.io.disconnect(); } catch (e) {} TB.io = null; }
    TB.dni = []; TB.S = {}; TB.closed = {}; TB.inflight = {}; TB.soon = []; TB.odobri = []; TB.at = ''; TB.okAt = 0; TB.hasBase = false; TB.built = false; TB.defer = {};
    if (tablo) { tablo.innerHTML = ''; tablo._h = null; }
    S.den = null; S.dni = []; S.tochki = []; S.res = []; S.deistviq = []; S.counts = {}; S.svezhest = []; S.svAt = 0;
    S.dataAt = ''; S.actsAt = ''; S.actsOkAt = 0; S.okAt = 0; S.newVersiq = 0; S.newHead = null; S.sig = '';
    // Стъпка 1а [§6.12]: паметта — регистърът на приложенията, „след черновата“, закъснелите, мерилото; ключовете „извън AiLab“
    SLED = {}; DOK = { den: {}, all: null, allSt: '', allAt: 0, allErr: null, lst: {} }; ZAK = {}; VI.skrit = {}; WAS = {};
    MER.rows = null; MER.st = ''; MER.at = 0; MER.start = null; MER.startSt = ''; MER.zatv = {};
    try { Object.keys(localStorage).filter(function (k) { return /^ailab-izvan-/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
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
      '<button type="button" class="btn ghost" data-a="dPrisNo" aria-pressed="' + !!(D && D.prisNo) + '">' + demoPrisLbl() + '</button>' +
      '<button type="button" class="btn ghost" data-a="dPrisLong" aria-pressed="' + !!(D && D.prisLong) + '">' + demoPrisLbl(true) + '</button>' +
      // Етап 6 [§5.11]: свежестта при спящ лаптоп; „без таблиците на Етап 6“ (преди 009)
      '<button type="button" class="btn ghost" data-a="dSpi" aria-pressed="' + !!(D && D.spi) + '">' + demoE6Lbl('spi') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dTeamsV" aria-pressed="' + !!(D && D.teamsV) + '">' + demoE6Lbl('tv') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dE6No" aria-pressed="' + !!(D && D.e6No) + '">' + demoE6Lbl('e6') + '</button>' +
      // Стъпка 1а [§6.11]: Присъствия след черновата · C: · пускът не е тръгнал · обновяване тече · „извън AiLab“ · без регистъра · без новото
      '<div class="demo-h">Стъпка 1а</div>' +
      '<button type="button" class="btn ghost" data-a="dPrisSled">' + demo1aLbl('pris') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dSledNo" aria-pressed="' + !!(D && D.sledNo) + '">' + demo1aLbl('sled') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dDisk">' + demo1aLbl('disk') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dCikalNe" aria-pressed="' + !!(D && D.cikal === 'ne') + '">' + demo1aLbl('ne') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dCikalTece" aria-pressed="' + !!(D && D.cikal === 'tece') + '">' + demo1aLbl('tece') + '</button>' +
      '<button type="button" class="btn ghost" data-a="dIzvan">⏱ Карта „извън AiLab“ (и извън часа)</button>' +
      '<button type="button" class="btn ghost" data-a="dDokNo" aria-pressed="' + !!(D && D.dokNo) + '">' + demo1aLbl('dok') + '</button>' +
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
    try { Object.keys(localStorage).filter(function (k) { return /^ailab-izvan-.*_demo$/.test(k); }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}   // 1а: „извън AiLab“
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
          t: D.tochki.filter(function (t) { return ids.indexOf(t.den_id) >= 0 && (t.grupa === 'reshenie' || t.grupa === 'neprovereno'); }).map(function (t) { return pick(t, 'id,den_id,grupa,istina,obnovena_v'); }),
          r: D.resheniq.filter(function (r) { return ids.indexOf(r.den_id) >= 0 && ANSW[r.vid] && r.tochka_id != null; }).map(function (r) { return pick(r, 'den_id,tochka_id,vid,versiq'); })
        };
      });
    },
    den: function (id) { return later(function () { return dDen(id); }); },
    head: function (id) { return later(function () { var d = dDen(id); return d ? pick(d, HEAD0 + ',sabrano,promeni') : null; }); },
    tochki: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).sort(function (a, b) { return a.red - b.red || a.id - b.id; }); }); },
    istini: function (id) { return later(function () { return D.tochki.filter(function (t) { return t.den_id === id; }).map(function (t) { return pick(t, 'id,istina'); }); }); },
    res: function (id) { return later(function () { return D.resheniq.filter(function (r) { return r.den_id === id; }).sort(function (a, b) { return a.kogda < b.kogda ? -1 : a.kogda > b.kogda ? 1 : 0; }); }); },
    // Етап 6: лаптопът — пазачът пише на 2 мин (минута преди „сега“); демо панелът: „💻 Лаптопът спи“ (17:02), „Тиймс от вчера“ (09:05)
    svezhest: function () {
      return later(function () {
        return D.svezhest.map(function (s) {
          var r = pick(s, 'izvor,posledno,ok,broi,belejka');
          if (s.izvor === 'laptop') r.posledno = D.spi ? dT('2026-09-24T17:02:00+03:00') : new Date(nowMs() - 60000).toISOString();
          if (s.izvor === 'teams' && D.teamsV) r.posledno = dT('2026-09-23T09:05:00+03:00');
          // Стъпка 1а [§6.11]: C: (пазачът, на 30 мин) и черновата (цикълът; пазачът — „не е тръгнал“) — от демо панела
          if (s.izvor === 'disk') { r.broi = D.disk; r.ok = D.disk >= 15; r.posledno = new Date(nowMs() - 5 * 60000).toISOString();
            r.belejka = 'C: ' + D.disk + ' GB свободни' + (D.disk < 8 ? ' — под 8 GB, освободи място' : D.disk < 15 ? ' — под 15 GB' : ''); }
          if (s.izvor === 'chernova') {
            if (D.cikal === 'ne') { r.ok = false; r.broi = 0; r.belejka = 'Пускът в 22:45 не е тръгнал (Claude е затворена или лимитът е свършил)'; }
            else if (D.cikal === 'tece') { r.ok = true; r.broi = 1; r.belejka = 'тече от ' + hhmm(new Date(nowMs() - 4 * 60000)) + ' (обновяване)'; }
          }
          return r;
        });
      });
    },
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
          var r = pick(t, FEED_COLS + (E6.open ? ',k,v_dnevnika' : '')); r.dni = pick(dDen(t.den_id), 'obekt,data,status,versiq,hesh,obnoven'); r.resheniq = []; r.deistviq = []; return r;
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
    mqsto: function () { return later(function () { return { broi: 1468, bajta: 261095424 }; }); },
    // Етап 5 — като истинските: страници по 1000 [К4]; „таблицата липсва“ (демо панел) → 42P01
    pris: function (rg) {
      return later(function () {
        if (D.prisNo) throw { code: '42P01', message: 'relation "public.prisystvie" does not exist' };
        return D.prisystvie.filter(function (r) { return r.v_izvora !== false; }).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : a.obekt < b.obekt ? -1 : a.obekt > b.obekt ? 1 : 0; })
          .slice(rg[0], rg[1] + 1).map(function (r) { return pick(r, 'obekt,data,obshto,neto'); });
      });
    },
    prisDen: function (o, d) {
      return later(function () {
        if (D.prisNo) throw { code: '42P01', message: 'relation "public.prisystvie" does not exist' };
        var r = D.prisystvie.filter(function (x) { return x.obekt === o && x.data === d && x.v_izvora !== false; })[0];
        return r ? pick(r, 'obekt,data,po_brigadi,obshto,neto,obnoveno_v,sinhr') : null;
      });
    },
    izad: function (rg) {
      return later(function () {
        return D.intranet_zadachi.filter(function (r) { return r.v_spisaka !== false; }).sort(function (a, b) { return a.tid - b.tid; }).slice(rg[0], rg[1] + 1).map(function (r) { return pick(r, IZ_COLS); });
      });
    },
    // Етап 6 — като истинските (009_etap6.sql); „без таблиците на Етап 6“ (демо панел) → 42P01 за движението и адресника
    saobDenK: function (den) {
      return later(function () {
        return D.saobshteniq.filter(function (r) { return r.den_id === den; })
          .sort(dSaobSort).slice(0, 1000).map(function (r) { return pick(r, 'id,kluch,vid,vreme'); });
      });
    },
    saobDen: function (den, vid, rg) {
      return later(function () { return D.saobshteniq.filter(function (r) { return r.den_id === den && r.vid === vid; }).sort(dSaobSort).slice(rg[0], rg[1] + 1).map(function (r) { return pick(r, SAOB_COLS); }); });
    },
    saobIds: function (ids) {
      return later(function () { return D.saobshteniq.filter(function (r) { return ids.indexOf(r.id) >= 0; }).sort(dSaobSort).slice(0, 60).map(function (r) { return pick(r, SAOB_COLS); }); });
    },
    saobDnesK: function (o, data, vse) {
      return later(function () { return D.saobshteniq.filter(function (r) { return r.obekt === o && r.data === data && (vse || r.den_id == null); }).sort(dSaobSort).slice(0, 1000).map(function (r) { return pick(r, 'id,kluch,vid,vreme'); }); });
    },
    // ---- Стъпка 1а — като истинските (010_stapka1a.sql); „без регистъра“ (демо панел) → 42P01 ----
    slednoBroi: function (o, data, ot) {
      return later(function () {
        var x = { teams: 0, mail: 0 }; if (D.sledNo) return x;
        D.saobshteniq.forEach(function (r) { if (r.obekt === o && r.data === data && (r.sazdadeno || r.vreme) > ot) { if (r.vid === 'mail') x.mail++; else x.teams++; } });
        return x;
      });
    },
    dokDen: function (o, data) {
      return later(function () {
        if (D.dokNo) throw { code: '42P01', message: 'relation "public.dokumenti" does not exist' };
        return D.dokumenti.filter(function (r) { return r.obekt === o && r.data === data; }).slice(0, 300).map(function (r) { return pick(r, DOK_COLS); });
      });
    },
    dokVsichki: function (ot, rg) {
      return later(function () {
        if (D.dokNo) throw { code: '42P01', message: 'relation "public.dokumenti" does not exist' };
        return D.dokumenti.filter(function (r) { return r.data >= ot; }).sort(function (a, b) { return a.id - b.id; }).slice(rg[0], rg[1] + 1).map(function (r) { return pick(r, 'obekt,status'); });
      });
    },
    dokSt: function (ot, sts, rg) {
      return later(function () {
        if (D.dokNo) throw { code: '42P01', message: 'relation "public.dokumenti" does not exist' };
        return D.dokumenti.filter(function (r) { return r.data >= ot && sts.indexOf(r.status) >= 0; })
          .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : a.id - b.id; }).slice(rg[0], rg[1] + 1).map(function (r) { return pick(r, DOK_COLS + ',obekt,data'); });
      });
    },
    zakasneliZa: function (o, data) {
      return later(function () { var d = parseD(data); d.setDate(d.getDate() + 21); var lim = ymd(d); return D.dni.filter(function (x) { return x.obekt === o && x.data > data && x.data <= lim; }).map(function (x) { return pick(x, 'id,data,sabrano'); }); });
    },
    vremeSedm: function (ot) {
      return later(function () { return D.metriki.filter(function (r) { return /^(aktivno|izvan)/.test(r.vid || '') && r.kogda >= ot; }).slice(0, 2000).map(function (r) { return pick(r, 'vid,stoinost,kogda'); }); });
    },
    merStart: function () {
      return later(function () { return D.metriki.filter(function (r) { return /^aktivno/.test(r.vid || ''); }).sort(function (a, b) { return a.kogda < b.kogda ? -1 : 1; }).slice(0, 1).map(function (r) { return pick(r, 'kogda'); }); });
    },
    dvizh: function (o, data) {
      return later(function () {
        if (D.e6No) throw { code: '42P01', message: 'relation "public.intranet_dvizhenie" does not exist' };
        return D.intranet_dvizhenie.filter(function (r) { return r.obekt === o && r.data_sabitie === data; })
          .sort(function (a, b) { return a.okno_do < b.okno_do ? -1 : a.okno_do > b.okno_do ? 1 : a.id - b.id; }).slice(0, 200)
          .map(function (r) { return pick(r, 'id,tid,obekt,vid,staro,novo,opisanie,otgovornik,srok,status,data_sabitie,tochnost,okno_ot,okno_do'); });
      });
    },
    // като изгледа adresnik (§2.4): адресът на подателя + „Име <адрес>“ и „Име [mailto:адрес]“ от текста; името — от най-новия
    adresi: function () {
      return later(function () {
        if (D.e6No) throw { code: '42P01', message: 'relation "public.adresnik" does not exist' };
        var m = {};
        function put(a, ime, d) {
          a = String(a || '').toLowerCase(); if (!a) return;
          var x = m[a] || (m[a] = { adres: a, ime: null, broi: 0, posledno: null, _d: '' });
          x.broi++; if (!x.posledno || d > x.posledno) x.posledno = d;
          if (ime && d >= x._d) { x.ime = ime; x._d = d; }
        }
        D.saobshteniq.forEach(function (s) {
          if (s.vid !== 'mail') return;
          if (/^[^ @<>]+@[^ @<>]+[.][a-zA-Z]{2,}$/.test(s.avtor || '')) put(s.avtor, null, s.data);
          var re1 = /([A-Za-zА-Яа-я][A-Za-zА-Яа-я .'-]{2,60}) <([^ <>@]+@[^ <>@]+[.][a-zA-Z]{2,})>/g, re2 = /([A-Za-zА-Яа-я][A-Za-zА-Яа-я .'-]{2,60}) \[mailto:([^\] <>@]+@[^\] <>@]+[.][a-zA-Z]{2,})\]/g, x;
          while ((x = re1.exec(s.tekst || ''))) put(x[2], x[1].replace(/^[ "']+|[ "']+$/g, ''), s.data);
          while ((x = re2.exec(s.tekst || ''))) put(x[2], x[1].replace(/^[ "']+|[ "']+$/g, ''), s.data);
        });
        return Object.keys(m).map(function (k) { var x = m[k]; return { adres: x.adres, ime: x.ime, broi: x.broi, posledno: x.posledno }; })
          .sort(function (a, b) { return b.broi - a.broi; }).slice(0, 1000);
      });
    },
    tZap: function (ids) { return later(function () { return D.dni.filter(function (d) { return ids.indexOf(d.id) >= 0; }).slice(0, 10).map(function (d) { return pick(d, 'id,zapis_md'); }); }); }
  };
  function dSaobSort(a, b) { return a.vreme < b.vreme ? -1 : a.vreme > b.vreme ? 1 : a.id - b.id; }
  // като истинската база: външните ключове се проверяват (23503), klient_id е уникален (23505), часът от телефона се пази
  function demoFk(tbl, col, v, ref) {
    return { code: '23503', message: 'insert or update on table "' + tbl + '" violates foreign key constraint "' + tbl + '_' + col + '_fkey"', details: 'Key (' + col + ')=(' + v + ') is not present in table "' + ref + '".' };
  }
  function demoInsert(tbl, row) {
    var T = tbl === 'resheniq' ? D.resheniq : tbl === 'deistviq' ? D.deistviq : tbl === 'deistviq_bel' ? D.deistviq_bel : null;
    if (T && row.klient_id && T.some(function (x) { return x.klient_id === row.klient_id; }))
      throw { code: '23505', message: 'duplicate key value violates unique constraint "' + tbl + '_klient_id_key"', details: 'Key (klient_id)=(' + row.klient_id + ') already exists.' };
    // „без таблиците на Етап 6“ (преди 009): базата още не приема „➕ Включи в дневника“ → листът „Не се записаха“ [§2.2, §5.1]
    if (D.e6No && tbl === 'resheniq' && row.vid === 'dobavi') throw { code: '23514', message: 'new row for relation "resheniq" violates check constraint "resheniq_vid_check"' };
    if (row.den_id != null && !D.dni.some(function (x) { return x.id === row.den_id; })) throw demoFk(tbl, 'den_id', row.den_id, 'dni');
    if (row.tochka_id != null && !D.tochki.some(function (x) { return x.id === row.tochka_id; })) throw demoFk(tbl, 'tochka_id', row.tochka_id, 'tochki');
    if (tbl === 'deistviq_bel' && !D.deistviq.some(function (x) { return x.id === row.deistvie_id; })) throw demoFk(tbl, 'deistvie_id', row.deistvie_id, 'deistviq');
    var r = Object.assign({ id: ++D.seq }, row);
    if (tbl === 'resheniq') {
      r.kogda = row.kogda || nowIso(); r.obraboteno = null; r.rezultat = null; D.resheniq.push(r);
      if (r.vid === 'izkljuchi' || r.vid === 'vkljuchi') { demoTrigger(r); return r; }   // като тригера ailab_v_dnevnika — веднага
      if (r.vid === 'vrazka_ne') {   // 1а [§3.3]: като тригера resheniq_vrazka_ne — връзката се маха веднага, на всеки статус на деня
        var tv = D.tochki.filter(function (x) { return x.id === r.tochka_id && x.den_id === r.den_id; })[0];
        if (tv) tv.prodalzhenie = null;
        r.obraboteno = nowIso(); r.rezultat = tv ? 'връзката е махната' : 'точката я няма в текущата версия';
        return r;
      }
    }
    else if (tbl === 'deistviq') { r.status = 'zaqveno'; r.sazdadeno = row.sazdadeno || nowIso(); r.obnoveno = null; r.belejka = null; r.vanshen_id = null; r.vanshen_url = null; r.opit = null; D.deistviq.push(r); return r; }
    else if (tbl === 'deistviq_bel') { r.kogda = row.kogda || nowIso(); r.obraboteno = null; r.rezultat = null; D.deistviq_bel.push(r); return r; }
    else if (tbl === 'metriki') { r.kogda = row.kogda || nowIso(); D.metriki.push(r); return r; }
    else throw { message: 'непозната таблица', code: 'DEMO' };
    if (!D.lt) D.lt = setTimeout(function () { D.lt = 0; demoLaptop(); }, 6000);
    return r;
  }
  // Като тригера ailab_v_dnevnika (007 + 008 [К1]): само на чернова; по-късен (kogda, id) избор за същата точка печели
  function demoTrigger(r) {
    var d = dDen(r.den_id), t = D.tochki.filter(function (x) { return x.id === r.tochka_id; })[0];
    r.obraboteno = nowIso();
    if (!t) { r.rezultat = 'точката я няма в текущата версия'; return; }
    if (!d || d.status !== 'chernova') { r.rezultat = 'денят е одобрен — не е сменено'; return; }
    var nov = D.resheniq.some(function (x) { return x !== r && x.tochka_id === r.tochka_id && (x.vid === 'izkljuchi' || x.vid === 'vkljuchi') && (x.kogda > r.kogda || (x.kogda === r.kogda && x.id > r.id)); });
    if (nov) { r.rezultat = 'по-късен избор вече е приложен'; return; }
    t.v_dnevnika = r.vid === 'vkljuchi'; r.rezultat = r.vid === 'vkljuchi' ? 'в дневника' : 'не за дневника';
  }
  // Като ailab-rabotnik.ps1: одобрения и потвърждения се обработват; задачите — отделно (demoZadachi, от демо панела).
  function demoLaptop() {
    var t = nowIso();
    D.resheniq.forEach(function (r) {
      if (r.obraboteno || r.vid === 'dobavi') return;   // „➕“ — само цикълът (вечер / сутрин), не работникът
      var d = dDen(r.den_id);
      if (r.vid === 'odobri' && d) {
        if (r.versiq !== d.versiq) r.rezultat = 'остаряла версия';
        else if (d.status === 'vpisana') r.rezultat = 'вече вписан';
        else { d.status = 'vpisana'; d.vpisan_pat = demoPat(d.data, d.versiq); r.rezultat = 'вписан'; }
      } else if (r.vid === 'potvardi') {
        // 1а [§5.19а]: ✓ потвърждава само текста, който РП е видял (versiq ≥ obnovena_v)
        var tt = D.tochki.filter(function (x) { return x.id === r.tochka_id; })[0];
        if (tt && r.versiq != null && tt.obnovena_v != null && +r.versiq < +tt.obnovena_v) r.rezultat = 'потвърдено за v' + r.versiq + ' — текстът е обновен във v' + tt.obnovena_v;
        else { if (tt) tt.istina = 'provereno'; r.rezultat = tt ? 'потвърдено' : 'точката я няма в текущата версия'; }
      } else { r.rezultat = 'чака Claude'; return; }   // като ailab-rabotnik: поправките и разясненията остават необработени за Claude
      r.obraboteno = t;
    });
  }
  // Като ailab-zadachi.ps1 в режим ПРОБА (§9.3.2), в твърдия ред [К3]: отмени/готово → замени → преходи в AiLab → Интранет последен.
  // Нищо не отива в Интранета — „🧪 готова — така ще я впиша“ с всички полета.
  function demoZadachi() {
    var t = nowIso(), hm0 = hhmm(), n = { proba: 0, dop: 0, resh: 0, razr: 0, otm: 0, izp: 0, gr: 0, bel: 0 };
    var NV = ['zaqveno', 'dopalni', 'chaka_reshenie', 'chaka_razreshenie', 'greshka', 'chaka_otgovor'];   // Етап 6: и питането по мейл
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
      // Етап 6 [§3.6, §4.5]: питането по мейл не е „начинът не е избран“ — като ailab-pitaniq.ps1: zaqveno → ✉ чака отговор
      if (a.vid === 'iskane' && danniOf(a).kanal === 'mail') { a.status = 'chaka_otgovor'; note(a, 'питано по мейл ' + ddmm(now()) + ' ' + hm0); n.pit = (n.pit || 0) + 1; return; }
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
    // Стъпка 1а [§4.2, §6.11]: всички точки имат k → като ailab-kachi-den в k-режим (обновяване НА МЯСТО, същите идове)
    if (D.tochki.some(function (x) { return x.den_id === d.id; }) && D.tochki.every(function (x) { return x.den_id !== d.id || x.k != null; })) { demoNewVersionK(d); return; }
    d.versiq += 1; d.hesh = Math.random().toString(16).slice(2, 10); d.obnoven = nowIso();
    D.tochki.push({ id: ++D.seq, den_id: d.id, razdel: 6, grupa: 'promqna', k: 16, v_dnevnika: true, tekst: 'Доставчикът на арматура потвърди частична доставка — 6 т арматура Ø12 на 29.09, сутринта.', istina: 'saobshteno', vajnost: 2,
      izvori: [{ n: 19, tip: 'Мейл', kratko: 'доставчикът на арматура · потвърждение на частична доставка', vreme: hhmm(), kade: 'Поща/' + hhmm().replace(':', '') + '00_доставка_арматура.eml' }], red: 0 });
    // Етап 6: доставките са раздел 6 → редът отива преди „## 7.“, със свой ⟦k⟧
    d.zapis_md = String(d.zapis_md || '').replace('\n\n## 7. ', '\n- Доставчикът на арматура потвърди частична доставка: 6 т Ø12 на 29.09 [19]. ⟦16⟧\n\n## 7. ');
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
  // k-режим: същият ред по k (✓, ✎, →, 🚫 остават на точката — resheniq/deistviq НЕ се пипат); нов k (най-големият + 1);
  // сменен текст на k 7 (obnovena_v, predishen_tekst); махнат k 10 (връзките към него стават празни — ON DELETE SET NULL)
  function demoNewVersionK(d) {
    var ov = d.versiq, nv = ov + 1, pts = D.tochki.filter(function (x) { return x.den_id === d.id; });
    var kMax = pts.reduce(function (m, x) { return Math.max(m, +x.k || 0); }, 0), nk = kMax + 1, rMax = pts.reduce(function (m, x) { return Math.max(m, +x.red || 0); }, 0);
    d.versiq = nv; d.hesh = Math.random().toString(16).slice(2, 10); d.obnoven = nowIso();
    // 1) нова точка
    D.tochki.push({ id: ++D.seq, den_id: d.id, razdel: 6, grupa: 'promqna', k: nk, v_dnevnika: true, tekst: 'Доставчикът на арматура потвърди частична доставка — 6 т арматура Ø12 на 29.09, сутринта.', istina: 'saobshteno', vajnost: 2,
      izvori: [dMsgFix({ n: 19, tip: 'Мейл', kratko: 'доставчикът на арматура · потвърждение на частична доставка', vreme: hhmm(), kade: 'Поща/' + hhmm().replace(':', '') + '00.eml' }, d.data)], red: rMax + 1,
      vav_versiq: nv, obnovena_v: null, predishen_tekst: null, prodalzhenie: null });
    d.zapis_md = String(d.zapis_md || '').replace('\n\n## 7. ', '\n- Доставчикът на арматура потвърди частична доставка: 6 т Ø12 на 29.09 [19]. ⟦' + nk + '⟧\n\n## 7. ');
    // 2) сменен текст — k 7 (иначе първата карта): същият ид
    var ch = pts.filter(function (x) { return x.k === 7; })[0] || pts.filter(function (x) { return x.grupa !== 'fakt'; })[0], obn = [];
    if (ch) {
      ch.predishen_tekst = ch.tekst;
      ch.tekst = String(ch.tekst).replace(/\s*\(обновено:[^)]*\)\s*$/, '') + ' (обновено: инвеститорът писа пак в ' + hhmm() + ')';
      ch.obnovena_v = nv; ch.istina = 'saobshteno'; obn.push(ch.k);
    }
    // 3) махната точка — k 10 (фактът вече го няма), с моя отговор → предупреждението „на 1 махната точка — не“
    var rm = pts.filter(function (x) { return x.k === 10 && x !== ch; })[0], mah = [];
    if (rm) {
      var otg = D.resheniq.some(function (r) { return r.tochka_id === rm.id && /^(potvardi|popravka|komentar|osporva|izkljuchi|vkljuchi)$/.test(r.vid); }) || D.deistviq.some(function (a) { return a.tochka_id === rm.id; });
      mah.push({ k: rm.k, tekst: clip(rm.tekst, 120), otgovor: otg });
      D.tochki = D.tochki.filter(function (x) { return x !== rm; });
      D.resheniq.forEach(function (r) { if (r.tochka_id === rm.id) r.tochka_id = null; });
      D.deistviq.forEach(function (a) { if (a.tochka_id === rm.id) a.tochka_id = null; });
      d.zapis_md = String(d.zapis_md).split('\n').filter(function (l) { var ks = mdKs(l); return !(ks.length === 1 && ks[0] === rm.k); }).join('\n');
    }
    d.promeni = { v: nv, ot_v: ov, vreme: nowIso(), novi: [nk], obnoveni: obn, mahnati: mah };
    if (d.sabrano) {
      var vz = new Date(nowMs() - 2 * 60000).toISOString();
      d.sabrano = Object.assign({}, d.sabrano, { vzeto: vz, provereno: null, vid: 'obnovqvane', chas: '22:45', tragnal: new Date(nowMs() - 3 * 60000).toISOString() });
      if (d.obekt === 'ag' && d.data === '2026-09-24') D.a24vzeto = vz;   // демо панелът „Присъствия след/преди черновата“ — спрямо новата снимка
    }
    D.svezhest.forEach(function (s) { if (s.izvor === 'chernova') { s.posledno = nowIso(); s.belejka = 'v' + nv + ' · ' + hhmm() + ' · ' + (d.obekt === 'ag' ? 'Амур' : 'Скай') + ' +1/1 · махната 1'; } });
    toast('Лаптопът качи v' + nv + ' — телефонът ще я види до ' + Math.round(POLL_MS / 1000) + ' с');
  }
  // „Лаптопът качва нов ден“ → Амур 25.09: +1 ден за одобрение, +1 решение, „🆕“, хапче „↑ Нови промени“ (ако си скролнал).
  function demoNewDay() {
    if (D.dni.some(function (x) { return x.obekt === 'ag' && x.data === '2026-09-25'; })) { toast('Денят 25.09 вече е качен — „Започни демото отначало“ за нов опит.'); return; }
    var nd = dKratak('ag', '2026-09-25', 'chernova', 1, 51, 'Армировката на плоча +9,30 в сграда 2 започна от ос 1. На обекта — 51 души.', [
      [4, 'promqna', 'Сграда 2, плоча +9,30 — армировката започна от ос 1; до обяд стигна ос 3.', 'saobshteno', 2, [dChat(1, 'ТР на обекта · канал на обекта', '12:40')]],
      [6, 'promqna', 'Доставени 6 т арматура Ø12 — първата част от закъснялата доставка.', 'saobshteno', 1, [dMail(2, 'доставчикът на арматура · товарителница', '09:15')]],
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
  // tip — точно като истинските („Мейл“, „Тиймс чат“, „Тиймс канал“, „Протокол“, „Присъствия“) [ETAP6 §5.11]
  function dMail(n, k, v) { return dSrc(n, 'Мейл', k, v, 'Поща/' + v.replace(':', '') + '00.eml'); }
  function dChat(n, k, v) { return dSrc(n, /·\s*канал/.test(k) ? 'Тиймс канал' : 'Тиймс чат', k, v, 'Оригинали/' + v.replace(':', '') + '00.json'); }
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
      [5, 'ВиК — изпитване на вертикалните щрангове в сграда {b}, без течове.'],
      [4, 'Ел. скари на етаж {e}, сграда {b} — монтирани.']
    ];
    var SK_P = [
      [4, 'Окачена фасада — монтирани панели до ниво {e}.'],
      [4, 'Кулокран 2 — добавена секция, кранът работи на новата височина.'],
      [4, 'Шпакловка на етаж {e} — завършени {p}%.'],
      [6, 'Доставени стъклопакети за ниво {e}.'],
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
      [5, 'promqna', 'Взети 6 пробни кубчета — за 7 и за 28 дни.', 'provereno', 1, [agCh(2, '12:45')]]]);
    dKratak('ag', '2026-09-18', 'vpisana', 1, 47, 'Доставени 18 т арматура (частична доставка). Надзорът прие армировката на стълбището в сграда 1.', [
      [6, 'promqna', 'Доставени 18 т арматура — частична доставка по поръчката за +9,30.', 'provereno', 2, [mail(1, 'доставчикът на арматура · 2 товарителници', '10:15')]],
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
      [6, 'reshenie', 'Доставчикът на арматура обещава остатъка (≈14 т) за 25.09 — да се следи.', 'provereno', 2, [mail(2, 'доставчикът на арматура · потвърждение на срок', '13:20')]],
      // Стъпка 1а [§6.11]: k 5 — към нея сочи „↳ продължение на: 22.09 …“ от Амур 24.09
      [3, 'fakt', 'Общо 51 души на обекта по Присъствия.', 'provereno', 1, [src(3, 'Присъствия', 'въведено за 8 бригади', '08:15', 'Присъствия/2026-09-22.json')]],
      [5, 'promqna', 'Армировката на стълбището в сграда 1 — подготвена за приемане.', 'provereno', 1, [agCh(4, '15:10')]],
      [6, 'promqna', 'Поръчана армировка Ø12/Ø16 (≈14 т) за плоча +9,30 — снабдяването потвърди поръчката.', 'provereno', 2, [chat(5, 'Demo Snab · чат на снабдяването', '09:12')]]]);
    var d23 = dKratak('ag', '2026-09-23', 'odobrena', 2, 50, 'Кофражът на +9,30 стигна ос 5. Инвеститорът поиска график за фасадата на сграда 4.', [
      [4, 'promqna', 'Кофраж на плоча +9,30, сграда 2 — до ос 5.', 'saobshteno', 2, [agCh(1, '16:50')]],
      [7, 'reshenie', 'Инвеститорът иска график за фасадата на сграда 4 до края на седмицата.', 'saobshteno', 2, [mail(2, 'Инвеститор · писмо', '11:02')]],
      [3, 'neprovereno', 'Присъствия: 50 души, чатът — 49. Разлика от 1 човек при общите работници.', 'osporeno', 1, [src(3, 'Присъствия', 'въведено за 8 бригади', '08:20', 'Присъствия/2026-09-23.json'), chat(4, 'ТР на обекта · сутрешен отчет', '07:35')]]]);
    D.resheniq.push({ id: ++D.seq, den_id: d23.id, tochka_id: null, vid: 'odobri', tekst: null, versiq: 2, hesh: d23.hesh, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-23T19:12:00+03:00'), obraboteno: null, rezultat: null });

    // 24.09 — основният пример: 50 души; кофраж +9,30 сграда 2; доставчикът на арматура закъснява; чат 10 / Присъствия 8 кофражисти.
    // Етап 6: разделите — по 12-те заглавия на указанията; tip — като истинските; източник „Интранет“ с tid (#7001 — на точката
    // от Тиймс + мейл + Интранет, #7027 — обобщеният ред за новите задачи, #7010 — смяна на статус); точка 14 е добавена с
    // „➕ Включи в дневника“ (v3); „фактура № 7001“ в текста — без пил (голо число без „задача/Интранет“) [§5.11, §5.3 б]
    var s1 = chat(1, 'ТР на обекта · канал на обекта: „кофражът е до ос 7, на плочата сме 10 кофражисти“', '07:18');
    // [2] — съобщение от Тиймс със снимки (като истинските: kade = Оригинали/…, ид от dMsgFix) → в листа „Източници“ под него има плочки
    var s2 = src(2, 'Тиймс канал', 'ТР на обекта · канал на обекта: снимки от плоча +9,30', '16:40', 'Оригинали/164000.json');
    var s3 = src(3, 'Присъствия', 'бригада кофражисти — 8 души, въведено в 08:10', '08:10', 'Присъствия/2026-09-24.json');
    var s4 = mail(4, 'доставчикът на арматура · писмо за нов срок на арматурата', '11:04');
    var s5 = chat(5, 'ПТО · чат на ПТО: „арматурата няма да дойде преди 01.10“', '11:30');
    var s6 = mail(6, 'бетонов възел · 2 товарителници, 24 м³ C25/30', '10:52');
    var s7 = chat(7, 'бригадир фасада · чат „Амур Гардънс“', '15:02');
    // Стъпка 1а [§4.5]: времето — Open-Meteo, модел за града (мястото идва само от данните; в демото — „Демо град“)
    var s8 = { n: 8, tip: 'Метео', kratko: 'Open-Meteo · Демо град (център на града)', vreme: '17:01', kade: 'Метео.md' };
    var s21 = chat(21, 'ТР на обекта · канал на обекта: „площадката е суха, кранът работи“', '07:05');
    var s9 = chat(9, 'механизатор · чат „Амур Гардънс“: „кранът стои, сменяме маркуч“', '13:05');
    var s10 = mail(10, 'подизпълнител кофраж · количествена сметка за поредния акт', '09:41');
    var s11 = mail(11, 'Инвеститор · въпрос за датата на бетона', '16:12');
    var s12 = src(12, 'Протокол', 'лаборатория · протокол № 118, 7-дневни кубчета', '14:20', 'Файлове/Протокол-118-демо.pdf');
    var s13 = chat(13, 'ТР на обекта · канал на обекта: „инвеститорът пак пита за бетона“', '16:30');
    var s14 = { n: 14, tip: 'Интранет', kratko: 'Интранет · #7001', vreme: '14:05', kade: 'Интранет.md', tid: 7001 };
    var s15 = { n: 15, tip: 'Интранет', kratko: 'Интранет · #7027', vreme: '10:15', kade: 'Интранет.md', tid: 7027 };
    var s16 = { n: 16, tip: 'Интранет', kratko: 'Интранет · #7010', vreme: '14:05', kade: 'Интранет.md', tid: 7010 };
    var s17 = chat(17, 'бригадир кофраж · канал на обекта: „почистихме около стълбището на сграда 1“', '08:04');
    var s18 = chat(18, 'Workflows · канал на обекта: напомняне за доставката на арматура', '11:35');
    dAdd('ag', '2026-09-24', 'chernova', 3, 50,
      'Нормален работен ден — 50 души. Кофражът на плоча +9,30 в сграда 2 е довършен до ос 7, армировката започва утре. Доставчикът на арматура отлага доставката с 5–10 дни.', [
        [4, 'promqna', 'Сграда 2, плоча +9,30 — кофражът е довършен до ос 7. Армировката започва утре от 07:00.', 'saobshteno', 2, [s1, s2]],
        [6, 'promqna', 'Доставени 24 м³ бетон C25/30 за стълбищната клетка на сграда 1 — 2 миксера, 09:10–10:40.', 'provereno', 1, [s6]],
        [4, 'promqna', 'Сграда 3 — скелето по северната фасада е демонтирано; фасадната бригада минава на сграда 4.', 'saobshteno', 1, [s7]],
        [5, 'promqna', '7-дневните кубчета от плоча +6,20 (бетон от 17.09) дават 31,2 MPa — в норма за C25/30.', 'provereno', 1, [s12]],
        [8, 'reshenie', 'Доставчикът на арматура отлага доставката на арматура Ø12/Ø16 (≈14 т) с 5–10 дни. Чакаме или поръчваме частично от друг доставчик? Бетонът на +9,30 по график е на 02.10.', 'saobshteno', 3, [s5, s4, s18]],
        [7, 'reshenie', 'Подизпълнителят по кофража иска потвърждение на количествата за поредния акт до петък, 25.09 (към фактура № 7001).', 'saobshteno', 2, [s10]],
        [7, 'reshenie', 'Инвеститорът пита за нова дата на бетона на +9,30 заради закъснението на арматурата — чака отговор от теб. Иска и писмено потвърждение, че фасадата на сграда 4 остава по график, и кога точно ще е огледът на армировката с надзора, за да планира своя технически контрол на обекта.', 'saobshteno', 2, [s11, s13, s14]],
        [3, 'neprovereno', 'Разлика в броя кофражисти: чатът казва 10, Присъствия — 8. В дневника засега са 8 (по Присъствия).', 'osporeno', 2, [s1, s3]],
        [8, 'neprovereno', 'Кулокран 1 е стоял 13:00–15:00 (смяна на хидравличен маркуч) — само от едно съобщение, механикът не е потвърдил.', 'saobshteno', 2, [s9]],
        [11, 'neprovereno', 'Часът за огледа на армировката с надзора не е потвърден — няма писмо от надзора.', 'saobshteno', 1, []],
        [2, 'promqna', 'Времето (Open-Meteo, Демо град): слънчево, 14…29 °C; вятър до 4 м/с — без ограничения за крана; площадката е суха.', 'provereno', 1, [s8, s21]],
        [3, 'fakt', 'Общо 50 души на обекта по Присъствия, 8 бригади.', 'provereno', 1, [s3]],
        [7, 'fakt', 'Интранет: нови задачи 1 (#7027) — „Предай екзекутивите на ВиК за сграда 1“.', 'provereno', 1, [s15]],
        [4, 'promqna', 'Площадката около стълбището на сграда 1 е почистена — там отиват палетите с клинкер.', 'saobshteno', 1, [s17]],
        [7, 'fakt', 'Интранет #7010 „Прегледай количествената сметка за поредния акт по кофража“: статус Текуща → Стартирала.', 'provereno', 1, [s16]]
      ], dMd({
        // Етап 5 (§6.5): маркерите ⟦k⟧ (k = редът на точката по-горе); фактите нямат карта — само тук; ред с ⟦8,12⟧;
        // етикетите „**Кран и помпа:**“ и „**Пробни кубчета:**“ носят номерата под тях [К8]; Етап 6: етикет със свой ⟦k⟧,
        // после празен ред и таблица — остава (П5); разделите — 12-те на указанията [§5.1]
        1: 'Нормален работен ден, **50 души** на обекта (по Присъствия). Кофражът на плоча +9,30 в сграда 2 е довършен до ос 7; армировката започва утре от 07:00 [1][2]. ⟦12,1⟧\n**Риск:** доставчикът на арматура отлага арматурата Ø12/Ø16 с 5–10 дни [4][5] — застрашава бетона на +9,30 по график (02.10). ⟦5⟧',
        2: '- Времето (Open-Meteo, Демо град): слънчево, 14…29 °C; вятър до 4 м/с — без ограничения за крана; площадката е суха [8][21]. ⟦11⟧',
        3: '- Хора на обекта по Присъствия: 50 (нето); въведени 55; не влизат в нето: Ръководство 5 ⟦12⟧\n\nХора по бригади: ⟦8,12⟧\n\n| Бригада | Къде | Хора |\n|---|---|---|\n| Кофражисти | плоча +9,30, сграда 2 | 8 (чат: 10) [1][3] ⟦8,12⟧ |\n| Арматуристи | стълбище, сграда 1 | 6 ⟦12⟧ |\n| Зидари | сграда 3 | 8 ⟦12⟧ |\n| Фасада | сграда 3 → 4 | 9 [7] ⟦12⟧ |\n| Бетонджии | стълбище, сграда 1 | 4 [6] ⟦12⟧ |\n| ВиК | вертикални щрангове | 4 ⟦12⟧ |\n| Електро | ел. инсталация, сграда 1 | 5 ⟦12⟧ |\n| Общи работници | почистване, пренасяне | 6 ⟦12⟧ |\n| **Общо** | | **50** [3] ⟦8,12⟧ |',
        4: '- Сграда 2, плоча +9,30 — кофражът е довършен до ос 7 [1][2]. ⟦1⟧\n- Сграда 3 — демонтирано скелето по северната фасада; бригадата минава на сграда 4 [7]. ⟦3⟧\n- Сграда 1 — почистена площадката около стълбището за палетите с клинкер [17]. ⟦14⟧\n\n**Кран и помпа:** ⟦9,2⟧\n- Кулокран 1 — стоял 13:00–15:00, смяна на хидравличен маркуч (само от едно съобщение) [9]. ⟦9⟧\n- Помпа за бетон 09:00–11:00. ⟦2⟧',
        5: '**Пробни кубчета:** ⟦4⟧\n- 7-дневните кубчета от плоча +6,20 (бетон от 17.09) — 31,2 MPa при клас C25/30 [12]. ⟦4⟧\n- 28-дневните — на 15.10. ⟦4⟧',
        6: '- Бетонов възел — 24 м³ C25/30, 2 миксера, 09:10–10:40 [6]. ⟦2⟧\n- Доставчикът на арматура — доставката на арматура Ø12/Ø16 (≈14 т) се отлага с 5–10 дни [4][5]. ⟦5⟧',
        7: '- **Чака РП:** доставчикът на арматура — чакаме или поръчваме частично от друг доставчик? [4][5] ⟦5⟧\n- **Чака РП:** количествата за поредния акт — до петък, 25.09 [10]. ⟦6⟧\n- Инвеститорът пита за нова дата на бетона на +9,30 [11][13]. ⟦7⟧\n- Интранет #7001 „Изпрати на инвеститора графика за фасадата на сграда 4“: срок 25.09.2026 → 30.09.2026 [14]. ⟦7⟧\n- Интранет #7010 „Прегледай количествената сметка за поредния акт по кофража“: статус Текуща → Стартирала [16]. ⟦15⟧\n- Интранет: нови задачи 1 (#7027) [15]. ⟦13⟧',
        8: '- Закъснението на арматурата може да измести бетона на +9,30 от 02.10 към 07–09.10. ⟦5⟧\n- Престой на крана 2 ч — кофражистите са пренасяли ръчно [9]. ⟦9⟧',
        9: '- Инвеститорът иска писмено потвърждение, че фасадата на сграда 4 остава по график [11]. ⟦7⟧',
        10: '- Армировка на плоча +9,30 в сграда 2 от 07:00; оглед с надзора — след ос 4. ⟦1⟧',
        11: '- Броят кофражисти: чат 10 / Присъствия 8 [1][3]. ⟦8⟧\n- Престоят на крана — само от едно съобщение [9]. ⟦9⟧\n- Огледът на армировката с надзора — часът още не е потвърден. ⟦10⟧',
        12: 'Тиймс ✓ 17:18 · Поща ✓ 17:05 · Присъствия ✓ 16:40 · Сървър ✓ 17:00 · Интранет ✓ 16:02 (6 събития, Интранет.md).\nСъобщения: 52 · мейли: 12 · снимки: 30.'
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
    demoE5(k23);
    demoE6(dDayOf('ag', '2026-09-24'), dDayOf('soft', '2026-09-24'));
    demoE1a(dDayOf('ag', '2026-09-24'), d23, dDayOf('ag', '2026-09-22'));
  }
  // ---- Стъпка 1а (§6.11): „събрано до“, версиите по k, „↳“, закъснелите, времето, приложенията, мерилото — всичко измислено ----
  // Амур 24.09 (v3, обновяване „от 22:45“ — демото не спазва вечерния час), Амур 23.09 (одобрен с „добави утре“), Амур 22.09 (k 5 за „↳“).
  // Скай 24.09 остава БЕЗ sabrano (старият вид), Скай 23.09 — без промяна.
  function demoE1a(a24, d23, a22) {
    var T = dT;
    D.disk = 33; D.cikal = ''; D.sledNo = false; D.dokNo = false; D.izvanForce = false; D.prisSled = 0; D.dokumenti = [];
    D.svezhest.push(
      { izvor: 'prilojeniq', posledno: T('2026-09-24T16:02:00+03:00'), ok: true, broi: 6, belejka: 'чака отворен Outlook · последно свалено 16:02' },
      { izvor: 'disk', posledno: T('2026-09-24T17:30:00+03:00'), ok: true, broi: 33, belejka: 'C: 33 GB свободни' },
      { izvor: 'chernova', posledno: T('2026-09-24T17:20:00+03:00'), ok: true, broi: 0, belejka: 'v3 · 17:20 · Амур +2/2 · Скай без промяна' });
    var vz = new Date(nowMs() - 40 * 60000).toISOString();   // часовникът − 40 мин → „Събрано до 17:02“
    D.a24vzeto = vz;
    function izv(t, pz) {
      return { teams: { posledno: t, ok: true }, poshta: { posledno: t, ok: true }, intranet: { posledno: T('2026-09-24T16:02:00+03:00'), ok: true }, prisystvia: Object.assign({ posledno: t, ok: true }, pz),
        prilojeniq: { posledno: T('2026-09-24T16:02:00+03:00'), ok: true }, meteo: { ok: true, mqsto: 'Демо град' }, laptop: { posledno: t } };
    }
    if (d23) {
      d23.sabrano = { v: 1, obekt: 'ag', data: d23.data, vzeto: T('2026-09-23T19:03:00+03:00'), provereno: null, vid: 'palna', chas: '19:00', tragnal: T('2026-09-23T19:01:00+03:00'),
        izvori: izv(T('2026-09-23T19:02:00+03:00'), { ima_zapis: true, neto: 49, vavedeno: T('2026-09-23T08:20:00+03:00') }), saob: { teams: 18, mail: 6 } };
      D.resheniq.forEach(function (r) { if (r.den_id === d23.id && r.vid === 'odobri') r.tekst = 'добави утре'; });
    }
    if (!a24) return;
    a24.sabrano = { v: 1, obekt: 'ag', data: a24.data, vzeto: vz, provereno: null, vid: 'obnovqvane', chas: '22:45', tragnal: new Date(Date.parse(vz) - 60000).toISOString(),
      izvori: izv(vz, { ima_zapis: false, neto: null, vavedeno: null }), saob: { teams: 41, mail: 10 }, zakasneli: { '2026-09-23': { do: vz, n: 2, pris_neto: null } } };
    // k 30 — махната във v3 (точката я няма; отговорът ми по нея остава в базата с празна точка)
    a24.promeni = { v: 3, ot_v: 2, vreme: a24.obnoven, novi: [31, 32], obnoveni: [3, 7], mahnati: [{ k: 30, tekst: 'Демо: махната точка', otgovor: true }] };
    var P = function (k) { return D.tochki.filter(function (t) { return t.den_id === a24.id && t.k === k; })[0] || null; };
    D.tochki.forEach(function (t) { if (t.den_id === a24.id) { t.vav_versiq = 1; t.obnovena_v = null; t.predishen_tekst = null; t.prodalzhenie = null; } });
    var t1 = P(1), t3 = P(3), t5 = P(5), t7 = P(7), t10 = P(10);
    if (t3) {
      t3.predishen_tekst = t3.tekst; t3.obnovena_v = 3;
      t3.tekst = 'Сграда 3 — скелето по северната и западната фасада е демонтирано; фасадната бригада минава на сграда 4 от утре сутринта.';
      a24.zapis_md = String(a24.zapis_md).replace('демонтирано скелето по северната фасада; бригадата минава на сграда 4', 'демонтирано скелето по северната и западната фасада; бригадата минава на сграда 4 от утре');
    }
    if (t7) {
      t7.predishen_tekst = t7.tekst; t7.obnovena_v = 3;
      t7.tekst = t7.tekst + ' Вечерта писа пак — иска отговор до утре на обяд.';
      t7.prodalzhenie = { tid: 7001, kratko: '#7001 „Изпрати на инвеститора графика за фасадата на сграда 4“ — срок 30.09' };
    }
    var t22 = a22 ? D.tochki.filter(function (t) { return t.den_id === a22.id && t.k === 5; })[0] : null;
    if (t5 && a22) t5.prodalzhenie = { data: '2026-09-22', k: 5, kratko: 'Демо: поръчка армировка (Тиймс чат · Demo Snab · 09:12)', den_id: a22.id, tochka_id: t22 ? t22.id : null };
    // отговорите: ✓ на k 3 е за v2 (→ „✓ беше за v2 — още ли е вярно?“); ✓ на k 7 — за v3; ✎ на k 1 — ненанесена; разяснение на k 10 (обработено)
    function RS(o) {
      D.resheniq.push(Object.assign({ id: ++D.seq, den_id: a24.id, tochka_id: null, vid: 'potvardi', tekst: null, versiq: 3, hesh: a24.hesh, ustroistvo: 'iPhone · иконка',
        kogda: T('2026-09-24T17:25:00+03:00'), obraboteno: T('2026-09-24T17:27:00+03:00'), rezultat: 'потвърдено' }, o));
    }
    if (t3) RS({ tochka_id: t3.id, versiq: 2, kogda: T('2026-09-24T16:50:00+03:00'), obraboteno: T('2026-09-24T16:52:00+03:00') });
    if (t7) RS({ tochka_id: t7.id, tekst: 'отговорено', kogda: T('2026-09-24T17:30:00+03:00'), obraboteno: T('2026-09-24T17:31:00+03:00') });
    if (t1) RS({ tochka_id: t1.id, vid: 'popravka', tekst: 'Кофражът е до ос 6 — ос 7 остава за утре сутринта.', kogda: T('2026-09-24T17:35:00+03:00'), obraboteno: null, rezultat: null });
    if (t10) RS({ tochka_id: t10.id, vid: 'komentar', tekst: 'Обади се на надзора утре сутрин — огледът е след ос 4.', kogda: T('2026-09-24T17:33:00+03:00'), obraboteno: T('2026-09-24T17:36:00+03:00'), rezultat: 'взето предвид' });
    RS({ versiq: 2, kogda: T('2026-09-24T16:45:00+03:00'), obraboteno: T('2026-09-24T17:20:00+03:00'), rezultat: 'точката я няма в текущата версия' });   // за k 30
    // нови във v3: „Закъснели за 23.09“ (мейл от 23.09, 21:40 — след одобрението) и „Поправка към записа за 23.09“
    var red = D.tochki.filter(function (t) { return t.den_id === a24.id; }).reduce(function (m, t) { return Math.max(m, t.red || 0); }, 0);
    var s20 = { n: 20, tip: 'Мейл', kratko: 'надзорът · потвърждение на огледа', vreme: '21:40', kade: 'Оригинали/2026-09-23_184000_mail.txt', den: '2026-09-23' };
    var c23 = d23 ? (D.tochki.filter(function (t) { return t.den_id === d23.id && t.k === 3; })[0] || { izvori: [] }).izvori.filter(function (s) { return /^Тиймс/.test(s.tip || ''); })[0] : null;
    var s22 = c23 ? Object.assign({}, c23, { n: 22, den: '2026-09-23' }) : null;
    D.tochki.push({ id: ++D.tid, den_id: a24.id, razdel: 7, grupa: 'promqna', k: 31, v_dnevnika: true, istina: 'saobshteno', vajnost: 2, red: red + 1, izvori: [s20],
      tekst: 'Закъснели за 23.09: надзорът потвърди огледа на армировката на +9,30 за понеделник, 10:00 (мейл от 23.09, 21:40).', vav_versiq: 3, obnovena_v: null, predishen_tekst: null, prodalzhenie: null });
    D.tochki.push({ id: ++D.tid, den_id: a24.id, razdel: 3, grupa: 'promqna', k: 32, v_dnevnika: true, istina: 'saobshteno', vajnost: 1, red: red + 2, izvori: s22 ? [s22] : [],
      tekst: 'Поправка към записа за 23.09: общите работници са били 7, не 6 — разликата от 1 човек е изяснена (въведен късно в Присъствия).', vav_versiq: 3, obnovena_v: null, predishen_tekst: null, prodalzhenie: null });
    a24.zapis_md = String(a24.zapis_md)
      .replace('\n\n## 4. ', '\n- Поправка към записа за 23.09: общите работници са били 7, не 6' + (s22 ? ' [22]' : '') + '. ⟦32⟧\n\n## 4. ')
      .replace('\n\n## 8. ', '\n- Закъснели за 23.09: надзорът потвърди огледа на армировката на +9,30 за понеделник, 10:00 [20]. ⟦31⟧\n\n## 8. ')
      .replace('Съобщения: 52 · мейли: 12 · снимки: 30.', 'Съобщения: 52 · мейли: 12 · снимки: 30.\n- Метео: Open-Meteo, Демо град (модел за града)\n- Закъснели за 23.09: 2 (дошли след одобрението)\n- Обновено в 17:20: +2 нови · 2 обновени');
    if (d23) D.saobshteniq.push({ id: ++D.seq, den_id: d23.id, obekt: 'ag', data: d23.data, kluch: '2026-09-23_184000_mail.txt', vid: 'mail', msg_id: null, vreme: T('2026-09-23T21:40:00+03:00'),
      sazdadeno: T('2026-09-23T23:05:00+03:00'), avtor: 'nadzor@primer.test', izvor_vid: 'mail', izvor: null, tema: 'Оглед на армировката +9,30', otgovor: null, do_kopie: 'Копие: demo.tehnik@primer.test',
      tekst: 'Здравейте,\n\nПотвърждаваме огледа на армировката на плоча +9,30 в сграда 2 — понеделник, 10:00.\n\nПоздрави,\nнадзорът', link: null, snimki_broi: 0, failove: [], original_url: 'demo:', belejka: null });
    // съобщенията: кога са дошли в базата (sazdadeno) — в демото = часа на съобщението
    D.saobshteniq.forEach(function (r) { if (!r.sazdadeno) r.sazdadeno = r.vreme; });
    // регистърът на приложенията: Амур 24.09 — 7 (5 прочетени, 1 само по име, 1 „не може“ → информация, не липса); от 01.09 — ~40
    function DK(o, data, ime, st, x) {
      return Object.assign({ id: ++D.seq, obekt: o, data: data, kade: 'Файлове/' + ime, ime: ime, razshirenie: ((/\.[^.]+$/.exec(ime) || [''])[0]).toLowerCase(), status: st, prichina: null, kratko: null,
        vajen: false, podatel: null, tema: null, vreme: T(data + 'T10:00:00+03:00'), url: 'demo:' }, x || {});
    }
    D.dokumenti.push(
      DK('ag', a24.data, 'Протокол-118-демо.pdf', 'prochet', { kratko: 'Протокол № 118 — 7-дневни кубчета от плоча +6,20: 31,2 MPa (C25/30)', vajen: true, podatel: 'laboratoria@primer.test', tema: 'Протокол № 118' }),
      DK('ag', a24.data, 'Товарителници-демо.pdf', 'prochet', { kratko: 'Две товарителници — 24 м³ C25/30, 09:10 и 10:05', podatel: 'beton@primer.test', tema: 'Товарителници 24.09' }),
      DK('ag', a24.data, 'Протокол-демо.xlsx', 'prochet', { kratko: 'Количествена сметка за поредния акт по кофража', vajen: true, podatel: 'kofrazh@primer.test', tema: 'Количествена сметка — пореден акт' }),
      DK('ag', a24.data, 'Демо фактура 101.pdf', 'prochet', { kratko: 'Демо фактура 101 — кофраж, поредният акт', vajen: true, podatel: 'kofrazh@primer.test', tema: 'Фактура към акта' }),
      DK('ag', a24.data, 'Демо писмо надзор.docx', 'prochet', { kratko: 'Писмо на надзора — огледът на армировката е след ос 4', podatel: 'nadzor@primer.test', tema: 'Огледът на армировката' }),
      DK('ag', a24.data, 'Демо план +9,30.dwg', 'samo_ime', { prichina: 'чертеж', podatel: 'pto@primer.test', tema: 'План +9,30' }),
      DK('ag', a24.data, 'Демо сканиран акт.pdf', 'ne_moje', { prichina: 'сканиран — нечетим и като картинка', podatel: 'investitor@primer.test', tema: 'Акт — сканиран', url: null }));
    var IM = [['Демо фактура 1{n}.pdf', 'prochet', null, 'Демо фактура 1{n} — материали'], ['Демо оферта {n}.pdf', 'prochet', null, 'Демо оферта {n} — скеле'], ['Демо снимка {n}.jpg', 'samo_ime', 'снимка'],
      ['Демо график {n}.xlsx', 'prochet', null, 'Демо график — фасада, седмица {n}'], ['Демо протокол {n}.pdf', 'prochet', null, 'Демо протокол {n} — приемане на армировка'], ['Демо договор {n}.pdf', 'ne_moje', 'защитен с парола'],
      ['Демо писмо {n}.msg', 'samo_ime', 'писмо в писмото — виж основния мейл'], ['Демо сметка {n}.xlsx', 'prochet', null, 'Демо количествена сметка {n}'], ['Демо акт {n}.pdf', 'ne_moje', 'сканиран — нечетим и като картинка'],
      ['Демо справка {n}.pdf', 'otlojen', 'таван 12 на ден — следващият пуск'], ['Демо писмо {n}.pdf', 'prochet', null, 'Демо писмо {n} — график на доставките'], ['Демо архив {n}.7z', 'samo_ime', 'архив — без разархивиране'],
      ['Демо фактура 2{n}.pdf', 'prochet', null, 'Демо фактура 2{n} — услуги'], ['Демо протокол {n}b.pdf', 'ne_moje', 'повреден'], ['Демо писмо {n}.docx', 'nov', null], ['Демо оферта {n}b.pdf', 'prochet', null, 'Демо оферта {n} — кофраж']];
    for (var i = 0, dt = parseD('2026-09-01'); dt <= parseD('2026-09-23'); dt.setDate(dt.getDate() + 1)) {
      if (dt.getDay() === 0 || dt.getDay() === 6) continue;
      [0, 1].forEach(function (j) {
        var x = IM[(i + j * 5) % IM.length], n = 10 + i * 2 + j, ime = x[0].replace('{n}', n);
        if (j && i % 2) return;   // ~1,5 на ден
        D.dokumenti.push(DK(i % 2 ? 'soft' : 'ag', ymd(dt), ime, x[1], { prichina: x[2] || null, kratko: x[3] ? x[3].replace('{n}', n) : null, vajen: /фактура|договор/i.test(ime), podatel: 'office@primer.test', tema: 'Документи ' + ddmm(dt) }));
      });
      i++;
    }
    // мерилото: седмицата е започнала на 21.09 (първият ред aktivno_*) — минути по екран и ръчните „извън AiLab“ за 2 вечери
    [['2026-09-21', 900, 180, 60], ['2026-09-22', 700, 240, 0], ['2026-09-23', 1100, 120, 90]].forEach(function (x) {
      var kg = T(x[0] + 'T23:20:00+03:00');
      D.metriki.push({ id: ++D.seq, vid: 'aktivno_pregled_sek', stoinost: x[1], den_id: null, kogda: kg }, { id: ++D.seq, vid: 'aktivno_tablo_sek', stoinost: x[2], den_id: null, kogda: kg });
      if (x[3]) D.metriki.push({ id: ++D.seq, vid: 'aktivno_zadachi_sek', stoinost: x[3], den_id: null, kogda: kg });
    });
    [['2026-09-22', 25, 40, 15], ['2026-09-23', 20, 35, null]].forEach(function (x) {
      var kg = T(x[0] + 'T12:00:00+03:00');
      [['intranet', x[1]], ['poshta', x[2]], ['dokladi', x[3]]].forEach(function (z) { if (z[1] != null) D.metriki.push({ id: ++D.seq, vid: 'izvan_' + z[0] + '_min', stoinost: z[1], den_id: null, kogda: kg }); });
    });
  }
  // ---- Етап 5 (§6.5): Присъствия, Интранетът, „📘/🚫“ — всичко измислено ----
  function demoE5(k23) {
    var T = dT;
    D.prisNo = false; D.prisLong = false;
    D.prisystvie = demoPris(false);
    // вписан ден с изключена точка (вписан без нея): Амур 22.09, точка k 2
    var v22 = dDayOf('ag', '2026-09-22'), t22 = v22 ? D.tochki.filter(function (t) { return t.den_id === v22.id && t.k === 2; })[0] : null;
    if (t22) {
      t22.v_dnevnika = false;
      D.resheniq.push({ id: ++D.seq, den_id: v22.id, tochka_id: t22.id, vid: 'izkljuchi', tekst: null, versiq: v22.versiq, hesh: v22.hesh, ustroistvo: 'iPhone · иконка',
        kogda: T('2026-09-22T19:40:00+03:00'), obraboteno: T('2026-09-22T19:40:00+03:00'), rezultat: 'не за дневника' });
    }
    // стара чернова без k (качена преди Етап 5): Скай 23.09 — без бутон 📘/🚫, редовете в „Пълен запис“ не са докосваеми [§6.1 т.5]
    if (k23) {
      D.tochki.forEach(function (t) { if (t.den_id === k23.id) { t.k = null; t.v_dnevnika = true; } });
      k23.zapis_md = String(k23.zapis_md || '').replace(MARK_RE, '');
    }
    D.intranet_zadachi = demoIntranet();
  }
  // ---- Етап 6 (§5.11): съобщенията на деня (и неизползваните), голям ден, движението в Интранета, „➕“, „✉ Питай“, свежестта ----
  // Всичко измислено: адресите …@primer.test, имената „Demo …“, ролите вместо имена.
  var LONG6 = 'по-дълго съобщение за пробата на „Покажи целия ›“: кофражът на ниво 9 е затворен до ос 6, остатъкът — утре сутринта; ' +
    'панелите на фасадата за ниво 8 са монтирани, за ниво 9 чакаме доставката; кранът е свободен след 14:00, затова довършителните ' +
    'бригади качват материалите за етаж 6 преди обяд; помпите в сутерена работят и водата спада — довършването там може да продължи ' +
    'от понеделник, ако нивото остане под пода; скелето на южната страна се мести утре — моля, оставете свободен подхода откъм портала.';
  function dMsg(d, o) {   // d — денят (или {obekt, data} за днешните, още без чернова — den_id празно, F12 §2.7)
    var r = Object.assign({ id: ++D.seq, den_id: d.id != null ? d.id : null, obekt: d.obekt, data: d.data, kluch: null, vid: 'teams', msg_id: null, vreme: null, avtor: 'ТР на обекта',
      izvor_vid: 'kanal', izvor: 'канал на обекта', tema: null, otgovor: null, do_kopie: null, tekst: '', link: 'demo:', snimki_broi: 0, failove: [], original_url: null, belejka: null }, o);
    var ms = Date.parse(r.data + 'T' + r.hm + ':00+03:00') + (r.sek || 0) * 1000 + (r.id % 997), u = new Date(ms);
    delete r.hm; delete r.sek;
    r.vreme = u.toISOString();
    if (r.vid === 'mail') { r.kluch = r.data + '_' + pad(u.getUTCHours()) + pad(u.getUTCMinutes()) + pad(u.getUTCSeconds()) + '_mail.txt'; r.izvor_vid = 'mail'; r.izvor = null; r.link = null; r.original_url = 'demo:'; }
    else { r.kluch = String(ms); r.msg_id = r.kluch; }
    D.saobshteniq.push(r);
    return r;
  }
  function demoE6(a24, k24) {
    var T = dT;
    D.e6No = false; D.spi = false; D.teamsV = false;
    // свежестта: „свежи“ при спрения часовник 17:42 (Интранетът — от 16:02); лаптопът — пазачът пише на 2 мин (demoApi.svezhest)
    D.svezhest.forEach(function (s) { if (s.izvor === 'intranet') { s.posledno = T('2026-09-24T16:02:00+03:00'); s.ok = true; s.broi = 20; s.belejka = 'Моите задачи — 20 задачи, 6 събития за Амур.'; } });
    D.svezhest.push({ izvor: 'laptop', posledno: T('2026-09-24T17:40:00+03:00'), ok: true, broi: null, belejka: 'Пазачът пише на 2 мин.' });
    if (a24) {
      var A = function (o) { return dMsg(a24, o); };
      // 15 неизползвани: 5 „Добро утро“, 2 от бота Workflows (времето), 3 уточнения, 3 мейла (вкл. от „аз“), 2 снимки без текст
      [['06:45', 'ТР на обекта'], ['06:48', 'бригадир кофраж'], ['06:52', 'бригадир фасада'], ['06:58', 'механизатор'], ['07:03', 'Demo Tehnik']].forEach(function (x) { A({ hm: x[0], avtor: x[1], tekst: 'Добро утро!' }); });
      A({ hm: '06:30', avtor: 'Workflows', tekst: 'Прогноза за обекта: слънчево, 14–29 °C, вятър до 4 m/s.' });
      A({ hm: '12:30', avtor: 'Workflows', tekst: 'Прогноза за следобеда: без валежи, вятър до 5 m/s.' });
      A({ hm: '10:20', avtor: 'бригадир кофраж', tekst: 'Бетонът за стълбището е приет — 24 м³, без забележки. Пробните кубчета са надписани.' });
      A({ hm: '13:40', avtor: 'ТР на обекта', izvor_vid: 'chat', izvor: 'Амур Гардънс', tekst: 'Уточнение: огледът с надзора е след ос 4, не след ос 3.' });
      A({ hm: '15:20', avtor: 'бригадир фасада', izvor_vid: 'chat', izvor: 'Амур Гардънс', tekst: 'Палетите с клинкер ще ги свалим утре сутрин, преди армировката.' });
      A({ hm: '09:12', vid: 'mail', avtor: 'demo.tehnik@primer.test', tema: 'RE: Огледът на армировката', do_kopie: 'Копие: snab@primer.test;office@primer.test',
        tekst: 'Здравейте,\n\nОгледът на армировката с надзора е възможен в понеделник след 10:00.\n\nПоздрави,\nDemo Tehnik\n\nFrom: Demo Snab [mailto:snab@primer.test]\nSent: Wednesday, September 23, 2026 5:10 PM\nSubject: Огледът на армировката\n\nКога е огледът?' });
      A({ hm: '14:55', vid: 'mail', avtor: 'snab@primer.test', tema: 'Клинкер за сграда 4 — уточнение', do_kopie: 'Копие: demo.tehnik@primer.test;office@primer.test',
        tekst: 'Здравейте,\n\nКлинкерът за сграда 4 е поръчан; доставката е в понеделник сутрин. Моля, осигурете място до сградата.\n\nПоздрави,\nDemo Snab' });
      A({ hm: '16:50', vid: 'mail', avtor: 'rp.demo@primer.test', tema: 'Седмична оперативка', do_kopie: 'Копие: office@primer.test',
        tekst: 'Колеги,\n\nОперативката е в петък от 08:30 на обекта.\n\nTi Demo <rp.demo@primer.test>' });
      A({ hm: '11:05', avtor: 'бригадир кофраж', tekst: '', snimki_broi: 2 });
      A({ hm: '15:45', avtor: 'бригадир фасада', izvor_vid: 'chat', izvor: 'Амур Гардънс', tekst: '', snimki_broi: 2 });
      // обработено „➕ Включи в дневника“ — точка 14 е добавена в v3 от съобщението ѝ [§3.1]
      var t14 = D.tochki.filter(function (t) { return t.den_id === a24.id && t.k === 14; })[0], k14 = t14 ? srcKey(t14.izvori[0]) : null;
      if (k14) D.resheniq.push({ id: ++D.seq, den_id: a24.id, tochka_id: null, vid: 'dobavi', tekst: k14, versiq: 2, hesh: null, ustroistvo: 'iPhone · иконка', kogda: T('2026-09-24T08:20:00+03:00'),
        obraboteno: T('2026-09-24T09:04:00+03:00'), rezultat: 'нанесено във v3: точка 14' });
    }
    // днешните съобщения след черновата — без den_id, по (обект, дата) → „📥 Днес досега“ [§5.14]
    var dn = { obekt: 'ag', data: '2026-09-24' }, dk = { obekt: 'soft', data: '2026-09-24' };
    // Стъпка 1а: 16:55 — преди снимката „събрано до“ (17:02); 17:31, 17:36 и 17:38 — „След черновата: 💬 2 · ✉️ 1“
    dMsg(dn, { hm: '16:55', tekst: 'Утре от 07:00 започваме армировката на +9,30 — кранът е запазен за нас до 10:00.' });
    dMsg(dn, { hm: '17:31', avtor: 'бригадир фасада', izvor_vid: 'chat', izvor: 'Амур Гардънс', tekst: 'Палетите с клинкер са преместени до сграда 4.' });
    dMsg(dn, { hm: '17:36', avtor: 'Demo Tehnik', izvor_vid: 'chat', izvor: 'чат на ПТО', tekst: 'Писмото до доставчика на арматура е пратено — чакаме отговор до утре на обяд.' });
    dMsg(dn, { hm: '17:38', vid: 'mail', avtor: 'snab@primer.test', tema: 'Клинкер за сграда 4 — потвърждение', do_kopie: 'Копие: demo.tehnik@primer.test',
      tekst: 'Здравейте,\n\nПотвърждавам доставката на клинкер за сграда 4 в понеделник, 07:30.\n\nПоздрави,\nDemo Snab' });
    dMsg(dk, { hm: '17:20', tekst: 'Помпите в сутерена работят, водата спада.' });
    dMsg(dk, { hm: '17:33', avtor: 'бригадир фасада', izvor_vid: 'chat', izvor: 'Скай Тауърс', tekst: 'Панелите за ниво 9 пристигат утре сутрин.' });
    dMsg(dk, { hm: '17:40', vid: 'mail', avtor: 'office@primer.test', tema: 'График на фасадата — ниво 9', tekst: 'Здравейте,\n\nИзпращаме актуализирания график на фасадата за ниво 9.\n\nПоздрави,\nDemo Office' });
    // голям ден: Скай 24.09 — 130 съобщения, 20 от тях в точки (2 промени по 3 + 2 факта по 7) → страниците по 30 [§5.13 т.4]
    if (k24) {
      var big = [], AV = ['ТР на обекта', 'бригадир фасада', 'Demo Tehnik', 'механизатор', 'бригадир довършителни'];
      for (var i = 1; i <= 130; i++) {
        var mn = 7 * 60 + Math.floor(i * 4.5);
        big.push(dMsg(k24, { hm: pad(Math.floor(mn / 60)) + ':' + pad(mn % 60), sek: i % 60, avtor: AV[i % 5], izvor_vid: i % 3 ? 'chat' : 'kanal', izvor: i % 3 ? 'Скай Тауърс' : 'канал на обекта',
          tekst: 'Демо съобщение ' + i + (i % 9 === 0 ? ' — ' + LONG6 : '.') }));
      }
      var inP = big.filter(function (r, j) { return j % 6 === 0; }).slice(0, 20), nn = 0;
      var srcs = function (l) {
        return l.map(function (r) {
          var d = new Date(r.vreme);
          return { n: ++nn, tip: r.izvor_vid === 'kanal' ? 'Тиймс канал' : 'Тиймс чат', kratko: r.avtor + ' · ' + (r.izvor_vid === 'kanal' ? 'канал на обекта' : 'чат „Скай Тауърс“'),
            vreme: hhmm(d), kade: 'Оригинали/' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '_' + r.kluch + '_20260101000000000.json' };
        });
      };
      var kp = D.tochki.filter(function (t) { return t.den_id === k24.id; }).sort(function (a, b) { return a.red - b.red; });
      if (kp[0]) kp[0].izvori = srcs(inP.slice(0, 3));
      if (kp[1]) kp[1].izvori = srcs(inP.slice(3, 6));
      var kk = kp.reduce(function (m, t) { return Math.max(m, t.k || 0); }, 0);
      [['Окачената фасада — монтирани панели до ниво 8 (по съобщенията от деня).', inP.slice(6, 13)], ['Етаж 5 — шпакловката е завършена; започва грундът.', inP.slice(13, 20)]].forEach(function (f) {
        kk++;
        D.tochki.push({ id: ++D.tid, den_id: k24.id, razdel: 4, grupa: 'fakt', tekst: f[0], istina: 'saobshteno', vajnost: 1, izvori: srcs(f[1]), red: kk, k: kk, v_dnevnika: true });
        k24.zapis_md = String(k24.zapis_md).replace('\n\n## 5. ', '\n- ' + f[0] + ' ⟦' + kk + '⟧\n\n## 5. ');
      });
      // чакащо „➕“ на друг ден — листът „Одобряваш ли деня?“ на Скай 24.09 предупреждава за него [§3.1]
      D.resheniq.push({ id: ++D.seq, den_id: k24.id, tochka_id: null, vid: 'dobavi', tekst: big[1].kluch, versiq: k24.versiq, hesh: k24.hesh, ustroistvo: 'iPhone · иконка',
        kogda: T('2026-09-24T17:15:00+03:00'), obraboteno: null, rezultat: null });
    }
    // движението в Интранета (пише го само лаптопът) — Амур 6, Скай 2 [§2.1, §5.11]
    function DV(id, o, tid, vid, staro, novo, op, a, b, x) {
      return Object.assign({ id: id, tid: tid, obekt: o, vid: vid, staro: staro, novo: novo, opisanie: op, otgovornik: null, srok: null, status: null, data_sabitie: '2026-09-24', tochnost: 'prozorec',
        okno_ot: T('2026-09-24T' + a + ':00+03:00'), okno_do: T('2026-09-24T' + b + ':00+03:00') }, x || {});
    }
    D.intranet_dvizhenie = [
      DV(9001, 'ag', 7027, 'nova', null, null, 'Предай екзекутивите на ВиК за сграда 1', '08:02', '10:21', { tochnost: 'tochna', otgovornik: 'Инж. ВиК (демо)', srok: '2026-10-08', status: 'Текуща' }),
      DV(9002, 'ag', 7010, 'status', 'Текуща', 'Стартирала', 'Прегледай количествената сметка за поредния акт по кофража', '12:03', '14:05'),
      DV(9003, 'ag', 7001, 'srok', '2026-09-25', '2026-09-30', 'Изпрати на инвеститора графика за фасадата на сграда 4', '12:03', '14:05'),
      DV(9004, 'ag', 7022, 'otgovornik', 'Техн. ръководител (демо)', 'Ти (демо)', 'Оглед на кофража с надзора — протокол', '14:05', '16:02'),
      DV(9005, 'ag', 7021, 'zavarshena', 'Текуща', 'Завършена', 'Снимки на плоча +9,30 преди армировката', '14:05', '16:02'),
      DV(9006, 'ag', 6950, 'izchezna', null, null, 'Стара задача: скелето по северната фасада на сграда 3', '14:05', '16:02'),
      DV(9007, 'soft', 7013, 'srok', '2026-09-20', '2026-09-27', 'Заяви технически преглед на кулокран 2', '08:02', '10:21'),
      DV(9008, 'soft', 7023, 'status', 'Текуща', 'За санкция', 'Проверка на хидроизолацията в сутерена', '12:03', '14:05')
    ];
    // списъкът на Интранета — по движението (сроковете, статусите, новата задача)
    (D.intranet_zadachi || []).forEach(function (r) {
      if (r.tid === 7001) r.srok = '2026-09-30';
      if (r.tid === 7010) r.status = 'Стартирала';
      if (r.tid === 7013) r.srok = '2026-09-27';
      if (r.tid === 7021) { r.status = 'Завършена'; r.zavarshena = T('2026-09-24T15:30:00+03:00'); }
      if (r.tid === 7027) r.sazdadena = T('2026-09-24T10:15:00+03:00');
    });
    // „✉ Питай по мейл“: едно „чака отговор“ (питано 15.09 → 9 дни, кехлибарено) и едно отговорено [§3.6]
    function PZ(o) {
      return Object.assign({ id: ++D.seq, den_id: null, tochka_id: null, vid: 'iskane', chovek: 'snab@primer.test', mqsto: null, srok: null, izvor: 'AiLab · Питай', status: 'chaka_otgovor', vanshen_id: null,
        sazdadeno: null, obnoveno: null, obekt: 'ag', cel: null, danni: null, razqsnenie: null, zamenq: null, belejka: null, vanshen_url: null, klient_id: null, opit: null }, o);
    }
    D.deistviq.push(PZ({ tekst: 'Въпрос до snab@primer.test: Клинкерът за сграда 4 — има ли потвърдена дата на доставката?', sazdadeno: T('2026-09-15T10:05:00+03:00'), obnoveno: T('2026-09-16T09:02:00+03:00'),
      belejka: 'питано по мейл 15.09 10:05', danni: { kanal: 'mail', adresati: [{ adres: 'snab@primer.test', ime: 'Demo Snab' }], tema: 'Въпрос: Клинкерът за сграда 4 — дата на доставката (Амур Гардънс, 15.09.2026)',
        pitano: T('2026-09-15T10:05:00+03:00'), kluch: null, tochka_k: null } }));
    D.deistviq.push(PZ({ status: 'izpalneno', tekst: 'Въпрос до snab@primer.test: Мострата на смесителите — кога пристига?', sazdadeno: T('2026-09-21T11:30:00+03:00'), obnoveno: T('2026-09-23T15:10:00+03:00'),
      belejka: 'отговор: 23.09 15:10 от snab@primer.test („RE: Въпрос: Мострата на смесителите — кога пристига?“)', danni: { kanal: 'mail', adresati: [{ adres: 'snab@primer.test', ime: 'Demo Snab' }],
        tema: 'Въпрос: Мострата на смесителите — кога пристига? (Амур Гардънс, 21.09.2026)', pitano: T('2026-09-21T11:30:00+03:00'), kluch: null, tochka_k: null,
        otgovor: { kluch: null, den_id: null, vreme: T('2026-09-23T15:10:00+03:00') } } }));
  }
  // демо панел: лаптопът спи (−40 мин) · Тиймс от вчера 09:05 · без таблиците на Етап 6 (преди 009) [§5.11, §5.13 т.11, т.16]
  function demoSvRefresh() { demoApi.svezhest().then(function (l) { S.svezhest = l || []; S.svAt = Date.now(); renderCurrent(); if (sheetKind === 'demo') openDemoSheet(); }, function () {}); }
  function demoSpi(el) { D.spi = !D.spi; if (el) el.setAttribute('aria-pressed', String(D.spi)); demoSvRefresh(); toast(D.spi ? 'Демо: лаптопът спи от 17:02' : 'Демо: лаптопът е буден'); }
  function demoTeamsV(el) { D.teamsV = !D.teamsV; if (el) el.setAttribute('aria-pressed', String(D.teamsV)); demoSvRefresh(); toast(D.teamsV ? 'Демо: Тиймс — последно вчера 09:05' : 'Демо: Тиймс пак е свеж'); }
  function demoE6No(el) {
    D.e6No = !D.e6No; IZ6 = {}; ADR = null; ADR_ST = '';
    if (el) el.setAttribute('aria-pressed', String(D.e6No));
    renderCurrent(); if (view === 'day') renderIzt();
    toast(D.e6No ? 'Демо: таблиците на Етап 6 ги няма — както преди 009' : 'Демо: таблиците на Етап 6 пак има');
    if (sheetKind === 'demo') openDemoSheet();
  }
  function demoE6Lbl(k) {
    return k === 'spi' ? '💻 Лаптопът спи — ' + (D && D.spi ? 'вкл.' : 'изкл.') : k === 'tv' ? '+ Тиймс от вчера — ' + (D && D.teamsV ? 'вкл.' : 'изкл.')
      : 'Без таблиците на Етап 6 — ' + (D && D.e6No ? 'вкл.' : 'изкл.');
  }
  // ---- Стъпка 1а — демо панел ----
  var DEMO_PS = ['няма запис', 'въведени след черновата', 'въведени преди черновата'];
  function demo1aLbl(k) {
    if (!D) return '';
    if (k === 'pris') return '👷 Присъствия Амур 24.09: ' + DEMO_PS[D.prisSled || 0] + ' ⇄';
    if (k === 'sled') return '✉️ Без съобщения след черновата — ' + (D.sledNo ? 'вкл.' : 'изкл.');
    if (k === 'disk') return '💽 C: ' + D.disk + ' GB → ' + (D.disk === 33 ? 12 : D.disk === 12 ? 7 : 33) + ' GB';
    if (k === 'ne') return '📝 Пускът не е тръгнал — ' + (D.cikal === 'ne' ? 'вкл.' : 'изкл.');
    if (k === 'tece') return '⏳ Обновяване тече — ' + (D.cikal === 'tece' ? 'вкл.' : 'изкл.');
    if (k === 'dok') return '📎 Без регистъра на приложенията — ' + (D.dokNo ? 'вкл.' : 'изкл.');
    return '';
  }
  function demo1aPaint(el, k, msg) {
    if (el) { el.textContent = demo1aLbl(k); if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(k === 'sled' ? !!D.sledNo : k === 'dok' ? !!D.dokNo : k === 'ne' ? D.cikal === 'ne' : k === 'tece' ? D.cikal === 'tece' : false)); }
    if (msg) toast(msg);
  }
  function demoPrisSled(el) {
    D.prisSled = ((D.prisSled || 0) + 1) % 3; D.prisystvie = demoPris(D.prisLong);
    demo1aPaint(el, 'pris', 'Демо: Присъствия Амур 24.09 — ' + DEMO_PS[D.prisSled]);
    demoPrisReset();
  }
  function demoSledNo(el) { D.sledNo = !D.sledNo; SLED = {}; demo1aPaint(el, 'sled', D.sledNo ? 'Демо: нищо ново след черновата' : 'Демо: 3 съобщения след черновата'); if (S.den) den1aLoad(); }
  function demoDisk(el) { D.disk = D.disk === 33 ? 12 : D.disk === 12 ? 7 : 33; demo1aPaint(el, 'disk', 'Демо: C: ' + D.disk + ' GB свободни'); demoSvRefresh(); }
  function demoCikal(el, k) {
    D.cikal = D.cikal === k ? '' : k;
    Array.prototype.forEach.call(document.querySelectorAll('[data-a="dCikalNe"],[data-a="dCikalTece"]'), function (b) { demo1aPaint(b, b.getAttribute('data-a') === 'dCikalNe' ? 'ne' : 'tece'); });
    toast(k === 'ne' ? (D.cikal ? 'Демо: пускът в 22:45 не е тръгнал' : 'Демо: пускът е минал') : (D.cikal ? 'Демо: обновяването тече' : 'Демо: обновяването свърши'));
    demoSvRefresh();
  }
  function demoDokNo(el) { D.dokNo = !D.dokNo; DOK = { den: {}, all: null, allSt: '', allAt: 0, allErr: null, lst: {} }; demo1aPaint(el, 'dok', D.dokNo ? 'Демо: таблицата dokumenti я няма — както преди 010' : 'Демо: регистърът пак има'); if (S.den) den1aLoad(); dokAllLoad(true); }
  // Присъствия: Амур 120 дни, Скай 95 (започва по-късно — [К20]); 3 делника без запис; 1 ден със стойност с часове;
  // нето = dni.hora, освен Амур 23.09 (49 ↔ 50) и Скай 24.09 (41 ↔ 38) — за „разлика“. dulga → ~1 300 реда (2 страници [К4]).
  function demoPris(dulga) {
    var H = {}, out = [], END = parseD('2026-09-24'), T = dT;
    D.dni.forEach(function (d) { if (d.hora != null) H[d.obekt + ':' + d.data] = d.hora; });
    var SPEC = { 'ag:2026-09-23': 49, 'soft:2026-09-24': 41 }, NONE = { 'ag:2026-08-27': 1, 'ag:2026-09-11': 1, 'soft:2026-09-15': 1 };
    function b(id, ime, kat, broi, net, ch) { var x = { id: id, ime: ime, kategoriq: kat, broi: broi, net: net }; if (ch) x.chasove = ch; return x; }
    function razbij(o, N, sab, k) {
      if (o === 'ag' && k === '2026-09-19') return [b('t1', 'Кофраж А', 'Груб строеж', 12, true, '07:00–13:00'), b('t3', 'Фасада Север', 'Фасада', 9, true), b('t5', 'Ръководство', 'Ръководство', 2, false)];
      var oh = sab ? 0 : 1, R = Math.max(0, N - oh), l;
      if (o === 'ag') {
        var a = Math.round(R * 0.34), c = Math.round(R * 0.2), bb = sab ? 0 : Math.round(R * 0.2);
        l = [b('t1', 'Кофраж А', 'Груб строеж', a, true), b('t2', 'Армировка Б', 'Груб строеж', bb, true), b('t3', 'Фасада Север', 'Фасада', c, true),
          b('t4', 'Общи работници', 'Общи', R - a - bb - c, true), b('t5', 'Ръководство', 'Ръководство', sab ? 2 : 5, false), b('t6', 'Охрана', null, oh, true)];
      } else {
        var f = Math.round(R * 0.36), dv = Math.round(R * 0.36);
        l = [b('s1', 'Фасада Север', 'Фасада', f, true), b('s2', 'Довършителни В', 'Довършителни', dv, true), b('s3', 'Общи работници', 'Общи', R - f - dv, true),
          b('s4', 'Ръководство', 'Ръководство', sab ? 1 : 4, false), b('s5', 'Охрана', null, oh, true)];
      }
      return l.filter(function (x) { return x.broi > 0; }).sort(function (x, y) {
        var p = x.kategoriq || '￿', q = y.kategoriq || '￿';
        return p < q ? -1 : p > q ? 1 : x.ime < y.ime ? -1 : x.ime > y.ime ? 1 : 0;
      });
    }
    [['ag', dulga ? 1000 : 120], ['soft', dulga ? 760 : 95]].forEach(function (x) {
      var o = x[0];
      for (var i = x[1] - 1; i >= 0; i--) {
        var dt = new Date(END.getFullYear(), END.getMonth(), END.getDate() - i), k = ymd(dt), wd = dt.getDay(), key = o + ':' + k, h = H[key];
        if (NONE[key] || wd === 0) continue;
        // Стъпка 1а [§6.11]: Амур 24.09 — по подразбиране още няма запис (в 19:00 почти никога); демо панелът ⇄ „след/преди черновата“
        var vz = D.a24vzeto ? Date.parse(D.a24vzeto) : 0, sinhr = null;
        if (key === 'ag:2026-09-24') { if (!D.prisSled) continue; sinhr = new Date(vz + (D.prisSled === 1 ? 25 : -30) * 60000).toISOString(); }
        if (wd === 6 && h == null && i % 14 !== 6) continue;   // повечето съботи — без работа
        var N = SPEC[key] != null ? SPEC[key] : h != null ? h : (o === 'ag' ? 44 + (i * 7) % 19 : 29 + (i * 5) % 12) - (wd === 6 ? (o === 'ag' ? 26 : 18) : 0);
        var pb = razbij(o, N, wd === 6, k), ob = 0, ne = 0;
        pb.forEach(function (y) { ob += y.broi; if (y.net) ne += y.broi; });
        var ov = sinhr || T(k + (o === 'soft' ? 'T09:35:00+03:00' : k === '2026-09-24' ? 'T16:35:00+03:00' : 'T20:40:00+03:00'));
        out.push({ obekt: o, data: k, po_brigadi: pb, obshto: ob, neto: ne, obnoveno_ot: null, v_izvora: true, obnoveno_v: ov, sinhr: ov });
      }
    });
    return out;
  }
  // Интранетът: 20 задачи — всички роли, 4 просрочени, 3 завършени, 2 вързани с демо задачите (7001, 6990); адресът — #demo-intranet-<tid>
  function demoIntranet() {
    var T = dT, TI = 'Ти (демо)', TR = 'Техн. ръководител (демо)', PTO = 'Инж. ПТО (демо)';
    function Z(tid, opisanie, obekt, otg, vaz, srok, status, o) {
      var tema = obekt === 'ag' ? 'Амур Гардънс' : obekt === 'soft' ? 'Скай Тауърс' : null;
      return Object.assign({ tid: tid, opisanie: opisanie, tema: tema, obekt: obekt, otgovornik: otg, vazlozhil: vaz, ekip: [], prioritet: 'normal', srok: srok, status: status,
        sazdadena: T('2026-09-' + pad(10 + tid % 12) + 'T09:' + pad(tid % 60) + ':00+03:00'), zavarshena: null, na_men: otg === TI, ot_men: vaz === TI, v_ekipa: false,
        komentari: null, kontrolni: '0/0', link: '#demo-intranet-' + tid, detajli_v: T('2026-09-24T16:02:00+03:00'), vidqna_posledno: T('2026-09-24T16:02:00+03:00'),
        obnoveno: T('2026-09-24T16:02:00+03:00'), v_spisaka: true }, o || {});
    }
    return [
      Z(7001, 'Изпрати на инвеститора графика за фасадата на сграда 4', 'ag', TR, TI, '2026-09-25', 'Текуща', { ekip: ['Бригадир фасада (демо)'], prioritet: 'high', komentari: 1 }),
      Z(6990, 'Подпиши протокола за приемане на армировката на стълбището', 'ag', TI, TI, '2026-09-22', 'Текуща', { sazdadena: T('2026-09-18T21:04:00+03:00') }),
      Z(7010, 'Прегледай количествената сметка за поредния акт по кофража', 'ag', TI, 'Сметчик (демо)', '2026-09-25', 'Текуща', { prioritet: 'high' }),
      Z(7011, 'Одобри мострата на фасадните панели за ниво 9', 'soft', TI, PTO, '2026-09-21', 'Чака одобрение', { komentari: 3 }),
      Z(7012, 'Месечен отчет за безопасността — септември', null, TI, 'Интранет', '2026-09-30', 'Текуща'),
      Z(7013, 'Заяви технически преглед на кулокран 2', 'soft', 'Механизатор (демо)', TI, '2026-09-20', 'Текуща', { prioritet: 'urgent', kontrolni: '1/2' }),
      Z(7014, 'Уточни графика на анкерите за окачената фасада', 'soft', TR, TI, '2026-09-29', 'Стартирала'),
      Z(7015, 'Поръчай втори контейнер за отпадъци за сгради 2 и 3', 'ag', 'Бригадир кофраж (демо)', TI, '2026-09-29', 'Мониторинг'),
      Z(7016, 'Протокол за заземяването на кулокран 1', 'ag', 'Механизатор (демо)', TI, '2026-09-18', 'Завършена', { zavarshena: T('2026-09-17T15:20:00+03:00') }),
      Z(7017, 'Проверка на пожарогасителите на обекта', 'ag', TR, 'Интранет', '2026-09-15', 'Завършена', { v_ekipa: true, ekip: [TI, TR] }),
      Z(7018, 'Мостра на смесителите — одобрение', 'ag', 'Инж. ВиК (демо)', TI, '2026-09-12', 'Завършена', { zavarshena: T('2026-09-11T10:05:00+03:00') }),
      Z(7019, 'Съгласуване на трасето на временното ел. захранване', 'soft', 'Координатор МЕП (демо)', PTO, '2026-10-02', 'Текуща', { v_ekipa: true, ekip: [TI, 'Инж. Електро (демо)'] }),
      Z(7020, 'Актуализиране на плана за безопасност и здраве', null, PTO, 'Интранет', '2026-09-23', 'Текуща', { v_ekipa: true, ekip: [TI] }),
      Z(7021, 'Снимки на плоча +9,30 преди армировката', 'ag', TR, TI, '2026-09-25', 'Текуща'),
      Z(7022, 'Оглед на кофража с надзора — протокол', 'ag', TI, TR, '2026-09-26', 'Текуща'),
      Z(7023, 'Проверка на хидроизолацията в сутерена', 'soft', TR, TI, '2026-09-24', 'За санкция', { komentari: 5 }),
      Z(7024, 'Списък на липсите по фасадата на сграда 3', 'ag', 'Бригадир фасада (демо)', TR, '2026-10-05', 'Текуща', { v_ekipa: true, ekip: [TI] }),
      Z(7025, 'Седмична оперативка — протокол', null, TI, TI, null, 'Текуща'),
      Z(7026, 'Доставка на стъклопакети за ниво 7', 'soft', PTO, TI, '2026-10-01', 'Мониторинг'),
      Z(7027, 'Предай екзекутивите на ВиК за сграда 1', 'ag', 'Инж. ВиК (демо)', TI, '2026-10-08', 'Текуща', { komentari: 2, kontrolni: '1/3' })
    ];
  }
  // демо панел: „таблицата липсва“ (поведението преди 008) и „дълга история“ (страници [К4])
  function demoPrisReset() { PRIS.rows = null; PRIS.by = {}; PRIS.first = {}; PRIS.last = {}; PRIS.st = ''; PRIS.at = 0; PRIS.det = {}; PRIS.detK = []; PRIS.detSt = {}; PRIS.inited = true; ldel(K5.hora); prisLoad(true); prisPaint(); }
  function demoPrisNo(el) { D.prisNo = !D.prisNo; if (el) { el.setAttribute('aria-pressed', String(D.prisNo)); el.textContent = demoPrisLbl(); } demoPrisReset(); toast(D.prisNo ? 'Демо: таблицата prisystvie я няма — както преди Етап 5' : 'Демо: Присъствия пак има'); }
  function demoPrisLong(el) {
    D.prisLong = !D.prisLong; D.prisystvie = demoPris(D.prisLong);
    if (el) { el.setAttribute('aria-pressed', String(D.prisLong)); el.textContent = demoPrisLbl(true); }
    demoPrisReset(); toast('Демо: Присъствия — ' + D.prisystvie.length + ' реда');
  }
  function demoPrisLbl(dl) { return dl ? 'Присъствия: дълга история (2 страници) — ' + (D && D.prisLong ? 'вкл.' : 'изкл.') : 'Присъствия: таблицата липсва — ' + (D && D.prisNo ? 'вкл.' : 'изкл.'); }
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
      // Етап 6 [§5.11]: „Копие:“ като истинските (a;b) — с адреса на „аз“ (не се предлага); цитираното писмо носи „Име <адрес>“
      [SS.s4, { avtor: 'dostavchik@primer.test', tema: 'RE: Уточнение за доставката', do_kopie: 'Копие: snab@primer.test;office@primer.test;rp.demo@primer.test',
        tekst: 'Здравейте,\n\nПоради забавяне при производителя остатъкът от арматурата Ø12/Ø16 (около 14 т) ще бъде доставен с 5 до 10 работни дни закъснение. Първата част можем да изпратим на 29.09.\n\nМоля да потвърдите дали приемате частична доставка.\n\nПоздрави,\nDemo Dostavchik\nотдел „Доставки“\n\n' +
          '-----Original Message-----\nFrom: Demo Tehnik <demo.tehnik@primer.test>\nSent: Wednesday, September 23, 2026 4:20 PM\nTo: Demo Dostavchik <dostavchik@primer.test>\nSubject: Уточнение за доставката\n\nКога точно идва остатъкът от арматурата?' }],
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
      srok: T('2026-09-25T17:00:00+03:00'), status: 'vpisano', vanshen_id: '7001', vanshen_url: '#demo-7001', belejka: 'вписана 18:20', razqsnenie: 'Графикът да покрива и скелето.',
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
      vanshen_id: '6990', vanshen_url: '#demo-6990', belejka: 'вписана 21:04', danni: { manager: M('2', 'Ти (демо)'), tema: 'Амур Гардънс', ekip: [], prioritet: 'normal', kraen_srok: '2026-09-22' },
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
    heldOrphans();   // Етап 6 [§5.6 т.9]: задържани отпреди > 10 мин (приложението е било убито насред „Отмени“) → тръгват
    setBodyO(TB.sel);
    WIDE = wideNow(); document.body.classList.toggle('wide', WIDE); twSync();   // широк екран — преди първото рисуване
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
