// sell.js
// 裏面デザインのまとめて売却(2026-10-14追加)。オークションとは別に、ダブりを1枚10UPで売れる。
// オークションの出品の8割以上が「売れずに戻るダブりの処分」だったため、こちらに移ってもらうと
// オークション一覧・フィードの読み書きが減る。
// - 売れるのはダブりだけ(1枚は必ず手元に残す)。スタレ裏面は対象外(gachaBacks.js の GACHA_DESIGNS だけ)
// - 1回の売却は1トランザクション(何枚売っても書き込みは少ない)。フィードには投稿しない
// - 売値は固定。ガチャ券(50UP)・オークション開始価格(25UP)より十分低くして、ガチャを回して売るだけで
//   UPが増える抜け道にならないようにしている
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=4';
import { isAccountLoggedIn } from './feed.js?v=64';
import { ensureLatestVersion } from './versionGuard.js?v=2';
import { GACHA_DESIGNS } from './gachaBacks.js?v=23';
import {
  collection, doc, runTransaction, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const SELL_PRICE = 10;

const STR = {
  ja: {
    openBtn: 'まとめて売却',
    title: 'ダブりをまとめて売却',
    desc: (p) => `ダブっている裏面を1枚${p}UPで売れます。1枚は必ず手元に残ります。`,
    selectAll: 'ダブりを全部選ぶ',
    clear: '選択解除',
    none: '売れるダブりはありません。',
    total: (n, up) => `${n}枚 × ${SELL_PRICE}UP ＝ ${up}UP`,
    sellBtn: '売却する',
    confirm: (n, up) => `${n}枚を売却して ${up}UP を受け取りますか？（取り消せません）`,
    done: (n, up) => `${n}枚を売却して ${up}UP を受け取りました。`,
    failed: '売却に失敗しました。時間をおいて再度お試しください。',
    changed: '枚数が変わっていたため売却できませんでした。もう一度選び直してください。',
    loginRequired: '売却にはアカウント登録（無料）が必要です。登録・ログインしてからお試しください。',
    owned: (n) => `所持 ${n}枚`,
  },
  en: {
    openBtn: 'Bulk Sell',
    title: 'Sell duplicates',
    desc: (p) => `Sell duplicate card backs for ${p} UP each. You always keep one.`,
    selectAll: 'Select all duplicates',
    clear: 'Clear',
    none: 'You have no duplicates to sell.',
    total: (n, up) => `${n} × ${SELL_PRICE} UP = ${up} UP`,
    sellBtn: 'Sell',
    confirm: (n, up) => `Sell ${n} card backs for ${up} UP? (This cannot be undone)`,
    done: (n, up) => `Sold ${n} card backs for ${up} UP.`,
    failed: 'Failed to sell. Please try again later.',
    changed: 'Your counts changed, so nothing was sold. Please select again.',
    loginRequired: 'Selling requires a free account. Please register and log in first.',
    owned: (n) => `Own ${n}`,
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

let selected = new Map(); // デザインID -> 売る枚数

function duplicates() {
  const owned = store.cardBacks || {};
  return GACHA_DESIGNS.filter((d) => (owned[d.id] || 0) >= 2).map((d) => ({ design: d, owned: owned[d.id] }));
}

function updateTotal() {
  const n = [...selected.values()].reduce((a, b) => a + b, 0);
  document.getElementById('sell-total').textContent = s().total(n, n * SELL_PRICE);
  document.getElementById('sell-ok').disabled = n === 0;
}

function renderList() {
  const list = document.getElementById('sell-list');
  list.innerHTML = '';
  const items = duplicates();
  if (!items.length) {
    list.innerHTML = `<p class="sell-none">${s().none}</p>`;
    updateTotal();
    return;
  }
  items.forEach(({ design, owned }) => {
    const max = owned - 1;
    const row = document.createElement('div');
    row.className = 'sell-row';
    row.innerHTML = `<img src="${design.url}" alt="" loading="lazy">
      <div class="sell-info"><div class="sell-name"></div><div class="sell-owned">${s().owned(owned)}</div></div>
      <div class="sell-stepper"><button type="button" data-d="-1">−</button><span class="sell-n">0</span><button type="button" data-d="1">＋</button></div>`;
    row.querySelector('.sell-name').textContent = design.name;
    const nEl = row.querySelector('.sell-n');
    const set = (v) => {
      const n = Math.max(0, Math.min(max, v));
      if (n) selected.set(design.id, n); else selected.delete(design.id);
      nEl.textContent = n;
      row.classList.toggle('picked', n > 0);
      updateTotal();
    };
    row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => set((selected.get(design.id) || 0) + Number(b.dataset.d))));
    row._set = set;
    row._max = max;
    set(selected.get(design.id) || 0);
    list.appendChild(row);
  });
  updateTotal();
}

async function openSellModal() {
  if (!(await ensureLatestVersion())) return;
  if (!(await isAccountLoggedIn())) { alert(s().loginRequired); return; }
  selected = new Map();
  document.getElementById('sell-title').textContent = s().title;
  document.getElementById('sell-desc').textContent = s().desc(SELL_PRICE);
  document.getElementById('sell-all').textContent = s().selectAll;
  document.getElementById('sell-clear').textContent = s().clear;
  document.getElementById('sell-ok').textContent = s().sellBtn;
  renderList();
  document.getElementById('sell-modal').style.display = 'flex';
}

function closeSellModal() {
  document.getElementById('sell-modal').style.display = 'none';
}

async function doSell() {
  const items = [...selected.entries()].filter(([, n]) => n > 0);
  const total = items.reduce((a, [, n]) => a + n, 0);
  if (!total) return;
  const up = total * SELL_PRICE;
  if (!confirm(s().confirm(total, up))) return;
  const okBtn = document.getElementById('sell-ok');
  okBtn.disabled = true;
  const userId = getUserId();
  const userRef = doc(db, 'omikujiUsers', userId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('NO_USER_DOC');
      const cardBacks = snap.data().cardBacks || {};
      const updates = { ukoPoints: increment(up) };
      for (const [id, n] of items) {
        // サーバー上の最新の枚数で、1枚は必ず残ることを確かめる(別の画面で出品・売却していた時のため)
        if (!GACHA_DESIGNS.some((d) => d.id === id) || (cardBacks[id] || 0) - n < 1) throw new Error('CHANGED');
        updates[`cardBacks.${id}`] = increment(-n);
      }
      tx.update(userRef, updates);
      tx.set(doc(collection(db, 'ukoPointsLog')), {
        userId, amount: up, type: 'cardSell',
        meta: { count: total, items: Object.fromEntries(items) },
        createdAt: serverTimestamp(),
      });
    });
    items.forEach(([id, n]) => { store.cardBacks[id] = (store.cardBacks[id] || 0) - n; });
    window.dispatchEvent(new CustomEvent('gachaCardBacksUpdated', { detail: {} }));
    closeSellModal();
    alert(s().done(total, up));
  } catch (e) {
    console.error('[sell] failed', e);
    alert(e.message === 'CHANGED' ? s().changed : s().failed);
    renderList();
  } finally {
    okBtn.disabled = false;
  }
}

export function initSell() {
  const btn = document.getElementById('sell-open-btn');
  if (!btn) return;
  btn.textContent = s().openBtn;
  btn.addEventListener('click', openSellModal);
  document.getElementById('sell-close').addEventListener('click', closeSellModal);
  document.querySelector('#sell-modal .col-modal-backdrop').addEventListener('click', closeSellModal);
  document.getElementById('sell-ok').addEventListener('click', doSell);
  document.getElementById('sell-all').addEventListener('click', () => {
    document.querySelectorAll('#sell-list .sell-row').forEach((r) => r._set(r._max));
  });
  document.getElementById('sell-clear').addEventListener('click', () => {
    document.querySelectorAll('#sell-list .sell-row').forEach((r) => r._set(0));
  });
}
