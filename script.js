// script.js
import { tarotCards, CARD_BACK, omikujiFolder } from './tarot.js';
import { horoscope, getZodiac } from './horoscope.js';
import { comments, fortuneLevels, fortuneWeights, fortuneLevels_en, comments_en } from './comments.js';
import { submitOmikujiStats } from './omikujiStats.js';
import { initFeed, submitFeedEntry, submitAchievementFeedEntry } from './feed.js?v=6';
import { ACHIEVEMENT_GROUPS, ALL_ACHIEVEMENTS } from './achievements.js';
import { store, loadUserDataFromFirestore, scheduleSync, getLastVisit, setLastVisit, getUserId } from './userData.js';
import { db } from './firebaseConfig.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ===== 干支データ =====
const ETO = [
  { ja: '子（ねずみ）', en: 'Rat (子)',      descJa: '知恵者で器用、社交的な性格',             descEn: 'Clever and resourceful with a social nature' },
  { ja: '丑（うし）',   en: 'Ox (丑)',       descJa: '忍耐強く勤勉、信頼される存在',           descEn: 'Patient and hardworking, a trusted presence' },
  { ja: '寅（とら）',   en: 'Tiger (寅)',    descJa: '勇敢で行動力があり、リーダー気質',       descEn: 'Brave and decisive with natural leadership' },
  { ja: '卯（うさぎ）', en: 'Rabbit (卯)',   descJa: '温和で平和的、直感が鋭い',               descEn: 'Gentle and peaceful with sharp intuition' },
  { ja: '辰（たつ）',   en: 'Dragon (辰)',   descJa: 'カリスマ的で情熱的、大きな夢を持つ',     descEn: 'Charismatic and passionate, a visionary dreamer' },
  { ja: '巳（へび）',   en: 'Snake (巳)',    descJa: '思慮深く神秘的、深い洞察力を持つ',       descEn: 'Thoughtful and mysterious with deep insight' },
  { ja: '午（うま）',   en: 'Horse (午)',    descJa: '自由奔放で活発、仲間思い',               descEn: 'Free-spirited and energetic, loyal to friends' },
  { ja: '未（ひつじ）', en: 'Goat (未)',     descJa: '温厚で芸術的センスがあり、優しい',       descEn: 'Gentle with artistic sensibility and warmth' },
  { ja: '申（さる）',   en: 'Monkey (申)',   descJa: '好奇心旺盛で機転が利き、器用',           descEn: 'Curious and witty with nimble hands and mind' },
  { ja: '酉（とり）',   en: 'Rooster (酉)', descJa: '几帳面で誠実、完璧主義な一面も',         descEn: 'Meticulous and sincere with a perfectionist streak' },
  { ja: '戌（いぬ）',   en: 'Dog (戌)',      descJa: '忠実で誠実、面倒見が良い',               descEn: 'Loyal and sincere, always there for others' },
  { ja: '亥（いのしし）', en: 'Pig (亥)',    descJa: '正直で純粋、情熱と粘り強さを持つ',       descEn: 'Honest and pure with passion and perseverance' },
];

