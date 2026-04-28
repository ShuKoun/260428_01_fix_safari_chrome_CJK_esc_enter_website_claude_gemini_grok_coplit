# Universal IME Fix for Safari

> Fix the long-standing IME (Chinese / Japanese / Korean input method) Enter & Esc key conflict on AI chat sites in Safari.
>
> 修復 Safari 上中文 / 日文 / 韓文輸入法在 AI 聊天網站誤發送訊息、誤取消編輯的問題。
>
> Safari で中国語・日本語・韓国語入力中に誤送信・誤キャンセルされる問題を修正する Userscript。

---

## 🌐 Languages | 語言 | 言語

- [English](#english)
- [繁體中文 / 簡體中文](#中文)
- [日本語](#日本語)

---

<a name="english"></a>

## English

### 🐛 The Problem

If you use Safari on macOS with a Chinese, Japanese, or Korean input method (IME), you have probably experienced this nightmare:

- You're typing a message in **Claude.ai**, **Gemini**, **Copilot**, or **Grok**.
- You press **Enter** to confirm your IME composition (上屏 / 確定 / 확정).
- ❌ Your half-finished message gets **sent immediately**.

Or:

- You're editing a previously sent message.
- You press **Esc** to cancel IME composition.
- ❌ The whole edit gets **cancelled**, and your changes are lost.

This is **not your fault**. It's a long-standing Safari bug that has been open on WebKit Bugzilla for **over 9 years**.

### 🔍 Why does this happen?

There are two layers of fault:

1. **Safari (WebKit) bug**: Safari fires `compositionend` *before* the `keydown` event for Enter/Esc, the opposite of Chrome's behavior and the opposite of what the W3C UI Events spec implies. This makes it nearly impossible for websites to tell whether a key press is "confirming IME composition" or "submitting the form".
2. **Website oversight**: Most front-end developers don't test with IMEs. Sites that *do* defend against this (like ChatGPT, by checking `e.keyCode === 229`) work fine on Safari. Sites that *don't* (like Claude, Gemini, Copilot, Grok) break.

Result: ~1.6 billion CJK users silently suffer, while English users have no idea this bug exists.

### ✅ What this script does

This userscript intercepts `Enter` and `Escape` key events at the `window` and `document` level **in capture phase**, and blocks them whenever the IME is composing or has just finished composing within a short threshold window (default: 20ms).

Specifically:
- **Enter while composing or just-composed** → blocked, won't trigger send.
- **Esc while composing or just-composed** → blocked, won't cancel the edit.
- **Normal Enter / Esc** (not in IME context) → works as usual.

It also overrides the click handler on common send buttons as an extra layer of defense.

### 📦 Supported Sites

Currently configured for:

- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com` & Microsoft 365 Copilot domains
- `grok.com` & `x.com/i/grok`
- `office.com`

You can easily add more sites by editing the `@match` lines (see below).

### 🚀 Installation

#### For non-technical users

1. **Install Tampermonkey for Safari** from the Mac App Store: <https://apps.apple.com/app/tampermonkey/id1482490089>
   (The free "Userscripts" extension also works, but Tampermonkey is more stable in our testing.)
2. **Enable the extension** in Safari → Settings → Extensions, and grant it permission for "All Websites".
3. **If you use Safari Profiles**: enable & authorize the extension in **each profile separately** — Safari treats extensions per-profile.
4. Click the Tampermonkey icon → **Create a new script** → paste the contents of [`safari-ime-fix.user.js`](./safari-ime-fix.user.js) → click **Save** (bottom-right corner).
5. Done. Refresh the AI site and enjoy a non-broken Enter key.

#### For technical users

Or just install via the raw URL once published to Greasy Fork.

### ➕ Adding more sites

Found another site with the same bug? Just add a new `@match` line:

```javascript
// @match        https://example.com/*
```

Common candidates: Slack web, Discord web, Notion, Linear, Microsoft Teams web, Reddit, etc.

### ⚙️ Tuning the threshold

If 20ms is too short on your setup (rare), you can increase `ENTER_THRESHOLD_MS` and `ESC_THRESHOLD_MS` in the script. Try 50–100ms.

### 📜 License

MIT License — see [LICENSE](./LICENSE).

### 🙋 Author

Shu (Tokyo, independent researcher)

### 🙏 Acknowledgments

- Inspired by a Japanese workaround originally published on Zenn for Claude.ai.
- Thanks to Anthropic's Claude for collaborative debugging across many iterations.

---

<a name="中文"></a>

## 繁體中文 / 簡體中文

### 🐛 問題描述

如果你在 macOS 上使用 Safari，並且使用拼音、注音、倉頡、日文、韓文等輸入法，你大概遇過這個惡夢：

- 你在 **Claude.ai**、**Gemini**、**Copilot** 或 **Grok** 中打字。
- 你按 **Enter** 想要「上屏」確認輸入法的組字。
- ❌ 結果半成品訊息**直接被發送出去**了。

或者：

- 你在編輯之前已經發送的訊息。
- 你按 **Esc** 想要取消輸入法的組字。
- ❌ 整個編輯**直接被取消**，所做的修改全部丟失。

**這不是你的問題**——這是 Safari 一個拖了 **9 年以上**未修的 bug。

### 🔍 為什麼會這樣？

責任在兩邊：

1. **Safari (WebKit) 的 bug**：Safari 對於 Enter/Esc 鍵的事件順序是先 `compositionend` 再 `keydown`，與 Chrome 相反，也與 W3C UI Events 規範隱含的順序相反。這導致網站幾乎無法正確判斷「按 Enter 是要確認組字」還是「按 Enter 是要送出表單」。
2. **網站開發者的疏忽**：大多數前端工程師不會用 IME 測試。**有處理**的網站（例如 ChatGPT，會檢查 `e.keyCode === 229`）在 Safari 上沒問題；**沒處理**的網站（如 Claude、Gemini、Copilot、Grok）就壞掉了。

結果：全球約 16 億 CJK 用戶默默承受這個問題，而英語用戶根本不知道這個 bug 存在。

### ✅ 這個腳本做什麼

這個 userscript 在 `window` 和 `document` 兩個層級的 **capture phase** 攔截 `Enter` 與 `Escape` 鍵事件，當輸入法正在組字、或剛剛結束組字的短時間內（預設 20ms），就阻止這些事件繼續傳遞。

具體來說：
- **組字中或剛組字完按 Enter** → 攔截，不會觸發發送。
- **組字中或剛組字完按 Esc** → 攔截,不會取消編輯。
- **正常的 Enter / Esc**（非 IME 情境）→ 行為照舊。

另外腳本也會覆蓋常見發送按鈕的 click handler,作為第二層防禦。

### 📦 支援的網站

目前已設定好:

- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com` 及 Microsoft 365 Copilot 網域
- `grok.com` 與 `x.com/i/grok`
- `office.com`

你可以輕鬆透過修改 `@match` 加入更多網站(見下文)。

### 🚀 安裝方法

#### 非技術用戶

1. 從 Mac App Store 安裝 **Tampermonkey for Safari**:<https://apps.apple.com/app/tampermonkey/id1482490089>
   (免費的「Userscripts」擴充功能也可以,但實測 Tampermonkey 更穩定。)
2. 在 Safari → 設定 → 擴充功能中**啟用**,並授予「所有網站」權限。
3. **如果你使用 Safari Profiles(多個瀏覽身份)**:每個 Profile 都要**單獨啟用並授權**——Safari 對每個 Profile 的擴充功能是獨立管理的。
4. 點擊 Tampermonkey 圖示 → **新增腳本** → 貼上 [`safari-ime-fix.user.js`](./safari-ime-fix.user.js) 的內容 → 點擊**右下角的 Save**。
5. 完成。重新整理 AI 網站,享受不會誤發送的 Enter 鍵。

#### 技術用戶

之後發布到 Greasy Fork 後可以透過 raw URL 一鍵安裝。

### ➕ 加入更多網站

發現其他網站有同樣的問題?只需新增一行 `@match`:

```javascript
// @match        https://example.com/*
```

常見可能的目標:Slack 網頁版、Discord 網頁版、Notion、Linear、Microsoft Teams 網頁版、Reddit 等。

### ⚙️ 調整門檻時間

如果 20ms 在你的環境太短(機率不高),可以提高腳本中的 `ENTER_THRESHOLD_MS` 和 `ESC_THRESHOLD_MS`,試試 50–100ms。

### 📜 授權

MIT License — 見 [LICENSE](./LICENSE)。

### 🙋 作者

Shu (Tokyo, independent researcher)

### 🙏 致謝

- 靈感來自一位日本開發者最初在 Zenn 上為 Claude.ai 發布的解決方案。
- 感謝 Anthropic 的 Claude 在多次迭代過程中協作除錯。

---

<a name="日本語"></a>

## 日本語

### 🐛 問題

macOS の Safari で日本語・中国語・韓国語入力メソッド(IME)を使っている方なら、こんな経験があるはずです:

- **Claude.ai**、**Gemini**、**Copilot**、**Grok** でメッセージを入力中。
- **Enter** で変換を確定しようとした。
- ❌ 入力途中のメッセージが**そのまま送信される**。

あるいは:

- 送信済みメッセージを編集中。
- **Esc** で変換をキャンセルしようとした。
- ❌ 編集自体が**キャンセル**され、加えた変更が全て失われる。

**これはあなたのせいではありません**。WebKit Bugzilla に **9 年以上**放置されたままの Safari の長年のバグです。

### 🔍 原因

責任は二つの層にあります:

1. **Safari (WebKit) のバグ**:Safari は Enter/Esc キーに対して `compositionend` を `keydown` より**先に**発火します。これは Chrome の挙動とも、W3C UI Events 仕様が示唆する順序とも逆です。そのため、ウェブサイトが「Enter が変換確定なのか、フォーム送信なのか」を判別するのが事実上不可能になっています。
2. **ウェブサイト側の見落とし**:多くのフロントエンドエンジニアは IME でテストしません。**対策している**サイト(例: ChatGPT は `e.keyCode === 229` をチェック)は Safari でも問題なく動作します。**対策していない**サイト(Claude、Gemini、Copilot、Grok など)で問題が起きます。

結果として、世界中で約 16 億人の CJK ユーザーがこの問題を黙って耐え、英語圏ユーザーはバグの存在すら知りません。

### ✅ このスクリプトの動作

このユーザースクリプトは、`window` および `document` の **capture phase** で `Enter` と `Escape` キーイベントを傍受し、IME が変換中または変換終了直後(デフォルト 20ms 以内)であればイベントの伝搬を阻止します。

具体的には:
- **変換中または変換終了直後の Enter** → 阻止、送信されない。
- **変換中または変換終了直後の Esc** → 阻止、編集がキャンセルされない。
- **通常の Enter / Esc**(IME とは無関係) → 通常通り動作。

また、一般的な送信ボタンの click ハンドラもオーバーライドして、二重の防御層としています。

### 📦 対応サイト

現在以下のサイトに対応:

- `claude.ai`
- `gemini.google.com`
- `copilot.microsoft.com` および Microsoft 365 Copilot 関連ドメイン
- `grok.com` および `x.com/i/grok`
- `office.com`

`@match` を編集することで簡単に他のサイトを追加できます(下記参照)。

### 🚀 インストール方法

#### 非エンジニアの方向け

1. Mac App Store から **Tampermonkey for Safari** をインストール: <https://apps.apple.com/app/tampermonkey/id1482490089>
   (無料の「Userscripts」拡張機能でも動きますが、検証では Tampermonkey の方が安定していました。)
2. Safari → 設定 → 機能拡張 で**有効化**し、「すべての Web サイト」へのアクセスを許可。
3. **Safari Profiles を使っている場合**:各 Profile で**個別に有効化と権限付与**が必要です。Safari は機能拡張を Profile 単位で管理しています。
4. Tampermonkey のアイコンをクリック → **新規スクリプト作成** → [`safari-ime-fix.user.js`](./safari-ime-fix.user.js) の内容を貼り付け → **右下の Save** ボタンをクリック。
5. 完了です。AI サイトを再読み込みすれば、Enter キーが壊れていない世界が手に入ります。

#### エンジニアの方向け

Greasy Fork に公開後、raw URL で一発インストールも可能になる予定です。

### ➕ 他サイトの追加

同じバグを別のサイトで発見したら、`@match` を 1 行追加するだけです:

```javascript
// @match        https://example.com/*
```

候補例:Slack web、Discord web、Notion、Linear、Microsoft Teams web、Reddit など。

### ⚙️ 閾値の調整

20ms が環境によって短すぎる場合(稀ですが)、スクリプト内の `ENTER_THRESHOLD_MS` と `ESC_THRESHOLD_MS` を 50–100ms に上げてみてください。

### 📜 ライセンス

MIT License — [LICENSE](./LICENSE) を参照。

### 🙋 作者

Shu (Tokyo, independent researcher)

### 🙏 謝辞

- 元々は日本の開発者が Zenn で Claude.ai 向けに公開した解決策にインスパイアされました。
- 何度もの反復デバッグに付き合ってくれた Anthropic の Claude に感謝します。

---

## 🔗 Related

- [WebKit Bugzilla — IME composition event ordering](https://bugs.webkit.org/) (search for `isComposing`)
- [W3C UI Events Specification](https://www.w3.org/TR/uievents/)
- [Tampermonkey for Safari](https://apps.apple.com/app/tampermonkey/id1482490089)

---

**Tags / 標籤 / タグ:** Safari, IME, Userscript, Tampermonkey, Claude, Gemini, Copilot, Grok, Chinese input method, 拼音, 注音, 中文輸入法, 日本語入力, 한국어 입력, CJK, accessibility, WebKit bug, isComposing, keyCode 229