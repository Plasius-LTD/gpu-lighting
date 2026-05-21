@group(0) @binding(0) var<uniform> hybridFrameParams: HybridFrameParams;
@group(0) @binding(1) var<uniform> hybridReflectionCamera: HybridReflectionCamera;
@group(0) @binding(2) var<storage, read> hybridReflectionSurfaces: array<HybridReflectionSurface>;
@group(0) @binding(3) var<storage, read> hybridScreenTraceHistory: array<HybridScreenTracePixel>;
@group(0) @binding(4) var<storage, read> hybridReflectionScene: HybridReflectionSceneMetadata;
@group(0) @binding(5) var<uniform> hybridGroundPlane: HybridGroundPlane;
@group(0) @binding(6) var<storage, read> hybridReflectionMaterials: array<HybridReflectionMaterial>;
@group(0) @binding(7) var<storage, read> hybridReflectionSpheres: array<HybridReflectionSphere>;
@group(0) @binding(8) var<storage, read_write> hybridScreenTraceOutput: array<HybridScreenTracePixel>;

fn screen_trace_index(pixel: vec2<u32>) -> u32 {
  return pixel.y * max(hybridFrameParams.image_width, 1u) + pixel.x;
}

fn unpack_reflection_material(index: u32) -> HybridReflectionMaterial {
  if (hybridReflectionScene.material_count == 0u) {
    return HybridReflectionMaterial(
      vec4<f32>(0.7, 0.72, 0.76, 0.4),
      vec4<f32>(0.0, 0.0, 0.0, 0.0)
    );
  }

  let safe_index = min(index, hybridReflectionScene.material_count - 1u);
  return hybridReflectionMaterials[safe_index];
}

fn miss_trace() -> HybridReflectionTrace {
  return HybridReflectionTrace(
    0u,
    hybridReflectionScene.max_trace_distance,
    vec3<f32>(0.0),
    0u,
    vec3<f32>(0.0, 1.0, 0.0),
    0u
  );
}

fn set_best_trace(best: ptr<function, HybridReflectionTrace>, candidate: HybridReflectionTrace) {
  if (candidate.hit_mask == 1u && candidate.distance < (*best).distance) {
    *best = candidate;
  }
}

fn trace_ground(
  origin: vec3<f32>,
  direction: vec3<f32>,
  best: ptr<function, HybridReflectionTrace>
) {
  if (hybridGroundPlane.enabled == 0u) {
    return;
  }

  let plane_normal = hybrid_safe_normalize(hybridGroundPlane.normal);
  let denominator = dot(plane_normal, direction);
  if (abs(denominator) <= 0.0005) {
    return;
  }

  let distance = -(dot(plane_normal, origin) + hybridGroundPlane.height) / denominator;
  if (distance <= 0.0005 || distance >= (*best).distance || distance >= hybridReflectionScene.max_trace_distance) {
    return;
  }

  set_best_trace(
    best,
    HybridReflectionTrace(
      1u,
      distance,
      origin + direction * distance,
      hybridGroundPlane.material_index,
      plane_normal,
      0u
    )
  );
}

fn trace_spheres(
  origin: vec3<f32>,
  direction: vec3<f32>,
  best: ptr<function, HybridReflectionTrace>
) {
  var index = 0u;
  loop {
    if (index >= hybridReflectionScene.sphere_count) {
      break;
    }

    let sphere = hybridReflectionSpheres[index];
    let offset = origin - sphere.center_radius.xyz;
    let a = dot(direction, direction);
    let half_b = dot(offset, direction);
    let c = dot(offset, offset) - sphere.center_radius.w * sphere.center_radius.w;
    let discriminant = half_b * half_b - a * c;
    if (discriminant >= 0.0) {
      let root = sqrt(discriminant);
      var distance = (-half_b - root) / max(a, 0.0005);
      if (distance <= 0.0005) {
        distance = (-half_b + root) / max(a, 0.0005);
      }
      if (distance > 0.0005 && distance < (*best).distance && distance < hybridReflectionScene.max_trace_distance) {
        let position = origin + direction * distance;
        let normal = hybrid_safe_normalize(position - sphere.center_radius.xyz);
        set_best_trace(
          best,
          HybridReflectionTrace(
            1u,
            distance,
            position,
            sphere.material_index,
            normal,
            0u
          )
        );
      }
    }

    index = index + 1u;
  }
}

fn trace_screen_scene(origin: vec3<f32>, direction: vec3<f32>) -> HybridReflectionTrace {
  var best = miss_trace();
  trace_ground(origin, direction, &best);
  trace_spheres(origin, direction, &best);
  return best;
}