// ===== 厄年データ（数え年） =====
const YAKUDOSHI = {
  male: [
    { age: 24, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 25, typeJa: '本厄',       typeEn: 'Yakudoshi',          dai: false },
    { age: 26, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
    { age: 41, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 42, typeJa: '本厄（大厄）', typeEn: 'Yakudoshi (Major)', dai: true  },
    { age: 43, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
    { age: 60, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 61, typeJa: '本厄',       typeEn: 'Yakudoshi',          dai: false },
    { age: 62, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
  ],
  female: [
    { age: 18, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 19, typeJa: '本厄',       typeEn: 'Yakudoshi',          dai: false },
    { age: 20, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
    { age: 32, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 33, typeJa: '本厄（大厄）', typeEn: 'Yakudoshi (Major)', dai: true  },
    { age: 34, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
    { age: 36, typeJa: '前厄',       typeEn: 'Pre-Yakudoshi',      dai: false },
    { age: 37, typeJa: '本厄',       typeEn: 'Yakudoshi',          dai: false },
    { age: 38, typeJa: '後厄',       typeEn: 'Post-Yakudoshi',     dai: false },
  ],
};

// ===== ローカルストレージキー（lastVisit のみ残す） =====
// 他のデータはすべて Firestore（store 経由）で管理する

// ===== 状態 =====
let selectedCardIndex = null;
let isShuffled        = false;
let isDraggingAny     = false;
let currentLang       = 'ja';
// シャッフル時に決定した各カードの正逆（index → boolean）
let shuffleOrientations = [];

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
// 通常22枚 + 奈落スロット1枚（index 22）。七星（index 23）は物理カードなし
const cardStates = tarotCards.slice(0, 23).map((_, i) => ({
  x: 0, y: 0, rotate: 0, zIndex: i, el: null,
}));

// ===== i18n 辞書 =====
const i18n = {
  ja: {
    headerSub:        '星座・バイオリズム・アルカナで今日のあなたを占います',
    accountLinkLabel: 'アカウント登録はこちら（登録は任意です）',
    cardSelectLabel:  'アルカナをシャッフルして1枚選んでください',
    shuffleBtn:       'シャッフル',
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
    doneSubtitle:     '毎日0:00 デイリー更新',
    streakMsg:        (n) => `🔥 ${n}日連続おみくじ中！`,
    saveBtn:          'Save Image',
    saving:           '生成中…',
    saveFail:           '画像の保存に失敗しました',
    captureTitle:       '✦ 原神おみくじ ✦',
    sectionCollection:   'アルカナ図鑑',
    collectionProgress:  (n) => `${n} / ${totalCollectibleCount()} 収録`,
    colPosUpright:       '正',
    colPosReversed:      '逆',
    sectionAchievement:  'アチーブメント',
    achievementProgress: (n, t) => `${n} / ${t} 解放`,
    saveCollection:      '図鑑を画像保存',
    saveAchievement:     '実績を画像保存',
    achUnlocked:         '✦ アチーブメント解放！',
    descTarot:   'シャッフルして引いたカードが、今日のあなたへのメッセージを語ります',
    descFortune: '生年月日と選んだアルカナから、今日の総合運をお伝えします',
    descZodiac:  '生年月日から星座を判定し、総合・恋愛・仕事・健康の4項目を占います',
    descBio:     '身体(23日)・感情(28日)・知性(33日)の3つのリズムで今日のコンディションを算出します',
    labelGender:  '性別（任意）',
    genderMale:   '男性',
    genderFemale: '女性',
    extraSummary:   '干支・厄年を確認する',
    etoLabel:       '干支',
    yakuThisLabel:  '今年の厄年',
    yakuNextLabel:  '来年の厄年',
    yakuSafe:       '平穏な年です',
    yakuNoGender:   '性別を選択してください',
    yakuFutureLabel: '次の本厄',
    yakuAllPassed:   'これ以降の本厄はありません',
    feedTitle:       'みんなの結果（24時間以内）',
    hideFeedLabel:   '自分の占いを公開しない',
    feedEmpty:       'まだ結果がありません',
    notifPanelTitle: 'いいね履歴',
    notifPanelEmpty: 'まだいいねはありません',
    avatarNudgeText: 'アカウント登録することで変更できます',
    avatarNudgeBtn:  'アカウント登録へ',
  },
  en: {
    headerSub:        'Fortune reading with Zodiac, Biorhythm & Arcana',
    accountLinkLabel: 'Register an account here (optional)',
    cardSelectLabel:  'Shuffle the Arcana and choose one card',
    shuffleBtn:       'Shuffle',
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
    doneSubtitle:     'Resets daily at midnight',
    streakMsg:        (n) => `🔥 ${n}-day streak!`,
    saveBtn:          'Save Image',
    saving:           'Generating…',
    saveFail:           'Failed to save image',
    captureTitle:       '✦ Genshin Omikuji ✦',
    sectionCollection:   'Arcana Collection',
    collectionProgress:  (n) => `${n} / ${totalCollectibleCount()} collected`,
    colPosUpright:       'U',
    colPosReversed:      'R',
    sectionAchievement:  'Achievements',
    achievementProgress: (n, t) => `${n} / ${t} unlocked`,
    saveCollection:      'Save Collection',
    saveAchievement:     'Save Achievements',
    achUnlocked:         '✦ Achievement Unlocked!',
    descTarot:   'The card you drew speaks a message for you today',
    descFortune: 'Your overall fortune derived from your birthday and chosen Arcana',
    descZodiac:  'Fortune in 4 areas — Overall, Love, Work & Health — based on your zodiac sign',
    descBio:     'Your daily condition via 3 rhythms: Physical (23d), Emotional (28d), Intellectual (33d)',
    labelGender:  'Gender (optional)',
    genderMale:   'Male',
    genderFemale: 'Female',
    extraSummary:   'View Zodiac Animal & Unlucky Years',
    etoLabel:       'Chinese Zodiac',
    yakuThisLabel:  'This Year',
    yakuNextLabel:  'Next Year',
    yakuSafe:       'Peaceful year',
    yakuNoGender:   'Select a gender',
    yakuFutureLabel: 'Next Yakudoshi',
    yakuAllPassed:   'All unlucky years have passed',
    feedTitle:       "Everyone's Results (last 24h)",
    hideFeedLabel:   "Don't publish my fortune",
    feedEmpty:       'No results yet',
    notifPanelTitle: 'Like History',
    notifPanelEmpty: 'No likes yet',
    avatarNudgeText: 'Register an account to customize this.',
    avatarNudgeBtn:  'Go to Registration',
  },
};

function t(key) { return i18n[currentLang][key]; }

// ===== 連続ログインストリーク =====
function updateStreak() {
  const today = getFortuneDate();
  const saved = store.streak;
  let count    = 1;
  let isReturn = false;
  if (saved) {
    if (saved.lastDate === today)               count = saved.count;       // 今日すでにカウント済み
    else if (saved.lastDate === getYesterday()) count = saved.count + 1;   // 昨日引いた → 連続
    else if (saved.count > 0)                  isReturn = true;            // 途切れて復帰
  }
  store.streak = { count, lastDate: today };
  return { count, isReturn };
}

function renderStreak() {
  const el = document.getElementById('streak-display');
  if (!el) return;
  const saved = store.streak;
  if (!saved || saved.count < 2) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.textContent = i18n[currentLang].streakMsg(saved.count);
}

// ===== アチーブメント =====
const ACH_STATS_DEFAULTS = {
  totalCount: 0, maxStreak: 0, hadReturn: false,
  fortuneLevelCounts: {}, zodiacsSeen: [],
  hadBioPeak: false, hadBioLow: false, hadBioCritical: false,
  hadNoName: false, hadName: false, hadDebug: false, hadUkoSaba: false,
  hadMidnight: false, hadEarlyMorning: false,
  hadOmisoka: false, hadNewYear: false, hadBirthday: false,
  hadRareGood: false, hadRareBad: false,
};

function loadAchStats() {
  return Object.assign({}, ACH_STATS_DEFAULTS, store.achStats || {});
}

function updateAchievementStats({ name, birthday, fortuneLevel, zodiacKey, bio, isDebug, streakCount }) {
  const stats = loadAchStats();

  if (isDebug) {
    stats.hadDebug = true;
    store.achStats = stats;
    scheduleSync();
    return;
  }

  stats.totalCount++;
  if (streakCount > stats.maxStreak) stats.maxStreak = streakCount;

  // ストリーク途切れ復帰フラグ（呼び出し元で渡せないので再計算）
  const streakSaved = store.streak;
  if (streakSaved && streakSaved.count === 1 && stats.totalCount > 1) stats.hadReturn = true;

  // 運勢レベル
  if (fortuneLevel) {
    stats.fortuneLevelCounts[fortuneLevel] = (stats.fortuneLevelCounts[fortuneLevel] || 0) + 1;
  }

  // 星座
  if (zodiacKey && !stats.zodiacsSeen.includes(zodiacKey)) stats.zodiacsSeen.push(zodiacKey);

  // バイオリズム
  if (bio) {
    if (bio.physical >= 0.5 && bio.emotional >= 0.5 && bio.intellectual >= 0.5)   stats.hadBioPeak     = true;
    if (bio.physical <= -0.5 && bio.emotional <= -0.5 && bio.intellectual <= -0.5) stats.hadBioLow      = true;
    if (Math.abs(bio.physical) < 0.1 || Math.abs(bio.emotional) < 0.1 || Math.abs(bio.intellectual) < 0.1) stats.hadBioCritical = true;
  }

  // 名前
  if (name) stats.hadName = true; else stats.hadNoName = true;
  if (name && name.startsWith('うこ鯖公認の')) stats.hadUkoSaba = true;

  // 時刻
  const hour = new Date().getHours();
  if (hour < 2)              stats.hadMidnight    = true;
  if (hour >= 5 && hour < 7) stats.hadEarlyMorning = true;

  // 日付
  const now   = new Date();
  const mon   = now.getMonth() + 1;
  const day   = now.getDate();
  if (mon === 12 && day === 31) stats.hadOmisoka = true;
  if (mon === 1  && day === 1)  stats.hadNewYear  = true;

  // 誕生日
  if (birthday) {
    const [, bm, bd] = birthday.split('-').map(Number);
    if (bm === mon && bd === day) stats.hadBirthday = true;
  }

  store.achStats = stats;
  scheduleSync();
}

function loadUnlocked() {
  return store.achievements; // store の Set を直接返す（変更は store に即反映）
}

function checkAndUnlockAchievements(silent = false, toastDelay = 0) {
  const unlocked = loadUnlocked();
  const stats    = loadAchStats();
  const col      = loadCollection();
  const newIds   = [];

  for (const ach of ALL_ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.check(stats, col)) {
      unlocked.add(ach.id);
      newIds.push(ach.id);
    }
  }

  if (newIds.length > 0) {
    // store.achievements は loadUnlocked() が返した同一参照なので既に更新済み
    scheduleSync();
    if (!silent) {
      const show = () => {
        newIds.forEach(id => showAchToast(id));
        newIds.forEach((id) => {
          const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
          if (!ach) return;
          submitAchievementFeedEntry({
            name: store.name,
            achievementName: currentLang === 'en' ? ach.nameEn : ach.name,
            rarity: ach.rarity || 'bronze',
          });
        });
      };
      if (toastDelay > 0) setTimeout(show, toastDelay);
      else show();
    }
  }
}

// ===== アチーブメントトースト =====
let achToastQueue = [];
let achToastBusy  = false;

function showAchToast(achId) {
  achToastQueue.push(achId);
  if (!achToastBusy) processToastQueue();
}

function processToastQueue() {
  if (achToastQueue.length === 0) { achToastBusy = false; return; }
  achToastBusy = true;

  const achId = achToastQueue.shift();
  const ach   = ALL_ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach) { processToastQueue(); return; }

  const isEn   = currentLang === 'en';
  const toast  = document.getElementById('ach-toast');
  if (!toast) { achToastBusy = false; return; }

  const rarity = ach.rarity || 'bronze';
  document.getElementById('ach-toast-label').textContent     = t('achUnlocked');
  document.getElementById('ach-toast-name').textContent      = isEn ? ach.nameEn      : ach.name;
  document.getElementById('ach-toast-condition').textContent = isEn ? ach.conditionEn : ach.condition;

  toast.style.display = 'block';
  // レアリティクラスをリセットして付け直す
  toast.classList.remove('rarity-bronze','rarity-silver','rarity-gold','rarity-legend');
  toast.classList.add(`rarity-${rarity}`);
  void toast.offsetWidth; // reflow
  toast.classList.remove('ach-toast-hide');
  toast.classList.add('ach-toast-show');

  setTimeout(() => {
    toast.classList.remove('ach-toast-show');
    toast.classList.add('ach-toast-hide');
    // 退場アニメーション(0.42s)完了後に非表示にして次のトーストへ
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('ach-toast-hide');
      processToastQueue();
    }, 450);
  }, 3200); // 表示時間 3.2秒
}

// ===== 共通：保存用ヘッダー HTML =====
function buildSaveHeader(today) {
  return `<div style="display:flex;align-items:flex-end;justify-content:center;gap:0;border-bottom:2px solid #ffcc00;padding-bottom:6px;margin-bottom:14px;">` +
    `<img src="${omikujiFolder}yaemiko01.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">` +
    `<div style="text-align:center;flex:1;padding-bottom:4px;">` +
      `<div style="font-size:1.05rem;font-weight:bold;letter-spacing:0.1em;">${t('captureTitle')}</div>` +
      `<div style="font-size:0.75rem;color:#888;">${today}</div>` +
    `</div>` +
    `<img src="${omikujiFolder}mona02.png" crossorigin="anonymous" style="height:80px;object-fit:contain;flex-shrink:0;">` +
  `</div>`;
}

// ===== 共通：保存用フッター HTML =====
function buildSaveFooter() {
  return `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;border-top:1px solid #ddd;padding-top:8px;">` +
    `<img src="https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/00_common/footer_icon/twitter_image.png" crossorigin="anonymous" style="width:20px;height:20px;object-fit:contain;">` +
    `<span style="font-size:0.78rem;color:#555;">@uko_dayo_</span>` +
  `</div>`;
}

// ===== 画像保存共通：モバイルは共有→新タブ、PCはダウンロード =====
async function saveOrShareImage(canvas, filename) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;

  await new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { resolve(); return; }

      if (isMobile) {
        // モバイル：まず Share API を試す
        try {
          const file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file] });
            resolve();
            return;
          }
        } catch (e) {
          if (e.name === 'AbortError') { resolve(); return; } // ユーザーキャンセル
          // Share 失敗 → 新タブにフォールバック
        }
        // Share 非対応 or 失敗 → 新タブで画像を開いて長押し保存を案内
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        resolve();
        return;
      }

      // PC：直接ダウンロード
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      resolve();
    }, 'image/png');
  });
}

