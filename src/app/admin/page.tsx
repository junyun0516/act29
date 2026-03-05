'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Classroom, Profile, OperatingHours } from '@/types';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, X, Edit2 } from 'lucide-react';
import Link from 'next/link';

// ======================================================
// ADMIN PAGE
// ======================================================
export default function AdminPage() {
    const supabase = createClient();

    // ── State ─────────────────────────────────────────
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [admins, setAdmins] = useState<Profile[]>([]);
    const [teachers, setTeachers] = useState<Profile[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([]);

    // Classroom form
    const [cls, setCls] = useState({ floor: '', name: '' });
    const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);

    const [selectedTeacher, setSelectedTeacher] = useState<Profile | null>(null);

    // ── Load ──────────────────────────────────────────
    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        const [cls, profs, hours] = await Promise.all([
            supabase.from('lesson_classrooms').select('*').order('floor').order('name'),
            supabase.from('lesson_profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('lesson_operating_hours').select('*').order('day_of_week'),
        ]);

        setClassrooms(cls.data ?? []);

        const allProfiles = profs.data ?? [];
        setAdmins(allProfiles.filter(p => p.role === 'admin'));
        setTeachers(allProfiles.filter(p => p.role === 'teacher'));
        setUsers(allProfiles.filter(p => p.role === 'user'));

        setOperatingHours(hours.data ?? []);
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
        const { error } = await supabase
            .from('lesson_classrooms')
            .update({ is_active: !current })
            .eq('id', id);
        if (error) toast.error('상태 변경 실패');
        else fetchAll();
    };

    const deleteClassroom = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 이 강의실의 모든 예약 내역도 영향을 받을 수 있습니다.')) return;
        const { error } = await supabase.from('lesson_classrooms').delete().eq('id', id);
        if (error) {
            if (error.code === '23503') {
                toast.error('예약 내역이 있는 강의실은 삭제할 수 없습니다. 대신 OFF 처리를 이용해주세요.');
            } else {
                toast.error('삭제 실패');
            }
        } else {
            toast.success('삭제되었습니다.');
            fetchAll();
        }
    };

    const updateClassroom = async (id: string, updates: Partial<Classroom>) => {
        const { error } = await supabase
            .from('lesson_classrooms')
            .update(updates)
            .eq('id', id);

        if (error) {
            toast.error('정보 수정 실패');
        } else {
            toast.success('정보가 수정되었습니다.');
            setSelectedClassroom(null);
            fetchAll();
        }
    };

    // ── 선생님 삭제 ────────────────────────────────────
    const deleteTeacher = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await supabase.from('lesson_profiles').delete().eq('id', id);
        fetchAll();
        toast.success('삭제되었습니다.');
    };

    // ── 사용자 역할 변경 ─────────────────────────────
    const changeUserRole = async (userId: string, newRole: 'user' | 'teacher' | 'admin') => {
        const { error } = await supabase
            .from('lesson_profiles')
            .update({ role: newRole })
            .eq('id', userId);
        if (error) toast.error('역할 변경 실패');
        else {
            const roleLabels = { admin: '관리자', teacher: '선생님', user: '일반 사용자' };
            toast.success(`역할이 ${roleLabels[newRole]}으로 변경되었습니다.`);
            fetchAll();
        }
    };

    // ── 선생님 정보 편집 (사이드 패널 저장) ─────────────
    const updateTeacherInfo = async (id: string, updates: Partial<Profile>) => {
        const { error } = await supabase
            .from('lesson_profiles')
            .update(updates)
            .eq('id', id);

        if (error) {
            toast.error('정보 수정 실패');
        } else {
            toast.success('정보가 수정되었습니다.');
            setSelectedTeacher(null); // 수정 완료 후 패널 닫기
            fetchAll();
        }
    };


    // ── 운영 시간 업데이트 ────────────────────────────
    const updateOperatingHour = async (id: string, updates: Partial<OperatingHours>) => {
        const { error } = await supabase
            .from('lesson_operating_hours')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) toast.error('운영 시간 업데이트 실패');
        else {
            toast.success('운영 시간이 업데이트되었습니다.');
            fetchAll();
        }
    };

    // ── Render ────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col relative overflow-x-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 h-12 flex items-center gap-4">
                    <Link href="/" className="text-xs text-gray-400 hover:text-gray-700">
                        ← 홈
                    </Link>
                    <span className="text-sm font-bold text-gray-900">관리자</span>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">
                <Tabs defaultValue="classrooms" className="w-full relative">
                    {/* 모바일에서 탭이 넘칠 경우 가로 스크롤 허용 */}
                    <div className="w-full overflow-x-auto pb-2 -mb-2 no-scrollbar">
                        <TabsList className="rounded-none mb-6 gap-0 h-9 bg-gray-100 p-0 flex w-min sm:w-full">
                            {[
                                { value: 'classrooms', label: '강의실' },
                                { value: 'schedule', label: '운영시간' },
                                { value: 'admins', label: `관리자(${admins.length})` },
                                { value: 'teachers', label: `선생님(${teachers.length})` },
                                { value: 'users', label: `사용자(${users.length})` },
                            ].map((tab) => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="rounded-none h-full px-3 sm:px-4 text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-none border-r border-gray-200 last:border-0 whitespace-nowrap"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

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
                                        <TableHead>상태</TableHead>
                                        <TableHead className="text-right">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {classrooms.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="text-xs">{c.floor}</TableCell>
                                            <TableCell className="text-xs font-medium">{c.name}</TableCell>
                                            <TableCell>
                                                <button
                                                    onClick={() => toggleClassroom(c.id, c.is_active)}
                                                    className={`text-[10px] font-bold px-2 py-0.5 border ${c.is_active
                                                        ? 'border-gray-900 bg-gray-900 text-white'
                                                        : 'border-gray-200 text-gray-400'
                                                        }`}
                                                >
                                                    {c.is_active ? 'ON' : 'OFF'}
                                                </button>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => setSelectedClassroom(c)}
                                                        className="p-1.5 text-gray-300 hover:text-gray-900 transition-colors"
                                                        title="수정"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteClassroom(c.id)}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                        title="삭제"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </SectionCard>
                    </TabsContent>

                    {/* ── 운영 시간 관리 ── */}
                    <TabsContent value="schedule">
                        <SectionCard title="요일별 운영 시간">
                            <div className="divide-y divide-gray-100">
                                {['일', '월', '화', '수', '목', '금', '토'].map((dayName, idx) => {
                                    const hour = operatingHours.find(h => h.day_of_week === idx);
                                    if (!hour) return null;
                                    return (
                                        <div key={hour.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                                            <div className="w-12 shrink-0 flex items-center gap-2">
                                                <span className={`text-sm font-bold ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-900'}`}>
                                                    {dayName}
                                                </span>
                                            </div>

                                            <div className="flex-1 flex items-center gap-3">
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-[10px] uppercase text-gray-400 font-bold">Open</Label>
                                                    <Input
                                                        type="time"
                                                        value={hour.open_time.slice(0, 5)}
                                                        disabled={hour.is_closed}
                                                        onChange={(e) => updateOperatingHour(hour.id, { open_time: e.target.value })}
                                                        className="rounded-none h-8 text-xs border-gray-200"
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-[10px] uppercase text-gray-400 font-bold">Close</Label>
                                                    <Input
                                                        type="time"
                                                        value={hour.close_time.slice(0, 5)}
                                                        disabled={hour.is_closed}
                                                        onChange={(e) => updateOperatingHour(hour.id, { close_time: e.target.value })}
                                                        className="rounded-none h-8 text-xs border-gray-200"
                                                    />
                                                </div>
                                            </div>

                                            <div className="w-24 shrink-0 flex flex-col items-end gap-1">
                                                <Label className="text-[10px] uppercase text-gray-400 font-bold">휴무 여부</Label>
                                                <button
                                                    onClick={() => updateOperatingHour(hour.id, { is_closed: !hour.is_closed })}
                                                    className={`text-[10px] font-bold px-3 py-1 border transition-colors ${hour.is_closed
                                                        ? 'bg-red-50 text-red-600 border-red-200'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {hour.is_closed ? '휴무' : '영업'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </SectionCard>
                    </TabsContent>

                    {/* ── 선생님 관리 ── */}
                    <TabsContent value="teachers">
                        <SectionCard title="선생님 목록">
                            <UserList
                                users={teachers}
                                onDelete={deleteTeacher}
                                onChangeRole={changeUserRole}
                                onRowClick={setSelectedTeacher} // 클릭 시 패널 열림
                            />
                        </SectionCard>
                    </TabsContent>

                    {/* ── 관리자 관리 ── */}
                    <TabsContent value="admins">
                        <SectionCard title="관리자 목록">
                            <UserList
                                users={admins}
                                onChangeRole={changeUserRole}
                                isReadOnly={true}
                            />
                        </SectionCard>
                    </TabsContent>

                    {/* ── 사용자 관리 ── */}
                    <TabsContent value="users">
                        <SectionCard title="사용자 목록">
                            <UserList
                                users={users}
                                onChangeRole={changeUserRole}
                            />
                        </SectionCard>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Teacher Details Slide-over Panel */}
            {selectedTeacher && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                        onClick={() => setSelectedTeacher(null)}
                    />
                    {/* Side Panel */}
                    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl z-50 border-l border-gray-200 flex flex-col animate-in slide-in-from-right-full duration-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-sm font-semibold text-gray-800">선생님 정보 수정</h2>
                            <button
                                onClick={() => setSelectedTeacher(null)}
                                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 h-0">
                            <TeacherEditForm
                                teacher={selectedTeacher}
                                onSave={(updates) => updateTeacherInfo(selectedTeacher.id, updates)}
                                onCancel={() => setSelectedTeacher(null)}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Classroom Details Slide-over Panel */}
            {selectedClassroom && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                        onClick={() => setSelectedClassroom(null)}
                    />
                    <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl z-50 border-l border-gray-200 flex flex-col animate-in slide-in-from-right-full duration-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-sm font-semibold text-gray-800">강의실 정보 수정</h2>
                            <button
                                onClick={() => setSelectedClassroom(null)}
                                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 h-0">
                            <ClassroomEditForm
                                classroom={selectedClassroom}
                                onSave={(updates) => updateClassroom(selectedClassroom.id, updates)}
                                onCancel={() => setSelectedClassroom(null)}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Teacher Edit Form ────────────────────────────────
function TeacherEditForm({
    teacher,
    onSave,
    onCancel
}: {
    teacher: Profile,
    onSave: (data: Partial<Profile>) => void,
    onCancel: () => void
}) {
    const [name, setName] = useState(teacher.full_name || '');
    const [subject, setSubject] = useState(teacher.subject || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ full_name: name, subject });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar Preview (Read-only for now) */}
            <div className="flex flex-col items-center justify-center py-4">
                {teacher.avatar_url ? (
                    <img src={teacher.avatar_url} alt={name} className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xl font-bold text-gray-400">
                        {(name || teacher.email || '?').charAt(0).toUpperCase()}
                    </div>
                )}
                <span className="text-xs text-gray-500 mt-2">{teacher.email}</span>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">이름</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름 입력"
                    className="rounded-none h-9 text-sm"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">담당 과목</Label>
                <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="예: 피아노, 보컬 등"
                    className="rounded-none h-9 text-sm"
                />
            </div>

            <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-none text-sm h-9">
                    취소
                </Button>
                <Button type="submit" className="flex-1 rounded-none text-sm h-9 bg-gray-900 hover:bg-gray-700">
                    저장
                </Button>
            </div>
        </form>
    );
}

// ── Classroom Edit Form ────────────────────────────────
function ClassroomEditForm({
    classroom,
    onSave,
    onCancel
}: {
    classroom: Classroom,
    onSave: (data: Partial<Classroom>) => void,
    onCancel: () => void
}) {
    const [floor, setFloor] = useState(classroom.floor || '');
    const [name, setName] = useState(classroom.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ floor, name });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">층</Label>
                <Input
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="예: 3층"
                    className="rounded-none h-9 text-sm"
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">이름</Label>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 피아노실"
                    className="rounded-none h-9 text-sm"
                />
            </div>

            <div className="pt-4 flex gap-2">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1 rounded-none text-sm h-9">
                    취소
                </Button>
                <Button type="submit" className="flex-1 rounded-none text-sm h-9 bg-gray-900 hover:bg-gray-700">
                    저장
                </Button>
            </div>
        </form>
    );
}

// ── Helper Components ─────────────────────────────────
function UserList({
    users,
    onDelete,
    onChangeRole,
    isReadOnly = false,
    onRowClick,
}: {
    users: Profile[],
    onDelete?: (id: string) => void,
    onChangeRole: (id: string, role: 'admin' | 'teacher' | 'user') => void,
    isReadOnly?: boolean,
    onRowClick?: (user: Profile) => void,
}) {
    if (users.length === 0) {
        return <p className="text-sm text-gray-400 py-4 text-center">목록이 비어있습니다.</p>;
    }

    return (
        <div className="divide-y divide-gray-100">
            {users.map((u) => (
                <div
                    key={u.id}
                    className={`flex items-center gap-3 py-3 last:pb-0 first:pt-0 ${onRowClick ? 'cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors' : ''}`}
                    onClick={(e) => {
                        // Select나 버튼 클릭 시에는 Row 클릭 이벤트를 막기 위해
                        const target = e.target as HTMLElement;
                        if (!target.closest('button') && !target.closest('.lucide-trash') && onRowClick) {
                            onRowClick(u);
                        }
                    }}
                >
                    {/* Avatar */}
                    {u.avatar_url ? (
                        <img
                            src={u.avatar_url}
                            alt={u.full_name}
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                            {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                                {u.full_name || '이름 없음'}
                            </span>
                            {u.subject && (
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 text-gray-500 rounded">
                                    {u.subject}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                            {u.email}
                        </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {isReadOnly ? (
                            <span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-2 py-1 bg-gray-50 uppercase tracking-tighter">
                                {u.role === 'admin' ? '관리자' : u.role}
                            </span>
                        ) : (
                            <Select
                                value={u.role}
                                onValueChange={(v) => onChangeRole(u.id, v as any)}
                            >
                                <SelectTrigger className="rounded-none h-7 w-24 text-[10px] font-medium border-gray-200 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    <SelectItem value="user" className="text-xs">일반 사용자</SelectItem>
                                    <SelectItem value="teacher" className="text-xs">선생님</SelectItem>
                                    <SelectItem value="admin" className="text-xs">관리자</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(u.id)}
                                className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                title="삭제"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

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
