'use client';

import { Reservation, Classroom, Profile } from '@/types';
import { generateTimeSlots, isVacant, isPastTime } from '@/lib/reservation';
import { cn } from '@/lib/utils';

interface Props {
    date: string;
    classrooms: Classroom[];
    reservations: Reservation[];
    currentUser: Profile | null;
    onBook: (classroomId: string, startTime: string) => void;
    onCancel: (reservationId: string) => void;
    onCheckIn: (reservationId: string) => void;
}

export default function TimetableGrid({
    date,
    classrooms,
    reservations,
    currentUser,
    onBook,
    onCancel,
    onCheckIn,
}: Props) {
    const slots = generateTimeSlots(9, 22);

    // (classroomId, start_time) → Reservation
    const reservationMap = new Map<string, Reservation>();
    for (const r of reservations) {
        reservationMap.set(`${r.classroom_id}__${r.start_time}`, r);
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
                <thead>
                    <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 text-left min-w-[5rem]">
                            시간
                        </th>
                        {classrooms.map((cls) => (
                            <th
                                key={cls.id}
                                className="border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 text-center whitespace-nowrap min-w-[9rem]"
                            >
                                {cls.name}
                                <span className="ml-1 text-gray-400 font-normal">
                                    {cls.floor} {cls.room_number}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {slots.map((slot) => (
                        <tr key={slot} className="hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-3 py-2 text-xs font-mono text-gray-500 whitespace-nowrap">
                                {slot}
                            </td>
                            {classrooms.map((cls) => {
                                const key = `${cls.id}__${slot}`;
                                const reservation = reservationMap.get(key);
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

                                // 예약 있고 유효(공실 아님)
                                if (reservation && !vacant) {
                                    const now = new Date();
                                    const startTime = new Date(`${date}T${reservation.start_time}`);
                                    const canCheckIn =
                                        isOwner &&
                                        !reservation.checked_in_at &&
                                        reservation.status === 'approved' &&
                                        now >= startTime &&
                                        now <= new Date(startTime.getTime() + 15 * 60 * 1000);

                                    return (
                                        <td
                                            key={key}
                                            className={cn(
                                                'border border-gray-200 px-2 py-1.5',
                                                reservation.status === 'pending'
                                                    ? 'bg-yellow-50'
                                                    : reservation.checked_in_at
                                                        ? 'bg-green-50'
                                                        : 'bg-gray-100'
                                            )}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-gray-800 truncate">
                                                    {reservation.teacher?.full_name ?? '선생님'}
                                                </span>
                                                <span className="text-[10px] text-gray-500 truncate">
                                                    {reservation.lesson?.title ?? '수업'}
                                                </span>
                                                <div className="flex gap-1 flex-wrap mt-0.5">
                                                    {reservation.status === 'pending' && (
                                                        <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1">
                                                            승인 대기
                                                        </span>
                                                    )}
                                                    {reservation.checked_in_at && (
                                                        <span className="text-[10px] bg-green-200 text-green-800 px-1">
                                                            체크인 완료
                                                        </span>
                                                    )}
                                                    {canCheckIn && (
                                                        <button
                                                            onClick={() => onCheckIn(reservation.id)}
                                                            className="text-[10px] bg-gray-900 text-white px-1.5 py-0.5 hover:bg-gray-700 transition-colors"
                                                        >
                                                            체크인
                                                        </button>
                                                    )}
                                                    {isOwner && reservation.status !== 'approved' && (
                                                        <button
                                                            onClick={() => onCancel(reservation.id)}
                                                            className="text-[10px] bg-white border border-gray-300 text-gray-600 px-1.5 py-0.5 hover:bg-gray-100 transition-colors"
                                                        >
                                                            취소
                                                        </button>
                                                    )}
                                                    {isOwner && reservation.status === 'approved' && !reservation.checked_in_at && !canCheckIn && (
                                                        <button
                                                            onClick={() => onCancel(reservation.id)}
                                                            className="text-[10px] bg-white border border-gray-300 text-gray-600 px-1.5 py-0.5 hover:bg-gray-100 transition-colors"
                                                        >
                                                            취소
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    );
                                }

                                // 공실 or 빈 슬롯
                                return (
                                    <td
                                        key={key}
                                        className="border border-gray-200 px-2 py-1.5 bg-white"
                                    >
                                        {canBook && !past ? (
                                            <button
                                                onClick={() => onBook(cls.id, slot)}
                                                className="w-full h-full min-h-[2rem] text-xs text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-dashed border-gray-200 hover:border-gray-400"
                                            >
                                                +
                                            </button>
                                        ) : vacant && reservation ? (
                                            <span className="text-[10px] text-gray-400">공실</span>
                                        ) : null}
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
