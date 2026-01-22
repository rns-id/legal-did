/**
 * 使用 Jupiter API 将 USDC 兑换为 SOL
 */
import {
  Connection,
  Keypair,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

// USDC Mint (Mainnet)
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Native SOL (wrapped)
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function main() {
  const privateKey = process.env.SOLANA_MAINNET_KEY;
  if (!privateKey) {
    throw new Error("SOLANA_MAINNET_KEY not found in .env");
  }

  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  const walletAddress = keypair.publicKey.toString();
  console.log("Wallet:", walletAddress);

  const connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );

  // 7.91 USDC = 7910045 (6 decimals)
  const amountIn = 7910045;
  console.log(`\nSwapping ${amountIn / 1e6} USDC to SOL...`);

  // Step 1: Get quote from Jupiter
  console.log("\n1. Getting quote from Jupiter...");
  const quoteUrl = `https://public.jupiterapi.com/quote?inputMint=${USDC_MINT}&outputMint=${SOL_MINT}&amount=${amountIn}&slippageBps=50`;

  const quoteResponse = await fetch(quoteUrl);
  const quoteData = await quoteResponse.json() as any;

  if (quoteData.error) {
    throw new Error(`Quote error: ${quoteData.error}`);
  }

  const outAmount = parseInt(quoteData.outAmount) / 1e9;
  console.log(`   Quote: ${amountIn / 1e6} USDC -> ${outAmount.toFixed(6)} SOL`);
  console.log(`   Price impact: ${quoteData.priceImpactPct}%`);

  // Step 2: Get swap transaction
  console.log("\n2. Getting swap transaction...");
  const swapResponse = await fetch("https://public.jupiterapi.com/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quoteData,
      userPublicKey: walletAddress,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  const swapData = await swapResponse.json() as any;

  if (swapData.error) {
    throw new Error(`Swap error: ${swapData.error}`);
  }

  // Step 3: Sign and send transaction
  console.log("\n3. Signing and sending transaction...");
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, "base64");
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  transaction.sign([keypair]);

  const txid = await connection.sendTransaction(transaction, {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`   Transaction sent: ${txid}`);
  console.log(
    `   Explorer: https://explorer.solana.com/tx/${txid}`
  );

  // Step 4: Confirm transaction
  console.log("\n4. Waiting for confirmation...");
  const confirmation = await connection.confirmTransaction(txid, "confirmed");

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log("\n✅ Swap completed successfully!");
  console.log(`   Swapped: ${amountIn / 1e6} USDC -> ~${outAmount.toFixed(6)} SOL`);

  // Check new balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`   New SOL balance: ${balance / 1e9} SOL`);
}

main().catch(console.error);
