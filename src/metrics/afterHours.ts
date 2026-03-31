/** After-Hours & Weekend Work Detection */

import type { JiraIssue } from '../api/types';
import type { WorkSchedule } from './workingHours';
import { isWithinWorkingHours } from './workingHours';

export interface AfterHoursStats {
  totalTransitions: number;
  afterHoursTransitions: number;
  weekendTransitions: number;
  afterHoursRate: number;
  weekendRate: number;
  afterHoursByDay: Array<{ day: string; count: number }>;
  topAfterHoursTickets: Array<{ key: string; afterHoursCount: number }>;
}

export function detectAfterHoursWork(
  issues: JiraIssue[],
  schedule: WorkSchedule,
): AfterHoursStats {
  let totalTransitions = 0;
  let afterHoursTransitions = 0;
  let weekendTransitions = 0;

  const dayOfWeekCounts: Record<string, number> = {
    Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0,
  };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const ticketAfterHours = new Map<string, number>();

  for (const issue of issues) {
    const histories = issue.changelog?.histories || [];

    for (const history of histories) {
      const hasStatusChange = history.items.some((item) => item.field === 'status');
      if (!hasStatusChange) continue;

      totalTransitions++;
      const transitionTime = new Date(history.created);
      const dayOfWeek = transitionTime.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isWithinHours = isWithinWorkingHours(transitionTime, schedule);

      if (isWeekend) {
        weekendTransitions++;
        dayOfWeekCounts[dayNames[dayOfWeek]]++;
      }

      if (!isWithinHours) {
        afterHoursTransitions++;
        if (!isWeekend) {
          dayOfWeekCounts[dayNames[dayOfWeek]]++;
        }

        const current = ticketAfterHours.get(issue.key) ?? 0;
        ticketAfterHours.set(issue.key, current + 1);
      }
    }
  }

  const afterHoursByDay = dayNames.map((day) => ({
    day,
    count: dayOfWeekCounts[day],
  }));

  const topAfterHoursTickets = [...ticketAfterHours.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, afterHoursCount]) => ({ key, afterHoursCount }));

  return {
    totalTransitions,
    afterHoursTransitions,
    weekendTransitions,
    afterHoursRate: totalTransitions > 0 ? afterHoursTransitions / totalTransitions : 0,
    weekendRate: totalTransitions > 0 ? weekendTransitions / totalTransitions : 0,
    afterHoursByDay,
    topAfterHoursTickets,
  };
}
