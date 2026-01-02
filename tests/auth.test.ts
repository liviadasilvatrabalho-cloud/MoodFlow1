
import { describe, it, expect, vi } from 'vitest';
import { UserRole } from '../types';

// Mock Storage Service
const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.PACIENTE,
};

describe('Auth & Roles Validation', () => {
    it('should identify a valid Patient role', () => {
        const userRole: UserRole = UserRole.PACIENTE;
        expect(userRole).toBe(UserRole.PACIENTE);
    });

    it('should identify a valid Professional role', () => {
        const role = UserRole.PSICOLOGO;
        expect(role).toBe('PSICOLOGO');
    });

    it('should not have a "STANDARD" role in the UserRole enum', () => {
        // Current roles are PACIENTE, PSICOLOGO, PSIQUIATRA, ADMIN_CLINICA
        const roles = Object.values(UserRole);
        expect(roles).not.toContain('STANDARD');
    });

    it('should correctly map professional subtypes', () => {
        // Current roles are PACIENTE, PSICOLOGO, PSIQUIATRA, ADMIN_CLINICA
        const roles = Object.values(UserRole); // Added this line to define 'roles' within this scope
        expect(roles).toContain(UserRole.PSICOLOGO);
        expect(roles).toContain(UserRole.PSIQUIATRA);
    });
});
