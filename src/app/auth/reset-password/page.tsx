'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Suspense } from 'react';

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [verified, setVerified] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const supabase = createClient();

    useEffect(() => {
        const token_hash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (token_hash && type === 'recovery') {
            // token_hash로 클라이언트에서 직접 OTP 검증
            supabase.auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
                if (error) {
                    console.error('verifyOtp error:', error);
                    setVerifyError('유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요.');
                } else {
                    setVerified(true);
                }
            });
        } else {
            // token_hash 없이 접근했다면 이미 세션이 있는지 확인 (로그인 상태)
            supabase.auth.getSession().then(({ data }) => {
                if (data.session) {
                    setVerified(true);
                } else {
                    setVerifyError('잘못된 접근입니다. 이메일의 링크를 통해 다시 시도해 주세요.');
                }
            });
        }
    }, [searchParams, supabase]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || !confirmPassword) {
            toast.error('비밀번호를 입력해주세요.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (password.length < 6) {
            toast.error('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            toast.error(`비밀번호 변경 실패: ${error.message}`);
        } else {
            toast.success('비밀번호가 성공적으로 변경되었습니다.');
            window.location.href = '/';
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm border border-gray-200 bg-white shadow-sm">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-6">
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                        Act29 레슨실 예약
                    </h1>
                    <p className="mt-1.5 text-xs text-gray-500 uppercase tracking-wider font-medium">
                        비밀번호 재설정
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-5">
                    {verifyError ? (
                        <div className="text-center py-6 space-y-3">
                            <p className="text-sm text-red-500">{verifyError}</p>
                            <a href="/login" className="text-xs text-gray-900 font-bold hover:underline">
                                로그인으로 돌아가기
                            </a>
                        </div>
                    ) : !verified ? (
                        <div className="text-center py-6 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900 mx-auto"></div>
                            <p className="text-sm text-gray-500">
                                인증 정보를 확인하고 있습니다...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <p className="text-sm text-gray-600">
                                새로운 비밀번호를 입력해주세요.
                            </p>
                            <div className="space-y-1.5">
                                <Label htmlFor="newPassword" className="text-xs font-semibold text-gray-700">새 비밀번호</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="rounded-none h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-0 transition-colors"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="confirmNewPassword" className="text-xs font-semibold text-gray-700">비밀번호 확인</Label>
                                <Input
                                    id="confirmNewPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="rounded-none h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-0 transition-colors"
                                    required
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-none h-11 text-sm font-bold bg-gray-900 hover:bg-gray-800 text-white transition-colors"
                            >
                                {loading ? '처리 중...' : '비밀번호 변경'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>

            <p className="mt-8 text-xs text-gray-400 font-medium">
                Act29 Church · apps.act29.kr
            </p>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}
