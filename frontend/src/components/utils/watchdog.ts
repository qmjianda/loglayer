/**
 * 有界滚动看门狗决策纯函数（perf-deepening / render-throttling）
 *
 * dockview 激活/失活面板时，浏览器会把面板内容的 DOM 滚动条归零且不触发 scroll 事件
 * （React state 仍是旧值），导致视觉上跳回首行。看门狗逐帧检测「DOM=0 但 state>0 且
 * 近期无用户滚动」的脱节并同帧拉回真实位置。
 *
 * 有界化：连续 `WATCHDOG_STABLE_FRAMES_TO_SLEEP` 帧稳定（无纠正、无用户滚动、无面板
 * 激活/布局变化）后返回 `sleep`，由调用方停止逐帧检测（睡眠）；scroll / resize /
 * fileId / isActive 事件触发时调用方重新武装循环。
 */

/** 用户滚动保护窗口：该时长内的 DOM=0 视为用户主动滚到顶，不做归零纠正 */
export const WATCHDOG_USER_GUARD_MS = 80;

/** 连续稳定帧数阈值：达到后看门狗进入睡眠（≈0.5s @60fps） */
export const WATCHDOG_STABLE_FRAMES_TO_SLEEP = 30;

export type WatchdogAction = 'restore' | 'sleep' | 'continue';

export interface WatchdogDecision {
  action: WatchdogAction;
  /** 更新后的稳定帧计数（restore/sleep 后重置为 0） */
  stableFrames: number;
}

/**
 * 看门狗单帧决策（纯函数，便于单测）。
 *
 * @param stableFrames      当前已累计的稳定帧数（调用方 ref 传入）
 * @param domScrollTop      本帧读取的 DOM 滚动位置
 * @param stateScrollTop    看门狗维护的真实滚动位置（React state / ref 同步值）
 * @param lastScrollEventAgeMs 距最近一次用户滚动事件的时长（performance.now 差值）
 */
export function computeWatchdogAction(
  stableFrames: number,
  domScrollTop: number,
  stateScrollTop: number,
  lastScrollEventAgeMs: number,
): WatchdogDecision {
  // 外部归零形态：DOM=0 且真实位置 >0 且超出用户滚动保护窗口 → 拉回（restore）
  if (domScrollTop === 0 && stateScrollTop > 0 && lastScrollEventAgeMs > WATCHDOG_USER_GUARD_MS) {
    return { action: 'restore', stableFrames: 0 };
  }

  // 位置一致（含用户滚到顶 0===0 / 程序化跳顶 state 已同步为 0）→ 计入稳定帧。
  // 累计到阈值后下一帧进入睡眠（停止逐帧检测）；恰好达到阈值本身仍为 continue。
  if (domScrollTop === stateScrollTop) {
    const next = stableFrames + 1;
    if (next > WATCHDOG_STABLE_FRAMES_TO_SLEEP) {
      return { action: 'sleep', stableFrames: 0 };
    }
    return { action: 'continue', stableFrames: next };
  }

  // 位置不一致（非归零形态，如滚动进行中）→ 稳定计数重置
  return { action: 'continue', stableFrames: 0 };
}

/**
 * 面板激活时的同步恢复决策（纯函数）：
 * dockview 失活期间看门狗可能已睡眠，归零未被纠正（DOM=0 而真实位置 >0）。
 * 切回 tab 时调用方须在 **paint 前**（useLayoutEffect）恢复，避免「先闪回 0 再闪回目标」。
 */
export function shouldRestoreOnActivation(domScrollTop: number, stateScrollTop: number): boolean {
  return domScrollTop === 0 && stateScrollTop > 0;
}
