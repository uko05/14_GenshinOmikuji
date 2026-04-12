// script.js
import { tarotCards, CARD_BACK, omikujiFolder } from './tarot.js';
import { horoscope, getZodiac } from './horoscope.js';
import { comments, fortuneLevels, fortuneWeights, fortuneLevels_en, comments_en } from './comments.js';
import { submitOmikujiStats } from './omikujiStats.js';

// ===== ローカルストレージキー =====
const LS_NAME     = 'genshinOmikuji_name';
const LS_BIRTHDAY = 'genshinOmikuji_birthday';
const LS_RESULT     = 'genshinOmikuji_result';
const LS_LANG       = 'genshinOmikuji_lang';
const LS_COLLECTION = 'genshinOmikuji_collection';

// ===== 状態 =====
let selectedCardIndex = null;
let isShuffled        = false;
let isDraggingAny     = false;
let currentLang       = 'ja';

// ===== 画像保存用キャッシュ =====
let captureCard       = null;
let captureIsReversed = false;
const CARD_W = 60;
const CARD_H = 90;

// ===== 言語再描画用キャッシュ =====
let lastFortuneBirthday    = null;
let lastFortuneName        = '';
let lastFortuneCardIndex   = null;
let lastFortuneIsReversed  = false;
let lastFortuneCardFlipped = false;

// タロット演出タイマー（言語切り替え時にキャンセル）
let tarotRevealT1 = null;
let tarotRevealT2 = null;

// 各カードの位置・角度状態
const cardStates = tarotCards.map((_, i) => ({
  x: 0, y: 0, rotate: 0, zIndex: i, el: null,
}));

// ===== i18n 辞書 =====
const i18n = {
  ja: {
    headerSub:        '星座・バイオリズム・アルカナで今日のあなたを占います',
    cardSelectLabel:  'アルカナをシャッフルして1枚選んでください',
    shuffleBtn:       '🂠 シャッフル',
    labelName:        '名前（任意）',
    labelBirthday:    '生年月日',
    namePlaceholder:  'あなたの名前',
    fortuneBtn:       '今日の運勢を占う',
    sectionFortune:   '今日の運勢',
    sectionZodiac:    '星座占い',
    sectionBio:       'バイオリズム',
    sectionTarot:     'アルカナからのメッセージ',
    sectionLucky:     '今日のラッキー',
    zodiacCatOverall: '総合',
    zodiacCatLove:    '恋愛',
    zodiacCatWork:    '仕事',
    zodiacCatHealth:  '健康',
    tapHint:          'カードをタップしてください',
    luckyColor:       'ラッキーカラー',
    luckyNumber:      'ラッキーナンバー',
    luckyItemZodiac:  'ラッキーアイテム（星座）',
    luckyItemTarot:   'ラッキーアイテム（アルカナ）',
    bioPhysical:      '身体',
    bioEmotional:     '感情',
    bioIntellectual:  '知性',
    bioVeryHigh:      '絶好調',
    bioHigh:          '好調',
    bioMid:           '普通',
    bioLow:           'やや不調',
    bioVeryLow:       '要注意',
    posUpright:       '（正位置）',
    posReversed:      '（逆位置）',
    greeting:         (name) => name ? `${name}さんの今日の運勢` : '今日の運勢',
    alertBirthday:    '生年月日を入力してください',
    alertCard:        'アルカナを選んでください',
    doneTitle:        '本日デイリー占い済み',
    doneSubtitle:     'AM5:00 デイリー更新',
    saveBtn:          'Save Image',
    saving:           '生成中…',
    saveFail:           '画像の保存に失敗しました',
    captureTitle:       '✦ 原神おみくじ ✦',
    sectionCollection:  'アルカナ図鑑',
    collectionProgress: (n) => `${n} / 44 収録`,
    colPosUpright:      '正',
    colPosReversed:     '逆',
  },
  en: {
    headerSub:        'Fortune reading with Zodiac, Biorhythm & Arcana',
    cardSelectLabel:  'Shuffle the Arcana and choose one card',
    shuffleBtn:       '🂠 Shuffle',
    labelName:        'Name (optional)',
    labelBirthday:    'Birthday',
    namePlaceholder:  'Your name',
    fortuneBtn:       'Tell My Fortune',
    sectionFortune:   "Today's Fortune",
    sectionZodiac:    'Zodiac Reading',
    sectionBio:       'Biorhythm',
    sectionTarot:     'Message from the Arcana',
    sectionLucky:     "Today's Lucky",
    zodiacCatOverall: 'Overall',
    zodiacCatLove:    'Love',
    zodiacCatWork:    'Work',
    zodiacCatHealth:  'Health',
    tapHint:          'Tap the card',
    luckyColor:       'Lucky Color',
    luckyNumber:      'Lucky Number',
    luckyItemZodiac:  'Lucky Item (Zodiac)',
    luckyItemTarot:   'Lucky Item (Arcana)',
    bioPhysical:      'Physical',
    bioEmotional:     'Emotional',
    bioIntellectual:  'Intellectual',
    bioVeryHigh:      'Excellent',
    bioHigh:          'Good',
    bioMid:           'Average',
    bioLow:           'Below Avg',
    bioVeryLow:       'Caution',
    posUpright:       ' (Upright)',
    posReversed:      ' (Reversed)',
    greeting:         (name) => name ? `${name}'s Fortune Today` : "Today's Fortune",
    alertBirthday:    'Please enter your birthday.',
    alertCard:        'Please choose an Arcana card.',
    doneTitle:        "Today's reading is done",
    doneSubtitle:     'Resets at 5:00 AM',
    saveBtn:          'Save Image',
    saving:           'Generating…',
    saveFail:           'Failed to save image',
    captureTitle:       '✦ Genshin Omikuji ✦',
    sectionCollection:  'Arcana Collection',
    collectionProgress: (n) => `${n} / 44 collected`,
    colPosUpright:      'U',
    colPosReversed:     'R',
  },
};

