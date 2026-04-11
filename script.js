// script.js
import { tarotCards, CARD_BACK, omikujiFolder } from './tarot.js';
import { horoscope, getZodiac } from './horoscope.js';
import { comments, fortuneLevels, fortuneWeights } from './comments.js';
import { submitOmikujiStats } from './omikujiStats.js';

// ===== ローカルストレージキー =====
const LS_NAME     = 'genshinOmikuji_name';
const LS_BIRTHDAY = 'genshinOmikuji_birthday';
const LS_RESULT   = 'genshinOmikuji_result';

// ===== 状態 =====
let selectedCardIndex = null;
let isShuffled        = false;
let isDraggingAny     = false;

// ===== 画像保存用キャッシュ =====
let captureCard       = null;
let captureIsReversed = false;
const CARD_W = 60;
const CARD_H = 90;

// 各カードの位置・角度状態
const cardStates = tarotCards.map((_, i) => ({
  x: 0, y: 0, rotate: 0, zIndex: i, el: null,
}));

// ===== シード付き乱数 =====
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return hash;
}

function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0;
    return ((s ^ (s >>> 16)) >>> 0) / 0x100000000;
  };
}

function pickWeighted(rng, weights) {
  const r = rng();
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    if (r < sum) return i;
  }
  return weights.length - 1;
}

function clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }

// ===== バイオリズム =====
function calcBiorhythm(birthDateStr) {
  const birth = new Date(birthDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today - birth) / (1000 * 60 * 60 * 24));
  return {
    physical:     Math.sin(2 * Math.PI * days / 23),
    emotional:    Math.sin(2 * Math.PI * days / 28),
    intellectual: Math.sin(2 * Math.PI * days / 33),
  };
}

function bioLabel(v) {
  if (v > 0.5)  return '絶好調';
  if (v > 0.1)  return '好調';
  if (v > -0.1) return '普通';
  if (v > -0.5) return 'やや不調';
  return '要注意';
}

function bioClass(v) {
  if (v > 0.1)  return 'bio-high';
  if (v > -0.1) return 'bio-mid';
  return 'bio-low';
}

// ===== 占い日付（朝5時区切り） =====
function getFortuneDate() {
  const now = new Date();
  if (now.getHours() < 5) now.setDate(now.getDate() - 1);
  return now.toISOString().slice(0, 10);
}

// ===== 結果の保存・読み込み =====
function saveResult(birthday, cardIndex, isReversed) {
  localStorage.setItem(LS_RESULT, JSON.stringify({
    date: getFortuneDate(),
    birthday, cardIndex, isReversed,
  }));
}

function loadResult() {
  const saved = JSON.parse(localStorage.getItem(LS_RESULT) || 'null');
  return (saved && saved.date === getFortuneDate()) ? saved : null;
}

// ===== カード変換適用 =====
function applyTransform(state, animated = true) {
  if (!state.el) return;
  state.el.style.transition = animated ? 'transform 0.35s ease' : 'none';
  state.el.style.transform  = `translate(${state.x}px, ${state.y}px) rotate(${state.rotate}deg)`;
  state.el.style.zIndex     = state.zIndex;
}

