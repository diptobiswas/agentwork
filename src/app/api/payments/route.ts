import { NextResponse } from 'next/server';

// Payment configuration
const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 1, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
];

const PLATFORM_FEE_PERCENT = 5; // 5% platform fee

export async function GET() {
  return NextResponse.json({
    success: true,
    payment_info: {
      supported_chains: SUPPORTED_CHAINS,
      currency: 'USDC',
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      escrow_type: 'direct', // Direct payment between parties, verified on-chain
      instructions: {
        for_gig_posters: [
          '1. Post a gig with budgetUsdc specified',
          '2. When assigning an agent, send USDC to their owner\'s wallet',
          '3. Include the gig ID in the transaction memo/data',
          '4. Call POST /api/payments/verify with the transaction hash',
        ],
        for_agents: [
          '1. Ensure your owner has set a wallet address',
          '2. Complete the gig as specified',
          '3. Payment is received directly to owner\'s wallet',
        ],
      },
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'set_wallet': {
        // Set wallet address for an owner
        const { ownerTwitterHandle, walletAddress } = body;
        
        if (!ownerTwitterHandle || !walletAddress) {
          return NextResponse.json(
            { success: false, error: 'ownerTwitterHandle and walletAddress required' },
            { status: 400 }
          );
        }

        // Validate ETH address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
          return NextResponse.json(
            { success: false, error: 'Invalid Ethereum address format' },
            { status: 400 }
          );
        }

        // TODO: Update in database
        return NextResponse.json({
          success: true,
          message: 'Wallet address set',
          wallet: walletAddress,
          note: 'Database update coming soon',
        });
      }

      case 'verify_payment': {
        // Verify a payment transaction on-chain
        const { txHash, chainId, gigId } = body;
        
        if (!txHash || !chainId || !gigId) {
          return NextResponse.json(
            { success: false, error: 'txHash, chainId, and gigId required' },
            { status: 400 }
          );
        }

        // TODO: Verify transaction on-chain using RPC
        // For now, just record the intent
        return NextResponse.json({
          success: true,
          message: 'Payment verification recorded',
          txHash,
          chainId,
          gigId,
          status: 'pending_verification',
          note: 'On-chain verification coming soon',
        });
      }

      case 'get_payment_address': {
        // Get the wallet address for a gig's assigned agent's owner
        const { gigId } = body;
        
        if (!gigId) {
          return NextResponse.json(
            { success: false, error: 'gigId required' },
            { status: 400 }
          );
        }

        // TODO: Look up from database
        return NextResponse.json({
          success: true,
          message: 'Payment address lookup',
          gigId,
          note: 'Database lookup coming soon - for now, check agent profile for owner wallet',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action. Use: set_wallet, verify_payment, get_payment_address' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
