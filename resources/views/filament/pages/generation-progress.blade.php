@php
    $progress = $this->progress();
    $stageCounts = $progress->stageCounts();
    $nodesByDepth = $progress->nodesByDepth();
    $failures = $progress->failures();
    $percent = $progress->percent();
    $etaSeconds = $progress->estimatedRemainingSeconds();
    $stageLabels = [
        'generate' => 'Generate',
        'localize' => 'Localise',
        'complete_info' => 'Complete info',
    ];
    $statusLabels = [
        'pending' => 'pending',
        'processing' => 'processing',
        'succeeded' => 'succeeded',
        'failed' => 'failed',
        'skipped' => 'skipped',
    ];
    $statusColors = [
        'pending' => 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200',
        'processing' => 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
        'succeeded' => 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
        'failed' => 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
        'skipped' => 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    ];
@endphp

<x-filament-panels::page>
    <div @if ($progress->pollingInterval()) wire:poll.{{ $progress->pollingInterval() }} @endif class="flex flex-col gap-6">
        <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <div class="flex items-end justify-between gap-4">
                <div>
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">Progress</p>
                    <p class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">{{ $percent }}%</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">ETA</p>
                    <p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        @if ($etaSeconds === null)
                            {{ $progress->isActive() ? 'Unavailable until a node finishes' : 'Run finished' }}
                        @elseif ($etaSeconds < 60)
                            About {{ $etaSeconds }}s remaining
                        @else
                            About {{ (int) ceil($etaSeconds / 60) }} min remaining
                        @endif
                    </p>
                </div>
            </div>
            <div
                class="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="{{ $percent }}"
            >
                <div class="h-full rounded-full bg-primary-500" style="width: {{ min(100, $percent) }}%"></div>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {{ $progress->completedStageCount() }} / {{ $progress->totalStageCount() }} stages complete
                @if ($progress->isActive())
                    · auto-refresh every 5s
                @endif
            </p>
        </div>

        <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
            <h3 class="text-sm font-medium text-gray-950 dark:text-white">Per-stage counts</h3>
            <div class="mt-3 overflow-x-auto">
                <table class="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                        <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                            <th class="py-2 pr-3 font-medium">Stage</th>
                            @foreach ($statusLabels as $status => $label)
                                <th class="py-2 px-2 font-medium">{{ $label }}</th>
                            @endforeach
                        </tr>
                    </thead>
                    <tbody>
                        @foreach ($stageLabels as $stage => $label)
                            <tr class="border-b border-gray-100 dark:border-white/5">
                                <td class="py-2 pr-3 font-medium text-gray-900 dark:text-gray-100">{{ $label }}</td>
                                @foreach ($statusLabels as $status => $statusLabel)
                                    <td class="py-2 px-2 text-gray-700 dark:text-gray-300">{{ $stageCounts[$stage][$status] ?? 0 }}</td>
                                @endforeach
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>

        @if ($failures !== [])
            <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
                <h3 class="text-sm font-medium text-gray-950 dark:text-white">Failures</h3>
                <ul class="mt-3 flex flex-col gap-3">
                    @foreach ($failures as $failure)
                        <li class="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/30 dark:bg-rose-500/10 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-950 dark:text-white">
                                    {{ $failure['name'] }}
                                    <span class="font-normal text-gray-500">· depth {{ $failure['depth'] }} · {{ $stageLabels[$failure['stage']] ?? $failure['stage'] }}</span>
                                </p>
                                <p class="mt-1 font-mono text-xs text-rose-800 dark:text-rose-200">{{ $failure['error'] ?? 'No error recorded' }}</p>
                            </div>
                            <div>
                                {{ ($this->retryStageAction)(['nodeId' => $failure['node_id'], 'stage' => $failure['stage']]) }}
                            </div>
                        </li>
                    @endforeach
                </ul>
            </div>
        @endif

        <div class="flex flex-col gap-4">
            @forelse ($nodesByDepth as $depth => $nodes)
                <div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10">
                    <h3 class="text-sm font-medium text-gray-950 dark:text-white">Depth {{ $depth }}</h3>
                    <ul class="mt-3 flex flex-col gap-2">
                        @foreach ($nodes as $node)
                            <li class="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                                <p class="text-sm font-medium text-gray-950 dark:text-white">{{ $node['name'] }}</p>
                                <div class="mt-2 flex flex-wrap gap-2">
                                    @foreach ($node['stages'] as $stage => $stageState)
                                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {{ $statusColors[$stageState['status']] ?? $statusColors['pending'] }}">
                                            {{ $stageLabels[$stage] ?? $stage }}: {{ $stageState['status'] }}
                                        </span>
                                    @endforeach
                                </div>
                                @foreach ($node['stages'] as $stage => $stageState)
                                    @if ($stageState['status'] === 'failed')
                                        <div class="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <p class="font-mono text-xs text-rose-700 dark:text-rose-300">{{ $stageState['error'] ?? 'No error recorded' }}</p>
                                            {{ ($this->retryStageAction)(['nodeId' => $node['id'], 'stage' => $stage]) }}
                                        </div>
                                    @endif
                                @endforeach
                            </li>
                        @endforeach
                    </ul>
                </div>
            @empty
                <div class="rounded-xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:text-gray-300 dark:ring-white/10">
                    This pipeline run has no nodes yet.
                </div>
            @endforelse
        </div>
    </div>
</x-filament-panels::page>
