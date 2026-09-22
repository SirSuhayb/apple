// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ReferralEscrow} from "../src/ReferralEscrow.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @notice Owner ops: set Windfall reward + optional BITE deposit into the UUPS proxy.
/// Env:
///   REFERRAL_ESCROW_PROXY — proxy address (required)
///   BITE_TOKEN — $BITE ERC-20
///   REWARD_PER_REFERRAL — wei (default 250_000 ether)
///   DEPOSIT_AMOUNT — wei to transferFrom msg.sender into escrow (0 = skip deposit)
contract FundReferralEscrow is Script {
    function run() external {
        address proxy = vm.envAddress("REFERRAL_ESCROW_PROXY");
        address token = vm.envAddress("BITE_TOKEN");
        uint256 reward = vm.envOr("REWARD_PER_REFERRAL", uint256(250_000 ether));
        uint256 depositAmount = vm.envOr("DEPOSIT_AMOUNT", uint256(0));

        ReferralEscrow escrow = ReferralEscrow(proxy);
        IERC20 bite = IERC20(token);

        vm.startBroadcast();

        uint256 oldReward = escrow.rewardPerReferral();
        if (oldReward != reward) {
            escrow.setRewardPerReferral(reward);
            console2.log("setRewardPerReferral", oldReward, "->", reward);
        } else {
            console2.log("reward already set", reward);
        }

        if (depositAmount > 0) {
            require(bite.approve(proxy, depositAmount), "approve failed");
            escrow.deposit(depositAmount);
            console2.log("deposited", depositAmount);
        } else {
            console2.log("deposit skipped (DEPOSIT_AMOUNT=0)");
        }

        vm.stopBroadcast();

        uint256 bal = escrow.escrowBalance();
        uint256 remaining = escrow.remainingPayouts();
        console2.log("escrowBalance", bal);
        console2.log("remainingPayouts", remaining);
        console2.log("rewardPerReferral", escrow.rewardPerReferral());
    }
}
