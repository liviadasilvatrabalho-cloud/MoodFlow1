
export enum UserRole {
  PATIENT = 'PATIENT',
  PROFESSIONAL = 'PROFESSIONAL',
  PSYCHOLOGIST = 'PSYCHOLOGIST',
  PSYCHIATRIST = 'PSYCHIATRIST',
}

export type Language = 'pt' | 'en' | 'es' | 'fr';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  language: Language;
  roleConfirmed: boolean;
  type?: 'medico' | 'paciente' | 'pessoa' | 'psicologo' | 'psiquiatra';
  joinedAt: string;
}

export interface MoodEntry {
  id: string;
  userId: string;
  date: string; // ISO String
  timestamp: number;
  mood: number | null; // 1-5 or null if just diary
  moodLabel?: string;
  energy?: number; // 1-10
  text: string;
  tags: string[]; // Activities/Symptoms
  isLocked: boolean; // Privacy for doctor view
  entryMode?: 'mood' | 'voice' | 'diary';
  permissions?: string[]; // List of doctor IDs who can view this entry
  aiAnalysis?: {
    sentiment: string;
    triggers: string[];
    summary: string;
  };
}

export interface DoctorNote {
  id: string;
  doctorId: string;
  patientId: string;
  entryId?: string; // Optional: Link to a specific mood entry
  text: string;
  isShared: boolean; // true = visible to patient, false = private clinical note
  authorRole: 'PROFESSIONAL' | 'PATIENT'; // Who wrote this note?
  read: boolean; // For notifications
  status?: 'active' | 'resolved' | 'hidden'; // For patient thread management
  createdAt: string;
}

// Recharts data shapes
export interface ChartDataPoint {
  name: string;
  value: number;
  secondary?: number;
}

// Database Charts Table
export interface ChartEntry {
  id: string;
  user_id: string;
  chart_type: 'weekly_mood' | 'energy_level';
  data: any; // JSONB
  created_at: string;
}

// Database View: medical_dashboard
export interface MedicalDashboardRow {
  patient_id: string;
  patient_name: string;
  patient_email: string;
  last_mood: number | null;
  last_mood_label: string | null;
  last_update: string | null; // ISO
  total_entries: number;
  avg_mood_7d: number | null;
  status_alert: 'Normal' | 'Risk' | 'Inactive'; // Based on View logic
}
