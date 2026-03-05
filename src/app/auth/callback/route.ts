import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as string | null;
    const next = searchParams.get('next') ?? '/';

    console.log('--- Auth Callback Request ---');
    console.log('URL:', request.url);
    console.log('Params:', Object.fromEntries(searchParams.entries()));

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log('Available Cookies:', allCookies.map((c) => c.name));

    const verifierCookie = allCookies.find(c => c.name.endsWith('-code-verifier'));
    console.log('Verifier Cookie Value (first 10 chars):', verifierCookie?.value?.substring(0, 10));

    const supabase = await createClient();

    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any
        });
        if (!error) {
            console.log('verifyOtp success, redirecting to:', next);
            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error('verifyOtp error:', error);
        }
    }

    if (code) {
        console.log('Exchanging code for session...');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log('exchangeCodeForSession success, redirecting to:', next);
            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error('exchangeCodeForSession error:', error);
        }
    }

    console.log('Auth failed, redirecting to login');
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
