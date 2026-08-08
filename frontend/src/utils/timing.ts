// 性能打点（性能看护，默认关闭；VITE_TIMING=1 开启）
// 统一格式: [Timing] <stage> wall=<Date.now()> file=<file_id> <extra>
// wall 与后端 time.time()*1000 同毫秒时间轴，可跨前后端对齐时间线。
const TIMING_ENABLED = process.env.VITE_TIMING === '1';

export function timingLog(stage: string, fileId?: string, extra?: string) {
  if (!TIMING_ENABLED) return;
  const parts = [`[Timing] ${stage}`, `wall=${Date.now()}`];
  if (fileId) parts.push(`file=${fileId}`);
  if (extra) parts.push(extra);
  console.log(parts.join(' '));
}
