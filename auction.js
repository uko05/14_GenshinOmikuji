// auction.js
// 裏面デザインの出品（閲覧・入札・精算は26_UkoAuctionへ分離した）
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=3';
import { submitListingFeedEntry, isAccountLoggedIn, markMissionAchievedOnce } from './feed.js?v=29';
import {
  collection, doc, getDoc, addDoc, runTransaction, serverTimestamp, increment, Timestamp,
  onSnapshot, query, where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ガチャ券は08_UPoint側で50UP固定(2026-09時点)。開始=券の5分の1という比率で運用する方針
// のため、ここは連動する自動計算ではなく固定値。券の価格を変更したらここも手動で合わせること。
// 閲覧側(26_UkoAuction)にも同じ値を持たせているので変更時はそちらも合わせること。
// 即決(買い切り)機能は2026-09-19に廃止した。固定500UPの即決価格がガチャ券50UPを大きく
// 上回っていたため、メイン垢で安くガチャを回して複製をサブ垢に即決購入させる自演両替の
// 抜け道になっていた(実際の取引データから発覚)。抜け道自体を塞ぐため機能ごと削除する方針。
export const AUCTION_START_PRICE   = 25;
const AUCTION_DURATION_DEFAULT_HOURS = 24; // 出品期間の選択肢のデフォルト値(確認ポップのselectと合わせる)

// ===== 期間限定キャンペーン(ukoAuctionCampaigns, 2026-09-18追加) =====
// 26_UkoAuctionの管理者画面で作成する。listingBonus(出品するたび定額UP)・
// listingCountBonus(期間中の出品数が閾値を超えるたびボーナスUP)はここ(出品時)で
// 即座に適用する。sellerBonus(落札額×倍率)・bidderBonus(落札額の%還元)は効果が
// 出るのは落札確定時だが、出品期間が最短24時間あるため「出品した時はキャンペーン
// 開催中だったのに、落札が確定する頃には終わっていて恩恵が付かない」問題があった
// (2026-09-20発覚)。そのため出品した瞬間に有効な倍率/還元率をこのドキュメント自体に
// スナップショット(sellerBonusMultiplier/bidderBonusRate)しておき、26_UkoAuction側の
// 精算(settleListing)はキャンペーンを再判定せずこの値をそのまま使う。スキーマの詳細も
// そちら(script.js)のコメント参照。
let latestAuctionCampaigns = [];
onSnapshot(collection(db, 'ukoAuctionCampaigns'), (snap) => {
  latestAuctionCampaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}, (e) => console.error('[auction] campaigns listen failed', e));

// adminOnly(2026-09-20追加): テスト中のキャンペーンを一般ユーザーに適用しないためのフラグ。
// 26_UkoAuction/script.jsと同じ仕組み(sharedUserRoles、匿名ID直接キー)で判定する。
let isAdminRole = false;
(async () => {
  try {
    const snap = await getDoc(doc(db, 'sharedUserRoles', getUserId()));
    isAdminRole = snap.exists() && snap.data().role === 'admin';
  } catch (e) {
    console.error('[auction] role load failed', e);
  }
})();

function isCampaignActiveNow(c) {
  if (!c.enabled) return false;
  if (c.adminOnly && !isAdminRole) return false;
  const now = Date.now();
  return c.startsAt?.toMillis() <= now && now <= c.endsAt?.toMillis();
}

// 出品1件につきもらえるボーナスUPの内訳を返す。
// listingBonus: 有効な全キャンペーン分を合算(定額の重ね掛けは意図通り)。
// listingCountBonus: userDataは出品トランザクション内で読んだ最新のomikujiUsersデータ
//   (呼び出し側でtx.get済みのsnap.data())。キャンペーンごとに出品数を数え、新しく
//   閾値を超えたtierのボーナスだけを加算する(同じtierを二重に払わないよう
//   claimedTiersで管理)。progressUpdatesは呼び出し側がtx.update()に含めるための
//   auctionCampaignProgress.{campaignId}の新しい値。
function computeListingCampaignBonus(userData) {
  let totalBonus = 0;
  const progressUpdates = {};

  activeCampaignsByType('listingBonus').forEach((c) => {
    totalBonus += c.bonusAmount || 0;
  });

  activeCampaignsByType('listingCountBonus').forEach((c) => {
    const progress = userData.auctionCampaignProgress?.[c.id] || { count: 0, claimedTiers: [] };
    const newCount = progress.count + 1;
    const claimedTiers = progress.claimedTiers || [];
    const newlyClaimed = [];
    (c.tiers || []).forEach((tier) => {
      if (newCount >= tier.count && !claimedTiers.includes(tier.count)) {
        totalBonus += tier.bonus || 0;
        newlyClaimed.push(tier.count);
      }
    });
    progressUpdates[`auctionCampaignProgress.${c.id}`] = {
      count: newCount,
      claimedTiers: [...claimedTiers, ...newlyClaimed],
    };
  });

  return { totalBonus, progressUpdates };
}

function activeCampaignsByType(type) {
  return latestAuctionCampaigns.filter((c) => c.type === type && isCampaignActiveNow(c));
}

// 出品時点で有効なsellerBonus/bidderBonusをスナップショットする値。26_UkoAuction/script.js
// の同名ロジック(activeSellerBonusMultiplier/activeBidderBonusRate、削除済み)と同じく、
// 複数同時有効な場合も合算せず最大値だけ採用する(1つも無ければ倍率1・還元率0)。
function snapshotSellerBonusMultiplier() {
  const active = activeCampaignsByType('sellerBonus');
  if (!active.length) return 1;
  return Math.max(1, ...active.map((c) => c.multiplier || 1));
}
function snapshotBidderBonusRate() {
  const active = activeCampaignsByType('bidderBonus');
  if (!active.length) return 0;
  return Math.max(0, ...active.map((c) => c.rate || 0));
}

const STR = {
  ja: {
    listLoginRequired: '出品にはアカウント登録（無料）が必要です。登録・ログインしてから出品してください。',
    listNoStock: '出品できる在庫がありません。',
    listFailed: '出品に失敗しました。時間をおいて再度お試しください。',
    listDone: '出品しました。うーこオークションで確認できます。',
    listDoneWithBonus: (n) => `出品しました。キャンペーンで+${n}UPもらいました！うーこオークションで確認できます。`,
  },
  en: {
    listLoginRequired: 'Listing requires a free account. Please register and log in first.',
    listNoStock: "You don't have any to list.",
    listFailed: 'Failed to list. Please try again later.',
    listDone: 'Listed! You can check it on Uko Auction.',
    listDoneWithBonus: (n) => `Listed! You earned +${n}UP from a campaign! You can check it on Uko Auction.`,
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

// ===== 出品の確認ポップ(ブラウザ標準confirm()の代わりに、うーこの部屋のデザインに合わせた
// 独自ポップでサムネ・開始価格・出品期間を見せてから確認する) =====
// 戻り値: キャンセル時はfalse、出品確定時は{ durationHours: number }
function openListingConfirmModal(design) {
  const modal = document.getElementById('auction-listing-confirm-modal');
  if (!modal) return Promise.resolve({ durationHours: AUCTION_DURATION_DEFAULT_HOURS }); // 万一要素が無ければ素通りさせる

  const img = document.getElementById('auction-listing-confirm-img');
  const nameEl = document.getElementById('auction-listing-confirm-name');
  const startEl = document.getElementById('auction-listing-confirm-start');
  const durationSelect = document.getElementById('auction-listing-confirm-duration');
  if (img) { img.src = design.url; img.alt = design.name; }
  if (nameEl) nameEl.textContent = design.name;
  if (startEl) startEl.textContent = `${AUCTION_START_PRICE}UP`;
  if (durationSelect) durationSelect.value = String(AUCTION_DURATION_DEFAULT_HOURS);

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
    const onOk = () => finish({
      durationHours: Number(durationSelect?.value) || AUCTION_DURATION_DEFAULT_HOURS,
    });
    const onCancel = () => finish(false);

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    backdrop?.addEventListener('click', onCancel);
  });
}

// ===== 出品（自分のドキュメントだけで完結する単純なトランザクション） =====
// うーこの部屋 横断マーケット(ukoMarketListings)への出品。閲覧・入札・精算は
// 26_UkoAuctionが担当するため、ここでは出品して終わり(returnFieldに落札/流札時の
// 返却先フィールドを書き込んでおくことで、26_UkoAuction側はサイト固有の知識なしに精算できる)。
export async function createListing(design) {
  if (!design) return;
  if (!(await isAccountLoggedIn())) { alert(s().listLoginRequired); return; }
  const confirmResult = await openListingConfirmModal(design);
  if (!confirmResult) return;
  const { durationHours } = confirmResult;

  const userId = getUserId();
  const userRef = doc(db, 'omikujiUsers', userId);
  let campaignBonusEarned = 0;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('NO_USER_DOC');
      const data = snap.data();
      const owned = (data.cardBacks || {})[design.id] || 0;
      if (owned < 1) throw new Error('NO_STOCK');

      const { totalBonus, progressUpdates } = computeListingCampaignBonus(data);
      campaignBonusEarned = totalBonus;
      const updates = { [`cardBacks.${design.id}`]: increment(-1), ...progressUpdates };
      if (totalBonus > 0) {
        updates.ukoPoints = increment(totalBonus);
        // UP取得履歴(管理者画面用の監査ログ、2026-09-19追加)。トランザクション内では
        // addDoc()が使えないため、事前にdoc(collection(...))でrefを作りtx.set()する。
        tx.set(doc(collection(db, 'ukoPointsLog')), {
          userId, amount: totalBonus, type: 'auctionListingBonus',
          meta: { itemId: design.id, itemName: design.name }, createdAt: serverTimestamp(),
        });
      }
      tx.update(userRef, updates);
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
      currentBid: 0,
      currentBidderId: null,
      currentBidderName: '',
      bidCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      endsAt: Timestamp.fromMillis(Date.now() + durationHours * 60 * 60 * 1000),
      soldPrice: null,
      soldTo: null,
      soldVia: null,
      // 出品した瞬間に有効なsellerBonus/bidderBonusをスナップショット(上のコメント参照)。
      // 精算(26_UkoAuction)はこの値をそのまま使い、精算時点のキャンペーン有無は見ない。
      sellerBonusMultiplier: snapshotSellerBonusMultiplier(),
      bidderBonusRate: snapshotBidderBonusRate(),
    });

    submitListingFeedEntry({
      name: store.name || '',
      itemId: design.id,
      itemName: design.name,
      itemImageUrl: design.url,
      listingId: listingRef.id,
    });

    markMissionAchievedOnce('omikujiAuctionListing');

    alert(campaignBonusEarned > 0 ? s().listDoneWithBonus(campaignBonusEarned) : s().listDone);
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
