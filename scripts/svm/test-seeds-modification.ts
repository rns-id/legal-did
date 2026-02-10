/**
 * 测试添加 PDA seeds 后的合约功能
 * 
 * 目的：验证修改后的合约在本地仍然正常工作
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Legaldid } from "../../target/types/legaldid";

const NON_TRANSFERABLE_PROJECT_PREFIX = "nt-proj-v5";

async function main() {
  console.log("🧪 测试 PDA Seeds 修改后的合约\n");

  // 设置 provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Legaldid as Program<Legaldid>;
  const authority = provider.wallet.publicKey;

  console.log("📋 测试配置:");
  console.log("  Program ID:", program.programId.toString());
  console.log("  Authority:", authority.toString());
  console.log("");

  // 派生 Project PDA
  const [projectPda, projectBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(NON_TRANSFERABLE_PROJECT_PREFIX)],
    program.programId
  );

  console.log("  Project PDA:", projectPda.toString());
  console.log("  Project Bump:", projectBump);
  console.log("");

  // 测试 1: 查询 Project 账户
  console.log("✅ 测试 1: 查询 Project 账户");
  try {
    const projectAccount = await program.account.projectAccount.fetch(projectPda);
    console.log("  ✓ Project 账户存在");
    console.log("  Authority:", projectAccount.authority.toString());
    console.log("  Operators:", projectAccount.operators.length);
    console.log("  Mint Price:", projectAccount.mintPrice.toString());
    console.log("");
  } catch (error) {
    console.log("  ✗ Project 账户不存在（需要先初始化）");
    console.log("  这是正常的，如果是新部署的程序");
    console.log("");
  }

  // 测试 2: 模拟 SetMintPrice（Admin or Operator）
  console.log("✅ 测试 2: 模拟 SetMintPrice");
  try {
    const newPrice = new anchor.BN(2000000); // 0.002 SOL
    
    const tx = await program.methods
      .setMintPrice(newPrice)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ SetMintPrice 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin/operator）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 3: 模拟 AddOperator（Admin Only）
  console.log("✅ 测试 3: 模拟 AddOperator");
  try {
    const newOperator = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .addOperator(newOperator)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ AddOperator 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("  New Operator:", newOperator.toString());
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 4: 模拟 RemoveOperator（Admin Only）
  console.log("✅ 测试 4: 模拟 RemoveOperator");
  try {
    const operatorToRemove = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .removeOperator(operatorToRemove)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ RemoveOperator 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin）");
    } else if (error.message?.includes("OperatorNotFound")) {
      console.log("  ⚠ Operator 不存在（正常）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 5: 模拟 SetBaseURI（Admin Only）
  console.log("✅ 测试 5: 模拟 SetBaseURI");
  try {
    const newUri = "https://example.com/metadata/";
    
    const tx = await program.methods
      .setBaseUri(newUri)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ SetBaseURI 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 6: 模拟 SetFundDestination（Admin Only）
  console.log("✅ 测试 6: 模拟 SetFundDestination");
  try {
    const newDestination = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .setFundDestination(newDestination)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ SetFundDestination 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 7: 模拟 TransferAuthority（Admin Only）
  console.log("✅ 测试 7: 模拟 TransferAuthority");
  try {
    const newAuthority = Keypair.generate().publicKey;
    
    const tx = await program.methods
      .transferAuthority(newAuthority)
      .accounts({
        authority: authority,
        nonTransferableProject: projectPda,
      })
      .simulate();

    console.log("  ✓ TransferAuthority 模拟成功");
    console.log("  Units Consumed:", tx.unitsConsumed);
    console.log("");
  } catch (error: any) {
    if (error.message?.includes("AccountNotInitialized")) {
      console.log("  ⚠ Project 未初始化（正常）");
    } else if (error.message?.includes("Unauthorized")) {
      console.log("  ⚠ 权限不足（正常，如果不是 admin）");
    } else {
      console.log("  ✗ 错误:", error.message);
    }
    console.log("");
  }

  // 测试 8: 验证 IDL 中的 PDA seeds
  console.log("✅ 测试 8: 验证 IDL 中的 PDA seeds");
  
  const instructionsToCheck = [
    "addOperator",
    "removeOperator",
    "setMintPrice",
    "setBaseUri",
    "setFundDestination",
    "transferAuthority",
  ];

  for (const instructionName of instructionsToCheck) {
    const instruction = program.idl.instructions.find(
      (ix) => ix.name === instructionName
    );

    if (instruction) {
      const projectAccount = instruction.accounts.find(
        (acc: any) => acc.name === "nonTransferableProject"
      );

      if (projectAccount && projectAccount.pda) {
        console.log(`  ✓ ${instructionName}: 有 PDA seeds`);
      } else {
        console.log(`  ✗ ${instructionName}: 没有 PDA seeds`);
      }
    }
  }

  console.log("");
  console.log("🎉 测试完成！");
  console.log("");
  console.log("📝 总结:");
  console.log("  - 如果所有指令都显示 '有 PDA seeds'，说明修改成功");
  console.log("  - 如果模拟失败是因为 'AccountNotInitialized' 或 'Unauthorized'，这是正常的");
  console.log("  - 如果有其他错误，需要检查代码");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  });
