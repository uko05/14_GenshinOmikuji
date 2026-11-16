# -*- coding: utf-8 -*-
"""
裏面デザインの追加を自動でやるスクリプト(2026-10-03。2026-11-16 スタレの裏面にも対応)。

使い方: 99_SharedImage/01_Genshin/Omikuji/GachaBacks/ に back_Custom_536.jpg、
StarRailBacks/ に StarRail_Custom_116.jpg のように連番で画像を置いてから、
E:/20_GitHub/裏面デザイン追加.bat をダブルクリックする(または python tools/add_card_backs.py)。

やること(原神・スタレの両方を見る):
  1. 新しい画像のサムネ(thumbs/)を作り、99_SharedImage にコミットしてプッシュ
  2. 14_GenshinOmikuji/gachaBacks.js の枚数(GACHA_DESIGNS / STARRAIL_DESIGNS)を、画像の最大番号に合わせる
     新着裏面の帯(RECENT_BACKS)にも追加した日を記録する
  3. キャッシュ対策の番号(xxx.js?v=N)を、変わったファイルから読み込み元へ連鎖的に上げる
     (gachaBacks.js → feed.js / script.js → auction.js → index.html の script.js?v=)
  4. サイトのバージョン表示(v4.xx)を1つ上げて、コミットしてプッシュ
  5. jsDelivr のキャッシュを消して、新しい画像がすぐ表示されるようにする
--dry-run を付けると、変更内容を表示するだけで何も書き換えない。
"""
import datetime, os, re, subprocess, sys, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OMIKUJI = os.path.join(ROOT, '14_GenshinOmikuji')
SHARED = os.path.join(ROOT, '99_SharedImage')
DRY = '--dry-run' in sys.argv
CO_AUTHOR = os.environ.get('CARD_BACKS_COAUTHOR', '')  # コミットメッセージの末尾に付ける行(任意)

# 裏面の種類(2026-11-16: スタレの裏面にも対応)
KINDS = [
    dict(name='原神', label='裏面デザイン', dir='01_Genshin/Omikuji/GachaBacks', file='back_Custom_{n:03d}.jpg',
         pat=r'back_Custom_(\d{3,})\.jpg', array='GACHA_DESIGNS', comment='back_Custom_001〜', rid='custom_{n:03d}'),
    dict(name='スタレ', label='スタレ裏面', dir='01_Genshin/Omikuji/StarRailBacks', file='StarRail_Custom_{n:03d}.jpg',
         pat=r'StarRail_Custom_(\d{3,})\.jpg', array='STARRAIL_DESIGNS', comment='StarRail_Custom_001〜', rid='sr_{n:03d}'),
]


def git(repo, *args, check=True):
    r = subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True, encoding='utf-8')
    if check and r.returncode != 0:
        raise SystemExit(f'git {" ".join(args)} に失敗しました:\n{r.stderr}')
    return r.stdout.strip()


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text):
    if DRY:
        return
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def make_thumbs(kind, first, top):
    """新着裏面の帯で使う小さいサムネ(横240px、1枚30KBほど)を thumbs/ に作る"""
    from PIL import Image
    d = os.path.join(SHARED, *kind['dir'].split('/'))
    os.makedirs(os.path.join(d, 'thumbs'), exist_ok=True)
    for n in range(first, top + 1):
        f = kind['file'].format(n=n)
        im = Image.open(os.path.join(d, f))
        im.thumbnail((240, 9999))
        im.convert('RGB').save(os.path.join(d, 'thumbs', f), 'JPEG', quality=82, optimize=True, progressive=True)


