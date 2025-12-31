import { vi } from 'vitest';
import { aiService } from '../services/aiService';

// Mock Supabase
vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            signInWithPassword: vi.fn(),
            signUp: vi.fn(),
            signOut: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        })),
    },
}));

// Mock AI Service
vi.mock('../services/aiService', () => ({
    aiService: {
        analyzeEntry: vi.fn().mockResolvedValue({
            transcription: 'Mocked entry',
            mode: 'mood',
            moodScore: 4,
            energyLevel: 8,
            detectedTags: ['Test'],
            intentToSave: true
        }),
        summarizeHistory: vi.fn().mockResolvedValue({
            patterns: ['Pattern A'],
            riskLevel: 'low',
            recommendations: ['Rec A'],
            summaryText: 'Summary A'
        })
    }
}));

// Mock window.crypto for UUIDs in tests
Object.defineProperty(window, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid'
    }
});

// Mock URL and Blob for exports
global.URL.createObjectURL = vi.fn();
global.Blob = vi.fn();
