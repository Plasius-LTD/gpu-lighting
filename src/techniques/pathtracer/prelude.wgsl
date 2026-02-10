struct PathTracerParams {
  frame_index: u32,
  max_bounces: u32,
  samples_per_pixel: u32,
  enable_next_event_estimation: u32,
};

struct PathSample {
  radiance: vec3<f32>,
  throughput: vec3<f32>,
};

fn luminance(value: vec3<f32>) -> f32 {
  return dot(value, vec3<f32>(0.2126, 0.7152, 0.0722));
}
