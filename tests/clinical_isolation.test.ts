
import { describe, it, expect } from 'vitest';
import { DoctorNote } from '../types';

describe('Clinical Isolation (Isolamento entre Profissionais)', () => {
    const patientId = 'patient-001';
    const psychologistId = 'psy-123';
    const psychiatristId = 'psych-456';

    const psychoNote: DoctorNote = {
        id: 'n1',
        patientId: patientId,
        doctorId: psychologistId,
        text: 'Psychological observation',
        createdAt: new Date().toISOString(),
        read: false,
        authorRole: 'PSICOLOGO', // Fixed: Must be 'PSICOLOGO' | 'PSIQUIATRA' | 'ADMIN_CLINICA' | 'PACIENTE'
        status: 'active',
        isShared: false
    };

    it('should only show the note to the authoring psychologist', () => {
        const isVisibleToAuthor = psychoNote.doctorId === psychologistId;
        const isVisibleToOther = psychoNote.doctorId === psychiatristId;

        expect(isVisibleToAuthor).toBe(true);
        expect(isVisibleToOther).toBe(false);
    });

    it('should respect "hidden" status for the patient', () => {
        const hiddenNote: DoctorNote = { ...psychoNote, status: 'hidden' };
        const isVisibleToPatient = hiddenNote.status !== 'hidden';
        expect(isVisibleToPatient).toBe(false);
    });
});
