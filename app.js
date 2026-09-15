(() => {
  const canvas = document.getElementById('chamber');
  const frame = document.getElementById('chamber-frame');
  const ctx = canvas.getContext('2d', { alpha: false });
  const sources = {
    alpha: document.getElementById('source-alpha'),
    beta: document.getElementById('source-beta'),
    muon: document.getElementById('source-muon'),
  };
  const pace = document.getElementById('pace');
  const paceValue = document.getElementById('pace-value');
  const pauseButton = document.getElementById('pause-button');
  const pauseLabel = document.getElementById('pause-label');
  const pauseIcon = document.getElementById('pause-icon');
  const clearButton = document.getElementById('clear-button');
  const statusText = document.getElementById('status-text');
  const status = document.querySelector('.stage-status');
  const emptyState = document.getElementById('empty-state');
  const idleInspector = document.getElementById('inspector-idle');
  const activeInspector = document.getElementById('inspector-active');
  const inspectorGlyph = document.getElementById('inspector-glyph');
  const inspectorTitle = document.getElementById('inspector-title');
  const inspectorClue = document.getElementById('inspector-clue');
  const inspectorParticle = document.getElementById('inspector-particle');
  const css = getComputedStyle(document.documentElement);
  const theme = {
    alpha: css.getPropertyValue('--track-alpha').trim(),
    beta: css.getPropertyValue('--track-beta').trim(),
    muon: css.getPropertyValue('--track-muon').trim(),
    chamber: css.getPropertyValue('--chamber-bg').trim(),
    grid: css.getPropertyValue('--chamber-grid').trim(),
    mist: css.getPropertyValue('--cyan').trim(),
  };

  const descriptions = {
    alpha: { glyph: 'α', title: 'A dense, short trail', clue: 'Many droplets sit close together. Alpha particles ionise strongly but travel only a short distance in air.', particle: 'Alpha particle', color: theme.alpha },
    beta: { glyph: 'β', title: 'A fine, wandering trail', clue: 'This thinner trail can bend or scatter. A beta particle is an electron and usually ionises less densely than an alpha particle.', particle: 'Beta particle (electron)', color: theme.beta },
    muon: { glyph: 'μ', title: 'A long, fine trail', clue: 'A cosmic muon often passes right across the chamber, leaving a nearly straight, thin trail.', particle: 'Cosmic muon', color: theme.muon },
  };

  let width = 1;
  let height = 1;
  let tracks = [];
  let selectedId = null;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFrame = performance.now();
  let simulationTime = 0;
  let nextEvent = 0;
  let nextId = 1;
  let speckles = [];

  function random(min, max) { return min + Math.random() * (max - min); }
  function enabledTypes() { return Object.keys(sources).filter(type => sources[type].checked); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    speckles = Array.from({ length: Math.round(width * height / 850) }, () => ({ x: Math.random() * width, y: Math.random() * height, r: random(.25, 1.1), a: random(.035, .16) }));
    draw();
  }

  function makeTrack(type, age = 0) {
    const points = [];
    if (type === 'muon') {
      const y0 = random(.19, .74);
      const slope = random(-.27, .27);
      for (let i = 0; i <= 48; i++) {
        const t = i / 48;
        points.push({ x: -.06 + 1.12 * t, y: y0 + slope * t + Math.sin(t * Math.PI * 2) * .003 });
      }
    } else if (type === 'alpha') {
      const x0 = random(.12, .68);
      const y0 = random(.17, .76);
      const angle = random(-Math.PI, Math.PI);
      const distance = random(.19, .31);
      for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        points.push({ x: x0 + Math.cos(angle) * distance * t + Math.sin(t * 9) * .002, y: y0 + Math.sin(angle) * distance * t + Math.cos(t * 8) * .002 });
      }
    } else {
      const x0 = random(.18, .72);
      const y0 = random(.18, .72);
      const angle = random(-Math.PI, Math.PI);
      const distance = random(.32, .52);
      const bend = random(-1, 1);
      const wobble = random(.012, .028);
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        const side = wobble * Math.sin(t * 12 + bend) + bend * .06 * t * t;
        points.push({ x: x0 + Math.cos(angle) * distance * t - Math.sin(angle) * side, y: y0 + Math.sin(angle) * distance * t + Math.cos(angle) * side });
      }
    }
    const track = { id: nextId++, type, points, born: simulationTime - age, seed: Math.random() * 1000 };
    tracks.push(track);
    if (tracks.length > 16) tracks.shift();
    return track;
  }

  function drawBackground() {
    ctx.fillStyle = theme.chamber;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = theme.mist;
    for (const speckle of speckles) {
      ctx.beginPath();
      ctx.globalAlpha = speckle.a;
      ctx.arc(speckle.x, speckle.y, speckle.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = .28;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 70; x < width; x += 76) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 72; y < height; y += 76) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  function pointPx(point) { return { x: point.x * width, y: point.y * height }; }
  function drawTrack(track) {
    const age = simulationTime - track.born;
    const reveal = clamp(age / .75, 0, 1);
    const fade = age < 5.6 ? 1 : clamp((8.5 - age) / 2.9, 0, 1);
    if (fade <= 0 || reveal <= 0) return;
    const selected = track.id === selectedId;
    const info = descriptions[track.type];
    const count = Math.max(2, Math.floor((track.points.length - 1) * reveal));
    ctx.save();
    ctx.globalAlpha = fade * (selected ? 1 : .85);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= count; i++) {
      const p = pointPx(track.points[i]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = info.color;
    ctx.shadowColor = info.color;
    ctx.shadowBlur = selected ? 22 : (track.type === 'alpha' ? 16 : 11);
    ctx.lineWidth = track.type === 'alpha' ? 8 : (track.type === 'beta' ? 3 : 2.5);
    ctx.globalAlpha *= track.type === 'alpha' ? .38 : .32;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = fade * (selected ? .9 : .7);
    ctx.lineWidth = track.type === 'alpha' ? 2.5 : 1;
    ctx.stroke();
    for (let i = 0; i <= count; i += track.type === 'alpha' ? 1 : 2) {
      const p = pointPx(track.points[i]);
      const jitter = Math.sin(i * 34.8 + track.seed);
      const radius = track.type === 'alpha' ? randomRadius(i, track.seed, 1.1, 2.6) : randomRadius(i, track.seed, .55, 1.25);
      ctx.fillStyle = info.color;
      ctx.globalAlpha = fade * (selected ? .98 : .74);
      ctx.beginPath();
      ctx.arc(p.x + jitter * (track.type === 'alpha' ? 3.1 : 1.2), p.y + Math.cos(i * 19 + track.seed) * (track.type === 'alpha' ? 3.1 : 1.2), radius, 0, Math.PI * 2);
      ctx.fill();
      if (track.type === 'alpha') {
        ctx.globalAlpha = fade * .37;
        ctx.beginPath();
        ctx.arc(p.x - jitter * 4, p.y - Math.cos(i * 19 + track.seed) * 4, radius * .8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (selected) {
      const p = pointPx(track.points[Math.floor(count * .55)]);
      ctx.globalAlpha = fade;
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 1;
      ctx.beginPath();ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);ctx.stroke();
      ctx.beginPath();ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);ctx.stroke();
    }
    ctx.restore();
  }

  function randomRadius(i, seed, min, max) { return min + ((Math.sin(i * 78.23 + seed * 3.1) + 1) / 2) * (max - min); }
  function draw() { drawBackground(); for (const track of tracks) drawTrack(track); }

  function updateInspector(track) {
    if (!track) {
      selectedId = null;
      idleInspector.hidden = false;
      activeInspector.hidden = true;
      return;
    }
    selectedId = track.id;
    const info = descriptions[track.type];
    inspectorGlyph.textContent = info.glyph;
    inspectorGlyph.className = `${track.type}-visual`;
    inspectorTitle.textContent = info.title;
    inspectorClue.textContent = info.clue;
    inspectorParticle.textContent = info.particle;
    idleInspector.hidden = true;
    activeInspector.hidden = false;
  }

  function segmentDistance(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let closest = null, closestDistance = 22;
    for (const track of tracks) {
      const age = simulationTime - track.born;
      if (age >= 8.5) continue;
      const count = Math.floor((track.points.length - 1) * clamp(age / .75, 0, 1));
      for (let i = 1; i <= count; i++) {
        const distance = segmentDistance(x, y, pointPx(track.points[i - 1]), pointPx(track.points[i]));
        if (distance < closestDistance) { closestDistance = distance; closest = track; }
      }
    }
    updateInspector(closest);
    draw();
  });

  function updateSources() {
    const enabled = enabledTypes();
    emptyState.hidden = enabled.length > 0;
    if (enabled.length === 0) { tracks = []; updateInspector(null); }
    else if (!tracks.some(track => enabled.includes(track.type))) { makeTrack(enabled[Math.floor(Math.random() * enabled.length)], .7); }
    draw();
  }
  for (const input of Object.values(sources)) input.addEventListener('change', updateSources);
  pace.addEventListener('input', () => { paceValue.textContent = ['Slow', 'Steady', 'Busy'][Number(pace.value) - 1]; nextEvent = simulationTime + [.95, .6, .32][Number(pace.value) - 1]; });

  function updatePauseButton() {
    pauseLabel.textContent = paused ? 'Resume' : 'Pause';
    pauseIcon.textContent = paused ? '▶' : 'Ⅱ';
    statusText.textContent = paused ? 'SIMULATION PAUSED' : 'SIMULATION RUNNING';
    status.classList.toggle('paused', paused);
    pauseButton.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
  }
  pauseButton.addEventListener('click', () => { paused = !paused; updatePauseButton(); });
  clearButton.addEventListener('click', () => { tracks = []; updateInspector(null); nextEvent = simulationTime + .5; draw(); });

  function animate(now) {
    const delta = Math.min((now - lastFrame) / 1000, .06);
    lastFrame = now;
    if (!paused) {
      simulationTime += delta;
      tracks = tracks.filter(track => simulationTime - track.born < 8.5);
      if (selectedId && !tracks.some(track => track.id === selectedId)) updateInspector(null);
      const enabled = enabledTypes();
      if (enabled.length && simulationTime >= nextEvent) {
        const type = enabled[Math.floor(Math.random() * enabled.length)];
        makeTrack(type);
        const interval = [3.1, 2.0, 1.2][Number(pace.value) - 1];
        nextEvent = simulationTime + interval * random(.72, 1.35);
      }
      draw();
    }
    requestAnimationFrame(animate);
  }

  new ResizeObserver(resize).observe(frame);
  resize();
  makeTrack('alpha', 1.2);
  makeTrack('beta', .9);
  makeTrack('muon', .6);
  nextEvent = 2;
  updatePauseButton();
  updateSources();
  requestAnimationFrame(animate);
})();
