-- ===========================================================
-- Act29 레슨실 예약 시스템 - Supabase SQL Schema
-- qt-guru 프로젝트 공용 사용 (lesson_ prefix)
-- ===========================================================

-- 기존 테이블 삭제 (초기화용, 주의해서 사용)
DROP TABLE IF EXISTS lesson_reservations CASCADE;
DROP TABLE IF EXISTS lesson_lessons CASCADE;
DROP TABLE IF EXISTS lesson_classrooms CASCADE;
DROP TABLE IF EXISTS lesson_invitations CASCADE;
DROP TABLE IF EXISTS lesson_profiles CASCADE;

-- 1. 프로필 (선생님 / 관리자)
CREATE TABLE lesson_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'teacher', 'admin')),
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "본인 또는 관리자만 조회" ON lesson_profiles
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "본인만 수정" ON lesson_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. 강의실
CREATE TABLE lesson_classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor       TEXT NOT NULL,
  room_number TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "전체 조회 허용" ON lesson_classrooms
  FOR SELECT USING (TRUE);
CREATE POLICY "관리자만 수정" ON lesson_classrooms
  FOR ALL USING (EXISTS (
    SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 3. 수업 (강의)
CREATE TABLE lesson_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  teacher_id    UUID NOT NULL REFERENCES lesson_profiles(id) ON DELETE CASCADE,
  student_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "전체 조회 허용" ON lesson_lessons
  FOR SELECT USING (TRUE);
CREATE POLICY "선생님 본인 또는 관리자" ON lesson_lessons
  FOR ALL USING (
    auth.uid() = teacher_id OR
    EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. 예약
CREATE TABLE lesson_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id    UUID NOT NULL REFERENCES lesson_classrooms(id) ON DELETE CASCADE,
  lesson_id       UUID NOT NULL REFERENCES lesson_lessons(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES lesson_profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  checked_in_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_reservations ENABLE ROW LEVEL SECURITY;
-- 전체 조회 허용 (비로그인도 조회 가능)
CREATE POLICY "전체 조회 허용" ON lesson_reservations
  FOR SELECT USING (TRUE);
-- 예약 신청은 로그인 사용자만
CREATE POLICY "로그인 사용자만 예약" ON lesson_reservations
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);
-- 취소/체크인은 본인 또는 관리자
CREATE POLICY "본인 또는 관리자 수정" ON lesson_reservations
  FOR UPDATE USING (
    auth.uid() = teacher_id OR
    EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. 초대 토큰
CREATE TABLE lesson_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_invitations ENABLE ROW LEVEL SECURITY;
-- 관리자만 조회/발급
CREATE POLICY "관리자만 관리" ON lesson_invitations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'
  ));
-- auth callback에서 service role로 처리하므로 service role 정책은 별도 불필요

-- ===========================================================
-- ※ 최초 관리자 계정 등록 방법:
-- 1. 카카오 로그인 후 생성된 auth.users ID를 확인
-- 2. 아래 SQL을 수동 실행:
--    INSERT INTO lesson_profiles (id, email, full_name, role)
--    VALUES ('<user_id>', '<email>', '관리자 이름', 'admin');
-- ===========================================================
