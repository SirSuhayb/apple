// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AppleKitchen} from "../src/AppleKitchen.sol";
import {V4KitchenRouter} from "../src/V4KitchenRouter.sol";
import {IPoolManager, IUnlockCallback} from "../src/interfaces/IPoolManager.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @dev Minimal PoolManager: unlock → callback, swap returns a packed BalanceDelta,
///      take pays BITE from this contract's balance.
contract MockPoolManager {
    int128 public forcedAmount0;
    int128 public forcedAmount1;
    bool public useForced;
    uint256 public outPerIn = 10 ether; // 1 AAPL → 10 BITE (1e18 scale)

    function setForcedDelta(int128 amount0, int128 amount1) external {
        forcedAmount0 = amount0;
        forcedAmount1 = amount1;
        useForced = true;
    }

    function setOutPerIn(uint256 v) external {
        outPerIn = v;
    }

    function unlock(bytes calldata data) external returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function swap(IPoolManager.PoolKey calldata, IPoolManager.SwapParams calldata params, bytes calldata)
        external
        view
        returns (int256)
    {
        if (useForced) return _pack(forcedAmount0, forcedAmount1);
        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 amountOut = (amountIn * outPerIn) / 1 ether;
        if (params.zeroForOne) {
            return _pack(-int128(int256(amountIn)), int128(int256(amountOut)));
        }
        return _pack(int128(int256(amountOut)), -int128(int256(amountIn)));
    }

    function sync(address) external {}

    function settle() external payable {}

    function take(address currency, address to, uint256 amount) external {
        if (amount == 0) return;
        require(IERC20(currency).transfer(to, amount), "take");
    }

    function _pack(int128 amount0, int128 amount1) internal pure returns (int256) {
        return (int256(amount0) << 128) | int256(uint256(uint128(amount1)));
    }
}

