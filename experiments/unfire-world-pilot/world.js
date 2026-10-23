/* UNFIRE WORLD LAB — isolated, dependency-free WebGL 1 proof of concept.
   The object is an original mathematical geometry demo, NOT an Unfire product render.
   No networking, analytics, checkout, third-party branding, or shared Audio engine. */
(() => {
  "use strict";

  const canvas = document.getElementById("world-canvas");
  const stage = document.getElementById("stage");
  const fallback = document.getElementById("fallback-visual");
  const slider = document.getElementById("morph-slider");
  const output = document.getElementById("morph-output");
  const button = document.getElementById("morph-button");
  const reset = document.getElementById("reset-button");
  const status = document.getElementById("render-status");
  const mode = document.getElementById("scene-mode");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let gl = null;
  let program = null;
  let meshBuffer = null;
  let indexBuffer = null;
  let meshCount = 0;
  let uniforms = null;
  let morph = 0;
  let yaw = -0.38;
  let tween = null;
  let raf = 0;
  let tracking = null;
  let prevX = 0;
  let resizeObserver = null;

  function updateControl() {
    slider.value = String(Math.round(morph * 100));
    output.value = String(Math.round(morph * 100)) + " %";
    output.textContent = output.value;
    button.firstChild.textContent = morph >= 0.5 ? "Volver al cubo " : "Transformar ";
  }

  function failGracefully(message) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    gl = null;
    canvas.hidden = true;
    stage.classList.remove("is-rendered");
    mode.textContent = "MODO 2D";
    fallback.hidden = false;
    status.textContent = message || "No se pudo activar WebGL. La alternativa 2D y el enlace al juego siguen disponibles.";
  }

  function makeShader(context, type, code) {
    const shader = context.createShader(type);
    context.shaderSource(shader, code);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      const info = context.getShaderInfoLog(shader) || "Error desconocido al compilar shader";
      context.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  }

  function makeProgram(context) {
    const vertex = makeShader(context, context.VERTEX_SHADER, [
      "attribute vec3 aCube;",
      "attribute vec3 aSphere;",
      "attribute vec3 aNormal;",
      "uniform mediump float uMorph;",
      "uniform float uYaw;",
      "uniform float uAspect;",
      "varying vec3 vNormal;",
      "varying vec3 vEye;",
      "void main(){",
      "  float t = uMorph * uMorph * (3.0 - 2.0 * uMorph);",
      "  vec3 pos = mix(aCube, aSphere, t);",
      "  vec3 normal = normalize(mix(aNormal, normalize(aSphere), t));",
      "  float co = cos(uYaw);",
      "  float si = sin(uYaw);",
      "  pos = vec3(co*pos.x + si*pos.z, pos.y, -si*pos.x + co*pos.z);",
      "  normal = normalize(vec3(co*normal.x + si*normal.z, normal.y, -si*normal.x + co*normal.z));",
      "  pos.y = pos.y * 0.94 - pos.z * 0.23;",
      "  pos.z = pos.z * 0.94 + pos.y * 0.23 - 4.1;",
      "  vNormal = normal;",
      "  vEye = normalize(-pos);",
      "  gl_Position = vec4(pos.x*1.8/max(0.65,uAspect), pos.y*1.8, -1.002*pos.z-0.2002, -pos.z);",
      "}"
    ].join("\n"));
    const fragment = makeShader(context, context.FRAGMENT_SHADER, [
      "precision mediump float;",
      "varying vec3 vNormal;",
      "varying vec3 vEye;",
      "uniform mediump float uMorph;",
      "void main(){",
      "  vec3 n = normalize(vNormal);",
      "  vec3 light = normalize(vec3(0.55, 0.86, 1.0));",
      "  float diffuse = max(dot(n, light), 0.0);",
      "  float edge = pow(1.0 - max(dot(n,normalize(vEye)),0.0), 2.3);",
      "  vec3 base = mix(vec3(0.085,0.29,0.56),vec3(0.23,0.64,0.91), clamp(n.y*0.42+0.5,0.0,1.0));",
      "  vec3 col = base*(0.30+diffuse*0.76) + vec3(0.41,0.76,1.0)*edge*0.52;",
      "  col += vec3(0.015,0.025,0.06) * uMorph;",
      "  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);",
      "}"
    ].join("\n"));
    const result = context.createProgram();
    context.attachShader(result, vertex);
    context.attachShader(result, fragment);
    context.linkProgram(result);
    context.deleteShader(vertex);
    context.deleteShader(fragment);
    if (!context.getProgramParameter(result, context.LINK_STATUS)) {
      const info = context.getProgramInfoLog(result) || "Error desconocido de enlace";
      context.deleteProgram(result);
      throw new Error(info);
    }
    return result;
  }

  function makeMesh() {
    // Every cube face is subdivided, so each surface vertex can morph into
    // its normalized sphere counterpart on the GPU (genuine vertex deformation).
    const divisions = 18;
    const data = [];
    const indices = [];
    for (let axis = 0; axis < 3; axis += 1) {
      for (const sign of [-1, 1]) {
        const base = data.length / 9;
        for (let row = 0; row <= divisions; row += 1) {
          for (let col = 0; col <= divisions; col += 1) {
            const a = col / divisions * 2 - 1;
            const b = row / divisions * 2 - 1;
            const cube = [0, 0, 0];
            const n = [0, 0, 0];
            cube[axis] = sign * 1.13;
            cube[(axis + 1) % 3] = a * 1.13;
            cube[(axis + 2) % 3] = b * 1.13;
            n[axis] = sign;
            const len = Math.hypot(cube[0], cube[1], cube[2]);
            const sphere = cube.map((x) => x / len * 1.28);
            data.push(...cube, ...sphere, ...n);
          }
        }
        for (let row = 0; row < divisions; row += 1) {
          for (let col = 0; col < divisions; col += 1) {
            const a = base + row * (divisions + 1) + col;
            const b = a + divisions + 1;
            indices.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
      }
    }
    return { data: new Float32Array(data), indices: new Uint16Array(indices) };
  }

  function initialize() {
    let context;
    try {
      context = canvas.getContext("webgl", {
        alpha: true, antialias: false, depth: true,
        preserveDrawingBuffer: false, powerPreference: "low-power"
      }) || canvas.getContext("experimental-webgl");
    } catch (_) {
      context = null;
    }
    if (!context) {
      failGracefully("WebGL no está disponible. Puedes utilizar los controles y acceder a la demostración real de Unfire Audio.");
      return;
    }

    try {
      gl = context;
      program = makeProgram(gl);
      const mesh = makeMesh();
      meshBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      meshCount = mesh.indices.length;
      gl.useProgram(program);
      const stride = 9 * 4;
      for (const [name, offset] of [["aCube", 0], ["aSphere", 12], ["aNormal", 24]]) {
        const location = gl.getAttribLocation(program, name);
        if (location < 0) throw new Error("Atributo inexistente: " + name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 3, gl.FLOAT, false, stride, offset);
      }
      uniforms = {
        morph: gl.getUniformLocation(program, "uMorph"),
        yaw: gl.getUniformLocation(program, "uYaw"),
        aspect: gl.getUniformLocation(program, "uAspect")
      };
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      canvas.hidden = false;
      stage.classList.add("is-rendered");
      mode.textContent = "WEBGL ACTIVO";
      status.textContent = "Geometría WebGL activa. La escena solo se vuelve a dibujar cuando interactúas.";
      schedule();
      if (!resizeObserver && "ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(schedule);
        resizeObserver.observe(stage);
      }
    } catch (error) {
      console.warn("WORLD LAB WebGL fallback:", error.message);
      failGracefully("Error de inicialización de WebGL. Se mantiene la navegación accesible en 2D.");
    }
  }

  function draw() {
    if (!gl || canvas.hidden || document.hidden) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    // A conservative DPR cap prevents excessive GPU memory on high-density phones.
    const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 600 ? 1.25 : 1.5);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniforms.morph, morph);
    gl.uniform1f(uniforms.yaw, yaw);
    gl.uniform1f(uniforms.aspect, width / height);
    gl.drawElements(gl.TRIANGLES, meshCount, gl.UNSIGNED_SHORT, 0);
  }

  function tick(now) {
    raf = 0;
    if (tween) {
      const position = Math.min(1, Math.max(0, (now - tween.startAt) / tween.duration));
      const easing = position * position * (3 - 2 * position);
      morph = tween.from + (tween.to - tween.from) * easing;
      updateControl();
      if (position >= 1) tween = null;
    }
    draw();
    if (tween) schedule();
  }

  function schedule() {
    if (!raf && gl && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function setMorph(value) {
    tween = null;
    morph = Math.max(0, Math.min(1, Number(value) || 0));
    updateControl();
    schedule();
  }

  function animateTo(value) {
    if (prefersReducedMotion.matches || !gl) {
      setMorph(value);
      return;
    }
    tween = {
      from: morph,
      to: Math.max(0, Math.min(1, value)),
      startAt: performance.now(),
      duration: 700
    };
    schedule();
  }

  slider.addEventListener("input", () => setMorph(Number(slider.value) / 100));
  button.addEventListener("click", () => animateTo(morph >= 0.5 ? 0 : 1));
  reset.addEventListener("click", () => {
    yaw = -0.38;
    animateTo(0);
  });

  canvas.addEventListener("pointerdown", (event) => {
    tracking = event.pointerId;
    prevX = event.clientX;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (tracking !== event.pointerId) return;
    const delta = Math.max(-60, Math.min(60, event.clientX - prevX));
    prevX = event.clientX;
    yaw += delta * 0.012;
    schedule();
  });
  const endPointer = (event) => {
    if (tracking === event.pointerId) tracking = null;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      schedule();
    }
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    tween = null;
    failGracefully("El dispositivo ha perdido el contexto 3D. La alternativa 2D sigue operativa.");
  });
  canvas.addEventListener("webglcontextrestored", initialize);

  updateControl();
  // Paint the HTML/fallback first; WebGL is non-essential progressive enhancement.
  requestAnimationFrame(() => window.setTimeout(initialize, 0));
})();
