import { tr } from './i18n.svelte';

const NAMES: Record<string, string> = {
  candidate_experience: 'ui.settings.experience',
  offline_texts: 'ui.settings.offlineTexts',
  ai_prompt_resume_tailor: 'ui.settings.promptResume',
  ai_prompt_cover_letter: 'ui.settings.promptCoverLetter',
  ai_prompt_other: 'ui.settings.promptOther',
  ai_prompt_answer_question: 'ui.settings.promptAnswer',
  ai_prompt_match_job: 'ui.settings.promptMatch',
  ai_prompt_import_job: 'ui.settings.promptImport',
  ai_prompt_import_match_job: 'ui.settings.promptImportMatch',
};

/** The name the user knows a tracked text by (the key of its setting when it is not known). */
export function historyName(key: string): string {
  const text = NAMES[key];
  return text === undefined ? key : tr(text);
}
