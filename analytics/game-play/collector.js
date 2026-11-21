/* Unfire Game Play Metrics — STAGED ONLY. No vendor autoload, cookies or IDs. */
(function(root){
  'use strict';
  if(!root || root.UnfirePlayMetrics)return;
  var doc=root.document, nav=root.navigator||{};
  var active=false, reported=false, since=null, milliseconds=0;
  function now(){return root.performance && typeof root.performance.now==='function'?root.performance.now():0;}
  function allowed(){
    var loc=root.location||{};
    return root.__UNFIRE_ANALYTICS_APPROVED===true &&
      root.__UNFIRE_ANALYTICS_RELEASE_APPROVED===true &&
      root.__UNFIRE_ANALYTICS_PRIVACY_GATE===true &&
      loc.protocol==='https:' && loc.hostname==='unfire.technology' &&
      nav.globalPrivacyControl!==true && nav.doNotTrack!=='1' &&
      nav.msDoNotTrack!=='1' && root.doNotTrack!=='1' &&
      !!(root.umami && typeof root.umami.track==='function');
  }
  function emit(name,data){
    if(!allowed())return false;
    try{
      var p=data?root.umami.track(name,data):root.umami.track(name);
      if(p && typeof p.catch==='function')p.catch(function(){});
      return true; /* invoked, delivery not verified */
    }catch(_){return false;}
  }
  function bucket(ms){
    if(ms<60000)return 'under_1m';
    if(ms<300000)return '1_to_5m';
    if(ms<900000)return '5_to_15m';
    if(ms<1800000)return '15_to_30m';
    return '30m_plus';
  }
  function pause(){
    if(!active || since===null)return false;
    milliseconds+=Math.max(0,now()-since);
    since=null;return true;
  }
  function resume(){
    if(!active || !reported || since!==null || (doc && doc.hidden))return false;
    since=now();return true;
  }
  function start(){
    if(active)return false;
    active=true;milliseconds=0;
    since=null; // Never count time before permission and tracker readiness.
    reported=emit('unfire_game_start');
    if(reported && !(doc && doc.hidden))since=now();
    return reported;
  }
  function onTrackerReady(){
    if(!active || reported || !allowed())return false;
    milliseconds=0;since=null; // Start counting at consent, not earlier.
    reported=emit('unfire_game_start');
    if(reported && !(doc && doc.hidden))since=now();
    return reported;
  }
  function end(){
    if(!active)return false;
    pause();active=false;
    var ok=reported && emit('unfire_game_end',{duration_bucket:bucket(milliseconds)});
    reported=false;since=null;milliseconds=0;return !!ok;
  }
  if(doc && typeof doc.addEventListener==='function')
    doc.addEventListener('visibilitychange',function(){if(doc.hidden)pause();else resume();},{passive:true});
  if(typeof root.addEventListener==='function')
    root.addEventListener('pagehide',end,{passive:true});
  root.UnfirePlayMetrics=Object.freeze({
    start:start,end:end,pause:pause,resume:resume,onTrackerReady:onTrackerReady,
    isActive:function(){return active;}
  });
})(typeof window==='object'?window:null);
