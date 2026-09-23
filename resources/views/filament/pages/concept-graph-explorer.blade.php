<div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Start concept</label>
                        <input
                            type="text"
                            class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                            wire:model.defer="seed"
                            placeholder="e.g. Cleopatra"
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Limit</label>
                            <input
                                type="number"
                                min="1"
                                max="500"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="limit"
                            />
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Depth</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="depth"
                            />
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Min strength</label>
                            <input
                                type="number"
                                step="0.001"
                                min="0"
                                max="1"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="minStrength"
                            />
                        </div>
                        <div>
                            <div class="mt-7 text-xs text-gray-600 dark:text-gray-300">
                                Tip: click a node to re-center. Shift+click expands one more hop. Cmd/Ctrl+click edits the concept. Hover for 2 seconds to see the description.
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <x-filament::button wire:click="loadGraph">
                        Load graph
                    </x-filament::button>

                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        Click an edge to edit its parameters.
                    </div>
                </div>

                <div
                    id="concept-graph"
                    class="w-full rounded-lg bg-gray-50 ring-1 ring-gray-950/5 dark:bg-gray-950 dark:ring-white/10"
                    style="aspect-ratio: 4 / 3; height: auto; min-height: 520px; max-height: 80vh;"
                    wire:ignore
                ></div>
                <div
                    id="concept-graph-tooltip"
                    class="fixed z-50 hidden max-w-sm rounded-lg bg-white p-3 text-sm text-gray-800 shadow-lg ring-1 ring-gray-950/10 dark:bg-gray-900 dark:text-gray-100 dark:ring-white/10"
                ></div>
    </div>

    <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
        <div class="text-base font-semibold text-gray-900 dark:text-gray-100">Selected edge</div>

                @if ($selectedRelationshipId)
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        Relationship ID: <span class="font-mono">{{ $selectedRelationshipId }}</span>
                    </div>

                    <div class="grid grid-cols-1 gap-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Strength (0..1)</label>
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.00001"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="edgeForm.strength"
                            />
                        </div>

                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">User weight</label>
                            <input
                                type="number"
                                step="1"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="edgeForm.user_weight"
                            />
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <x-filament::button wire:click="saveEdge">
                            Save edge
                        </x-filament::button>

                        <x-filament::button color="gray" wire:click="loadGraph">
                            Refresh
                        </x-filament::button>
                    </div>
                @else
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        Click an edge in the graph to load it here.
                    </div>
                @endif
    </div>

    <script>
            function renderConceptGraph(elements, attempt = 0) {
                const container = document.getElementById('concept-graph');
                if (!container) return;
                const tooltip = document.getElementById('concept-graph-tooltip');
                let tooltipTimer = null;

                function hideTooltip() {
                    if (tooltipTimer) {
                        window.clearTimeout(tooltipTimer);
                        tooltipTimer = null;
                    }
                    if (tooltip) tooltip.classList.add('hidden');
                }

                if (!window.cytoscape) {
                    if (attempt === 0) {
                        container.replaceChildren();
                        const loading = document.createElement('div');
                        loading.className = 'p-4 text-sm text-gray-600';
                        loading.textContent = 'Graph library not loaded yet. Loading...';
                        container.appendChild(loading);
                    }

                    if (attempt < 50) {
                        window.setTimeout(() => renderConceptGraph(elements, attempt + 1), 100);
                    }

                    return;
                }

                if (window.__conceptGraphCy) {
                    window.__conceptGraphCy.destroy();
                }

                const cy = window.cytoscape({
                    container,
                    elements: elements ?? [],
                    style: [
                        {
                            selector: 'node',
                            style: {
                                'label': 'data(label)',
                                'background-color': '#d97706',
                                'border-width': 2,
                                'border-color': '#78350f',
                                'color': '#0f172a',
                                'text-valign': 'bottom',
                                'text-halign': 'center',
                                'text-margin-y': 8,
                                'font-size': 16,
                                'font-weight': 700,
                                'text-wrap': 'wrap',
                                'text-max-width': 140,
                                'text-background-color': '#fffbeb',
                                'text-background-opacity': 0.95,
                                'text-background-padding': '4px',
                                'text-background-shape': 'roundrectangle',
                                'text-outline-width': 2,
                                'text-outline-color': '#fffbeb',
                                'min-zoomed-font-size': 10,
                                'width': 42,
                                'height': 42,
                            }
                        },
                        {
                            selector: 'edge',
                            style: {
                                'label': 'data(label)',
                                'curve-style': 'bezier',
                                'line-color': '#6b7280',
                                'width': 'mapData(strength, 0, 1, 1, 6)',
                                'font-size': 13,
                                'font-weight': 600,
                                'text-rotation': 'autorotate',
                                'text-margin-y': -10,
                                'color': '#111827',
                                'text-background-color': '#ffffff',
                                'text-background-opacity': 0.92,
                                'text-background-padding': '3px',
                                'text-outline-width': 2,
                                'text-outline-color': '#ffffff',
                                'min-zoomed-font-size': 8,
                            }
                        },
                        {
                            selector: '.selected',
                            style: {
                                'line-color': '#f59e0b',
                            }
                        }
                    ],
                    layout: {
                        name: 'cose',
                        animate: false,
                        // Spread nodes further apart so larger labels stay readable.
                        idealEdgeLength: 180,
                        nodeRepulsion: 1200000,
                        edgeElasticity: 100,
                        gravity: 0.01,
                        numIter: 30000,
                    }
                });

                cy.on('tap', 'edge', function (evt) {
                    cy.edges().removeClass('selected');
                    evt.target.addClass('selected');
                    const id = evt.target.data('relationship_id');
                    if (window.Livewire) {
                        window.Livewire.dispatch('selectRelationship', { relationshipId: id });
                    }
                });

                cy.on('tap', 'node', function (evt) {
                    const nodeId = evt.target.id(); // e.g. c123
                    const conceptId = evt.target.data('concept_id') ?? parseInt(String(nodeId).replace(/^c/, ''), 10);
                    const openEdit = evt.originalEvent?.metaKey || evt.originalEvent?.ctrlKey;
                    const expand = evt.originalEvent?.shiftKey;
                    if (Number.isFinite(conceptId) && window.Livewire) {
                        if (openEdit) {
                            window.Livewire.dispatch('navigateToConcept', { conceptId });
                        } else if (expand) {
                            window.Livewire.dispatch('expandConcept', { conceptId });
                        } else {
                            window.Livewire.dispatch('setSeedFromConcept', { conceptId });
                        }
                    }
                });

                cy.on('mouseover', 'node', function (evt) {
                    hideTooltip();
                    if (!tooltip) return;

                    const node = evt.target;
                    const position = evt.renderedPosition ?? { x: 0, y: 0 };
                    tooltipTimer = window.setTimeout(() => {
                        const label = String(node.data('label') ?? '');
                        const description = String(node.data('shortDescription') ?? '');
                        const complexity = String(node.data('complexity') ?? '');
                        const degree = String(node.data('degree') ?? '');
                        const wikiUrl = node.data('wikiUrl');
                        const mediaUrl = node.data('mediaUrl');

                        tooltip.replaceChildren();

                        const title = document.createElement('div');
                        title.className = 'font-semibold';
                        title.textContent = label;
                        tooltip.appendChild(title);

                        const descriptionEl = document.createElement('div');
                        descriptionEl.className = 'mt-1';
                        descriptionEl.textContent = description;
                        tooltip.appendChild(descriptionEl);

                        const meta = document.createElement('div');
                        meta.className = 'mt-2 text-xs opacity-75';
                        meta.textContent = `Complexity ${complexity} · Degree ${degree}`;
                        tooltip.appendChild(meta);

                        const links = document.createElement('div');
                        links.className = 'mt-2 pointer-events-auto';
                        let hasLinks = false;

                        if (wikiUrl) {
                            const wiki = document.createElement('a');
                            wiki.className = 'text-primary-600 underline';
                            wiki.href = String(wikiUrl);
                            wiki.target = '_blank';
                            wiki.rel = 'noreferrer';
                            wiki.textContent = 'Wikipedia';
                            links.appendChild(wiki);
                            hasLinks = true;
                        }

                        if (mediaUrl) {
                            if (hasLinks) {
                                links.appendChild(document.createTextNode(' · '));
                            }
                            const media = document.createElement('a');
                            media.className = 'text-primary-600 underline';
                            media.href = String(mediaUrl);
                            media.target = '_blank';
                            media.rel = 'noreferrer';
                            media.textContent = 'Media';
                            links.appendChild(media);
                            hasLinks = true;
                        }

                        if (hasLinks) {
                            tooltip.appendChild(links);
                        }

                        const rect = container.getBoundingClientRect();
                        tooltip.style.left = `${Math.min(window.innerWidth - 280, rect.left + position.x + 16)}px`;
                        tooltip.style.top = `${Math.max(12, rect.top + position.y + 16)}px`;
                        tooltip.classList.remove('hidden');
                    }, 2000);
                });

                cy.on('mouseout', 'node', hideTooltip);
                cy.on('pan zoom drag', hideTooltip);

                window.__conceptGraphCy = cy;
            }

            // Filament may run in SPA mode; DOMContentLoaded won't fire on internal navigations.
            // We render on page load and on Livewire navigations, with retry until Cytoscape is available.
            window.addEventListener('load', () => {
                renderConceptGraph(@js($graphElements));
            });
            document.addEventListener('livewire:navigated', () => {
                renderConceptGraph(@js($graphElements));
            });

            document.addEventListener('livewire:init', () => {
                if (!window.Livewire) return;
                window.Livewire.on('concept-graph-updated', (payload) => {
                    // Livewire v3 may pass params as (payload) or as an array of args.
                    const data = Array.isArray(payload) ? (payload[0] ?? {}) : (payload ?? {});
                    renderConceptGraph(data.elements ?? []);
                });
            });
        </script>
</div>

