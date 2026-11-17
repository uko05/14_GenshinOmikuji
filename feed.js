// feed.js
// みんなの結果フィード・いいね・いいね通知・アバター表示
import { app, db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=4';
import { pickGachaDesign, isStarRailDesign } from './gachaBacks.js?v=28';
import { listenWhileVisible } from './visibleListener.js';
import { ensureLatestVersion } from './versionGuard.js?v=2';
import {
  collection, collectionGroup, doc, addDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, increment, arrayUnion, runTransaction, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getDoc, getDocs, getDocsFromCache, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAggregateFromServer, sum, count } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { genshinChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_data/genshin_chars.js';
import { starrailChars } from 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_data/starrail_chars.js';

const GENSHIN_ICON_BASE  = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/chara_icon/';
const STARRAIL_ICON_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/02_Starrail/chara_icon/';
const DEFAULT_AVATAR_URL = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/00_common/image/sonota.png';
const UKO_AUCTION_URL = 'https://uko05.github.io/26_UkoAuction/';

const STR = {
  ja: {
    noName:    '名無しの旅人',
    feedEmpty: 'まだ結果がありません',
    feedMore: 'もっと見る',
    notifEmpty: 'まだいいねはありません',
    likeToast: (name) => `${name}さんがいいねしました！`,
    likeToastMany: (name, n) => `${name}さんたちから${n}件のいいね！`,
    justNow:   'たった今',
    minAgo:    (n) => `${n}分前`,
    hourAgo:   (n) => `${n}時間前`,
    // 名前の直後にアチーブバッジ(あれば)を差し込めるよう、名前より後ろの
    // サフィックス部分だけを返す(nameは呼び出し側で別ノードとして先に出す)。
    normalLine: (level) => `さんが${level}を引きました`,
    rareLine:   (card)  => `さんが${card}を引き当てました！`,
    achLine:    (ach)   => `さんが「${ach}」を取得しました！`,
    gachaGetLine: (name) => `さんがガチャで「${name}」を入手しました！`,
    listingLine:  (name) => `さんが「${name}」を出品しました`,
    auctionBtnLabel: 'オークションへ',
    statsUpInfo: (given, received) => `「UP（うーこポイント）」は、他の人の結果にいいねする（アゲいいね：あなたは今${given}回、1回で1UP）、または自分の結果にいいねをもらう（モラいいね：あなたは今${received}回、1回で2UP）と貯まるポイントです。今後は他のサイトでミッションをクリアしてももらえるようになる予定です。貯めたUPは引き換え専用サイトで、色々なサイトのちょっとした特典と交換できます！`,
    mailEmpty: '届いているメールはありません',
    mailExpandBtn: '本文を表示する',
    mailClaimBtn: '受け取る',
    mailClaimedBtn: '受取済み',
    mailClaimFailed: '受け取りに失敗しました。時間をおいて再度お試しください。',
    gachaResultToast: (name) => `「${name}」を手に入れた！`,
    gachaNoTicketAlert: 'ガチャ券がありません。',
    gachaDrawFailedAlert: 'ガチャの抽選に失敗しました。時間をおいて再度お試しください。',
    deleteBtnTitle: 'この投稿をフィードから削除(管理者専用)',
    deleteConfirm:  'この投稿をみんなの結果から削除しますか？（他の人からも見えなくなります）',
    deleteFailed:   '削除に失敗しました。',
    missionAchievedToast: 'ミッション達成！うーこポイント交換所で受け取ろう',
  },
  en: {
    noName:    'Nameless Traveler',
    feedEmpty: 'No results yet',
    feedMore: 'Load more',
    notifEmpty: 'No likes yet',
    likeToast: (name) => `${name} liked your fortune!`,
    likeToastMany: (name, n) => `${n} likes from ${name} and others!`,
    justNow:   'just now',
    minAgo:    (n) => `${n}m ago`,
    hourAgo:   (n) => `${n}h ago`,
    normalLine: (level) => ` got ${level}!`,
    rareLine:   (card)  => ` drew ${card}!!`,
    achLine:    (ach)   => ` unlocked "${ach}"!`,
    gachaGetLine: (name) => ` got "${name}" from the gacha!`,
    listingLine:  (name) => ` listed "${name}" for auction`,
    auctionBtnLabel: 'To Auction',
    statsUpInfo: (given, received) => `"UP" (Uko Points) are earned by liking other people's results (Given: ${given} so far, 1 UP each) or having your own results liked (Received: ${received} so far, 2 UP each). You'll also be able to earn them by completing missions on other sites in the future. Saved-up UP can be used on the dedicated redemption site to unlock small perks across various sites!`,
    mailEmpty: 'No mail yet',
    mailExpandBtn: 'Show full message',
    mailClaimBtn: 'Claim',
    mailClaimedBtn: 'Claimed',
    mailClaimFailed: 'Failed to claim. Please try again later.',
    gachaResultToast: (name) => `You got "${name}"!`,
    gachaNoTicketAlert: 'You have no gacha tickets.',
    gachaDrawFailedAlert: 'The gacha draw failed. Please try again later.',
    deleteBtnTitle: 'Delete this post from the feed (admin only)',
    deleteConfirm:  'Delete this post from everyone\'s results? (Others will no longer see it either)',
    deleteFailed:   'Failed to delete.',
    missionAchievedToast: 'Mission complete! Claim it on the UPoint page.',
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

// 出品・入札などアカウント登録者限定にしたい機能から使う。
// 見るだけ(一覧閲覧)は未登録でも可能にしたいので、そちらでは使わないこと。
export async function isAccountLoggedIn() {
  await authReady;
  return !!authUid;
}

// ===== うーこポイント交換所(08_UPoint)の「1回限りミッション」達成フラグ =====
// 01_TiersList等、他サイトの画像生成ミッションと同じ二段階方式(達成フラグを立てるだけで、
// UP付与は08_UPoint側の「受け取る」操作で行う)。未ログイン(AccountCenter未連携)だと
// localStorageの匿名IDをリセットして何度でも達成扱いにできてしまうため、ログイン中のみ立てる。
function showMissionToast(text) {
  let toast = document.getElementById('uko-mission-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'uko-mission-toast';
    toast.className = 'uko-mission-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.remove('show');
  void toast.offsetWidth; // reflow
  toast.classList.add('show');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

export async function markMissionAchievedOnce(claimKey) {
  if (!(await isAccountLoggedIn())) return;
  const userId = getUserId();
  const ref = doc(db, 'omikujiUsers', userId);
  try {
    const achieved = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      if (data.missionsAchieved?.[claimKey] || data.missionsClaimed?.[claimKey]) return false;
      tx.set(ref, { missionsAchieved: { [claimKey]: true } }, { merge: true });
      return true;
    });
    if (achieved) showMissionToast(s().missionAchievedToast);
  } catch (e) {
    console.error('[feed] mission mark failed', e);
  }
}

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

// 開いている間は、読んだアバターを使い回す(2026-10-26、読み取り削減。いいねのたびに読んでいた)。
// このページで変えた時は selectAvatarFromPicker が更新する。他のサイトで変えた分は開き直すと反映される。
const avatarCache = new Map();
async function getMyAvatar(userId) {
  if (avatarCache.has(userId)) return avatarCache.get(userId);
  try {
    const snap = await getDoc(doc(db, 'userAvatars', userId));
    const d = snap.exists() ? snap.data() : {};
    const v = { game: d.game || null, icon: d.icon || null };
    avatarCache.set(userId, v);
    return v;
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
    avatarCache.set(getUserId(), { game: game || null, icon: icon || null });
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

// ===== ガチャNEW入手のフィード投稿(被りの時は呼ばない) =====
export async function submitGachaFeedEntry({ name, cardBackId, cardBackName, cardBackUrl }) {
  if (store.hideFromFeed) return;
  try {
    const userId = getUserId();
    const avatar = await getMyAvatar(userId);
    await addDoc(collection(db, 'omikujiFeed'), {
      type: 'gacha',
      userId,
      name: name || '',
      cardBackId: cardBackId || '',
      cardBackName: cardBackName || '',
      cardBackUrl: cardBackUrl || '',
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      likeCount: 0,
      createdAt: serverTimestamp(),
      ...getBadgeSnapshot(),
    });
  } catch (e) {
    console.error('[feed] gacha submit failed', e);
  }
}

// ===== 出品のフィード投稿(26_UkoAuctionへのディープリンク付き) =====
export async function submitListingFeedEntry({ name, itemId, itemName, itemImageUrl, listingId }) {
  if (store.hideFromFeed) return;
  try {
    const userId = getUserId();
    const avatar = await getMyAvatar(userId);
    await addDoc(collection(db, 'omikujiFeed'), {
      type: 'listing',
      userId,
      name: name || '',
      itemId: itemId || '',
      itemName: itemName || '',
      itemImageUrl: itemImageUrl || '',
      listingId: listingId || '',
      avatarGame: avatar.game,
      avatarIcon: avatar.icon,
      likeCount: 0,
      createdAt: serverTimestamp(),
      ...getBadgeSnapshot(),
    });
  } catch (e) {
    console.error('[feed] listing submit failed', e);
  }
}

// ===== いいね =====
const myLikedIds = new Set();

// 管理者ロールは確認用に同じ投稿へ何度でもいいねできる(デバッガーはコネクトバトル専用、2026-10-02)
let isFeedDebugger = false;
let myRole = 'general'; // メールのロール指定配信の絞り込みに使う
async function loadFeedDebuggerRole() {
  try {
    const snap = await getDoc(doc(db, 'sharedUserRoles', getUserId()));
    if (snap.exists()) {
      const d = snap.data();
      isFeedDebugger = d.role === 'admin';
      myRole = d.role || 'general';
    }
  } catch (e) {
    console.warn('[feed] role fetch failed', e);
  }
}

// 相手が「モラいいねUPアップ」中かどうかは、同じ相手なら10分間使い回す(2026-10-26、読み取り削減)。
// 相手が特典を買った直後の最大10分は、受け取りが+3ではなく+2になることがある。
const RECEIVE_BOOST_CACHE_MS = 10 * 60 * 1000;
const receiveBoostCache = new Map(); // userId -> { until, at }
async function getReceiveBoostUntil(userId) {
  const c = receiveBoostCache.get(userId);
  if (c && Date.now() - c.at < RECEIVE_BOOST_CACHE_MS) return c.until;
  const snap = await getDoc(doc(db, 'omikujiUsers', userId));
  const until = snap.exists() ? (snap.data().sitePerks?.omikuji?.likeReceiveBoostUntil?.toMillis?.() || 0) : 0;
  receiveBoostCache.set(userId, { until, at: Date.now() });
  return until;
}

async function toggleLike(entry, likeBtn) {
  const myUserId = getUserId();
  const privileged = isFeedDebugger;

  if (!privileged && myLikedIds.has(entry.id)) return;

  likeBtn.disabled = true;
  try {
    const likeRef = doc(db, 'omikujiFeed', entry.id, 'likes', myUserId);
    // いいね済みかどうかを先に読むのは管理者だけ(取り消して押し直せるため)。一般の人は読まずに
    // そのまま書き、すでにいいね済みならルール(likes は作成のみで上書き不可)で拒否されるので、
    // それを「いいね済み」として扱う(2026-10-26、読み取り削減)。
    const already = privileged ? await getDoc(likeRef) : null;

    if (already && already.exists()) {
      // デバッガー・管理者: 確認用にいいねを取り消して再度押せる状態に戻す
      // (再描画をトリガーするlikeCount更新より先にローカル状態を更新し、再描画時の色反映ズレを防ぐ)
      // ブースト分は「いいねした時点」の状態で決まる(giveAmount/receiveAmount)ので、
      // 取り消し時は現在のブースト状況ではなく、当時のいいねドキュメントに記録した
      // 金額をそのまま逆再生する(取り消しまでの間にブーストが切れていてもズレない)。
      const prev = already.data();
      const giveAmount = prev.giveAmount || 1;
      const receiveAmount = prev.receiveAmount || 2;
      await deleteDoc(likeRef);
      myLikedIds.delete(entry.id);
      rememberMyLike(entry.id, false);
      likeBtn.classList.remove('liked');
      await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(-1) });
      bumpLocalLikeCount(entry.id, -1);
      await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(-1), ukoPoints: increment(-receiveAmount) }, { merge: true });
      await setDoc(doc(db, 'omikujiUsers', myUserId), { totalLikesGiven: increment(-1), ukoPoints: increment(-giveAmount) }, { merge: true });
      return;
    }

    // UP(うーこポイント)基本額: モラいいね1回=2UP、アゲいいね1回=1UP。08_UPointの
    // 「アゲ/モラいいねUPアップ」(sitePerks.omikuji.like{Give,Receive}BoostUntil、
    // 24時間だけ効く時限ブースト)が有効なら、それぞれ+1する。与える側(自分)は
    // 手元のstoreで判定(他の特典と同じく、購入直後は別タブなら反映まで再読み込みが
    // 必要になる場合がある)、受け取る側(相手)は自分のデータではないので毎回
    // Firestoreから最新を読んで判定する。
    const now = Date.now();
    const myGiveBoostUntil = store.sitePerks?.omikuji?.likeGiveBoostUntil?.toMillis?.() || 0;
    const giveAmount = myGiveBoostUntil > now ? 2 : 1;

    const targetReceiveBoostUntil = await getReceiveBoostUntil(entry.userId);
    const receiveAmount = targetReceiveBoostUntil > now ? 3 : 2;

    // receiverUserId: このいいねドキュメント自体(likes/{likerUserId})はentry.idの下に
    // ぶら下がっているので誰の投稿かはentry.userIdでしか分からない。管理者画面のUP取得
    // 履歴でcollectionGroup('likes')横断検索から「誰が受け取ったか」を直接引けるように、
    // 冗長でもここにコピーしておく(2026-09-19追加)。
    try {
      await setDoc(likeRef, {
        likedAt: serverTimestamp(), likerUserId: myUserId, receiverUserId: entry.userId, giveAmount, receiveAmount,
      });
    } catch (e) {
      if (e?.code === 'permission-denied') {
        // 別の端末などで、すでにいいね済み
        myLikedIds.add(entry.id);
        rememberMyLike(entry.id, true);
        likeBtn.classList.add('liked');
        return;
      }
      throw e;
    }
    myLikedIds.add(entry.id);
    rememberMyLike(entry.id, true);
    likeBtn.classList.add('liked');
    await updateDoc(doc(db, 'omikujiFeed', entry.id), { likeCount: increment(1) });
    bumpLocalLikeCount(entry.id, 1);
    await setDoc(doc(db, 'omikujiUsers', entry.userId), { totalLikesReceived: increment(1), ukoPoints: increment(receiveAmount) }, { merge: true });
    await setDoc(doc(db, 'omikujiUsers', myUserId), { totalLikesGiven: increment(1), ukoPoints: increment(giveAmount) }, { merge: true });

    // 通知は「受け取る人×1時間」で1件にまとめ、いいねのたびに件数を足す(2026-10-25、書き込み削減)。
    // 以前は1いいね1件で、作成・表示済み・24時間後の削除で計3件の書き込みになっていた。
    // createdAt はその1時間の始まり(固定値)なので、24時間後の削除(likeNotifCleanup)もそのまま効く。
    // 'shown' は付けない(古い版の画面の「shown==false」の購読に引っかからないように)。
    const myAvatar = await getMyAvatar(myUserId);
    const hourMs = Math.floor(Date.now() / 3600000) * 3600000;
    await setDoc(doc(db, 'omikujiLikeNotifications', `${entry.userId}_${hourMs}`), {
      toUserId: entry.userId,
      fromUserId: myUserId,
      fromName: store.name || '',
      fromAvatarGame: myAvatar.game,
      fromAvatarIcon: myAvatar.icon,
      feedId: entry.id,
      createdAt: Timestamp.fromMillis(hourMs),
      updatedAt: serverTimestamp(),
      count: increment(1),
    }, { merge: true });
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
// 宝くじの結果のまとめ(フィード用。2026-11-17)
const LOTTERY_FEED_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="#ffcc00"/><path d="M10 14h20v4a3 3 0 0 0 0 6v4H10v-4a3 3 0 0 0 0-6z" fill="none" stroke="#4a3600" stroke-width="2" stroke-linejoin="round"/><path d="M23 14v14" stroke="#4a3600" stroke-width="1.6" stroke-dasharray="2 2"/></svg>');
function lotteryFeedLine(e) {
  const en = store.lang === 'en';
  const nm = (x) => x || (en ? 'No name' : '名無し');
  const hm = (ms) => { const j = new Date(ms + 9 * 3600e3); return `${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}`; };
  // 2026-11-17: 発表は「まもなく発表」→ 3等(1人1件)→ 2等 → 1等 の順に流れる
  if (e.kind === 'remind') return en
    ? `UP Lottery: ${e.hours} hour${e.hours > 1 ? 's' : ''} left to buy! Prize pool ${e.pool.toLocaleString()} UP (${e.totalTickets} tickets, ${e.participants} players)`
    : `UP宝くじ購入締め切りまであと${e.hours}時間！ 賞金の合計 ${e.pool.toLocaleString()}UP（${e.totalTickets}口・${e.participants}人）`;
  if (e.kind === 'pre') return en
    ? `UP Lottery results at ${hm(e.resultMs)}! Prize pool ${e.pool.toLocaleString()} UP (${e.totalTickets} tickets, ${e.participants} players)${e.enough ? '' : ' - fewer than 9 players, likely carried over'}`
    : `まもなくUP宝くじの結果発表（${hm(e.resultMs)}）！ 賞金の合計 ${e.pool.toLocaleString()}UP（${e.totalTickets}口・${e.participants}人）${e.enough ? '' : '／参加者が9人に届かないため持ち越しの見込み'}`;
  if (e.kind === 'win') return en
    ? `UP Lottery ${e.tier === 1 ? '1st' : e.tier === 2 ? '2nd' : '3rd'} prize: ${nm(e.winnerName)} (${e.amount.toLocaleString()} UP${e.crystals ? ` + ${e.crystals} crystal${e.crystals > 1 ? 's' : ''}` : ''})${e.tier === 1 ? '!' : ''}`
    : `UP宝くじ ${e.tier}等 ${nm(e.winnerName)}さん（${e.amount.toLocaleString()}UP${e.crystals ? `＋結晶${e.crystals}個` : ''}）${e.tier === 1 ? '！おめでとうございます！' : ''}`;
  if (e.kind === 'carried') return en
    ? `UP Lottery: fewer than 9 players, carried over to the next round with ${e.pool.toLocaleString()} UP`
    : `UP宝くじ：参加者が9人に届かなかったため、賞金 ${e.pool.toLocaleString()}UP と口数を次の回へ持ち越します`;
  const f = e.first;
  const p1 = f ? (en ? `1st ${nm(f.name)} (${f.amount.toLocaleString()} UP + ${f.crystals} crystals)` : `1等 ${nm(f.name)}さん（${f.amount.toLocaleString()}UP＋結晶${f.crystals}個）`) : '';
  const p2 = (e.seconds || []).length ? (en ? ` / 2nd ${e.seconds.map(nm).join(', ')}` : `／2等 ${e.seconds.map((x) => nm(x) + 'さん').join('・')}`) : '';
  const p3 = e.thirdCount ? (en ? ` / 3rd ${e.thirdCount} winners` : `／3等 ${e.thirdCount}人`) : '';
  return (en ? 'UP Lottery results: ' : 'UP宝くじの結果：') + p1 + p2 + p3;
}

function renderFeedList(entries) {
  const list = document.getElementById('feed-list');
  if (!list) return;
  const myUserId = getUserId();
  const keepScroll = list.scrollTop; // 描き直しても見ていた位置のままにする(「もっと見る」・いいねの後など)
  list.innerHTML = '';

  // 公開前の宝くじの結果(adminOnly)は管理者にだけ出す
  const visibleEntries = entries.filter((e) => !(e.adminOnly && !isFeedDebugger));

  if (!visibleEntries.length) {
    const p = document.createElement('p');
    p.className = 'feed-empty';
    p.textContent = s().feedEmpty;
    list.appendChild(p);
    return;
  }

  visibleEntries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    if (entry.type === 'achievement') {
      item.classList.add('feed-item-achievement', `rarity-${entry.rarity || 'bronze'}`);
    } else if (entry.type === 'gacha') {
      item.classList.add('feed-item-gacha');
      // スタレ裏面は星空っぽい紺〜青で、ほかの投稿より少し目立たせる(2026-10-09)
      if (isStarRailDesign(entry.cardBackId)) item.classList.add('feed-item-gacha-sr');
    } else if (entry.type === 'listing') {
      item.classList.add('feed-item-listing');
    } else if (entry.type === 'lottery') {
      item.classList.add('feed-item-lottery');
      if (entry.kind === 'win') item.classList.add(`lottery-tier-${entry.tier}`);
    }

    const avatar = document.createElement('img');
    avatar.className = 'feed-avatar';
    avatar.src = entry.type === 'lottery' ? LOTTERY_FEED_ICON : avatarUrl(entry.avatarGame, entry.avatarIcon);
    if (entry.type === 'lottery') {
      // 宝くじの投稿のチケットのアイコンを押すと、UP交換所の宝くじタブを開く(2026-11-17)
      avatar.classList.add('feed-avatar-link');
      avatar.title = store.lang === 'en' ? 'Open the UP Lottery' : 'UP宝くじを開く';
      avatar.addEventListener('click', (ev) => { ev.stopPropagation(); window.open(`${LOTTERY_UPOINT_URL}?tab=lottery`, '_blank', 'noopener'); });
    }
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
    } else if (entry.type === 'gacha') {
      if (isStarRailDesign(entry.cardBackId)) lineEl.insertBefore(document.createTextNode('✦ '), lineEl.firstChild);
      lineEl.appendChild(document.createTextNode(s().gachaGetLine(entry.cardBackName)));
    } else if (entry.type === 'listing') {
      lineEl.appendChild(document.createTextNode(s().listingLine(entry.itemName)));
    } else if (entry.type === 'lottery') {
      lineEl.textContent = lotteryFeedLine(entry);
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
    if (entry.type === 'gacha' && entry.cardBackUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'feed-gacha-thumb-inline';
      thumb.src = entry.cardBackUrl;
      thumb.alt = entry.cardBackName || '';
      thumb.loading = 'lazy';
      thumb.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openGachaLightbox(entry.cardBackUrl);
      });
      row1.appendChild(thumb);
    } else if (entry.type === 'listing' && entry.itemImageUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'feed-gacha-thumb-inline';
      thumb.src = entry.itemImageUrl;
      thumb.alt = entry.itemName || '';
      thumb.loading = 'lazy';
      thumb.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openGachaLightbox(entry.itemImageUrl);
      });
      row1.appendChild(thumb);
    }
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

    const isMine = entry.userId === myUserId;

    // 出品通知(type:'listing')は08_UPointで「オークション出品へのいいねを解放」を
    // 交換した人だけ、通常と同じいいねボタンを「オークションへ」リンクの左に出す
    // (未交換の人には従来通りリンクだけ)。likeCount自体は出品通知にも最初から
    // 持たせてあるので、ボタンを出す条件だけの違い。
    const listingLikeUnlocked = !!store.sitePerks?.omikuji?.listingLikeUnlocked;
    if (entry.type !== 'lottery' && (entry.type !== 'listing' || listingLikeUnlocked)) {
      const likeBtn = document.createElement('button');
      likeBtn.className = 'feed-like-btn';
      likeBtn.innerHTML = `<span class="feed-like-icon">👍</span><span class="feed-like-count">${entry.likeCount || 0}</span>`;
      const isLiked = myLikedIds.has(entry.id);
      if (!isFeedDebugger && isLiked) {
        likeBtn.disabled = true;
        likeBtn.classList.add('liked');
      } else {
        if (isLiked) likeBtn.classList.add('liked');
        likeBtn.addEventListener('click', () => toggleLike(entry, likeBtn));
      }
      item.appendChild(likeBtn);
    }

    if (entry.type === 'listing') {
      // 出品されたアイテムの入札画面へ直接飛べるリンク
      const auctionLink = document.createElement('a');
      auctionLink.className = 'feed-like-btn feed-auction-btn';
      auctionLink.href = `${UKO_AUCTION_URL}?listing=${encodeURIComponent(entry.listingId || '')}`;
      auctionLink.textContent = s().auctionBtnLabel;
      item.appendChild(auctionLink);
    }

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

  // 続きの投稿(最初は50件だけ読む。2026-10-25)
  if (feedHasMore && visibleEntries.length < FEED_LIMIT) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'feed-like-btn feed-more-btn';
    more.textContent = s().feedMore;
    more.disabled = loadingMoreFeed;
    more.addEventListener('click', loadMoreFeed);
    list.appendChild(more);
  }
  list.scrollTop = keepScroll;
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

