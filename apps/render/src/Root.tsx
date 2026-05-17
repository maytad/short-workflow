import {
  RENDER_FPS,
  RENDER_HEIGHT,
  RENDER_WIDTH,
} from "@short-workflow/shared";
import { Composition, registerRoot } from "remotion";

import { getTotalDurationFrames, ShortVideo } from "./ShortVideo";
import type { RenderInput } from "./schema";

const defaultRenderInput: RenderInput = {
  projectId: "00000000-0000-4000-8000-000000000000",
  title: "Short Workflow Preview",
  format: {
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
    fps: RENDER_FPS,
    durationSeconds: 45,
  },
  scenes: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      position: 1,
      role: "hook",
      durationSeconds: 45,
      narration: "Preview narration",
      caption: "Short Workflow Preview",
      imagePath: "preview.png",
      audioPath: "preview.mp3",
    },
  ],
};

export const RemotionRoot = () => (
  <Composition
    calculateMetadata={({ props }) => ({
      durationInFrames: getTotalDurationFrames(props.scenes, props.format.fps),
      fps: props.format.fps,
      height: props.format.height,
      width: props.format.width,
    })}
    component={ShortVideo}
    defaultProps={defaultRenderInput}
    durationInFrames={45 * RENDER_FPS}
    fps={RENDER_FPS}
    height={RENDER_HEIGHT}
    id="ShortVideo"
    width={RENDER_WIDTH}
  />
);

registerRoot(RemotionRoot);
