// auction.js
// 裏面デザインのオークション機能（出品・入札・即決購入・期限切れ精算）
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=3';
import {
  collection, doc, addDoc, getDoc, onSnapshot, runTransaction,
  query, where, orderBy, limit, serverTimestamp, increment, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ガチャ券は08_UPoint側で50UP固定(2026-09時点)。開始=券の5分の1、即決=券の5倍という
// 比率で運用する方針のため、ここは連動する自動計算ではなく固定値。券の価格を
// 変更したらここも手動で合わせること。
export const AUCTION_START_PRICE   = 10;
export const AUCTION_BUY_NOW_PRICE = 250;
const AUCTION_DURATION_MS = 48 * 60 * 60 * 1000; // 48時間

const STR = {
  ja: {
    empty: '出品されている裏面デザインはありません',
    startLabel: '開始',
    currentLabel: '現在',
    noBid: 'まだ入札なし',
    buyNowLabel: '即決',
    bidBtn: '入札する',
    buyNowBtn: '即決で買う',
    yourListing: '（あなたの出品）',
    timeLeft: (h, m) => `残り${h}時間${m}分`,
    timeLeftMin: (m) => `残り${m}分`,
    ended: '終了処理中…',
    listConfirm: (name) => `「${name}」を1枚オークションに出品します（開始${AUCTION_START_PRICE}UP・即決${AUCTION_BUY_NOW_PRICE}UP・48時間）。よろしいですか？`,
    listNoStock: '出品できる在庫がありません。',
    listFailed: '出品に失敗しました。時間をおいて再度お試しください。',
    listDone: '出品しました。',
    bidPrompt: (min) => `入札額を入力してください（${min}UP以上）`,
    bidTooLow: (min) => `入札額は${min}UP以上にしてください。`,
    bidInvalid: '入札額は整数で入力してください。',
    bidNoPoints: 'UPが足りません。',
    bidOwn: '自分の出品には入札できません。',
    bidEnded: 'このオークションは終了しています。',
    bidFailed: '入札に失敗しました。時間をおいて再度お試しください。',
    bidDone: '入札しました。',
    buyNowConfirm: (name) => `「${name}」を${AUCTION_BUY_NOW_PRICE}UPで即決購入しますか？`,
    buyNowNoPoints: 'UPが足りません。',
    buyNowFailed: '購入に失敗しました。時間をおいて再度お試しください。',
    buyNowDone: '購入しました！',
  },
  en: {
    empty: 'No card-back designs are currently listed',
    startLabel: 'Start',
    currentLabel: 'Current',
    noBid: 'No bids yet',
    buyNowLabel: 'Buy Now',
    bidBtn: 'Bid',
    buyNowBtn: 'Buy Now',
    yourListing: '(Your listing)',
    timeLeft: (h, m) => `${h}h ${m}m left`,
    timeLeftMin: (m) => `${m}m left`,
    ended: 'Settling…',
    listConfirm: (name) => `List 1x "${name}" for auction (start ${AUCTION_START_PRICE}UP, buy-now ${AUCTION_BUY_NOW_PRICE}UP, 48h)?`,
    listNoStock: "You don't have any to list.",
    listFailed: 'Failed to list. Please try again later.',
    listDone: 'Listed!',
    bidPrompt: (min) => `Enter your bid (${min}UP or more)`,
    bidTooLow: (min) => `Your bid must be at least ${min}UP.`,
    bidInvalid: 'Please enter a whole number.',
    bidNoPoints: 'Not enough UP.',
    bidOwn: "You can't bid on your own listing.",
    bidEnded: 'This auction has ended.',
    bidFailed: 'Failed to place bid. Please try again later.',
    bidDone: 'Bid placed!',
    buyNowConfirm: (name) => `Buy "${name}" now for ${AUCTION_BUY_NOW_PRICE}UP?`,
    buyNowNoPoints: 'Not enough UP.',
    buyNowFailed: 'Purchase failed. Please try again later.',
    buyNowDone: 'Purchased!',
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

// ===== 出品（自分のドキュメントだけで完結する単純なトランザクション） =====
export async function createListing(design) {
  if (!design) return;
  if (!confirm(s().listConfirm(design.name))) return;

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

    await addDoc(collection(db, 'omikujiListings'), {
      sellerId: userId,
      sellerName: store.name || '',
      designId: design.id,
      designName: design.name,
      designUrl: design.url,
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

    alert(s().listDone);
    return true;
  } catch (e) {
    console.error('[auction] listing failed', e);
    alert(e.message === 'NO_STOCK' ? s().listNoStock : s().listFailed);
    return false;
  }
}

// ===== 期限切れオークションの精算（誰かが一覧を開いた時に遅延実行する） =====
async function settleListing(listingId) {
  const ref = doc(db, 'omikujiListings', listingId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.status !== 'active') return;
      if (!d.endsAt || d.endsAt.toMillis() > Date.now()) return;

      if (d.currentBidderId) {
        const winnerRef = doc(db, 'omikujiUsers', d.currentBidderId);
        const sellerRef = doc(db, 'omikujiUsers', d.sellerId);
        const [winnerSnap, sellerSnap] = await Promise.all([tx.get(winnerRef), tx.get(sellerRef)]);
        if (winnerSnap.exists()) {
          tx.update(winnerRef, { [`cardBacks.${d.designId}`]: increment(1) });
        }
        if (sellerSnap.exists()) {
          tx.update(sellerRef, { ukoPoints: increment(d.currentBid) });
        }
        tx.update(ref, { status: 'sold', soldVia: 'bid', soldPrice: d.currentBid, soldTo: d.currentBidderId });
      } else {
        // 入札なしで終了 → 出品者に返却
        const sellerRef = doc(db, 'omikujiUsers', d.sellerId);
        const sellerSnap = await tx.get(sellerRef);
        if (sellerSnap.exists()) {
          tx.update(sellerRef, { [`cardBacks.${d.designId}`]: increment(1) });
        }
        tx.update(ref, { status: 'unsold' });
      }
    });
  } catch (e) {
    console.error('[auction] settle failed', e);
  }
}

// ===== 入札（出品者⇔入札者をまたぐトランザクション。競り落とされたら前の入札者に返金する） =====
async function placeBid(listing, amount) {
  const myUserId = getUserId();
  if (listing.sellerId === myUserId) { alert(s().bidOwn); return; }
  if (!Number.isInteger(amount)) { alert(s().bidInvalid); return; }

  const listingRef = doc(db, 'omikujiListings', listing.id);
  const myRef = doc(db, 'omikujiUsers', myUserId);

  try {
    await runTransaction(db, async (tx) => {
      const listingSnap = await tx.get(listingRef);
      if (!listingSnap.exists()) throw new Error('NOT_FOUND');
      const d = listingSnap.data();
      if (d.status !== 'active' || (d.endsAt && d.endsAt.toMillis() <= Date.now())) throw new Error('ENDED');

      const minBid = d.currentBid > 0 ? d.currentBid + 1 : d.startPrice;
      if (amount < minBid) throw new Error('TOO_LOW');

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('NO_USER_DOC');
      const myPoints = mySnap.data().ukoPoints || 0;

      const prevBidderId = d.currentBidderId;
      const prevBid = d.currentBid || 0;
      const isSameBidder = prevBidderId === myUserId;
      // 同一人物の再入札は差額だけエスクロー、別人なら全額エスクロー＋前の入札者へ全額返金
      const escrowNeeded = isSameBidder ? (amount - prevBid) : amount;
      if (myPoints < escrowNeeded) throw new Error('NO_POINTS');

      tx.update(myRef, { ukoPoints: increment(-escrowNeeded) });
      if (prevBidderId && !isSameBidder) {
        const prevRef = doc(db, 'omikujiUsers', prevBidderId);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists()) {
          tx.update(prevRef, { ukoPoints: increment(prevBid) });
        }
      }

      tx.update(listingRef, {
        currentBid: amount,
        currentBidderId: myUserId,
        currentBidderName: store.name || '',
      });
    });
    alert(s().bidDone);
  } catch (e) {
    console.error('[auction] bid failed', e);
    const map = {
      ENDED: s().bidEnded,
      TOO_LOW: s().bidTooLow(listing.currentBid > 0 ? listing.currentBid + 1 : listing.startPrice),
      NO_POINTS: s().bidNoPoints,
    };
    alert(map[e.message] || s().bidFailed);
  }
}

