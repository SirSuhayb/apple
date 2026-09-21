// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {AppleKitchen} from "../src/AppleKitchen.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

contract AppleKitchenTest is Test {
    MockERC20 bite;
    MockERC20 aapl;
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
        deadline = block.timestamp + 30 days;
        kitchen = new AppleKitchen(address(bite), address(aapl), farmer, coreTarget, deadline, 1 ether, 1, farmer);

        bite.mint(eater, 1_000 ether);
        bite.mint(farmer, 1_000 ether);
    }

    function testBiteBurnsAndProgresses() public {
        vm.startPrank(eater);
        bite.approve(address(kitchen), 100 ether);
        kitchen.bite(100 ether);
        vm.stopPrank();

        assertEq(kitchen.burned(), 100 ether);
        assertEq(bite.balanceOf(eater), 900 ether);
        assertEq(bite.totalSupply(), 1_900 ether); // 2000 minted - 100 burned
    }

    function testRevealCoreAndClaim() public {
        vm.startPrank(eater);
        bite.approve(address(kitchen), coreTarget);
        kitchen.bite(coreTarget);
        vm.stopPrank();

        // Seed fees, digest while still racing → prize grows
        aapl.mint(address(kitchen), 10 ether);
        kitchen.digest();
        uint256 pot = kitchen.prizePool();
        assertEq(pot, 5 ether);

        uint256 claimAmount = 3 ether;
        bytes32 leaf = keccak256(abi.encodePacked(uint256(0), eater, claimAmount));
        kitchen.revealCore(leaf);

        bytes32[] memory proof;
        vm.prank(eater);
        kitchen.claim(0, eater, claimAmount, proof);
        assertEq(aapl.balanceOf(eater), claimAmount);
        assertEq(kitchen.prizePool(), pot - claimAmount);
    }

    function testRevealRotPaysFarmerEverything() public {
        aapl.mint(address(kitchen), 20 ether);
        kitchen.digest();
        uint256 pot = kitchen.prizePool();
        assertEq(pot, 10 ether);

        vm.warp(deadline + 1);
        kitchen.revealRot();
        assertEq(uint256(kitchen.phase()), uint256(AppleKitchen.Phase.Rot));
        // Prize + leftover burn-side AAPL both go to the farmer
        assertEq(aapl.balanceOf(farmer), 20 ether);
        assertEq(kitchen.prizePool(), 0);
    }

    function testDeployerCannotClaimCore() public {
        vm.startPrank(farmer);
        bite.approve(address(kitchen), coreTarget);
        kitchen.bite(coreTarget);
        vm.stopPrank();

        aapl.mint(address(kitchen), 4 ether);
        kitchen.digest();

        uint256 claimAmount = 1 ether;
        bytes32 leaf = keccak256(abi.encodePacked(uint256(0), farmer, claimAmount));
        kitchen.revealCore(leaf);

        bytes32[] memory proof;
        vm.prank(farmer);
        vm.expectRevert(AppleKitchen.DeployerExcluded.selector);
        kitchen.claim(0, farmer, claimAmount, proof);
    }

    function testProgressBps() public {
        vm.startPrank(eater);
        bite.approve(address(kitchen), 250 ether);
        kitchen.bite(250 ether);
        vm.stopPrank();
        assertEq(kitchen.progressBps(), 5_000);
    }
}
