
import { MoodEntry, User, DoctorNote, UserRole, Language, ClinicalRole, ClinicRole, Notification, AiInsight, MessageThread } from '../types';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Centralized Role Normalization ---
const normalizeRole = (rawRole: string | undefined): UserRole => {
    if (!rawRole) return UserRole.PATIENT;
    const r = rawRole.toLowerCase().trim();
    if (r === 'psicologo' || r === 'psychologist' || r === 'psicólogo') return UserRole.PSYCHOLOGIST;
    if (r === 'psiquiatra' || r === 'psychiatrist') return UserRole.PSYCHIATRIST;
    if (r === 'medico' || r === 'professional' || r === 'profissional' || r === 'saúde') return UserRole.PROFESSIONAL;
    if (r === 'admin_clinica' || r === 'clinic_admin' || r === 'admin' || r === 'gestão' || r === 'unidade' || r === 'admin_clinica') return UserRole.CLINIC_ADMIN;
    return UserRole.PATIENT; // Default for 'paciente', 'pessoa', 'patient', etc.
};

// --- Helper to map DB User -> Application User ---
const mapDbUserToUser = (dbUser: any, authName?: string): User => {
    const role = normalizeRole(dbUser.role);

    // Prioritize DB name if it exists and isn't just "User" default, 
    // otherwise use Auth Metadata name, 
    // otherwise fall back to 'User'
    let finalName = dbUser.name;

    const invalidNames = ['user', 'usuário', 'usuario', 'admin', 'administrator'];
    const dbNameLower = finalName ? finalName.toLowerCase().trim() : '';

    if (!finalName || invalidNames.includes(dbNameLower) || finalName.trim() === '') {
        if (authName && authName.trim() !== '') {
            finalName = authName;
        }
    }

    return {
        id: dbUser.id,
        email: dbUser.email,
        name: finalName || 'User',
        role: role,
        clinicalRole: (dbUser.clinical_role as ClinicalRole) ||
            (role === UserRole.PSYCHOLOGIST ? 'psychologist' :
                role === UserRole.PSYCHIATRIST ? 'psychiatrist' : 'none'),
        clinicRole: (dbUser.clinic_role as ClinicRole) || 'none',
        language: (dbUser.language as Language) || 'pt',
        roleConfirmed: dbUser.role_confirmed || false,
        joinedAt: dbUser.joined_at || dbUser.created_at || new Date().toISOString()
    }
};

