// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MetaWager} from "../src/MetaWager.sol";

/// @dev forge script script/DeployMetaWager.s.sol:DeployMetaWager --rpc-url $RPC_URL --broadcast
contract DeployMetaWager is Script {
    function run() external {
        address token = vm.envAddress("BITE_TOKEN");
        address kitchen = vm.envAddress("KITCHEN_CONTRACT");
        address farmer = vm.envAddress("DEPLOYER");
        uint256 feeBps = vm.envOr("WAGER_FEE_BPS", uint256(1000)); // 10%
        address owner_ = vm.envOr("OWNER", farmer);

        vm.startBroadcast();
        MetaWager wager = new MetaWager(token, kitchen, farmer, feeBps, owner_);
        vm.stopBroadcast();

        console2.log("MetaWager", address(wager));
        console2.log("token", token);
        console2.log("kitchen", kitchen);
        console2.log("farmer", farmer);
        console2.log("feeBps", feeBps);
    }
}
