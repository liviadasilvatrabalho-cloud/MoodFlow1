
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

async function runVerify() {
    console.log("Starting Verification for Doctor-Patient Note Visibility...");

    const uniqueId = Date.now();
    const docEmail = `dr_verify_${uniqueId}@test.com`;
    const patEmail = `pat_verify_${uniqueId}@test.com`;
    const password = "password123";

    // 1. Setup Users
    console.log("Creating users...");
    const { data: docData } = await supabase.auth.signUp({ email: docEmail, password, options: { data: { full_name: "Dr Verify" } } });
    const docId = docData.user?.id;
    await supabase.from('profiles').update({ role: 'medico' }).eq('id', docId);

    const { data: patData } = await supabase.auth.signUp({ email: patEmail, password, options: { data: { full_name: "Pat Verify" } } });
    const patId = patData.user?.id;
    await supabase.from('profiles').update({ role: 'paciente' }).eq('id', patId);

    // 2. Connect
    console.log("Connecting...");
    await supabase.auth.signInWithPassword({ email: docEmail, password });
    await supabase.from('doctor_patients').insert({ doctor_id: docId, patient_id: patId });

    // 3. Simulate The Fix Logic
    console.log("Patient logging in...");
    await supabase.auth.signInWithPassword({ email: patEmail, password });

    console.log("Simulating 'getConnectedDoctor' lookup...");
    const { data: items } = await supabase
        .from('doctor_patients')
        .select('doctor_id')
        .eq('patient_id', patId)
        .limit(1);

    const foundDocId = items?.[0]?.doctor_id;

    if (!foundDocId) {
        console.error("FAIL: Could not find connected doctor!");
        return;
    }
    console.log(`Found connected doctor: ${foundDocId}`);

    console.log("Attempting insert with found doctor_id...");
    const { error: insertError } = await supabase.from('doctor_notes').insert({
        doctor_id: foundDocId,
        patient_id: patId,
        text: "This should SUCCEED now",
        is_shared: true,
        author_role: 'PATIENT',
        read: false
    });

    if (insertError) {
        console.error("FAIL: Insert with correct ID failed:", insertError.message);
    } else {
        console.log("SUCCESS: Note inserted successfully!");
    }
}

runVerify();
