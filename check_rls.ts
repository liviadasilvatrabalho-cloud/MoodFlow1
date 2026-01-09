// Quick diagnostic script to check RLS policies
// Run with: npx tsx check_rls.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

function loadEnv() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const envPath = path.resolve(__dirname, '.env');

        if (!fs.existsSync(envPath)) {
            console.error('❌ No .env file found');
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
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRLS() {
    console.log('🔍 Checking RLS Policies...\n');

    const email = 'liviaadmim@gmail.com';
    const password = '127791';

    try {
        // Sign in
        console.log('Step 1: Signing in as admin...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            console.error('❌ Sign in failed:', signInError.message);
            return;
        }

        const userId = signInData.user?.id;
        console.log(`✅ Signed in successfully`);
        console.log(`User ID: ${userId}\n`);

        // Check profile role
        console.log('Step 2: Checking user role...');
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, email, name')
            .eq('id', userId)
            .single();

        console.log(`Role: ${profile?.role}`);
        console.log(`Email: ${profile?.email}\n`);

        // Try to create a test clinic
        console.log('Step 3: Testing clinic creation...');
        const testClinicName = `Test Clinic ${Date.now()}`;

        const { data: clinic, error: clinicError } = await supabase
            .from('clinics')
            .insert({
                name: testClinicName,
                admin_id: userId
            })
            .select()
            .single();

        if (clinicError) {
            console.error('❌ CLINIC CREATION FAILED!');
            console.error('Error Message:', clinicError.message);
            console.error('Error Code:', clinicError.code);
            console.error('Error Details:', clinicError.details);
            console.error('Error Hint:', clinicError.hint);
            console.log('\n⚠️  This confirms RLS policies are NOT working correctly!');
            console.log('\n📋 SOLUTION:');
            console.log('1. Open Supabase Dashboard → SQL Editor');
            console.log('2. Run this query to check if policies exist:');
            console.log('\n   SELECT * FROM pg_policies WHERE tablename = \'clinics\';\n');
            console.log('3. If no results, the migration was NOT applied');
            console.log('4. Apply the migration file: supabase/migrations/20260109_fix_clinic_rls_policies.sql');
        } else {
            console.log('✅ Clinic created successfully!');
            console.log(`Clinic ID: ${clinic.id}`);
            console.log(`Clinic Name: ${clinic.name}\n`);

            // Clean up - delete test clinic
            console.log('Cleaning up test clinic...');
            await supabase.from('clinics').delete().eq('id', clinic.id);
            console.log('✅ Test clinic deleted\n');

            console.log('🎉 RLS POLICIES ARE WORKING CORRECTLY!');
        }

        // Sign out
        await supabase.auth.signOut();

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkRLS();
