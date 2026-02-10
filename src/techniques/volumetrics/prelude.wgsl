struct FroxelGridParams {
  grid_width: u32,
  grid_height: u32,
  grid_depth: u32,
  scattering_strength: f32,
};

struct MediumSample {
  extinction: vec3<f32>,
  inscattering: vec3<f32>,
};

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}
