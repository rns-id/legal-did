import { ethers, upgrades } from "hardhat";

async function main() {
  const proxy = '0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d';
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log('Current implementation:', impl);
  
  // 检查合约是否有 V4 的方法
  const contract = await ethers.getContractAt('LegalDIDV4', proxy);
  
  // 测试 V4 特有的事件/方法是否存在
  const filter = contract.filters.AirdropV4;
  console.log('AirdropV4 event filter exists:', !!filter);
  
  // 获取 mintPrice
  const mintPrice = await contract.mintPrice();
  console.log('mintPrice:', ethers.formatEther(mintPrice), 'ETH');
}

main().catch(console.error);
