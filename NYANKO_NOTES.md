# SUGAR MARCH（nyanko.html）設計メモ

にゃんこ大戦争風スピンオフ `nyanko.html`（テンプレ `nyanko.tpl.html` → `build_nyanko.js` で生成）のメタ進行・強化まわりの設計メモ。**あとから参照するための覚え書き**。

## メタ進行（EXP）— 実装済み

- **EXP（`save.exp`）**：ステージクリアで獲得する恒久通貨。`stageExp(s, first)` ＝初回 `300 + id*80` / 再挑戦 `30 + id*10`。決着 `win()` で付与。
- **🍬コイン（`save.coins`）**：ガチャ専用（`partycookie`/`bigslime`）に残置。ステージ初回で従来どおり付与。
- **キャラ解放**：`buyUnit(k)` が **EXPを消費**。`UNLOCKS[k].need`（クリア済みステージ数）以上で解放可＝**ステージを進めるほど解放できるキャラが増える**（`unlockAvailable`）。コストは `UNLOCKS[k].cost`（EXP）。
- **サイフ／タワーの恒久強化**：`UPG`（下記）を EXP で1Lvずつ購入（`buyUpgrade` / `renderUpgrade` / ホーム「⚙ 強化」）。`save.upg[track]` にLvを保存。

### 強化トラック `UPG`（`upgVal`=base+Lv*step / `upgCost`=c0×1.55^Lv / 最大Lv=max）

| track | 名前 | base | step | max | 効果の接続先 |
| --- | --- | --- | --- | --- | --- |
| `wStart` | サイフ 初期最大 | 100 | 35 | 8 | `effCap()` のお財布Lv0上限（**最初期=100**） |
| `wMax` | サイフ 最大貯金 | 600 | 170 | 8 | `effCap()` のお財布Lvmax上限 |
| `wRate` | 生産速度 | 20 | 5 | 8 | `effRate()` の基礎🍬/秒 |
| `tHp` | タワーHP | 1600 | 450 | 8 | 自城HP（`reset` で `php=upgVal('tHp')`、HPバー分母 `myMaxHP`） |
| `tPow` | タワー攻撃力 | 120 | 55 | 8 | `castTower` の威力 |
| `tRng` | タワー射程 | 380 | 95 | 6 | `castTower` が届く距離（自城=右 `W` から左へ `tRng`px） |

- **サイフのバトル中UP**：`upgradeWallet`（🍬で購入）は据え置き。上限は `wStart`→`wMax` を お財布Lv(0..walletMax) で線形補間（`effCap`）。`walletCostBase=80 / step=70`（初期最大100でも1段目を払える額）。
- 調整はすべて `UPG` の base/step/max/c0、`stageExp`、`CONF.walletMax/walletRateStep/walletCost*` で完結。

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

**泥沼化しない設計**：敵は「時間経過で無限湧き」ではなく、**軽めの基本湧き（同時数ソフト上限 `baseCap`）＋城HP割合で発火するイベント（大群/ボス）**で構成。プレイヤーが押し込んで敵城HPを削ると、しきい値でイベントが起きる＝**有限で押し合いが決着する**。

- **`genStage(n)`（n=1..50）**：`STAGES = Array.from({length:50}, …)`。
  - `enemyHP = 560 + n*205 + n*n*6`（＝ステージの長さ／削り切ると勝ち）。
  - `baseCd`（基本湧き間隔・軽め）／`baseCap`（同時に湧く敵のソフト上限＝泥沼化防止）。
  - `pool = basePool(n)`：敵の解禁スケジュール。**自爆(m_puff)は18面から**（序盤に出さない）。swarm→壁(4)→射手(8)→超硬(13)→自爆(18)→混成(26)。
  - `events`：`{at:HP割合, wave:{key,n}}`（大群）/ `{at, boss:{hp,atk,sMul}}`（ボス）。**10面ごとにボス面**（`n%10`）、**5面ごとに中ボス**（`n%5`）。
  - 1面はチュートリアル＝超軽量（アオカビだけ・イベントなし）。
