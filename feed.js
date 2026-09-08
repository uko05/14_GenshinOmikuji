// feed.js
// みんなの結果フィード・いいね・いいね通知・アバター表示
import { app, db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js';
import { GACHA_DESIGNS } from './gachaBacks.js';
import {
  collection, collectionGroup, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot,
  query, where, orderBy, limit, serverTimestamp, increment, arrayUnion, runTransaction, Timestamp,
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
    // 名前の直後にアチーブバッジ(あれば)を差し込めるよう、名前より後ろの
    // サフィックス部分だけを返す(nameは呼び出し側で別ノードとして先に出す)。
    normalLine: (level) => `さんが${level}を引きました`,
    rareLine:   (card)  => `さんが${card}を引き当てました！`,
    achLine:    (ach)   => `さんが「${ach}」を取得しました！`,
    statsUpInfo: (given, received) => `「UP（うーこポイント）」は、他の人の結果にいいねする（アゲいいね：あなたは今${given}回、1回で1UP）、または自分の結果にいいねをもらう（モラいいね：あなたは今${received}回、1回で2UP）と貯まるポイントです。今後は他のサイトでミッションをクリアしてももらえるようになる予定です。貯めたUPは引き換え専用サイトで、色々なサイトのちょっとした特典と交換できます！`,
    mailEmpty: '届いているメールはありません',
    mailClaimBtn: '受け取る',
    mailClaimedBtn: '受取済み',
    mailClaimFailed: '受け取りに失敗しました。時間をおいて再度お試しください。',
    gachaResultToast: (name) => `「${name}」を手に入れた！`,
    gachaNoTicketAlert: 'ガチャ券がありません。',
    gachaDrawFailedAlert: 'ガチャの抽選に失敗しました。時間をおいて再度お試しください。',
    deleteBtnTitle: 'この投稿をフィードから削除(管理者/デバッガー専用)',
    deleteConfirm:  'この投稿をみんなの結果から削除しますか？（他の人からも見えなくなります）',
    deleteFailed:   '削除に失敗しました。',
  },
  en: {
    noName:    'Nameless Traveler',
    feedEmpty: 'No results yet',
    notifEmpty: 'No likes yet',
    likeToast: (name) => `${name} liked your fortune!`,
    justNow:   'just now',
    minAgo:    (n) => `${n}m ago`,
    hourAgo:   (n) => `${n}h ago`,
    normalLine: (level) => ` got ${level}!`,
    rareLine:   (card)  => ` drew ${card}!!`,
    achLine:    (ach)   => ` unlocked "${ach}"!`,
    statsUpInfo: (given, received) => `"UP" (Uko Points) are earned by liking other people's results (Given: ${given} so far, 1 UP each) or having your own results liked (Received: ${received} so far, 2 UP each). You'll also be able to earn them by completing missions on other sites in the future. Saved-up UP can be used on the dedicated redemption site to unlock small perks across various sites!`,
    mailEmpty: 'No mail yet',
    mailClaimBtn: 'Claim',
    mailClaimedBtn: 'Claimed',
    mailClaimFailed: 'Failed to claim. Please try again later.',
    gachaResultToast: (name) => `You got "${name}"!`,
    gachaNoTicketAlert: 'You have no gacha tickets.',
    gachaDrawFailedAlert: 'The gacha draw failed. Please try again later.',
    deleteBtnTitle: 'Delete this post from the feed (admin/debugger only)',
    deleteConfirm:  'Delete this post from everyone\'s results? (Others will no longer see it either)',
    deleteFailed:   'Failed to delete.',
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

// ===== フィード投稿(通常ユーザーは1日1回のみ。runFortune()のスキップされない全経路から
//       呼ばれるが、既に当日分を投稿済みなら何もしない。デバッガー・管理者ロールは
//       確認用にこの日次制限を無視して毎回投稿する) =====
const LS_FEED_POSTED_DATE = 'genshinOmikuji_feedPostedDate';

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 08_UPointで「アチーブメント表示」を解放している場合のみ、24_AccountCenterで
// 設定した称号(store.equippedBadge、無ければnull)を投稿時点でコピーして持たせる。
// 投稿後に称号を変えても過去の投稿には反映されない(アバターと同じ仕様)。
function getBadgeSnapshot() {
  const unlocked = !!store.sitePerks?.omikuji?.achievementDisplayUnlocked;
  return {
    badgeDisplayUnlocked: unlocked,
    badge: unlocked ? (store.equippedBadge || null) : null,
  };
}

export async function submitFeedEntry({ name, cardName, fortuneLevel, isRare }) {
  if (store.hideFromFeed) return;
  const today = todayStr();
  if (!isFeedDebugger && localStorage.getItem(LS_FEED_POSTED_DATE) === today) return;
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
      ...getBadgeSnapshot(),
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
      ...getBadgeSnapshot(),
    });
  } catch (e) {
    console.error('[feed] achievement submit failed', e);
  }
}

