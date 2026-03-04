-- ===========================================================
-- 00000000000000_initial_schema.sql
-- ===========================================================

-- 1. 프로필 (선생님 / 관리자 / 일반 유저)
CREATE TABLE IF NOT EXISTS lesson_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'teacher', 'admin')),
  subject     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '전체 조회 허용' AND tablename = 'lesson_profiles') THEN
    CREATE POLICY "전체 조회 허용" ON lesson_profiles FOR SELECT USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '본인만 수정' AND tablename = 'lesson_profiles') THEN
    CREATE POLICY "본인만 수정" ON lesson_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- 2. 강의실
CREATE TABLE IF NOT EXISTS lesson_classrooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor       TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_classrooms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '전체 조회 허용' AND tablename = 'lesson_classrooms') THEN
    CREATE POLICY "전체 조회 허용" ON lesson_classrooms FOR SELECT USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '관리자만 수정' AND tablename = 'lesson_classrooms') THEN
    CREATE POLICY "관리자만 수정" ON lesson_classrooms FOR ALL USING (EXISTS (
      SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'
    ));
  END IF;
END $$;

-- 3. 수업 (강의)
CREATE TABLE IF NOT EXISTS lesson_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  teacher_id    UUID NOT NULL REFERENCES lesson_profiles(id) ON DELETE CASCADE,
  student_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_lessons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '전체 조회 허용' AND tablename = 'lesson_lessons') THEN
    CREATE POLICY "전체 조회 허용" ON lesson_lessons FOR SELECT USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '선생님 본인 또는 관리자' AND tablename = 'lesson_lessons') THEN
    CREATE POLICY "선생님 본인 또는 관리자" ON lesson_lessons FOR ALL USING (
      auth.uid() = teacher_id OR
      EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- 4. 예약
CREATE TABLE IF NOT EXISTS lesson_reservations (
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '전체 조회 허용' AND tablename = 'lesson_reservations') THEN
    CREATE POLICY "전체 조회 허용" ON lesson_reservations FOR SELECT USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '로그인 사용자만 예약' AND tablename = 'lesson_reservations') THEN
    CREATE POLICY "로그인 사용자만 예약" ON lesson_reservations FOR INSERT WITH CHECK (auth.uid() = teacher_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '본인 또는 관리자 수정' AND tablename = 'lesson_reservations') THEN
    CREATE POLICY "본인 또는 관리자 수정" ON lesson_reservations FOR UPDATE USING (
      auth.uid() = teacher_id OR
      EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- 5. 초대 토큰
CREATE TABLE IF NOT EXISTS lesson_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lesson_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '관리자만 관리' AND tablename = 'lesson_invitations') THEN
    CREATE POLICY "관리자만 관리" ON lesson_invitations FOR ALL USING (EXISTS (
      SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'
    ));
  END IF;
END $$;

-- 6. 신규 가입 시 프로필 자동 생성 및 초대 토큰 처리 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  assigned_role TEXT := 'user';
  invitation_role TEXT;
  token_val TEXT;
BEGIN
  token_val := new.raw_user_meta_data->>'token';
  
  IF token_val IS NOT NULL THEN
    SELECT role INTO invitation_role 
    FROM public.lesson_invitations 
    WHERE token = token_val AND used = false AND expires_at > now()
    LIMIT 1;
    
    IF invitation_role IS NOT NULL THEN
      assigned_role := invitation_role;
      UPDATE public.lesson_invitations SET used = true WHERE token = token_val;
    END IF;
  END IF;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
