# SUGAR WARS — 開発ガイド（Claude Code 引き継ぎ）

あなたは、初心者〜初級者のユーザーが作っているブラウザゲーム **「SUGAR WARS」** の開発を引き継ぐ Claude Code です。

## 最優先ルール（YOU MUST）

- **会話はすべて日本語**で行う。
- 成果物は**単一ファイル `index.html`**（このリポジトリ直下。base64スプライト埋め込みで大きめ）。**着手前に必ずこのファイルのロジック（末尾の単一 `<script>`）を読んで現状を把握する**。巨大な `SPRITE_DATA` のbase64行は読み飛ばしてよい。
  - ゲーム本体は引き続き `index.html` 1ファイル完結。**PWA用の同梱ファイル**（`manifest.webmanifest` / `sw.js` / `icon-192.png` / `icon-512.png` / `apple-touch-icon.png`）だけは別ファイル（仕様上インライン不可）。Service Workerはバージョンを上げるとき `sw.js` の `CACHE` 名を変える。アイコンは元絵 `icon-src.png`（ドット絵ポップコーン）から Chromium で生成（PIL不要・`image-rendering:pixelated` でくっきり拡大→192/512/apple180）。差し替えるときは `icon-src.png` を置換して再生成。
- ファイルは**その場で直接編集**する（別ファイルに分割しない／1ファイル完結を維持）。
- 数値バランスは「あとで調整」が基本。**過度なチューニングはせず、まず動くものを優先**。
- 新ユニット・新カードは、既存の枠組み（`UNITS` 配列／`SPECIALS` マップ／各種 `*Step` 関数）に**素直に乗せる**。
- **新機能は実装前に「効果の方向性」をユーザーに確認**してから進める（候補a/b/cを提示するとよい）。
- **変更後は必ずヘッドレステスト（`node test.js`）を全パスさせてから**完成とする。テストが古くなったら新仕様に合わせて更新する。
- ユーザーへ渡すときは、簡潔な日本語の要約＋**どの数値（`UNITS` の項目や `CONFIG`/各定数）を変えれば調整できるか**を必ず添える。
- 子ども向けにも安全な、健全な内容を保つ。

## ゲーム概要

- 「お菓子の王国」をテーマにした **カードドラフト＋オートバトラー**。
- 対戦は **CPU対戦** と **オンラインPVP（Firebase+WebRTC・ホスト権威型／下記「PVP」章）**。PVPは強化カード・逆転ボーナスまで実装済み。
- **コアループ**：ホーム →「バトル」or「編成」。編成で4枚デッキ `myDeck` を作る → バトルでは毎ラウンド「3枚提示→1枚選ぶ」→ 選んだユニットは毎ラウンド復活して増え続ける軍（上限30）に加わる → 縦型キャンバスでリアルタイム自動戦闘（自分＝下/青、敵＝上/赤）→ 負けるとライフ−1（初期3）→ 先に0で敗北。CPUも自分のランダム4枚デッキで同じ仕組み。

## 現在のロスター（`UNITS` 配列・全15種）

| key | 名前 | tier | count | atk | hp | speed | 特徴 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| daifuku | 大福サムライ | -1.5 | 1 | 22 | 160 | 60 | 居合－竹串（`chargerStep`）＝遠いと力をため強い踏み込みで斬込み。突撃は範囲薙ぎ払い（dashDamage90/dashRange26）。強化「ちょんまげ大福」(`buff_daifuku`)＝居合の範囲(+50%)・威力(+80%)メイン＋HP/攻撃(+30%)・巨大化なし |
| cookie | クッキーアーミー | -0.5 | 5 | 14 | 50 | 115 | 固有ギミックなし＝素で手数が多い前衛（cd0.35）。強化「クッキーパーティー」(`applyCookieParty`)＝近くの味方クッキー数で段階的に攻撃＆速度UP（`u.party`でサングラス立ち絵`cookie_party_*`）。※旧flockは撤廃 |
| slime | ゼリースライム | 0.5 | 3 | 12 | 55 | 90 | 強化カードで融合／倒れると分裂 |
| bomb | ポップコーンTNT | -3 | 2 | 0 | 55 | 128 | 自爆（導火0.5s・HP無関係・死亡時も爆発・blast100/blastR60） |
| soda | ランニングソーダ | -2 | 2 | 0 | 50 | 150 | 自爆＋炭酸沼（blast10/blastR50・沼puddleR60/5dps・移動低下） |
| choco | チョコレートナイト | 0 | 2 | 20 | 200 | 66 | 超硬タンク前衛（ビター装甲でHP280/atk30） |
| pancake | パンケーキキング | 1 | 1 | 22 | 150 | 50 | 約10秒で進化→HP3.5倍(525)＋移動50→`evoSpeed`60＋ジャンプ衝撃波(shockDmg52/shockR88/evoCd1.8) |
| donut | バキュームドーナッツ | -1 | 1 | 6 | 430 | 50 | 正面の敵を吸い寄せる鈍足タンク（`vacuumStep`）。`heavy`＋`kbResist`＝殴られても後退しない高ノックバック耐性（`applyHit`のKBを無効）で群れに押し込まれない。強化「鉄壁ドーナッツ」(`applyDonutWall`)＝HP+90%(`DONUT_HP`0.9→817)＋巨大化。※CPUの評価(`aiPicks`)はHPを`AI_HP_SOFT`(200)超で`AI_HP_FRAC`(0.3)倍に逓減＝超硬タンクをHPだけで最優先しない |
| bakery | ジンジャーベーカリー | 2 | 1 | 0 | 230 | 0 | 不動の生産工場。2秒ごとに `BAKERY_SPAWN_PATTERN`(3→1→1)でginger生産（個体ごと最大`spawnCap`=30） |
| ginger | ジンジャーソルジャー | 0 | 1 | 10 | 25 | 112 | ベーカリー召喚専用（`summonOnly`） |
| shoe | シュークリームアーチャー | 1.5 | 4 | 14 | 44 | 64 | 後衛射手（4人・射程150） |
| ghost | わたあめゴースト | 3.5 | 3 | 16 | 44 | 95 | 開幕少し待って敵後方へワープ（warpDelay1.5・無敵中は狙われない） |
| cannon | キャンディキャノン | 3 | 1 | 0 | 140 | 0 | 不動の全域誘導AoE迫撃（手前の敵を優先・`mortar`=90/`cd`=4.2・爆発範囲 `splash`=35）。強化「ぱちぱちキャンディ」=着弾で小爆発を撒く |
| icewiz | アイスクリームウィザード | 2.5 | 1 | 20 | 70 | 60 | 後衛魔導士（`cd`=1.0）。小範囲の氷弾（`ranged`＋`splash`=32・`range`=190）を撃ち、範囲内の敵に近い順で多段減衰ダメージ（`ICEWIZ_DECAY`=[1,0.65,0.35]＝atk20で20/13/7）＋鈍化（`slowHit`=0.5＝50%/`slowDur`=0.5秒）を付与。鈍化は `u.chillT`/`chillAmt` で管理し `slowMul` に反映。強化「ブリザード」(`applyIcewizBuff`)＝氷弾の範囲(`ICEWIZ_SPLASH_MUL`1.8)・攻撃力(`ICEWIZ_ATK`30)・鈍化時間(`ICEWIZ_SLOW_DUR`1.0秒)を強化（鈍化量は0.5据え置き） |
| macaron | シェルマカロン | -2.5 | 2 | 12 | 100 | 70 | 殻スピン（`shell`／`shellStep`）。強化「マカロンアーマー」=HP100→180(`MACARON_HP`0.8)。開幕は殻で突進し壁で反射しながら約4秒(`SHELL_SPIN_DUR`)暴れる→約2秒(`SHELL_STUN_DUR`)スタン→以降は通常戦闘。スピン中は体当たり(`atk`)＋被ダメ80%カット(`SHELL_DR`／`u.inShell`)、スタン(気絶)中は無防備でカットなし。`u.shellPhase`(spin/stun/normal)で挙動・立ち絵を切替 |

隊列 `arrangeFormation` は **tier が小さいほど前列、大きいほど後方**。現在の並び（前→後）＝bomb(-3)→macaron(-2.5)→soda(-2)→daifuku(-1.5)→donut(-1)→cookie(-0.5)→choco(0)→slime(0.5)→pancake(1)→shoe(1.5)→bakery(2)→icewiz(2.5)→cannon(3)→ghost(3.5)。tierは隊列のグループ化と描画にのみ使用（スコア/経済には非使用）。

新キャラは `UNITS` に `beta:true` を付けると、編成カードに「β」バッジ・キャラ詳細に「ベータ実装＝バランス調整中」の注記が出る（現在βキャラなし）。

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
- **X2カード**（各キャラ `x2_<key>` を自動生成）：対象キャラが3体以上（`X2_MIN`）で専用カードが出現。ただし**多すぎる種類（`X2_OFFER_CAP`=15体以上）には出ない**（増えすぎ防止）。選ぶとそのキャラを今いる数だけ倍に増殖。`state.youX2` で永続。スライムは除外。
- **逆転ボーナス（敗者先行）**：負けた側は4回ピック、勝った側は3回。**敗者の+1枚は最初の選択で単独で行い、その間は相手が待機**（`picksFor()` と `maybeRevealFoe()`、`state.playerExtra`）。
- **固有強化**（各キャラ1種・`apply*Buff`／フラグ系）：取得すると永続・毎ラウンド再適用（`applyFlagBuffs`/`reapplyEnhancements`）。例：ビター装甲(choco)・特盛り(shoe)・メガ炭酸沼(soda)・**ブリザード(icewiz＝氷弾の爆風拡大＋鈍足強化／`applyIcewizBuff`)** など。`eligibleSpecials`/`foeEnhanceCandidates` で資格判定、`pickCard`/`applyPvpSpecial` で適用。
- 敵（CPU）も融合・X2・逆転ボーナスを確率で使う（パリティ）。

## アーキテクチャ（単一 `<script>` 内の主な関数）

