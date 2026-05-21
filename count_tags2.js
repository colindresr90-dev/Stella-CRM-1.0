const fs = require('fs');

const content = fs.readFileSync('src/app/(dashboard)/leads/[id]/page.tsx', 'utf-8');

let divOpen = 0;
let divClose = 0;
let divSelfClose = 0;

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Count self-closing `<div ... />`
  const selfCloses = (line.match(/<div[^>]*\/>/g) || []).length;
  // Count standard `<div` that are not self-closing
  // Wait, simpler: total `<div` minus selfCloses
  const allOpens = (line.match(/<div(\s|>)/g) || []).length;
  
  const divCloses = (line.match(/<\/div>/g) || []).length;
  
  divOpen += (allOpens - selfCloses);
  divClose += divCloses;
  divSelfClose += selfCloses;
}

console.log(`divOpen (non-self-closing): ${divOpen}`);
console.log(`divClose: ${divClose}`);
console.log(`divSelfClose: ${divSelfClose}`);
console.log(`diff: ${divOpen - divClose}`);
