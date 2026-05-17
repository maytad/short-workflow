import type { ZodError } from "zod";

type StatusSetter = {
  status?: number | string;
};

export type JsonErrorCode = "validation_failed" | "not_found" | "conflict" | "internal_error";

export type ValidationIssue = {
  path: string;
  message: string;
};

function conciseIssue(issue: ZodError["issues"][number]): ValidationIssue {
  return {
    path: issue.path.map(String).join("."),
    message: issue.message,
  };
}

export function jsonError<TCode extends string>(
  set: StatusSetter,
  status: number,
  error: TCode,
  extra?: Record<string, unknown>,
) {
  set.status = status;
  return { error, ...extra };
}

export function validationFailed(set: StatusSetter, error: ZodError) {
  return jsonError(set, 400, "validation_failed", {
    issues: error.issues.map(conciseIssue),
  });
}

export function notFound(set: StatusSetter) {
  return jsonError(set, 404, "not_found");
}

export function conflict(set: StatusSetter, error = "conflict") {
  return jsonError(set, 409, error);
}

export function internalError(set: StatusSetter) {
  return jsonError(set, 500, "internal_error");
}
