
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createAdmin() {
    const email = 'liviaadmim@gmail.com'
    const password = '127791'
    const name = 'Lívia Admin'

    console.log(`Attempting to create user: ${email}...`)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
                role: 'ADMIN_CLINICA'
            }
        }
    })

    if (error) {
        console.error('Error creating user:', error.message)
        return
    }

    console.log('User created successfully in Auth!', data.user?.id)

    if (data.user) {
        console.log('Now updating profile role in public.profiles...')
        // Note: The profile might be created by a trigger, but we'll manually ensure it has the right role.
        // However, since we are using the anon key, RLS might block us. 
        // Usually, we would do this via SQL execute tools we have.
    }
}

createAdmin()
