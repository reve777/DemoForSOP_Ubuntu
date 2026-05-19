// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract DEMO is Initializable, OwnableUpgradeable {

    //  Enums & Struct
    enum Status {
        Active,
        Inactive,
        Deleted
    }

    // ★ Log 操作類型
    enum ActionType {
        Created,   // 0
        Updated,   // 1
        Deleted,   // 2
        Queried    // 3
    }

    struct User {
        string account;
        bytes32 passwordHash;
        string name;
        uint256 birthday;
        string department;
        string team;
        Status status;
        uint256 effectiveDate;
        uint256 expiryDate;
        uint256 hireDate;
        uint256 createdAt;
        uint256 updatedAt;
        string memo;
        string chineseZodiac;
    }

    //  Input Structs
    struct CreateUserInput {
        string account;
        string passwordPlain;
        string name;
        uint256 birthday;
        string department;
        string team;
        Status status;
        uint256 effectiveDate;
        uint256 expiryDate;
        uint256 hireDate;
        string memo;
        string chineseZodiac;
    }

    struct UpdateUserInput {
        string name;
        uint256 birthday;
        string department;
        string team;
        Status status;
        uint256 effectiveDate;
        uint256 expiryDate;
        uint256 hireDate;
        string memo;
        string chineseZodiac;
    }

    //  Storage
    uint256 private _nextId;
    mapping(string => uint256) private accountToId;
    mapping(uint256 => User) private users;

    //  Events (原有)
    event UserCreated(uint256 indexed id, string account, string name);
    event UserUpdated(
        uint256 indexed id,
        string account,
        string name,
        Status status,
        uint256 updatedAt
    );
    event UserDeleted(uint256 indexed id, string account, uint256 updatedAt);

    // ★ Log Events
    // 新增、刪除、查詢 log
    event ActionLog(
        ActionType indexed action,
        uint256 indexed userId,
        address indexed operator,
        string account,
        uint256 timestamp
    );

    // 修改 log：記錄哪些欄位被改了
    event UpdateLog(
        uint256 indexed userId,
        address indexed operator,
        string changedFields,   // 逗號分隔的欄位名稱，例如 "name,department,status"
        uint256 timestamp
    );

    // initialize() 取代 constructor()
    function initialize() public initializer {
        __Ownable_init();
        _nextId = 1;
    }

    //  Modifiers
    modifier userExists(uint256 id) {
        require(users[id].createdAt != 0, "User not found");
        _;
    }
    modifier notDeleted(uint256 id) {
        require(users[id].status != Status.Deleted, "User already deleted");
        _;
    }

    // ★ 內部工具：比較兩個 string
    function _strDiff(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) != keccak256(bytes(b));
    }

    // ★ 內部工具：組合修改欄位字串
    function _buildChangedFields(
        User storage old,
        UpdateUserInput memory input
    ) internal view returns (string memory) {
        bytes memory fields;
        bool first = true;

        if (_strDiff(old.name, input.name)) {
            fields = abi.encodePacked(fields, first ? "" : ",", "name");
            first = false;
        }
        if (old.birthday != input.birthday) {
            fields = abi.encodePacked(fields, first ? "" : ",", "birthday");
            first = false;
        }
        if (_strDiff(old.department, input.department)) {
            fields = abi.encodePacked(fields, first ? "" : ",", "department");
            first = false;
        }
        if (_strDiff(old.team, input.team)) {
            fields = abi.encodePacked(fields, first ? "" : ",", "team");
            first = false;
        }
        if (old.status != input.status) {
            fields = abi.encodePacked(fields, first ? "" : ",", "status");
            first = false;
        }
        if (old.effectiveDate != input.effectiveDate) {
            fields = abi.encodePacked(fields, first ? "" : ",", "effectiveDate");
            first = false;
        }
        if (old.expiryDate != input.expiryDate) {
            fields = abi.encodePacked(fields, first ? "" : ",", "expiryDate");
            first = false;
        }
        if (old.hireDate != input.hireDate) {
            fields = abi.encodePacked(fields, first ? "" : ",", "hireDate");
            first = false;
        }
        if (_strDiff(old.memo, input.memo)) {
            fields = abi.encodePacked(fields, first ? "" : ",", "memo");
            first = false;
        }
        if (_strDiff(old.chineseZodiac, input.chineseZodiac)) {
            fields = abi.encodePacked(fields, first ? "" : ",", "chineseZodiac");
            first = false;
        }

        return string(fields);
    }

    //  CREATE
    function createUser(
        CreateUserInput memory input
    ) public onlyOwner returns (uint256) {
        require(bytes(input.account).length > 0, "Account required");
        require(bytes(input.passwordPlain).length > 0, "Password required");
        require(bytes(input.name).length > 0, "Name required");
        require(input.status != Status.Deleted, "Cannot create with Deleted status");

        uint256 existingId = accountToId[input.account];
        if (existingId != 0) {
            require(
                users[existingId].status == Status.Deleted,
                "Account already in use"
            );
        }

        uint256 id = _nextId++;
        users[id] = User({
            account: input.account,
            passwordHash: keccak256(abi.encodePacked(input.passwordPlain)),
            name: input.name,
            birthday: input.birthday,
            department: input.department,
            team: input.team,
            status: input.status,
            effectiveDate: input.effectiveDate,
            expiryDate: input.expiryDate,
            hireDate: input.hireDate,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            memo: input.memo,
            chineseZodiac: input.chineseZodiac
        });

        accountToId[input.account] = id;
        emit UserCreated(id, input.account, input.name);

        // ★ Log
        emit ActionLog(ActionType.Created, id, msg.sender, input.account, block.timestamp);

        return id;
    }

    function createUsers(
        CreateUserInput[] memory inputs
    ) public onlyOwner returns (uint256[] memory ids) {
        ids = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            ids[i] = createUser(inputs[i]);
        }
    }

    //  UPDATE
    function updateUser(
        uint256 id,
        UpdateUserInput memory input
    ) public onlyOwner userExists(id) notDeleted(id) {
        require(bytes(input.name).length > 0, "Name required");
        require(input.status != Status.Deleted, "Use deleteById() to delete");

        // ★ 在修改前先計算哪些欄位有變
        string memory changedFields = _buildChangedFields(users[id], input);

        User storage u = users[id];
        u.name = input.name;
        u.birthday = input.birthday;
        u.chineseZodiac = input.chineseZodiac;
        u.department = input.department;
        u.team = input.team;
        u.status = input.status;
        u.effectiveDate = input.effectiveDate;
        u.expiryDate = input.expiryDate;
        u.hireDate = input.hireDate;
        u.memo = input.memo;
        u.updatedAt = block.timestamp;

        emit UserUpdated(id, u.account, input.name, input.status, block.timestamp);

        // ★ Log
        emit ActionLog(ActionType.Updated, id, msg.sender, u.account, block.timestamp);
        emit UpdateLog(id, msg.sender, changedFields, block.timestamp);
    }

    function updatePassword(
        uint256 id,
        string memory newPasswordPlain
    ) public onlyOwner userExists(id) notDeleted(id) {
        require(bytes(newPasswordPlain).length > 0, "Password required");
        users[id].passwordHash = keccak256(abi.encodePacked(newPasswordPlain));
        users[id].updatedAt = block.timestamp;

        // ★ Log
        emit ActionLog(ActionType.Updated, id, msg.sender, users[id].account, block.timestamp);
        emit UpdateLog(id, msg.sender, "passwordHash", block.timestamp);
    }

    //  DELETE
    function deleteById(
        uint256 id
    ) public onlyOwner userExists(id) notDeleted(id) {
        string memory acc = users[id].account;
        users[id].status = Status.Deleted;
        users[id].updatedAt = block.timestamp;
        emit UserDeleted(id, acc, block.timestamp);

        // ★ Log
        emit ActionLog(ActionType.Deleted, id, msg.sender, acc, block.timestamp);
    }

    function deleteByAccount(string memory account) public onlyOwner {
        uint256 id = accountToId[account];
        require(id != 0, "Account not found");
        deleteById(id);
    }

    //  READ
    function getById(
        uint256 id
    ) public view userExists(id) returns (User memory) {
        return users[id];
    }

    function getByAccount(
        string memory account
    ) public view returns (uint256 id, User memory user) {
        id = accountToId[account];
        require(id != 0, "Account not found");
        user = users[id];
    }

    function getByChineseZodiac(
        string memory chineseZodiac
    ) public view returns (User[] memory) {
        bytes32 h = keccak256(bytes(chineseZodiac));
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].chineseZodiac)) == h
            ) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].chineseZodiac)) == h
            ) result[idx++] = users[i];
        }
        return result;
    }

    function getByDepartment(
        string memory department
    ) public view returns (User[] memory) {
        bytes32 h = keccak256(bytes(department));
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].department)) == h
            ) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].department)) == h
            ) result[idx++] = users[i];
        }
        return result;
    }

    function getByTeam(
        string memory team
    ) public view returns (User[] memory) {
        bytes32 h = keccak256(bytes(team));
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].team)) == h
            ) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                keccak256(bytes(users[i].team)) == h
            ) result[idx++] = users[i];
        }
        return result;
    }

    function getByStatus(
        Status status
    ) public view returns (User[] memory) {
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (users[i].createdAt != 0 && users[i].status == status) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (users[i].createdAt != 0 && users[i].status == status)
                result[idx++] = users[i];
        }
        return result;
    }

    function getByHireDate(
        uint256 from,
        uint256 to
    ) public view returns (User[] memory) {
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                users[i].hireDate >= from &&
                users[i].hireDate <= to
            ) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (
                users[i].createdAt != 0 &&
                users[i].hireDate >= from &&
                users[i].hireDate <= to
            ) result[idx++] = users[i];
        }
        return result;
    }

    function findAll() public view returns (User[] memory) {
        uint256 total = _nextId - 1;
        User[] memory result = new User[](total);
        for (uint256 i = 1; i <= total; i++) {
            result[i - 1] = users[i];
        }
        return result;
    }

    function findAllActive() public view returns (User[] memory) {
        uint256 total = _nextId - 1;
        uint256 count = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (users[i].status != Status.Deleted) count++;
        }
        User[] memory result = new User[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (users[i].status != Status.Deleted) result[idx++] = users[i];
        }
        return result;
    }

    function getTotalCount() public view returns (uint256) {
        return _nextId - 1;
    }

    function verifyPassword(
        uint256 id,
        string memory passwordPlain
    ) public view userExists(id) returns (bool) {
        return
            users[id].passwordHash ==
            keccak256(abi.encodePacked(passwordPlain));
    }
}
