(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();

  // ---------- Clock + copy (no dependencies) ----------
  const fmtTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit' });
  const tick = () => { $('#clock').textContent = fmtTime.format(new Date()); };
  tick(); setInterval(tick, 20000);
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#email').textContent); $('#copy-msg').textContent = 'Copied to clipboard'; }
    catch { const r = document.createRange(); r.selectNodeContents($('#email')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('#copy-msg').textContent = 'Selected. Press Ctrl or Cmd and C to copy.'; }
  });

  // ---------- Particle field ----------
  const field = { ready: false, intro: 0, t1: 0, t2: 0 };
  function initParticles() {
    if (reduce || !window.THREE) return;
    const canvas = $('#stage');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' }); }
    catch { return; }
    root.classList.add('gl');
    const scene = new THREE.Scene();
    let W = innerWidth, H = innerHeight;
    const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
    const pr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    const uniforms = {
      uIntro: { value: 0 }, uT1: { value: 0 }, uT2: { value: 0 }, uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(9999, 9999) }, uMouseR: { value: 120 }, uSize: { value: 2.4 }, uPR: { value: pr },
      uColor: { value: new THREE.Color(css('--ink')) }, uAccent: { value: new THREE.Color(css('--red')) }, uAccent2: { value: new THREE.Color(css('--cobalt')) },
      uG1: { value: new THREE.Color() }, uG2: { value: new THREE.Color() }, uG3: { value: new THREE.Color() }, uHolo: { value: 0 }, uW: { value: innerWidth }, uH: { value: innerHeight },
      uBurstT: { value: 99 }, uBurstPos: { value: new THREE.Vector2(0, 0) }
    };
    const material = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false,
      vertexShader: `
        attribute vec2 aA; attribute vec2 aB; attribute vec2 aC; attribute float aSeed;
        uniform float uIntro, uT1, uT2, uTime, uMouseR, uSize, uPR, uW, uH, uBurstT; uniform vec2 uMouse; uniform vec2 uBurstPos;
        varying float vAlpha; varying float vHot; varying float vAcc; varying float vAcc2; varying vec2 vUV;
        float ease(float t) { return 1.0 - pow(1.0 - t, 4.0); }
        void main() {
          float s = aSeed;
          float pi = ease(clamp((uIntro - s * 0.45) / 0.55, 0.0, 1.0));
          float e1 = smoothstep(0.0, 1.0, clamp((uT1 - s * 0.3) / 0.7, 0.0, 1.0));
          float e2 = ease(clamp((uT2 - s * 0.35) / 0.65, 0.0, 1.0));
          float formed = pi * (1.0 - e1);
          vec2 p = mix(aB, aA, formed);
          p = mix(p, aC, e2);
          float fieldness = (1.0 - formed) * (1.0 - e2);
          float amp = 0.8 + 22.0 * fieldness;
          p += vec2(sin(uTime * 0.35 + s * 41.0), cos(uTime * 0.29 + s * 67.0)) * amp;
          if (uBurstT < 3.0) {
            vec2 bd = p - uBurstPos; float bl = max(length(bd), 1.0);
            float kick = exp(-uBurstT * 2.4) * (0.5 + 0.9 * fract(s * 91.7)) * smoothstep(900.0, 0.0, bl);
            float ang = s * 6.2831;
            p += (bd / bl) * 260.0 * kick + vec2(cos(ang), sin(ang)) * 90.0 * kick;
          }
          vec2 dm = p - uMouse; float d = length(dm);
          float f = smoothstep(uMouseR, 0.0, d);
          p += (dm / max(d, 0.001)) * f * mix(14.0, 46.0, max(formed, e2));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
          gl_PointSize = uSize * uPR * (0.65 + 0.7 * fract(s * 13.37)) * (1.0 - 0.35 * fieldness);
          vAlpha = mix(0.92, 0.2, fieldness);
          vHot = f;
          float r = fract(s * 7.31);
          vAcc = step(0.975, r);
          vAcc2 = step(0.93, r) * (1.0 - vAcc);
          vUV = vec2(clamp(aA.x / uW + 0.5, 0.0, 1.0), clamp(aA.y / uH + 0.5, 0.0, 1.0));
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform vec3 uAccent; uniform vec3 uAccent2; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform float uHolo; uniform float uTime;
        varying float vAlpha; varying float vHot; varying float vAcc; varying float vAcc2; varying vec2 vUV;
        vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
        void main() {
          vec2 c = gl_PointCoord - 0.5; float r = length(c);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.32, r) * vAlpha;
          float t = vUV.x;
          vec3 grad = t < 0.5 ? mix(uG1, uG2, t * 2.0) : mix(uG2, uG3, (t - 0.5) * 2.0);
          vec3 holo = hsv(fract(t * 0.85 + vUV.y * 0.3 - uTime * 0.05), 0.5, 1.0);
          vec3 col = mix(grad, holo, uHolo);
          col = mix(col, uAccent2, vAcc2);
          col = mix(col, uAccent, max(vAcc, vHot * 0.85));
          gl_FragColor = vec4(col, a);
        }`
    });
    let points, N = 0;

    function sampleText(lines, maxW, maxH, cy) {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d', { willReadFrequently: true });
      c.width = Math.ceil(W); c.height = Math.ceil(H);
      let size = 400;
      const font = s => `900 ${s}px "Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif`;
      ctx.font = font(size);
      const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
      size = Math.min(size * maxW / widest, maxH / (lines.length * 0.9));
      ctx.font = font(size);
      ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lh = size * 0.88, top = H / 2 - cy - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => {
        // tighten tracking by drawing per-letter
        const chars = [...l]; const track = -0.05 * size;
        const widths = chars.map(ch => ctx.measureText(ch).width);
        const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
        let x = W / 2 - total / 2; ctx.textAlign = 'left';
        chars.forEach((ch, j) => { ctx.fillText(ch, x, top + i * lh); x += widths[j] + track; });
      });
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const step = Math.max(2, Math.round(size / 70));
      const pts = [];
      for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
        if (data[(y * c.width + x) * 4 + 3] > 140) pts.push([x - W / 2 + (Math.random() - .5) * step, H / 2 - y + (Math.random() - .5) * step]);
      }
      return pts;
    }
    function pick(pts, n) { const out = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const p = pts[(Math.random() * pts.length) | 0] || [0, 0]; out[i * 2] = p[0]; out[i * 2 + 1] = p[1]; } return out; }

    function build() {
      W = innerWidth; H = innerHeight;
      renderer.setSize(W, H, false); uniforms.uW.value = W; uniforms.uH.value = H;
      Object.assign(camera, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 }); camera.updateProjectionMatrix();
      const narrow = W < 700;
      N = Math.round(Math.min(12000, Math.max(4000, W * H / 110)));
      uniforms.uSize.value = narrow ? 2.0 : 2.5;
      uniforms.uMouseR.value = narrow ? 80 : 130;
      const name = sampleText(narrow ? ['Pranav', 'Gupta'] : ['Pranav Gupta'], W * (narrow ? 0.86 : 0.88), H * (narrow ? 0.42 : 0.36), H * 0.06);
      const talk = sampleText(narrow ? ['Let’s', 'talk'] : ['Let’s talk'], W * (narrow ? 0.8 : 0.7), H * (narrow ? 0.34 : 0.3), H * 0.14);
      const A = pick(name, N), C = pick(talk, N), B = new Float32Array(N * 2), S = new Float32Array(N);
      for (let i = 0; i < N; i++) { B[i * 2] = (Math.random() - .5) * W * 1.08; B[i * 2 + 1] = (Math.random() - .5) * H * 1.08; S[i] = Math.random(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute('aA', new THREE.BufferAttribute(A, 2));
      g.setAttribute('aB', new THREE.BufferAttribute(B, 2));
      g.setAttribute('aC', new THREE.BufferAttribute(C, 2));
      g.setAttribute('aSeed', new THREE.BufferAttribute(S, 1));
      if (points) { scene.remove(points); points.geometry.dispose(); }
      points = new THREE.Points(g, material); points.frustumCulled = false; scene.add(points);
    }
    build();

    let mx = 9999, my = 9999, tmx = 9999, tmy = 9999;
    addEventListener('pointermove', e => { tmx = e.clientX - W / 2; tmy = H / 2 - e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { tmx = tmy = 9999; });
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 180); });
    const target = { fg: new THREE.Color(), a1: new THREE.Color(), a2: new THREE.Color(), g1: new THREE.Color(), g2: new THREE.Color(), g3: new THREE.Color(), holo: 0, add: 0 };
    let schemeEl = document.querySelector('[data-scheme]');
    const readScheme = () => { const cs = getComputedStyle(schemeEl); target.fg.set(cs.getPropertyValue('--p-fg').trim() || '#0B1530'); target.a1.set(cs.getPropertyValue('--p-a1').trim() || '#E0263C'); target.a2.set(cs.getPropertyValue('--p-a2').trim() || '#2B4BE0'); ['g1', 'g2', 'g3'].forEach(k => target[k].set(cs.getPropertyValue('--p-' + k).trim() || '#0B1530')); target.holo = parseFloat(cs.getPropertyValue('--p-holo')) || 0; target.add = parseFloat(cs.getPropertyValue('--p-add')) || 0; material.blending = target.add ? THREE.AdditiveBlending : THREE.NormalBlending; material.needsUpdate = true; };
    readScheme(); ['g1', 'g2', 'g3'].forEach(k => uniforms['uG' + k[1]].value.copy(target[k])); uniforms.uHolo.value = target.holo; uniforms.uColor.value.copy(target.fg); uniforms.uAccent.value.copy(target.a1); uniforms.uAccent2.value.copy(target.a2);
    field.setScheme = el => { schemeEl = el; readScheme(); };
    const recolor = () => readScheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
    new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    let visible = true; document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    const clock = new THREE.Clock();
    let burstAt = -1;
    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      mx += (tmx - mx) * 0.12; my += (tmy - my) * 0.12;
      if (Math.abs(tmx) > 5000) { mx = tmx; my = tmy; }
      uniforms.uMouse.value.set(mx, my);
      uniforms.uG1.value.lerp(target.g1, 0.07); uniforms.uG2.value.lerp(target.g2, 0.07); uniforms.uG3.value.lerp(target.g3, 0.07); uniforms.uHolo.value += (target.holo - uniforms.uHolo.value) * 0.07;
      uniforms.uColor.value.lerp(target.fg, 0.07); uniforms.uAccent.value.lerp(target.a1, 0.07); uniforms.uAccent2.value.lerp(target.a2, 0.07);
      uniforms.uTime.value = clock.getElapsedTime();
      uniforms.uBurstT.value = burstAt < 0 ? 99 : uniforms.uTime.value - burstAt;
      uniforms.uIntro.value = field.intro; uniforms.uT1.value = field.t1; uniforms.uT2.value = field.t2;
      renderer.render(scene, camera);
    }
    frame();
    // Click (or tap) the opening screen to scatter the points and watch them re-converge
    addEventListener('pointerdown', e => {
      if (scrollY > innerHeight * 0.6 || e.target.closest('a, button, input, .palette')) return;
      uniforms.uBurstPos.value.set(e.clientX - W / 2, H / 2 - e.clientY);
      burstAt = clock.getElapsedTime();
    });
    field.ready = true; field.N = N;
  }

  // ---------- Split helpers ----------
  function splitWords(el, cls) {
    const words = el.textContent.trim().split(/\s+/);
    const full = el.textContent.trim().replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
    el.innerHTML = `<span class="sr-only">${full}</span>` + words.map(w => cls === 'sw' ? `<span class="sw" aria-hidden="true">${w}</span>` : `<span class="w" aria-hidden="true"><span class="wi">${w}</span></span>`).join(' ');
    return $$(`#${el.id || (el.id = 'sp' + Math.random().toString(36).slice(2, 7))} .${cls === 'sw' ? 'sw' : 'wi'}`);
  }

  // ---------- Run ----------
  const fontsReady = Promise.race([
    document.fonts ? document.fonts.load('900 200px "Schibsted Grotesk"').then(() => document.fonts.ready) : Promise.resolve(),
    new Promise(r => setTimeout(r, 1800))
  ]);

  fontsReady.then(() => {
    if (hasGsap) initParticles();
    if (!hasGsap || reduce) {
      // Static, fully readable page. Count-up and reveals skipped.
      if (field.ready) { field.intro = 1; }
      return;
    }
    root.classList.add('js-anim');
    gsap.registerPlugin(ScrollTrigger);

    // Smooth scroll
    let lenis = null;
    if (window.Lenis) {
      lenis = window.__lenis = new Lenis({ duration: 1.15, smoothWheel: true, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const t = $(a.getAttribute('href')); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: 0, duration: 1.6 });
      }));
    }

    // Project visuals: phone numbers count up, bars grow, confidence bars fill
    let phonePlayed = false, chatPlayed = false;
    function playPhone() {
      if (phonePlayed) return; phonePlayed = true;
      gsap.from('#phone .ph-row', { x: -16, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out' });
      gsap.from('#phone .ph-split div', { y: 12, opacity: 0, duration: 0.8, stagger: 0.12, delay: 0.5, ease: 'expo.out' });
      $$('#phone [data-to]').forEach(el => { const to = +el.dataset.to, d = +el.dataset.dec, o = { v: 0 }; gsap.to(o, { v: to, duration: 1.8, delay: 0.3, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); } }); });
    }
    function playChat() {
      if (chatPlayed) return; chatPlayed = true;
      gsap.from('#chat .chat-in', { y: 16, opacity: 0, duration: 0.6, ease: 'expo.out' });
      gsap.from('#chat .chat-out', { y: 16, opacity: 0, duration: 0.6, delay: 0.35, ease: 'expo.out' });
      gsap.from('#chat .cond em', { scaleX: 0, duration: 1.2, stagger: 0.12, delay: 0.6, ease: 'expo.out' });
    }

    // Work: pinned horizontal reel on wide screens
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      const reel = $('#reel');
      const dist = () => reel.scrollWidth - innerWidth;
      const tween = gsap.to(reel, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 } });
      $$('.panel').forEach(p => {
        gsap.from(p.querySelector('.art') || p, { scale: 0.86, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: tween, start: 'left 100%', end: 'left 45%', scrub: true } });
      });
      ScrollTrigger.create({ trigger: '.work', start: 'top 55%', once: true, onEnter: playPhone });
      ScrollTrigger.create({ trigger: $('#chat').closest('.panel'), containerAnimation: tween, start: 'left 80%', once: true, onEnter: playChat });
      ScrollTrigger.create({ trigger: $('#cards').closest('.panel'), containerAnimation: tween, start: 'left 75%', onEnter: () => $('#cards').classList.add('fan') });
      // Progress readout: which project is in view
      const projects = $$('.panel[data-title]'), n = projects.length;
      const iEl = $('#reel-i'), nameEl = $('#reel-name'), fill = $('#reel-fill');
      let cur = -1;
      ScrollTrigger.create({ trigger: '.work', start: 'top top', end: () => '+=' + dist(), onUpdate: st => {
        fill.style.transform = `scaleX(${st.progress})`;
        const i = Math.min(n - 1, Math.floor(st.progress * n * 0.999));
        if (i !== cur) { cur = i; iEl.textContent = String(i + 1).padStart(2, '0'); nameEl.textContent = projects[i].dataset.title; gsap.fromTo(nameEl, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }); }
      } });
    });
    mm.add('(max-width: 899px)', () => {
      ScrollTrigger.create({ trigger: '#cards', start: 'top 75%', onEnter: () => $('#cards').classList.add('fan') });
      ScrollTrigger.create({ trigger: '#phone', start: 'top 85%', once: true, onEnter: playPhone });
      ScrollTrigger.create({ trigger: '#chat', start: 'top 85%', once: true, onEnter: playChat });
      $$('.panel').forEach(p => gsap.from(p, { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 88%' } }));
    });

    // Colour: the page crossfades to each section's scheme as it reaches the middle of the screen
    const schemed = $$('[data-scheme]');
    const applyScheme = (sec, instant) => {
      root.dataset.scheme = sec.dataset.scheme;
      const bg = getComputedStyle(sec).getPropertyValue('--sbg').trim();
      gsap.to(document.body, { backgroundColor: bg, duration: instant ? 0 : 0.9, ease: 'power2.out', overwrite: true });
      const glow = getComputedStyle(sec).getPropertyValue('--glow').trim(), gEl = $('#glow');
      if (glow && glow !== 'none') gEl.style.backgroundImage = glow;
      gsap.to(gEl, { opacity: glow && glow !== 'none' ? 1 : 0, duration: instant ? 0 : 1.1, ease: 'power2.out', overwrite: true });
      if (field.setScheme) field.setScheme(sec);
    };
    schemed.forEach((sec, i) => ScrollTrigger.create({
      trigger: sec, start: 'top 50%',
      onEnter: () => applyScheme(sec), onLeaveBack: () => applyScheme(schemed[Math.max(0, i - 1)])
    }));
    applyScheme(schemed[0], true);
    const reapply = () => applyScheme(schemed.find(x => x.dataset.scheme === root.dataset.scheme && ScrollTrigger.isInViewport(x)) || schemed[0], true);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reapply);

    // Intro: particles converge, counter runs, tagline rises
    const heroWords = splitWords($('.hero-tag'), 'w');
    const tagEl = $('.hero-tag'); tagEl.classList.add('split');
    const lineGrad = () => { const tw = tagEl.getBoundingClientRect(); heroWords.forEach(w => { const r = w.getBoundingClientRect(); w.style.backgroundSize = `${tw.width}px ${tw.height}px`; w.style.backgroundPosition = `${tw.left - r.left}px ${tw.top - r.top}px`; }); };
    lineGrad(); addEventListener('resize', lineGrad);
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(field, { intro: 1, duration: 3.2, ease: 'power2.inOut' }, 0)
      .from('.site-head .bar', { yPercent: -140, opacity: 0, duration: 1.2 }, 1.6)
      .from(heroWords, { yPercent: 110, duration: 1.2, stagger: 0.035 }, 1.7)
      .from('.hero [data-fade]', { opacity: 0, y: 16, duration: 1, stagger: 0.12 }, 2.1);
    if (!field.ready) { gsap.from('.hero-name', { yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out' }); }

    // Particles: disperse over the hero, re-form at contact
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true, onUpdate: s => { field.t1 = s.progress; } });
    ScrollTrigger.create({ trigger: '.contact', start: 'top 85%', end: 'top 10%', scrub: true, refreshPriority: -1, onUpdate: s => { field.t2 = s.progress; } });

    // Progress bar + header hide
    gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    let lastY = 0;
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => { const y = s.scroll(); $('.site-head').classList.toggle('hide', y > lastY && y > 200); lastY = y; } });

    // Statement: words light up as you read
    const sw = splitWords($('#statement'), 'sw');
    gsap.to(sw, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '#statement', start: 'top 80%', end: 'bottom 45%', scrub: true } });

    // Section titles rise word by word
    $$('[data-split]').forEach(el => {
      if (el.classList.contains('hero-tag')) return;
      const ws = splitWords(el, 'w');
      gsap.from(ws, { yPercent: 115, rotate: 4, duration: 1.3, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: el, start: 'top 88%' } });
    });
    $$('[data-fade]').forEach(el => {
      if (el.closest('.hero')) return;
      gsap.from(el, { opacity: 0, y: 24, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });

    // Experience: line draws, rows slide in
    gsap.from('.xp-line', { scaleY: 0, ease: 'none', scrollTrigger: { trigger: '.xp-list', start: 'top 75%', end: 'bottom 60%', scrub: true } });
    $$('[data-row]').forEach(r => gsap.from(r, { x: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: r, start: 'top 88%' } }));

    // Record: count up
    $$('[data-count]').forEach(el => {
      const to = +el.dataset.count, suf = el.dataset.suffix || '', o = { v: 0 };
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } }) });
    });

    // Marquee: two rows moving in opposite directions; speed and direction follow your scroll
    const rows = [[$('#mq'), 1], [$('#mq2'), -1]].map(([track, sign]) => {
      const set = track.firstElementChild;
      for (let i = 0; i < 3; i++) track.appendChild(set.cloneNode(true));
      return { track, set, sign, x: sign > 0 ? 0 : -(set.offsetWidth || 0) };
    });
    let dir = -1, skew = 0;
    gsap.ticker.add(() => {
      const v = lenis ? lenis.velocity : 0;
      if (v > 0.5) dir = -1; else if (v < -0.5) dir = 1;
      skew += ((Math.max(-8, Math.min(8, v * 0.4))) - skew) * 0.1;
      rows.forEach(r => {
        const w = r.set.offsetWidth || 1;
        r.x += dir * r.sign * (0.6 + Math.min(Math.abs(v) * 0.35, 14));
        if (r.x <= -w) r.x += w; if (r.x > 0) r.x -= w;
        r.track.style.transform = `translate3d(${r.x}px,0,0) skewX(${-skew * r.sign}deg)`;
      });
    });

    // Header: highlight the section you are in
    [['#work', 'work'], ['#experience', 'experience'], ['#record', 'record'], ['#contact', 'contact']].forEach(([sel, id]) => {
      const link = $(`.nav a[href="#${id}"]`);
      ScrollTrigger.create({ trigger: sel, start: 'top 50%', end: 'bottom 50%', onToggle: st => link && link.classList.toggle('on', st.isActive) });
    });

    // Contact: body fades up as letters form
    ScrollTrigger.refresh();
  });


  // ---------- Command palette (Cmd/Ctrl + K) ----------
  (() => {
    const pal = $('#palette'), q = $('#pal-q'), list = $('#pal-list'), opener = $('#open-palette');
    const go = sel => () => { const t = $(sel); if (!t) return; if (window.__lenis) window.__lenis.scrollTo(t, { duration: 1.4 }); else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    const link = href => () => { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
    const actions = [
      ['Go to selected work', 'Section', go('#work')],
      ['Go to experience', 'Section', go('#experience')],
      ['Go to record', 'Section', go('#record')],
      ['Go to contact', 'Section', go('#contact')],
      ['Back to the top', 'Section', go('#top')],
      ['Open resume (PDF)', 'Link', link('resume.pdf')],
      ['Copy email address', 'Action', () => $('#copy').click()],
      ['Open GitHub', 'Link', link('https://github.com/PranavGupta184')],
      ['Open LinkedIn', 'Link', link('https://www.linkedin.com/in/pranavgupta184')],
      ['Visit My Carbon Zero', 'Link', link('https://www.mycarbonzero.org')],
      ['Visit Idea Reach', 'Link', link('https://www.ideareach.org')]
    ];
    let shown = actions, idx = 0, lastFocus = null;
    const render = () => {
      list.innerHTML = shown.length ? shown.map((a, i) => `<li role="option" id="pal-${i}" aria-selected="${i === idx}">${a[0]}<span>${a[1]}</span></li>`).join('') : '<li class="empty">No matching actions</li>';
      q.setAttribute('aria-activedescendant', shown.length ? 'pal-' + idx : '');
      const sel = list.querySelector('[aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest' });
    };
    const open = () => { lastFocus = document.activeElement; pal.hidden = false; q.value = ''; shown = actions; idx = 0; render(); q.focus(); if (window.__lenis) window.__lenis.stop(); };
    const close = () => { pal.hidden = true; if (window.__lenis) window.__lenis.start(); if (lastFocus && lastFocus.focus) lastFocus.focus(); };
    const run = i => { const a = shown[i]; if (!a) return; close(); setTimeout(a[2], 60); };
    opener.addEventListener('click', open);
    q.addEventListener('input', () => { const t = q.value.toLowerCase().trim(); shown = actions.filter(a => (a[0] + ' ' + a[1]).toLowerCase().includes(t)); idx = 0; render(); });
    list.addEventListener('click', e => { const li = e.target.closest('li[role="option"]'); if (li) run(+li.id.split('-')[1]); });
    list.addEventListener('pointermove', e => { const li = e.target.closest('li[role="option"]'); if (li) { const i = +li.id.split('-')[1]; if (i !== idx) { idx = i; render(); } } });
    pal.addEventListener('pointerdown', e => { if (e.target === pal) close(); });
    document.addEventListener('keydown', e => {
      const typing = /input|textarea/i.test(document.activeElement && document.activeElement.tagName) && document.activeElement !== q;
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal.hidden ? open() : close(); return; }
      if (e.key === '/' && pal.hidden && !typing) { e.preventDefault(); open(); return; }
      if (pal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) { idx = (idx + 1) % shown.length; render(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { idx = (idx - 1 + shown.length) % shown.length; render(); } }
      else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
      else if (e.key === 'Tab') { e.preventDefault(); q.focus(); }
    });
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) opener.querySelector('kbd').textContent = 'Ctrl';
  })();

  // ---------- Tilt project visuals toward the cursor ----------
  $$('.panel .art').forEach(art => {
    const wrap = document.createElement('div'); wrap.className = 'tilt';
    [...art.children].filter(c => !c.matches('.art-note, .ev-chip')).forEach(c => wrap.appendChild(c));
    art.prepend(wrap);
    if (!fine || reduce) return;
    art.addEventListener('pointermove', e => { const r = art.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; wrap.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg'); wrap.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg'); });
    art.addEventListener('pointerleave', () => { wrap.style.setProperty('--ry', '0deg'); wrap.style.setProperty('--rx', '0deg'); });
  });

  // ---------- Cursor + magnetic (independent of GSAP) ----------
  if (fine && !reduce) {
    root.classList.add('has-cursor');
    const dot = $('.cur'), ring = $('.cur-ring');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; dot.style.transform = `translate3d(${x}px,${y}px,0)`; }, { passive: true });
    (function loop() { rx += (x - rx) * 0.16; ry += (y - ry) * 0.16; ring.style.transform = `translate3d(${rx}px,${ry}px,0)`; requestAnimationFrame(loop); })();
    const label = ring.querySelector('.cur-label');
    const hot = 'a, button, [data-hover]';
    document.addEventListener('pointerover', e => {
      const t = e.target.closest(hot); if (!t) return;
      ring.classList.add('big');
      const l = e.target.closest('[data-cursor]');
      if (l) { label.textContent = l.dataset.cursor; ring.classList.add('labelled'); } else ring.classList.remove('labelled');
    });
    document.addEventListener('pointerout', e => {
      const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget : null;
      if (!(to && to.closest(hot))) ring.classList.remove('big', 'labelled');
      else if (!to.closest('[data-cursor]')) ring.classList.remove('labelled');
    });
    // Spotlight that follows the cursor across project panels
    $$('.panel').forEach(pn => pn.addEventListener('pointermove', e => { const r = pn.getBoundingClientRect(); pn.style.setProperty('--mx', (e.clientX - r.left) + 'px'); pn.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));
    // Nav links scramble through digits before settling, a nod to random sampling
    const glyphs = '0123456789+−×÷=%';
    $$('.nav a, .brand').forEach(a => {
      const target = a.firstChild && a.firstChild.nodeType === 3 ? a.firstChild : null; if (!target) return;
      const orig = target.textContent; let raf = 0;
      a.addEventListener('pointerenter', () => {
        cancelAnimationFrame(raf); const t0 = performance.now(), dur = 420;
        const step = now => {
          const k = Math.min(1, (now - t0) / dur), done = Math.floor(k * orig.length);
          target.textContent = orig.split('').map((ch, i) => i < done || ch === ' ' ? ch : glyphs[(Math.random() * glyphs.length) | 0]).join('');
          if (k < 1) raf = requestAnimationFrame(step); else target.textContent = orig;
        };
        raf = requestAnimationFrame(step);
      });
    });
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); el.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .5s cubic-bezier(.2,.7,.1,1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 500); });
    });
  }
})();
