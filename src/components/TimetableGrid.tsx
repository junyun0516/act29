'use client';

import { Reservation, Classroom, Profile, OperatingHours, RecurringSchedule } from '@/types';
import { generateTimeSlots, isVacant, isPastTime } from '@/lib/reservation';
import { cn } from '@/lib/utils';
import { Ban, Repeat, X } from 'lucide-react';

interface Props {
    date: string;
    classrooms: Classroom[];
    reservations: Reservation[];
    recurringSchedules: RecurringSchedule[];
    currentUser: Profile | null;
    operatingHours?: OperatingHours;
    onBook: (classroomId: string, startTime: string) => void;
    onCancel: (reservationId: string) => void;
    onCheckIn: (reservationId: string) => void;
    onBlock: (classroomId: string, startTime: string) => void;
    onUnblock: (reservationId: string) => void;
    onToggleRecurring: (classroomId: string, startTime: string, reservation?: Reservation, recurring?: RecurringSchedule) => void;
}

export default function TimetableGrid({
    date,
    classrooms,
    reservations,
    recurringSchedules,
    currentUser,
    operatingHours,
    onBook,
    onCancel,
    onCheckIn,
    onBlock,
    onUnblock,
    onToggleRecurring,
}: Props) {
    if (operatingHours?.is_closed) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-200">
                <span className="text-sm font-bold text-gray-900 mb-1">오늘은 휴무입니다.</span>
                <span className="text-xs text-gray-400">관리자가 설정한 운영 시간을 확인해 주세요.</span>
            </div>
        );
    }

    const start = operatingHours?.open_time.slice(0, 5) || '09:00';
    const end = operatingHours?.close_time.slice(0, 5) || '22:00';
    const slots = generateTimeSlots(start, end);

    const isAdmin = currentUser?.role === 'admin';
    const dayOfWeek = new Date(date).getDay();

    // (classroomId, start_time) → Reservation
    const reservationMap = new Map<string, Reservation>();
    for (const r of reservations) {
        reservationMap.set(`${r.classroom_id}__${r.start_time}`, r);
    }

    // (classroomId, start_time) → RecurringSchedule (해당 요일만)
    const recurringMap = new Map<string, RecurringSchedule>();
    for (const rs of recurringSchedules) {
        if (rs.day_of_week === dayOfWeek) {
            recurringMap.set(`${rs.classroom_id}__${rs.start_time.slice(0, 5)}`, rs);
        }
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 text-left min-w-[5rem]">
                            시간
                            {isAdmin && <span className="ml-1 text-blue-500" title="관리자 권한 활성화됨">*</span>}
                        </th>
                        {classrooms.map((cls) => (
                            <th
                                key={cls.id}
                                className="border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 text-center whitespace-nowrap min-w-[9rem]"
                            >
                                {cls.name}
                                <span className="ml-1 text-gray-400 font-normal text-[10px]">
                                    {cls.floor}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map((slot) => (
                        <tr key={slot}>
                            <td className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">
                                {slot}
                            </td>
                            {classrooms.map((cls) => {
                                const key = `${cls.id}__${slot}`;
                                const reservation = reservationMap.get(key);
                                const recurring = recurringMap.get(key);
                                const vacant =
                                    reservation && isVacant({
                                        date,
                                        start_time: reservation.start_time,
                                        checked_in_at: reservation.checked_in_at,
                                        status: reservation.status,
                                    });

                                const isOwner = reservation?.teacher_id === currentUser?.id;
                                const past = isPastTime(date, slot);
                                const canBook =
                                    currentUser?.role === 'teacher' ||
                                    currentUser?.role === 'admin';

                                // ── Blocked (N/A) ──
                                if (reservation?.status === 'blocked') {
                                    return (
                                        <td
                                            key={key}
                                            className="border border-gray-200 p-0 relative"
                                            style={{
                                                background: 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 6px, #e5e7eb 6px, #e5e7eb 12px)',
                                            }}
                                        >
                                            <div className="group w-full h-full min-h-[3rem] px-2 py-1.5 flex flex-col justify-center relative">
                                                <div className="absolute inset-0 flex items-center justify-center opacity-60">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-white/50 px-1 rounded">N/A</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5 z-10">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onUnblock(reservation.id); }}
                                                            className="p-1 bg-white border border-gray-200 rounded text-gray-500 hover:text-red-600 hover:border-red-300 shadow-sm transition-colors cursor-pointer"
                                                            title="차단 해제"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                }

                                // ── 예약 있고 유효(공실 아님) ──
                                if (reservation && !vacant) {
                                    const now = new Date();
                                    const startTime = new Date(`${date}T${reservation.start_time}`);
                                    const canCheckIn =
                                        isOwner &&
                                        !reservation.checked_in_at &&
                                        reservation.status === 'approved' &&
                                        now >= startTime &&
                                        now <= new Date(startTime.getTime() + 15 * 60 * 1000);

                                    const hasRecurring = !!recurring;

                                    return (
                                        <td
                                            key={key}
                                            className={cn(
                                                'border border-gray-200 p-0',
                                                reservation.checked_in_at
                                                    ? 'bg-green-50'
                                                    : 'bg-gray-100'
                                            )}
                                        >
                                            <div className="group w-full h-full min-h-[3rem] px-2 py-1.5 flex flex-col justify-center relative">
                                                <div className="flex flex-col gap-0.5 z-0">
                                                    <span className="text-xs font-semibold text-gray-800 truncate pr-6">
                                                        {reservation.teacher?.full_name ?? '선생님'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 truncate pr-6">
                                                        {reservation.lesson?.title ?? '수업'}
                                                    </span>
                                                    <div className="flex gap-1 flex-wrap mt-0.5">
                                                        {hasRecurring && (
                                                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1">
                                                                반복
                                                            </span>
                                                        )}
                                                        {reservation.checked_in_at && (
                                                            <span className="text-[10px] bg-green-200 text-green-800 px-1">
                                                                체크인
                                                            </span>
                                                        )}
                                                        {canCheckIn && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onCheckIn(reservation.id); }}
                                                                className="text-[10px] bg-gray-900 text-white px-1.5 py-0.5 hover:bg-gray-700 transition-colors"
                                                            >
                                                                체크인
                                                            </button>
                                                        )}
                                                        {(isOwner || isAdmin) && !reservation.checked_in_at && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onCancel(reservation.id); }}
                                                                className="text-[10px] bg-white border border-gray-300 text-gray-600 px-1.5 py-0.5 hover:bg-gray-100 transition-colors"
                                                            >
                                                                취소
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Admin hover actions */}
                                                {isAdmin && (
                                                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5 z-10">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onToggleRecurring(cls.id, slot, reservation, recurring); }}
                                                            className={cn(
                                                                'p-1 bg-white border rounded shadow-sm transition-colors cursor-pointer',
                                                                hasRecurring
                                                                    ? 'text-blue-600 border-blue-200 hover:text-red-600 hover:border-red-300'
                                                                    : 'text-gray-400 border-gray-200 hover:text-blue-600 hover:border-blue-300'
                                                            )}
                                                            title={hasRecurring ? '반복 해제' : '매주 반복'}
                                                        >
                                                            <Repeat size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                }

                                // ── 반복 스케줄만 있는 경우 (특정 날짜 예약 없음) ──
                                if (recurring && !reservation) {
                                    return (
                                        <td
                                            key={key}
                                            className="border border-gray-200 p-0 bg-blue-50/50"
                                        >
                                            <div className="group w-full h-full min-h-[3rem] px-2 py-1.5 flex flex-col justify-center relative">
                                                <div className="flex flex-col gap-0.5 z-0">
                                                    <span className="text-xs font-semibold text-gray-700 truncate pr-6">
                                                        {recurring.teacher?.full_name ?? '선생님'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 truncate pr-6">
                                                        {recurring.lesson?.title ?? '수업'}
                                                    </span>
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1 w-fit">
                                                        반복
                                                    </span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5 z-10">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onToggleRecurring(cls.id, slot, undefined, recurring); }}
                                                            className="p-1 bg-white border border-blue-200 rounded text-blue-600 hover:text-red-600 hover:border-red-300 shadow-sm transition-colors cursor-pointer"
                                                            title="반복 해제"
                                                        >
                                                            <Repeat size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                }

                                // ── 공실 or 빈 슬롯 ──
                                const allowAdminInPast = isAdmin; // 관리자는 과거라도 예약/차단 버튼 표시
                                return (
                                    <td
                                        key={key}
                                        className="border border-gray-200 p-0 bg-white"
                                    >
                                        <div className="group w-full h-full min-h-[3rem] p-1 flex items-center justify-center relative">
                                            {canBook && (!past || allowAdminInPast) ? (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onBook(cls.id, slot); }}
                                                        className="w-full h-full text-xs text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-dashed border-transparent hover:border-gray-300 min-h-[2rem]"
                                                    >
                                                        +
                                                    </button>
                                                    {/* Admin: hover block button */}
                                                    {isAdmin && (
                                                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5 z-10 pointer-events-auto">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onBlock(cls.id, slot); }}
                                                                className="p-1 bg-white border border-gray-200 rounded text-gray-400 hover:text-red-500 hover:border-red-300 shadow-sm transition-colors cursor-pointer"
                                                                title="사용 불가(N/A) 설정"
                                                            >
                                                                <Ban size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : vacant && reservation ? (
                                                <span className="text-[10px] text-gray-400">공실</span>
                                            ) : null}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
