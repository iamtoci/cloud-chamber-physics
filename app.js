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
  const identityLine = document.querySelector('.identity-line');
  const muonMore = document.getElementById('muon-more');
  const muonLegend = document.getElementById('muon-legend');
  const mechanismMore = document.getElementById('mechanism-more');
  const mechanismMorePanel = document.getElementById('mechanism-more-panel');
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
  let mystery = null;
  let labSaved = null;

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
    const concealed = mystery && mystery.trackId === track.id && !mystery.checked;
    inspectorTitle.textContent = concealed ? 'Unknown trail' : info.title;
    inspectorClue.textContent = concealed ? 'Look at its length, thickness and shape. Make a prediction before revealing the model’s answer.' : info.clue;
    inspectorParticle.textContent = concealed ? '' : info.particle;
    identityLine.hidden = Boolean(concealed);
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
  canvas.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const visible = tracks.filter(track => simulationTime - track.born < 8.5);
    if (!visible.length) return;
    const index = visible.findIndex(track => track.id === selectedId);
    updateInspector(visible[(index + 1) % visible.length]);
    draw();
  });

  function updateSources() {
    const enabled = enabledTypes();
    tracks = tracks.filter(track => enabled.includes(track.type));
    if (selectedId && !tracks.some(track => track.id === selectedId)) updateInspector(null);
    emptyState.hidden = enabled.length > 0;
    if (enabled.length === 0) { tracks = []; updateInspector(null); }
    else if (!tracks.some(track => enabled.includes(track.type))) { makeTrack(enabled[Math.floor(Math.random() * enabled.length)], .7); }
    draw();
  }
  for (const [type,input] of Object.entries(sources)) input.addEventListener('change', () => {
    if (input.checked) makeTrack(type, .7);
    updateSources();
  });
  muonMore.addEventListener('toggle', () => {
    muonLegend.hidden = !muonMore.open;
    if (!muonMore.open && sources.muon.checked) { sources.muon.checked = false; updateSources(); }
  });
  pace.addEventListener('input', () => { paceValue.textContent = ['Slow', 'Steady', 'Busy'][Number(pace.value) - 1]; nextEvent = simulationTime + [.95, .6, .32][Number(pace.value) - 1]; });

  function updatePauseButton() {
    pauseLabel.textContent = paused ? 'Resume' : 'Pause';
    pauseIcon.textContent = paused ? '▶' : 'Ⅱ';
    statusText.textContent = paused ? 'SIMULATION PAUSED' : 'SIMULATION RUNNING';
    status.classList.toggle('paused', paused);
    pauseButton.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
  }
  pauseButton.addEventListener('click', () => { paused = !paused; updatePauseButton(); });
  clearButton.addEventListener('click', () => {
    tracks = [];
    updateInspector(null);
    nextEvent = simulationTime + .5;
    if (currentStep === 'see' && coreState.seeSample) { coreState.seeSample = false; renderStep(); }
    if (currentStep === 'identify' && coreState.unknown) { coreState.unknown = null; mystery = null; renderStep(); }
    if (currentStep === 'predict' && coreState.predictRun) { coreState.predictRun = false; renderStep(); }
    draw();
  });

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

  const learning = globalThis.CloudChamberContent;
  const stepTabs = document.getElementById('step-tabs');
  const stepPanel = document.getElementById('step-panel');
  const stepIndex = document.getElementById('step-index');
  const stepHeading = document.getElementById('step-heading');
  const stepSummary = document.getElementById('step-summary');
  const stepInteraction = document.getElementById('step-interaction');
  const stepMoreButton = document.getElementById('step-more-button');
  const stepMorePanel = document.getElementById('step-more-panel');
  const coreProgress = document.getElementById('core-progress');
  const coreState = {
    seeSample: false, seeChoice: null, seeChecked: false,
    unknown: null, unknownGuess: null, unknownChecked: false, unknownWhy: null, unknownWhyChecked: false,
    explainChecked: false, explainCorrect: false,
    predictGuess: null, predictRun: false, predictWhy: null, predictWhyChecked: false,
    background: 2, counterSource: false, samples: [], measureChecked: false, measureCorrect: false,
    pair: null, dataInput: '', dataChecked: false, dataCorrect: false,
    applyChoice: null, applyEvidence: null, applyChecked: false,
  };
  let currentStep = 'see';
  let completed;
  try {
    const saved = JSON.parse(localStorage.getItem('cloud-chamber-core') || '[]');
    completed = new Set(Array.isArray(saved) ? saved.filter(id => learning.units.some(unit => unit.id === id)) : []);
  }
  catch { completed = new Set(); }

  function saveProgress() {
    try { localStorage.setItem('cloud-chamber-core', JSON.stringify([...completed])); }
    catch { /* Core work remains usable when local storage is unavailable. */ }
  }
  function completeStep(id) {
    if (!completed.has(id)) { completed.add(id); saveProgress(); renderTabs(); }
    coreProgress.textContent = `${completed.size} / ${learning.units.length}`;
  }
  function renderTabs() {
    stepTabs.innerHTML = learning.units.map((unit, index) => `<button id="tab-${unit.id}" role="tab" type="button" data-step="${unit.id}" aria-controls="step-panel" aria-selected="${unit.id === currentStep}" tabindex="${unit.id === currentStep ? 0 : -1}"><span>${String(index + 1).padStart(2, '0')}</span> ${unit.title} <b aria-hidden="true">${completed.has(unit.id) ? '■' : ''}</b></button>`).join('');
    coreProgress.textContent = `${completed.size} / ${learning.units.length}`;
  }
  function restoreLab() {
    if (!labSaved) return;
    mystery = null;
    for (const type of Object.keys(sources)) sources[type].checked = labSaved.sources[type];
    paused = labSaved.paused;
    labSaved = null;
    tracks = [];
    updateInspector(null);
    updateSources();
    nextEvent = simulationTime + .6;
    updatePauseButton();
  }
  function guidedScene(types, activeSources = ['alpha', 'beta']) {
    if (!labSaved) labSaved = { paused, sources: Object.fromEntries(Object.keys(sources).map(type => [type, sources[type].checked])) };
    for (const type of Object.keys(sources)) sources[type].checked = activeSources.includes(type);
    emptyState.hidden = true;
    paused = true;
    updatePauseButton();
    tracks = [];
    updateInspector(null);
    return types.map((type, index) => makeTrack(type, .85 - index * .1));
  }
  function showMore(panel, key, depth = 0) {
    const entry = learning.more[key][depth];
    panel.innerHTML = `<span class="instrument-label">OPTIONAL PHYSICS · BEYOND IGCSE</span><h4>${entry.title}</h4><p>${entry.text}</p>${depth === 0 ? '<button type="button" class="more-trigger" data-deeper="true">MORE ▸</button>' : ''}`;
  }
  mechanismMore.addEventListener('click', () => {
    const open = mechanismMore.getAttribute('aria-expanded') !== 'true';
    mechanismMore.setAttribute('aria-expanded', String(open));
    mechanismMorePanel.hidden = !open;
    if (open) showMore(mechanismMorePanel, 'see');
  });
  mechanismMorePanel.addEventListener('click', event => {
    if (event.target.closest('[data-deeper]')) showMore(mechanismMorePanel, 'see', 1);
  });
  stepMoreButton.addEventListener('click', () => {
    const open = stepMoreButton.getAttribute('aria-expanded') !== 'true';
    stepMoreButton.setAttribute('aria-expanded', String(open));
    stepMorePanel.hidden = !open;
    if (open) showMore(stepMorePanel, currentStep);
  });
  stepMorePanel.addEventListener('click', event => {
    if (event.target.closest('[data-deeper]')) showMore(stepMorePanel, currentStep, 1);
  });

  const choice = (name, options) => `<div class="choice-list" role="group" aria-label="Choose an answer">${options.map((label, index) => `<label><input type="radio" name="${name}" value="${index}" /><span>${label}</span></label>`).join('')}</div>`;
  const feedback = (message, good) => `<p class="task-feedback ${good ? 'good' : 'retry'}" role="status">${message}</p>`;
  const chamberLink = '<a class="chamber-link" href="#chamber-frame">VIEW CHAMBER ↑</a>';
  function renderActivity() {
    switch (currentStep) {
      case 'see': return `<p class="task-prompt">[ NEW SAMPLE ] shows one alpha and one beta trail. Which difference can you actually observe?</p><button type="button" class="control-button" data-action="see-sample">[ NEW SAMPLE ]</button>${coreState.seeSample ? `${chamberLink}${choice('see-choice',['One trail is shorter and denser than the other','Every trail is identical','The particles themselves are visible'])}<button type="button" class="control-button" data-action="see-check">[ CHECK OBSERVATION ]</button>${coreState.seeChecked ? feedback(coreState.seeChoice === 0 ? 'Yes. Length and droplet density are visible clues; identity is inferred.' : 'Look for length and droplet density. We see the droplets, not the particle itself.', coreState.seeChoice === 0) : ''}` : ''}`;
      case 'identify': return `<p class="task-prompt">Predict the likely particle from one unknown simulated trail. The inspector withholds its identity until you check.</p><button type="button" class="control-button" data-action="unknown-new">[ NEW UNKNOWN TRAIL ]</button>${coreState.unknown ? `${chamberLink}<button type="button" class="control-button" data-action="unknown-inspect">[ INSPECT SAMPLE ]</button>${choice('unknown-guess',['Alpha','Beta'])}<button type="button" class="control-button" data-action="unknown-check">[ CHECK PREDICTION ]</button>${coreState.unknownChecked ? `${feedback(`The model generated a ${coreState.unknown.type} trail. ${coreState.unknownGuess === coreState.unknown.type ? 'Your prediction fits.' : 'Compare its length and thickness, then try another.'}`, coreState.unknownGuess === coreState.unknown.type)}<p class="task-prompt">Which observation supports that inference?</p>${choice('unknown-why',coreState.unknown.type === 'alpha' ? ['It is short and densely dotted','It crosses the whole chamber as a thin line','Its colour proves its charge'] : ['It is dense and short','It is fine and can wander','Its colour proves its charge'])}<button type="button" class="control-button" data-action="unknown-why-check">[ CHECK EVIDENCE ]</button>${coreState.unknownWhyChecked ? feedback(coreState.unknownWhy === (coreState.unknown.type === 'alpha' ? 0 : 1) ? 'That uses the observed trail, while keeping the inference cautious.' : 'Use length, thickness and shape rather than colour.', coreState.unknownWhy === (coreState.unknown.type === 'alpha' ? 0 : 1)) : ''}` : ''}` : ''}`;
      case 'explain': return `<p class="task-prompt">A thick alpha-like trail is usually shorter than a fine beta-like trail. Choose the two physics links that explain this pattern.</p><div class="choice-list" role="group" aria-label="Choose two pieces of evidence"><label><input type="checkbox" name="explain-evidence" value="0" /><span>Dense droplets suggest strong ionisation along the route.</span></label><label><input type="checkbox" name="explain-evidence" value="1" /><span>Track colour proves the alpha particle is heavier.</span></label><label><input type="checkbox" name="explain-evidence" value="2" /><span>Strong energy loss helps explain a shorter range.</span></label><label><input type="checkbox" name="explain-evidence" value="3" /><span>All beta particles have exactly the same route.</span></label></div><button type="button" class="control-button" data-action="explain-check">[ CHECK EVIDENCE ]</button>${coreState.explainChecked ? feedback(coreState.explainCorrect ? 'Good: denser ionisation and faster energy loss help explain the short, thick trail.' : 'Select the ionisation clue and the energy-loss link. Colour is a display choice.', coreState.explainCorrect) : ''}`;
      case 'predict': return `<p class="task-prompt">Predict what you will see if beta events are switched off and only alpha events remain. Then run the chamber.</p>${choice('predict-guess',['Mostly short, dense trails','Mostly fine, irregular trails','Continuous gamma lines'])}<button type="button" class="control-button" data-action="predict-run">[ RUN ALPHA ONLY ]</button>${coreState.predictRun ? `${chamberLink}${feedback(coreState.predictGuess === 0 ? 'Your prediction fits the new alpha-only scene.' : 'The new scene shows short, dense alpha-like trails. Compare with your prediction.', coreState.predictGuess === 0)}<p class="task-prompt">Why does this match alpha radiation?</p>${choice('predict-why',['Alpha causes dense ionisation and has a short range','Alpha is electromagnetic radiation','The border colour changes the decay rate'])}<button type="button" class="control-button" data-action="predict-why-check">[ CHECK EXPLANATION ]</button>${coreState.predictWhyChecked ? feedback(coreState.predictWhy === 0 ? 'Yes. The source change affected the simulated particle mix, not the randomness of individual decay events.' : 'Use ionisation and range to explain the observed trails.', coreState.predictWhy === 0) : ''}` : ''}`;
      case 'measure': return `<p class="task-prompt">This virtual counter models random counts, separate from the chamber picture. Every sample lasts 20 s. Change background and repeat.</p><div class="instrument-controls"><label for="background-level">BACKGROUND LEVEL <output id="background-output">${['Low','Medium','High'][coreState.background - 1]}</output></label><input id="background-level" type="range" min="1" max="3" step="1" value="${coreState.background}" /><label class="check-line"><input id="counter-source" type="checkbox" ${coreState.counterSource ? 'checked' : ''} /> SOURCE PRESENT</label><button type="button" class="control-button" data-action="measure-sample">[ NEW 20 s SAMPLE ]</button></div>${coreState.samples.length ? `<table class="data-table"><caption>Equal-time readings</caption><thead><tr><th>Trial</th><th>Condition</th><th>Count / 20 s</th><th>Rate / counts s⁻¹</th></tr></thead><tbody>${coreState.samples.map((sample,index) => `<tr><td>${index + 1}</td><td>${sample.source ? 'Source + background' : 'Background only'}</td><td>${sample.count}</td><td>${(sample.count / 20).toFixed(2)}</td></tr>`).join('')}</tbody></table>` : ''}${coreState.samples.length >= 3 ? `<p class="task-prompt">Why can equal-time readings differ?</p>${choice('measure-why',['The counter necessarily makes a mistake each time','Individual emissions occur randomly','The sample’s half-life changes each trial'])}<button type="button" class="control-button" data-action="measure-check">[ CHECK REASONING ]</button>${coreState.measureChecked ? feedback(coreState.measureCorrect ? 'Yes. Repeated readings reveal random variation; longer counts reduce its relative effect.' : 'Random emission causes variation even when the procedure is unchanged.', coreState.measureCorrect) : ''}` : '<p class="task-hint">Collect at least three equal-time samples before explaining the variation.</p>'}`;
      case 'data': return `<p class="task-prompt">Take a 20 s background reading and a 20 s source-present reading with the same virtual counter. Calculate the corrected rate.</p><button type="button" class="control-button" data-action="data-pair">[ NEW MEASUREMENT PAIR ]</button>${coreState.pair ? `<table class="data-table"><caption>Equal-time measurement pair</caption><thead><tr><th>Condition</th><th>Counts / 20 s</th></tr></thead><tbody><tr><td>Background only</td><td>${coreState.pair.background}</td></tr><tr><td>Source + background</td><td>${coreState.pair.source}</td></tr></tbody></table><label class="numeric-line" for="data-answer">Corrected count rate / counts s⁻¹ <input id="data-answer" type="number" step="0.01" inputmode="decimal" value="${coreState.dataInput}" /></label><button type="button" class="control-button" data-action="data-check">[ CHECK CALCULATION ]</button>${coreState.dataChecked ? feedback(coreState.dataCorrect ? `Correct: (${coreState.pair.source} − ${coreState.pair.background}) ÷ 20 = ${((coreState.pair.source - coreState.pair.background) / 20).toFixed(2)} counts s⁻¹.` : 'Subtract the background count first, then divide by the same 20 s interval.', coreState.dataCorrect) : ''}` : ''}`;
      case 'apply': return `<p class="task-prompt">An unfamiliar source gives these 20 s counts. Background alone is 5 counts. Which emission is most consistent with the absorber evidence?</p><table class="data-table"><caption>Absorber comparison</caption><thead><tr><th>Absorber</th><th>Count / 20 s</th></tr></thead><tbody><tr><td>None</td><td>55</td></tr><tr><td>Paper</td><td>54</td></tr><tr><td>Thin aluminium</td><td>12</td></tr></tbody></table>${choice('apply-choice',['Alpha','Beta','Gamma'])}<p class="task-prompt">Choose the best supporting observation.</p>${choice('apply-evidence',['Paper changes little; aluminium reduces the count greatly','The apparatus uses a digital counter','The chamber border is blue'])}<button type="button" class="control-button" data-action="apply-check">[ CHECK INFERENCE ]</button>${coreState.applyChecked ? feedback(coreState.applyChoice === 1 && coreState.applyEvidence === 0 ? 'Beta is most consistent: paper transmits much of it, while aluminium absorbs more. This is evidence, not absolute proof.' : 'Compare the effect of each absorber. Alpha would be stopped strongly by paper; gamma would be harder to absorb with thin aluminium.', coreState.applyChoice === 1 && coreState.applyEvidence === 0) : ''}`;
      default: return '';
    }
  }
  function renderStep() {
    const index = learning.units.findIndex(unit => unit.id === currentStep);
    const unit = learning.units[index];
    stepIndex.textContent = `${String(index + 1).padStart(2, '0')} / 07`;
    stepHeading.textContent = unit.heading;
    stepSummary.textContent = unit.summary;
    stepPanel.setAttribute('aria-labelledby', `tab-${unit.id}`);
    stepInteraction.setAttribute('data-activity-id', learning.activities[index].id);
    stepInteraction.innerHTML = renderActivity();
  }
  function selectStep(id) {
    if (id === currentStep) return;
    restoreLab();
    coreState.seeSample = false;
    coreState.unknown = null;
    coreState.predictRun = false;
    currentStep = id;
    stepMoreButton.setAttribute('aria-expanded', 'false');
    stepMorePanel.hidden = true;
    renderTabs();
    renderStep();
  }
  stepTabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-step]');
    if (tab) selectStep(tab.dataset.step);
  });
  stepTabs.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = learning.units.findIndex(unit => unit.id === currentStep);
    const next = learning.units[(index + (event.key === 'ArrowRight' ? 1 : -1) + learning.units.length) % learning.units.length].id;
    selectStep(next);
    document.getElementById(`tab-${next}`).focus();
  });
  const selectedRadio = name => {
    const input = stepInteraction.querySelector(`input[name="${name}"]:checked`);
    return input ? Number(input.value) : null;
  };
  function poisson(mean) {
    const limit = Math.exp(-mean);
    let product = 1, count = 0;
    do { product *= Math.random(); count++; } while (product > limit);
    return count - 1;
  }
  const backgroundRate = () => [0.25, 0.55, 1.0][coreState.background - 1];
  stepInteraction.addEventListener('input', event => {
    if (event.target.id === 'data-answer') coreState.dataInput = event.target.value;
    if (event.target.id === 'background-level') {
      coreState.background = Number(event.target.value);
      document.getElementById('background-output').textContent = ['Low','Medium','High'][coreState.background - 1];
    }
  });
  stepInteraction.addEventListener('change', event => {
    if (event.target.id === 'counter-source') coreState.counterSource = event.target.checked;
  });
  stepInteraction.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    switch (button.dataset.action) {
      case 'see-sample': guidedScene(['alpha','beta']); coreState.seeSample = true; coreState.seeChecked = false; break;
      case 'see-check': coreState.seeChoice = selectedRadio('see-choice'); coreState.seeChecked = true; if (coreState.seeChoice === 0) completeStep('see'); break;
      case 'unknown-new': {
        const type = Math.random() < .5 ? 'alpha' : 'beta';
        const [track] = guidedScene([type]);
        mystery = {type,trackId:track.id,checked:false};
        coreState.unknown = mystery; coreState.unknownGuess = null; coreState.unknownChecked = false; coreState.unknownWhyChecked = false;
        break;
      }
      case 'unknown-inspect': if (coreState.unknown) { updateInspector(tracks.find(track => track.id === coreState.unknown.trackId)); draw(); } return;
      case 'unknown-check': {
        const guessed = selectedRadio('unknown-guess');
        coreState.unknownGuess = guessed === 0 ? 'alpha' : guessed === 1 ? 'beta' : null;
        if (coreState.unknownGuess) { coreState.unknownChecked = true; mystery.checked = true; }
        break;
      }
      case 'unknown-why-check': coreState.unknownWhy = selectedRadio('unknown-why'); coreState.unknownWhyChecked = true; if (coreState.unknownWhy === (coreState.unknown.type === 'alpha' ? 0 : 1)) completeStep('identify'); break;
      case 'explain-check': {
        const selected = [...stepInteraction.querySelectorAll('input[name="explain-evidence"]:checked')].map(input => Number(input.value)).sort();
        coreState.explainCorrect = selected.length === 2 && selected[0] === 0 && selected[1] === 2;
        coreState.explainChecked = true;
        if (coreState.explainCorrect) completeStep('explain');
        break;
      }
      case 'predict-run': {
        coreState.predictGuess = selectedRadio('predict-guess');
        if (coreState.predictGuess !== null) { guidedScene(['alpha'], ['alpha']); coreState.predictRun = true; coreState.predictWhyChecked = false; }
        break;
      }
      case 'predict-why-check': coreState.predictWhy = selectedRadio('predict-why'); coreState.predictWhyChecked = true; if (coreState.predictWhy === 0) completeStep('predict'); break;
      case 'measure-sample': coreState.samples.push({source:coreState.counterSource,background:coreState.background,count:poisson((backgroundRate() + (coreState.counterSource ? 1.6 : 0)) * 20)}); coreState.measureChecked = false; break;
      case 'measure-check': coreState.measureCorrect = selectedRadio('measure-why') === 1; coreState.measureChecked = true; if (coreState.measureCorrect && coreState.samples.length >= 3) completeStep('measure'); break;
      case 'data-pair': {
        const background = poisson(backgroundRate() * 20);
        let source = poisson((backgroundRate() + 1.6) * 20);
        while (source <= background) source = poisson((backgroundRate() + 1.6) * 20);
        coreState.pair = {background,source}; coreState.dataInput = ''; coreState.dataChecked = false;
        break;
      }
      case 'data-check': {
        const value = Number(coreState.dataInput);
        const expected = (coreState.pair.source - coreState.pair.background) / 20;
        coreState.dataCorrect = coreState.dataInput.trim() !== '' && Math.abs(value - expected) <= .01;
        coreState.dataChecked = true;
        if (coreState.dataCorrect) completeStep('data');
        break;
      }
      case 'apply-check': coreState.applyChoice = selectedRadio('apply-choice'); coreState.applyEvidence = selectedRadio('apply-evidence'); coreState.applyChecked = true; if (coreState.applyChoice === 1 && coreState.applyEvidence === 0) completeStep('apply'); break;
      default: return;
    }
    renderStep();
  });
  renderTabs();
  renderStep();

  new ResizeObserver(resize).observe(frame);
  resize();
  makeTrack('alpha', 1.2);
  makeTrack('beta', .9);
  nextEvent = 2;
  updatePauseButton();
  updateSources();
  requestAnimationFrame(animate);
})();
