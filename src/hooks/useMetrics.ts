import { useMemo } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { useIssues } from './useJiraData';
import { calculateHeadlineMetrics, calculateTimeSeries, calculateTTFT } from '../metrics/headlineMetrics';
import { assessStaffing, calculatePrioritySeparationIndex } from '../metrics/staffingModel';
import { calculateRecurrenceStats } from '../patterns/recurrenceEngine';
import { classifyClosure, calculateIntegrityStats } from '../metrics/closureIntegrity';
import { decomposeLeadTime, aggregateLeadTimes } from '../metrics/leadTimeDecomposition';
import type { LeadTimeAggregate } from '../metrics/leadTimeDecomposition';
import { calculateAgingBuckets, detectStalledTickets } from '../metrics/ticketAging';
import type { AgingBucket, StalledTicket } from '../metrics/ticketAging';
import { calculateRolloverByShift, calculateVelocityUnderLoad } from '../metrics/shiftMetrics';
import type { RolloverSummary, VelocityPoint } from '../metrics/shiftMetrics';
import { buildClusters, calculateCategoryNetVelocity } from '../metrics/clusterAnalysis';
import type { TicketCluster } from '../metrics/clusterAnalysis';
import { identifyIncidentWindows, calculateIncidentCosts, detectSurges } from '../metrics/incidentImpact';
import type { IncidentImpactSummary, SurgeAbsorptionResult } from '../metrics/incidentImpact';
import { projectForward } from '../staffing/projectionEngine';
import type { ProjectionResult } from '../staffing/projectionEngine';
import { generateInsights } from '../narrative/insightGenerator';
import type { Insight } from '../narrative/insightGenerator';
import { filterByDimensions, extractDimensions } from '../dimensions/dimensionEngine';
import { getHolidayExclusions } from '../ledger/holidays';
import type { DimensionOption, DimensionKey } from '../dimensions/dimensionEngine';
import { detectClosureBursts } from '../metrics/closureBurst';
import type { ClosureBurstStats } from '../metrics/closureBurst';
import { detectAfterHoursWork } from '../metrics/afterHours';
import type { AfterHoursStats } from '../metrics/afterHours';

import { percentile, computeRollingBaseline } from '../utils/statistics';
import { KPI_DELTA_THRESHOLD, KPI_STATUS_RED_THRESHOLD } from '../constants';
import type { JiraIssue } from '../api/types';

import type { KPIData, KPITooltip } from '../components/kpi/KPICard';

function buildKPI(
  label: string,
  value: number,
  formatted: string,
  prev: number,
  opts?: { invertDelta?: boolean; insight?: string; baseline?: { mean: number; stdDev: number }; tooltip?: KPITooltip },
): KPIData {
  const delta = prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : 0;
  const direction: 'up' | 'down' | 'flat' = delta > KPI_DELTA_THRESHOLD ? 'up' : delta < -KPI_DELTA_THRESHOLD ? 'down' : 'flat';
  const isGood = opts?.invertDelta ? delta > 0 : delta < 0;

  let status: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
  if (opts?.baseline && opts.baseline.stdDev > 0) {
    const sigma = Math.abs(value - opts.baseline.mean) / opts.baseline.stdDev;
    if (sigma > 2) status = isGood ? 'green' : 'red';
    else if (sigma > 1) status = isGood ? 'green' : 'yellow';
  } else {
    const absDelta = Math.abs(delta);
    if (absDelta > KPI_STATUS_RED_THRESHOLD) status = isGood ? 'green' : 'red';
    else if (absDelta > KPI_DELTA_THRESHOLD) status = isGood ? 'green' : 'yellow';
  }

  return {
    label,
    value,
    formattedValue: formatted,
    direction,
    delta,
    formattedDelta: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
    status,
    insight: opts?.insight || '',
    tooltip: opts?.tooltip,
  };
}

function splitHalf(issues: JiraIssue[], dateRange: { start: Date; end: Date }) {
  const mid = new Date((dateRange.start.getTime() + dateRange.end.getTime()) / 2);
  const first = issues.filter((i) => new Date(i.fields.created) < mid);
  const second = issues.filter((i) => new Date(i.fields.created) >= mid);
  return { first, second };
}

