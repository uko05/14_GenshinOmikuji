// feed.js
// みんなの結果フィード・いいね・いいね通知・アバター表示
import { app, db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js';
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, increment, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import { starrailChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_data/starrail_chars.js';

const GENSHIN_ICON_BASE  = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';
const STARRAIL_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_icon/';
const DEFAULT_AVATAR_URL = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/00_common/image/sonota.png';

const STR = {
  ja: {
    noName:    '名無しの旅人',
    feedEmpty: 'まだ結果がありません',
    notifEmpty: 'まだいいねはありません',
    likeToast: (name) => `${name}さんがいいねしました！`,
    justNow:   'たった今',
    minAgo:    (n) => `${n}分前`,
    hourAgo:   (n) => `${n}時間前`,
    normalLine: (name, level) => `${name}さんが${level}を引きました`,
    rareLine:   (name, card)  => `${name}さんが${card}を引き当てました！`,
    achLine:    (name, ach)   => `${name}さんが「${ach}」を取得しました！`,
  },
  en: {
    noName:    'Nameless Traveler',
    feedEmpty: 'No results yet',
    notifEmpty: 'No likes yet',
    likeToast: (name) => `${name} liked your fortune!`,
    justNow:   'just now',
    minAgo:    (n) => `${n}m ago`,
    hourAgo:   (n) => `${n}h ago`,
    normalLine: (name, level) => `${name} got ${level}!`,
    rareLine:   (name, card)  => `${name} drew ${card}!!`,
    achLine:    (name, ach)   => `${name} unlocked "${ach}"!`,
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

const auth = getAuth(app);
let authUid = null;
const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    authUid = user ? user.uid : null;
    resolve();
  });
});

const ELEM_LABELS = {
  ja: { hi: '炎', mizu: '水', koori: '氷', kaminari: '雷', kusa: '草', kaze: '風', iwa: '岩', kyosuu: '虚数', ryoushi: '量子', butsuri: '物理' },
  en: { hi: 'Fire', mizu: 'Hydro', koori: 'Ice', kaminari: 'Lightning', kusa: 'Dendro', kaze: 'Wind', iwa: 'Geo', kyosuu: 'Imaginary', ryoushi: 'Quantum', butsuri: 'Physical' },
};
const GAME_ELEMS = {
  genshin:  ['hi', 'mizu', 'koori', 'kaminari', 'kusa', 'kaze', 'iwa'],
  starrail: ['hi', 'koori', 'kaze', 'kaminari', 'kyosuu', 'ryoushi', 'butsuri'],
};
const GAME_CHARS = { genshin: genshinChars, starrail: starrailChars };
const GAME_ICON_BASE = { genshin: GENSHIN_ICON_BASE, starrail: STARRAIL_ICON_BASE };

function avatarUrl(game, icon) {
  if (!game || !icon) return DEFAULT_AVATAR_URL;
  return (game === 'starrail' ? STARRAIL_ICON_BASE : GENSHIN_ICON_BASE) + icon;
}

async function getMyAvatar(userId) {
  try {
    const snap = await getDoc(doc(db, 'userAvatars', userId));
    if (snap.exists()) {
      const d = snap.data();
      return { game: d.game || null, icon: d.icon || null };
    }
  } catch (e) { console.error('[feed] avatar fetch failed', e); }
  return { game: null, icon: null };
}

function relTime(ts) {
  if (!ts || typeof ts.toMillis !== 'function') return '';
  const min = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (min < 1)  return s().justNow;
  if (min < 60) return s().minAgo(min);
  return s().hourAgo(Math.floor(min / 60));
}

