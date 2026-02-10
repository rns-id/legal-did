# Squads 多签管理员操作指南

## 背景

LegalDID 合约的管理员权限已转移到 Squads 多签钱包。所有管理员操作需要通过 Squads 多签执行。

由于 Squads UI 的 Anchor IDL 模式存在 discriminator 计算 bug（camelCase vs snake_case），**不能使用 "Anchor programs (with IDL)" 模式**，需要使用 **"Import base58 encoded transaction"** 模式。

## 关键地址（Devnet）

| 名称 | 地址 |
|------|------|
| Program ID | `BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa` |
| Squads Multisig Vault | `wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud` |
| Project PDA | `GLdsotriCs2HcxoSNcqA3pp35QuKZi3PGuKQcdiUzP5o` |

## 操作流程

### 第一步：生成 base58 交易

```bash
npx ts-node scripts/svm/squads-tx-generator.ts <command> [args...]
```

支持的命令：

| 命令 | 说明 | 示例 |
|------|------|------|
| `removeOperator <pubkey>` | 移除 operator | `removeOperator GwZX...FzRo` |
| `addOperator <pubkey>` | 添加 operator | `addOperator GwZX...FzRo` |
| `setMintPrice <lamports>` | 设置 mint 价格 | `setMintPrice 100000` |
| `setBaseUri <uri>` | 设置 base URI | `setBaseUri https://api.example.com/` |
| `setFeeRecipient <pubkey>` | 设置费用接收地址 | `setFeeRecipient 8bsJ...p3gd` |
| `setFundDestination <pubkey>` | 设置资金目标地址 | `setFundDestination 8bsJ...p3gd` |
| `transferAuthority <pubkey>` | 转移管理员权限 | `transferAuthority NEW_ADMIN` |

### 第二步：在 Squads UI 导入并执行

1. 打开 https://devnet.squads.so/
2. 进入 **Developers → TX Builder → Create transaction**
3. 选择 **"Import a base58 encoded transaction"**
4. 粘贴脚本输出的 base58 字符串
5. 点击 **Next → Add Instruction**
6. 点击 **Save draft**
7. 点击 **Run Simulation** 验证（应显示 Successful）
8. 点击 **Initiate Transaction**
9. 多签成员投票批准
10. 执行交易

## 示例

### 移除 Operator

```bash
npx ts-node scripts/svm/squads-tx-generator.ts removeOperator GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo
```

### 添加 Operator

```bash
npx ts-node scripts/svm/squads-tx-generator.ts addOperator GwZXPRhkXF3iMQ3CKpvzqLukBC9bMZ1qfYW4kKF8FzRo
```

### 设置 Mint 价格（0.001 SOL = 1000000 lamports）

```bash
npx ts-node scripts/svm/squads-tx-generator.ts setMintPrice 1000000
```

## 注意事项

- base58 交易中的 blockhash 有时效性，生成后尽快使用
- 如果 Squads 提示 blockhash 过期，重新运行脚本生成新的即可
- 模拟成功不代表执行一定成功，但基本可以确认指令构造正确
- `withdraw` 指令涉及额外账户，暂不支持通过此脚本生成
