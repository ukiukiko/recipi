# 段取りシェフ

「献立を探す時間」「複数品の段取り」「調味料の確認」「買い物リスト作成」をまとめて短縮する、スマホ向けローカルファーストPWAのプロトタイプです。

## この初期版でできること

- 調理可能時間（20 / 30 / 40 / 50分）から主菜＋副菜を提案
- 冷蔵庫・在庫を優先した献立提案
- 献立と在庫の差分から買い物リストを自動作成
- 在庫をスマホ内のIndexedDBへ保存
- 主菜と副菜の工程を簡易的に統合
- 調理中は画面全体の横スワイプで「次 / 前」へ移動
- 工程内タイマーを自動開始
- 対応端末では調理中の画面スリープを抑止
- PWAとしてホーム画面追加可能

## 技術構成

- React
- TypeScript
- Vite
- IndexedDB
- Service Worker / Web App Manifest
- バックエンドなし

## 起動

```bash
npm install
npm run dev
```

同一LAN上のスマホから確認する場合は、PCのファイアウォール設定に注意し、Viteが表示するNetwork URLへアクセスしてください。

## 本番ビルド

```bash
npm run build
```

`dist/` が生成されます。静的サイトとして配信できます。

## GitHubへ置く

```bash
git init
git add .
git commit -m "Initial prototype"
git branch -M main
git remote add origin <YOUR_REPOSITORY_URL>
git push -u origin main
```

## 現在のサンプルレシピ

- 鶏むね豆腐ナゲット
- 豚こま生姜焼き
- 鮭のバター醤油焼き
- キャベツのタレ和え
- きゅうり塩だれ
- レンジ無限ピーマン

初期データとして、鶏むね肉550g・木綿豆腐150g・キャベツ1/2玉・卵4個を在庫登録しています。実際の利用時に削除・追加できます。

## 次に実装したいもの

1. レシピの追加・編集画面
2. YouTube候補検索とレシピURL保存
3. 複数の料理をDAGとして扱う本格的な工程最適化
4. 調味料の累積g計量モード
5. 土曜昼＋夜をまとめた献立 / 買い物最適化
6. 実調理時間を学習して次回予測へ反映
7. GitHub Pages向けの自動デプロイ

## データについて

この初期版はサーバーへデータを送信しません。在庫・チェック状態は端末のブラウザ内（IndexedDB）に保存されます。

## GitHub Pagesでスマホから使う

`.github/workflows/deploy-pages.yml` を同梱しています。GitHubへpush後、リポジトリの **Settings → Pages → Source** を **GitHub Actions** にすると、`main` へのpush時に静的サイトをビルド・公開できます。

公開後のURLをスマホで開き、ブラウザの「ホーム画面に追加」を使えばアプリ風に起動できます。