// 直近の自分のフィード投稿が今のアバターと食い違っていたら更新する
// (投稿時点のアバターを非正規化しているため、投稿後にアバターを設定/変更した場合に必要)
async function syncLatestFeedAvatar(userId, avatar) {
  try {
    const q = query(
      collection(db, 'omikujiFeed'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const docSnap = snap.docs[0];
    const d = docSnap.data();
    if ((d.avatarGame || null) !== (avatar.game || null) || (d.avatarIcon || null) !== (avatar.icon || null)) {
      await updateDoc(docSnap.ref, { avatarGame: avatar.game || null, avatarIcon: avatar.icon || null });
    }
  } catch (e) {
    console.warn('[feed] avatar sync failed', e);
  }
}

// ===== 自分のアバター表示（名前欄の左） =====
async function initPlayerAvatar() {
  const img = document.getElementById('player-avatar');
  if (!img) return;
  const avatar = await getMyAvatar(getUserId());
  img.src = avatarUrl(avatar.game, avatar.icon);
  syncLatestFeedAvatar(getUserId(), avatar);

  img.addEventListener('click', async () => {
    await authReady;
    if (authUid) {
      openAvatarPicker();
    } else {
      const modal = document.getElementById('avatar-nudge-modal');
      if (modal) modal.style.display = 'flex';
    }
  });
}

// ===== アバター選択ポップ（AccountCenterにログイン中のみ。24_AccountCenterと同じ
//       ゲームタブ→属性タブ→アイコン一覧UIをここにも移植） =====
let pickerGame = 'genshin';
let pickerElem = GAME_ELEMS.genshin[0];

function openAvatarPicker() {
  const modal = document.getElementById('avatar-picker-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderPickerGameTabs();
  renderPickerElemTabs();
  renderPickerCharList();
}

function closeAvatarPicker() {
  const modal = document.getElementById('avatar-picker-modal');
  if (modal) modal.style.display = 'none';
}

function renderPickerGameTabs() {
  const bar = document.getElementById('avatar-picker-game-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  const isEn = store.lang === 'en';
  [['genshin', isEn ? 'Genshin' : '原神'], ['starrail', isEn ? 'Star Rail' : 'スタレ']].forEach(([game, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-game-tab-btn' + (game === pickerGame ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      pickerGame = game;
      pickerElem = GAME_ELEMS[game][0];
      renderPickerGameTabs();
      renderPickerElemTabs();
      renderPickerCharList();
    });
    bar.appendChild(btn);
  });
}

function renderPickerElemTabs() {
  const bar = document.getElementById('avatar-picker-elem-tabs');
  if (!bar) return;
  bar.innerHTML = '';
  const labels = ELEM_LABELS[store.lang === 'en' ? 'en' : 'ja'];
  GAME_ELEMS[pickerGame].forEach((elem) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-elem-tab-btn' + (elem === pickerElem ? ' active' : '');
    btn.textContent = labels[elem];
    btn.addEventListener('click', () => {
      pickerElem = elem;
      renderPickerElemTabs();
      renderPickerCharList();
    });
    bar.appendChild(btn);
  });
}

function renderPickerCharList() {
  const list = document.getElementById('avatar-picker-char-list');
  if (!list) return;
  list.innerHTML = '';
  const chars = GAME_CHARS[pickerGame].filter((c) => c.element === pickerElem);
  chars.forEach((c) => {
    const name = c.name || c.icon.replace(/\.\w+$/, '');
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'avatar-picker-thumb';
    thumb.title = name;
    const img = document.createElement('img');
    img.src = GAME_ICON_BASE[pickerGame] + c.icon;
    img.alt = name;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', () => selectAvatarFromPicker(pickerGame, c.icon));
    list.appendChild(thumb);
  });
}

async function selectAvatarFromPicker(game, icon) {
  try {
    await setDoc(doc(db, 'userAvatars', getUserId()), {
      game, icon, updatedAt: serverTimestamp(),
    });
    const img = document.getElementById('player-avatar');
    if (img) img.src = avatarUrl(game, icon);
    syncLatestFeedAvatar(getUserId(), { game, icon });
    closeAvatarPicker();
  } catch (e) {
    console.error('[feed] avatar select failed', e);
  }
}

// ===== フィード投稿(1日1回のみ。runFortune()のスキップされない全経路から呼ばれるが、
//       既に当日分を投稿済みなら何もしない) =====
const LS_FEED_POSTED_DATE = 'genshinOmikuji_feedPostedDate';

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function submitFeedEntry({ name, cardName, fortuneLevel, isRare }) {
  if (store.hideFromFeed) return;
  const today = todayStr();
  if (localStorage.getItem(LS_FEED_POSTED_DATE) === today) return;
  try {
    const userId = getUserId();
    const avatar = await getMyAvatar(userId);
    await addDoc(collection(db, 'omikujiFeed'), {
      type: 'fortune',
      userId,
      name: name || '',
      cardName: cardName || '',
      fortuneLevel: fortuneLevel || '',
      isRare: !!isRare,
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      likeCount: 0,
      createdAt: serverTimestamp(),
    });
    localStorage.setItem(LS_FEED_POSTED_DATE, today);
  } catch (e) {
    console.error('[feed] submit failed', e);
  }
}

// ===== アチーブメント獲得のフィード投稿(新規解放ごとに呼ばれる、遡及・サイレント解放時は呼ばない) =====
export async function submitAchievementFeedEntry({ name, achievementName, rarity }) {
  if (store.hideFromFeed) return;
  try {
    const userId = getUserId();
    const avatar = await getMyAvatar(userId);
    await addDoc(collection(db, 'omikujiFeed'), {
      type: 'achievement',
      userId,
      name: name || '',
      achievementName: achievementName || '',
      rarity: rarity || 'bronze',
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      likeCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[feed] achievement submit failed', e);
  }
}

// ===== いいね =====
const myLikedIds = new Set();

// デバッガー・管理者ロールは確認用に同じ投稿へ何度でもいいねできる
let isFeedDebugger = false;
async function loadFeedDebuggerRole() {
  try {
    const snap = await getDoc(doc(db, 'sharedUserRoles', getUserId()));
    if (snap.exists()) {
      const d = snap.data();
      isFeedDebugger = d.role === 'admin' || d.role === 'debugger' || !!d.debugOmikuji;
    }
  } catch (e) {
    console.warn('[feed] role fetch failed', e);
  }
}

async function toggleLike(entry, likeBtn, opts = {}) {
  const myUserId = getUserId();
  const allowSelf = !!opts.allowSelf;
  const privileged = isFeedDebugger;

  if (!privileged && !allowSelf && myUserId === entry.userId) return;
  if (!privileged && myLikedIds.has(entry.id)) return;

  likeBtn.disabled = true;
  try {
    const likeRef = doc(db, 'omikujiFeed', entry.id, 'likes', myUserId);
    const already  = await getDoc(likeRef);

    if (already.exists()) {
      if (!privileged) { myLikedIds.add(entry.id); return; }
      // デバッガー・管理者: 確認用にいいねを取り消して再度押せる状態に戻す
      await deleteDoc(likeRef);
      await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(-1) });
      await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(-1) }, { merge: true });
      myLikedIds.delete(entry.id);
      likeBtn.classList.remove('liked');
      return;
    }

    await setDoc(likeRef, { likedAt: serverTimestamp() });
    await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(1) });
    await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(1) }, { merge: true });
    myLikedIds.add(entry.id);
    likeBtn.classList.add('liked');

    const myAvatar = await getMyAvatar(myUserId);
    await addDoc(collection(db, 'omikujiLikeNotifications'), {
      toUserId: entry.userId,
      fromUserId: myUserId,
      fromName: store.name || '',
      fromAvatarGame: myAvatar.game,
      fromAvatarIcon: myAvatar.icon,
      feedId: entry.id,
      createdAt: serverTimestamp(),
      shown: false,
    });
  } catch (e) {
    console.error('[feed] like failed', e);
  } finally {
    likeBtn.disabled = privileged ? false : myLikedIds.has(entry.id);
  }
}

