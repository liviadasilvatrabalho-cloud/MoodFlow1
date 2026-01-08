
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

    // --- DOCTORS ---
    getConnectedDoctors: async (patientId: string): Promise<User[]> => {
        const { data } = await supabase
            .from('patient_doctors')
            .select('doctor_id, profiles!patient_doctors_doctor_id_fkey(*)')
            .eq('patient_id', patientId);
        return data ? data.map((d: any) => mapDbUserToUser(d.profiles)) : [];
    },

    getPatientsForDoctor: async (doctorId: string): Promise<User[]> => {
        const { data } = await supabase
            .from('patient_doctors')
            .select('patient_id, profiles!patient_doctors_patient_id_fkey(*)')
            .eq('doctor_id', doctorId);
        return data ? data.map((d: any) => mapDbUserToUser(d.profiles)) : [];
    },

    connectDoctor: async (patientId: string, doctorCode: string) => {
        const { data: doc } = await supabase.from('profiles').select('id').eq('id', doctorCode).single();
        if (!doc) throw new Error("Doctor not found");
        await supabase.from('patient_doctors').insert({ patient_id: patientId, doctor_id: doc.id });
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
            doctorName: (n as any).profiles?.name,
            doctorRole: normalizeRole((n as any).profiles?.role)
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
        const chan = supabase.channel('notes-p-' + patientId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_notes', filter: `patient_id=eq.${patientId}` }, fetch)
            .subscribe();
        return () => { supabase.removeChannel(chan); };
    },

    deleteDoctorNote: async (noteId: string) => {
        await supabase.from('doctor_notes').delete().eq('id', noteId);
    },

    // --- THREADS ---
    getOrCreateThread: async (patientId: string, professionalId: string, specialty: string): Promise<MessageThread> => {
        const { data: existing } = await supabase.from('message_threads').select('*').eq('patient_id', patientId).eq('professional_id', professionalId).eq('specialty', specialty).maybeSingle();
        if (existing) return { id: existing.id, patientId: existing.patient_id, professionalId: existing.professional_id, specialty: existing.specialty, createdAt: existing.created_at } as MessageThread;

        const { data: created, error } = await supabase.from('message_threads').insert({ patient_id: patientId, professional_id: professionalId, specialty: specialty }).select().maybeSingle();
        if (error && error.code === '23505') {
            const { data: retry } = await supabase.from('message_threads').select('*').eq('patient_id', patientId).eq('professional_id', professionalId).eq('specialty', specialty).single();
            if (retry) return { id: retry.id, patientId: retry.patient_id, professionalId: retry.professional_id, specialty: retry.specialty, createdAt: retry.created_at } as MessageThread;
        }
        if (error) throw error;
        return { id: created!.id, patientId: created!.patient_id, professionalId: created!.professional_id, specialty: created!.specialty, createdAt: created!.created_at } as MessageThread;
    },

    getThreads: async (userId: string, role: UserRole): Promise<MessageThread[]> => {
        const col = role === UserRole.PACIENTE ? 'patient_id' : 'professional_id';
        const { data } = await supabase.from('message_threads').select('*').eq(col, userId).order('created_at', { ascending: false });
        return data ? data.map(row => ({ id: row.id, patientId: row.patient_id, professionalId: row.professional_id, specialty: row.specialty, createdAt: row.created_at })) as MessageThread[] : [];
    },

    // --- AUDIO ---
    uploadAudio: async (audioBlob: Blob): Promise<string> => {
        const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
        const name = `audio_${crypto.randomUUID()}.${ext}`;
        const { data, error } = await supabase.storage.from('audio-comments').upload(name, audioBlob, { contentType: audioBlob.type });
        if (error) throw error;
        return data.path;
    },

    getAudioUrl: async (path: string): Promise<string | null> => {
        const { data } = await supabase.storage.from('audio-comments').createSignedUrl(path, 3600);
        return data ? data.signedUrl : null;
    },

    // --- LOGS & NOTIFS ---
    logView: async (viewerId: string, targetId: string, entityType: string) => {
        await supabase.from('view_logs').insert({ viewer_id: viewerId, target_id: targetId, entity_type: entityType });
    },

    subscribeNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
        const fetch = async () => {
            const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
            if (data) callback(data.map(row => ({
                id: row.id, userId: row.user_id, type: row.type, title: row.title, message: row.message,
                data: row.data, readAt: row.read_at, createdAt: row.created_at
            })) as Notification[]);
        };
        fetch();
        const chan = supabase.channel('notifs-' + userId).on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetch).subscribe();
        return () => { supabase.removeChannel(chan); };
    },

    createNotification: async (notif: Partial<Notification>) => {
        await supabase.from('notifications').insert({ user_id: notif.userId, type: notif.type, title: notif.title, message: notif.message, data: notif.data });
    },
};
