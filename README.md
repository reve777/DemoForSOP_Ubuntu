Ethereum Smart Contract & Node.js DApp Demo
本專案為一個基於 Linux Geth（創世區塊）測試環境的完整 Demo。包含了以太坊智能合約的開發、部署、升級，以及前端網頁的互動（支援純 API 模式與 MetaMask UI 模式）。
🚀 系統架構與技術棧
區塊鏈底層： 以太坊 (Ethereum) / Linux Geth (自建創世區塊測試鏈)
智能合約語言： Solidity（支援首次部署與合約升級邏輯）
後端/服務端： Node.js
前端介面： index.html (由 Node.js 服務驅動)

🛠 核心功能與開發流程
1. 智能合約管理 (Solidity)
專案架構支援將合約生命週期切分為兩個主要階段：
首次部署 (Deploy)： 部署初始合約至 Geth 測試鏈。
合約升級 (Upgrade)： 執行合約更新，在保留原資料/地址或透過代理合約（Proxy）的前提下更新業務邏輯。
2. 資料操作 (CRUD)
本專案支援對區塊鏈上的資料進行增刪查改（CRUD）操作：

⚙️ 環境設定與運行模式 (.env)
請先將專案中的 env 範例檔案重新命名或複製為 .env，並根據你的 Geth 環境修改設定。本專案支援以下兩種運行模式：

📌 模式 A：純 API 模式 (無 UI 介面，不使用 MetaMask)
此模式完全由後端程式碼與 Geth 節點直接互動，需在 .env 中設定私鑰與節點位置：
PRIVATE_KEY：填入你的 Geth 帳戶私鑰（ prk ）。
RPC_URL：填入你的 Geth 節點連線位置（例如 http://localhost:8545）。

📌 模式 B：UI 介面模式 (使用 MetaMask)
此模式透過瀏覽器與使用者錢包進行互動：
瀏覽器準備： 使用 Chrome 瀏覽器並安裝 MetaMask 擴充功能。
錢包設定：
在 MetaMask 中「匯入帳戶」，將你的 Geth 創世區塊私鑰 匯入。
在 MetaMask 中「新增網路」，將 RPC URL 指向你的 Geth 節點位置。

<img  width="100%" src="https://github.com/reve777/DemoForSOP_Ubuntu/blob/main/metaMask.png" />