- **データ/描画**：`CONFIG` / `UNITS` / `UNIT_BY_KEY` / `SPECIALS`（X2は自動生成）/ `iconHTML`（カード用・スライム/ソーダは味方色）/ `SPRITE_DATA`(base64) / `SPRITES`(Image) / `spriteFor`（盤面用スプライト解決）/ `render` / `loop`。
- **軽量モード（弱い端末＝スマホ親のカクつき対策）**：**プレイヤーが設定メニュー（⚙）でON/OFF**する（`toggleLowFx`／`lowFxRow`・既定OFFでフル演出）。端末個別の好みなので `localStorage('sw_lowfx')` に保存＝**クラウド同期しない**（音量と同じ扱い）。ONのとき **見た目だけの粒子(`world.parts`) を削減**＝`burst()` の生成数を半減＋総数上限を `PART_CAP_HI`(200)→`PART_CAP_LO`(70) に下げ、`loop()` が毎フレーム古い粒子を間引く（`partCap()`）。炭酸沼はグラデ生成をやめフラット塗り。さらに `render` の**装飾的な強化オーラ（進化/パーティ/各種バフの脈動リング一式）をON時はまとめて描画スキップ**（強化の有無はスプライト＋頭上の✦バッジで分かるので情報は失われない／足元の陣営リング・起爆警告・チャージ光など情報系は残す）。**CPU計算・当たり判定・スナップショットは不変＝ゲーム性/対戦の公平性に影響なし**（減るのは派手さだけ）。自動検知はしない（勝手に地味にしないため）。テスト：test.js 82。
- **戦闘エンジン**：`createWorld` / `stepWorld(world,dt)`（phase=muster|battle|outro。毎フレームshuffleで左右バイアス除去）/ `nearestEnemy`（**無敵中`invuln>0`の敵は標的にしない**＝ワープ直後のゴーストにサムライ等が吊られない）/ `applyHit`（無敵中は無効。ノックバックは重量耐性＋上限＋無効時間。吸引中/起爆中は無反動）/ `killUnit`（爆発・スライム分裂・炭酸沼発生を一本化。爆発AoEも無敵中は当たらない）。
- **専用挙動**：`chargerStep`(大福) / `artilleryStep`(キャノン) / `vacuumStep`(ドーナッツ) / `spawnerStep`(ベーカリー：`spawnerId` で個体ごとに独立した召喚枠) / `evolvePancake`・`evolvedStep`(パンケーキ進化＋ジャンプ衝撃波) / ワープ(ゴースト) / `shellStep`(マカロン：殻スピン→スタン→通常／true返却でその場処理) / 氷弾のヒット時スローは `u.chillT`/`chillAmt`、炭酸沼は `world.puddles` を `stepWorld` で毎フレーム処理（DoT＋`slowMul`減速）。
- **ドラフト/演出**：`beginDraft` / `nextPick` / `renderPickOffer` / `pickCardAnimated`（裏表フリップ）→ `pickCard` / `revealFoePick` / `aiPicks`（貪欲スコア）/ `lockAndFight`。
- **カード選択の制限時間（放置対策）**：`PICK_TIME_LIMIT`(30秒)。カード提示のたびに `startPickTimer(autoPickLeftmost)` を起動し（`#pickTimer` に残り秒表示・残5秒で赤）、時間切れで `autoPickLeftmost()`＝**一番左（先頭）のカードを自動選択**。選択開始/開戦/待機で `stopPickTimer()`。**チュートリアル中は起動しない**（案内を邪魔しないため）。PVEは `renderPickOffer`、PVPは親=`pvpHostShowOffer`／子=`pvpGuestShowStep` にそれぞれ仕込む。PVPの親は、子がフリーズしてSTEPPICKを送れない場合に備え `pvpHostDraftStep` の待機に **+5秒の猶予つき代理タイムアウト**（`eOffer[0]`＝子に見せた一番左を代理選択。子が生きていれば子自身も同じ左端を送るので結果一致）。**ヘッドレス(test)は `setInterval` 不在を検知してタイマー自体を動かさない**（自動選択でテストが乱れない）。
- **ドラフト中の盤面のぞき見**：offer-foot の「👁 盤面を見る」(`#draftPeekBtn`)で `toggleDraftPeek()`＝カードのボックスを一時的に `visibility:hidden` にして盤面を確認、画面下の「🃏 カードにもどる」(`#draftPeekBack`・`position:fixed`)で戻す（`_draftPeek`）。`showOfferCards`/`hideOfferCards` で状態リセット＝新ピックや待機のたびにカード表示へ戻る。制限時間タイマーは覗き見中も進む。PVE/PVP共通。
- **隊列**：`arrangeFormation`（tierでグループ化し後方アンカーで整列）/ `centerMergedSlimes`。
- **X2**：`doubleUnitsOnBoard` / `applyX2Replay` / `eligibleX2Specials` / `cloneFighter`。
- **決着**：`beginOutro` / `outroStep`（溶けて砂糖に）。

## スプライト（立ち絵）

