// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AppleKitchen} from "../src/AppleKitchen.sol";
import {V4KitchenRouter} from "../src/V4KitchenRouter.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @notice Live Robinhood 4663 pool. Skips if the RPC is unreachable.
contract V4KitchenRouterForkTest is Test {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;
    address constant AAPL = 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9;
    address constant BITE = 0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9;
    address constant HOOKS = 0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044;
    address constant KITCHEN = 0x56fEb999D829761C787581413605bf88F5Cd81e0;
    address constant OWNER = 0xEB95ff72EAb9e8D8fdb545FE15587AcCF410b42E;
    bytes32 constant POOL_ID = 0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c;
    uint24 constant FEE = 0;
    int24 constant TICK_SPACING = 200;

    V4KitchenRouter router;
    bool ready;

    function setUp() public {
        string memory rpc = vm.envOr("RPC_URL", string("https://rpc.mainnet.chain.robinhood.com"));
        try vm.createSelectFork(rpc) {
            ready = true;
        } catch {
            ready = false;
            return;
        }
        router = new V4KitchenRouter(POOL_MANAGER, AAPL, BITE, FEE, TICK_SPACING, HOOKS);
    }

    modifier forkOnly() {
        if (!ready) vm.skip(true);
        _;
    }

    function _path() internal pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = AAPL;
        path[1] = BITE;
    }

    function testForkPoolIdMatchesLive() public forkOnly {
        assertEq(router.poolId(), POOL_ID);
        assertFalse(router.zeroForOne()); // BITE < AAPL → sell token1
    }

    function testForkKitchenShapedSwap() public forkOnly {
        address user = makeAddr("swapper");
        uint256 amountIn = 0.01 ether;
        deal(AAPL, user, amountIn);

        vm.startPrank(user);
        IERC20(AAPL).approve(address(router), amountIn);
        uint256[] memory amounts = router.swapExactTokensForTokens(amountIn, 0, _path(), user, block.timestamp + 600);
        vm.stopPrank();

        assertEq(amounts[0], amountIn);
        assertGt(amounts[1], 0);
        assertEq(IERC20(BITE).balanceOf(user), amounts[1]);
        assertEq(IERC20(AAPL).balanceOf(address(router)), 0);
        assertEq(IERC20(BITE).balanceOf(address(router)), 0);
        assertEq(IERC20(AAPL).balanceOf(user), 0);
    }

    function testForkMinOutZero() public forkOnly {
        address user = makeAddr("minout");
        uint256 amountIn = 0.005 ether;
        deal(AAPL, user, amountIn);
        vm.startPrank(user);
        IERC20(AAPL).approve(address(router), amountIn);
        uint256[] memory amounts = router.swapExactTokensForTokens(amountIn, 0, _path(), user, block.timestamp + 600);
        vm.stopPrank();
        assertGt(amounts[1], 0);
    }

    function testForkWrongPathReverts() public forkOnly {
        address user = makeAddr("badpath");
        deal(AAPL, user, 0.01 ether);
        address[] memory path = new address[](2);
        path[0] = BITE;
        path[1] = AAPL;
        vm.startPrank(user);
        IERC20(AAPL).approve(address(router), 0.01 ether);
        vm.expectRevert(V4KitchenRouter.InvalidPath.selector);
        router.swapExactTokensForTokens(0.01 ether, 0, path, user, block.timestamp + 600);
        vm.stopPrank();
    }

    function testForkDigestBuysBurnsAndParksPrize() public forkOnly {
        AppleKitchen kitchen = AppleKitchen(KITCHEN);
        uint256 surplus = 0.02 ether; // 0.01 AAPL buy-and-burn, 0.01 prize
        deal(AAPL, KITCHEN, IERC20(AAPL).balanceOf(KITCHEN) + surplus);

        uint256 prizeBefore = kitchen.prizePool();
        uint256 burnedBefore = kitchen.burned();
        uint256 aaplBefore = IERC20(AAPL).balanceOf(KITCHEN);

        vm.prank(OWNER);
        kitchen.setRouter(address(router));
        kitchen.digest();

        assertEq(IERC20(AAPL).balanceOf(address(router)), 0);
        assertEq(IERC20(BITE).balanceOf(address(router)), 0);
        assertEq(IERC20(BITE).balanceOf(KITCHEN), 0); // burned
        assertGt(kitchen.burned(), burnedBefore);
        assertGt(kitchen.prizePool(), prizeBefore);
        // Prize side stays on kitchen; burn-side AAPL is spent.
        assertLt(IERC20(AAPL).balanceOf(KITCHEN), aaplBefore);
        assertEq(kitchen.prizePool() > prizeBefore, true);
    }
}
