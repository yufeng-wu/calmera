export const FRAME_BUFFER_SIZE = 20; // Same as backend, max frames in rolling buffer
export const WEIGHT_CHANGE_THRESHOLD = 2; // grams difference that constitutes a new weight
export const STABLE_FRAME_COUNT = 3; // number of agreeing frames for a stable state
export const ROI_CONFIDENCE_THRESHOLD = 0.08; // if ROI confidence is below this, skip digit stage
