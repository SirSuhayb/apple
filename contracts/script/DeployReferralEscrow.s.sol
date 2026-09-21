// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ReferralEscrow} from "../src/ReferralEscrow.sol";

/// @dev Deploy UUPS proxy + implementation to Robinhood 4663.
///   ./scripts/deploy-referral-escrow.sh
///
/// Env: BITE_TOKEN, ATTESTER, REWARD_PER_REFERRAL, OWNER (shell sets owner/attester = deployer).
/// Fund the printed PROXY address — not the implementation.
contract DeployReferralEscrow is Script {
    address constant DEFAULT_BITE = 0x0d6e3D5D99a92499f584Ac821a64b237e5cEf3c9;

    function run() external {
        address token = vm.envOr("BITE_TOKEN", DEFAULT_BITE);
        uint256 reward = vm.envOr("REWARD_PER_REFERRAL", uint256(100 ether));
        address owner_ = vm.envAddress("OWNER");
        address attester = vm.envAddress("ATTESTER");

        vm.startBroadcast();

        ReferralEscrow impl = new ReferralEscrow();
        bytes memory initData =
            abi.encodeCall(ReferralEscrow.initialize, (token, attester, reward, owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        ReferralEscrow escrow = ReferralEscrow(address(proxy));

        console2.log("=== ReferralEscrow UUPS deploy ===");
        console2.log("PROXY (fund this)", address(proxy));
        console2.log("IMPLEMENTATION", address(impl));
        console2.log("token", address(escrow.token()));
        console2.log("owner", escrow.owner());
        console2.log("attester", escrow.attester());
        console2.log("rewardPerReferral", escrow.rewardPerReferral());
    }
}
