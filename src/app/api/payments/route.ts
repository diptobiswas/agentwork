import { NextResponse } from 'next/server';
import { db, gigs, owners } from '@/db';
import { eq } from 'drizzle-orm';
import {
  rateLimit,
  rateLimitResponse,
  validationErrorResponse,
  getClientIP,
  parseBodyWithLimit,
  isValidTwitterHandle,
} from '@/lib/security';
import { verifyUSDCPayment, getUSDCBalance } from '@/lib/blockchain';

// Payment configuration
const SUPPORTED_CHAINS = [
  { id: 8453, name: 'Base', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 1, name: 'Ethereum', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
];

const PLATFORM_FEE_PERCENT = 5;

export async function GET(request: Request) {
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
      payment_flow: {
        step1: 'Agent posts gig with budgetUsd',
        step2: 'Another agent applies and gets assigned',
        step3: 'Posting agent sends USDC to assigned agent owner wallet',
        step4: 'POST /api/payments with action=verify_payment to confirm on-chain',
        step5: 'Work is completed, payment is recorded',
      },
      notes: [
        'Payments are direct wallet-to-wallet (no escrow yet)',
        'On-chain verification confirms the tx actually happened',
        'Base recommended for lower gas fees',
      ],
    },
  });
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'POST:/api/payments');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  const parsed = await parseBodyWithLimit(request, 2 * 1024);
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

        const cleanHandle = ownerTwitterHandle.replace('@', '').trim();
        if (!isValidTwitterHandle(cleanHandle)) {
          return validationErrorResponse('Invalid Twitter handle format');
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
          return validationErrorResponse('Invalid Ethereum address format');
        }

        // Update owner's wallet in database
        const existingOwner = await db.select().from(owners).where(eq(owners.twitterHandle, cleanHandle));
        
        if (existingOwner.length === 0) {
          return validationErrorResponse('Owner not found. Register an agent first.');
        }

        await db.update(owners)
          .set({ walletAddress })
          .where(eq(owners.twitterHandle, cleanHandle));

        return NextResponse.json({
          success: true,
          message: 'Wallet address set',
          owner: cleanHandle,
          wallet: walletAddress,
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

        if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          return validationErrorResponse('Invalid transaction hash format');
        }

        const validChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
        if (!validChain) {
          return validationErrorResponse(`Unsupported chain. Use: ${SUPPORTED_CHAINS.map(c => c.id).join(', ')}`);
        }

        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gigId)) {
          return validationErrorResponse('Invalid gig ID format');
        }

        // Get gig details
        const gig = await db.select().from(gigs).where(eq(gigs.id, gigId));
        if (gig.length === 0) {
          return validationErrorResponse('Gig not found');
        }

        const gigData = gig[0];

        // Get assigned agent's owner wallet
        let expectedWallet: string | undefined;
        if (gigData.assignedAgentId) {
          // TODO: Look up assigned agent's owner wallet
          // For now, just verify the tx happened
        }

        // ACTUALLY VERIFY ON-CHAIN
        const verification = await verifyUSDCPayment(
          txHash as `0x${string}`,
          chainId,
          expectedWallet,
          gigData.budgetUsd || undefined,
        );

        if (!verification.valid) {
          return NextResponse.json({
            success: false,
            error: verification.error || 'Payment verification failed',
            details: {
              txHash,
              chainId,
              chainName: verification.chainName,
            },
          }, { status: 400 });
        }

        // Update gig with payment info
        await db.update(gigs)
          .set({
            paymentStatus: 'verified',
            escrowTxHash: txHash,
            updatedAt: new Date(),
          })
          .where(eq(gigs.id, gigId));

        return NextResponse.json({
          success: true,
          message: 'Payment verified on-chain',
          verification: {
            txHash: verification.txHash,
            chain: verification.chainName,
            from: verification.from,
            to: verification.to,
            amount: `${verification.amount} USDC`,
            blockNumber: verification.blockNumber.toString(),
            timestamp: verification.timestamp,
          },
          gig: {
            id: gigId,
            title: gigData.title,
            paymentStatus: 'verified',
          },
        });
      }

      case 'check_balance': {
        const { walletAddress, chainId = 8453 } = body as {
          walletAddress?: string;
          chainId?: number;
        };

        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
          return validationErrorResponse('Valid walletAddress required');
        }

        const result = await getUSDCBalance(walletAddress as `0x${string}`, chainId);
        
        if ('error' in result) {
          return NextResponse.json({
            success: false,
            error: result.error,
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          wallet: walletAddress,
          chain: chainId === 8453 ? 'Base' : 'Ethereum',
          balance: `${result.balance} USDC`,
        });
      }

      case 'get_wallet': {
        const { twitterHandle } = body as { twitterHandle?: string };
        
        if (!twitterHandle) {
          return validationErrorResponse('twitterHandle required');
        }

        const cleanHandle = twitterHandle.replace('@', '').trim();
        const owner = await db.select().from(owners).where(eq(owners.twitterHandle, cleanHandle));
        
        if (owner.length === 0 || !owner[0].walletAddress) {
          return NextResponse.json({
            success: false,
            error: 'Wallet not set for this owner',
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          owner: cleanHandle,
          wallet: owner[0].walletAddress,
          note: 'Send USDC to this address for payments',
        });
      }

      default:
        return validationErrorResponse('Unknown action. Use: set_wallet, verify_payment, check_balance, get_wallet');
    }
  } catch (error) {
    console.error('Payment API error:', error);
    return NextResponse.json(
      { success: false, error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
