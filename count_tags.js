const fs = require('fs');

const content = fs.readFileSync('src/app/(dashboard)/leads/[id]/page.tsx', 'utf-8');

let divOpen = 0;
let divClose = 0;
let motionOpen = 0;
let motionClose = 0;

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count `<div` (but not `</div`)
  const divOpens = (line.match(/<div(\s|>)/g) || []).length;
  // Count `</div`
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  // Count `<motion.div`
  const motionOpens = (line.match(/<motion\.div(\s|>)/g) || []).length;
  const motionCloses = (line.match(/<\/motion\.div>/g) || []).length;
  
  divOpen += divOpens;
  divClose += divCloses;
  motionOpen += motionOpens;
  motionClose += motionCloses;
}

console.log(`divOpen: ${divOpen}`);
console.log(`divClose: ${divClose}`);
console.log(`motionOpen: ${motionOpen}`);
console.log(`motionClose: ${motionClose}`);
console.log(`div diff: ${divOpen - divClose}`);
console.log(`motion diff: ${motionOpen - motionClose}`);
