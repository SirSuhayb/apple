// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ReferralEscrow} from "../src/ReferralEscrow.sol";

/// @notice Owner reclaim: pause + withdraw all escrowed $BITE to `to` (default: owner).
/// Env:
///   REFERRAL_ESCROW_PROXY — proxy address (required)
///   WITHDRAW_TO — recipient (optional; defaults to owner())
///   WITHDRAW_AMOUNT — wei (optional; 0 / unset = full escrowBalance)
///   SKIP_PAUSE — set to 1 to withdraw without pausing
contract WithdrawReferralEscrow is Script {
    function run() external {
        address proxy = vm.envAddress("REFERRAL_ESCROW_PROXY");
        ReferralEscrow escrow = ReferralEscrow(proxy);

        address to = vm.envOr("WITHDRAW_TO", escrow.owner());
        uint256 bal = escrow.escrowBalance();
        uint256 amount = vm.envOr("WITHDRAW_AMOUNT", bal);
        if (amount == 0 || amount > bal) amount = bal;

        bool skipPause = vm.envOr("SKIP_PAUSE", uint256(0)) == 1;

        console2.log("=== Withdraw ReferralEscrow ===");
        console2.log("proxy", proxy);
        console2.log("to", to);
        console2.log("escrowBalance", bal);
        console2.log("withdrawAmount", amount);
        console2.log("rewardPerReferral", escrow.rewardPerReferral());
        console2.log("remainingPayouts", escrow.remainingPayouts());
        console2.log("payoutCount", escrow.payoutCount());
        console2.log("paused", escrow.paused());

        require(amount > 0, "empty escrow");

        vm.startBroadcast();

        if (!skipPause && !escrow.paused()) {
            escrow.pause();
            console2.log("paused");
        }

        escrow.withdraw(to, amount);
        console2.log("withdrawn", amount, "to", to);

        vm.stopBroadcast();

        console2.log("escrowBalance after", escrow.escrowBalance());
        console2.log("remainingPayouts after", escrow.remainingPayouts());
        console2.log("paused after", escrow.paused());
    }
}
