import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, t) => a + (b - a) * t, sm = (t) => t * t * (3 - 2 * t);
const lite = location.search.includes('lite'); const mobile = matchMedia('(max-width:900px)').matches, reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ================= ESCENA 3D: la cápsula que viaja por la página ================= */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2)); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .1, 60); camera.position.set(0, 0, 8);
scene.add(new THREE.AmbientLight(0x6fd8c8, .55)); const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
const rim = new THREE.PointLight(0x2dd4bf, 40, 12); rim.position.set(-3, -1, 3); scene.add(rim);
const root = new THREE.Group(), cap = new THREE.Group(); root.add(cap); scene.add(root);

// --- cuentas de la cápsula (1 draw call, ensamblado en el shader) ---
const N = mobile ? 900 : 1500, R = 1.55, base = new THREE.IcosahedronGeometry(1, 1);
const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('normal', base.getAttribute('normal'));
const shell = new Float32Array(N * 3), scat = new Float32Array(N * 3), seed = new Float32Array(N), cmix = new Float32Array(N), size = new Float32Array(N);
let m = 0; const open = new THREE.Vector3(.25, .12, 1).normalize(); const golden = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < N * 1.25 && m < N; i++) {
  const y = 1 - (i / (N * 1.25 - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i, d = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
  if (d.dot(open) > .8) continue; // abertura (corte) para ver el interior
  shell.set([d.x * R, d.y * R, d.z * R], m * 3); const sd = Math.random();
  const sc = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(2.6 + Math.random() * 3.2); scat.set([sc.x, sc.y, sc.z], m * 3);
  seed[m] = sd; cmix[m] = Math.random(); size[m] = .045 + Math.random() * .03; m++;
}
g.instanceCount = m;
g.setAttribute('aShell', new THREE.InstancedBufferAttribute(shell, 3)); g.setAttribute('aScat', new THREE.InstancedBufferAttribute(scat, 3));
g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1)); g.setAttribute('aCol', new THREE.InstancedBufferAttribute(cmix, 1)); g.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 1));
const beadMat = new THREE.ShaderMaterial({
  uniforms: { uA: { value: 1 }, uT: { value: 0 }, uMix: { value: 0 }, uPulse: { value: 0 } },
  vertexShader: `attribute vec3 aShell,aScat; attribute float aSeed,aCol,aSize; uniform float uA,uT,uPulse; varying vec3 vN,vV; varying float vC,vS;
  void main(){ float k=smoothstep(0.,1.,clamp(uA*1.35-aSeed*.35,0.,1.)); vec3 p=mix(aScat,aShell,k); vec3 dir=normalize(aShell);
   p+=dir*(sin(uT*1.6+aSeed*40.)*.012*k + uPulse*.06*k*sin(aSeed*9.+uT*3.)); p+=(1.-k)*vec3(sin(uT*.7+aSeed*30.),cos(uT*.6+aSeed*20.),sin(uT*.5+aSeed*10.))*.18;
   vec4 mv=modelViewMatrix*vec4(p+position*aSize*(1.+uPulse*.25),1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vC=aCol; vS=k; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uMix,uT; varying vec3 vN,vV; varying float vC,vS;
  void main(){ vec3 A=vec3(.10,.72,.62), B=vec3(.58,.88,.24), D=vec3(.04,.30,.34); float mx=clamp(vC*.55+uMix,0.,1.); vec3 base=mix(mix(D,A,vC),B,mx);
   float d=max(dot(vN,normalize(vec3(.5,.7,.6))),0.), f=pow(1.-max(dot(vN,vV),0.),2.4), s=pow(max(dot(reflect(-normalize(vec3(.5,.7,.6)),vN),vV),0.),22.);
   vec3 col=base*(.18+d*.75)+vec3(.15,.8,.7)*f*.45+vec3(.8,1.,.95)*s*.35; gl_FragColor=vec4(col*(.5+.5*vS),1.); }`
});
const beads = new THREE.Mesh(g, beadMat); beads.frustumCulled = false; cap.add(beads);

