// gachaBacks.js
// 裏面デザインガチャの画像一覧(99_SharedImage/01_Genshin/Omikuji/GachaBacksに配置、back_Custom_001〜206)
export const GACHA_IMG_BASE = 'https://cdn.jsdelivr.net/gh/uko05/99_SharedImage@main/01_Genshin/Omikuji/GachaBacks/';

export const GACHA_DESIGNS = Array.from({ length: 206 }, (_, i) => {
  const num = String(i + 1).padStart(3, '0');
  return {
    id: `custom_${num}`,
    name: `裏面デザイン No.${num}`,
    url: `${GACHA_IMG_BASE}back_Custom_${num}.png`,
  };
});
