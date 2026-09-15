# Cloud Chamber

A single-page physics simulation and learning pathway for Cambridge IGCSE Physics students. The chamber shows stylised condensation trails as evidence of ionising radiation. Students observe, predict, change the chamber, measure random counts, correct for background and use evidence in an unfamiliar case. A dedicated practice area serves five questions at a time. Optional **MORE ▸** panels lead from the IGCSE idea to an IB bridge and then to curious physics.

The main pathway keeps detailed chamber construction, supersaturation, cosmic muons and nuclear theory beyond IGCSE optional. Tracks are illustrative clues, not certain particle identifications; gamma rays do not draw continuous charged-particle trails. The virtual counter models random variation in equal-time measurements. It is an educational simulation rather than a calibrated detector.

## Run locally

```sh
npm run dev
```

Open `http://localhost:3000`. No dependencies or build step are required. `npm run check` checks the scripts and audits the question bank, metadata, mark points, curriculum coverage and optional-content boundary.

## Learning content

`content.js` holds 60 original questions: 28 IGCSE Core, 12 IGCSE Supplement, 16 IB-bridge and 4 deeper extension questions. Each question has a curriculum band, syllabus objective, revised Bloom process, knowledge type, Cambridge assessment objective where appropriate, command term, marks, difficulty, format, answer and concise mark points. It also holds seven core guided tasks and two optional MORE levels for each pathway step. `practice.js` renders mixed or filtered sets from that data, including visual tracks, graphs, tables, choices, ordering, numerical answers and written self-marking. Written physics prose is assessed by the student against visible mark points; the app does not claim to grade prose automatically.

The data model is plain JavaScript and can be expanded without changing the practice UI. `tools/audit_content.js` checks structural consistency and coverage. The questions are original, written to reflect the style and cognitive demands of examinations rather than copied from past papers.

## Physics and curriculum references

- [Cambridge IGCSE Physics 0625 syllabus, 2026–2028](https://www.cambridgeinternational.org/Images/697209-2026-2028-syllabus.pdf) — primary boundary for the default learning pathway and IGCSE practice.
- [IB Physics guide](https://www.ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/physics-guide.pdf) — reference for the first optional extension layer.
- [CERN S'Cool LAB cloud chamber guide](https://scoollab.web.cern.ch/sites/default/files/documents/20200521_JW_DIYManual_CloudChamber_v7.pdf) — chamber and trail descriptions.
- [American Physical Society account of the positron discovery](https://www.aps.org/apsnews/2004/08/discovery-positron-1932) — historical extension context.