// ===== 即決購入（出品者⇔購入者をまたぐトランザクション。入札中だった人がいれば返金する） =====
async function buyNow(listing) {
  const myUserId = getUserId();
  if (listing.sellerId === myUserId) { alert(s().bidOwn); return; }
  if (!confirm(s().buyNowConfirm(listing.designName))) return;

  const listingRef = doc(db, 'omikujiListings', listing.id);
  const myRef = doc(db, 'omikujiUsers', myUserId);
  const sellerRef = doc(db, 'omikujiUsers', listing.sellerId);

  try {
    await runTransaction(db, async (tx) => {
      const listingSnap = await tx.get(listingRef);
      if (!listingSnap.exists()) throw new Error('NOT_FOUND');
      const d = listingSnap.data();
      if (d.status !== 'active' || (d.endsAt && d.endsAt.toMillis() <= Date.now())) throw new Error('ENDED');

      const mySnap = await tx.get(myRef);
      if (!mySnap.exists()) throw new Error('NO_USER_DOC');
      const myPoints = mySnap.data().ukoPoints || 0;
      if (myPoints < d.buyNowPrice) throw new Error('NO_POINTS');

      const sellerSnap = await tx.get(sellerRef);

      // 入札中だった人がいれば全額返金
      if (d.currentBidderId) {
        const prevRef = doc(db, 'omikujiUsers', d.currentBidderId);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists()) {
          tx.update(prevRef, { ukoPoints: increment(d.currentBid) });
        }
      }

      tx.update(myRef, {
        ukoPoints: increment(-d.buyNowPrice),
        [`cardBacks.${d.designId}`]: increment(1),
      });
      if (sellerSnap.exists()) {
        tx.update(sellerRef, { ukoPoints: increment(d.buyNowPrice) });
      }
      tx.update(listingRef, {
        status: 'sold', soldVia: 'buyNow', soldPrice: d.buyNowPrice, soldTo: myUserId,
      });
    });
    alert(s().buyNowDone);
  } catch (e) {
    console.error('[auction] buy-now failed', e);
    const map = { ENDED: s().bidEnded, NO_POINTS: s().buyNowNoPoints };
    alert(map[e.message] || s().buyNowFailed);
  }
}

