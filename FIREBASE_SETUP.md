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

## 8. コスト・後始末

- 個人テスト規模なら無料枠で十分です。対戦データはWebRTC直送なので、Firebaseの通信量はほぼ「あいことばの受け渡し」だけです。
- 「もどる」を押すと、その部屋のデータは自動で削除します（`rooms/{あいことば}`）。

---

これで **F2-①（接続）** は完了です。接続が確認できたら、次の **F2-②** で
「接続できた2人で実際に対戦する」処理（ドラフトの同期＋盤面のスナップショット配信）を載せていきます。
