// Script to verify and fix admin user
// Run with: npx tsx verify_admin.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Manual .env parser
function loadEnv() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const envPath = path.resolve(__dirname, '.env');

        if (!fs.existsSync(envPath)) {
            console.error('❌ No .env file found at:', envPath);
            return {};
        }

        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars: Record<string, string> = {};

        envFile.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;

            const [key, ...rest] = trimmedLine.split('=');
            const value = rest.join('=');
            if (key && value) {
                envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        });
        return envVars;
    } catch (e) {
        console.error("❌ Could not load .env file", e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyAdmin() {
    console.log('🔍 Verifying Admin User Configuration...\n');

    const email = 'liviaadmim@gmail.com';
    const password = '127791';

    try {
        // Step 1: Try to sign in
        console.log('Step 1: Attempting to sign in as admin...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            console.error('❌ Sign in failed:', signInError.message);
            console.log('\n💡 Tip: Run create_admin_user.ts to create/fix the admin user');
            return;
        }

        const userId = signInData.user?.id;
        console.log('✅ Sign in successful!');
        console.log(`User ID: ${userId}\n`);

        // Step 2: Check profile
        console.log('Step 2: Checking profile in database...');
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error('❌ Profile fetch error:', profileError.message);
            return;
        }

        console.log('✅ Profile found:');
        console.log(`  Name: ${profile.name}`);
        console.log(`  Email: ${profile.email}`);
        console.log(`  Role: ${profile.role}`);
        console.log(`  Clinical Role: ${profile.clinical_role}`);
        console.log(`  Clinic Role: ${profile.clinic_role}`);
        console.log(`  Role Confirmed: ${profile.role_confirmed}`);
        console.log(`  Language: ${profile.language}\n`);

        // Step 3: Verify role is correct
        if (profile.role !== 'ADMIN_CLINICA') {
            console.log('⚠️  Role is not ADMIN_CLINICA. Fixing...');
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    role: 'ADMIN_CLINICA',
                    role_confirmed: true
                })
                .eq('id', userId);

            if (updateError) {
                console.error('❌ Failed to update role:', updateError.message);
            } else {
                console.log('✅ Role updated to ADMIN_CLINICA');
            }
        } else {
            console.log('✅ Role is correctly set to ADMIN_CLINICA');
        }

        // Step 4: Check clinics
        console.log('\nStep 3: Checking clinics for this admin...');
        const { data: clinics, error: clinicsError } = await supabase
            .from('clinics')
            .select('*')
            .eq('admin_id', userId);

        if (clinicsError) {
            console.error('❌ Error fetching clinics:', clinicsError.message);
            console.error('Details:', JSON.stringify(clinicsError, null, 2));
            console.log('\n⚠️  This error suggests RLS policies are not applied!');
            console.log('📋 Action required: Apply the migration file in Supabase SQL Editor');
            console.log('   File: supabase/migrations/20260109_fix_clinic_rls_policies.sql');
        } else {
            console.log(`✅ Found ${clinics?.length || 0} clinic(s):`);
            if (clinics && clinics.length > 0) {
                clinics.forEach((clinic, index) => {
                    console.log(`  ${index + 1}. ${clinic.name} (ID: ${clinic.id})`);
                });
            } else {
                console.log('  (No clinics yet - this is normal for a new admin)');
            }
        }

        // Step 5: Summary
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Admin user exists and can log in`);
        console.log(`✅ Email: ${email}`);
        console.log(`✅ Password: ${password}`);
        console.log(`${profile.role === 'ADMIN_CLINICA' ? '✅' : '❌'} Role: ${profile.role}`);

        if (clinicsError) {
            console.log(`❌ RLS Policies: NOT APPLIED`);
            console.log(`\n⚠️  NEXT STEP: Apply RLS migration in Supabase`);
            console.log(`   1. Open Supabase Dashboard → SQL Editor`);
            console.log(`   2. Run: supabase/migrations/20260109_fix_clinic_rls_policies.sql`);
        } else {
            console.log(`✅ RLS Policies: Applied correctly`);
            console.log(`✅ Clinics: ${clinics?.length || 0} found`);
        }

        // Sign out
        await supabase.auth.signOut();

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

verifyAdmin();
