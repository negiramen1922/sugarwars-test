# SUGAR WARS — 開発ガイド（Claude Code 引き継ぎ）

あなたは、初心者〜初級者のユーザーが作っているブラウザゲーム **「SUGAR WARS」** の開発を引き継ぐ Claude Code です。

## 最優先ルール（YOU MUST）

- **会話はすべて日本語**で行う。
- 成果物は**単一ファイル `draft-showdown.html`**（このリポジトリ直下。base64スプライト埋め込みで約590KB）。**着手前に必ずこのファイルのロジック（末尾の単一 `<script>`）を読んで現状を把握する**。巨大な `SPRITE_DATA` のbase64行は読み飛ばしてよい。
- ファイルは**その場で直接編集**する（別ファイルに分割しない／1ファイル完結を維持）。
- 数値バランスは「あとで調整」が基本。**過度なチューニングはせず、まず動くものを優先**。
- 新ユニット・新カードは、既存の枠組み（`UNITS` 配列／`SPECIALS` マップ／各種 `*Step` 関数）に**素直に乗せる**。
- **新機能は実装前に「効果の方向性」をユーザーに確認**してから進める（候補a/b/cを提示するとよい）。
- **変更後は必ずヘッドレステスト（`node test.js`）を全パスさせてから**完成とする。テストが古くなったら新仕様に合わせて更新する。
- ユーザーへ渡すときは、簡潔な日本語の要約＋**どの数値（`UNITS` の項目や `CONFIG`/各定数）を変えれば調整できるか**を必ず添える。
- 子ども向けにも安全な、健全な内容を保つ。

## ゲーム概要

- 「お菓子の王国」をテーマにした **カードドラフト＋オートバトラー**。
- 対戦は **CPU対戦のみ**（PVPは未実装・ボタンは「準備中」で無効）。
- **コアループ**：ホーム →「バトル」or「編成」。編成で4枚デッキ `myDeck` を作る → バトルでは毎ラウンド「3枚提示→1枚選ぶ」→ 選んだユニットは毎ラウンド復活して増え続ける軍（上限30）に加わる → 縦型キャンバスでリアルタイム自動戦闘（自分＝下/青、敵＝上/赤）→ 負けるとライフ−1（初期3）→ 先に0で敗北。CPUも自分のランダム4枚デッキで同じ仕組み。

## 現在のロスター（`UNITS` 配列・全13種）

| key | 名前 | tier | count | atk | hp | speed | 特徴 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| daifuku | 大福サムライ | -1 | 1 | 20 | 130 | 60 | 居合チャージ→抜刀タックル（`chargerStep`） |
| cookie | クッキーアーミー | 0 | 5 | 14 | 50 | 115 | flock=同種が多いほど攻撃UP |
| slime | ゼリースライム | 0.5 | 3 | 12 | 55 | 90 | 強化カードで融合／倒れると分裂 |
| bomb | ポップコーンTNT | 1 | 2 | 0 | 55 | 128 | 自爆（導火0.5s・HP無関係・死亡時も爆発） |
| soda | ランニングソーダ | 1 | 2 | 0 | 50 | 150 | 自爆＋炭酸沼（DoT＋移動速度低下） |
| choco | チョコレートナイト | 2 | 2 | 24 | 260 | 66 | 超硬タンク前衛 |
| pancake | パンケーキキング | 2.5 | 1 | 22 | 150 | 58 | 約10秒で進化→3段＋HP増＋ジャンプ衝撃波 |
| donut | バキュームドーナッツ | 1.5 | 1 | 6 | 430 | 50 | 正面の敵を吸引する鈍足タンク（`vacuumStep`） |
| bakery | ジンジャーベーカリー | 3.2 | 1 | 0 | 230 | 0 | 不動の生産工場。2秒ごとにginger3体（個体ごと最大7） |
| ginger | ジンジャーソルジャー | 0 | 1 | 10 | 32 | 112 | ベーカリー召喚専用（`summonOnly`） |
| shoe | シュークリームアーチャー | 3 | 2 | 21 | 72 | 64 | 後衛射手 |
| ghost | わたあめゴースト | 3.5 | 3 | 16 | 44 | 95 | 開幕に敵後方へワープ |
| cannon | キャンディキャノン | 4 | 1 | 0 | 140 | 0 | 不動の全域誘導AoE迫撃（手前の敵を優先） |

