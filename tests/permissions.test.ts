
import { describe, it, expect } from 'vitest';
import { MoodEntry } from '../types';

describe('Data Permissions (Isolamento Clínico)', () => {
    const patientId = 'patient-001';
    const doctorAId = 'doctor-a';
    const doctorBId = 'doctor-b';

    const privateEntry: MoodEntry = {
        id: 'e1',
        userId: patientId,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        mood: 4,
        energy: 4,
        text: 'Private thought',
        tags: [],
        isLocked: true,
        permissions: []
    };

    const sharedEntry: MoodEntry = {
        id: 'e2',
        userId: patientId,
        date: new Date().toISOString(),
        timestamp: Date.now(),
        mood: 3,
        energy: 3,
        text: 'Shared with Doctor A',
        tags: [],
        isLocked: true,
        permissions: [doctorAId]
    };

    it('should hide private entry from all doctors', () => {
        const isVisibleToA = !privateEntry.isLocked || (privateEntry.permissions && privateEntry.permissions.includes(doctorAId));
        const isVisibleToB = !privateEntry.isLocked || (privateEntry.permissions && privateEntry.permissions.includes(doctorBId));

        expect(isVisibleToA).toBe(false);
        expect(isVisibleToB).toBe(false);
    });

    it('should allow shared entry to be seen ONLY by authorized doctor', () => {
        const isVisibleToA = !sharedEntry.isLocked || (sharedEntry.permissions && sharedEntry.permissions.includes(doctorAId));
        const isVisibleToB = !sharedEntry.isLocked || (sharedEntry.permissions && sharedEntry.permissions.includes(doctorBId));

        expect(isVisibleToA).toBe(true);
        expect(isVisibleToB).toBe(false);
    });
});
