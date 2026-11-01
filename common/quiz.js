// 写真（と鳴き声）から名前を当てる4択クイズのアプリ（Material 3 のデザイン、スマホの画面向け）。
// クイズの設定は QUIZZES / MIX_QUIZ（quizzes.js）、データは QUIZ_DATA[id]（各 data.js）、アイコンは MS_ICONS（icons.js）。
// 画面: 下のナビゲーションバーで ホーム / 図鑑（#zukan）/ きろく（#kiroku）。
//       クイズのトップ（#birds など）→ 出題 → 結果。ほかに #credits、#today、#sp-学名
(() => {
  const ROUNDS = 10;
  const CHOICES = 4;
  const UNIT = "種";

  // 各データの画像・音声のパスはそのクイズのフォルダからの相対パスなので、ここでそろえる
  const byId = {};
  for (const q of QUIZZES) {
    byId[q.id] = q;
    q.items = (window.QUIZ_DATA[q.id] || []).map((x) => ({
      ...x, quiz: q.id,
      img: `${q.id}/${x.img}`,
      sound: x.sound && `${q.id}/${x.sound}`,
    }));
    q.coverImg = `${q.id}/images/${q.cover}.jpg`;
  }
  MIX_QUIZ.items = QUIZZES.flatMap((q) => q.items);
  byId.mix = MIX_QUIZ;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const slugOf = (x) => x.img.split("/").pop().replace(/\.jpg$/, "");

  // アイコン: Material Symbols（common/icons.js）と、それにない図柄（キノコ）
  const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 -960 960 960" aria-hidden="true"><path d="${MS_ICONS[name]}"/></svg>`;
  const qIcon = (q) => (q.ms ? icon(q.ms + (q.ms === "shuffle" ? "" : "_fill")) : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${q.svg}</svg>`);
  const avatar = (q, size = "") => `<span class="avatar ${size} c-${q.id}">${qIcon(q)}</span>`;

  const listItem = (id, ic, headline, support = "") =>
    `<li><button class="list-item" id="${id}"><span class="avatar tonal">${icon(ic)}</span>` +
    `<span class="li-text"><b id="${id}Head">${headline}</b><small id="${id}Sub">${support}</small></span>${icon("chevron_right", "trail")}</button></li>`;

  $("app").innerHTML = `
  <section id="home" class="screen">
    <header class="home-head">
      <h1 class="display">いきものクイズ</h1>
      <a class="icon-btn" href="#credits" aria-label="写真・音声のクレジット">${icon("info")}</a>
    </header>
    <article class="card feature">
      <div class="media"><img id="featureImg" alt=""></div>
      <div class="card-body">
        <span class="overline">今日の生きもの</span>
        <h2 class="title-l" id="featureName"></h2>
        <p class="body-s" id="featureSub"></p>
        <div class="actions">
          <button class="btn tonal" id="featureStudy">${icon("menu_book")}図鑑で見る</button>
          <button class="btn text" id="featureQuiz">${icon("quiz_fill")}<span id="featureQuizLabel"></span></button>
        </div>
      </div>
    </article>
    <h3 class="section-title">クイズ</h3>
    <div class="tiles" id="tiles"></div>
    <p class="footnote">写真と音声は iNaturalist の観察記録から、撮影者・録音者が定めたクリエイティブ・コモンズ・ライセンスに従って使っています。<a href="#credits">クレジット</a></p>
  </section>

  <section id="start" class="screen" hidden>
    <header class="topbar">
      <button class="icon-btn" id="toHome" aria-label="戻る">${icon("arrow_back")}</button>
      <span class="topbar-title" id="startBar"></span>
    </header>
    <div class="hero"><img id="heroImg" alt=""><span id="heroAvatar"></span></div>
    <h1 class="headline" id="title"></h1>
    <p class="lead" id="lead"></p>
    <div class="chips" id="stats"></div>
    <div class="notice" id="notice" hidden>${icon("warning_fill")}<span id="noticeText"></span></div>
    <div class="seg-btn" id="answerSeg" role="radiogroup" aria-label="むずかしさ">
      <button data-ans="choice" role="radio"><span class="seg-label">${icon("check", "seg-check")}かんたん</span><small>4択</small></button>
      <button data-ans="type" role="radio"><span class="seg-label">${icon("check", "seg-check")}むずかしい</span><small>名前を入力</small></button>
    </div>
    <button class="btn filled big" id="photoMode">${icon("photo_camera_fill")}写真クイズをはじめる</button>
    <ul class="list">
      ${listItem("soundMode", "graphic_eq", "", "")}
      ${listItem("reviewMode", "history", "苦手を復習", "")}
      ${listItem("studyBtn", "menu_book", "図鑑", "")}
    </ul>
  </section>

  <section id="quiz" class="screen" hidden>
    <header class="topbar">
      <button class="icon-btn" id="quit" aria-label="やめる">${icon("close")}</button>
      <span class="topbar-title" id="quizBar"></span>
      <span class="topbar-trail" id="progress"></span>
    </header>
    <div class="segs" id="segs" aria-hidden="true"></div>
    <figure class="qmedia">
      <img id="photo" alt="写真">
      <button id="listen" class="listen" hidden><span class="listen-ic"></span><span>もう一度聞く</span></button>
    </figure>
    <h2 class="title-m" id="question"></h2>
    <div class="choices" id="choices"></div>
    <div class="typebox" id="typeBox" hidden>
      <label class="field">${icon("search")}<input id="typeInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="名前を入力（ひらがなでもOK）" aria-label="名前を入力"><button class="icon-btn small" id="typeClear" aria-label="消す" hidden>${icon("close")}</button></label>
      <ul class="suggest" id="suggest" role="listbox" aria-label="候補"></ul>
      <div class="type-actions"><button class="btn text" id="giveUp">わからない</button></div>
    </div>
    <div class="sheet" id="feedback" hidden>
      <div class="handle"></div>
      <p id="result"></p>
      <div class="chips" id="resultChips"></div>
      <p id="desc"></p>
      <p id="tip" class="tip"></p>
      <p id="caution" class="caution" hidden></p>
      <p class="credit" id="credit"></p>
      <button class="btn filled block" id="next">次へ</button>
    </div>
  </section>

  <section id="end" class="screen" hidden>
    <header class="topbar">
      <button class="icon-btn" id="endClose" aria-label="閉じる">${icon("close")}</button>
      <span class="topbar-title">結果</span>
    </header>
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" class="ring-track"/>
        <circle cx="60" cy="60" r="52" class="ring-value" id="ringValue"/>
      </svg>
      <div class="ring-text"><b id="finalScore"></b><span id="finalOf"></span></div>
    </div>
    <p class="verdict" id="verdict"></p>
    <p class="learned-note" id="learnedNote" hidden></p>
    <h3 class="section-title" id="missedHead">まちがえたもの</h3>
    <ul id="missed" class="list missed"></ul>
    <div class="actions stack">
      <button class="btn filled block" id="again">もう一度</button>
      <button class="btn tonal block" id="toStart">クイズのトップへ</button>
    </div>
  </section>

  <section id="study" class="screen" hidden>
    <header class="topbar">
      <button class="icon-btn" id="back" aria-label="戻る">${icon("arrow_back")}</button>
      <span class="topbar-title" id="studyBar">図鑑</span>
      <span class="topbar-trail" id="count"></span>
    </header>
    <label class="searchbar">${icon("search")}<input id="filter" type="search" placeholder="名前でさがす" aria-label="名前でさがす"></label>
    <div class="chips scroll" id="catChips"></div>
    <div class="chips" id="studySeg">
      <button class="chip filter" data-f="all">すべて</button><button class="chip filter" data-f="weak">苦手</button><button class="chip filter" data-f="new">まだ</button><button class="chip filter" data-f="learned">覚えた</button>
    </div>
    <div id="cards" class="cards"></div>
  </section>

  <section id="records" class="screen" hidden>
    <header class="topbar"><span class="topbar-title">きろく</span></header>
    <article class="card summary" id="summary"></article>
    <h3 class="section-title">クイズごと</h3>
    <ul class="list" id="recordList"></ul>
  </section>

  <section id="credits" class="screen" hidden>
    <header class="topbar">
      <button class="icon-btn" id="creditsBack" aria-label="戻る">${icon("arrow_back")}</button>
      <span class="topbar-title">クレジット</span>
    </header>
    <div class="card credits-about">
      <p>このアプリの写真と音声は、<a href="https://www.inaturalist.org/" target="_blank" rel="noopener">iNaturalist</a> に投稿された観察記録から、撮影者・録音者が定めた次のライセンスに従って使っています。</p>
      <p class="licenses" id="licenseList"></p>
      <p>写真は画面に合わせて縮小・切り抜きをしています。音声は15秒に切り出し、音量を調整しています。</p>
      <p>このアプリは非営利で公開しています。非営利に限るライセンス（NC）の素材を含むため、商用には使えません。</p>
      <p>解説文・見分けポイントはこのアプリのために書いたものです。アイコンは Google の Material Symbols（Apache License 2.0）です。</p>
    </div>
    <div id="creditList"></div>
  </section>

  <nav class="navbar" id="navbar" aria-label="メニュー">
    <a href="#" id="nav-home"><span class="pill">${icon("home")}${icon("home_fill", "on")}</span>ホーム</a>
    <a href="#zukan" id="nav-zukan"><span class="pill">${icon("menu_book")}${icon("menu_book_fill", "on")}</span>図鑑</a>
    <a href="#kiroku" id="nav-kiroku"><span class="pill">${icon("insights")}${icon("insights_fill", "on")}</span>きろく</a>
  </nav>
  <div class="zoom" id="zoom" hidden><img id="zoomImg" alt=""><span class="zoom-hint">タップで閉じる</span></div>`;

  const screens = ["home", "start", "quiz", "end", "study", "records", "credits"];
  // nav: 下のナビゲーションバーで強調するタブ（出さない画面では null）
  function show(name, nav = null) {
    screens.forEach((s) => ($(s).hidden = s !== name));
    $("navbar").hidden = !nav;
    document.body.classList.toggle("has-nav", !!nav);
    ["home", "zukan", "kiroku"].forEach((t) => $("nav-" + t).classList.toggle("on", t === nav));
    window.scrollTo(0, 0);
  }
  const setColor = (id) => { document.body.className = `c-${id}`; };

  // 記録（ベストスコア・出題順・選択肢に出た回数）はクイズごとにブラウザへ保存する
  const loadState = (id) => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem("quiz-" + id)) || {}; } catch { /* 保存できない環境でも遊べる */ }
    return Object.assign({ best: {}, deck: {}, seen: {} }, s);
  };
  const save = () => { try { localStorage.setItem("quiz-" + C.id, JSON.stringify(state)); } catch { /* 同上 */ } };

  // 種ごとの学習記録（全クイズ共通）: c=正解数, w=不正解数, s=連続正解数, t=最後に答えた時刻
  // 2回続けて正解したら「覚えた」、間違えたことがあり、まだ覚えていない種は「苦手」
  const LEARN_KEY = "ikimono-learn";
  const MASTER = 2;
  let learn = {};
  try { learn = JSON.parse(localStorage.getItem(LEARN_KEY)) || {}; } catch { /* 記録なしで続ける */ }
  const rec = (x) => learn[`${x.quiz}:${x.name}`];
  const isLearned = (x) => (rec(x)?.s || 0) >= MASTER;
  const isWeak = (x) => { const r = rec(x); return !!r && r.w > 0 && r.s < MASTER; };
  const weakList = (pool) => pool.filter(isWeak).sort((a, b) => rec(a).s - rec(b).s || rec(b).w - rec(a).w);
  function record(x, ok) {
    const k = `${x.quiz}:${x.name}`;
    const r = learn[k] || { c: 0, w: 0, s: 0 };
    if (ok) { r.c++; r.s++; } else { r.w++; r.s = 0; }
    r.t = Date.now();
    learn[k] = r;
    try { localStorage.setItem(LEARN_KEY, JSON.stringify(learn)); } catch { /* 同上 */ }
  }
  const learnedCount = (items) => items.filter(isLearned).length;

  // むずかしさ: "choice"＝かんたん（4択）か "type"＝むずかしい（名前を入力して候補から選ぶ）。前回の選択を覚えておく
  let answerMode = "choice";
  try { answerMode = localStorage.getItem("ikimono-answer") === "type" ? "type" : "choice"; } catch { /* 4択のまま */ }
  const bestKey = (m) => (answerMode === "type" ? `${m}-type` : m);

  // 入力のゆれをそろえる: カタカナ→ひらがな、空白・中黒を除く（例「かわせみ」「カワセミ」「ｶﾜｾﾐ」は同じ）
  const norm = (t) => t.normalize("NFKC").replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･]/g, "").toLowerCase();
  // 候補: 名前か読みに入力を含む種。前方一致を先に、短い名前を先に
  function suggestions(text, pool) {
    const t = norm(text);
    if (!t) return [];
    return pool.map((x) => {
      const n = norm(x.name), y = norm(x.yomi);
      const at = Math.min(...[n.indexOf(t), y.indexOf(t)].filter((i) => i >= 0), Infinity);
      return { x, at };
    }).filter((o) => o.at !== Infinity)
      .sort((p, q) => (p.at === 0 ? 0 : 1) - (q.at === 0 ? 0 : 1) || p.x.name.length - q.x.name.length)
      .slice(0, 6).map((o) => o.x);
  }

  let C, ALL, WITH_SOUND, state, pending, studyFilter = "all", studyCat = "all", studyFromTab = false, learnedBefore;
  let mode, queue, idx, score, missed, answered, usedInGame, results;

  // 出題順: 全種を一巡するまで同じ種は出さない（ゲームをまたいで続く）
  // exclude: 苦手として別に出題する種（山札から出たら飛ばす）
  function draw(m, pool, n, exclude = new Set()) {
    const names = new Set(pool.map((x) => x.name));
    let deck = (state.deck[m] || []).filter((x) => names.has(x));
    const out = [];
    while (out.length < Math.min(n, pool.length - exclude.size)) {
      if (!deck.length) deck = shuffle(pool.map((x) => x.name)).filter((x) => !out.includes(x) && !exclude.has(x));
      if (!deck.length) break;
      const name = deck.shift();
      if (!exclude.has(name)) out.push(name);
    }
    state.deck[m] = deck;
    return out.map((name) => pool.find((x) => x.name === name));
  }

  // ダミーの選択肢: 正解と同じ分類（鳴き声クイズなら鳴き声のある種）から選ぶ。
  // 見た目が似た仲間（group: 例 虫のチョウ・セミ、鳥の水辺の鳥）を優先し、足りない分だけほかの仲間から補う。
  // それぞれの中では、選択肢に出た回数が少ないものを優先し、同じゲーム内での再登場も避ける
  function distractors(answer) {
    const pool = (mode === "sound" ? WITH_SOUND : ALL).filter((x) => x.quiz === answer.quiz && x !== answer);
    const rank = (list) => shuffle(list)
      .map((x) => ({ x, k: (usedInGame.has(x.name) ? 1000 : 0) + (state.seen[x.name] || 0) + Math.random() * 1.5 }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.x);
    const same = answer.group ? pool.filter((x) => x.group === answer.group) : [];
    const other = pool.filter((x) => !same.includes(x));
    return [...rank(same), ...rank(other)].slice(0, CHOICES - 1);
  }

  // クレジット: 作者・ライセンス（説明ページへのリンク）・出典・加工したこと（CC の表示条件）
  const LICENSE_URL = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/deed.ja",
    "CC BY": "https://creativecommons.org/licenses/by/4.0/deed.ja",
    "CC BY-SA": "https://creativecommons.org/licenses/by-sa/4.0/deed.ja",
    "CC BY-NC": "https://creativecommons.org/licenses/by-nc/4.0/deed.ja",
    "CC BY-NC-SA": "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ja",
  };
  const CHANGES = { 写真: "縮小・切り抜き", 音声: "15秒に切り出し・音量を調整" };
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${esc(text)}</a>`;
  const credit = (c, what) => c ? `${what}: ${esc(c.artist)} / ` +
    (LICENSE_URL[c.license] ? link(LICENSE_URL[c.license], c.license) : esc(c.license)) +
    ` / ${link(c.page, c.page.includes("inaturalist") ? "iNaturalist" : "出典")}（${CHANGES[what]}）` : "";
  const credits = (x) => [credit(x.imgCredit, "写真"), credit(x.soundCredit, "音声")].filter(Boolean).join("<br>");
  // 食用・毒（キノコ）や生息場所（魚）、仲間（虫）のラベル
  const tagOf = (x) => x.edible || x.tag || "";
  const badge = (x) => {
    const t = tagOf(x), q = byId[x.quiz];
    return t ? `<span class="badge ${q.badgeClass ? q.badgeClass(t) : ""}">${esc(t)}</span>` : "";
  };
  const status = (x) => (isLearned(x) ? `<span class="badge learned">${icon("check")}覚えた</span>` : isWeak(x) ? '<span class="badge weak">苦手</span>' : "");
  const soundLabel = (x) => byId[x.quiz].soundLabel || "鳴き声";

  const audio = new Audio();
  audio.preload = "none";
  const clearPlaying = () => document.querySelectorAll(".playing").forEach((b) => b.classList.remove("playing"));
  function play(src, btn) {
    if (!audio.paused && audio.dataset.src === src) { audio.pause(); return; }
    audio.src = src;
    audio.dataset.src = src;
    audio.play().catch(() => {});
    clearPlaying();
    if (btn) btn.classList.add("playing");
  }
  audio.addEventListener("pause", clearPlaying);
  audio.addEventListener("ended", clearPlaying);
  // 再生ボタンの中身（再生中は停止アイコンに切り替わる）
  const playInner = (label) => `${icon("play_arrow_fill", "when-idle")}${icon("stop_circle_fill", "when-playing")}${label}`;

  // 今日の生きもの: 日付ごとに全種から1つ選ぶ
  function todayPick() {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    const all = MIX_QUIZ.items;
    return all[(day * 7919) % all.length];
  }

  const bestOf = (q) => {
    const b = loadState(q.id).best;
    const v = Math.max(b.photo ?? -1, b.sound ?? -1);
    return v >= 0 ? v : null;
  };
  const meter = (n, total) => `<span class="lin"><i style="width:${(n / total) * 100}%"></i></span>`;

  function renderHome() {
    setColor("home");
    document.title = "いきものクイズ";

    const pick = todayPick();
    const pq = byId[pick.quiz];
    $("featureImg").src = pick.img;
    $("featureName").textContent = pick.name;
    $("featureSub").textContent = `${pq.short}・${pick.tip}`;
    $("featureQuizLabel").textContent = pq.title;
    $("featureStudy").onclick = () => { location.hash = "sp-" + slugOf(pick); };
    $("featureQuiz").onclick = () => { location.hash = pick.quiz; };

    $("tiles").innerHTML = QUIZZES.map((q) => {
      const n = learnedCount(q.items);
      return `<a class="tile c-${q.id}" href="#${q.id}">
        <span class="tile-head">${avatar(q)}<span><b>${q.short}</b><small>覚えた ${n} / ${q.items.length}</small></span></span>
        ${meter(n, q.items.length)}
      </a>`;
    }).join("");
    audio.pause();
    show("home", "home");
  }

  function openQuiz(q) {
    C = q;
    ALL = q.items;
    WITH_SOUND = q.id === "mix" ? [] : ALL.filter((x) => x.sound);
    state = loadState(q.id);
    setColor(q.id);
    document.title = q.title;
    $("startBar").textContent = q.title;
    $("heroImg").src = q.coverImg || todayPick().img;
    $("heroAvatar").innerHTML = avatar(q, "lg");
    $("title").textContent = q.title;
    $("lead").textContent = q.lead;
    $("notice").hidden = !q.notice;
    $("noticeText").textContent = q.notice || "";
    const label = q.soundLabel || "鳴き声";
    $("soundMode").parentElement.hidden = WITH_SOUND.length < CHOICES;
    $("soundModeHead").textContent = `${label}クイズ`;
    $("soundModeSub").textContent = `${label}だけで答える（${WITH_SOUND.length}${UNIT}）`;
    const weak = weakList(ALL).length;
    $("reviewMode").parentElement.hidden = weak === 0;
    $("reviewModeSub").textContent = `苦手な ${weak}${UNIT}だけを出題`;
    $("studyBtnSub").textContent = `${ALL.length}${UNIT}の写真と見分けポイント`;
    renderAnswerSeg();
    const b = state.best;
    $("stats").innerHTML = [
      `<span class="chip">${icon("school_fill")}覚えた ${learnedCount(ALL)} / ${ALL.length}</span>`,
      weak ? `<span class="chip">${icon("history")}苦手 ${weak}</span>` : "",
      b.photo != null ? `<span class="chip">${icon("emoji_events_fill")}写真 ベスト ${b.photo}/${ROUNDS}</span>` : "",
      b.sound != null ? `<span class="chip">${icon("emoji_events_fill")}${label} ベスト ${b.sound}/${ROUNDS}</span>` : "",
      b["photo-type"] != null ? `<span class="chip">${icon("emoji_events_fill")}写真・むずかしい ベスト ${b["photo-type"]}/${ROUNDS}</span>` : "",
      b["sound-type"] != null ? `<span class="chip">${icon("emoji_events_fill")}${label}・むずかしい ベスト ${b["sound-type"]}/${ROUNDS}</span>` : "",
    ].join("");
    audio.pause();
    show("start");
  }

  function renderAnswerSeg() {
    $("answerSeg").querySelectorAll("button").forEach((b) => {
      const on = b.dataset.ans === answerMode;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }

  // 出題: 苦手な種を最大3問まぜ、残りは山札から。「苦手を復習」は苦手な種だけ
  function start(m) {
    mode = m;
    if (m === "review") {
      queue = shuffle(weakList(ALL).slice(0, ROUNDS));
    } else {
      const pool = m === "sound" ? WITH_SOUND : ALL;
      const weak = shuffle(weakList(pool).slice(0, 6)).slice(0, 3);
      queue = shuffle([...weak, ...draw(m, pool, ROUNDS - weak.length, new Set(weak.map((x) => x.name)))]);
    }
    learnedBefore = new Set(queue.filter(isLearned));
    idx = 0; score = 0; missed = []; results = []; usedInGame = new Set();
    save();
    $("quizBar").textContent = (m === "review" ? "苦手を復習" : m === "sound" ? `${C.soundLabel}クイズ` : C.title) + (answerMode === "type" ? "・むずかしい" : "");
    show("quiz");
    ask();
  }

  function renderProgress() {
    $("segs").innerHTML = queue.map((_, i) =>
      `<i class="${results[i] === true ? "ok" : results[i] === false ? "ng" : i === idx ? "now" : ""}"></i>`).join("");
    $("progress").textContent = `${idx + 1} / ${queue.length}`;
  }

  function ask() {
    answered = false;
    const a = queue[idx];
    renderProgress();
    $("question").textContent = mode === "sound" ? `この${soundLabel(a)}はだれ？` : byId[a.quiz].question;
    $("photo").hidden = mode === "sound";
    $("photo").src = mode === "sound" ? "" : a.img;
    $("listen").hidden = mode !== "sound";
    $("listen").querySelector(".listen-ic").innerHTML = playInner("");
    $("listen").onclick = () => play(a.sound, $("listen"));
    $("feedback").hidden = true;
    $("quiz").style.paddingBottom = "";
    audio.pause();
    if (mode === "sound") play(a.sound, $("listen"));
    if (queue[idx + 1]) new Image().src = queue[idx + 1].img;  // 次の写真を先に読み込んでおく

    $("choices").hidden = answerMode === "type";
    $("typeBox").hidden = answerMode !== "type";
    if (answerMode === "type") {
      $("typeInput").value = "";
      $("typeInput").disabled = false;
      $("typeClear").hidden = true;
      $("suggest").innerHTML = "";
      $("giveUp").disabled = false;
      $("giveUp").onclick = () => judge(null, a);
      window.scrollTo(0, 0);
      return;
    }
    const opts = shuffle([a, ...distractors(a)]);
    opts.forEach((x) => { usedInGame.add(x.name); state.seen[x.name] = (state.seen[x.name] || 0) + 1; });
    const box = $("choices");
    box.innerHTML = "";
    opts.forEach((x) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.dataset.name = x.name;
      btn.textContent = x.name;
      btn.onclick = () => choose(btn, x, a);
      box.appendChild(btn);
    });
    window.scrollTo(0, 0);
  }

  // 4択: 押したボタンと正解のボタンに印をつけて判定
  function choose(btn, picked, a) {
    if (answered) return;
    [...$("choices").children].forEach((el) => {
      el.disabled = true;
      if (el.dataset.name === a.name) { el.classList.add("correct"); el.insertAdjacentHTML("afterbegin", icon("check_circle_fill")); }
    });
    if (picked !== a) { btn.classList.add("wrong"); btn.insertAdjacentHTML("afterbegin", icon("cancel_fill")); }
    judge(picked, a);
  }

  // 入力: 文字を打つたびに候補を出し、候補を選ぶとそのまま答えになる
  function renderSuggest() {
    if (answered) return;
    const a = queue[idx];
    const text = $("typeInput").value;
    $("typeClear").hidden = !text;
    const list = suggestions(text, byId[a.quiz].items.filter((x) => mode !== "sound" || x.sound));
    $("suggest").innerHTML = list.map((x, i) =>
      `<li><button class="suggest-item" data-i="${i}" role="option"><b>${esc(x.name)}</b><small>${esc(x.yomi)}</small></button></li>`).join("") +
      (text && !list.length ? '<li class="suggest-empty">当てはまる名前がありません</li>' : "");
    $("suggest").querySelectorAll("button").forEach((b) => (b.onclick = () => judge(list[b.dataset.i], a)));
  }

  // 判定（4択・入力で共通）: picked が null なら「わからない」
  function judge(picked, a) {
    if (answered) return;
    answered = true;
    const ok = picked === a;
    if (ok) score++; else missed.push(a);
    results[idx] = ok;
    record(a, ok);
    if (answerMode === "type") {
      $("typeInput").blur();
      $("typeInput").disabled = true;
      $("giveUp").disabled = true;
      $("typeInput").value = picked ? picked.name : "";
      $("typeClear").hidden = true;
      $("suggest").innerHTML = picked && !ok ? `<li class="suggest-item your ng">${icon("cancel_fill")}あなたの答え: ${esc(picked.name)}</li>` : "";
    }
    renderProgress();
    if (mode === "sound") { $("photo").src = a.img; $("photo").hidden = false; $("listen").hidden = true; }
    const r = $("result");
    r.innerHTML = (ok ? `${icon("check_circle_fill")}正解！ ` : `${icon("cancel_fill")}正解は `) + `<b>${esc(a.name)}</b> <small>${esc(a.yomi)}</small>`;
    r.className = ok ? "ok" : "ng";
    $("resultChips").innerHTML = [
      tagOf(a) ? badge(a) : "",
      a.sound ? `<button class="chip assist" id="hear">${playInner(`${soundLabel(a)}を聞く`)}</button>` : "",
    ].join("");
    if (a.sound) $("hear").onclick = () => play(a.sound, $("hear"));
    $("desc").textContent = a.desc;
    $("tip").innerHTML = `${icon("lightbulb_fill")}見分けポイント: ${esc(a.tip)}`;
    $("caution").hidden = !byId[a.quiz].caution;
    $("caution").innerHTML = byId[a.quiz].caution ? `${icon("warning_fill")}${esc(byId[a.quiz].caution)}` : "";
    $("credit").innerHTML = credits(a);
    $("next").textContent = idx + 1 === queue.length ? "結果を見る" : "次へ";
    $("feedback").hidden = false;
    // 下から出る解説（ボトムシート）の分だけ余白をとり、選択肢が隠れないようにする
    $("quiz").style.paddingBottom = `${$("feedback").offsetHeight + 16}px`;
    const over = $(answerMode === "type" ? "typeBox" : "choices").getBoundingClientRect().bottom - (innerHeight - $("feedback").offsetHeight) + 12;
    if (over > 0) window.scrollBy({ top: over, behavior: "smooth" });
    save();
  }

  function finish() {
    audio.pause();
    show("end");
    const n = queue.length;
    $("finalScore").textContent = score;
    $("finalOf").textContent = `/ ${n} 問正解`;
    const len = 2 * Math.PI * 52;
    $("ringValue").style.strokeDasharray = `${len}`;
    $("ringValue").style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $("ringValue").style.strokeDashoffset = `${len * (1 - score / n)}`;
    }));
    const rate = score / n;
    $("verdict").textContent = rate === 1 ? "パーフェクト！" : rate >= .8 ? "すばらしい！" : rate >= .5 ? "いい調子！" : "図鑑で復習してみよう";
    const bk = bestKey(mode);
    if (mode !== "review" && (state.best[bk] == null || score > state.best[bk])) state.best[bk] = score;
    save();
    const newly = queue.filter((x) => isLearned(x) && !learnedBefore.has(x)).length;
    $("learnedNote").hidden = !newly;
    $("learnedNote").innerHTML = `${icon("school_fill")}新しく覚えた生きもの ${newly}${UNIT}（2回続けて正解）`;
    $("missedHead").hidden = $("missed").hidden = !missed.length;
    $("missed").innerHTML = missed.map((x) =>
      `<li class="list-item static"><img class="thumb" src="${x.img}" alt=""><span class="li-text"><b>${esc(x.name)}</b><small>${esc(x.tip)}</small></span></li>`).join("");
  }

  // 図鑑: クイズのトップから開くとそのクイズの種、下の「図鑑」タブから開くと全種（分類で絞り込める）
  function study() {
    const pool = studyFromTab ? (studyCat === "all" ? MIX_QUIZ.items : byId[studyCat].items) : ALL;
    show("study", studyFromTab ? "zukan" : null);
    $("back").hidden = studyFromTab;
    $("studyBar").textContent = studyFromTab ? "図鑑" : `${C.short}の図鑑`;
    $("catChips").hidden = !studyFromTab;
    $("catChips").innerHTML = [["all", "すべて"], ...QUIZZES.map((q) => [q.id, q.short])].map(([id, label]) =>
      `<button class="chip filter${studyCat === id ? " on" : ""}" data-cat="${id}">${studyCat === id ? icon("check") : ""}${label}</button>`).join("");
    const q = $("filter").value.trim();
    const pass = { all: () => true, weak: isWeak, learned: isLearned, new: (x) => !rec(x) }[studyFilter];
    const list = pool.filter((x) => (!q || x.name.includes(q) || x.yomi.includes(q) || tagOf(x).includes(q)) && pass(x));
    $("studySeg").querySelectorAll("button").forEach((b) => {
      const on = b.dataset.f === studyFilter;
      b.classList.toggle("on", on);
      b.innerHTML = (on ? icon("check") : "") + { all: "すべて", weak: "苦手", new: "まだ", learned: "覚えた" }[b.dataset.f];
    });
    $("count").textContent = `${list.length}${UNIT}`;
    $("cards").innerHTML = list.map((x, i) => `
      <article class="card sp c-${x.quiz}">
        <img src="${x.img}" alt="${esc(x.name)}" loading="lazy">
        <div class="card-body">
          <h3>${esc(x.name)}<small>${esc(x.yomi)}</small></h3>
          <div class="chips">${studyFromTab ? `<span class="badge cat">${byId[x.quiz].short}</span>` : ""}${badge(x)}${status(x)}</div>
          <p class="sci">${esc(x.sci)}</p>
          <p>${esc(x.desc)}</p>
          <p class="tip">${icon("lightbulb_fill")}見分けポイント: ${esc(x.tip)}</p>
          ${byId[x.quiz].caution ? `<p class="caution">${icon("warning_fill")}${esc(byId[x.quiz].caution)}</p>` : ""}
          ${x.sound ? `<button class="btn tonal play" data-i="${i}">${playInner(`${soundLabel(x)}を聞く`)}</button>` : ""}
          <p class="credit">${credits(x)}</p>
        </div>
      </article>`).join("");
    $("cards").querySelectorAll(".play").forEach((b) => (b.onclick = () => play(list[b.dataset.i].sound, b)));
    if (!list.length) $("cards").innerHTML = `<p class="empty">${studyFilter === "weak" ? "苦手な生きものはありません。" : studyFilter === "learned" ? "まだ覚えた生きものはありません。クイズで2回続けて正解すると、ここに並びます。" : "見つかりませんでした。"}</p>`;
  }

  function openZukan() {
    setColor("home");
    document.title = "図鑑";
    studyFromTab = true;
    audio.pause();
    study();
  }

  function renderRecords() {
    setColor("home");
    document.title = "きろく";
    const all = MIX_QUIZ.items;
    const learned = learnedCount(all);
    const weak = weakList(all).length;
    const answers = Object.values(learn).reduce((n, r) => n + r.c + r.w, 0);
    const right = Object.values(learn).reduce((n, r) => n + r.c, 0);
    $("summary").innerHTML = `
      <div class="summary-top"><span class="avatar tonal lg">${icon("school_fill")}</span>
        <span><span class="overline">覚えた生きもの</span><b class="big-num">${learned}<small> / ${all.length}${UNIT}</small></b></span></div>
      ${meter(learned, all.length)}
      <div class="summary-stats">
        <span><b>${answers}</b>回 答えた</span>
        <span><b>${answers ? Math.round((right / answers) * 100) : 0}</b>% 正解</span>
        <span><b>${weak}</b>${UNIT} 苦手</span>
      </div>`;
    $("recordList").innerHTML = [...QUIZZES, MIX_QUIZ].map((q) => {
      const n = learnedCount(q.items), w = weakList(q.items).length, best = bestOf(q);
      return `<li><a class="list-item c-${q.id}" href="#${q.id}">${avatar(q)}
        <span class="li-text"><b>${q.title}</b><small>覚えた ${n} / ${q.items.length}${w ? `・苦手 ${w}` : ""}${best != null ? `・ベスト ${best}/${ROUNDS}` : ""}</small>${meter(n, q.items.length)}</span>
        ${icon("chevron_right", "trail")}</a></li>`;
    }).join("");
    audio.pause();
    show("records", "kiroku");
  }

  function renderCredits() {
    setColor("home");
    document.title = "クレジット";
    const all = MIX_QUIZ.items;
    const count = {};
    for (const x of all) for (const c of [x.imgCredit, x.soundCredit]) if (c) count[c.license] = (count[c.license] || 0) + 1;
    $("licenseList").innerHTML = Object.keys(LICENSE_URL).filter((l) => count[l])
      .map((l) => `${link(LICENSE_URL[l], l)}（${count[l]}点）`).join("　");
    $("creditList").innerHTML = QUIZZES.map((q) => `
      <h3 class="section-title">${q.title}</h3>
      <ul class="list credit-rows">${q.items.map((x) => `
        <li class="list-item static"><img class="thumb" src="${x.img}" alt="" loading="lazy"><span class="li-text"><b>${esc(x.name)}</b><p class="credit">${credits(x)}</p></span></li>`).join("")}
      </ul>`).join("");
    audio.pause();
    show("credits");
  }

  // ウィジェットからのリンク: #today（今日の生きもの）、#sp-学名（例 #sp-passer-montanus）でその種の図鑑を開く
  function openSpecies(x) {
    openQuiz(byId[x.quiz]);
    studyFromTab = false;
    studyFilter = "all";
    $("filter").value = x.name;
    study();
  }

  function route() {
    const h = location.hash;
    if (h === "#credits") return renderCredits();
    if (h === "#zukan") return openZukan();
    if (h === "#kiroku") return renderRecords();
    if (h === "#today") return openSpecies(todayPick());
    if (h.startsWith("#sp-")) {
      const x = MIX_QUIZ.items.find((i) => slugOf(i) === h.slice(4));
      if (x) return openSpecies(x);
    }
    const q = byId[h.slice(1)];
    if (!q) return renderHome();
    openQuiz(q);
    if (pending) { const m = pending; pending = null; start(m); }
  }
  const goHome = () => { if (location.hash) location.hash = ""; else renderHome(); };
  const toQuizTop = () => { audio.pause(); openQuiz(C); };

  $("next").onclick = () => { idx++; idx < queue.length ? ask() : finish(); };
  $("again").onclick = () => start(mode);
  $("toStart").onclick = $("endClose").onclick = $("quit").onclick = toQuizTop;
  $("back").onclick = toQuizTop;
  $("toHome").onclick = goHome;
  $("creditsBack").onclick = goHome;
  $("answerSeg").onclick = (e) => {
    const v = e.target.closest("[data-ans]")?.dataset.ans;
    if (!v) return;
    answerMode = v;
    try { localStorage.setItem("ikimono-answer", v); } catch { /* 次回は4択から */ }
    renderAnswerSeg();
  };
  $("typeInput").oninput = renderSuggest;
  // 決定キー: 候補が1つだけ、または入力が名前と完全に一致すればそれで答える
  $("typeInput").onkeydown = (e) => {
    if (e.key !== "Enter" || e.isComposing || answered) return;
    const a = queue[idx];
    const list = suggestions($("typeInput").value, byId[a.quiz].items.filter((x) => mode !== "sound" || x.sound));
    const exact = list.find((x) => norm(x.name) === norm($("typeInput").value) || norm(x.yomi) === norm($("typeInput").value));
    if (exact || list.length === 1) judge(exact || list[0], a);
  };
  $("typeInput").onfocus = () => $("typeBox").scrollIntoView({ behavior: "smooth", block: "start" });
  $("typeClear").onclick = () => { $("typeInput").value = ""; renderSuggest(); $("typeInput").focus(); };
  $("photoMode").onclick = () => start("photo");
  $("soundMode").onclick = () => start("sound");
  $("reviewMode").onclick = () => start("review");
  $("studyBtn").onclick = () => { $("filter").value = ""; studyFilter = "all"; studyFromTab = false; study(); };
  $("studySeg").onclick = (e) => { const f = e.target.closest("[data-f]")?.dataset.f; if (f) { studyFilter = f; study(); } };
  $("catChips").onclick = (e) => { const c = e.target.closest("[data-cat]")?.dataset.cat; if (c) { studyCat = c; study(); } };
  $("filter").oninput = study;
  // 写真をタップすると大きく表示する（出題中・図鑑）
  const zoom = (src) => { $("zoomImg").src = src; $("zoom").hidden = false; };
  $("photo").onclick = () => $("photo").src && zoom($("photo").src);
  $("cards").addEventListener("click", (e) => { if (e.target.matches(".card img")) zoom(e.target.src); });
  $("zoom").onclick = () => { $("zoom").hidden = true; };
  window.addEventListener("hashchange", route);
  route();
})();
