// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ReferralEscrow} from "../src/ReferralEscrow.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract ReferralEscrowTest is Test {
    MockERC20 bite;
    ReferralEscrow escrow;

    address owner;
    address attester;
    address referrer;
    address referee;
    address other;

    uint256 constant REWARD = 100 ether;

    function setUp() public {
        owner = makeAddr("owner");
        attester = makeAddr("attester");
        referrer = makeAddr("referrer");
        referee = makeAddr("referee");
        other = makeAddr("other");

        bite = new MockERC20("BITE", "BITE", false);
        escrow = new ReferralEscrow(address(bite), attester, REWARD, owner);

        bite.mint(owner, 1_000_000 ether);
        bite.mint(referrer, 10 ether);
        bite.mint(referee, 10 ether);
    }

    function _fund(uint256 amount) internal {
        vm.startPrank(owner);
        bite.approve(address(escrow), amount);
        escrow.deposit(amount);
        vm.stopPrank();
    }

    function testHappyPathBindQualifyPaysReferrer() public {
        _fund(REWARD * 10);

        vm.prank(referee);
        escrow.bind(referrer);

        assertEq(escrow.referrerOf(referee), referrer);

        uint256 beforeBal = bite.balanceOf(referrer);

        vm.prank(attester);
        escrow.qualify(referee);

        assertTrue(escrow.paid(referee));
        assertEq(bite.balanceOf(referrer), beforeBal + REWARD);
        assertEq(escrow.payoutCount(), 1);
        assertEq(escrow.totalPaid(), REWARD);
    }

    function testSelfReferralReverts() public {
        vm.prank(referee);
        vm.expectRevert(ReferralEscrow.SelfReferral.selector);
        escrow.bind(referee);
    }

    function testDoubleBindReverts() public {
        vm.prank(referee);
        escrow.bind(referrer);

        vm.prank(referee);
        vm.expectRevert(ReferralEscrow.AlreadyBound.selector);
        escrow.bind(other);
    }

    function testDoubleClaimReverts() public {
        _fund(REWARD * 2);

        vm.prank(referee);
        escrow.bind(referrer);

        vm.prank(attester);
        escrow.qualify(referee);

        vm.prank(attester);
        vm.expectRevert(ReferralEscrow.AlreadyPaid.selector);
        escrow.qualify(referee);
    }

    function testEmptyEscrowReverts() public {
        vm.prank(referee);
        escrow.bind(referrer);

        vm.prank(attester);
        vm.expectRevert(ReferralEscrow.InsufficientEscrow.selector);
        escrow.qualify(referee);
    }

    function testQualifyRequiresBind() public {
        _fund(REWARD);

        vm.prank(attester);
        vm.expectRevert(ReferralEscrow.NotBound.selector);
        escrow.qualify(referee);
    }

    function testNonAttesterCannotQualify() public {
        _fund(REWARD);
        vm.prank(referee);
        escrow.bind(referrer);

        vm.prank(other);
        vm.expectRevert(ReferralEscrow.NotAttester.selector);
        escrow.qualify(referee);
    }

    function testQualifyBatch() public {
        address referee2 = makeAddr("referee2");
        address referrer2 = makeAddr("referrer2");

        _fund(REWARD * 2);

        vm.prank(referee);
        escrow.bind(referrer);
        vm.prank(referee2);
        escrow.bind(referrer2);

        address[] memory refs = new address[](2);
        refs[0] = referee;
        refs[1] = referee2;

        vm.prank(attester);
        escrow.qualifyBatch(refs);

        assertTrue(escrow.paid(referee));
        assertTrue(escrow.paid(referee2));
        assertEq(escrow.payoutCount(), 2);
        assertEq(bite.balanceOf(referrer), 10 ether + REWARD);
        assertEq(bite.balanceOf(referrer2), REWARD);
    }

    function testOwnerWithdrawLeftover() public {
        _fund(REWARD * 5);

        vm.prank(owner);
        escrow.withdraw(owner, REWARD * 2);

        assertEq(bite.balanceOf(address(escrow)), REWARD * 3);
    }

    function testPauseBlocksBindAndQualify() public {
        _fund(REWARD);
        vm.prank(owner);
        escrow.pause();

        vm.prank(referee);
        vm.expectRevert(ReferralEscrow.PausedError.selector);
        escrow.bind(referrer);

        vm.prank(owner);
        escrow.unpause();

        vm.prank(referee);
        escrow.bind(referrer);

        vm.prank(owner);
        escrow.pause();

        vm.prank(attester);
        vm.expectRevert(ReferralEscrow.PausedError.selector);
        escrow.qualify(referee);
    }

    function testSetRewardAndAttester() public {
        vm.prank(owner);
        escrow.setRewardPerReferral(50 ether);
        assertEq(escrow.rewardPerReferral(), 50 ether);

        address newAttester = makeAddr("newAttester");
        vm.prank(owner);
        escrow.setAttester(newAttester);
        assertEq(escrow.attester(), newAttester);
    }

    function testRemainingPayouts() public {
        _fund(REWARD * 3 + 10 ether);
        assertEq(escrow.remainingPayouts(), 3);
    }

    function testConstructorRejectsZeroReward() public {
        vm.expectRevert(ReferralEscrow.ZeroAmount.selector);
        new ReferralEscrow(address(bite), attester, 0, owner);
    }
}
