
import { MoodEntry, User, DoctorNote, UserRole, Language, ClinicalRole, ClinicRole, Notification, AiInsight, MessageThread } from '../types';
import { supabase } from './supabaseClient';

// --- Centralized Role Normalization ---
const normalizeRole = (rawRole: string | undefined): UserRole => {
    if (!rawRole) return UserRole.PACIENTE;
    const r = rawRole.toLowerCase().trim();
    if (r === 'psicologo' || r === 'psychologist' || r === 'psicólogo') return UserRole.PSICOLOGO;
    if (r === 'psiquiatra' || r === 'psychiatrist') return UserRole.PSIQUIATRA;
    if (r === 'medico' || r === 'professional' || r === 'profissional' || r === 'saúde') return UserRole.PSICOLOGO;
    if (r === 'admin_clinica' || r === 'clinic_admin' || r === 'admin' || r === 'gestão' || r === 'unidade') return UserRole.ADMIN_CLINICA;
    return UserRole.PACIENTE; // Default for 'paciente', 'pessoa', 'patient', etc.
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
            (role === UserRole.PSICOLOGO ? 'PSICOLOGO' :
                role === UserRole.PSIQUIATRA ? 'PSIQUIATRA' : 'none'),
        clinicRole: (dbUser.clinic_role as ClinicRole) || 'none',
        language: (dbUser.language as Language) || 'pt',
        roleConfirmed: dbUser.role_confirmed || false,
        joinedAt: dbUser.joined_at || dbUser.created_at || new Date().toISOString()
    }
};

