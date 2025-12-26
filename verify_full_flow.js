
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runTest() {
    console.log("Starting Full Flow Verification...");

    const timestamp = Date.now();
    const email = `full_verify_${timestamp}@test.com`;
    const name = "Full Verify User";
    const password = "Password123!";

    // 1. SignUp
    console.log("1. Signing up...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                role: 'STANDARD',
                type: 'pessoa'
            }
        }
    });

    if (authError) {
        console.error("SignUp Error:", authError.message);
        return;
    }
    const userId = authData.user?.id;
    console.log("SignUp Success. User ID:", userId);

    // 2. Save User (Role Selection) - This mimics storageService.saveUser
    console.log("2. Simulating Role Selection (saveUser)...");

    // Profiles table (English Role)
    const { error: pError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        name,
        role: 'PATIENT',
        language: 'pt',
        role_confirmed: true
    });
    if (pError) {
        console.error("Profiles Upsert Error:", pError.message);
        return;
    }

    // Users table (Portuguese Type)
    const { error: uError } = await supabase.from('users').upsert({
        id: userId,
        email,
        name,
        type: 'paciente',
        language: 'pt',
        role_confirmed: true,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
    if (uError) {
        console.error("Users Upsert Error:", uError.message);
        return;
    }
    console.log("Role Selection Success (Sync confirmed).");

    // 3. Add Entry
    console.log("3. Testing Entry Insertion...");
    const { error: entryError } = await supabase.from('entries').insert({
        user_id: userId,
        date: new Date().toISOString(),
        mood: 5,
        mood_label: 'Muito Bem',
        text: 'Teste de fluxo completo funcionando!',
        is_locked: false
    });

    if (entryError) {
        console.error("Entry Insertion Error:", entryError.message);
        return;
    }
    console.log("Entry Insertion Success!");

    console.log("\n============================================");
    console.log("VERIFICATION SUCCESSFUL: FULL FLOW IS WORKING");
    console.log("============================================");
}

runTest();