contract V4KitchenRouterTest is Test {
    MockERC20 bite;
    MockERC20 aapl;
    MockPoolManager pm;
    V4KitchenRouter router;
    AppleKitchen kitchen;
    address farmer;
    address eater;

    uint256 coreTarget = 500 ether;
    uint256 deadline;

    function setUp() public {
        farmer = makeAddr("farmer");
        eater = makeAddr("eater");
        bite = new MockERC20("BITE", "BITE", true);
        aapl = new MockERC20("AAPL", "AAPL", false);
        pm = new MockPoolManager();
        router = new V4KitchenRouter(address(pm), address(aapl), address(bite), 0, 200, address(0));
        deadline = block.timestamp + 30 days;
        kitchen = new AppleKitchen(address(bite), address(aapl), farmer, coreTarget, deadline, 1 ether, 1, farmer);
        vm.prank(farmer);
        kitchen.setRouter(address(router));
    }

    function _path() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = address(aapl);
        path[1] = address(bite);
    }

    function testPoolIdMatchesEncode() public view {
        bytes32 expected = keccak256(
            abi.encode(
                address(bite) < address(aapl) ? address(bite) : address(aapl),
                address(bite) < address(aapl) ? address(aapl) : address(bite),
                uint24(0),
                int24(200),
                address(0)
            )
        );
        assertEq(router.poolId(), expected);
    }

    function testKitchenShapedCallSendsBiteToRecipient() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        bite.mint(address(pm), 100 ether);

        vm.startPrank(user);
        aapl.approve(address(router), 1 ether);
        uint256[] memory amounts = router.swapExactTokensForTokens(1 ether, 0, _path(), user, block.timestamp + 600);
        vm.stopPrank();

        assertEq(amounts.length, 2);
        assertEq(amounts[0], 1 ether);
        assertEq(amounts[1], 10 ether);
        assertEq(bite.balanceOf(user), 10 ether);
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(bite.balanceOf(address(router)), 0);
        assertEq(aapl.balanceOf(address(pm)), 1 ether);
    }

    function testMinOutZeroSucceeds() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        bite.mint(address(pm), 10 ether);
        vm.startPrank(user);
        aapl.approve(address(router), 1 ether);
        uint256[] memory amounts = router.swapExactTokensForTokens(1 ether, 0, _path(), user, block.timestamp + 600);
        vm.stopPrank();
        assertGt(amounts[1], 0);
    }

    function testLeftoverAaplRefundedToPayer() public {
        address user = makeAddr("user");
        aapl.mint(user, 100 ether);
        bite.mint(address(pm), 50 ether);
        // Consume only 90 AAPL, pay 50 BITE.
        if (router.zeroForOne()) {
            pm.setForcedDelta(-90 ether, 50 ether);
        } else {
            pm.setForcedDelta(50 ether, -90 ether);
        }

        vm.startPrank(user);
        aapl.approve(address(router), 100 ether);
        uint256[] memory amounts =
            router.swapExactTokensForTokens(100 ether, 0, _path(), makeAddr("other"), block.timestamp + 600);
        vm.stopPrank();

        assertEq(amounts[1], 50 ether);
        assertEq(aapl.balanceOf(user), 10 ether); // leftover refunded to payer
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(bite.balanceOf(makeAddr("other")), 50 ether);
    }

    function testWrongPathReverts() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        address[] memory path = new address[](2);
        path[0] = address(bite);
        path[1] = address(aapl);
        vm.startPrank(user);
        aapl.approve(address(router), 1 ether);
        vm.expectRevert(V4KitchenRouter.InvalidPath.selector);
        router.swapExactTokensForTokens(1 ether, 0, path, user, block.timestamp + 600);
        vm.stopPrank();
        assertEq(aapl.balanceOf(user), 1 ether);
    }

    function testWrongPathLengthReverts() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        address[] memory path = new address[](3);
        path[0] = address(aapl);
        path[1] = address(bite);
        path[2] = address(aapl);
        vm.prank(user);
        vm.expectRevert(V4KitchenRouter.InvalidPath.selector);
        router.swapExactTokensForTokens(1 ether, 0, path, user, block.timestamp + 600);
    }

    function testExpiredReverts() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(V4KitchenRouter.Expired.selector);
        router.swapExactTokensForTokens(1 ether, 0, _path(), user, block.timestamp - 1);
    }

    function testUnlockCallbackRejectsNonPoolManager() public {
        vm.expectRevert(V4KitchenRouter.NotPoolManager.selector);
        router.unlockCallback(abi.encode(address(this), address(this), uint256(1), uint256(0)));
    }

    function testDigestBuysAndBurnsBite() public {
        aapl.mint(address(kitchen), 2 ether);
        bite.mint(address(pm), 100 ether);

        kitchen.digest();

        assertEq(kitchen.prizePool(), 1 ether);
        assertEq(kitchen.burned(), 10 ether); // 1 AAPL in → 10 BITE out, then burned
        assertEq(bite.balanceOf(address(kitchen)), 0);
        assertEq(aapl.balanceOf(address(router)), 0);
        assertEq(aapl.balanceOf(address(kitchen)), 1 ether); // parked prize
    }

    function testDigestSwapRevertParksNoPrize() public {
        aapl.mint(address(kitchen), 2 ether);
        // No BITE in the mock PM → take() reverts → digest catch parks nothing.
        kitchen.digest();
        assertEq(kitchen.prizePool(), 0);
        assertEq(kitchen.burned(), 0);
        assertEq(aapl.balanceOf(address(kitchen)), 2 ether);
    }

    function testSlippageMinOutReverts() public {
        address user = makeAddr("user");
        aapl.mint(user, 1 ether);
        bite.mint(address(pm), 10 ether);
        vm.startPrank(user);
        aapl.approve(address(router), 1 ether);
        vm.expectRevert(V4KitchenRouter.TooLittleOut.selector);
        router.swapExactTokensForTokens(1 ether, 10 ether + 1, _path(), user, block.timestamp + 600);
        vm.stopPrank();
        assertEq(aapl.balanceOf(user), 1 ether);
    }
}
