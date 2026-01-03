let snapshotId = 0;

interface SnapshotResult {
  snapshot: string;
  elementMap: Map<string, number>;
  snapshotId: number;
}

export function getA11ySnapshot(verbose: boolean): SnapshotResult {
  snapshotId++;
  const elementMap = new Map<string, number>();
  let nodeIndex = 0;

  const lines: string[] = [];

  function walk(node: Element, depth = 0): void {
    const role = node.getAttribute('role') || getImplicitRole(node);
    const name = getAccessibleName(node);
    const isInteractive = isInteractiveRole(role);

    if (!verbose && !isInteractive && !name) {
      for (const child of node.children) {
        walk(child, depth);
      }
      return;
    }

    const uid = `${snapshotId}_${nodeIndex}`;
    nodeIndex++;

    // store reference for later interaction
    (node as HTMLElement).dataset.taskhomieUid = uid;
    elementMap.set(uid, nodeIndex);

    const indent = '  '.repeat(depth);
    let line = `${indent}uid=${uid} ${role}`;
    if (name) line += ` "${name}"`;

    // add useful attributes
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href) line += ` href="${href}"`;
    }
    if (node.tagName === 'INPUT') {
      const type = node.getAttribute('type') || 'text';
      line += ` type="${type}"`;
      if ((node as HTMLInputElement).value) {
        line += ` value="${(node as HTMLInputElement).value}"`;
      }
    }

    lines.push(line);

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  walk(document.body);

  return {
    snapshot: lines.join('\n'),
    elementMap,
    snapshotId
  };
}

export function getElementByUid(uid: string): Element | null {
  return document.querySelector(`[data-taskhomie-uid="${uid}"]`);
}

function getImplicitRole(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const roleMap: Record<string, string> = {
    a: 'link',
    button: 'button',
    input: 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    img: 'image',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    aside: 'complementary',
    article: 'article',
    section: 'region',
    form: 'form',
    table: 'table',
    ul: 'list',
    ol: 'list',
    li: 'listitem'
  };
  return roleMap[tag] || 'generic';
}

function getAccessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy.split(' ')
      .map(id => document.getElementById(id)?.textContent)
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  if (el.tagName === 'IMG') {
    return el.getAttribute('alt') || '';
  }

  if (el.tagName === 'INPUT') {
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder;
  }

  if (['BUTTON', 'A', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
    return el.textContent?.trim().slice(0, 100) || '';
  }

  return '';
}

function isInteractiveRole(role: string): boolean {
  const interactive = [
    'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
    'listbox', 'menu', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'option', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab',
    'treeitem', 'heading'
  ];
  return interactive.includes(role);
}
