// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {V4KitchenRouter} from "../src/V4KitchenRouter.sol";

/// @dev Deploy the V2-shaped v4 adapter. Does NOT call kitchen.setRouter;
///      that must be sent by the kitchen owner (sirsu.eth).
///
/// forge script script/DeployV4KitchenRouter.s.sol:DeployV4KitchenRouter --rpc-url $RPC_URL --broadcast
contract DeployV4KitchenRouter is Script {
    function run() external {
        address poolManager = vm.envOr("UNISWAP_POOL_MANAGER", address(0x8366a39CC670B4001A1121B8F6A443A643e40951));
        address aapl = vm.envOr("AAPL_TOKEN", address(0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9));
        address bite = vm.envOr("BITE_TOKEN", address(0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9));
        uint24 fee = uint24(vm.envOr("V4_POOL_FEE", uint256(0)));
        int24 tickSpacing = int24(int256(vm.envOr("V4_TICK_SPACING", uint256(200))));
        address hooks = vm.envOr("V4_HOOKS", address(0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044));
        address kitchen = vm.envOr("KITCHEN_CONTRACT", address(0x56fEb999D829761C787581413605bf88F5Cd81e0));
        bytes32 expectedPoolId =
            vm.envOr("V4_POOL_ID", bytes32(0x76d38162a8ef7da08c92777299fbbfe02748eea05e7cd125131a537b3f08f15c));

        vm.startBroadcast();
        V4KitchenRouter router = new V4KitchenRouter(poolManager, aapl, bite, fee, tickSpacing, hooks);
        vm.stopBroadcast();

        bytes32 id = router.poolId();
        require(id == expectedPoolId, "pool id mismatch");

        console2.log("V4KitchenRouter", address(router));
        console2.log("poolId");
        console2.logBytes32(id);
        console2.log("kitchen", kitchen);
        console2.log("owner must call kitchen.setRouter(adapter); this script does not");
        console2.logBytes(abi.encodeWithSignature("setRouter(address)", address(router)));
    }
}
