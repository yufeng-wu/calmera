import { v4 as uuidv4 } from "uuid";

export class Frame {
  constructor({ timestamp, imagePath, weight, metadata = {} }) {
    if (weight < 0 && !Number.isNaN(weight)) {
      throw new Error("Weight must be non 0.");
    }

    this.timestamp =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.imagePath = imagePath; // uri on device
    this.weight = weight;
    this.metadata = metadata; // detections, confidence, etc.
  }
}

export class State {
  constructor({ timestamp, weight, imagePath }) {
    this.timestamp =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.weight = weight;
    this.imagePath = imagePath;
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
    this.id = uuidv4();
    this.timestamp =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    this.absDeltaWeight = absDeltaWeight;
    this.direction = direction;
    this.foodName = foodName;
    this.nutritionInfo = nutritionInfo;
  }
}

export class Session {
  constructor(bufferSize = 20) {
    this.createdAt = new Date();
    this.sessionBufferSize = bufferSize;
    this.frameBuffer = [];
    this.currentState = null; // instance of State
    this.log = {}; // id -> LogEntry
  }

  addFrame(frame) {
    if (!(frame instanceof Frame)) {
      throw new Error("Session.addFrame expects Frame");
    }
    this.frameBuffer.push(frame);
    if (this.frameBuffer.length > this.sessionBufferSize) {
      this.frameBuffer.shift();
    }
  }

  clear() {
    this.frameBuffer = [];
    this.currentState = null;
    this.log = {};
  }
}
