# LegalDID V4 Sepolia 测试网升级记录

**日期**: 2026-01-21

---

## 升级概要

| 项目 | 值 |
|------|-----|
| 网络 | Sepolia (chainId: 11155111) |
| Proxy 地址 | `0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d` |
| 旧 Implementation | `0x010e41B4FD32565FA2dD7886Cfe22FA5b99e2e02` |
| 新 Implementation | `0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9` |
| 部署账户 | `0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722` |

---

## 执行步骤与交易记录

### 步骤 1: 执行升级脚本

**命令**:
```bash
npx hardhat run scripts/evm/upgrade-v4.ts --network sepolia
```

**脚本路径**: `scripts/evm/upgrade-v4.ts`

**脚本执行过程**:
1. 连接 Sepolia 网络
2. 检测到代理合约未在本地注册，执行 `forceImport`
3. 编译并部署新的 LegalDIDV4 Implementation 合约
4. 调用 ProxyAdmin 将 Proxy 指向新 Implementation

**交易 Hash**: 
```
0xbadbe295a427f52173f6b49b18ad5d491ca116c4d4a23f8a108c918429e8a85a
```

**Etherscan 链接**: 
https://sepolia.etherscan.io/tx/0xbadbe295a427f52173f6b49b18ad5d491ca116c4d4a23f8a108c918429e8a85a

**输出结果**:
```
Upgrading with account: 0x464f65Cc4AF7013239c6B79ed8a2FBd87dF91722
Target proxy: 0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d
Current implementation: 0x010e41B4FD32565FA2dD7886Cfe22FA5b99e2e02

Checking if proxy needs to be imported...
Proxy imported successfully

Upgrading to LegalDIDV4...

✅ Upgrade to V4 successful!
Proxy address: 0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d
New implementation: 0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9

Verification - mintPrice: 0.000358037952022914 ETH
```

---

### 步骤 2: 验证合约源码

**命令**:
```bash
npx hardhat verify --network sepolia 0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9
```

**交易 Hash**: 无（链下操作，仅提交源码到 Etherscan API）

**输出结果**:
```
Successfully submitted source code for contract
contracts/LegalDID/LegalDIDV4.sol:LegalDIDV4 at 0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9
for verification on the block explorer. Waiting for verification result...

Successfully verified contract LegalDIDV4 on the block explorer.
https://sepolia.etherscan.io/address/0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9#code
```

**验证后链接**:
https://sepolia.etherscan.io/address/0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9#code

---

### 步骤 3: 验证升级结果

**命令**:
```bash
npx hardhat run scripts/evm/check-impl.ts --network sepolia
```

**脚本路径**: `scripts/evm/check-impl.ts`

**输出结果**:
```
Current implementation: 0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9
AirdropV4 event filter exists: true
mintPrice: 0.000358037952022914 ETH
```

**验证内容**:
- ✅ Implementation 地址已更新
- ✅ V4 新增的 `AirdropV4` 事件存在
- ✅ 历史数据 `mintPrice` 保留完整

---

## 涉及的脚本文件

| 脚本 | 用途 |
|------|------|
| `scripts/evm/upgrade-v4.ts` | 执行升级，支持 forceImport |
| `scripts/evm/check-impl.ts` | 验证升级后的 Implementation |
| `scripts/evm/check-proxy-info.ts` | 查看代理合约详细信息 |

---

## 合约地址汇总

| 合约 | 地址 | Etherscan |
|------|------|-----------|
| Proxy | `0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d` | [查看](https://sepolia.etherscan.io/address/0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d) |
| 新 Implementation (V4) | `0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9` | [查看](https://sepolia.etherscan.io/address/0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9#code) |
| 旧 Implementation | `0x010e41B4FD32565FA2dD7886Cfe22FA5b99e2e02` | [查看](https://sepolia.etherscan.io/address/0x010e41B4FD32565FA2dD7886Cfe22FA5b99e2e02) |

---

## 升级前后对比

| 功能 | 升级前 | 升级后 |
|------|--------|--------|
| `authorizeMint()` | ✅ | ✅ (保留兼容) |
| `airdrop()` | ✅ | ✅ (保留兼容) |
| `authorizeMintV4()` | ❌ | ✅ (新增) |
| `airdropV4()` | ❌ | ✅ (新增) |
| `AirdropV4` 事件 | ❌ | ✅ (新增) |
| `AuthorizeMintV4` 事件 | ❌ | ✅ (新增) |
| 历史数据 | - | ✅ 完整保留 |