function t(key) { return i18n[currentLang][key]; }

// ===== 言語切り替え =====
function applyLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === 'en' ? 'en' : 'ja';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang][key] !== undefined) el.textContent = i18n[lang][key];
  });
  const nameInput = document.getElementById('player-name');
  if (nameInput) nameInput.placeholder = t('namePlaceholder');

  if (lastFortuneBirthday && document.getElementById('result').style.display !== 'none') {
    runFortune(lastFortuneBirthday, lastFortuneName, lastFortuneCardIndex,
               lastFortuneIsReversed, lastFortuneCardFlipped, true);
  }
  renderCollection();
}

// ===== アルカナ図鑑 =====
function loadCollection() {
  return new Set(JSON.parse(localStorage.getItem(LS_COLLECTION) || '[]'));
}

function saveCollection(col) {
  localStorage.setItem(LS_COLLECTION, JSON.stringify([...col]));
}

// 新規追加ならキーを返す、既収録なら null
function addToCollection(cardId, isReversed) {
  const col = loadCollection();
  const key = `${cardId}_${isReversed ? 'reversed' : 'upright'}`;
  if (col.has(key)) return null;
  col.add(key);
  saveCollection(col);
  return key;
}

function renderCollection(newKey = null) {
  const grid    = document.getElementById('collection-grid');
  const countEl = document.getElementById('collection-count');
  if (!grid) return;

  const col = loadCollection();
  if (countEl) {
    countEl.textContent = i18n[currentLang].collectionProgress(col.size);
  }

  grid.innerHTML = '';

  tarotCards.forEach(card => {
    ['upright', 'reversed'].forEach(pos => {
      const isReversed = pos === 'reversed';
      const key        = `${card.id}_${pos}`;
      const collected  = col.has(key);
      const isNew      = key === newKey;

      const item = document.createElement('div');
      item.className = 'col-item' + (collected ? '' : ' col-item-unknown');

      // カードシーン（perspective）
      const scene = document.createElement('div');
      scene.className = 'col-scene';

      const inner = document.createElement('div');
      // 収録済みかつ新規でない → 最初からフリップ（表を表示）
      inner.className = 'col-card-inner' + (collected && !isNew ? ' col-flipped' : '');
      if (isNew) inner.dataset.new = 'true';

      // 裏面
      const backFace = document.createElement('div');
      backFace.className = 'col-card-back';
      const backImg = document.createElement('img');
      backImg.src = CARD_BACK;
      backImg.alt = '';
      backFace.appendChild(backImg);

      // 表面
      const frontFace = document.createElement('div');
      frontFace.className = 'col-card-front';
      const frontImg = document.createElement('img');
      frontImg.src = card.filename;
      frontImg.alt = collected ? card.name : '';
      if (isReversed) frontImg.style.transform = 'rotate(180deg)';
      frontFace.appendChild(frontImg);

      inner.appendChild(backFace);
      inner.appendChild(frontFace);
      scene.appendChild(inner);

      // ④ 収録済みカードをクリックでモーダル表示
      if (collected) {
        scene.addEventListener('click', () => openCollectionModal(card, isReversed));
      }

      item.appendChild(scene);

      // ⑥ 収録済みのみラベル表示（未収録はスペース確保のみ）
      const label = document.createElement('div');
      label.className = 'col-label' + (isNew ? ' col-label-new' : '');
      if (collected) {
        const posStr = isReversed ? i18n[currentLang].colPosReversed : i18n[currentLang].colPosUpright;
        label.textContent = `${card.number} ${posStr}`;
      } else {
        label.style.visibility = 'hidden';
      }
      item.appendChild(label);

      grid.appendChild(item);
    });
  });

  // 新規カード：ビューポートに入ったらズームめくり演出
  if (newKey) {
    const newEls = grid.querySelectorAll('[data-new="true"]');
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const inner = entry.target;
          inner.classList.add('col-reveal');
          inner.addEventListener('animationend', () => {
            inner.classList.remove('col-reveal');
            inner.classList.add('col-flipped');
          }, { once: true });
          obs.unobserve(inner);
        }
      });
    }, { threshold: 0.4 });
    newEls.forEach(el => observer.observe(el));
  }
}

