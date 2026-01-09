
import fs from 'fs';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The file has a mess around lines 218-266 (in recent view)
// We need to find `const toggleRecording` and `const handleSendAudio`.
// And replace everything in between with the correct functions.

const startPattern = /const toggleRecording = \(\) => \{[\s\S]*?setIsRecording\(true\);\s*\}\s*;/;
const endPattern = /const handleSendAudio/;

// We need to keep toggleRecording (it seems correct in lines 137-182, but let's be safe).
// Actually, looking at the file view, there are TWO toggleRecordings?
// View 1451:
// 137: const toggleRecording ...
// 182: };
// 218: [Garbage starts]

// So safe bet: Find the FIRST toggleRecording. Keep it.
// Find `handleSendAudio`.
// Replace everything between the end of FIRST toggleRecording and START of handleSendAudio with the missing functions.

// But wait, `handleSendAudio` might be far down.
// Let's rely on string replacement of the specific garbage block if possible, or use a robust anchor.

// Anchor 1: End of toggleRecording (the correct one).
// It ends with `setIsRecording(true); } };` (approx)

// Anchor 2: Start of handleSendAudio.
// `const handleSendAudio = async`

// Let's construct the functions to insert.
const missingFunctions = `
    const loadPatients = async () => {
        const data = await storageService.getPatientsForDoctor(user.id);
        setPatients(data);
    };

    const handleConnectPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await storageService.connectPatient(user.id, connectEmail);
        if (result.success) {
            loadPatients();
            setConnectEmail('');
            alert("Success");
        } else {
            alert((t as any)[result.message] || result.message);
        }
    };

    const handleSavePrivateNote = async () => {
        if (!newNote.trim() || !selectedPatientId) return;
        const note: DoctorNote = {
            id: crypto.randomUUID(),
            doctorId: user.id,
            patientId: selectedPatientId,
            text: newNote,
            isShared: false,
            authorRole: (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
            read: true,
            createdAt: new Date().toISOString()
        };

        // Optimistic update
        setNotes(prev => [...prev, note]);
        const currentNote = newNote;
        setNewNote('');

        try {
            await storageService.saveDoctorNote(note);
        } catch (error) {
            console.error("Error saving private note:", error);
            setNewNote(currentNote); // Restore text on failure
        }
    };

    const handleSaveEntryComment = async (entryId: string) => {
        if (!entryComment.trim() || !selectedPatientId) return;

        const currentComment = entryComment;
        try {
            // Normalize clinical role to what DB expects (uppercase) - Default to PSICOLOGO as it's the primary role
            const specialty = (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? 'PSIQUIATRA' : 'PSICOLOGO';
            const thread = await storageService.getOrCreateThread(selectedPatientId, user.id, specialty);

            const newNote: DoctorNote = {
                id: crypto.randomUUID(),
                doctorId: user.id,
                doctorName: user.name,
                doctorRole: (user.clinicalRole === 'psychiatrist' || user.clinicalRole === 'PSIQUIATRA') ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                patientId: selectedPatientId,
                entryId,
                threadId: thread.id,
                text: entryComment,
                isShared: true,
                authorRole: specialty === 'PSIQUIATRA' ? UserRole.PSIQUIATRA : UserRole.PSICOLOGO,
                read: false,
                createdAt: new Date().toISOString()
            };

            await storageService.saveDoctorNote(newNote);
            setEntryComment('');
            setCommentingEntryId(null);

            // Refresh notes for current patient (Subscription also handles this, but explicit refresh for immediate feedback)
            const patientNotes = await storageService.getPatientNotes(selectedPatientId);
            setNotes(patientNotes);
        } catch (err: any) {
            console.error("Fail to save threaded comment", err);
            alert("Falha ao enviar mensagem: " + (err.message || "Erro desconhecido"));
            setEntryComment(currentComment);
        }
    };
    
    // Also include handleSaveReport if it was missed
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
    };
`;

// Find the index of the FIRST toggleRecording end.
// It ends around line 182.
// We can find it by searching for the code block.
// Key identifier for end of toggleRecording:
// `setIsRecording(true); } };` (ignoring whitespace)

// The garbage starts AFTER `setIsRecording(true); } };`

// Strategy: Split file by `setIsRecording(true);`
// The FIRST occurrence is inside the valid toggleRecording.
// The SECOND occurrence might be in the garbage or not exist if I removed it?
// In view 1496: `setIsRecording(true);` is at line 211 (garbage start).
// And also at 228 (garbage duplication).

// The VALID one is at 181 (view 1451).

// So I will find the location of `const toggleRecording` and iterate lines until I find the closing brace.
// Then I will delete everything until `const handleSendAudio`.

const lines = content.split('\n');
let toggleRecordingStart = -1;
let toggleRecordingEnd = -1;
let handleSendAudioStart = -1;
let handleSaveReportStart = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const toggleRecording = () => {') && toggleRecordingStart === -1) {
        toggleRecordingStart = i;
    }
    if (lines[i].includes('const handleSendAudio = async') && handleSendAudioStart === -1) {
        handleSendAudioStart = i;
    }
    if (lines[i].includes('const handleSaveReport = async') && handleSaveReportStart === -1) {
        handleSaveReportStart = i;
    }
}

// Find end of toggleRecording semi-manually or assume it ends before the garbage.
// The garbage starts around line 217 (view 1496) or 186 (view 1451).
// The garbage is `// --- CLINICAL REPORTS STATE (NEW) ---` which appeared in view 1451.
// But in view 1496 it starts with `recognitionRef.current.onend`.

// Let's assume toggleRecordingStart is correct (around 137).
// We want to keep it.
// We want to delete from (toggleRecordingStart + ~50 lines) up to handleSendAudioStart.

// To be safe, let's look for "recognitionRef.current.start(); setIsRecording(true); }"
// That marks the end of toggleRecording logic.
// There is one at 179-181 (valid).
// And one at 210-212 (garbage).

// I will construct a new file content.
// 0 -> end of valid toggleRecording.
// Insert missingFunctions.
// handleSendAudioStart -> end.

// Finding end of valid toggleRecording:
let validEndIndex = -1;
let braceCount = 0;
let insideToggle = false;
for (let i = toggleRecordingStart; i < lines.length; i++) {
    // This is a naive brace counter, might fail with comments/strings but usually ok for this file
    const line = lines[i];
    braceCount += (line.match(/\{/g) || []).length;
    braceCount -= (line.match(/\}/g) || []).length;

    if (braceCount === 0 && i > toggleRecordingStart) {
        validEndIndex = i;
        break;
    }
}

// If brace counting fails, fallback to line number ~182 based on view 1451
if (validEndIndex === -1 || validEndIndex > 200) {
    validEndIndex = toggleRecordingStart + 45; // Approx
    // Search for `setIsRecording(true);` and then `}`
    for (let i = toggleRecordingStart; i < lines.length; i++) {
        if (lines[i].includes('setIsRecording(true);')) {
            // The next few lines should close it.
            // Check i+1 or i+2 for `}`
            if (lines[i + 1].includes('}')) { validEndIndex = i + 1; break; }
            if (lines[i + 2].includes('}')) { validEndIndex = i + 2; break; }
        }
    }
}

const before = lines.slice(0, validEndIndex + 1).join('\n');
const after = lines.slice(handleSendAudioStart).join('\n');

const newContent = before + '\n\n' + missingFunctions + '\n\n' + after;

fs.writeFileSync(filePath, newContent);
console.log('DoctorPortal.tsx functions restored and garbage removed.');