export function useMetrics() {
  const {
    issues: storeIssues,
    statusMappings,
    workSchedule,
    dateRange,
    selectedProjectKeys,
    irProjectKey,
    dimensionFilters,
  } = useDashboardStore();

  const { data: fetchedIssues, isLoading, error } = useIssues();
  const issues = fetchedIssues ?? storeIssues ?? [];

  return useMemo(() => {
    if (issues.length === 0) {
      return {
        isLoading, error: error?.message ?? null, isEmpty: true,
        headline: null, timeSeries: [], staffing: null, recurrence: null,
        closureStats: null, leadTimeAgg: null,
        agingBuckets: [] as AgingBucket[], stalledTickets: [] as StalledTicket[],
        rollover: null as RolloverSummary | null,
        velocityUnderLoad: [] as VelocityPoint[],
        clusters: [] as TicketCluster[],
        categoryNetVelocity: [] as Array<{ name: string; value: number; color: string }>,
        incidentImpact: null as IncidentImpactSummary | null,
        surgeAbsorption: null as SurgeAbsorptionResult | null,
        projection: null as ProjectionResult | null,
        insights: [] as Insight[],
        availableDimensions: {} as Record<DimensionKey, DimensionOption[]>,
        closureBursts: null as ClosureBurstStats | null,
        holidayExclusions: [] as Array<{ start: Date; end: Date }>,
        afterHours: null as AfterHoursStats | null,
        kpis: { watch: [], flow: [], speed: [], capacity: [] },
      };
    }

    try {
    // Federal holiday exclusions
    const holidayExclusions = getHolidayExclusions(dateRange);

    // Merge status mappings across selected projects
    const flatMapping: Record<string, 'queue' | 'active' | 'done'> = {};
    for (const key of selectedProjectKeys) {
      const mapping = statusMappings[key];
      if (mapping) {
        for (const [status, classification] of Object.entries(mapping)) {
          flatMapping[status] = classification as 'queue' | 'active' | 'done';
        }
      }
    }

    const irIssues = irProjectKey
      ? issues.filter((i) => i.key.startsWith(irProjectKey + '-'))
      : [];
    const unfilteredProjectIssues = issues.filter(
      (i) => selectedProjectKeys.some((k) => i.key.startsWith(k + '-')),
    );
    const projectIssues = filterByDimensions(unfilteredProjectIssues, dimensionFilters);
    const availableDimensions = extractDimensions(unfilteredProjectIssues);

    const headline = calculateHeadlineMetrics(projectIssues, irIssues, flatMapping, workSchedule, dateRange);
    const timeSeries = calculateTimeSeries(projectIssues, dateRange);
    const staffing = assessStaffing(projectIssues, irIssues, flatMapping, workSchedule, dateRange, timeSeries);
    const recurrence = calculateRecurrenceStats(projectIssues, workSchedule);

    // Closure integrity
    const closures = projectIssues
      .filter((i) => i.fields.resolutiondate)
      .map((i) => classifyClosure(i, workSchedule, flatMapping));
    const closureStats = calculateIntegrityStats(closures);
    const closureBursts = detectClosureBursts(projectIssues);
    const afterHours = detectAfterHoursWork(projectIssues, workSchedule);

    // Lead time decomposition
    const closedProjectIssues = projectIssues.filter((i) => i.fields.resolutiondate);
    const leadTimeBreakdowns = closedProjectIssues.map((i) =>
      decomposeLeadTime(i, flatMapping, workSchedule),
    );
    const leadTimeAgg: LeadTimeAggregate = aggregateLeadTimes(leadTimeBreakdowns);

    // Ticket aging & stalled detection (open tickets only)
    const openIssues = projectIssues.filter((i) => !i.fields.resolutiondate);
    const agingBuckets = calculateAgingBuckets(openIssues, workSchedule);
    const stalledTickets = detectStalledTickets(openIssues, workSchedule);

    // Shift rollover & velocity under load
    const rollover = calculateRolloverByShift(projectIssues, workSchedule, flatMapping, dateRange);
    const velocityUnderLoad = calculateVelocityUnderLoad(projectIssues, dateRange);

    // Cluster analysis
    const clusters = buildClusters(projectIssues, workSchedule, flatMapping);
    const categoryNetVelocity = calculateCategoryNetVelocity(clusters);

    // Incident impact & surge absorption
    const incidentWindows = identifyIncidentWindows(irIssues);
    const incidentImpact = calculateIncidentCosts(incidentWindows, projectIssues, timeSeries, flatMapping, workSchedule);
    const surgeAbsorption = detectSurges(timeSeries);

    // Projections (60-day default horizon)
    const projection = projectForward(timeSeries, headline.queueDepth, 60);

    // Halves for delta calculation
    const { first } = splitHalf(projectIssues, dateRange);
    const firstHeadline = first.length > 0
      ? calculateHeadlineMetrics(first, irIssues, flatMapping, workSchedule, dateRange)
      : headline;

    // Rolling baselines from first-half data for sigma coloring
    const firstHalfQueueDepths = first.length > 0
      ? [firstHeadline.queueDepth]
      : [];
    const queueBaseline = firstHalfQueueDepths.length > 0
      ? computeRollingBaseline(firstHalfQueueDepths)
      : undefined;

    // Precompute TTFT array for KPIs
    const ttfts = projectIssues.map((i) => calculateTTFT(i, flatMapping, workSchedule)).filter((t): t is number => t !== null);
    const ttftP50 = percentile(ttfts, 50);
    const ttftP85 = percentile(ttfts, 85);

    // Build KPI arrays
    const watchKPIs: KPIData[] = [
      buildKPI('Queue Depth', headline.queueDepth, String(headline.queueDepth), firstHeadline.queueDepth, { insight: `${headline.queueDepth} tickets in non-Done statuses`, baseline: queueBaseline, tooltip: { headline: 'Count of tickets not in a Done-class status', detail: 'Tickets in any status classified as "queue" or "active" in your status mapping. Does not include resolved/closed tickets.', formula: 'COUNT(issues WHERE status_class != "done")', sampleSize: projectIssues.length } }),
      buildKPI('Net Velocity', headline.netVelocity, `${headline.netVelocity.toFixed(1)}/day`, firstHeadline.netVelocity, { invertDelta: true, insight: headline.netVelocity >= 0 ? 'Queue draining' : 'Queue filling faster than draining', tooltip: { headline: 'Average daily close rate minus intake rate', detail: 'Positive = queue shrinking. Negative = queue growing. Computed as average (closed - created) per day over the selected date range.', formula: 'AVG(daily_closed - daily_created)', sampleSize: timeSeries.length } }),
      buildKPI('TTFT P85', headline.ttftP85, `${headline.ttftP85.toFixed(1)}h`, firstHeadline.ttftP85, { insight: '85th percentile time to first touch', tooltip: { headline: 'Time from ticket creation to first status change into an Active-class status', detail: 'Measured in working hours only (excludes nights, weekends, holidays). P85 means 85% of tickets were touched faster than this value.', formula: 'PERCENTILE(working_hours(created → first_active_transition), 85)', sampleSize: ttfts.length } }),
      buildKPI('Active Incidents', headline.activeIncidentCount, String(headline.activeIncidentCount), 0, { insight: headline.activeIncidentCount > 0 ? `Oldest: ${headline.oldestIncidentAge.toFixed(1)}h` : 'No active incidents' }),
    ];

    // Flow KPIs — using lead time decomposition
    const flowKPIs: KPIData[] = [
      buildKPI('Lead Time P85', ttftP85, `${ttftP85.toFixed(1)}h`, firstHeadline.ttftP85, { insight: 'Time from creation to close (working hours)' }),
      buildKPI('Queue Wait P85', leadTimeAgg.queueWaitP85, `${leadTimeAgg.queueWaitP85.toFixed(1)}h`, 0, { insight: 'Time waiting before first touch' }),
      buildKPI('Active Work P85', leadTimeAgg.activeWorkP85, `${leadTimeAgg.activeWorkP85.toFixed(1)}h`, 0, { invertDelta: true, insight: 'Time in active status' }),
      buildKPI('Flow Efficiency', leadTimeAgg.flowEfficiency, `${leadTimeAgg.flowEfficiency.toFixed(0)}%`, 0, { invertDelta: true, insight: 'Ratio of active work to total lead time', tooltip: { headline: 'Percentage of lead time spent actively working the ticket', detail: 'Decomposed into three phases: queue wait (before first touch), active work (in Active-class statuses), and post-active wait (back in queue after being worked). Higher is better — low efficiency means tickets sit idle.', formula: 'SUM(active_work_minutes) / SUM(total_lead_time_minutes) × 100', sampleSize: closedProjectIssues.length } }),
    ];

    // Speed KPIs
    const psi = calculatePrioritySeparationIndex(projectIssues, flatMapping, workSchedule);
    const speedKPIs: KPIData[] = [
      buildKPI('TTFT P85', ttftP85, `${ttftP85.toFixed(1)}h`, firstHeadline.ttftP85, { insight: 'Working hours only' }),
      buildKPI('TTFT P50', ttftP50, `${ttftP50.toFixed(1)}h`, 0, { insight: 'Median response time' }),
      buildKPI('Priority Separation', psi.index, psi.index.toFixed(2), 0, { insight: psi.isReliable ? 'High priority touched faster' : 'Insufficient data' }),
    ];

    // Capacity KPIs — use open-queue stalled count
    const capacityKPIs: KPIData[] = [
      buildKPI('Staffing Verdict', 0, staffing.verdict.replace('_', ' '), 0, { insight: staffing.narrative }),
      buildKPI('Stalled Tickets', stalledTickets.length, String(stalledTickets.length), 0, { insight: stalledTickets.length > 0 ? `Oldest: ${stalledTickets[0]?.issueKey} (${stalledTickets[0]?.stalledDurationHours.toFixed(0)}h)` : 'No stalled tickets in open queue' }),
      buildKPI('Instant Closures', closureStats.instant, String(closureStats.instant), 0, { insight: `${closureStats.instant} tickets closed < 5 min` }),
    ];

    // Generate insights
    const insights = generateInsights({
      headline, leadTimeAgg, staffing, stalledTickets, clusters, surgeAbsorption, projection,
    });

    return {
      isLoading,
      error: error?.message ?? null,
      isEmpty: false,
      headline,
      timeSeries,
      staffing,
      recurrence,
      closureStats,
      leadTimeAgg,
      agingBuckets,
      stalledTickets,
      rollover,
      velocityUnderLoad,
      clusters,
      categoryNetVelocity,
      incidentImpact,
      surgeAbsorption,
      projection,
      insights,
      availableDimensions,
      closureBursts,
      holidayExclusions,
      afterHours,
      kpis: {
        watch: watchKPIs,
        flow: flowKPIs,
        speed: speedKPIs,
        capacity: capacityKPIs,
      },
      flatMapping,
      projectIssues,
      irIssues,
    };
    } catch (e) {
      // Metrics computation failed — error surfaced in return value
      return {
        isLoading: false, error: e instanceof Error ? e.message : 'Metrics computation failed', isEmpty: true,
        headline: null, timeSeries: [], staffing: null, recurrence: null,
        closureStats: null, leadTimeAgg: null,
        agingBuckets: [] as AgingBucket[], stalledTickets: [] as StalledTicket[],
        rollover: null as RolloverSummary | null,
        velocityUnderLoad: [] as VelocityPoint[],
        clusters: [] as TicketCluster[],
        categoryNetVelocity: [] as Array<{ name: string; value: number; color: string }>,
        incidentImpact: null as IncidentImpactSummary | null,
        surgeAbsorption: null as SurgeAbsorptionResult | null,
        projection: null as ProjectionResult | null,
        insights: [] as Insight[],
        availableDimensions: {} as Record<DimensionKey, DimensionOption[]>,
        closureBursts: null as ClosureBurstStats | null,
        holidayExclusions: [] as Array<{ start: Date; end: Date }>,
        afterHours: null as AfterHoursStats | null,
        kpis: { watch: [], flow: [], speed: [], capacity: [] },
      };
    }
  }, [issues, statusMappings, workSchedule, dateRange, selectedProjectKeys, irProjectKey, dimensionFilters, isLoading, error]);
}
