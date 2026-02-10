/**
 * 验证 PDA 地址在修改前后保持不变
 * 
 * 这个脚本证明：添加 PDA seeds 不会改变任何地址
 */

import { PublicKey } from "@solana/web3.js";

const NON_TRANSFERABLE_PROJECT_PREFIX = "nt-proj-v5";

// Devnet 上的实际地址
const PROGRAM_ID = new PublicKey("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa");
const EXPECTED_PROJECT_PDA = new PublicKey("GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o");

console.log("🔍 验证 PDA 地址是否改变\n");

console.log("📋 配置:");
console.log("  Program ID:", PROGRAM_ID.toString());
console.log("  Seeds:", NON_TRANSFERABLE_PROJECT_PREFIX);
console.log("  预期 PDA:", EXPECTED_PROJECT_PDA.toString());
console.log("");

// 派生 PDA（使用相同的 seeds）
const [derivedPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from(NON_TRANSFERABLE_PROJECT_PREFIX)],
  PROGRAM_ID
);

console.log("🧮 派生结果:");
console.log("  派生 PDA:", derivedPda.toString());
console.log("  Bump:", bump);
console.log("");

// 比较
if (derivedPda.equals(EXPECTED_PROJECT_PDA)) {
  console.log("✅ 验证成功！");
  console.log("");
  console.log("📊 结论:");
  console.log("  ✅ PDA 地址完全相同");
  console.log("  ✅ 添加 seeds 不会改变地址");
  console.log("  ✅ 完全向后兼容");
  console.log("");
  console.log("🎯 原因:");
  console.log("  - PDA 派生公式: hash(seeds + program_id)");
  console.log("  - Seeds 没有改变: 'nt-proj-v5'");
  console.log("  - Program ID 没有改变");
  console.log("  - 所以 PDA 也不会改变");
  console.log("");
  process.exit(0);
} else {
  console.log("❌ 验证失败！");
  console.log("");
  console.log("预期:", EXPECTED_PROJECT_PDA.toString());
  console.log("实际:", derivedPda.toString());
  console.log("");
  console.log("这不应该发生！请检查代码。");
  console.log("");
  process.exit(1);
}
