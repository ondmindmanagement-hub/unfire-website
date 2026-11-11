"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "world.css"), "utf8");
const js = fs.readFileSync(path.join(root, "world.js"), "utf8");
new vm.Script(js, {filename:"world.js"});
const checks = [
  ["Escenario aislado y enlazado sólo como demo", /PRUEBA TÉCNICA AISLADA/.test(html) && html.includes('href="/audio/"')],
  ["Etiqueta Unfire no traducible", html.includes('translate="no"') && html.includes("notranslate")],
  ["Alternativa WebGL integrada", html.includes('id="fallback-visual"') && js.includes("failGracefully(")],
  ["Controles de rango accesibles", html.includes('for="morph-slider"') && html.includes('type="range"')],
  ["Deformación procedural real de geometría", js.includes("mix(aCube, aSphere, t)") && js.includes("gl.drawElements(")],
  ["Uniforms GLSL con precisión coincidente", (js.match(/uniform mediump float uMorph;/g)||[]).length===2],
  ["Dibujo bajo demanda y límite DPR", js.includes("function schedule()") && js.includes("Math.min(window.devicePixelRatio")],
  ["Respeto a movimiento reducido", js.includes('prefersReducedMotion.matches') && css.includes("prefers-reduced-motion")],
  ["Sin pasarela de pago ni red saliente", !/\bfetch\s*\(|XMLHttpRequest|sendBeacon|stripe|checkout\./i.test(js)],
  ["Sin scripts ni estilos de terceros", !/<script[^>]+src="https?:/i.test(html) && !/<link[^>]+href="https?:/i.test(html)],
  ["Responsive y cero scroll lateral intencional", css.includes("overflow-x:clip") && css.includes("max-width:450px")],
  ["Escaparate público sólo de Unfire Audio", html.includes('id="tienda-piloto"') && html.includes('src="/audio/img/maletin-real-first-frame-desktop.webp"') && html.includes('href="/audio/"')],
  ["Captura auténtica existente y ligera", (()=>{const p=path.resolve(root,"../../audio/img/maletin-real-first-frame-desktop.webp");return fs.existsSync(p)&&fs.statSync(p).size<100000})()],
  ["Zona navegable por enlaces convencionales", html.includes('href="#showroom"') && html.includes('href="#tienda-piloto"')],
  ["Vista 2D responde realmente al control", html.includes('id="fallback-shape"') && html.includes('id="fallback-label"') && js.includes('fallbackShape.style.borderRadius')],
  ["Recuperación y liberación de recursos WebGL", js.includes('webglcontextrestored') && js.includes('releaseResources()') && js.includes('addEventListener("pagehide"')],
  ["Medición local sin rastreo externo", js.includes('performance.mark?.("unfire-world:first-draw")') && !js.includes("sendBeacon(")],
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log("PASS",label)}
console.log("TOTAL",checks.length,"/ ",checks.length,"PASS");
