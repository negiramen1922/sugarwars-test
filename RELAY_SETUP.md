# PVP中継サーバー（非P2P）— Cloudflare Durable Objects セットアップ

P2P（WebRTC）の代わりに、**1部屋=1 Durable Object** に2人を繋いでメッセージを中継する方式です。
対戦本体は「通信路」だけに依存しているので、WebRTC とまるごと差し替えできます（ホスト権威＝親が計算、は不変）。

- サーバー：`relay-worker.js`（Cloudflare Worker + Durable Object `Room`）／設定：`relay-wrangler.toml`
- クライアント：`index.html` の `RELAY_URL` と `PVP_USE_RELAY`

## いまプレイしている人への影響
- 既定は **`PVP_USE_RELAY = false`＝従来どおりWebRTC**。デプロイしても何も変わりません。
- サーバーを立てて `RELAY_URL` を設定し、動作確認できてから **`PVP_USE_RELAY = true`** にして配信すると、
  次のリロードで全員が中継方式に切り替わります（Webなので自動更新）。CPU対戦は常に無関係で不変。
- `PVP_USE_RELAY = true` でも、中継サーバーに繋がらなければ **自動でWebRTCにフォールバック**します。

## 手順

### 1. デプロイ（サーバー）
```bash
# Cloudflareにログイン（初回のみ）
npx wrangler login
# 中継Workerをデプロイ（Durable Object込み）
npx wrangler deploy --config relay-wrangler.toml
```
デプロイ後に表示される URL（例 `https://sugarwars-relay.<あなた>.workers.dev`）を控えます。

> Durable Object は SQLite backed（`new_sqlite_classes`）指定なので**無料プランでも利用可**です。
> 動作確認：ブラウザで `https://.../health` を開いて `sugarwars relay ok` が出ればOK。

### 2. クライアント設定（`index.html`）
```js
// http(s) を wss に変えて貼る（例）
const RELAY_URL = 'wss://sugarwars-relay.<あなた>.workers.dev';
const PVP_USE_RELAY = true;   // まずは false で様子見→OKなら true にして配信
```

### 3. 動作確認（2台 or 2タブ）
- プライベート対戦の「部屋を作る／入る」、またはランダムマッチで接続。
- つながらない/切れる場合は `PVP_USE_RELAY = false` に戻せば即WebRTCへ。

## 仕組み（プロトコル）
- 接続：`wss://<worker>/ws/<あいことば>?role=host|guest`
- サーバー制御メッセージ（対戦データと混ざらないよう `__relay` を持つ）
  - `{__relay:'ready'}` … 2人そろった（両者へ）＝クライアントはここで対戦開始
  - `{__relay:'peer-left'}` … 相手が退出
  - `{__relay:'full'}` … すでに2人いる（満室）
- 対戦データ（`PVP_MSG.*`）はサーバーが中身を見ずに相手へ素通し。

## 限界 / 今後
- v1は「中継のみ」（計算は親クライアント）。**親の切断＝対戦終了**は従来と同じ。
- 完全なチート耐性・親切断への強さが要るなら、次段で「サーバー権威型」（Durable Object内で戦闘計算）へ拡張可能。
- 中継サーバーの実機テスト（2台）はこのリポジトリ環境ではできないため、手元で確認してください。
