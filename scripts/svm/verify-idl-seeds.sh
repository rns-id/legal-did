#!/bin/bash

# 验证 IDL 中所有管理员指令都有 PDA seeds

echo "🔍 验证 IDL 中的 PDA Seeds"
echo ""

IDL_FILE="target/idl/legaldid.json"

if [ ! -f "$IDL_FILE" ]; then
  echo "❌ IDL 文件不存在: $IDL_FILE"
  exit 1
fi

echo "📋 检查以下指令的 PDA seeds:"
echo ""

# 需要检查的指令列表
INSTRUCTIONS=(
  "add_operator"
  "remove_operator"
  "set_mint_price"
  "set_base_uri"
  "set_fund_destination"
  "transfer_authority"
  "airdrop"
  "withdraw"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for instruction in "${INSTRUCTIONS[@]}"; do
  # 检查指令是否有 pda.seeds
  HAS_SEEDS=$(jq -r ".instructions[] | select(.name == \"$instruction\") | .accounts[] | select(.name == \"non_transferable_project\") | .pda.seeds" "$IDL_FILE" 2>/dev/null)
  
  if [ -n "$HAS_SEEDS" ] && [ "$HAS_SEEDS" != "null" ]; then
    echo "  ✅ $instruction - 有 PDA seeds"
    ((SUCCESS_COUNT++))
  else
    echo "  ❌ $instruction - 没有 PDA seeds"
    ((FAIL_COUNT++))
  fi
done

echo ""
echo "📊 结果:"
echo "  成功: $SUCCESS_COUNT"
echo "  失败: $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "🎉 所有指令都有 PDA seeds！"
  exit 0
else
  echo "⚠️  有 $FAIL_COUNT 个指令缺少 PDA seeds"
  exit 1
fi
