# Squads 多签治理 — 已完成操作报告

## 概述

LegalDID 合约（Devnet）的升级权限已从个人钱包转移至 Squads 多签钱包，并通过多签完成了合约升级和管理员操作。
Squads 是 Solana 生态最主流的多签方案，Jupiter、Pyth、Drift、Jito 等 450+ 团队在使用，管理超过 150 亿美元资产。

## 关键地址

| 名称 | 地址 |
|------|------|
| 合约 Program ID | `BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa` |
| Squads 多签 Vault | `wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud` |
| Project PDA | `GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o` |

---

## 已完成操作一：通过多签升级合约

**目的：** 为所有管理员指令添加 PDA seeds，使 Squads UI 能正确解析账户地址。

**操作流程：**

1. 本地修改合约代码，为 7 个管理员 Context 添加 PDA seeds
2. `anchor build` 编译新版本
3. `solana program write-buffer` 上传 buffer
4. `solana program set-buffer-authority` 将 buffer 权限转给多签
5. 通过脚本直接发送 `ExtendProgram` 指令扩展 ProgramData 空间（该指令无需升级权限，任何人可付费执行）
6. 在 Squads UI → Developers → Programs → Add Upgrade 创建升级提案
7. 多签成员投票批准并执行

**验证结果：**
- 合约二进制已更新（Last Deployed Slot 已变更）
- 链上 IDL 已同步更新，12 个指令全部包含 PDA seeds
- 升级权限仍为多签地址，未发生变更

---

## 已完成操作二：通过多签执行 withdraw

**目的：** 验证多签能正常调用合约的提取资金功能。

**操作流程：**

1. 在 Squads UI → Developers → TX Builder → Create transaction
2. 选择 Anchor IDL 模式，选择 `withdraw` 指令（该指令原本就有 PDA seeds，Squads 可正确解析）
3. 填写账户信息，模拟成功
4. Initiate Transaction → 多签成员投票 → 执行

**验证结果：** 合约中的资金成功提取到指定目标地址。

---

## 已完成操作三：通过多签执行 removeOperator

**目的：** 验证升级后的合约能通过多签正常执行管理员操作。

**操作流程：**

1. 运行交易生成脚本：
   ```bash
   npx ts-node scripts/svm/squads-tx-generator.ts removeOperator GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo
   ```
2. 脚本输出一段 base58 编码的交易字符串
3. 在 Squads UI → Developers → TX Builder → Create transaction
4. 选择 **"Import a base58 encoded transaction"**
5. 粘贴 base58 字符串 → Next → Add Instruction
6. Save draft → Run Simulation（模拟成功）
7. Initiate Transaction → 多签成员投票 → 执行

**验证结果：**
- Operator `GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo` 已成功移除
- 当前 Operator 列表从 2 个变为 1 个

---

## 日常管理员操作方式

所有管理员操作统一使用交易生成脚本 + Squads base58 导入模式：

```bash
# 移除 operator
npx ts-node scripts/svm/squads-tx-generator.ts removeOperator <地址>

# 添加 operator
npx ts-node scripts/svm/squads-tx-generator.ts addOperator <地址>

# 设置 mint 价格（单位 lamports，1 SOL = 1000000000）
npx ts-node scripts/svm/squads-tx-generator.ts setMintPrice <数量>

# 设置 base URI
npx ts-node scripts/svm/squads-tx-generator.ts setBaseUri <URI>

# 设置费用接收地址
npx ts-node scripts/svm/squads-tx-generator.ts setFeeRecipient <地址>

# 设置资金目标地址
npx ts-node scripts/svm/squads-tx-generator.ts setFundDestination <地址>

# 转移管理员权限
npx ts-node scripts/svm/squads-tx-generator.ts transferAuthority <新管理员地址>
```

生成后在 Squads TX Builder 中导入 base58 → 模拟 → 发起 → 投票 → 执行。

---

## 为什么使用 base58 导入而非 IDL 模式

Squads UI 的 Anchor IDL 模式在计算指令 discriminator 时存在 bug（将 snake_case 指令名转为 camelCase 后再计算哈希），导致链上程序无法识别指令。通过 base58 导入方式，指令数据由我们的脚本正确构造，绕过了该问题。

---

## Squads 权限说明

Squads v4 支持三种成员角色（需 Business 计划）：

| 角色 | 权限 |
|------|------|
| Proposer | 只能创建提案，不能投票和执行 |
| Voter | 只能投票，不能创建和执行 |
| Executor | 只能执行已通过的提案 |

可为开发人员分配 Proposer 权限，确保操作需经审批后才能执行。

---

## 职责分工：老板 vs 开发者

### 开发者负责（无需多签权限）

| 操作 | 说明 |
|------|------|
| 修改合约代码 & 编译 | `anchor build`，本地开发 |
| 上传 buffer | `solana program write-buffer`，用开发者钱包付 gas |
| 转移 buffer 权限给多签 | `solana program set-buffer-authority`，一次性操作 |
| 扩展 ProgramData 空间 | `ExtendProgram` 是 permissionless 的，任何人可付费执行 |
| 生成 base58 交易 | 运行 `squads-tx-generator.ts` 脚本，生成操作指令 |
| 更新链上 IDL | `anchor idl upgrade`，用开发者钱包（IDL authority） |
| 在 Squads 创建提案 | 导入 base58 → 模拟 → Initiate Transaction（需 Proposer 权限） |

以上操作不涉及合约管理员权限，开发者可独立完成。

### 老板负责（需多签 Voter 权限）

| 操作 | 说明 |
|------|------|
| 审核提案内容 | 在 Squads UI 查看提案详情，确认操作是否正确 |
| 投票批准 | 点击 Approve，用自己的钱包签名 |
| 执行提案 | 达到阈值后点击 Execute（需 Executor 权限） |

所有涉及合约状态变更的操作（升级、改 operator、改价格等），最终都必须经过老板投票批准才能生效。

### 典型协作流程

```
开发者                              老板
  │                                  │
  ├─ 1. 编译合约 / 上传 buffer        │
  ├─ 2. 生成 base58 交易             │
  ├─ 3. 导入 Squads 创建提案 ────────→│
  │                                  ├─ 4. 审核提案内容
  │                                  ├─ 5. 投票批准（Approve）
  │                                  ├─ 6. 执行（Execute）
  │                                  │
  └─ 7. 验证链上状态                  │
```

开发者准备一切，老板只需在 Squads UI 上审核、点批准、点执行。
