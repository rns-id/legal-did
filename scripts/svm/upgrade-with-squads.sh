#!/bin/bash
# Solana 程序多签升级脚本
# 用于准备通过 Squads 多签升级程序

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROGRAM_ID="${PROGRAM_ID:-8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd}"
SQUADS_VAULT="${SQUADS_VAULT:-wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud}"
NETWORK="${NETWORK:-devnet}"

echo -e "${BLUE}🚀 LegalDID Squads 多签升级准备脚本${NC}"
echo "========================================"
echo ""
echo -e "${YELLOW}配置信息:${NC}"
echo "  Program ID: $PROGRAM_ID"
echo "  Squads Vault: $SQUADS_VAULT"
echo "  Network: $NETWORK"
echo "  当前钱包: $(solana address)"
echo ""

# 检查网络配置
CURRENT_RPC=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo -e "${YELLOW}当前 RPC:${NC} $CURRENT_RPC"

if [[ "$NETWORK" == "devnet" && "$CURRENT_RPC" != *"devnet"* ]]; then
    echo -e "${RED}⚠️  警告: 网络配置不匹配！${NC}"
    read -p "是否切换到 devnet? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        solana config set --url https://api.devnet.solana.com
    else
        echo "已取消"
        exit 1
    fi
fi

# 检查余额
BALANCE=$(solana balance | awk '{print $1}')
echo -e "${YELLOW}当前余额:${NC} $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo -e "${RED}⚠️  余额不足！至少需要 2 SOL${NC}"
    if [[ "$NETWORK" == "devnet" ]]; then
        read -p "是否申请空投? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            solana airdrop 2
        fi
    else
        echo "请先充值 SOL"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}步骤 1/5: 清理旧构建${NC}"
echo "------------------------"
anchor clean
echo "✅ 清理完成"

echo ""
echo -e "${GREEN}步骤 2/5: 构建新版本${NC}"
echo "------------------------"
anchor build

# 检查构建产物
if [ ! -f "target/deploy/legaldid.so" ]; then
    echo -e "${RED}❌ 构建失败: 找不到 legaldid.so${NC}"
    exit 1
fi

PROGRAM_SIZE=$(ls -lh target/deploy/legaldid.so | awk '{print $5}')
echo "✅ 构建成功"
echo "   程序大小: $PROGRAM_SIZE"

echo ""
echo -e "${GREEN}步骤 3/5: 创建 Program Buffer${NC}"
echo "------------------------"
echo "正在上传程序到 Buffer..."

# 创建 Buffer
BUFFER_OUTPUT=$(solana program write-buffer target/deploy/legaldid.so --output json 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Buffer 创建失败${NC}"
    echo "$BUFFER_OUTPUT"
    exit 1
fi

# 提取 Buffer 地址
BUFFER_ADDRESS=$(echo "$BUFFER_OUTPUT" | grep -o '"buffer":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BUFFER_ADDRESS" ]; then
    # 尝试另一种方式提取
    BUFFER_ADDRESS=$(echo "$BUFFER_OUTPUT" | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -1)
fi

if [ -z "$BUFFER_ADDRESS" ]; then
    echo -e "${RED}❌ 无法获取 Buffer 地址${NC}"
    echo "$BUFFER_OUTPUT"
    exit 1
fi

echo "✅ Buffer 创建成功"
echo "   Buffer 地址: $BUFFER_ADDRESS"

echo ""
echo -e "${GREEN}步骤 4/5: 设置 Buffer Authority${NC}"
echo "------------------------"
echo "将 Buffer Authority 设置为 Squads Vault..."

solana program set-buffer-authority $BUFFER_ADDRESS --new-buffer-authority $SQUADS_VAULT

if [ $? -eq 0 ]; then
    echo "✅ Buffer Authority 已设置为 Squads Vault"
else
    echo -e "${RED}❌ 设置 Buffer Authority 失败${NC}"
    echo -e "${YELLOW}提示: Buffer 仍然可用，但需要在 Squads 提案中手动处理权限${NC}"
fi

echo ""
echo -e "${GREEN}步骤 5/5: 验证配置${NC}"
echo "------------------------"

# 验证 Program Upgrade Authority
PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)
UPGRADE_AUTH=$(echo "$PROGRAM_INFO" | grep "Authority" | awk '{print $2}')

echo "Program Upgrade Authority: $UPGRADE_AUTH"

if [ "$UPGRADE_AUTH" == "$SQUADS_VAULT" ]; then
    echo "✅ Program Upgrade Authority 正确"
else
    echo -e "${YELLOW}⚠️  Program Upgrade Authority 不是 Squads Vault${NC}"
    echo "   当前: $UPGRADE_AUTH"
    echo "   期望: $SQUADS_VAULT"
fi

# 验证 Buffer
BUFFER_INFO=$(solana program show $BUFFER_ADDRESS 2>&1)
echo ""
echo "Buffer 信息:"
echo "$BUFFER_INFO" | grep -E "Address|Authority|Length"

echo ""
echo "========================================"
echo -e "${GREEN}✅ 准备工作完成！${NC}"
echo ""
echo -e "${BLUE}📋 下一步操作指南:${NC}"
echo ""
echo "1️⃣  访问 Squads 界面:"
if [ "$NETWORK" == "devnet" ]; then
    echo "   🔗 https://devnet.squads.so/"
else
    echo "   🔗 https://squads.so/"
fi
echo ""
echo "2️⃣  创建升级提案，使用以下信息:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Transaction Type: Program Upgrade"
echo "   Program ID: $PROGRAM_ID"
echo "   Buffer Address: $BUFFER_ADDRESS"
echo "   Spill Account: $(solana address)"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "3️⃣  等待多签成员投票并执行提案"
echo ""
echo "4️⃣  升级完成后验证:"
echo "   solana program show $PROGRAM_ID"
echo ""
echo "🔗 相关链接:"
echo "   Buffer: https://explorer.solana.com/address/$BUFFER_ADDRESS?cluster=$NETWORK"
echo "   Program: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$NETWORK"
echo ""

# 保存信息到文件
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
INFO_FILE="upgrade-info-$TIMESTAMP.txt"

cat > $INFO_FILE << EOF
LegalDID Squads 升级信息
========================
生成时间: $(date)
网络: $NETWORK
操作者: $(solana address)

配置信息:
---------
Program ID: $PROGRAM_ID
Squads Vault: $SQUADS_VAULT
Buffer Address: $BUFFER_ADDRESS
Spill Account: $(solana address)

浏览器链接:
-----------
Buffer: https://explorer.solana.com/address/$BUFFER_ADDRESS?cluster=$NETWORK
Program: https://explorer.solana.com/address/$PROGRAM_ID?cluster=$NETWORK
Squads: https://$NETWORK.squads.so/

验证命令:
---------
solana program show $PROGRAM_ID
solana program show $BUFFER_ADDRESS

下一步:
-------
1. 访问 Squads 界面创建升级提案
2. 使用上述 Buffer Address 和 Program ID
3. 等待多签成员投票
4. 执行提案
5. 验证升级结果
EOF

echo -e "${GREEN}✅ 升级信息已保存到: $INFO_FILE${NC}"
echo ""
