
import { describe, it, expect, vi } from 'vitest';
import { UserRole } from '../types';

// Mock Storage Service
const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.PATIENT,
};

describe('Auth & Roles Validation', () => {
    it('should identify a valid Patient role', () => {
        const role = UserRole.PATIENT;
        expect(role).toBe('PATIENT');
    });

    it('should identify a valid Professional role', () => {
        const role = UserRole.PROFESSIONAL;
        expect(role).toBe('PROFESSIONAL');
    });

    it('should not have a "STANDARD" role in the UserRole enum', () => {
        // Current roles are PATIENT, PROFESSIONAL, PSYCHOLOGIST, PSYCHIATRIST
        const roles = Object.values(UserRole);
        expect(roles).not.toContain('STANDARD');
    });

    it('should correctly map professional subtypes', () => {
        expect(UserRole.PSYCHOLOGIST).toBe('PSYCHOLOGIST');
        expect(UserRole.PSYCHIATRIST).toBe('PSYCHIATRIST');
    });
});
