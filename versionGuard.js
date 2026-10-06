// versionGuard.js
// アイテムやUPが動く操作(出品・ガチャ・メール受け取り)の前に、このタブが最新版かを確かめる。
// 開きっぱなしの古いタブは、修正を公開しても古いプログラムのまま動き続ける(2026-10-02、
// 同時出品数の上限を入れた後も古いタブから大量出品が続いた)。auto-reload.js はタブが裏から
// 表に戻った時しか確認しないため、操作の直前にも version.json を見て、古ければ止めて読み込み直す。
// version.json は GitHub Pages の普通のファイルなので、Firestore の読み取りは増えない。
// 確認に失敗したとき(通信エラーなど)は操作を止めない。
import { store } from './userData.js?v=4';

const MSG = {
  ja: '新しいバージョンが公開されています。ページを読み込み直してから、もう一度操作してください。',
  en: 'A new version is available. The page will reload — please try again after it reloads.',
};

export async function ensureLatestVersion() {
  try {
    const meta = document.querySelector('meta[name="uko-reload-version"]');
    const current = parseInt(meta?.getAttribute('content'), 10) || 0;
    const res = await fetch(new URL('version.json', location.href).href, { cache: 'no-store' });
    if (!res.ok) return true;
    const latest = parseInt((await res.json()).reloadVersion, 10) || 0;
    if (latest <= current) return true;
    alert(MSG[store.lang === 'en' ? 'en' : 'ja']);
    location.reload();
    return false;
  } catch (e) {
    console.error('[versionGuard] version check failed', e);
    return true;
  }
}
