
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zcrxdmpiackbgxrpzdbv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjcnhkbXBpYWNrYmd4cnB6ZGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MjI2MTksImV4cCI6MjA4MTk5ODYxOX0.ziMoDNplCPQwg1gyUJi08sDO4duP2hJX0zquHXaE9Zk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdmin() {
    const email = 'liviaadmim@gmail.com';
    const password = '127791';
    const name = 'Lívia Admin';

    console.log(`Attempting to create user: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                role: 'ADMIN_CLINICA'
            }
        }
    });

    if (error) {
        if (error.message.includes('already registered')) {
            console.log('User already registered in Auth.');
        } else {
            console.error('Error creating user:', error.message);
            return;
        }
    } else {
        console.log('User created successfully in Auth!', data.user?.id);
    }
}

createAdmin();
