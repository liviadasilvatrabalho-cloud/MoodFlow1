
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

async function verifyDeviceSwitch() {
    console.log("Verifying Device Switch / Data Persistence...");
    const email = `switch_${Date.now()}@test.com`;
    const password = "password123";

    // 1. Device A: Signup
    console.log(`[Device A] Signing up ${email}...`);
    const { data: auth, error: signupError } = await supabase.auth.signUp({ email, password });
    if (signupError) { console.error("Signup Failed", signupError); return; }

    const userId = auth.user?.id;
    if (!userId) { console.error("No User ID"); return; }

    // 2. Device A: Add Data
    console.log("[Device A] Inserting sensitive diary entry...");
    const secretText = "This data must survive device switch.";

    // Give a small moment for any DB triggers to setup foreign key relations
    await new Promise(r => setTimeout(r, 2000));

    const { error: insertError } = await supabase.from('entries').insert({
        user_id: userId,
        date: new Date().toISOString(),
        mood: 5,
        mood_label: 'Excellent',
        text: secretText,
        is_locked: true
    });

    if (insertError) {
        console.error("Insert Failed (Device A):", insertError.message);
        return;
    }
    console.log("✅ Data inserted on Device A.");

    // 3. Device B: Login (New Client Instance)
    console.log("[Device B] Logging in (simulating new device)...");
    const deviceB = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

    const { error: loginError } = await deviceB.auth.signInWithPassword({ email, password });
    if (loginError) {
        console.error("Login Failed (Device B):", loginError.message);
        return;
    }

    // 4. Device B: Fetch Data
    console.log("[Device B] Retrieving data...");
    const { data: entries, error: fetchError } = await deviceB.from('entries').select('*').eq('user_id', userId);

    if (fetchError) {
        console.error("Fetch Failed (Device B):", fetchError.message);
        return;
    }

    if (entries.length === 1 && entries[0].text === secretText) {
        console.log("✅ SUCCESS! Data retrieved on Device B.");
    } else {
        console.error("FAIL: Data mismatch or missing on Device B.", entries);
    }
}

verifyDeviceSwitch();
