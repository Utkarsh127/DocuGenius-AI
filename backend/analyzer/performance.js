export function getPerformanceInsights(logs) {
  if (logs.length === 0) {
    return {
      avgResponseTime: 0,
      p50: 0,
      p90: 0,
      p99: 0,
      totalRequests: 0,
      throughputPerMin: 0,
      concurrency: 1,
      errorRate: 0,
      flowPerformance: {},
      channelDistribution: {},
      geoDistribution: {},
      workloadDistribution: {}
    };
  }

  const rt = logs.map(l => l.responseTime);
  rt.sort((a, b) => a - b);

  const p = (x) => rt[Math.floor((x / 100) * rt.length)];

  // Flow performance (per sequence)
  const flowPerformance = {};
  logs.forEach(l => {
    const key = `${l.method} ${l.url}`;
    if (!flowPerformance[key]) flowPerformance[key] = [];
    flowPerformance[key].push(l.responseTime);
  });

  const flowAvg = Object.fromEntries(
    Object.entries(flowPerformance).map(([flow, arr]) => [
      flow,
      (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
    ])
  );

  // Channel distribution
  const channelDistribution = {};
  logs.forEach(l => {
    if (l.channel) {
      channelDistribution[l.channel] = (channelDistribution[l.channel] || 0) + 1;
    }
  });

  // Geographic distribution
  const geoDistribution = {};
  logs.forEach(l => {
    if (l.country) {
      geoDistribution[l.country] = (geoDistribution[l.country] || 0) + 1;
    }
  });

  // Workload distribution (by hour)
  const workloadDistribution = {};
  logs.forEach(l => {
    const hour = new Date(l.timestamp).getHours();
    workloadDistribution[hour] = (workloadDistribution[hour] || 0) + 1;
  });

  return {
    avgResponseTime: (rt.reduce((a, b) => a + b, 0) / rt.length).toFixed(2),
    p50: p(50),
    p90: p(90),
    p99: p(99),
    totalRequests: logs.length,
    throughputPerMin: (logs.length / 1).toFixed(2),
    concurrency: Math.ceil(rt.length / 60),
    errorRate: ((logs.filter(l => l.status >= 400).length / logs.length) * 100).toFixed(2),
    flowPerformance: flowAvg,
    channelDistribution,
    geoDistribution,
    workloadDistribution
  };
}
