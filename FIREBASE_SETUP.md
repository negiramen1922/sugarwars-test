# PVP対戦のための Firebase 設定手順（F2-①：接続編）

SUGAR WARS の対人戦は、**Firebase**を「部屋の顔合わせ（あいことばの受け渡し）」に使い、
対戦データ自体は **WebRTC** で2台が直接やり取りします。Firebase は無料枠（Sparkプラン）で始められます。

この手順書のゴール：**2台の端末が「あいことば」で繋がり、「接続成功！」と表示される**こと。

---

## 1. Firebase プロジェクトを作る

1. [Firebase コンソール](https://console.firebase.google.com/) にGoogleアカウントでログイン。
2. 「プロジェクトを追加」→ 好きな名前（例 `sugarwars`）→ 作成。
   - Googleアナリティクスは「無効」でOK（任意）。

## 2. Realtime Database を有効化する

1. 左メニュー「構築 > Realtime Database」→「データベースを作成」。
2. ロケーションは近い地域（例：`asia-southeast1` など）。
3. セキュリティルールは、まず**「テストモードで開始」**を選ぶ（あとで 5. で締めます）。

## 3. Web アプリを登録して設定（config）を取得する

1. プロジェクト概要（歯車 > プロジェクトの設定）→「マイアプリ」で **`</>`（ウェブ）** を選ぶ。
2. アプリのニックネーム（例 `sugarwars-web`）を入れて登録。Hosting は今は不要。
3. 表示される `firebaseConfig` をコピー。こんな形です：

   ```js
   const firebaseConfig = {
     apiKey: "AIza........",
     authDomain: "sugarwars-xxxx.firebaseapp.com",
     databaseURL: "https://sugarwars-xxxx-default-rtdb.firebaseio.com",
     projectId: "sugarwars-xxxx",
     appId: "1:1234567890:web:abcdef......"
   };
   ```

   > `databaseURL` が表示されない場合は、2.でRealtime Databaseを作成すると出てきます。必須項目です。

## 4. config を `index.html` に貼る

`index.html` の中ほど、コメント `▼▼▼ あなたのFirebase設定をここに貼り付けてください ▼▼▼` の下にある
`FIREBASE_CONFIG` を、3.でコピーした値で置き換えます。

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza........",
  authDomain: "sugarwars-xxxx.firebaseapp.com",
  databaseURL: "https://sugarwars-xxxx-default-rtdb.firebaseio.com",
  projectId: "sugarwars-xxxx",
  appId: "1:1234567890:web:abcdef......",
};
```

設定が済むと、PVP画面の「⚠ Firebaseが未設定です」の警告が消えます。

## 5. セキュリティルールを設定する（テストモードの期限切れ対策）

テストモードは数週間で読み書きが止まります。Realtime Database の「ルール」タブを次に置き換えてください。
（`rooms` 配下だけ誰でも読み書き可。あいことばを知っている人だけが部屋に入れる、という割り切りです）

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

> より厳密にしたい場合は、後で匿名認証（Anonymous Auth）を足して `auth != null` を条件にできます。
> まずは上記で「繋がること」を確認しましょう。

## 6. 動作確認（2台でテスト）

1. `index.html` を**インターネット経由でアクセスできる場所**に置く（例：Firebase Hosting / GitHub Pages / Netlify など）。
   - WebRTC と Firebase は `https://` が必要です。`file://` で直接開くと動きません。
   - 同じ端末の2タブでも確認できますが、できれば**別々の端末**で試すのが確実です。
2. 端末A：ホーム →「バトル」→「PVP対戦」→「**部屋を作る**」。表示された4文字の**あいことば**を控える。
3. 端末B：同じく「PVP対戦」→「**部屋に入る**」→ あいことばを入力 →「接続する」。
4. 両方に「**接続成功！🎉**」が出れば成功。「テスト送信」を押すと、相手側のログにメッセージが届きます。

## 7. うまく繋がらないときは