// フィードに載せる投稿の起点。フィード本体と自分のいいね履歴の購読で同じ値を使うため、
// ページを開いた時に一度だけ決める。1時間単位に切り捨てる(2026-09-27)のは、購読条件が
// 同じならFirestoreのキャッシュ(resume token)が効き、タブ復帰や同じ時間帯のリロードで
// 変わったドキュメントだけの読み取りで済むため。48時間の投稿数はlimit(200)を大きく
// 上回るので、起点が最大1時間ずれてもフィードの表示は変わらない。
let feedSince = null;
function getFeedSince() {
  if (!feedSince) {
    const HOUR_MS = 60 * 60 * 1000;
    const rollingSinceMs = Math.floor((Date.now() - FEED_WINDOW_HOURS * HOUR_MS) / HOUR_MS) * HOUR_MS;
    feedSince = Timestamp.fromMillis(Math.max(rollingSinceMs, FEED_CUTOFF_MS));
  }
  return feedSince;
}

// フィードの読み込み(2026-10-04 変更、読み取り削減)。
// 以前は直近200件をリアルタイム購読していたため、いいね1件ごとに投稿の likeCount が書き換わり、
// 画面を開いている全員に1件ずつ読み取りが発生していた(いいねは1日約1万件、閲覧者の数だけ倍になる)。
// 今は「開いた時に1回だけ200件読む」+「一番新しい投稿1件だけを見張り、新しい投稿が来たら
// 増えた分だけ追加で読む」。他の人のいいね数は開き直すまで更新しない(自分のいいねはその場で反映)。
// 2026-10-25: 開いた時に読むのは新しい50件だけにし、続きは「もっと見る」で50件ずつ(最大200件)読む。
// 開くたびに200件を読んでいたのが、おみくじの読み取りでいちばん大きかったため
const FEED_LIMIT = 200;
const FEED_PAGE = 50;
let feedHasMore = false;
let loadingMoreFeed = false;
let feedNewestMs = 0;
const feedCreatedMs = (e) => e.createdAt?.toMillis?.() || 0;

