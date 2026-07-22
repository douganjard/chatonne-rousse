#!/usr/bin/env node

const url = process.env.VISUAL_QA_URL || 'http://127.0.0.1:5173/';

const routes = [
  ['Home scene', '/'],
  ['About', '/about'],
  ['Writing', '/writing'],
  ['Contact', '/contact'],
  ['Not found', '/missing-route'],
];

const viewports = [
  ['Desktop', '1440 x 1000'],
  ['Tablet', '834 x 1112'],
  ['Mobile', '390 x 844'],
];

const destinationObjects = [
  ['About', 'Framed portrait'],
  ['How about a game of chess?', 'Chess board'],
  ['Synth Conductor', 'MIDI keyboard'],
];

function printList(items) {
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

console.log('Visual QA checklist');
console.log('===================');
console.log('');
console.log(`Dev server: ${url}`);
console.log('Start with: pnpm run dev:codex');
console.log('');

console.log('Viewports');
for (const [label, size] of viewports) {
  console.log(`- ${label}: ${size}`);
}
console.log('');

console.log('Routes');
for (const [label, route] of routes) {
  console.log(`- ${label}: ${new URL(route, url).toString()}`);
}
console.log('');

console.log('Home scene destination objects');
for (const [label, object] of destinationObjects) {
  console.log(`- ${label}: ${object}`);
}
console.log('');

console.log('Required states');
printList([
  'Default motion with WebGL enabled',
  'Reduced motion with prefers-reduced-motion: reduce',
  'Home initial scene after models settle',
  'Home popup after selecting each destination object',
  'Mobile touch controls at rest, held forward, and held forward plus turn',
  'Mobile Overview and Follow camera modes in portrait and landscape',
  'Each route page at desktop, tablet, and mobile sizes',
]);
console.log('');

console.log('Browser checks');
printList([
  'No uncaught console errors or React/router warnings',
  'No failed network requests for /models/**/*.glb or app assets',
  'Canvas is nonblank on desktop and mobile',
  'Text and controls do not overlap the fixed header or each other',
  'Mobile touch controls stop on release, cancellation, page hide, and window blur',
  'Overview fits the complete room; Follow pans gently without rotation, empty space, or jitter',
  'Nav, fallback, and popup links are reachable by pointer and keyboard',
  'Home scene remains interactive after resizing',
]);
console.log('');

console.log('Accepted project-specific warning: Rapier deprecated initialization parameters, only if the scene still renders and moves normally.');
console.log('See docs/visual-qa.md for the full workflow and handoff summary format.');
