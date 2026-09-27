const fs = require('fs');
const model = fs.readFileSync('public/models/left_hand.glb');
// just looking for strings that might be animation names
const strings = model.toString('utf8').match(/[a-zA-Z0-9_]{3,}/g);
console.log(Array.from(new Set(strings)).filter(s => s.toLowerCase().includes('anim') || s.toLowerCase().includes('pose') || s.toLowerCase().includes('point') || s.toLowerCase().includes('grip')));
