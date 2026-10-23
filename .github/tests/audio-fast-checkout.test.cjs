'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const page=fs.readFileSync(path.join(__dirname,'../../audio/index.html'),'utf8');
const code=page.slice(page.indexOf('const PAY={'),page.indexOf('const eur='));
assert.ok(code.includes('READY_FOR_SALE'),'Payment gate is required');
// Evaluate only the pure payment routing functions, never page UI or external URLs.
function checkout(){
  return new Function(code+';return {PAY,READY_FOR_SALE,paymentLinkFor,checkoutLinkFor};')();
}
test('no product may charge while payment configuration and delivery remain pending',()=>{
  const p=checkout();
  assert.equal(p.paymentLinkFor('hyper'),'');
  assert.equal(p.checkoutLinkFor(['hyper']),'');
  assert.equal(p.checkoutLinkFor(['hyper','synth']),'');
  assert.equal(p.paymentLinkFor('club'),'');
});
test('only exact Stripe live Payment Links can be used',()=>{
  const p=checkout();p.READY_FOR_SALE.add('hyper');
  p.PAY.hyper='https://buy.stripe.com/abcABC0123';
  assert.equal(p.checkoutLinkFor(['hyper']),'https://buy.stripe.com/abcABC0123');
  for(const invalid of [
    'http://buy.stripe.com/abcABC0123',
    'https://buy.stripe.com.evil.example/a',
    'javascript:alert(1)',
    'https://buy.stripe.com/test_abcABC0123',
    'https://buy.stripe.com/',
    'https://buy.stripe.com/abcABC0123#fake'
  ]){
    p.PAY.hyper=invalid;
    assert.equal(p.paymentLinkFor('hyper'),'',invalid);
  }
});
test('cart never silently charges a different product or a partial basket',()=>{
  const p=checkout();p.READY_FOR_SALE.add('hyper');
  p.PAY.hyper='https://buy.stripe.com/abcABC0123';
  assert.equal(p.checkoutLinkFor(['hyper','synth']),'');
  assert.equal(p.checkoutLinkFor(['hyper','starter']),'');
  assert.equal(p.checkoutLinkFor([]),'');
  assert.equal(p.checkoutLinkFor(['hyper']),p.PAY.hyper);
});
test('subscription maps to separately approved Stripe link, not a one-time SKU',()=>{
  const p=checkout();p.READY_FOR_SALE.add('clubM');
  p.PAY.clubM='https://buy.stripe.com/abcSUB1234';
  assert.equal(p.checkoutLinkFor(['club']),p.PAY.clubM);
  assert.equal(p.checkoutLinkFor(['fx-razora']),'');
});
test('ready product by itself is insufficient without a real link',()=>{
  const p=checkout();p.READY_FOR_SALE.add('todo');
  assert.equal(p.checkoutLinkFor(['todo']),'');
});
test('free demos and launch notifications cannot be converted into paid products',()=>{
  const p=checkout();
  p.PAY.starter='https://buy.stripe.com/fake123456';
  p.READY_FOR_SALE.add('starter');
  assert.equal(p.checkoutLinkFor(['starter']),'');
  p.PAY.launch='https://buy.stripe.com/fake123456';
  p.READY_FOR_SALE.add('launch');
  assert.equal(p.checkoutLinkFor(['launch']),'');
});
test('do not propagate query parameters from payment links',()=>{
  const p=checkout();p.READY_FOR_SALE.add('hyper');
  p.PAY.hyper='https://buy.stripe.com/abc123?prefilled_email=example%40example.org';
  assert.equal(p.checkoutLinkFor(['hyper']),'');
});
test('checkout UI keeps not-yet-launched products as enquiries',()=>{
  assert.match(page, /id="bagUnreleased"/);
  assert.match(page, /id="bagPayMethods" hidden/);
  assert.match(page, /id="bagOfferLabel"/);
  assert.match(page, /express\?items.reduce\(\(sum,k\)=>sum\+ITEMS\[k\]\[1\],0\)/);
  assert.match(page, /checkoutLinkFor\(items\)/);
  assert.match(page, /getLic\(ITEMS\[k\]\[0\],\[k\]\)/);
  assert.match(page, /mailto:hello@unfire\.technology/);
});