// ===== 図鑑 画像保存 =====
async function captureSection(sectionId, btnId) {
  const btn     = document.getElementById(btnId);
  const section = document.getElementById(sectionId);
  if (!btn || !section) return;

  btn.disabled    = true;
  btn.textContent = t('saving');

  const today = getFortuneDate().replace(/-/g, '/');

  // ヘッダー＋セクション複製をラップしたdivを生成
  const wrapper = document.createElement('div');
  wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:700px;background:#f4f4f9;padding:20px 18px;box-sizing:border-box;font-family:'MihoyoZenZero','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#333;line-height:1.7;";
  wrapper.innerHTML = buildSaveHeader(today);

  const clone = section.cloneNode(true);
  // 保存ボタンと見出し（セクション外から見えるため）は除去
  clone.querySelector(`#${btnId}`)?.remove();
  clone.style.cssText = 'background:transparent;border:none;box-shadow:none;padding:0;margin:0;';
  wrapper.appendChild(clone);
  wrapper.insertAdjacentHTML('beforeend', buildSaveFooter());

  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, {
      useCORS: true, backgroundColor: '#f4f4f9', scale: 2, logging: false,
    });
    await saveOrShareImage(canvas, `genshin-collection-${getFortuneDate()}.png`);
  } catch {
    alert(t('saveFail'));
  } finally {
    wrapper.remove();
    btn.disabled    = false;
    btn.textContent = t('saveCollection');
  }
}

