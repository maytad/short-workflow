import type { DbClient, JobRow } from "@short-workflow/db";

import { handleGenerateSceneAudio } from "./generateSceneAudio";
import { handleGenerateSceneImage } from "./generateSceneImage";
import { handleGenerateScript } from "./generateScript";
import { handleRenderVideo } from "./renderVideo";
import { handleRunProjectFlow } from "./runProjectFlow";
import { handleUploadYoutube } from "./uploadYoutube";

export async function handleJob(db: DbClient, job: JobRow): Promise<void> {
  switch (job.type) {
    case "generate_script":
      await handleGenerateScript(db, job);
      break;
    case "generate_scene_image":
      await handleGenerateSceneImage(db, job);
      break;
    case "generate_scene_audio":
      await handleGenerateSceneAudio(db, job);
      break;
    case "render_video":
      await handleRenderVideo(db, job);
      break;
    case "upload_youtube":
      await handleUploadYoutube(db, job);
      break;
    case "run_project_flow":
      await handleRunProjectFlow(db, job);
      break;
    default: {
      const exhaustiveJobType: never = job.type;
      throw new Error(`handler_not_implemented:${exhaustiveJobType}`);
    }
  }
}
