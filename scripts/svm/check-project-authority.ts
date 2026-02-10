import { Connection, PublicKey } from '@solana/web3.js';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const programId = new PublicKey('BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa');
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nt-proj-v5')],
    programId
  );
  
  const accountInfo = await connection.getAccountInfo(projectPda);
  if (!accountInfo) {
    console.log('Project account not found');
    return;
  }
  
  const data = accountInfo.data;
  // discriminator(8) + authority(32) + mint_price(8) + destination(32) + bump(1) + mint_bump(1)
  const authority = new PublicKey(data.slice(8, 40));
  
  // 跳过 name, symbol, base_uri 找 operators
  let offset = 8 + 32 + 8 + 32 + 1 + 1; // = 82
  
  // 读取 name
  const nameLen = data.readUInt32LE(offset);
  offset += 4 + nameLen;
  
  // 读取 symbol  
  const symbolLen = data.readUInt32LE(offset);
  offset += 4 + symbolLen;
  
  // 读取 base_uri
  const uriLen = data.readUInt32LE(offset);
  offset += 4 + uriLen;
  
  // 读取 operators vec
  const operatorsLen = data.readUInt32LE(offset);
  offset += 4;
  
  console.log('=== Project Authority Info ===');
  console.log('Authority (Admin):', authority.toBase58());
  console.log('Operators count:', operatorsLen);
  
  for (let i = 0; i < operatorsLen; i++) {
    const op = new PublicKey(data.slice(offset + i * 32, offset + (i + 1) * 32));
    console.log(`Operator ${i + 1}:`, op.toBase58());
  }
  
  if (operatorsLen === 0) {
    console.log('(No operators configured)');
  }
}

main().catch(console.error);