- **警告が消えない**：`FIREBASE_CONFIG` の貼り間違い（特に `databaseURL`）。コンソールの設定と一致しているか確認。
- **「部屋が見つかりません」**：あいことばの打ち間違い、または親より先に子が入った。親を作り直してから子が入る。
- **「接続状態: failed」**：双方が厳しいネットワーク（職場・学校・一部モバイル回線）だとP2Pが繋がらないことがあります。
  別の回線（自宅Wi-Fiやテザリング）で試す。改善しない場合は将来 TURN サーバーの追加を検討します。
- **数週間後に急に動かない**：5.のルールを設定していない（テストモード期限切れ）。

## 7.5 どうしても繋がらない時：TURN中継を設定する（確実性UP）

同じWi-Fiでも繋がらない場合、ルーターの **「プライバシーセパレーター／ネットワーク分離（APアイソレーション）」** が
ONだと端末同士が直接通信できません。設定でOFFにできればOFFに。別回線同士（モバイル×Wi-Fiなど）でも直接は繋がりにくいです。

### 一番ラクな回避策（設定不要）

**片方のスマホでテザリング（インターネット共有）をON → もう片方をそのWi-Fiに接続。**
2台が同じシンプルな回線に入るので端末分離に当たらず、直接つながりやすくなります。まずこれを試すのが速いです。

### おすすめ：Cloudflare Realtime TURN（無料枠が大きく安定）

Meteredの無料枠（月500MB）が尽きると `code=400 allocate error`／`relay 0` で繋がらなくなります。
**Cloudflare Realtime のTURN**は無料枠が大きく安定しているので、こちらを推奨します。設定すると自動でCloudflareを優先します。

**手順（5分・Cloudflareアカウントは無料）**

1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) にログイン。
2. 左メニュー **Realtime**（旧 Calls）→ **TURN** → **Create TURN Key**。
3. 表示される **Turn Token ID（キーID）** と **API Token（トークン）** を控える。
4. `index.html` のこの2行に貼る：

   ```js
   const CLOUDFLARE_TURN_KEY_ID = 'ここにキーID';
   const CLOUDFLARE_TURN_TOKEN  = 'ここにAPIトークン';
   ```

5. これだけ。接続時に診断ログへ「**Cloudflare TURN取得OK**」が出て、対戦時に `経路候補[relay]` が出れば中継成功です。

> ⚠ トークンはクライアントに埋め込まれて公開される前提です（WebRTCの仕様上、Meteredのキーと同じ扱い）。
> スコープはTURN専用なので影響は限定的。**気になる/課金を確実に防ぎたいなら次の「Worker化」を推奨**。
> Cloudflare/Metered の両方が空ならSTUNのみ（＝同一回線でしか繋がりません）。Cloudflareを設定すればMeteredは使いません。

### 強く推奨：Worker化（トークンを隠す＋キルスイッチ）

トークンをクライアントに出さず、**Cloudflare Worker の秘密**として持たせます。これで第三者にトークンを拾われて
勝手にTURN枠を使われる＝予期せぬ課金、を防げます。同梱の **`turn-worker.js`** をそのまま使います。

**手順（10分・追加費用なし）**

1. Cloudflareダッシュボード → **Workers & Pages** → **Create** → **Create Worker**。
2. 名前を付け（例 `sugarwars-turn`）デプロイ → **Edit code** で、`turn-worker.js` の中身を貼り付けて **Deploy**。
3. そのWorkerの **Settings → Variables and Secrets** で**シークレット**を2つ追加：
   - `TURN_KEY_ID` … TURNキーID
   - `TURN_TOKEN` … APIトークン
   （任意）`ALLOWED_ORIGINS` に公開オリジンを設定（例 `https://negiramen1922.github.io`）。`TURN_DISABLED=1` で即停止（キルスイッチ）。
4. WorkerのURL（例 `https://sugarwars-turn.xxxx.workers.dev`）を控える。
5. `index.html` に貼る（**トークンはもう書かない**）：

   ```js
   const CLOUDFLARE_TURN_WORKER = 'https://sugarwars-turn.xxxx.workers.dev';
   const CLOUDFLARE_TURN_KEY_ID = '';   // 空でOK
   const CLOUDFLARE_TURN_TOKEN  = '';   // 空でOK
   ```

