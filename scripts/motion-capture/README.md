# Seeing motion on the simulator

For checking an animation frame by frame when you can't watch the screen.

1. Record: `xcrun simctl io <device> recordVideo --codec h264 --force clip.mp4`, run the flow, then stop it with
   `kill -INT` (a plain kill leaves the simulator thinking it is still recording).
2. Split: `swift scripts/motion-capture/frames.swift clip.mp4 frames 15.0 18.5 0.3` saves every real frame
   between 15 s and 18.5 s, plus `frames.tsv` with each frame's time and the step from the frame before.
   The recorder only writes a frame when the screen changes, so during an animation a step well over 17 ms
   is a dropped frame, and a long step while nothing moves is only a still screen.
3. Look: `scripts/motion-capture/sheet.sh frames 15000 18500 sheet.png 100ms 7 15372` lays out a contact
   sheet, one frame per 100 ms, labelled in ms from 15372 (say, the frame Save was tapped), so two runs line up.

To line frames up with app events, have a debug build draw short timestamped marks in a corner of the screen:
each one then appears in the very frame it landed in.
