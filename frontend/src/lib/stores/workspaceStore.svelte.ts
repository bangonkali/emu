export type ToolboxId =
  | 'play'
  | 'map'
  | 'party'
  | 'items'
  | 'saves'
  | 'pokedex'
  | 'logs'
  | 'battle';

export interface LeafPaneNode {
  type: 'leaf';
  id: string;
  toolboxId: ToolboxId | null;
}

export interface SplitPaneNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  sizes: number[]; // percentage values, sum ≈ 100
  children: PaneNode[];
}

export type PaneNode = LeafPaneNode | SplitPaneNode;

export interface WorkspaceTab {
  id: string;
  label: string;
  layout: PaneNode;
}

const STORAGE_KEY = 'poke-workspace-v2';

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function makeLeaf(toolboxId: ToolboxId | null = null): LeafPaneNode {
  return { type: 'leaf', id: makeId(), toolboxId };
}

function defaultTabs(): WorkspaceTab[] {
  return [
    {
      id: makeId(),
      label: 'Workbench',
      layout: {
        type: 'split',
        id: makeId(),
        direction: 'horizontal',
        sizes: [30, 40, 30],
        children: [
          makeLeaf('play'),
          makeLeaf('map'),
          {
            type: 'split',
            id: makeId(),
            direction: 'vertical',
            sizes: [50, 50],
            children: [makeLeaf('party'), makeLeaf('logs')],
          },
        ],
      },
    },
  ];
}

type FindResult = {
  node: PaneNode;
  parent: SplitPaneNode | null;
  index: number;
};

function findNode(
  root: PaneNode,
  id: string,
  parent: SplitPaneNode | null = null,
  index = 0,
): FindResult | null {
  if (root.id === id) return { node: root, parent, index };
  if (root.type === 'split') {
    for (let i = 0; i < root.children.length; i++) {
      const r = findNode(root.children[i], id, root, i);
      if (r) return r;
    }
  }
  return null;
}

function safeLoad(): { tabs: WorkspaceTab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { tabs: WorkspaceTab[]; activeTabId: string };
    if (!Array.isArray(data.tabs) || data.tabs.length === 0) return null;
    if (!data.activeTabId) return null;
    if (!data.tabs.find((t) => t.id === data.activeTabId)) {
      data.activeTabId = data.tabs[0].id;
    }
    return data;
  } catch {
    return null;
  }
}

class WorkspaceStore {
  tabs = $state<WorkspaceTab[]>([]);
  activeTabId = $state<string>('');

  constructor() {
    const saved = safeLoad();
    if (saved) {
      this.tabs = saved.tabs;
      this.activeTabId = saved.activeTabId;
    } else {
      const defaults = defaultTabs();
      this.tabs = defaults;
      this.activeTabId = defaults[0].id;
    }
  }

  get activeTab(): WorkspaceTab | undefined {
    return this.tabs.find((t) => t.id === this.activeTabId);
  }

  save(): void {
    try {
      const snapshot = $state.snapshot({ tabs: this.tabs, activeTabId: this.activeTabId });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  }

  setActiveTab(id: string): void {
    this.activeTabId = id;
    this.save();
  }

  addTab(label?: string): void {
    const id = makeId();
    this.tabs.push({
      id,
      label: label ?? `Tab ${this.tabs.length + 1}`,
      layout: makeLeaf(null),
    });
    this.activeTabId = id;
    this.save();
  }

  removeTab(id: string): void {
    if (this.tabs.length <= 1) return;
    const index = this.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    this.tabs.splice(index, 1);
    if (this.activeTabId === id) {
      this.activeTabId = this.tabs[Math.max(0, index - 1)].id;
    }
    this.save();
  }

  renameTab(id: string, label: string): void {
    const tab = this.tabs.find((t) => t.id === id);
    if (tab) tab.label = label;
    this.save();
  }

  splitPane(paneId: string, direction: 'horizontal' | 'vertical'): void {
    const tab = this.activeTab;
    if (!tab) return;

    const result = findNode(tab.layout, paneId);
    if (!result || result.node.type !== 'leaf') return;

    const { node, parent, index } = result;
    const existingLeaf = node as LeafPaneNode;

    // If the parent split is already in the same direction, add a sibling
    if (parent && parent.direction === direction) {
      const removedSize = parent.sizes[index];
      const half = removedSize / 2;
      parent.children.splice(index + 1, 0, makeLeaf(null));
      parent.sizes.splice(index, 1, half, half);
      this.save();
      return;
    }

    // Otherwise wrap in a new binary split
    const newSplit: SplitPaneNode = {
      type: 'split',
      id: makeId(),
      direction,
      sizes: [50, 50],
      children: [
        { type: 'leaf', id: existingLeaf.id, toolboxId: existingLeaf.toolboxId },
        makeLeaf(null),
      ],
    };

    if (parent === null) {
      tab.layout = newSplit;
    } else {
      parent.children[index] = newSplit;
    }
    this.save();
  }

  removePane(paneId: string): void {
    const tab = this.activeTab;
    if (!tab) return;

    // If it's the root, just clear its toolbox
    if (tab.layout.id === paneId) {
      if (tab.layout.type === 'leaf') {
        tab.layout.toolboxId = null;
      }
      this.save();
      return;
    }

    const result = findNode(tab.layout, paneId);
    if (!result || !result.parent) return;

    const { parent, index } = result;

    if (parent.children.length === 2) {
      // Replace parent split with the surviving sibling
      const siblingIndex = index === 0 ? 1 : 0;
      const sibling = parent.children[siblingIndex];

      const parentResult = findNode(tab.layout, parent.id);
      if (!parentResult) return;

      if (parentResult.parent === null) {
        tab.layout = sibling;
      } else {
        parentResult.parent.children[parentResult.index] = sibling;
      }
    } else {
      // Remove from parent, redistribute its size evenly
      const removedSize = parent.sizes[index];
      parent.children.splice(index, 1);
      parent.sizes.splice(index, 1);
      const bonus = removedSize / parent.children.length;
      for (let i = 0; i < parent.sizes.length; i++) {
        parent.sizes[i] += bonus;
      }
    }
    this.save();
  }

  assignToolbox(paneId: string, toolboxId: ToolboxId | null): void {
    const tab = this.activeTab;
    if (!tab) return;
    const result = findNode(tab.layout, paneId);
    if (!result || result.node.type !== 'leaf') return;
    (result.node as LeafPaneNode).toolboxId = toolboxId;
    this.save();
  }

  updateSizes(splitId: string, sizes: number[]): void {
    const tab = this.activeTab;
    if (!tab) return;
    const result = findNode(tab.layout, splitId);
    if (!result || result.node.type !== 'split') return;
    (result.node as SplitPaneNode).sizes = [...sizes];
    // Don't persist on every mouse-move; call saveSizes() on drag end
  }

  saveSizes(): void {
    this.save();
  }
}

export const workspaceStore = new WorkspaceStore();
