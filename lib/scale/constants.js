export const WEIGHT_BUFFER_SIZE = 20; // Same as backend, max frames in rolling buffer
export const WEIGHT_CHANGE_THRESHOLD = 2; // grams difference that constitutes a new weight
export const STABLE_FRAME_COUNT = 2; // number of agreeing frames for a stable state
export const IMAGE_BUFFER_SIZE = STABLE_FRAME_COUNT + 2; // number of frames to keep in memory for image display
export const FRAME_RESIZE_DIM_FOR_WEIGHT_DETECTION = 640;
export const FRAME_COMPRESSION_QUALITY = 0.3; // Frame compression quality (0-1, lower = more compression), but after a certain point, the size won't shrink anymore.
export const BLANK_FRAME_TOLERANCE = 2; // Number of consecutive blank frames before we consider the scale undetected
export const LOW_CONFIDENCE_THRESHOLD = 0.6; // Minimum confidence threshold for a valid weight detection