- 陣営で出し分けるキャラ：**スライム**（`slime_blue/red` ＋ `_big`）と**ソーダ**（`soda_blue`=味方/`soda_red`=敵）ほか多数（cookie/choco/shoe/daifuku/ghost/donut/bakery/ginger/cannon/**icewiz**/**shortcake**/**strawturret**＝`*_blue`味方/`*_red`敵）。`spriteFor()`/`iconHTML()` で解決。
- **ショートケーキ**：`shortcake_blue`(ブルーベリー)/`shortcake_red`(いちご)＝通常（頭にベリー）。**タレット設置中**（`u.myTurret` 生存）は頭のベリーが無い `shortcake_deploy_*` に切替（ベリー＝タレットになって飛び出した表現）。立ち絵は**本体のみ（影を除去）**で、影は共有スプライト `shortcake_shadow` を `render` で**地面に固定描画**（bob無し）。本体だけを `render` で上下(`bob += -3+sin(...)*3`)させて**ふわふわ浮遊**＝影との隙間で浮遊感（影は固定）。タレット `strawturret_blue`(ブルーベリー)/`strawturret_red`(いちご)。
- **チョコレートナイトの剣・盾合成（分離素材）**：`spriteFor` が**本体のみ**`choco_body_blue/red` を返し（強化/未強化とも本体は共通）、`render` の `drawChocoGear(u,S,cx,cy)` が**剣(左)`choco_sword_*`＋盾(右)**を合成。**盾は強化(ビター装甲/`u.chocoBuff`)で大盾 `choco_shield_buff_*`（大きめ `shW=S*0.52`）／未強化は小盾 `choco_shield_*`（`S*0.42`）**に切替（`chocoUsesParts` は強化/未強化とも真）。**攻撃(atkAnim)＝剣を左に倒して振り下ろす**（`ang=-0.5-2.0*a`・握り`CSW_PIVX/Y`=0.5,0.82）／**歩行(battle)＝盾が上下に揺れる**（`Math.sin(u.bob)*S*0.07`）。赤は青→赤 recolor。本体素材が無い場合のみ従来の一枚絵`choco_buff_*`にフォールバック。カード絵は従来 `choco_*`。**アニメテストでも `choco` の待機/歩行/攻撃ポーズを確認可**（`CHOCO_POSES`）。
- **アニメテストの動作確認（`ANIM_TEST_EXTRA`＝`strawturret`/`daifuku`/`cookie`/`choco`）**：`animTestUnits()` に追加。選ぶと `animTestLive=true` で `animTestLoop` が `stepWorld` を回す（他キャラは従来どおり `world.t` だけ進めて静止アニメ確認）。タレット＝味方2基＋各射程内に不死・不動の敵で連射を確認。**サムライ＝中央に1体だけ置き、`animTestLoop` が `cstate` を手で切替えて `SAM_POSES`（①納刀→②抜刀前→③掲げて突撃→④通常攻撃）を各1.6〜2.2秒ずつ順番に見せる「ポーズ確認モード」**（stepWorldは回さない・画面上部に現在ポーズ名のラベルを描画・`animTestSamurai`/`animTestPhaseT`）。
- **大福サムライの武器合成（刀・鞘の分離素材）**：未強化・スキン無しのときは `spriteFor` が**本体のみ**`daifuku_body_blue/red` を返し、`render` の `drawDaifukuWeapon(u,S,cx,cy)` が**鞘 `daifuku_sheath`（腰に固定）＋刀 `daifuku_katana`（状態別に回転/移動）**を上乗せ描画。刀のポーズは `u.cstate`：`charge`=**納刀（水平）してから溜め後半に鞘から水平にスライドして抜く**（`behind=true`で鞘を手前に描画＝刃が鞘から出る前後関係）／`dash`=**抜刀して刀を頭上に掲げて突撃**（ang≈-100°）＋**ヒット時に前方へ扇状の斬撃**（`world.slashes` に `{x,y,sang,reach,life,max,side}` を積み、`render` が進行方向へ広がる弧で描画。`chargerStep` の突撃ヒットで生成）／`walk`+`atkAnim`=**体の左側で振り下ろす**通常攻撃の弧／`walk`待機=左に軽く構え／その他=納刀。**通常攻撃は前へのプッシュ(lunge)を無効化**（`render`で daifuku は `lungeX/Y=0`）＝刀の振りだけで見せる。`world.slashes` は createWorld/stepWorld/serializeWorld/applySnapshot（`sang`はY反転で符号反転）に対応済み。walk攻撃時に `chargerStep` が `atkAnim=ATK_ANIM` を立てる。回転軸は刀スプライト内 `KAT_PIVX,KAT_PIVY`(0.24,0.5)＝柄。強化(ちょんまげ大福)・くさもちスキン・スキン強化も**武器なし本体**があれば同じ刀/鞘を合成（`daifukuBodyKey()`＝通常`daifuku_body_*`／強化`daifuku_buff_body_*`／スキン`daifuku_yomogi_body_*`／スキン強化`daifuku_yomogi_buff_body_*`。6枚は共通bboxで切り出し本体位置を統一）。本体が無ければ従来の一枚絵にフォールバック。突撃ヒットの扇状斬撃は実戦でも表示（大きめ/明るめ）。
- **クッキーアーミーの槍合成（槍・本体の分離素材）**：未強化(非パーティー)のとき `spriteFor` が**槍なし本体**`cookie_body_blue/red` を返し、`render` の `drawCookieSpear(u,S,cx,cy)` が槍 `cookie_spear_blue/red` を右手で握って状態別に回す（`cookieUsesParts`/`SP_PIVX,SP_PIVY`=握り0.5,0.72）。状態：**待機(muster)=槍を上に向ける**（今の一枚絵と同じ見た目）／**移動(battle中)=槍を左に倒す**(ang≈-1.15)／**攻撃(atkAnim>0)=左へ突き出す**（左へ平行移動＋ang≈-1.65）。赤(敵)版は青→赤 recolor で用意。強化「クッキーパーティー」(`u.party`)は従来の一枚絵`cookie_party_*`（合成しない）。カード絵(iconHTML)は従来 `cookie_*`（槍つき一枚絵）。
- パンケーキは陣営色つき。進化前 `pancake_blue/red`／はや焼き強化(進化前・王冠5トゲ)`pancake_fast_blue/red`(`u.fastEvo`)／進化後(3段)`pancake_evo_blue/red`(`u.evolved`)を切替（進化後が最優先）。旧 `pancake`/`pancake_evo` はフォールバック。
- シェルマカロンは通常 `macaron_blue/red`／殻スピン・スタン中 `macaron_spin_blue/red` を `u.shellPhase` で切替（スピン中は描画を回転＋スタン中は★演出）。強化(マカロンアーマー/`u.macaronBuff`)は `macaron_buff_*`／`macaron_spin_buff_*`。
- 強化で立ち絵が変わるキャラ：**チョコ**（`choco_buff_*`＝ビター装甲、`u.chocoBuff`）・**シュー**（`shoe_buff_*`＝特盛り、`u.shoeBuff`）・**ソーダ**（`soda_buff_*`＝炭酸沼強化、`u.fizz`）・**ベーカリー**（`bakery_buff_*`＝ラストベイク、`u.bakeryBuff`）・**ポップコーン**（`bomb_buff_*`＝おかわり、`u.spawnMini`）・**大福**（`daifuku_buff_*`＝ちょんまげ大福、`u.daifukuBuff`）・**ゴースト**（`ghost_buff_*`＝分身、`u.cloneOn`／おとり分身は通常絵）・**キャノン**（`cannon_buff_*`＝クラスター花火弾、`u.cluster`）・**ドーナッツ**（`donut_buff_*`＝鉄壁、`u.donutWall`）・**アイス**（`icewiz_buff_*`＝ブリザード、`u.icewizBuff`）・**マカロン**（`macaron_buff_*`/`macaron_spin_buff_*`＝マカロンアーマー）。いずれも陣営色つき。`spriteFor()` で解決。
- 立ち絵が無いキャラは絵文字フォールバック。
- **アニメ付きキャラ**：UNITに `anim`（味方=青フレーム配列）＋`animRed`（敵=赤フレーム配列・省略時は`anim`流用）＋`animFps`を持たせると、`spriteFor()` が `u.side` と `world.t` で `animFps` 枚/秒でフレームを切り替える（例 `mangel`＝マシュマロエンジェル・青赤各3フレーム）。**静止立ち絵の陣営色出し分けにも流用可**（例 `kumagumi`＝クマグミ・`anim:['kumagumi_blue']`/`animRed:['kumagumi_red']`＝1枚アニメ）。開発中は `test:true` を付けるとロスター/ドラフト/CPUデッキ/X2生成から除外され通常プレイに出ない。**アニメ動作テスト**＝設定メニュー「🧪 アニメテスト」→`startAnimTest(key)`：1カード分ずつ(3体vs3体)を上=敵赤/下=味方青で**その場に整列（動かない）**で出し、`animTestLoop` が `world.t` だけ進めて**アニメだけをじっくり確認**。上部のバー（`#animTestBar`＝`test:true`キャラ一覧）で**確認するキャラを選べる**（`stopAnimTest`で戻る）。テスト：test.js 90。
- **強化カードの絵**：`SPECIALS` に `evoSprite`（例 `buff_choco`→`choco_buff_blue`／`fast_pancake`→`pancake_evo`／`up_slime`→`slime_blue_big`）を持つ強化は、ドラフトのカード絵を**進化後/強化後の立ち絵**で出す（`specialCardIcon()`）。無ければ対象キャラのベース絵→絵文字にフォールバック。**ライバルの選択カード**（`showFoePickCard`）はユニット＝敵色の立ち絵(`iconHTML(u,'e')`)／強化＝`specialCardIcon()`（強化後の絵）で表示。プロフィールの「よく使うキャラ」は `unitSpriteImg()` で**立ち絵**表示。
- **ヘッダーのアクション（`.topbar-actions`）**：右上に「コミュニティに参加！(Discord・他より横長)」→「お知らせ📢(`#newsBtn`)」→「設定⚙」の順。お知らせは**新着があると赤ドット**（`renderNewsDot`/`#newsDot`）＝最新 `NEWS[0].ver` を `localStorage('sw_news_seen')` と比較（`newsUnseen`）、`openNews` で既読化（`markNewsSeen`）。起動時に `renderNewsDot()`。
- **キャラ詳細（`showDetail`）**：**「ステータス」「熟練度」の2タブ**（`switchDetailTab`）。ステータスタブ＝ダメージタイプのバッジ（`unitDamageType()`＝近距離/遠距離×単体/範囲・自爆/生産）＋ステータスグリッド（召喚数/攻撃/HP/移動速度/攻撃速度=`cd`秒/回/射程＝`fmtSpeed`不動・`fmtRange`全域）＋説明＋**能力欄 `abilitiesHTML()`**（`UNIT_ABILITIES`＝key→[{name,info}]。固有ギミックを**能力名＋ℹ️で詳細開閉**(`toggleAbilityInfo`)。能力の無いキャラは非表示。1キャラずつ調整していく）＋`enhDisplay()`（進化＝自動／固有強化＝強化後HP/攻撃を定数から再計算＋進化後の立ち絵）。熟練度タブ＝`masteryDetailHTML()`。攻撃力は `unitAtkText()` で**殴り攻撃0でも実ダメージを表示**（自爆=💥blast／迫撃=💥mortar・ラベルは「爆発ダメージ」）。`enhDisplay()` はスライムに**融合後ステータス**（`FUSE` から再計算）、ベーカリーに**召喚するジンジャーの性能**も併記。モーダルは `.modal-card` に `max-height:calc(100vh-40px);overflow-y:auto` で**縦長でもスクロール**（全モーダル共通）。テスト：test.js 85・87。

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

### F2-①（接続）— 実装済み（`<script>` 末尾「10) PVP 接続レイヤ」）

- **Firebase＝シグナリング専用**（部屋/あいことばのSDP・ICE受け渡し）。対戦データはWebRTCの DataChannel で直送。
- `FIREBASE_CONFIG`：ユーザーが自分のキーを貼る（既定は `PASTE_...` プレースホルダ。未設定でもCPU対戦は不変、PVP画面に警告表示）。
- `createWebRTCTransport({mode,code,onOpen,onState})`：F1の通信路IF `{send,onMessage,close}` を返す＝`createLoopbackPair()` と差し替え可能。
  接続成立後は**この transport にだけ**対戦本体を依存させる（F2-②）。
- ロビーUI：`pvpLobby` セクション＋ `openPvpLobby/pvpHost/pvpShowJoin/pvpJoin/pvpLeave/pvpSendTest`。
  現状は**接続確認モード**（「接続成功！」＋テスト送信）まで。PVPボタンは有効化済み。
- 設定手順は `FIREBASE_SETUP.md`。Realtime Database のルールは `rooms/$code` のみ read/write 可の割り切り。
- **2台＋Firebaseの実機テストはこのリポジトリ環境ではできない**ため、接続確認はユーザーの手元で行う。

### F2.5（非P2P：WebSocket中継）— 実装済み（transport差し替えのみ／既定OFF）

- **目的**：P2P(WebRTC)の代わりに Cloudflare **Durable Objects**（1部屋=1オブジェクト）でメッセージを中継。対戦本体は transport IF `{send,onMessage,close}` にしか依存しないので**まるごと差し替え**（ホスト権威＝親が計算は不変）。
- サーバー：`relay-worker.js`（Worker+DO `Room`）／設定 `relay-wrangler.toml`／手順 `RELAY_SETUP.md`。制御は `{__relay:'ready'|'peer-left'|'full'}`、対戦データ(`PVP_MSG.*`)は素通し。
- クライアント：`createRelayTransport()`（WebSocket版transport）と `createPvpTransport()`（リレー優先→失敗時WebRTCフォールバック）。PVPの接続4箇所（`pvpHost`/`pvpJoin`/`mmBecomeHost`/`mmGuestFromAssignment`）は `createPvpTransport` 経由。
- **切替**：`RELAY_URL`（wss）＋ `PVP_USE_RELAY`。**既定は `false`＝従来のWebRTCで一切影響なし**。サーバー確認後に `true` にして配信すると次リロードで全員切替（Webの自動更新）。CPU対戦は不変。
- **要実機確認**：2台/2タブでの中継対戦はこの環境ではテスト不可。`RELAY_SETUP.md` 参照。

### 親選び（役割調整・A案：PCを優先して親＝計算側）— 実装済み

- **目的**：ホスト権威型なので**親（＝計算する側）が非力なスマホだと両者がカクつく**。PCとスマホが当たったら**必ずPCを親**にしてスマホ親を避ける。
- **仕組み**：接続直後に `pvpOnConnected()` が端末種別(`PVP_MSG.ROLE`)を交換し、純粋関数 `pvpDecideIAmHost(iWasHost, myDev, theirDev)` で役割を決める。`pvpDeviceType()`＝UA/`pointer:coarse`/タッチで `'pc'|'mobile'` を判定（保守的にタッチ系は `mobile`）。**PC×スマホはPCが親／同種は従来どおり接続を張った側が親**（＝どの組み合わせでも親はちょうど1人）。決定後 `pvpSetupRole(iAmHost)` が `makePvpHost`/`makePvpGuest` を張り替える（transportの向きは不変・PVP層は対称なのでスワップ可）。
- **下位互換**：旧版の相手は `ROLE` を送らない/無視する。相手が先に `HELLO` 等を送ってきたら旧版とみなし**従来割当てで即開始**（ネゴ中に届いたメッセージは退避して本ハンドラへ流し直す＝取りこぼしなし）。相手が無応答でも 1.5秒で従来割当てにフォールバック。**既存プレイヤーに影響なし**。
- テスト：test.js 83（`pvpDecideIAmHost` の決定表＋「親はちょうど1人」）。スワップ実挙動＋旧版フォールバックはブラウザ(loopback)で確認済み。**実機（PC×スマホ）確認は手元で**。

### F2-②（対戦本体）— オーケストレーション層は実装済み（`<script>`「11) PVP 対戦オーケストレーション」）

- `makePvpHost(conn, hooks)` / `makePvpGuest(conn, hooks)`：通信路(transport)にだけ依存する進行役。
  実戦は `createWebRTCTransport` の transport、テストは `createLoopbackPair()` を渡す（test.js 48）。
  - 親：`start()` / `offerAndAwait(round,step,offer3)`（子のPICKをPromiseで待つ＝ドラフト非同期化の核）/ `sendSnapshot(world)` / `sendResult()` / `sendGameover()` / `getGuestDeck()`。
  - 子：`hello(deck)`。受信は hooks（`onStart/onOffer(m,reply)/onSnapshot(world,m)/onResult/onGameover`）。SNAPSHOTは自動でミラー展開。

### F2-②（画面配線）— 実装済み（`<script>`「12) PVP 画面配線」）

- **親**：既存機構を `pvpMode` で再利用。`foeCtl=makeRemoteFoeController()` に差し替え、
  `pvpHostStartRound()` が `offerAndAwait` で子の選択を先に集めてから `beginDraft()`（=既存ドラフト/戦闘がそのまま動く）。
  `loop()` が `sendSnapshot`（**戦闘中=約10Hz／ドラフト中=約3Hz**でTURN通信量を削減）、`endBattle` が `sendResult`/`sendGameover`、`nextRound` がPVP分岐。
  - **通信量削減**：`serializeWorld` は数値を丸め（位置/HP=整数・演出値=小数2桁）、`false`のフラグ項目を省略（子では undefined=falsy で同義）、粒子/リングは戦闘中のみ送る。TURN中継時のデータ量を抑える（無料枠対策）。
- **子**：`PVP_GUEST_HOOKS`＋`pvpGuestEnterPlay/ShowOffer/RenderSnapshot/OnResult/OnGameover`。
  計算せず、OFFERで選び・SNAPSHOTを `render` で描画するだけの薄いクライアント。
- `pvpOnConnected` が接続後に親=子デッキ待ち→開始／子=デッキ送信→START待ち、に分岐。`openPvpLobby` は `needPlayerDeck()` で編成を要求。
- **VSカットイン**：対戦開始時（`pvpStartAsHost`/`pvpGuestEnterPlay` 冒頭）に `pvpShowVsCutin()`→`showVsCutin(foe,you)`。全画面 `#vsCutin`（上=相手・赤／下=自分・青／間に斜めライン、アイコン大＋横に**二つ名**/名前/レート縦並び）を約2秒アニメ表示。**見た目（フレーム/二つ名/名前の色）も両陣営に反映**＝`showVsCutin` は `{name,avatar,frame,titlePre,titleSuf,nameColor,rate}` を受け取り `avatarHTML(avatar,78,frame)`＋`applyNameColor`＋`titleTextOf` で描画。相手の見た目は**ハンドシェイクで共有**（`pvpNetProfile()` に frame/titlePre/titleSuf/nameColor を載せ `pvpOppProfile` で受信。旧版は各フィールド無しで見た目なしにフォールバック）。`pointer-events:none`・自動で消える。
- テスト：test.js 48（オーケストレーション往復）＋49（リモート敵が実フローを駆動）。CPU対戦は不変。
- **要・実機確認**：2台（または同端末2タブ）での対戦通しはこのリポジトリ環境ではテスト不可。手元で確認する。