// ===== フィード一覧描画 =====
function renderFeedList(entries) {
  const list = document.getElementById('feed-list');
  if (!list) return;
  const myUserId = getUserId();
  list.innerHTML = '';

  if (!entries.length) {
    const p = document.createElement('p');
    p.className = 'feed-empty';
    p.textContent = s().feedEmpty;
    list.appendChild(p);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    if (entry.type === 'achievement') {
      item.classList.add('feed-item-achievement', `rarity-${entry.rarity || 'bronze'}`);
    }

    const avatar = document.createElement('img');
    avatar.className = 'feed-avatar';
    avatar.src = avatarUrl(entry.avatarGame, entry.avatarIcon);
    avatar.alt = '';
    item.appendChild(avatar);

    const body = document.createElement('div');
    body.className = 'feed-item-body';

    const name = entry.name || s().noName;
    const lineEl = document.createElement('span');
    lineEl.className = 'feed-item-line';
    if (entry.type === 'achievement') {
      lineEl.textContent = s().achLine(name, entry.achievementName);
    } else {
      lineEl.textContent = entry.isRare
        ? s().rareLine(name, entry.cardName || entry.fortuneLevel)
        : s().normalLine(name, entry.fortuneLevel || entry.cardName);
      if (entry.isRare) lineEl.classList.add('feed-item-line-rare');
    }
    body.appendChild(lineEl);

    const timeEl = document.createElement('span');
    timeEl.className = 'feed-item-time';
    timeEl.textContent = relTime(entry.createdAt);
    body.appendChild(timeEl);

    item.appendChild(body);

    const likeBtn = document.createElement('button');
    likeBtn.className = 'feed-like-btn';
    likeBtn.innerHTML = `<span class="feed-like-icon">👍</span><span class="feed-like-count">${entry.likeCount || 0}</span>`;
    const isMine  = entry.userId === myUserId;
    const isLiked = myLikedIds.has(entry.id);
    if (!isFeedDebugger && (isMine || isLiked)) {
      likeBtn.disabled = true;
      if (isLiked) likeBtn.classList.add('liked');
    } else {
      if (isLiked) likeBtn.classList.add('liked');
      likeBtn.addEventListener('click', () => toggleLike(entry, likeBtn));
    }
    item.appendChild(likeBtn);

    list.appendChild(item);
  });
}