export const storageService = {

    // --- Auth & User Management ---

    onAuthStateChanged: (callback: (user: User | null) => void) => {
        const fetchAndSetUser = async (sessionUser: any) => {
            if (!sessionUser) {
                callback(null);
                return;
            }
            try {
                const { data: dbUser, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', sessionUser.id)
                    .single();

                if (error || !dbUser) {
                    console.error("Error fetching user:", error);

                    // NEW: Check if we have a pending role from Auth screen
                    const pendingRole = localStorage.getItem('moodflow_selected_role') as UserRole || UserRole.PATIENT;

                    // Fallback using session metadata
                    const fallbackUser: User = {
                        id: sessionUser.id,
                        email: sessionUser.email!,
                        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || 'User',
                        role: pendingRole || sessionUser.user_metadata?.role || UserRole.PATIENT,
                        clinicalRole: (pendingRole === UserRole.PSYCHOLOGIST ? 'psychologist' : pendingRole === UserRole.PSYCHIATRIST ? 'psychiatrist' : 'none') as ClinicalRole,
                        clinicRole: 'none',
                        language: 'pt',
                        roleConfirmed: true,
                        joinedAt: sessionUser.created_at || new Date().toISOString()
                    };
                    callback(fallbackUser);

                    // If it was a first-time login without a profile, save the initial profile now
                    if (!dbUser) {
                        storageService.saveUser(fallbackUser).catch(console.error);
                        // Only clear after we are sure we tried to save
                        localStorage.removeItem('moodflow_selected_role');
                    }
                } else {
                    const mappedUser = mapDbUserToUser(dbUser, sessionUser.user_metadata?.full_name);
                    callback(mappedUser);

                    // Auto-repair: If the DB had a generic name but we found a better one in metadata, save it back to DB
                    if (mappedUser.name !== dbUser.name && sessionUser.user_metadata?.full_name) {
                        const invalidNames = ['user', 'usuário', 'usuario'];
                        const dbNameLower = dbUser.name ? dbUser.name.toLowerCase().trim() : '';

                        if (invalidNames.includes(dbNameLower)) {
                            console.log("Auto-repairing user name in DB...", mappedUser.name);
                            storageService.saveUser(mappedUser).catch(e => console.warn("Auto-repair failed", e));
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                callback(null);
            }
        };

        // Initial check
        supabase.auth.getSession().then(({ data: { session } }) => {
            fetchAndSetUser(session?.user);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            fetchAndSetUser(session?.user);
        });

        return () => subscription.unsubscribe();
    },

    loginEmail: async (email: string, pass: string): Promise<User> => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (!data.user) throw new Error("No user returned");

        // Fetch from profiles table
        const { data: dbUser } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (dbUser) return mapDbUserToUser(dbUser, data.user.user_metadata?.full_name);

        // Fallback
        return {
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'User',
            role: UserRole.PATIENT,
            clinicalRole: 'none',
            clinicRole: 'none',
            language: 'pt',
            roleConfirmed: false,
            joinedAt: new Date().toISOString()
        };
    },

    signupEmail: async (email: string, pass: string, name: string, role: UserRole): Promise<void> => {
        const clinicalRole = (role === UserRole.PSYCHOLOGIST ? 'psychologist' :
            role === UserRole.PSYCHIATRIST ? 'psychiatrist' : 'none') as ClinicalRole;

        const { error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    full_name: name,
                    role: role,
                    clinical_role: clinicalRole,
                    clinic_role: 'none',
                    role_confirmed: true // Email signup already confirms role
                }
            }
        });
        if (error) throw error;
    },


    resetPassword: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
    },

    saveUser: async (user: User) => {
        const now = new Date().toISOString();

        const { error: profileError } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            clinical_role: user.clinicalRole,
            clinic_role: user.clinicRole,
            language: user.language,
            role_confirmed: user.roleConfirmed
        });

        if (profileError) {
            console.error("Error saving to profiles:", profileError);
            throw profileError;
        }
    },

    logout: async () => {
        try {
            // Criamos uma promessa que resolve após um timeout para evitar travamento total
            const logoutTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout ao deslogar")), 3000)
            );

            // Corrida entre o signOut real e o timeout
            await Promise.race([
                supabase.auth.signOut(),
                logoutTimeout
            ]);

            // Sucesso ou Timeout, limpamos tudo e recarregamos para garantir
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        } catch (e: any) {
            console.warn("Logout suave falhou, forçando limpeza:", e.message);
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
    },

    deleteAccount: async (userId: string) => {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.signOut();
    },

    // --- Entries Management ---

    subscribeEntries: (userId: string, callback: (entries: MoodEntry[]) => void) => {
        const fetchEntries = async () => {
            // First get entries
            const { data: entriesData, error: entriesError } = await supabase
                .from('entries')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false });

            if (entriesError) {
                console.error("Erro ao buscar registros: " + entriesError.message);
                return;
            }

            if (entriesData) {
                // Fetch permissions for all entries in one go (optional optimization, but let's keep it simple for now)
                const entryIds = entriesData.map(e => e.id);
                const { data: permissionsData } = await supabase
                    .from('entry_permissions')
                    .select('entry_id, doctor_id')
                    .in('entry_id', entryIds)
                    .eq('can_view', true);

                const mapped = entriesData.map(row => {
                    const entryPermissions = permissionsData
                        ? permissionsData.filter(p => p.entry_id === row.id).map(p => p.doctor_id)
                        : [];

                    return {
                        ...row,
                        userId: row.user_id,
                        timestamp: new Date(row.date).getTime(),
                        moodLabel: row.mood_label,
                        isLocked: row.is_locked,
                        permissions: entryPermissions,
                        entryMode: row.ai_analysis?.entry_mode || (row.mood === null ? 'diary' : 'mood'),
                        aiAnalysis: row.ai_analysis
                    };
                });
                callback(mapped as MoodEntry[]);
            }
        };

        fetchEntries();

        const channel = supabase
            .channel('entries-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` }, () => {
                fetchEntries();
            })
            // Also listen for permission changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'entry_permissions' }, () => {
                fetchEntries();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    addEntry: async (userId: string, entry: MoodEntry) => { // userId arg kept for interface compatibility but we use auth user
        // 1. Force fetch authenticated user to prevent ID spoofing/mismatch
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.error("Critical: No authenticated user found during save.");
            throw new Error("User not authenticated");
        }

        // Map helper
        const dbEntry = {
            id: entry.id, // Explicitly use the client-generated ID
            user_id: user.id, // Explicitly use the auth token's user ID
            date: new Date(entry.timestamp).toISOString(),
            mood: entry.mood,
            mood_label: entry.moodLabel,
            energy: entry.energy,
            text: entry.text,
            tags: entry.tags,
            is_locked: entry.isLocked,
            ai_analysis: {
                ...entry.aiAnalysis,
                entry_mode: entry.entryMode
            }
        };

        const { data, error } = await supabase.from('entries').insert(dbEntry).select();

        if (error) {
            console.error("Error adding entry to Supabase:", error.message, error.details);
            throw error;
        }

        // Handle Permissions
        if (data && data[0] && entry.permissions && entry.permissions.length > 0) {
            const entryId = data[0].id;
            const permissionRows = entry.permissions.map(doctor_id => ({
                entry_id: entryId,
                doctor_id: doctor_id,
                can_view: true
            }));
            await supabase.from('entry_permissions').insert(permissionRows);
        }
    },

    updateEntry: async (userId: string, updatedEntry: MoodEntry) => {
        const dbEntry = {
            mood: updatedEntry.mood,
            mood_label: updatedEntry.moodLabel,
            energy: updatedEntry.energy,
            text: updatedEntry.text,
            tags: updatedEntry.tags,
            is_locked: updatedEntry.isLocked,
            ai_analysis: {
                ...updatedEntry.aiAnalysis,
                entry_mode: updatedEntry.entryMode
            }
        };

        const { error } = await supabase.from('entries').update(dbEntry).eq('id', updatedEntry.id);
        if (error) {
            console.error("Error updating entry in Supabase:", error.message, error.details);
            throw error;
        }

        // Sync Permissions: Delete old, add new
        await supabase.from('entry_permissions').delete().eq('entry_id', updatedEntry.id);

        if (updatedEntry.permissions && updatedEntry.permissions.length > 0) {
            const permissionRows = updatedEntry.permissions.map(doctor_id => ({
                entry_id: updatedEntry.id,
                doctor_id: doctor_id,
                can_view: true
            }));
            await supabase.from('entry_permissions').insert(permissionRows);
        }
    },

    deleteEntry: async (userId: string, entryId: string) => {
        await supabase.from('entries').delete().eq('id', entryId);
    },

    getEntriesOnce: async (userId: string): Promise<MoodEntry[]> => {
        const { data } = await supabase.from('entries').select('*').eq('user_id', userId).order('date', { ascending: false });
        if (!data) return [];
        return data.map(row => ({
            ...row,
            userId: row.user_id,
            timestamp: new Date(row.date).getTime(),
            moodLabel: row.mood_label,
            isLocked: row.is_locked,
            entryMode: row.ai_analysis?.entry_mode || (row.mood === null ? 'diary' : 'mood'),
            aiAnalysis: row.ai_analysis
        })) as MoodEntry[];
    },

    // --- Doctor Features ---

    // Instead of getDoctorPatients, utilize the View
    getMedicalDashboard: async (doctorId: string): Promise<any[]> => {
        // CHANGED: Query tables directly to avoid "relation does not exist" on view
        const { data, error } = await supabase
            .from('doctor_patients')
            .select('patient_id, profiles!patient_id(name, email)')
            .eq('doctor_id', doctorId);

        if (error) {
            console.error('Error fetching dashboard patients:', error);
            return [];
        }

        // Map to match the expected format for DoctorPortal
        return data.map((row: any) => ({
            patient_id: row.patient_id,
            patient_name: row.profiles?.name || 'Unknown',
            patient_email: row.profiles?.email || 'No Email'
        })) || [];
    },

    // Legacy method optional, or remove if unused. Kept for safety but unimplemented effectively.
    getDoctorPatients: async (doctorId: string): Promise<User[]> => {
        // Deprecated by getMedicalDashboard, but keeping structure if needed
        return [];
    },

    getConnectedDoctors: async (patientId: string): Promise<{ id: string, name: string, role?: string }[]> => {
        const { data, error } = await supabase
            .from('doctor_patients')
            .select('doctor_id, profiles!doctor_id(id, name, role)')
            .eq('patient_id', patientId);

        if (error || !data) return [];
        return data.map((d: any) => ({
            id: d.profiles?.id || d.doctor_id,
            name: d.profiles?.name || 'Médico',
            role: normalizeRole(d.profiles?.role)
        }));
    },

    connectPatient: async (doctorId: string, patientEmail: string): Promise<{ success: boolean; message: string }> => {
        // 1. Find patient by email using profiles table
        const { data: foundUsers, error } = await supabase
            .from('profiles')
            .select('id, role')
            .ilike('email', patientEmail.trim());

        if (error || !foundUsers || foundUsers.length === 0) return { success: false, message: "patientNotFound" };

        const targetUser = foundUsers[0];
        const normalizedTargetRole = normalizeRole(targetUser.role);

        if (normalizedTargetRole !== UserRole.PATIENT) return { success: false, message: "userIsStandard" };

        // 2. Insert relation using retrieved UUID (targetUser.id)
        const { error: insertError } = await supabase.from('doctor_patients').insert({
            doctor_id: doctorId,
            patient_id: targetUser.id
        });

        if (insertError) {
            if (insertError.code === '23505') return { success: false, message: "alreadyConnected" };
            // FK violation code usually 23503
            if (insertError.code === '23503') return { success: false, message: "constraintViolation" };
            return { success: false, message: insertError.message };
        }

        return { success: true, message: "Success" };
    },

    getPatientCharts: async (patientId: string): Promise<any[]> => {
        const { data, error } = await supabase
            .from('charts')
            .select('*')
            .eq('user_id', patientId)
            .order('created_at', { ascending: false })
            .limit(1); // Get latest chart snapshot

        if (error) return [];
        return data || [];
    },

    getPatientConnections: async (patientId: string) => {
        const { data, error } = await supabase
            .from('doctor_patients')
            .select('doctor_id, created_at, profiles!doctor_id(name, email)')
            .eq('patient_id', patientId);

        if (error) throw error;
        return data.map((d: any) => ({
            doctor_id: d.doctor_id,
            doctor_name: d.profiles.name,
            doctor_email: d.profiles.email,
            created_at: d.created_at
        }));
    },

    disconnectDoctor: async (patientId: string, doctorId: string) => {
        const { error } = await supabase
            .from('doctor_patients')
            .delete()
            .eq('patient_id', patientId)
            .eq('doctor_id', doctorId);

        if (error) throw error;

        // Also remove specific entry permissions for this doctor
        await supabase
            .from('entry_permissions')
            .delete()
            .eq('doctor_id', doctorId)
            .in('entry_id', (await supabase.from('entries').select('id').eq('user_id', patientId)).data?.map(e => e.id) || []);
    },

    // --- NOTES ---

    subscribeNotes: (doctorId: string | undefined, patientId: string, callback: (notes: DoctorNote[]) => void) => {
        const fetchNotes = async () => {
            // Join with profiles to get doctor name and role
            let query = supabase
                .from('doctor_notes')
                .select('*, profiles:doctor_id(name, role)') // Select profile info
                .eq('patient_id', patientId)
                .order('created_at', { ascending: true });

            // Se for paciente, filtrar apenas as compartilhadas
            if (!doctorId) {
                query = query.eq('is_shared', true);
            } else {
                // Se for médico, ver apenas as próprias notas (Isolamento Clínico)
                query = query.eq('doctor_id', doctorId);
            }

            const { data, error } = await query;
            if (error) {
                console.error("Error fetching notes:", error);
                return;
            }

            if (data) {
                const mapped = data.map((row: any) => ({
                    id: row.id,
                    doctorId: row.doctor_id,
                    doctorName: row.profiles?.name,
                    doctorRole: normalizeRole(row.profiles?.role),
                    patientId: row.patient_id,
                    entryId: row.entry_id,
                    text: row.text,
                    isShared: row.is_shared,
                    authorRole: row.author_role,
                    read: row.read,
                    status: row.status,
                    createdAt: row.created_at
                }));
                callback(mapped as DoctorNote[]);
            }
        };

        fetchNotes();

        const channel = supabase
            .channel('notes-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_notes', filter: `patient_id=eq.${patientId}` }, () => {
                fetchNotes();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    getNotes: async (doctorId: string | undefined, patientId: string): Promise<DoctorNote[]> => {
        let query = supabase
            .from('doctor_notes')
            .select('*, profiles:doctor_id(name, role)')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: true });

        if (!doctorId) {
            query = query.eq('is_shared', true);
        } else {
            query = query.eq('doctor_id', doctorId);
        }

        const { data, error } = await query;
        if (error || !data) return [];

        return data.map((row: any) => ({
            id: row.id,
            doctorId: row.doctor_id,
            doctorName: row.profiles?.name,
            doctorRole: normalizeRole(row.profiles?.role),
            patientId: row.patient_id,
            entryId: row.entry_id,
            threadId: row.thread_id,
            text: row.text,
            isShared: row.is_shared,
            authorRole: row.author_role,
            read: row.read,
            status: row.status,
            createdAt: row.created_at
        }));
    },

    saveDoctorNote: async (note: DoctorNote) => {
        const dbNote: any = {
            doctor_id: note.doctorId,
            patient_id: note.patientId,
            entry_id: note.entryId,
            thread_id: note.threadId,
            text: note.text,
            is_shared: note.isShared,
            author_role: note.authorRole,
            read: note.read,
            status: 'active'
        };
        const { data, error } = await supabase.from('doctor_notes').insert(dbNote).select().single();
        if (error) {
            console.error(error);
            return;
        }

        // AUTO-NOTIFICATION TRIGGER
        if (note.isShared && data) {
            const recipientId = note.authorRole === 'PROFESSIONAL' ? note.patientId : note.doctorId;
            const senderName = note.authorRole === 'PROFESSIONAL' ? (note.doctorName || 'Seu Profissional') : 'Paciente';

            storageService.createNotification({
                userId: recipientId,
                type: note.authorRole === 'PROFESSIONAL' ? 'comment_created' : 'message_created',
                title: note.authorRole === 'PROFESSIONAL' ? 'Novo comentário clínico' : 'Nova resposta do paciente',
                message: `${senderName} enviou uma nova mensagem.`,
                data: { entry_id: note.entryId, note_id: data.id, thread_id: note.threadId }
            } as any).catch(console.error);
        }
    },

    // --- NOTIFICATIONS ---
    subscribeNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
        const fetchNotifications = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) {
                callback(data.map(row => ({
                    id: row.id,
                    userId: row.user_id,
                    type: row.type,
                    title: row.title,
                    message: row.message,
                    data: row.data,
                    readAt: row.read_at,
                    createdAt: row.created_at
                })) as Notification[]);
            }
        };

        fetchNotifications();

        const channel = supabase
            .channel(`notifications-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    createNotification: async (notif: Partial<Notification>) => {
        const { error } = await supabase.from('notifications').insert({
            user_id: notif.userId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            data: notif.data
        });
        if (error) throw error;
    },

    markNotificationAsRead: async (notifId: string) => {
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notifId);
    },

    markAllNotificationsAsRead: async (userId: string) => {
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
    },

    // --- AI INSIGHTS ---
    saveAiInsight: async (insight: Partial<AiInsight>) => {
        const { error } = await supabase.from('ai_insights').insert({
            patient_id: insight.patientId,
            period: insight.period,
            summary: insight.summary,
            risk_score: insight.riskScore,
            patterns: insight.patterns,
            metadata: insight.metadata
        });
        if (error) throw error;
    },

    getAiInsights: async (patientId: string): Promise<AiInsight[]> => {
        const { data, error } = await supabase
            .from('ai_insights')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error || !data) return [];
        return data.map(row => ({
            id: row.id,
            patientId: row.patient_id,
            period: row.period,
            summary: row.summary,
            riskScore: row.risk_score,
            patterns: row.patterns,
            metadata: row.metadata,
            createdAt: row.created_at
        })) as AiInsight[];
    },

    // --- MESSAGE THREADS ---
    getOrCreateThread: async (patientId: string, professionalId: string, specialty: string): Promise<MessageThread> => {
        // Try to find existing
        const { data: existing } = await supabase
            .from('message_threads')
            .select('*')
            .eq('patient_id', patientId)
            .eq('professional_id', professionalId)
            .eq('specialty', specialty)
            .single();

        if (existing) {
            return {
                id: existing.id,
                patientId: existing.patient_id,
                professionalId: existing.professional_id,
                specialty: existing.specialty,
                createdAt: existing.created_at
            } as MessageThread;
        }

        // Create new
        const { data: created, error } = await supabase.from('message_threads').insert({
            patient_id: patientId,
            professional_id: professionalId,
            specialty: specialty
        }).select().single();

        if (error) throw error;
        return {
            id: created.id,
            patientId: created.patient_id,
            professionalId: created.professional_id,
            specialty: created.specialty,
            createdAt: created.created_at
        } as MessageThread;
    },

    getThreads: async (userId: string, role: UserRole): Promise<MessageThread[]> => {
        const column = role === UserRole.PATIENT ? 'patient_id' : 'professional_id';
        const { data, error } = await supabase
            .from('message_threads')
            .select('*')
            .eq(column, userId)
            .order('created_at', { ascending: false });

        if (error || !data) return [];
        return data.map(row => ({
            id: row.id,
            patientId: row.patient_id,
            professionalId: row.professional_id,
            specialty: row.specialty,
            createdAt: row.created_at
        })) as MessageThread[];
    },


    markNotesAsRead: async (doctorId: string, patientId: string, viewerRole: 'DOCTOR' | 'PATIENT') => {
        // Update read status based on viewer
        const targetAuthorRole = viewerRole === 'DOCTOR' ? 'PATIENT' : 'DOCTOR';

        await supabase.from('doctor_notes')
            .update({ read: true })
            .eq('patient_id', patientId)
            .eq('author_role', targetAuthorRole)
            .eq('read', false);
    },

    logAudit: async (userId: string, action: string, targetId?: string, metadata?: any) => {
        await supabase.from('audit_logs').insert({
            user_id: userId,
            action,
            target_id: targetId,
            metadata: metadata || {},
            timestamp: new Date().toISOString()
        });
    },

    getAuditLogs: async (userId: string) => {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('target_id', userId)
            .order('timestamp', { ascending: false })
            .limit(20);

        if (error) {
            console.error("Error fetching audit logs:", error);
            return [];
        }
        return data;
    },

    // --- CLINIC MANAGEMENT ---
    createClinic: async (name: string, ownerId: string) => { // ownerId ignored in favor of auth.getUser()
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) throw new Error("User not authenticated");

        // CHECK PERMISSION: Only CLINIC_ADMIN can create clinics
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).single();
        if (profile?.role !== UserRole.CLINIC_ADMIN && profile?.role !== 'ADMIN_CLINICA') {
            throw new Error("Ação não autorizada. Apenas administradores podem criar clínicas.");
        }

        const { data, error } = await supabase.from('clinics').insert({
            name,
            admin_id: authUser.id, // Correct column per schema
            plan_type: 'enterprise'
        }).select().single();

        if (error) {
            console.error("Erro de permissão:", error.message);
            throw error;
        }

        // Auto-add owner as admin member
        await supabase.from('clinic_members').insert({
            clinic_id: data.id,
            doctor_id: authUser.id,
            role: 'admin'
        });

        return data;
    },

    getClinics: async (doctorId: string) => {
        const { data, error } = await supabase
            .from('clinic_members')
            .select(`
                role,
                clinics (*)
            `)
            .eq('doctor_id', doctorId);

        if (error) return [];
        return data;
    },

    addDoctorToClinic: async (clinicId: string, doctorEmail: string, role: string = 'member') => {
        // Find doctor
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', doctorEmail)
            .eq('role', 'DOCTOR');

        if (pError || !profiles || profiles.length === 0) throw new Error("Doctor not found");

        const { error } = await supabase.from('clinic_members').insert({
            clinic_id: clinicId,
            doctor_id: profiles[0].id,
            role
        });

        if (error) throw error;
        return true;
    },

    // --- LGPD / COMPLIANCE ---
    downloadAccountData: async (userId: string) => {
        // Fetch everything relevant
        const [entries, profile, logs] = await Promise.all([
            supabase.from('entries').select('*').eq('user_id', userId),
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('audit_logs').select('*').eq('target_id', userId).or(`user_id.eq.${userId}`)
        ]);

        const fullData = {
            profile: profile.data,
            entries: entries.data,
            securityLogs: logs.data,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `moodflow_data_export_${userId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    updateNoteStatus: async (noteId: string, status: 'active' | 'resolved' | 'hidden') => {
        await supabase.from('doctor_notes').update({ status }).eq('id', noteId);
    }
};
