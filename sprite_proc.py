import numpy as np
from PIL import Image
from scipy import ndimage

def process_sprite(path, out_size=128, big_frac=0.02, hole_frac=0.0008, strip_bottom_shadow=False):
    im = Image.open(path).convert('RGB')
    a = np.array(im).astype(np.int16)
    H, W = a.shape[:2]
    mx = a.max(axis=2); mn = a.min(axis=2)

    # --- 背景候補：薄いグレーキー(mx>205 & mx-mn<18) ＋ 四隅/外周のチェッカー色に近い画素 ---
    bg = (mx > 205) & ((mx - mn) < 18)
    # 外周ストリップからチェッカーの代表色をサンプリング
    strip = np.concatenate([
        a[0:6, :, :].reshape(-1, 3), a[H-6:H, :, :].reshape(-1, 3),
        a[:, 0:6, :].reshape(-1, 3), a[:, W-6:W, :].reshape(-1, 3)])
    # 代表色（最頻に近い）を数点取る
    samp = strip[::97]
    uniq = {}
    for c in samp:
        k = (c[0]//8, c[1]//8, c[2]//8)
        uniq[k] = uniq.get(k, 0) + 1
    tops = sorted(uniq.items(), key=lambda x: -x[1])[:4]
    for (k, _) in tops:
        cc = np.array([k[0]*8+4, k[1]*8+4, k[2]*8+4])
        d = np.abs(a - cc.reshape(1, 1, 3)).sum(axis=2)
        bg |= (d < 26)

    # --- 連結成分：外周連結 or 一定サイズ以上の背景成分だけ透明化 ---
    lbl, n = ndimage.label(bg)
    transp = np.zeros((H, W), bool)
    border = set(np.unique(np.concatenate([lbl[0, :], lbl[-1, :], lbl[:, 0], lbl[:, -1]])))
    border.discard(0)
    if n > 0:
        sizes = ndimage.sum(np.ones_like(lbl, dtype=np.int64), lbl, index=np.arange(1, n+1))
        big = big_frac * H * W
        keep_bg = set(int(i) for i in np.where(sizes > big)[0] + 1) | set(int(b) for b in border)
        mask_keep = np.zeros(n+1, bool)
        for i in keep_bg:
            mask_keep[i] = True
        transp = mask_keep[lbl]

    fg = ~transp

    # --- 右下の "Dola AI" 透かし：右下領域の小さめの灰色っぽい明るい成分を除去 ---
    bright = fg & (mx > 150) & ((mx - mn) < 55)
    rb = np.zeros((H, W), bool); rb[int(H*0.78):, int(W*0.52):] = True
    cand = bright & rb
    lb2, n2 = ndimage.label(cand)
    if n2 > 0:
        sz2 = ndimage.sum(np.ones_like(lb2, dtype=np.int64), lb2, index=np.arange(1, n2+1))
        for i in range(1, n2+1):
            if sz2[i-1] < 0.012*H*W:   # 透かしは小さい（大面積の雪などは残す）
                fg[lb2 == i] = False

    # --- （オプション）足元のドロップシャドウを除去：下部の灰色っぽい中間調を消す（白い足は残す） ---
    if strip_bottom_shadow:
        ys2, xs2 = np.where(fg)
        if len(ys2):
            ymin, ymax = ys2.min(), ys2.max()
            ythr = ymin + 0.80*(ymax-ymin)
            shadow = fg & (mx >= 120) & (mx <= 212) & ((mx - mn) < 30)  # 中間調の灰色（白い足>212は残す）
            region = np.zeros((H, W), bool); region[int(ythr):, :] = True
            fg[shadow & region] = False
            # 取り残しの孤立小片も掃除
            lbS, nS = ndimage.label(fg)
            if nS > 0:
                szS = ndimage.sum(np.ones_like(lbS, dtype=np.int64), lbS, index=np.arange(1, nS+1))
                keepLab = int(np.argmax(szS)) + 1   # 最大成分（本体）
                big2 = 0.003*H*W
                for i in range(1, nS+1):
                    cy = np.where(lbS == i)[0]
                    if i != keepLab and szS[i-1] < big2 and cy.mean() > ythr:
                        fg[lbS == i] = False

    # --- 小さな内部透明だけ穴埋め（アンチエイリアスの隙間など） ---
    filled = ndimage.binary_fill_holes(fg)
    holes = filled & ~fg
    lh, nh = ndimage.label(holes)
    if nh > 0:
        szh = ndimage.sum(np.ones_like(lh, dtype=np.int64), lh, index=np.arange(1, nh+1))
        small = hole_frac * H * W
        for i in range(1, nh+1):
            if szh[i-1] < small:
                fg[lh == i] = True

    alpha = np.where(fg, 255, 0).astype(np.uint8)
    rgba = np.dstack([np.array(im).astype(np.uint8), alpha])

    # --- 内容でクロップ ---
    ys, xs = np.where(alpha > 0)
    if len(ys) == 0:
        raise RuntimeError('empty after bg removal: ' + path)
    y0, y1, x0, x1 = ys.min(), ys.max()+1, xs.min(), xs.max()+1
    crop = rgba[y0:y1, x0:x1]

    # --- 正方パディング（中央） ---
    ch, cw = crop.shape[:2]
    side = max(ch, cw)
    pad = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side-ch)//2, (side-cw)//2
    pad[oy:oy+ch, ox:ox+cw] = crop

    # --- 128×128 NEAREST ---
    out = Image.fromarray(pad, 'RGBA').resize((out_size, out_size), Image.NEAREST)
    return out

def preview(img, path, bg=(34,30,46)):
    # 暗背景に合成して拡大プレビュー
    base = Image.new('RGBA', img.size, bg + (255,))
    comp = Image.alpha_composite(base, img)
    comp = comp.convert('RGB').resize((img.size[0]*3, img.size[1]*3), Image.NEAREST)
    comp.save(path)

if __name__ == '__main__':
    jobs = [
        ('ゼリー兵士ドット絵__22_.png', 'bakery'),
        ('ゼリー兵士ドット絵__23_.png', 'pancake'),
        ('ゼリー兵士ドット絵__24_.png', 'pancake_evo'),
    ]
    import os
    src = '/mnt/user-data/uploads/'
    for fn, key in jobs:
        out = process_sprite(src+fn)
        out.save(f'/home/claude/work/_{key}.png')
        preview(out, f'/home/claude/work/_prev_{key}.png')
        print('done', key, out.size)