const FEED_WINDOW_HOURS = 24;
// テスト期間中のデータを一覧から除外するための下限(2026-08-04 00:00 ローカル時刻以降のみ表示)
const FEED_CUTOFF_MS = new Date(2026, 7, 4, 0, 0, 0).getTime();

function startFeedListener() {
  const rollingSinceMs = Date.now() - FEED_WINDOW_HOURS * 60 * 60 * 1000;
  const since = Timestamp.fromMillis(Math.max(rollingSinceMs, FEED_CUTOFF_MS));
  const q = query(
    collection(db, 'omikujiFeed'),
    where('createdAt', '>=', since),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  onSnapshot(q, (snap) => {
    renderFeedList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => console.error('[feed] listen failed', err));
}

// ===== いいね通知トースト（アチーブトーストと同じキュー方式・薄め短時間） =====
let likeToastQueue = [];
let likeToastBusy  = false;

function showLikeToast(notif) {
  likeToastQueue.push(notif);
  if (!likeToastBusy) processLikeToastQueue();
}

function processLikeToastQueue() {
  if (likeToastQueue.length === 0) { likeToastBusy = false; return; }
  likeToastBusy = true;

  const notif = likeToastQueue.shift();
  const toast = document.getElementById('like-toast');
  if (!toast) { likeToastBusy = false; return; }

  const avatarImg = document.getElementById('like-toast-avatar');
  const textEl    = document.getElementById('like-toast-text');
  if (avatarImg) avatarImg.src = avatarUrl(notif.fromAvatarGame, notif.fromAvatarIcon);
  if (textEl) textEl.textContent = s().likeToast(notif.fromName || s().noName);

  toast.style.display = 'block';
  void toast.offsetWidth; // reflow
  toast.classList.remove('like-toast-hide');
  toast.classList.add('like-toast-show');

  setTimeout(() => {
    toast.classList.remove('like-toast-show');
    toast.classList.add('like-toast-hide');
    setTimeout(() => {
      toast.style.display = 'none';
      toast.classList.remove('like-toast-hide');
      processLikeToastQueue();
    }, 350);
  }, 2200); // アチーブトースト(3.2s)より短め
}

// 自分宛の未表示通知を購読（初回ロード分＋開いている間のリアルタイム分の両方を処理）
function startNotifListener() {
  const myUserId = getUserId();
  const q = query(
    collection(db, 'omikujiLikeNotifications'),
    where('toUserId', '==', myUserId),
    where('shown', '==', false)
  );
  onSnapshot(q, (snap) => {
    const added = snap.docChanges()
      .filter((c) => c.type === 'added')
      .map((c) => ({ id: c.doc.id, ...c.doc.data() }));
    if (!added.length) return;

    added.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    added.forEach((notif) => {
      showLikeToast(notif);
      updateDoc(doc(db, 'omikujiLikeNotifications', notif.id), { shown: true })
        .catch((e) => console.error('[feed] mark shown failed', e));
    });
  }, (err) => console.error('[feed] notif listen failed', err));
}

// ===== いいね履歴パネル（通知ベル） =====
async function openNotifPanel() {
  const modal  = document.getElementById('notif-panel');
  const listEl = document.getElementById('notif-panel-list');
  if (!modal || !listEl) return;
  modal.style.display = 'flex';
  listEl.innerHTML = '';

  try {
    const q = query(
      collection(db, 'omikujiLikeNotifications'),
      where('toUserId', '==', getUserId()),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      const p = document.createElement('p');
      p.className = 'notif-empty';
      p.textContent = s().notifEmpty;
      listEl.appendChild(p);
      return;
    }
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const row = document.createElement('div');
      row.className = 'notif-row';

      const avatar = document.createElement('img');
      avatar.className = 'notif-row-avatar';
      avatar.src = avatarUrl(d.fromAvatarGame, d.fromAvatarIcon);
      avatar.alt = '';
      row.appendChild(avatar);

      const col = document.createElement('div');
      col.className = 'notif-row-col';
      const text = document.createElement('div');
      text.className = 'notif-row-text';
      text.textContent = s().likeToast(d.fromName || s().noName);
      const time = document.createElement('div');
      time.className = 'notif-row-time';
      time.textContent = relTime(d.createdAt);
      col.appendChild(text);
      col.appendChild(time);
      row.appendChild(col);

      const likeBtn = document.createElement('button');
      likeBtn.className = 'feed-like-btn notif-row-like-btn';
      likeBtn.innerHTML = '<span class="feed-like-icon">👍</span>';
      likeBtn.addEventListener('click', () => {
        toggleLike({ id: d.feedId, userId: d.toUserId }, likeBtn, { allowSelf: true });
      });
      row.appendChild(likeBtn);

      listEl.appendChild(row);
    });
  } catch (e) {
    console.error('[feed] notif history load failed', e);
  }
}

