// auction.js
// 裏面デザインの出品（閲覧・入札・精算は26_UkoAuctionへ分離した）
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=3';
import { submitListingFeedEntry, isAccountLoggedIn, markMissionAchievedOnce } from './feed.js?v=30';
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
// 出品期間は固定24時間(2026-09-20に48時間の選択肢を廃止し、選べなくした)。
const AUCTION_DURATION_HOURS = 24;

// ===== 期間限定キャンペーン(ukoAuctionCampaigns, 2026-09-18追加) =====
// 26_UkoAuctionの管理者画面で作成する。ここ(出品時)で即座に適用するのはlistingBonus
// (出品するたび定額UP)とlistingCountBonus(期間中の出品数が閾値を超えるたびボーナスUP)
// の2種類。sellerBonus(落札額×倍率)・bidderBonus(落札額の%還元)は「落札時ボーナス／
// 落札者キャッシュバック」という名前通り、落札が確定した瞬間にキャンペーンが有効かどうかで
// 判定するため(2026-09-20、出品時点スナップショット方式から変更)、精算を担当する
// 26_UkoAuction側だけで判定している。スキーマの詳細もそちら(script.js)のコメント参照。
let latestAuctionCampaigns = [];
onSnapshot(collection(db, 'ukoAuctionCampaigns'), (snap) => {
  latestAuctionCampaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderCampaignBanner();
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
  renderCampaignBanner();
})();

function isCampaignActiveNow(c) {
  if (!c.enabled) return false;
  if (c.adminOnly && !isAdminRole) return false;
  const now = Date.now();
  return c.startsAt?.toMillis() <= now && now <= c.endsAt?.toMillis();
}

// ===== 開催中キャンペーンのお知らせバナー(2026-09-20追加、まずは管理者ロールだけに表示) =====
// 「オークションサイトにしかバナーが出ないと気づかない人がいる」という理由で、
// おみくじサイト側(みんなの結果フィードの下、アルカナ結果の上=#campaign-banner)にも
// 26_UkoAuction/script.jsと同じ内容のバナーを複製する。バナー画像URL・要約文言は
// あちら側と同じものをこちらにも持たせている(画像を差し替えたら3箇所
// [26_UkoAuction/script.js, 24_AccountCenter/admin/admin.js, ここ]を揃えること)。
// CAMPAIGN_BANNER_ADMIN_ONLYはこのバナー自体を一般公開する前の確認用フラグ
// (campaign doc側のadminOnlyとは別物)。2026-09-20、確認が取れたためfalseにして全員に公開。
const CAMPAIGN_BANNER_ADMIN_ONLY = false;

const CAMPAIGN_TYPE_BANNER_URLS = {
  listingBonus: 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/auction/%E5%87%BA%E5%93%81%E5%8D%B3%E6%99%82%E3%83%9C%E3%83%BC%E3%83%8A%E3%82%B9.png',
  sellerBonus: 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/auction/%E8%90%BD%E6%9C%AD%E6%99%82%E3%83%9C%E3%83%BC%E3%83%8A%E3%82%B9.png',
  listingCountBonus: 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/auction/%E5%87%BA%E5%93%81%E6%95%B0%E3%83%9C%E3%83%BC%E3%83%8A%E3%82%B9.png',
  bidderBonus: 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/auction/%E8%90%BD%E6%9C%AD%E6%99%82%E3%82%AD%E3%83%A3%E3%83%83%E3%82%B7%E3%83%A5%E3%83%90%E3%83%83%E3%82%AF.png',
};

const CAMPAIGN_BANNER_STR = {
  ja: {
    sellerBonus: (mult, until) => `🎉 出品者ボーナス開催中！出品が落札されると通常の${mult}倍のUPがもらえます（${until}まで）`,
    listingBonus: (amount, until) => `🎉 出品ボーナス開催中！出品するたび+${amount}UP（${until}まで）`,
    listingCountBonus: (until) => `🎉 出品数ボーナス開催中！出品数に応じてボーナスUPがもらえます（${until}まで）`,
    bidderBonus: (rate, until) => `🎉 落札者キャッシュバック開催中！落札すると支払額の${rate}%がUPで還元されます（${until}まで）`,
    deferredNote: '※ボーナスUPはキャンペーン終了後、メールでまとめてお届けします（受け取る操作で加算されます）',
  },
  en: {
    sellerBonus: (mult, until) => `🎉 Seller Bonus is live! Sellers get ${mult}x UP when their listing sells (until ${until})`,
    listingBonus: (amount, until) => `🎉 Listing Bonus is live! +${amount}UP every time you list an item (until ${until})`,
    listingCountBonus: (until) => `🎉 Listing Count Bonus is live! Bonus UP based on how many items you list (until ${until})`,
    bidderBonus: (rate, until) => `🎉 Bidder Cashback is live! Get ${rate}% of what you pay back as UP when you win (until ${until})`,
    deferredNote: '※ Bonus UP is delivered by mail after the campaign ends (claim it there to receive it)',
  },
};

