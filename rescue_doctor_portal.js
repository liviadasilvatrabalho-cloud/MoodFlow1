
import fs from 'fs';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the line that starts with indent and import autoTable.
// Line 205 in view 1561: "            import autoTable from 'jspdf-autotable';"
// It has 12 spaces.

let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
    // Check if line contains "import autoTable" and has indentation (to distinguish from line 10)
    // Line 10: "import autoTable from 'jspdf-autotable';" (no indent)
    if (lines[i].includes("import autoTable") && lines[i].startsWith('            ')) {
        startIndex = i;
        break;
    }
}

if (startIndex === -1) {
    console.error("Could not find the indented duplicate block.");
    process.exit(1);
}

// Extract lines from startIndex
const rescuedLines = lines.slice(startIndex);

// Dedent
const dedentedLines = rescuedLines.map(line => {
    // Remove up to 12 spaces from start
    if (line.startsWith('            ')) {
        return line.substring(12);
    }
    // If line has less than 12 spaces but empty?
    if (line.trim() === '') return '';

    // If it has less indentation, just trimStart? No, might break inner formatting.
    // Ideally code should be indented by 12.
    // If we have `        }` (8 spaces), removing 12 is impossible.
    // Let's assume the block was indented uniformly.
    return line.replace(/^ {1,12}/, '');
});

// Reconstruct
let newContent = dedentedLines.join('\n');

// Also, we need to make sure we include the HEAD of the file if the indented block started at `import autoTable`.
// `import autoTable` is line 10.
// So lines 1-9 (React imports, etc) need to be prepended?
// Let's check view 1561.
// 205: import autoTable...
// 206: import * as XLSX...
// 1-9: React imports, constants, services, types, Button, AudioComponents, Recharts.
// jsPDF is at 9.

// The duplicate block at 205 *starts* with autoTable.
// It *misses* lines 1-9!
// So I need to PREPEND lines 1-9 from the original file (top).

const headerLines = lines.slice(0, 9); // Lines 0 to 8 (originally 1-9)
// Actually line indices 0-8. 
// "import { jsPDF } from 'jspdf';" is line 9 (index 8).

// Let's take lines 0-9 (first 10 lines) from original file, assuming they are clean.
// Or just hardcode the missing imports.

/*
import React, { useState, useEffect, useRef } from 'react';
import { MOODS, TRANSLATIONS } from '../../constants';
import { storageService } from '../../services/storageService';
import { aiService } from '../../services/aiService';
import { MoodEntry, User, DoctorNote, Language, UserRole, ClinicalReport } from '../../types';
import { Button } from '../ui/Button';
import { AudioRecorder, AudioPlayer } from '../ui/AudioComponents';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { jsPDF } from 'jspdf';
*/

// I will prepend these to `newContent`.
const topImports = lines.slice(0, 9).join('\n');

newContent = topImports + '\n' + newContent;

fs.writeFileSync(filePath, newContent);
console.log('Briefly rescued DoctorPortal.tsx');
