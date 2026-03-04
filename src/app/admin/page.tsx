'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Classroom, Profile, Reservation } from '@/types';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';

// ======================================================
// ADMIN PAGE
// ======================================================
export default function AdminPage() {
    const supabase = createClient();

    // ── State ─────────────────────────────────────────
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [teachers, setTeachers] = useState<Profile[]>([]);
    const [pendingReservations, setPendingReservations] = useState<Reservation[]>([]);

    // Classroom form
    const [cls, setCls] = useState({ floor: '', name: '' });

    // Invitation
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'teacher' | 'admin'>('teacher');
    const [generatedLink, setGeneratedLink] = useState('');

    // ── Load ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        const [cls, tchr, rsv] = await Promise.all([
            supabase.from('lesson_classrooms').select('*').order('floor').order('name'),
            supabase.from('lesson_profiles').select('*').eq('role', 'teacher'),
            supabase
                .from('lesson_reservations')
                .select('*, teacher:lesson_profiles(full_name), lesson:lesson_lessons(title), classroom:lesson_classrooms(name,floor,room_number)')
                .eq('status', 'pending')
                .order('date')
                .order('start_time'),
        ]);
        setClassrooms(cls.data ?? []);
        setTeachers(tchr.data ?? []);
        setPendingReservations(rsv.data ?? []);
    };

    // ── Classroom 추가 ────────────────────────────────
    const addClassroom = async () => {
        if (!cls.floor || !cls.name) {
            toast.error('모든 필드를 입력해주세요.');
            return;
        }
        const { error } = await supabase.from('lesson_classrooms').insert({
            ...cls,
            is_active: true,
        });
        if (error) toast.error('강의실 추가 실패');
        else {
            toast.success('강의실이 추가되었습니다.');
            setCls({ floor: '', name: '' });
            fetchAll();
        }
    };

    const toggleClassroom = async (id: string, current: boolean) => {
        await supabase
            .from('lesson_classrooms')
            .update({ is_active: !current })
            .eq('id', id);
        fetchAll();
    };

    // ── 초대 링크 발급 ─────────────────────────────────
    const issueInvitation = async () => {
        const token = crypto.randomUUID();
        const expires = new Date();
        expires.setDate(expires.getDate() + 7); // 7일 유효

        const { error } = await supabase.from('lesson_invitations').insert({
            token,
            email: inviteEmail || null,
            role: inviteRole,
            used: false,
            expires_at: expires.toISOString(),
        });

        if (error) {
            toast.error('초대 링크 발급 실패');
        } else {
            const link = `${window.location.origin}/login?token=${token}`;
            setGeneratedLink(link);
            toast.success('초대 링크가 발급되었습니다.');
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(generatedLink);
        toast.success('링크가 복사되었습니다.');
    };

    // ── 선생님 삭제 ────────────────────────────────────
    const deleteTeacher = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await supabase.from('lesson_profiles').delete().eq('id', id);
        fetchAll();
        toast.success('삭제되었습니다.');
    };

    // ── 예약 승인/거절 ─────────────────────────────────
    const approveReservation = async (id: string) => {
        await supabase
            .from('lesson_reservations')
            .update({ status: 'approved' })
            .eq('id', id);
        toast.success('승인되었습니다.');
        fetchAll();
    };

    const rejectReservation = async (id: string) => {
        await supabase
            .from('lesson_reservations')
            .update({ status: 'rejected' })
            .eq('id', id);
        toast.success('거절되었습니다.');
        fetchAll();
    };

    // ── Render ────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-12 flex items-center gap-4">
                    <Link href="/" className="text-xs text-gray-400 hover:text-gray-700">
                        ← 홈
                    </Link>
                    <span className="text-sm font-bold text-gray-900">관리자</span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6">
                <Tabs defaultValue="reservations">
                    <TabsList className="rounded-none mb-6 gap-0 h-9 bg-gray-100 p-0">
                        {[
                            { value: 'reservations', label: `예약 승인 (${pendingReservations.length})` },
                            { value: 'classrooms', label: '강의실 관리' },
                            { value: 'teachers', label: '선생님 관리' },
                        ].map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="rounded-none h-full px-4 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-none border-r border-gray-200 last:border-0"
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {/* ── 예약 승인 ── */}
                    <TabsContent value="reservations">
                        <SectionCard title="승인 대기 예약">
                            {pendingReservations.length === 0 ? (
                                <p className="text-sm text-gray-400 py-4 text-center">
                                    대기 중인 예약이 없습니다.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>날짜</TableHead>
                                            <TableHead>시간</TableHead>
                                            <TableHead>강의실</TableHead>
                                            <TableHead>선생님</TableHead>
                                            <TableHead>수업</TableHead>
                                            <TableHead className="text-right">처리</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingReservations.map((r) => (
                                            <TableRow key={r.id}>
                                                <TableCell className="text-xs font-mono">{r.date}</TableCell>
                                                <TableCell className="text-xs font-mono">
                                                    {r.start_time} ~ {r.end_time}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {r.classroom?.name}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {r.teacher?.full_name}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {r.lesson?.title}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button
                                                            onClick={() => approveReservation(r.id)}
                                                            className="p-1 text-green-600 hover:text-green-800"
                                                            title="승인"
                                                        >
                                                            <CheckCircle size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => rejectReservation(r.id)}
                                                            className="p-1 text-red-500 hover:text-red-700"
                                                            title="거절"
                                                        >
                                                            <XCircle size={16} />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </SectionCard>
                    </TabsContent>

                    {/* ── 강의실 관리 ── */}
                    <TabsContent value="classrooms">
                        <SectionCard title="강의실 추가">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">층</Label>
                                    <Input
                                        placeholder="예: 3층"
                                        value={cls.floor}
                                        onChange={(e) => setCls({ ...cls, floor: e.target.value })}
                                        className="rounded-none h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">이름</Label>
                                    <Input
                                        placeholder="예: 피아노실"
                                        value={cls.name}
                                        onChange={(e) => setCls({ ...cls, name: e.target.value })}
                                        className="rounded-none h-9 text-sm"
                                    />
                                </div>
                            </div>
                            <Button onClick={addClassroom} className="rounded-none h-9 text-sm bg-gray-900 hover:bg-gray-700 w-full">
                                강의실 추가
                            </Button>
                        </SectionCard>

                        <SectionCard title="강의실 목록" className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>층</TableHead>
                                        <TableHead>이름</TableHead>
                                        <TableHead className="text-right">상태</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {classrooms.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="text-xs">{c.floor}</TableCell>
                                            <TableCell className="text-xs font-medium">{c.name}</TableCell>
                                            <TableCell className="text-right">
                                                <button
                                                    onClick={() => toggleClassroom(c.id, c.is_active)}
                                                    className={`text-xs px-2 py-1 border ${c.is_active
                                                        ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                        : 'border-gray-200 text-gray-400'
                                                        }`}
                                                >
                                                    {c.is_active ? '활성' : '비활성'}
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SectionCard>
                    </TabsContent>

                    {/* ── 선생님 관리 ── */}
                    <TabsContent value="teachers">
                        <SectionCard title="초대 링크 발급">
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">이메일 (선택)</Label>
                                    <Input
                                        type="email"
                                        placeholder="초대할 이메일"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="rounded-none h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">권한</Label>
                                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'teacher' | 'admin')}>
                                        <SelectTrigger className="rounded-none h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            <SelectItem value="teacher" className="text-sm">선생님</SelectItem>
                                            <SelectItem value="admin" className="text-sm">관리자</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={issueInvitation} className="rounded-none h-9 text-sm bg-gray-900 hover:bg-gray-700 w-full">
                                초대 링크 생성 (7일 유효)
                            </Button>
                            {generatedLink && (
                                <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2">
                                    <span className="flex-1 text-xs font-mono text-gray-700 break-all">
                                        {generatedLink}
                                    </span>
                                    <button onClick={copyLink} className="text-gray-500 hover:text-gray-900 shrink-0">
                                        <Copy size={14} />
                                    </button>
                                </div>
                            )}
                        </SectionCard>

                        <SectionCard title="선생님 목록" className="mt-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>이름</TableHead>
                                        <TableHead>이메일</TableHead>
                                        <TableHead>담당 과목</TableHead>
                                        <TableHead className="text-right">삭제</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {teachers.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="text-xs font-medium">{t.full_name}</TableCell>
                                            <TableCell className="text-xs text-gray-500">{t.email}</TableCell>
                                            <TableCell className="text-xs">{t.subject ?? '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <button
                                                    onClick={() => deleteTeacher(t.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SectionCard>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// ── Helper Component ─────────────────────────────────
function SectionCard({
    title,
    children,
    className,
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`bg-white border border-gray-200 ${className ?? ''}`}>
            <div className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            </div>
            <div className="px-4 py-4">{children}</div>
        </div>
    );
}
