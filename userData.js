// userData.js
// ユーザーデータの Firestore 永続化モジュール
// localStorage を作業キャッシュとして使い続けつつ、
// Firestore をデータの正源泉として扱う。
// 端末変更時は userId さえ伝えれば全データを復元可能。

import { db } from './firebaseConfig.js';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ===== localStorage キー =====
const LS_USER_ID      = 'genshinOmikuji_userId';
const LS_NAME         = 'genshinOmikuji_name';
const LS_BIRTHDAY     = 'genshinOmikuji_birthday';
const LS_RESULT       = 'genshinOmikuji_result';
const LS_LANG         = 'genshinOmikuji_lang';
const LS_COLLECTION   = 'genshinOmikuji_collection';
const LS_STREAK       = 'genshinOmikuji_streak';
const LS_LAST_VISIT   = 'genshinOmikuji_lastVisit';
const LS_ACH_STATS    = 'genshinOmikuji_achStats';
const LS_ACHIEVEMENTS = 'genshinOmikuji_achievements';

// ===== ユーザーID =====
// 初回アクセス時に暗号的ランダム ID を生成してローカルに保存する
function generateUserId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'u_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function getUserId() {
  let id = localStorage.getItem(LS_USER_ID);
  if (!id) {
    id = generateUserId();
    localStorage.setItem(LS_USER_ID, id);
  }
  return id;
}

// ===== Firestore からロード =====
// Firestore のデータで localStorage を上書きする（端末変更対応）
// 戻り値: true = Firestore ドキュメント存在、false = 新規ユーザー or エラー
export async function loadUserDataFromFirestore() {
  try {
    const userId = getUserId();
    const snap   = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return false;

    const d = snap.data();
    const set = (key, val) => { if (val !== undefined && val !== null) localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); };

    set(LS_NAME,         d.name);
    set(LS_BIRTHDAY,     d.birthday);
    set(LS_LANG,         d.lang);
    set(LS_LAST_VISIT,   d.lastVisit);
    set(LS_STREAK,       d.streak);
    set(LS_RESULT,       d.result);
    set(LS_COLLECTION,   d.collection);
    set(LS_ACHIEVEMENTS, d.achievements);
    set(LS_ACH_STATS,    d.achStats);
    return true;
  } catch (e) {
    console.warn('[userData] Firestore load failed, using localStorage:', e);
    return false;
  }
}

// ===== Firestore へ同期 =====
// localStorage の現在値をすべて Firestore ドキュメントに書き込む
export async function syncUserDataToFirestore() {
  try {
    const userId = getUserId();
    const get    = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return localStorage.getItem(key) ?? fallback; } };

    const payload = {
      name:         localStorage.getItem(LS_NAME)       || '',
      birthday:     localStorage.getItem(LS_BIRTHDAY)   || '',
      lang:         localStorage.getItem(LS_LANG)       || 'ja',
      lastVisit:    localStorage.getItem(LS_LAST_VISIT) || '',
      streak:       get(LS_STREAK,       null),
      result:       get(LS_RESULT,       null),
      collection:   get(LS_COLLECTION,   []),
      achievements: get(LS_ACHIEVEMENTS, []),
      achStats:     get(LS_ACH_STATS,    null),
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