隊列 `arrangeFormation` は **tier が小さいほど前列、大きいほど後方**。

## 主要定数（`CONFIG` とトップレベル定数）

| 定数 | 値 | 説明 |
| --- | --- | --- |
| `startLives` | 3 | 初期ライフ |
| `deckSize` | 4 | 編成枠 |
| `offerPerPick` | 3 | 1ピックの提示枚数 |
| `picksBase` | 3 | 通常ピック回数 |
| `picksComeback` | 4 | 前回負けた側のピック回数（逆転） |
| `picksAfterWin` | 3 | 前回勝った側（=通常） |
| `armyCap` | 30 | 軍の上限 |
| `timeLimit` | 24 | 1戦の制限秒 |
| `X2_MIN` | 3 | この数以上いるキャラにX2カードが出る |
| `SPECIAL_OFFER_CHANCE` | 0.3 | 強化カード(融合/X2)が枠に出る確率 |
| `FOE_X2_CHANCE` | 0.4 | CPUがX2を使う確率 |
| `X2_BOARD_CAP` | 40 | X2で増やせる盤面上限 |

キャラ個別の調整値は各 `UNITS` 行（atk/hp/speed/blast/puddle*/evo*/shock*/spawn* など）。

## 強化カード・特殊システム

- **スライム融合**（`SPECIALS.up_slime`）：未融合スライム3体以上で出現。3体ずつ巨大化、倒れると3体に分裂。`state.youMerges` で永続。
- **X2カード**（各キャラ `x2_<key>` を自動生成）：対象キャラが3体以上で専用カードが出現。選ぶとそのキャラを今いる数だけ倍に増殖。`state.youX2` で永続。スライムは除外。
- **逆転ボーナス（敗者先行）**：負けた側は4回ピック、勝った側は3回。**敗者の+1枚は最初の選択で単独で行い、その間は相手が待機**（`picksFor()` と `maybeRevealFoe()`、`state.playerExtra`）。
- 敵（CPU）も融合・X2・逆転ボーナスを確率で使う（パリティ）。

## アーキテクチャ（単一 `<script>` 内の主な関数）

- **データ/描画**：`CONFIG` / `UNITS` / `UNIT_BY_KEY` / `SPECIALS`（X2は自動生成）/ `iconHTML`（カード用・スライム/ソーダは味方色）/ `SPRITE_DATA`(base64) / `SPRITES`(Image) / `spriteFor`（盤面用スプライト解決）/ `render` / `loop`。
- **戦闘エンジン**：`createWorld` / `stepWorld(world,dt)`（phase=muster|battle|outro。毎フレームshuffleで左右バイアス除去）/ `nearestEnemy` / `applyHit`（ノックバックは重量耐性＋上限＋無効時間。吸引中/起爆中は無反動）/ `killUnit`（爆発・スライム分裂・炭酸沼発生を一本化）。
- **専用挙動**：`chargerStep`(大福) / `artilleryStep`(キャノン) / `vacuumStep`(ドーナッツ) / `spawnerStep`(ベーカリー：`spawnerId` で個体ごとに独立した召喚枠) / `evolvePancake`・`evolvedStep`(パンケーキ進化＋ジャンプ衝撃波) / ワープ(ゴースト) / 炭酸沼は `world.puddles` を `stepWorld` で毎フレーム処理（DoT＋`slowMul`減速）。
- **ドラフト/演出**：`beginDraft` / `nextPick` / `renderPickOffer` / `pickCardAnimated`（裏表フリップ）→ `pickCard` / `revealFoePick` / `aiPicks`（貪欲スコア）/ `lockAndFight`。
- **隊列**：`arrangeFormation`（tierでグループ化し後方アンカーで整列）/ `centerMergedSlimes`。
- **X2**：`doubleUnitsOnBoard` / `applyX2Replay` / `eligibleX2Specials` / `cloneFighter`。
- **決着**：`beginOutro` / `outroStep`（溶けて砂糖に）。

## スプライト（立ち絵）

- 陣営で出し分けるキャラ：**スライム**（`slime_blue/red` ＋ `_big`）と**ソーダ**（`soda_blue`=味方/`soda_red`=敵）。`spriteFor()` で解決。
- パンケーキは進化前 `pancake`／進化後 `pancake_evo` を `u.evolved` で切替。
- 立ち絵が無いキャラは絵文字フォールバック。

