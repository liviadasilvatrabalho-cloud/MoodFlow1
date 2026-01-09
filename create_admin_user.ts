
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Manual .env parser to avoid external dependencies like 'dotenv'
function loadEnv() {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const envPath = path.resolve(__dirname, '.env');

        if (!fs.existsSync(envPath)) {
            console.error('No .env file found at:', envPath);
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
        console.error("Critical: Could not load .env file", e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL']
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY']

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createAdmin() {
    const email = 'liviaadmim@gmail.com'
    const password = '127791'
    const name = 'Lívia Admin'

    console.log(`Step 1: Attempting to sign up/in user: ${email}...`)

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                role: 'ADMIN_CLINICA'
            }
        }
    })

    let userId = authData.user?.id

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('User already registered. Signing in to get ID...')
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError) {
                console.error('Sign in failed:', signInError.message)
                return
            }
            userId = signInData.user?.id
        } else {
            console.error('Signup error:', authError.message)
            return
        }
    }

    if (!userId) {
        console.error('Failed to obtain User ID.')
        return
    }

    console.log('User ID:', userId)
    console.log('Step 2: Ensuring profile is set to ADMIN_CLINICA in public.profiles...')

    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            name: name,
            role: 'ADMIN_CLINICA',
            role_confirmed: true,
            language: 'pt'
        })

    if (profileError) {
        console.error('Profile update error:', profileError.message)
    } else {
        console.log('SUCCESS: Admin user is ready with correct roles.')
    }
}

createAdmin()