// ===== 実績 画像保存 =====
async function captureAchievements(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = true;
  btn.textContent = t('saving');

  const isEn     = currentLang === 'en';
  const unlocked = loadUnlocked();
  const total    = ALL_ACHIEVEMENTS.length;
  const today    = getFortuneDate().replace(/-/g, '/');

  const S  = 'background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px 14px;margin-bottom:10px;';
  const T  = 'color:#aa8800;font-size:0.68rem;letter-spacing:0.15em;text-align:center;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:10px;';
  const EMPTY = 'font-size:0.70rem;color:#bbb;text-align:center;padding:4px 0;';
  const RARITY_TILE = {
    bronze: 'background:#fffbe6;border:1px solid #cd7f32;color:#7a4000;',
    silver: 'background:#f0f4f8;border:1px solid #a8b8c8;color:#2a3a4a;',
    gold:   'background:#fffbe6;border:1px solid #d4a800;color:#5a3d00;',
    legend: 'background:#f5eeff;border:1px solid #9b59b6;color:#5a0080;',
  };
  const TILE_BASE = 'border-radius:6px;padding:5px 8px;font-size:0.72rem;font-weight:bold;display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;';

  // グループごとに表示（取得0でも枠は出す）
  let groupsHTML = '';
  ACHIEVEMENT_GROUPS.forEach(group => {
    const unlockedItems = group.items.filter(a => unlocked.has(a.id));
    const groupName = isEn ? group.nameEn : group.name;
    const tilesHTML = unlockedItems.length > 0
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">` +
          unlockedItems.map(a => {
            const name     = isEn ? a.nameEn : a.name;
            const rStyle   = RARITY_TILE[a.rarity || 'bronze'];
            return `<div style="${TILE_BASE}${rStyle}">` +
              `<span style="flex-shrink:0;">✦</span>` +
              `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>` +
            `</div>`;
          }).join('') +
        `</div>`
      : `<div style="${EMPTY}">${isEn ? 'None yet' : 'まだ取得なし'}</div>`;
    groupsHTML += `<div style="${S}">` +
      `<div style="${T}">${groupName}　${unlockedItems.length} / ${group.items.length}</div>` +
      tilesHTML +
    `</div>`;
  });

  const div = document.createElement('div');
  div.style.cssText = "position:absolute;left:-9999px;top:0;width:700px;background:#f4f4f9;padding:20px 18px;box-sizing:border-box;font-family:'MihoyoZenZero','Hiragino Kaku Gothic ProN','Meiryo',sans-serif;color:#333;line-height:1.6;";
  div.innerHTML =
    buildSaveHeader(today) +
    `<div style="font-size:0.78rem;color:#aa8800;font-weight:bold;text-align:right;margin-bottom:10px;">${unlocked.size} / ${total}</div>` +
    groupsHTML +
    buildSaveFooter();

  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { useCORS: true, backgroundColor: '#f4f4f9', scale: 2, logging: false });
    await saveOrShareImage(canvas, `genshin-achievements-${getFortuneDate()}.png`);
  } catch {
    alert(t('saveFail'));
  } finally {
    div.remove();
    btn.disabled    = false;
    btn.textContent = t('saveAchievement');
  }
}

function renderAchievements() {
  const container = document.getElementById('achievement-list');
  const countEl   = document.getElementById('achievement-count');
  if (!container) return;

  const unlocked = loadUnlocked();
  const isEn     = currentLang === 'en';

  if (countEl) {
    countEl.textContent = i18n[currentLang].achievementProgress(unlocked.size, ALL_ACHIEVEMENTS.length);
  }

  container.innerHTML = '';

  ACHIEVEMENT_GROUPS.forEach(group => {
    const groupUnlocked = group.items.filter(a => unlocked.has(a.id)).length;
    const total         = group.items.length;
    const allDone       = groupUnlocked === total;

    const details = document.createElement('details');
    details.className = 'ach-group';

    const summary = document.createElement('summary');
    summary.className = 'ach-group-header';
    summary.innerHTML =
      `<span class="ach-group-name">${isEn ? group.nameEn : group.name}</span>` +
      `<span class="ach-progress${allDone ? ' ach-progress-complete' : ''}">${groupUnlocked}/${total}</span>`;
    details.appendChild(summary);

    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'ach-items';

    const RARITY_LABEL = { bronze:'Bronze', silver:'Silver', gold:'Gold', legend:'Legend' };
    group.items.forEach(ach => {
      const isUnlocked = unlocked.has(ach.id);
      const name       = isEn ? ach.nameEn      : ach.name;
      const rarity     = ach.rarity || 'bronze';

      // prerequisite がある場合の条件テキスト切り替え
      let condition;
      if (ach.prerequisite && !unlocked.has(ach.prerequisite)) {
        condition = isEn ? (ach.conditionLockedEn || ach.conditionEn) : (ach.conditionLocked || ach.condition);
      } else {
        condition = isEn ? ach.conditionEn : ach.condition;
      }

      const item = document.createElement('div');
      item.className = `ach-item rarity-${rarity} ${isUnlocked ? 'ach-unlocked' : 'ach-locked'}`;
      item.innerHTML =
        `<span class="ach-icon">${isUnlocked ? '✦' : '？'}</span>` +
        `<div class="ach-text">` +
          `<span class="ach-name">` +
            `${isUnlocked ? name : '？？？'}` +
            `<span class="ach-rarity rarity-badge-${rarity}">${RARITY_LABEL[rarity]}</span>` +
          `</span>` +
          `<span class="ach-condition">${condition}</span>` +
        `</div>`;
      itemsDiv.appendChild(item);
    });

    details.appendChild(itemsDiv);
    container.appendChild(details);
  });
}

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
  renderStreak();
  renderAchievements();
}

