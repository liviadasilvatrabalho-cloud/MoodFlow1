
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            if (key && rest.length) {
                envVars[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
        return envVars;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
    const email = 'liviaadmim@gmail.com';
    const password = '127791';

    console.log(`Logging in as ${email}...`);
    const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) throw loginErr;

    const userId = auth.user.id;
    const clinicId = 'd5e4ef43-6d8c-4f2b-b7bb-d357a7029326'; // From screenshot
    const newName = 'Update Test ' + Date.now();

    console.log(`Attempting to update clinic ${clinicId} to: ${newName}`);
    const { data, error, count } = await supabase
        .from('clinics')
        .update({ name: newName })
        .eq('id', clinicId)
        .select();

    if (error) {
        console.error("Update Failed:", error.message);
        console.error("Code:", error.code);
    } else {
        console.log("Update SUCCESS! Data returned:", data);
        if (data.length === 0) {
            console.log("WARNING: 0 rows affected. RLS likely blocked it.");
        }
    }
}

testUpdate().catch(console.error);
