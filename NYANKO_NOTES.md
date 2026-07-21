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

## テスト

`node build_nyanko.js` → ヘッドレス smoke（scratchpad の `smoke.js`）で **38項目**。メタ関連の検証：サイフ初期上限=100 / `effCap` の Lv0→max 補間 / 城HP=`tHp` / 強化購入でLv↑&EXP消費&コスト逓増 / タワー射程外は当たらない / 解放ゲート（need）＋EXP消費。