// ===== いいね =====
const myLikedIds = new Set();

// デバッガー・管理者ロールは確認用に同じ投稿へ何度でもいいねできる
let isFeedDebugger = false;
let myRole = 'general'; // メールのロール指定配信の絞り込みに使う
async function loadFeedDebuggerRole() {
  try {
    const snap = await getDoc(doc(db, 'sharedUserRoles', getUserId()));
    if (snap.exists()) {
      const d = snap.data();
      isFeedDebugger = d.role === 'admin' || d.role === 'debugger' || !!d.debugOmikuji;
      myRole = d.role || 'general';
    }
  } catch (e) {
    console.warn('[feed] role fetch failed', e);
  }
}

async function toggleLike(entry, likeBtn) {
  const myUserId = getUserId();
  const privileged = isFeedDebugger;

  if (!privileged && myUserId === entry.userId) return;
  if (!privileged && myLikedIds.has(entry.id)) return;

  likeBtn.disabled = true;
  try {
    const likeRef = doc(db, 'omikujiFeed', entry.id, 'likes', myUserId);
    const already  = await getDoc(likeRef);

    if (already.exists()) {
      if (!privileged) { myLikedIds.add(entry.id); return; }
      // デバッガー・管理者: 確認用にいいねを取り消して再度押せる状態に戻す
      // (再描画をトリガーするlikeCount更新より先にローカル状態を更新し、再描画時の色反映ズレを防ぐ)
      await deleteDoc(likeRef);
      myLikedIds.delete(entry.id);
      likeBtn.classList.remove('liked');
      await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(-1) });
      // UP(うーこポイント): モラいいね1回=2UP、アゲいいね1回=1UP。取り消し時も対称に減らす
      await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(-1), ukoPoints: increment(-2) }, { merge: true });
      await setDoc(doc(db, 'omikujiUsers', myUserId), { totalLikesGiven: increment(-1), ukoPoints: increment(-1) }, { merge: true });
      return;
    }

    await setDoc(likeRef, { likedAt: serverTimestamp(), likerUserId: myUserId });
    myLikedIds.add(entry.id);
    likeBtn.classList.add('liked');
    await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(1) });
    // UP(うーこポイント): モラいいね1回=2UP、アゲいいね1回=1UP
    await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(1), ukoPoints: increment(2) }, { merge: true });
    await setDoc(doc(db, 'omikujiUsers', myUserId), { totalLikesGiven: increment(1), ukoPoints: increment(1) }, { merge: true });

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

// バッジの横幅を全員共通の固定値にするための基準文字列。
// 原神おみくじ・コネクトバトル両方の実績名の中で現状最長のもの
// (コネクトバトルの「法の皇帝であり、盤上の支配者」14文字)。
// 将来もっと長い名前の実績が追加されたら、ここも合わせて更新すること。
const LONGEST_BADGE_NAME = '法の皇帝であり、盤上の支配者';
let feedBadgeWidthReady = false;

// 見えない位置に実際の.feed-badgeと同じ見た目の要素を1つ描画して実測することで、
// フォントが変わっても正確な幅を出す(手打ちの推測値だとフォント次第でズレるため)。
function measureBadgeWidth() {
  const probe = document.createElement('span');
  probe.className = 'feed-badge rarity-legend';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.width = 'auto';
  probe.style.whiteSpace = 'nowrap';
  probe.textContent = LONGEST_BADGE_NAME;
  document.body.appendChild(probe);
  const width = Math.ceil(probe.getBoundingClientRect().width);
  document.body.removeChild(probe);
  if (width > 0) {
    document.documentElement.style.setProperty('--feed-badge-width', `${width}px`);
  }
}

