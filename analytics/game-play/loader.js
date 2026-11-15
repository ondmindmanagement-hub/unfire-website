/* Unfire Game Play Metrics — manual, release-gated Umami loader (DRAFT).
 * Does not run automatically. Does not contain a tenant ID, credentials or cookies.
 */
(function(root){
  'use strict';
  if(!root || root.UnfirePlayMetricsLoader)return;
  var doc=root.document,nav=root.navigator||{},loaded=false,started=false,revoked=false;
  var src='https://cloud.umami.is/script.js';
  function permitted(){
    var loc=root.location||{};
    return !!(doc && doc.head &&
      root.__UNFIRE_ANALYTICS_RELEASE_APPROVED===true &&
      root.__UNFIRE_ANALYTICS_PRIVACY_GATE===true &&
      loc.protocol==='https:' && loc.hostname==='unfire.technology' &&
      nav.globalPrivacyControl!==true && nav.doNotTrack!=='1' &&
      nav.msDoNotTrack!=='1' && root.doNotTrack!=='1');
  }
  function enable(id){
    if(started || revoked || !permitted() || typeof id!=='string' ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
       return false;
    started=true;
    try{
      var s=doc.createElement('script');
      s.defer=true;
      s.src=src;
      s.setAttribute('data-website-id',id);
      s.setAttribute('data-domains','unfire.technology');
      s.setAttribute('data-do-not-track','true');
      s.setAttribute('data-exclude-search','true');
      s.setAttribute('data-exclude-hash','true');
      s.setAttribute('data-auto-pageview','false');
      s.setAttribute('data-auto-track','false'); // No vendor auto clicks or path changes.
      s.onload=function(){
        if(!permitted() || !root.umami || typeof root.umami.track!=='function')return;
        loaded=true;
        root.__UNFIRE_ANALYTICS_APPROVED=true;
        try{var p=root.umami.track();if(p&&typeof p.catch==='function')p.catch(function(){});}catch(_){}
        try{if(root.UnfirePlayMetrics && typeof root.UnfirePlayMetrics.onTrackerReady==='function')root.UnfirePlayMetrics.onTrackerReady();}catch(_){}
      };
      s.onerror=function(){started=false;root.__UNFIRE_ANALYTICS_APPROVED=false;};
      doc.head.appendChild(s);
      return true;
    }catch(_){started=false;return false;}
  }
  function revoke(){
    revoked=true; // Fail closed: require a fresh navigation before re-enabling.
    root.__UNFIRE_ANALYTICS_APPROVED=false;
    root.__UNFIRE_ANALYTICS_PRIVACY_GATE=false;
    // The external script has already loaded: revocation blocks custom events
    // and pageviews in this adapter, but cannot undo earlier vendor processing.
    // A full vendor-unload policy belongs to the actual privacy integrator.
  }
  root.UnfirePlayMetricsLoader=Object.freeze({
    enable:enable,revoke:revoke,
    isLoaded:function(){return loaded;}
  });
})(typeof window==='object'?window:null);
