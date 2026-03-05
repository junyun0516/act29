// -------------------------------------------
// 레슨실 예약 시스템 공통 TypeScript 타입 정의
// -------------------------------------------

export type Role = 'admin' | 'teacher' | 'user';

export type Profile = {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string | null; // 프로필 이미지 URL
    role: Role;
    subject: string | null; // 담당 과목
    created_at: string;
};

export type Classroom = {
    id: string;
    floor: string;      // 층 (예: "3층")
    name: string;        // 이름 (예: "피아노실")
    is_active: boolean;
    created_at: string;
};

export type Lesson = {
    id: string;
    title: string;
    teacher_id: string;
    student_count: number;
    created_at: string;
    // joined
    teacher?: Profile;
};

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'blocked';

export type Reservation = {
    id: string;
    classroom_id: string;
    lesson_id: string | null;
    teacher_id: string;
    date: string;           // YYYY-MM-DD
    start_time: string;     // HH:mm
    end_time: string;       // HH:mm
    status: ReservationStatus;
    checked_in_at: string | null;
    created_at: string;
    // joined
    classroom?: Classroom;
    lesson?: Lesson;
    teacher?: Profile;
};

export type Invitation = {
    id: string;
    token: string;
    email: string | null;
    role: Role;
    used: boolean;
    expires_at: string;
    created_at: string;
};

export type OperatingHours = {
    id: string;
    day_of_week: number;   // 0 (일) ~ 6 (토)
    open_time: string;     // HH:mm (or HH:mm:ss)
    close_time: string;    // HH:mm (or HH:mm:ss)
    is_closed: boolean;
    created_at: string;
    updated_at: string;
};

export type RecurringSchedule = {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    classroom_id: string;
    teacher_id: string;
    lesson_id: string | null;
    created_at: string;
    updated_at: string;
    // 관계 데이터 (조인용)
    teacher?: { full_name: string; subject: string | null };
    lesson?: { title: string };
};

// 타임슬롯 – UI에서 사용
export type TimeSlot = {
    time: string; // HH:mm (30분 단위)
    reservation: Reservation | null;
    // 체크인 없이 15분 경과한 경우 공실로 간주
    isVacant: boolean;
};