function openCollectionModal(card, isReversed) {
  const isEn     = currentLang === 'en';
  const cardData  = isReversed
    ? (isEn ? card.reversed_en : card.reversed)
    : (isEn ? card.upright_en  : card.upright);
  const cardName  = isEn ? card.nameEn : card.name;
  const posLabel  = isReversed ? t('posReversed') : t('posUpright');
  const imgEl     = document.getElementById('col-modal-img');
  imgEl.src       = card.filename;
  imgEl.style.transform = isReversed ? 'rotate(180deg)' : '';
  document.getElementById('col-modal-name').textContent    = `${card.number} ${cardName} ${posLabel}`;
  document.getElementById('col-modal-keyword').textContent = cardData.keyword;
  document.getElementById('col-modal').style.display       = 'flex';
}

function initLangSwitch() {
  currentLang = localStorage.getItem(LS_LANG) || 'ja';
  document.querySelectorAll('input[name="lang"]').forEach(r => {
    r.checked = r.value === currentLang;
    r.addEventListener('change', () => {
      currentLang = r.value;
      localStorage.setItem(LS_LANG, currentLang);
      applyLang(currentLang);
    });
  });
  applyLang(currentLang);
}

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
  if (v > 0.5)  return t('bioVeryHigh');
  if (v > 0.1)  return t('bioHigh');
  if (v > -0.1) return t('bioMid');
  if (v > -0.5) return t('bioLow');
  return t('bioVeryLow');
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

  let dragCardIndex = null;
  let dragStartX    = 0;
  let dragStartY    = 0;

  tarotCards.forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'scatter-card';
    div.innerHTML = `<img src="${CARD_BACK}" alt="${card.name}" draggable="false">`;

    div.addEventListener('pointerdown', (e) => {
      if (!isShuffled) return;
      dragCardIndex = i;
      dragStartX    = e.clientX;
      dragStartY    = e.clientY;
      isDraggingAny = false;
      cardStates[i].zIndex = tarotCards.length + 10;
      applyTransform(cardStates[i], false);
    });

    div.addEventListener('pointerup', () => {
      if (dragCardIndex !== i) return;
      if (!isDraggingAny) selectCard(i);
      _endDrag();
    });

    cardStates[i].el     = div;
    cardStates[i].x      = 0;
    cardStates[i].y      = 0;
    cardStates[i].rotate = (Math.random() - 0.5) * 8;
    cardStates[i].zIndex = i;
    applyTransform(cardStates[i], false);
    container.appendChild(div);
  });

  function _endDrag() {
    if (isDraggingAny && dragCardIndex !== null) {
      cardStates[dragCardIndex].el.classList.remove('dragging');
    }
    isDraggingAny = false;
    dragCardIndex = null;
  }

  container.addEventListener('pointermove', (e) => {
    if (!isShuffled || !(e.buttons > 0)) return;

    if (dragCardIndex !== null && !isDraggingAny) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 6) {
        isDraggingAny = true;
        cardStates[dragCardIndex].el.classList.add('dragging');
      }
    }

    if (isDraggingAny && dragCardIndex !== null) {
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

    pushCards(e, container);
  });

  container.addEventListener('pointerup', _endDrag);
  container.addEventListener('pointerleave', () => { if (isDraggingAny) _endDrag(); });

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

  cardStates.forEach((state, i) => {
    state.x      = (Math.random() - 0.5) * 10;
    state.y      = (Math.random() - 0.5) * 10;
    state.rotate = (Math.random() - 0.5) * 15;
    state.zIndex = i;
    state.el.classList.remove('selected');
    applyTransform(state, false);
  });

  setTimeout(() => {
    cardStates.forEach((state) => {
      state.x      = (Math.random() * 2 - 1) * maxX;
      state.y      = (Math.random() * 2 - 1) * maxY;
      state.rotate = (Math.random() * 2 - 1) * 65;
      state.zIndex = Math.floor(Math.random() * tarotCards.length);
      applyTransform(state, true);
    });
    isShuffled = true;

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

  const SEP_DIST  = 38;
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
  overlay.innerHTML = `<div class="daily-done-text"><span data-i18n="doneTitle">${t('doneTitle')}</span><small data-i18n="doneSubtitle">${t('doneSubtitle')}</small></div>`;
  area.appendChild(overlay);
}

function isDebugMode() {
  return document.getElementById('player-name').value.trim() === 'uko@debug';
}

function updateFortuneBtn() {
  const birthday = document.getElementById('birthday').value;
  const saved     = loadResult();
  const locked    = !isDebugMode() && !!(saved && saved.birthday === birthday);
  document.getElementById('fortune-btn').disabled = locked || !(selectedCardIndex !== null && birthday);
}

// ===== DOM読み込み完了 =====
document.addEventListener('DOMContentLoaded', () => {
  const nameInput     = document.getElementById('player-name');
  const birthdayInput = document.getElementById('birthday');
  const shuffleBtn    = document.getElementById('shuffle-btn');

  // 言語切り替え初期化
  initLangSwitch();

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
    setTimeout(() => selectCard(savedResult.cardIndex), 400);
    if (!isDebugMode()) showDailyDoneOverlay();
    const name = nameInput.value.trim();
    runFortune(savedBirthday, name, savedResult.cardIndex, savedResult.isReversed, true);
    document.getElementById('result').style.display = 'block';
  }

  renderCollection();

  document.querySelector('.col-modal-backdrop').addEventListener('click', () => {
    document.getElementById('col-modal').style.display = 'none';
  });
  document.querySelector('.col-modal-close').addEventListener('click', () => {
    document.getElementById('col-modal').style.display = 'none';
  });

  shuffleBtn.addEventListener('click', shuffleCards);
  document.getElementById('save-img-btn').addEventListener('click', captureResult);
  birthdayInput.addEventListener('change', updateFortuneBtn);
  nameInput.addEventListener('input', updateFortuneBtn);

  document.getElementById('fortune-btn').addEventListener('click', () => {
    const birthday = birthdayInput.value;
    const name     = nameInput.value.trim();
    if (!birthday)                  { alert(t('alertBirthday')); return; }
    if (selectedCardIndex === null) { alert(t('alertCard')); return; }

    localStorage.setItem(LS_NAME, name);
    localStorage.setItem(LS_BIRTHDAY, birthday);

    const debug = isDebugMode();

    // 通常モード: 当日結果があれば再表示して終了
    if (!debug) {
      const existingResult = loadResult();
      if (existingResult && existingResult.birthday === birthday) {
        runFortune(birthday, name, existingResult.cardIndex, existingResult.isReversed);
        document.getElementById('result').style.display = 'block';
        document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    const todayStr   = getFortuneDate();
    const seed       = hashCode(todayStr + birthday + selectedCardIndex);
    const isReversed = seededRandom(seed)() < 0.5;

    saveResult(birthday, selectedCardIndex, isReversed);
    runFortune(birthday, name, selectedCardIndex, isReversed);
    document.getElementById('result').style.display = 'block';
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
    if (!debug) {
      showDailyDoneOverlay();
      updateFortuneBtn();
    }
  });
});

// ===== メイン占い処理 =====
// skipStats=true のとき Firebase 送信・状態更新をスキップ（言語再描画用）
function runFortune(birthday, name, cardIndex, isReversed, isRestored = false, skipStats = false) {
  if (!skipStats) {
    lastFortuneBirthday    = birthday;
    lastFortuneName        = name;
    lastFortuneCardIndex   = cardIndex;
    lastFortuneIsReversed  = isReversed;
    lastFortuneCardFlipped = isRestored;
  }

  const [, month, day] = birthday.split('-').map(Number);
  const todayStr = getFortuneDate();
  const seed     = hashCode(todayStr + birthday);
  const rng      = seededRandom(seed);
  const pick     = (arr) => arr[Math.floor(rng() * arr.length)];
  const isEn     = currentLang === 'en';

  // 星座（日英で同数の RNG 消費 → fortune level が同じになる）
  const zodiacKey  = getZodiac(month, day);
  const zodiacData = horoscope[zodiacKey];
  const zodiacOverall = pick(isEn ? zodiacData.overall_en : zodiacData.overall);
  const zodiacLove    = pick(isEn ? zodiacData.love_en    : zodiacData.love);
  const zodiacWork    = pick(isEn ? zodiacData.work_en    : zodiacData.work);
  const zodiacHealth  = pick(isEn ? zodiacData.health_en  : zodiacData.health);
  displayZodiac(zodiacData, zodiacOverall, zodiacLove, zodiacWork, zodiacHealth);

  // バイオリズム
  const bio = calcBiorhythm(birthday);
  displayBiorhythm(bio);

  // タロット
  const card = tarotCards[cardIndex];
  captureCard       = card;
  captureIsReversed = isReversed;
  displayTarot(card, isReversed, isRestored);

  // 運勢レベル（日英ともに同じ RNG 位置で決定）
  const fortuneLevel = fortuneLevels[pickWeighted(rng, fortuneWeights)];
  displayFortuneBadge(fortuneLevel);

  // 総合コメント
  const bioAvg     = (bio.physical + bio.emotional + bio.intellectual) / 3;
  const bioTier    = bioAvg > 0.2 ? 'high' : bioAvg < -0.2 ? 'low' : 'mid';
  const commentPool = isEn ? comments_en : comments;
  const overallComment = pick(commentPool[fortuneLevel][bioTier]);
  document.getElementById('overall-comment').textContent = overallComment;

  // ラッキー
  const luckyIdx = Math.floor(rng() * 3);
  const cardData = isReversed
    ? (isEn ? card.reversed_en : card.reversed)
    : (isEn ? card.upright_en  : card.upright);
  document.getElementById('lucky-color').textContent       = (isEn ? zodiacData.luckyColor_en : zodiacData.luckyColor)[luckyIdx];
  document.getElementById('lucky-item-zodiac').textContent = (isEn ? zodiacData.luckyItem_en  : zodiacData.luckyItem)[luckyIdx];
  document.getElementById('lucky-number').textContent      = zodiacData.luckyNumber[luckyIdx];
  document.getElementById('lucky-item-tarot').textContent  = cardData.lucky;
  document.getElementById('lucky-item-tarot-row').style.display = 'block';

  // 挨拶
  document.getElementById('result-greeting').textContent = i18n[currentLang].greeting(name);

  // Firebase 統計送信（新規占いのみ）
  if (!skipStats) {
    submitOmikujiStats({
      zodiac:          zodiacKey,
      tarot:           card.name,
      isReversed,
      playerName:      name,
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
}

// ===== 表示関数 =====
function displayZodiac(data, overall, love, work, health) {
  document.getElementById('zodiac-symbol').textContent  = data.symbol;
  document.getElementById('zodiac-name').textContent    = currentLang === 'en' ? data.nameEn   : data.name;
  document.getElementById('zodiac-period').textContent  = currentLang === 'en' ? data.periodEn : data.period;
  document.getElementById('zodiac-overall').textContent = overall;
  document.getElementById('zodiac-love').textContent    = love;
  document.getElementById('zodiac-work').textContent    = work;
  document.getElementById('zodiac-health').textContent  = health;
}

function displayBiorhythm(bio) {
  const items = [
    { label: t('bioPhysical'),     value: bio.physical },
    { label: t('bioEmotional'),    value: bio.emotional },
    { label: t('bioIntellectual'), value: bio.intellectual },
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
  // 保留中の演出タイマーをキャンセル（言語切り替え時の二重更新防止）
  if (tarotRevealT1) { clearTimeout(tarotRevealT1); tarotRevealT1 = null; }
  if (tarotRevealT2) { clearTimeout(tarotRevealT2); tarotRevealT2 = null; }

  const cardEl = document.getElementById('tarot-card');
  cardEl.querySelector('.card-front img').src = card.filename;
  cardEl.querySelector('.card-front img').style.transform = isReversed ? 'rotate(180deg)' : '';
  cardEl.querySelector('.card-back img').src = CARD_BACK;
  cardEl.querySelector('.card-back').style.visibility = '';

  const nameEl = document.getElementById('tarot-name');
  const keyEl  = document.getElementById('tarot-keyword');
  const msgEl  = document.getElementById('tarot-message');

  const isEn      = currentLang === 'en';
  const cardData  = isReversed
    ? (isEn ? card.reversed_en : card.reversed)
    : (isEn ? card.upright_en  : card.upright);
  const cardName    = isEn ? card.nameEn : card.name;
  const posLabel    = isReversed ? t('posReversed') : t('posUpright');
  const displayName = `${card.number} ${cardName}${posLabel}`;

  if (isRestored) {
    cardEl.classList.add('flipped');
    cardEl.onclick = null;
    nameEl.textContent = displayName;
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
      lastFortuneCardFlipped = true;

      // コレクションに追加し、新規なら図鑑を再描画（スクロール演出付き）
      const newKey = addToCollection(card.id, isReversed);
      renderCollection(newKey);

      tarotRevealT1 = setTimeout(() => {
        tarotRevealT1 = null;
        nameEl.textContent = displayName;
        void nameEl.offsetWidth;
        nameEl.classList.add('tarot-flipin');
      }, 1200);
      tarotRevealT2 = setTimeout(() => {
        tarotRevealT2 = null;
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
  btn.textContent = t('saving');

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

  const badgeEl      = document.getElementById('fortune-badge');
  const fortune      = badgeEl.textContent;
  const fortuneLevel = badgeEl.dataset.level;
  const isEn         = currentLang === 'en';
  const cardData     = captureIsReversed
    ? (isEn ? captureCard.reversed_en : captureCard.reversed)
    : (isEn ? captureCard.upright_en  : captureCard.upright);
  const imgRotate    = captureIsReversed ? 'transform:rotate(180deg);' : '';
  const today        = getFortuneDate().replace(/-/g, '/');
  const tarotDisplayName = `${captureCard.number} ${isEn ? captureCard.nameEn : captureCard.name}${captureIsReversed ? t('posReversed') : t('posUpright')}`;

  const overallComment  = document.getElementById('overall-comment').textContent;
  const zodiacSymbol    = document.getElementById('zodiac-symbol').textContent;
  const zodiacName      = document.getElementById('zodiac-name').textContent;
  const zodiacPeriod    = document.getElementById('zodiac-period').textContent;
  const bioHTML         = document.getElementById('biorhythm-bars').innerHTML;
  const luckyColor      = document.getElementById('lucky-color').textContent;
  const luckyNumber     = document.getElementById('lucky-number').textContent;
  const luckyItemZodiac = document.getElementById('lucky-item-zodiac').textContent;
  const luckyItemTarot  = cardData.lucky || '';

  const rows      = ['overall', 'love', 'work', 'health'];
  const rowLabels = [t('zodiacCatOverall'), t('zodiacCatLove'), t('zodiacCatWork'), t('zodiacCatHealth')];
  const zodiacRows = rows.map((r, i) =>
    `<div style="${R}"><span style="${C}">${rowLabels[i]}</span><span style="font-size:0.80rem;">${document.getElementById('zodiac-' + r).textContent}</span></div>`
  ).join('');

  const div = document.createElement('div');
  div.style.cssText = "position:absolute;left:-9999px;top:0;width:700px;background:#f4f4f9;padding:20px 18px;box-sizing:border-box;font-family:'MihoyoZenZero','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#333;line-height:1.7;";

  div.innerHTML = `
    <div style="display:flex;align-items:flex-end;justify-content:center;gap:0;border-bottom:2px solid #ffcc00;padding-bottom:6px;margin-bottom:14px;">
      <img src="${omikujiFolder}yaemiko01.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">
      <div style="text-align:center;flex:1;padding-bottom:4px;">
        <div style="font-size:1.05rem;font-weight:bold;letter-spacing:0.1em;">${t('captureTitle')}</div>
        <div style="font-size:0.75rem;color:#888;">${today}</div>
      </div>
      <img src="${omikujiFolder}mona02.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">
    </div>
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div style="${S}">
          <div style="${T}">${t('sectionFortune')}</div>
          <div style="text-align:center;margin-bottom:8px;">
            <span style="display:inline-block;font-size:1.6rem;font-weight:bold;padding:4px 18px;border-radius:8px;${badgeStyles[fortuneLevel] || ''}">${fortune}</span>
          </div>
          <p style="font-size:0.82rem;margin:0;">${overallComment}</p>
        </div>
        <div style="${S}">
          <div style="${T}">${t('sectionZodiac')}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:1.8rem;">${zodiacSymbol}</span>
            <div><div style="font-weight:bold;font-size:0.9rem;">${zodiacName}</div><div style="font-size:0.70rem;color:#888;">${zodiacPeriod}</div></div>
          </div>
          ${zodiacRows}
        </div>
        <div style="${S}">
          <div style="${T}">${t('sectionBio')}</div>
          ${bioHTML}
        </div>
      </div>
      <div style="width:250px;flex-shrink:0;">
        <div style="${S}">
          <div style="${T}">${t('sectionTarot')}</div>
          <div style="text-align:center;margin-bottom:8px;">
            <img src="${captureCard.filename}" crossorigin="anonymous" style="width:90px;height:135px;object-fit:cover;border-radius:6px;${imgRotate}">
          </div>
          <div style="font-size:1.0rem;font-weight:bold;text-align:center;margin-bottom:3px;">${tarotDisplayName}</div>
          <div style="font-size:0.80rem;color:#888;text-align:center;margin-bottom:8px;">${cardData.keyword}</div>
          <div style="font-size:0.80rem;background:#eee;border-radius:8px;padding:9px 10px;">${cardData.message}</div>
        </div>
        <div style="${S}">
          <div style="${T}">${t('sectionLucky')}</div>
          <div style="${LI}"><div style="${LL}">${t('luckyColor')}</div><div style="${LV}">${luckyColor}</div></div>
          <div style="${LI}"><div style="${LL}">${t('luckyNumber')}</div><div style="${LV}">${luckyNumber}</div></div>
          <div style="${LI}"><div style="${LL}">${t('luckyItemZodiac')}</div><div style="${LV}">${luckyItemZodiac}</div></div>
          ${luckyItemTarot ? `<div style="${LI}"><div style="${LL}">${t('luckyItemTarot')}</div><div style="${LV}">${luckyItemTarot}</div></div>` : ''}
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
    alert(t('saveFail'));
    console.error(e);
  } finally {
    div.remove();
    btn.disabled = false;
    btn.textContent = t('saveBtn');
  }
}

function displayFortuneBadge(level) {
  const badge = document.getElementById('fortune-badge');
  badge.textContent   = currentLang === 'en' ? fortuneLevels_en[fortuneLevels.indexOf(level)] : level;
  badge.dataset.level = level;
  badge.className     = `fortune-badge fortune-${level}`;
}
