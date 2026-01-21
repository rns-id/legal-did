# LegalDID V4 主网升级指南

## 概述

本文档描述如何将 LegalDID 合约从当前版本升级到 V4。

## 前置条件

1. 确保 `.env` 文件配置正确：
   ```
   PRIVATE_KEY=<主网部署账户私钥，不带0x前缀>
   MAINNET_RPC_URL=<主网RPC地址>
   ETHERSCAN_API_KEY=<Etherscan API Key>
   ```

2. 确保部署账户是 ProxyAdmin 的 owner（有权限升级合约）

3. 确保账户有足够的 ETH 支付 gas 费用

---

## 升级步骤

### 第一步：设置主网代理地址

修改 `scripts/evm/upgrade-v4.ts` 中的默认地址为主网代理地址：

```typescript
const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "<主网Proxy地址>";
```

或者通过环境变量指定：
```bash
export PROXY_ADDRESS=<主网Proxy地址>
```

---

### 第二步：执行升级脚本

```bash
npx hardhat run scripts/evm/upgrade-v4.ts --network mainnet
```

**脚本做了什么：**

1. **forceImport（如需要）**
   - 检查代理合约是否已在本地 `.openzeppelin/mainnet.json` 注册
   - 如果未注册，使用 `upgrades.forceImport()` 将已部署的代理合约导入到本地管理
   - **为什么**：OpenZeppelin 插件需要知道代理合约的存储布局，才能验证升级是否安全

2. **部署新 Implementation**
   - 编译并部署 `LegalDIDV4` 合约到链上
   - 新合约地址会自动生成

3. **调用 ProxyAdmin.upgrade()**
   - 通过 ProxyAdmin 合约将 Proxy 指向新的 Implementation
   - 这是一个链上交易，需要 gas

4. **验证升级结果**
   - 读取 `mintPrice` 确认合约可正常调用

---

### 第三步：验证合约源码

升级成功后，验证新 Implementation 合约：

```bash
npx hardhat verify --network mainnet <新Implementation地址>
```

**为什么要验证：**
- 让用户可以在 Etherscan 上查看合约源码
- 增加透明度和信任度
- 方便后续调试和审计

---

## 完整命令汇总

```bash
# 1. 升级合约
PROXY_ADDRESS=<主网Proxy地址> npx hardhat run scripts/evm/upgrade-v4.ts --network mainnet

# 2. 验证合约（使用升级脚本输出的新Implementation地址）
npx hardhat verify --network mainnet <新Implementation地址>

# 3. （可选）查看代理合约信息
PROXY_ADDRESS=<主网Proxy地址> npx hardhat run scripts/evm/check-proxy-info.ts --network mainnet
```

---

## 升级原理说明

### 透明代理模式 (Transparent Proxy Pattern)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   用户/前端      │────▶│   Proxy 合约    │────▶│ Implementation  │
│                 │     │  (地址不变)      │     │   (可更换)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               │ 升级时调用
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │   ProxyAdmin    │
                        │  (管理升级权限)   │
                        └─────────────────┘
```

- **Proxy 合约**：用户交互的入口，地址永远不变，存储所有状态数据
- **Implementation 合约**：包含业务逻辑代码，升级时替换
- **ProxyAdmin 合约**：管理升级权限，只有 owner 可以升级

### 为什么需要 forceImport？

当代理合约不是由当前项目部署时，本地 `.openzeppelin/<network>.json` 没有记录。
`forceImport` 的作用是：
1. 告诉 OpenZeppelin 插件"这个代理合约是合法的"
2. 记录当前 Implementation 的存储布局
3. 后续升级时可以验证存储布局兼容性，防止数据损坏

---

## 回滚方案

如果升级后发现问题，可以回滚到旧版本：

```bash
# 使用旧的 Implementation 地址
npx hardhat run scripts/evm/rollback.ts --network mainnet
```

**注意**：回滚前需要创建 `rollback.ts` 脚本，指定旧 Implementation 地址。

---

## 测试网验证记录

| 项目 | 值 |
|------|-----|
| 网络 | Sepolia |
| Proxy | `0x6e008797d8a7f3ed706d1a69f1fba713e74eb96d` |
| 旧 Implementation | `0x010e41B4FD32565FA2dD7886Cfe22FA5b99e2e02` |
| 新 Implementation | `0x4fa0b388F2776f2BC24A61Fb8Ef7E639EC87d5B9` |
| 升级交易 | `0xbadbe295a427f52173f6b49b18ad5d491ca116c4d4a23f8a108c918429e8a85a` |
| 验证状态 | ✅ 已验证 |

---

## 注意事项

1. **备份私钥**：确保私钥安全，不要泄露
2. **Gas 预估**：主网 gas 费用较高，建议在 gas 价格较低时操作
3. **双重确认**：升级前再次确认 Proxy 地址正确
4. **监控交易**：升级交易提交后，在 Etherscan 监控确认状态
5. **通知相关方**：升级前通知前后端团队，升级期间可能短暂影响服务