### F2-③（PVP強化カード フェーズ1）— 実装済み（倍カード＋強化カード）

- **バージョン照合で自動切替**：`PVP_PROTO`（現在2）を HELLO/START でやり取りし、**両者が新版のときだけ** `pvpEnh=true` で強化カードを有効化。
  片方が旧版（cache/旧タブ）なら自動で従来のv1（強化なし）に落ちる＝**既存プレイヤーに影響なし**。
- **ホスト権威で提示生成**：親が自分('p')と相手('e')双方の提示3枚を作る。'p'=`eligibleSpecials()`／'e'=`foeEnhanceCandidates()` で資格判定。子の提示は STEP の `offer3` で配る。旧版の親は `offer3` を送らず、子は自前生成にフォールバック。
- **強化パリティ**：`pvpMakeStepOffers()` が**1回の抽選**（`SPECIAL_OFFER_CHANCE`）で両者の提示を作り、当たれば**両陣営に同時に**強化カードを差し込む＝「片方に強化/X2が出たら、もう片方にも（出せるなら）出る」。`X2_OFFER_CAP` 体以上の種類はX2を出さない。
- **効果適用**：`applyPvpSpecial(world,side,key)` が融合/X2/固有強化を指定陣営へ適用し `state.youX2`/`foeX2`/`youMerges` 等を更新（PVEと同じ状態）。親の自分ピックは'p'、子のピックは'e'へ。
- **毎ラウンド再適用**：`pvpHostStartRound()` 冒頭で `reapplyEnhancements(world,'p'|'e')`（融合＋`applyX2Replay`＋`applyFlagBuffs`）。PVEの `beginDraft` と同等。
- テスト：test.js 53〜58（提示の出し分け／X2適用／融合＋再適用／STEPでのoffer3伝播／X2上限／強化パリティ）。

### F2-④（PVP逆転ボーナス フェーズ2）— 実装済み（敗者先行の非対称ピック）

- **`pvpEnh` 時のみ有効**（新版同士。旧版混在なら `picksFor` が `picksBase` を返して従来どおり両者同数）。
- ピック数：`pvpHostStartRound()` が `picksFor()` で親子それぞれ算出（敗者=`picksComeback`=4／勝者=`picksAfterWin`=3）。`endBattle` がホスト側で `state.lostLast`/`foeLostLast` を確定済み。子の `lostLast` は RESULT から `pvpGuestOnResult` が設定（逆転バナー用）。
- **敗者先行**：差分（`pvpHostExtra`/`pvpGuestExtra`）ぶんを先頭ステップで**単独ピック**。`pvpHostDraftStep()` が各ステップで `pvpStepHostActive`/`pvpStepGuestActive` を判定し、片側のみアクティブなら単独・両方なら同時選択（強化パリティはこのときだけ）。
- **待機同期**：親が単独で選ぶステップは `notifyGuestWait()` が STEP に `wait:true` を載せ、子は `pvpGuestShowWait()` で待機表示＋**返信しない**。子が単独のステップは親が `pvpHostShowOffer` を出さず待機表示。
- テスト：test.js 59（`picksFor`の逆転）・60（待機通知で子が返信しない）。
- **親子のキャンバスサイズ差**：子は座標系を親(`snap.W/H`)に合わせつつ、**表示は自分の画面幅いっぱいに拡大**（`pvpGuestRenderSnapshot`＝CSS高さを `pvpGuestDisplayH(avail,CW,CH)`＝表示幅(440上限)×親アスペクト比に設定）＝**親が小さい端末でもステージが縮まない**（純粋関数 `pvpGuestDisplayH`・test.js 113）。

### プライベート部屋の再戦（接続を保ったまま何度でも）— 実装済み

- **ロビーは2段**：PVP →「ランダムマッチ / プライベート対戦」（`pvpShowPrivate`/`pvpBackToChoice`）→ プライベートは「部屋を作る / 部屋に入る」。
- **presence**：ペア成立後（`mmBecomeHost`/`mmGuestFromAssignment`）とプライベート部屋のホスト/参加（`pvpHost`/`pvpJoin`）は `'connecting'`＝「マッチ待ち」に数えない。実際に待機列に並ぶ人だけが `matching`。
- **再戦**：プライベート部屋（`pvpRanked===false` かつ `pvpConn` あり）は決着後も**接続を切らず**、over画面に「🔁 もう一度／🚪 部屋を出る」（`pvpSetupOverButtons`）。両者が「もう一度」を押すと親が同じ接続で `pvpStartAsHost()` を再実行＝新しい対戦（**編成=`myDeck`/`pvpGuestDeck` は維持**、子が編成を変えていれば `REMATCH` に添えた新デッキを反映）。`PVP_MSG.REMATCH`／`pvpRematchClick`/`pvpRematchTryStart`/`pvpRematchUpdateUI`。子の再戦は親の `START` で開始。テスト：test.js 78。
- **限界**：対戦間（over画面）に相手が抜けた場合の即時検知はしない（`pvpMatchActive()`＝対戦中のみ再接続監視）。要2台実機確認。

### F3 — 自動マッチング（ランダムマッチ）— 実装済み（`<script>`「12.5) ランダムマッチ」）

- **あいことば不要**。Firebaseの待機列 `matchmaking/queue/<uid>` でペアリングし、既存 `createWebRTCTransport`→`pvpOnConnected` フローに合流（CPU/手動対戦は不変）。
- 参加時のみ `ensureGuestSignIn()`（**匿名認証** `signInAnonymously`／ログイン済みはそのuid）でuid発行。
- `mmQueueRef.transaction` で**待機者を1人だけclaim**（奪い合い防止）。`mmPickWaiter(queue,uid,now,staleMs)`＝自分以外・期限内で最古を選ぶ純粋関数（test.js 70）。
- **claimした側＝親(host)／claimされた側＝子(guest)**。親が部屋を作り `matchmaking/matches/<guestUid>` にコードを通知→子は `waitOffer:true` で親のオファーを待って接続。
- 切断/キャンセルは `onDisconnect().remove()` と `mmCleanup()` で待機列を掃除。相手プロフィール（名前/アイコン）はマッチ割当て経由で表示（`mmShowOpponent`・textContentで安全表示）。
- **要設定**：匿名認証の有効化＋RTDBルールに `matchmaking`（`auth!=null`）。手順は `FIREBASE_SETUP.md`「ランダムマッチ」。
- **要実機確認**：2台/2タブでのペアリング〜対戦通しはこの環境ではテスト不可。`mmPickWaiter` のみヘッドレス検証。

