#!/bin/bash
# 转移 Solana 程序的 Upgrade Authority 到 Squads 多签钱包

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROGRAM_ID="BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa"
SQUADS_VAULT="wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud"
NETWORK="devnet"

echo -e "${BLUE}🔐 转移 Program Upgrade Authority 到 Squads 多签${NC}"
echo "========================================"
echo ""
echo -e "${YELLOW}配置信息:${NC}"
echo "  Program ID: $PROGRAM_ID"
echo "  当前 Authority: $(solana address)"
echo "  新 Authority (Squads): $SQUADS_VAULT"
echo "  Network: $NETWORK"
echo ""

# 确认网络
CURRENT_RPC=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo -e "${YELLOW}当前 RPC:${NC} $CURRENT_RPC"

if [[ "$CURRENT_RPC" != *"devnet"* ]]; then
    echo -e "${RED}⚠️  警告: 当前不在 devnet！${NC}"
    read -p "是否切换到 devnet? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        solana config set --url https://api.devnet.solana.com
    else
        echo "已取消"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}步骤 1: 检查当前程序状态${NC}"
echo "------------------------"

PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 无法获取程序信息${NC}"
    echo "$PROGRAM_INFO"
    exit 1
fi

echo "$PROGRAM_INFO"
echo ""

# 提取当前 Authority
CURRENT_AUTH=$(echo "$PROGRAM_INFO" | grep "Authority" | awk '{print $2}')
MY_ADDRESS=$(solana address)

echo -e "${YELLOW}验证权限:${NC}"
echo "  当前 Authority: $CURRENT_AUTH"
echo "  我的地址: $MY_ADDRESS"

if [ "$CURRENT_AUTH" != "$MY_ADDRESS" ]; then
    echo -e "${RED}❌ 错误: 你不是当前的 Upgrade Authority！${NC}"
    echo "   当前 Authority: $CURRENT_AUTH"
    echo "   你的地址: $MY_ADDRESS"
    exit 1
fi

echo -e "${GREEN}✅ 权限验证通过${NC}"
echo ""

# 最后确认
echo -e "${RED}⚠️  重要警告 ⚠️${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "你即将把程序的 Upgrade Authority 转移给 Squads 多签钱包。"
echo ""
echo "转移后："
echo "  ✓ 只有多签成员投票通过才能升级程序"
echo "  ✓ 提高了安全性"
echo "  ✗ 你将无法单独升级程序"
echo "  ✗ 此操作不可逆（除非多签再转回来）"
echo ""
echo "目标多签钱包: $SQUADS_VAULT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "确认要继续吗? 输入 'YES' 继续: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
    echo "已取消操作"
    exit 0
fi

echo ""
echo -e "${GREEN}步骤 2: 转移 Upgrade Authority${NC}"
echo "------------------------"

echo "正在执行转移..."

# 执行转移（跳过新 authority 签名检查，因为是多签钱包）
TX_RESULT=$(solana program set-upgrade-authority $PROGRAM_ID \
    --new-upgrade-authority $SQUADS_VAULT \
    --skip-new-upgrade-authority-signer-check 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 转移成功！${NC}"
    echo ""
    
    # 提取交易签名
    TX_SIG=$(echo "$TX_RESULT" | grep -oE '[1-9A-HJ-NP-Za-km-z]{87,88}' | head -1)
    
    if [ ! -z "$TX_SIG" ]; then
        echo "交易签名: $TX_SIG"
        echo "浏览器: https://explorer.solana.com/tx/$TX_SIG?cluster=devnet"
    fi
else
    echo -e "${RED}❌ 转移失败${NC}"
    echo "$TX_RESULT"
    exit 1
fi

echo ""
echo -e "${GREEN}步骤 3: 验证转移结果${NC}"
echo "------------------------"

sleep 3  # 等待交易确认

NEW_PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)
NEW_AUTH=$(echo "$NEW_PROGRAM_INFO" | grep "Authority" | awk '{print $2}')

echo "新的 Upgrade Authority: $NEW_AUTH"

if [ "$NEW_AUTH" == "$SQUADS_VAULT" ]; then
    echo -e "${GREEN}✅ 验证成功！Authority 已正确转移到 Squads 多签${NC}"
else
    echo -e "${RED}❌ 验证失败！Authority 不是预期的地址${NC}"
    echo "   当前: $NEW_AUTH"
    echo "   期望: $SQUADS_VAULT"
    exit 1
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ 转移完成！${NC}"
echo ""
echo -e "${BLUE}📋 重要信息:${NC}"
echo ""
echo "1️⃣  Program ID: $PROGRAM_ID"
echo "2️⃣  新 Upgrade Authority: $SQUADS_VAULT"
echo "3️⃣  Squads 界面: https://devnet.squads.so/"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo ""
echo "• 升级程序时，使用以下流程："
echo "  1. 运行: ./scripts/svm/upgrade-with-squads.sh"
echo "  2. 在 Squads 界面创建升级提案"
echo "  3. 多签成员投票"
echo "  4. 执行升级"
echo ""
echo "• 查看详细文档:"
echo "  docs/deployment/多签升级操作指南.md"
echo "  docs/deployment/SQUADS_MULTISIG_UPGRADE_GUIDE.md"
echo ""
echo "🔗 相关链接:"
echo "  Program: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "  Squads: https://devnet.squads.so/"
echo ""

# 保存转移记录
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RECORD_FILE="upgrade-authority-transfer-$TIMESTAMP.txt"

cat > $RECORD_FILE << EOF
Program Upgrade Authority 转移记录
==================================
转移时间: $(date)
网络: $NETWORK

程序信息:
---------
Program ID: $PROGRAM_ID
旧 Authority: $MY_ADDRESS
新 Authority: $SQUADS_VAULT

交易信息:
---------
$(if [ ! -z "$TX_SIG" ]; then echo "交易签名: $TX_SIG"; fi)
$(if [ ! -z "$TX_SIG" ]; then echo "浏览器: https://explorer.solana.com/tx/$TX_SIG?cluster=devnet"; fi)

验证信息:
---------
$NEW_PROGRAM_INFO

下一步:
-------
1. 升级程序时使用 Squads 多签流程
2. 运行 ./scripts/svm/upgrade-with-squads.sh 准备升级
3. 在 https://devnet.squads.so/ 创建提案
4. 查看文档: docs/deployment/多签升级操作指南.md
EOF

echo -e "${GREEN}✅ 转移记录已保存到: $RECORD_FILE${NC}"
echo ""
