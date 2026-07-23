# SUGAR MARCH（nyanko.html）設計メモ

にゃんこ大戦争風スピンオフ `nyanko.html`（テンプレ `nyanko.tpl.html` → `build_nyanko.js` で生成）のメタ進行・強化まわりの設計メモ。**あとから参照するための覚え書き**。

## メタ進行（EXP）— 実装済み

- **EXP（`save.exp`）**：ステージクリアで獲得する恒久通貨。`stageExp(s, first)` ＝初回 `600 + id*100`（1-2面で計約1500）/ 再挑戦 `120 + id*20`。決着 `win()` で付与。
- **🍬コイン（`save.coins`）**：ガチャ専用（`partycookie`/`bigslime`）に残置。ステージ初回で従来どおり付与。
- **キャラ解放**：`buyUnit(k)` が **EXPを消費**。`UNLOCKS[k].need`（クリア済みステージ数）以上で解放可＝**ステージを進めるほど解放できるキャラが増える**（`unlockAvailable`）。コストは `UNLOCKS[k].cost`（EXP）。
- **サイフ／タワーの恒久強化**：`UPG`（下記）を EXP で1Lvずつ購入（`buyUpgrade` / `renderUpgrade` / ホーム「⚙ 強化」）。`save.upg[track]` にLvを保存。
- **キャラ別レベル（にゃんこの「にゃんこ強化」相当）**：`save.lv[key]`（1〜`CHAR_LV_MAX`=20）を EXP で1Lvずつ上げると **HPと攻撃が `CHAR_LV_STEP`(8%)ずつ上昇**（`charLvMul`）。`newUnit` が自軍(side'p')のみ hp/atk に倍率を掛ける（敵は対象外）。レベルUPコスト `charLvCost`＝`(25+出撃コスト×0.3)×1.35^(lv-1)`＝**高コストキャラほど強化も重い**。UIは **なかま一覧のキャラをタップ→キャラ詳細ダイアログ**（`openCharDetail`/`renderCharDetail`）＝立ち絵・特徴（`UNIT_DESC`）・性能（コスト/HP/攻撃/射程/移動/攻撃速度/再出撃）・レベルUPボタンを表示。見た目でなく**性能に効く恒久強化**（サイフ/タワーと同じEXP経済の追加シンク）。
- **なかま一覧の構成（`renderCollect`）**：**2セクション**＝「📦 ノーマル」（進捗で解放＝`UNLOCKS[k].via!=='gacha'`＋スターター）／「🎰 ガチャ限定」（`via==='gacha'`）を見出し＋区切り線で分けて表示。**未開放キャラは「？」カード**（立ち絵・名前を伏せて `？`／`？？？`＋解放条件だけ）。タップで詳細＝**解放済＝性能/レベルUP・未開放＝「？？？」＋解放方法だけのミステリー表示**。
- **通貨アイコン**：🍬絵文字はすべて **ドット絵キャンディ画像**（`CANDY_URI`→CSS `.candy`／`CANDY`／`candyify`／Canvas用 `CANDY_IMG`）に置換。差し替えは `CANDY_URI` のbase64を替えるだけで全箇所反映。
- **進捗リセット（テスト用）**：ホームの「🗑 進捗をリセット」＝`resetProgress()`＝`confirm` 後に `save` を初期化（EXP/コイン/解放/レベル/クリア状況を全消去）＝難易度・進行の検証用。

### サイフ（にゃんこ式の固定テーブル）