### PVP 再接続（瞬断救済）— 実装済み（`<script>`「12.6) PVP 再接続」）

- `createWebRTCTransport` の `onconnectionstatechange` から `pvpHandleConnState` を呼ぶ。対戦中(`pvpMatchActive`)に `disconnected/failed` を検知したら `pvpReconnBegin`（オーバーレイ＋30秒カウントダウン `PVP_RECONNECT_MS`）。
- **瞬断（リロードなし）**：ICEが自己回復して `connected` に戻れば `pvpReconnRecover`（親は `sendSnapshot` で子を追いつかせる）。ホスト権威なので盤面は親で進み続ける。
- **30秒で戻らない**：`pvpReconnFail`→`pvpReconnEndMatch`（引き分け扱いでメニューへ）。「対戦をやめる」= `pvpReconnGiveUp`。
- **リログ（再読み込み）**：対戦開始時に `pvpSaveResume()`（sessionStorage `sw_pvp_resume`）。起動時 `pvpTryResumeOnLoad` が最近の記録を見て「前の対戦は切断で終了」と通知（同一試合の完全再同期はしない）。正常終了(`endGame`/`pvpGuestOnGameover`)・`pvpLeave` で `pvpClearResume`。
- 純粋関数 `pvpReconnRemain` / `pvpResumeIsRecent` をヘッドレス検証（test.js 71）。実切断の通しは要実機。
- **限界**：親(ホスト)の完全リログ復旧・ドラフト中の再同期は対象外（サーバー権威=Railway移行時に対応予定）。

## トロフィー（=レート）＆ランキング（実装済み）

- **トロフィー＝ELOレート**。初期 `TROPHY_START`=1000、`ELO_K`=32。`eloExpected`/`eloDelta`（純粋関数・test.js 72）。
- ランダムマッチ決着時のみ増減（あいことば手動PVP・CPU戦は非変動。pvpRankedで判定）：親は `endGame`（`wasPvp`時）、子は `pvpGuestOnGameover` で `applyTrophyResult(won, oppTrophies)`。相手トロフィーはハンドシェイク（HELLO/START の `prof`＝`pvpNetProfile()`）で交換し `pvpOppProfile` に保持。over画面に増減を表示。
- 保存：`myProfile.trophies/wins/losses` を buildProfile/applyProfile に統合（端末＋クラウド）。
- **戦績表示**：プロフィール欄（`#authModal`）に `renderProfileStats()` でトロフィー／**最高トロフィー(`myProfile.best`)**／**勝率(%)**／バトル数（=wins+losses）／勝利／敗北＋**よく使うキャラ(`mostUsedUnit()`)** を表示（`fillProfileEditor` から呼ぶ）。wins/losses はランダムマッチのみ反映。`best` は `applyTrophyResult` で更新、`usage`（key→回・全モードで `trackBattleStart` が加算）から `mostUsedUnit()` を算出。どちらも buildProfile/applyProfile でマージ（大きい方）＝端末＋クラウド。テスト：test.js 86。
- **熟練度（キャラ経験値）で解禁する特別アバター**：`myProfile.mastery`（key→XP）。XPは**PVP対戦の決着時のみ** `awardMasteryXp(won)` で付与（デッキ各キャラに 勝ち=`MASTERY_WIN_XP`(10)／負け=`MASTERY_LOSE_XP`(3)・CPU戦は非加算）。レベル＝`masteryLevel()`。**XPカーブは `masteryXpForLevel(n)`＝Lv3までは1レベル50XP（累計 Lv1=50/Lv2=100/Lv3=150）、Lv3以降は1レベルごとに必要XPが `MASTERY_RAMP_STEP`(50)ずつ増える（Lv4=250/Lv5=400/Lv6=600…＝やり込み報酬を重く）**。**アバターは全て画像アイコン（絵文字アイコンは廃止）**。`SPECIAL_AVATARS` は **無料(`free:true`,`lvl:0`)＝`ava_cookie_free`/`ava_ginger`/`ava_shoe`（最初から選べる）** ＋ **熟練度解禁(`lvl:3`)＝`ava_bomb`/`ava_choco`/`ava_cookie`/`ava_daifuku`/`ava_donut`/`ava_pancake`/`ava_macaron`**（背景つき画像64×64）。解禁は対象キャラの熟練度Lvが `lvl` 以上で `avatarUnlocked()` が真。新アバターは同じ64×64 RGBAを `SPRITE_DATA` に注入し `SPECIAL_AVATARS` に1行足すだけ（グリッド/ロードマップは自動反映・`free` はロードマップに出さない）。`avatarHTML()` は**常に画像**を返し、`validAvatarId()` で不正/旧・ユニットkey(絵文字)は `DEFAULT_AVATAR`(`ava_cookie_free`) に正規化＝**既存の絵文字ユーザーは自動でクッキーに置換**（プロフィールチップ/ランキング/対戦相手表示/選択グリッド）。ロック中は🔒＋必要Lv表示、解禁時は `toast()` 通知。熟練度は buildProfile/applyProfile とローカル保存に統合（マージは大きい方）。キャラ詳細（`showDetail`）に `masteryDetailHTML()` で**熟練度Lv/XP進捗バー＋解禁ロードマップ（アバター＋スキン）**を表示。
- **スキン（戦闘中の立ち絵を差し替え・見た目だけ）**：`SPECIAL_SKINS`（例 `daifuku_yomogi`＝よもぎ大福・`unit:daifuku`・`lvl:5`・`base:'daifuku_yomogi'`）。立ち絵キーは `base+'_'+team` / 強化後 `base+'_buff_'+team`（4枚：青/赤×通常/強化を `SPRITE_DATA` に128px NEARESTで注入）。熟練度Lvが `lvl` 以上で `skinUnlocked()`。装備は `myProfile.skins`（unit→skinId）に保存、ロードマップの「装備する/装備中✓」ボタン＝`equipSkin(unit,id)`（トグル・その場で熟練度タブ再描画）。`spriteFor()` は `activeSkinBase(unitKey)`（装備中かつ解禁済みならbaseを返す）で**自分の軍（side='p'）だけ**差し替え（相手の見た目は不変・PVPの相手スキン共有は未対応）。新スキンは4枚を `SPRITE_DATA` に注入し `SPECIAL_SKINS` に1行＋（daifuku以外は）`spriteFor` に分岐追加。
**方針：解禁は見た目（アイコン/スキン）だけ＝強化カード等の性能は熟練度で解禁しない（対戦を常にフェアに）**。テスト：test.js 79・88。
- **リーダーボード**：`leaderboard/<uid>={name,avatar,trophies,wins,ts}`（公開read・自分のみwrite）。`leaderboardSubmit`（決着/ログイン時）・`leaderboardLoad`（trophies降順・上位50）。`#ranking` 画面＝`openRanking`/`renderRankingList`。ホームに `🏆` 表示（`renderHomeTrophies`）。
- **死んでる(放置)アカウント対策**：①`leaderboardSubmit` は**本ログイン(`isRealUser()`＝非匿名)のみ**登録＝ランダムマッチのたびに増える使い捨ての匿名ゲストでランキングを埋めない。②`leaderboardLoad` は多め(`LEADERBOARD_FETCH`=300)取得して `filterActiveEntries()`（純粋関数・test.js 92）で**最終プレイ `ts` が直近 `LEADERBOARD_ACTIVE_DAYS`(30)日以内のエントリだけ**に絞ってから上位N件を返す（ts無し/古いものは非表示）。**表示から外すだけでDBの古いエントリ自体は消えない**（他uidの削除はクライアント権限外＝Firebaseコンソール/Functionsで別途掃除）。
- **要設定**：RTDBルールに `leaderboard`（read:true・$uidのみwrite）。`FIREBASE_SETUP.md` C章参照。
- CPU対戦はトロフィー非変動（PVPのみ）。

## 経済（通貨🍬シュガーコイン＋カードパック＋見た目コレクション・実装済み・`<script>`「13.5) 経済」）

**通貨は🍬シュガーコイン1種のみ**（旧「ジェム」は廃止し統合）。パック購入・キャラ解禁・レッスン報酬・対戦報酬すべてこの1通貨。

**最優先の原則：経済は「見た目」だけに効かせる＝ユニット性能・強化カードは一切解禁しない（対戦は常にフェア）**。人が少なくても課金・レベル差で格差が広がらないための割り切り。テスト：test.js 90・91。

