/**
 * Crypto Payment Service
 *
 * Handles $BRIAN and USDC payments on Base network
 * Verifies blockchain transactions and activates subscriptions
 */

import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Base network contract addresses
const CONTRACTS = {
  // USDC on Base (official Circle deployment)
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  // $BRIAN token on Base (to be deployed)
  BRIAN: (process.env.BRIAN_TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`,
};

// Treasury wallet that receives payments
const TREASURY_WALLET = (process.env.TREASURY_WALLET_ADDRESS || process.env.TREASURY_BASE || '') as `0x${string}`;

// ERC20 ABI for transfer event
const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address account) view returns (uint256)',
]);

// ============================================================================
// TYPES
// ============================================================================

export type CryptoToken = 'USDC' | 'BRIAN';

export interface CryptoPaymentRequest {
  userId: string;
  planId: string;
  token: CryptoToken;
  amount: number; // In token units (e.g., 19.99 USDC or 14999 BRIAN)
  walletAddress: string;
}

export interface CryptoPaymentResult {
  success: boolean;
  txHash?: string;
  error?: string;
  confirmations?: number;
  blockNumber?: bigint;
}

export interface PaymentVerification {
  verified: boolean;
  from: string;
  to: string;
  amount: string;
  token: CryptoToken;
  blockNumber: bigint;
  txHash: string;
}

// ============================================================================
// SERVICE
// ============================================================================

class CryptoPaymentService {
  private client;
  private isConfigured: boolean;

  constructor() {
    this.client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
    });

    // Check if treasury wallet is configured
    this.isConfigured = !!TREASURY_WALLET && TREASURY_WALLET !== '0x0000000000000000000000000000000000000000';

    if (!this.isConfigured) {
      console.warn('[CryptoPaymentService] Treasury wallet not configured - payments will be simulated');
    }
  }

  /**
   * Get the payment address users should send tokens to
   */
  getTreasuryAddress(): string {
    return TREASURY_WALLET;
  }

  /**
   * Get token contract address
   */
  getTokenAddress(token: CryptoToken): string {
    return CONTRACTS[token];
  }

  /**
   * Get expected payment amount in wei/smallest unit
   */
  async getPaymentAmountInWei(token: CryptoToken, amount: number): Promise<bigint> {
    const contractAddress = CONTRACTS[token];

    try {
      const decimals = await this.client.readContract({
        address: contractAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });

      // Convert to smallest unit
      return BigInt(Math.floor(amount * 10 ** Number(decimals)));
    } catch {
      // Default decimals: 6 for USDC, 18 for BRIAN
      const defaultDecimals = token === 'USDC' ? 6 : 18;
      return BigInt(Math.floor(amount * 10 ** defaultDecimals));
    }
  }

  /**
   * Verify a payment transaction on Base
   */
  async verifyPayment(
    txHash: `0x${string}`,
    expectedToken: CryptoToken,
    expectedAmount: number,
    fromAddress: string
  ): Promise<PaymentVerification> {
    try {
      // Get transaction receipt
      const receipt = await this.client.getTransactionReceipt({ hash: txHash });

      if (!receipt || receipt.status !== 'success') {
        throw new Error('Transaction failed or not found');
      }

      const contractAddress = CONTRACTS[expectedToken];
      const expectedAmountWei = await this.getPaymentAmountInWei(expectedToken, expectedAmount);

      // Find Transfer event to treasury
      const transferLog = receipt.logs.find((log) => {
        if (log.address.toLowerCase() !== contractAddress.toLowerCase()) return false;

        try {
          // Check if it's a Transfer event to our treasury
          const topics = log.topics;
          if (topics[0] !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
            return false; // Not a Transfer event
          }

          // Decode 'to' address from topics[2]
          const toAddress = '0x' + topics[2]?.slice(26);
          return toAddress.toLowerCase() === TREASURY_WALLET.toLowerCase();
        } catch {
          return false;
        }
      });

      if (!transferLog) {
        throw new Error('No valid transfer to treasury found');
      }

      // Decode transfer amount from data
      const transferAmount = BigInt(transferLog.data);
      const fromAddressFromLog = '0x' + transferLog.topics[1]?.slice(26);

      // Verify sender matches
      if (fromAddressFromLog.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new Error('Sender address mismatch');
      }

      // Verify amount (allow 1% tolerance for gas estimation differences)
      const tolerance = expectedAmountWei / 100n;
      if (transferAmount < expectedAmountWei - tolerance) {
        throw new Error(`Insufficient payment: expected ${expectedAmountWei}, got ${transferAmount}`);
      }

      return {
        verified: true,
        from: fromAddressFromLog,
        to: TREASURY_WALLET,
        amount: formatUnits(transferAmount, expectedToken === 'USDC' ? 6 : 18),
        token: expectedToken,
        blockNumber: receipt.blockNumber,
        txHash,
      };
    } catch (error) {
      throw new Error(`Payment verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Watch for incoming payment (with timeout)
   */
  async waitForPayment(
    token: CryptoToken,
    expectedAmount: number,
    fromAddress: string,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<PaymentVerification> {
    const contractAddress = CONTRACTS[token];
    const expectedAmountWei = await this.getPaymentAmountInWei(token, expectedAmount);
    const startBlock = await this.client.getBlockNumber();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Payment timeout - no transaction received'));
      }, timeoutMs);

      // Poll for new blocks and check for transfers
      const pollInterval = setInterval(async () => {
        try {
          const currentBlock = await this.client.getBlockNumber();

          // Get transfer events in recent blocks
          const logs = await this.client.getLogs({
            address: contractAddress,
            event: {
              type: 'event',
              name: 'Transfer',
              inputs: [
                { type: 'address', indexed: true, name: 'from' },
                { type: 'address', indexed: true, name: 'to' },
                { type: 'uint256', indexed: false, name: 'value' },
              ],
            },
            args: {
              from: fromAddress as `0x${string}`,
              to: TREASURY_WALLET,
            },
            fromBlock: startBlock,
            toBlock: currentBlock,
          });

          for (const log of logs) {
            const amount = log.args.value || 0n;
            const tolerance = expectedAmountWei / 100n;

            if (amount >= expectedAmountWei - tolerance) {
              clearInterval(pollInterval);
              clearTimeout(timeout);

              resolve({
                verified: true,
                from: fromAddress,
                to: TREASURY_WALLET,
                amount: formatUnits(amount, token === 'USDC' ? 6 : 18),
                token,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
              });
              return;
            }
          }
        } catch (error) {
          console.error('[CryptoPaymentService] Poll error:', error);
        }
      }, 5000); // Poll every 5 seconds
    });
  }

  /**
   * Generate payment instructions for user
   */
  getPaymentInstructions(token: CryptoToken, amount: number): {
    to: string;
    tokenAddress: string;
    amount: string;
    network: string;
    chainId: number;
  } {
    return {
      to: TREASURY_WALLET,
      tokenAddress: CONTRACTS[token],
      amount: amount.toString(),
      network: 'Base',
      chainId: 8453,
    };
  }

  /**
   * Check if service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Simulate payment for development/testing
   */
  async simulatePayment(
    token: CryptoToken,
    amount: number,
    fromAddress: string
  ): Promise<PaymentVerification> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      verified: true,
      from: fromAddress,
      to: TREASURY_WALLET || '0xSimulatedTreasury',
      amount: amount.toString(),
      token,
      blockNumber: BigInt(Date.now()),
      txHash: `0x${Date.now().toString(16)}${'0'.repeat(48)}`,
    };
  }
}

// Export singleton instance
export const cryptoPaymentService = new CryptoPaymentService();
export default cryptoPaymentService;
