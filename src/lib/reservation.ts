/**
 * 예약의 "공실 여부"를 판별합니다 (Lazy Check).
 * 수업 시작 후 15분이 지났는데 체크인이 없으면 공실로 간주합니다.
 */
export function isVacant(reservation: {
    date: string;
    start_time: string;
    checked_in_at: string | null;
    status: string;
}): boolean {
    if (reservation.status !== 'approved') return true; // 승인 안됐으면 공실
    if (reservation.checked_in_at) return false; // 체크인 했으면 공실 아님

    const start = new Date(`${reservation.date}T${reservation.start_time}`);
    const cutoff = new Date(start.getTime() + 15 * 60 * 1000); // +15분
    return new Date() > cutoff;
}

/**
 * HH:mm 형식의 1시간 단위 타임슬롯 배열을 생성합니다.
 * @param startTime '09:00' format
 * @param endTime '22:00' format
 */
export function generateTimeSlots(
    startTime = '09:00',
    endTime = '22:00'
): string[] {
    const slots: string[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let currentH = startH;
    let currentM = startM;

    while (currentH < endH || (currentH === endH && currentM < endM)) {
        slots.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`);

        // 1시간 단위로 변경
        currentH += 1;
    }
    return slots;
}

/**
 * 2주치(이번 주 + 다음 주) 날짜 배열을 반환합니다.
 */
export function getTwoWeekDates(): Date[] {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일요일
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    const dates: Date[] = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/**
 * Date를 YYYY-MM-DD 문자열로 변환합니다.
 */
export function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * YYYY-MM-DD & HH:mm 조합이 과거인지 확인합니다.
 */
export function isPastTime(date: string, time: string): boolean {
    return new Date(`${date}T${time}`) < new Date();
}