- **イベント発火**：`step()` → `checkStageEvents()` が `ehp/foeMaxHP` を見て、しきい値を下回った瞬間に一度だけ `spawnWave`/`spawnBoss`＋`showEventBanner('⚠ …')`。ボスは `u.boss=true`・`kbCount=3`（滅多にひるまず前進）。
- **キャラ解禁順（`UNLOCKS[k].need`＝そのステージをクリアで解禁）**：**序盤(〜10面)はクッキー＋4体だけ**＝ctank(3面) / cwarrior(5面) / clance(8面) / choco(10面)。それ以外(macaron/slime/shoe/icewiz/donut/daifuku)は**仮ロック（need13〜34の仮置き・11面以降の順番は後で確定）**。gachaはpartycookie/bigslime。
- **EXP**：`stageExp(s,first)= first? 120+n*26 : 20+n*4`（後半ほど多い）。
- **タワー（城砲）**：バトル開幕は**チャージ切れ**（`reset` で `towerCd=CONF.towerCd`＝溜まってから初撃）。射程 `UPG.tRng` は **base=中央ちょい自陣寄り(minX≈520)／MAX=敵城の目の前(minX≈40)**（base440・step80・max6＝敵城前まで届く）。
- **バランス（1〜10面）**：limited roster（クッキー＋順次解禁の4体）でsim検証済み。**泥沼化なし・ボス面(5=中ボス/10=ボス)が時間の山**。ボスは「厚いHP＋高火力の壁」＝base湧きが軽いので必ず対面でき、押し切る本番。難易度は `genStage` の `enemyHP/baseCd/baseCap/events(boss.hp/atk)` で調整。

新ステージ/難易度は `genStage` の式（enemyHP・baseCd・baseCap・events）と `basePool`・`UNLOCKS.need` を触るだけ。個別に上書きしたい面は生成後に `STAGES[i].xxx=…` で調整可（1面がその例）。

### バランス検証（ヘッドレス・シミュレータ）

`scratchpad/balance.js`＝Playwrightで**実ゲームロジックを回す自動対戦シム**。プレイヤーの進行段階（early/early2/mid/late/max＝デッキ＋メタ強化 `save.upg`）ごとに各ステージを複数回シミュレートし、勝率・所要秒・城HP残量を出す。方針（AIポリシー）：**序盤はお財布を優先して伸ばし（wTarget=4）、以降は安い順に出せるだけ出す＋タワー常時**。

`scratchpad/balance.js` は **50面ルート対応**＝マイルストーン面(1,3,5,8,10,15,20,25,30,35,40,45,50)を、その面に到達した想定のプロフィール（`profile(n)`＝解禁済みデッキ＋段階的メタ強化）で複数回シミュレートする。

現状の目安（適正段階でプレイ／シムは人間より控えめ）：
- **S1〜S30＝3/3で安定**（所要時間が徐々に伸びる滑らかなカーブ）。**ボス面(10/20/30/40/50)が難易度の山**。
- **S35〜S50＝難関（シムで1〜2/3・惜敗が多い＝敵城1〜3割残しで時間切れ）**。シムは人間より下手なので、実プレイでは進行（EXP強化・キャラ解禁）を積めば勝てる想定。**低レベルで高難度面はほぼ負け**＝積み上げが要る設計。
- 数値を触ったら `node build_nyanko.js` → `NODE_PATH=$(npm root -g) node scratchpad/balance.js` で再確認するとカーブが崩れていないか分かる。

## テスト

`node build_nyanko.js` → ヘッドレス smoke（scratchpad の `smoke.js`）で **38項目**。メタ関連の検証：サイフ初期上限=100 / `effCap` の Lv0→max 補間 / 城HP=`tHp` / 強化購入でLv↑&EXP消費&コスト逓増 / タワー射程外は当たらない / 解放ゲート（need）＋EXP消費。
