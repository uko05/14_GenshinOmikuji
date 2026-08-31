// userData.js
// ユーザーデータ管理モジュール
//
// 設計方針：
//   - localStorage に残すのは userId と lastVisit のみ
//   - それ以外のデータは Firestore を正源泉とし、インメモリストアで保持
//   - ページ起動時に Firestore → store へロード
//   - データ変更時は store を更新し、デバウンスで Firestore へ同期
//   - Firestore 書き込み成功が確認できるまで旧 localStorage データは消さない

import { db } from './firebaseConfig.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ===== localStorage に残すキー（2つだけ） =====
const LS_USER_ID    = 'genshinOmikuji_userId';
const LS_LAST_VISIT = 'genshinOmikuji_lastVisit';

// ===== 旧 localStorage キー（マイグレーション用・フォールバック用） =====
const OLD_LS = {
  name:         'genshinOmikuji_name',
  birthday:     'genshinOmikuji_birthday',
  lang:         'genshinOmikuji_lang',
  result:       'genshinOmikuji_result',
  streak:       'genshinOmikuji_streak',
  collection:   'genshinOmikuji_collection',
  achievements: 'genshinOmikuji_achievements',
  achStats:     'genshinOmikuji_achStats',
};

// ===== userId 管理（localStorage に保持） =====
export function getUserId() {
  let id = localStorage.getItem(LS_USER_ID);
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = 'u_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(LS_USER_ID, id);
  }
  return id;
}

// ===== lastVisit 管理（localStorage に保持） =====
export function getLastVisit()  { return localStorage.getItem(LS_LAST_VISIT) || ''; }
export function setLastVisit(v) { localStorage.setItem(LS_LAST_VISIT, v); }

// ===== インメモリストア =====
export const store = {
  name:         '',
  birthday:     '',
  gender:       '',
  lang:         'ja',
  streak:       null,
  result:       null,
  collection:   new Set(),
  achievements: new Set(),
  achStats:     null,
  hideFromFeed: false,
  // sitePerks/equippedBadge は08_UPoint/24_AccountCenterが直接書き込む値の
  // 読み取り専用キャッシュ。syncUserDataToFirestoreの書き戻し対象には含めない
  // (含めると、他タブでの更新をこちらの古いローカル値で上書きしてしまうため)。
  sitePerks:    null,
  equippedBadge: null,
};

// ===== Firestore からロード =====
export async function loadUserDataFromFirestore() {
  try {
    const userId = getUserId();
    const snap   = await getDoc(doc(db, 'omikujiUsers', userId));

    if (snap.exists()) {
      // Firestore のデータでストアを初期化
      const d = snap.data();
      if (d.name         != null) store.name     = d.name;
      if (d.birthday     != null) store.birthday = d.birthday;
      if (d.gender       != null) store.gender   = d.gender;
      if (d.lang         != null) store.lang     = d.lang;
      if (d.streak       != null) store.streak   = d.streak;
      if (d.result       != null) store.result   = d.result;
      if (d.collection   != null) store.collection   = new Set(d.collection);
      if (d.achievements != null) store.achievements = new Set(d.achievements);
      if (d.achStats     != null) store.achStats = d.achStats;
      if (d.hideFromFeed != null) store.hideFromFeed = d.hideFromFeed;
      if (d.sitePerks    != null) store.sitePerks    = d.sitePerks;
      if (d.equippedBadge != null) store.equippedBadge = d.equippedBadge;
      console.log('[userData] Loaded from Firestore:', userId);
      return true;
    }

    // Firestore にドキュメントなし → 旧 localStorage からマイグレーション
    console.log('[userData] No Firestore doc, migrating from localStorage...');
    _migrateFromLocalStorage();

    // Firestore への書き込みを試みる
    const synced = await syncUserDataToFirestore();

    // 書き込み成功が確認できた場合のみ旧 localStorage を削除
    if (synced) {
      _clearOldLocalStorage();
      console.log('[userData] Migration complete, old localStorage cleared.');
    } else {
      console.warn('[userData] Firestore write failed. Keeping old localStorage as fallback.');
    }
    return false;

  } catch (e) {
    // 読み込みエラー → 旧 localStorage をフォールバックとして使用
    console.warn('[userData] Firestore load error, falling back to localStorage:', e);
    _migrateFromLocalStorage();
    return false;
  }
}

// 旧 localStorage → store へのマイグレーション
function _migrateFromLocalStorage() {
  const parse = (key) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
  };
  store.name     = localStorage.getItem(OLD_LS.name)     || '';
  store.birthday = localStorage.getItem(OLD_LS.birthday) || '';
  store.lang     = localStorage.getItem(OLD_LS.lang)     || 'ja';
  store.streak   = parse(OLD_LS.streak);
  store.result   = parse(OLD_LS.result);
  const col  = parse(OLD_LS.collection);
  const achs = parse(OLD_LS.achievements);
  if (Array.isArray(col))  store.collection   = new Set(col);
  if (Array.isArray(achs)) store.achievements = new Set(achs);
  store.achStats = parse(OLD_LS.achStats);
}

// 旧 localStorage データを削除（Firestore 書き込み成功確認後のみ呼ぶ）
function _clearOldLocalStorage() {
  Object.values(OLD_LS).forEach(key => localStorage.removeItem(key));
}

// ===== Firestore へ同期 =====
// 戻り値: true = 成功、false = 失敗
export async function syncUserDataToFirestore() {
  try {
    const userId  = getUserId();
    const payload = {
      name:         store.name,
      birthday:     store.birthday,
      gender:       store.gender,
      lang:         store.lang,
      streak:       store.streak,
      result:       store.result,
      collection:   [...store.collection],
      achievements: [...store.achievements],
      achStats:     store.achStats,
      hideFromFeed: store.hideFromFeed,
      updatedAt:    serverTimestamp(),
    };
    await setDoc(doc(db, 'omikujiUsers', userId), payload, { merge: true });
    return true;
  } catch (e) {
    console.error('[userData] Firestore sync failed:', e);
    return false;
  }
}

// ===== デバウンス付きスケジュール同期 =====
let _syncTimer = null;
export function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    syncUserDataToFirestore();
  }, 1500);
}
