# Ask AI — Phase 1

動画学習カードの4番目に Ask AI を追加。Phase 2の保存・音声・Discussion・報酬は含まない。

## 有効化

1. Supabase SQL Editor、または既存のマイグレーション手順で `supabase/migrations/20261101_ask_ai_rate_limits.sql` を適用する。
2. Vercelの対象環境（Production / Preview）に下記の環境変数を設定して再デプロイする。ローカルは `.env.local`。
3. ログインした状態で動画ページの Ask AI を開く。

| 環境変数 | 必須 | 用途 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 必須 | サーバー専用APIキー。`NEXT_PUBLIC_` を付けない |
| `OPENAI_MODEL` | 任意 | 既定値 `gpt-5.6-luna`。変更先はResponses API対応テキストモデル |
| `ASK_AI_INCLUDE_TRANSCRIPT` | 任意 | AIへの送信が許可されたTranscriptを使う場合だけ `true`。既定は送信しない |
| `NEXT_PUBLIC_SUPABASE_URL` | 既存 | Supabase接続先 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 既存 | セッション・RLSによるDBアクセス |

サービスロールキーや新しい外部レート制限サービスは不要。SQL未適用時はAPIが503で停止し、無制限のOpenAI呼び出しを防ぐ。この実装作業では本番DBへのSQL適用・Vercel環境変数の設定は行っていない。

## 構成と上限

- ブラウザ → `POST /api/ask-ai` → OpenAI公式Node SDKの `responses.create()`。非ストリーミング、`store: false`、自動再試行なし、30秒タイムアウト。
- `supabase.auth.getUser()` で認証。異なるOrigin、不正JSON、任意Transcript・systemロールなどの追加項目は拒否。
- 動画IDから `categories` をRLS付きサーバークライアントで取得。タイトル・チャンネル・カテゴリ・難易度は各300文字まで。IDなしは一般質問、存在しないIDは404。
- Transcriptは明示的な設定がある場合に限り、検証した動画IDとslugで `captions` から取得。既存パーサーを使い先頭6,000文字まで。利用できない場合や抜粋の場合、内容を断定しないよう指示する。
- 質問2,000文字、履歴は直近6往復（12メッセージ）かつ12,000文字。個々の回答履歴は6,000文字、リクエスト全体64,000バイト。OpenAI出力は最大1,200トークン。
- SQL関数の原子的なカウンター更新でユーザーごとに毎分10回・UTC日付ごと100回。複数Vercelインスタンスでも共有。失敗したAPI試行も消費し、ユーザー操作でのみ再試行する。
- カウンターテーブルにはユーザーID・時間枠・回数のみ保存。質問・回答・会話はDB保存しない。
- チャットはReactローカル状態。Radixの `forceMount` でタブ移動時に保持。動画ID（欠損時slug）とユーザーIDのReact keyで別動画・別ユーザーから分離し、離脱時は進行中リクエストを中断。ページ再読み込み・別動画への遷移後の復元は行わない。
- Enter送信、Shift+Enter改行、日本語IME変換確定では送信しない。refとdisabledで二重送信を防止。エラー時は同じ質問の再試行・編集が可能。
- 入力・Transcriptは上位指示と分離した非信頼データとして渡す。回答はプレーンテキストで表示。APIキー・質問・応答・上流エラー詳細をログに出さない。

モデル根拠: [OpenAI公式モデル仕様](https://developers.openai.com/api/docs/models/gpt-5.6-luna)。低コスト用途向け、Responses API対応。既定モデルのみ reasoning effort を `none` に設定し、別モデルへの切替時は指定しない。

## 追加・変更ファイル

- `src/components/article/LearningTabs.tsx`: 第4タブ、状態保持、狭い画面でのタブ横スクロール。
- `src/components/article/AskAIChat.tsx`: チャットUI・送信・再試行。
- `src/app/api/ask-ai/route.ts`: 認証・検証・動画取得・OpenAI連携。
- `src/lib/ask-ai/prompt.ts`: AIチューターのプロンプト。内容の調整はこのファイルで行う。
- `src/lib/ask-ai/shared.ts`: 共通型・上限・履歴切り詰め・リクエスト検証。
- `src/app/globals.css`: PCのAsk AIパネル内部スクロール。
- `supabase/migrations/20261101_ask_ai_rate_limits.sql`: 共有レート制限。
- `tests/ask-ai.test.cjs`: APIとチャットの回帰テスト。
- `package.json`, `pnpm-lock.yaml`: OpenAI SDK、テストコマンド。
- `docs/ask-ai-phase1.md`: 本書。

## 検証

- `pnpm test:ask-ai`: 7件成功。入力検証・履歴上限・認証・Origin・共有制限・動画検証・Transcriptの明示許可・上流エラー・タイムアウト・二重送信・会話継続・再試行・IME。
- `pnpm test:learning`: 既存15件成功。
- `pnpm exec tsc --noEmit`: 成功。
- 変更TS/TSXと追加テストへのESLint: 成功。
- `pnpm build`: 成功（Google Fonts取得にネットワーク許可が必要）。
- 一時ブラウザハーネスで実LearningTabs/AskAIChatと本番CSSを使用し、320px / 768px / 1440pxで確認: 第4タブ選択、Transcript切替後の会話保持、追加質問の履歴送信、別動画への分離、エラー再試行、生成中の無効化、長文の内部スクロール、入力欄の表示、ページ横はみ出しなし。認証と既存Quiz/Vocabularyコンポーネント・API応答はモック。
- 一時PGlite（Postgres互換）でSQLを実行: 分・日の上限、時間枠リセット、ユーザー分離、カウンター直接参照拒否、匿名RPC拒否を確認。
- 設定されたキーと既定モデルを使った実OpenAI SDK呼び出しで、日本語・英語・追加質問の応答を確認。

実Supabaseへのマイグレーション適用後の、認証セッションからDB・OpenAIまでの通し確認はデプロイ先で必要。