// ===== カードスキャッタエリア初期化 =====
function initCardScatter() {
  const container = document.getElementById('card-scatter-area');
  container.innerHTML = '';

  // ドラッグ状態
  let dragCardIndex = null;
  let dragStartX    = 0;
  let dragStartY    = 0;
  let isDragMode    = false;

  tarotCards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'scatter-card';
    div.innerHTML = `<img src="${CARD_BACK}" alt="${card.name}" draggable="false">`;

    div.addEventListener('pointerdown', (e) => {
      if (!isShuffled) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragCardIndex = i;
      dragStartX    = e.clientX;
      dragStartY    = e.clientY;
      isDragMode    = false;
      // 最前面へ
      cardStates[i].zIndex = tarotCards.length + 10;
      applyTransform(cardStates[i], false);
    });

    div.addEventListener('pointermove', (e) => {
      if (dragCardIndex !== i) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      // 8px 以上動いたら即ドラッグモードへ（長押し不要）
      if (!isDragMode && Math.sqrt(dx * dx + dy * dy) > 8) {
        isDragMode    = true;
        isDraggingAny = true;
        cardStates[i].el.classList.add('dragging');
      }
      if (isDragMode) {
        const rect = container.getBoundingClientRect();
        const px   = e.clientX - rect.left - rect.width  / 2;
        const py   = e.clientY - rect.top  - rect.height / 2;
        const maxX = rect.width  / 2 - CARD_W / 2 - 4;
        const maxY = rect.height / 2 - CARD_H / 2 - 4;
        cardStates[i].x = clamp(px, -maxX, maxX);
        cardStates[i].y = clamp(py, -maxY, maxY);
        applyTransform(cardStates[i], false);
      }
    });

    div.addEventListener('pointerup', () => {
      if (dragCardIndex !== i) return;
      if (!isDragMode) selectCard(i); // 動かなければタップ選択
      _endDrag(i);
    });

    div.addEventListener('pointercancel', () => {
      if (dragCardIndex !== i) return;
      _endDrag(i);
    });

    cardStates[i].el     = div;
    cardStates[i].x      = 0;
    cardStates[i].y      = 0;
    cardStates[i].rotate = (Math.random() - 0.5) * 8;
    cardStates[i].zIndex = i;
    applyTransform(cardStates[i], false);
    container.appendChild(div);
  });

  function _endDrag(i) {
    if (isDragMode) {
      isDraggingAny = false;
      cardStates[i].el.classList.remove('dragging');
    }
    dragCardIndex = null;
    isDragMode    = false;
  }

  // コンテナ全体でポインター移動 → ドラッグ中以外は押しのけ
  container.addEventListener('pointermove', (e) => {
    if (!isShuffled || !(e.buttons > 0) || isDraggingAny) return;
    pushCards(e, container);
  });

  // タッチで混ぜる（ドラッグ中はスキップ）
  container.addEventListener('touchmove', (e) => {
    if (!isShuffled || isDraggingAny) return;
    e.preventDefault();
    const touch = e.touches[0];
    pushCards({ clientX: touch.clientX, clientY: touch.clientY, buttons: 1 }, container);
  }, { passive: false });
}

// ===== シャッフル =====
function shuffleCards() {
  isShuffled = false;
  const container = document.getElementById('card-scatter-area');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const maxX = W / 2 - CARD_W / 2 - 4;
  const maxY = H / 2 - CARD_H / 2 - 4;

  // いったん中央に集める（アニメなし）
  cardStates.forEach((state, i) => {
    state.x      = (Math.random() - 0.5) * 10;
    state.y      = (Math.random() - 0.5) * 10;
    state.rotate = (Math.random() - 0.5) * 15;
    state.zIndex = i;
    state.el.classList.remove('selected');
    applyTransform(state, false);
  });

  // ランダムに飛び散らせる
  setTimeout(() => {
    cardStates.forEach((state) => {
      state.x      = (Math.random() * 2 - 1) * maxX;
      state.y      = (Math.random() * 2 - 1) * maxY;
      state.rotate = (Math.random() * 2 - 1) * 65;
      state.zIndex = Math.floor(Math.random() * tarotCards.length);
      applyTransform(state, true);
    });
    isShuffled = true;

    // 選択リセット
    selectedCardIndex = null;
    document.getElementById('card-selected-name').textContent = '';
    updateFortuneBtn();
  }, 30);
}

