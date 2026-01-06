
export enum UserRole {
  PACIENTE = 'PACIENTE',
  PSICOLOGO = 'PSICOLOGO',
  PSIQUIATRA = 'PSIQUIATRA',
  ADMIN_CLINICA = 'ADMIN_CLINICA',
}

export type ClinicalRole = 'PSICOLOGO' | 'PSIQUIATRA' | 'none';
export type ClinicRole = 'admin' | 'member' | 'none';

export type Language = 'pt' | 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ar';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole; // Legacy/Main role (PATIENT/PROFESSIONAL)
  clinicalRole: ClinicalRole; // psychologist | psychiatrist
  clinicRole: ClinicRole; // admin | member | none
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
  visible_to_psychologist?: boolean | null; // Granular control
  visible_to_psychiatrist?: boolean | null; // Granular control
  aiAnalysis?: {
    sentiment: string;
    triggers: string[];
    summary: string;
  };
  aiClinicalInsight?: any; // New: Link to ai_clinical_insight in DB
}

export interface DoctorNote {
  id: string;
  doctorId: string;
  doctorName?: string;
  doctorRole?: UserRole;
  patientId: string;
  entryId?: string;
  threadId?: string; // New: Link to a message thread
  text: string;
  isShared: boolean;
  authorRole: 'PSICOLOGO' | 'PSIQUIATRA' | 'ADMIN_CLINICA' | 'PACIENTE';
  visibility?: 'PRIVATE' | 'PATIENT_VISIBLE'; // New for admin segregation
  professionalType?: string;
  parentNoteId?: string;
  read: boolean;
  status?: 'active' | 'resolved' | 'hidden';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'comment_created' | 'entry_shared' | 'risk_alert' | 'message_created';
  title: string;
  message: string;
  data: any;
  readAt: string | null;
  createdAt: string;
}

export interface AiInsight {
  id: string;
  patientId: string;
  period: 'weekly' | 'monthly' | 'longitudinal';
  summary: string;
  riskScore: number;
  patterns: string[];
  metadata?: any;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  patientId: string;
  professionalId: string;
  specialty: 'PSICOLOGO' | 'PSIQUIATRA';
  createdAt: string;
}

export interface RiskAlert {
  id: string;
  doctorId?: string;
  patientId?: string;
  entryId?: string;
  riskLevel: 'high' | 'medium';
  message: string;
  isResolved: boolean;
  createdAt: string;
}

export interface ViewLog {
  id: string;
  viewerId: string;
  entryId: string;
  viewedAt: string;
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
