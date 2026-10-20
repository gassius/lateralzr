<?php

namespace App\Filament\Pages;

use App\Filament\Resources\ConceptGraphRuns\ConceptGraphRunResource;
use App\Models\ConceptGraphRun;
use App\Models\ConceptPipelineNode;
use App\Services\ConceptPipeline\ConceptPipelineDispatchService;
use App\Services\ConceptPipeline\ConceptPipelineProgress;
use Filament\Actions\Action;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Panel;
use Filament\Support\Icons\Heroicon;
use Illuminate\Contracts\Support\Htmlable;
use InvalidArgumentException;
use Livewire\Attributes\Locked;

class GenerationProgress extends Page
{
    protected static bool $shouldRegisterNavigation = false;

    protected static ?string $slug = 'generation-progress/{record}';

    protected static ?string $title = 'Generation progress';

    protected static string|\BackedEnum|null $navigationIcon = Heroicon::OutlinedChartBar;

    protected string $view = 'filament.pages.generation-progress';

    #[Locked]
    public int $recordId;

    public function mount(int|string $record): void
    {
        $this->recordId = (int) $this->resolvePipelineRun($record)->getKey();
    }

    public function getRecord(): ConceptGraphRun
    {
        return $this->resolvePipelineRun($this->recordId);
    }

    public static function getRelativeRouteName(Panel $panel): string
    {
        return 'generation-progress';
    }

    public function getHeading(): string|Htmlable
    {
        return 'Generation progress';
    }

    public function getSubheading(): string|Htmlable|null
    {
        return $this->getRecord()->summary;
    }

    /**
     * @return array<string, string>
     */
    public function getBreadcrumbs(): array
    {
        $record = $this->getRecord();

        return [
            ConceptGraphRunResource::getUrl() => 'Worker Runs',
            ConceptGraphRunResource::getUrl('view', ['record' => $record]) => (string) $record->run_uuid,
        ];
    }

    public function progress(): ConceptPipelineProgress
    {
        return ConceptPipelineProgress::for($this->getRecord());
    }

    public function retryStageAction(): Action
    {
        return Action::make('retryStage')
            ->label('Retry')
            ->icon(Heroicon::ArrowPath)
            ->color('danger')
            ->requiresConfirmation()
            ->modalHeading('Retry this stage?')
            ->modalDescription('Re-queues only this node and stage. Later skipped stages on the same node are reset so the chain can continue.')
            ->successNotificationTitle('Stage re-queued')
            ->action(function (array $arguments, Action $action): void {
                $nodeId = (int) ($arguments['nodeId'] ?? 0);
                $stage = (string) ($arguments['stage'] ?? '');

                $node = ConceptPipelineNode::query()
                    ->where('run_uuid', $this->getRecord()->run_uuid)
                    ->whereKey($nodeId)
                    ->firstOrFail();

                try {
                    app(ConceptPipelineDispatchService::class)->retryStage($node, $stage);
                } catch (InvalidArgumentException $e) {
                    Notification::make()
                        ->title('Retry not queued')
                        ->body($e->getMessage())
                        ->danger()
                        ->send();

                    $action->failure();
                    $action->halt();
                }
            });
    }

    protected function resolvePipelineRun(int|string $record): ConceptGraphRun
    {
        $run = ConceptGraphRun::query()->whereKey($record)->firstOrFail();

        abort_unless($run->isPipeline(), 404);

        return $run;
    }
}
