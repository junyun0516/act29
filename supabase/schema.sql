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

-- 1. 프로필 (선생님 / 관리자 / 일반 유저)
CREATE TABLE lesson_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'teacher', 'admin')),
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_profiles ENABLE ROW LEVEL SECURITY;

-- 무한 재귀 에러(500) 방지를 위해 정책 분리
CREATE POLICY "전체 조회 허용" ON lesson_profiles
  FOR SELECT USING (TRUE); -- 모든 사용자의 기본 정보 조회를 허용 (성함 등)

CREATE POLICY "본인만 수정" ON lesson_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. 강의실
CREATE TABLE lesson_classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor       TEXT NOT NULL,
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

-- ===========================================================
-- 6. 초기 데이터 (강의실 등)
-- 필요 시 수동으로 추가

-- 7. 신규 가입 시 프로필 자동 생성 및 초대 토큰 처리 트리거
-- OAuth 및 이메일 가입 시 lesson_profiles 테이블에 자동으로 정보를 입력하고, 초대 토큰이 있다면 즉시 역할을 부여합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role TEXT := 'user';
  invitation_role TEXT;
  token_val TEXT;
BEGIN
  -- 1. 메타데이터에서 초대 토큰 추출
  token_val := new.raw_user_meta_data->>'token';
  
  -- 2. 토큰이 있는 경우 초대장 테이블 확인
  IF token_val IS NOT NULL THEN
    SELECT role INTO invitation_role 
    FROM public.lesson_invitations 
    WHERE token = token_val AND used = false AND expires_at > now()
    LIMIT 1;
    
    -- 유효한 토큰인 경우 역할 할당 및 사용 처리
    IF invitation_role IS NOT NULL THEN
      assigned_role := invitation_role;
      UPDATE public.lesson_invitations SET used = true WHERE token = token_val;
    END IF;
  END IF;

  -- 3. 프로필 생성 (이미 있으면 업데이트)
  INSERT INTO public.lesson_profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      COALESCE(new.raw_user_meta_data->>'name', '')
    ), 
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN (lesson_profiles.full_name IS NULL OR lesson_profiles.full_name = '') THEN EXCLUDED.full_name ELSE lesson_profiles.full_name END,
    role = CASE WHEN (lesson_profiles.role = 'user' OR lesson_profiles.role IS NULL) THEN EXCLUDED.role ELSE lesson_profiles.role END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 최초 관리자 지정을 위한 팁:
-- 해당 사용자로 가입한 후, Supabase SQL Editor에서 다음을 실행하세요:
-- UPDATE lesson_profiles SET role = 'admin' WHERE email = '본인이메일';
-- ===========================================================