- **通貨（🍬シュガーコイン＝`myProfile.coins`）**：課金ではなく**対戦報酬**で配る（子ども向けに安全）。`grantBattleReward(won)` を決着時に呼ぶ＝**CPU/PVP両方**（`endGame`＋子の `pvpGuestOnGameover`。チュートリアルは除外）。報酬額は純粋関数 `battleCoinReward(won, firstWinToday)`＝`COIN_PLAY`(10・参加)＋`COIN_WIN`(15・勝利)＋`COIN_DAILY_WIN`(50・その日の初勝利=`myProfile.dailyWinKey` で1日1回)。ホーム＆ショップに残高表示（`renderHomeCoins`/`renderShopCoins`）。
- **カードパック**：`PACK_COST`(120コイン)で `buyPack()`→`openPackOnce(Math.random())`。中身は**レア度なし＝全アイテム同確率**（`packPool()`＝フレーム＋称号＋ネームカラーの**見た目3種のみ**）。抽選は純粋関数 `rollPack(pool, r)`（0..1）。**★アイコン(アバター)/スキンはガチャに出さない**＝それらは**キャラの熟練度でのみ解禁**（熟練度報酬をガチャで進めさせない＝対戦を常にフェアに）。
- **11連**：`PACK11_COST`(1200＝10回ぶん)で `buyPack11()`＝`PACK11_COUNT`(11)回 `openPackOnce` を回す（1回お得）。単発 `buyPack`/11連 `buyPack11` とも結果を**配列**で `showPackOpen(arr)` に渡す（test.js 111）。
- **開封演出（CSS描画・絵素材不要）**：中身を即確定して `showPackOpen(arr)`→全画面 `#packOpenLayer`。パック（`.pack`＝🍬柄の包装・点線の切り取り線／11連は「11連パック」表示）が登場して待機→**タップ `ripPack()` でギザギザに2分割（`clip-path`）して上下に飛ぶ＋砂糖バースト `packBurstFx()`**→`revealPackItems(arr)` で中身を表示（1件＝大カード／複数＝`packItemMini` のグリッド＋NEW/重複の集計）。`もう一度`=`packOpenAgain`（直前と同じ種類）／`とじる`=`closePackOpen`。ロジック（`openPackOnce`）は不変＝ヘッドレステストに影響なし。
- **排出内容モーダル**：ショップの「📋 排出内容を見る」→`openPackPool()`→`#poolModal`（`renderPackPool`＝プールを読み取り専用で一覧・所持✓/未所持マーク）。**ショップからは所持一覧/装備UI（旧`renderCollection`）は撤去し、装備はプロフィール編集(`renderProfileCosmetics`)に一本化**。
- **初入手 vs 重複**：`alreadyHave(item)`（`ownsCollected`）で判定。初入手→`myProfile.collected[id]` に加算して**解禁**。**重複→そのアイテムのテーマキャラ(`unit`)の熟練度XPに変換**（`addMasteryXp`・`PACK_DUP_XP`=25／重複で熟練度が早く進む助け）。
- **見た目3種（絵素材不要・CSS/テキスト）**：`FRAMES`（アイコン装飾枠＝box-shadow）／**二つ名＝`TITLE_PRE`（前半）＋`TITLE_SUF`（後半）を1つずつ組み合わせて作る**（`titleText()`＝装備中の前半＋後半・`titleTextOf(pre,suf)`＝任意組み合わせ）／`NAME_COLORS`（名前の色・グラデ）。各行に `unit`（テーマ表示用）。装備は `myProfile.frame/titlePre/titleSuf/nameColor`＋`equipFrame/equipTitlePre/equipTitleSuf/equipNameColor`（トグル・所持のみ）。表示は**自分のプロフィールチップ**（`renderProfileChip`）＋**プロフィール編集の見た目UI**（`renderProfileCosmetics`＝#authModal内・**開閉メニュー(アコーディオン)**＝カテゴリ(フレーム/前半/後半/カラー)ごとにヘッダーをタップで開閉・`_cosmOpen`/`toggleCosmeticSection`・ヘッダーに現在の選択を表示・持っているアイテムから選ぶ＋二つ名プレビュー）＋VSカットイン。二つ名パーツはガチャ排出（`packPool` が `titlePre`/`titleSuf` を出す・`renderCollection` は前半/後半の2セクション）。
- **アイコン/スキンは熟練度のみで解禁**（ガチャ非排出）：`avatarUnlocked`/`skinUnlocked` は熟練度Lvで判定（`ownsCollected` fallbackは残すが、パックがそれらを配らないので実質使わない）。フレーム/二つ名パーツ/ネームカラーを増やすときは各配列（`FRAMES`/`TITLE_PRE`/`TITLE_SUF`/`NAME_COLORS`）に1行足すだけでパックプール・コレクション画面（`renderCollection`）・プロフィール編集の見た目UIに自動反映。アイコン/スキンを増やすときは `SPRITE_DATA` 注入＋`SPECIAL_AVATARS`/`SPECIAL_SKINS`（熟練度ロードマップに反映）。
- **保存**：`coins`/`collected`/`frame`/`title`/`nameColor`/`dailyWinKey` を `saveProfileLocal`（端末）＋`buildProfile`/`applyProfile`（クラウド）に統合。マージは coins=大きい方・collected=個数の大きい方（進捗が消えない割り切り）。
- **UI**：ホームメニュー「🎁 ショップ」＋ホームのコイン表示（クリックでショップ）→ `#shopModal`（`openShop`/`closeShop`/`renderShop`＝大きい「パックを開ける(120)」「11連を開ける(1200)」＋「📋排出内容を見る」）。

## 継続ログイン報酬（毎日ログインでコイン＋累計日数で見た目解禁・実装済み・`<script>`「13.55) 継続ログイン報酬」）

**目的**：戻ってくる理由を作って定着を上げる。**コインは【連続ログイン日数】でスケール**（途切れたら1日目に戻る・7日で頭打ち）、**見た目のマイルストーンは【累計ログイン日数】で解禁**（一日休んでもリセットされず積み上がる＝誰でもいつかは到達＝格差最小・見た目だけ＝対戦はフェア）。テスト：test.js 115。

- **状態**：`myProfile.login`＝`{last,streak,best,total}`（`last`=最後にログインした日キー・`streak`=連続日数・`best`=最高連続・`total`=累計日数）。`saveProfileLocal`/`buildProfile`/`applyProfile` に統合（マージ＝累計 `total` が大きい方の `last`/`streak` を採用＋`best`は最大＝進捗が消えない）。
- **毎日のコイン**：`loginCoinReward(streak)`（純粋関数）＝`LOGIN_COIN_BASE`(15)＋`(streak-1)*LOGIN_COIN_STEP`(5)、`LOGIN_COIN_MAX`(45・連続7日で到達)で頭打ち。
- **チェックイン**：起動時に `loginCheckinAndShow()`→`loginCheckin()`。`computeLoginUpdate(prev,today,yesterday)`（純粋関数）で当日ぶんを判定（`last===today`なら二重付与しない＝`changed:false`／昨日ログイン済みなら連続+1／間があいたら連続1に戻す・累計は+1）。日付キーは `todayKey()`/`yesterdayKey()`。新しい日ならコイン付与＋`grantLoginMilestones(total)` で到達済みマイルストーンを `collected` へ解禁し、`showLoginModal(res)` を表示（**チュートリアル中は表示を抑制＝コインは付与済み**）。
- **マイルストーン（累計日数→見た目）**：`LOGIN_MILESTONES`＝7日フレーム(`frame_login7`)／**10日アイコン(`ava_login10`)**／30日 二つ名「まいにち王さま」(`tp_everyday`+`ts_king`)／50日 レインボーネーム(`nc_login50`)／**100日アイコン(`ava_login100`)**。各コレクション配列（`FRAMES`/`TITLE_PRE`/`TITLE_SUF`/`NAME_COLORS`/`SPECIAL_AVATARS`）に **`login:N` を付けた項目**として定義。
  - **ガチャ非排出**：`login` 付きは `packPool()` と `renderCollection()`（排出一覧）から除外＝**継続ログインでのみ入手**（見た目の入手経路を分離）。装備は通常どおり `ownsCollected` 経由（`renderProfileCosmetics`）。
  - **記念アイコン**：`avatarUnlocked()` は `login` 付きアバターを **累計ログイン日数(`myLoginTotal()`)** で解禁（`renderAvatarGrid` はロック中「N日」バッジ＋累計進捗をツールチップ表示）。熟練度ロードマップ(`masteryDetailHTML`)には `lvl` 未設定なので出ない。**アイコン画像 `ava_login10`/`ava_login100` は仮の自動生成プレースホルダ（128×128・Chromium合成）を `SPRITE_DATA` に注入済み。ユーザーが本番絵に差し替え予定**（差し替え時は同idの128px PNGを `SPRITE_DATA` に再注入するだけ）。
- **UI**：ホームメニュー「📅 ログインボーナス」＝`openLoginInfo()`→`showLoginModal(null)`（現在の連続/累計＋ロードマップ `loginRoadmapHTML()`）。日替わりの受け取りは起動時の自動ポップアップ（`#loginModal`）。
- **調整**：`LOGIN_COIN_*`（コイン曲線）と `LOGIN_MILESTONES`（解禁日数・種類）＋各配列の `login:` 値。

## 広告（リワード動画＝広告を見て🍬・受け皿のみ実装済み・`<script>`「13.52) 広告」）

**方針**：一般向け。**任意で見るリワード動画のみ**（強制割り込みなし＝子ども向けでも受け入れやすく経済にも素直）。収益化の第一歩。**未設定なら一切表示しない＝CPU/PVP・既存プレイに完全無影響**（Firebase設定と同じ「キーを貼るだけ」方式）。テスト：test.js 116。

- **設定**：`AD_CONFIG={network,id}`（既定は `PASTE_` プレースホルダ＝未設定）。ユーザーが広告ネットワーク（**方針＝Google AdSense H5 Games Ads を採用**。他に GameMonetize / GameDistribution）でアカウント作成→キーを貼る。**Web用H5広告なので Androidアプリ(TWA)・iOSブラウザ両方に同じコードで効く**（AdMobネイティブSDKはTWA/ブラウザ不可）。
- **本番ホスト限定（環境分離）**：`AD_PROD_HOST`（既定 `PASTE_PROD_HOST`）＝本番の独自ドメイン名。広告は `adsEnabledHere()`＝`adsConfigured() && isAdProdHost()`（`location.hostname===AD_PROD_HOST`）が真のときだけ表示。**テスト環境（GitHub Pages `*.github.io`）やローカルでは常に広告OFF**＝AdSense等の未承認ドメイン表示・無効トラフィックを防ぐ。運用は「本番＝独自ドメイン(Cloudflare Pages等)／テスト＝GitHub Pages」。ドメイン購入後に `AD_PROD_HOST` と `<head>` OGP・`SHARE_URL` を本番ドメインへ差し替える（共有/招待リンクは実行時 `location` 生成なので差し替え不要）。
- **SDK差し込み口**：`adNetworkPlay(onReward,onClose,onError)` の1箇所だけを各社に合わせて書き換える（未接続は `onError('SDK未ロード')`＝呼び出し側が「準備中」表示）。抽象は `showRewardedAd({onReward,onClose,onUnavailable})`＝ここにだけ対戦本体は依存しない。
- **報酬と上限**：`AD_REWARD_COINS`(30)＝1本の🍬／`AD_REWARD_DAILY_CAP`(5)＝1日の上限回数（荒稼ぎ防止）。日次カウントは `myProfile.adReward={day,count}`（`grantAdReward` が付与・`todayKey()` で日替わりリセット）。純粋関数 `adRewardState(profile,today)`＝`{used,remaining,capped}`（テスト対象）。保存/クラウド同期は save/build/apply に統合（同日は大きいカウントを採用）。
- **UI**：`#shopModal` の「🎬 広告を見て🍬をもらう」ボタン（`watchAdForCoins`／`renderAdButton` が残り回数表示・上限で無効化・未設定で非表示）。
- **要ユーザー作業**：①広告ネットワークのアカウント作成→`AD_CONFIG` にキー、②`adNetworkPlay` にSDK呼び出しを実装、③（審査用に）独自ドメイン推奨。**性能・対戦バランスには一切関与しない（見た目/コインのみ＝対戦は常にフェア）**。

