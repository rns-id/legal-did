#!/usr/bin/env python3
"""
Solana Legal DID - Python Mint Script
铸造 DID NFT 到指定用户地址

Usage:
    python mint_did.py <user_wallet> <order_id> [merkle_root]
    
Example:
    python mint_did.py 7s3NWENLzKzL18yGfy4rQNYFQPNFhiHnXYSgjptEwhBg d275d072-21e1-48d3-b17c-e0855712b067
"""

import sys
import os
from hashlib import sha256
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.sysvar import RENT
from solders.instruction import Instruction, AccountMeta
from solders.transaction import Transaction
from solders.message import Message
from solders.compute_budget import set_compute_unit_limit
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
import asyncio
import base58

# 配置
PROGRAM_ID = Pubkey.from_string("BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa")
RPC_URL = "https://api.devnet.solana.com"
NETWORK = "devnet"

# Token Program IDs
TOKEN_2022_PROGRAM_ID = Pubkey.from_string("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

# PDA 前缀
NON_TRANSFERABLE_PROJECT_PREFIX = b"nt-proj-v5"
NON_TRANSFERABLE_PROJECT_MINT_PREFIX = b"nt-project-mint-v5"
NON_TRANSFERABLE_NFT_MINT_PREFIX = b"nt-nft-mint-v5"

# Airdrop 指令的 discriminator (从 IDL 获取)
AIRDROP_DISCRIMINATOR = bytes([113, 173, 36, 238, 38, 152, 22, 117])


def get_associated_token_address(owner: Pubkey, mint: Pubkey, token_program_id: Pubkey):
    """计算 Associated Token Address"""
    seeds = [
        bytes(owner),
        bytes(token_program_id),
        bytes(mint),
    ]
    ata, _ = Pubkey.find_program_address(seeds, ASSOCIATED_TOKEN_PROGRAM_ID)
    return ata


def get_admin_keypair():
    """从环境变量或文件加载管理员密钥"""
    # 尝试从 Solana CLI 默认位置加载
    wallet_path = os.path.expanduser("~/.config/solana/id.json")
    
    if os.path.exists(wallet_path):
        with open(wallet_path, 'r') as f:
            import json
            secret_key = json.load(f)
            return Keypair.from_bytes(bytes(secret_key))
    else:
        raise Exception(f"Wallet file not found: {wallet_path}")


def get_project_pda():
    """计算 Project PDA"""
    pda, bump = Pubkey.find_program_address(
        [NON_TRANSFERABLE_PROJECT_PREFIX],
        PROGRAM_ID
    )
    return pda, bump


def get_collection_mint_pda():
    """计算 Collection Mint PDA"""
    pda, bump = Pubkey.find_program_address(
        [NON_TRANSFERABLE_PROJECT_MINT_PREFIX],
        PROGRAM_ID
    )
    return pda, bump


def get_nft_mint_pda(order_id: str):
    """计算 NFT Mint PDA (使用 order_id 的 SHA256 哈希)"""
    order_id_hash = sha256(order_id.encode('utf-8')).digest()
    pda, bump = Pubkey.find_program_address(
        [NON_TRANSFERABLE_NFT_MINT_PREFIX, order_id_hash],
        PROGRAM_ID
    )
    return pda, bump


async def check_if_minted(order_id: str, client: AsyncClient):
    """检查 order_id 是否已经铸造"""
    nft_mint_pda, _ = get_nft_mint_pda(order_id)
    account_info = await client.get_account_info(nft_mint_pda)
    return account_info.value is not None


def create_airdrop_instruction(
    authority: Pubkey,
    user_wallet: Pubkey,
    order_id: str,
    merkle_root: str
):
    """创建 airdrop 指令"""
    
    # 计算所有 PDA
    project_pda, _ = get_project_pda()
    collection_mint, _ = get_collection_mint_pda()
    nft_mint_pda, _ = get_nft_mint_pda(order_id)
    
    # 计算用户的 ATA
    user_token_account = get_associated_token_address(
        owner=user_wallet,
        mint=nft_mint_pda,
        token_program_id=TOKEN_2022_PROGRAM_ID
    )
    
    # 构建指令数据
    # discriminator (8 bytes) + order_id (string) + wallet (32 bytes) + merkle_root (string)
    data = AIRDROP_DISCRIMINATOR
    
    # 添加 order_id (Rust String: 4 bytes length + data)
    order_id_bytes = order_id.encode('utf-8')
    data += len(order_id_bytes).to_bytes(4, 'little')
    data += order_id_bytes
    
    # 添加 wallet (32 bytes)
    data += bytes(user_wallet)
    
    # 添加 merkle_root (Rust String: 4 bytes length + data)
    merkle_root_bytes = merkle_root.encode('utf-8')
    data += len(merkle_root_bytes).to_bytes(4, 'little')
    data += merkle_root_bytes
    
    # 构建账户列表（顺序必须与程序定义一致）
    accounts = [
        AccountMeta(pubkey=authority, is_signer=True, is_writable=True),
        AccountMeta(pubkey=project_pda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=nft_mint_pda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=user_wallet, is_signer=False, is_writable=True),
        AccountMeta(pubkey=user_token_account, is_signer=False, is_writable=True),
        AccountMeta(pubkey=collection_mint, is_signer=False, is_writable=True),
        AccountMeta(pubkey=ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(pubkey=TOKEN_2022_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(pubkey=SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        AccountMeta(pubkey=RENT, is_signer=False, is_writable=False),
    ]
    
    return Instruction(
        program_id=PROGRAM_ID,
        data=data,
        accounts=accounts
    )


async def mint_did(user_wallet: Pubkey, order_id: str, merkle_root: str = None):
    """铸造 DID NFT"""
    
    # 默认 merkle_root
    if merkle_root is None:
        merkle_root = "2d852b3c21e923484a93d3a980a45b7571e89552d58875d40dd17c73216a49d7"
    
    print("=" * 50)
    print("Solana Legal DID - Python Mint Script")
    print("=" * 50)
    print(f"Network: {NETWORK}")
    print(f"Program ID: {PROGRAM_ID}")
    print(f"User Wallet: {user_wallet}")
    print(f"Order ID: {order_id}")
    print(f"Merkle Root: {merkle_root}")
    print()
    
    # 加载管理员密钥
    admin_keypair = get_admin_keypair()
    print(f"Admin Wallet: {admin_keypair.pubkey()}")
    
    # 连接到 Solana
    async with AsyncClient(RPC_URL, commitment=Confirmed) as client:
        
        # 检查是否已经铸造
        print("\nChecking if order_id already minted...")
        if await check_if_minted(order_id, client):
            print(f"❌ Error: Order ID '{order_id}' has already been minted!")
            print("   Please use a different order_id")
            return False
        
        print("✅ Order ID is available")
        
        # 计算 PDA
        project_pda, _ = get_project_pda()
        collection_mint, _ = get_collection_mint_pda()
        nft_mint_pda, _ = get_nft_mint_pda(order_id)
        user_token_account = get_associated_token_address(
            owner=user_wallet,
            mint=nft_mint_pda,
            token_program_id=TOKEN_2022_PROGRAM_ID
        )
        
        print("\nPDA Addresses:")
        print(f"  Project: {project_pda}")
        print(f"  Collection Mint: {collection_mint}")
        print(f"  NFT Mint: {nft_mint_pda}")
        print(f"  User Token Account: {user_token_account}")
        print()
        
        # 创建指令
        print("Creating airdrop instruction...")
        airdrop_ix = create_airdrop_instruction(
            authority=admin_keypair.pubkey(),
            user_wallet=user_wallet,
            order_id=order_id,
            merkle_root=merkle_root
        )
        
        # 添加 compute budget
        compute_budget_ix = set_compute_unit_limit(400_000)
        
        # 获取最新的 blockhash
        print("Getting recent blockhash...")
        recent_blockhash_resp = await client.get_latest_blockhash()
        recent_blockhash = recent_blockhash_resp.value.blockhash
        
        # 创建交易
        print("Creating transaction...")
        message = Message.new_with_blockhash(
            [compute_budget_ix, airdrop_ix],
            admin_keypair.pubkey(),
            recent_blockhash
        )
        tx = Transaction([admin_keypair], message, recent_blockhash)
        
        # 发送交易
        print("Sending transaction...")
        result = await client.send_transaction(tx)
        signature = result.value
        
        print(f"\n✅ Transaction sent!")
        print(f"Signature: {signature}")
        
        # 等待确认
        print("\nWaiting for confirmation...")
        await client.confirm_transaction(signature, commitment=Confirmed)
        
        print("✅ Transaction confirmed!")
        print()
        print("🎉 DID NFT minted successfully!")
        print()
        print("View on Explorer:")
        print(f"  Transaction: https://explorer.solana.com/tx/{signature}?cluster={NETWORK}")
        print(f"  NFT Mint: https://explorer.solana.com/address/{nft_mint_pda}?cluster={NETWORK}")
        print(f"  User Token Account: https://explorer.solana.com/address/{user_token_account}?cluster={NETWORK}")
        
        return True


async def main():
    """主函数"""
    if len(sys.argv) < 3:
        print("Usage: python mint_did.py <user_wallet> <order_id> [merkle_root]")
        print()
        print("Example:")
        print("  python mint_did.py 7s3NWENLzKzL18yGfy4rQNYFQPNFhiHnXYSgjptEwhBg d275d072-21e1-48d3-b17c-e0855712b067")
        sys.exit(1)
    
    user_wallet_str = sys.argv[1]
    order_id = sys.argv[2]
    merkle_root = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        user_wallet = Pubkey.from_string(user_wallet_str)
    except Exception as e:
        print(f"❌ Invalid user wallet address: {e}")
        sys.exit(1)
    
    try:
        success = await mint_did(user_wallet, order_id, merkle_root)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
