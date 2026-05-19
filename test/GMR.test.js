const { assert } = require("chai");
const GMR = artifacts.require("../contracts/GMR.sol");
require("chai").use(require("chai-as-promised")).should();
// 頂部加入
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

contract("GMR contract test...", accounts => {
    let gmr;
    const admin = accounts[0];    // 預設 Manager
    const secondAdmin = accounts[1]; // 準備被授權的第二個管理員
    const player = accounts[2];   // 普通玩家

    // beforeEach(async () => {
    //     // 取得已部署的合約實例
    //     gmr = await GMR.deployed();
    // });
    // beforeEach 改為（每次重新部署，避免狀態污染）：
    beforeEach(async () => {
        gmr = await deployProxy(GMR, [], { initializer: "initialize", kind: "uups", from: admin });
    });

    // --- 原有的基礎測試 ---
    it("應該正確取得帳戶與位址", () => {
        console.log("📍 Manager 地址:", admin);
        assert.ok(admin, "應該有管理員帳號");
        assert.ok(gmr.address, "合約應該已部署並有地址");
    });

    it("初始餘額應該為 0", async () => {
        let balance = await gmr.getBalance();
        console.log("💰 初始合約餘額:", web3.utils.fromWei(balance, 'ether'), "ETH");
        assert.equal(balance.toNumber(), 0);
    });

    // --- 📥 新增：玩家加入測試 ---
    it("玩家應該能投入資金參加遊戲", async () => {
        // 玩家發送 0.02 ETH (大於限制的 0.01)
        await gmr.enterGame({ from: player, value: web3.utils.toWei("0.02", "ether") });

        let balance = await gmr.getBalance();
        let players = await gmr.getCurrentPlayers();

        console.log("🎮 玩家參加後合約餘額:", web3.utils.fromWei(balance, 'ether'), "ETH");
        assert.equal(web3.utils.fromWei(balance, 'ether'), "0.02");
        assert.equal(players.length, 1);
        assert.equal(players[0], player);
    });

    // --- 🔐 新增：權限授權測試 (核心功能) ---
    it("應該能授權第二個帳號為管理員並成功開獎", async () => {
        // 1. 先讓一個玩家進場 (才有錢可以開獎)
        await gmr.enterGame({ from: player, value: web3.utils.toWei("0.05", "ether") });

        // 2. 測試：此時 accounts[1] 還沒被授權，開獎應該會失敗 (Revert)
        await gmr.payMoneyToPlayer({ from: secondAdmin }).should.be.rejectedWith("Access denied");
        console.log("✅ 攔截成功：未授權帳號無法開獎");

        // 3. 授權：由 Manager (accounts[0]) 授權給 accounts[1]
        await gmr.addAdmin(secondAdmin, { from: admin });
        console.log("🔑 已授權給第二個管理員:", secondAdmin);

        // 4. 再次測試：現在 accounts[1] 應該可以成功開獎了
        await gmr.payMoneyToPlayer({ from: secondAdmin });

        // 驗證結果
        let finalBalance = await gmr.getBalance();
        let playersList = await gmr.getCurrentPlayers();

        console.log("🏆 開獎成功！合約餘額已清空為:", finalBalance.toNumber());
        assert.equal(finalBalance.toNumber(), 0, "開獎後餘額應歸零");
        assert.equal(playersList.length, 0, "開獎後玩家名單應清空");
    });

    // --- 🚫 新增：權限移除測試 ---
    it("Manager 應該能移除其他人的管理權限", async () => {
        await gmr.removeAdmin(secondAdmin, { from: admin });
        // 移除後再次嘗試開獎，應該又要失敗
        await gmr.payMoneyToPlayer({ from: secondAdmin }).should.be.rejectedWith("Access denied");
        console.log("🚫 成功移除權限並測試攔截");
    });
});