// --- núcleo: hojas, bayas y centro luminoso ---
const core = new THREE.Group(); cap.add(core);
const leafM = new THREE.MeshStandardMaterial({ color: 0x4fbf3a, emissive: 0x0b4a18, roughness: .45, metalness: .1 });
for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 12), leafM); l.scale.set(1, .09, .42); l.position.set((Math.random() - .5) * .6, (Math.random() - .3) * .5, (Math.random() - .5) * .6); l.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); l.userData.s = Math.random() * 6; core.add(l); }
const berryM = new THREE.MeshStandardMaterial({ color: 0x3b1f66, emissive: 0x1a0b3a, roughness: .25, metalness: .3 });
for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.09 + Math.random() * .07, 16, 12), berryM); b.position.set((Math.random() - .5) * 1.0, (Math.random() - .5) * 1.0, (Math.random() - .5) * 1.0); b.userData.s = Math.random() * 6; core.add(b); }
const glow = new THREE.Mesh(new THREE.SphereGeometry(.34, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5ff0c0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); core.add(glow);
const coreLight = new THREE.PointLight(0x4fffc8, 8, 5); core.add(coreLight);

// --- burbujas (fermentación) y partículas orbitales ---
const BN = 220, bp = new Float32Array(BN * 3), bs = new Float32Array(BN);
for (let i = 0; i < BN; i++) { bs[i] = Math.random(); bp[i * 3] = (Math.random() - .5) * 1.5; bp[i * 3 + 1] = (Math.random() - .5) * 2.4; bp[i * 3 + 2] = (Math.random() - .5) * 1.5; }
const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
const bubM = new THREE.PointsMaterial({ color: 0xc8ff7a, size: .07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
const bubbles = new THREE.Points(bg, bubM); cap.add(bubbles);
const PN = mobile ? 260 : 520, pp = new Float32Array(PN * 3), pa = new Float32Array(PN * 3);
for (let i = 0; i < PN; i++) { const a = Math.random() * 6.283, r = 2.2 + Math.random() * 1.8, y = (Math.random() - .5) * 2.4; pa.set([a, r, y], i * 3); }
const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const partM = new THREE.PointsMaterial({ color: 0x5ff0d8, size: .045, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
const parts = new THREE.Points(pg, partM); cap.add(parts);
const ringMats = [], rings = new THREE.Group(); cap.add(rings);
[2.25, 2.7, 3.15].forEach((r, i) => { const mt = new THREE.MeshBasicMaterial({ color: i === 1 ? 0x9bdc3c : 0x2dd4bf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); ringMats.push(mt); const t = new THREE.Mesh(new THREE.TorusGeometry(r, .008, 8, 160), mt); t.rotation.set(1.2 + i * .5, i * .8, 0); rings.add(t); });

// --- postproceso ---
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), mobile ? .22 : .32, .5, .62); composer.addPass(bloom); composer.addPass(new OutputPass());
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---- keyframes por sección (data-cap) ---- */
const keys = $$('[data-cap]').map((el) => ({ el, k: JSON.parse(el.dataset.cap) }));
const P = { x: .38, y: 0, s: 1.0, asm: 0, mix: 0, core: 1, bub: 0, ring: 1 }, T = { ...P };
function targetAt() {
  const c = scrollY + innerHeight * .5, pts = keys.map((o) => { const r = o.el.getBoundingClientRect(); return { c: r.top + scrollY + r.height / 2, k: o.k }; });
  if (c <= pts[0].c) return pts[0].k; if (c >= pts[pts.length - 1].c) return pts[pts.length - 1].k;
  for (let i = 0; i < pts.length - 1; i++) if (c >= pts[i].c && c < pts[i + 1].c) { const t = sm((c - pts[i].c) / (pts[i + 1].c - pts[i].c)), o = {}; for (const k in pts[i].k) o[k] = lerp(pts[i].k[k], pts[i + 1].k[k], t); return o; }
  return pts[0].k;
}
let mx = 0, my = 0, tx = 0, ty = 0, spin = 0, lastY = scrollY, vel = 0; const clock = new THREE.Clock();
addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; });
let drag = false, dx = 0, dy = 0, rotX = 0, rotY = 0;
addEventListener('pointerdown', (e) => { if (e.target.closest('a,button,input,textarea,.card,.stepc,.p')) return; drag = true; dx = e.clientX; dy = e.clientY; });
addEventListener('pointerup', () => drag = false);
addEventListener('pointermove', (e) => { if (!drag) return; rotY += (e.clientX - dx) * .008; rotX += (e.clientY - dy) * .005; dx = e.clientX; dy = e.clientY; });
const visH = () => 2 * 8 * Math.tan(camera.fov * Math.PI / 360);
function frame() {
  const dt = Math.min(clock.getDelta(), .1), t = clock.elapsedTime, kk = 1 - Math.exp(-dt * 3.2);
  Object.assign(T, targetAt()); for (const k in P) P[k] = lerp(P[k], T[k], kk);
  const vh = visH(), vw = vh * camera.aspect, X = mobile || innerWidth < 900 ? 0 : P.x;
  root.position.set(X * vw * .5, P.y * vh * .5 + (mobile ? vh * .22 : 0), 0);
  const sc = P.s * (mobile ? .62 : 1) * (vh / 5.5); root.scale.setScalar(sc * (innerWidth < 900 ? Math.min(1, innerWidth / 700) : 1));
  mx = lerp(mx, tx, kk); my = lerp(my, ty, kk); vel = lerp(vel, scrollY - lastY, .1); lastY = scrollY; spin += vel * .0016;
  cap.rotation.y = t * .18 + mx * .5 + rotY + spin; cap.rotation.x = Math.sin(t * .3) * .12 + my * .25 + rotX; cap.rotation.z = Math.sin(t * .2) * .06;
  const pulse = (Math.sin(t * Math.PI * 2 * (128 / 60) / 2) * .5 + .5) ** 3 * .6 + clamp(Math.abs(vel) * .02);
  beadMat.uniforms.uA.value = P.asm; beadMat.uniforms.uT.value = t; beadMat.uniforms.uMix.value = P.mix; beadMat.uniforms.uPulse.value = pulse;
  core.scale.setScalar(.25 + P.core * 1.0 + pulse * .05); core.rotation.y = -t * .4; glow.material.opacity = .35 + .25 * Math.sin(t * 2) + pulse * .3; coreLight.intensity = 6 + pulse * 10;
  core.children.forEach((o) => { if (o.userData.s !== undefined) o.position.y += Math.sin(t * 1.3 + o.userData.s) * .0009; });
  bubM.opacity = P.bub * .9;
  if (P.bub > .02) { const a = bg.attributes.position; for (let i = 0; i < BN; i++) { let y = a.getY(i) + (.006 + bs[i] * .014) * (1 + vel * .02); if (y > 1.4) y = -1.4; a.setY(i, y); a.setX(i, a.getX(i) + Math.sin(t * 2 + i) * .0016); } a.needsUpdate = true; }
  { const a = pg.attributes.position; for (let i = 0; i < PN; i++) { const an = pa[i * 3] + t * (.06 + (i % 5) * .012), r = pa[i * 3 + 1] * (.8 + P.ring * .35 + pulse * .04); a.setXYZ(i, Math.cos(an) * r, pa[i * 3 + 2] + Math.sin(t * .5 + i) * .1, Math.sin(an) * r); } a.needsUpdate = true; partM.opacity = .25 + P.ring * .6; }
  ringMats.forEach((mt, i) => mt.opacity = P.ring * (.28 - i * .05)); rings.rotation.y = t * .1; rings.rotation.x = t * .06;
  rim.intensity = 30 + pulse * 40;
  if (!lite) composer.render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ================= INTERACCIONES ================= */
// carga
addEventListener('load', () => setTimeout(() => $('#loader').classList.add('off'), 350)); setTimeout(() => $('#loader').classList.add('off'), 3500);
// titulares por palabras
$$('.split').forEach((h) => { const walk = (n) => { [...n.childNodes].forEach((c) => { if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach((w, i) => { if (!w.trim()) { f.append(w); return; } const o = document.createElement('span'); o.className = 'w'; const s = document.createElement('span'); s.textContent = w; s.style.transitionDelay = (i * .035) + 's'; o.append(s); f.append(o); }); c.replaceWith(f); } else if (c.nodeType === 1) walk(c); }); }; walk(h); });
// reveal
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); const c = $('.chart', e.target); if (c) c.classList.add('in'); $$('.bar i', e.target).forEach((b) => b.style.width = b.dataset.w + '%'); $$('[data-count]', e.target).forEach(count); if (e.target.classList.contains('tilt')) setTimeout(() => e.target.style.transition = 'transform .18s ease-out', 1100); io.unobserve(e.target); } }), { threshold: .18 });
$$('.rv,.split').forEach((el) => io.observe(el));
function count(el) { const to = +el.dataset.count, t0 = performance.now(); (function s(n) { const k = clamp((n - t0) / 1800); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(s); })(t0); }
// tilt 3D
$$('.tilt').forEach((el) => { el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`; }); el.addEventListener('pointerleave', () => el.style.transform = ''); });
// imágenes con parallax
const pars = $$('.par');
// magnético
$$('.magnet').forEach((b) => { b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px,${(e.clientY - r.top - r.height / 2) * .35}px)`; }); b.addEventListener('pointerleave', () => b.style.transform = ''); });
// cursor luminoso
const cur = $('#cursor'); addEventListener('pointermove', (e) => { cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; });
// scroll: nav, barra, TRL
const nav = $('#nav'), prog = $('#progress'), trl = $('#trl'), fill = $('.fill', trl), nodes = $$('.nodes b', trl);
function onScroll() {
  nav.classList.toggle('sc', scrollY > 40); prog.style.width = (scrollY / (document.body.scrollHeight - innerHeight) * 100) + '%';
  pars.forEach((p) => { const r = p.getBoundingClientRect(); p.style.transform = `translateY(${(r.top + r.height / 2 - innerHeight / 2) * parseFloat(p.dataset.s || .05)}px)`; });
  const r = trl.getBoundingClientRect(), k = clamp((innerHeight * .75 - r.top) / (innerHeight * .5)); fill.style.width = (k * 100) + '%'; nodes.forEach((n, i) => n.classList.toggle('hit', i / 8 <= k + .001));
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();
