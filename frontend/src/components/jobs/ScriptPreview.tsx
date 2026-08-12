import { Badge } from "@/components/ui/Badge";
import type { VideoContent, VideoScene } from "@/types";
import { formatDuration } from "@/utils/formatRelativeTime";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

function SceneRow({ scene, index }: { scene: VideoScene; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Scene {index + 1}</p>
          {!expanded && <p className="mt-0.5 truncate text-xs text-text-secondary">{scene.narration}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-text-muted">{formatDuration(scene.estimatedDuration)}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Narration</p>
            <p className="mt-1 text-text-primary">{scene.narration}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Visual</p>
            <p className="mt-1 text-text-secondary">{scene.visualDescription}</p>
          </div>
          {scene.onScreenText && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">On-Screen Text</p>
              <p className="mt-1 text-text-secondary">{scene.onScreenText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScriptPreview({ content }: { content: VideoContent }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Title</p>
        <h2 className="mt-1 text-lg font-semibold text-text-primary">{content.title}</h2>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Hook</p>
        <p className="mt-1 text-sm italic text-text-secondary">{content.hook}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Introduction</p>
        <p className="mt-1 text-sm text-text-secondary">{content.introduction}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          Scenes ({content.scenes.length})
        </p>
        <div className="space-y-2">
          {content.scenes
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((scene, index) => (
              <SceneRow key={scene.id} scene={scene} index={index} />
            ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Conclusion</p>
        <p className="mt-1 text-sm text-text-secondary">{content.conclusion}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">YouTube Description</p>
        <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">{content.description}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {content.tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
