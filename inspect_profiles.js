
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

async function inspectProfiles() {
    console.log("Inspecting Profiles...");
    // Just select 1 row to see keys
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    if (error) {
        console.error("Error selecting profiles:", error);
    } else {
        console.log("Profiles Sample Row:", data[0]);
        // Also try to insert/upsert to see if 'full_name' or 'name' is accepted if table is empty
        if (data.length === 0) {
            console.log("Table is empty. Attempting to insert dummy to check columns...");
        }
    }
}

inspectProfiles();
