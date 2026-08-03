/** Builds the display-context picker and animation transport panel. */

import { enterDisplaySlot, listAvailableSlots, currentSlot, restorePreviousMode } from "./slot-controller";
import {
  enforceCurrentDisplayAnimationPolicy,
  togglePlay,
  setLooping,
  isLooping,
  isLowFpsPreview,
  setLowFpsPreview,
  seekTo,
  setTickCallback,
  stop,
  selectAnimationAndReset,
  isCurrentDisplayAnimationEnabled,
} from "./playback";
import {
  getDisplayAnimationEnabled,
  setDisplayAnimationEnabled,
} from "./display-animation-settings";
import { tr } from "./i18n";

let panel: Panel | null = null;
let slotSelectEl: HTMLSelectElementLike | null = null;
let sliderEl: HTMLInputElementLike | null = null;
let timeLabelEl: HTMLElementLike | null = null;
let playButtonEl: HTMLElementLike | null = null;
let animatedCheckboxEl: HTMLInputElementLike | null = null;
let animationSwitchRowEl: HTMLElementLike | null = null;
let slotMonitorTimer: number | null = null;
let observedSlot = "";

const SLOT_LABELS: Record<string, string> = {
  thirdperson_righthand: "dap.slot.thirdperson_righthand",
  thirdperson_lefthand: "dap.slot.thirdperson_lefthand",
  firstperson_righthand: "dap.slot.firstperson_righthand",
  firstperson_lefthand: "dap.slot.firstperson_lefthand",
  ground: "dap.slot.ground",
  gui: "dap.slot.gui",
  head: "dap.slot.head",
  embedded: "dap.slot.embedded",
  fixed: "dap.slot.fixed",
  on_shelf: "dap.slot.on_shelf",
};

function formatTime(t: number): string {
  return t.toFixed(2) + "s";
}

function updateControlsUI(time: number, length: number, playing: boolean): void {
  syncDisplayControls();
  if (sliderEl) {
    sliderEl.max = String(length);
    sliderEl.value = String(time);
  }
  if (timeLabelEl) {
    timeLabelEl.innerText = `${formatTime(time)} / ${formatTime(length)}`;
  }
  if (playButtonEl) {
    playButtonEl.innerHTML = `<i class="material-icons">${playing ? "pause" : "play_arrow"}</i>`;
  }
}

function refreshModeVisibility(): void {
  if (animationSwitchRowEl) {
    animationSwitchRowEl.style.display =
      Modes.selected.id === "display" ? "flex" : "none";
  }
}

function refreshPlayButtonState(): void {
  if (!playButtonEl) return;
  const enabled =
    Modes.selected.id !== "display" || isCurrentDisplayAnimationEnabled();
  playButtonEl.style.opacity = enabled ? "1" : "0.35";
  playButtonEl.style.cursor = enabled ? "pointer" : "not-allowed";
  playButtonEl.title = enabled
    ? tr("dap.panel.play")
    : tr("dap.panel.play_disabled");
}

function syncDisplayControls(force = false): void {
  refreshModeVisibility();
  const slot = currentSlot();
  if (!force && observedSlot === slot) return;
  observedSlot = slot;
  if (slotSelectEl) slotSelectEl.value = slot;
  if (animatedCheckboxEl) {
    animatedCheckboxEl.checked = getDisplayAnimationEnabled(slot);
  }
  refreshPlayButtonState();
  enforceCurrentDisplayAnimationPolicy();
}

function startSlotMonitor(): void {
  if (slotMonitorTimer !== null) return;
  slotMonitorTimer = setInterval(() => syncDisplayControls(), 150);
}

function stopSlotMonitor(): void {
  if (slotMonitorTimer === null) return;
  clearInterval(slotMonitorTimer);
  slotMonitorTimer = null;
}

function buildSlotPicker(container: HTMLElementLike): void {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  row.style.padding = "4px 0";
  // Wrap narrow rows instead of squeezing their children.
  row.style.flexWrap = "wrap";

  const label = document.createElement("span");
  label.innerText = tr("dap.panel.slot");
  label.style.fontSize = "11px";
  label.style.whiteSpace = "nowrap";
  // Prevent flexbox from truncating the label.
  label.style.flex = "0 0 auto";

  const select = document.createElement("select");
  // Fill remaining space while allowing the control to shrink on narrow panels.
  select.style.flex = "1 1 120px";
  select.style.minWidth = "0";
  for (const slot of listAvailableSlots()) {
    const option = document.createElement("option");
    option.value = slot;
    option.innerText = SLOT_LABELS[slot] ? tr(SLOT_LABELS[slot]) : slot;
    select.appendChild(option);
  }
  select.value = currentSlot();
  select.onchange = (event) => {
    const slot = event.target.value;
    enterDisplaySlot(slot);
    syncDisplayControls(true);
  };
  slotSelectEl = select;

  row.appendChild(label);
  row.appendChild(select);
  container.appendChild(row);
}