// ===== 押しのけ処理 =====
function pushCards(e, container) {
  const rect = container.getBoundingClientRect();
  const px   = e.clientX - rect.left  - rect.width  / 2;
  const py   = e.clientY - rect.top   - rect.height / 2;
  const W    = rect.width;
  const H    = rect.height;
  const maxX = W / 2 - CARD_W / 2 - 4;
  const maxY = H / 2 - CARD_H / 2 - 4;
  const RADIUS = 90;
  const FORCE  = 45;

  // 指からカードを押しのける
  cardStates.forEach(state => {
    const dx   = state.x - px;
    const dy   = state.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
    if (dist < RADIUS) {
      const power = (1 - dist / RADIUS) * FORCE;
      state.x = clamp(state.x + (dx / dist) * power, -maxX, maxX);
      state.y = clamp(state.y + (dy / dist) * power, -maxY, maxY);
      applyTransform(state, false);
    }
  });

  // カード同士の重なりを解消（隣接する2枚を互いに反発）
  const SEP_DIST  = 38; // この距離未満なら反発
  const SEP_FORCE = 14;
  for (let a = 0; a < cardStates.length; a++) {
    for (let b = a + 1; b < cardStates.length; b++) {
      const dx   = cardStates[b].x - cardStates[a].x;
      const dy   = cardStates[b].y - cardStates[a].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      if (dist < SEP_DIST) {
        const power = (1 - dist / SEP_DIST) * SEP_FORCE;
        const nx = dx / dist;
        const ny = dy / dist;
        cardStates[a].x = clamp(cardStates[a].x - nx * power, -maxX, maxX);
        cardStates[a].y = clamp(cardStates[a].y - ny * power, -maxY, maxY);
        cardStates[b].x = clamp(cardStates[b].x + nx * power, -maxX, maxX);
        cardStates[b].y = clamp(cardStates[b].y + ny * power, -maxY, maxY);
        applyTransform(cardStates[a], false);
        applyTransform(cardStates[b], false);
      }
    }
  }
}

// ===== カード選択 =====
function selectCard(index) {
  selectedCardIndex = index;
  cardStates.forEach((state, i) => {
    const sel = i === index;
    state.el.classList.toggle('selected', sel);
    state.zIndex = sel ? 100 : state.zIndex;
    applyTransform(state, true);
  });
  document.getElementById('card-selected-name').textContent = '';
  updateFortuneBtn();
}

