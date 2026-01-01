
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MoodEntry, DoctorNote, UserRole } from '../types';

interface ExportConfig {
    startDate: string;
    endDate: string;
    professionalFilter: 'PSYCHOLOGIST' | 'PSYCHIATRIST' | 'BOTH';
    contentFilter: 'ENTRIES' | 'NOTES' | 'BOTH';
    userRole: string; // The role of the user requesting the export
    patientName: string;
}

export const exportService = {
    // Main Entry Point
    generateReport: (entries: MoodEntry[], notes: DoctorNote[], config: ExportConfig, format: 'PDF' | 'CSV' | 'EXCEL' | 'PRINT') => {
        // 1. Filter Data based on Config & Permissions
        const filteredEntries = filterEntries(entries, config);
        const filteredNotes = filterNotes(notes, config);

        // 2. Generate based on format
        switch (format) {
            case 'PDF':
            case 'PRINT':
                return generatePDF(filteredEntries, filteredNotes, config, format === 'PRINT');
            case 'CSV':
                return generateCSV(filteredEntries, filteredNotes, config);
            case 'EXCEL':
                return generateExcel(filteredEntries, filteredNotes, config);
        }
    }
};

// --- FILTERS ---

const filterEntries = (entries: MoodEntry[], config: ExportConfig) => {
    if (config.contentFilter === 'NOTES') return []; // Only notes requested

    const start = new Date(config.startDate).getTime();
    const end = new Date(config.endDate).getTime() + (24 * 60 * 60 * 1000); // End of day

    return entries.filter(e => {
        const t = e.timestamp;
        return t >= start && t <= end;
    }).sort((a, b) => a.timestamp - b.timestamp);
};

const filterNotes = (notes: DoctorNote[], config: ExportConfig) => {
    if (config.contentFilter === 'ENTRIES') return []; // Only entries requested

    const start = new Date(config.startDate).getTime();
    const end = new Date(config.endDate).getTime() + (24 * 60 * 60 * 1000);

    return notes.filter(n => {
        const t = new Date(n.createdAt).getTime();
        const withinTime = t >= start && t <= end;
        if (!withinTime) return false;

        // Security / Isolation Logic
        // If user is Psychologist, CANNOT see Psychiatrist notes
        if (config.userRole === 'PSYCHOLOGIST' && n.doctorRole === 'PSYCHIATRIST') return false;
        // If user is Psychiatrist, CANNOT see Psychologist notes
        if (config.userRole === 'PSYCHIATRIST' && n.doctorRole === 'PSYCHOLOGIST') return false;

        // Filter by request
        if (config.professionalFilter === 'PSYCHOLOGIST' && n.doctorRole !== 'PSYCHOLOGIST') return false;
        if (config.professionalFilter === 'PSYCHIATRIST' && n.doctorRole !== 'PSYCHIATRIST') return false;

        return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// --- GENERATORS ---

const generatePDF = (entries: MoodEntry[], notes: DoctorNote[], config: ExportConfig, autoPrint: boolean) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("Relatório Clínico - MoodFlow", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Paciente: ${config.patientName}`, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 33);
    doc.text(`Período: ${new Date(config.startDate).toLocaleDateString()} a ${new Date(config.endDate).toLocaleDateString()}`, 14, 38);

    let finalY = 45;

    // Section: Entries
    if (entries.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0); // Black
        doc.text("Registros do Paciente", 14, finalY);
        finalY += 5;

        const tableData = entries.map(e => [
            new Date(e.timestamp).toLocaleDateString() + ' ' + new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            e.mood ? `${e.mood}/5` : '-',
            e.energy ? `${e.energy}/10` : '-',
            e.text || '-'
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Data', 'Humor', 'Energia', 'Relato']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [63, 81, 181] }, // Indigo
            columnStyles: { 3: { cellWidth: 'auto' } }, // Text wrap
        });

        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 15;
    }

    // Section: Notes
    if (notes.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Anotações Clínicas & Comentários", 14, finalY);
        finalY += 5;

        const tableData = notes.map(n => [
            new Date(n.createdAt).toLocaleDateString() + ' ' + new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            n.doctorRole === 'PSYCHOLOGIST' ? 'Psicologia' : n.doctorRole === 'PSYCHIATRIST' ? 'Psiquiatria' : 'N/A',
            n.authorRole === 'PATIENT' ? 'Paciente' : `Profissional (${n.doctorName})`,
            n.text
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Data', 'Área', 'Autor', 'Conteúdo']],
            body: tableData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [76, 175, 80] }, // Green
            columnStyles: { 3: { cellWidth: 'auto' } },
        });
    }

    // Footer with Page Numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount} - CONFIDENCIAL - MoodFlow Enterprise`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    if (autoPrint) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(`MoodFlow_Relatorio_${config.patientName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
};

const generateCSV = (entries: MoodEntry[], notes: DoctorNote[], config: ExportConfig) => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM for Excel

    // Entries
    if (entries.length > 0) {
        csvContent += "TIPO,DATA,HUMOR,ENERGIA,AUTOR/AREA,TEXTO\n";
        entries.forEach(e => {
            const row = [
                "REGISTRO",
                new Date(e.timestamp).toISOString(),
                e.mood || "",
                e.energy || "",
                "PACIENTE",
                `"${(e.text || "").replace(/"/g, '""')}"` // Escape quotes
            ];
            csvContent += row.join(",") + "\n";
        });
    }

    // Notes
    if (notes.length > 0) {
        notes.forEach(n => {
            const row = [
                "COMENTARIO",
                new Date(n.createdAt).toISOString(),
                "", // No mood
                "", // No energy
                `${n.doctorRole} - ${n.authorRole}`,
                `"${(n.text || "").replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `moodflow_export_${config.patientName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const generateExcel = (entries: MoodEntry[], notes: DoctorNote[], config: ExportConfig) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Entries
    if (entries.length > 0) {
        const entData = entries.map(e => ({
            Data: new Date(e.timestamp).toISOString(),
            Humor: e.mood,
            Energia: e.energy,
            Texto: e.text
        }));
        const wsEnt = XLSX.utils.json_to_sheet(entData);
        XLSX.utils.book_append_sheet(wb, wsEnt, "Registros do Paciente");
    }

    // Sheet 2: Notes
    if (notes.length > 0) {
        const noteData = notes.map(n => ({
            Data: new Date(n.createdAt).toISOString(),
            Area: n.doctorRole,
            Autor: n.authorRole,
            Profissional: n.doctorName || 'N/A',
            Conteudo: n.text
        }));
        const wsNotes = XLSX.utils.json_to_sheet(noteData);
        XLSX.utils.book_append_sheet(wb, wsNotes, "Anotações Clínicas");
    }

    XLSX.writeFile(wb, `MoodFlow_Relatorio_${config.patientName}.xlsx`);
};
