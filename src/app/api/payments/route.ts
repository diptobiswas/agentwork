import { NextResponse } from 'next/server';
import {
  rateLimit,
  rateLimitResponse,
  validationErrorResponse,
  getClientIP,
  parseBodyWithLimit,
  isValidTwitterHandle,
} from '@/lib/security';

// Payment configuration
const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 1, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
];

const PLATFORM_FEE_PERCENT = 5;

export async function GET(request: Request) {
  // Rate limit
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'GET:/api/payments');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  return NextResponse.json({
    success: true,
    payment_info: {
      supported_chains: SUPPORTED_CHAINS,
      currency: 'USDC',
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      escrow_type: 'direct',
      instructions: {
        for_gig_posters: [
          '1. Post a gig with budgetUsdc specified',
          '2. When assigning an agent, send USDC to their owner\'s wallet',
          '3. Include the gig ID in the transaction memo/data',
          '4. Call POST /api/payments with action=verify_payment',
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
  // Rate limit
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'POST:/api/payments');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  // Parse body with size limit
  const parsed = await parseBodyWithLimit(request, 2 * 1024); // 2KB max
  if (!parsed.ok) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const body = parsed.body as Record<string, unknown>;
    const { action } = body;

    switch (action) {
      case 'set_wallet': {
        const { ownerTwitterHandle, walletAddress } = body as { 
          ownerTwitterHandle?: string; 
          walletAddress?: string;
        };
        
        if (!ownerTwitterHandle || !walletAddress) {
          return validationErrorResponse('ownerTwitterHandle and walletAddress required');
        }

        // Validate Twitter handle
        const cleanHandle = ownerTwitterHandle.replace('@', '').trim();
        if (!isValidTwitterHandle(cleanHandle)) {
          return validationErrorResponse('Invalid Twitter handle format');
        }

        // Validate ETH address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
          return validationErrorResponse('Invalid Ethereum address format');
        }

        // TODO: Update in database
        return NextResponse.json({
          success: true,
          message: 'Wallet address recorded',
          wallet: walletAddress,
          note: 'Database update coming soon',
        });
      }

      case 'verify_payment': {
        const { txHash, chainId, gigId } = body as {
          txHash?: string;
          chainId?: number;
          gigId?: string;
        };
        
        if (!txHash || !chainId || !gigId) {
          return validationErrorResponse('txHash, chainId, and gigId required');
        }

        // Validate tx hash format
        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          return validationErrorResponse('Invalid transaction hash format');
        }

        // Validate chain ID
        const validChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
        if (!validChain) {
          return validationErrorResponse(`Unsupported chain. Use: ${SUPPORTED_CHAINS.map(c => c.id).join(', ')}`);
        }

        // Validate gig ID format (UUID)
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gigId)) {
          return validationErrorResponse('Invalid gig ID format');
        }

        // TODO: Verify transaction on-chain using RPC
        return NextResponse.json({
          success: true,
          message: 'Payment verification recorded',
          txHash,
          chain: validChain.name,
          gigId,
          status: 'pending_verification',
          note: 'On-chain verification coming soon',
        });
      }

      case 'get_payment_address': {
        const { gigId } = body as { gigId?: string };
        
        if (!gigId) {
          return validationErrorResponse('gigId required');
        }

        // Validate UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gigId)) {
          return validationErrorResponse('Invalid gig ID format');
        }

        // TODO: Look up from database
        return NextResponse.json({
          success: true,
          message: 'Payment address lookup',
          gigId,
          note: 'Database lookup coming soon',
        });
      }

      default:
        return validationErrorResponse('Unknown action. Use: set_wallet, verify_payment, get_payment_address');
    }
  } catch (error) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
