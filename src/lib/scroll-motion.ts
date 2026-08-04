export type ScrollMotionValues = {
  progress: number;
  farX: number;
  farY: number;
  midX: number;
  midY: number;
  nearX: number;
  nearY: number;
  turn: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converts an element's viewport position into small, bounded motion values.
 * Progress is zero when the scene enters at the bottom edge and one when it
 * leaves through the top edge. The signed layer values cross zero when the
 * scene is centred, which keeps parallax subtle rather than floaty.
 */
export function calculateScrollMotion(
  top: number,
  height: number,
  viewportHeight: number,
): ScrollMotionValues {
  const safeHeight = Math.max(0, height);
  const safeViewport = Math.max(1, viewportHeight);
  const travel = Math.max(1, safeViewport + safeHeight);
  const progress = clamp((safeViewport - top) / travel, 0, 1);
  const signed = progress * 2 - 1;

  return {
    progress,
    farX: signed * -5,
    farY: signed * 8,
    midX: signed * 9,
    midY: signed * -15,
    nearX: signed * -15,
    nearY: signed * 24,
    turn: signed * 1.2,
  };
}

/**
 * Progress for a bounded sticky scene. The value stays at zero until the
 * scene reaches its sticky offset, then advances across only the additional
 * scroll distance created by the scene before resolving to one.
 */
export function calculateStickyScrollProgress(
  top: number,
  height: number,
  viewportHeight: number,
  stickyOffset = 0,
) {
  const safeHeight = Math.max(0, height);
  const safeViewport = Math.max(1, viewportHeight);
  const safeOffset = Math.max(0, stickyOffset);
  const travel = Math.max(1, safeHeight - safeViewport + safeOffset);

  return clamp((safeOffset - top) / travel, 0, 1);
}
