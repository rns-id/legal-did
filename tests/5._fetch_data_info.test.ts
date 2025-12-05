// import {
//   setProvider,
//   AnchorProvider,
// } from '@coral-xyz/anchor'

// import { getCollectionMintAddress, getAccountNFTs } from './utils/utils'
// import { USER_WALLET } from "./utils/constants";


// describe("fetch", () => {

//   const provider = AnchorProvider.env();
//   setProvider(provider)

//   it('Fetches the edition info', async () => {

//     const nonTransferableProjectMint = await getCollectionMintAddress();


//     await getAccountNFTs(USER_WALLET.publicKey.toBase58(), nonTransferableProjectMint.toBase58())
//       .then(nfts => {
//         console.log('NFTs:', nfts);
//       })
//       .catch(err => {
//         console.error('Error:', err);
//       });
//   });
// });