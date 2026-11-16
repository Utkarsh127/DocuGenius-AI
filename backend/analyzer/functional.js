export function getFunctionalInsights(logs) {
  const userFlows = {};
  const failedFlows = [];
  const browserUsage = {};
  const channelUsage = {};
  const userFrequency = {};
  const flowCounts = {};

  logs.forEach(log => {
    const user = log.userId || (typeof log.user === 'object' ? log.user?.id : log.user) || "anonymous";

    // Track user sequence (flow)
    if (!userFlows[user]) userFlows[user] = [];
    userFlows[user].push(`${log.method} ${log.url}`);

    // Track browser usage
    if (log.browser) {
      browserUsage[log.browser] = (browserUsage[log.browser] || 0) + 1;
    }

    // Track channel usage
    if (log.channel) {
      channelUsage[log.channel] = (channelUsage[log.channel] || 0) + 1;
    }

    // Track user frequency
    userFrequency[user] = (userFrequency[user] || 0) + 1;

    // Track failed flows
    if (log.status >= 400) {
      failedFlows.push({
        user,
        method: log.method,
        url: log.url,
        status: log.status,
        timestamp: log.timestamp
      });
    }
  });

  // Most frequently used flows
  const flowList = Object.values(userFlows)
    .map(flow => flow.join(" → "))
    .reduce((acc, f) => {
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});

  const mostUsedFlows = Object.fromEntries(
    Object.entries(flowList).sort((a, b) => b[1] - a[1])
  );

  return {
    userFlows,
    mostUsedFlows,
    failedFlows,
    totalFlowCount: Object.keys(flowList).length,
    browserUsage,
    channelUsage,
    userFrequency
  };
}
