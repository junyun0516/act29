'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import TimetableGrid from '@/components/TimetableGrid';
import ReservationDialog from '@/components/ReservationDialog';
import { Classroom, Profile, Reservation, Lesson } from '@/types';
import { toDateString } from '@/lib/reservation';
import { toast } from 'sonner';
import Link from 'next/link';
import { LogIn, LogOut, Settings } from 'lucide-react';

export default function HomePage() {
  const supabase = createClient();
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInit, setDialogInit] = useState<{
    classroomId?: string;
    startTime?: string;
  }>({});

  // ── 초기 로드 ──────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      // 현재 유저
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('lesson_profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(profile ?? null);
      }

      // 강의실
      const { data: cls } = await supabase
        .from('lesson_classrooms')
        .select('*')
        .eq('is_active', true)
        .order('floor');
      setClassrooms(cls ?? []);

      // 수업 (선생님 소유)
      if (user) {
        const { data: lsn } = await supabase
          .from('lesson_lessons')
          .select('*, teacher:lesson_profiles(full_name)')
          .eq('teacher_id', user.id);
        setLessons(lsn ?? []);
      }
    };
    init();
  }, []);

  // ── 날짜별 예약 조회 ───────────────────────────────
  const fetchReservations = useCallback(async (date: string) => {
    const { data } = await supabase
      .from('lesson_reservations')
      .select(`
        *,
        teacher:lesson_profiles(full_name),
        lesson:lesson_lessons(title),
        classroom:lesson_classrooms(name, floor, room_number)
      `)
      .eq('date', date)
      .in('status', ['pending', 'approved']);
    setReservations(data ?? []);
  }, []);

  useEffect(() => {
    fetchReservations(selectedDate);
  }, [selectedDate, fetchReservations]);

  // ── 예약 신청 ──────────────────────────────────────
  const handleBook = async (data: {
    lessonId: string;
    classroomId: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!currentUser) return;
    const { error } = await supabase.from('lesson_reservations').insert({
      classroom_id: data.classroomId,
      lesson_id: data.lessonId,
      teacher_id: currentUser.id,
      date: selectedDate,
      start_time: data.startTime,
      end_time: data.endTime,
      status: 'pending',
      checked_in_at: null,
    });
    if (error) {
      toast.error('예약 신청 중 오류가 발생했습니다.');
    } else {
      toast.success('예약이 신청되었습니다. 관리자 승인을 기다려주세요.');
      fetchReservations(selectedDate);
    }
  };

  // ── 취소 ───────────────────────────────────────────
  const handleCancel = async (reservationId: string) => {
    const { error } = await supabase
      .from('lesson_reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId);
    if (error) {
      toast.error('취소 중 오류가 발생했습니다.');
    } else {
      toast.success('예약이 취소되었습니다.');
      fetchReservations(selectedDate);
    }
  };

  // ── 체크인 ─────────────────────────────────────────
  const handleCheckIn = async (reservationId: string) => {
    const { error } = await supabase
      .from('lesson_reservations')
      .update({ checked_in_at: new Date().toISOString() })
      .eq('id', reservationId);
    if (error) {
      toast.error('체크인 중 오류가 발생했습니다.');
    } else {
      toast.success('체크인 완료!');
      fetchReservations(selectedDate);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    toast.success('로그아웃 되었습니다.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-sm font-bold tracking-tight text-gray-900">
            Act29 레슨실
          </span>
          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2 py-1 transition-colors"
              >
                <Settings size={12} />
                관리
              </Link>
            )}
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border border-gray-200 px-2 py-1 transition-colors"
              >
                <LogOut size={12} />
                로그아웃
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1 text-xs text-gray-700 bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-700 transition-colors"
              >
                <LogIn size={12} />
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2-week calendar strip */}
      <WeeklyCalendar
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      {/* Timetable */}
      <main className="flex-1 max-w-6xl w-full mx-auto">
        {classrooms.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            등록된 강의실이 없습니다.
          </div>
        ) : (
          <TimetableGrid
            date={selectedDate}
            classrooms={classrooms}
            reservations={reservations}
            currentUser={currentUser}
            onBook={(classroomId, startTime) => {
              setDialogInit({ classroomId, startTime });
              setDialogOpen(true);
            }}
            onCancel={handleCancel}
            onCheckIn={handleCheckIn}
          />
        )}
      </main>

      {/* Reservation Dialog */}
      {currentUser && (
        <ReservationDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleBook}
          date={selectedDate}
          initialClassroomId={dialogInit.classroomId}
          initialStartTime={dialogInit.startTime}
          lessons={lessons}
          classrooms={classrooms}
        />
      )}
    </div>
  );
}
