
import fs from 'fs';
import path from 'path';

const filePath = 'c:/Users/dasil/Downloads/1/MoodFlow1/components/doctor/DoctorPortal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Configurar onClick
const configurarPattern = /onClick=\{([^}]*)\}\s*>\s*Configurar\s*<\/Button>/g;
content = content.replace(configurarPattern, (match, p1) => {
    if (p1.includes('setEditingClinicName')) return match;
    return `onClick={() => {
                                                                    setSelectedClinicId(membership.clinics.id);
                                                                    setEditingClinicName(membership.clinics.name);
                                                                    setViewMode('clinic_settings');
                                                                }}>Configurar</Button>`;
});

// 2. Enable input in clinic_settings view
const inputPattern = /<input\s+type="text"\s+className="w-full bg-black\/40 border border-white\/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"\s+value=\{clinics.find\(c => c.clinics.id === selectedClinicId\)\?.clinics.name \|\| ''\}\s+onChange=\{\(\) => \{ \}\}\s+\/\/ Placeholder for now to avoid readonly warning\s+disabled\s+\/>\s+<p className="text-\[10px\] text-gray-500 italic">A edição de nome está desabilitada para esta versão\.<\/p>/;

const newInput = `<input
                                                    type="text"
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                                    value={editingClinicName}
                                                    onChange={e => setEditingClinicName(e.target.value)}
                                                    placeholder="Digite o nome da unidade..."
                                                />
                                                <p className="text-[10px] text-gray-500 italic mt-1">Nome atual: {clinics.find(c => c.clinics.id === selectedClinicId)?.clinics.name}</p>`;

content = content.replace(inputPattern, newInput);

// 3. Update Save Button
const saveButtonPattern = /<Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3">\s+Salvar Alterações\s+<\/Button>/;

const newSaveButton = `<Button 
                                                    onClick={handleUpdateClinic}
                                                    disabled={isCreatingClinic || !editingClinicName.trim()}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                                >
                                                    {isCreatingClinic ? 'Salvando...' : 'Salvar Alterações'}
                                                </Button>`;

content = content.replace(saveButtonPattern, newSaveButton);

fs.writeFileSync(filePath, content);
console.log('DoctorPortal.tsx patched successfully.');