export const storageService = {
    // --- AUTH ---
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
                    const pendingRole = localStorage.getItem('moodflow_selected_role') as UserRole || UserRole.PACIENTE;
                    const fallbackUser: User = {
                        id: sessionUser.id,
                        email: sessionUser.email!,
                        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || 'User',
                        role: pendingRole || sessionUser.user_metadata?.role || UserRole.PACIENTE,
                        clinicalRole: (pendingRole === UserRole.PSICOLOGO ? 'PSICOLOGO' : pendingRole === UserRole.PSIQUIATRA ? 'PSIQUIATRA' : 'none') as ClinicalRole,
                        clinicRole: 'none',
                        language: 'pt',
                        roleConfirmed: true,
                        joinedAt: sessionUser.created_at || new Date().toISOString()
                    };
                    callback(fallbackUser);
                    if (!dbUser) {
                        storageService.saveUser(fallbackUser).catch(console.error);
                        localStorage.removeItem('moodflow_selected_role');
                    }
                } else {
                    const mappedUser = mapDbUserToUser(dbUser, sessionUser.user_metadata?.full_name);
                    callback(mappedUser);
                    if (mappedUser.name !== dbUser.name && sessionUser.user_metadata?.full_name) {
                        const invalidNames = ['user', 'usuário', 'usuario'];
                        const dbNameLower = dbUser.name ? dbUser.name.toLowerCase().trim() : '';
                        if (invalidNames.includes(dbNameLower)) {
                            storageService.saveUser(mappedUser).catch(e => console.warn("Auto-repair failed", e));
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                callback(null);
            }
        };

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
        const { data: dbUser } = await supabase.from('profiles').select('*').eq('id', data.user!.id).single();
        if (dbUser) return mapDbUserToUser(dbUser, data.user!.user_metadata?.full_name);
        return {
            id: data.user!.id,
            email: data.user!.email!,
            name: data.user!.user_metadata?.full_name || data.user!.user_metadata?.name || 'User',
            role: UserRole.PACIENTE,
            clinicalRole: 'none',
            clinicRole: 'none',
            language: 'pt',
            roleConfirmed: false,
            joinedAt: new Date().toISOString()
        };
    },

    signupEmail: async (email: string, pass: string, name: string, role: UserRole): Promise<void> => {
        if (role === UserRole.ADMIN_CLINICA) {
            throw new Error("Cadastro de administradores não é permitido. Consulte o suporte.");
        }
        const clinicalRole = (role === UserRole.PSICOLOGO ? 'PSICOLOGO' : role === UserRole.PSIQUIATRA ? 'PSIQUIATRA' : 'none') as ClinicalRole;
        const { error } = await supabase.auth.signUp({
            email, password: pass,
            options: { data: { full_name: name, role: role, clinical_role: clinicalRole, clinic_role: 'none', role_confirmed: true } }
        });
        if (error) throw error;
    },

    resetPassword: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
        if (error) throw error;
    },

    saveUser: async (user: User) => {
        const { error } = await supabase.from('profiles').upsert({
            id: user.id, email: user.email, name: user.name, role: user.role,
            clinical_role: user.clinicalRole, clinic_role: user.clinicRole,
            language: user.language, role_confirmed: user.roleConfirmed
        });
        if (error) throw error;
    },

    logout: async () => {
        try {
            await supabase.auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        } catch (e) {
            localStorage.clear();
            window.location.reload();
        }
    },

    deleteAccount: async (userId: string) => {
        await supabase.from('profiles').delete().eq('id', userId);
        await supabase.auth.signOut();
    },

    // --- ENTRIES ---
    addEntry: async (entry: Partial<MoodEntry>): Promise<MoodEntry> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const dbEntry = {
            user_id: user.id,
            date: entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString(),
            mood: entry.mood,
            mood_label: entry.moodLabel,
            energy: entry.energy,
            text: entry.text,
            tags: entry.tags,
            is_locked: entry.isLocked,
            visible_to_psychologist: entry.visible_to_psychologist,
            visible_to_psychiatrist: entry.visible_to_psychiatrist,
            ai_analysis: { ...entry.aiAnalysis, entry_mode: entry.entryMode }
        };

        const { data, error } = await supabase.from('entries').insert(dbEntry).select().single();
        if (error) throw error;
        return {
            ...data,
            userId: data.user_id,
            timestamp: new Date(data.date).getTime(),
            moodLabel: data.mood_label,
            isLocked: data.is_locked,
            entryMode: data.ai_analysis?.entry_mode
        } as MoodEntry;
    },

    updateEntry: async (entry: MoodEntry) => {
        const dbEntry = {
            mood: entry.mood,
            mood_label: entry.moodLabel,
            energy: entry.energy,
            text: entry.text,
            tags: entry.tags,
            is_locked: entry.isLocked,
            visible_to_psychologist: entry.visible_to_psychologist,
            visible_to_psychiatrist: entry.visible_to_psychiatrist,
            ai_analysis: { ...entry.aiAnalysis, entry_mode: entry.entryMode }
        };
        const { error } = await supabase.from('entries').update(dbEntry).eq('id', entry.id);
        if (error) throw error;
    },

    subscribeEntries: (userId: string, callback: (entries: MoodEntry[]) => void) => {
        const fetch = async () => {
            const { data } = await supabase.from('entries').select('*').eq('user_id', userId).order('date', { ascending: false });
            if (data) callback(data.map(row => ({
                ...row,
                userId: row.user_id,
                timestamp: new Date(row.date).getTime(),
                moodLabel: row.mood_label,
                isLocked: row.is_locked,
                entryMode: row.ai_analysis?.entry_mode || (row.mood === null ? 'diary' : 'mood'),
                aiAnalysis: row.ai_analysis
            })) as MoodEntry[]);
        };
        fetch();
        const chan = supabase.channel('entries-' + userId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` }, fetch)
            .subscribe();
        return () => { supabase.removeChannel(chan); };
    },

    getPatientEntries: async (patientId: string, doctorId: string): Promise<MoodEntry[]> => {
        const { data, error } = await supabase
            .from('entries')
            .select('*')
            .eq('user_id', patientId)
            .order('date', { ascending: false });

        if (error) throw error;

        return (data || []).map(row => ({
            ...row,
            userId: row.user_id,
            timestamp: new Date(row.date).getTime(),
            moodLabel: row.mood_label,
            isLocked: row.is_locked,
            entryMode: row.ai_analysis?.entry_mode || (row.mood === null ? 'diary' : 'mood'),
            aiAnalysis: row.ai_analysis
        })) as MoodEntry[];
    },


    // --- DOCTORS ---
    getConnectedDoctors: async (patientId: string): Promise<User[]> => {
        const { data } = await supabase
            .from('doctor_patients')
            .select('doctor_id, profiles!doctor_patients_doctor_id_fkey(*)')
            .eq('patient_id', patientId);
        return data ? data.map((d: any) => mapDbUserToUser(d.profiles)) : [];
    },

    getPatientsForDoctor: async (doctorId: string): Promise<User[]> => {
        const { data } = await supabase
            .from('doctor_patients')
            .select('patient_id, profiles!doctor_patients_patient_id_fkey(*)')
            .eq('doctor_id', doctorId);
        return data ? data.map((d: any) => mapDbUserToUser(d.profiles)) : [];
    },

    getClinicPatients: async (clinicId: string): Promise<User[]> => {
        // 1. Get doctors in this clinic
        const { data: members } = await supabase
            .from('clinic_members')
            .select('doctor_id')
            .eq('clinic_id', clinicId);

        if (!members || members.length === 0) return [];

        const doctorIds = members.map(m => m.doctor_id);

        // 2. Get patients connected to these doctors
        const { data: connections } = await supabase
            .from('doctor_patients')
            .select('patient_id, profiles!doctor_patients_patient_id_fkey(*)')
            .in('doctor_id', doctorIds);

        // Deduplicate patients
        const uniquePatients = new Map();
        if (connections) {
            connections.forEach((c: any) => {
                if (c.profiles && !uniquePatients.has(c.patient_id)) {
                    uniquePatients.set(c.patient_id, mapDbUserToUser(c.profiles));
                }
            });
        }

        return Array.from(uniquePatients.values());
    },

    getMedicalDashboard: async (doctorId: string): Promise<any[]> => {
        const { data } = await supabase
            .from('doctor_patients')
            .select('patient_id, profiles!doctor_patients_patient_id_fkey(name, email)')
            .eq('doctor_id', doctorId);
        return data ? data.map((d: any) => ({
            patient_id: d.patient_id,
            patient_name: d.profiles?.name,
            patient_email: d.profiles?.email
        })) : [];
    },

    connectDoctor: async (patientId: string, doctorCode: string) => {
        const { data: doc } = await supabase.from('profiles').select('id').eq('id', doctorCode).single();
        if (!doc) throw new Error("Doctor not found");
        await supabase.from('doctor_patients').insert({ patient_id: patientId, doctor_id: doc.id });
    },

    connectPatient: async (doctorId: string, patientEmail: string) => {
        const { data: patient } = await supabase.from('profiles').select('id').eq('email', patientEmail).single();
        if (!patient) return { success: false, message: 'patientNotFound' };

        const { error } = await supabase.from('doctor_patients').insert({ patient_id: patient.id, doctor_id: doctorId });
        if (error) {
            if (error.code === '23505') return { success: false, message: 'alreadyConnected' };
            throw error;
        }
        return { success: true, message: 'success' };
    },

    getPatientConnections: async (patientId: string): Promise<any[]> => {
        const { data } = await supabase
            .from('doctor_patients')
            .select('doctor_id, profiles!doctor_patients_doctor_id_fkey(name, role)')
            .eq('patient_id', patientId);

        return data ? data.map((d: any) => ({
            doctor_id: d.doctor_id,
            doctor_name: d.profiles?.name,
            doctor_role: normalizeRole(d.profiles?.role)
        })) : [];
    },

    disconnectDoctor: async (patientId: string, doctorId: string) => {
        const { error } = await supabase
            .from('doctor_patients')
            .delete()
            .eq('patient_id', patientId)
            .eq('doctor_id', doctorId);

        if (error) throw error;
    },

    // --- NOTES ---
    saveDoctorNote: async (note: Partial<DoctorNote>): Promise<DoctorNote> => {
        const dbNote = {
            id: note.id || crypto.randomUUID(),
            doctor_id: note.doctorId,
            patient_id: note.patientId,
            entry_id: note.entryId,
            thread_id: note.threadId,
            text: note.text || '',
            type: note.type || 'text',
            audio_url: note.audioUrl,
            duration: note.duration,
            is_shared: true,
            author_role: note.authorRole,
            read: note.read || false,
            status: note.status || 'active'
        };
        const { data, error } = await supabase.from('doctor_notes').insert(dbNote).select().single();
        if (error) throw error;
        return {
            ...data,
            doctorId: data.doctor_id,
            patientId: data.patient_id,
            entryId: data.entry_id,
            threadId: data.thread_id,
            audioUrl: data.audio_url,
            isShared: data.is_shared,
            authorRole: data.author_role,
            createdAt: data.created_at
        } as DoctorNote;
    },

    markNotesAsRead: async (patientId: string, role: 'DOCTOR' | 'PATIENT') => {
        // Updated to actually perform a useful update if possible, or just stub correctly
        await supabase.from('doctor_notes')
            .update({ read: true })
            .eq('patient_id', patientId);
    },

    getNotes: async (entryId: string): Promise<DoctorNote[]> => {
        const { data } = await supabase
            .from('doctor_notes')
            .select('*, profiles:doctor_id(name, role)')
            .eq('entry_id', entryId)
            .order('created_at', { ascending: true });

        return data ? data.map(n => ({
            id: n.id, doctorId: n.doctor_id, patientId: n.patient_id, entryId: n.entry_id,
            threadId: n.thread_id, text: n.text, type: n.type, audioUrl: n.audio_url,
            duration: n.duration, isShared: n.is_shared, authorRole: n.author_role,
            read: n.read, status: n.status, createdAt: n.created_at,
            doctorName: n.profiles?.name, doctorRole: n.profiles?.role
        })) as DoctorNote[] : [];
    },

    getPatientNotes: async (patientId: string): Promise<DoctorNote[]> => {
        const { data } = await supabase
            .from('doctor_notes')
            .select('*, profiles:doctor_id(name, role)')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: true });

        return data ? data.map(n => ({
            id: n.id, doctorId: n.doctor_id, patientId: n.patient_id, entryId: n.entry_id,
            threadId: n.thread_id, text: n.text, type: n.type, audioUrl: n.audio_url,
            duration: n.duration, isShared: n.is_shared, authorRole: n.author_role,
            read: n.read, status: n.status, createdAt: n.created_at,
            doctorName: n.profiles?.name, doctorRole: n.profiles?.role
        })) as DoctorNote[] : [];
    },

    subscribeNotes: (doctorId: string | undefined, patientId: string, callback: (notes: DoctorNote[]) => void) => {
        const fetch = async () => {
            let q = supabase
                .from('doctor_notes')
                .select('*, profiles:doctor_id(name, role)')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: true });

            if (!doctorId) q = q.eq('is_shared', true);
            else q = q.eq('doctor_id', doctorId);

            const { data } = await q;
            if (data) callback(data.map(n => ({
                id: n.id, doctorId: n.doctor_id, patientId: n.patient_id, entryId: n.entry_id,
                threadId: n.thread_id, text: n.text, type: n.type, audioUrl: n.audio_url,
                duration: n.duration, isShared: n.is_shared, authorRole: n.author_role,
                read: n.read, status: n.status, createdAt: n.created_at,
                doctorName: (n as any).profiles?.name,
                doctorRole: normalizeRole((n as any).profiles?.role)
            })) as DoctorNote[]);
        };
        fetch();
        const chan = supabase.channel('doctor_notes-' + patientId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_notes', filter: `patient_id=eq.${patientId}` }, fetch)
            .subscribe();
        return () => { supabase.removeChannel(chan); };
    },

    deleteDoctorNote: async (noteId: string) => {
        const { error } = await supabase.from('doctor_notes').delete().eq('id', noteId);
        if (error) throw error;
    },

    // --- THREADS ---
    getOrCreateThread: async (patientId: string, professionalId: string, specialty: string): Promise<MessageThread> => {
        const { data: existing } = await supabase.from('message_threads')
            .select('*')
            .eq('patient_id', patientId)
            .eq('professional_id', professionalId)
            .eq('specialty', specialty)
            .maybeSingle();

        if (existing) return existing as MessageThread;

        const newThread = {
            id: crypto.randomUUID(),
            patient_id: patientId,
            professional_id: professionalId,
            specialty: specialty,
            status: 'active',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('message_threads').insert(newThread).select().single();
        if (error) throw error;
        return data as MessageThread;
    },

    getThreads: async (userId: string, role: UserRole): Promise<MessageThread[]> => {
        const field = role === UserRole.PACIENTE ? 'patient_id' : 'professional_id';
        const { data } = await supabase.from('message_threads').select('*').eq(field, userId);
        return (data || []) as MessageThread[];
    },

    // --- CLINICS & CHARTS ---
    getClinics: async (userId: string): Promise<any[]> => {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        const role = profile ? normalizeRole(profile.role) : UserRole.PACIENTE;

        if (role === UserRole.ADMIN_CLINICA) {
            const { data, error } = await supabase
                .from('clinics')
                .select('id, name')
                .eq('admin_id', userId);

            if (error) {
                console.error("Error fetching admin clinics:", error);
                return [];
            }
            return (data || []).map(c => ({
                role: 'admin',
                clinics: c
            }));
        } else {
            const { data, error } = await supabase
                .from('clinic_members')
                .select('status, clinics!inner(id, name)')
                .or(`doctor_id.eq.${userId},patient_id.eq.${userId}`);

            if (error) {
                console.error("Error fetching member clinics:", error);
                return [];
            }
            return (data || []).map(m => ({
                role: 'member',
                clinics: m.clinics
            }));
        }
    },

    createClinic: async (clinicName: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // 1. Create the clinic with admin_id
        const { data: clinic, error: clinicError } = await supabase
            .from('clinics')
            .insert({
                name: clinicName,
                admin_id: user.id
            });

        if (clinicError) {
            console.error("Create Clinic Error:", clinicError);
            throw clinicError;
        }

        return clinic;
    },

    updateClinic: async (id: string, name: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase
            .from('clinics')
            .update({ name })
            .eq('id', id)
            .eq('admin_id', user.id); // Ensure ownership

        if (error) {
            console.error("Update Clinic Error:", error);
            throw error;
        }
    },

    getPatientCharts: async (pid: string): Promise<any[]> => {
        const { data } = await supabase.from('charts').select('*').eq('patient_id', pid);
        return data || [];
    },

    // --- AUDIO ---
    uploadAudio: async (audioBlob: Blob): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Determine extension from MIME type or default to webm
        const ext = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
        const fileName = `${user.id}/${Date.now()}.${ext}`;

        const { data, error } = await supabase.storage.from('audio-comments').upload(fileName, audioBlob);
        if (error) throw error;
        return data.path;
    },

    getAudioUrl: async (path: string): Promise<string | null> => {
        try {
            console.log('[getAudioUrl] Getting public URL for path:', path);
            const { data } = supabase.storage.from('audio-comments').getPublicUrl(path);

            if (!data?.publicUrl) {
                console.error('[getAudioUrl] No public URL returned');
                return null;
            }

            console.log('[getAudioUrl] Public URL generated:', data.publicUrl);
            return data.publicUrl;
        } catch (err) {
            console.error('[getAudioUrl] Exception:', err);
            return null;
        }
    },

    // --- LOGS & NOTIFS ---
    logView: async (viewerId: string, targetId: string, entityType: string) => {
        await supabase.from('audit_logs').insert({ actor_id: viewerId, action: 'VIEW', target_id: targetId, entity_type: entityType });
    },

    logAudit: async (actorId: string, action: string, targetId: string) => {
        await supabase.from('audit_logs').insert({ actor_id: actorId, action, target_id: targetId });
    },

    createRiskAlert: async (patientId: string, score: number, level: string, reason: string) => {
        await supabase.from('risk_alerts').insert({ patient_id: patientId, score, level, reason });
    },

    subscribeNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
        const fetch = async () => {
            const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (data) callback(data as Notification[]);
        };
        fetch();
        const chan = supabase.channel('notifications-' + userId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetch)
            .subscribe();
        return () => { supabase.removeChannel(chan); };
    },

    createNotification: async (notif: Partial<Notification>) => {
        await supabase.from('notifications').insert(notif);
    },

    markNotificationAsRead: async (notificationId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', notificationId);

        if (error) throw error;
    },

    markAllNotificationsAsRead: async (userId: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .is('read_at', null);

        if (error) throw error;
    },

    // --- CLINICAL REPORTS (NEW ENTERPRISE FEATURE) ---
    getClinicalReports: async (patientId: string, professionalId: string) => {
        const { data } = await supabase
            .from('clinical_reports')
            .select('*')
            .eq('patient_id', patientId)
            .eq('professional_id', professionalId)
            .eq('is_deleted', false) // Soft delete check
            .order('created_at', { ascending: false });

        if (!data) return [];

        return data.map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            professionalId: r.professional_id,
            professionalRole: r.professional_role,
            title: r.title,
            reportType: r.report_type,
            content: r.content,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            isDeleted: r.is_deleted
        }));
    },

    createClinicalReport: async (report: { patientId: string, professionalId: string, professionalRole: string, title: string, reportType: string, content: string }) => {
        // Ensure role matches strictly what the DB Expects ('PSICOLOGO' or 'PSIQUIATRA')
        let finalRole = report.professionalRole;
        const normalized = finalRole.toUpperCase();
        if (normalized.includes('PSIC') || normalized.includes('PSYCH')) finalRole = 'PSICOLOGO';
        if (normalized.includes('PSIQ') || normalized.includes('PSYCHIA')) finalRole = 'PSIQUIATRA';

        // Final fallback if something weird comes in, though distinct from defaults
        if (finalRole !== 'PSICOLOGO' && finalRole !== 'PSIQUIATRA') finalRole = 'PSICOLOGO';

        const payload = {
            patient_id: report.patientId,
            professional_id: report.professionalId,
            professional_role: finalRole,
            title: report.title,
            report_type: report.reportType,
            content: report.content
        };
        const { error } = await supabase.from('clinical_reports').insert(payload);
        if (error) throw error;
        // Audit Log
        await storageService.logAudit(report.professionalId, 'CREATE_REPORT', report.patientId);
    },

    updateClinicalReport: async (id: string, updates: Partial<{ title: string, reportType: string, content: string }>) => {
        const payload: any = {};
        if (updates.title) payload.title = updates.title;
        if (updates.reportType) payload.report_type = updates.reportType;
        if (updates.content) payload.content = updates.content;
        payload.updated_at = new Date().toISOString();

        const { error } = await supabase.from('clinical_reports').update(payload).eq('id', id);
        if (error) throw error;
    },


    // --- PROFESSIONAL MANAGEMENT (ADMIN) ---
    getClinicProfessionals: async (clinicId: string): Promise<any[]> => {
        // Fetch profiles via clinic_members
        const { data, error } = await supabase
            .from('clinic_members')
            .select(`
                status,
                doctor:doctor_id (
                    id,
                    name,
                    email,
                    role,
                    specialty:clinical_role
                )
            `)
            .eq('clinic_id', clinicId)
            .neq('doctor_id', null); // Ensure we only get doctors

        if (error) {
            console.error("Error fetching clinic professionals:", error);
            return [];
        }

        // Flatten structure
        return (data || []).map((m: any) => ({
            ...m.doctor,
            membershipStatus: m.status
        }));
    },

    addProfessionalToClinic: async (clinicId: string, email: string) => {
        // 0. Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error("Formato de email inválido.");
        }

        // 1. Find user by email
        const { data: users, error: userError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('email', email)
            .limit(1);

        if (userError || !users || users.length === 0) {
            throw new Error("Usuário não encontrado com este email.");
        }

        const userToAdd = users[0];

        // 2. Check if already a member of ANY clinic (Strict Restriction)
        const { data: existing } = await supabase
            .from('clinic_members')
            .select('id, clinics(name)')
            .eq('doctor_id', userToAdd.id)
            .single();

        if (existing) {
            // @ts-ignore
            const clinicName = existing.clinics?.name || 'outra clínica';
            throw new Error(`Este profissional já está vinculado à ${clinicName}. Remova-o da clínica anterior antes de vincular.`);
        }

        // 3. Add to clinic
        const { error: linkError } = await supabase
            .from('clinic_members')
            .insert({
                clinic_id: clinicId,
                doctor_id: userToAdd.id,
                status: 'active',
                added_at: new Date().toISOString()
            });

        if (linkError) throw linkError;
    },

    removeProfessionalFromClinic: async (clinicId: string, doctorId: string) => {
        // 1. Remove from clinic
        const { error } = await supabase
            .from('clinic_members')
            .delete()
            .eq('clinic_id', clinicId)
            .eq('doctor_id', doctorId);

        if (error) throw error;

        // 2. Cascade: Remove direct connections to patients (Revoke access)
        // This ensures they cannot see patients even if they were linked
        await supabase
            .from('doctor_patients')
            .delete()
            .eq('doctor_id', doctorId);
    },


    softDeleteClinicalReport: async (id: string, professionalId: string) => {
        // Extra safety: Policy handles this, but explicit ID check is good habit
        const { error } = await supabase
            .from('clinical_reports')
            .update({ is_deleted: true })
            .eq('id', id);

        if (error) throw error;
        await storageService.logAudit(professionalId, 'DELETE_REPORT', id);
    }
};
