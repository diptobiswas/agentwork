import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, mainnet } from 'viem/chains';

// USDC Contract addresses
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
};

export interface PaymentVerification {
  valid: boolean;
  txHash: string;
  chainId: number;
  chainName: string;
  from: string;
  to: string;
  amount: string;
  amountRaw: bigint;
  blockNumber: bigint;
  timestamp?: number;
  error?: string;
}

/**
 * Verify a USDC payment transaction on-chain
 */
export async function verifyUSDCPayment(
  txHash: `0x${string}`,
  chainId: number,
  expectedTo?: string,
  expectedAmount?: string,
): Promise<PaymentVerification> {
  const usdcAddress = USDC_ADDRESSES[chainId];
  const chainName = chainId === 8453 ? 'Base' : chainId === 1 ? 'Ethereum' : 'Unknown';

  if (!usdcAddress) {
    return {
      valid: false,
      txHash,
      chainId,
      chainName,
      from: '',
      to: '',
      amount: '0',
      amountRaw: 0n,
      blockNumber: 0n,
      error: `Unsupported chain: ${chainId}`,
    };
  }

  // Create client based on chain
  const client = chainId === 8453 
    ? createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    : createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });

  try {
    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    
    if (!receipt) {
      return {
        valid: false,
        txHash,
        chainId,
        chainName,
        from: '',
        to: '',
        amount: '0',
        amountRaw: 0n,
        blockNumber: 0n,
        error: 'Transaction not found',
      };
    }

    if (receipt.status !== 'success') {
      return {
        valid: false,
        txHash,
        chainId,
        chainName,
        from: receipt.from,
        to: '',
        amount: '0',
        amountRaw: 0n,
        blockNumber: receipt.blockNumber,
        error: 'Transaction failed',
      };
    }

    // Find USDC Transfer event in logs
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    const transferLog = receipt.logs.find(log => 
      log.address.toLowerCase() === usdcAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_TOPIC
    );

    if (!transferLog) {
      return {
        valid: false,
        txHash,
        chainId,
        chainName,
        from: receipt.from,
        to: '',
        amount: '0',
        amountRaw: 0n,
        blockNumber: receipt.blockNumber,
        error: 'No USDC transfer found in transaction',
      };
    }

    // Decode Transfer event
    const from = '0x' + transferLog.topics[1]!.slice(26);
    const to = '0x' + transferLog.topics[2]!.slice(26);
    const amountRaw = BigInt(transferLog.data);
    const amount = formatUnits(amountRaw, 6);

    // Validate recipient if expected
    if (expectedTo && to.toLowerCase() !== expectedTo.toLowerCase()) {
      return {
        valid: false,
        txHash,
        chainId,
        chainName,
        from,
        to,
        amount,
        amountRaw,
        blockNumber: receipt.blockNumber,
        error: `Wrong recipient. Expected ${expectedTo}, got ${to}`,
      };
    }

    // Validate amount if expected
    if (expectedAmount) {
      const expectedRaw = BigInt(Math.floor(parseFloat(expectedAmount) * 1e6));
      if (amountRaw < expectedRaw) {
        return {
          valid: false,
          txHash,
          chainId,
          chainName,
          from,
          to,
          amount,
          amountRaw,
          blockNumber: receipt.blockNumber,
          error: `Insufficient amount. Expected ${expectedAmount} USDC, got ${amount} USDC`,
        };
      }
    }

    // Get block timestamp
    let timestamp: number | undefined;
    try {
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      timestamp = Number(block.timestamp);
    } catch {
      // Timestamp is optional
    }

    return {
      valid: true,
      txHash,
      chainId,
      chainName,
      from,
      to,
      amount,
      amountRaw,
      blockNumber: receipt.blockNumber,
      timestamp,
    };
  } catch (error) {
    return {
      valid: false,
      txHash,
      chainId,
      chainName,
      from: '',
      to: '',
      amount: '0',
      amountRaw: 0n,
      blockNumber: 0n,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current USDC balance for an address
 */
export async function getUSDCBalance(
  address: `0x${string}`,
  chainId: number = 8453,
): Promise<{ balance: string; balanceRaw: bigint } | { error: string }> {
  const usdcAddress = USDC_ADDRESSES[chainId];

  if (!usdcAddress) {
    return { error: `Unsupported chain: ${chainId}` };
  }

  const client = chainId === 8453 
    ? createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    : createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });

  try {
    const balanceRaw = await client.readContract({
      address: usdcAddress,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [address],
    });

    return {
      balance: formatUnits(balanceRaw, 6),
      balanceRaw,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
