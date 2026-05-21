const fs = require('fs');

const diff = fs.readFileSync('diff.txt', 'utf-8');
const lines = diff.split('\n');

let currentHunk = '';
let addedDivs = 0;
let removedDivs = 0;
let addedCloseDivs = 0;
let removedCloseDivs = 0;

let addedMotionDivs = 0;
let removedMotionDivs = 0;
let addedCloseMotionDivs = 0;
let removedCloseMotionDivs = 0;

let hunkStart = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('@@')) {
    // Process previous hunk
    if (currentHunk) {
      const netOpen = (addedDivs - removedDivs) + (addedMotionDivs - removedMotionDivs);
      const netClose = (addedCloseDivs - removedCloseDivs) + (addedCloseMotionDivs - removedCloseMotionDivs);
      
      if (netOpen !== netClose) {
        console.log(`Hunk starting around ${hunkStart}: Unbalanced! Net Open: ${netOpen}, Net Close: ${netClose} (Diff: ${netOpen - netClose})`);
      }
    }
    
    // Reset
    currentHunk = line;
    hunkStart = line;
    addedDivs = 0;
    removedDivs = 0;
    addedCloseDivs = 0;
    removedCloseDivs = 0;
    addedMotionDivs = 0;
    removedMotionDivs = 0;
    addedCloseMotionDivs = 0;
    removedCloseMotionDivs = 0;
  } else if (line.startsWith('+') && !line.startsWith('+++')) {
    addedDivs += (line.match(/<div(\s|>)/g) || []).length;
    addedCloseDivs += (line.match(/<\/div>/g) || []).length;
    addedMotionDivs += (line.match(/<motion\.div(\s|>)/g) || []).length;
    addedCloseMotionDivs += (line.match(/<\/motion\.div>/g) || []).length;
  } else if (line.startsWith('-') && !line.startsWith('---')) {
    removedDivs += (line.match(/<div(\s|>)/g) || []).length;
    removedCloseDivs += (line.match(/<\/div>/g) || []).length;
    removedMotionDivs += (line.match(/<motion\.div(\s|>)/g) || []).length;
    removedCloseMotionDivs += (line.match(/<\/motion\.div>/g) || []).length;
  }
}

// Process last hunk
if (currentHunk) {
    const netOpen = (addedDivs - removedDivs) + (addedMotionDivs - removedMotionDivs);
    const netClose = (addedCloseDivs - removedCloseDivs) + (addedCloseMotionDivs - removedCloseMotionDivs);
    
    if (netOpen !== netClose) {
    console.log(`Hunk starting around ${hunkStart}: Unbalanced! Net Open: ${netOpen}, Net Close: ${netClose} (Diff: ${netOpen - netClose})`);
    }
}
