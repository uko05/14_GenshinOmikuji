// omikujiStats.js
import { db } from './firebaseConfig.js';
import { getUserId } from './userData.js';
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export async function submitOmikujiStats(data) {
  try {
    const userId = getUserId();
    await setDoc(doc(db, 'omikujiUsers', userId), {
      latestFortune: { ...data, timestamp: serverTimestamp() },
    }, { merge: true });
  } catch (e) {
    console.error('おみくじ集計失敗', e);
  }
}
