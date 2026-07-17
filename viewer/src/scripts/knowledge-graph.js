const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

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

async function initGraph(root) {
  const graph = parseGraph(root);
  const stage = root.querySelector('[data-graph-stage]');
  const svgElement = root.querySelector('[data-graph-svg]');
  const tooltip = root.querySelector('[data-graph-tooltip]');
  const status = root.querySelector('[data-graph-status]');
  if (!graph?.nodes?.length || !stage || !svgElement || !tooltip || !status) return;

  let d3;
  try {
    d3 = await import('d3');
  } catch (error) {
    root.classList.add('knowledge-graph--failed');
    status.textContent = 'The interactive graph could not load. Use the page list below instead.';
    console.error('Knowledge graph failed to load', error);
    return;
  }

  const nodes = graph.nodes.map((node) => ({ ...node }));
  const links = graph.edges.map((edge) => ({ ...edge }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));

  for (const link of links) {
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  for (const node of nodes) {
    node.radius = Math.min(17, 7 + Math.sqrt(degree.get(node.id) ?? 0) * 2.4);
  }

  const svg = d3.select(svgElement);
  const viewport = svg.append('g').attr('class', 'knowledge-graph-viewport');
  const edgeLayer = viewport.append('g').attr('class', 'knowledge-graph-edges').attr('aria-hidden', 'true');
  const nodeLayer = viewport.append('g').attr('class', 'knowledge-graph-nodes');

  const edgeSelection = edgeLayer
    .selectAll('line')
    .data(links, (link) => link.id)
    .join('line')
    .attr('class', 'knowledge-graph-edge');

  const nodeSelection = nodeLayer
    .selectAll('a')
    .data(nodes, (node) => node.id)
    .join('a')
    .attr('class', (node) =>
      [
        'knowledge-graph-node',
        `knowledge-graph-node--${node.kind}`,
        node.catalog ? 'knowledge-graph-node--catalog' : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .attr('href', (node) => node.href)
    .attr('aria-label', (node) => `Open ${node.title}`)
    .attr('tabindex', 0);

  nodeSelection
    .append('circle')
    .attr('class', 'knowledge-graph-node-hit')
    .attr('r', (node) => Math.max(16, node.radius + 7));

  nodeSelection
    .append('path')
    .attr('class', 'knowledge-graph-node-mark')
    .attr('d', (node) =>
      d3
        .symbol()
        .type(node.kind === 'source' ? d3.symbolSquare : d3.symbolCircle)
        .size(node.radius * node.radius * (node.kind === 'source' ? 3.2 : Math.PI))(),
    );

  nodeSelection.append('title').text((node) => node.title);

  let width = 0;
  let height = 0;
  let userMovedViewport = false;
  let activeNodeId = null;

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

  const linkForce = d3
    .forceLink(links)
    .id((node) => node.id)
    .distance(88)
    .strength(0.36);

  const simulation = d3
    .forceSimulation(nodes)
    .force('link', linkForce)
    .force('charge', d3.forceManyBody().strength((node) => -120 - node.radius * 5))
    .force('collide', d3.forceCollide().radius((node) => node.radius + 9).iterations(2))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.035))
    .force('y', d3.forceY(height / 2).strength(0.035))
    .alphaDecay(0.045);

  function render() {
    edgeSelection
      .attr('x1', (link) => link.source.x)
      .attr('y1', (link) => link.source.y)
      .attr('x2', (link) => link.target.x)
      .attr('y2', (link) => link.target.y);

    nodeSelection.attr('transform', (node) => `translate(${node.x},${node.y})`);
  }

  function setEmphasis(node) {
    activeNodeId = node?.id ?? null;
    if (!node) {
      nodeSelection.classed('is-neighbor', false).classed('is-dimmed', false);
      edgeSelection.classed('is-active', false).classed('is-dimmed', false);
      return;
    }

    const neighbors = adjacency.get(node.id) ?? new Set();
    nodeSelection
      .classed('is-neighbor', (candidate) => neighbors.has(candidate.id))
      .classed('is-dimmed', (candidate) => candidate.id !== node.id && !neighbors.has(candidate.id));
    edgeSelection
      .classed('is-active', (link) => link.source.id === node.id || link.target.id === node.id)
      .classed('is-dimmed', (link) => link.source.id !== node.id && link.target.id !== node.id);
  }

  function positionTooltip(node, x, y) {
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

  function positionTooltipAtNode(node) {
    const transform = d3.zoomTransform(svgElement);
    const [x, y] = transform.apply([node.x, node.y]);
    positionTooltip(node, x, y);
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  nodeSelection
    .on('pointerenter', function (event, node) {
      setEmphasis(node);
      const rect = stage.getBoundingClientRect();
      positionTooltip(node, event.clientX - rect.left, event.clientY - rect.top);
    })
    .on('pointermove', function (event, node) {
      const rect = stage.getBoundingClientRect();
      positionTooltip(node, event.clientX - rect.left, event.clientY - rect.top);
    })
    .on('pointerleave', function () {
      if (document.activeElement !== this) {
        hideTooltip();
        setEmphasis(null);
      }
    })
    .on('focus', function (_event, node) {
      setEmphasis(node);
      positionTooltipAtNode(node);
      const connections = degree.get(node.id) ?? 0;
      status.textContent = `${node.title}. ${connections} ${connections === 1 ? 'connection' : 'connections'}. Press Enter to open.`;
    })
    .on('blur', function () {
      hideTooltip();
      setEmphasis(null);
    })
    .on('click', function (event, node) {
      if (!node.suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    });

  const zoom = d3
    .zoom()
    .scaleExtent([0.28, 4])
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
      if (activeNodeId) {
        const node = nodeById.get(activeNodeId);
        if (node && document.activeElement?.closest?.('.knowledge-graph-node')) {
          positionTooltipAtNode(node);
        }
      }
    });

  svg.call(zoom).on('dblclick.zoom', null);

  const drag = d3
    .drag()
    .on('start', (event, node) => {
      event.sourceEvent?.stopPropagation();
      node.dragStartX = event.x;
      node.dragStartY = event.y;
      node.dragged = false;
      if (!event.active && !REDUCED_MOTION.matches) simulation.alphaTarget(0.25).restart();
      node.fx = node.x;
      node.fy = node.y;
    })
    .on('drag', (event, node) => {
      if (Math.hypot(event.x - node.dragStartX, event.y - node.dragStartY) > 3) node.dragged = true;
      node.fx = event.x;
      node.fy = event.y;
      if (REDUCED_MOTION.matches) render();
    })
    .on('end', (event, node) => {
      if (!event.active && !REDUCED_MOTION.matches) simulation.alphaTarget(0);
      node.fx = null;
      node.fy = null;
      node.suppressClick = node.dragged;
      window.setTimeout(() => {
        node.suppressClick = false;
      }, 120);
    });

  nodeSelection.call(drag);

  function graphBounds() {
    const positioned = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
    if (positioned.length === 0) return null;
    return {
      minX: d3.min(positioned, (node) => node.x - node.radius) ?? 0,
      maxX: d3.max(positioned, (node) => node.x + node.radius) ?? width,
      minY: d3.min(positioned, (node) => node.y - node.radius) ?? 0,
      maxY: d3.max(positioned, (node) => node.y + node.radius) ?? height,
    };
  }

  function fitGraph(animate = true) {
    const bounds = graphBounds();
    if (!bounds) return;
    const padding = 54;
    const graphWidth = Math.max(1, bounds.maxX - bounds.minX);
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.max(
      0.28,
      Math.min(2.2, Math.min((width - padding * 2) / graphWidth, (height - padding * 2) / graphHeight)),
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

  simulation.on('tick', render).on('end', () => {
    render();
    if (!userMovedViewport) fitGraph();
  });

  if (REDUCED_MOTION.matches) {
    simulation.stop();
    for (let index = 0; index < 280; index++) simulation.tick();
    render();
    fitGraph(false);
  }

  const resizeObserver = new ResizeObserver(() => {
    if (!measure()) return;
    simulation
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.035))
      .force('y', d3.forceY(height / 2).strength(0.035));

    if (REDUCED_MOTION.matches) {
      simulation.stop();
      for (let index = 0; index < 80; index++) simulation.tick();
      render();
      if (!userMovedViewport) fitGraph(false);
    } else {
      simulation.alpha(0.18).restart();
    }
  });
  resizeObserver.observe(stage);

  root.classList.add('knowledge-graph--ready');
}

ready(() => {
  for (const root of document.querySelectorAll('[data-knowledge-graph]')) {
    initGraph(root);
  }
});
