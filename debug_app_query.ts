
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
        acc[key.trim()] = value.trim();
    }
    return acc;
}, {} as Record<string, string>);

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const adminPassword = envVars.ADMIN_PASSWORD || '127791';

async function debugAppQuery() {
    console.log('🔍 Testing App Query Logic...');

    // 1. Sign in
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'liviaadmim@gmail.com',
        password: adminPassword
    });

    if (authError) {
        console.error('❌ Auth Failed:', authError.message);
        return;
    }

    // 2. Get Clinic ID
    const { data: clinics } = await supabase.from('clinics').select('id').eq('admin_id', user.id).limit(1);
    if (!clinics || clinics.length === 0) {
        console.log('No clinics found');
        return;
    }
    const clinicId = clinics[0].id;
    console.log(`Testing with Clinic ID: ${clinicId}`);

    // 3. EXECUTE EXACT QUERY FROM storageService.ts
    console.log('\n--- Executing JOIN Query ---');
    const { data, error } = await supabase
        .from('clinic_members')
        .select(`
            status,
            doctor:doctor_id (
                id,
                name,
                email,
                role
            )
        `)
        .eq('clinic_id', clinicId)
        .neq('doctor_id', null);

    if (error) {
        console.error('❌ Query Failed:', error);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
    } else {
        console.log('✅ Query Success!');
        console.log(`Returned ${data.length} rows.`);
        console.dir(data, { depth: null });

        if (data.length > 0) {
            if (data[0].doctor === null) {
                console.log('⚠️ ALERT: "doctor" field is NULL! The Join failed.');
                console.log('Possible causes:');
                console.log('1. No foreign key relation between clinic_members.doctor_id and profiles.id');
                console.log('2. RLS policies hiding the profile (even if separate select worked? unlikel but possible)');
            } else {
                console.log('✅ Doctor data is present.');
            }
        }
    }
}

debugAppQuery().catch(console.error);
