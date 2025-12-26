
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.join(__dirname, '.env');
const envConfig = {};
try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([^=]+)=(.*)$/);
        if (match) envConfig[match[1].trim()] = match[2].trim();
    });
} catch (e) { console.error('No .env'); process.exit(1); }

const supabaseUrl = envConfig['VITE_SUPABASE_URL'];
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) { console.error("Missing vars"); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log("1. Creating test user...");
    const email = `test_${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password
    });

    if (authError) {
        console.error("Auth failed:", authError.message);
        return;
    }

    const userId = authData.user?.id;
    console.log("User created:", userId);

    if (!userId) {
        console.error("No user ID returned");
        return;
    }

    console.log("2. Inserting entry...");
    const { error: insertError } = await supabase.from('entries').insert({
        user_id: userId,
        date: new Date().toISOString(),
        mood: 5,
        mood_label: 'Okay',
        text: 'Test entry from script',
        is_locked: false
    });

    if (insertError) {
        console.error("INSERT FAILED:", insertError);
        console.error("Likely RLS issue: 'Enable insert for authenticated users' might be missing.");
    } else {
        console.log("Entry inserted successfully.");
    }

    console.log("3. Fetching entries...");
    const { data: entries, error: fetchError } = await supabase.from('entries').select('*').eq('user_id', userId);

    if (fetchError) {
        console.error("FETCH FAILED:", fetchError);
    } else {
        console.log(`Fetched ${entries.length} entries.`);
        if (entries.length > 0) {
            console.log("Entry verification SUCCESS.");
        } else {
            console.log("Entry verification FAILED (inserted but not found?).");
        }
    }

    // Cleanup (optional, but good practice)
    // Note: Can't easily delete user without service role, but can delete content
    // await supabase.from('entries').delete().eq('user_id', userId);
}

runTest();