function ensureFeedBadgeWidth() {
  if (feedBadgeWidthReady) return;
  feedBadgeWidthReady = true;
  // カスタムフォント(MihoyoZenZero)の読み込み完了を待ってから測る。
  // 先に測ると代替フォントの幅で固定されてしまい、実際の見た目とズレるため。
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measureBadgeWidth);
  } else {
    measureBadgeWidth();
  }
}

// アチーブメントバッジ(名前の行の下に2段目として表示)。投稿時点でbadgeDisplayUnlockedが
// trueかつ実際に称号を設定していた投稿にだけ出す。表示解放済みでも称号未設定の場合や、
// 表示自体が無効だった投稿には何も出さない(未解放の人と同じ通常の1行表示になる)。
// 2段目に独立させることで、称号名がどれだけ長くても(コネクトバトル側の実績名を
// 含め)1行を丸ごと使える。
function buildFeedBadgeEl(entry) {
  if (!entry.badgeDisplayUnlocked) return null;
  if (!entry.badge || !entry.badge.name) return null;
  const badge = document.createElement('span');
  badge.className = `feed-badge rarity-${entry.badge.rarity || 'bronze'}`;
  badge.textContent = (store.lang === 'en' && entry.badge.nameEn) ? entry.badge.nameEn : entry.badge.name;
  return badge;
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
    lineEl.appendChild(document.createTextNode(name));
    if (entry.type === 'achievement') {
      lineEl.appendChild(document.createTextNode(s().achLine(entry.achievementName)));
    } else {
      lineEl.appendChild(document.createTextNode(
        entry.isRare
          ? s().rareLine(entry.cardName || entry.fortuneLevel)
          : s().normalLine(entry.fortuneLevel || entry.cardName)
      ));
      if (entry.isRare) lineEl.classList.add('feed-item-line-rare');
    }

    const timeEl = document.createElement('span');
    timeEl.className = 'feed-item-time';
    timeEl.textContent = relTime(entry.createdAt);

    const row1 = document.createElement('span');
    row1.className = 'feed-item-row1';
    row1.appendChild(lineEl);
    row1.appendChild(timeEl);
    body.appendChild(row1);

    const badgeEl = buildFeedBadgeEl(entry);
    if (badgeEl) {
      const badgeRow = document.createElement('div');
      badgeRow.className = 'feed-badge-row';
      badgeRow.appendChild(badgeEl);
      body.appendChild(badgeRow);
    }

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

    // 管理者・デバッガーは検証で自分の投稿を量産しがちなので、自分の投稿だけ
    // フィードから削除できるボタンを出す(他人の投稿は消せない)。
    if (isFeedDebugger && isMine) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'feed-delete-btn';
      deleteBtn.textContent = '－';
      deleteBtn.title = s().deleteBtnTitle;
      deleteBtn.addEventListener('click', () => deleteFeedEntry(entry.id));
      item.appendChild(deleteBtn);
    }

    list.appendChild(item);
  });
}

async function deleteFeedEntry(feedId) {
  if (!confirm(s().deleteConfirm)) return;
  try {
    await deleteDoc(doc(db, 'omikujiFeed', feedId));
  } catch (e) {
    console.error('[feed] delete failed', e);
    alert(s().deleteFailed);
  }
}

const FEED_WINDOW_HOURS = 48;
// テスト期間中のデータを一覧から除外するための下限(2026-08-04 00:00 ローカル時刻以降のみ表示)
const FEED_CUTOFF_MS = new Date(2026, 7, 4, 0, 0, 0).getTime();

let latestFeedEntries = [];

// 言語切り替え時、既にレンダリング済みのフィード一覧を今の言語で再描画する
export function refreshFeedLang() {
  renderFeedList(latestFeedEntries);
}

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
    latestFeedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderFeedList(latestFeedEntries);
  }, (err) => console.error('[feed] listen failed', err));
}

