# Cloudflare で本番公開する手順（本番＝独自ドメイン／テスト＝GitHub Pages）

このゲームを **本番＝`sugar-wars.com`（Cloudflare Pages）／テスト＝`negiramen1922.github.io/sugarwars-test/`（GitHub Pages）** の2環境で運用するための手順です。初心者向けに順を追って書いています。

---

## 全体像

```
テスト環境（あなたの確認用）      本番環境（公開・AdSense・アプリのリンク先）
GitHub Pages                     Cloudflare Pages
negiramen1922.github.io/...   →   https://sugar-wars.com/
（今のまま・広告OFF）             （独自ドメイン・広告ON）
```

- 共有／招待リンクは実行時のURLから自動生成されるので、どちらで開いても正しく動きます。
- **広告は本番ドメイン（`sugar-wars.com`）でだけ表示**されます（コード側で対応済み：`AD_PROD_HOST`）。テスト環境では広告は出ません。

---

## 手順1：Cloudflare アカウント作成 ＆ ドメイン購入

1. <https://dash.cloudflare.com/sign-up> でアカウント作成（メール＋パスワード）。
2. 左メニュー **Domain Registration → Register Domains**。
3. `sugar-wars.com` を検索 → 空いていれば購入（クレジットカード・年 約$10）。
   - Cloudflareは**原価販売・更新値上げなし・Whois保護は標準で無料**。余計なオプションはありません。
4. 購入すると自動でCloudflareのDNSで管理されます（あとの設定がラク）。

> すでにお名前.com等で買ってしまった場合は、その画面を送ってください。ネームサーバーをCloudflareに向ける手順を案内します。

---

## 手順2：Cloudflare Pages に GitHub リポジトリを接続（本番）

1. 左メニュー **Workers & Pages → Create → Pages → Connect to Git**。
2. GitHub と連携し、リポジトリ **`negiramen1922/sugarwars-test`** を選択。
3. ビルド設定：
   - **Production branch**：`main`
   - **Framework preset**：`None`
   - **Build command**：（空欄）
   - **Build output directory**：`/`（ルート。空欄でも可）
4. **Save and Deploy**。数十秒で `〇〇.pages.dev` が発行され、そこで本番の中身が見られます。

> 以降、`main` にマージするたびに自動で本番へ反映されます（＝リリース）。

---

## 手順3：カスタムドメインを設定（本番＝sugar-wars.com）

1. 作成したPagesプロジェクト → **Custom domains → Set up a custom domain**。
2. `sugar-wars.com` を入力。CloudflareでドメインもDNSも管理しているので、**ボタンを押すだけで自動設定**（DNSレコード追加・SSL発行まで自動）。
3. 数分で `https://sugar-wars.com/` が有効になります。

> `www.sugar-wars.com` も使いたい場合は同様にもう1つ追加できます（任意）。

---

## 手順4：Firebase の承認済みドメインを追加（重要）

ログイン・オンライン対戦・クラウド保存を本番でも動かすため：

1. [Firebase コンソール](https://console.firebase.google.com/) → 対象プロジェクト。
2. **Authentication → Settings → Authorized domains（承認済みドメイン）** に、次の**両方**を追加：
   - `sugar-wars.com`
   - `negiramen1922.github.io`（テスト環境用・未登録なら）

---

## 手順5：AdSense を申請（本番ドメインで）

1. [Google AdSense](https://www.google.com/adsense/) でアカウント作成。サイトに **`sugar-wars.com`** を登録。
2. 審査用に、サイト内に **プライバシーポリシー**（`privacy.html`）と **紹介ページ**（`about.html`）を用意済み。ゲーム内メニューからもリンクしています。
3. AdSenseの指示に従い、確認用コードを `<head>` に入れる（この作業はこちらで対応できます）。
4. 審査通過後、**H5 Games Ads（リワード）のコード／広告ユニットID** を控えてください。

> 審査には数日〜数週かかることがあります。**先に申請だけ出しておく**のがおすすめです。

---

## 手順6：ドメインが有効になったら教えてください

以下はこちら（開発側）で対応します：

- [ ] `AD_PROD_HOST` を `sugar-wars.com` に設定（**対応済み**）
- [ ] `<head>` のOGP（`og:url`／`og:image`／`twitter:image`）と `SHARE_URL` を `https://sugar-wars.com/` へ差し替え
- [ ] AdSenseの確認コードを `<head>` に設置（審査用）
- [ ] 審査通過後、`adNetworkPlay()` に AdSense の H5 リワード呼び出し（`adBreak({type:'reward'})`）を実装
- [ ] `privacy.html` の **【運営者名】／【連絡先メールアドレス】** を実際の値に差し替え（← ここだけご自身で決めて教えてください）

---

## よくある質問

- **テストと本番で中身は同じ？** 基本同じ `main` を見ます。厳密に「テストで先に確認 → 本番へ」を分けたい場合は、GitHub Pages を `develop` ブランチ公開に変え、`develop→main` のマージでリリースする運用にもできます（希望があれば設定します）。
- **広告はいつ出る？** `sugar-wars.com` で開いたとき **かつ** AdSenseのキーを設定したときだけ。テスト環境・ローカルでは出ません。
- **お金はかかる？** ドメイン代（年 約1,500円）だけ。Cloudflare Pages・GitHub Pages・Firebase無料枠・SSLはすべて無料。
