'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import TimetableGrid from '@/components/TimetableGrid';
import ReservationDialog from '@/components/ReservationDialog';
import { Classroom, Profile, Reservation, Lesson, OperatingHours, RecurringSchedule } from '@/types';
import { toDateString } from '@/lib/reservation';
import { toast } from 'sonner';
import Link from 'next/link';
import { LogIn, LogOut, Settings } from 'lucide-react';

export default function HomePage() {
  const supabase = createClient();
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringSchedule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [operatingHours, setOperatingHours] = useState<OperatingHours[]>([]);
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

      // 수업 (선생님 소유 또는 관리자면 전체 조회)
      if (user) {
        const { data: profileData } = await supabase
          .from('lesson_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileData?.role === 'admin') {
          // 관리자: 모든 수업 조회
          const { data: lsn } = await supabase
            .from('lesson_lessons')
            .select('*, teacher:lesson_profiles(full_name)');
          setLessons(lsn ?? []);
        } else {
          // 선생님: 본인 수업만
          const { data: lsn } = await supabase
            .from('lesson_lessons')
            .select('*, teacher:lesson_profiles(full_name)')
            .eq('teacher_id', user.id);
          setLessons(lsn ?? []);
        }
      }

      // 운영 시간
      const { data: hours } = await supabase
        .from('lesson_operating_hours')
        .select('*');
      setOperatingHours(hours ?? []);

      // 반복 스케줄
      const { data: recurring } = await supabase
        .from('lesson_recurring_schedules')
        .select('*, teacher:lesson_profiles(full_name), lesson:lesson_lessons(title)');
      setRecurringSchedules(recurring ?? []);

      // 선생님 목록 (관리자용)
      const { data: teacherList } = await supabase
        .from('lesson_profiles')
        .select('*')
        .in('role', ['teacher', 'admin']);
      setTeachers(teacherList ?? []);
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
        classroom:lesson_classrooms(name, floor)
      `)
      .eq('date', date)
      .in('status', ['approved', 'blocked']);
    setReservations(data ?? []);
  }, []);

  useEffect(() => {
    fetchReservations(selectedDate);
  }, [selectedDate, fetchReservations]);

  // ── 예약 신청 ──────────────────────────────────────
  const handleBook = async (data: {
    lessonId?: string;
    classroomId: string;
    startTime: string;
    endTime: string;
    teacherId?: string;
  }) => {
    if (!currentUser) return;
    const { error } = await supabase.from('lesson_reservations').insert({
      classroom_id: data.classroomId,
      lesson_id: data.lessonId || null,
      teacher_id: data.teacherId || currentUser.id,
      date: selectedDate,
      start_time: data.startTime,
      end_time: data.endTime,
    });
    if (error) {
      if (error.code === '23505') {
        toast.error('해당 시간에 이미 예약이 있습니다.');
      } else {
        toast.error('예약 중 오류가 발생했습니다.');
      }
    } else {
      toast.success('예약이 완료되었습니다!');
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

  // ── 슬롯 차단 (N/A) ────────────────────────────────
  const handleBlock = async (classroomId: string, startTime: string) => {
    if (!currentUser) return;
    const endH = parseInt(startTime.split(':')[0]);
    const endM = parseInt(startTime.split(':')[1]) + 30;
    const endTime = `${String(endM >= 60 ? endH + 1 : endH).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;

    const { error } = await supabase.from('lesson_reservations').insert({
      classroom_id: classroomId,
      teacher_id: currentUser.id,
      date: selectedDate,
      start_time: startTime,
      end_time: endTime,
      status: 'blocked',
    });
    if (error) {
      toast.error('차단 설정 중 오류가 발생했습니다.');
    } else {
      toast.success('해당 시간이 사용 불가(N/A)로 설정되었습니다.');
      fetchReservations(selectedDate);
    }
  };

  // ── 차단 해제 ──────────────────────────────────────
  const handleUnblock = async (reservationId: string) => {
    const { error } = await supabase
      .from('lesson_reservations')
      .delete()
      .eq('id', reservationId);
    if (error) {
      toast.error('차단 해제 중 오류가 발생했습니다.');
    } else {
      toast.success('차단이 해제되었습니다.');
      fetchReservations(selectedDate);
    }
  };

  // ── 반복 스케줄 토글 ───────────────────────────────
  const handleToggleRecurring = async (
    classroomId: string,
    startTime: string,
    reservation?: Reservation,
    recurring?: RecurringSchedule
  ) => {
    if (recurring) {
      // 반복 해제
      const { error } = await supabase
        .from('lesson_recurring_schedules')
        .delete()
        .eq('id', recurring.id);
      if (error) toast.error('반복 해제 실패');
      else {
        toast.success('반복 스케줄이 해제되었습니다.');
        // 반복 스케줄 다시 로드
        const { data } = await supabase
          .from('lesson_recurring_schedules')
          .select('*, teacher:lesson_profiles(full_name), lesson:lesson_lessons(title)');
        setRecurringSchedules(data ?? []);
      }
    } else if (reservation) {
      // 반복 설정: 예약 정보 기반으로 반복 스케줄 생성
      const dayOfWeek = new Date(selectedDate).getDay();
      const { error } = await supabase.from('lesson_recurring_schedules').insert({
        day_of_week: dayOfWeek,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        classroom_id: classroomId,
        teacher_id: reservation.teacher_id,
        lesson_id: reservation.lesson_id,
      });
      if (error) {
        if (error.code === '23505') {
          toast.error('이미 해당 시간에 반복 스케줄이 설정되어 있습니다.');
        } else {
          toast.error('반복 설정 실패');
        }
      } else {
        toast.success('매주 반복 스케줄이 설정되었습니다.');
        const { data } = await supabase
          .from('lesson_recurring_schedules')
          .select('*, teacher:lesson_profiles(full_name), lesson:lesson_lessons(title)');
        setRecurringSchedules(data ?? []);
      }
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
            recurringSchedules={recurringSchedules}
            currentUser={currentUser}
            operatingHours={operatingHours.find(h => h.day_of_week === (new Date(selectedDate).getDay()))}
            onBook={(classroomId, startTime) => {
              setDialogInit({ classroomId, startTime });
              setDialogOpen(true);
            }}
            onCancel={handleCancel}
            onCheckIn={handleCheckIn}
            onBlock={handleBlock}
            onUnblock={handleUnblock}
            onToggleRecurring={handleToggleRecurring}
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
          teachers={teachers}
          currentUser={currentUser}
          operatingHours={operatingHours.find(h => h.day_of_week === (new Date(selectedDate).getDay()))}
        />
      )}
    </div>
  );
}