// ===== 占い済みオーバーレイ =====
function showDailyDoneOverlay() {
  const area = document.getElementById('card-scatter-area');
  if (document.getElementById('daily-done-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'daily-done-overlay';
  overlay.innerHTML = '<div class="daily-done-text"><span>本日デイリー占い済み</span><small>AM5:00 デイリー更新</small></div>';
  area.appendChild(overlay);
}

function updateFortuneBtn() {
  const birthday = document.getElementById('birthday').value;
  const saved     = loadResult();
  const locked    = !!(saved && saved.birthday === birthday);
  document.getElementById('fortune-btn').disabled = locked || !(selectedCardIndex !== null && birthday);
}

// ===== DOM読み込み完了 =====
document.addEventListener('DOMContentLoaded', () => {
  const nameInput     = document.getElementById('player-name');
  const birthdayInput = document.getElementById('birthday');
  const fortuneBtn    = document.getElementById('fortune-btn');
  const shuffleBtn    = document.getElementById('shuffle-btn');

  // キャラクター画像
  document.getElementById('chara-left').src  = omikujiFolder + 'yaemiko01.png';
  document.getElementById('chara-right').src = omikujiFolder + 'mona02.png';

  // 生年月日の max を今日に設定
  birthdayInput.max = new Date().toISOString().slice(0, 10);

  // localStorage 復元（生年月日の初期値は20年前）
  nameInput.value = localStorage.getItem(LS_NAME) || '';
  const storedBirthday = localStorage.getItem(LS_BIRTHDAY);
  if (storedBirthday) {
    birthdayInput.value = storedBirthday;
  } else {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 20);
    birthdayInput.value = d.toISOString().slice(0, 10);
  }
  updateFortuneBtn();

  // カードスキャッタ初期化 → 常に初期シャッフル
  initCardScatter();
  shuffleCards();

  // 今日の結果が保存済みなら自動復元
  const savedBirthday = birthdayInput.value;
  const savedResult   = savedBirthday ? loadResult() : null;
  if (savedResult && savedResult.birthday === savedBirthday) {
    // シャッフル後にカード選択を復元
    setTimeout(() => selectCard(savedResult.cardIndex), 400);
    // 占い済みオーバーレイを表示してカード操作をブロック
    showDailyDoneOverlay();
    // 結果を表示
    const name = nameInput.value.trim();
    runFortune(savedBirthday, name, savedResult.cardIndex, savedResult.isReversed, true);
    document.getElementById('result').style.display = 'block';
  }

  shuffleBtn.addEventListener('click', shuffleCards);

  document.getElementById('save-img-btn').addEventListener('click', captureResult);

  birthdayInput.addEventListener('change', updateFortuneBtn);

  fortuneBtn.addEventListener('click', () => {
    const birthday = birthdayInput.value;
    const name     = nameInput.value.trim();
    if (!birthday)                  { alert('生年月日を入力してください'); return; }
    if (selectedCardIndex === null) { alert('アルカナを選んでください'); return; }

    localStorage.setItem(LS_NAME, name);
    localStorage.setItem(LS_BIRTHDAY, birthday);

    // 朝5時まで同じ結果を使い回す
    const existingResult = loadResult();
    if (existingResult && existingResult.birthday === birthday) {
      runFortune(birthday, name, existingResult.cardIndex, existingResult.isReversed);
      document.getElementById('result').style.display = 'block';
      document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // 新規: isReversed をシードで決定
    const todayStr   = getFortuneDate();
    const seed       = hashCode(todayStr + birthday + selectedCardIndex);
    const isReversed = seededRandom(seed)() < 0.5;

    saveResult(birthday, selectedCardIndex, isReversed);
    runFortune(birthday, name, selectedCardIndex, isReversed);
    document.getElementById('result').style.display = 'block';
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
    showDailyDoneOverlay();
    updateFortuneBtn();
  });
});

// ===== メイン占い処理 =====
function runFortune(birthday, name, cardIndex, isReversed, isRestored = false) {
  const [, month, day] = birthday.split('-').map(Number);
  const playerName = name;
  const todayStr = getFortuneDate();
  const seed     = hashCode(todayStr + birthday);
  const rng      = seededRandom(seed);
  const pick     = (arr) => arr[Math.floor(rng() * arr.length)];

  // 星座（先にpickして値を確定）
  const zodiacKey     = getZodiac(month, day);
  const zodiacData    = horoscope[zodiacKey];
  const zodiacOverall = pick(zodiacData.overall);
  const zodiacLove    = pick(zodiacData.love);
  const zodiacWork    = pick(zodiacData.work);
  const zodiacHealth  = pick(zodiacData.health);
  displayZodiac(zodiacData, zodiacOverall, zodiacLove, zodiacWork, zodiacHealth);

  // バイオリズム
  const bio = calcBiorhythm(birthday);
  displayBiorhythm(bio);

  // タロット
  const card = tarotCards[cardIndex];
  captureCard       = card;
  captureIsReversed = isReversed;
  displayTarot(card, isReversed, isRestored);

  // 運勢レベル
  const fortuneLevel = fortuneLevels[pickWeighted(rng, fortuneWeights)];
  displayFortuneBadge(fortuneLevel);

  // 総合コメント
  const bioAvg        = (bio.physical + bio.emotional + bio.intellectual) / 3;
  const bioTier       = bioAvg > 0.2 ? 'high' : bioAvg < -0.2 ? 'low' : 'mid';
  const overallComment = pick(comments[fortuneLevel][bioTier]);
  document.getElementById('overall-comment').textContent = overallComment;

  // ラッキー
  const luckyIdx = Math.floor(rng() * 3);
  const cardData = isReversed ? card.reversed : card.upright;
  document.getElementById('lucky-color').textContent       = zodiacData.luckyColor[luckyIdx];
  document.getElementById('lucky-item-zodiac').textContent = zodiacData.luckyItem[luckyIdx];
  document.getElementById('lucky-number').textContent      = zodiacData.luckyNumber[luckyIdx];
  document.getElementById('lucky-item-tarot').textContent  = cardData.lucky;
  document.getElementById('lucky-item-tarot-row').style.display = 'block';

  // 挨拶
  document.getElementById('result-greeting').textContent =
    name ? `${name}さんの今日の運勢` : '今日の運勢';

  // Firebase 統計送信（全データ）
  submitOmikujiStats({
    zodiac:          zodiacKey,
    tarot:           card.name,
    isReversed,
    birthday,
    fortuneLevel,
    overallComment,
    zodiacOverall,
    zodiacLove,
    zodiacWork,
    zodiacHealth,
    bioPhysical:     Math.round(bio.physical     * 1000) / 1000,
    bioEmotional:    Math.round(bio.emotional    * 1000) / 1000,
    bioIntellectual: Math.round(bio.intellectual * 1000) / 1000,
  });
}

// ===== 表示関数 =====
function displayZodiac(data, overall, love, work, health) {
  document.getElementById('zodiac-symbol').textContent  = data.symbol;
  document.getElementById('zodiac-name').textContent    = data.name;
  document.getElementById('zodiac-period').textContent  = data.period;
  document.getElementById('zodiac-overall').textContent = overall;
  document.getElementById('zodiac-love').textContent    = love;
  document.getElementById('zodiac-work').textContent    = work;
  document.getElementById('zodiac-health').textContent  = health;
}

function displayBiorhythm(bio) {
  const items = [
    { label: '身体', value: bio.physical },
    { label: '感情', value: bio.emotional },
    { label: '知性', value: bio.intellectual },
  ];
  const container = document.getElementById('biorhythm-bars');
  container.innerHTML = '';
  items.forEach(({ label, value }) => {
    const pct = Math.round((value + 1) / 2 * 100);
    container.innerHTML += `
      <div class="bio-row">
        <span class="bio-label">${label}</span>
        <div class="bio-bar-wrap">
          <div class="bio-bar ${bioClass(value)}" style="width:${pct}%"></div>
        </div>
        <span class="bio-status ${bioClass(value)}">${bioLabel(value)}</span>
      </div>`;
  });
}

function displayTarot(card, isReversed, isRestored = false) {
  const cardEl = document.getElementById('tarot-card');
  cardEl.querySelector('.card-front img').src = card.filename;
  cardEl.querySelector('.card-front img').style.transform = isReversed ? 'rotate(180deg)' : '';
  cardEl.querySelector('.card-back img').src = CARD_BACK;
  cardEl.querySelector('.card-back').style.visibility = '';

  const nameEl = document.getElementById('tarot-name');
  const keyEl  = document.getElementById('tarot-keyword');
  const msgEl  = document.getElementById('tarot-message');

  if (isRestored) {
    // すでに占い済みの復元：カードを最初からフリップ表示
    cardEl.classList.add('flipped');
    cardEl.onclick = null;
    const cardData = isReversed ? card.reversed : card.upright;
    nameEl.textContent = `${card.number} ${card.name}${isReversed ? '（逆位置）' : '（正位置）'}`;
    keyEl.textContent  = cardData.keyword;
    msgEl.textContent  = cardData.message;
    nameEl.classList.add('tarot-flipin');
    keyEl.classList.add('tarot-flipin');
    msgEl.classList.add('tarot-flipin');
  } else {
    cardEl.classList.remove('flipped');
    [nameEl, keyEl, msgEl].forEach(el => {
      el.textContent = '';
      el.classList.remove('tarot-flipin');
    });

    cardEl.onclick = () => {
      if (cardEl.classList.contains('flipped')) return;
      cardEl.onclick = null;
      cardEl.classList.add('flipped');

      const cardData = isReversed ? card.reversed : card.upright;
      // フリップ完了後(1200ms)に名前、さらに1100ms後にキーワード+メッセージをフリップイン
      setTimeout(() => {
        nameEl.textContent = `${card.number} ${card.name}${isReversed ? '（逆位置）' : '（正位置）'}`;
        void nameEl.offsetWidth; // reflow
        nameEl.classList.add('tarot-flipin');
      }, 1200);
      setTimeout(() => {
        keyEl.textContent = cardData.keyword;
        msgEl.textContent = cardData.message;
        void keyEl.offsetWidth;
        keyEl.classList.add('tarot-flipin');
        msgEl.classList.add('tarot-flipin');
      }, 2300);
    };
  }
}

// ===== 画像保存 =====
async function captureResult() {
  if (!captureCard) return;

  const btn = document.getElementById('save-img-btn');
  btn.disabled = true;
  btn.textContent = '生成中…';

  // バッジスタイルマップ
  const badgeStyles = {
    '大吉': 'color:#cc2200;background:rgba(204,34,0,0.08);border:1px solid rgba(204,34,0,0.3)',
    '中吉': 'color:#cc6600;background:rgba(204,102,0,0.08);border:1px solid rgba(204,102,0,0.3)',
    '小吉': 'color:#aa8800;background:rgba(255,204,0,0.15);border:1px solid rgba(255,204,0,0.5)',
    '末吉': 'color:#448844;background:rgba(68,136,68,0.08);border:1px solid rgba(68,136,68,0.3)',
    '凶':   'color:#888888;background:#eeeeee;border:1px solid #dddddd',
  };
  const S  = 'background:#fff;border:1px solid #ddd;border-radius:12px;padding:14px 12px;margin-bottom:10px;';
  const T  = 'color:#aa8800;font-size:0.70rem;letter-spacing:0.15em;text-align:center;border-bottom:1px solid #ddd;padding-bottom:7px;margin-bottom:10px;';
  const R  = 'background:#eee;border-radius:8px;padding:7px 10px;display:flex;gap:8px;margin-bottom:5px;align-items:flex-start;';
  const C  = 'color:#aa8800;font-size:0.72rem;min-width:40px;flex-shrink:0;';
  const LI = 'background:#eee;border-radius:8px;padding:7px 10px;margin-bottom:5px;';
  const LL = 'color:#aa8800;font-size:0.68rem;margin-bottom:2px;';
  const LV = 'font-size:0.85rem;font-weight:bold;';

  const fortune        = document.getElementById('fortune-badge').textContent;
  const overallComment = document.getElementById('overall-comment').textContent;
  const zodiacSymbol   = document.getElementById('zodiac-symbol').textContent;
  const zodiacName     = document.getElementById('zodiac-name').textContent;
  const zodiacPeriod   = document.getElementById('zodiac-period').textContent;
  const bioHTML        = document.getElementById('biorhythm-bars').innerHTML;
  const cardData       = captureIsReversed ? captureCard.reversed : captureCard.upright;
  const imgRotate      = captureIsReversed ? 'transform:rotate(180deg);' : '';
  const today          = getFortuneDate().replace(/-/g, '/');

  const luckyColor      = document.getElementById('lucky-color').textContent;
  const luckyNumber     = document.getElementById('lucky-number').textContent;
  const luckyItemZodiac = document.getElementById('lucky-item-zodiac').textContent;
  const luckyItemTarot  = cardData.lucky || '';

  const rows = ['overall','love','work','health'];
  const rowLabels = ['総合','恋愛','仕事','健康'];
  const zodiacRows = rows.map((r, i) =>
    `<div style="${R}"><span style="${C}">${rowLabels[i]}</span><span style="font-size:0.80rem;">${document.getElementById('zodiac-'+r).textContent}</span></div>`
  ).join('');

  const div = document.createElement('div');
  div.style.cssText = "position:absolute;left:-9999px;top:0;width:700px;background:#f4f4f9;padding:20px 18px;box-sizing:border-box;font-family:'MihoyoZenZero','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#333;line-height:1.7;";

  div.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:center;gap:0;border-bottom:2px solid #ffcc00;padding-bottom:6px;margin-bottom:14px;">
      <img src="${omikujiFolder}yaemiko01.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">
      <div style="text-align:center;flex:1;padding-bottom:4px;">
        <div style="font-size:1.05rem;font-weight:bold;letter-spacing:0.1em;">✦ 原神おみくじ ✦</div>
        <div style="font-size:0.75rem;color:#888;">${today}</div>
      </div>
      <img src="${omikujiFolder}mona02.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <!-- 左列: 運勢・星座・バイオリズム -->
      <div style="flex:1;min-width:0;">
        <div style="${S}">
          <div style="${T}">今日の運勢</div>
          <div style="text-align:center;margin-bottom:8px;">
            <span style="display:inline-block;font-size:1.6rem;font-weight:bold;padding:4px 18px;border-radius:8px;${badgeStyles[fortune]||''}">${fortune}</span>
          </div>
          <p style="font-size:0.82rem;margin:0;">${overallComment}</p>
        </div>
        <div style="${S}">
          <div style="${T}">星座占い</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:1.8rem;">${zodiacSymbol}</span>
            <div><div style="font-weight:bold;font-size:0.9rem;">${zodiacName}</div><div style="font-size:0.70rem;color:#888;">${zodiacPeriod}</div></div>
          </div>
          ${zodiacRows}
        </div>
        <div style="${S}">
          <div style="${T}">バイオリズム</div>
          ${bioHTML}
        </div>
      </div>
      <!-- 右列: アルカナ・ラッキー -->
      <div style="width:250px;flex-shrink:0;">
        <div style="${S}">
          <div style="${T}">アルカナからのメッセージ</div>
          <div style="text-align:center;margin-bottom:8px;">
            <img src="${captureCard.filename}" crossorigin="anonymous" style="width:90px;height:135px;object-fit:cover;border-radius:6px;${imgRotate}">
          </div>
          <div style="font-size:1.0rem;font-weight:bold;text-align:center;margin-bottom:3px;">${captureCard.number} ${captureCard.name}${captureIsReversed?'（逆位置）':'（正位置）'}</div>
          <div style="font-size:0.80rem;color:#888;text-align:center;margin-bottom:8px;">${cardData.keyword}</div>
          <div style="font-size:0.80rem;background:#eee;border-radius:8px;padding:9px 10px;">${cardData.message}</div>
        </div>
        <div style="${S}">
          <div style="${T}">今日のラッキー</div>
          <div style="${LI}"><div style="${LL}">ラッキーカラー</div><div style="${LV}">${luckyColor}</div></div>
          <div style="${LI}"><div style="${LL}">ラッキーナンバー</div><div style="${LV}">${luckyNumber}</div></div>
          <div style="${LI}"><div style="${LL}">ラッキーアイテム（星座）</div><div style="${LV}">${luckyItemZodiac}</div></div>
          ${luckyItemTarot ? `<div style="${LI}"><div style="${LL}">ラッキーアイテム（アルカナ）</div><div style="${LV}">${luckyItemTarot}</div></div>` : ''}
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">
      <img src="https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/00_common/footer_icon/twitter_image.png" crossorigin="anonymous" style="width:20px;height:20px;object-fit:contain;">
      <span style="font-size:0.78rem;color:#555;">@uko_dayo_</span>
    </div>`;

  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { useCORS: true, backgroundColor: '#f4f4f9', scale: 2, logging: false });
    const a = document.createElement('a');
    a.download = `genshin-omikuji-${getFortuneDate()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  } catch (e) {
    alert('画像の保存に失敗しました');
    console.error(e);
  } finally {
    div.remove();
    btn.disabled = false;
    btn.textContent = 'Save Image';
  }
}

function displayFortuneBadge(level) {
  const badge = document.getElementById('fortune-badge');
  badge.textContent = level;
  badge.className   = `fortune-badge fortune-${level}`;
}
