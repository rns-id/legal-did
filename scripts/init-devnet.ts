import { Program, AnchorProvider, Wallet, web3 } from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

const {
  Connection,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
} = web3;

// 配置 - 更新为新的程序 ID
const PROGRAM_ID = new PublicKey(
  "JCo8dShYwHu74UpBTmwUcoEcGgWZQWnoTCvFaqjGJ6fc"
);
const RPC_URL = "https://api.devnet.solana.com";

// PDA 计算函数 (v5 版本 - 带 Collection + Metadata)
function findNonTransferableProject(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-proj-v5")],
    PROGRAM_ID
  );
  return pda;
}

function getProjectMintAddress(): web3.PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("nt-project-mint-v5")],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  console.log("========================================");
  console.log("RNS DID Devnet 初始化脚本 (Token-2022 v5 + Collection + Metadata)");
  console.log("========================================\n");

  // 加载钱包
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const adminWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));

  console.log("Admin 钱包:", adminWallet.publicKey.toBase58());

  // 连接
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new Wallet(adminWallet);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // 加载 IDL
  const idlPath = "./target/idl/rnsdid_core.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl, provider);

  // 计算所有 PDA
  const nonTransferableProject = findNonTransferableProject();
  const nonTransferableProjectMint = getProjectMintAddress();

  console.log("\nPDA 地址:");
  console.log("  Project:", nonTransferableProject.toBase58());
  console.log("  Project Mint (Token-2022):", nonTransferableProjectMint.toBase58());
  console.log("");

  // 检查项目是否已初始化
  const projectInfo = await connection.getAccountInfo(nonTransferableProject);
  if (projectInfo) {
    console.log("✅ 项目已经初始化过了！");

    // 显示项目信息
    try {
      const projectData = await (program.account as any).projectAccount.fetch(
        nonTransferableProject
      );
      console.log("\n项目信息:");
      console.log("  Name:", projectData.name);
      console.log("  Symbol:", projectData.symbol);
      console.log("  Base URI:", projectData.baseUri);
      console.log("  Authority:", projectData.authority.toBase58());
    } catch (e) {
      console.log("无法读取项目数据");
    }
    return;
  }

  console.log("正在初始化项目 (Token-2022)...");

  try {
    const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    const domain = "https://api.rns.id/";

    const tx = await program.methods
      .initialize({
        name: "Legal DID",
        symbol: "LDID",
        baseUri: `${domain}api/v2/portal/identity/nft/`,
      })
      .accounts({
        authority: adminWallet.publicKey,
        nonTransferableProject: nonTransferableProject,
        nonTransferableProjectMint: nonTransferableProjectMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .preInstructions([setComputeUnitLimitIx])
      .signers([adminWallet])
      .rpc();

    console.log("\n✅ 初始化成功！");
    console.log("交易签名:", tx);
    console.log(
      `\n查看交易: https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
  } catch (error) {
    console.error("\n❌ 初始化失败:", error);
    throw error;
  }
}

main().catch(console.error);
