import { Composition } from "remotion";
import { SceneComposition, defaultSceneProps, type SceneCompositionProps } from "./SceneComposition";
import { ThumbnailComposition, defaultThumbnailProps } from "./Thumbnail";

export const FPS = 30;
// Static fallback used only by Remotion Studio's default preview — every
// real render supplies its own videoWidth/videoHeight via props (see
// remotionRenderer.ts, which reads config.rendering.width/height), and
// calculateMetadata below is what actually takes effect at render time.
export const WIDTH = defaultSceneProps.videoWidth;
export const HEIGHT = defaultSceneProps.videoHeight;

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Scene"
        component={SceneComposition}
        durationInFrames={Math.max(1, Math.round(defaultSceneProps.durationInSeconds * FPS))}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultSceneProps}
        calculateMetadata={({ props }: { props: SceneCompositionProps }) => ({
          durationInFrames: Math.max(1, Math.round(props.durationInSeconds * FPS)),
          width: props.videoWidth,
          height: props.videoHeight,
        })}
      />
      {/* Phase 11 — a single real still frame (1280x720), rendered via renderStill() from the same bundle rather than a second, separately bundled webpack project. */}
      <Composition
        id="Thumbnail"
        component={ThumbnailComposition}
        durationInFrames={1}
        fps={FPS}
        width={defaultThumbnailProps.width}
        height={defaultThumbnailProps.height}
        defaultProps={defaultThumbnailProps}
      />
    </>
  );
}
