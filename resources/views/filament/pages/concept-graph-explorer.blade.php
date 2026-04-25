<div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Seed (preferred term)</label>
                        <input
                            type="text"
                            class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                            wire:model.defer="seed"
                            placeholder="e.g. creativity"
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Complexity</label>
                            <input
                                type="number"
                                min="1"
                                max="5"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="complexity"
                            />
                        </div>
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
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Relationship type (optional)</label>
                            <input
                                type="text"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="relationshipType"
                                placeholder="lateral"
                            />
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
                    style="aspect-ratio: 2 / 1; height: auto; min-height: 420px; max-height: 70vh;"
                    wire:ignore
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
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-200">Relationship type</label>
                            <input
                                type="text"
                                class="mt-1 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100"
                                wire:model.defer="edgeForm.relationship_type"
                            />
                        </div>

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
                console.log('[ConceptGraphExplorer] renderConceptGraph()', {
                    attempt,
                    hasContainer: !!container,
                    elementsType: Array.isArray(elements) ? 'array' : typeof elements,
                    elementsLength: Array.isArray(elements) ? elements.length : null,
                });
                if (!container) return;

                if (!window.cytoscape) {
                    if (attempt === 0) {
                        container.innerHTML = '<div class="p-4 text-sm text-gray-600">Graph library not loaded yet. Loading…</div>';
                    }

                    console.log('[ConceptGraphExplorer] cytoscape not ready yet', { attempt });
                    if (attempt < 50) {
                        window.setTimeout(() => renderConceptGraph(elements, attempt + 1), 100);
                    }

                    return;
                }

                console.log('[ConceptGraphExplorer] cytoscape ready', {
                    attempt,
                    containerWidth: container.clientWidth,
                    containerHeight: container.clientHeight,
                });

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
                                'background-color': '#f59e0b',
                                'color': '#111827',
                                'text-valign': 'center',
                                'text-halign': 'center',
                                'font-size': 10,
                                'text-wrap': 'wrap',
                                'text-max-width': 110,
                                'width': 28,
                                'height': 28,
                            }
                        },
                        {
                            selector: 'edge',
                            style: {
                                'label': 'data(label)',
                                'curve-style': 'bezier',
                                'target-arrow-shape': 'triangle',
                                'target-arrow-color': '#6b7280',
                                'line-color': '#6b7280',
                                'width': 'mapData(strength, 0, 1, 1, 6)',
                                'font-size': 9,
                                'text-rotation': 'autorotate',
                                'text-margin-y': -8,
                                'color': '#374151',
                            }
                        },
                        {
                            selector: '.selected',
                            style: {
                                'line-color': '#f59e0b',
                                'target-arrow-color': '#f59e0b',
                            }
                        }
                    ],
                    layout: {
                        name: 'cose',
                        animate: false,
                    }
                });

                console.log('[ConceptGraphExplorer] cy created', {
                    nodes: cy.nodes().length,
                    edges: cy.edges().length,
                });

                cy.on('tap', 'edge', function (evt) {
                    cy.edges().removeClass('selected');
                    evt.target.addClass('selected');
                    const id = evt.target.data('relationship_id');
                    console.log('[ConceptGraphExplorer] edge tapped', { relationshipId: id });
                    if (window.Livewire) {
                        window.Livewire.dispatch('selectRelationship', { relationshipId: id });
                    }
                });

                cy.on('tap', 'node', function (evt) {
                    const nodeId = evt.target.id(); // e.g. c123
                    const conceptId = evt.target.data('concept_id') ?? parseInt(String(nodeId).replace(/^c/, ''), 10);
                    const openEdit = evt.originalEvent?.metaKey || evt.originalEvent?.ctrlKey;
                    console.log('[ConceptGraphExplorer] node tapped', { nodeId, conceptId, openEdit });
                    if (Number.isFinite(conceptId) && window.Livewire) {
                        if (openEdit) {
                            window.Livewire.dispatch('navigateToConcept', { conceptId });
                        } else {
                            window.Livewire.dispatch('setSeedFromConcept', { conceptId });
                        }
                    }
                });

                window.__conceptGraphCy = cy;
            }

            // Filament may run in SPA mode; DOMContentLoaded won't fire on internal navigations.
            // We render on page load and on Livewire navigations, with retry until Cytoscape is available.
            window.addEventListener('load', () => {
                console.log('[ConceptGraphExplorer] window load');
                renderConceptGraph(@js($graphElements));
            });
            document.addEventListener('livewire:navigated', () => {
                console.log('[ConceptGraphExplorer] livewire:navigated');
                renderConceptGraph(@js($graphElements));
            });

            document.addEventListener('livewire:init', () => {
                if (!window.Livewire) return;
                console.log('[ConceptGraphExplorer] livewire:init');
                window.Livewire.on('concept-graph-updated', (payload) => {
                    // Livewire v3 may pass params as (payload) or as an array of args.
                    const data = Array.isArray(payload) ? (payload[0] ?? {}) : (payload ?? {});
                    console.log('[ConceptGraphExplorer] concept-graph-updated', { payload, data });
                    renderConceptGraph(data.elements ?? []);
                });
            });
        </script>
</div>

