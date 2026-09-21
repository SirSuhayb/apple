// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "./utils/Ownable.sol";
import {ReentrancyGuard} from "./utils/ReentrancyGuard.sol";

/// @notice Minimal router surface for AAPL -> BITE swaps after graduation.
interface ISwapRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title AppleKitchen
/// @notice BITE race vault: tap-to-burn, 50/50 fee digest, core vs rot payout.
/// @dev Deploy after the pons token exists. Point pons creatorFeeRecipient here
///      after ads/verify (~$500-1k fees). buybackEnabled must stay false on pons.
contract AppleKitchen is Ownable, ReentrancyGuard {
    enum Phase {
        Racing,
        Core,
        Rot
    }

    enum EatKind {
        WalletBite,
        FeeDigest
    }

    IERC20 public immutable token;
    IERC20 public immutable quote; // AAPL
    address public immutable deployer;
    uint256 public immutable coreTarget;
    uint256 public immutable deadline;
    uint256 public immutable minHold;
    uint256 public immutable minConsumption;

    address public router;
    address public dead = 0x000000000000000000000000000000000000dEaD;

    Phase public phase;
    uint256 public burned;
    uint256 public prizePool;
    bytes32 public merkleRoot;
    mapping(uint256 => uint256) private claimedBitMap;

    event AppleEaten(address indexed eater, uint256 amount, uint8 kind);
    event Digested(uint256 burnedAmount, uint256 prizeAmount);
    event CoreRevealed(bytes32 merkleRoot, uint256 prizePool, uint256 burned);
    event RotRevealed(address farmer, uint256 prizePool);
    event Claimed(uint256 index, address account, uint256 amount);
    event RouterUpdated(address router);

    error RacingOnly();
    error TooLate();
    error TooEarly();
    error TargetNotMet();
    error AlreadyEnded();
    error NotCore();
    error AlreadyClaimed();
    error InvalidProof();
    error DeployerExcluded();
    error ZeroAmount();
    error TransferFailed();

    constructor(
        address token_,
        address quote_,
        address deployer_,
        uint256 coreTarget_,
        uint256 deadline_,
        uint256 minHold_,
        uint256 minConsumption_,
        address owner_
    ) Ownable(owner_ == address(0) ? deployer_ : owner_) {
        require(token_ != address(0) && quote_ != address(0), "zero token");
        require(deployer_ != address(0), "zero deployer");
        require(coreTarget_ > 0, "zero target");
        require(deadline_ > block.timestamp, "deadline");
        token = IERC20(token_);
        quote = IERC20(quote_);
        deployer = deployer_;
        coreTarget = coreTarget_;
        deadline = deadline_;
        minHold = minHold_;
        minConsumption = minConsumption_;
        phase = Phase.Racing;
    }

    function setRouter(address router_) external onlyOwner {
        router = router_;
        emit RouterUpdated(router_);
    }

    function setDead(address dead_) external onlyOwner {
        dead = dead_;
    }

    /// @notice Progress toward the core in basis points (10000 = 100%).
    function progressBps() external view returns (uint256) {
        if (coreTarget == 0) return 0;
        uint256 bps = (burned * 10_000) / coreTarget;
        return bps > 10_000 ? 10_000 : bps;
    }

    /// @notice Tap the apple: burn caller's BITE. Counts toward core + player score off-chain.
    function bite(uint256 amount) external nonReentrant {
        if (phase != Phase.Racing) revert RacingOnly();
        if (amount == 0) revert ZeroAmount();
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        _destroy(amount);
        burned += amount;
        emit AppleEaten(msg.sender, amount, uint8(EatKind.WalletBite));
    }

    /// @notice Permissionless: take AAPL sitting here (pons fees), 50% burn BITE, 50% prize.
    /// @dev Caller should claim/sweep pons fees into this contract first if needed.
    function digest() external nonReentrant {
        if (phase != Phase.Racing) revert RacingOnly();
        uint256 free = quote.balanceOf(address(this));
        if (free <= prizePool) return;
        uint256 balance = free - prizePool;
        if (balance < 2) return;

        uint256 toBurnSide = balance / 2;
        uint256 toPrize = balance - toBurnSide;
        uint256 burnedAmount;

        if (toBurnSide > 0 && router != address(0)) {
            quote.approve(router, toBurnSide);
            address[] memory path = new address[](2);
            path[0] = address(quote);
            path[1] = address(token);
            try ISwapRouter(router)
                .swapExactTokensForTokens(toBurnSide, 0, path, address(this), block.timestamp + 600) returns (
                uint256[] memory amounts
            ) {
                burnedAmount = amounts[amounts.length - 1];
                if (burnedAmount > 0) {
                    _destroy(burnedAmount);
                    burned += burnedAmount;
                    emit AppleEaten(address(0), burnedAmount, uint8(EatKind.FeeDigest));
                }
                prizePool += toPrize;
            } catch {
                // Leave all free AAPL for a later digest if the swap is too impactful.
                toPrize = 0;
            }
        } else {
            // No router yet — park everything as prize until swaps are possible,
            // or hold burn-side as free balance for the next digest.
            prizePool += toPrize;
        }

        emit Digested(burnedAmount, toPrize);
    }

    /// @notice Anyone: freeze a core win if burn target hit before deadline.
    function revealCore(bytes32 merkleRoot_) external nonReentrant {
        if (phase != Phase.Racing) revert AlreadyEnded();
        if (block.timestamp > deadline) revert TooLate();
        if (burned < coreTarget) revert TargetNotMet();
        phase = Phase.Core;
        merkleRoot = merkleRoot_;
        emit CoreRevealed(merkleRoot_, prizePool, burned);
    }

    /// @notice Anyone after deadline without a core: farmer takes the pot.
    function revealRot() external nonReentrant {
        if (phase != Phase.Racing) revert AlreadyEnded();
        if (block.timestamp <= deadline) revert TooEarly();
        if (burned >= coreTarget) revert TargetNotMet(); // should have revealed core
        phase = Phase.Rot;
        uint256 pot = prizePool;
        prizePool = 0;
        if (pot > 0) {
            if (!quote.transfer(deployer, pot)) revert TransferFailed();
        }
        // Forward any leftover quote too
        uint256 leftover = quote.balanceOf(address(this));
        if (leftover > 0) {
            if (!quote.transfer(deployer, leftover)) revert TransferFailed();
        }
        emit RotRevealed(deployer, pot);
    }

    /// @notice Qualified eaters claim AAPL after core. Deployer cannot claim.
    function claim(uint256 index, address account, uint256 consumption, bytes32[] calldata proof)
        external
        nonReentrant
    {
        if (phase != Phase.Core) revert NotCore();
        if (account == deployer) revert DeployerExcluded();
        if (isClaimed(index)) revert AlreadyClaimed();
        if (consumption < minConsumption) revert InvalidProof();

        bytes32 node = keccak256(abi.encodePacked(index, account, consumption));
        if (!_verify(proof, merkleRoot, node)) revert InvalidProof();

        _setClaimed(index);

        // Pro-rata by consumption weight encoded in the tree leaf amounts:
        // leaf consumption is the weight; payout = prizePool_at_reveal * weight / totalWeight
        // For simplicity the tree encodes the absolute AAPL claim amount in `consumption`
        // when built by the keeper (rename semantically to claimAmount off-chain).
        uint256 amount = consumption;
        if (amount > prizePool) amount = prizePool;
        prizePool -= amount;
        if (!quote.transfer(account, amount)) revert TransferFailed();
        emit Claimed(index, account, amount);
    }

    function isClaimed(uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        return (claimedBitMap[wordIndex] & (1 << bitIndex)) != 0;
    }

    function _setClaimed(uint256 index) private {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitMap[wordIndex] |= (1 << bitIndex);
    }

    function _verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            if (computed <= p) {
                computed = keccak256(abi.encodePacked(computed, p));
            } else {
                computed = keccak256(abi.encodePacked(p, computed));
            }
        }
        return computed == root;
    }

    function _destroy(uint256 amount) private {
        // Prefer burn if the token implements it; otherwise send to dead.
        (bool ok,) = address(token).call(abi.encodeWithSignature("burn(uint256)", amount));
        if (!ok) {
            if (!token.transfer(dead, amount)) revert TransferFailed();
        }
    }

    /// @notice Rescue non-prize quote dust only while racing (owner).
    function rescueQuote(uint256 amount, address to) external onlyOwner {
        require(phase == Phase.Racing, "ended");
        uint256 available = quote.balanceOf(address(this));
        require(available > prizePool, "none");
        uint256 free = available - prizePool;
        require(amount <= free, "prize");
        if (!quote.transfer(to, amount)) revert TransferFailed();
    }
}
