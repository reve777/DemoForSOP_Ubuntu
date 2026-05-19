// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// 注意：為了儲存插槽相容，不可在此處繼承 ReentrancyGuardUpgradeable
contract GMR is Initializable {
    address public manager;
    address payable[] public players;
    mapping(address => bool) public authorizedAdmins;

    // 🔴 必須保留此變數！否則升級會失敗。
    // 為了相容舊合約的 bool 類型，我們維持 bool locked 不動。
    bool private locked; 

    // 自訂的重入鎖修飾符（維持原樣以確保邏輯相容）
    modifier nonReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        manager = msg.sender;
        authorizedAdmins[msg.sender] = true;
    }

    modifier restricted() {
        require(
            authorizedAdmins[msg.sender] || msg.sender == manager,
            "Access denied: Not an admin"
        );
        _;
    }

    function addAdmin(address _newAdmin) public {
        require(msg.sender == manager, "Only the manager can add new admins");
        authorizedAdmins[_newAdmin] = true;
    }

    function removeAdmin(address _admin) public {
        require(msg.sender == manager, "Only the manager can remove admins");
        authorizedAdmins[_admin] = false;
    }

    function enterGame() public payable {
        require(msg.value > 0.01 ether, "Minimum 0.01 ether required");
        players.push(payable(msg.sender));
    }

    function chooseByTime() private view returns (uint) {
        require(players.length > 0, "No players in the game");
        return uint(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, players.length))) % players.length;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // 這裡使用了優化後的 CEI 模式（delete players），並加上相容的 nonReentrant 鎖
    function payMoneyToPlayer() public restricted nonReentrant {
        uint winnerId = chooseByTime();
        address payable winner = players[winnerId];
        uint256 amount = address(this).balance;

        // 1. 先重置狀態 (Effects) - 使用 delete 釋放儲存空間並退 Gas
        delete players;

        // 2. 再進行外部轉帳 (Interactions)
        (bool success, ) = winner.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function getCurrentPlayers() public view returns (address payable[] memory) {
        return players;
    }
}