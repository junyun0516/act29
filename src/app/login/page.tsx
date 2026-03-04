'use client';

export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    const loginWithKakao = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'kakao',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            toast.error('로그인 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm border border-gray-200 bg-white">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-5">
                    <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                        Act29 레슨실 예약
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        선생님 계정으로 로그인하세요
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-4">
                    <button
                        onClick={loginWithKakao}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F5DC00] border border-[#D4B800] text-gray-900 font-medium py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="text-gray-700">로그인 중...</span>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path
                                        fillRule="evenodd"
                                        clipRule="evenodd"
                                        d="M9 0C4.032 0 0 3.192 0 7.128c0 2.556 1.656 4.794 4.14 6.084l-1.056 3.924c-.096.348.3.636.612.432L8.1 14.94c.294.036.594.06.9.06 4.968 0 9-3.192 9-7.128C18 3.192 13.968 0 9 0z"
                                        fill="#3C1E1E"
                                    />
                                </svg>
                                카카오로 로그인
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-gray-400">
                        카카오 계정으로 간편하게 시작하세요
                    </p>
                </div>
            </div>

            <p className="mt-6 text-xs text-gray-400">
                Act29 Church · apps.act29.kr
            </p>
        </div>
    );
}