// 自分が過去にいいねした投稿一覧をリアルタイム購読し、リロード直後や他端末での
// いいねでもボタンの色・disabled状態が正しく反映されるようにする
function startMyLikesListener() {
  const myUserId = getUserId();
  const q = query(collectionGroup(db, 'likes'), where('likerUserId', '==', myUserId));
  onSnapshot(q, (snap) => {
    myLikedIds.clear();
    snap.docs.forEach((d) => {
      const feedId = d.ref.parent.parent?.id;
      if (feedId) myLikedIds.add(feedId);
    });
    renderFeedList(latestFeedEntries);
  }, (err) => console.error('[feed] my-likes listen failed', err));
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

  toast.style.display = 'flex';
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
// ===== 固定フッターの各種カウント（リアルタイム） =====
// アゲ/モラいいねはフッターには出さず、UPをタップした時の説明ポップにだけ数値を出す
let latestLikesGiven    = 0;
let latestLikesReceived = 0;
let latestGachaTickets  = 0;
let latestClaimedMailIds = new Set();
let latestMailDocs = []; // omikujiMailBroadcastsのdocSnap配列(未読バッジ集計用)

function startStatsFooterListener() {
  const upEl    = document.getElementById('stats-up-count');
  const gachaEl = document.getElementById('gacha-ticket-count');
  onSnapshot(doc(db, 'omikujiUsers', getUserId()), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    latestLikesGiven     = d.totalLikesGiven || 0;
    latestLikesReceived  = d.totalLikesReceived || 0;
    latestGachaTickets   = d.sitePerks?.omikuji?.gachaTickets || 0;
    latestClaimedMailIds = new Set(d.claimedMailIds || []);
    if (upEl)    upEl.textContent    = d.ukoPoints || 0;
    if (gachaEl) gachaEl.textContent = latestGachaTickets;
    updateMailBadge();
  }, (err) => console.error('[feed] stats footer listen failed', err));
}

// ===== メール未読バッジ（リアルタイム） =====
function startMailBadgeListener() {
  const q = query(collection(db, 'omikujiMailBroadcasts'), orderBy('createdAt', 'desc'), limit(50));
  onSnapshot(q, (snap) => {
    latestMailDocs = snap.docs;
    updateMailBadge();
  }, (err) => console.error('[feed] mail badge listen failed', err));
}

function updateMailBadge() {
  const badgeEl = document.getElementById('mail-badge');
  if (!badgeEl) return;
  const myUserId = getUserId();
  const unclaimedCount = latestMailDocs.filter((docSnap) => (
    mailIsVisible(docSnap, myUserId) && !latestClaimedMailIds.has(docSnap.id)
  )).length;

  if (unclaimedCount > 0) {
    badgeEl.textContent = unclaimedCount > 9 ? '9+' : String(unclaimedCount);
    badgeEl.style.display = 'flex';
  } else {
    badgeEl.style.display = 'none';
  }
}

// ===== ガチャポップ（カードは最初から裏向きで表示しておき、ボタンを押すとその場で
//       演出が始まる1画面構成。別ポップへの切り替えは行わない） =====
let gachaBusy = false;
let gachaEls = null;

function getGachaEls() {
  if (gachaEls) return gachaEls;
  gachaEls = {
    modal: document.getElementById('gacha-confirm-modal'),
    before: document.getElementById('gacha-confirm-before'),
    after: document.getElementById('gacha-confirm-after'),
    drawBtn: document.getElementById('gacha-confirm-draw-btn'),
    stage: document.getElementById('gacha-stage'),
    rays: document.getElementById('gacha-light-rays'),
    glowRing: document.getElementById('gacha-glow-ring'),
    card: document.getElementById('gacha-card'),
    inner: document.getElementById('gacha-card-inner'),
    flash: document.getElementById('gacha-flash-overlay'),
    sparkleBox: document.getElementById('gacha-sparkle-container'),
    resultImg: document.getElementById('gacha-result-img'),
    resultName: document.getElementById('gacha-result-name'),
    resultLbl: document.getElementById('gacha-result-label'),
    lightbox: document.getElementById('gacha-lightbox'),
    lightboxImg: document.getElementById('gacha-lightbox-img'),
  };
  return gachaEls;
}

// カードを裏向きに戻し、券枚数の表示を最新化する(初回オープン時・演出失敗時に呼ぶ)
function resetGachaStage() {
  const els = getGachaEls();
  if (!els.modal) return;
  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([els.card, els.inner, els.rays, els.glowRing, els.flash]);
    gsap.set(els.inner, { rotateY: 0 });
    gsap.set(els.card, { scale: 1, rotate: 0 });
    gsap.set(els.rays, { opacity: 0, scale: 0.5, rotate: 0 });
    gsap.set(els.glowRing, { opacity: 0, scale: 0.6 });
    gsap.set(els.flash, { opacity: 0 });
  }
  els.resultImg.removeAttribute('src');
  els.resultName.textContent = '';
  els.resultLbl.textContent = '';
  els.sparkleBox.innerHTML = '';
  els.drawBtn.disabled = false;
  els.before.textContent = latestGachaTickets;
  els.after.textContent = Math.max(0, latestGachaTickets - 1);
}

