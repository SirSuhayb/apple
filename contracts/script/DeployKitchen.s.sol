// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {AppleKitchen} from "../src/AppleKitchen.sol";

/// @dev forge script script/DeployKitchen.s.sol:DeployKitchen --rpc-url $RPC_URL --broadcast
contract DeployKitchen is Script {
    function run() external {
        address token = vm.envAddress("BITE_TOKEN");
        address quote = vm.envAddress("AAPL_TOKEN");
        address deployer = vm.envAddress("DEPLOYER");
        uint256 coreTarget = vm.envUint("CORE_TARGET");
        uint256 deadline = vm.envUint("DEADLINE");
        uint256 minHold = vm.envOr("MIN_HOLD", uint256(1 ether));
        uint256 minConsumption = vm.envOr("MIN_CONSUMPTION", uint256(1));
        address owner_ = vm.envOr("OWNER", deployer);

        vm.startBroadcast();
        AppleKitchen kitchen =
            new AppleKitchen(token, quote, deployer, coreTarget, deadline, minHold, minConsumption, owner_);
        vm.stopBroadcast();

        console2.log("AppleKitchen", address(kitchen));
        console2.log("coreTarget", coreTarget);
        console2.log("deadline", deadline);
    }
}
