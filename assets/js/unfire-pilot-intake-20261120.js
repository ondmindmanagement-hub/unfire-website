'use strict';
(function(){
 const $=id=>document.getElementById(id),form=$('intake'),status=$('status'),box=$('previewBox'),preview=$('preview');
 const clean=(v,max)=>v.trim().replace(/[\r\n\t]+/g,' ').slice(0,max);
 let subject='Unfire written workflow assessment enquiry';
 form.addEventListener('submit',event=>{
  event.preventDefault();status.textContent='';
  if(!form.checkValidity()){form.reportValidity();status.textContent='Please complete the required fields with a valid email address.';return;}
  const org=clean($('org').value,100),email=clean($('contact').value,150);
  const problem=$('problem').value.trim().slice(0,750),outcome=$('outcome').value.trim().slice(0,500);
  if(problem.length<20||outcome.length<12){status.textContent='Please give a little more detail about the issue and intended result.';return;}
  subject='Unfire workflow assessment — '+org.slice(0,65);
  preview.value=['Hello Unfire,','', 'I would like a written-only discussion of a non-binding, synthetic-data feasibility review.','',
    'Organization: '+org, 'Reply-to email: '+email, 'Operating area: '+$('sector').value,
    'Process owner: '+$('owner').value,'','Recurring problem:',' '+problem,'','Desired measurable outcome:',' '+outcome,
    '','Indicative budget: '+$('scope').value,'Decision horizon: '+$('timing').value,'',
    'I understand this is a preliminary enquiry, not a booking, contract or commitment. Please reply by email.'].join('\n');
  box.hidden=false;status.textContent='Draft prepared locally. Nothing has been sent.';
  box.scrollIntoView({behavior:'smooth',block:'start'});
 });
 $('prepareEnquiry').disabled=false; // Enable only after local draft-preparation handler is installed.
 $('openEmail').addEventListener('click',()=>{
  if(!preview.value.trim())return;
  const url='mailto:hello@unfire.technology?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(preview.value);
  if(url.length>4500){status.textContent='Please shorten the draft slightly before opening your email app.';return;}
  window.location.href=url;
 });
 $('copyEmail').addEventListener('click',async()=>{
  if(!preview.value.trim())return;
  try{await navigator.clipboard.writeText('To: hello@unfire.technology\nSubject: '+subject+'\n\n'+preview.value);status.textContent='Email details copied. Paste into your email app to send.';}
  catch{preview.focus();preview.select();status.textContent='Select and copy the text above manually.';}
 });
})();
