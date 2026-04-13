// userData.js
// ユーザーデータ管理モジュール
//
// 設計方針：
//   - localStorage に残すのは userId と lastVisit のみ
//   - それ以外のデータは Firestore を正源泉とし、インメモリストアで保持
//   - ページ起動時に Firestore → store へロード
//   - データ変更時は store を更新し、デバウンスで Firestore へ同期
//   - 旧 localStorage データがある場合は初回のみマイグレーション

import { db } from './firebaseConfig.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ===== localStorage に残すキー（2つだけ） =====
const LS_USER_ID    = 'genshinOmikuji_userId';
const LS_LAST_VISIT = 'genshinOmikuji_lastVisit';

// ===== 旧 localStorage キー（マイグレーション用） =====
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
// Firestore から読み込んだデータをここに保持し、コード全体から参照する
export const store = {
  name:         '',
  birthday:     '',
  lang:         'ja',
  streak:       null,   // { count: number, lastDate: string }
  result:       null,   // { date, birthday, cardIndex, isReversed }
  collection:   new Set(),   // Set<string>  例: "fool_upright"
  achievements: new Set(),   // Set<string>  例: "streak_1"
  achStats:     null,        // アチーブメント統計オブジェクト
};

// ===== Firestore からロード =====
// 戻り値: true = Firestore ドキュメント存在・ロード成功
//        false = 新規ユーザー or エラー（旧 localStorage からのマイグレーション済み）
export async function loadUserDataFromFirestore() {
  try {
    const userId = getUserId();
    const snap   = await getDoc(doc(db, 'users', userId));

    if (snap.exists()) {
      // Firestore のデータでストアを初期化
      const d = snap.data();
      if (d.name         != null) store.name     = d.name;
      if (d.birthday     != null) store.birthday = d.birthday;
      if (d.lang         != null) store.lang     = d.lang;
      if (d.streak       != null) store.streak   = d.streak;
      if (d.result       != null) store.result   = d.result;
      if (d.collection   != null) store.collection   = new Set(d.collection);
      if (d.achievements != null) store.achievements = new Set(d.achievements);
      if (d.achStats     != null) store.achStats = d.achStats;
      return true;
    }

    // Firestore にドキュメントなし → 旧 localStorage データをマイグレーション
    _migrateFromLocalStorage();
    // すぐに Firestore に書き込んで以降はFirestore を使う
    await syncUserDataToFirestore();
    // 旧 localStorage データを削除（userId・lastVisit は残す）
    _clearOldLocalStorage();
    return false;

  } catch (e) {
    console.warn('[userData] Firestore load failed, using legacy localStorage:', e);
    _migrateFromLocalStorage();
    return false;
  }
}

// 旧 localStorage → store へのマイグレーション
function _migrateFromLocalStorage() {
  const g = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return localStorage.getItem(key); }
  };
  store.name     = localStorage.getItem(OLD_LS.name)     || '';
  store.birthday = localStorage.getItem(OLD_LS.birthday) || '';
  store.lang     = localStorage.getItem(OLD_LS.lang)     || 'ja';
  store.streak   = g(OLD_LS.streak);
  store.result   = g(OLD_LS.result);
  const col  = g(OLD_LS.collection);
  const achs = g(OLD_LS.achievements);
  if (Array.isArray(col))  store.collection   = new Set(col);
  if (Array.isArray(achs)) store.achievements = new Set(achs);
  store.achStats = g(OLD_LS.achStats);
}

// 旧 localStorage データを削除（移行完了後）
function _clearOldLocalStorage() {
  Object.values(OLD_LS).forEach(key => localStorage.removeItem(key));
}

// ===== Firestore へ同期 =====
export async function syncUserDataToFirestore() {
  try {
    const userId  = getUserId();
    const payload = {
      name:         store.name,
      birthday:     store.birthday,
      lang:         store.lang,
      streak:       store.streak,
      result:       store.result,
      collection:   [...store.collection],
      achievements: [...store.achievements],
      achStats:     store.achStats,
      updatedAt:    serverTimestamp(),
    };
    await setDoc(doc(db, 'users', userId), payload, { merge: true });
  } catch (e) {
    console.warn('[userData] Firestore sync failed:', e);
  }
}

// ===== デバウンス付きスケジュール同期 =====
// 複数の書き込みが短時間に続いても 1 回の Firestore 書き込みにまとめる
let _syncTimer = null;
export function scheduleSync() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    syncUserDataToFirestore();
  }, 1500);
}
