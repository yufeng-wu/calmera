import { releaseImage, retainImage } from "@/lib/scale/imageManager";

export class Frame {
  constructor({ weight, uri }) {
    if (weight < 0) {
      throw new Error("Weight must be non-negative");
    }

    this.weight = weight;
    this.uri = uri;
    retainImage(uri);
  }
}

export class State {
  constructor({ timestamp, weight, imagePath }) {
    this.timestamp =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.weight = weight;
    this.imagePath = imagePath;
    retainImage(imagePath);
  }
}

export class LogEntry {
  constructor({
    timestamp,
    absDeltaWeight,
    direction,
    foodName,
    nutritionInfo,
  }) {
    if (direction !== "add" && direction !== "remove") {
      throw new Error("direction must be 'add' or 'remove'");
    }
    if (absDeltaWeight <= 0) {
      throw new Error("absDeltaWeight must be positive");
    }
    this.id = String(Date.now());
    this.timestamp =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.absDeltaWeight = absDeltaWeight;
    this.direction = direction;
    this.foodName = foodName;
    this.nutritionInfo = nutritionInfo;
  }
}

export class Session {
  constructor(weightBufferSize, imageBufferSize) {
    if (imageBufferSize >= weightBufferSize) {
      throw new Error("imageBufferSize must be less than weightBufferSize");
    }
    this.createdAt = new Date();
    this.weightBufferSize = weightBufferSize;
    this.imageBufferSize = imageBufferSize;
    this.frameBuffer = [];
    this.currentState = null; // instance of State
    this.log = {}; // id -> LogEntry
  }

  addFrame(frame) {
    if (!(frame instanceof Frame)) {
      throw new Error("Session.addFrame expects Frame");
    }
    this.frameBuffer.push(frame);

    // Keep only the most recent weightBufferSize frames for weight data
    if (this.frameBuffer.length > this.weightBufferSize) {
      this.frameBuffer.shift();
    }

    // Keep only the most recent `imageBufferSize` frames that retain an image URI.
    if (this.frameBuffer.length > this.imageBufferSize) {
      const frameToClean =
        this.frameBuffer[this.frameBuffer.length - this.imageBufferSize - 1];
      if (frameToClean?.uri) {
        releaseImage(frameToClean.uri);
        frameToClean.uri = null;
      }
    }
  }

  clear() {
    // Release any image resources still referenced by frames or currentState
    this.frameBuffer.forEach((f) => {
      if (f?.uri) releaseImage(f.uri);
    });
    if (this.currentState?.imagePath) {
      releaseImage(this.currentState.imagePath);
    }

    this.frameBuffer = [];
    this.currentState = null;
    this.log = {};
  }
}
