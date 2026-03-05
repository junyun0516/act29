'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

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
                </div>
            </div>

            <p className="mt-8 text-xs text-gray-400 font-medium">
                Act29 Church · apps.act29.kr
            </p>
        </div>
    );
}
