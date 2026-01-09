// Script to inspect clinics in the database
// Run with: node inspect_clinics_cjs.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectClinics() {
    console.log('🔍 Inspecting Clinics Table...\n');

    try {
        // Get all clinics
        const { data: clinics, error: clinicsError } = await supabase
            .from('clinics')
            .select('*')
            .order('created_at', { ascending: false });

        if (clinicsError) {
            console.error('❌ Error fetching clinics:', clinicsError);
            console.error('Details:', JSON.stringify(clinicsError, null, 2));
            return;
        }

        console.log(`📊 Total Clinics: ${clinics?.length || 0}\n`);

        if (clinics && clinics.length > 0) {
            clinics.forEach((clinic, index) => {
                console.log(`--- Clinic ${index + 1} ---`);
                console.log(`ID: ${clinic.id}`);
                console.log(`Name: ${clinic.name}`);
                console.log(`Admin ID: ${clinic.admin_id}`);
                console.log(`Created At: ${clinic.created_at}`);
                console.log('');
            });
        } else {
            console.log('⚠️  No clinics found in database');
        }

        // Check for admin user
        console.log('\n🔍 Checking for admin user (liviaadmim@gmail.com)...\n');
        const { data: adminProfile, error: adminError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'liviaadmim@gmail.com')
            .single();

        if (adminError) {
            console.error('❌ Error fetching admin profile:', adminError);
        } else if (adminProfile) {
            console.log('✅ Admin user found:');
            console.log(`ID: ${adminProfile.id}`);
            console.log(`Name: ${adminProfile.name}`);
            console.log(`Role: ${adminProfile.role}`);
            console.log(`Email: ${adminProfile.email}`);

            // Check clinics for this admin
            const { data: adminClinics, error: adminClinicsError } = await supabase
                .from('clinics')
                .select('*')
                .eq('admin_id', adminProfile.id);

            if (adminClinicsError) {
                console.error('\n❌ Error fetching admin clinics:', adminClinicsError);
                console.error('Details:', JSON.stringify(adminClinicsError, null, 2));
            } else {
                console.log(`\n📋 Clinics for this admin: ${adminClinics?.length || 0}`);
                if (adminClinics && adminClinics.length > 0) {
                    adminClinics.forEach(clinic => {
                        console.log(`  - ${clinic.name} (ID: ${clinic.id})`);
                    });
                } else {
                    console.log('⚠️  This admin has no clinics yet');
                }
            }
        } else {
            console.log('⚠️  Admin user not found');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

inspectClinics();