にゃんこ大戦争の「働きネコ（お財布）」に寄せた設計＝**財布Lvごとに固定の最大貯金**を持ち、バトル中に🍬を払ってLvを上げる。メタ強化(EXP)は「開始Lv」と「上限Lv」と「生産速度」を伸ばす。
- **`WALLET_CAPS = [100,200,300,400,500,600]`**：財布Lv0〜5の最大貯金（最初期＝100・`effCap()`＝現在Lvのテーブル値）。
- **`wMax`（最大貯金）メタ**：500の先に上限Lvを +100🍬 ずつ追加（`walletCapTable`／`walletMaxLv`）。
- **`wStart`（初期Lv）メタ**：バトル開始時の財布Lvを上げる（`reset` で `walletLv=walletStartLv()`）。開始🍬も `CONF.moneyStart + walletLv*40`。
- **バトル中UP**：`upgradeWallet`（🍬で1Lv上げる）。費用 `walletCost()=今の上限×0.75`（にゃんこ式＝ほぼ貯金を使って上げる）。
- **`wRate`（生産速度）**：`effRate()=upgVal('wRate')+財布Lv*CONF.walletRateStep`。

### 強化トラック `UPG`（`upgCost`=c0×1.55^Lv / 最大Lv=max。wStart/wMaxは`valFn`でテーブル値）

| track | 名前 | 値 | max | 効果の接続先 |
| --- | --- | --- | --- | --- |
| `wStart` | サイフ 初期Lv | 50/100/200/300/400/500 | 5 | 開始時の財布Lv＝開始上限 |
| `wMax` | サイフ 最大貯金 | 500,600,700… | 6 | 財布UPの上限Lv（+100ずつ） |
| `wRate` | 生産速度 | 20+5/Lv | 8 | `effRate()` の基礎🍬/秒 |
| `tHp` | タワーHP | 1600+450/Lv | 8 | 自城HP（HPバー分母 `myMaxHP`） |
| `tPow` | タワー攻撃力 | 120+55/Lv | 8 | `castTower` の威力 |
| `tRng` | タワー射程 | 440+80/Lv | 6 | 届く距離。**開幕チャージ切れ**（`reset` で `towerCd=CONF.towerCd`）。base=中央ちょい自陣寄り(minX≈520)／MAX=敵城の目の前(minX≈40)。**`render` が射程ラインを描画**（ピンクの点線＋💥ラベル） |

## タワーの派生要素（砲の種類）— **未実装・設計考察**

にゃんこの「にゃんこ砲」＝1種類を強化していくのに加え、後半で**別系統の砲（スロー/波動/鉄壁破壊/雷撃/貯金…）に派生**して撃ち分けられる。SUGAR MARCH でも **タワー攻撃(`castTower`)に「種類」を持たせる**構想。以下は候補と実装方針の覚え書き。

### 砲タイプ候補（お菓子テーマ）
| タイプ | 効果 | 既存資産の流用 |
| --- | --- | --- |
| **ノーマル**（現状） | 射程内の敵にダメージ＋左へノックバック | `castTower` そのまま |
| **スロー砲**（キャラメル） | 命中した敵を数秒鈍足（`slowT`/`slowMul`） | アイスの `slowHit` と同じ仕組み |
| **こおり砲**（アイス） | 命中した敵を数秒停止（動けない） | 新規（`u.freezeT` を step で参照） |
| **どく沼砲**（チョコ） | 着弾地点に継続ダメージの沼 | ソーダ/沼系（本家 `puddle`）を移植 |
| **波動砲**（ラムネ） | 射程内を貫通する太いビームで多段 | 現行ビーム演出を強化 |
| **ふきとばし砲** | ダメージ控えめ・KB特大で totale 押し戻し | `applyKnock` の距離を大きく |
| **ちょきん砲** | 撃破時に🍬ボーナス（経済型） | `killUnit` フックでお金加算 |

### 実装方針（後日）
1. `save.upg.towerType`（既定 `'normal'`）＋ **タイプ解放を EXP で**（`TOWER_TYPES` 配列。各タイプに `unlockExp`）。
2. `castTower` をタイプで分岐：ダメージ/KB/付与効果（slow/freeze/poison）を差し替え。共通ステータス（`tHp`/`tPow`/`tRng`）はそのまま効かせ、**タイプ固有ステータス**（例：スロー時間、こおり時間、沼dps）は各タイプ用の `UPG` トラックを追加。
3. UI：強化画面に「タワー砲の種類」セクションを追加し、解放済みタイプから**装備を1つ選択**（`equipTowerType`）。バトル中の右下ボタンは装備中タイプで撃つ。
4. バランス：タイプは**性能の上下でなく“役割の違い”**にする（対集団=波動/沼、対タンク=ノーマル高火力、足止め=スロー/こおり）＝どれを選んでもフェアに。
5. 派生ツリー案：`normal → slow → freeze`（足止め系）と `normal → wave → poison`（範囲系）の2系統に枝分かれ。片方を伸ばすほど反対系統の解放コストは据え置き（両取りは高EXP）。

