'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
function visible(s){
  return s.replace(/<!--[\s\S]*?-->/g,'')
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
          .replace(/<[^>]*>/g,' ')
          .replace(/&(?:amp|nbsp|lt|gt|quot|#\d+);/g,' ')
          .replace(/\s+/g,' ');
}
const publicPages=['games/index.html','education/index.html','audio-shield-privacy.html','unfire-audio/index.html'];
const spanish=/\b(?:juega|gratuito|gratis|español|castellano|preparando|experiencia|selecciona|cerrar|salir|volver|idioma|navegación|aulas|requisitos|contacto|privacidad|términos|enseñanza|universidades|propuesta|proyectos|ahorras|efectos|instrumentos|ritmos|juegos|capturas|instalar|ordenador|pizarras|docencia|presentación|enseñar)\b/i;
test('public institutional and games pages have English-first visible HTML and metadata',()=>{
 for(const f of publicPages){
  const s=read(f);
  assert.match(s,/<html lang="en"/i,f);
  assert.doesNotMatch(visible(s),spanish,f);
 }
});
test('games source has no Spanish language toggle or Spanish first paint',()=>{
 const s=read('games/index.html');
 assert.doesNotMatch(s,/data-es=|data-set-lang=|lang="es"/);
 assert.match(s,/function setLanguage\(\)/);
 assert.match(s,/setLanguage\(\);/);
 assert.match(s,/id="hyperwave-embed" class="games-embed" hidden/);
 assert.match(s,/the game and instruments remain separate experiences/i);
});
test('education provides no unverified institutional claim or mandatory in-person meeting',()=>{
 const s=read('education/index.html');
 assert.match(s,/No mandatory in-person meetings/);
 assert.match(s,/Effectiveness in real classrooms has not yet been validated/);
 assert.match(s,/requires? written terms/i);
 assert.match(s,/No public download is authorized/i);
 assert.match(s,/mailto:hello@unfire\.technology/);
});
test('Audio Shield retains complete English privacy disclosure, not a Spanish duplicate',()=>{
 const s=read('audio-shield-privacy.html');
 assert.match(s,/Information processed by the app/);
 assert.match(s,/Reports and control/);
 assert.match(s,/Third parties, permissions and security/);
 assert.doesNotMatch(s,/<section lang="es">/);
});