## キャラ解禁（スターター＋🍬シュガーコイン・実装済み・`<script>`「13.6) キャラ解禁」）

**方針（①=全モード解禁制を採用）**：スターターを実用的な数にし、コインは無料で貯まる（指南クリア＋対戦報酬）ので、初心者でもすぐ4枚デッキを組めて、いつかは全員そろう＝格差を最小化。将来は課金でのコイン購入も想定。テスト：test.js 92。

- **スターター**：`STARTER_UNITS`＝`cookie/slime/bomb/choco/shoe`（前衛/タンク×2/自爆/遠距離の5体）は最初から使える。※ソーダは自爆がbombと被るため外し、戦術指南の「沼レッスン」で解禁する。
- **解禁状態**：`myProfile.units`（解禁済みキャラのkey配列）。`unitUnlocked(key)`＝召喚専用は非対象／スターター／units に入っていれば真。`lockedUnits()`＝まだロックのkey一覧。
- **通貨は🍬シュガーコインのみ**（`myProfile.coins`／`myCoins()`）。対戦報酬 `grantBattleReward` は `battleCoinReward`＝`COIN_PLAY`(10)＋`COIN_WIN`(15)＋`COIN_DAILY_WIN`(50・初勝利)を付与。※旧`gems`/`myGems`/`GEM_*`/`battleGemReward`は廃止。
- **解禁手段**：戦術指南クリア（下記）＋`buyUnit(key)`（🍬で直接購入・`unitUnlockCost`=一律500）。`unlockUnit(key)` が units に追加。
- **編成のゲート**：`toggleDeck` は自分の編成（`rosterMode==='you'`）で未解禁キャラをタップすると**解放モーダル `#unlockModal`（`openUnlockModal`）**を開く＝①🍬シュガーコイン`unitUnlockCost`(500)で解放（`unlockByCoins`→`buyUnit`・残高不足はトースト）／②戦術指南で解放（`unlockByGuide`→`guideArcForUnit(key)` でそのキャラを解禁するアークへ `openGuide`＋`openGuideArc`）の2択を提示。`renderRoster` はロックキャラに🔒＋🍬コストのオーバーレイ（`.rlocked`/`.rlock`）。レッスン編成(`guide`)は従来どおりトースト。CPUデッキ編成はゲートしない。`guideArcForUnit`＝`arcUnit(a)===key` のアークを返す純粋関数（全ロックキャラに対応アークがある＝test.js 99）。
- **既存救済**：`migrateUnlocks()`＝**本デッキ**（`realDeck()`）に入っている非スターターは解禁済み扱い（起動時＋クラウド復元後に呼ぶ）＝新システムでデッキが壊れない。**`realDeck()`＝レッスン中は退避した本デッキ(`_guideDeckBackup`)を返す**（保存 `saveDeckLocal`/`buildProfile` も同様）＝**レッスン用デッキ（未解禁の学ぶキャラを含む）で誤って解禁/保存されるのを防ぐ**（「クリアしていないのにキャラが解放される」不具合の修正・test.js 109）。
- **保存**：`units`/`guideDone` を `saveProfileLocal`＋`buildProfile`/`applyProfile` に統合（和集合マージ）。コインは経済側で保存。

## PVE 戦術指南（ステージ制レッスン・実装済み・`<script>`「13.7) PVE 戦術指南」）

ユーザー要望の「PVEの戦術指南でカードを入手→その後ガチャ」の前半。各レッスン＝1テーマを実戦で学び、**勝利で仲間（キャラ）解禁＋🍬シュガーコイン（初回のみ）**。キャラ（アーク）は自由選択・アーク内のみ順番制。テスト：test.js 93。

- **データ**：`GUIDE_STAGES`（`{id,title,theme,tip,deck,foe,unit?,coins}`）。`deck`＝レッスン用おすすめデッキ（学ぶキャラを含めて体験させる）、`foe`＝相手デッキ、`unit`＝クリア報酬キャラ（**省略可**＝体験型レッスン。コインのみ）、`coins`＝報酬🍬（**統一ルール：キャラ解禁レッスン=100／体験(それ以前)=50**。test.js 93で担保）。**アーク方式**：複数レッスンで1キャラを解禁できる（`unit`は最終レッスンだけに付け、途中は`unit`省略でコインのみ＝「近道(`buyUnit`)」の価値を出す）。**現在17レッスン**：非スターターの全キャラ（donut=`front`のみ単発）＋ソーダ（`soda1`→`soda2`）＋アイス（`ranged1`→`ranged2`）＋大福（`charge1`→`charge2`）＋ゴースト（`warp1`→`warp2`）＋キャノン（`aoe1`→`aoe2`）＋ベーカリー（`produce1`→`produce2`）＋パンケーキ（`evolve1`→`evolve2`）＋マカロン（`shell1`→`shell2`）を無料解禁できる＝誰でもPVEを進めれば全員そろう（対人も公平）。🍬は「レッスンを待たずに先に解禁する近道」として任意利用。test.js 93 が「全非スターターキャラがレッスンで解禁できる」ことを保証（新キャラを足したらレッスンも追加する）。
- **アークごとに自由選択＋アーク内は順番制**：`stageArc(s)`＝`arc`明示→`unit`→`id` でアーク（キャラ）を判定。`guideStageUnlocked(id)`＝各アークの先頭レッスンは常に挑戦可（好きなキャラから選べる）、アーク内のレッスン2以降は同アークの前レッスンを `guideCleared` していれば解禁。単発アーク（1レッスン）は常に選べる。
- **メニューは2階層**（`guideView` = `arcs`/`arc`）：`openGuide`→`renderGuide` が**キャラ一覧**（`guideArcs()`＝アーク単位・進捗 `cleared/total`）を表示→キャラを選ぶと `openGuideArc(a)` で**そのキャラのレッスンを縦に並べて**表示（`arcStages(a)`／上から順番）。`arcUnit(a)`＝アーク代表キャラ。`guideBackToArcs()` で戻る。
- **キャラ紹介ダイアログ（クッキーじい）**：`GUIDE_INTRO`（unitKey→クッキーじいのセリフ）。**アークの先頭レッスンでだけ**、`startGuideStage` が `#guideTipModal`（ヒント）の前に `showGuideIntro(学ぶキャラ)` を出す（`.tut-bubble`流用の `#guideIntroLayer`・立ち絵`tut_gramps`＋「◯◯ のとくちょう」タグ＋セリフ）。「つづける」で `guideIntroContinue()`→ヒントへ／「とじる」`closeGuideIntro()`＝一覧へ戻る。文言は今後1体ずつ調整（test.js 107＝学ぶ全キャラにセリフがあることを担保）。
- **フロー**：レッスンタップ→`startGuideStage`（先頭レッスンは紹介ダイアログ→）`#guideTipModal` でヒント→**デッキ編成**`guideOpenDeckBuilder`（`rosterMode='guide'`＝学ぶキャラ `forceUnit`（`stage.forceUnit`→`unit`）を先頭に**強制**・外せない／残りは**解禁済みキャラ**から選ぶ／`stage.deck` の解禁済みをプレフィル／`rosterSub` に**相手のデッキ**をアイコン表示＝対策を組める）→「レッスン開始」`beginGuideStageBattle`＝`myDeck`をその編成にして `startGame`。**相手は `makeGuideFoeController(stage.foe)`＝デッキを round-robin で確実に出す**（貪欲AIだと弓兵など弱い後衛が出ないため／`guideRestoreDeck` で `makeCpuFoeController` に戻す）。**本デッキは `_guideDeckBackup` に退避**（保存しない＝本デッキ不変）。`guideCancelDeck`/`goHome` で復元。
- **レッスン1系の易化フラグ（任意・per-stage）**：`easyFoe:true`＝そのレッスンはCPUが強化/X2を取らない（`guideEasyFoe()` が `foeMatchEnhance` を無効化）。`winRounds:N`＝相手から N ライフ取った時点でクリア（`endBattle`／`endGame` で判定。例：soda1 は `easyFoe`+`winRounds:1`）。
- **決着**：`endGame` の `guideMode` 分岐→`guideWon`（`winRounds`指定は「規定ライフ取ればクリア」／通常は `foeLives<=0`）→`guideFinish(guideWon)`。**報酬は初回クリアのみ**＝`guideFinish` が初回だけ `guideDone` 記録＋`unlockUnit`（`unit`があれば）＋stage💎付与、さらに `endGame` が初回のみ `grantBattleReward`（🍬シュガーコイン）を付与（再挑戦・敗北は無報酬）。over画面は `#overGuideBtns`＝（同アークに次があれば）**▶次のレッスンへ**（`guideNextLesson`/`guideGoNext`＝次レッスンの編成へ直行）/🎓指南へ戻る/🏠ホームへ。
- **入口**：ホームメニュー「🎓 戦術指南」。

## オンライン人数（presence・実装済み）

