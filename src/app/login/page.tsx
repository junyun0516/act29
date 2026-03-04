'use client';

export const dynamic = 'force-dynamic';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function LoginContent() {
    const searchParams = useSearchParams();
    const tokenFromUrl = searchParams.get('token');

    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const supabase = createClient();

    const handleOAuthLogin = async (provider: 'kakao' | 'google') => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback${tokenFromUrl ? `?token=${tokenFromUrl}` : ''}`,
            },
        });
        if (error) {
            toast.error(`${provider} 로그인 중 오류가 발생했습니다.`);
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        if (isSignUp) {
            if (password !== confirmPassword) {
                toast.error('비밀번호가 일치하지 않습니다.');
                setLoading(false);
                return;
            }
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        token: tokenFromUrl,
                    }
                }
            });
            if (error) toast.error(`회원가입 실패: ${error.message}`);
            else toast.success('회원가입 확인 메일을 보내드렸습니다. 메일 확인 후 로그인해 주세요.');
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) toast.error(`로그인 실패: ${error.message}`);
            else {
                toast.success('로그인되었습니다.');
                window.location.href = '/';
            }
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
                        {isSignUp ? '계정 생성' : '선생님 로그인'}
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-5">
                    {/* Social Logins */}
                    <div className="space-y-2">
                        <button
                            onClick={() => handleOAuthLogin('kakao')}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-[#FEE500] hover:bg-[#F5DC00] border border-[#D4B800] text-gray-900 font-medium h-11 text-sm transition-colors disabled:opacity-50"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M9 0C4.032 0 0 3.192 0 7.128c0 2.556 1.656 4.794 4.14 6.084l-1.056 3.924c-.096.348.3.636.612.432L8.1 14.94c.294.036.594.06.9.06 4.968 0 9-3.192 9-7.128C18 3.192 13.968 0 9 0z"
                                    fill="#3C1E1E"
                                />
                            </svg>
                            카카오로 {isSignUp ? '시작하기' : '로그인'}
                        </button>
                        <button
                            onClick={() => handleOAuthLogin('google')}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium h-11 text-sm transition-colors disabled:opacity-50"
                        >
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0 5.482 0 2.443 2.022.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335" />
                            </svg>
                            Google로 {isSignUp ? '시작하기' : '로그인'}
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-gray-400">또는 이메일로</span>
                        </div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-semibold text-gray-700">이메일</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="rounded-none h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-0 transition-colors"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-xs font-semibold text-gray-700">비밀번호</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="rounded-none h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-0 transition-colors"
                                required
                            />
                        </div>
                        {isSignUp && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-gray-700">비밀번호 확인</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="rounded-none h-11 text-sm border-gray-200 focus:border-gray-900 focus:ring-0 transition-colors"
                                    required
                                />
                            </div>
                        )}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-none h-11 text-sm font-bold bg-gray-900 hover:bg-gray-800 text-white transition-colors"
                        >
                            {loading ? '처리 중...' : (isSignUp ? '회원가입' : '이메일로 로그인')}
                        </Button>
                    </form>

                    <div className="pt-2 text-center text-xs text-gray-500">
                        {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-1 text-gray-900 font-bold hover:underline"
                        >
                            {isSignUp ? '로그인하기' : '회원가입하기'}
                        </button>
                    </div>
                </div>
            </div>

            <p className="mt-8 text-xs text-gray-400 font-medium">
                Act29 Church · apps.act29.kr
            </p>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-400">로딩 중...</div>}>
            <LoginContent />
        </Suspense>
    );
}