> まずはメタ強化（サイフ/タワーの数値）を回して、砲タイプは反応を見てから着手予定。着手時はこの節を仕様の起点にする。

## 敵の立ち絵スプライト — 実装済み
- **画像で描く敵**：`FOE_DEFS` に `spr:'<key>'`（`mold` なし）を持たせると、`drawUnit` が `drawFoeSprite`（足元アンカー・吹き飛び回転）で**画像**を描く（従来の手描き `drawMold` はそのまま併存）。単一画像＝陣営サフィックスなし。スプライトは `nyanko.tpl.html` の `Object.assign(SPRITE_DATA,{…})` に128px base64で注入（白背景を境界フラッドフィルで透過→クロップ→正方パディング→NEAREST）。
- **敵ザコの役割（味方の並びに対応させたシンプルな4段）**：複雑な固有効果は付けず、役割を数値と挙動で整理。
  - **①`m_bump`（ホコリだま・白もこもこ）**＝雑魚1・基本前衛（安い数押し・味方のクッキーナイト相当）。
  - **②`m_neba`（ネバモチ）**＝雑魚2・**タンク**（HP230・足遅い52・plain）。シロカビの前でHPを盾に。旧`m_thorn`/`m_armor`の役割を集約。
  - **③`m_gspike`（トゲミドリ・緑）／③'`m_thorn`（イガまる・シロトゲ・白）**＝どちらも**「単体→単体→ジャンプ範囲」のループ攻撃**（`slam:{r}`＋`slamEvery:3`＝3回に1回だけ範囲＝毎回範囲は強すぎるため）。トゲミドリ6面から／イガまる11面（最初のボス後）から。
  - **④`m_legs`（ノッポし・キモシロカビ足長）**＝高コスト雑魚（高HP950/高atk45・味方のチョコナイト相当）。20面から。
  - **中ボス`m_gboss`（緑）／大ボス`m_boss`（赤・単体強打atk75）**。※ボスのAoEは climax が理不尽になったため見送り（単体強打のまま）。
- **範囲攻撃（`slam`＋`slamEvery`）**：`step`の近接攻撃で `D.slam` 持ちは `u.atkN` を数え、`slamEvery`(3)回に1回だけ**ジャンプ衝撃波**＝`u.hopT`で跳ね上がり＋半径r内の敵をまとめて `attackHit`＋`world.shocks`に広がるリングFX（`SLAM_HOP`秒・`drawUnit`が`hop`で持ち上げ・render が地面沿いの楕円で描画）。それ以外の回は単体（`fe.o`）。※`D.hits>1`（前方最大N体キャップ）と `D.area`（無制限）も別途あり（現在は未使用）。テスト：smoke（両者が6回中2回だけ範囲＝毎3回目／半径外は無傷）。
- **敵タワーの立ち絵**：敵城は「菌の親」タワー（白属性）の立ち絵 `tower_kin` を `drawCastle(side==='e')` で描画（味方城は従来の手描き青）。地面に接地・城位置(`castleInset`)を中心に132px。
- **引退（プール非登場・定義は数値参照用に温存）**：手描きの`m_swarm`/`m_tank`/`m_big`、立ち絵の`m_armor`（→ネバモチに集約）、射手`m_phage`（後衛は当面出さない方針）。**まだ手描きなのは自爆`m_puff` の1体のみ**。バランスシムでS1〜S9=4/4・S10ボス=3/4（山）を確認済み。
- **増やし方**：画像を `SPRITE_DATA` に注入→`FOE_DEFS` に `spr` 付き1行→`normalPool`/`breakPool`（どのWAVEに出すか）に配置。テスト：smoke 19。

