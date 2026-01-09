
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

async function verifyFix() {
    const email = 'liviaadmim@gmail.com';
    const password = '127791';

    console.log(`Logging in as ${email}...`);
    const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) throw loginErr;

    const userId = auth.user.id;
    const testName = 'Production Fix Test Final ' + Date.now();

    console.log(`Attempting to create clinic (without select): ${testName}`);
    // EXERCISE THE NEW LOGIC: INSERT WITHOUT RETURNING
    const { error: clinicError } = await supabase
        .from('clinics')
        .insert({
            name: testName,
            admin_id: userId
        });

    if (clinicError) {
        console.error("Create Clinic Failed:", clinicError.message);
        console.error("Error Code:", clinicError.code);
    } else {
        console.log("Create Clinic SUCCESS! (No recursion triggered)");

        console.log("Checking visibility with separate Select...");
        const { data: list, error: listErr } = await supabase
            .from('clinics')
            .select('id, name')
            .eq('admin_id', userId)
            .eq('name', testName);

        if (listErr) {
            console.error("Fetch visibility failed:", listErr.message);
        } else if (list.length > 0) {
            console.log("Visibility SUCCESS! Found clinic ID:", list[0].id);
            console.log("Cleanup: Deleting test clinic...");
            await supabase.from('clinics').delete().eq('id', list[0].id);
            console.log("Done.");
        } else {
            console.log("Clinic created but not visible (check RLS SELECT policy)");
        }
    }
}

verifyFix().catch(console.error);
