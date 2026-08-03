// Minimal Blockbench global API declarations — only what this plugin uses.
// Verified live against a running Blockbench 5.1.6 instance via the
// Blockbench MCP plugin (risky_eval) before writing this file — see the
// commit history / chat log for the verification transcript. Do NOT extend
// this speculatively; if a new global is needed, verify it live first.

declare global {
  const Language: {
    addTranslations(language: string, translations: Record<string, string>): void;
  };
  function tl(key: string): string;

  interface Console {
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    log(...args: unknown[]): void;
  }
  const console: Console;

  interface PluginOptions {
    title: string;
    author: string;
    description: string;
    icon: string;
    version: string;
    min_version?: string;
  creation_date?: string;
    has_changelog?: boolean;
    repository?: string;
    bug_tracker?: string;
    variant: "both" | "desktop" | "web";
    tags?: string[];
    await_loading?: boolean;
    contributes?: {
      formats?: string[];
    };
    onload?: () => void;
    onunload?: () => void;
  }

  interface ModelFormatOptions {
    id: string;
    name: string;
    icon: string;
    category?: string;
    target?: string;
    description?: string;
    show_in_start_screen?: boolean;
    box_uv?: boolean;
    optional_box_uv?: boolean;
    single_texture?: boolean;
    bone_rig?: boolean;
    centered_grid?: boolean;
    rotate_cubes?: boolean;
    integer_size?: boolean;
    animation_mode?: boolean;
    display_mode?: boolean;
    codec?: unknown;
  }

  interface ModelFormatInstance {
    id: string;
    name: string;
    codec?: unknown;
    delete(): void;
  }

  const ModelFormat: {
    new (id: string, options: ModelFormatOptions): ModelFormatInstance;
  };

  const Formats: Record<string, ModelFormatInstance | undefined>;
  const Format: ModelFormatInstance;

  interface PropertyInstance {
    delete(): void;
  }

  interface PropertyOptions {
    default?: unknown;
    label?: string;
    description?: string;
  }

  const Property: {
    new (
      targetClass: { properties?: Record<string, PropertyInstance> },
      type: "object" | "string" | "boolean",
      name: string,
      options?: PropertyOptions
    ): PropertyInstance;
  };

  const ModelProject: {
    properties?: Record<string, PropertyInstance>;
  };

  const Plugin: {
    register(id: string, options: PluginOptions): void;
  };

  interface ActionOptions {
    name: string;
    description?: string;
    icon: string;
    category?: string;
    condition?: () => boolean;
    click(): void;
  }

  class Action {
    constructor(id: string, options: ActionOptions);
    delete(): void;
  }

  const MenuBar: {
    addAction(action: Action, path: string): void;
    removeAction(path: string): void;
  };

  const Blockbench: {
    version: string;
    on(event: string, callback: (data?: unknown) => void): void;
    removeListener(event: string, callback: (data?: unknown) => void): void;
    showQuickMessage(message: string, ms?: number): void;
    showMessageBox(
      options: {
        title: string;
        message: string;
        icon?: string;
        buttons?: string[];
        confirm?: number;
        cancel?: number;
      },
      callback?: (buttonIndex: number) => void
    ): void;
    /**
     * Desktop-only directory picker; remembers the last location per
     * `resource_id`. Returns null/undefined when cancelled.
     */
    pickDirectory(options: { resource_id?: string; title?: string; startpath?: string }): string | null | undefined;
    /**
     * Writes one file. Verified live: this does NOT create parent
     * directories — mkdir them first or it fails with ENOENT.
     * `savetype: "image"` decodes a `data:image/png;base64,…` content string.
     */
    writeFile(path: string, options: { content: string; savetype?: "text" | "image" | "zip" }): void;
    export(options: {
      resource_id?: string;
      type: string;
      extensions: string[];
      name: string;
      content: unknown;
      savetype: "zip";
    }): void;
  };

  class JSZip {
    file(name: string, content: string): void;
    generateAsync(options: { type: "blob" }): Promise<unknown>;
  }

  // --- Node modules, exposed to plugins through a permission-scoped require ---
  // Verified live that `requireNativeModule("fs", {scope})` returns a handle
  // restricted to that directory, prompting the user once and remembering the
  // grant. Only the members this plugin uses are declared.
  interface NodeDirent {
    name: string;
    isDirectory(): boolean;
  }
  interface NodeFs {
    mkdirSync(path: string, options?: { recursive?: boolean }): void;
    existsSync(path: string): boolean;
    readdirSync(path: string, options: { withFileTypes: true }): NodeDirent[];
    readFileSync(path: string, encoding: "utf8"): string;
    unlinkSync(path: string): void;
  }
  interface NodePath {
    join(...parts: string[]): string;
    dirname(path: string): string;
    basename(path: string): string;
  }
  function requireNativeModule(
    module: "fs" | "path",
    options?: { scope?: string; message?: string; show_permission_dialog?: boolean }
  ): unknown;

  // --- Model / animation runtime ---

  interface GroupInstance extends OutlinerNodeLike {
    /**
     * Official "Resolve Group" operation: re-parents children one level up
     * while composing the parent's rotation into each child and shifting
     * from/to/origin to match. Reusing this is what lets baking avoid
     * hand-rolled hierarchy math. `undo = false` skips its own Undo
     * bookkeeping so the caller can wrap a whole frame in one transaction.
     */
    resolve(undo?: boolean): OutlinerNodeLike[];
  }
  const Group: {
    all: GroupInstance[];
    new (...args: unknown[]): GroupInstance;
  };
  type Group = GroupInstance;

  interface BoneAnimatorInstance {
    channels: { rotation?: unknown; position?: unknown; scale?: unknown };
    keyframes?: unknown[];
    interpolate(channel: "rotation" | "position" | "scale"): number[] | null;
  }

  interface AnimationInstance {
    uuid: string;
    name: string;
    length: number;
    playing: boolean;
    /** Animation FPS grid used by frame baking. */
    snapping: number;
    /** Molang expression string when set; used as a blend multiplier. */
    blend_weight?: string;
    /** Bone animators keyed by group uuid — this is where keyframes live. */
    animators?: Record<string, BoneAnimatorInstance | undefined>;
    select(): void;
    getBoneAnimator(node: OutlinerNodeLike): BoneAnimatorInstance | null;
  }
  const Animation: { all: AnimationInstance[]; selected: AnimationInstance | null };
  type Animation = AnimationInstance;

  const Animator: {
    open: boolean;
    animations: AnimationInstance[];
    MolangParser: { parse(expression: string): number };
    showDefaultPose(no_matrix_update?: boolean): void;
    preview(in_loop?: boolean): void;
  };

  // --- Outliner / baking surface ---
  // Blockbench extends Array.prototype with these vector helpers; the baking
  // code uses them so the arithmetic matches the official
  // bake_animation_into_model Action exactly.
  interface Array<T> {
    V3_add(vector: number[]): number[];
    V3_multiply(vector: number[]): number[];
  }

  /**
   * The common surface of the outliner nodes baking touches (Groups and
   * Cubes). Coordinate fields are optional because which ones exist depends
   * on the node type.
   */
  interface OutlinerNodeLike {
    uuid: string;
    name: string;
    parent: OutlinerNodeLike | "root" | null;
    children: OutlinerNodeLike[];
    from?: number[];
    to?: number[];
    origin?: number[];
    rotation?: number[];
    export?: boolean;
    visibility?: boolean;
    mesh: THREE_Object3D;
    constructor: { animator?: unknown };
    getTypeBehavior(behavior: string): boolean;
  }

  const Outliner: { elements: OutlinerNodeLike[] };

  const Cube: { all: OutlinerNodeLike[] };

  /**
   * Project textures. Verified live: `id` is a numeric string matching the
   * keys of a compiled model's `textures` map, `getDataURL()` returns a
   * `data:image/png;base64,…` string, and `javaTextureLink()` returns the bare
   * in-project path (e.g. `block/texture`) that has to be rewritten for
   * export.
   */
  interface TextureInstance {
    id: string;
    name: string;
    folder: string;
    width: number;
    height: number;
    getDataURL(): string;
    javaTextureLink(): string;
  }
  const Texture: { all: TextureInstance[] };

  /**
   * `Undo.cancelEdit(true)` reverts to the pre-edit snapshot WITHOUT adding a
   * history entry, unlike finishEdit()+undo() which truncates the user's redo
   * branch.
   *
   * CRITICAL: the snapshot only covers the aspects you declare. Baking
   * removes groups (via Group.resolve()), and keyframes are stored on those
   * groups' bone animators, so `animations` MUST be declared or the rollback
   * silently returns empty groups and destroys the user's keyframes.
   */
  const Undo: {
    current_save: unknown;
    initEdit(aspects: {
      elements?: OutlinerNodeLike[];
      groups?: GroupInstance[];
      outliner?: boolean;
      animations?: AnimationInstance[];
    }): unknown;
    cancelEdit(revert_changes?: boolean): void;
  };

  const Codecs: {
    java_block: { compile(options?: { prevent_dialog?: boolean }): string };
  };

  const Timeline: {
    time: number;
    playing: boolean;
    start(): void;
    pause(): void;
    /** Advances time, applies loop/hold/once behavior, and calls Animator.preview(). */
    loop(): void;
    setTime(time: number, editing?: boolean): void;
    /**
     * `1 / snapping` of the selected animation (falling back to the global
     * animation_snap setting) — i.e. the duration of one frame on the
     * animation's own FPS grid. Verified live: returns 0.05 for a
     * snapping-20 animation.
     */
    getStep(): number;
  };

  interface ToggleBarItem {
    value: boolean;
    set(value: boolean): void;
  }

  const BarItems: {
    looped_animation_playback: ToggleBarItem;
  };

  interface DisplaySettingsEntry {
    rotation: [number, number, number];
    translation: [number, number, number];
    scale: [number, number, number];
  }

  const Project: ({
    name?: string;
    saved: boolean;
    /**
     * UV resolution the codec scales face UVs against. Can differ from the
     * actual texture pixel size, which silently produces wrong UVs on export —
     * the dialog warns when they disagree.
     */
    texture_width: number;
    texture_height: number;
    display_settings: Record<string, DisplaySettingsEntry>;
  } & Record<string, unknown>) | null;

  // --- Display Mode (the official Java block/item display editor) ---
  // `DisplayMode.load(slot)` both applies the slot's static transform to
  // `display_base` AND jumps the main viewport camera to that slot's preset
  // angle — reusing it gives us the official camera presets / left-hand
  // mirroring / rotation+scale pivot handling directly.
  const DisplayMode: {
    display_slot: string;
    slots: string[];
    display_base: THREE_Object3D;
    load(slot: string): void;
    updateDisplayBase(entry?: DisplaySettingsEntry): void;
  };

  interface AppModeOption {
    id: string;
    select(): void;
  }
  const Modes: {
    selected: AppModeOption;
    /**
     * Keyed by mode id ("edit" / "animate" / "display" / "paint"). Baking
     * needs `animate`: verified live that `animator.interpolate()` returns
     * `false` rather than a vector in other modes.
     */
    options: Record<string, AppModeOption | undefined>;
  };

  // --- Minimal three.js object surface exposed by Blockbench ---
  interface THREE_Vector3 {
    x: number;
    y: number;
    z: number;
  }
  interface THREE_Euler {
    x: number;
    y: number;
    z: number;
  }
  interface THREE_Object3D {
    visible: boolean;
    position: THREE_Vector3;
    rotation: THREE_Euler;
    scale: THREE_Vector3;
    parent: THREE_Object3D | null;
  }

  // --- DOM surface for building the control panel (no DOM lib — see
  // sibling project's types/blockbench.d.ts for why DOM lib is excluded:
  // it collides with Blockbench's own Group/Cube/Animation/Plugin globals). ---
  interface HTMLElementLike {
    appendChild(node: HTMLElementLike): void;
    style: Record<string, string>;
    remove(): void;
    innerHTML: string;
    innerText: string;
    title: string;
    onclick: (() => void) | null;
  }

  interface InputEventLike {
    target: HTMLInputElementLike;
  }

  interface HTMLSelectElementLike extends HTMLElementLike {
    value: string;
    onchange: ((event: InputEventLike) => void) | null;
  }

  interface HTMLInputElementLike extends HTMLElementLike {
    type: string;
    checked: boolean;
    value: string;
    min: string;
    max: string;
    step: string;
    oninput: ((event: InputEventLike) => void) | null;
    onchange: ((event: InputEventLike) => void) | (() => void) | null;
  }

  interface HTMLOptionElementLike extends HTMLElementLike {
    value: string;
  }

  interface Document {
    createElement(tag: "input"): HTMLInputElementLike;
    createElement(tag: "select"): HTMLSelectElementLike;
    createElement(tag: "option"): HTMLOptionElementLike;
    createElement(tag: string): HTMLElementLike;
  }
  const document: Document;

  function requestAnimationFrame(cb: (timestamp: number) => void): number;
  function cancelAnimationFrame(handle: number): void;
  function setInterval(callback: () => void, delay: number): number;
  function clearInterval(handle: number): void;

  interface PanelOptions {
    name: string;
    icon: string;
    growable?: boolean;
    resizable?: boolean;
    default_position?: { slot: string; height: number; width: number; float_position?: [number, number]; float_size?: [number, number] };
    onResize?: () => void;
  }

  class Panel {
    constructor(id: string, options: PanelOptions);
    node: HTMLElementLike;
    delete(): void;
  }

  /**
   * Dialog form fields. `type: "text"` with a `list` renders a native
   * datalist — free typing plus a filtered dropdown of suggestions, which is
   * what the base-item picker uses (verified live).
   */
  interface DialogFormField {
    label?: string;
    type?: "text" | "number" | "select" | "checkbox" | "info";
    value?: string | number | boolean;
    text?: string;
    list?: string[];
    options?: Record<string, string>;
    min?: number;
    max?: number;
    step?: number;
    description?: string;
    full_width?: boolean;
  }

  interface DialogOptions<T> {
    title: string;
    form?: Record<string, DialogFormField>;
    onConfirm?(result: T): void;
    onCancel?(): void;
  }

  class Dialog<T = Record<string, never>> {
    constructor(id: string, options: DialogOptions<T>);
    show(): void;
    delete(): void;
  }
}

export {};
