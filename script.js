// script.js
import { tarotCards, CARD_BACK } from './tarot.js';
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

  // ドラッグ状態（コンテナ全体で共有）
  let dragCardIndex  = null;  // 長押し中・ドラッグ中のカードインデックス
  let dragStartX     = 0;
  let dragStartY     = 0;
  let longPressTimer = null;

  tarotCards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'scatter-card';
    div.innerHTML = `<img src="${CARD_BACK}" alt="${card.name}" draggable="false">`;

    div.addEventListener('pointerdown', (e) => {
      if (!isShuffled) return;
      e.stopPropagation();
      if (longPressTimer) clearTimeout(longPressTimer);
      dragCardIndex = i;
      dragStartX    = e.clientX;
      dragStartY    = e.clientY;

      // 350ms 長押しでドラッグモードへ
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        isDraggingAny = true;
        cardStates[i].el.classList.add('dragging');
        cardStates[i].zIndex = 200;
        applyTransform(cardStates[i], false);
      }, 350);
    });

    div.addEventListener('pointerup', () => {
      if (dragCardIndex !== i) return;
      if (longPressTimer !== null) {
        // タイマー発火前に離した → タップ選択
        clearTimeout(longPressTimer);
        longPressTimer = null;
        selectCard(i);
      }
      _endDrag(i);
    });

    div.addEventListener('pointercancel', () => {
      if (dragCardIndex !== i) return;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
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
    if (isDraggingAny) {
      isDraggingAny = false;
      cardStates[i].el.classList.remove('dragging');
    }
    dragCardIndex = null;
  }

  // コンテナ全体でポインター移動を処理
  container.addEventListener('pointermove', (e) => {
    if (!isShuffled || !(e.buttons > 0)) return;

    if (isDraggingAny && dragCardIndex !== null) {
      // 特定カードをドラッグ移動
      const rect = container.getBoundingClientRect();
      const px   = e.clientX - rect.left - rect.width  / 2;
      const py   = e.clientY - rect.top  - rect.height / 2;
      const maxX = rect.width  / 2 - CARD_W / 2 - 4;
      const maxY = rect.height / 2 - CARD_H / 2 - 4;
      cardStates[dragCardIndex].x = clamp(px, -maxX, maxX);
      cardStates[dragCardIndex].y = clamp(py, -maxY, maxY);
      applyTransform(cardStates[dragCardIndex], false);
      return;
    }

    // 少し動いたら長押しタイマーをキャンセルしてプッシュへ移行
    if (longPressTimer !== null) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        dragCardIndex  = null;
      }
    }

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
  const RADIUS = 75;
  const FORCE  = 32;

  cardStates.forEach(state => {
    const dx   = state.x - px;
    const dy   = state.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < RADIUS && dist > 0) {
      const power = (1 - dist / RADIUS) * FORCE;
      state.x = clamp(state.x + (dx / dist) * power, -maxX, maxX);
      state.y = clamp(state.y + (dy / dist) * power, -maxY, maxY);
      applyTransform(state, false); // 即時反映
    }
  });
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
  document.getElementById('card-selected-name').textContent = 'カードを選びました ✓';
  updateFortuneBtn();
}

function updateFortuneBtn() {
  const birthday = document.getElementById('birthday').value;
  document.getElementById('fortune-btn').disabled = !(selectedCardIndex !== null && birthday);
}

// ===== DOM読み込み完了 =====
document.addEventListener('DOMContentLoaded', () => {
  const nameInput     = document.getElementById('player-name');
  const birthdayInput = document.getElementById('birthday');
  const fortuneBtn    = document.getElementById('fortune-btn');
  const shuffleBtn    = document.getElementById('shuffle-btn');

  // localStorage 復元
  nameInput.value     = localStorage.getItem(LS_NAME)     || '';
  birthdayInput.value = localStorage.getItem(LS_BIRTHDAY) || '';

  // カードスキャッタ初期化 → 常に初期シャッフル
  initCardScatter();
  shuffleCards();

  // 今日の結果が保存済みなら自動復元
  const savedBirthday = birthdayInput.value;
  const savedResult   = savedBirthday ? loadResult() : null;
  if (savedResult && savedResult.birthday === savedBirthday) {
    // シャッフル後にカード選択を復元
    setTimeout(() => selectCard(savedResult.cardIndex), 400);
    // 結果を表示
    const name = nameInput.value.trim();
    runFortune(savedBirthday, name, savedResult.cardIndex, savedResult.isReversed);
    document.getElementById('result').style.display = 'block';
  }

  shuffleBtn.addEventListener('click', shuffleCards);

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
  });
});

// ===== メイン占い処理 =====
function runFortune(birthday, name, cardIndex, isReversed) {
  const [, month, day] = birthday.split('-').map(Number);
  const todayStr = getFortuneDate();
  const seed     = hashCode(todayStr + birthday);
  const rng      = seededRandom(seed);
  const pick     = (arr) => arr[Math.floor(rng() * arr.length)];

  // 星座
  const zodiacKey  = getZodiac(month, day);
  const zodiacData = horoscope[zodiacKey];
  displayZodiac(zodiacData, pick);

  // バイオリズム
  displayBiorhythm(calcBiorhythm(birthday));

  // タロット
  const card = tarotCards[cardIndex];
  displayTarot(card, isReversed);
  submitOmikujiStats(zodiacKey, card.name, isReversed);

  // 運勢レベル
  const fortuneLevel = fortuneLevels[pickWeighted(rng, fortuneWeights)];
  displayFortuneBadge(fortuneLevel);

  // 総合コメント
  const bio     = calcBiorhythm(birthday);
  const bioAvg  = (bio.physical + bio.emotional + bio.intellectual) / 3;
  const bioTier = bioAvg > 0.2 ? 'high' : bioAvg < -0.2 ? 'low' : 'mid';
  document.getElementById('overall-comment').textContent = pick(comments[fortuneLevel][bioTier]);

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
}

// ===== 表示関数 =====
function displayZodiac(data, pick) {
  document.getElementById('zodiac-symbol').textContent  = data.symbol;
  document.getElementById('zodiac-name').textContent    = data.name;
  document.getElementById('zodiac-period').textContent  = data.period;
  document.getElementById('zodiac-overall').textContent = pick(data.overall);
  document.getElementById('zodiac-love').textContent    = pick(data.love);
  document.getElementById('zodiac-work').textContent    = pick(data.work);
  document.getElementById('zodiac-health').textContent  = pick(data.health);
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

function displayTarot(card, isReversed) {
  const cardData = isReversed ? card.reversed : card.upright;
  const cardEl   = document.getElementById('tarot-card');
  cardEl.querySelector('.card-front img').src = card.filename;
  cardEl.querySelector('.card-front img').style.transform = isReversed ? 'rotate(180deg)' : '';
  cardEl.querySelector('.card-back img').src  = CARD_BACK;
  cardEl.classList.remove('flipped');
  cardEl.onclick = () => cardEl.classList.add('flipped');

  document.getElementById('tarot-name').textContent    = `${card.number} ${card.name}${isReversed ? '（逆位置）' : '（正位置）'}`;
  document.getElementById('tarot-keyword').textContent = cardData.keyword;
  document.getElementById('tarot-message').textContent = cardData.message;
}

function displayFortuneBadge(level) {
  const badge = document.getElementById('fortune-badge');
  badge.textContent = level;
  badge.className   = `fortune-badge fortune-${level}`;
}