6. 接続時に診断ログへ「**Cloudflare TURN取得OK（Worker）**」が出れば成功。
7. **仕上げ**：以前クライアントに載せていたトークンは公開済みなので、Cloudflareで**TURNキーを作り直し（ローテーション）**、
   Workerのシークレット `TURN_KEY_ID`/`TURN_TOKEN` を新しい値に更新→古いキーは削除。これで露出したトークンは無効化されます。

> 「使った量が上限に近づいたら自動で止めたい」場合：Workerの `TURN_DISABLED=1` を立てれば即停止できます（手動キルスイッチ）。
> Cloudflare側でも **使用量の通知**を設定可能。1,000GB/月はこのゲームでは実質到達しないので、通常はキルスイッチ＋通知で十分です。

### 予備：TURN中継（Metered・設定済み）

本リポジトリは [Metered](https://www.metered.ca/) のTURNを**接続時に自動取得**する方式で設定済みです
（`index.html` の `METERED_SUBDOMAIN` / `METERED_API_KEY`）。接続のたびに最新の中継情報を取りに行きます。

別のMeteredプロジェクトに差し替えるときは、`index.html` のこの2行を置き換えるだけ：

```js
const METERED_SUBDOMAIN = 'あなたのアプリ.metered.live';
const METERED_API_KEY   = 'あなたのAPIキー';
```

> APIキーはFirebaseのapiKey同様、クライアント側に埋め込まれて公開される前提の値です（WebRTCの仕様上そうなります）。
> 気になる場合はMeteredのダッシュボードでキーをローテーションできます。
>
> 確認方法：接続時に画面下の診断ログへ「TURN取得OK（中継n件）」が出て、対戦時に `経路候補[relay]` が出れば中継が効いています。
> 無料枠は月500MB。対戦データはWebRTC直送なので、relayを経由しても顔合わせ＋中継分のみで、通常は十分です。

## 8. コスト・後始末

- 個人テスト規模なら無料枠で十分です。対戦データはWebRTC直送なので、Firebaseの通信量はほぼ「あいことばの受け渡し」だけです。
- 「もどる」を押すと、その部屋のデータは自動で削除します（`rooms/{あいことば}`）。

---

# ログイン（Google / メール）とクラウド保存

ログイン機能を使うと、**デッキとチュートリアル進捗がアカウントにひも付いてクラウド保存**され、
別の端末でも続きから遊べます。未ログイン／未設定でも従来どおり遊べ、デッキは端末（localStorage）に保存されます。
（音量設定はデバイス個別の項目なので、あえて同期しません。）

## A. ログイン方法を有効化する（Firebaseコンソール・5分）

1. 左メニュー「構築 > Authentication」→「始める」。
2. 「Sign-in method」タブで、次の2つを有効化：
   - **Google**（サポートメールを選ぶだけでOK）
   - **メール / パスワード**（「メール/パスワード」をオンに。「メールリンク」はオフのままでOK）

## B. 承認済みドメインを登録する

Authentication →「Settings（設定）」→「**承認済みドメイン**」に、ゲームを公開している**ホスト名**を追加します。

- 入れるのは**ホスト名だけ**（`https://` もパス `/...` も付けない）。
- 例：GitHub Pages で `https://ユーザー名.github.io/リポジトリ名/` で公開しているなら、登録するのは **`ユーザー名.github.io`**（パス部分は対象外）。
- `localhost` と `<project>.firebaseapp.com` / `<project>.web.app` は**自動登録済み**なので追加不要。
- 独自ドメインに移行したら、そのドメイン（例 `sugarwars.example`）を**1行追加するだけ**。コードの変更は不要です。

> モバイルのアプリ内ブラウザ（LINE/X等）では `signInWithPopup` が使えないことがあり、その場合はコードが自動で
> `signInWithRedirect`（リダイレクト方式）に切り替えます。リダイレクトは認証後に元のページへ戻ってきます。

## C. セキュリティルールに `users` を追加する

クラウド保存先 `users/<uid>/profile` を、**本人だけが読み書きできる**ように、5.のルールへ `users` を足します
（Realtime Database →「ルール」タブ）：

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true
      }
    },
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "matchmaking": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