function fmtCampaignBannerDate(ts) {
  if (!ts || typeof ts.toMillis !== 'function') return '';
  const d = new Date(ts.toMillis());
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function campaignBannerSummaryText(c) {
  const until = fmtCampaignBannerDate(c.endsAt);
  const t = CAMPAIGN_BANNER_STR[store.lang === 'en' ? 'en' : 'ja'];
  if (c.type === 'sellerBonus') return t.sellerBonus(c.multiplier, until);
  if (c.type === 'listingBonus') return t.listingBonus(c.bonusAmount, until);
  if (c.type === 'listingCountBonus') return t.listingCountBonus(until);
  if (c.type === 'bidderBonus') return t.bidderBonus(c.rate, until);
  return '';
}

// バナー全体をクリックすると26_UkoAuctionへ飛ぶ(このサイト単体では出品/入札できず、
// 詳細を確認する場所が別サイトのため)。
export function renderCampaignBanner() {
  const el = document.getElementById('campaign-banner');
  if (!el) return;
  const active = latestAuctionCampaigns.filter(isCampaignActiveNow);
  const visible = CAMPAIGN_BANNER_ADMIN_ONLY ? (isAdminRole ? active : []) : active;
  el.innerHTML = '';
  el.hidden = visible.length === 0;
  visible.forEach((c) => {
    const link = document.createElement('a');
    link.className = 'campaign-banner-item';
    link.href = 'https://uko05.github.io/26_UkoAuction/';
    link.target = '_blank';
    link.rel = 'noopener';

    const bannerUrl = CAMPAIGN_TYPE_BANNER_URLS[c.type];
    if (bannerUrl) {
      const img = document.createElement('img');
      img.className = 'campaign-banner-img';
      img.src = bannerUrl;
      img.alt = '';
      link.appendChild(img);
    }

    const row = document.createElement('div');
    row.className = 'campaign-banner-text';
    row.textContent = campaignBannerSummaryText(c);
    link.appendChild(row);

    el.appendChild(link);
  });
  // ボーナスUP自体は即時付与ではなくキャンペーン終了後の集計メール経由(2026-09-20変更)
  // なので、そのことを一度だけ案内しておく(バナーごとに繰り返さない)。
  if (visible.length > 0) {
    const note = document.createElement('div');
    note.className = 'campaign-banner-note';
    note.textContent = CAMPAIGN_BANNER_STR[store.lang === 'en' ? 'en' : 'ja'].deferredNote;
    el.appendChild(note);
  }
}

// 出品1件につきもらえるボーナスUPの内訳を返す。
// listingBonus: 有効な全キャンペーン分を合算(定額の重ね掛けは意図通り)。
// listingCountBonus: userDataは出品トランザクション内で読んだ最新のomikujiUsersデータ
//   (呼び出し側でtx.get済みのsnap.data())。キャンペーンごとに出品数を数え、新しく
//   閾値を超えたtierのボーナスだけを加算する(同じtierを二重に払わないよう
//   claimedTiersで管理)。progressUpdatesは呼び出し側がtx.update()に含めるための
//   auctionCampaignProgress.{campaignId}の新しい値。
// breakdown(2026-09-20追加): totalBonusの内訳を、どのキャンペーンが何UP分寄与したか
// 1件ずつ持たせたもの。同時に複数のlistingBonus/listingCountBonusが有効な場合
// 合算されるため、1つのukoPointsLogエントリにまとめるとキャンペーンごとの
// 集計メール送信(24_AccountCenter/admin)で按分できなくなる。呼び出し側で
// このbreakdown 1件ごとに別々のukoPointsLogを書くことで、campaignId単位の
// 正確な合計を後から拾えるようにする。
function computeListingCampaignBonus(userData) {
  let totalBonus = 0;
  const progressUpdates = {};
  const breakdown = [];

  activeCampaignsByType('listingBonus').forEach((c) => {
    const amount = c.bonusAmount || 0;
    if (amount > 0) {
      totalBonus += amount;
      breakdown.push({ campaignId: c.id, campaignType: 'listingBonus', amount });
    }
  });

  activeCampaignsByType('listingCountBonus').forEach((c) => {
    const progress = userData.auctionCampaignProgress?.[c.id] || { count: 0, claimedTiers: [] };
    const newCount = progress.count + 1;
    const claimedTiers = progress.claimedTiers || [];
    const newlyClaimed = [];
    let campaignAmount = 0;
    (c.tiers || []).forEach((tier) => {
      if (newCount >= tier.count && !claimedTiers.includes(tier.count)) {
        campaignAmount += tier.bonus || 0;
        newlyClaimed.push(tier.count);
      }
    });
    if (campaignAmount > 0) {
      totalBonus += campaignAmount;
      breakdown.push({ campaignId: c.id, campaignType: 'listingCountBonus', amount: campaignAmount });
    }
    progressUpdates[`auctionCampaignProgress.${c.id}`] = {
      count: newCount,
      claimedTiers: [...claimedTiers, ...newlyClaimed],
    };
  });

  return { totalBonus, progressUpdates, breakdown };
}

function activeCampaignsByType(type) {
  return latestAuctionCampaigns.filter((c) => c.type === type && isCampaignActiveNow(c));
}

const STR = {
  ja: {
    listLoginRequired: '出品にはアカウント登録（無料）が必要です。登録・ログインしてから出品してください。',
    listNoStock: '出品できる在庫がありません。',
    listFailed: '出品に失敗しました。時間をおいて再度お試しください。',
    listDone: '出品しました。うーこオークションで確認できます。',
    listDoneWithBonus: (n) => `出品しました。キャンペーン対象で+${n}UP分！キャンペーン終了後、メールでお届けします。`,
  },
  en: {
    listLoginRequired: 'Listing requires a free account. Please register and log in first.',
    listNoStock: "You don't have any to list.",
    listFailed: 'Failed to list. Please try again later.',
    listDone: 'Listed! You can check it on Uko Auction.',
    listDoneWithBonus: (n) => `Listed! This qualifies for +${n}UP — it'll be delivered by mail after the campaign ends.`,
  },
};
function s() { return STR[store.lang === 'en' ? 'en' : 'ja']; }

// ===== 出品の確認ポップ(ブラウザ標準confirm()の代わりに、うーこの部屋のデザインに合わせた
// 独自ポップでサムネ・開始価格・出品期間を見せてから確認する) =====
// 出品期間は固定24時間で選択肢が無いため、戻り値は確定したかどうかのbooleanだけでよい。
function openListingConfirmModal(design) {
  const modal = document.getElementById('auction-listing-confirm-modal');
  if (!modal) return Promise.resolve(true); // 万一要素が無ければ素通りさせる

  const img = document.getElementById('auction-listing-confirm-img');
  const nameEl = document.getElementById('auction-listing-confirm-name');
  const startEl = document.getElementById('auction-listing-confirm-start');
  if (img) { img.src = design.url; img.alt = design.name; }
  if (nameEl) nameEl.textContent = design.name;
  if (startEl) startEl.textContent = `${AUCTION_START_PRICE}UP`;

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
// うーこの部屋 横断マーケット(ukoMarketListings)への出品。閲覧・入札・精算は
// 26_UkoAuctionが担当するため、ここでは出品して終わり(returnFieldに落札/流札時の
// 返却先フィールドを書き込んでおくことで、26_UkoAuction側はサイト固有の知識なしに精算できる)。
export async function createListing(design) {
  if (!design) return;
  if (!(await isAccountLoggedIn())) { alert(s().listLoginRequired); return; }
  const confirmed = await openListingConfirmModal(design);
  if (!confirmed) return;

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

      const { totalBonus, progressUpdates, breakdown } = computeListingCampaignBonus(data);
      campaignBonusEarned = totalBonus;
      const updates = { [`cardBacks.${design.id}`]: increment(-1), ...progressUpdates };
      if (totalBonus > 0) {
        // ukoPointsはここでは増やさない(2026-09-20変更): キャンペーンによるボーナス分は
        // 即時付与せず、キャンペーン終了後に24_AccountCenter/adminから送る集計メールの
        // 「受け取る」操作で初めて加算される(sellerBonus/bidderBonusと扱いを揃えた)。
        // ここではUP取得履歴(管理者画面用の監査ログ、2026-09-19追加)だけ記録しておく。
        // トランザクション内ではaddDoc()が使えないため、事前にdoc(collection(...))で
        // refを作りtx.set()する。breakdown 1件=1キャンペーンごとに別々のログを書く
        // (campaignId単位で後から集計できるようにするため、2026-09-20)。
        breakdown.forEach((b) => {
          tx.set(doc(collection(db, 'ukoPointsLog')), {
            userId, amount: b.amount, type: 'auctionListingBonus',
            meta: { itemId: design.id, itemName: design.name, campaignId: b.campaignId, campaignType: b.campaignType },
            createdAt: serverTimestamp(),
          });
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
      endsAt: Timestamp.fromMillis(Date.now() + AUCTION_DURATION_HOURS * 60 * 60 * 1000),
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
