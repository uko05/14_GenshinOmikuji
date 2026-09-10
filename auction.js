// auction.js
// 裏面デザインの出品（閲覧・入札・即決購入・精算は26_UkoAuctionへ分離した）
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=3';
import { submitListingFeedEntry, isAccountLoggedIn } from './feed.js?v=21';
import {
  collection, doc, addDoc, runTransaction, serverTimestamp, increment, Timestamp,
  onSnapshot, query, where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ガチャ券は08_UPoint側で50UP固定(2026-09時点)。開始=券の5分の1、即決=券の5倍という
// 比率で運用する方針のため、ここは連動する自動計算ではなく固定値。券の価格を
// 変更したらここも手動で合わせること。閲覧側(26_UkoAuction)にも同じ値を持たせているので
// 変更時はそちらも合わせること。
export const AUCTION_START_PRICE   = 25;
export const AUCTION_BUY_NOW_PRICE = 500;
const AUCTION_DURATION_MS = 48 * 60 * 60 * 1000; // 48時間

const STR = {
  ja: {
    listLoginRequired: '出品にはアカウント登録（無料）が必要です。登録・ログインしてから出品してください。',
    listNoStock: '出品できる在庫がありません。',
    listFailed: '出品に失敗しました。時間をおいて再度お試しください。',
    listDone: '出品しました。うーこオークションで確認できます。',
  },
  en: {
    listLoginRequired: 'Listing requires a free account. Please register and log in first.',
    listNoStock: "You don't have any to list.",
    listFailed: 'Failed to list. Please try again later.',
    listDone: 'Listed! You can check it on Uko Auction.',
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

// ===== 出品の確認ポップ(ブラウザ標準confirm()の代わりに、うーこの部屋のデザインに合わせた
// 独自ポップでサムネ・開始価格・即決価格・出品期間を見せてから確認する) =====
function openListingConfirmModal(design) {
  const modal = document.getElementById('auction-listing-confirm-modal');
  if (!modal) return Promise.resolve(true); // 万一要素が無ければ素通りさせる

  const img = document.getElementById('auction-listing-confirm-img');
  const nameEl = document.getElementById('auction-listing-confirm-name');
  const startEl = document.getElementById('auction-listing-confirm-start');
  const buyNowEl = document.getElementById('auction-listing-confirm-buynow');
  if (img) { img.src = design.url; img.alt = design.name; }
  if (nameEl) nameEl.textContent = design.name;
  if (startEl) startEl.textContent = `${AUCTION_START_PRICE}UP`;
  if (buyNowEl) buyNowEl.textContent = `${AUCTION_BUY_NOW_PRICE}UP`;
  modal.style.display = 'flex';

  return new Promise((resolve) => {
    const okBtn = document.getElementById('auction-listing-confirm-ok');
    const cancelBtn = document.getElementById('auction-listing-confirm-cancel');
    const closeBtn = document.getElementById('auction-listing-confirm-close');
    const backdrop = modal.querySelector('.col-modal-backdrop');

    const finish = (result) => {
      modal.style.display = 'none';
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      backdrop?.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    backdrop?.addEventListener('click', onCancel);
  });
}

// ===== 出品（自分のドキュメントだけで完結する単純なトランザクション） =====
// うーこの部屋 横断マーケット(ukoMarketListings)への出品。閲覧・入札・即決購入・精算は
// 26_UkoAuctionが担当するため、ここでは出品して終わり(returnFieldに落札/流札時の
// 返却先フィールドを書き込んでおくことで、26_UkoAuction側はサイト固有の知識なしに精算できる)。
export async function createListing(design) {
  if (!design) return;
  if (!(await isAccountLoggedIn())) { alert(s().listLoginRequired); return; }
  if (!(await openListingConfirmModal(design))) return;

  const userId = getUserId();
  const userRef = doc(db, 'omikujiUsers', userId);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('NO_USER_DOC');
      const owned = (snap.data().cardBacks || {})[design.id] || 0;
      if (owned < 1) throw new Error('NO_STOCK');
      tx.update(userRef, { [`cardBacks.${design.id}`]: increment(-1) });
    });

    const listingRef = await addDoc(collection(db, 'ukoMarketListings'), {
      siteKey: 'omikuji',
      sellerId: userId,
      sellerName: store.name || '',
      itemId: design.id,
      itemName: design.name,
      itemImageUrl: design.url,
      returnField: `cardBacks.${design.id}`,
      startPrice: AUCTION_START_PRICE,
      buyNowPrice: AUCTION_BUY_NOW_PRICE,
      currentBid: 0,
      currentBidderId: null,
      currentBidderName: '',
      status: 'active',
      createdAt: serverTimestamp(),
      endsAt: Timestamp.fromMillis(Date.now() + AUCTION_DURATION_MS),
      soldPrice: null,
      soldTo: null,
      soldVia: null,
    });

    submitListingFeedEntry({
      name: store.name || '',
      itemId: design.id,
      itemName: design.name,
      itemImageUrl: design.url,
      listingId: listingRef.id,
    });

    alert(s().listDone);
    return true;
  } catch (e) {
    console.error('[auction] listing failed', e);
    alert(e.message === 'NO_STOCK' ? s().listNoStock : s().listFailed);
    return false;
  }
}

// ===== 自分が現在出品中のアイテム一覧(裏面図鑑に「出品中」バッジを出すため) =====
let myListedItemIds = new Set();

export function watchMyListings(onChange) {
  const q = query(
    collection(db, 'ukoMarketListings'),
    where('sellerId', '==', getUserId()),
    where('status', '==', 'active'),
  );
  onSnapshot(q, (snap) => {
    myListedItemIds = new Set(snap.docs.map((d) => d.data().itemId));
    onChange();
  }, (e) => console.error('[auction] my listings watch failed', e));
}

export function isItemListed(itemId) {
  return myListedItemIds.has(itemId);
}
