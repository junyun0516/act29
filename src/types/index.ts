// -------------------------------------------
// 레슨실 예약 시스템 공통 TypeScript 타입 정의
// -------------------------------------------

export type Role = 'admin' | 'teacher' | 'user';

export type Profile = {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    subject: string | null; // 담당 과목
    created_at: string;
};

export type Classroom = {
    id: string;
    floor: string;      // 층 (예: "3층")
    room_number: string; // 호수 (예: "301호")
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

export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type Reservation = {
    id: string;
    classroom_id: string;
    lesson_id: string;
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

// 타임슬롯 – UI에서 사용
export type TimeSlot = {
    time: string; // HH:mm (30분 단위)
    reservation: Reservation | null;
    // 체크인 없이 15분 경과한 경우 공실로 간주
    isVacant: boolean;
};
