const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// Meta pages (overview, log) stay out of the graph — the canvas is for content pages.
const HIDDEN_CATEGORIES = new Set(['overview', 'log']);
const CATEGORY_PRIORITY = [
  'entity',
  'concept',
  'decision',
  'open-questions',
  'diagram',
  'reference',
  'wiki',
  'source',
];

function ready(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function parseGraph(root) {
  const data = root.querySelector('.knowledge-graph-data');
  if (!data?.textContent) return null;
  try {
    return JSON.parse(data.textContent);
  } catch {
    return null;
  }
}

function titleCase(value = '') {
  return value
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function categoryLabel(category) {
  return category === 'source' ? 'Sources' : titleCase(category);
}

function truncate(value, length = 34) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function categoryRank(category) {
  const rank = CATEGORY_PRIORITY.indexOf(category);
  return rank < 0 ? CATEGORY_PRIORITY.length : rank;
}

async function initGraph(root) {
  const graph = parseGraph(root);
  const stage = root.querySelector('[data-graph-stage]');
  const svgElement = root.querySelector('[data-graph-svg]');
  const tooltip = root.querySelector('[data-graph-tooltip]');
  const status = root.querySelector('[data-graph-status]');
  const openButton = root.querySelector('[data-graph-open]');
  const openTitle = root.querySelector('[data-graph-open-title]');
  if (!graph?.nodes?.length || !stage || !svgElement || !tooltip || !status || !openButton) return;

  let d3;
  try {
    d3 = await import('d3');
  } catch (error) {
    root.classList.add('knowledge-graph--failed');
    status.textContent = 'The interactive graph could not load. Use the page list below instead.';
    console.error('Knowledge graph failed to load', error);
    return;
  }

  const nodes = graph.nodes
    .filter((node) => !node.catalog && !HIDDEN_CATEGORIES.has(node.category))
    .map((node) => ({ ...node, radius: node.kind === 'source' ? 6.5 : 8 }));
  if (nodes.length === 0) return;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges.filter(
    (edge) => edge.source !== edge.target && nodeById.has(edge.source) && nodeById.has(edge.target),
  );

  let selectedId = null;
  let mode = 'whole';
  let hoveredId = null;
  let userMovedViewport = false;
  let layoutKey = '';
  let width = 0;
  let height = 0;
  let visibleNodes = [];
  let visibleEdges = [];
  let neighborIds = new Map();
  let anchors = new Map();
  let simulation = null;
  let nodeSelection = d3.select(null);
  let edgeSelection = d3.select(null);

  const activeRelations = new Set(
    [...root.querySelectorAll('[data-graph-relation][aria-pressed="true"]')].map(
      (button) => button.dataset.graphRelation,
    ),
  );

  const svg = d3.select(svgElement);
  const viewport = svg.append('g').attr('class', 'knowledge-graph-viewport');
  const clusterLayer = viewport.append('g').attr('class', 'knowledge-graph-clusters').attr('aria-hidden', 'true');
  const edgeLayer = viewport.append('g').attr('class', 'knowledge-graph-edges').attr('aria-hidden', 'true');
  const nodeLayer = viewport.append('g').attr('class', 'knowledge-graph-nodes');

  function measure() {
    const nextWidth = Math.max(320, stage.clientWidth);
    const nextHeight = Math.max(320, stage.clientHeight);
    const changed = nextWidth !== width || nextHeight !== height;
    width = nextWidth;
    height = nextHeight;
    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
    return changed;
  }

  measure();

  const zoom = d3
    .zoom()
    .scaleExtent([0.25, 4])
    .clickDistance(5)
    .filter((event) => {
      if (event.type === 'dblclick') return false;
      if (event.type === 'wheel') return true;
      return !event.target.closest?.('.knowledge-graph-node');
    })
    .on('start', (event) => {
      if (event.sourceEvent) userMovedViewport = true;
    })
    .on('zoom', (event) => {
      viewport.attr('transform', event.transform);
      syncClusterLabelScale(event.transform.k);
      if (hoveredId) positionTooltipAtNode(nodeById.get(hoveredId));
    });

  svg.call(zoom).on('dblclick.zoom', null);

  svg.on('click', (event) => {
    if (event.target.closest?.('.knowledge-graph-node')) return;
    if (mode !== 'whole' || selectedId === null) return;
    select(null);
    status.textContent = 'Selection cleared.';
  });

  // Cluster labels keep a constant on-screen size regardless of zoom level.
  function syncClusterLabelScale(scale = d3.zoomTransform(svgElement).k) {
    clusterLayer.style('font-size', `${11 / Math.max(0.2, scale)}px`);
  }

  function nodeVisible(node) {
    return node.kind !== 'source' || activeRelations.has('source');
  }

  function fallbackFocusId() {
    const candidates = nodes
      .filter(nodeVisible)
      .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.title.localeCompare(b.title));
    return candidates[0]?.id ?? null;
  }

  function compute() {
    const candidates = nodes.filter(nodeVisible);
    const candidateIds = new Set(candidates.map((node) => node.id));

    if (selectedId && !candidateIds.has(selectedId)) selectedId = null;
    if (mode === 'neighborhood' && !selectedId) selectedId = fallbackFocusId();

    const layerEdges = edges.filter(
      (edge) =>
        activeRelations.has(edge.relation) &&
        candidateIds.has(edge.source) &&
        candidateIds.has(edge.target),
    );

    if (mode === 'whole') {
      visibleNodes = candidates;
      visibleEdges = layerEdges;
    } else {
      const keep = new Set([selectedId]);
      for (const edge of layerEdges) {
        if (edge.source === selectedId) keep.add(edge.target);
        if (edge.target === selectedId) keep.add(edge.source);
      }
      visibleNodes = candidates.filter((node) => keep.has(node.id));
      visibleEdges = layerEdges.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
    }

    neighborIds = new Map(visibleNodes.map((node) => [node.id, new Set()]));
    for (const edge of visibleEdges) {
      neighborIds.get(edge.source)?.add(edge.target);
      neighborIds.get(edge.target)?.add(edge.source);
    }
  }

  function clusterAnchors() {
    const categories = [...new Set(visibleNodes.map((node) => node.category))].sort(
      (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
    );
    const positions = new Map();
    const radius = categories.length <= 1 ? 0 : 230 + categories.length * 26;
    categories.forEach((category, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, categories.length)) * Math.PI * 2;
      positions.set(category, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
    return positions;
  }

  function seedPositions() {
    anchors = mode === 'whole' ? clusterAnchors() : new Map();
    const slotByCategory = new Map();

    visibleNodes.forEach((node, index) => {
      node.fx = null;
      node.fy = null;
      if (mode === 'neighborhood') {
        if (node.id === selectedId) {
          node.x = 0;
          node.y = 0;
          node.fx = 0;
          node.fy = 0;
          return;
        }
        const angle = -Math.PI / 2 + index * GOLDEN_ANGLE;
        const ring = 140 + 22 * Math.sqrt(index);
        node.x = Math.cos(angle) * ring;
        node.y = Math.sin(angle) * ring;
        return;
      }
      const anchor = anchors.get(node.category) ?? { x: 0, y: 0 };
      const slot = slotByCategory.get(node.category) ?? 0;
      slotByCategory.set(node.category, slot + 1);
      const angle = slot * GOLDEN_ANGLE;
      const spread = 13 * Math.sqrt(slot + 1);
      node.x = anchor.x + Math.cos(angle) * spread;
      node.y = anchor.y + Math.sin(angle) * spread;
    });
  }

  function runSimulation() {
    simulation?.stop();

    simulation = d3
      .forceSimulation(visibleNodes)
      .force(
        'charge',
        d3.forceManyBody().strength(mode === 'whole' ? -60 : -260).distanceMax(mode === 'whole' ? 170 : 620),
      )
      .force('collide', d3.forceCollide().radius((node) => node.radius + (mode === 'whole' ? 10 : 30)));

    if (mode === 'whole') {
      // Edges are drawn but deliberately exert no force here — links between
      // clusters would otherwise stretch the type clumps into each other.
      simulation
        .force('x', d3.forceX((node) => (anchors.get(node.category) ?? { x: 0 }).x).strength(0.28))
        .force('y', d3.forceY((node) => (anchors.get(node.category) ?? { y: 0 }).y).strength(0.28));
    } else {
      simulation
        .force(
          'link',
          d3
            .forceLink(visibleEdges.map((edge) => ({ ...edge })))
            .id((node) => node.id)
            .distance(130)
            .strength(0.4),
        )
        .force('x', d3.forceX(0).strength(0.04))
        .force('y', d3.forceY(0).strength(0.04));
    }

    simulation.stop();
    simulation.tick(REDUCED_MOTION.matches ? 300 : 80);
    positionElements();
    if (!userMovedViewport) fitGraph(false);

    if (!REDUCED_MOTION.matches) {
      simulation.on('tick', positionElements);
      simulation.on('end', () => {
        if (!userMovedViewport) fitGraph(true);
      });
      simulation.alpha(0.25).restart();
    }
  }

  function positionElements() {
    nodeSelection.attr('transform', (node) => `translate(${node.x},${node.y})`);
    edgeSelection
      .attr('x1', (edge) => nodeById.get(edge.source)?.x ?? 0)
      .attr('y1', (edge) => nodeById.get(edge.source)?.y ?? 0)
      .attr('x2', (edge) => nodeById.get(edge.target)?.x ?? 0)
      .attr('y2', (edge) => nodeById.get(edge.target)?.y ?? 0);
    if (mode === 'whole') renderClusterLabels();
  }

  function renderClusterLabels() {
    const groups = d3.group(visibleNodes, (node) => node.category);
    const labels = [...groups.entries()].map(([category, members]) => ({
      category,
      count: members.length,
      x: d3.mean(members, (node) => node.x) ?? 0,
      y: (d3.min(members, (node) => node.y - node.radius) ?? 0) - 24,
    }));
    clusterLayer
      .selectAll('text')
      .data(labels, (label) => label.category)
      .join('text')
      .attr('class', 'knowledge-graph-cluster-label')
      .attr('x', (label) => label.x)
      .attr('y', (label) => label.y)
      .text((label) => `${categoryLabel(label.category)} · ${label.count}`);
  }

  // Whole map: edges appear only for the hovered and the selected node.
  // Neighborhood: the focused subgraph shows all of its edges.
  function displayedEdges() {
    if (mode === 'neighborhood') return visibleEdges;
    if (hoveredId === null && selectedId === null) return [];
    return visibleEdges.filter(
      (edge) =>
        edge.source === hoveredId ||
        edge.target === hoveredId ||
        edge.source === selectedId ||
        edge.target === selectedId,
    );
  }

  function renderEdges() {
    edgeSelection = edgeLayer
      .selectAll('line')
      .data(displayedEdges(), (edge) => edge.id)
      .join('line')
      .attr('class', (edge) => `knowledge-graph-edge knowledge-graph-edge--${edge.relation}`)
      .classed(
        'is-active',
        (edge) => hoveredId !== null && (edge.source === hoveredId || edge.target === hoveredId),
      )
      .classed(
        'is-muted',
        (edge) =>
          mode === 'neighborhood' &&
          hoveredId !== null &&
          edge.source !== hoveredId &&
          edge.target !== hoveredId,
      )
      .attr('x1', (edge) => nodeById.get(edge.source)?.x ?? 0)
      .attr('y1', (edge) => nodeById.get(edge.source)?.y ?? 0)
      .attr('x2', (edge) => nodeById.get(edge.target)?.x ?? 0)
      .attr('y2', (edge) => nodeById.get(edge.target)?.y ?? 0);
  }

  function labelVisible(node, hoverNeighbors, selectedNeighbors) {
    if (node.id === hoveredId || node.id === selectedId) return true;
    if (mode === 'neighborhood') return true;
    return (hoverNeighbors?.has(node.id) ?? false) || (selectedNeighbors?.has(node.id) ?? false);
  }

  function applyEmphasis() {
    renderEdges();
    const hoverNeighbors = hoveredId ? neighborIds.get(hoveredId) ?? new Set() : null;
    const selectedNeighbors = selectedId ? neighborIds.get(selectedId) ?? new Set() : null;

    nodeSelection
      .classed('is-selected', (node) => node.id === selectedId)
      .classed('is-hovered', (node) => node.id === hoveredId)
      .classed(
        'is-neighbor',
        (node) => (hoverNeighbors?.has(node.id) || selectedNeighbors?.has(node.id)) ?? false,
      )
      .classed(
        'is-dimmed',
        (node) =>
          hoveredId !== null &&
          node.id !== hoveredId &&
          node.id !== selectedId &&
          !hoverNeighbors?.has(node.id) &&
          !selectedNeighbors?.has(node.id),
      );

    nodeSelection
      .select('.knowledge-graph-node-label')
      .classed('is-visible', (node) => labelVisible(node, hoverNeighbors, selectedNeighbors));
  }

  function syncOpenButton() {
    const node = selectedId ? nodeById.get(selectedId) : null;
    if (!node) {
      openButton.hidden = true;
      return;
    }
    openButton.hidden = false;
    openButton.href = node.href;
    if (openTitle) openTitle.textContent = truncate(node.title, 44);
  }

  function select(id, { announce = true } = {}) {
    selectedId = id;
    if (mode === 'neighborhood') {
      userMovedViewport = false;
      update();
    } else {
      applyEmphasis();
      syncOpenButton();
    }
    if (announce && id) {
      const node = nodeById.get(id);
      status.textContent = `${node.title} selected. Use the Open page button, or the Neighborhood view to explore around it.`;
    }
  }

  function activate(node) {
    if (node.id === selectedId) {
      window.location.assign(node.href);
      return;
    }
    select(node.id);
  }

  function render() {
    nodeSelection = nodeLayer
      .selectAll('g.knowledge-graph-node')
      .data(visibleNodes, (node) => node.id)
      .join(
        (enter) => {
          const group = enter
            .append('g')
            .attr('class', 'knowledge-graph-node')
            .attr('role', 'button')
            .attr('tabindex', 0);
          group.append('circle').attr('class', 'knowledge-graph-node-hit');
          group.append('path').attr('class', 'knowledge-graph-node-mark');
          group.append('text').attr('class', 'knowledge-graph-node-label');
          group.append('title');
          return group;
        },
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('class', (node) =>
        [
          'knowledge-graph-node',
          `knowledge-graph-node--${node.kind}`,
          `knowledge-graph-node--status-${node.status || 'none'}`,
        ].join(' '),
      )
      .attr('aria-label', (node) =>
        `${node.title}, ${categoryLabel(node.category)}. Select to show its connections; select again to open.`,
      );

    nodeSelection.select('.knowledge-graph-node-hit').attr('r', (node) => Math.max(17, node.radius + 8));
    nodeSelection
      .select('.knowledge-graph-node-mark')
      .attr('d', (node) =>
        d3
          .symbol()
          .type(node.kind === 'source' ? d3.symbolSquare : d3.symbolCircle)
          .size(node.radius * node.radius * (node.kind === 'source' ? 3.2 : Math.PI))(),
      );
    nodeSelection
      .select('.knowledge-graph-node-label')
      .attr('text-anchor', 'middle')
      .attr('x', 0)
      .attr('y', (node) => node.radius + 15)
      .text((node) => truncate(node.title));
    nodeSelection.select('title').text((node) => node.title);

    nodeSelection
      .on('pointerenter', (event, node) => {
        hoveredId = node.id;
        applyEmphasis();
        positionTooltipFromPointer(node, event);
      })
      .on('pointermove', (event, node) => positionTooltipFromPointer(node, event))
      .on('pointerleave', () => {
        hoveredId = null;
        hideTooltip();
        applyEmphasis();
      })
      .on('focus', (_event, node) => {
        hoveredId = node.id;
        applyEmphasis();
        positionTooltipAtNode(node);
        const connectionCount = neighborIds.get(node.id)?.size ?? 0;
        status.textContent = `${node.title}. ${connectionCount} visible ${connectionCount === 1 ? 'connection' : 'connections'}.`;
      })
      .on('blur', () => {
        hoveredId = null;
        hideTooltip();
        applyEmphasis();
      })
      .on('click', (event, node) => {
        if (node.suppressClick) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
        activate(node);
      })
      .on('dblclick', (event, node) => {
        event.preventDefault();
        window.location.assign(node.href);
      })
      .on('keydown', (event, node) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        activate(node);
      });

    const drag = d3
      .drag()
      .on('start', (event, node) => {
        event.sourceEvent?.stopPropagation();
        node.dragStartX = event.x;
        node.dragStartY = event.y;
        node.dragged = false;
        node.fx = node.x;
        node.fy = node.y;
        if (!REDUCED_MOTION.matches) simulation?.alphaTarget(0.1).restart();
      })
      .on('drag', (event, node) => {
        if (Math.hypot(event.x - node.dragStartX, event.y - node.dragStartY) > 3) node.dragged = true;
        node.fx = event.x;
        node.fy = event.y;
        node.x = event.x;
        node.y = event.y;
        if (REDUCED_MOTION.matches || !simulation) positionElements();
      })
      .on('end', (_event, node) => {
        if (!REDUCED_MOTION.matches) simulation?.alphaTarget(0);
        if (!(mode === 'neighborhood' && node.id === selectedId)) {
          node.fx = null;
          node.fy = null;
        }
        node.suppressClick = node.dragged;
        window.setTimeout(() => {
          node.suppressClick = false;
        }, 140);
      });

    nodeSelection.call(drag);

    if (mode !== 'whole') clusterLayer.selectAll('*').remove();
    applyEmphasis();
  }

  function graphBounds() {
    if (visibleNodes.length === 0) return null;
    return {
      minX: d3.min(visibleNodes, (node) => node.x - node.radius - 60) ?? 0,
      maxX: d3.max(visibleNodes, (node) => node.x + node.radius + 60) ?? width,
      minY: d3.min(visibleNodes, (node) => node.y - node.radius - 52) ?? 0,
      maxY: d3.max(visibleNodes, (node) => node.y + node.radius + 34) ?? height,
    };
  }

  function fitGraph(animate = true) {
    const bounds = graphBounds();
    if (!bounds) return;
    const padding = 30;
    const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.max(
      0.25,
      Math.min(2.1, Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight)),
    );
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    if (animate && !REDUCED_MOTION.matches) {
      svg.transition().duration(220).call(zoom.transform, transform);
    } else {
      svg.call(zoom.transform, transform);
    }
  }

  function update() {
    hoveredId = null;
    hideTooltip();
    compute();
    render();
    // Re-layout only when the set of positioned nodes changes; toggling an
    // edge layer that adds no nodes must not shuffle the map around.
    const key = `${mode}:${selectedId ?? ''}:${visibleNodes.map((node) => node.id).join(',')}`;
    if (key !== layoutKey) {
      layoutKey = key;
      seedPositions();
      runSimulation();
    } else {
      positionElements();
    }
    syncOpenButton();
    root.dataset.graphMode = mode;
  }

  function positionTooltip(node, x, y) {
    if (!node) return;
    tooltip.textContent = node.title;
    tooltip.hidden = false;
    requestAnimationFrame(() => {
      const padding = 10;
      const maxX = Math.max(padding, stage.clientWidth - tooltip.offsetWidth - padding);
      const maxY = Math.max(padding, stage.clientHeight - tooltip.offsetHeight - padding);
      tooltip.style.left = `${Math.min(Math.max(x + 12, padding), maxX)}px`;
      tooltip.style.top = `${Math.min(Math.max(y - tooltip.offsetHeight - 12, padding), maxY)}px`;
    });
  }

  function positionTooltipFromPointer(node, event) {
    const rect = stage.getBoundingClientRect();
    positionTooltip(node, event.clientX - rect.left, event.clientY - rect.top);
  }

  function positionTooltipAtNode(node) {
    if (!node) return;
    const transform = d3.zoomTransform(svgElement);
    const [x, y] = transform.apply([node.x, node.y]);
    positionTooltip(node, x, y);
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function changeZoom(factor) {
    if (REDUCED_MOTION.matches) {
      svg.call(zoom.scaleBy, factor);
    } else {
      svg.transition().duration(160).call(zoom.scaleBy, factor);
    }
  }

  root.querySelector('[data-graph-action="zoom-out"]')?.addEventListener('click', () => changeZoom(0.8));
  root.querySelector('[data-graph-action="zoom-in"]')?.addEventListener('click', () => changeZoom(1.25));
  root.querySelector('[data-graph-action="fit"]')?.addEventListener('click', () => {
    userMovedViewport = false;
    fitGraph();
  });

  root.querySelectorAll('[data-graph-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (mode === button.dataset.graphMode) return;
      mode = button.dataset.graphMode;
      root.querySelectorAll('[data-graph-mode]').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === button));
      });
      userMovedViewport = false;
      update();
      status.textContent =
        mode === 'whole'
          ? 'Showing the whole map, clustered by page type.'
          : `Showing the pages directly connected to ${nodeById.get(selectedId)?.title ?? 'the selected page'}.`;
    });
  });

  root.querySelectorAll('[data-graph-relation]').forEach((button) => {
    button.addEventListener('click', () => {
      const relation = button.dataset.graphRelation;
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(pressed));
      if (pressed) activeRelations.add(relation);
      else activeRelations.delete(relation);
      userMovedViewport = false;
      update();
    });
  });

  const resizeObserver = new ResizeObserver(() => {
    if (!measure()) return;
    if (!userMovedViewport) fitGraph(false);
  });
  resizeObserver.observe(stage);

  update();
  root.classList.add('knowledge-graph--ready');
}

ready(() => {
  for (const root of document.querySelectorAll('[data-knowledge-graph]')) {
    initGraph(root);
  }
});
