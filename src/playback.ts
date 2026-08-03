import { getDisplayAnimationEnabled } from "./display-animation-settings";

/** Bridges the plugin controls to Blockbench's official animation timeline and playback state. */

export type TickCallback = (currentTime: number, length: number, playing: boolean) => void;

let lowFpsPreview = false;
let onTick: TickCallback = () => {};
let listenersRegistered = false;
let quantizedPreviewInProgress = false;
let previewPlaybackTimer: number | null = null;

function getAnimation(): Animation | null {
  return Animation.selected ?? Animation.all[0] ?? null;
}

function quantize(time: number): number {
  if (!lowFpsPreview) return time;
  const step = Timeline.getStep();
  if (!step || step <= 0) return time;
  const epsilon = step * 1e-7;
  return Math.floor((time + epsilon) / step) * step;
}

function report(time = Timeline.time): void {
  const animation = getAnimation();
  if (!animation) return;
  onTick(Math.min(quantize(time), animation.length), animation.length, Timeline.playing);
}

/**
 * Outside animation mode, Blockbench sets the official playback state but does not continuously
 * schedule Timeline.loop(). A short mutually exclusive timer calls the official loop only in
 * those modes, avoiding a second animation clock.
 */
function usesPreviewPlaybackDriver(): boolean {
  return ["edit", "paint", "display"].includes(Modes.selected.id);
}

export function isCurrentDisplayAnimationEnabled(): boolean {
  return getDisplayAnimationEnabled(DisplayMode.display_slot);
}

function previewPlaybackAllowed(): boolean {
  return (
    Modes.selected.id !== "display" || isCurrentDisplayAnimationEnabled()
  );
}

function stopPreviewPlaybackDriver(): void {
  if (previewPlaybackTimer !== null) {
    clearInterval(previewPlaybackTimer);
    previewPlaybackTimer = null;
  }
}

function drivePreviewPlayback(): void {
  if (
    !Timeline.playing ||
    !usesPreviewPlaybackDriver() ||
    !previewPlaybackAllowed()
  ) {
    stopPreviewPlaybackDriver();
    return;
  }
  Timeline.loop();
}

function syncPreviewPlaybackDriver(): void {
  if (
    Timeline.playing &&
    usesPreviewPlaybackDriver() &&
    previewPlaybackAllowed()
  ) {
    if (previewPlaybackTimer === null) {
      previewPlaybackTimer = setInterval(drivePreviewPlayback, 16);
    }
  } else {
    stopPreviewPlaybackDriver();
  }
}

/**
 * Pauses and returns to the base pose when animation is disabled for the current display context.
 */
export function enforceCurrentDisplayAnimationPolicy(): void {
  if (Modes.selected.id !== "display" || isCurrentDisplayAnimationEnabled()) {
    syncPreviewPlaybackDriver();
    report();
    return;
  }
  if (Timeline.playing) Timeline.pause();
  seekTo(0);
  stopPreviewPlaybackDriver();
}

/**
 * Re-renders at the snapped time after Blockbench's interpolated frame, then restores the
 * official clock so playback speed and looping remain correct.
 */
function handleDisplayFrame(): void {
  if (quantizedPreviewInProgress) return;
  const animation = getAnimation();
  if (!animation) return;

  const rawTime = Timeline.time;
  const displayTime = Math.min(quantize(rawTime), animation.length);
  if (
    lowFpsPreview &&
    Timeline.playing &&
    Math.abs(displayTime - rawTime) > 1e-8
  ) {
    quantizedPreviewInProgress = true;
    try {
      Timeline.time = displayTime;
      Animator.preview(true);
    } finally {
      Timeline.time = rawTime;
      quantizedPreviewInProgress = false;
    }
  }
  onTick(displayTime, animation.length, Timeline.playing);
}

function handleTimelinePlay(): void {
  if (!previewPlaybackAllowed()) {
    Timeline.pause();
    Blockbench.showQuickMessage(
      "Animation is disabled for the current display context",
      2200
    );
    return;
  }
  syncPreviewPlaybackDriver();
  report();
}

function handleTimelinePause(): void {
  stopPreviewPlaybackDriver();
  if (lowFpsPreview) {
    seekTo(Timeline.time);
  } else {
    report();
  }
}

function handleModeSelect(): void {
  enforceCurrentDisplayAnimationPolicy();
}

export function initializePlaybackSync(): void {
  if (listenersRegistered) return;
  Blockbench.on("display_animation_frame", handleDisplayFrame);
  Blockbench.on("timeline_play", handleTimelinePlay);
  Blockbench.on("timeline_pause", handleTimelinePause);
  Blockbench.on("select_mode", handleModeSelect);
  listenersRegistered = true;
  syncPreviewPlaybackDriver();
}

export function disposePlaybackSync(): void {
  if (!listenersRegistered) return;
  Blockbench.removeListener("display_animation_frame", handleDisplayFrame);
  Blockbench.removeListener("timeline_play", handleTimelinePlay);
  Blockbench.removeListener("timeline_pause", handleTimelinePause);
  Blockbench.removeListener("select_mode", handleModeSelect);
  stopPreviewPlaybackDriver();
  listenersRegistered = false;
  onTick = () => {};
}

export function isPlaying(): boolean {
  return Timeline.playing;
}

export function isLooping(): boolean {
  return BarItems.looped_animation_playback.value;
}

export function setLooping(value: boolean): void {
  BarItems.looped_animation_playback.set(value);
}

export function isLowFpsPreview(): boolean {
  return lowFpsPreview;
}

export function setLowFpsPreview(value: boolean): void {
  lowFpsPreview = value;
  if (Timeline.playing) {
    handleDisplayFrame();
  } else {
    seekTo(Timeline.time);
  }
}

export function getCurrentTime(): number {
  return Timeline.time;
}

export function setTickCallback(cb: TickCallback): void {
  onTick = cb;
  report();
}

export function seekTo(time: number): void {
  const animation = getAnimation();
  if (!animation) return;
  const clamped = Math.min(Math.max(time, 0), animation.length);
  const displayTime = quantize(clamped);
  Timeline.setTime(displayTime);
  Animator.preview();
  onTick(displayTime, animation.length, Timeline.playing);
}

export function togglePlay(): void {
  if (!getAnimation()) return;
  if (
    Modes.selected.id === "display" &&
    !isCurrentDisplayAnimationEnabled()
  ) {
    Blockbench.showQuickMessage(
      "Animation is disabled for the current display context",
      2200
    );
    return;
  }
  if (Timeline.playing) {
    Timeline.pause();
  } else {
    Timeline.start();
  }
}

export function stop(): void {
  if (Timeline.playing) Timeline.pause();
}

/** Selects the current or first available animation and resets time to zero. */
export function selectAnimationAndReset(): Animation | null {
  const animation = getAnimation();
  if (animation) {
    stop();
    animation.select();
    seekTo(0);
  }
  return animation;
}
