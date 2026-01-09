
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function loadEnv() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const envPath = path.resolve(__dirname, '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envFile.split('\n').forEach(line => {
            const [key, ...rest] = line.split('=');
            const value = rest.join('=');
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

async function inspectClinics() {
    console.log("Inspecting Clinics Table...");
    const { data, error } = await supabase.from('clinics').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Columns present in clinics:", Object.keys(data[0] || {}));
        console.log("Sample row:", data[0]);
    }
}

inspectClinics();
