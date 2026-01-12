
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

async function testServiceLogic() {
    console.log('🔍 Testing storageService Logic...');

    // 1. Sign in
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'liviaadmim@gmail.com',
        password: adminPassword
    });

    if (authError) { console.error('❌ Auth Failed'); return; }

    // 2. Get Clinic
    const { data: clinics } = await supabase.from('clinics').select('id, name').eq('admin_id', user.id);
    if (!clinics || clinics.length === 0) { console.log('❌ No clinics'); return; }

    const clinicId = clinics[0].id;
    console.log(`🏥 Clinic: ${clinics[0].name} (${clinicId})`);

    // 3. RUN THE EXACT LOGIC FROM storageService.ts
    console.log('--- Running getClinicProfessionals logic ---');

    // STEP 1: Fetch members
    const { data: members, error: membersError } = await supabase
        .from('clinic_members')
        .select('*')
        .eq('clinic_id', clinicId)
        .not('doctor_id', 'is', null);

    if (membersError) { console.error("❌ Error fetching members:", membersError); return; }
    console.log(`✅ Step 1: Found ${members?.length || 0} members`);

    if (!members || members.length === 0) return;

    // STEP 2: Fetch profiles
    const doctorIds = members.map(m => m.doctor_id);
    console.log(`   IDs: ${doctorIds.join(', ')}`);

    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('id', doctorIds);

    if (profilesError) { console.error("❌ Error fetching profiles:", profilesError); return; }
    console.log(`✅ Step 2: Found ${profiles?.length || 0} profiles`);

    // STEP 3: Merge
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    const merged = members.map(m => {
        const profile = profileMap.get(m.doctor_id);
        if (!profile) {
            console.log(`⚠️ Missing profile for doc ID: ${m.doctor_id}`);
            return null;
        }
        return {
            ...profile,
            membershipStatus: m.status,
            specialty: profile.role
        };
    }).filter(item => item !== null);

    console.log(`✅ Step 3: Merged result has ${merged.length} items`);
    console.dir(merged, { depth: null });
}

testServiceLogic().catch(console.error);
