// omikujiStats.js
import { db } from './firebaseConfig.js';
import { getUserId } from './userData.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const COOLDOWN_MS     = 60 * 60 * 1000; // 1時間
const LAST_SUBMIT_KEY = 'genshinOmikuji_lastSubmit';

export async function submitOmikujiStats(data) {
  const last = localStorage.getItem(LAST_SUBMIT_KEY);
  if (data.playerName !== 'uko@debug' && last && Date.now() - Number(last) < COOLDOWN_MS) return;

  try {
    const userId = getUserId();
    await addDoc(collection(db, 'omikujiUsers', userId, 'stats'), {
      ...data,
      timestamp: serverTimestamp(),
    });
    localStorage.setItem(LAST_SUBMIT_KEY, Date.now());
  } catch (e) {
    console.error('おみくじ集計失敗', e);
  }
}
