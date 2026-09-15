const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {questions, activities, units, more} = require('../content.js');

const bands = new Set(['igcse-core','igcse-supplement','beyond-igcse-ib','beyond-ib']);
const processes = new Set(['remember','understand','apply','analyze','evaluate','create']);
const knowledgeTypes = new Set(['factual','conceptual','procedural','metacognitive']);
const formats = new Set(['choice','incorrect','track','number','graph','order','evidence','structured','compare','data']);
const commandTerms = new Set(['calculate','comment','compare','deduce','define','describe','determine','explain','give','identify','justify','predict','sketch','state','suggest','design']);
const ids = new Set();

assert.equal(questions.length,60,'The original question bank has 60 questions');
assert.equal(questions.filter(q => q.curriculumBand.startsWith('igcse-')).length,40,'40 IGCSE questions');
assert.equal(questions.filter(q => q.curriculumBand.startsWith('beyond-')).length,20,'20 MORE questions');
for (const item of [...questions,...activities]) {
  assert(!ids.has(item.id),`Duplicate item ID: ${item.id}`);
  ids.add(item.id);
  assert(bands.has(item.curriculumBand),`${item.id}: curriculum band`);
  assert(processes.has(item.bloomProcess),`${item.id}: Bloom process`);
  assert(knowledgeTypes.has(item.knowledgeType),`${item.id}: knowledge type`);
  assert(['AO1','AO2','AO3',null].includes(item.cambridgeAO),`${item.id}: Cambridge AO`);
  assert(commandTerms.has(item.commandTerm),`${item.id}: command term`);
  assert(Number.isInteger(item.marks) && item.marks >= 1 && item.marks <= 4,`${item.id}: marks`);
  assert(Number.isInteger(item.difficulty) && item.difficulty >= 1 && item.difficulty <= 5,`${item.id}: difficulty`);
  assert(typeof item.objective === 'string' && item.objective.length > 0,`${item.id}: objective`);
  if (!item.format) continue; // Guided activities have their own simulator interaction.
  assert(formats.has(item.format),`${item.id}: format`);
  assert(typeof item.prompt === 'string' && item.prompt.length > 15,`${item.id}: prompt`);
  assert.equal(item.markPoints.length,item.marks,`${item.id}: one meaningful point per mark`);
  assert(item.markPoints.every(point => typeof point === 'string' && point.length >= 8 && point.length < 170),`${item.id}: concise points`);
  if (['choice','incorrect','track'].includes(item.format)) {
    assert(Array.isArray(item.options) && item.options.length >= 3,`${item.id}: options`);
    assert.equal(new Set(item.options).size,item.options.length,`${item.id}: distinct options`);
    assert(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < item.options.length,`${item.id}: answer index`);
  }
  if (item.format === 'evidence') assert(item.answer.every(index => Number.isInteger(index) && index >= 0 && index < item.options.length),`${item.id}: evidence answer`);
  if (item.format === 'order') assert(item.answer.length === item.options.length && item.answer.every(value => item.options.includes(value)),`${item.id}: ordering answer`);
  if (['number','graph'].includes(item.format)) assert(Number.isFinite(item.answer),`${item.id}: numeric answer`);
  if (['structured','compare','data'].includes(item.format)) assert(typeof item.answer === 'string' && item.answer.length > 20,`${item.id}: strong answer`);
  if (item.figure?.type === 'table' || item.figure?.type === 'graph') {
    assert(item.figure.rows.length >= 2 && item.figure.rows.every(row => row.length === item.figure.headings.length),`${item.id}: coherent figure data`);
  }
}
assert.equal(activities.length,7,'Seven guided core tasks');
assert(activities.every(item => item.curriculumBand === 'igcse-core'),'Guided tasks stay inside core');
assert.equal(units.length,7,'Seven concise pathway steps');
assert(units.every(unit => Array.isArray(more[unit.id]) && more[unit.id].length === 2),'Each stage has two optional MORE levels');
for (const objective of ['5.2.1','5.2.2','5.2.3','5.2.4','5.2.5']) assert(questions.some(q => q.objective === objective && q.curriculumBand.startsWith('igcse-')),`IGCSE ${objective} covered`);

const root = path.join(__dirname,'..');
const excludedName = String.fromCharCode(80,97,114,107,32,76,97,110,101);
const excludedSchool = String.fromCharCode(73,110,116,101,114,110,97,116,105,111,110,97,108,32,83,99,104,111,111,108);
for (const file of ['index.html','app.js','practice.js','content.js','styles.css','README.md','package.json','favicon.svg']) {
  const contents = fs.readFileSync(path.join(root,file),'utf8');
  assert(!new RegExp(`${excludedName}|${excludedSchool}`,'i').test(contents),`${file}: forbidden school reference`);
}
const tally = field => Object.fromEntries([...new Set(questions.map(q => q[field]))].map(value => [value,questions.filter(q => q[field] === value).length]));
console.log('Content audit passed:',questions.length,'original questions +',activities.length,'guided tasks');
console.log('Curriculum bands:',tally('curriculumBand'));
console.log('Bloom processes:',tally('bloomProcess'));
