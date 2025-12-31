
import { MoodEntry, User, DoctorNote, UserRole, Language } from '../types';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Helper to map DB User -> Application User ---
const mapDbUserToUser = (dbUser: any, authName?: string): User => {
    let role = UserRole.PATIENT;
    if (dbUser.role === UserRole.PROFESSIONAL || dbUser.role === 'medico' || dbUser.role === 'professional') role = UserRole.PROFESSIONAL;
    if (dbUser.role === UserRole.PSYCHOLOGIST || dbUser.role === 'psicologo') role = UserRole.PSYCHOLOGIST;
    if (dbUser.role === UserRole.PSYCHIATRIST || dbUser.role === 'psiquiatra') role = UserRole.PSYCHIATRIST;
    if (dbUser.role === UserRole.PATIENT || dbUser.role === 'paciente' || dbUser.role === 'pessoa') role = UserRole.PATIENT;

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
                    localStorage.removeItem('moodflow_selected_role');

                    // Fallback using session metadata
                    const fallbackUser: User = {
                        id: sessionUser.id,
                        email: sessionUser.email!,
                        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || 'User',
                        role: sessionUser.user_metadata?.role || pendingRole,
                        language: 'pt',
                        roleConfirmed: !!(sessionUser.user_metadata?.role || pendingRole),
                        joinedAt: sessionUser.created_at || new Date().toISOString()
                    };
                    callback(fallbackUser);

                    // If it was a first-time login without a profile, save the initial profile now
                    if (!dbUser) {
                        storageService.saveUser(fallbackUser).catch(console.error);
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
            language: 'pt',
            roleConfirmed: false,
            joinedAt: new Date().toISOString()
        };
    },

    signupEmail: async (email: string, pass: string, name: string, role: UserRole): Promise<void> => {
        const { error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    full_name: name,
                    role: role,
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

    addEntry: async (userId: string, entry: MoodEntry) => {
        // Map helper
        const dbEntry = {
            user_id: userId,
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
        const { data, error } = await supabase
            .from('medical_dashboard')
            .select('*')
            .eq('doctor_id', doctorId);

        if (error) {
            console.error('Error fetching dashboard:', error);
            return [];
        }
        return data || [];
    },

    // Legacy method optional, or remove if unused. Kept for safety but unimplemented effectively.
    getDoctorPatients: async (doctorId: string): Promise<User[]> => {
        // Deprecated by getMedicalDashboard, but keeping structure if needed
        return [];
    },

    getConnectedDoctors: async (patientId: string): Promise<{ id: string, name: string }[]> => {
        const { data, error } = await supabase
            .from('doctor_patients')
            .select('doctor_id, profiles!doctor_id(id, name)')
            .eq('patient_id', patientId);

        if (error || !data) return [];
        return data.map((d: any) => ({
            id: d.profiles.id,
            name: d.profiles.name || 'Médico'
        }));
    },

    connectPatient: async (doctorId: string, patientEmail: string): Promise<{ success: boolean; message: string }> => {
        // 1. Find patient by email using profiles table
        const { data: foundUsers, error } = await supabase
            .from('profiles')
            .select('id, role')
            .ilike('email', patientEmail);

        if (error || !foundUsers || foundUsers.length === 0) return { success: false, message: "patientNotFound" };

        const targetUser = foundUsers[0];
        if (targetUser.role !== UserRole.PATIENT && targetUser.role !== 'paciente') return { success: false, message: "userIsStandard" };

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
            let query = supabase.from('doctor_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: true });

            // Se for paciente, filtrar apenas as compartilhadas e não ocultas
            if (!doctorId) {
                query = query.eq('is_shared', true).neq('status', 'hidden');
            } else {
                // Se for médico, ver apenas as próprias notas (Isolamento Clínico)
                query = query.eq('doctor_id', doctorId);
            }

            const { data } = await query;
            if (data) {
                const mapped = data.map(row => ({
                    id: row.id,
                    doctorId: row.doctor_id,
                    patientId: row.patient_id,
                    entryId: row.entry_id,
                    text: row.text,
                    isShared: row.is_shared,
                    authorRole: row.author_role,
                    read: row.read,
                    createdAt: row.created_at
                }));
                callback(mapped as DoctorNote[]);
            }
        };

        fetchNotes();

        const channel = supabase
            .channel(`notes-${patientId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_notes', filter: `patient_id=eq.${patientId}` }, () => {
                fetchNotes();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    },

    saveDoctorNote: async (note: DoctorNote) => {
        const dbNote = {
            doctor_id: note.doctorId,
            patient_id: note.patientId,
            entry_id: note.entryId,
            text: note.text,
            is_shared: note.isShared,
            author_role: note.authorRole,
            read: note.read
            // created_at auto
        };
        const { error } = await supabase.from('doctor_notes').insert(dbNote);
        if (error) console.error(error);
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
    createClinic: async (name: string, ownerId: string) => {
        const { data, error } = await supabase.from('clinics').insert({
            name,
            owner_id: ownerId
        }).select().single();

        if (error) throw error;

        // Auto-add owner as admin member
        await supabase.from('clinic_members').insert({
            clinic_id: data.id,
            doctor_id: ownerId,
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