これで他人のデータは読めず、自分のデッキだけが安全に保存されます。
`matchmaking` はランダムマッチの待機列（次章）に使います。**ログイン（匿名でも可）した人だけ**読み書きできます。

## D. 使い方・動作確認

1. ホーム右上の「☰ メニュー」→「👤 ログイン」。
2. **Googleでログイン**、または**メールアドレス＋パスワード**で「新規登録」→「ログイン」。
3. ログインすると、編成画面でデッキを変えるたびに自動でクラウド保存されます（数百ミリ秒のまとめ書き）。
4. 別の端末で同じアカウントにログインすると、保存済みのデッキが復元されます。

> **初回ログイン時の挙動**：そのアカウントにクラウド保存が無ければ、いまの端末のデッキをアップロードします。
> すでにクラウド保存があれば、そちらを復元して端末のデッキを上書きします。

## E. うまくいかないときは

- **「このドメインは承認されていません」**：B. の承認済みドメインにホスト名が入っていない。公開URLのホスト名を確認して追加。
- **Googleのポップアップがすぐ閉じる／出ない**：アプリ内ブラウザの可能性。自動でリダイレクト方式に切り替わるので、画面の指示に従う。標準ブラウザ（Safari/Chrome）で開くと確実。
- **保存されない**：C. のルールに `users` を追加したか確認。ログイン中か（メニューの行に名前が出ているか）も確認。

---

# ランダムマッチ（あいことば不要の自動対戦）

「あいことば」を伝え合わなくても、**ボタン1つで相手を自動で見つけて対戦**できます。
仕組みは **Firebaseの待機列でペアにして、その2人を既存のWebRTCで繋ぐ**だけ（新しいサーバーは不要）。

## 必要な設定（3つ・どれも1回だけ）

1. **匿名認証を有効化**：Authentication → Sign-in method → **「匿名」をオン**。
   - ランダムマッチは「参加した瞬間だけ」裏で匿名ログインしてゲストIDを作ります（メール等は不要）。
2. **`matchmaking` ルールを追加**：上の C. のルール（`matchmaking` を含む全文）に置き換えて「公開」。
3. **プロフィール（任意）**：メニュー →「👤 ログイン / プロフィール設定」で**ニックネームとお菓子アイコン**を設定。
   - 未設定でも「ゲスト〇〇」＋既定アイコンで対戦できますが、設定すると相手に表示されます。

## 使い方・動作確認（2台 or 2タブ）

1. 両方の端末で：ホーム →「バトル」→「PVP対戦」→「🎲 **ランダムマッチ**」。
2. 片方が「対戦相手を探しています…」で待機 → もう片方が押すと**自動でペア成立**して接続。
3. 「対戦相手が見つかりました！」→ そのまま対戦が始まればOK。

> **ペアの決まり方**：先に待っていた人が「子」、後から来てマッチさせた人が「親（部屋を作る側）」になります。
> どちらが親でも遊び方は同じです。途中で「キャンセル」すれば待機列から外れます（切断時も自動で外れます）。

## うまくいかないときは

- **ずっと「探しています」のまま**：相手がいない（1人しか待っていない）だけ。もう1台で押す。
- **権限エラー／繋がらない**：匿名認証の有効化、`matchmaking` ルールの公開を確認。
- **接続状態が `failed`**：双方が厳しい回線だとP2Pが繋がらないことがある（手動対戦と同じ）。TURN設定／回線変更（7.5章）を参照。

---

これで **F2-①（接続）**・アカウント連携・**ランダムマッチ**の土台は完了です。
次は勝敗の記録（レート）→ランキング表へと積んでいけます。
