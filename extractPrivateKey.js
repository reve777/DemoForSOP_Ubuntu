const fs = require('fs');
const Wallet = require('ethereumjs-wallet').default || require('ethereumjs-wallet');

// 1. 設定 Linux 絕對路徑 (請確認這兩個檔案路徑在你的 Ubuntu 裡是正確的)
// const keystorePath = '/home/user/Ivan/ivan/keystore/UTC--2026-04-08T02-32-54.573553949Z--75dd1e2b3d6355db6b9da58d0717379d355f48af';
const keystorePath = '/home/user/Ivan/ivan_new/keystore/UTC--2026-04-13T08-01-34.003324087Z--71562b71999873db5b286df957af199ec94617f7';
// const pwdPath = '/home/user/Ivan/ivan/pwd.txt';
const pwdPath = '/home/user/Ivan/ivan_new/pwd.txt';

try {
    // 2. 讀取檔案
    if (!fs.existsSync(keystorePath)) throw new Error(`找不到 Keystore 檔案: ${keystorePath}`);
    if (!fs.existsSync(pwdPath)) throw new Error(`找不到密碼檔: ${pwdPath}`);

    const keystore = fs.readFileSync(keystorePath, 'utf8');
    // const password = fs.readFileSync(pwdPath, 'utf8').trim();
    const password = "";

    // 3. 解密 wallet (保持原邏輯)
    // 注意：ethereumjs-wallet 新版可能需要 .default，這裡做了相容處理
    const wallet = Wallet.fromV3(JSON.parse(keystore), password);

    // 4. 輸出 PRIVATE_KEY
    console.log("\n============================================================");
    console.log("PRIVATE_KEY=0x" + wallet.getPrivateKey().toString('hex'));
    console.log("============================================================\n");

} catch (error) {
    console.error("❌ 執行失敗:");
    console.error(error.message);
}