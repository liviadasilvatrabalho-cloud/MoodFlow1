
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

async function repro() {
    const email = `test_reg_${Date.now()}@example.com`;
    const password = 'password123';
    const fullName = 'Test Registration';

    console.log(`Testing SignUp for ${email}...`);
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

    console.log("Waiting for trigger to create records...");
    await new Promise(r => setTimeout(r, 2000));

    const { data: userData } = await supabase.from('users').select('*').eq('id', userId);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId);

    if (userData && userData.length > 0) console.log("✅ User found in 'users'");
    else console.log("❌ User NOT found in 'users'");

    if (profileData && profileData.length > 0) console.log("✅ Profile found in 'profiles'");
    else console.log("❌ Profile NOT found in 'profiles'");
}

repro();