function buildAnimationSwitch(container: HTMLElementLike): void {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  row.style.padding = "4px 0";
  row.style.flexWrap = "wrap";
  animationSwitchRowEl = row;

  const animated = document.createElement("input");
  animated.type = "checkbox";
  animated.title = tr("dap.panel.animate_hint");
  animated.onchange = () => {
    const slot = currentSlot();
    setDisplayAnimationEnabled(slot, animated.checked);
    enforceCurrentDisplayAnimationPolicy();
    refreshPlayButtonState();
  };
  animatedCheckboxEl = animated;

  const animatedLabel = document.createElement("span");
  animatedLabel.innerText = tr("dap.panel.animate");
  animatedLabel.style.fontSize = "11px";
  animatedLabel.style.whiteSpace = "nowrap";

  row.appendChild(animated);
  row.appendChild(animatedLabel);
  container.appendChild(row);
  refreshModeVisibility();
  syncDisplayControls(true);
}

function buildTransportControls(container: HTMLElementLike): void {
  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.gap = "6px";
  bar.style.padding = "4px 0";
  // Let the transport and scrubber wrap independently on narrow panels.
  bar.style.flexWrap = "wrap";

  const buttonGroup = document.createElement("div");
  buttonGroup.style.display = "flex";
  buttonGroup.style.alignItems = "center";
  buttonGroup.style.gap = "6px";
  buttonGroup.style.flex = "0 0 auto";

  const playButton = document.createElement("button");
  playButton.innerHTML = '<i class="material-icons">play_arrow</i>';
  playButton.title = tr("dap.panel.play");
  playButton.style.flex = "0 0 auto";
  playButton.onclick = () => togglePlay();
  playButtonEl = playButton;
  refreshPlayButtonState();

  const loopButton = document.createElement("button");
  loopButton.innerHTML = '<i class="material-icons">repeat</i>';
  loopButton.title = tr("dap.panel.loop");
  loopButton.style.flex = "0 0 auto";
  loopButton.style.opacity = isLooping() ? "1" : "0.4";
  loopButton.onclick = () => {
    setLooping(!isLooping());
    loopButton.style.opacity = isLooping() ? "1" : "0.4";
  };

  const lowFpsButton = document.createElement("button");
  lowFpsButton.innerText = tr("dap.panel.low_fps");
  lowFpsButton.title = tr("dap.panel.low_fps_hint");
  lowFpsButton.style.flex = "0 0 auto";
  lowFpsButton.style.whiteSpace = "nowrap";
  lowFpsButton.style.opacity = isLowFpsPreview() ? "1" : "0.4";
  lowFpsButton.onclick = () => {
    setLowFpsPreview(!isLowFpsPreview());
    lowFpsButton.style.opacity = isLowFpsPreview() ? "1" : "0.4";
  };

  const scrubGroup = document.createElement("div");
  scrubGroup.style.display = "flex";
  scrubGroup.style.alignItems = "center";
  scrubGroup.style.gap = "6px";
  // Use remaining space while allowing shrink and wrap.
  scrubGroup.style.flex = "1 1 140px";
  scrubGroup.style.minWidth = "0";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.001";
  slider.value = "0";
  slider.style.flex = "1 1 auto";
  slider.style.minWidth = "0";
  slider.oninput = (event) => {
    stop();
    seekTo(parseFloat(event.target.value));
    updateControlsUI(parseFloat(event.target.value), parseFloat(slider.max), false);
  };
  sliderEl = slider;

  const timeLabel = document.createElement("span");
  timeLabel.style.fontSize = "11px";
  timeLabel.style.textAlign = "right";
  timeLabel.style.whiteSpace = "nowrap";
  timeLabel.style.flex = "0 0 auto";
  timeLabelEl = timeLabel;

  buttonGroup.appendChild(playButton);
  buttonGroup.appendChild(loopButton);
  buttonGroup.appendChild(lowFpsButton);
  scrubGroup.appendChild(slider);
  scrubGroup.appendChild(timeLabel);
  bar.appendChild(buttonGroup);
  bar.appendChild(scrubGroup);
  container.appendChild(bar);
}

export function openControlPanel(): void {
  setTickCallback(updateControlsUI);

  if (panel) {
    const animation = selectAnimationAndReset();
    syncDisplayControls(true);
    startSlotMonitor();
    if (animation) updateControlsUI(0, animation.length, false);
    return;
  }

  const wrapper = document.createElement("div");
  // Keep controls readable and padded when the panel becomes narrow.
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "2px";
  wrapper.style.padding = "0 4px 4px";
  wrapper.style.minWidth = "0";
  buildSlotPicker(wrapper);
  buildAnimationSwitch(wrapper);
  buildTransportControls(wrapper);

  panel = new Panel("display_anim_preview_controls", {
    name: tr("dap.panel.name"),
    icon: "movie",
    growable: true,
    resizable: true,
    // Leave enough height for a third wrapped row.
    default_position: { slot: "left_bar", height: 165, width: 320 },
  });
  panel.node.appendChild(wrapper);

  const animation = selectAnimationAndReset();
  syncDisplayControls(true);
  startSlotMonitor();
  if (animation) updateControlsUI(0, animation.length, false);
}

export function closeControlPanel(): void {
  stopSlotMonitor();
  stop();
  restorePreviousMode();
}

export function disposeControlPanel(): void {
  closeControlPanel();
  panel?.delete();
  panel = null;
  slotSelectEl = null;
  sliderEl = null;
  timeLabelEl = null;
  playButtonEl = null;
  animatedCheckboxEl = null;
  animationSwitchRowEl = null;
  observedSlot = "";
}
