
import fs from 'fs';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const newLines = [];
let skip = false;

// We will manually reconstruct the file to some extent or filter out known bad blocks
// Identified bad blocks from recent view:
// 1. Lines 100-101 (Duplicate report state) -> Keep 102 (isSaving), Remove 100-101.
// 2. Lines 186-249 (Big duplicate block) -> Remove.
// Note: Line numbers are from the VIEW, which are 1-based. Arrays are 0-based.

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fileLineNumber = i + 1;

    // Fix 1: Remove duplicate report state at start
    // 100:     const [isEditingReport, setIsEditingReport] = useState(false);
    // 101:     const [editingReport, setEditingReport] = useState<{ id: string, title: string, reportType: 'evolucao' | 'avaliacao' | 'encaminhamento', content: string }>({ id: '', title: '', reportType: 'evolucao', content: '' });
    if (fileLineNumber === 100 && line.includes('const [isEditingReport, setIsEditingReport]')) continue;
    if (fileLineNumber === 101 && line.includes('const [editingReport, setEditingReport]')) continue;

    // Fix 2: Remove big duplicate block.
    // Starts at 186: // --- CLINICAL REPORTS STATE (NEW) ---
    // Ends at 250ish. 
    // We want to KEEP `loadPatients` if it's only in this block.
    // But `loadPatients` is at 217.
    // And `handleConnectPatient` is below.

    // Actually, it's safer to identify the duplicate block by content.
    // The duplicate block starts after `toggleRecording` ends (around 182).
    // And it repeats `// --- CLINICAL REPORTS STATE (NEW) ---` which is already at line 105.

    if (fileLineNumber >= 186 && fileLineNumber <= 216) {
        // This is the duplicate state and effects and toggleRecording repetition.
        // We know lines 186-216 are garbage duplicates of 105+ and 137+.
        continue;
    }

    // We need to keep `loadPatients` at 217.
    // Lines 217-220 are loadPatients.
    // Line 221 is empty.
    // Lines 222+ are handleConnectPatient.

    // Wait, the duplicate block seemed to END at `toggleRecording`... no, the view shows `toggleRecording` AGAIN at 218!
    // 218:     const toggleRecording = () => {

    // So 218 is ALSO a duplicate.

    if (fileLineNumber >= 218 && fileLineNumber <= 250) {
        // This is duplicate toggleRecording.
        continue;
    }

    newLines.push(line);
}

// Re-assemble
content = newLines.join('\n');

// Now we need to make sure `loadPatients` exists.
// Logic: If I removed the duplicate block that *contained* loadPatients, I lost it.
// In the view, `loadPatients` was at 217.
// My loop kept 217.
// But wait, in the view:
// 216:     
// 217:     const loadPatients = async () => {
// 218:     const toggleRecording = () => { ... } // This is weird. why is toggleRecording inside loadPatients? No indent?
// Ah line 217 is `const loadPatients ...`
// line 221 is `};` (presumably)
// But wait, the view 1451 shows:
/*
217:     const loadPatients = async () => {
218:         const data = await storageService.getPatientsForDoctor(user.id);
219:         setPatients(data);
220:     };
221: 
222:     const handleConnectPatient = async (e: React.FormEvent) => {
*/
// BUT my duplicate check saw `toggleRecording` at 218 in lines 218-250?
// Let's re-read the view 1451 CAREFULLY.
/*
...
137:     const toggleRecording = () => { ... }
...
182:     };
...
186:     // --- CLINICAL REPORTS STATE (NEW) ---
...
217:     
218:     const toggleRecording = () => {
*/
// Wait, in view 1451, line 217 is EMPTY.
// Line 218 is `const toggleRecording ...`
// I misread the previous thought where I said `loadPatients` is at 217.
// In view 1451, `loadPatients` is NOT VISIBLE in lines 90-250 except maybe... wait.

// Step 1451 output:
// 217: 
// 218:     const toggleRecording = () => {

// Step 1446 output (the diff):
// +    const loadPatients = async () => {
// +        const data = await storageService.getPatientsForDoctor(user.id);
// +        setPatients(data);
// +    };
// +
// -    const handleConnectPatient = async (e: React.FormEvent) => {

// The diff implies `loadPatients` was inserted.
// If view 1451 shows `toggleRecording` at 218, then `loadPatients` is NOT there.

// I MUST explicitly insert `loadPatients`.

// Let's clean the duplicates first, then append/insert `loadPatients`.

fs.writeFileSync(filePath, content);
console.log('Duplicates removed.');

// Verify cleanup and insert missing functions if needed
let cleanContent = fs.readFileSync(filePath, 'utf8');

if (!cleanContent.includes('const loadPatients = async')) {
    const loadPatientsCode = `
    const loadPatients = async () => {
        const data = await storageService.getPatientsForDoctor(user.id);
        setPatients(data);
    };`;
    // Insert before handleConnectPatient
    cleanContent = cleanContent.replace(/(const handleConnectPatient = async)/, `${loadPatientsCode}\n    $1`);
}

if (!cleanContent.includes('const handleSaveReport = async')) {
    const handleSaveReportCode = `
    const handleSaveReport = async () => {
        if (!selectedPatientId || !editingReport.title || !editingReport.content) return;
        setIsSaving(true);
        try {
            if (editingReport.id) {
                await storageService.updateClinicalReport(editingReport.id, {
                    title: editingReport.title,
                    reportType: editingReport.reportType,
                    content: editingReport.content
                });
            } else {
                await storageService.createClinicalReport({
                    patientId: selectedPatientId,
                    professionalId: user.id,
                    professionalRole: user.clinicalRole || 'PSICOLOGO',
                    title: editingReport.title,
                    reportType: editingReport.reportType,
                    content: editingReport.content
                });
            }
            // Refresh reports
            const reports = await storageService.getClinicalReports(selectedPatientId, user.id);
            setClinicalReports(reports);
            setIsEditingReport(false);
            setEditingReport({ id: '', title: '', reportType: 'evolucao', content: '' });
        } catch (error) {
            console.error("Failed to save report:", error);
            alert("Erro ao salvar relatório.");
        } finally {
            setIsSaving(false);
        }
    };`;
    // Insert before return if not found
    cleanContent = cleanContent.replace(/(return \(\s*<div)/, `${handleSaveReportCode}\n    $1`);
}

fs.writeFileSync(filePath, cleanContent);
console.log('Missing functions restored.');