// 2026-11-17: フィードを「結果」(おみくじ・ガチャ・実績)と「出品」(オークション出品)のタブに分けた。
// フィードのほぼ半分が出品のお知らせで、結果が見づらかったため。読むのは開いているタブの分だけ
// (出品タブは押した時に初めて読む)なので、開いた時の読み取りは今まで通り50件。
// 索引: omikujiFeed (type ASC, createdAt DESC)
// 2026-11-17: 宝くじの結果のまとめ(type 'lottery'。functions/lottery.js が抽選のたびに1件)も「結果」タブに出す
const FEED_TABS = { results: ['fortune', 'gacha', 'achievement', 'lottery'], listing: ['listing'] };
let feedTab = 'results';
const feedTabState = {};   // タブ → { entries, hasMore, newestMs, stale }
const feedTypeFilter = () => (FEED_TABS[feedTab].length === 1
  ? where('type', '==', FEED_TABS[feedTab][0])
  : where('type', 'in', FEED_TABS[feedTab]));
const FEED_CACHE_KEY_BASE = 'omikujiFeedServerAt';
const feedCacheKey = () => `${FEED_CACHE_KEY_BASE}_${feedTab}`;
// 2026-10-31: 30分→3時間(よく使う人は1日に何十回も開き直し、そのたびに50件読んでいた)
const FEED_CACHE_MS = 3 * 60 * 60 * 1000;

