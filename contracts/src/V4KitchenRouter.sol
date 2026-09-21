// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPoolManager, IUnlockCallback} from "./interfaces/IPoolManager.sol";

/// @title V4KitchenRouter
/// @notice V2-shaped adapter so AppleKitchen.digest() can buy BITE on the live
///         Uniswap v4 AAPL/BITE pool. Kitchen approves this contract, then calls
///         `swapExactTokensForTokens(amountIn, 0, [AAPL, BITE], kitchen, deadline)`.
/// @dev Do not point kitchen.router at Universal Router; kitchen's interface is V2.
contract V4KitchenRouter is IUnlockCallback {
    /// TickMath MIN_SQRT_PRICE + 1 / MAX_SQRT_PRICE - 1 (unbounded swap limits).
    uint160 internal constant MIN_SQRT_PRICE_LIMIT = 4295128740;
    uint160 internal constant MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341;

    IPoolManager public immutable poolManager;
    IERC20 public immutable aapl;
    IERC20 public immutable bite;
    address public immutable currency0;
    address public immutable currency1;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    address public immutable hooks;
    bool public immutable zeroForOne;

    error Expired();
    error InvalidPath();
    error ZeroAmount();
    error TransferFailed();
    error TooLittleOut();
    error NotPoolManager();
    error InvalidDelta();

    constructor(address poolManager_, address aapl_, address bite_, uint24 fee_, int24 tickSpacing_, address hooks_) {
        require(poolManager_ != address(0) && aapl_ != address(0) && bite_ != address(0), "zero");
        require(aapl_ != bite_, "pair");
        poolManager = IPoolManager(poolManager_);
        aapl = IERC20(aapl_);
        bite = IERC20(bite_);
        fee = fee_;
        tickSpacing = tickSpacing_;
        hooks = hooks_;
        if (bite_ < aapl_) {
            currency0 = bite_;
            currency1 = aapl_;
            zeroForOne = false; // sell token1 (AAPL) for token0 (BITE)
        } else {
            currency0 = aapl_;
            currency1 = bite_;
            zeroForOne = true; // sell token0 (AAPL) for token1 (BITE)
        }
    }

    function poolKey() public view returns (IPoolManager.PoolKey memory) {
        return IPoolManager.PoolKey({
            currency0: currency0, currency1: currency1, fee: fee, tickSpacing: tickSpacing, hooks: hooks
        });
    }

    /// @notice keccak256(abi.encode(PoolKey)); must match the live Dexscreener v4 pool id.
    function poolId() public view returns (bytes32) {
        return keccak256(abi.encode(poolKey()));
    }

    /// @notice UniswapV2Router02-compatible entry. Pulls AAPL from caller, swaps on v4,
    ///         sends BITE to `to`. `amounts[0] = amountIn`, `amounts[last] = BITE out`.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert TransferFailed();
        if (path.length != 2 || path[0] != address(aapl) || path[1] != address(bite)) {
            revert InvalidPath();
        }
        if (amountIn > uint256(uint128(type(int128).max))) revert ZeroAmount();

        if (!aapl.transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();

        bytes memory result = poolManager.unlock(abi.encode(msg.sender, to, amountIn, amountOutMin));
        uint256 amountOut = abi.decode(result, (uint256));

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
    }

    /// @dev Called by PoolManager during unlock. Settles AAPL in, takes BITE out to `to`.
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (address payer, address to, uint256 amountIn, uint256 amountOutMin) =
            abi.decode(data, (address, address, uint256, uint256));

        int256 delta = poolManager.swap(
            poolKey(),
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(amountIn),
                sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT
            }),
            ""
        );

        (uint256 payAapl, uint256 takeBite) = _credit(delta);
        if (takeBite < amountOutMin) revert TooLittleOut();

        _settle(address(aapl), payAapl);
        if (takeBite > 0) {
            poolManager.take(address(bite), to, takeBite);
        }

        // Exact-input should consume `amountIn`; refund dust so nothing sticks here.
        _sweep(aapl, payer);
        _sweep(bite, to);

        return abi.encode(takeBite);
    }

    function _credit(int256 delta) internal view returns (uint256 payAapl, uint256 takeBite) {
        int128 amount0 = int128(delta >> 128);
        int128 amount1 = int128(delta);
        if (zeroForOne) {
            if (amount0 >= 0 || amount1 <= 0) revert InvalidDelta();
            payAapl = uint256(int256(-amount0));
            takeBite = uint256(int256(amount1));
        } else {
            if (amount1 >= 0 || amount0 <= 0) revert InvalidDelta();
            payAapl = uint256(int256(-amount1));
            takeBite = uint256(int256(amount0));
        }
    }

    function _settle(address currency, uint256 amount) internal {
        if (amount == 0) return;
        poolManager.sync(currency);
        if (!IERC20(currency).transfer(address(poolManager), amount)) revert TransferFailed();
        poolManager.settle();
    }

    function _sweep(IERC20 token, address to) internal {
        uint256 leftover = token.balanceOf(address(this));
        if (leftover == 0) return;
        if (!token.transfer(to, leftover)) revert TransferFailed();
    }
}
