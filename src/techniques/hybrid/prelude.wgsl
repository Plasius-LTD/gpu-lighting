struct HybridFrameParams {
  frame_index: u32,
  max_trace_steps: u32,
  history_weight: f32,
  exposure: f32,
};

struct HybridHit {
  radiance: vec3<f32>,
  hit_distance: f32,
};

fn encode_history_weight(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}
