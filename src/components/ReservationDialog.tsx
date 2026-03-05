'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
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
import { Lesson, Classroom, OperatingHours, Profile, Reservation, RecurringSchedule } from '@/types';
import { generateTimeSlots } from '@/lib/reservation';
import { X } from 'lucide-react';

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
    reservations: Reservation[];
    recurringSchedules: RecurringSchedule[];
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
    reservations,
    recurringSchedules,
}: Props) {
    const startH = operatingHours?.open_time.slice(0, 5) || '09:00';
    const endH = operatingHours?.close_time.slice(0, 5) || '22:00';
    const slots = generateTimeSlots(startH, endH);

    const isAdmin = currentUser.role === 'admin';

    const [selectedTeacherId, setSelectedTeacherId] = useState(currentUser.id);
    const [lessonId, setLessonId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            const currentTeacherId = isAdmin ? selectedTeacherId : currentUser.id;
            setSelectedTeacherId(currentTeacherId);

            const teacherLessons = lessons.filter(l => l.teacher_id === currentTeacherId);
            setLessonId(teacherLessons[0]?.id ?? '');

            const start = initialStartTime ?? slots[0];
            setStartTime(start);

            // 기본 종료 시간: 시작 시간으로부터 1시간 뒤
            // 단, 다음 예약이 있으면 그 전까지만 가능하도록 필터링된 slots 기반으로 계산
            const startIdx = slots.indexOf(start);

            // 현재 강의실의 다른 예약들 확인 (이미 예약이 있는 시간은 피함)
            const dayOfWeek = new Date(date).getDay();
            const classroomReservations = reservations.filter(r => r.classroom_id === initialClassroomId && r.status !== 'cancelled');
            const classroomRecurring = recurringSchedules.filter(rs => rs.classroom_id === initialClassroomId && rs.day_of_week === dayOfWeek);

            const occupiedTimes = [
                ...classroomReservations.map(r => r.start_time.slice(0, 5)),
                ...classroomRecurring.map(rs => rs.start_time.slice(0, 5))
            ];

            const nextOccupiedIdx = slots.findIndex((s, idx) => idx > startIdx && occupiedTimes.includes(s));
            const maxIdx = nextOccupiedIdx === -1 ? slots.length : nextOccupiedIdx;

            // 1시간 뒤를 기본값으로 함 (1시간 단위이므로 startIdx + 1)
            if (startIdx !== -1 && startIdx + 1 <= maxIdx) {
                setEndTime(slots[startIdx + 1]);
            } else {
                setEndTime('');
            }
        }
    }, [open, initialStartTime, lessons, isAdmin, currentUser.id, slots, selectedTeacherId, date, initialClassroomId, reservations, recurringSchedules]);

    const teacherLessons = lessons.filter(l => l.teacher_id === selectedTeacherId);
    const selectedClassroom = classrooms.find(c => c.id === initialClassroomId);

    // 종료 시간 options 필터링: 시작 시간 이후 ~ 다음 예약 시작 시간 전까지
    const getEndSlots = () => {
        const startIdx = slots.indexOf(startTime);
        if (startIdx === -1) return [];

        const dayOfWeek = new Date(date).getDay();
        const classroomReservations = reservations.filter(r => r.classroom_id === initialClassroomId && r.status !== 'cancelled');
        const classroomRecurring = recurringSchedules.filter(rs => rs.classroom_id === initialClassroomId && rs.day_of_week === dayOfWeek);

        const occupiedTimes = [
            ...classroomReservations.map(r => r.start_time.slice(0, 5)),
            ...classroomRecurring.map(rs => rs.start_time.slice(0, 5))
        ];

        const nextOccupiedIdx = slots.findIndex((s, idx) => idx > startIdx && occupiedTimes.includes(s));

        // 만약 10:00에 다음 수업이 있으면, 종료 시간은 10:00까지 선택 가능해야 함
        // (실제 저장 시에는 겹치지 않도록 서버나 DB에서 처리되거나, 보여줄 때만 :50으로 표시)
        const limitIdx = nextOccupiedIdx === -1 ? slots.length : nextOccupiedIdx;

        // 종료 시간 후보는 시작 시간 다음 슬롯부터 가능함
        return slots.slice(startIdx + 1, limitIdx + 1);
    };

    const endSlots = getEndSlots();

    const isValid = !!(initialClassroomId && startTime && endTime);

    const handleSubmit = async () => {
        if (!isValid || !initialClassroomId) return;
        setLoading(true);
        await onSubmit({
            lessonId: lessonId || undefined, // lessonId가 있으면 전달 (교사/관리자 공통)
            classroomId: initialClassroomId,
            startTime,
            endTime,
            teacherId: isAdmin ? selectedTeacherId : currentUser.id,
        });
        setLoading(false);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md rounded-none border-0 shadow-2xl p-0 overflow-hidden" showCloseButton={false}>
                <div className="bg-gray-900 px-6 py-4 flex items-center justify-between relative">
                    <DialogTitle className="text-sm font-bold text-white tracking-tight">
                        수업 예약 설정
                    </DialogTitle>
                    <div className="flex items-center gap-4 mr-8">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-white/10 text-white/80 rounded-sm">
                            {date}
                        </span>
                        {selectedClassroom && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500 text-white rounded-sm">
                                {selectedClassroom.name}
                            </span>
                        )}
                    </div>
                    <DialogClose asChild>
                        <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1">
                            <X size={18} />
                        </button>
                    </DialogClose>
                </div>

                <div className="p-6 space-y-6">
                    {isAdmin && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">대상 선생님</Label>
                                <Select
                                    value={selectedTeacherId}
                                    onValueChange={setSelectedTeacherId}
                                >
                                    <SelectTrigger className="rounded-none h-11 text-sm border-gray-200">
                                        <SelectValue placeholder="선생님 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none">
                                        {teachers.map((t) => (
                                            <SelectItem key={t.id} value={t.id} className="text-sm">
                                                {t.full_name || t.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* 교사/관리자: 수업 선택 (수업이 1개 이상일 때만 표시하거나, 관리자면 항상 표시) */}
                            {(teacherLessons.length > 0) && (
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">수업 선택</Label>
                                    <Select value={lessonId} onValueChange={setLessonId}>
                                        <SelectTrigger className="rounded-none h-11 text-sm border-gray-200 bg-gray-50">
                                            <SelectValue placeholder="수업 선택" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-none">
                                            {teacherLessons.map((l) => (
                                                <SelectItem key={l.id} value={l.id} className="text-sm">
                                                    {l.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 교사: 시간 선택에만 집중 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">시작 시간 (고정)</Label>
                            <Select value={startTime} disabled>
                                <SelectTrigger className="rounded-none h-11 text-sm font-mono border-gray-200 bg-gray-100 cursor-not-allowed focus:ring-0 opacity-100 text-gray-900">
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
                            <Label className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">종료 시간</Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger className="rounded-none h-11 text-sm font-mono border-gray-200 bg-gray-50 focus:ring-1 focus:ring-gray-900">
                                    <SelectValue>
                                        {endTime ? (() => {
                                            const [h, m] = endTime.split(':').map(Number);
                                            return m === 0 ? `${String(h - 1).padStart(2, '0')}:50` : `${h}:${m - 10}`;
                                        })() : '선택'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-none">
                                    {endSlots.map((s) => {
                                        const [h, m] = s.split(':').map(Number);
                                        const displayTime = m === 0 ? `${String(h - 1).padStart(2, '0')}:50` : `${h}:${m - 10}`;

                                        return (
                                            <SelectItem key={s} value={s} className="text-sm font-mono">
                                                {displayTime}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {!isAdmin && (
                        <div className="bg-blue-50/50 p-4 border border-blue-100/50">
                            <div className="flex gap-3">
                                <div className="mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[11px] font-bold text-blue-900 leading-none">예약 정보 확인</p>
                                    <p className="text-[10px] text-blue-700/80 leading-relaxed font-medium">
                                        선생님의 본인 명의로 수업이 예약됩니다. <br />
                                        다음 예약이 있는 시간까지만 선택 가능합니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-none text-[11px] font-bold h-10 text-gray-400 hover:text-gray-900 hover:bg-white px-6 transition-all"
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !startTime || !endTime}
                        className="rounded-none text-[11px] font-bold h-10 bg-gray-900 hover:bg-black text-white px-10 shadow-lg shadow-gray-200 transition-all active:scale-95"
                    >
                        {loading ? '처리 중...' : '예약 완료하기'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