def main():
    print('原神おみくじ: 裏面デザインを追加します(原神・スタレの両方)')
    print('（原神は 99_SharedImage/01_Genshin/Omikuji/GachaBacks に back_Custom_XXX.jpg、')
    print('  スタレは 99_SharedImage/01_Genshin/Omikuji/StarRailBacks に StarRail_Custom_XXX.jpg を、連番で置いてから実行してください）')
    print()
    gacha_path = os.path.join(OMIKUJI, 'gachaBacks.js')
    gacha = read(gacha_path)
    added = []          # [(kind, first, top)]
    new_files = []
    for kind in KINDS:
        d = os.path.join(SHARED, *kind['dir'].split('/'))
        # ---- 画像の番号を数える ----
        nums = sorted(int(m.group(1)) for f in os.listdir(d) if (m := re.fullmatch(kind['pat'], f)))
        if not nums:
            raise SystemExit(f'{kind["name"]}の画像が見つかりません: ' + d)
        top = nums[-1]
        missing = sorted(set(range(1, top + 1)) - set(nums))
        if missing:
            raise SystemExit(f'{kind["name"]}の番号が抜けています: {missing[:20]} … 連番になるように置いてください。')
        m = re.search(r'export const ' + kind['array'] + r' = Array\.from\(\{ length: (\d+) \}', gacha)
        if not m:
            raise SystemExit(f'gachaBacks.js に {kind["array"]} が見つかりません')
        cur = int(m.group(1))
        if top < cur:
            raise SystemExit(f'{kind["name"]}の画像が {top} 枚しかありませんが、サイトは {cur} 枚になっています。画像が消えていないか確認してください。')
        if top == cur:
            print(f'{kind["name"]}: 追加された画像はありません(今は {cur} 枚)。')
            continue
        first = cur + 1
        print(f'{kind["name"]}: {kind["label"]} No.{first:03d}' + (f'〜{top:03d}' if top > first else '') +
              f' を追加します({cur} 枚 → {top} 枚)')
        # ---- 枚数を書き換える ----
        gacha = gacha[:m.start(1)] + str(top) + gacha[m.end(1):]
        gacha = re.sub(re.escape(kind['comment']) + r'\d+', f'{kind["comment"]}{top}', gacha, count=1)
        if not DRY:
            make_thumbs(kind, first, top)
            print(f'  {kind["name"]}: サムネ(thumbs/)を作りました')
        new_files += [f'{kind["dir"]}/{kind["file"].format(n=n)}' for n in range(first, top + 1)]
        new_files += [f'{kind["dir"]}/thumbs/{kind["file"].format(n=n)}' for n in range(first, top + 1)]
        added.append((kind, first, top))
    if not added:
        return
    label = '・'.join(f'{k["label"]} No.{a:03d}' + (f'〜{b:03d}' if b > a else '') for k, a, b in added)

    # ---- 99_SharedImage に画像をコミット・プッシュ ----
    if not DRY:
        pending = git(SHARED, 'status', '--porcelain', '--', *new_files)
        if pending:
            print('  99_SharedImage: 画像をコミットしてプッシュします')
            git(SHARED, 'add', '--', *new_files)
            git(SHARED, 'commit', '-m', f'{label} を追加' + (f'\n\n{CO_AUTHOR}' if CO_AUTHOR else ''))
            git(SHARED, 'push', 'origin', 'HEAD')
        else:
            print('  99_SharedImage: 画像はすでにコミット済みです')

    # 新着裏面の帯用に、追加した日を RECENT_BACKS の先頭へ足す(新しい順。60日より前のものは消す)
    m = re.search(r'(export const RECENT_BACKS = \[\r?\n)(.*?)(\];)', gacha, re.S)
    if m:
        nl = '\r\n' if '\r\n' in m.group(1) else '\n'
        today = datetime.date.today().isoformat()
        new_rows = [f"  ['{k['rid'].format(n=n)}', '{today}'],{nl}" for k, a, b in added for n in range(b, a - 1, -1)]
        cutoff = (datetime.date.today() - datetime.timedelta(days=60)).isoformat()
        old_rows = [r for r in m.group(2).splitlines(keepends=True)
                    if (dd := re.search(r"'(\d{4}-\d{2}-\d{2})'", r)) and dd.group(1) >= cutoff]
        gacha = gacha[:m.start(2)] + ''.join(new_rows + old_rows) + gacha[m.end(2):]
        print(f'  gachaBacks.js: 新着裏面の一覧に {today} 追加として記録しました')
    changed = {'gachaBacks.js': gacha}

    # ---- ?v= を連鎖的に上げる ----
    files = [f for f in os.listdir(OMIKUJI) if f.endswith(('.js', '.html'))]
    texts = {f: changed.get(f, read(os.path.join(OMIKUJI, f))) for f in files}
    queue = ['gachaBacks.js']
    bumped = set()
    while queue:
        target = queue.pop()
        pat = re.compile(re.escape(target) + r'\?v=(\d+)')
        for f in files:
            if f == target or (f, target) in bumped:
                continue
            new, n = pat.subn(lambda mm: f'{target}?v={int(mm.group(1)) + 1}', texts[f])
            if n:
                bumped.add((f, target))
                texts[f] = new
                print(f'  {f}: {target} の読み込み番号を上げました')
                if f not in changed:
                    queue.append(f)
                changed[f] = new

    # ---- サイトのバージョン表示 ----
    m = re.search(r'id="site-version" class="site-version">v(\d+)\.(\d+)<', texts['index.html'])
    ver = f'v{m.group(1)}.{int(m.group(2)) + 1}'
    texts['index.html'] = texts['index.html'].replace(m.group(0), f'id="site-version" class="site-version">{ver}<')
    changed['index.html'] = texts['index.html']
    print(f'  index.html: バージョンを {ver} にしました')

    for f, t in changed.items():
        write(os.path.join(OMIKUJI, f), t)

    if DRY:
        print('(--dry-run なので書き換えていません)')
        return
    git(OMIKUJI, 'add', '--', *changed.keys(), 'tools/add_card_backs.py')
    git(OMIKUJI, 'commit', '-m', f'{label} を追加 ({ver})' + (f'\n\n{CO_AUTHOR}' if CO_AUTHOR else ''))
    git(OMIKUJI, 'push', 'origin', 'HEAD')
    print(f'  14_GenshinOmikuji: コミットしてプッシュしました ({ver})')

    # ---- jsDelivr のキャッシュを消す(新しい画像がすぐ出るように) ----
    for rel in new_files:
        try:
            urllib.request.urlopen(f'https://purge.jsdelivr.net/gh/uko05/99_SharedImage@main/{rel}', timeout=20).read()
        except Exception as e:  # キャッシュ消しに失敗しても、しばらくすれば自然に反映される
            print(f'  (キャッシュ消しに失敗: {rel} {e})')
    print('完了しました。数分後にサイトへ反映されます。')


if __name__ == '__main__':
    main()
