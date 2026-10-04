# -*- coding: utf-8 -*-
"""
裏面デザインの追加を自動でやるスクリプト(2026-10-03)。

使い方: 99_SharedImage/01_Genshin/Omikuji/GachaBacks/ に back_Custom_536.jpg のように
連番で画像を置いてから、E:/20_GitHub/裏面デザイン追加.bat をダブルクリックする
(または python tools/add_card_backs.py)。

やること:
  1. 99_SharedImage の新しい画像をコミットしてプッシュ
  2. 14_GenshinOmikuji/gachaBacks.js の枚数を、画像の最大番号に合わせる
  3. キャッシュ対策の番号(xxx.js?v=N)を、変わったファイルから読み込み元へ連鎖的に上げる
     (gachaBacks.js → feed.js / script.js → auction.js → index.html の script.js?v=)
  4. サイトのバージョン表示(v4.xx)を1つ上げて、コミットしてプッシュ
  5. jsDelivr のキャッシュを消して、新しい画像がすぐ表示されるようにする
--dry-run を付けると、変更内容を表示するだけで何も書き換えない。
"""
import os, re, subprocess, sys, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OMIKUJI = os.path.join(ROOT, '14_GenshinOmikuji')
SHARED = os.path.join(ROOT, '99_SharedImage')
BACKS_DIR_REL = '01_Genshin/Omikuji/GachaBacks'
BACKS_DIR = os.path.join(SHARED, *BACKS_DIR_REL.split('/'))
DRY = '--dry-run' in sys.argv
CO_AUTHOR = os.environ.get('CARD_BACKS_COAUTHOR', '')  # コミットメッセージの末尾に付ける行(任意)


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


def main():
    print('原神おみくじ: 裏面デザインを追加します')
    print('（99_SharedImage/01_Genshin/Omikuji/GachaBacks に back_Custom_XXX.jpg を連番で置いてから実行してください）')
    print()
    # ---- 1. 画像の番号を数える ----
    nums = sorted(int(m.group(1)) for f in os.listdir(BACKS_DIR) if (m := re.fullmatch(r'back_Custom_(\d{3,})\.jpg', f)))
    if not nums:
        raise SystemExit('画像が見つかりません: ' + BACKS_DIR)
    top = nums[-1]
    missing = sorted(set(range(1, top + 1)) - set(nums))
    if missing:
        raise SystemExit(f'番号が抜けています: {missing[:20]} … 連番になるように置いてください。')

    gacha_path = os.path.join(OMIKUJI, 'gachaBacks.js')
    gacha = read(gacha_path)
    cur = int(re.search(r'Array\.from\(\{ length: (\d+) \}', gacha).group(1))
    if top < cur:
        raise SystemExit(f'画像が {top} 枚しかありませんが、サイトは {cur} 枚になっています。画像が消えていないか確認してください。')
    if top == cur:
        print(f'追加された画像はありません(今は {cur} 枚)。')
        return
    first = cur + 1
    label = f'No.{first:03d}' if first == top else f'No.{first:03d}〜{top:03d}'
    print(f'裏面デザイン {label} を追加します({cur} 枚 → {top} 枚)')

    # ---- 2. 99_SharedImage に画像をコミット・プッシュ ----
    new_files = [f'{BACKS_DIR_REL}/back_Custom_{n:03d}.jpg' for n in range(first, top + 1)]
    pending = git(SHARED, 'status', '--porcelain', '--', *new_files)
    if pending:
        print('  99_SharedImage: 画像をコミットしてプッシュします')
        if not DRY:
            git(SHARED, 'add', '--', *new_files)
            git(SHARED, 'commit', '-m', f'裏面デザイン {label} を追加' + (f'\n\n{CO_AUTHOR}' if CO_AUTHOR else ''))
            git(SHARED, 'push', 'origin', 'HEAD')
    else:
        print('  99_SharedImage: 画像はすでにコミット済みです')

    # ---- 3. gachaBacks.js の枚数 ----
    gacha = gacha.replace(f'{{ length: {cur} }}', f'{{ length: {top} }}', 1)
    gacha = re.sub(r'back_Custom_001〜\d+', f'back_Custom_001〜{top}', gacha, count=1)
    changed = {'gachaBacks.js': gacha}

    # ---- 4. ?v= を連鎖的に上げる ----
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
            new, n = pat.subn(lambda m: f'{target}?v={int(m.group(1)) + 1}', texts[f])
            if n:
                bumped.add((f, target))
                texts[f] = new
                print(f'  {f}: {target} の読み込み番号を上げました')
                if f not in changed:
                    queue.append(f)
                changed[f] = new

    # ---- 5. サイトのバージョン表示 ----
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
    git(OMIKUJI, 'add', '--', *changed.keys())
    git(OMIKUJI, 'commit', '-m', f'裏面デザイン {label} を追加 ({ver})' + (f'\n\n{CO_AUTHOR}' if CO_AUTHOR else ''))
    git(OMIKUJI, 'push', 'origin', 'HEAD')
    print(f'  14_GenshinOmikuji: コミットしてプッシュしました ({ver})')

    # ---- 6. jsDelivr のキャッシュを消す(新しい画像がすぐ出るように) ----
    for rel in new_files:
        try:
            urllib.request.urlopen(f'https://purge.jsdelivr.net/gh/uko05/99_SharedImage@main/{rel}', timeout=20).read()
        except Exception as e:  # キャッシュ消しに失敗しても、しばらくすれば自然に反映される
            print(f'  (キャッシュ消しに失敗: {rel} {e})')
    print('完了しました。数分後にサイトへ反映されます。')


if __name__ == '__main__':
    main()