## 色トレイト（属性）— 実装済み
- **設計**：三すくみは廃止。**色トレイト**（`TRAITS`＝色数むせいげん・データ駆動）。`plain`＝無属性（塗り替えなし・倍率に一切関与しない＝序盤の雑魚は相性を気にしない）。緑/赤/青/黒/黄…は `TRAITS` に1行足すだけ。
- **敵**：`u.trait`（または `FOE_DEFS.trait`）で判定。**立ち絵の敵は絵の色そのまま**（recolorなし＝traitは相性計算だけに使う）。色つき＝`m_gspike`(緑)・中ボス`m_gboss`(緑)・大ボス`m_boss`(赤)／それ以外の雑魚は`plain`。手描き`drawMold`の敵だけ `traitTint()` で体色を塗り替える。
- **味方**：`DEFS.strongVs`（対〇色）を持つ子だけ、その色の敵に **`EFFECT_MUL`(1.6)倍**（有利のみ・**減衰なし**）。初期割り当て＝対赤：cwarrior/clance/daifuku、対緑：choco/macaron/icewiz（"何体か"）。
- **判定**：`isEffective(strongVs, targetTrait)`＝plainは常に非有利。近接=`attackHit`、居合=`chargerStep`、遠距離=`world.shots`（`s.strongVs`）で共通適用。
- **演出**：有効ヒットは `advFx(o, traitOf(o))`＝**属性色の火花＋「ばつぐん！」**（色は相手のトレイト色）。キャラ詳細に「とくせい：◯に強い ×1.6」、なかまカードに対象色ドット（`attrBadgeHTML`）。
- **テスト**：smoke 18（plain無効・同色有効・不利は倍率1・ボスの色・与ダメ増をエンドツーエンド）。**色/対象を増やすときは `TRAITS`＋敵`trait`／味方`strongVs` を足すだけ**。

## 操作系（実装済み）
- **出撃ボタンの並び**：dock は**コストの安い順（左→右）**に並べる（`buildDock` が `myLoadout` をコストでソートしたコピーで生成）。ロジックは `cd[key]` 参照なので並びは表示のみ。smoke 22。
- **一時停止**：上部バーの `⏸`（`togglePause`／`paused` フラグ）。`loop()` は `running && !paused` のときだけ `step`。全画面 `#pauseOverlay`（タップで再開）。`startBattle`/`win` で `clearPause`。smoke 23。
- **連続ノックバックのハメ防止**：`hurt` のHPしきい値スタッガーに**クールダウン**（`KB_STAGGER_CD=0.6`／`u.kbCd`）。壁際で大量の敵に囲まれても、0.6秒に1回しかスタッガーしない＝攻撃する隙を確保して「動けないままハメ殺される」のを防ぐ。通常戦闘は不変（バランスシムで確認）。smoke 24。