### スプライト加工の手順（同梱の `sprite_proc.py` を使用）

ユーザーのPNG（`Dola AI` 透かし入り・チェッカー背景）を透過処理して `SPRITE_DATA` に注入する。手順：四隅/外周から背景色検出＋薄いグレーキー(mx>205 & mx-mn<18) → 連結成分で「外周連結 or 一定サイズ以上」を透明化 → 右下の透かし除去 →（必要なら）足元の影除去(`strip_bottom_shadow=True`) → 小さな内部穴埋め → クロップ → 正方パディング → 128×128 NEAREST → base64。**注入前に必ず暗背景プレビュー（`_prev_*.png`）を目視確認**してから、`SPRITE_DATA` を json.loads→更新→json.dumps で書き戻す。`spriteFor`/`iconHTML` の分岐追加も忘れずに。
依存：`pip install pillow scipy numpy`。

## ヘッドレステスト（同梱の `test.js`）

`node test.js` で実行。HTMLから `<script>` を抽出し Node の `vm` でDOM/Image等をスタブした sandbox に流し込み、`globalThis.__API` 経由で関数を取り出して検証する。観点：隊列順・各ユニット挙動・ミラー対戦が約50%（左右対称）・詰まり/残骸ゼロ・ドラフト/編成フロー・新機能の単体検証。**コード変更のたびに全パスを確認**。仕様変更でテストが古くなったら新仕様に合わせて更新する。依存：Node.js。

## PVP（対人戦）土台 — 段階実装中

最終形は **親(host)=計算 / 子(guest)=表示** のホスト権威型。顔合わせ＋将来の自動マッチングは
**Firebase**、対戦データのやり取りは **WebRTC**（Firebaseはシグナリングに使う）を予定。

進行フェーズ：**F1=親/子分離（通信はローカル・ダミー）→ F2=Firebase+WebRTCで実接続 → F3=自動マッチング**。

### F1で入れたもの（`<script>` 末尾「9) PVP 土台」）

- `PVP_MSG`：親⇔子で流すメッセージ種別（HELLO/START/OFFER/PICK/SNAPSHOT/RESULT/GAMEOVER）。F2でこのままネット越しに流す。
- `createLoopbackPair()`：通信路の抽象（F1はメモリ内ループバック。送信時にJSON複製＝実通信を模す）。**F2でここをWebRTC/Firebaseに差し替える**。
- 敵コントローラ：`foeCtl`（既定 `makeCpuFoeController()`）。`deck()`＝相手デッキ、`picks(loadout,n)`＝各ラウンドの選択。
  PVPでは `makeRemoteFoeController()`（相手プレイヤーのデッキ／選択を `setDeck`/`pushPick` で供給）へ差し替える。
  `startGame()` と `beginDraft()` は敵をこのコントローラ経由で取得する（CPU挙動は不変）。
- `serializeWorld(world)` / `applySnapshot(snap, mirror)`：盤面の描画用スナップショット。
  ユニットは全フィールドがプリミティブ（参照なし）なので丸ごと複製可。`mirror=true`（子が親盤面を見るとき）で
  陣営(p↔e)とY座標を反転し、自分が常に下(青)に見えるようにする。
- テストは `test.js` の 43〜47（コントローラ／ループバック／スナップショット往復・ミラー／CPUフロー維持）。

### F2以降の残作業（要・実機）

- Firebaseプロジェクト作成（ユーザー操作）＋設定キー／セキュリティルール。
- ドラフトを「親が抽選→子へOFFER→子のPICKを待つ」非同期フローに拡張（現状の同期ドラフトを分岐）。
- 戦闘ループで親が `serializeWorld` を一定間隔で送信し、子は `applySnapshot(…, true)` を描画。
- 切断・再接続・タイムアウト処理。**2台＋Firebaseの実機テストはこのリポジトリ環境ではできない**ため手元確認が必須。

## 次の候補タスク（未着手・要相談）

- PVP **F2**（Firebase+WebRTCで実接続）→ **F3**（自動マッチング）。
- 各キャラの固有強化（X2以外の派手な効果）の追加。
- flock の効果検証・他キャラへの相乗効果。
- 立ち絵の追加・差し替え（ユーザーがPNGを置いて「`SPRITE_DATA` の○○を差し替えて」と依頼）。
