import { ethers } from "hardhat";

async function main() {
  const PROXY = "0xb365e53b64655476e3c3b7a3e225d8bf2e95f71d";
  
  console.log("========================================");
  console.log("EVM 主网 LegalDID 合约参数查询");
  console.log("========================================\n");
  
  // 使用 LegalDID ABI 连接合约
  const contract = await ethers.getContractAt("LegalDID", PROXY);
  
  try {
    const name = await contract.name();
    console.log("name:", name);
  } catch (e) {
    console.log("name: 查询失败");
  }
  
  try {
    const symbol = await contract.symbol();
    console.log("symbol:", symbol);
  } catch (e) {
    console.log("symbol: 查询失败");
  }
  
  try {
    // 尝试不同的方法名
    let baseUri;
    try {
      baseUri = await contract.baseURI();
    } catch {
      try {
        baseUri = await (contract as any).baseTokenURI();
      } catch {
        try {
          baseUri = await (contract as any)._baseURI();
        } catch {
          baseUri = "无法获取";
        }
      }
    }
    console.log("baseURI:", baseUri);
  } catch (e) {
    console.log("baseURI: 查询失败");
  }
  
  // 查询一个已铸造的 NFT 的 tokenURI 来推断 baseURI
  try {
    // 尝试获取 tokenURI of token 1
    const tokenUri = await contract.tokenURI(1);
    console.log("tokenURI(1):", tokenUri);
  } catch (e) {
    console.log("tokenURI(1): 查询失败或不存在");
  }
  
  console.log("\n合约地址:", PROXY);
  console.log("Etherscan:", `https://etherscan.io/address/${PROXY}`);
}

main().catch(console.error);
