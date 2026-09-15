(() => {
  const {questions} = globalThis.CloudChamberContent;
  const bandSelect = document.getElementById('practice-band');
  const objectiveSelect = document.getElementById('practice-objective');
  const newSetButton = document.getElementById('new-practice-set');
  const questionHost = document.getElementById('practice-question');
  const previousButton = document.getElementById('practice-prev');
  const nextButton = document.getElementById('practice-next');
  const position = document.getElementById('practice-position');
  const count = document.getElementById('practice-count');
  const topicNames = {
    '5.2.1':'Detection & background', '5.2.2':'Alpha, beta & gamma',
    '5.2.3':'Radioactive decay', '5.2.4':'Half-life & applications',
    '5.2.5':'Radiation safety', 'IB D.2':'IB · Nuclear physics',
    'IB HL':'IB HL · Decay constant', 'CLOUD MORE':'Cloud chamber physics',
    'CURIOUS PHYSICS':'Curious physics',
  };
  let currentSet = [];
  let currentIndex = 0;
  let responses = new Map();
  const escapeHtml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  function poolForBand() {
    const bands = bandSelect.value === 'core' ? ['igcse-core'] :
      bandSelect.value === 'extended' ? ['igcse-core','igcse-supplement'] :
      ['beyond-igcse-ib','beyond-ib'];
    return questions.filter(question => bands.includes(question.curriculumBand));
  }
  function fillTopics() {
    const found = [...new Set(poolForBand().map(question => question.objective))];
    objectiveSelect.innerHTML = '<option value="all">All topics</option>' + found.map(objective => `<option value="${objective}">${topicNames[objective] || objective}</option>`).join('');
  }
  function shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }
  function newSet() {
    const pool = poolForBand().filter(question => objectiveSelect.value === 'all' || question.objective === objectiveSelect.value);
    currentSet = shuffle(pool).slice(0, 5);
    currentIndex = 0;
    responses = new Map();
    render();
  }
  function responseFor(question) {
    if (!responses.has(question.id)) responses.set(question.id, {value:'',selected:[],checked:false,revealed:false,strong:false,selfAwarded:[]});
    return responses.get(question.id);
  }
  function figureHtml(question) {
    const figure = question.figure;
    if (!figure) return '';
    if (figure.type === 'table') return `<table class="data-table question-figure"><caption>Given data</caption><thead><tr>${figure.headings.map(head => `<th>${head}</th>`).join('')}</tr></thead><tbody>${figure.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    if (figure.type === 'trails') {
      const dense = figure.labels[0].includes('dense');
      return `<div class="trail-figure" role="img" aria-label="Two schematic particle trails for comparison"><div><strong>${figure.labels[0]}</strong><svg viewBox="0 0 220 65" aria-hidden="true"><path d="M16 38 L${dense ? '143 34' : '208 34'}" stroke="var(--track-${dense ? 'alpha' : 'beta'})" stroke-width="${dense ? 6 : 2}" stroke-linecap="square" /></svg></div><div><strong>${figure.labels[1]}</strong><svg viewBox="0 0 220 65" aria-hidden="true"><path d="M8 48 C40 18 58 54 95 29 S147 45 208 14" stroke="var(--track-beta)" fill="none" stroke-width="2" /></svg></div></div>`;
    }
    if (figure.type === 'graph') {
      const rows = figure.rows;
      const maxTime = rows.at(-1)[0], maxValue = rows[0][1];
      const x = time => 42 + time / maxTime * 320;
      const y = value => 151 - value / maxValue * 125;
      const points = rows.map(([time,value]) => `${x(time)},${y(value)}`).join(' ');
      return `<div class="graph-figure"><svg viewBox="0 0 390 182" role="img" aria-label="Graph of nuclei remaining against time in hours, starting at 80 and halving every 6 hours"><path d="M42 20 V151 H365" fill="none" stroke="var(--navy)" stroke-width="2"/><path d="M42 88 H365" stroke="var(--blue-mid)" stroke-dasharray="4 4"/><polyline points="${points}" fill="none" stroke="var(--blue)" stroke-width="3"/>${rows.map(([time,value]) => `<rect x="${x(time)-3}" y="${y(value)-3}" width="6" height="6" fill="var(--green)"/>`).join('')}<path id="graph-marker" d="M42 20 V151" stroke="var(--green-mid)" stroke-width="2"/><text x="4" y="27">80</text><text x="4" y="92">40</text><text x="39" y="171">0</text><text x="345" y="171">18 h</text></svg><label for="graph-cursor">MOVE GRAPH CURSOR <output id="graph-readout">0 h · about 80 nuclei</output></label><input id="graph-cursor" type="range" min="0" max="${maxTime}" step="1" value="0" /></div>`;
    }
    return '';
  }
  function trackSvg(type) {
    const path = type === 'alpha' ? '<path d="M14 32 L113 30" stroke="var(--track-alpha)" stroke-width="7"/>' :
      type === 'beta' ? '<path d="M9 42 C29 12 43 39 58 17 S83 47 117 18" stroke="var(--track-beta)" stroke-width="2" fill="none"/>' :
      '<path d="M7 46 L120 12" stroke="var(--track-muon)" stroke-width="2"/>';
    return `<svg viewBox="0 0 130 60" aria-hidden="true">${path}</svg>`;
  }
  function answerHtml(question, state) {
    if (question.format === 'structured' || question.format === 'compare' || question.format === 'data') {
      return `<label class="response-label" for="written-answer">YOUR RESPONSE</label><textarea id="written-answer" rows="4" placeholder="Write your physics points before viewing the scheme.">${escapeHtml(state.value)}</textarea><button class="control-button" type="button" data-practice-action="reveal">[ SHOW MARK SCHEME ]</button>${state.revealed ? `<div class="mark-scheme"><h4>MARK SCHEME · ${question.marks} MARKS</h4><p>Tick only points your answer earns. Equivalent clear physics wording counts.</p>${question.markPoints.map((point,index) => `<label><input type="checkbox" data-mark="${index}" ${state.selfAwarded.includes(index) ? 'checked' : ''}/><span>${point}</span></label>`).join('')}<output id="self-score">${state.selfAwarded.length} / ${question.marks} self-awarded</output><button class="control-button" type="button" data-practice-action="strong">[ ${state.strong ? 'HIDE' : 'SHOW'} STRONG ANSWER ]</button>${state.strong ? `<p class="strong-answer">${question.answer}</p>` : ''}</div>` : ''}`;
    }
    if (question.format === 'order') return `<p class="response-label">SELECT THE ORDER</p><div class="order-list">${question.answer.map((_, index) => `<label>POSITION ${index + 1}<select data-order="${index}"><option value="">Choose…</option>${question.options.map(option => `<option value="${option}" ${state.selected[index] === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`).join('')}</div><button class="control-button" type="button" data-practice-action="check">[ CHECK ORDER ]</button>`;
    if (question.format === 'number' || question.format === 'graph') return `<label class="numeric-line" for="numeric-answer">YOUR ANSWER ${question.unit ? `/ ${question.unit}` : ''}<input id="numeric-answer" type="number" step="any" inputmode="decimal" value="${escapeHtml(state.value)}" /></label><button class="control-button" type="button" data-practice-action="check">[ CHECK ]</button>`;
    if (question.format === 'evidence') return `<div class="choice-list" role="group" aria-label="Choose evidence">${question.options.map((option,index) => `<label><input type="checkbox" name="practice-evidence" value="${index}" ${state.selected.includes(index) ? 'checked' : ''} /><span>${option}</span></label>`).join('')}</div><button class="control-button" type="button" data-practice-action="check">[ CHECK EVIDENCE ]</button>`;
    return `<div class="choice-list ${question.format === 'track' ? 'track-options' : ''}" role="group" aria-label="Choose an answer">${question.options.map((option,index) => `<label><input type="radio" name="practice-choice" value="${index}" ${state.value === String(index) ? 'checked' : ''}/>${question.format === 'track' ? trackSvg(question.trackTypes[index]) : ''}<span>${option}</span></label>`).join('')}</div><button class="control-button" type="button" data-practice-action="check">[ CHECK ]</button>`;
  }
  function checkedFeedback(question, state) {
    if (!state.checked) return '';
    let correct;
    if (question.format === 'order') correct = state.selected.length === question.answer.length && state.selected.every((value,index) => value === question.answer[index]);
    else if (question.format === 'evidence') correct = state.selected.length === question.answer.length && state.selected.every(value => question.answer.includes(value));
    else if (question.format === 'number' || question.format === 'graph') {
      const tolerance = question.tolerance ?? Math.max(1e-9,Math.abs(question.answer) * .005);
      correct = state.value.trim() !== '' && Math.abs(Number(state.value) - question.answer) <= tolerance;
    } else correct = Number(state.value) === question.answer && state.value !== '';
    return `<div class="answer-feedback ${correct ? 'good' : 'retry'}" role="status"><strong>${correct ? 'MATCHES THE MARK SCHEME' : 'REVIEW THE PHYSICS'}</strong><p>${question.markPoints.join(' ')}${!correct && (question.format === 'number' || question.format === 'graph') ? ` Expected answer: ${question.answer} ${question.unit || ''}.` : ''}${!correct && question.format === 'order' ? ` Correct order: ${question.answer.join(' → ')}.` : ''}</p></div>`;
  }
  function render() {
    if (!currentSet.length) { questionHost.innerHTML = '<p>No questions match this filter. Choose another topic.</p>'; return; }
    const question = currentSet[currentIndex];
    const state = responseFor(question);
    const band = question.curriculumBand === 'igcse-core' ? 'IGCSE CORE' : question.curriculumBand === 'igcse-supplement' ? 'IGCSE EXTENDED' : 'MORE · OPTIONAL';
    const total = currentSet.length;
    count.textContent = `QUESTION ${currentIndex + 1} / ${total}`;
    position.textContent = `${currentIndex + 1} / ${total}`;
    previousButton.disabled = currentIndex === 0;
    nextButton.disabled = currentIndex === total - 1;
    questionHost.innerHTML = `<div class="question-head"><span>${band} · ${topicNames[question.objective] || question.objective}</span><span>${question.marks} ${question.marks === 1 ? 'MARK' : 'MARKS'}</span></div><h3>${question.prompt}</h3>${question.useSimulator ? '<a class="chamber-link" href="#chamber-frame">[ USE CHAMBER ↑ ]</a>' : ''}${figureHtml(question)}${answerHtml(question,state)}${checkedFeedback(question,state)}`;
  }
  questionHost.addEventListener('input', event => {
    const state = responseFor(currentSet[currentIndex]);
    if (event.target.id === 'written-answer' || event.target.id === 'numeric-answer') state.value = event.target.value;
    if (event.target.id === 'graph-cursor') {
      const question = currentSet[currentIndex];
      const time = Number(event.target.value);
      const rows = question.figure.rows;
      let value = rows.at(-1)[1];
      for (let i = 1; i < rows.length; i++) if (time <= rows[i][0]) {
        const [t0,n0] = rows[i - 1], [t1,n1] = rows[i];
        value = n0 + (n1 - n0) * (time - t0) / (t1 - t0);
        break;
      }
      document.getElementById('graph-readout').textContent = `${time} h · about ${Math.round(value)} nuclei`;
      const x = 42 + time / rows.at(-1)[0] * 320;
      document.getElementById('graph-marker').setAttribute('d', `M${x} 20 V151`);
    }
  });
  questionHost.addEventListener('change', event => {
    const state = responseFor(currentSet[currentIndex]);
    if (event.target.name === 'practice-choice') state.value = event.target.value;
    if (event.target.name === 'practice-evidence') state.selected = [...questionHost.querySelectorAll('input[name="practice-evidence"]:checked')].map(input => Number(input.value));
    if (event.target.dataset.order !== undefined) state.selected[Number(event.target.dataset.order)] = event.target.value;
    if (event.target.dataset.mark !== undefined) {
      state.selfAwarded = [...questionHost.querySelectorAll('input[data-mark]:checked')].map(input => Number(input.dataset.mark));
      document.getElementById('self-score').textContent = `${state.selfAwarded.length} / ${currentSet[currentIndex].marks} self-awarded`;
    }
  });
  questionHost.addEventListener('click', event => {
    const action = event.target.closest('[data-practice-action]')?.dataset.practiceAction;
    if (!action) return;
    const question = currentSet[currentIndex];
    const state = responseFor(question);
    if (action === 'reveal') {
      state.value = questionHost.querySelector('#written-answer').value;
      if (!state.value.trim()) { questionHost.querySelector('#written-answer').focus(); return; }
      state.revealed = true;
    }
    if (action === 'strong') state.strong = !state.strong;
    if (action === 'check') {
      if (question.format === 'number' || question.format === 'graph') state.value = questionHost.querySelector('#numeric-answer').value;
      if (question.format === 'order') state.selected = [...questionHost.querySelectorAll('select[data-order]')].map(select => select.value);
      if (question.format === 'evidence') state.selected = [...questionHost.querySelectorAll('input[name="practice-evidence"]:checked')].map(input => Number(input.value));
      if (question.format === 'choice' || question.format === 'incorrect' || question.format === 'track') state.value = questionHost.querySelector('input[name="practice-choice"]:checked')?.value ?? '';
      state.checked = true;
    }
    render();
  });
  bandSelect.addEventListener('change', () => { fillTopics(); newSet(); });
  objectiveSelect.addEventListener('change', newSet);
  newSetButton.addEventListener('click', newSet);
  previousButton.addEventListener('click', () => { currentIndex--; render(); });
  nextButton.addEventListener('click', () => { currentIndex++; render(); });
  fillTopics();
  newSet();
})();
