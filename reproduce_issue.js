
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to read .env manually
function loadEnv() {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const envPath = path.resolve(__dirname, '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
        return envVars;
    } catch (e) {
        console.error("Error reading .env:", e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log("Starting Empty Doctor ID Test...");

    const uniqueId = Date.now();
    const docEmail = `dr_vis_${uniqueId}@test.com`;
    const patEmail = `pat_vis_${uniqueId}@test.com`;
    const password = "password123";

    // 1. Setup Users
    console.log("Creating users...");
    const { data: docData } = await supabase.auth.signUp({ email: docEmail, password, options: { data: { full_name: "Dr Vis" } } });
    const docId = docData.user?.id;
    await supabase.from('profiles').update({ role: 'medico' }).eq('id', docId);

    const { data: patData } = await supabase.auth.signUp({ email: patEmail, password, options: { data: { full_name: "Pat Vis" } } });
    const patId = patData.user?.id;
    await supabase.from('profiles').update({ role: 'paciente' }).eq('id', patId);

    // 2. Connect
    console.log("Connecting...");
    await supabase.auth.signInWithPassword({ email: docEmail, password });
    await supabase.from('doctor_patients').insert({ doctor_id: docId, patient_id: patId });

    // 3. Patient tries to reply WITHOUT knowing Doctor ID (simulating first contact bug)
    console.log("Patient logging in...");
    await supabase.auth.signInWithPassword({ email: patEmail, password });

    console.log("Attempting insert with empty doctor_id (current App behavior)...");
    const { error: failError } = await supabase.from('doctor_notes').insert({
        doctor_id: "", // This matches the bug in App.tsx
        patient_id: patId, // Correctly set
        entry_id: undefined,
        text: "This should fail",
        is_shared: true,
        author_role: 'PATIENT',
        read: false
    });

    if (failError) {
        console.log("CONFIRMED: Insert failed as expected:", failError.message);
    } else {
        console.log("UNEXPECTED: Insert succeeded with empty doctor_id?");
    }
}

runTest();
