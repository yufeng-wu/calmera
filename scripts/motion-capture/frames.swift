// Splits a simulator recording into its real frames, so motion can be read one frame at a time.
//
//   swift scripts/motion-capture/frames.swift <video.mp4> <out-dir> [from-s] [to-s] [scale]
//
// `simctl io recordVideo` writes a frame only when the screen changes, so the time between frames is itself
// the evidence: a 16.7 ms step is a smooth 60 fps frame, and a long step in the middle of an animation is a
// stutter. Every frame in [from, to] is saved as frame-<n>-<ms>.png (ms from the start of the clip, PNGs scaled
// by `scale`, default 0.33), and frames.tsv lists each frame's time and the step from the one before.
import AVFoundation
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
  FileHandle.standardError.write("usage: frames.swift <video> <out-dir> [from-s] [to-s] [scale]\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2], isDirectory: true)
let from = args.count > 3 ? Double(args[3])! : 0
let to = args.count > 4 ? Double(args[4])! : .infinity
let scale = args.count > 5 ? Double(args[5])! : 0.33
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

let asset = AVURLAsset(url: url)
let semaphore = DispatchSemaphore(value: 0)
var track: AVAssetTrack?
Task { track = try? await asset.loadTracks(withMediaType: .video).first; semaphore.signal() }
semaphore.wait()
guard let track else { print("no video track"); exit(1) }
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(output)
reader.startReading()

let context = CIContext()
var rows = ["frame\tms\tstep_ms"]
var previous: Double?
var index = 0
while let sample = output.copyNextSampleBuffer() {
  let seconds = CMSampleBufferGetPresentationTimeStamp(sample).seconds
  defer { previous = seconds }
  guard seconds >= from, seconds <= to, let buffer = CMSampleBufferGetImageBuffer(sample) else { continue }
  index += 1
  let ms = Int((seconds * 1000).rounded())
  let step = previous.map { String(format: "%.1f", (seconds - $0) * 1000) } ?? ""
  rows.append("\(index)\t\(ms)\t\(step)")
  let image = CIImage(cvPixelBuffer: buffer).transformed(by: CGAffineTransform(scaleX: scale, y: scale))
  guard let cg = context.createCGImage(image, from: image.extent) else { continue }
  let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!
  try png.write(to: out.appendingPathComponent(String(format: "frame-%04d-%06d.png", index, ms)))
}
try (rows.joined(separator: "\n") + "\n").write(to: out.appendingPathComponent("frames.tsv"), atomically: true, encoding: .utf8)
print("\(index) frames → \(out.path)")