## スマホ最適化 — pass1（実装済み）
- **フルスクリーン/PWA下地**：`viewport-fit=cover`＋`apple-mobile-web-app-capable`/`mobile-web-app-capable`/`theme-color`/status-bar メタ＝「ホーム画面に追加」でアドレスバー無しの全画面に。
- **100vh対策**：JSが `window.innerHeight` を `--vh` に反映し、`#wrap` の高さを `calc(var(--vh)*100)`＝モバイルのアドレスバーで下が切れない。`resize`/`orientationchange` で更新。
- **セーフエリア**：`#wrap` に `env(safe-area-inset-*)` パディング（ノッチ対応）。`overscroll-behavior:none`＋`touch-action:manipulation`＋`-webkit-tap-highlight-color:transparent` で引っぱり更新/ダブルタップ拡大/タップ光を抑制。
- **バトルHUDのコンパクト化**：狭い/低い画面（`max-width:760px` または `max-height:560px`）でバトル上部タイトルを非表示（ホームのh1は別要素なので不変）。
- **縦持ちレイアウト**：戦場を上寄せ（`#stage` align-flex-start）＋操作ボタンを下（親指ゾーン）に寄せて拡大（`.btn` の `.ic` 52px・出撃/サイドボタン大型化）。以前は戦場が中央に小さく浮いて上下に大きな余白だったのを解消。
- **横持ち低画面**：上下パディングを詰めて戦場を最大化。デスクトップ（大画面）はメディアクエリ外なので従来どおり。
## スマホ最適化 — pass2（縦持ちズームカメラ）実装済み
- **縦持ちは戦場を画面いっぱいにズーム＋横スクロール**（にゃんこ式）。以前は横長の戦場が細い帯で下に大きな余白だった。
- `resizeCanvas()`：明確に縦長のとき（`innerHeight > innerWidth*1.15`）だけモバイルカメラ。キャンバス内部解像度を `#stage` の実サイズ×dpr にし、`cam.zoom = cv.width/CAM_VISW`（`CAM_VISW=440`＝一度に見せる世界の横幅）でユニットを見やすい大きさに。地面は `CAM_GROUND_FRAC=0.82` の高さに固定（`cam.oy`）。横/PCは従来の全体表示（`zoom=1`）。
- `updateCamera()`：**最前線の味方ユニット(pMin)** へ `cam.x` をなめらか追従（lerp・`[0, W-visW]` クランプ）。開幕は自陣(右)→出撃した先頭を映して前線へ追従（中央へ飛ばない）。味方全滅時は最前の敵(eMax)を映す。
- `render()`：①空をスクリーン空間で全面塗り（カメラ非依存＝余白ゼロ）②`setTransform(zoom,0,0,zoom,-camX*zoom, oy)` で世界描画③地面は画面下まで延長。
- CSS：縦持ちは `#stage` が `flex:1` で中央を占め、`canvas{width/height:100%}`。操作ボタンは下に固定。`resize`/`orientationchange`/`startBattle` で `resizeCanvas`。
- テスト：smoke 25（非縦持ちは全体表示・カメラは範囲内クランプ）。Playwrightで縦=ズーム＋スクロール／横・PC=全体 を確認。

## その他の修正メモ
- **対面ユニットのすり抜け防止（前線を保つ）**：`stepWorld` の移動後に、味方(右)と敵(左)が入れ替わった（味方が敵の左に回り込んだ）ペアを押し戻す当たり判定（`COLLIDE_W=24`）。ノックバックや速度差で「敵が後ろに回り込む／味方が後ろに下がって取り残される」不具合を解消。吹き飛び中(`kbT>0`)と `noCollide`/`untargetable` は対象外。20試行シムで取り残しフレーム率 0.99%→0.00%（勝率ほぼ不変）。smoke 21。
- **なかま一覧の並び**：ノーマル欄は**解放ステージ順**（スターター先頭→`UNLOCKS.need`昇順）にソート。ガチャ限定は別セクション。`renderCollect`。
- **HPしきい値スタッガー（にゃんこ式KB）**：`hurt` が `kbCount` 等分のしきい値割れで `kbBackward`（`KB_HPDIST=52`）。すり抜け防止と併用で前線が安定。
- **ボス登場の衝撃波**：`spawnBoss()` が `knockAllAllies()` を呼び、味方ユニット全員を自陣側（敵城の逆＝右）へ強制ノックバック（`applyKnock(u,0,CONF.bossKnock=120,{pop,time})`）＝城に張り付いた組を強制的にはがす。導火中の自爆は対象外。中ボス/ボス両方で発動。smoke 17。
- **増援waveの張り付きはがし**：`spawnWave()` が `knockAllAllies({maxX:spawnInset+140, dist:CONF.waveKnock=95})` を呼ぶ＝**城際に張り付いた味方だけ**を少し後ろへ剥がす。プレイヤーが敵を追って城の手前(x<湧き位置)まで踏み込むと、そこに湧いた増援が味方の後ろに出て無視され、増援が防衛にならず城が落ちる不具合の対策（`knockAllAllies` に `maxX`/`dist` オプションを追加。ボスは従来どおり全員・bossKnock）。smoke 20。
- **倍速（×1 ⇄ ×2）**：上部バーの `#speedBtn`＝`toggleSpeed()`（`gameSpeed` 1/2・`localStorage 'sm_speed'` に保存）。`loop()` は1フレームで `step(dt)` を `gameSpeed` 回まわす（大きなdtでの当たり判定貫通を防ぐため2回ステップ）。smoke 15。
- **城への張り付き無視バグの修正**：前方に「城より手前の敵」がいる間は城を殴らない（`feNearer = fe.gap < castleGap` のとき `castleInRange=false`）＝城に張り付いたまま、城側に湧いた敵を無視する不具合を解消。移動クランプも「敵がいれば敵の射程手前まで踏み込む／いなければ `castleAtkRange` で停止・どちらも `castleBodyR` へはめり込まない」に整理。`castleAtkRange` を 60→**96**（手前で殴れる＝湧いた敵の手前で足を止められる）、`castleBodyR`(20) を追加。smoke 16。
- **ノックバックのクランプ**：`kbT>0` 中の座標クランプは `castleAtkRange` ではなく `[10, W-10]`（画面内に留めるだけ）。以前は城際(x<castleAtkRange)の敵がノックバックで前へワープし、攻撃中の味方をすり抜けて後ろに回り込むバグがあった（test.js 12）。
- **タワー後ろの余裕**：`CONF.spawnInset=40`（湧き位置を端から離す）。さらに広くしたい/スクロールは将来対応（Wを広げる系）。

