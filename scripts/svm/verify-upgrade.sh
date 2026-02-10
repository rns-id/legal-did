#!/bin/bash
# 验证 Solana 程序升级结果

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROGRAM_ID="${1:-8bsJcfGRyFWUEzS4bQfADTVBjReUm3YH89x1QY1qp3gd}"
NETWORK="${2:-devnet}"

echo -e "${BLUE}🔍 LegalDID 程序升级验证${NC}"
echo "========================================"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Network: $NETWORK"
echo ""

# 设置网络
if [ "$NETWORK" == "devnet" ]; then
    RPC_URL="https://api.devnet.solana.com"
    EXPLORER_URL="https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
elif [ "$NETWORK" == "mainnet" ]; then
    RPC_URL="https://api.mainnet-beta.solana.com"
    EXPLORER_URL="https://explorer.solana.com/address/$PROGRAM_ID"
else
    echo -e "${RED}❌ 无效的网络: $NETWORK${NC}"
    exit 1
fi

solana config set --url $RPC_URL > /dev/null 2>&1

echo -e "${GREEN}1. 检查程序状态${NC}"
echo "------------------------"

PROGRAM_INFO=$(solana program show $PROGRAM_ID 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 无法获取程序信息${NC}"
    echo "$PROGRAM_INFO"
    exit 1
fi

echo "$PROGRAM_INFO"
echo ""

# 提取关键信息
UPGRADE_AUTH=$(echo "$PROGRAM_INFO" | grep "Authority" | awk '{print $2}')
LAST_SLOT=$(echo "$PROGRAM_INFO" | grep "Last Deployed In Slot" | awk '{print $5}')
DATA_LENGTH=$(echo "$PROGRAM_INFO" | grep "Data Length" | awk '{print $3}')

echo -e "${GREEN}2. 验证权限配置${NC}"
echo "------------------------"
echo "Upgrade Authority: $UPGRADE_AUTH"

EXPECTED_VAULT="wkxCmw6rzM8xeUNhzPhWtWCwp6VoE4S81ymNDhqMWud"
if [ "$UPGRADE_AUTH" == "$EXPECTED_VAULT" ]; then
    echo -e "${GREEN}✅ Upgrade Authority 正确 (Squads Vault)${NC}"
else
    echo -e "${YELLOW}⚠️  Upgrade Authority 不是预期的 Squads Vault${NC}"
    echo "   当前: $UPGRADE_AUTH"
    echo "   期望: $EXPECTED_VAULT"
fi

echo ""
echo -e "${GREEN}3. 检查程序大小${NC}"
echo "------------------------"
echo "Data Length: $DATA_LENGTH bytes"

# 转换为 KB
DATA_KB=$((DATA_LENGTH / 1024))
echo "           ≈ $DATA_KB KB"

if [ $DATA_LENGTH -gt 0 ]; then
    echo -e "${GREEN}✅ 程序大小正常${NC}"
else
    echo -e "${RED}❌ 程序大小异常${NC}"
fi

echo ""
echo -e "${GREEN}4. 检查部署时间${NC}"
echo "------------------------"
echo "Last Deployed In Slot: $LAST_SLOT"

# 获取当前 slot
CURRENT_SLOT=$(solana slot)
SLOTS_AGO=$((CURRENT_SLOT - LAST_SLOT))
MINUTES_AGO=$((SLOTS_AGO * 400 / 1000 / 60))  # 假设 400ms per slot

echo "Current Slot: $CURRENT_SLOT"
echo "Deployed: $MINUTES_AGO 分钟前"

if [ $SLOTS_AGO -lt 1000 ]; then
    echo -e "${GREEN}✅ 最近刚部署/升级${NC}"
else
    echo -e "${YELLOW}ℹ️  上次部署时间: $MINUTES_AGO 分钟前${NC}"
fi

echo ""
echo -e "${GREEN}5. 测试程序功能${NC}"
echo "------------------------"

# 检查是否有测试脚本
if [ -f "scripts/svm/did/query-price.ts" ]; then
    echo "运行价格查询测试..."
    
    QUERY_RESULT=$(npx ts-node scripts/svm/did/query-price.ts $NETWORK 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 程序功能正常${NC}"
        echo "$QUERY_RESULT" | grep -E "价格|Price|SOL"
    else
        echo -e "${RED}❌ 程序功能测试失败${NC}"
        echo "$QUERY_RESULT"
    fi
else
    echo -e "${YELLOW}⚠️  未找到测试脚本，跳过功能测试${NC}"
fi

echo ""
echo -e "${GREEN}6. 检查 Project PDA${NC}"
echo "------------------------"

# 计算 Project PDA
if command -v node &> /dev/null; then
    PROJECT_PDA=$(node -e "
    const { PublicKey } = require('@solana/web3.js');
    try {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('nt-proj-v5')],
            new PublicKey('$PROGRAM_ID')
        );
        console.log(pda.toString());
    } catch (e) {
        console.log('ERROR');
    }
    " 2>/dev/null)
    
    if [ "$PROJECT_PDA" != "ERROR" ] && [ ! -z "$PROJECT_PDA" ]; then
        echo "Project PDA: $PROJECT_PDA"
        
        # 检查 PDA 账户
        PDA_INFO=$(solana account $PROJECT_PDA 2>&1)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Project PDA 存在${NC}"
            echo "$PDA_INFO" | head -5
        else
            echo -e "${RED}❌ Project PDA 不存在或无法访问${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  无法计算 Project PDA${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Node.js 未安装，跳过 PDA 检查${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ 验证完成${NC}"
echo ""
echo "🔗 浏览器链接:"
echo "   $EXPLORER_URL"
echo ""

# 生成验证报告
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="upgrade-verification-$TIMESTAMP.txt"

cat > $REPORT_FILE << EOF
LegalDID 程序升级验证报告
========================
验证时间: $(date)
网络: $NETWORK
Program ID: $PROGRAM_ID

程序信息:
---------
Upgrade Authority: $UPGRADE_AUTH
Last Deployed Slot: $LAST_SLOT
Data Length: $DATA_LENGTH bytes ($DATA_KB KB)
部署时间: $MINUTES_AGO 分钟前

验证结果:
---------
$(if [ "$UPGRADE_AUTH" == "$EXPECTED_VAULT" ]; then echo "✅ 权限配置正确"; else echo "⚠️  权限配置需要检查"; fi)
$(if [ $DATA_LENGTH -gt 0 ]; then echo "✅ 程序大小正常"; else echo "❌ 程序大小异常"; fi)
$(if [ $SLOTS_AGO -lt 1000 ]; then echo "✅ 最近刚升级"; else echo "ℹ️  上次升级: $MINUTES_AGO 分钟前"; fi)

浏览器链接:
-----------
$EXPLORER_URL

完整程序信息:
-------------
$PROGRAM_INFO
EOF

echo -e "${GREEN}✅ 验证报告已保存到: $REPORT_FILE${NC}"
echo ""