function openGachaInfo() {
  const els = getGachaEls();
  if (!els.modal) return;
  if (!gachaBusy) resetGachaStage();
  els.modal.style.display = 'flex';
}

function closeGachaConfirmModal() {
  const els = getGachaEls();
  if (els.modal) els.modal.style.display = 'none';
}

// rewards/claimMailと同じ発想: サーバー側の関数を持たないため、抽選と消費は
// クライアントのトランザクションで一体化して行う(不正防止はomikujiUsersが
// 元々「本人が誰でも読み書き可」という信頼モデルのため、他機能と同水準)
async function drawGachaTransaction() {
  const userId = getUserId();
  const ref = doc(db, 'omikujiUsers', userId);
  const design = GACHA_DESIGNS[Math.floor(Math.random() * GACHA_DESIGNS.length)];
  let isNew = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('NO_USER_DOC');
    const data = snap.data();
    const tickets = data.sitePerks?.omikuji?.gachaTickets || 0;
    if (tickets < 1) throw new Error('NO_TICKETS');
    isNew = !(data.cardBacks || []).includes(design.id);
    tx.update(ref, {
      'sitePerks.omikuji.gachaTickets': increment(-1),
      cardBacks: arrayUnion(design.id),
    });
  });

  store.cardBacks.add(design.id);
  window.dispatchEvent(new CustomEvent('gachaCardBacksUpdated', { detail: { designId: design.id, isNew } }));
  return design;
}

function spawnGachaSparkles(container, n) {
  container.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle twinkle';
    const x = -8 + Math.random() * 116;
    const y = -8 + Math.random() * 116;
    s.style.left = `${x}%`;
    s.style.top = `${y}%`;
    const size = 6 + Math.random() * 10;
    s.style.width = `${size}px`;
    s.style.height = `${size}px`;
    s.style.animationDuration = `${0.9 + Math.random() * 1.0}s`;
    s.style.animationDelay = `${-Math.random() * 1.9}s`;
    container.appendChild(s);
  }
}

// gacha-preview.htmlで検証した「①光の爆発」演出をそのまま移植
function playGachaReveal(design) {
  const els = getGachaEls();
  return new Promise((resolve) => {
    if (typeof gsap === 'undefined') {
      els.resultImg.src = design.url;
      els.resultName.textContent = design.name;
      resolve();
      return;
    }
    gsap.set(els.inner, { rotateY: 0 });
    gsap.set(els.rays, { opacity: 0, scale: 0.5, rotate: 0 });
    gsap.set(els.glowRing, { opacity: 0, scale: 0.6 });
    gsap.set(els.flash, { opacity: 0 });
    els.sparkleBox.innerHTML = '';

    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(els.card, { scale: 1.06, duration: 0.2, ease: 'power1.out' })
      .to(els.card, { scale: 1, duration: 0.16, ease: 'power1.in' })
      .to(els.card, { rotate: -5, duration: 0.06, repeat: 9, yoyo: true, ease: 'power1.inOut' }, '<')
      .to(els.rays, { opacity: 0.9, scale: 1.5, rotate: 140, duration: 1.0, ease: 'power2.out' }, '<')
      .to(els.glowRing, { opacity: 1, scale: 1.6, duration: 1.0, ease: 'power2.out' }, '<')
      .to(els.card, { scale: 1.18, duration: 0.3, ease: 'power3.in' }, '-=0.15')
      .to(els.flash, { opacity: 0.85, duration: 0.08 })
      .call(() => {
        els.resultImg.src = design.url;
        els.resultName.textContent = design.name;
      })
      .to(els.flash, { opacity: 0, duration: 0.35 }, '<')
      .to(els.inner, { duration: 0.55, ease: 'back.out(2)', rotateY: 180 }, '<')
      .call(() => {
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 150, spread: 95, startVelocity: 55,
            origin: { y: 0.55 },
            colors: ['#ffcc00', '#ff5a5a', '#ffffff', '#8a6bff'],
          });
        }
        els.resultLbl.textContent = s().gachaResultToast(design.name);
        spawnGachaSparkles(els.sparkleBox, 36);
      })
      .to(els.rays, { opacity: 0, duration: 0.5 }, '<')
      .to(els.card, { scale: 1, duration: 0.3, ease: 'power2.out' })
      .to(els.glowRing, { opacity: 0, duration: 0.5 }, '<');
  });
}

