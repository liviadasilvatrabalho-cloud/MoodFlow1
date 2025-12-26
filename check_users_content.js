
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
        console.error("Error reading .env:", e);
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkUserPersistence() {
    console.log("Checking User Persistence...");
    const email = `test_name_${Date.now()}@example.com`;
    const name = "Test User FullName";

    // 1. SignUp
    console.log(`Signing up ${email} with name: ${name}`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: 'password123',
        options: {
            data: {
                full_name: name,
                name: name
            }
        }
    });

    if (authError) {
        console.error("SignUp Error:", authError);
        return;
    }

    const userId = authData.user?.id;
    console.log("User Created in Auth:", userId);

    // 2. Check public.users table immediately
    console.log("Checking public.users table...");
    await new Promise(r => setTimeout(r, 2000));

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId);

    if (userError) console.error("Read Error (public.users):", userError);
    else if (userData.length === 0) console.error("FAIL: User NOT found in public.users");
    else console.log("User Found in public.users:", userData[0]);

    // 3. Check public.profiles table
    console.log("Checking public.profiles table...");
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

    if (profileError) console.error("Read Error (public.profiles):", profileError);
    else if (profileData.length === 0) console.error("FAIL: User NOT found in public.profiles");
    else console.log("User Found in public.profiles:", profileData[0]);
}

checkUserPersistence();
