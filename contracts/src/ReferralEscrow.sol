// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @title ReferralEscrow (UUPS upgradeable)
/// @notice Escrowed $BITE paid to referrers when a referee completes an in-app buy+burn.
/// @dev Pure chain data cannot prove "bought via the app". An attester (site backend,
///      kitchen owner, or keeper) must call `qualify` after verifying the in-app path
///      (Uniswap Trading API + kitchen.bite). Frontend `?ref=` / localStorage is only
///      attribution UX — on-chain bind + qualify is the payout layer.
///
///      Deploy behind ERC1967Proxy. Fund the **proxy** address. Upgrade via
///      `upgradeToAndCall` as owner (same key that owns the proxy).
contract ReferralEscrow is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ── Storage ──

    /// @notice BITE token (set once in initialize).
    IERC20 public token;

    /// @notice Address allowed to mark a referee as having completed in-app buy+burn.
    address public attester;

    /// @notice Fixed $BITE payout to the referrer per successful referral.
    uint256 public rewardPerReferral;

    bool public paused;

    /// @notice referee => referrer (set once via `bind`).
    mapping(address => address) public referrerOf;

    /// @notice referee already paid out (one payout per referee).
    mapping(address => bool) public paid;

    /// @notice Cumulative BITE deposited into escrow (gross).
    uint256 public totalDeposited;

    /// @notice Cumulative BITE paid to referrers.
    uint256 public totalPaid;

    /// @notice Number of successful referral payouts.
    uint256 public payoutCount;

    // ── Events ──

    event Deposited(address indexed from, uint256 amount);
    event Bound(address indexed referee, address indexed referrer);
    event Qualified(
        address indexed referee, address indexed referrer, uint256 reward, address indexed attester
    );
    event RewardUpdated(uint256 oldReward, uint256 newReward);
    event AttesterUpdated(address indexed oldAttester, address indexed newAttester);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event Withdrawn(address indexed to, uint256 amount);

    // ── Errors ──

    error ZeroAddress();
    error ZeroAmount();
    error PausedError();
    error AlreadyBound();
    error SelfReferral();
    error NotBound();
    error AlreadyPaid();
    error InsufficientEscrow();
    error NotAttester();
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param token_ BITE token
    /// @param attester_ initial attester (site backend / keeper); may equal owner
    /// @param rewardPerReferral_ fixed BITE payout per successful referral (wei)
    /// @param owner_ contract owner / upgrader
    function initialize(address token_, address attester_, uint256 rewardPerReferral_, address owner_)
        external
        initializer
    {
        if (token_ == address(0)) revert ZeroAddress();
        if (attester_ == address(0)) revert ZeroAddress();
        if (owner_ == address(0)) revert ZeroAddress();
        if (rewardPerReferral_ == 0) revert ZeroAmount();

        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        token = IERC20(token_);
        attester = attester_;
        rewardPerReferral = rewardPerReferral_;
    }

    // ── Modifiers ──

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier onlyAttester() {
        if (msg.sender != attester) revert NotAttester();
        _;
    }

    // ── Funding ──

    /// @notice Deposit BITE into escrow. Caller must `approve` this contract (proxy) first.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    // ── Bind ──

    /// @notice Referee binds their referrer once. No self-ref. Must happen before `qualify`.
    /// @dev Site flow: after wallet connects with pending `?ref=`, call `bind(referrer)`.
    function bind(address referrer) external whenNotPaused {
        if (referrer == address(0)) revert ZeroAddress();
        if (referrer == msg.sender) revert SelfReferral();
        if (referrerOf[msg.sender] != address(0)) revert AlreadyBound();
        if (paid[msg.sender]) revert AlreadyPaid();

        referrerOf[msg.sender] = referrer;
        emit Bound(msg.sender, referrer);
    }

    // ── Qualify / payout ──

    /// @notice Attester confirms referee completed in-app buy+burn; pays referrer immediately.
    /// @dev Off-chain: verify Trading API swap + kitchen.bite for `referee`, then call this.
    function qualify(address referee) external nonReentrant whenNotPaused onlyAttester {
        _qualify(referee);
    }

    /// @notice Batch qualify for keepers / bots.
    function qualifyBatch(address[] calldata referees) external nonReentrant whenNotPaused onlyAttester {
        uint256 n = referees.length;
        for (uint256 i = 0; i < n; i++) {
            _qualify(referees[i]);
        }
    }

    function _qualify(address referee) internal {
        if (referee == address(0)) revert ZeroAddress();
        if (paid[referee]) revert AlreadyPaid();

        address referrer = referrerOf[referee];
        if (referrer == address(0)) revert NotBound();
        if (referrer == referee) revert SelfReferral();

        uint256 reward = rewardPerReferral;
        if (token.balanceOf(address(this)) < reward) revert InsufficientEscrow();

        paid[referee] = true;
        totalPaid += reward;
        payoutCount += 1;

        if (!token.transfer(referrer, reward)) revert TransferFailed();

        emit Qualified(referee, referrer, reward, msg.sender);
    }

    // ── Views ──

    function escrowBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// @notice How many full rewards the current balance can still pay.
    function remainingPayouts() external view returns (uint256) {
        uint256 reward = rewardPerReferral;
        if (reward == 0) return 0;
        return token.balanceOf(address(this)) / reward;
    }

    // ── Owner admin ──

    function setAttester(address newAttester) external onlyOwner {
        if (newAttester == address(0)) revert ZeroAddress();
        address old = attester;
        attester = newAttester;
        emit AttesterUpdated(old, newAttester);
    }

    function setRewardPerReferral(uint256 newReward) external onlyOwner {
        if (newReward == 0) revert ZeroAmount();
        uint256 old = rewardPerReferral;
        rewardPerReferral = newReward;
        emit RewardUpdated(old, newReward);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Owner withdraws leftover / unused escrow BITE from the proxy.
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (token.balanceOf(address(this)) < amount) revert InsufficientEscrow();
        if (!token.transfer(to, amount)) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    // ── UUPS ──

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