async function handleGachaDraw() {
  if (gachaBusy) return;
  if (latestGachaTickets < 1) {
    alert(s().gachaNoTicketAlert);
    return;
  }

  const els = getGachaEls();
  gachaBusy = true;
  els.drawBtn.disabled = true;
  els.resultLbl.textContent = '';

  try {
    const design = await drawGachaTransaction();

    const preload = new Image();
    preload.src = design.url;

    await playGachaReveal(design);

    // 次に引ける枚数を券の表示に反映しておく(latestGachaTicketsはonSnapshotの
    // 反映を待つとラグがあるため、消費した1枚分をここで先に差し引いておく)
    els.before.textContent = Math.max(0, latestGachaTickets - 1);
    els.after.textContent = Math.max(0, latestGachaTickets - 2);
  } catch (e) {
    console.error('[feed] gacha draw failed', e);
    alert(e.message === 'NO_TICKETS' ? s().gachaNoTicketAlert : s().gachaDrawFailedAlert);
    resetGachaStage();
  } finally {
    gachaBusy = false;
    els.drawBtn.disabled = false;
  }
}

// ===== メールボックス（運営からのプレゼント配布） =====
// target未設定(旧データ)は全員向けとして扱う
function mailMatchesTarget(target, myUserId) {
  if (!target || target.type === 'all') return true;
  if (target.type === 'role') return target.role === myRole;
  if (target.type === 'users') return Array.isArray(target.userIds) && target.userIds.includes(myUserId);
  return false;
}

// expiresAt未設定(null/なし)は無期限として扱う
function mailIsExpired(d) {
  return !!(d.expiresAt && d.expiresAt.toMillis() < Date.now());
}

function mailIsVisible(docSnap, myUserId) {
  const d = docSnap.data();
  return mailMatchesTarget(d.target, myUserId) && !mailIsExpired(d);
}

async function openMailPanel() {
  const modal  = document.getElementById('mail-panel');
  const listEl = document.getElementById('mail-panel-list');
  if (!modal || !listEl) return;
  modal.style.display = 'flex';
  listEl.innerHTML = '';

  try {
    const myUserId = getUserId();
    const [mailSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, 'omikujiMailBroadcasts'), orderBy('createdAt', 'desc'), limit(50))),
      getDoc(doc(db, 'omikujiUsers', myUserId)),
    ]);

    const visibleDocs = mailSnap.docs.filter((docSnap) => mailIsVisible(docSnap, myUserId));

    if (visibleDocs.length === 0) {
      const p = document.createElement('p');
      p.className = 'notif-empty';
      p.textContent = s().mailEmpty;
      listEl.appendChild(p);
      return;
    }

    const claimedIds = new Set((userSnap.exists() ? userSnap.data().claimedMailIds : null) || []);

    visibleDocs.forEach((docSnap) => {
      const d = docSnap.data();
      const claimed = claimedIds.has(docSnap.id);

      const row = document.createElement('div');
      row.className = 'notif-row';

      const col = document.createElement('div');
      col.className = 'notif-row-col';
      const title = document.createElement('div');
      title.className = 'notif-row-text';
      title.textContent = d.title || '';
      const msg = document.createElement('div');
      msg.className = 'notif-row-text';
      msg.textContent = d.message || '';
      const time = document.createElement('div');
      time.className = 'notif-row-time';
      time.textContent = relTime(d.createdAt);
      col.appendChild(title);
      if (d.message) col.appendChild(msg);
      col.appendChild(time);
      row.appendChild(col);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mail-claim-btn';
      btn.textContent = claimed ? s().mailClaimedBtn : s().mailClaimBtn;
      btn.disabled = claimed;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await claimMail(docSnap.id, d.rewards);
          btn.textContent = s().mailClaimedBtn;
        } catch (e) {
          console.error('[feed] mail claim failed', e);
          btn.disabled = false;
          alert(s().mailClaimFailed);
        }
      });
      row.appendChild(btn);

      listEl.appendChild(row);
    });
  } catch (e) {
    console.error('[feed] mail list load failed', e);
  }
}

