/* Unfire research: user-initiated YouTube embedding.
   The player loads only on activation; previews are from YouTube itself. */
(function(){
  'use strict';
  function activate(event){
    var link=event.target.closest && event.target.closest('a[data-ufbm-video]');
    if(!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var id=link.getAttribute('data-ufbm-video');
    if(!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    event.preventDefault();
    var player=document.createElement('div');
    player.className='ufbm-player';
    var frame=document.createElement('iframe');
    frame.title='YouTube video: '+(link.getAttribute('data-ufbm-title')||'original creator demo');
    frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1';
    frame.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen=true;
    frame.referrerPolicy='strict-origin-when-cross-origin';
    frame.loading='eager';
    player.appendChild(frame);
    link.replaceWith(player);
    frame.focus({preventScroll:true});
  }
  document.addEventListener('click',activate);
})();
