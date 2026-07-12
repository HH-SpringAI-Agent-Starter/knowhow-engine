/**
 * Conduction Engine — 传导路径推理
 * 给定一条链和信号接入点，输出完整的传导路径 + 时间窗 + 受益标的
 */

const { getChain } = require('./chain-loader');

/**
 * 获取完整传导视图
 * @param {string} chainId
 * @returns {Object} { steps, bottleneck, entry, failure, verification }
 */
function getConductionView(chainId) {
  const chain = getChain(chainId);
  if (!chain) return null;

  const path = chain.conduction_path || {};
  const steps = (path.steps || []).map((s, i) => ({
    step: s.step || i + 1,
    from: s.from || '',
    to: s.to || '',
    lag_days: s.lag_days || [0, 0],
    signals: s.signals || []
  }));

  // 瓶颈分析
  const bottleneck = chain.bottleneck_analysis || {};

  // entry timing
  const entry = chain.entry_timing || {};

  // failure conditions
  const failure = chain.failure_conditions || {};

  // verification
  const verification = chain.verification_signals || {};

  // 时间线总结
  const totalMinDays = steps.reduce((s, st) => s + (st.lag_days[0] || 0), 0);
  const totalMaxDays = steps.reduce((s, st) => s + (st.lag_days[1] || 0), 0);

  return {
    chain_id: chainId,
    name: chain.name,
    path_summary: path.description || '',
    total_lag_range: [totalMinDays, totalMaxDays],
    steps,
    bottleneck,
    entry,
    failure,
    verification
  };
}

/**
 * 预测传导到某一环节的时间
 * @param {string} chainId
 * @param {number} targetStep - 目标步骤
 * @returns {Object} { days_min, days_max, path }
 */
function predictTimeline(chainId, targetStep) {
  const chain = getChain(chainId);
  if (!chain) return null;

  const steps = (chain.conduction_path?.steps || []);
  if (targetStep > steps.length) return null;

  let min = 0, max = 0;
  const pathSegments = [];
  for (let i = 0; i < targetStep && i < steps.length; i++) {
    const s = steps[i];
    min += (s.lag_days[0] || 0);
    max += (s.lag_days[1] || 0);
    pathSegments.push({ from: s.from, to: s.to });
  }

  return {
    chain_id: chainId,
    target_step: targetStep,
    days_range: [min, max],
    segments: pathSegments
  };
}

module.exports = { getConductionView, predictTimeline };
