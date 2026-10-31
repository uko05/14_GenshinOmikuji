// wishCrystal.js
// 願いの結晶(2026-11-01追加)。UP交換所で1500UP・毎月1個まで交換できるアイテム
// (sitePerks.omikuji.wishCrystals に個数が入る。08_UPoint/script.js の omikuji_wish_crystal)。
// 1個使うと、裏面図鑑から選んだ好きな裏面デザインが1枚増える。
// - 持っている裏面も選べる。スタレ裏面は選べない。
// - 結晶で手に入れた枚数は cardBacksLocked.{裏面ID} に数えておき、その分はオークションに出品できない
//   (auction.js の createListing が「持っている枚数 − この枚数」で判定)。一括売却(sell.js)では売れる。
// - 使ったことはみんなの結果(フィード)には出さない。
// 2026-11-01に一般公開。WISH_ADMIN_ONLY を true に戻すと、管理者ロールの人にだけ結晶の表示・使う操作を出す。
import { db } from './firebaseConfig.js';
import { getUserId, store } from './userData.js?v=4';
import { ensureLatestVersion } from './versionGuard.js?v=2';
import { isStarRailDesign } from './gachaBacks.js?v=23';
import { doc, runTransaction, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const WISH_ADMIN_ONLY = false;

const STR = {
  ja: {
    barLabel: (n) => `願いの結晶 ×${n}`,
    useBtn: '使う',
    cancelBtn: 'やめる',
    selectHint: '手に入れたい裏面を図鑑から選んでください（スタレ裏面は選べません）',
    modalTitle: '願いの結晶を使いますか？',
    ownedNow: (n) => `今 ${n}枚 持っています → ${n + 1}枚 になります`,
    note: '※この1枚はオークションに出品できません（ダブりの一括売却はできます）',
    getBtn: '手に入れる',
    done: (name) => `${name} を手に入れました`,
    noCrystal: '願いの結晶を持っていません。',
    notTarget: 'スタレ裏面は願いの結晶の対象外です。',
    failed: '願いの結晶を使えませんでした。時間をおいてもう一度お試しください。',
    moreBtn: '願いの結晶でもう1枚',
    lockedNote: (n) => `うち${n}枚は願いの結晶で入手（出品不可）`,
  },
  en: {
    barLabel: (n) => `Wish Crystal ×${n}`,
    useBtn: 'Use',
    cancelBtn: 'Cancel',
    selectHint: 'Pick the card back you want from the collection (Star Rail backs cannot be chosen)',
    modalTitle: 'Use a Wish Crystal?',
    ownedNow: (n) => `You have ${n} → you will have ${n + 1}`,
    note: '* This copy cannot be listed on the auction (it can be bulk-sold as a duplicate).',
    getBtn: 'Get it',
    done: (name) => `You got ${name}`,
    noCrystal: "You don't have a Wish Crystal.",
    notTarget: 'Star Rail card backs cannot be chosen with a Wish Crystal.',
    failed: 'Could not use the Wish Crystal. Please try again later.',
    moreBtn: 'One more with a Wish Crystal',
    lockedNote: (n) => `${n} obtained with a Wish Crystal (cannot be listed)`,
  },
};
const s = () => STR[store.lang === 'en' ? 'en' : 'ja'];

let isAdmin = false;
let selectMode = false;

export function wishStr() { return s(); }

// 結晶の機能をこの人に出すか(試験中は管理者だけ)
export function isWishEnabled() {
  return !WISH_ADMIN_ONLY || isAdmin;
}

export function getWishCrystals() {
  return Math.max(0, store.sitePerks?.omikuji?.wishCrystals || 0);
}

// 結晶で手に入れた(出品できない)枚数
export function getWishLockedCount(designId) {
  return Math.max(0, store.cardBacksLocked?.[designId] || 0);
}

export function isWishSelectMode() {
  return selectMode && isWishEnabled() && getWishCrystals() > 0;
}

export function setWishSelectMode(on) {
  selectMode = !!on;
  window.dispatchEvent(new CustomEvent('wishCrystalsChanged'));
}

export function setWishAdmin(v) {
  isAdmin = !!v;
  window.dispatchEvent(new CustomEvent('wishCrystalsChanged'));
}

// 図鑑の見出しの下に出す「願いの結晶 ×N [使う]」の帯
export function renderWishBar(el) {
  if (!el) return;
  const n = getWishCrystals();
  const show = isWishEnabled() && n > 0;
  el.hidden = !show;
  el.innerHTML = '';
  if (!show) return;
  const t = s();
  const row = document.createElement('div');
  row.className = 'wish-bar-row';
  const label = document.createElement('span');
  label.className = 'wish-bar-label';
  label.textContent = t.barLabel(n);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wish-bar-btn' + (selectMode ? ' is-active' : '');
  btn.textContent = selectMode ? t.cancelBtn : t.useBtn;
  btn.addEventListener('click', () => setWishSelectMode(!selectMode));
  row.append(label, btn);
  el.appendChild(row);
  if (selectMode) {
    const hint = document.createElement('p');
    hint.className = 'wish-bar-hint';
    hint.textContent = t.selectHint;
    el.appendChild(hint);
  }
}

// 確認ポップ(選んだ1枚の絵を大きく出す)
function openConfirm(design) {
  return new Promise((resolve) => {
    const t = s();
    const owned = store.cardBacks?.[design.id] || 0;
    const modal = document.createElement('div');
    modal.className = 'col-modal wish-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="col-modal-backdrop"></div>
      <div class="col-modal-content">
        <button type="button" class="col-modal-close" aria-label="close">×</button>
        <p class="gacha-modal-title wish-modal-title"></p>
        <img class="col-modal-img" alt="">
        <div class="col-modal-name"></div>
        <p class="wish-modal-owned"></p>
        <p class="wish-modal-note"></p>
        <div class="gacha-col-modal-actions">
          <button type="button" class="avatar-nudge-btn wish-modal-cancel"></button>
          <button type="button" class="avatar-nudge-btn wish-modal-ok"></button>
        </div>
      </div>`;
    modal.querySelector('.wish-modal-title').textContent = t.modalTitle;
    const img = modal.querySelector('.col-modal-img');
    img.src = design.url;
    img.alt = design.name;
    modal.querySelector('.col-modal-name').textContent = design.name;
    const ownedEl = modal.querySelector('.wish-modal-owned');
    ownedEl.textContent = owned > 0 ? t.ownedNow(owned) : '';
    ownedEl.hidden = owned === 0;
    modal.querySelector('.wish-modal-note').textContent = t.note;
    modal.querySelector('.wish-modal-cancel').textContent = t.cancelBtn;
    modal.querySelector('.wish-modal-ok').textContent = t.getBtn;
    const close = (ok) => { modal.remove(); resolve(ok); };
    modal.querySelector('.col-modal-backdrop').addEventListener('click', () => close(false));
    modal.querySelector('.col-modal-close').addEventListener('click', () => close(false));
    modal.querySelector('.wish-modal-cancel').addEventListener('click', () => close(false));
    modal.querySelector('.wish-modal-ok').addEventListener('click', () => close(true));
    document.body.appendChild(modal);
  });
}

// 結晶を1個使って design を1枚手に入れる。成功したら true
export async function useWishCrystal(design) {
  const t = s();
  if (!design || !isWishEnabled()) return false;
  if (isStarRailDesign(design.id)) { alert(t.notTarget); return false; }
  if (getWishCrystals() < 1) { alert(t.noCrystal); return false; }
  if (!(await openConfirm(design))) return false;
  if (!(await ensureLatestVersion())) return false;

  const ref = doc(db, 'omikujiUsers', getUserId());
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('NO_USER_DOC');
      const have = snap.data().sitePerks?.omikuji?.wishCrystals || 0;
      if (have < 1) throw new Error('NO_CRYSTAL');
      tx.update(ref, {
        'sitePerks.omikuji.wishCrystals': increment(-1),
        [`cardBacks.${design.id}`]: increment(1),
        [`cardBacksLocked.${design.id}`]: increment(1),
      });
    });
  } catch (e) {
    console.error('[wish] use failed', e);
    alert(e.message === 'NO_CRYSTAL' ? t.noCrystal : t.failed);
    return false;
  }

  // 手元の値も同じだけ動かす(cardBacks は scheduleSync で丸ごと書き戻されるので、サーバーと揃えておく)
  store.cardBacks[design.id] = (store.cardBacks[design.id] || 0) + 1;
  store.cardBacksLocked = { ...(store.cardBacksLocked || {}), [design.id]: getWishLockedCount(design.id) + 1 };
  store.sitePerks = {
    ...(store.sitePerks || {}),
    omikuji: { ...(store.sitePerks?.omikuji || {}), wishCrystals: getWishCrystals() - 1 },
  };
  selectMode = false;
  const isNew = store.cardBacks[design.id] === 1;
  window.dispatchEvent(new CustomEvent('gachaCardBacksUpdated', { detail: { designId: design.id, isNew } }));
  window.dispatchEvent(new CustomEvent('wishCrystalsChanged'));
  alert(t.done(design.name));
  return true;
}

// 自分のユーザー情報が変わったとき(feed.js の購読から)。結晶の個数・出品不可の枚数を取り込む
window.addEventListener('omikujiUserDocChanged', (e) => {
  const d = e.detail || {};
  const locked = d.cardBacksLocked || {};
  const crystals = d.sitePerks?.omikuji?.wishCrystals || 0;
  const lockedChanged = JSON.stringify(locked) !== JSON.stringify(store.cardBacksLocked || {});
  const crystalsChanged = crystals !== getWishCrystals();
  if (!lockedChanged && !crystalsChanged) return;
  store.cardBacksLocked = { ...locked };
  if (crystalsChanged && d.sitePerks) store.sitePerks = d.sitePerks;
  window.dispatchEvent(new CustomEvent('wishCrystalsChanged'));
});

// 管理者ロールかどうか(auction.js が sharedUserRoles を読んだ結果を受け取る。読み取りは増やさない)
window.addEventListener('omikujiAdminRoleLoaded', (e) => setWishAdmin(!!e.detail?.isAdmin));
