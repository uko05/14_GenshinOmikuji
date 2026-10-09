// gachaBacks.js
// 裏面デザインガチャの画像一覧(99_SharedImage/01_Genshin/Omikuji/GachaBacksに配置、back_Custom_001〜539、JPEG)
export const GACHA_IMG_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/Omikuji/GachaBacks/';

export const GACHA_DESIGNS = Array.from({ length: 539 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0');
  return {
    id: `custom_${num}`,
    name: `裏面デザイン No.${num}`,
    url: `${GACHA_IMG_BASE}back_Custom_${num}.jpg`,
  };
});

// ===== スタレ裏面(2026-10-09追加) =====
// 99_SharedImage/01_Genshin/Omikuji/StarRailBacksに配置、StarRail_Custom_001〜115、JPEG。
// UP交換所の「スタレ裏面ガチャ解放」(sitePerks.omikuji.starRailGachaUnlocked、500UP、一度きり・オフ不可)を
// 交換した人だけ、ガチャの排出対象に入る。オークションには出品できない(自力で引くしかない)。
// tools/add_card_backs.py は上の原神分の Array.from だけを書き換えるので、原神分を必ず先に置くこと。
export const STARRAIL_IMG_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/Omikuji/StarRailBacks/';

export const STARRAIL_DESIGNS = Array.from({ length: 115 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0');
  return {
    id: `sr_${num}`,
    name: `スタレ裏面 No.${num}`,
    url: `${STARRAIL_IMG_BASE}StarRail_Custom_${num}.jpg`,
  };
});

// スタレ裏面1枚あたりの出やすさ(原神の裏面1枚を1としたときの倍率)
export const STARRAIL_WEIGHT = 0.5; // 2026-10-09に0.7→0.5(スタレの出る割合 約13%→約10%)

// 原神・スタレ両方の裏面(装備中の裏面の表示や、管理画面のサムネ表示用)
export const ALL_CARD_DESIGNS = [...GACHA_DESIGNS, ...STARRAIL_DESIGNS];

export function isStarRailDesign(id) {
  return typeof id === 'string' && id.startsWith('sr_');
}

// ガチャ1回分の抽選。スタレ解放済みなら、スタレ裏面もSTARRAIL_WEIGHTの重みで混ぜる
export function pickGachaDesign(starRailUnlocked) {
  const srTotal = starRailUnlocked ? STARRAIL_DESIGNS.length * STARRAIL_WEIGHT : 0;
  const r = Math.random() * (GACHA_DESIGNS.length + srTotal);
  if (r < GACHA_DESIGNS.length) return GACHA_DESIGNS[Math.floor(r)];
  return STARRAIL_DESIGNS[Math.min(STARRAIL_DESIGNS.length - 1, Math.floor((r - GACHA_DESIGNS.length) / STARRAIL_WEIGHT))];
}
