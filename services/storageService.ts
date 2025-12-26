
import { MoodEntry, User, DoctorNote, UserRole, Language } from '../types';
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- Helper to map DB User -> Application User ---
const mapDbUserToUser = (dbUser: any, authName?: string): User => {
    let role = UserRole.STANDARD;
    if (dbUser.role === UserRole.DOCTOR || dbUser.role === 'medico') role = UserRole.DOCTOR;
    if (dbUser.role === UserRole.PATIENT || dbUser.role === 'paciente') role = UserRole.PATIENT;
    if (dbUser.role === UserRole.STANDARD || dbUser.role === 'pessoa') role = UserRole.STANDARD;

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
                    // Fallback using session metadata
                    const fallbackUser: User = {
                        id: sessionUser.id,
                        email: sessionUser.email!,
                        name: sessionUser.user_metadata?.full_name || 'User',
                        role: UserRole.STANDARD,
                        language: 'pt',
                        roleConfirmed: false,
                        joinedAt: sessionUser.created_at || new Date().toISOString()
                    };
                    callback(fallbackUser);
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
            role: UserRole.STANDARD,
            language: 'pt',
            roleConfirmed: false,
            joinedAt: new Date().toISOString()
        };
    },

    signupEmail: async (email: string, pass: string, name: string): Promise<void> => {
        const { error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    full_name: name,
                    name: name // Redundant but safe
                }
            }
        });
        if (error) throw error;
    },

    loginGoogle: async (): Promise<{ user: User | null, isNew: boolean }> => {
        // Supabase OAuth redirect flow means this function returns before auth completes usually.
        // But we can initiate it.
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
        return { user: null, isNew: false }; // Handled by onAuthStateChange after redirect
    },

    resetPassword: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
    },

    saveUser: async (user: User) => {
        const { error } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role, // Use UserRole enum directly (STANDARD, DOCTOR, PATIENT)
            language: user.language,
            role_confirmed: user.roleConfirmed
        });
        if (error) throw error;
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
            const { data, error } = await supabase
                .from('entries')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false });

            if (error) {
                console.error("Erro ao buscar registros: " + error.message);
            }
            if (!error && data) {
                const mapped = data.map(row => ({
                    ...row,
                    userId: row.user_id,
                    timestamp: new Date(row.date).getTime(), // Map 'date' to timestamp number
                    moodLabel: row.mood_label,
                    isLocked: row.is_locked,
                    entryMode: row.ai_analysis?.entry_mode || (row.mood === null ? 'diary' : 'mood'), // Extract from JSONB with fallback
                    aiAnalysis: row.ai_analysis
                }));
                callback(mapped as MoodEntry[]);
            } else if (!error) {
                console.log("Nenhum dado retornado (Data é nulo/vazio)");
            }
        };

        fetchEntries();

        const channel = supabase
            .channel('entries-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` }, () => {
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
                entry_mode: entry.entryMode // Store in JSONB
            }
        };

        const { error } = await supabase.from('entries').insert(dbEntry);
        if (error) console.error("Error adding entry:", error);
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
                entry_mode: updatedEntry.entryMode // Store in JSONB
            }
        };

        const { error } = await supabase.from('entries').update(dbEntry).eq('id', updatedEntry.id);
        if (error) console.error("Error updating entry:", error);
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

    getConnectedDoctor: async (patientId: string): Promise<string | null> => {
        const { data, error } = await supabase
            .from('doctor_patients')
            .select('doctor_id')
            .eq('patient_id', patientId)
            .limit(1);

        if (error || !data || data.length === 0) return null;
        return data[0].doctor_id;
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

    // --- NOTES ---

    subscribeNotes: (doctorId: string | undefined, patientId: string, callback: (notes: DoctorNote[]) => void) => {
        const fetchNotes = async () => {
            let query = supabase.from('doctor_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: true });

            // Se for paciente, filtrar apenas as compartilhadas (por segurança, embora o RLS já faça isso)
            if (!doctorId) {
                query = query.eq('is_shared', true);
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
    }
};
