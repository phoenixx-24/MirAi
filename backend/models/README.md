# Local models
Place the MediaPipe Pose Landmarker model at `pose_landmarker.task`.
Place an unpacked Vosk English model in `vosk/`.
Models are not bundled. System health reports missing models; no simulated tracking is used.
Face recognition uses the optional face-recognition package's model assets.
Optionally place face_landmarker.task here and load the expression check from Setup center. It tracks expression changes against an initial baseline, not pain; explicit user discomfort reports take precedence.