// ===== アルカナ図鑑 =====
function loadCollection() {
  return store.collection; // store の Set を直接返す（変更は store に即反映）
}

function saveCollection(_col) {
  // store.collection は参照渡しなので変更は既に反映済み
  scheduleSync();
}

// 新規追加ならキーを返す、既収録なら null
// isRare=true のときはキーを cardId そのまま使用（正逆なし）
function addToCollection(cardId, isReversed, isRare = false) {
  const col = loadCollection();
  const key = isRare ? cardId : `${cardId}_${isReversed ? 'reversed' : 'upright'}`;
  if (col.has(key)) return null;
  col.add(key);
  saveCollection(col);
  return key;
}

// 図鑑の総収録可能枚数（通常22×2 + レアカード枚数）
function totalCollectibleCount() {
  return tarotCards.reduce((sum, card) => sum + (card.isRare ? 1 : 2), 0);
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
    // レアカードは正位置のみ・コレクションキーは card.id そのもの
    const positions = card.isRare ? ['upright'] : ['upright', 'reversed'];
    positions.forEach(pos => {
      const isReversed = pos === 'reversed';
      const key        = card.isRare ? card.id : `${card.id}_${pos}`;
      const collected  = col.has(key);
      const isNew      = key === newKey;

      const item = document.createElement('div');
      item.className = 'col-item' + (collected ? '' : ' col-item-unknown');

      // カードシーン（perspective）
      const scene = document.createElement('div');
      scene.className = 'col-scene';

      // スケール担当ラッパー
      const zoom = document.createElement('div');
      zoom.className = 'col-card-zoom';
      if (isNew) zoom.dataset.new = 'true';

      const inner = document.createElement('div');
      // 収録済みかつ新規でない → 最初からフリップ（表を表示）
      inner.className = 'col-card-inner' + (collected && !isNew ? ' col-flipped' : '');

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
      if (!card.isRare && isReversed) frontImg.style.transform = 'rotate(180deg)';
      frontFace.appendChild(frontImg);

      inner.appendChild(backFace);
      inner.appendChild(frontFace);
      zoom.appendChild(inner);
      scene.appendChild(zoom);

      // ④ 収録済みカードをクリックでモーダル表示
      if (collected) {
        scene.addEventListener('click', () => openCollectionModal(card, isReversed));
      }

      item.appendChild(scene);

      // ⑥ 収録済みのみラベル表示（未収録はスペース確保のみ）
      const label = document.createElement('div');
      label.className = 'col-label' + (isNew ? ' col-label-new' : '');
      if (collected) {
        const posStr = card.isRare ? '★' : (isReversed ? i18n[currentLang].colPosReversed : i18n[currentLang].colPosUpright);
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
          const zoom    = entry.target;                          // スケール担当
          const inner   = zoom.querySelector('.col-card-inner'); // 回転担当
          // グリッドアイテム（.col-item）のz-indexを上げて全隣接カードより前面に出す
          const colItem = zoom.closest('.col-item');
          if (colItem) colItem.style.zIndex = '10';

          zoom.classList.add('col-reveal');
          inner.classList.add('col-reveal');
          // 回転アニメーション終了後に確定状態へ差し替え
          inner.addEventListener('animationend', () => {
            zoom.classList.remove('col-reveal');
            inner.classList.remove('col-reveal');
            inner.classList.add('col-flipped');
            if (colItem) colItem.style.zIndex = ''; // z-index をリセット
          }, { once: true });
          obs.unobserve(zoom);
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
  currentLang = store.lang || 'ja';
  document.querySelectorAll('input[name="lang"]').forEach(r => {
    r.checked = r.value === currentLang;
    r.addEventListener('change', () => {
      currentLang = r.value;
      store.lang  = currentLang;
      scheduleSync();
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
  const calc = (d) => ({
    physical:     Math.sin(2 * Math.PI * d / 23),
    emotional:    Math.sin(2 * Math.PI * d / 28),
    intellectual: Math.sin(2 * Math.PI * d / 33),
  });
  const cur  = calc(days);
  const prev = calc(days - 1);
  return {
    ...cur,
    diff: {
      physical:     cur.physical     - prev.physical,
      emotional:    cur.emotional    - prev.emotional,
      intellectual: cur.intellectual - prev.intellectual,
    },
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

// ===== 占い日付（0時区切り） =====
function getFortuneDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ===== 結果の保存・読み込み =====
function saveResult(birthday, cardIndex, isReversed) {
  store.result = { date: getFortuneDate(), birthday, cardIndex, isReversed };
}

function loadResult() {
  const saved = store.result;
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

  // 通常22枚 + 奈落スロット（index 22）のみ作成。七星（index 23）は物理カードなし
  tarotCards.slice(0, 23).forEach((card, i) => {
    const div = document.createElement('div');
    div.className = 'scatter-card';
    if (i === 22) div.style.display = 'none'; // 奈落は初期非表示
    div.innerHTML = `<img src="${CARD_BACK}" alt="${card.name}" draggable="false">`;

    div.addEventListener('pointerdown', (e) => {
      if (!isShuffled) return;
      if (document.getElementById('daily-done-overlay')) return;
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
    if (document.getElementById('daily-done-overlay')) return;

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
    if (document.getElementById('daily-done-overlay')) return;
    e.preventDefault();
    const touch = e.touches[0];
    pushCards({ clientX: touch.clientX, clientY: touch.clientY, buttons: 1 }, container);
  }, { passive: false });
}

// ===== 奈落ヒント演出 =====
function showRareBadHint() {
  // 散布エリアに暗幕ビネットエフェクト（占うまで持続）
  const area = document.getElementById('card-scatter-area');
  area.classList.add('abyss-active');

  // トーストをエリア中央に配置して表示
  const toast = document.getElementById('rare-bad-toast');
  const rect  = area.getBoundingClientRect();
  toast.style.top  = (rect.top  + rect.height / 2) + 'px';
  toast.style.left = (rect.left + rect.width  / 2) + 'px';
  toast.style.display = 'block';
  void toast.offsetWidth;
  toast.classList.remove('hide');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('hide');
    }, 450);
  }, 3600);
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
    // 通常カード（0-21）を散布
    cardStates.slice(0, 22).forEach((state) => {
      state.x      = (Math.random() * 2 - 1) * maxX;
      state.y      = (Math.random() * 2 - 1) * maxY;
      state.rotate = (Math.random() * 2 - 1) * 65;
      state.zIndex = Math.floor(Math.random() * 22);
      applyTransform(state, true);
    });

    // 奈落のアルカナ（index 22）: 1%で追加、それ以外は非表示
    const rareBadState = cardStates[22];
    if (Math.random() < 0.01) {
      rareBadState.x      = (Math.random() * 2 - 1) * maxX;
      rareBadState.y      = (Math.random() * 2 - 1) * maxY;
      rareBadState.rotate = (Math.random() * 2 - 1) * 65;
      rareBadState.zIndex = Math.floor(Math.random() * 23);
      rareBadState.el.style.display = '';
      applyTransform(rareBadState, true);
      setTimeout(() => showRareBadHint(), 350);
    } else {
      rareBadState.el.style.display = 'none';
      document.getElementById('card-scatter-area').classList.remove('abyss-active');
    }

    isShuffled = true;

    // 各カードの正逆をシャッフル時に決定（通常22枚のみ）
    shuffleOrientations = tarotCards.slice(0, 22).map(() => Math.random() < 0.5);

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
    if (state.el && state.el.style.display === 'none') return;
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
    if (cardStates[a].el && cardStates[a].el.style.display === 'none') continue;
    for (let b = a + 1; b < cardStates.length; b++) {
      if (cardStates[b].el && cardStates[b].el.style.display === 'none') continue;
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
  area.style.touchAction = 'pan-y'; // オーバーレイ表示中は縦スクロールを許可
  const overlay = document.createElement('div');
  overlay.id = 'daily-done-overlay';
  overlay.innerHTML = `<div class="daily-done-text"><span data-i18n="doneTitle">${t('doneTitle')}</span><small data-i18n="doneSubtitle">${t('doneSubtitle')}</small></div>`;
  area.appendChild(overlay);
}

// 管理画面(AccountCenter)でロール「デバッガー」+「原神おみくじ」を付与された場合だけ true。
// 初期化時に一度だけFirestoreから取得してキャッシュする（loadDebuggerRole参照）。
let isOmikujiDebugger = false;

function isDebugMode() {
  return isOmikujiDebugger;
}

async function loadDebuggerRole() {
  try {
    const snap = await getDoc(doc(db, 'sharedUserRoles', getUserId()));
    if (snap.exists()) {
      const d = snap.data();
      // 管理者はデバッガーの上位ロールなので、admin/debugger いずれの role でもデバッグ扱いにする
      isOmikujiDebugger = d.role === 'admin' || d.role === 'debugger' || !!d.debugOmikuji;
    }
  } catch (e) {
    console.warn('[debug] ロール取得に失敗:', e);
  }
}

function updateFortuneBtn() {
  const birthday = document.getElementById('birthday').value;
  const saved     = loadResult();
  const locked    = !isDebugMode() && !!(saved && saved.birthday === birthday);
  document.getElementById('fortune-btn').disabled = locked || !(selectedCardIndex !== null && birthday);
}

// ===== DOM読み込み完了 =====
document.addEventListener('DOMContentLoaded', async () => {
  const nameInput     = document.getElementById('player-name');
  const birthdayInput = document.getElementById('birthday');
  const shuffleBtn    = document.getElementById('shuffle-btn');

  // Firestore からデータをロード（端末変更対応）
  // localStorage を Firestore の内容で上書きしてから UI を初期化する
  await loadUserDataFromFirestore();
  await loadDebuggerRole();

  // 言語切り替え初期化
  initLangSwitch();

  // みんなの結果フィード・いいね通知・アバター初期化
  initFeed();

  // 「自分の占いを公開しない」チェックボックス
  const hideFeedCheckbox = document.getElementById('hide-feed-checkbox');
  if (hideFeedCheckbox) {
    hideFeedCheckbox.checked = !!store.hideFromFeed;
    hideFeedCheckbox.addEventListener('change', () => {
      store.hideFromFeed = hideFeedCheckbox.checked;
      scheduleSync();
    });
  }

  // キャラクター画像
  document.getElementById('chara-left').src  = omikujiFolder + 'yaemiko01.png';
  document.getElementById('chara-right').src = omikujiFolder + 'mona02.png';

  // 生年月日の max を今日に設定
  birthdayInput.max = new Date().toISOString().slice(0, 10);

  // store からデータ復元（Firestore ロード済みのインメモリストアから取得）
  nameInput.value = store.name || '';
  if (store.gender) {
    const genderEl = document.querySelector(`input[name="gender"][value="${store.gender}"]`);
    if (genderEl) genderEl.checked = true;
  }
  document.querySelectorAll('input[name="gender"]').forEach(r => {
    r.addEventListener('change', () => {
      store.gender = r.value;
      scheduleSync();
      if (document.getElementById('result').style.display !== 'none' && lastFortuneBirthday) {
        displayExtraFortune(lastFortuneBirthday, r.value);
      }
    });
  });
  const storedBirthday = store.birthday;
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
  renderStreak();
  checkAndUnlockAchievements(true); // 既存データから遡及解放（トーストなし）
  renderAchievements();

  document.getElementById('save-col-btn').addEventListener('click', () => captureSection('collection-section', 'save-col-btn'));
  document.getElementById('save-ach-btn').addEventListener('click', () => captureAchievements('save-ach-btn'));

  // タブ復帰時に日付が変わっていたら自動リロード（lastVisit はローカルに保持）
  setLastVisit(getFortuneDate());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (getLastVisit() !== getFortuneDate()) {
        location.reload();
      }
    }
  });

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
    document.getElementById('card-scatter-area').classList.remove('abyss-active');
    if (selectedCardIndex === null) { alert(t('alertCard')); return; }

    store.name     = name;
    store.birthday = birthday;

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

    const todayStr = getFortuneDate();

    // レアカード判定（シャッフル差し替え > 確率）
    let effectiveCardIndex = selectedCardIndex;
    if (!debug && Math.random() < 0.005) {
      effectiveCardIndex = 23; // rare_Good (tarotCards[23]) 0.5%
    }

    // レアカードは常に正位置
    const isRare     = effectiveCardIndex >= 22;
    const isReversed = isRare ? false : (shuffleOrientations[effectiveCardIndex] ?? Math.random() < 0.5);

    saveResult(birthday, effectiveCardIndex, isReversed);
    const streakResult = !debug ? updateStreak() : { count: 0, isReturn: false };
    scheduleSync(); // name, birthday, result, streak を Firestore へ同期
    renderStreak();
    runFortune(birthday, name, effectiveCardIndex, isReversed);
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
  const card   = tarotCards[cardIndex];
  const isRare = card.isRare === true;
  captureCard       = card;
  captureIsReversed = isReversed;
  displayTarot(card, isReversed, isRestored);

  // 運勢レベル（レアカードは専用レベルを強制）
  let fortuneLevel, overallComment;
  if (isRare) {
    fortuneLevel   = card.id === 'rare_bad' ? '大凶' : '超大吉';
    overallComment = isEn ? card.upright_en.message : card.upright.message;
  } else {
    fortuneLevel   = fortuneLevels[pickWeighted(rng, fortuneWeights)];
    const bioAvg     = (bio.physical + bio.emotional + bio.intellectual) / 3;
    const bioTier    = bioAvg > 0.2 ? 'high' : bioAvg < -0.2 ? 'low' : 'mid';
    const commentPool = isEn ? comments_en : comments;
    overallComment = pick(commentPool[fortuneLevel][bioTier]);
  }
  displayFortuneBadge(fortuneLevel);
  document.getElementById('overall-comment').textContent = overallComment;



  // ラッキー
  const luckyColorIdx  = Math.floor(rng() * zodiacData.luckyColor.length);
  const luckyItemIdx   = Math.floor(rng() * zodiacData.luckyItem.length);
  const luckyNumberIdx = Math.floor(rng() * zodiacData.luckyNumber.length);
  const cardData = isReversed
    ? (isEn ? card.reversed_en : card.reversed)
    : (isEn ? card.upright_en  : card.upright);
  document.getElementById('lucky-color').textContent       = (isEn ? zodiacData.luckyColor_en : zodiacData.luckyColor)[luckyColorIdx];
  document.getElementById('lucky-item-zodiac').textContent = (isEn ? zodiacData.luckyItem_en  : zodiacData.luckyItem)[luckyItemIdx];
  document.getElementById('lucky-number').textContent      = zodiacData.luckyNumber[luckyNumberIdx];
  document.getElementById('lucky-item-tarot').textContent  = cardData.lucky;
  document.getElementById('lucky-item-tarot-row').style.display = 'block';

  // 挨拶
  document.getElementById('result-greeting').textContent = i18n[currentLang].greeting(name);

  // おまけ：干支・厄年
  displayExtraFortune(birthday, getGender());

  // 実績統計更新・チェック（新規占いのみ）
  if (!skipStats) {
    const isDebug = isDebugMode();
    const streakSaved = store.streak;
    updateAchievementStats({ name, birthday, fortuneLevel, zodiacKey, bio, isDebug, streakCount: streakSaved ? streakSaved.count : 1 });
    checkAndUnlockAchievements();
    renderAchievements();
  }

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
    submitFeedEntry({ name, cardName: card.name, fortuneLevel, isRare });
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
    { label: t('bioPhysical'),     value: bio.physical,     diff: bio.diff.physical },
    { label: t('bioEmotional'),    value: bio.emotional,    diff: bio.diff.emotional },
    { label: t('bioIntellectual'), value: bio.intellectual, diff: bio.diff.intellectual },
  ];
  const container = document.getElementById('biorhythm-bars');
  container.innerHTML = '';
  items.forEach(({ label, value, diff }) => {
    const pct      = Math.round((value + 1) / 2 * 100);
    const diffStr  = (diff >= 0 ? '+' : '') + diff.toFixed(2);
    const diffCls  = Math.abs(diff) < 0.05 ? 'bio-diff-neutral' : diff > 0 ? 'bio-diff-up' : 'bio-diff-down';
    container.innerHTML += `
      <div class="bio-row">
        <span class="bio-label">${label}</span>
        <div class="bio-bar-wrap">
          <div class="bio-bar ${bioClass(value)}" style="width:${pct}%"></div>
        </div>
        <span class="bio-status ${bioClass(value)}">${bioLabel(value)}</span>
        <span class="bio-diff ${diffCls}">(${diffStr})</span>
      </div>`;
  });
}

function displayTarot(card, isReversed, isRestored = false) {
  // 保留中の演出タイマーをキャンセル（言語切り替え時の二重更新防止）
  if (tarotRevealT1) { clearTimeout(tarotRevealT1); tarotRevealT1 = null; }
  if (tarotRevealT2) { clearTimeout(tarotRevealT2); tarotRevealT2 = null; }

  const cardEl    = document.getElementById('tarot-card');
  const frontFace = cardEl.querySelector('.card-front');
  frontFace.querySelector('img').src             = card.filename;
  frontFace.querySelector('img').style.transform = isReversed ? 'rotate(180deg)' : '';
  cardEl.querySelector('.card-back img').src      = CARD_BACK;
  cardEl.querySelector('.card-back').style.visibility = '';

  // NEW! バッジをリセット
  const newBadgeEl = document.getElementById('tarot-new-badge');
  if (newBadgeEl) newBadgeEl.style.display = 'none';

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
    // 復元時はカード表面を即表示（visibility 保険は不要）
    frontFace.style.visibility = '';
    cardEl.classList.add('flipped');
    cardEl.onclick = null;
    nameEl.textContent = displayName;
    keyEl.textContent  = cardData.keyword;
    msgEl.textContent  = cardData.message;
    nameEl.classList.add('tarot-flipin');
    keyEl.classList.add('tarot-flipin');
    msgEl.classList.add('tarot-flipin');
  } else {
    // 未開封時：result が display:none→block になる瞬間に裏面が一瞬見えるのを防ぐため
    // card-front を visibility:hidden で隠し、タップ時に解除する
    frontFace.style.visibility = 'hidden';
    cardEl.classList.remove('flipped');
    [nameEl, keyEl, msgEl].forEach(el => {
      el.textContent = '';
      el.classList.remove('tarot-flipin');
    });

    cardEl.onclick = () => {
      if (cardEl.classList.contains('flipped')) return;
      cardEl.onclick = null;
      // フリップ開始前に表面を見えるようにする（アニメーションで徐々に表示）
      frontFace.style.visibility = '';
      cardEl.classList.add('flipped');
      lastFortuneCardFlipped = true;

      // コレクションに追加し、新規なら図鑑を再描画（スクロール演出付き）
      const newKey = addToCollection(card.id, isReversed, card.isRare === true); // 内部で scheduleSync 済み
      if (newKey && newBadgeEl) newBadgeEl.style.display = 'block';
      renderCollection(newKey);
      checkAndUnlockAchievements(false, 1500);
      renderAchievements();

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

  div.innerHTML = buildSaveHeader(today) + `
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
    </div>` + buildSaveFooter();

  document.body.appendChild(div);
  try {
    const canvas = await html2canvas(div, { useCORS: true, backgroundColor: '#f4f4f9', scale: 2, logging: false });
    await saveOrShareImage(canvas, `genshin-omikuji-${getFortuneDate()}.png`);
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

function getGender() {
  const sel = document.querySelector('input[name="gender"]:checked');
  return sel ? sel.value : '';
}

function displayExtraFortune(birthday, gender) {
  const content = document.getElementById('extra-fortune-content');
  if (!content) return;

  const birthYear  = Number(birthday.split('-')[0]);
  const isEn       = currentLang === 'en';
  const eto        = ETO[((birthYear - 1900) % 12 + 12) % 12];
  const thisYear   = new Date().getFullYear();
  const suimei     = thisYear - birthYear + 1;
  const yakuList   = gender && YAKUDOSHI[gender] ? YAKUDOSHI[gender] : null;
  const yaku       = yakuList ? (yakuList.find(y => y.age === suimei)     || null) : null;
  const yakuNext   = yakuList ? (yakuList.find(y => y.age === suimei + 1) || null) : null;
  // suimei より後の最初の本厄（大厄含む）
  const futureHonyaku     = yakuList ? (yakuList.find(y => y.typeJa.includes('本厄') && y.age > suimei) || null) : null;
  const futureHonyakuYear = futureHonyaku ? thisYear + (futureHonyaku.age - suimei) : null;

  // 干支ブロック
  let html = `<div class="extra-block">`;
  html += `<div class="extra-block-title">${t('etoLabel')}</div>`;
  html += `<div class="extra-eto">`;
  html += `<span class="extra-eto-name">${isEn ? eto.en : eto.ja}</span>`;
  html += `<span class="extra-eto-desc">${isEn ? eto.descEn : eto.descJa}</span>`;
  html += `</div></div>`;

  // 厄年：今年・来年 横並び
  const yakuBlock = (yakuEntry, labelKey) => {
    let b = `<div class="extra-block extra-yaku-half">`;
    b += `<div class="extra-block-title">${t(labelKey)}</div>`;
    if (!gender) {
      b += `<div class="extra-yaku-note">${t('yakuNoGender')}</div>`;
    } else if (yakuEntry) {
      const typeText = isEn ? yakuEntry.typeEn : yakuEntry.typeJa;
      b += `<div class="extra-yaku-result${yakuEntry.dai ? ' extra-yaku-dai' : ' extra-yaku-warn'}">${typeText}</div>`;
      if (yakuEntry.dai) {
        b += `<div class="extra-yaku-note">${isEn ? 'Major unlucky year.' : '大厄にあたります。'}</div>`;
      } else {
        b += `<div class="extra-yaku-note">${isEn ? 'Consider a purification ritual.' : '厄払いを検討してみては。'}</div>`;
      }
    } else {
      b += `<div class="extra-yaku-safe">${t('yakuSafe')}</div>`;
    }
    b += `</div>`;
    return b;
  };

  html += `<div class="extra-yaku-row">`;
  html += yakuBlock(yaku,     'yakuThisLabel');
  html += yakuBlock(yakuNext, 'yakuNextLabel');
  html += `</div>`;

  // 次の本厄年表示
  if (gender) {
    if (futureHonyaku) {
      const typeText = isEn ? futureHonyaku.typeEn : futureHonyaku.typeJa;
      html += `<div class="extra-yaku-next">${t('yakuFutureLabel')}: ${futureHonyakuYear}${isEn ? '' : '年'} (${typeText})</div>`;
    } else {
      html += `<div class="extra-yaku-next">${t('yakuAllPassed')}</div>`;
    }
  }

  content.innerHTML = html;
}
