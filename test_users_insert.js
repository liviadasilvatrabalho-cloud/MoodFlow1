
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

async function testUsersInsert() {
    console.log("Testing Users Insert Permissions...");
    const email = `insert_test_${Date.now()}@test.com`;
    const password = "password123";

    // 1. Signup
    const { data: auth } = await supabase.auth.signUp({ email, password });
    const userId = auth.user?.id;
    console.log("User ID:", userId);

    // 2. Insert into public.profiles
    console.log("Attempting manual insert into public.profiles...");
    const { error } = await supabase.from('profiles').insert({
        id: userId,
        full_name: "Test Insert Profile"
    });

    if (error) {
        console.error("❌ INSERT FAILED:", error);
    } else {
        console.log("✅ INSERT SUCCESS!");
    }
}

testUsersInsert();
