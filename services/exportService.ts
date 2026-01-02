
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MoodEntry, DoctorNote, UserRole } from '../types';

interface ExportConfig {
    startDate: string;
    endDate: string;
    professionalFilter: 'PSYCHOLOGIST' | 'PSYCHIATRIST' | 'BOTH';
    contentFilter: 'ENTRIES' | 'NOTES' | 'BOTH';
    userRole: string;
    patientName: string;
    aiInsight?: any; // Added: Optional AI longitudinal insight
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
    const pageWidth = doc.internal.pageSize.width;

    // 1. Premium Graphic Header (Clinical Branding)
    doc.setFillColor(15, 15, 15); // Dark surface
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("MoodFlow", 14, 25);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text("Clinical Intelligence Platform", 14, 32);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(`Relatório Gerado: ${new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });
    doc.text(`Protocolo: ${crypto.randomUUID().slice(0, 8).toUpperCase()}`, pageWidth - 14, 32, { align: 'right' });

    let finalY = 50;

    // 2. Patient Meta Information
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO PACIENTE", 14, finalY);
    finalY += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Nome: ${config.patientName}`, 14, finalY);
    doc.text(`Período: ${new Date(config.startDate).toLocaleDateString()} - ${new Date(config.endDate).toLocaleDateString()}`, pageWidth / 2, finalY);
    finalY += 15;

    // 3. AI Longitudinal Insight (Premium Feature)
    if (config.aiInsight) {
        doc.setFillColor(245, 247, 255); // Light blue wash
        doc.roundedRect(14, finalY, pageWidth - 28, 45, 3, 3, 'F');

        doc.setFontSize(11);
        doc.setTextColor(63, 81, 181); // Indigo
        doc.setFont("helvetica", "bold");
        doc.text("INTELIGÊNCIA CLÍNICA (AI INSIGHT)", 20, finalY + 10);

        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        const summaryLines = doc.splitTextToSize(config.aiInsight.summaryText || config.aiInsight.summary || "Nenhuma análise detalhada disponível.", pageWidth - 40);
        doc.text(summaryLines, 20, finalY + 18);

        doc.setFont("helvetica", "bold");
        doc.text(`Risco Detectado: ${config.aiInsight.riskLevel?.toUpperCase() || 'BAIXO'}`, 20, finalY + 38);

        finalY += 55;
    }

    // 4. Clinical Entries Table
    if (entries.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("HISTÓRICO DE REGISTROS", 14, finalY);
        finalY += 5;

        const tableData = entries.map(e => [
            new Date(e.timestamp).toLocaleDateString(),
            e.mood ? `${e.mood}/5` : '-',
            e.energy ? `${e.energy}/10` : '-',
            e.text || '-'
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Data', 'Humor', 'Energia', 'Relato Qualitativo']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
            columnStyles: { 3: { cellWidth: 'auto' } },
        });

        // @ts-ignore
        finalY = doc.lastAutoTable.finalY + 15;
    }

    // 5. Clinical Observations Table
    if (notes.length > 0) {
        if (finalY > doc.internal.pageSize.height - 40) doc.addPage();

        doc.setFontSize(12);
        doc.setTextColor(40, 40, 40);
        doc.setFont("helvetica", "bold");
        doc.text("OBSERVAÇÕES CLÍNICAS & RESPOSTAS", 14, finalY);
        finalY += 5;

        const tableData = notes.map(n => [
            new Date(n.createdAt).toLocaleDateString(),
            n.doctorRole === 'PSYCHOLOGIST' ? 'Psicologia' : 'Psiquiatria',
            n.authorRole === 'PATIENT' ? 'Paciente' : `Dr(a). ${n.doctorName || 'Profissional'}`,
            n.text
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [['Data', 'Especialidade', 'Interlocutor', 'Conteúdo da Mensagem']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255] },
            styles: { fontSize: 8, cellPadding: 4 },
        });
    }

    // 6. Footer (Page Numbers & Legal)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`MoodFlow Enterprise Edition - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        doc.text("Este documento contém informações clínicas confidenciais protegidas por sigilo profissional.", pageWidth / 2, doc.internal.pageSize.height - 14, { align: 'center' });
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
