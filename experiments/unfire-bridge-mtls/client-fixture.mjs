import { sendMtlsSynthetic } from './mtls.mjs';

let text='';
process.stdin.setEncoding('utf8');
for await (const part of process.stdin) {
  text+=part;
  if (text.length>20_000) process.exit(2);
}
try {
  const result=await sendMtlsSynthetic(JSON.parse(text));
  process.stdout.write(JSON.stringify(result));
} catch(error) {
  process.stdout.write(JSON.stringify({failed:true,code:error.code||'REJECTED'}));
  process.exitCode=1;
}