## 敵ロスター（カビ軍団）＆ステージ設計

- **`enemySpawn` は `curStage.pools` を使う**（時間経過 `elapsed/ramp` でプールが切り替わる `[[しきい値,[敵…]],…]`）。以前はハードコードでステージ差が出ていなかったのを修正。
- **敵ロスター `FOE_DEFS`（役割で整理）**：
  | key | 名前 | 役割 | 目安 |
  | --- | --- | --- | --- |
  | `m_swarm` | アオカビン | スウォーム（1回2体・速い・弱い） | atk12/hp70 |
  | `m_tank` | ネバモチ | 壁（前線を止める） | atk24/hp360 |
  | `m_big` | ドロカビ | 超硬スポンジ（押し込みで城を削る） | atk16/hp720/遅 |
  | `m_phage` | ファージ砲 | 後衛射手（遠距離で削る） | atk20/hp80/range175 |
  | `m_puff` | プクーレ | 自爆ラッシュ（接触で大爆発） | blast180/速い |
  | `m_boss` | カビ大帝 | ボス（超巨大・高HP高火力・遅い） | atk75/hp3600/終盤のみ |
  - 敵は画像素材なし＝`drawMold` の `mold`（blob/phage/spiky）＋`col/col2` で手描き。新種は `FOE_DEFS` に1行＋pools に入れるだけ（ボスも blob 流用）。

### 50面ルート（プロシージャル生成）＋HP連動イベント — 実装済み

**泥沼化しない設計**：敵は「時間経過で無限湧き」ではなく、**軽めの基本湧き（同時数ソフト上限 `baseCap`）＋敵タワーの複数ゲージ＝WAVE制**で構成。プレイヤーが押し込んで今のゲージ（WAVE）を削り切ると次のWAVEへ、**最後のゲージを削り切ると勝ち**＝有限で押し合いが決着する。

