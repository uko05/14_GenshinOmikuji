// feed.js
// みんなの結果フィード・いいね・いいね通知・アバター表示
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js';
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, increment, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
  },
  en: {
    noName:    'Nameless Traveler',
    feedEmpty: 'No results yet',
    notifEmpty: 'No likes yet',
    likeToast: (name) => `${name} liked your fortune!`,
    justNow:   'just now',
    minAgo:    (n) => `${n}m ago`,
    hourAgo:   (n) => `${n}h ago`,
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

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

// ===== 自分のアバター表示（名前欄の左） =====
async function initPlayerAvatar() {
  const img = document.getElementById('player-avatar');
  if (!img) return;
  const avatar = await getMyAvatar(getUserId());
  img.src = avatarUrl(avatar.game, avatar.icon);
  img.addEventListener('click', () => {
    if (avatar.game && avatar.icon) return; // 設定済みの人は変更不可（AccountCenter側で変更）
    const modal = document.getElementById('avatar-nudge-modal');
    if (modal) modal.style.display = 'flex';
  });
}

// ===== フィード投稿（新規占い時のみ呼ばれる） =====
export async function submitFeedEntry({ name, cardName, fortuneLevel }) {
  try {
    const userId = getUserId();
    const avatar = await getMyAvatar(userId);
    await addDoc(collection(db, 'omikujiFeed'), {
      userId,
      name: name || '',
      cardName: cardName || '',
      fortuneLevel: fortuneLevel || '',
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      likeCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[feed] submit failed', e);
  }
}

// ===== いいね =====
const myLikedIds = new Set();

async function toggleLike(entry, likeBtn) {
  const myUserId = getUserId();
  if (myUserId === entry.userId || myLikedIds.has(entry.id)) return;

  likeBtn.disabled = true;
  try {
    const likeRef = doc(db, 'omikujiFeed', entry.id, 'likes', myUserId);
    const already = await getDoc(likeRef);
    if (already.exists()) { myLikedIds.add(entry.id); return; }

    await setDoc(likeRef, { likedAt: serverTimestamp() });
    await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(1) });
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
    likeBtn.disabled = myLikedIds.has(entry.id);
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

    const avatar = document.createElement('img');
    avatar.className = 'feed-avatar';
    avatar.src = avatarUrl(entry.avatarGame, entry.avatarIcon);
    avatar.alt = '';
    item.appendChild(avatar);

    const body = document.createElement('div');
    body.className = 'feed-item-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'feed-item-name';
    nameEl.textContent = entry.name || s().noName;
    body.appendChild(nameEl);

    const resultEl = document.createElement('div');
    resultEl.className = 'feed-item-result';
    resultEl.textContent = [entry.cardName, entry.fortuneLevel].filter(Boolean).join(' ');
    body.appendChild(resultEl);

    const timeEl = document.createElement('div');
    timeEl.className = 'feed-item-time';
    timeEl.textContent = relTime(entry.createdAt);
    body.appendChild(timeEl);

    item.appendChild(body);

    const likeBtn = document.createElement('button');
    likeBtn.className = 'feed-like-btn';
    likeBtn.innerHTML = `<span class="feed-like-icon">👍</span><span class="feed-like-count">${entry.likeCount || 0}</span>`;
    const isMine  = entry.userId === myUserId;
    const isLiked = myLikedIds.has(entry.id);
    if (isMine || isLiked) {
      likeBtn.disabled = true;
      if (isLiked) likeBtn.classList.add('liked');
    } else {
      likeBtn.addEventListener('click', () => toggleLike(entry, likeBtn));
    }
    item.appendChild(likeBtn);

    list.appendChild(item);
  });
}

function startFeedListener() {
  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
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
export function initFeed() {
  initPlayerAvatar();
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
}