function closeNotifPanel() {
  const modal = document.getElementById('notif-panel');
  if (modal) modal.style.display = 'none';
}

function closeAvatarNudgeModal() {
  const modal = document.getElementById('avatar-nudge-modal');
  if (modal) modal.style.display = 'none';
}

// ===== 初期化 =====
export async function initFeed() {
  initPlayerAvatar();
  await loadFeedDebuggerRole();
  startFeedListener();
  startNotifListener();

  const bell = document.getElementById('notif-bell');
  if (bell) bell.addEventListener('click', openNotifPanel);

  const notifClose = document.getElementById('notif-panel-close');
  if (notifClose) notifClose.addEventListener('click', closeNotifPanel);
  const notifBackdrop = document.querySelector('#notif-panel .col-modal-backdrop');
  if (notifBackdrop) notifBackdrop.addEventListener('click', closeNotifPanel);

  const nudgeClose = document.getElementById('avatar-nudge-close');
  if (nudgeClose) nudgeClose.addEventListener('click', closeAvatarNudgeModal);
  const nudgeBackdrop = document.querySelector('#avatar-nudge-modal .col-modal-backdrop');
  if (nudgeBackdrop) nudgeBackdrop.addEventListener('click', closeAvatarNudgeModal);

  const pickerClose = document.getElementById('avatar-picker-close');
  if (pickerClose) pickerClose.addEventListener('click', closeAvatarPicker);
  const pickerBackdrop = document.querySelector('#avatar-picker-modal .col-modal-backdrop');
  if (pickerBackdrop) pickerBackdrop.addEventListener('click', closeAvatarPicker);
}
