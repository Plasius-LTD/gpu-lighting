struct IblPrecomputeParams {
  mip_level: u32,
  sample_count: u32,
  roughness: f32,
  exposure_bias: f32,
};

fn clamp_roughness(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}
