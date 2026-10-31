/** Test-only child process. Ephemeral Ed25519 key never leaves child process. */
import { generateKeyPairSync } from 'node:crypto';
import { signSyntheticPacket, postSyntheticPacket } from './loopback.mjs';
const {privateKey,publicKey} = generateKeyPairSync('ed25519');
if (!process.send) process.exit(3);
process.send({type:'ready',publicKeyPem:publicKey.export({format:'pem',type:'spki'})});
process.on('message', async message => {
  if (message?.type !== 'synthetic_send') return;
  try {
    const result = await postSyntheticPacket(message.url,signSyntheticPacket(message.packet,privateKey));
    process.send({type:'result',result});
  } catch(e) {
    process.send({type:'error',code:e.code||e.name});
  }
});