fn evaluate_hit_radiance(trace: HybridReflectionTrace, reflection_direction: vec3<f32>) -> vec3<f32> {
  let material = unpack_reflection_material(trace.material_index);
  let normal = hybrid_safe_normalize(trace.normal);
  let view_direction = -reflection_direction;
  let light_direction = hybrid_safe_normalize(vec3<f32>(0.31, 0.92, 0.22));
  let ndotl = hybrid_saturate(dot(normal, light_direction));
  let halfway = hybrid_safe_normalize(light_direction + view_direction);
  let roughness = clamp(material.albedo_roughness.w, 0.02, 1.0);
  let metalness = hybrid_saturate(material.emission_metalness.w);
  let albedo = material.albedo_roughness.xyz;
  let fresnel = hybrid_fresnel_schlick(
    hybrid_saturate(dot(normal, view_direction)),
    hybrid_surface_f0(albedo, metalness)
  );
  let diffuse = albedo * ndotl * 0.3183098861837907 * (1.0 - metalness);
  let specular = fresnel * pow(hybrid_saturate(dot(normal, halfway)), 12.0 + (1.0 - roughness) * 84.0) * ndotl;
  let sky_fill = hybrid_environment(normal, hybridFrameParams.sky_intensity, hybridFrameParams.sky_mode);
  return material.emission_metalness.xyz + (diffuse + specular) * vec3<f32>(4.8, 4.5, 4.1) + sky_fill * 0.1;
}

@compute @workgroup_size(8, 8, 1)
fn process_job(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (
    global_id.x >= hybridFrameParams.image_width ||
    global_id.y >= hybridFrameParams.image_height
  ) {
    return;
  }

  let index = screen_trace_index(global_id.xy);
  let surface = hybridReflectionSurfaces[index];
  let previous = hybridScreenTraceHistory[index];
  let position = surface.position.xyz;
  let normal = hybrid_safe_normalize(surface.normal_roughness.xyz);
  let roughness = clamp(surface.normal_roughness.w + hybridFrameParams.roughness_bias, 0.02, 1.0);
  let albedo = surface.albedo_metalness.xyz;
  let metalness = hybrid_saturate(surface.albedo_metalness.w);
  let occlusion = hybrid_saturate(surface.emission_occlusion.w);
  let view_direction = hybrid_safe_normalize(hybridReflectionCamera.position - position);
  var random_state = hybrid_hash_u32(
    hybridFrameParams.frame_index * 1664525u +
    index * 1013904223u +
    0x68bc21ebu
  );
  let reflected_direction = hybrid_safe_normalize(
    reflect(-view_direction, normal) +
    hybrid_sample_unit_sphere(&random_state) * roughness * roughness * 0.25
  );
  let trace = trace_screen_scene(
    position + normal * max(hybridFrameParams.thickness, 0.0005),
    reflected_direction
  );
  let sky_fallback = hybrid_environment(
    reflected_direction,
    hybridFrameParams.sky_intensity,
    hybridFrameParams.sky_mode
  );
  let hit_radiance = select(
    sky_fallback,
    evaluate_hit_radiance(trace, reflected_direction),
    trace.hit_mask == 1u
  );
  let reflection_budget = clamp(
    max(hybrid_surface_f0(albedo, metalness).x, max(albedo.y * metalness, albedo.z * metalness)) +
      (1.0 - roughness) * 0.45,
    0.0,
    1.0
  );
  let trace_confidence = clamp(
    reflection_budget * occlusion * select(0.35, 0.9, trace.hit_mask == 1u),
    0.0,
    1.0
  );
  let history_weight = select(
    0.0,
    encode_history_weight(hybridFrameParams.history_weight),
    hybridFrameParams.reflection_reset == 0u && previous.radiance_confidence.w > 0.0
  );
  let resolved_radiance =
    previous.radiance_confidence.xyz * history_weight +
    hit_radiance * trace_confidence * (1.0 - history_weight);
  let resolved_normal = select(normal, hybrid_safe_normalize(trace.normal), trace.hit_mask == 1u);
  let resolved_distance = select(
    hybridFrameParams.max_reflection_distance,
    trace.distance,
    trace.hit_mask == 1u
  );

  hybridScreenTraceOutput[index] = HybridScreenTracePixel(
    vec4<f32>(resolved_radiance * hybridFrameParams.exposure, trace_confidence),
    vec4<f32>(resolved_normal, resolved_distance)
  );
}
