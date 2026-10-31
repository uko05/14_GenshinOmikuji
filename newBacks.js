// newBacks.js
// 新着裏面の帯(2026-10-31追加)。みんなの結果の上に、最近追加した裏面のサムネと追加日を横にゆっくり流す。
// UP交換所の「新着裏面の帯」(sitePerks.omikuji.newBacksTickerUnlocked)を交換した人に出す予定。
// 今は見た目の調整中なので、NEW_BACKS_ADMIN_ONLY が true の間は管理者ロールの人にだけ出す
// (交換していなくても出る。一般の人には交換していても出ない)。
// Firestoreの読み取りは増やさない(ロールは auction.js が読んだものを、解放フラグは store を使う)。
import { GACHA_DESIGNS, RECENT_BACKS } from './gachaBacks.js?v=23';
import { store } from './userData.js?v=4';

const NEW_BACKS_ADMIN_ONLY = true;
const SHOW_COUNT = 5;        // 流す裏面の数(新しい順)
const SPEED_PX_PER_SEC = 22; // 流れる速さ

const STR = {
  ja: { added: (md) => `${md} 追加` },
  en: { added: (md) => `Added ${md}` },
};

let isAdmin = false;
let resizeTimer = 0;

function canShow() {
  if (NEW_BACKS_ADMIN_ONLY) return isAdmin;
  return !!store.sitePerks?.omikuji?.newBacksTickerUnlocked;
}

function recentItems() {
  const byId = new Map(GACHA_DESIGNS.map((d) => [d.id, d]));
  return RECENT_BACKS
    .filter(([id]) => byId.has(id))
    .slice(0, SHOW_COUNT)
    .map(([id, date]) => ({ ...byId.get(id), date }));
}

function fmtMonthDay(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${d}`;
}

function makeItem(item, t) {
  const el = document.createElement('div');
  el.className = 'new-backs-item';
  const img = document.createElement('img');
  img.className = 'new-backs-img';
  img.src = item.url;
  img.alt = item.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  const no = document.createElement('div');
  no.className = 'new-backs-no';
  no.textContent = item.id.replace('custom_', 'No.');
  const date = document.createElement('div');
  date.className = 'new-backs-date';
  date.textContent = t.added(fmtMonthDay(item.date));
  el.append(img, no, date);
  return el;
}

// 同じ並びを2つ続けて置き、1つ分の幅だけ左へ動かして繰り返すと、つなぎ目なく流れ続ける。
// 画面が広くて5個だと幅が足りないときは、1つ分の中で並びを繰り返して画面幅以上にする。
function layout() {
  const section = document.getElementById('new-backs-section');
  const viewport = document.getElementById('new-backs-viewport');
  const track = document.getElementById('new-backs-track');
  if (!section || !viewport || !track || section.hidden) return;
  const items = recentItems();
  const t = STR[store.lang === 'en' ? 'en' : 'ja'];
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  track.innerHTML = '';
  track.classList.remove('is-moving');
  const group = document.createElement('div');
  group.className = 'new-backs-group';
  items.forEach((it) => group.appendChild(makeItem(it, t)));
  track.appendChild(group);
  if (reduce) return; // 動きを減らす設定の人には流さず、指で横にスクロールできるようにする

  const setWidth = group.scrollWidth;
  const need = viewport.clientWidth;
  if (!setWidth) return;
  const repeat = Math.max(1, Math.ceil(need / setWidth));
  for (let r = 1; r < repeat; r++) items.forEach((it) => group.appendChild(makeItem(it, t)));
  const copy = group.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  track.appendChild(copy);

  const shift = group.scrollWidth;
  track.style.setProperty('--new-backs-shift', `-${shift}px`);
  track.style.setProperty('--new-backs-duration', `${Math.round(shift / SPEED_PX_PER_SEC)}s`);
  track.classList.add('is-moving');
}

export function renderNewBacksTicker(opts) {
  if (opts && typeof opts.isAdmin === 'boolean') isAdmin = opts.isAdmin;
  const section = document.getElementById('new-backs-section');
  if (!section) return;
  const show = canShow() && recentItems().length > 0;
  section.hidden = !show;
  if (show) layout();
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 200);
});
// UP交換所で交換したら、開いたままの画面でも出す(feed.js が自分のユーザー情報の変化を見て発火する)
window.addEventListener('newBacksTickerUnlockChanged', () => renderNewBacksTicker());
