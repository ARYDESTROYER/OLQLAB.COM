type AnswerPersistenceState = {
  pendingSaves: number;
  dirtyAnswers: number;
  saveFailed: boolean;
  submitting: boolean;
};

export function shouldBlockAssessmentNavigation(
  state: AnswerPersistenceState,
) {
  return (
    state.pendingSaves > 0 ||
    state.dirtyAnswers > 0 ||
    state.saveFailed ||
    state.submitting
  );
}

export function assessmentSaveStatus(
  state: Pick<
    AnswerPersistenceState,
    "pendingSaves" | "dirtyAnswers" | "saveFailed"
  >,
) {
  if (state.pendingSaves > 0) {
    return `Saving ${state.pendingSaves} response${
      state.pendingSaves === 1 ? "" : "s"
    }…`;
  }
  if (state.saveFailed) return "Save failed — retry before leaving";
  if (state.dirtyAnswers > 0) {
    return `${state.dirtyAnswers} unsaved response${
      state.dirtyAnswers === 1 ? "" : "s"
    }`;
  }
  return "Responses saved";
}

export function persistedVersionIsCurrent(
  currentVersion: number | undefined,
  persistedVersion: number,
) {
  return currentVersion === persistedVersion;
}
