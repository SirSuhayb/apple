// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";
import {Ownable} from "./utils/Ownable.sol";

/// @notice Minimal read interface for the AppleKitchen phase.
interface IAppleKitchen {
    /// @dev 0 = Racing, 1 = Core, 2 = Rot
    function phase() external view returns (uint8);
}

/// @title MetaWager
/// @notice Side bet on the BITE burn race outcome.
///         Players stake $BITE on CORE (eaters reach 50% burn target) or ROT (deadline passes).
///         A 10% entry fee is taken upfront — 90% enters the pool, 10% goes to the fee recipient.
///         After the kitchen resolves, winners split the ENTIRE losing pool pro-rata. No exit fee.
contract MetaWager is ReentrancyGuard, Ownable {
    // ── Types ──

    enum Side {
        None,
        Core,
        Rot
    }

    // ── Immutables ──

    IERC20 public immutable token;
    IAppleKitchen public immutable kitchen;

    // ── State ──

    /// @notice Fee recipient — defaults to farmer/dev, settable by owner.
    address public feeRecipient;

    uint256 public totalCore;
    uint256 public totalRot;
    bool public resolved;
    Side public winningSide;

    /// @notice Entry fee in basis points (default 1000 = 10%). Taken on every bet.
    uint256 public feeBps;
    uint256 public constant MAX_FEE_BPS = 2000; // 20% hard cap

    /// @notice Cumulative fees collected (for transparency).
    uint256 public totalFeesCollected;

    struct Bet {
        uint256 core;
        uint256 rot;
        bool claimed;
    }
    mapping(address => Bet) public bets;

    // ── Events ──

    event BetPlaced(address indexed bettor, Side side, uint256 netAmount, uint256 fee);
    event Resolved(Side winner, uint256 winPool, uint256 losePool);
    event Claimed(address indexed bettor, uint256 payout);
    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    // ── Errors ──

    error ZeroAmount();
    error AlreadyResolved();
    error NotResolved();
    error RaceStillRunning();
    error NothingToClaim();
    error TransferFailed();
    error FeeTooHigh();
    error ZeroAddress();

    // ── Constructor ──

    constructor(address token_, address kitchen_, address feeRecipient_, uint256 feeBps_, address owner_)
        Ownable(owner_ == address(0) ? feeRecipient_ : owner_)
    {
        require(token_ != address(0), "zero token");
        require(kitchen_ != address(0), "zero kitchen");
        require(feeRecipient_ != address(0), "zero recipient");
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        token = IERC20(token_);
        kitchen = IAppleKitchen(kitchen_);
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // ── Betting ──

    /// @notice Stake BITE on CORE. 10% entry fee sent to feeRecipient; 90% enters the core pool.
    function betCore(uint256 amount) external nonReentrant {
        if (resolved) revert AlreadyResolved();
        if (amount == 0) revert ZeroAmount();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;

        if (fee > 0) {
            if (!token.transfer(feeRecipient, fee)) revert TransferFailed();
            totalFeesCollected += fee;
        }

        bets[msg.sender].core += net;
        totalCore += net;
        emit BetPlaced(msg.sender, Side.Core, net, fee);
    }

    /// @notice Stake BITE on ROT. 10% entry fee sent to feeRecipient; 90% enters the rot pool.
    function betRot(uint256 amount) external nonReentrant {
        if (resolved) revert AlreadyResolved();
        if (amount == 0) revert ZeroAmount();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 net = amount - fee;

        if (fee > 0) {
            if (!token.transfer(feeRecipient, fee)) revert TransferFailed();
            totalFeesCollected += fee;
        }

        bets[msg.sender].rot += net;
        totalRot += net;
        emit BetPlaced(msg.sender, Side.Rot, net, fee);
    }

    // ── Resolution ──

    /// @notice Anyone can call after kitchen leaves Racing phase.
    ///         Reads kitchen.phase() to determine the winner side.
    ///         No exit fee — winners split the entire losing pool.
    function resolve() external nonReentrant {
        if (resolved) revert AlreadyResolved();
        uint8 kitchenPhase = kitchen.phase();
        // 0 = Racing → revert; 1 = Core; 2 = Rot
        if (kitchenPhase == 0) revert RaceStillRunning();

        resolved = true;
        winningSide = kitchenPhase == 1 ? Side.Core : Side.Rot;

        uint256 winPool = winningSide == Side.Core ? totalCore : totalRot;
        uint256 losePool = winningSide == Side.Core ? totalRot : totalCore;
        emit Resolved(winningSide, winPool, losePool);
    }

    // ── Claiming ──

    /// @notice Winners claim their original stake + proportional share of the entire losing pool.
    function claim() external nonReentrant {
        if (!resolved) revert NotResolved();
        Bet storage b = bets[msg.sender];
        if (b.claimed) revert NothingToClaim();

        uint256 userStake;
        uint256 winPool;
        uint256 losePool;

        if (winningSide == Side.Core) {
            userStake = b.core;
            winPool = totalCore;
            losePool = totalRot;
        } else {
            userStake = b.rot;
            winPool = totalRot;
            losePool = totalCore;
        }

        if (userStake == 0) revert NothingToClaim();

        b.claimed = true;

        // Payout = original stake + proportional share of entire losing pool
        uint256 winnings = (losePool * userStake) / winPool;
        uint256 payout = userStake + winnings;

        if (!token.transfer(msg.sender, payout)) revert TransferFailed();
        emit Claimed(msg.sender, payout);
    }

    // ── Views ──

    /// @notice Pending payout for a bettor (before resolution: estimate; after: exact).
    function pendingPayout(address bettor) external view returns (uint256) {
        Bet storage b = bets[bettor];
        if (b.claimed) return 0;

        if (!resolved) {
            return _estimate(b.core, totalCore, totalRot) + _estimate(b.rot, totalRot, totalCore);
        }

        uint256 userStake;
        uint256 winPool;
        uint256 losePool;

        if (winningSide == Side.Core) {
            userStake = b.core;
            winPool = totalCore;
            losePool = totalRot;
        } else {
            userStake = b.rot;
            winPool = totalRot;
            losePool = totalCore;
        }
        if (userStake == 0) return 0;

        return userStake + (losePool * userStake) / winPool;
    }

    function _estimate(uint256 stake, uint256 pool, uint256 otherPool) private pure returns (uint256) {
        if (stake == 0 || pool == 0) return 0;
        return stake + (otherPool * stake) / pool;
    }

    /// @notice Core odds as basis points (10000 = 100%). Returns implied probability.
    function coreOddsBps() external view returns (uint256) {
        uint256 total = totalCore + totalRot;
        if (total == 0) return 5000; // 50/50 when no bets
        return (totalCore * 10_000) / total;
    }

    // ── Admin ──

    /// @notice Update entry fee (owner only, max 20%).
    function setFeeBps(uint256 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 old = feeBps;
        feeBps = newBps;
        emit FeeUpdated(old, newBps);
    }

    /// @notice Update fee recipient (owner only). Route to LP, prize pool, or keep.
    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        address old = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(old, newRecipient);
    }
}
