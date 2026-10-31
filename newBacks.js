// newBacks.js
// 新着裏面の帯(2026-10-31追加)。みんなの結果の上に、直近30日に追加した裏面のサムネと追加日を1列に並べる
// (自動では流さず、横スクロールで見る。2026-10-31、自動で流れるのはなしとのことで変更)。
// UP交換所の「新着裏面の帯」(300UP、sitePerks.omikuji.newBacksTickerUnlocked)を交換した人にだけ出す。
// 2026-10-31に一般公開。NEW_BACKS_ADMIN_ONLY を true に戻すと、調整用に管理者ロールの人にだけ出る
// (そのときは交換していなくても出て、一般の人には交換していても出ない)。
// Firestoreの読み取りは増やさない(ロールは auction.js が読んだものを、解放フラグは store を使う)。
// サムネは元画像(1枚300KBほど)ではなく、各フォルダの thumbs/ にある小さい版(30KBほど)を使う。
import { ALL_CARD_DESIGNS, RECENT_BACKS, isStarRailDesign } from './gachaBacks.js?v=23';
import { store } from './userData.js?v=4';

const NEW_BACKS_ADMIN_ONLY = false;
const RECENT_DAYS = 30; // この日数以内に追加した裏面を出す

const STR = {
  ja: { added: (md) => `${md} 追加`, sr: 'スタレ' },
  en: { added: (md) => `Added ${md}`, sr: 'HSR' },
};

let isAdmin = false;

function canShow() {
  if (NEW_BACKS_ADMIN_ONLY) return isAdmin;
  return !!store.sitePerks?.omikuji?.newBacksTickerUnlocked;
}

function localIsoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function recentItems() {
  const byId = new Map(ALL_CARD_DESIGNS.map((d) => [d.id, d]));
  const cutoff = localIsoDate(new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000));
  return RECENT_BACKS
    .filter(([id, date]) => byId.has(id) && date >= cutoff)
    .map(([id, date]) => ({ ...byId.get(id), date }));
}

// 元画像のURL(.../GachaBacks/back_Custom_556.jpg)から、サムネのURL(.../GachaBacks/thumbs/back_Custom_556.jpg)を作る
function thumbUrl(url) {
  const i = url.lastIndexOf('/');
  return `${url.slice(0, i)}/thumbs${url.slice(i)}`;
}

function fmtMonthDay(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

function makeItem(item, t) {
  const sr = isStarRailDesign(item.id);
  const el = document.createElement('div');
  el.className = 'new-backs-item' + (sr ? ' is-sr' : '');
  const img = document.createElement('img');
  img.className = 'new-backs-img';
  img.src = thumbUrl(item.url);
  img.alt = item.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  const no = document.createElement('div');
  no.className = 'new-backs-no';
  no.textContent = (sr ? `${t.sr} ` : '') + item.id.replace(/^(custom|sr)_/, 'No.');
  const date = document.createElement('div');
  date.className = 'new-backs-date';
  date.textContent = t.added(fmtMonthDay(item.date));
  el.append(img, no, date);
  return el;
}

export function renderNewBacksTicker(opts) {
  if (opts && typeof opts.isAdmin === 'boolean') isAdmin = opts.isAdmin;
  const section = document.getElementById('new-backs-section');
  const list = document.getElementById('new-backs-list');
  if (!section || !list) return;
  const items = canShow() ? recentItems() : [];
  section.hidden = items.length === 0;
  list.innerHTML = '';
  if (!items.length) return;
  const t = STR[store.lang === 'en' ? 'en' : 'ja'];
  items.forEach((it) => list.appendChild(makeItem(it, t)));
}

// UP交換所で交換したら、開いたままの画面でも出す(feed.js が自分のユーザー情報の変化を見て発火する)
window.addEventListener('newBacksTickerUnlockChanged', () => renderNewBacksTicker());