// ===== 入札額入力ポップ =====
let bidTargetListing = null;

function openBidModal(listing) {
  bidTargetListing = listing;
  const minBid = listing.currentBid > 0 ? listing.currentBid + 1 : listing.startPrice;
  const nameEl = document.getElementById('auction-bid-name');
  const promptEl = document.getElementById('auction-bid-prompt');
  const input = document.getElementById('auction-bid-input');
  const submitBtn = document.getElementById('auction-bid-submit');
  if (nameEl) nameEl.textContent = listing.designName;
  if (promptEl) promptEl.textContent = s().bidPrompt(minBid);
  if (input) { input.min = minBid; input.value = minBid; }
  if (submitBtn) submitBtn.textContent = s().bidBtn;
  const modal = document.getElementById('auction-bid-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBidModal() {
  bidTargetListing = null;
  const modal = document.getElementById('auction-bid-modal');
  if (modal) modal.style.display = 'none';
}

async function submitBid() {
  if (!bidTargetListing) return;
  const input = document.getElementById('auction-bid-input');
  const amount = Math.floor(Number(input?.value));
  closeBidModal();
  await placeBid(bidTargetListing, amount);
}

// ===== 一覧描画 =====
function fmtTimeLeft(endsAt) {
  const ms = endsAt.toMillis() - Date.now();
  if (ms <= 0) return s().ended;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? s().timeLeft(h, m) : s().timeLeftMin(m);
}

function renderAuctionList(listings) {
  const listEl = document.getElementById('auction-list');
  if (!listEl) return;
  const myUserId = getUserId();
  listEl.innerHTML = '';

  if (listings.length === 0) {
    const p = document.createElement('p');
    p.className = 'notif-empty';
    p.textContent = s().empty;
    listEl.appendChild(p);
    return;
  }

  listings.forEach((listing) => {
    const isExpired = listing.endsAt && listing.endsAt.toMillis() <= Date.now();
    if (isExpired) { settleListing(listing.id); }

    const card = document.createElement('div');
    card.className = 'auction-card';

    const img = document.createElement('img');
    img.className = 'auction-card-img';
    img.src = listing.designUrl;
    img.alt = listing.designName;
    img.loading = 'lazy';
    img.addEventListener('click', () => openAuctionLightbox(listing.designUrl));
    card.appendChild(img);

    const info = document.createElement('div');
    info.className = 'auction-card-info';

    const name = document.createElement('div');
    name.className = 'auction-card-name';
    name.textContent = listing.designName;
    info.appendChild(name);

    const priceRow = document.createElement('div');
    priceRow.className = 'auction-card-price';
    priceRow.textContent = listing.currentBid > 0
      ? `${s().currentLabel} ${listing.currentBid}UP`
      : `${s().startLabel} ${listing.startPrice}UP（${s().noBid}）`;
    info.appendChild(priceRow);

    const buyNowRow = document.createElement('div');
    buyNowRow.className = 'auction-card-buynow';
    buyNowRow.textContent = `${s().buyNowLabel} ${listing.buyNowPrice}UP`;
    info.appendChild(buyNowRow);

    const timeRow = document.createElement('div');
    timeRow.className = 'auction-card-time';
    timeRow.textContent = isExpired ? s().ended : fmtTimeLeft(listing.endsAt);
    info.appendChild(timeRow);

    card.appendChild(info);

    const isMine = listing.sellerId === myUserId;
    const actions = document.createElement('div');
    actions.className = 'auction-card-actions';
    if (isMine) {
      const mine = document.createElement('span');
      mine.className = 'auction-card-mine';
      mine.textContent = s().yourListing;
      actions.appendChild(mine);
    } else if (!isExpired) {
      const bidBtn = document.createElement('button');
      bidBtn.type = 'button';
      bidBtn.className = 'auction-action-btn';
      bidBtn.textContent = s().bidBtn;
      bidBtn.addEventListener('click', () => openBidModal(listing));
      actions.appendChild(bidBtn);

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'auction-action-btn auction-buynow-btn';
      buyBtn.textContent = s().buyNowBtn;
      buyBtn.addEventListener('click', () => buyNow(listing));
      actions.appendChild(buyBtn);
    }
    card.appendChild(actions);

    listEl.appendChild(card);
  });
}

function openAuctionLightbox(url) {
  const lightbox = document.getElementById('gacha-lightbox');
  const lightboxImg = document.getElementById('gacha-lightbox-img');
  if (!lightbox || !lightboxImg || !url) return;
  lightboxImg.src = url;
  lightbox.classList.add('visible');
}

// ===== 初期化 =====
export function initAuction() {
  const q = query(
    collection(db, 'omikujiListings'),
    where('status', '==', 'active'),
    orderBy('endsAt', 'asc'),
    limit(100)
  );
  onSnapshot(q, (snap) => {
    const listings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAuctionList(listings);
  }, (err) => console.error('[auction] listen failed', err));

  const bidClose = document.getElementById('auction-bid-close');
  if (bidClose) bidClose.addEventListener('click', closeBidModal);
  const bidBackdrop = document.querySelector('#auction-bid-modal .col-modal-backdrop');
  if (bidBackdrop) bidBackdrop.addEventListener('click', closeBidModal);
  const bidSubmit = document.getElementById('auction-bid-submit');
  if (bidSubmit) bidSubmit.addEventListener('click', submitBid);
}
