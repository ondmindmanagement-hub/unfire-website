'use strict';
// Defense-in-depth for a static GitHub Pages store. This is NOT legal approval.
// A paid SKU cannot be switched on without a reviewed merchant, fiscal,
// consumer-rights, delivery and product-release checklist.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.resolve(__dirname,'../..');
const page=fs.readFileSync(path.join(root,'audio/index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.github/audio-commerce-release.json'),'utf8'));
const segment=page.slice(page.indexOf('const PAY={'),page.indexOf('const eur='));
assert.ok(segment.startsWith('const PAY={')&&segment.includes('READY_FOR_SALE=new Set('),'Cannot inspect checkout release gate');
const commerce=new Function(segment+';return {PAY,READY_FOR_SALE,paymentLinkFor,checkoutLinkFor};')();
const gates=manifest.release_checks;
const required=[
  'merchant_identity_and_bank_verified',
  'aeat_activity_registration_checked',
  'social_security_reta_position_checked',
  'sepe_benefit_position_resolved',
  'seller_identification_notice_complete',
  'tax_and_cross_border_vat_configured',
  'consumer_terms_and_digital_withdrawal_confirmed',
  'individual_builds_signed_and_compatibility_tested',
  'paid_order_webhook_and_secure_fulfillment_tested',
  'receipts_refunds_support_and_cancellations_ready'
];
const live=[...commerce.READY_FOR_SALE];

test('sale state is explicit and fails closed by default',()=>{
  assert.equal(manifest.schema,1);
  assert.equal(typeof manifest.direct_web_checkout_authorized,'boolean');
  assert.ok(gates&&typeof gates==='object'&&!Array.isArray(gates));
  assert.ok(manifest.approved_skus&&typeof manifest.approved_skus==='object'&&!Array.isArray(manifest.approved_skus));
  for(const name of required)assert.equal(typeof gates[name],'boolean',name);
  if(!manifest.direct_web_checkout_authorized){
    assert.deepEqual(live,[],'Checkout cannot be live before merchant authorization');
    assert.deepEqual(Object.keys(manifest.approved_skus),[],'Unapproved merchant must not advertise approved SKUs');
  }
});

test('no live checkout without all release evidence',()=>{
  if(!live.length)return;
  assert.equal(manifest.direct_web_checkout_authorized,true);
  for(const name of required) assert.equal(gates[name],true,'GO LIVE BLOCKED: '+name);
  assert.match(page,/id="agreeDigitalSupply"/,'Separate affirmative consent for immediate digital supply is required');
  assert.match(page,/id="ackWithdrawal"/,'Separate acknowledgment of withdrawal consequences is required');
  for(const sku of live){
    assert.ok(!['starter','launch'].includes(sku),'Free/notification SKU cannot become paid');
    const item=manifest.approved_skus[sku];
    assert.ok(item&&typeof item==='object','Missing signed release record for '+sku);
    assert.match(item.sha256||'',/^[a-f0-9]{64}$/,'Missing distribution SHA256 for '+sku);
    assert.ok(Array.isArray(item.tested_platforms)&&item.tested_platforms.length>0,'No compatibility tests '+sku);
    assert.ok(item.delivery_receipt_test_id&&item.legal_offer_version,'No fulfillment/legal confirmation '+sku);
    assert.match(commerce.paymentLinkFor(sku),/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_-]+$/,'Invalid live payment link for '+sku);
  }
  const used=live.map(k=>commerce.paymentLinkFor(k));
  assert.equal(new Set(used).size,used.length,'Different SKUs must not share an ambiguous payment link');
});

test('public consumer rights pages must remain available',()=>{
  const terms=fs.readFileSync(path.join(root,'terms.html'),'utf8');
  const refunds=fs.readFileSync(path.join(root,'refunds.html'),'utf8');
  const license=fs.readFileSync(path.join(root,'software-license.html'),'utf8');
  const legal=fs.readFileSync(path.join(root,'legal.html'),'utf8');
  const privacy=fs.readFileSync(path.join(root,'privacy.html'),'utf8');
  const compatibility=fs.readFileSync(path.join(root,'audio/compatibilidad/index.html'),'utf8');
  assert.match(terms,/precio total/i);
  assert.match(refunds,/desistimiento/i);
  assert.match(license,/consumidor/i);
  assert.match(legal,/Unfire/);
  assert.match(privacy,/privacy|privacidad/i);
  assert.match(compatibility,/todavía no se aceptan pagos/i);
});

test('checkout stays a non-binding enquiry while no SKU is approved',()=>{
  if(manifest.direct_web_checkout_authorized)return;
  assert.deepEqual(live,[]);
  assert.match(page,/id="bagUnreleased"/);
  assert.equal(commerce.checkoutLinkFor(['fx20']),'');
  assert.equal(commerce.checkoutLinkFor(['todo']),'');
  assert.equal(commerce.checkoutLinkFor(['club']),'');
});
