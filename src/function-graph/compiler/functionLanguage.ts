import { createTypeshadeLanguageService } from "typeshade/language-service";

/** General symbol operations remain in the pinned TypeShade language service. */
export function functionLanguage(modules: Record<string, string>) {
  const service = createTypeshadeLanguageService();
  for (const [path, source] of Object.entries(modules))
    service.openDocument(`file://${path}`, source);
  return service;
}
