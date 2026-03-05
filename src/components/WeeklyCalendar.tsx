'use client';

import { getTwoWeekDates, toDateString } from '@/lib/reservation';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

interface Props {
    selectedDate: string;
    onSelect: (date: string) => void;
}

export default function WeeklyCalendar({ selectedDate, onSelect }: Props) {
    const dates = getTwoWeekDates();
    const todayStr = toDateString(new Date());

    const scrollToToday = () => {
        onSelect(todayStr);
        const el = document.getElementById(`day-${todayStr}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    return (
        <div className="border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    강의실 예약
                </span>
                <div className="flex-1" />
                <button
                    onClick={scrollToToday}
                    className="text-xs font-medium text-gray-600 border border-gray-300 px-2 py-1 hover:bg-gray-50 transition-colors"
                >
                    오늘
                </button>
            </div>
            {/* Scrollable date strip */}
            <div className="flex overflow-x-auto scrollbar-none pb-3 px-2 gap-0.5 sm:justify-center">
                {dates.map((date) => {
                    const str = toDateString(date);
                    const isSelected = str === selectedDate;
                    const isToday = str === todayStr;
                    // day of week: date.getDay() 0=Sun
                    const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
                    const dayLabel = DAY_LABELS[dayIdx];
                    const isSat = dayIdx === 5;
                    const isSun = dayIdx === 6;

                    return (
                        <button
                            key={str}
                            id={`day-${str}`}
                            onClick={() => onSelect(str)}
                            className={cn(
                                'flex flex-col items-center justify-center min-w-[3.25rem] py-2 transition-colors border',
                                isSelected
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-white border-transparent hover:bg-gray-50',
                                !isSelected && isToday && 'border-gray-400'
                            )}
                        >
                            <span
                                className={cn(
                                    'text-[10px] font-medium leading-none mb-1',
                                    isSelected
                                        ? 'text-gray-300'
                                        : isSun
                                            ? 'text-red-400'
                                            : isSat
                                                ? 'text-blue-400'
                                                : 'text-gray-400'
                                )}
                            >
                                {dayLabel}
                            </span>
                            <span className="text-sm font-semibold leading-none">
                                {date.getDate()}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
