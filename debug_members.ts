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

async function debugMembers() {
    console.log('🔍 Starting Professional Visibility Debug...');

    // 1. Sign in as Admin
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'liviaadmim@gmail.com',
        password: adminPassword
    });

    if (authError || !user) {
        console.error('❌ Auth Failed:', authError?.message);
        return;
    }
    console.log(`✅ Logged in as Admin: ${user.email} (${user.id})`);

    // 2. Get Admin's Clinics
    const { data: clinics, error: clinicsError } = await supabase
        .from('clinics')
        .select('*')
        .eq('admin_id', user.id);

    if (clinicsError) {
        console.error('❌ Failed to fetch clinics:', clinicsError.message);
        return;
    }

    if (!clinics || clinics.length === 0) {
        console.log('⚠️ No clinics found for this admin.');
        return;
    }

    console.log(`✅ Found ${clinics.length} clinics.`);

    // 3. Inspect Members for the first clinic
    const clinic = clinics[0];
    console.log(`\n🏥 Inspecting Clinic: "${clinic.name}" (${clinic.id})`);

    // A. Raw Select on clinic_members
    console.log('\n--- Checking clinic_members table ---');
    const { data: members, error: membersError } = await supabase
        .from('clinic_members')
        .select('*')
        .eq('clinic_id', clinic.id);

    if (membersError) {
        console.error('❌ Error fetching members:', membersError.message);
    } else {
        console.log(`Found ${members.length} raw rows in clinic_members.`);
        console.table(members);
    }

    if (!members || members.length === 0) {
        console.log('⚠️ No members found in this clinic (this might be correct if none linked).');
    } else {
        // B. Check Profiles visibility for these members
        const memberIds = members.map(m => m.doctor_id);
        console.log(`\n--- Checking profiles for IDs: ${memberIds.join(', ')} ---`);

        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .in('id', memberIds);

        if (profilesError) {
            console.error('❌ Error fetching profiles:', profilesError.message);
            console.log('💡 This strongly indicates an RLS issue on the "profiles" table.');
        } else {
            console.log(`Found ${profiles.length} profiles visible.`);
            console.table(profiles);

            if (profiles.length < members.length) {
                console.log(`⚠️ Mismatch! ${members.length} members but only ${profiles.length} profiles visible.`);
                console.log('💡 The missing profiles are hidden by RLS.');
            } else {
                console.log('✅ All profiles are visible.');
            }
        }
    }
}

debugMembers().catch(console.error);
