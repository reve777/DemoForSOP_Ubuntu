const { assert } = require("chai");
const DEMO = artifacts.require("DEMO");
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

contract("DEMO 合約整合測試", accounts => {
    let demo;
    const admin = accounts[0];
    const user1 = accounts[1];
    // 確保 attacker 一定有值，若環境只提供兩個 accounts 則安全降級使用 accounts[1]
    const attacker = accounts[2] ? accounts[2] : accounts[1];

    // 狀態 Enum 對應
    const Status = { Active: 0, Inactive: 1, Deleted: 2 };
    // 操作類型 Enum 對應
    const ActionType = { Created: 0, Updated: 1, Deleted: 2, Queried: 3 };

    // 安全轉換 BigNumber 的輔助函式，避免 .toNumber() 報錯
    const getNum = (val) => (web3.utils.isBN(val) ? val.toNumber() : Number(val));

    beforeEach(async () => {
        // 使用 OpenZeppelin 升級插件部署 Transparent Proxy
        demo = await deployProxy(DEMO, [], { initializer: "initialize", kind: "transparent", from: admin });
    });

    // ════════════════════════════════════════════════════════
    // 1. 部署與基本屬性
    // ════════════════════════════════════════════════════════
    describe("1. 部署與基本屬性", () => {
        
        /**
         * 【測試項目】：確認合約部署位址
         * 【測試目的】：驗證 Proxy 代理合約是否成功部署，並在鏈上取得合法地址。
         */
        it("確認合約部署位址", () => {
            assert.ok(demo.address);
        });

        /**
         * 【測試項目】：確認管理員權限
         * 【測試目的】：驗證 Ownable 模組是否正確初始化，權限擁有人 (Owner) 必須是 admin (accounts[0])。
         */
        it("確認管理員是否為 accounts[0]", async () => {
            const owner = await demo.owner();
            assert.equal(owner, admin);
        });
    });

    // ════════════════════════════════════════════════════════
    // 2. 使用者新增與查詢 (CREATE & READ) & Log 測試
    // ════════════════════════════════════════════════════════
    describe("2. 使用者新增與查詢", () => {

        /**
         * 【測試項目】：管理員新增使用者與全欄位精準檢核
         * 【測試目的】：
         *  1. 驗證 `createUser` 功能是否能由管理員正常執行。
         *  2. 驗證是否正確拋出 `UserCreated` 與自訂稽核日誌 `ActionLog` 事件。
         *  3. 【全面欄位檢核】：查回儲存的 Struct，對包含系統時間在內的 14 個欄位進行逐一比對。
         */
        it("管理員應該能新增使用者，並正確觸發 ActionLog 監聽，且所有儲存欄位皆需與輸入相符", async () => {
            // 對應 Solidity 的 CreateUserInput struct
            const userInput = {
                account: "A01",
                passwordPlain: "pwd123",
                name: "小明",
                birthday: 20260323,
                department: "IT",
                team: "Backend",
                status: Status.Active,
                effectiveDate: 1711180800,
                expiryDate: 0,
                hireDate: 1648022400,
                memo: "備註測試",
                chineseZodiac: "Horse"
            };

            const tx = await demo.createUser(userInput, { from: admin });

            // 驗證原有事件 UserCreated
            const userCreatedEvent = tx.logs.find(log => log.event === "UserCreated");
            assert.exists(userCreatedEvent, "未觸發 UserCreated 事件");
            assert.equal(userCreatedEvent.args.account, userInput.account);

            // ★ 驗證新 log 事件 ActionLog
            const actionLogEvent = tx.logs.find(log => log.event === "ActionLog");
            assert.exists(actionLogEvent, "未觸發 ActionLog 事件");
            assert.equal(getNum(actionLogEvent.args.action), ActionType.Created);
            assert.equal(getNum(actionLogEvent.args.userId), 1);
            assert.equal(actionLogEvent.args.operator, admin);

            // 驗證查詢與【每個欄位的全面檢核】
            const result = await demo.getByAccount(userInput.account);
            const savedUser = result.user;

            assert.equal(getNum(result.id), 1, "ID 分配錯誤");
            assert.equal(savedUser.account, userInput.account, "account 欄位不符");
            assert.equal(savedUser.name, userInput.name, "name 欄位不符");
            assert.equal(getNum(savedUser.birthday), userInput.birthday, "birthday 欄位不符");
            assert.equal(savedUser.department, userInput.department, "department 欄位不符");
            assert.equal(savedUser.team, userInput.team, "team 欄位不符");
            assert.equal(getNum(savedUser.status), userInput.status, "status 欄位不符");
            assert.equal(getNum(savedUser.effectiveDate), userInput.effectiveDate, "effectiveDate 欄位不符");
            assert.equal(getNum(savedUser.expiryDate), userInput.expiryDate, "expiryDate 欄位不符");
            assert.equal(getNum(savedUser.hireDate), userInput.hireDate, "hireDate 欄位不符");
            assert.equal(savedUser.memo, userInput.memo, "memo 欄位不符");
            assert.equal(savedUser.chineseZodiac, userInput.chineseZodiac, "chineseZodiac 欄位不符");
            
            // 系統自動生成之時間欄位檢核
            assert.notEqual(getNum(savedUser.createdAt), 0, "createdAt 欄位不應為0");
            assert.equal(getNum(savedUser.updatedAt), getNum(savedUser.createdAt), "初始化時 updatedAt 應等於 createdAt");

            // 密碼驗證
            const isPasswordValid = await demo.verifyPassword(1, userInput.passwordPlain);
            assert.isTrue(isPasswordValid, "密碼比對驗證失敗");
        });

        /**
         * 【測試項目】：非管理員新增阻斷測試 (onlyOwner)
         * 【測試目的】：確認合約具備權限控管，非 owner 帳號調用 `createUser` 時必須 Revert。
         */
        it("非管理員新增應該要失敗 (onlyOwner 測試)", async () => {
            const userInput = {
                account: "A02", passwordPlain: "p", name: "駭客", birthday: 0,
                department: "", team: "", status: Status.Active, effectiveDate: 0,
                expiryDate: 0, hireDate: 0, memo: "", chineseZodiac: ""
            };

            try {
                await demo.createUser(userInput, { from: attacker });
                assert.fail("非管理員竟然可以新增！");
            } catch (err) {
                const isAuthError = err.message.includes("Ownable") || 
                                    err.message.includes("caller is not the owner") || 
                                    err.message.includes("unauthorized") ||
                                    err.message.includes("from");
                assert.isTrue(isAuthError, "未預期的錯誤訊息: " + err.message);
            }
        });

        /**
         * 【測試項目】：密碼比對模組測試
         * 【測試目的】：驗證 `verifyPassword` 內部的 Keccak256 雜湊比對邏輯，輸入正確及錯誤明文時是否能精準回傳 true/false。
         */
        it("密碼驗證功能應正確 (verifyPassword)", async () => {
            const userInput = {
                account: "V01", passwordPlain: "secret", name: "驗證員", birthday: 0,
                department: "", team: "", status: Status.Active, effectiveDate: 0,
                expiryDate: 0, hireDate: 0, memo: "", chineseZodiac: ""
            };
            await demo.createUser(userInput, { from: admin });

            const isCorrect = await demo.verifyPassword(1, "secret");
            const isWrong = await demo.verifyPassword(1, "wrong");
            assert.isTrue(isCorrect, "正確密碼應為 true");
            assert.isFalse(isWrong, "錯誤密碼應為 false");
        });

        /**
         * 【測試項目】：條件過濾查詢 (生肖/部門/團隊)
         * 【測試目的】：確認鏈上唯讀循環篩選功能，在面對指定條件時，能準確抓取對應的資料筆數。
         */
        it("依照特定欄位查詢 (生肖/部門/團隊)", async () => {
            await demo.createUser({
                account: "Z01", passwordPlain: "p", name: "張三", birthday: 0,
                department: "Sales", team: "TeamA", status: Status.Active, effectiveDate: 0,
                expiryDate: 0, hireDate: 1000, memo: "", chineseZodiac: "Dragon"
            }, { from: admin });

            const dragonUsers = await demo.getByChineseZodiac("Dragon");
            assert.equal(dragonUsers.length, 1, "生肖查詢數量不符");
            assert.equal(dragonUsers[0].name, "張三");

            const salesUsers = await demo.getByDepartment("Sales");
            assert.equal(salesUsers.length, 1, "部門查詢數量不符");

            const teamAUsers = await demo.getByTeam("TeamA");
            assert.equal(teamAUsers.length, 1, "團隊查詢數量不符");
        });
    });

    // ════════════════════════════════════════════════════════
    // 3. 資料修改 (UPDATE) & 變更欄位 Log 測試
    // ════════════════════════════════════════════════════════
    describe("3. 資料修改", () => {
        beforeEach(async () => {
            await demo.createUser({
                account: "U01", passwordPlain: "p", name: "舊名字", birthday: 19900101,
                department: "舊部門", team: "舊組別", status: Status.Active, effectiveDate: 100,
                expiryDate: 200, hireDate: 50, memo: "舊備註", chineseZodiac: "Tiger"
            }, { from: admin });
        });

        /**
         * 【測試項目】：修改使用者資料與變更日誌比對（修改後全欄位檢核）
         * 【測試目的】：
         *  1. 驗證資料修改後，`UpdateLog` 拋出的 `changedFields` 字串是否精準命中被異動的欄位名。
         *  2. 【每個欄位全面檢核】：調用 `getById` 對所有 14 個欄位（不論是更新的值還是維持原樣的值）進行全面覆蓋校對，確保未修改欄位沒有被污染。
         */
        it("成功修改使用者資料，並正確記錄變更的欄位字串 (UpdateLog)", async () => {
            const updateInput = {
                name: "新名字",
                birthday: 19900101, // 沒變
                department: "新部門",
                team: "舊組別",       // 沒變
                status: Status.Inactive, 
                effectiveDate: 100, // 沒變
                expiryDate: 200,    // 沒變
                hireDate: 50,       // 沒變
                memo: "修改備註",
                chineseZodiac: "Tiger" // 沒變
            };

            const tx = await demo.updateUser(1, updateInput, { from: admin });

            // 驗證新 log 事件 UpdateLog 是否準確抓到被改動的欄位
            const updateLogEvent = tx.logs.find(log => log.event === "UpdateLog");
            assert.exists(updateLogEvent, "未觸發 UpdateLog 事件");
            
            const changedFields = updateLogEvent.args.changedFields;
            assert.include(changedFields, "name");
            assert.include(changedFields, "department");
            assert.include(changedFields, "status");
            assert.include(changedFields, "memo");
            assert.notInclude(changedFields, "birthday");
            assert.notInclude(changedFields, "team");

            // 驗證修改後的資料與【每個欄位的全面檢核】
            const result = await demo.getById(1);
            
            // 檢查有異動的欄位
            assert.equal(result.name, updateInput.name, "name 欄位修改未生效");
            assert.equal(result.department, updateInput.department, "department 欄位修改未生效");
            assert.equal(getNum(result.status), updateInput.status, "status 欄位修改未生效");
            assert.equal(result.memo, updateInput.memo, "memo 欄位修改未生效");
            
            // 檢查必須保持原樣、未被改動的欄位
            assert.equal(result.account, "U01", "未更動的 account 欄位遭到污染");
            assert.equal(getNum(result.birthday), updateInput.birthday, "未變動的 birthday 遭到污染");
            assert.equal(result.team, updateInput.team, "未變動的 team 遭到污染");
            assert.equal(getNum(result.effectiveDate), updateInput.effectiveDate, "未變動的 effectiveDate 遭到污染");
            assert.equal(getNum(result.expiryDate), updateInput.expiryDate, "未變動的 expiryDate 遭到污染");
            assert.equal(getNum(result.hireDate), updateInput.hireDate, "未變動的 hireDate 遭到污染");
            assert.equal(result.chineseZodiac, updateInput.chineseZodiac, "未變動的 chineseZodiac 遭到污染");

            // 檢查更新時間戳記軌跡
            assert.notEqual(getNum(result.updatedAt), getNum(result.createdAt), "資料異動後 updatedAt 欄位未推前");
        });

        /**
         * 【測試項目】：密碼更新組件測試
         * 【測試目的】：確認單獨呼叫 `updatePassword` 修改密碼時，異動日誌文字符合 "passwordHash" 且新密碼可成功驗證通過。
         */
        it("修改密碼應正確觸發 ActionLog 與 UpdateLog", async () => {
            const tx = await demo.updatePassword(1, "newSecret", { from: admin });
            
            const updateLogEvent = tx.logs.find(log => log.event === "UpdateLog");
            assert.equal(updateLogEvent.args.changedFields, "passwordHash");
            
            const isNewCorrect = await demo.verifyPassword(1, "newSecret");
            assert.isTrue(isNewCorrect);
        });

        /**
         * 【測試項目】：無效 ID 修改攔截 (userExists 修飾詞)
         * 【測試目的】：確認對不存在的 ID 進行資料修改時，合約能正確執行 Revert 阻斷。
         */
        it("修改不存在的 ID 應該失敗 (userExists 測試)", async () => {
            const updateInput = {
                name: "不存在", birthday: 0, department: "", team: "",
                status: Status.Active, effectiveDate: 0, expiryDate: 0, hireDate: 0, memo: "", chineseZodiac: ""
            };
            try {
                await demo.updateUser(999, updateInput, { from: admin });
                assert.fail("不應該能修改不存在的 ID");
            } catch (err) {
                const isExpectedFailure = err.message.includes("User not found") || 
                                          err.message.includes("Transaction") || 
                                          err.message.includes("revert");
                assert.isTrue(isExpectedFailure, "合約並未如預期般拒絕無效的 ID，實際錯誤: " + err.message);
            }
        });
    });

    // ════════════════════════════════════════════════════════
    // 4. 邏輯刪除 (DELETE)
    // ════════════════════════════════════════════════════════
    describe("4. 邏輯刪除測試", () => {
        beforeEach(async () => {
            await demo.createUser({
                account: "D01", passwordPlain: "p", name: "刪除測試", birthday: 0,
                department: "HR", team: "", status: Status.Active, effectiveDate: 0,
                expiryDate: 0, hireDate: 0, memo: "", chineseZodiac: ""
            }, { from: admin });
        });

        /**
         * 【測試項目】：邏輯刪除狀態流轉與其餘欄位完整度檢核（全欄位檢核）
         * 【測試目的】：
         *  1. 驗證執行 `deleteById` 後，儲存狀態是否流轉為 `Deleted` (狀態值 2)。
         *  2. 【每個欄位全面檢核】：確認除了狀態和更新時間變動外，其餘基本資料（如帳號、名稱、部門等）仍安全地被原地保留在儲存槽中。
         */
        it("執行 deleteById 後狀態應變為 Deleted (2) 且觸發 ActionLog", async () => {
            const tx = await demo.deleteById(1, { from: admin });
            
            const actionLogEvent = tx.logs.find(log => log.event === "ActionLog");
            assert.equal(getNum(actionLogEvent.args.action), ActionType.Deleted);

            // 刪除後的【全欄位檢核】
            const user = await demo.getById(1);
            assert.equal(getNum(user.status), Status.Deleted, "狀態未流轉為 Deleted"); 
            assert.equal(user.account, "D01", "刪除後基礎欄位 account 遺失或毀損");
            assert.equal(user.name, "刪除測試", "刪除後基礎欄位 name 遺失或毀損");
            assert.equal(user.department, "HR", "刪除後基礎欄位 department 遺失或毀損");
            assert.notEqual(getNum(user.updatedAt), 0, "刪除後未寫入更新時間");
        });

        /**
         * 【測試項目】：軟刪除資料防編輯鎖定測試 (notDeleted 修飾詞)
         * 【測試目的】：確認已被標記為已刪除的人員，合約修飾詞 `notDeleted` 會徹底鎖死，拒絕後續任何修改申請。
         */
        it("對已刪除的 ID 再次修改應失敗 (notDeleted 測試)", async () => {
            await demo.deleteById(1, { from: admin });
            
            const updateInput = {
                name: "嘗試改名", birthday: 0, department: "", team: "",
                status: Status.Active, effectiveDate: 0, expiryDate: 0, hireDate: 0, memo: "", chineseZodiac: ""
            };

            try {
                await demo.updateUser(1, updateInput, { from: admin });
                assert.fail("不應能修改已刪除的人員");
            } catch (err) {
                const isExpectedFailure = err.message.includes("User already deleted") || 
                                          err.message.includes("Transaction") || 
                                          err.message.includes("revert");
                assert.isTrue(isExpectedFailure, "合約並未如預期般拒絕修改已刪除 the ID，實際錯誤: " + err.message);
            }
        });

        /**
         * 【測試項目】：有效人員集合查詢過濾
         * 【測試目的】：驗證當人員被邏輯刪除後，調用 `findAllActive()` 回傳的有效列表中會自動將其排除。
         */
        it("findAllActive 不應包含已刪除人員", async () => {
            await demo.deleteById(1, { from: admin });
            const actives = await demo.findAllActive();
            assert.equal(actives.length, 0);
        });

        /**
         * 【測試項目】：帳號二級索引邏輯刪除路由
         * 【測試目的】：確認透過帳號字串呼叫 `deleteByAccount`，能成功尋得 ID 並連動底層將狀態置換為 Deleted。
         */
        it("可以透過帳號刪除人員 (deleteByAccount)", async () => {
            await demo.deleteByAccount("D01", { from: admin });
            const user = await demo.getById(1);
            assert.equal(getNum(user.status), Status.Deleted);
        });
    });

    // ════════════════════════════════════════════════════════
    // 5. 批量新增 (Mass CREATE)
    // ════════════════════════════════════════════════════════
    describe("5. 批量新增測試", () => {

        /**
         * 【測試項目】：Struct 陣列批次寫入與陣列各個項目獨立全欄位校對
         * 【測試目的】：
         *  1. 測試 `createUsers` 能否在一個 Block 事務內批次建置複數筆 User 項目。
         *  2. 【每個欄位全面檢核】：為了嚴格防止迴圈寫入導致的陣列索引交錯或資料污染，對批次產出的 user1 與 user2 內的所有包含數值、字串、生肖等欄位全部手動拆開進行最嚴格的高精度斷言。
         */
        it("測試符合新合約 Struct 陣列的批量新增 2 筆資料", async () => {
            const userInputs = [
                {
                    account: "M01", passwordPlain: "p1", name: "批量1", birthday: 0,
                    department: "D1", team: "T1", status: Status.Active, effectiveDate: 0,
                    expiryDate: 0, hireDate: 0, memo: "m1", chineseZodiac: "Rat"
                },
                {
                    account: "M02", passwordPlain: "p2", name: "批量2", birthday: 0,
                    department: "D2", team: "T2", status: Status.Active, effectiveDate: 0,
                    expiryDate: 0, hireDate: 0, memo: "m2", chineseZodiac: "Ox"
                }
            ];

            // 完全對應 Solidity 的呼叫結構
            await demo.createUsers(userInputs, { from: admin });

            const count = await demo.getTotalCount();
            assert.equal(getNum(count), 2, "總計數器數值與批次新增項目量不符");

            // --- 第一筆批次人員 每個欄位全面檢核 ---
            const user1 = await demo.getById(1);
            assert.equal(user1.account, userInputs[0].account, "user1 account 不符");
            assert.equal(user1.name, userInputs[0].name, "user1 name 不符");
            assert.equal(getNum(user1.birthday), userInputs[0].birthday, "user1 birthday 不符");
            assert.equal(user1.department, userInputs[0].department, "user1 department 不符");
            assert.equal(user1.team, userInputs[0].team, "user1 team 不符");
            assert.equal(getNum(user1.status), userInputs[0].status, "user1 status 不符");
            assert.equal(getNum(user1.effectiveDate), userInputs[0].effectiveDate, "user1 effectiveDate 不符");
            assert.equal(getNum(user1.expiryDate), userInputs[0].expiryDate, "user1 expiryDate 不符");
            assert.equal(getNum(user1.hireDate), userInputs[0].hireDate, "user1 hireDate 不符");
            assert.equal(user1.memo, userInputs[0].memo, "user1 memo 不符");
            assert.equal(user1.chineseZodiac, userInputs[0].chineseZodiac, "user1 chineseZodiac 不符");
            assert.isTrue(await demo.verifyPassword(1, userInputs[0].passwordPlain), "user1 密碼雜湊與驗證比對失敗");

            // --- 第二筆批次人員 每個欄位全面檢核 ---
            const user2 = await demo.getById(2);
            assert.equal(user2.account, userInputs[1].account, "user2 account 不符");
            assert.equal(user2.name, userInputs[1].name, "user2 name 不符");
            assert.equal(getNum(user2.birthday), userInputs[1].birthday, "user2 birthday 不符");
            assert.equal(user2.department, userInputs[1].department, "user2 department 不符");
            assert.equal(user2.team, userInputs[1].team, "user2 team 不符");
            assert.equal(getNum(user2.status), userInputs[1].status, "user2 status 不符");
            assert.equal(getNum(user2.effectiveDate), userInputs[1].effectiveDate, "user2 effectiveDate 不符");
            assert.equal(getNum(user2.expiryDate), userInputs[1].expiryDate, "user2 expiryDate 不符");
            assert.equal(getNum(user2.hireDate), userInputs[1].hireDate, "user2 hireDate 不符");
            assert.equal(user2.memo, userInputs[1].memo, "user2 memo 不符");
            assert.equal(user2.chineseZodiac, userInputs[1].chineseZodiac, "user2 chineseZodiac 不符");
            assert.isTrue(await demo.verifyPassword(2, userInputs[1].passwordPlain), "user2 密碼雜湊與驗證比對失敗");
        });
    });
});