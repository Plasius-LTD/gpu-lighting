struct VolumetricIntegrationParams {
  light_direction: vec3<f32>,
  history_blend: f32,
  extinction_bias: f32,
  ambient_boost: f32,
  integration_step_scale: f32,
  phase_bias: f32,
  temporal_stability: f32,
  reserved: f32,
};

struct FroxelMediumVoxel {
  extinction_density: vec4<f32>,
  inscattering_anisotropy: vec4<f32>,
};

struct VolumetricShadowHistory {
  shadow_transmittance: vec4<f32>,
  depth_phase: vec4<f32>,
};

struct FroxelIntegratedVoxel {
  integrated_scattering: vec4<f32>,
  integrated_extinction: vec4<f32>,
};

@group(0) @binding(0) var<uniform> froxelGridParams: FroxelGridParams;
@group(0) @binding(1) var<uniform> volumetricIntegrationParams: VolumetricIntegrationParams;
@group(0) @binding(2) var<storage, read> froxelMediumInput: array<FroxelMediumVoxel>;
@group(0) @binding(3) var<storage, read> froxelShadowInput: array<VolumetricShadowHistory>;
@group(0) @binding(4) var<storage, read_write> froxelIntegratedOutput: array<FroxelIntegratedVoxel>;

fn froxel_integrate_index(coord: vec3<u32>) -> u32 {
  let plane = max(froxelGridParams.grid_width, 1u) * max(froxelGridParams.grid_height, 1u);
  return coord.z * plane + coord.y * max(froxelGridParams.grid_width, 1u) + coord.x;
}

fn safe_normalize(value: vec3<f32>) -> vec3<f32> {
  let length_value = length(value);
  if (length_value <= 0.000001) {
    return vec3<f32>(0.0, 1.0, 0.0);
  }
  return value / length_value;
}

fn henyey_greenstein(cos_theta: f32, anisotropy: f32) -> f32 {
  let g = clamp(anisotropy, -0.85, 0.85);
  let denominator = pow(max(1.0 + g * g - 2.0 * g * cos_theta, 0.001), 1.5);
  return (1.0 - g * g) / max(12.566370614359172 * denominator, 0.001);
}

@compute @workgroup_size(4, 4, 4)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= froxelGridParams.grid_width ||
    global_id.y >= froxelGridParams.grid_height ||
    global_id.z >= froxelGridParams.grid_depth
  ) {
    return;
  }

  let index = froxel_integrate_index(global_id);
  let medium = froxelMediumInput[index];
  let shadow = froxelShadowInput[index];
  let previous = froxelIntegratedOutput[index];
  let light_direction = safe_normalize(volumetricIntegrationParams.light_direction);
  let slice_depth = (f32(global_id.z) + 0.5) / max(f32(froxelGridParams.grid_depth), 1.0);
  let density = max(medium.extinction_density.w + volumetricIntegrationParams.extinction_bias, 0.0);
  let extinction = max(medium.extinction_density.xyz, vec3<f32>(0.0001));
  let albedo = clamp(medium.inscattering_anisotropy.xyz, vec3<f32>(0.0), vec3<f32>(4.0));
  let anisotropy = medium.inscattering_anisotropy.w;
  let phase = henyey_greenstein(light_direction.y, anisotropy + volumetricIntegrationParams.phase_bias * 0.1);
  let step_length =
    max(volumetricIntegrationParams.integration_step_scale, 0.2) /
    max(f32(froxelGridParams.grid_depth), 1.0);
  let shadow_visibility = shadow.shadow_transmittance.w;
  let ambient_term = vec3<f32>(0.08, 0.1, 0.14) * max(volumetricIntegrationParams.ambient_boost, 0.0);
  let sample = MediumSample(
    extinction,
    (albedo * (0.25 + slice_depth * 0.5) + ambient_term) * shadow_visibility * phase
  );
  let transmittance = exp(-sample.extinction * density * step_length);
  let integrated_scattering =
    sample.inscattering *
    froxelGridParams.scattering_strength *
    (1.0 - transmittance) *
    (1.0 + shadow.depth_phase.z * 0.2);
  let integrated_extinction = sample.extinction * density * step_length;
  let stability = clamp(
    shadow.depth_phase.w * volumetricIntegrationParams.temporal_stability,
    0.0,
    1.0
  );
  let blend = clamp(volumetricIntegrationParams.history_blend, 0.0, 0.98) * stability;
  let resolved_scattering =
    previous.integrated_scattering.xyz * blend +
    integrated_scattering * (1.0 - blend);
  let resolved_extinction =
    previous.integrated_extinction.xyz * blend +
    integrated_extinction * (1.0 - blend);

  froxelIntegratedOutput[index] = FroxelIntegratedVoxel(
    vec4<f32>(resolved_scattering, shadow_visibility),
    vec4<f32>(resolved_extinction, stability)
  );
}