- 起動時に `pvpPresenceJoin()`＝**匿名サインイン**して `presence/<uid>={status,ts}`（`onDisconnect().remove()`）。`presence` を購読し `presenceCounts(obj)`（純粋関数・test.js 73）で集計→「🟢 オンラインN人・マッチ待ちW人・対戦中M人」をホーム/PVPロビーに表示（`renderPresence`）。マッチ待ち=`status:'matching'` の数。
- 状態遷移 `pvpPresenceSet`：起動/退出='home'、ランダムマッチ='matching'、対戦開始(`pvpStartAsHost`/`pvpGuestEnterPlay`)='battling'。
- **バックグラウンド放置は数えない**：`pvpInitVisibility()` が `visibilitychange` を監視し、タブを隠して `PRESENCE_AWAY_MS`(45秒)経つと `pvpSetAway(true)`＝presenceに `status:'away'` を書く。復帰で即 `away` 解除。`presenceCounts` は `status:'away'` を**オンライン/対戦中どちらにも数えない**（＝ブラウザを裏で開いているだけの人を除外）。`pvpPresenceSet` は論理状態(`pvpCurStatus`)を保持しつつ、away中は生の書込 `pvpPresenceWrite('away')` に切替える。テスト：test.js 73（away除外）。
- 匿名は「未ログイン扱い」（`updateAuthUI` は `!isAnonymous` で判定）＝ログイン誘導は残す。`leaderboardSubmit` は対戦経験者(`wins+losses>0`)のみ＝匿名の空エントリでランキングを埋めない。
- **要設定**：RTDBルールに `presence`（read:auth!=null・$uidのみwrite）＋匿名認証有効化。`FIREBASE_SETUP.md` 参照。

## アカウント＆クラウド保存（実装済み・`<script>`「13) アカウント…」）

- **Firebase Auth（Google＋メール/パスワード）でログイン**。`firebase-auth-compat.js` を追加読み込み。
- 保存対象は **デッキ(`myDeck`)＋プロフィール(ニックネーム`name`/アイコン`avatar`=ユニットkey)＋チュートリアル進捗** を `users/<uid>/profile`（RTDB）に保存。音量はデバイス個別なので**同期しない**。
- **プロフィール**（`myProfile`）：対戦相手に見せる名前＋お菓子アイコン。`#authModal` のプロフィール欄で設定（`saveProfile`/`renderAvatarGrid`）。未ログインでも端末(localStorage `sw_profile`)に保存。`displayProfile()`＝空欄を既定（ゲスト名/先頭アイコン）で補完。ランダムマッチ（次段）で使用。
- `buildProfile()`/`applyProfile()`＝保存データの整形（純粋関数・不正/召喚専用キーは除外・最大`deckSize`枚）。test.js 68。
- `saveDeckLocal()`/`loadDeckLocal()`＝未ログインでも端末(localStorage `sw_deck`)にデッキ保存。`persistDeck()` を `toggleDeck`/`removeDeckSlot`（自分デッキ時）でフック。
- `authInit()`＝起動時に `onAuthStateChanged` 監視開始。ログイン時 `onSignedIn` がクラウド読込→適用（無ければ端末内容をアップ）。`scheduleCloudSave()` でデバウンス保存。**クラウド保存は本ログイン(`isRealUser()`＝非匿名)のみ**＝ゲスト(匿名)は端末(localStorage)だけに保存し、ログイン/連携で本アカウントのuidに移ったときにクラウド同期する（匿名uidのゴミノードを作らない）。
- **保存の保留ガード（データ消失防止・重要）**：`_cloudSyncReady` が `true` になるまで `scheduleCloudSave()` は保存しない。ログイン直後は `onSignedIn` の**クラウド読込→反映が完了してから** `true` にする（新規=アップロード後／復元=applyProfile後／食い違い=ユーザーが選んでから／読込失敗=再開）。**ログイン直後にデッキ編集や対戦決着の保存が先に走って、初期値(1000/0)でクラウドを上書きしてしまう競合を防ぐ**（＝「ログインしたら急にトロフィー1000・勝敗0にリセット。熟練度だけ残る」旧不具合の残り経路を封じる）。
- **ログイン時の同期（データ消失防止・重要）**：`onSignedIn` は `_syncedUid` で同一uidの多重処理を防ぎ（タブ復帰などで二重にならない）、`profileHasProgress()`/`profilesConflict()`（純粋関数・test.js 91）で分岐：
  - クラウドに記録なし → 端末（ゲスト）の内容をアップロード（`seedNameFromAuth`＝名前が空ならGoogle表示名を初期値に）。
  - 端末に記録なし/実質同一 → クラウドを復元。
  - **両方に記録があり食い違う** → `showSyncConflict()` で確認ダイアログ（`#syncModal`）「☁ クラウドを呼び出す／📱 この端末で上書き」を出し、`syncUseCloud`/`syncUseLocal` で選んだ方に統一。**「ログインしたらトロフィー/勝利数が勝手にリセット」される旧バグ（デッキ空を新規と誤判定して端末の空データで上書きしていた）を修正**。
  - `saveProfileLocal()`/`loadProfileLocal()` は **トロフィー/best/勝敗/usage/skins も端末保存**（旧はname/avatar/masteryのみ＝ゲスト戦績がリロードで消えていた）。
- Googleは `signInWithPopup`、失敗時（モバイルWebView等）は `signInWithRedirect` に自動フォールバック。
- **アカウント連携（ゲスト→本登録）**：匿名(`isAnonymous`)中にログインすると `linkWithPopup`/`linkWithCredential` でuidを保持したまま昇格＝**ゲストのトロフィー/デッキを引き継ぐ**。`auth/credential-already-in-use`（既存アカウント）の時は通常 `signInWithPopup` に切替（その分は引き継がれない）。
- **メール＋Googleの2アカウント化を防ぐ**：`auth/account-exists-with-different-credential`（同じメールが別プロバイダで登録済み）を `handleGoogleEmailClash()` で捕捉＝Google認証情報を `_pendingGoogleCred` に退避し「そのメールでログインしてください」と案内→`authEmailLogin` 成功時に `linkWithCredential` で**同一アカウントにGoogleを連携**。ただし完全解消には**コンソール設定「メールアドレスにつき1アカウント」が必須**（`FIREBASE_SETUP.md` A-2章）。
- UIは `#authModal`（メニューの「👤 ログイン」から `openAuth`）。未設定/未ログインでも従来どおり動作。
- **要ユーザー作業**：コンソールでGoogle/メール認証を有効化・**「メールアドレスにつき1アカウント」に設定**・承認済みドメイン登録・RTDBルールに `users/$uid`（`auth.uid===$uid`）追加。手順は `FIREBASE_SETUP.md`「ログインとクラウド保存」。

## 利用状況の計測（GA4＝Firebase Analytics・実装済み・`<script>`「track()」）

- `firebase-analytics-compat.js` を追加。`getAnalytics()`＝遅延初期化（未設定/ヘッドレスはno-op）。`track(name,params)` でイベント送信。PIIは送らない。
- 送信イベント：`battle_start{mode}`／`unit_in_deck{unit,mode}`（デッキ構成＝使用率）／`unit_pick{unit}`（ドラフト選択＝使用率）／`battle_end{mode,result}`／`tutorial_complete`／`random_match_start`・`random_match_connected`・`random_match_failed`（マッチ成立/接続健全性）／`pvp_matchup{type,ranked}`（端末組み合わせ＝`pc_pc`/`pc_mobile`/`mobile_mobile`/`unknown`。**親側から1回だけ**送信＝1対戦1件で重複なし。A案=サーバー権威型の要否判断に使う。`pvpMatchupType()`・test.js 84）。
- 計測点：`startGame`（cpu/tutorial）・`pvpStartAsHost`/`pvpGuestEnterPlay`（pvp）・`endBattle`・`pickCard`・`endTutorial`・`randomMatchStart`/`mmConnState`。
- **要確認**：Firebaseプロジェクトで Google Analytics 連携が有効なこと（`FIREBASE_CONFIG.measurementId` があれば連携済み）。GA4のDebugView/リアルタイムでイベント確認。キャラ別の正確な実数が要るなら将来 GA4→BigQueryエクスポート（無料）かRTDB集計カウンタ。

## シェア＆招待（新規プレイヤーを増やすバイラル導線・実装済み・`<script>`「シェア＆招待」）

**目的**：人が少ないので「今いる人が友達を連れてくる」導線を作る。3点セット。

- **OGP / Twitterカード**：`<head>` に `og:*`／`twitter:*` を追加。SNSやLINEにURLを貼ると**画像＋説明のリッチプレビュー**が出てクリック率が上がる。共有画像は `og-image.png`（1200×630・`icon-src.png` のポップコーンをChromiumで合成）。**公開URLは絶対URL必須**＝`SHARE_URL`（既定 `https://negiramen1922.github.io/sugarwars-test/`）と `<head>` の `og:url`/`og:image`/`twitter:image` を**独自ドメイン移行時に合わせて変更**。SWの `CACHE` は `v4`・SHELLに `og-image.png` を追加済み。
- **結果シェア**：対戦決着画面（`overDefaultBtns`＝CPU/ランダムPVP。プライベートは再戦UI優先で非表示）に「📣 結果をシェア」＝`shareResult()`→`shareText()`。**Web Share API →無ければX投稿画面→最後にクリップボード**にフォールバック（環境非依存）。文言は純粋関数 `shareResultText(won,trophies)`（勝敗＋トロフィー。`_lastResultWon` は `endGame` で更新）。
- **招待リンク**：プライベート部屋のホスト画面に「🔗 招待リンクをシェア」＝`pvpShareInvite()`。`roomInviteUrl(base,code)`＝`base?room=CODE`。受け取った人がリンクを開くと起動時 `pvpMaybeJoinFromUrl()` が `parseRoomCode(location.search)`（4文字[A-Z0-9]のみ有効）で拾い、デッキ4枚チェック→プライベート参加フローへ直行して自動接続（チュートリアル中・Firebase未設定・URL掃除まで面倒を見る）。
- 純粋関数 `shareResultText`/`roomInviteUrl`/`parseRoomCode` はヘッドレス検証（test.js 114）。実シェア/実接続は要実機。

## 次の候補タスク（未着手・要相談）

- **経済Phase 3（コインショップ）**：全キャラはレッスンで無料解禁できるので、🍬の用途は「**近道**」。UI（`buyUnit` を呼ぶ「先に解禁」ボタン＝まだ到達していないレッスンのキャラを🍬で先取り）を足すだけ。
- 戦術指南のレッスン追加・数値/順番の調整（`GUIDE_STAGES`）。
- PVP **F2**（Firebase+WebRTCで実接続）→ **F3**（自動マッチング）。
- 各キャラの固有強化（X2以外の派手な効果）の追加。
- flock の効果検証・他キャラへの相乗効果。
- 立ち絵の追加・差し替え（ユーザーがPNGを置いて「`SPRITE_DATA` の○○を差し替えて」と依頼）。
