
import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore missing loadPatients function
const loadPatientsCode = `
    const loadPatients = async () => {
        const data = await storageService.getPatientsForDoctor(user.id);
        setPatients(data);
    };
`;
// Insert before handleConnectPatient
content = content.replace(/(const handleConnectPatient = async)/, `${loadPatientsCode}\n    $1`);

// 2. Restore missing handleSaveReport function
// Need to find state setters for report
const reportState = `
    const [isEditingReport, setIsEditingReport] = useState(false);
    const [editingReport, setEditingReport] = useState<{ id: string, title: string, reportType: 'evolucao' | 'avaliacao' | 'encaminhamento', content: string }>({ id: '', title: '', reportType: 'evolucao', content: '' });
    const [isSaving, setIsSaving] = useState(false);
`;

// Insert state if missing (it might be missing too based on lint errors for isSaving)
// Checking if isSaving is defined
if (!content.includes('const [isSaving, setIsSaving]')) {
    content = content.replace(/(const \[isGeneratingSummary, setIsGeneratingSummary\] = useState\(false\);)/, `$1\n${reportState}`);
}

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
    };
`;

// Insert before return if not found
if (!content.includes('const handleSaveReport')) {
    content = content.replace(/(return \(\s*<div)/, `${handleSaveReportCode}\n    $1`);
}

// 3. Fix handleUpdateClinic (remove alert, add redirect)
// Use a robust regex to find the function, including the setTimeout version if it exists
const handleUpdatePattern = /const handleUpdateClinic = async \(\) => \{[\s\S]*?setIsCreatingClinic\(false\);\s*\}\s*;/;
const newHandleUpdate = `const handleUpdateClinic = async () => {
        if (!selectedClinicId || !editingClinicName.trim()) return;
        setIsCreatingClinic(true);
        try {
            await storageService.updateClinic(selectedClinicId, editingClinicName);
            const updated = await storageService.getClinics(user.id);
            setClinics(updated);
            setViewMode('clinic'); 
        } catch (error) {
            console.error("Failed to update clinic:", error);
            alert("Erro ao atualizar nome da unidade. Verifique as permissões.");
        } finally {
            setIsCreatingClinic(false);
        }
    };`;

content = content.replace(handleUpdatePattern, newHandleUpdate);

fs.writeFileSync(filePath, content);
console.log('DoctorPortal.tsx patched: Alert removed, Redirect added, Missing functions restored.');
