import type { DbClient, JobRow } from "@short-workflow/db";

export async function handleJob(db: DbClient, job: JobRow): Promise<void> {
  void db;

  switch (job.type) {
    case "generate_script":
    case "generate_scene_image":
    case "generate_scene_audio":
    case "render_video":
      throw new Error(`handler_not_implemented:${job.type}`);
    default: {
      const exhaustiveJobType: never = job.type;
      throw new Error(`handler_not_implemented:${exhaustiveJobType}`);
    }
  }
}
