
import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Improve handleUpdateClinic to be more robust
const handleUpdatePattern = /const handleUpdateClinic = async \(\) => \{[\s\S]*?setIsCreatingClinic\(false\);\s*\}\s*;/;
const newHandleUpdate = `const handleUpdateClinic = async () => {
        if (!selectedClinicId || !editingClinicName.trim()) return;
        setIsCreatingClinic(true);
        try {
            await storageService.updateClinic(selectedClinicId, editingClinicName);
            const updated = await storageService.getClinics(user.id);
            // We set state and then use a small timeout to let React process the render 
            // before the blocking alert pops up.
            setClinics(updated);
            setTimeout(() => {
                alert("Nome da unidade atualizado com sucesso!");
            }, 100);
        } catch (error) {
            console.error("Failed to update clinic:", error);
            alert("Erro ao atualizar nome da unidade. Verifique as permissões.");
        } finally {
            setIsCreatingClinic(false);
        }
    };`;

content = content.replace(handleUpdatePattern, newHandleUpdate);

// 2. Add an extra useEffect to ensure clinics are fresh when settings view is active
const useFetchEffectPattern = /useEffect\(\(\) => \{[\s\S]*?viewMode === 'clinic'[\s\S]*?\}, \[viewMode, user\.id\]\);/;
const newUseFetchEffect = `useEffect(() => {
        if (viewMode === 'clinic' || viewMode === 'clinic_settings') {
            storageService.getClinics(user.id).then(setClinics);
        }
    }, [viewMode, user.id]);`;

content = content.replace(useFetchEffectPattern, newUseFetchEffect);

fs.writeFileSync(filePath, content);
console.log('DoctorPortal.tsx patched for robust updates.');
