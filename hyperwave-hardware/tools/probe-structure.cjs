// Lists the top-level structure of the real Hyperwave model and world AABBs at several T values.
const pc = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
(async () => {
  const b = await pc.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
  const p = await b.newPage();
  await p.goto((process.argv[2] || 'http://127.0.0.1:8731') + '/audio/hyperwave/', { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.__hw && document.body.classList.contains('ready'));
  const r = await p.evaluate(() => {
    const H = window.__hw.H, out = [];
    const box = (o) => { const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? null : [b.min.toArray().map((v) => +v.toFixed(3)), b.max.toArray().map((v) => +v.toFixed(3))]; };
    for (const T of [0, 1, 2, 3, 4]) {
      H.update(T, 0, { params: window.__hw.st.params }); H.root.updateMatrixWorld(true);
      H.root.children.forEach((c, i) => { let n = 0; c.traverse((o) => { if (o.isMesh) n++; }); out.push({ T, i, type: c.type, vis: c.visible, pos: c.position.toArray().map((v) => +v.toFixed(3)), rot: [c.rotation.x, c.rotation.y, c.rotation.z].map((v) => +v.toFixed(3)), meshes: n, box: box(c) }); });
    }
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
