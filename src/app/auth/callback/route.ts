import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const token = searchParams.get('token'); // 초대 토큰

    if (code) {
        const supabase = await createClient();
        const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && sessionData.user) {
            const userId = sessionData.user.id;
            const email = sessionData.user.email;

            // 이미 프로필이 있으면 바로 이동
            const { data: existingProfile } = await supabase
                .from('lesson_profiles')
                .select('id')
                .eq('id', userId)
                .single();

            if (existingProfile) {
                return NextResponse.redirect(`${origin}`);
            }

            // 신규 사용자 — 토큰 검증 후 권한 부여, 없으면 기본 'user'
            const service = createServiceClient();
            let assignedRole = 'user';

            if (token) {
                const now = new Date().toISOString();

                const { data: invitation } = await service
                    .from('lesson_invitations')
                    .select('*')
                    .eq('token', token)
                    .eq('used', false)
                    .gt('expires_at', now)
                    .single();

                if (invitation) {
                    assignedRole = invitation.role;

                    // 초대 토큰 사용 처리
                    await service
                        .from('lesson_invitations')
                        .update({ used: true })
                        .eq('id', invitation.id);
                }
            }

            // 프로필 생성
            await service.from('lesson_profiles').insert({
                id: userId,
                email: email,
                full_name: sessionData.user.user_metadata?.full_name || '',
                role: assignedRole,
                subject: null,
            });

            return NextResponse.redirect(`${origin}`);
        }
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
