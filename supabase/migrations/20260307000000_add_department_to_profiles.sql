-- ===========================================================
-- lesson_profiles 테이블에 department(소속) 컬럼 추가
-- ===========================================================

ALTER TABLE public.lesson_profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- 주석 추가 (관리용)
COMMENT ON COLUMN public.lesson_profiles.department IS '선생님 소속 (예: 오케스트라, 중등부)';
