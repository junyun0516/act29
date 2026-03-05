-- ===========================================================
-- Act29 레슨실 예약 시스템 - 통합 마이그레이션
-- schema.sql 이후의 모든 변경 사항을 하나로 통합
-- 이미 실행된 항목이 있어도 안전하게 재실행 가능 (멱등성)
-- ===========================================================

-- ===========================================================
-- 1. 프로필 테이블 수정
-- ===========================================================

-- avatar_url 컬럼 추가
ALTER TABLE lesson_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 관리자가 다른 사용자의 프로필(역할 등)을 수정할 수 있도록 정책 추가
DROP POLICY IF EXISTS "관리자 전용 업데이트 허용" ON public.lesson_profiles;
CREATE POLICY "관리자 전용 업데이트 허용" ON public.lesson_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- avatar_url도 저장하도록 트리거 함수 업데이트
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

  INSERT INTO public.lesson_profiles (id, email, full_name, avatar_url, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      COALESCE(new.raw_user_meta_data->>'name', '')
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    assigned_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN (lesson_profiles.full_name IS NULL OR lesson_profiles.full_name = '') THEN EXCLUDED.full_name ELSE lesson_profiles.full_name END,
    avatar_url = CASE WHEN (lesson_profiles.avatar_url IS NULL) THEN EXCLUDED.avatar_url ELSE lesson_profiles.avatar_url END,
    role = CASE WHEN (lesson_profiles.role = 'user' OR lesson_profiles.role IS NULL) THEN EXCLUDED.role ELSE lesson_profiles.role END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================
-- 2. 예약 테이블 수정 (선착순 + 차단 지원)
-- ===========================================================

-- 선착순: status 기본값을 approved로 변경
ALTER TABLE public.lesson_reservations ALTER COLUMN status SET DEFAULT 'approved';

-- status 제약 조건 업데이트 (blocked 추가)
ALTER TABLE public.lesson_reservations DROP CONSTRAINT IF EXISTS lesson_reservations_status_check;
ALTER TABLE public.lesson_reservations ADD CONSTRAINT lesson_reservations_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'blocked'));

-- 중복 예약 방지 유니크 제약 조건 (동일 강의실+날짜+시간)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lesson_reservations_room_date_time_unique'
  ) THEN
    ALTER TABLE public.lesson_reservations ADD CONSTRAINT lesson_reservations_room_date_time_unique 
      UNIQUE (classroom_id, date, start_time);
  END IF;
END $$;

-- N/A (차단) 처리를 위해 lesson_id를 NULL 허용으로 변경
ALTER TABLE public.lesson_reservations ALTER COLUMN lesson_id DROP NOT NULL;

-- 관리자가 다른 선생님 명의로 예약 삽입 가능하도록 INSERT 정책 추가
DROP POLICY IF EXISTS "관리자 예약 대리 등록" ON public.lesson_reservations;
CREATE POLICY "관리자 예약 대리 등록" ON public.lesson_reservations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 관리자가 예약 삭제 가능하도록 (차단 해제용)
DROP POLICY IF EXISTS "관리자 예약 삭제" ON public.lesson_reservations;
CREATE POLICY "관리자 예약 삭제" ON public.lesson_reservations
  FOR DELETE USING (
    auth.uid() = teacher_id OR
    EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===========================================================
-- 3. 운영 시간 테이블 생성
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.lesson_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INT NOT NULL,  -- 0 (일) ~ 6 (토)
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '22:00',
    is_closed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(day_of_week)
);

ALTER TABLE public.lesson_operating_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view operating hours" ON public.lesson_operating_hours;
CREATE POLICY "Anyone can view operating hours" ON public.lesson_operating_hours FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update operating hours" ON public.lesson_operating_hours;
CREATE POLICY "Admins can update operating hours" ON public.lesson_operating_hours FOR ALL 
USING (EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'));

-- 기본 데이터 (일~토)
INSERT INTO public.lesson_operating_hours (day_of_week, open_time, close_time, is_closed)
VALUES 
    (0, '08:00', '22:00', false),
    (1, '09:00', '22:00', false),
    (2, '09:00', '22:00', false),
    (3, '09:00', '22:00', false),
    (4, '09:00', '22:00', false),
    (5, '09:00', '22:00', false),
    (6, '08:00', '22:00', false)
ON CONFLICT (day_of_week) DO NOTHING;

-- ===========================================================
-- 4. 반복 스케줄 테이블 생성
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.lesson_recurring_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week   INT NOT NULL,  -- 0 (일) ~ 6 (토)
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    classroom_id  UUID NOT NULL REFERENCES lesson_classrooms(id) ON DELETE CASCADE,
    teacher_id    UUID NOT NULL REFERENCES lesson_profiles(id) ON DELETE CASCADE,
    lesson_id     UUID REFERENCES lesson_lessons(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(day_of_week, start_time, classroom_id)
);

ALTER TABLE public.lesson_recurring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view recurring schedules" ON public.lesson_recurring_schedules;
CREATE POLICY "Anyone can view recurring schedules" ON public.lesson_recurring_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage recurring schedules" ON public.lesson_recurring_schedules;
CREATE POLICY "Admins can manage recurring schedules" ON public.lesson_recurring_schedules FOR ALL 
USING (EXISTS (SELECT 1 FROM lesson_profiles WHERE id = auth.uid() AND role = 'admin'));
