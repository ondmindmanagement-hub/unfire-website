'use strict';
/**
 * Y2K Robots game-rights release preflight.
 * audit mode: validate that the declaration is internally consistent.
 * release mode: fail closed until every documented gate is verified and signed off.
 * NOT a legal opinion; only checks release evidence metadata, not its truth.
 */
const fs=require('node:fs');
const path=require('node:path');
const f=path.resolve(__dirname,'../.github/y2k-game-rights-release.json');
const REQUIRED=[
 'asset_rights_chain_of_title',
 'voice_model_output_and_attribution',
 'sample_library_source_matching',
 'fonts_images_video_and_dependency_notices',
 'player_terms_license_privacy_visible_in_game',
 'privacy_data_flows_and_vendor_contracts',
 'online_reports_blocking_and_minors_safety',
 'operator_identity_and_consumer_compliance',
 'apple_google_microsoft_edition_specific_review',
 'legal_signoff_and_exact_release_build_qa'
];
function check(gates,mode){
 const errors=[];
 if(!gates||typeof gates!=='object'){return ['missing release declaration'];}
 if(gates.schema!==1)errors.push('unsupported schema');
 if(gates.product!=='Y2K Robots')errors.push('wrong product');
 if(typeof gates.release_authorized!=='boolean')errors.push('release_authorized must be boolean');
 if(!gates.checks||typeof gates.checks!=='object')errors.push('missing checks object');
 for(const k of REQUIRED){
   const obj=gates.checks&&gates.checks[k];
   if(!obj||typeof obj!=='object'){errors.push('missing required gate: '+k);continue;}
   if(!['blocked','verified'].includes(obj.status))errors.push('invalid gate status: '+k);
   if(!Array.isArray(obj.evidence))errors.push('evidence must be an array: '+k);
   if(obj.status==='verified'){
     if(!Array.isArray(obj.evidence)||obj.evidence.length===0||
       obj.evidence.some(v=>typeof v!=='string'||v.trim().length<10))
       errors.push('verified gate lacks adequate evidence references: '+k);
     if(typeof obj.reviewed_utc!=='string'||!/^20\d\d-\d\d-\d\d/.test(obj.reviewed_utc))
       errors.push('verified gate lacks review date: '+k);
   }
 }
 if(gates.release_authorized){
   for(const k of REQUIRED){
     if(gates.checks?.[k]?.status!=='verified')errors.push('release_authorized while gate blocked: '+k);
   }
   if(typeof gates.release_reviewer!=='string'||gates.release_reviewer.trim().length<2)
     errors.push('release_authorized without reviewer');
   if(typeof gates.release_reviewed_utc!=='string'||!/^20\d\d-\d\d-\d\d/.test(gates.release_reviewed_utc))
     errors.push('release_authorized without review date');
 }
 if(mode==='release'&&gates.release_authorized!==true)errors.push('Y2K Robots distribution not yet legally cleared');
 return errors;
}
function main(){
 const mode=process.argv[2]==='--release'?'release':'audit';
 let gates;try{gates=JSON.parse(fs.readFileSync(f,'utf8'));}catch(e){
  console.error('BLOCKED: game legal gate missing or unreadable:',e.message);process.exit(1);
 }
 const errors=check(gates,mode);
 const blocked=REQUIRED.filter(k=>gates.checks?.[k]?.status!=='verified');
 if(errors.length){
   console.error('BLOCKED: Y2K Robots '+mode+' preflight failed');
   for(const e of errors)console.error(' - '+e);
   process.exitCode=1;
 }else{
   console.log('PASS: '+mode+' declaration schema is internally consistent');
 }
 console.log('Evidence gates: '+(REQUIRED.length-blocked.length)+' verified / '+REQUIRED.length+
   ' required; game release_authorized='+String(gates.release_authorized));
 if(mode==='audit'&&blocked.length)console.log('NOTICE: remaining rights / legal checks '+blocked.join(', '));
 console.log('NOT A LEGAL CERTIFICATION. A passed audit does not authorize a release.');
}
if(require.main===module)main();
module.exports={check,REQUIRED};
