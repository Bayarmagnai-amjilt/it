// Attendance percent, the same formula as attendance_percent() in the database
// (prompt section 5). Self-contained on purpose so tests can load it directly.

export type Status = 'present' | 'late' | 'absent' | 'excused' | 'sick';
export type ExcusedPolicy = 'exclude' | 'count_present';

export type StatusCounts = Record<Status, number>;

export function emptyCounts(): StatusCounts {
  return { present: 0, late: 0, absent: 0, excused: 0, sick: 0 };
}

export function countStatuses(statuses: Iterable<Status | null | undefined>): StatusCounts {
  const counts = emptyCounts();
  for (const s of statuses) {
    if (s && s in counts) counts[s] += 1;
  }
  return counts;
}

/**
 * (present + late x coefficient) / counted lessons x 100, rounded to 2 decimals.
 * Excused and sick lessons either count as present or are left out of the total.
 * Returns null when no lesson counts yet.
 */
export function attendancePercent(counts: StatusCounts, lateCoefficient: number, policy: ExcusedPolicy): number | null {
  const excused = policy === 'count_present' ? counts.excused + counts.sick : 0;
  const counted = counts.present + counts.late + counts.absent + excused;
  if (counted === 0) return null;
  const earned = counts.present + counts.late * lateCoefficient + excused;
  return Math.round((earned / counted) * 10000) / 100;
}
