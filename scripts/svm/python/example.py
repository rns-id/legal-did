#!/usr/bin/env python3
"""
使用示例
"""

import asyncio
import uuid
from mint_did import mint_did, check_if_minted, PROGRAM_ID
from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient

# 配置
RPC_URL = "https://api.devnet.solana.com"


async def example_mint():
    """示例：铸造单个 DID"""
    user_wallet = Pubkey.from_string("7s3NWENLzKzL18yGfy4rQNYFQPNFhiHnXYSgjptEwhBg")
    order_id = str(uuid.uuid4())  # 生成唯一的 order_id
    
    print(f"铸造 DID 给用户: {user_wallet}")
    print(f"Order ID: {order_id}")
    
    success = await mint_did(user_wallet, order_id)
    
    if success:
        print("\n✅ 铸造成功！")
    else:
        print("\n❌ 铸造失败")


async def example_check():
    """示例：检查 order_id 是否已铸造"""
    order_id = "aecc98f5-63b9-4871-a46e-547f40c8dcdc"  # 已铸造的 order_id
    
    async with AsyncClient(RPC_URL) as client:
        is_minted = await check_if_minted(order_id, client)
        
        if is_minted:
            print(f"✅ Order ID '{order_id}' 已经铸造")
        else:
            print(f"❌ Order ID '{order_id}' 尚未铸造")


async def example_batch_mint():
    """示例：批量铸造"""
    users = [
        "7s3NWENLzKzL18yGfy4rQNYFQPNFhiHnXYSgjptEwhBg",
        "H2sykMLjWjBCtALDYCwnqxALEWtDbBwfCXtz7YThoEne",
    ]
    
    for user_str in users:
        user = Pubkey.from_string(user_str)
        order_id = str(uuid.uuid4())
        
        print(f"\n铸造给 {user_str[:8]}...")
        await mint_did(user, order_id)
        
        # 等待避免 rate limit
        await asyncio.sleep(2)


if __name__ == "__main__":
    # 运行示例
    print("选择示例:")
    print("1. 铸造单个 DID")
    print("2. 检查 order_id")
    print("3. 批量铸造")
    
    choice = input("\n输入选项 (1-3): ")
    
    if choice == "1":
        asyncio.run(example_mint())
    elif choice == "2":
        asyncio.run(example_check())
    elif choice == "3":
        asyncio.run(example_batch_mint())
    else:
        print("无效选项")
