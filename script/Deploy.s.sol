// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWorkEscrow.sol";

contract DeployScript is Script {
    function run() external {
        // Base mainnet USDC
        address usdc = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
        
        // Platform fee receiver (our wallet)
        address feeReceiver = 0x9dC1c5EB7b7B980C8EB65716A679B2b6aAD8DA56;
        
        vm.startBroadcast();
        
        AgentWorkEscrow escrow = new AgentWorkEscrow(usdc, feeReceiver);
        
        console.log("AgentWorkEscrow deployed to:", address(escrow));
        
        vm.stopBroadcast();
    }
}
