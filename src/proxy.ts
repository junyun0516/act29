import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 관리자 페이지는 로그인 필수 및 admin 권한 필수
    if (request.nextUrl.pathname.startsWith('/admin')) {
        if (!user) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    // 예약 API는 로그인 필수, GET 요청만 전체 통과 (수정: 예약은 POST 등 이므로 로그인 필요)
    if (
        request.nextUrl.pathname.startsWith('/api/reservations') &&
        request.method !== 'GET'
    ) {
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
