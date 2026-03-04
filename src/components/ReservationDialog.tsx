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
import { Lesson, Classroom } from '@/types';
import { generateTimeSlots } from '@/lib/reservation';

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: {
        lessonId: string;
        classroomId: string;
        startTime: string;
        endTime: string;
    }) => Promise<void>;
    date: string;
    initialClassroomId?: string;
    initialStartTime?: string;
    lessons: Lesson[];
    classrooms: Classroom[];
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
}: Props) {
    const slots = generateTimeSlots(9, 22);

    const [lessonId, setLessonId] = useState(lessons[0]?.id ?? '');
    const [classroomId, setClassroomId] = useState(initialClassroomId ?? '');
    const [startTime, setStartTime] = useState(initialStartTime ?? slots[0]);
    const [endTime, setEndTime] = useState('');
    const [loading, setLoading] = useState(false);

    // 종료 시간 options: 시작 시간 이후 30분 단위
    const endSlots = slots.filter((s) => s > startTime);

    const handleSubmit = async () => {
        if (!lessonId || !classroomId || !startTime || !endTime) return;
        setLoading(true);
        await onSubmit({ lessonId, classroomId, startTime, endTime });
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
                    {/* 수업 선택 */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-700">수업</Label>
                        <Select value={lessonId} onValueChange={setLessonId}>
                            <SelectTrigger className="rounded-none h-9 text-sm">
                                <SelectValue placeholder="수업을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                                {lessons.map((l) => (
                                    <SelectItem key={l.id} value={l.id} className="text-sm">
                                        {l.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

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
