
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

async function verify() {
    const email = `verify_fix_${Date.now()}@test.com`;
    const password = 'password123';
    const fullName = 'Verified User';

    console.log(`1. Testing SignUp for ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
                name: fullName
            }
        }
    });

    if (authError) {
        console.error("❌ Auth SignUp Error:", authError);
        return;
    }

    const userId = authData.user?.id;
    console.log("✅ Auth SignUp Success. User ID:", userId);

    console.log("2. Simulating storageService.saveUser (upserting to users and profiles)...");

    // Simulate saveUser logic
    const { error: usersError } = await supabase.from('users').upsert({
        id: userId,
        email: email,
        name: fullName,
        type: 'paciente',
        language: 'pt',
        role_confirmed: true
    });

    if (usersError) {
        console.error("❌ Users Table Error:", usersError);
    } else {
        console.log("✅ Users Table Success");
    }

    const { error: profilesError } = await supabase.from('profiles').upsert({
        id: userId,
        name: fullName
    });

    if (profilesError) {
        console.error("❌ Profiles Table Error:", profilesError);
    } else {
        console.log("✅ Profiles Table Success (Fix worked!)");
    }

    // 3. Verify data in profiles
    console.log("3. Verifying data in 'profiles'...");
    const { data: profileResult } = await supabase.from('profiles').select('*').eq('id', userId);

    if (profileResult && profileResult.length > 0) {
        console.log("✅ Profile Data:", profileResult[0]);
        if (profileResult[0].name === fullName) {
            console.log("✨ SUCCESS: Name field is correctly populated!");
        } else {
            console.error("❌ FAIL: Name mismatch!");
        }
    } else {
        console.error("❌ FAIL: Profile not found!");
    }
}

verify();
