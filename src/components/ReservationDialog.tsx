'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lesson, Classroom, OperatingHours, Profile } from '@/types';
import { generateTimeSlots } from '@/lib/reservation';

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: {
        lessonId?: string;
        classroomId: string;
        startTime: string;
        endTime: string;
        teacherId?: string;
    }) => Promise<void>;
    date: string;
    initialClassroomId?: string;
    initialStartTime?: string;
    lessons: Lesson[];
    classrooms: Classroom[];
    teachers: Profile[];
    currentUser: Profile;
    operatingHours?: OperatingHours;
}

export default function ReservationDialog({
    open,
    onClose,
    onSubmit,
    date,
    initialClassroomId,
    initialStartTime,
    lessons,
    classrooms,
    teachers,
    currentUser,
    operatingHours,
}: Props) {
    const startH = operatingHours?.open_time.slice(0, 5) || '09:00';
    const endH = operatingHours?.close_time.slice(0, 5) || '22:00';
    const slots = generateTimeSlots(startH, endH);

    const isAdmin = currentUser.role === 'admin';

    const [selectedTeacherId, setSelectedTeacherId] = useState(currentUser.id);
    const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '');
    const [classroomId, setClassroomId] = useState(initialClassroomId ?? '');
    const [startTime, setStartTime] = useState(initialStartTime ?? slots[0]);
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    // 선생님 선택 시 수업 목록 필터링
    const filteredLessons = isAdmin
        ? lessons.filter((l) => l.teacher_id === selectedTeacherId)
        : lessons;

    // 종료 시간 options: 시작 시간 이후 30분 단위
    const endSlots = slots.filter((s) => s > startTime);

    const isValid = isAdmin
        ? classroomId && startTime && endTime
        : lessonId && classroomId && startTime && endTime;

    const handleSubmit = async () => {
        if (!isValid) return;
        setLoading(true);
        await onSubmit({
            lessonId: lessonId || undefined,
            classroomId,
            startTime,
            endTime,
            teacherId: isAdmin ? selectedTeacherId : undefined,
        });
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-none">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold">
                        레슨실 예약
                    </DialogTitle>
                    <p className="text-sm text-gray-500 mt-0.5">{date}</p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* 관리자: 선생님 선택 */}
                    {isAdmin && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">선생님</Label>
                            <Select
                                value={selectedTeacherId}
                                onValueChange={(v) => {
                                    setSelectedTeacherId(v);
                                    // 선생님 변경 시 수업 초기화
                                    const teacherLessons = lessons.filter(l => l.teacher_id === v);
                                    setLessonId(teacherLessons[0]?.id ?? '');
                                }}
                            >
                                <SelectTrigger className="rounded-none h-9 text-sm">
                                    <SelectValue placeholder="선생님을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {teachers.map((t) => (
                                        <SelectItem key={t.id} value={t.id} className="text-sm">
                                            {t.full_name || t.email}
                                            {t.subject && (
                                                <span className="text-gray-400 ml-1">({t.subject})</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* 수업 선택 (관리자가 아닐 때만 표시하거나 관리자라도 선생님의 수업이 여러 개일 여지를 위해 지금은 관리자는 숨기고 자동 선택되게 처리) */}
                    {!isAdmin && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">수업</Label>
                            <Select value={lessonId} onValueChange={setLessonId}>
                                <SelectTrigger className="rounded-none h-9 text-sm">
                                    <SelectValue placeholder="수업을 선택하세요" />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {filteredLessons.map((l) => (
                                        <SelectItem key={l.id} value={l.id} className="text-sm">
                                            {l.title}
                                        </SelectItem>
                                    ))}
                                    {filteredLessons.length === 0 && (
                                        <div className="px-2 py-1.5 text-xs text-gray-400">
                                            등록된 수업이 없습니다.
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* 강의실 선택 */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-700">강의실</Label>
                        <Select value={classroomId} onValueChange={setClassroomId}>
                            <SelectTrigger className="rounded-none h-9 text-sm">
                                <SelectValue placeholder="강의실을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                                {classrooms.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-sm">
                                        {c.name}{' '}
                                        <span className="text-gray-400 text-[10px]">
                                            ({c.floor})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 시간 선택 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">
                                시작 시간
                            </Label>
                            <Select value={startTime} onValueChange={(v) => { setStartTime(v); setEndTime(''); }}>
                                <SelectTrigger className="rounded-none h-9 text-sm font-mono">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {slots.map((s) => (
                                        <SelectItem key={s} value={s} className="text-sm font-mono">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-700">
                                종료 시간
                            </Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger className="rounded-none h-9 text-sm font-mono">
                                    <SelectValue placeholder="선택" />
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {endSlots.map((s) => (
                                        <SelectItem key={s} value={s} className="text-sm font-mono">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="rounded-none text-sm h-9"
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !lessonId || !classroomId || !startTime || !endTime}
                        className="rounded-none text-sm h-9 bg-gray-900 hover:bg-gray-700"
                    >
                        {loading ? '신청 중...' : '예약 신청'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
