import { Connection, PublicKey } from '@solana/web3.js';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  const programId = new PublicKey('BE6yuzEjzapwBEQ9RoAFzG72XZzb17JuWWqhecFHdEQa');
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('nt-proj-v5')],
    programId
  );
  
  console.log('Program ID:', programId.toBase58());
  console.log('Project PDA:', projectPda.toBase58());
  
  const accountInfo = await connection.getAccountInfo(projectPda);
  if (accountInfo) {
    // Skip 8 bytes discriminator, read 32 bytes authority
    const authority = new PublicKey(accountInfo.data.slice(8, 40));
    console.log('Project Authority (Admin):', authority.toBase58());
    console.log('Account data length:', accountInfo.data.length);
  } else {
    console.log('Project account not found - program may not be initialized');
  }
}

main().catch(console.error);