function closeMailPanel() {
  const modal = document.getElementById('mail-panel');
  if (modal) modal.style.display = 'none';
}

// rewards: [{ field: 'sitePerks.omikuji.gachaTickets', amount: 1 }, ...]（省略可）
async function claimMail(mailId, rewards) {
  const ref = doc(db, 'omikujiUsers', getUserId());
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('NO_USER_DOC');
    const claimed = snap.data().claimedMailIds || [];
    if (claimed.includes(mailId)) return;

    // ドットを含むキー(例: 'sitePerks.omikuji.gachaTickets')をネストしたフィールドとして
    // 更新するため、set(merge)ではなくupdate()を使う(setだとキー文字列そのままになってしまう)
    const update = { claimedMailIds: arrayUnion(mailId) };
    (rewards || []).forEach((r) => {
      if (r && typeof r.field === 'string' && typeof r.amount === 'number') {
        update[r.field] = increment(r.amount);
      }
    });
    tx.update(ref, update);
  });
}

export async function initFeed() {
  ensureFeedBadgeWidth();
  initPlayerAvatar();
  await loadFeedDebuggerRole();
  startFeedListener();
  startMyLikesListener();
  startNotifListener();
  startStatsFooterListener();
  startMailBadgeListener();

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

  const upItem = document.getElementById('stats-up-item');
  if (upItem) upItem.addEventListener('click', () => openStatsInfoModal(s().statsUpInfo(latestLikesGiven, latestLikesReceived)));
  const statsInfoClose = document.getElementById('stats-info-close');
  if (statsInfoClose) statsInfoClose.addEventListener('click', closeStatsInfoModal);
  const statsInfoBackdrop = document.querySelector('#stats-info-modal .col-modal-backdrop');
  if (statsInfoBackdrop) statsInfoBackdrop.addEventListener('click', closeStatsInfoModal);

  const gachaBtn = document.getElementById('gacha-btn');
  if (gachaBtn) gachaBtn.addEventListener('click', openGachaInfo);
  const gachaConfirmClose = document.getElementById('gacha-confirm-close');
  if (gachaConfirmClose) gachaConfirmClose.addEventListener('click', closeGachaConfirmModal);
  const gachaConfirmBackdrop = document.querySelector('#gacha-confirm-modal .col-modal-backdrop');
  if (gachaConfirmBackdrop) gachaConfirmBackdrop.addEventListener('click', closeGachaConfirmModal);

  const gachaDrawBtn = document.getElementById('gacha-confirm-draw-btn');
  if (gachaDrawBtn) gachaDrawBtn.addEventListener('click', handleGachaDraw);

  const gachaResultImg = document.getElementById('gacha-result-img');
  const gachaLightbox = document.getElementById('gacha-lightbox');
  const gachaLightboxImg = document.getElementById('gacha-lightbox-img');
  if (gachaResultImg && gachaLightbox && gachaLightboxImg) {
    gachaResultImg.addEventListener('click', () => {
      if (!gachaResultImg.src) return;
      gachaLightboxImg.src = gachaResultImg.src;
      gachaLightbox.classList.add('visible');
    });
    gachaLightbox.addEventListener('click', () => gachaLightbox.classList.remove('visible'));
  }

  const mailBtn = document.getElementById('mail-btn');
  if (mailBtn) mailBtn.addEventListener('click', openMailPanel);
  const mailClose = document.getElementById('mail-panel-close');
  if (mailClose) mailClose.addEventListener('click', closeMailPanel);
  const mailBackdrop = document.querySelector('#mail-panel .col-modal-backdrop');
  if (mailBackdrop) mailBackdrop.addEventListener('click', closeMailPanel);
}

function openStatsInfoModal(text) {
  const modal = document.getElementById('stats-info-modal');
  const textEl = document.getElementById('stats-info-text');
  if (textEl) textEl.textContent = text;
  if (modal) modal.style.display = 'flex';
}

function closeStatsInfoModal() {
  const modal = document.getElementById('stats-info-modal');
  if (modal) modal.style.display = 'none';
}