#### WAVE制（敵タワーの複数HPゲージ）— 実装済み
- **`makeWaves(n, boss, mini, total)`**：`genStage` が敵城HP総量(`total`)を**複数のWAVEゲージに分割**して `curStage.waves`（`[{idx,type,final,hp,spawn,burst,burstPool,tower,heavy?,boss?,mini?}]`）を作る。ゲージ数＝`2 + floor(n/6)` を 2〜5 でクランプ（ボス面は最低4）。重み配分＝ブレイクゲージは×1.4厚い。
  - **WAVE 2種**：`type:'normal'`（通常）と `type:'break'`（ブレイク）。**基本は最後のゲージがブレイク**。ゲージ4本以上なら**途中(最後から2番目)にもブレイク**が入る。
  - **通常WAVE**：切替時に `spawnWaveBurst`（`burst=3+floor(n/7)`体）で敵が多めに湧く。連続湧き＆バーストの敵＝`normalPool(n)`（軽め）。
  - **ブレイクWAVE**：`burst`が多い（`4+floor(n/4)`・重めの敵`w.heavy`を混ぜる）／敵タワーが手前を攻撃（`tower:true`）／敵の湧き間隔が0.6倍に短縮（`world.waveType==='break'`）。連続湧き＆バーストの敵＝`breakPool(n)`（壁/装甲/エリートを厚く）。**※制限時間（大技スタン）は撤廃**＝あまり機能しなかったため。
  - **WAVEごとの敵プール（つくり込みノブ）**：各waveは `w.spawn`（そのWAVE中に連続湧きする敵の配列）と `w.burstPool`（切替バーストの敵・既定＝`spawn`）を持つ。`enemySpawn()` は**現在のWAVEの `spawn`** を、`spawnWaveBurst()` は `w.burstPool` を引く＝**通常/ブレイクで湧く敵が変わる**。`normalPool(n)`＝軽め／`breakPool(n)`＝重め＋エリート。`basePool(n)`＝両者の和集合（`pool`＝描画/テスト用の一覧）。**足長ノッポ `m_legs` は20面からブレイクWAVE限定でデビュー→28面から通常湧きにも混ざる**。後衛（射手`m_phage`）は当面プールに入れない。
  - **ボス/中ボス**：最終ゲージに `boss`(`m_boss`/red)または `mini`(`m_gboss`/green)を積む（**10面ごとボス／5面ごと中ボス**）。ボスはHP割合イベントではなく**最終ブレイクWAVEにユニットとして登場**（壁として立ちはだかる）。
  - 1面(STAGE_BY_ID[1])は上書きで**単一の通常ゲージ**（チュートリアル＝WAVEなし）。
- **WAVE切替（`advanceWave`）**：今のゲージを削り切る（`ehp<=0` かつ非最終）と発火。①`curWave++`＋次ゲージのHP/タイプをセット、②**`knockAllAllies()`＝味方ユニット全体を必ずノックバック**（にゃんこの「城まで押したら跳ね返される」感）、③`spawnWaveBurst`で入場バースト、④ボス/中ボスがいれば`spawnBoss`、⑤バナー（通常=「WAVE N！」／ブレイク=「⚡ ブレイクWAVE！」／最終=「⚡ 最終ブレイク！」）。
- **ブレイク進行（`updateBreak(dt)`）**：`step()`から毎フレーム、`tower`ゲージなら`TOWER_ATK_CD`(2.6秒)ごとに`towerAttack()`＝敵タワー(左・`castleInset`)から最前(最左)の味方へ弾（`dmg=22+id*2`・`side:'e' tower:true`）。※制限時間・大技スタン(`breakPenalty`/`breakTimer`)は撤廃。
- **HP表示**：HTMLの城バー(`.bars`)は非表示化。代わりに①**画面上部に大きな敵バー `drawWaveHud()`**（screen-space・WAVEピップ`●○`・ブレイクは赤）、②**自陣タワーの真上に数値＋バー `drawCastleHP()`**（world-space）。
- **キャラ解禁順（`UNLOCKS[k].need`＝そのステージをクリアで解禁）**：**序盤(〜10面)はクッキー＋4体だけ**＝ctank(3面) / cwarrior(5面) / clance(8面) / choco(10面)。それ以外(macaron/slime/shoe/icewiz/donut/daifuku)は**仮ロック（need13〜34の仮置き・11面以降の順番は後で確定）**。gachaはpartycookie/bigslime。
- **EXP/コスト（塩梅）**：`stageExp= first? 600+n*100 : 120+n*20`（1-2面で計約1500）。解禁コスト＝ctank1000/cwarrior1800/clance3000/choco4500（以降仮）。強化コスト `c0` は 400〜500（1-2面のEXPで数個・少しだけ強化できる）。
- **タワー（城砲）**：バトル開幕は**チャージ切れ**（`reset` で `towerCd=CONF.towerCd`＝溜まってから初撃）。射程 `UPG.tRng` は **base=中央ちょい自陣寄り(minX≈520)／MAX=敵城の目の前(minX≈40)**（base440・step80・max6＝敵城前まで届く）。
- **バランス（1〜10面）**：limited roster（クッキー＋順次解禁の4体）でsim検証済み。**泥沼化なし・ボス面(5=中ボス/10=ボス)が時間の山**。ボスは最終ブレイクWAVEの「厚いHP＋高火力の壁」＝base湧きが軽いので必ず対面でき、押し切る本番。難易度は `genStage` の `enemyHP/baseCd/baseCap` と `makeWaves`（ゲージ数/ブレイク重み/burst/limit/boss.hp・atk）で調整。

