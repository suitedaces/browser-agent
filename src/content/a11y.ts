// use window property to prevent multiple injections
declare global {
  interface Window {
    __taskhomieSnapshotId?: number;
  }
}

if (typeof window.__taskhomieSnapshotId === 'undefined') {
  window.__taskhomieSnapshotId = 0;
}

interface SnapshotResult {
  snapshot: string;
  snapshotId: number;
}

export function getA11ySnapshot(verbose: boolean, maxTokens = 15000): SnapshotResult {
  window.__taskhomieSnapshotId = (window.__taskhomieSnapshotId || 0) + 1;
  const snapshotId = window.__taskhomieSnapshotId;
  let nodeIndex = 0;

  // collect all elements with priority scores
  const elements: Array<{
    node: Element;
    score: number;
    depth: number;
    role: string;
    name: string;
  }> = [];

  function scoreElement(node: Element, role: string, name: string, depth: number): number {
    let score = 0;

    // critical interactive elements
    if (['button', 'link', 'textbox', 'searchbox', 'checkbox', 'radio'].includes(role)) score += 100;

    // navigation/landmarks
    if (['navigation', 'main', 'search', 'form'].includes(role)) score += 80;
    if (['heading'].includes(role)) score += 60;

    // has meaningful name
    if (name && name.length > 3) score += 20;

    // viewport visibility (prioritize what user sees)
    const rect = (node as HTMLElement).getBoundingClientRect?.();
    if (rect && rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth) {
      score += 50;
    }

    // penalize depth (prefer shallow elements)
    score -= depth * 2;

    // exclude completely hidden elements
    if ((node as HTMLElement).offsetWidth === 0 || (node as HTMLElement).offsetHeight === 0) {
      return -999; // definitely exclude
    }

    // penalize decorative
    if (node.getAttribute('aria-hidden') === 'true') score -= 50;
    if (['presentation', 'none', 'img'].includes(role)) score -= 30;

    return score;
  }

  // collect all elements
  function collect(node: Element, depth = 0): void {
    if (depth > 20) return;

    const role = node.getAttribute('role') || getImplicitRole(node);
    const name = getAccessibleName(node);
    const score = scoreElement(node, role, name, depth);

    if (score > -50) {
      elements.push({ node, score, depth, role, name });
    }

    for (const child of node.children) {
      collect(child, depth + 1);
    }
  }

  collect(document.body);

  // sort by score (highest first)
  elements.sort((a, b) => b.score - a.score);

  const lines: string[] = [];
  let estimatedTokens = 0;
  const includedUids = new Set<string>();

  // build snapshot staying under token budget
  for (const { node, depth, role, name } of elements) {
    const uid = `${snapshotId}_${nodeIndex}`;
    nodeIndex++;

    (node as HTMLElement).dataset.taskhomieUid = uid;
    includedUids.add(uid);

    const indent = '  '.repeat(Math.min(depth, 8));
    let line = `${indent}${uid} ${role}`;

    if (name) line += ` "${name}"`; // no truncation

    // add attributes
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href) line += ` [${href}]`;
    }
    if (node.tagName === 'INPUT') {
      const type = node.getAttribute('type') || 'text';
      const value = (node as HTMLInputElement).value;
      line += ` [${type}]`;
      if (value) line += ` value="${value}"`;
    }
    if (node.tagName === 'BUTTON' && node.getAttribute('type')) {
      line += ` [${node.getAttribute('type')}]`;
    }

    // estimate tokens (rough: 4 chars ≈ 1 token)
    estimatedTokens += line.length / 4;

    if (!verbose && estimatedTokens > maxTokens) {
      const remaining = elements.length - lines.length;
      lines.push(`\n... ${remaining} more elements omitted (use verbose=true for full context)`);
      break;
    }

    lines.push(line);
  }

  return {
    snapshot: lines.join('\n'),
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