// ===== 宝くじタブ(2026-11-17。購入は 08_UPoint、抽選は 24_AccountCenter/functions/lottery.js) =====
// フィードの3つめのタブ。今回の回(賞金・口数・参加者)と前回の結果を出す。読み取りは開いた時に回のドキュメント2件だけ。
const LOTTERY_PUBLIC = false;   // false の間は管理者だけにタブを出す(試しの期間)
const LOTTERY_UPOINT_URL = 'https://uko05.github.io/08_UPoint/';
let lotteryOpen = false;
const isLotteryVisible = () => LOTTERY_PUBLIC || myRole === 'admin';
const LOT = {
  ja: {
    now: (c, r) => `今回 ${c} 締め切り・${r} 結果発表`, pool: '賞金の合計', first: '1等の賞金', tickets: '全体の口数', myTickets: '購入口数', people: '参加者',
    hourly: '（開いた時点の数字です）', buy: 'UP交換所で買う', last: (d) => `前回（${d}）の結果`, noLast: 'まだ結果はありません',
    tier: (n) => `${n}等`, ticketsOf: (n) => `${n}口`, none: '該当なし', total: (n, p) => `全体 ${n}口・${p}人`,
    crystals: (n) => `＋結晶${n}個`, test: '試しの期間（管理者だけに表示中）', noName: '名無し', loading: '読み込み中…',
    waiting: '22:00 に結果を発表します',
    carried: (d) => `参加者が9人に届かなかったため、抽選は次の回（${d}）へ持ち越しになりました。口数と賞金はそのまま引き継がれます。`,
    carriedIn: '前の回からの持ち越しを含みます',
    firstLabel: '1等の賞金（1人）', firstHint: '＋ 願いの結晶 2個', secondLabel: '2等（1人あたり）', secondHint: '＋ 結晶 1個',
    thirdLabel: '3等（5人・1人あたり）', thirdHint: '賞金の2%ずつ',
  },
  en: {
    now: (c, r) => `This round: sales close ${c} JST, results ${r}`, pool: 'Total prize', first: '1st prize', tickets: 'Tickets', myTickets: 'Yours', people: 'Players',
    hourly: '(as of when you opened this tab)', buy: 'Buy at UP Exchange', last: (d) => `Last round (${d})`, noLast: 'No results yet',
    tier: (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : 'rd'}`, ticketsOf: (n) => `${n} tix`, none: 'None', total: (n, p) => `${n} tickets / ${p} players`,
    crystals: (n) => ` + ${n} crystal${n > 1 ? 's' : ''}`, test: 'Test period (admins only)', noName: 'No name', loading: 'Loading…',
    waiting: 'Results at 22:00',
    carried: (d) => `Fewer than 9 players, so the draw was carried over to the next round (${d}). Tickets and prize carry over.`,
    carriedIn: 'Includes a carry-over from the previous round',
    firstLabel: '1st prize (1 winner)', firstHint: '+ 2 Wish Crystals', secondLabel: '2nd prize (each)', secondHint: '+ 1 crystal',
    thirdLabel: '3rd prize (5 winners, each)', thirdHint: '2% of the pool each',
  },
};
const lotT = () => LOT[store.lang === 'en' ? 'en' : 'ja'];

// 今の回と前回(サーバーの lottery.js と同じ決め方: 1日と16日、22時に発表)
// 試しの期間(2026-11-17。ukoLotteryConfig/main の testUntil・testIntervalMin)なら、その間隔の回(名前は T+発表時刻、締め切りは5分前)
function lotteryTestSlot(nowMs, cfg, back = 0) {
  const until = cfg && cfg.testUntil && cfg.testUntil.toMillis ? cfg.testUntil.toMillis() : 0;
  if (!(until > nowMs && cfg.testIntervalMin > 0)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const iv = cfg.testIntervalMin * 60e3;
  const res = Math.floor(nowMs / iv) * iv + iv - back * iv;
  const j = new Date(res + 9 * 3600e3);
  const id = `T${j.getUTCFullYear()}${pad(j.getUTCMonth() + 1)}${pad(j.getUTCDate())}-${pad(j.getUTCHours())}${pad(j.getUTCMinutes())}`;
  return { drawId: id, id, closeMs: res - 5 * 60e3, resultMs: res };
}
// 日時の表示(日本時間 M/D HH:MM)
function lotteryFmt(ms) {
  const j = new Date(ms + 9 * 3600e3);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}`;
}
// カウントダウン(2026-11-17)。「締め切りまで 残り08日 10:25:10（11/16 21:00）」の形。端末の時計で1秒ごとに書き換えるだけ(読み書きなし)
// 回のタイトル(2026-11-17)。本番は 2026-12-01 を第1回として1日・16日ごとに数える。試しの回は「試し HH:MM の回」
function lotteryRoundTitle(drawId, en) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(drawId || '');
  if (m) {
    const n = (Number(m[1]) - 2026) * 24 + (Number(m[2]) - 12) * 2 + (Number(m[3]) === 16 ? 1 : 0) + 1;
    return en ? `UP Lottery #${n}` : `第${n}回UP宝くじ`;
  }
  const t = /-(\d{2})(\d{2})$/.exec(drawId || '');
  return en ? `UP Lottery (test ${t ? `${t[1]}:${t[2]}` : ''})` : `UP宝くじ（試し ${t ? `${t[1]}:${t[2]}` : ''}の回）`;
}
let lotteryCdTimer = null;
function lotteryCountdown(el, closeMs, resultMs, en) {
  if (lotteryCdTimer) clearInterval(lotteryCdTimer);
  const p2 = (n) => String(n).padStart(2, '0');
  const tick = () => {
    if (!el.isConnected) { clearInterval(lotteryCdTimer); lotteryCdTimer = null; return; }
    const now = Date.now();
    // 2026-11-17: 「購入締め切りまで」と「結果発表まで」を2行に分けて、どちらの時刻か分かるように
    const left = (target) => {
      let sec = Math.max(0, Math.floor((target - now) / 1000));
      const d = Math.floor(sec / 86400); sec -= d * 86400;
      const h = Math.floor(sec / 3600); sec -= h * 3600;
      const m = Math.floor(sec / 60); sec -= m * 60;
      return `${en ? '' : '残り'}${p2(d)}${en ? 'd' : '日'} ${p2(h)}:${p2(m)}:${p2(sec)}（${lotteryFmt(target)}）`;
    };
    const line1 = now < closeMs ? `${en ? 'Sales close in' : '購入締め切りまで'} ${left(closeMs)}` : (en ? 'Sales closed' : '購入は締め切りました');
    const line2 = now < resultMs ? `${en ? 'Results in' : '結果発表まで'} ${left(resultMs)}` : (en ? 'Results coming soon! Check the feed.' : 'まもなく発表！ フィードをチェック');
    el.innerHTML = `<span class="lottery-cd-close">${line1}</span><span class="lottery-cd-result">${line2}</span>`;
  };
  tick();
  lotteryCdTimer = setInterval(tick, 1000);
}
function lotteryDraws(nowMs = Date.now(), cfg = {}) {
  const ts = lotteryTestSlot(nowMs, cfg);
  if (ts) {
    const pv = lotteryTestSlot(nowMs, cfg, 1);
    return { cur: { ...ts, label: lotteryFmt(ts.resultMs) }, prev: { ...pv, label: lotteryFmt(pv.resultMs) } };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const list = [];
  const j = new Date(nowMs + 9 * 3600e3);
  let y = j.getUTCFullYear(), m = j.getUTCMonth() + 1 - 1;
  if (m < 1) { m = 12; y -= 1; }
  for (let k = 0; k < 4; k++) {
    for (const day of [1, 16]) list.push({ id: `${y}-${pad(m)}-${pad(day)}`, label: `${m}/${day}`, closeMs: Date.UTC(y, m - 1, day, 21 - 9), resultMs: Date.UTC(y, m - 1, day, 22 - 9) });
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  const i = list.findIndex((d) => d.resultMs > nowMs);
  return { cur: list[i], prev: list[i - 1] };
}

function openLotteryTab() {
  lotteryOpen = true;
  renderFeedTabs();
  const list = document.getElementById('feed-list');
  const panel = document.getElementById('feed-lottery');
  if (list) list.hidden = true;
  if (panel) panel.hidden = false;
  loadLotteryPanel();
}
function closeLotteryTab() {
  lotteryOpen = false;
  const list = document.getElementById('feed-list');
  const panel = document.getElementById('feed-lottery');
  if (list) list.hidden = false;
  if (panel) panel.hidden = true;
}

async function loadLotteryPanel() {
  const panel = document.getElementById('feed-lottery');
  if (!panel) return;
  const t = lotT();
  panel.innerHTML = `<p class="lottery-muted">${t.loading}</p>`;
  let cfg = {};
  try { const cs = await getDoc(doc(db, 'ukoLotteryConfig', 'main')); cfg = cs.exists() ? cs.data() : {}; } catch (e) { cfg = {}; }
  const { cur, prev } = lotteryDraws(Date.now(), cfg);
  let c = null, p = null, mine = 0;
  try {
    // 今回の口数・参加者は、その場で数える(合計を数える集計なので読み取りは1回分。2026-11-17)
    const [cs, ps, agg, ms] = await Promise.all([
      getDoc(doc(db, 'ukoLottery', cur.id)), getDoc(doc(db, 'ukoLottery', prev.id)),
      getAggregateFromServer(query(collection(db, 'ukoLotteryEntries'), where('drawId', '==', cur.id)), { total: sum('count'), n: count() }).catch(() => null),
      getDoc(doc(db, 'ukoLotteryEntries', `${cur.id}_${getUserId()}`)).catch(() => null),
    ]);
    mine = ms && ms.exists() ? (ms.data().count || 0) : 0;
    c = cs.exists() ? cs.data() : null;
    p = ps.exists() ? ps.data() : null;
    if (c && c.status === 'open' && agg) {
      const total = agg.data().total || 0;
      c = { ...c, totalTickets: total, participants: agg.data().n || 0, pool: (c.seed || 3000) + 8 * total };
    }
  } catch (e) {
    console.error('[feed] lottery load failed', e);
  }
  const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pool = c ? (c.pool || 0) : 0;
  const cur$ = `
    <div class="lottery-hero">
      <div class="lottery-title">${esc(lotteryRoundTitle(cur.id, store.lang === 'en'))}</div>
      <div class="lottery-countdown" id="feed-lottery-cd"></div>
    </div>
    <div class="lottery-first"><small>${t.firstLabel}</small><b>${Math.floor(pool * 0.60).toLocaleString()}<span>UP</span></b><em>${t.firstHint}</em></div>
    <div class="lottery-second">
      ${[0, 1].map(() => `<div class="lottery-prize"><small>${t.secondLabel}</small><b>${Math.floor(pool * 0.15).toLocaleString()}<span>UP</span></b><em>${t.secondHint}</em></div>`).join('')}
    </div>
    <div class="lottery-prize lottery-third"><small>${t.thirdLabel}</small><b>${Math.floor(pool * 0.02).toLocaleString()}<span>UP</span></b><em>${t.thirdHint}</em></div>
    <div class="lottery-stats">
      <div><small>${t.pool}</small><b>${pool.toLocaleString()}<span>UP</span></b></div>
      <div><small>${t.tickets}</small><b>${(c?.totalTickets || 0).toLocaleString()}</b></div>
      <div><small>${t.myTickets}</small><b>${mine.toLocaleString()}</b></div>
      <div><small>${t.people}</small><b>${(c?.participants || 0).toLocaleString()}</b></div>
    </div>
    ${c?.carriedFrom ? `<div class="lottery-muted">${t.carriedIn}</div>` : ''}
    <div class="lottery-row"><span class="lottery-muted">${t.hourly}</span><a class="lottery-buy-link" href="${LOTTERY_UPOINT_URL}?tab=lottery" target="_blank" rel="noopener">${t.buy}</a></div>`;
  let last$ = `<div class="lottery-last-title">${esc(t.last(prev.label))}</div>`;
  if (p && p.status === 'drawn' && (p.revealedAt || !p.winners?.length)) {
    const rows = [1, 2, 3].map((tier) => {
      const ws = (p.winners || []).filter((w) => w.tier === tier);
      const body = ws.length ? ws.map((w) => `<span class="lottery-winner"><b>${esc(w.name || t.noName)}</b> ${w.amount.toLocaleString()}UP${w.crystals ? esc(t.crystals(w.crystals)) : ''}<small>（${esc(t.ticketsOf(w.tickets))}）</small></span>`).join('') : `<span class="lottery-muted">${t.none}</span>`;
      return `<div class="lottery-tier lottery-tier-${tier}"><span class="lottery-tier-label">${esc(t.tier(tier))}</span><div class="lottery-tier-body">${body}</div></div>`;
    }).join('');
    last$ += rows + `<div class="lottery-muted">${esc(t.total((p.totalTickets || 0).toLocaleString(), p.participants || 0))}</div>`;
  } else if (p && p.status === 'carried') {
    last$ += `<div class="lottery-muted">${esc(t.carried(String(p.carriedTo || '').slice(5).replace('-', '/')))}</div>`;
  } else {
    last$ += `<div class="lottery-muted">${t.noLast}</div>`;
  }
  panel.innerHTML = (LOTTERY_PUBLIC ? '' : `<p class="lottery-test">${t.test}</p>`) + cur$ + last$;
  const cdEl = document.getElementById('feed-lottery-cd');
  if (cdEl) lotteryCountdown(cdEl, cur.closeMs, cur.resultMs, store.lang === 'en');
}

function renderFeedTabs() {
  const active = lotteryOpen ? 'lottery' : feedTab;
  document.querySelectorAll('[data-feed-tab]').forEach((b) => {
    const on = b.dataset.feedTab === active;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
}

async function switchFeedTab(tab) {
  if (tab === 'lottery') { if (isLotteryVisible()) openLotteryTab(); return; }
  if (lotteryOpen) {   // 宝くじタブから戻る
    closeLotteryTab();
    if (tab === feedTab) { renderFeedTabs(); return; }
  }
  if (tab === feedTab || !FEED_TABS[tab]) return;
  feedTabState[feedTab] = { entries: latestFeedEntries, hasMore: feedHasMore, newestMs: feedNewestMs, stale: false };
  feedTab = tab;
  renderFeedTabs();
  const st = feedTabState[tab];
  if (st) {
    latestFeedEntries = st.entries; feedHasMore = st.hasMore; feedNewestMs = st.newestMs;
    renderFeedList(latestFeedEntries);
    if (st.stale) await fetchNewerFeed();   // 見ていない間に、このタブの新着が来ていた
    return;
  }
  latestFeedEntries = []; feedHasMore = false; feedNewestMs = 0;
  const list = document.getElementById('feed-list');
  if (list) list.innerHTML = '';
  await loadFeedInitial();
  ensureMyLikes(oldestFeedMs());
}

function setFeedEntries(snap) {
  latestFeedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  feedHasMore = snap.size === FEED_PAGE;
  feedNewestMs = Math.max(0, ...latestFeedEntries.map(feedCreatedMs));
  renderFeedList(latestFeedEntries);
}

async function loadFeedInitial() {
  const tab = feedTab;
  const q = query(
    collection(db, 'omikujiFeed'),
    feedTypeFilter(),
    where('createdAt', '>=', getFeedSince()),
    orderBy('createdAt', 'desc'),
    limit(FEED_PAGE)
  );
  // 2026-10-25: 前回サーバーから読んでから30分以内なら、端末のキャッシュ(firebaseConfig.js の
  // 永続キャッシュ)から出して、新着だけをサーバーから読む(開き直すたびに50件読むのをやめる)。
  // 他の人のいいね数は最大3時間古いまま(2026-10-31 に30分から延長)。自分のいいねはキャッシュにも反映されている。
  let cachedAt = 0;
  try { cachedAt = Number(localStorage.getItem(feedCacheKey())) || 0; } catch {}
  if (Date.now() - cachedAt < FEED_CACHE_MS) {
    try {
      const snap = await getDocsFromCache(q);
      if (tab !== feedTab) return;   // 読んでいる間に別のタブに切り替わった
      if (snap.size > 0) {
        setFeedEntries(snap);
        await fetchNewerFeed();
        return;
      }
    } catch (err) {
      // キャッシュが使えない環境ではサーバーから読む
    }
  }
  try {
    const snap = await getDocs(q);
    if (tab !== feedTab) return;
    setFeedEntries(snap);
    try { localStorage.setItem(feedCacheKey(), String(Date.now())); } catch {}
  } catch (err) {
    console.error('[feed] load failed', err);
  }
}

let fetchingNewer = false;
let fetchNewerAgain = false;
// 読み込み中に次の新着が来た場合(ガチャを続けて引いた時など)は、終わってからもう一度読む。
// 以前は読み込み中の新着を無視していたため、続けて投稿された2件目以降が一覧に出なかった
async function fetchNewerFeed() {
  if (fetchingNewer) { fetchNewerAgain = true; return; }
  fetchingNewer = true;
  fetchNewerAgain = false;
  const tab = feedTab;
  try {
    const q = query(
      collection(db, 'omikujiFeed'),
      feedTypeFilter(),
      where('createdAt', '>', Timestamp.fromMillis(feedNewestMs)),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    if (tab !== feedTab) return;   // 読んでいる間に別のタブに切り替わった(新着は切り替え先で読み直す)
    // 新着が50件以上あった(キャッシュから出した後など)場合は、手元の投稿との間が抜けるので、
    // 新しい50件だけに入れ替える(続きは「もっと見る」で読める)
    if (snap.size >= 50) {
      latestFeedEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      feedHasMore = true;
      feedNewestMs = Math.max(0, ...latestFeedEntries.map(feedCreatedMs));
      try { localStorage.setItem(feedCacheKey(), String(Date.now())); } catch {}
      renderFeedList(latestFeedEntries);
      ensureMyLikes(oldestFeedMs());
      return;
    }
    const known = new Set(latestFeedEntries.map((e) => e.id));
    const fresh = snap.docs.filter((d) => !known.has(d.id)).map((d) => ({ id: d.id, ...d.data() }));
    if (fresh.length) {
      latestFeedEntries = [...fresh, ...latestFeedEntries].slice(0, FEED_LIMIT);
      feedNewestMs = Math.max(feedNewestMs, ...fresh.map(feedCreatedMs));
      renderFeedList(latestFeedEntries);
    }
  } catch (err) {
    console.error('[feed] fetch newer failed', err);
  } finally {
    fetchingNewer = false;
    if (fetchNewerAgain) fetchNewerFeed();
  }
}

const oldestFeedMs = () => Math.min(...latestFeedEntries.map(feedCreatedMs).filter((x) => x > 0), Date.now());

// 「もっと見る」: 今出ている一番古い投稿より前の50件を読む
async function loadMoreFeed() {
  if (loadingMoreFeed || !feedHasMore) return;
  loadingMoreFeed = true;
  renderFeedList(latestFeedEntries);
  const tab = feedTab;
  try {
    const q = query(
      collection(db, 'omikujiFeed'),
      feedTypeFilter(),
      where('createdAt', '>=', getFeedSince()),
      where('createdAt', '<', Timestamp.fromMillis(oldestFeedMs())),
      orderBy('createdAt', 'desc'),
      limit(Math.min(FEED_PAGE, FEED_LIMIT - latestFeedEntries.length))
    );
    const snap = await getDocs(q);
    if (tab !== feedTab) return;
    const known = new Set(latestFeedEntries.map((e) => e.id));
    const older = snap.docs.filter((d) => !known.has(d.id)).map((d) => ({ id: d.id, ...d.data() }));
    latestFeedEntries = [...latestFeedEntries, ...older];
    feedHasMore = snap.size === FEED_PAGE && latestFeedEntries.length < FEED_LIMIT;
    // 自分のいいねの購読を、新しく出た投稿の分まで広げる
    if (older.length) await ensureMyLikes(oldestFeedMs());
  } catch (err) {
    console.error('[feed] load more failed', err);
  } finally {
    loadingMoreFeed = false;
    renderFeedList(latestFeedEntries);
  }
}

function startFeedListener() {
  document.querySelectorAll('[data-feed-tab]').forEach((b) => b.addEventListener('click', () => switchFeedTab(b.dataset.feedTab)));
  const lotteryBtn = document.querySelector('[data-feed-tab="lottery"]');
  if (lotteryBtn) lotteryBtn.hidden = !isLotteryVisible();
  renderFeedTabs();
  loadFeedInitial().then(() => {
    // 自分のいいね一覧は、フィードに出ている一番古い投稿以降の分だけ読めば足りる
    // (いいねは必ず投稿より後なので漏れない)。フィードが読めてから始める
    ensureMyLikes(oldestFeedMs());
    const newestQ = query(collection(db, 'omikujiFeed'), orderBy('createdAt', 'desc'), limit(1));
    listenWhileVisible(() => onSnapshot(newestQ, (snap) => {
      if (snap.metadata.hasPendingWrites) return; // 自分の投稿の送信中(作成日時がまだ入っていない)
      const d = snap.docs[0];
      if (!d) return;
      const data = d.data();
      if (feedCreatedMs(data) > feedNewestMs) {
        // 新着が今のタブの種類なら読み、別のタブの種類なら、そのタブを開いた時に読む(読み取りを増やさない)
        if (FEED_TABS[feedTab].includes(data.type)) { fetchNewerFeed(); return; }
        Object.keys(FEED_TABS).forEach((t) => {
          if (t !== feedTab && FEED_TABS[t].includes(data.type) && feedTabState[t]) feedTabState[t].stale = true;
        });
        return;
      }
      // 一番新しい投稿のいいね数の変化は、この購読で届いた分だけ反映する(追加の読み取りなし)
      const i = latestFeedEntries.findIndex((e) => e.id === d.id);
      if (i >= 0 && latestFeedEntries[i].likeCount !== data.likeCount) {
        latestFeedEntries[i] = { id: d.id, ...data };
        renderFeedList(latestFeedEntries);
      }
    }, (err) => console.error('[feed] newest listen failed', err)));
  });
}

// 自分のいいねは、読み直さずに手元のいいね数を増減して描画する
function bumpLocalLikeCount(feedId, delta) {
  const e = latestFeedEntries.find((x) => x.id === feedId);
  if (!e) return;
  e.likeCount = Math.max(0, (e.likeCount || 0) + delta);
  renderFeedList(latestFeedEntries);
}

// 自分がいいねした投稿(ボタンの色・押せるかどうか)は、この端末の localStorage に記録する(2026-10-25)。
// 以前は開くたびに「フィードに出ている一番古い投稿以降の自分のいいね」をリアルタイム購読しており、
// おみくじの読み取りでいちばん大きかった。サーバーから読むのは、この端末で1日1回と、
// 「もっと見る」でまだ確かめていない古い時間帯の投稿が出た時だけ。
// 別の端末で押したいいねは、次にサーバーから読むまでボタンに出ないことがあるが、
// 押してもいいねの記録があれば二重にはならない(toggleLike で確認している)。
// collectionGroup('likes') の (likerUserId, likedAt) 複合インデックスを使う。
const MY_LIKES_KEEP_MS = 3 * 24 * 3600000; // フィードは48時間分なので、それより古い記録は捨てる
const MY_LIKES_SYNC_MS = 24 * 3600000;
const myLikesKey = () => `omikujiMyLikes_${getUserId()}`;
let myLikesStore = null; // { likes: { feedId: いいねした時刻 }, syncedAt, syncedFromMs }

function loadMyLikesStore() {
  const key = myLikesKey(); // アカウント連携でIDが変わった時に別の人の記録を使わないよう、キーごとに持つ
  if (myLikesStore && myLikesStore.key === key) return myLikesStore;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  myLikesStore = (v && v.likes && typeof v.likes === 'object') ? v : { likes: {}, syncedAt: 0, syncedFromMs: null };
  myLikesStore.key = key;
  return myLikesStore;
}

function saveMyLikesStore() {
  const st = loadMyLikesStore();
  const cutoff = Date.now() - MY_LIKES_KEEP_MS;
  for (const [id, at] of Object.entries(st.likes)) if (at < cutoff) delete st.likes[id];
  try { localStorage.setItem(myLikesKey(), JSON.stringify(st)); } catch {}
}

function applyMyLikes() {
  myLikedIds.clear();
  Object.keys(loadMyLikesStore().likes).forEach((id) => myLikedIds.add(id));
}

function rememberMyLike(feedId, on) {
  const st = loadMyLikesStore();
  if (on) st.likes[feedId] = st.likes[feedId] || Date.now();
  else delete st.likes[feedId];
  saveMyLikesStore();
}

async function fetchMyLikes(fromMs, toMs) {
  const conds = [where('likerUserId', '==', getUserId()), where('likedAt', '>=', Timestamp.fromMillis(fromMs))];
  if (toMs) conds.push(where('likedAt', '<', Timestamp.fromMillis(toMs)));
  const snap = await getDocs(query(collectionGroup(db, 'likes'), ...conds));
  const st = loadMyLikesStore();
  snap.docs.forEach((d) => {
    const feedId = d.ref.parent.parent?.id;
    if (feedId) st.likes[feedId] = d.data().likedAt?.toMillis?.() || Date.now();
  });
}

// フィードに出ている一番古い投稿の時刻を受け取り、その時刻以降の自分のいいねがそろっている状態にする
async function ensureMyLikes(oldestPostMs) {
  const st = loadMyLikesStore();
  const fromMs = Math.floor((oldestPostMs || Date.now()) / 3600000) * 3600000;
  const now = Date.now();
  try {
    if (!st.syncedAt || now - st.syncedAt > MY_LIKES_SYNC_MS || st.syncedFromMs == null) {
      await fetchMyLikes(fromMs, null);
      st.syncedAt = now;
      st.syncedFromMs = fromMs;
    } else if (fromMs < st.syncedFromMs) {
      await fetchMyLikes(fromMs, st.syncedFromMs);
      st.syncedFromMs = fromMs;
    }
  } catch (err) {
    console.error('[feed] my-likes fetch failed', err);
  }
  saveMyLikesStore();
  applyMyLikes();
  renderFeedList(latestFeedEntries);
}

// 同じ端末の別タブで押したいいねも反映する
window.addEventListener('storage', (e) => {
  if (e.key !== myLikesKey()) return;
  myLikesStore = null;
  applyMyLikes();
  renderFeedList(latestFeedEntries);
});

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
  const fromName = notif.fromName || s().noName;
  if (textEl) textEl.textContent = (notif.count || 1) > 1 ? s().likeToastMany(fromName, notif.count) : s().likeToast(fromName);

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

// 自分宛のいいね通知を購読(24時間以内)。2026-10-25 から通知は「1人×1時間」で1件にまとめ、
// count にいいねの件数が入る。どこまで表示したかはサーバーに書かず、この端末の localStorage に
// 通知ごとの表示済み件数として覚える(以前は通知1件ごとに shown:true を書き込んでいた)。
// 1回の更新で届いた分は、最後にいいねした人の名前で1つのトーストにまとめる。
// 24時間たった通知はサーバー(24_AccountCenter/functions/likeNotifCleanup.js)が消す。
const LIKE_SEEN_KEY = 'omikujiLikeNotifSeen';
let likeSeenMem = null;
function loadLikeSeen() {
  if (likeSeenMem) return likeSeenMem;
  try { likeSeenMem = JSON.parse(localStorage.getItem(LIKE_SEEN_KEY) || '{}') || {}; } catch { likeSeenMem = {}; }
  return likeSeenMem;
}
function saveLikeSeen(seen, liveIds) {
  // もう購読範囲にない(消えた)通知の記録は捨てる
  for (const id of Object.keys(seen)) if (!liveIds.has(id)) delete seen[id];
  try { localStorage.setItem(LIKE_SEEN_KEY, JSON.stringify(seen)); } catch {}
}

function startNotifListener() {
  const myUserId = getUserId();
  const since = Timestamp.fromMillis(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 3600000) * 3600000);
  const q = query(
    collection(db, 'omikujiLikeNotifications'),
    where('toUserId', '==', myUserId),
    where('createdAt', '>=', since)
  );
  listenWhileVisible(() => onSnapshot(q, (snap) => {
    const seen = loadLikeSeen();
    let total = 0, latest = null, latestMs = -1;
    snap.docs.forEach((d) => {
      const n = d.data();
      if (n.shown === true) return; // 古い形式で表示済みのもの
      const count = n.count || 1;
      const fresh = count - (seen[d.id] || 0);
      if (fresh <= 0) return;
      seen[d.id] = count;
      total += fresh;
      const ms = n.updatedAt?.toMillis?.() ?? n.createdAt?.toMillis?.() ?? 0;
      if (ms >= latestMs) { latestMs = ms; latest = n; }
    });
    saveLikeSeen(seen, new Set(snap.docs.map((d) => d.id)));
    if (total > 0 && latest) showLikeToast({ ...latest, count: total });
  }, (err) => console.error('[feed] notif listen failed', err)));
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
  listenWhileVisible(() => onSnapshot(doc(db, 'omikujiUsers', getUserId()), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    latestLikesGiven     = d.totalLikesGiven || 0;
    latestLikesReceived  = d.totalLikesReceived || 0;
    latestGachaTickets   = d.sitePerks?.omikuji?.gachaTickets || 0;
    // UP交換所でスタレ裏面ガチャを解放したら、開いたままの画面でも図鑑を切り替える
    const srUnlocked = !!d.sitePerks?.omikuji?.starRailGachaUnlocked;
    if (srUnlocked !== !!store.sitePerks?.omikuji?.starRailGachaUnlocked && d.sitePerks) {
      store.sitePerks = d.sitePerks;
      window.dispatchEvent(new CustomEvent('starRailUnlockChanged'));
    }
    // UP交換所で新着裏面の帯を交換したら、開いたままの画面でも帯を出す(newBacks.js)
    const nbUnlocked = !!d.sitePerks?.omikuji?.newBacksTickerUnlocked;
    if (nbUnlocked !== !!store.sitePerks?.omikuji?.newBacksTickerUnlocked && d.sitePerks) {
      store.sitePerks = d.sitePerks;
      window.dispatchEvent(new CustomEvent('newBacksTickerUnlockChanged'));
    }
    // 願いの結晶の個数・結晶で手に入れた(出品できない)枚数を wishCrystal.js へ渡す
    window.dispatchEvent(new CustomEvent('omikujiUserDocChanged', { detail: d }));
    latestClaimedMailIds = new Set(d.claimedMailIds || []);
    if (upEl)    upEl.textContent    = d.ukoPoints || 0;
    if (gachaEl) gachaEl.textContent = latestGachaTickets;
    updateMailBadge();
  }, (err) => console.error('[feed] stats footer listen failed', err)));
}

// ===== メール未読バッジ（リアルタイム） =====
// 期限が切れていないメールだけを読む(2026-10-25)。以前は期限切れも含めて新しい順に50通を読んでいた
// (98通のうち受け取れるのは1通だけで、開くたびに約50件の読み取り)。無期限のメールは2099年末の期限で保存している。
// 1時間単位に切り捨てるのはキャッシュを効かせるため(少し前に切れたメールは mailIsVisible で除く)
function liveMailQuery() {
  const since = Timestamp.fromMillis(Math.floor(Date.now() / 3600000) * 3600000);
  return query(collection(db, 'omikujiMailBroadcasts'), where('expiresAt', '>', since), orderBy('expiresAt', 'asc'), limit(50));
}
const byCreatedDesc = (a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0);

function startMailBadgeListener() {
  listenWhileVisible(() => onSnapshot(liveMailQuery(), (snap) => {
    latestMailDocs = [...snap.docs].sort(byCreatedDesc);
    updateMailBadge();
  }, (err) => console.error('[feed] mail badge listen failed', err)));
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

// フィード上の裏面サムネイルなど、ガチャ演出モーダルの外からも呼べる拡大表示
function openGachaLightbox(url) {
  const els = getGachaEls();
  if (!els.lightbox || !els.lightboxImg || !url) return;
  els.lightboxImg.src = url;
  els.lightbox.classList.add('visible');
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
  let design = null;
  let isNew = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('NO_USER_DOC');
    const data = snap.data();
    const tickets = data.sitePerks?.omikuji?.gachaTickets || 0;
    if (tickets < 1) throw new Error('NO_TICKETS');
    // スタレ裏面ガチャ解放済み(UP交換所、2026-10-09追加)ならスタレ裏面も排出対象に入る。
    // 解放はサーバー上の最新の値で判定したいので、抽選はトランザクションの中で行う。
    design = pickGachaDesign(!!data.sitePerks?.omikuji?.starRailGachaUnlocked);

    // cardBacksは { デザインID: 所持数 } 形式。旧データ(所持デザインIDの配列)が
    // 残っている場合はここで新形式に丸ごと変換してから書き込む(ドットパスでの
    // 部分更新だと、既存フィールドが配列型の場合にFirestore側でエラーになるため)。
    const rawCardBacks = data.cardBacks;
    const cardBacksMap = Array.isArray(rawCardBacks)
      ? Object.fromEntries(rawCardBacks.map((id) => [id, 1]))
      : { ...(rawCardBacks || {}) };
    const currentCount = cardBacksMap[design.id] || 0;
    isNew = currentCount === 0;
    cardBacksMap[design.id] = currentCount + 1;

    tx.update(ref, {
      'sitePerks.omikuji.gachaTickets': increment(-1),
      cardBacks: cardBacksMap,
    });
  });

  store.cardBacks[design.id] = (store.cardBacks[design.id] || 0) + 1;
  window.dispatchEvent(new CustomEvent('gachaCardBacksUpdated', { detail: { designId: design.id, isNew } }));
  return { design, isNew };
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
  if (!(await ensureLatestVersion())) return;

  const els = getGachaEls();
  const ticketsBeforeDraw = latestGachaTickets; // onSnapshotの反映タイミングに左右されないよう、抽選前の枚数を確保しておく
  gachaBusy = true;
  els.drawBtn.disabled = true;
  els.resultLbl.textContent = '';

  try {
    const { design, isNew } = await drawGachaTransaction();

    const preload = new Image();
    preload.src = design.url;

    await playGachaReveal(design);

    // 次に引ける枚数を券の表示に反映しておく(確保しておいた抽選前の枚数から計算する)
    const remaining = Math.max(0, ticketsBeforeDraw - 1);
    els.before.textContent = remaining;
    els.after.textContent = Math.max(0, remaining - 1);

    if (isNew) {
      submitGachaFeedEntry({
        name: store.name,
        cardBackId: design.id,
        cardBackName: design.name,
        cardBackUrl: design.url,
      });
    }

    markMissionAchievedOnce('omikujiGachaDraw');
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
      getDocs(liveMailQuery()),
      getDoc(doc(db, 'omikujiUsers', myUserId)),
    ]);

    const visibleDocs = [...mailSnap.docs].sort(byCreatedDesc).filter((docSnap) => mailIsVisible(docSnap, myUserId));

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
      col.appendChild(title);

      // 受け取るボタンを常に本文の直下(一番下)に置きたいので、日時は本文より先
      // (タイトルのすぐ下)に出しておく。
      const time = document.createElement('div');
      time.className = 'notif-row-time';
      time.textContent = relTime(d.createdAt);
      col.appendChild(time);

      // 説明文が長いと受け取るボタンまでの距離が伸びて見にくいため、最初は1行分だけ
      // プレビュー表示し、「本文を表示する」を押した時だけ全文(改行込み)に差し替える。
      // 短い(改行なし・MAIL_PREVIEW_LENGTH文字以内)メールはそもそも省略の意味が無いので、
      // 最初から全文を出しボタン自体を出さない。
      const fullMessage = d.message || '';
      if (fullMessage) {
        const MAIL_PREVIEW_LENGTH = 50;
        const firstLine = fullMessage.split('\n')[0];
        const needsExpand = fullMessage.length > MAIL_PREVIEW_LENGTH || fullMessage.includes('\n');
        const previewText = firstLine.length > MAIL_PREVIEW_LENGTH
          ? `${firstLine.slice(0, MAIL_PREVIEW_LENGTH)}…`
          : `${firstLine}…`;

        const msg = document.createElement('div');
        // 管理者画面で改行して書いた説明文がそのまま伝わるように、改行を保持して表示する
        // (textContent自体は改行を含んだまま渡っているので、CSS側でwhite-space:pre-wrapに
        // するだけでよい。innerHTML+<br>変換は使わない)。
        msg.className = 'notif-row-text notif-row-text-message';
        msg.textContent = needsExpand ? previewText : fullMessage;
        col.appendChild(msg);

        if (needsExpand) {
          const expandBtn = document.createElement('button');
          expandBtn.type = 'button';
          expandBtn.className = 'mail-expand-btn';
          expandBtn.textContent = s().mailExpandBtn;
          expandBtn.addEventListener('click', () => {
            msg.textContent = fullMessage;
            expandBtn.remove();
          });
          col.appendChild(expandBtn);
        }
      }

      // 受け取るボタンは(横並びではなく)本文の下に来るよう、colの中に入れて
      // 縦積みにする(colはflexコンテナではないので、通常のブロック要素として下に並ぶ)。
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mail-claim-btn';
      btn.textContent = claimed ? s().mailClaimedBtn : s().mailClaimBtn;
      btn.disabled = claimed;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        if (!(await ensureLatestVersion())) return;
        try {
          await claimMail(docSnap.id, d.rewards);
          btn.textContent = s().mailClaimedBtn;
        } catch (e) {
          console.error('[feed] mail claim failed', e);
          btn.disabled = false;
          alert(s().mailClaimFailed);
        }
      });
      col.appendChild(btn);
      row.appendChild(col);

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
  startNotifListener();
  startStatsFooterListener();
  startMailBadgeListener();



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

  // ガチャ券はUP(うーこポイント)で08_UPointから交換する(このサイト側では発行しない)ため、
  // 交換所への導線をここに置く。別タブで開き、おみくじ側の状態は保持したままにする。
  const gachaExchangeLink = document.getElementById('gacha-exchange-link');
  if (gachaExchangeLink) {
    gachaExchangeLink.addEventListener('click', () => {
      window.open('https://uko05.github.io/08_UPoint/', '_blank', 'noopener');
    });
  }

  const gachaResultImg = document.getElementById('gacha-result-img');
  const gachaLightbox = document.getElementById('gacha-lightbox');
  if (gachaResultImg && gachaLightbox) {
    gachaResultImg.addEventListener('click', () => openGachaLightbox(gachaResultImg.src));
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