新ステージ/難易度は `genStage` の式（enemyHP・baseCd・baseCap）と `makeWaves`（WAVE構成）・`normalPool`/`breakPool`・`UNLOCKS.need` を触るだけ。

#### 各ステージのつくり込み（`STAGE_OVERRIDES`）
自動生成の上から**ステージ個別に手動オーバーライド**できる（`STAGES` 生成直後に `STAGE_OVERRIDES[id](s)` を適用）。1面がその一例（単一ゲージへ上書き）。触れるノブ：
- **WAVE数**＝`s.waves` の要素数（増減 or 差し替え）。
- **通常WAVEの敵**＝`w.spawn`（`type:'normal'` のwave）／**ブレイクの敵**＝`w.spawn`（`type:'break'`）。
- **切替時に出る敵**＝`w.burstPool`（既定は `spawn`）／**数**＝`w.burst`。
- **ゲージHP/種類/制限秒**＝`w.hp` / `w.type` / `w.limit`。
- 例）`STAGE_OVERRIDES[8]=(s)=>{ s.waves[1].spawn=['m_bump','m_legs']; s.waves[1].burst=6; };`

### バランス検証（ヘッドレス・シミュレータ）

`scratchpad/balance.js`＝Playwrightで**実ゲームロジックを回す自動対戦シム**。プレイヤーの進行段階（early/early2/mid/late/max＝デッキ＋メタ強化 `save.upg`）ごとに各ステージを複数回シミュレートし、勝率・所要秒・城HP残量を出す。方針（AIポリシー）：**序盤はお財布を優先して伸ばし（wTarget=4）、以降は安い順に出せるだけ出す＋タワー常時**。

`scratchpad/balance.js` は **50面ルート対応**＝マイルストーン面(1,3,5,8,10,15,20,25,30,35,40,45,50)を、その面に到達した想定のプロフィール（`profile(n)`＝解禁済みデッキ＋段階的メタ強化）で複数回シミュレートする。

現状の目安（適正段階でプレイ／シムは人間より控えめ）：
- **S1〜S30＝3/3で安定**（所要時間が徐々に伸びる滑らかなカーブ）。**ボス面(10/20/30/40/50)が難易度の山**。
- **S35〜S50＝難関（シムで1〜2/3・惜敗が多い＝敵城1〜3割残しで時間切れ）**。シムは人間より下手なので、実プレイでは進行（EXP強化・キャラ解禁）を積めば勝てる想定。**低レベルで高難度面はほぼ負け**＝積み上げが要る設計。
- 数値を触ったら `node build_nyanko.js` → `NODE_PATH=$(npm root -g) node scratchpad/balance.js` で再確認するとカーブが崩れていないか分かる。

## テスト

`node build_nyanko.js` → ヘッドレス smoke（scratchpad の `smoke.js`）で **38項目**。メタ関連の検証：サイフ初期上限=100 / `effCap` の Lv0→max 補間 / 城HP=`tHp` / 強化購入でLv↑&EXP消費&コスト逓増 / タワー射程外は当たらない / 解放ゲート（need）＋EXP消費。
