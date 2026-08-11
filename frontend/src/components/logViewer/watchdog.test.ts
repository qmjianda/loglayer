/**
 * 有界滚动看门狗决策纯函数验收测试（perf-deepening / render-throttling）
 *
 * 追溯 spec: render-throttling → "滚动位置保持（有界看门狗）"
 * - 外部归零 → restore（面板切换不跳回首行）
 * - 用户滚动保护窗口内不误干预
 * - 空闲稳定 → sleep（看门狗停止逐帧检测）
 * - 用户滚到顶 / 程序化跳顶不被误判为归零
 */
import { describe, it, expect } from 'vitest';
import {
  computeWatchdogAction,
  WATCHDOG_USER_GUARD_MS,
  WATCHDOG_STABLE_FRAMES_TO_SLEEP,
} from '../utils/watchdog';

describe('computeWatchdogAction 决策（有界看门狗）', () => {
  it('外部归零（DOM=0 且 state>0 且无近期用户滚动）→ restore', () => {
    const d = computeWatchdogAction(0, 0, 5000, WATCHDOG_USER_GUARD_MS + 1);
    expect(d.action).toBe('restore');
    expect(d.stableFrames).toBe(0); // 纠正后稳定计数重置
  });

  it('用户滚动保护窗口内不误干预（age <= 80ms）', () => {
    const d = computeWatchdogAction(0, 0, 5000, WATCHDOG_USER_GUARD_MS - 1);
    expect(d.action).not.toBe('restore');
  });

  it('用户主动滚到顶（DOM=0 且 state=0）不被误判为归零', () => {
    const d = computeWatchdogAction(0, 0, 0, WATCHDOG_USER_GUARD_MS + 1);
    expect(d.action).not.toBe('restore');
    expect(d.stableFrames).toBe(1); // 计入稳定帧
  });

  it('程序化跳转到顶部（state 已同步为 0）不被误判为归零', () => {
    const d = computeWatchdogAction(5, 0, 0, WATCHDOG_USER_GUARD_MS + 1);
    expect(d.action).not.toBe('restore');
  });

  it('位置稳定累积稳定帧，达到阈值后 sleep（停止逐帧检测）', () => {
    const threshold = WATCHDOG_STABLE_FRAMES_TO_SLEEP;
    const before = computeWatchdogAction(threshold - 1, 100, 100, WATCHDOG_USER_GUARD_MS + 1);
    expect(before.action).toBe('continue');
    expect(before.stableFrames).toBe(threshold);

    const at = computeWatchdogAction(threshold, 100, 100, WATCHDOG_USER_GUARD_MS + 1);
    expect(at.action).toBe('sleep');
    expect(at.stableFrames).toBe(0); // 睡眠后重置
  });

  it('位置不一致（非归零形态）不计入稳定帧', () => {
    const d = computeWatchdogAction(10, 100, 200, WATCHDOG_USER_GUARD_MS + 1);
    expect(d.action).toBe('continue');
    expect(d.stableFrames).toBe(0);
  });
});
