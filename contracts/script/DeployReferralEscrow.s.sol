// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ReferralEscrow} from "../src/ReferralEscrow.sol";

/// @dev Dry-run (no broadcast):
///   forge script script/DeployReferralEscrow.s.sol:DeployReferralEscrow --rpc-url $RPC_URL
/// Broadcast (explicit only — do not fund 1M here):
///   forge script script/DeployReferralEscrow.s.sol:DeployReferralEscrow --rpc-url $RPC_URL --broadcast
///
/// Env:
///   BITE_TOKEN          (default Robinhood BITE)
///   ATTESTER            site backend / keeper EOA or multisig
///   REWARD_PER_REFERRAL wei amount (default 100e18 = 100 BITE)
///   OWNER / DEPLOYER    owner (historically sirsu.eth deployer)
contract DeployReferralEscrow is Script {
    address constant DEFAULT_BITE = 0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9;

    function run() external {
        address token = vm.envOr("BITE_TOKEN", DEFAULT_BITE);
        address attester = vm.envAddress("ATTESTER");
        uint256 reward = vm.envOr("REWARD_PER_REFERRAL", uint256(100 ether));
        address deployer = vm.envOr("DEPLOYER", address(0));
        address owner_ = vm.envOr("OWNER", deployer);
        require(owner_ != address(0), "set OWNER or DEPLOYER");
        require(attester != address(0), "set ATTESTER");

        vm.startBroadcast();
        ReferralEscrow escrow = new ReferralEscrow(token, attester, reward, owner_);
        vm.stopBroadcast();

        console2.log("ReferralEscrow", address(escrow));
        console2.log("token", token);
        console2.log("attester", attester);
        console2.log("rewardPerReferral", reward);
        console2.log("owner", owner_);
        console2.log("next: approve+deposit BITE, then site bind + attester qualify");
    }
}
