function getComponentArray(componentType, buffer, byteOffset, count) {
  switch (componentType) {
    case 5121:
      return new Uint8Array(buffer, byteOffset, count);
    case 5123:
      return new Uint16Array(buffer, byteOffset, count);
    case 5125:
      return new Uint32Array(buffer, byteOffset, count);
    case 5126:
      return new Float32Array(buffer, byteOffset, count);
    default:
      throw new Error(`Unsupported glTF componentType: ${componentType}`);
  }
}

function getTypeSize(type) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unsupported glTF accessor type: ${type}`);
  }
}

function getComponentByteSize(componentType) {
  switch (componentType) {
    case 5121:
      return 1;
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      throw new Error(`Unsupported glTF componentType: ${componentType}`);
  }
}

function readComponentValue(view, componentType, byteOffset) {
  switch (componentType) {
    case 5121:
      return view.getUint8(byteOffset);
    case 5123:
      return view.getUint16(byteOffset, true);
    case 5125:
      return view.getUint32(byteOffset, true);
    case 5126:
      return view.getFloat32(byteOffset, true);
    default:
      throw new Error(`Unsupported glTF componentType: ${componentType}`);
  }
}

function readAccessor(document, accessorIndex, buffers) {
  const accessor = document.accessors?.[accessorIndex];
  if (!accessor) {
    throw new Error(`glTF accessor ${accessorIndex} is missing.`);
  }
  const bufferView = document.bufferViews?.[accessor.bufferView];
  if (!bufferView) {
    throw new Error(`glTF bufferView ${accessor.bufferView} is missing.`);
  }
  const componentCount = getTypeSize(accessor.type);
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const componentByteSize = getComponentByteSize(accessor.componentType);
  const packedElementByteLength = componentCount * componentByteSize;
  const byteStride = Math.max(bufferView.byteStride ?? packedElementByteLength, packedElementByteLength);
  if (byteStride === packedElementByteLength) {
    const valueCount = accessor.count * componentCount;
    return Array.from(
      getComponentArray(accessor.componentType, buffers[bufferView.buffer], byteOffset, valueCount)
    );
  }
  const view = new DataView(
    buffers[bufferView.buffer],
    byteOffset
  );
  const valueCount = accessor.count * componentCount;
  const values = new Array(valueCount);
  for (let index = 0; index < accessor.count; index += 1) {
    const elementOffset = index * byteStride;
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      values[index * componentCount + componentIndex] = readComponentValue(
        view,
        accessor.componentType,
        elementOffset + componentIndex * componentByteSize
      );
    }
  }
  return values;
}

async function decodeTexturePixels(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Eames texture: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas =
        typeof OffscreenCanvas === "function"
          ? new OffscreenCanvas(bitmap.width, bitmap.height)
          : Object.assign(document.createElement("canvas"), {
              width: bitmap.width,
              height: bitmap.height,
            });
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        throw new Error("Unable to create 2D context for texture decode.");
      }
      context.drawImage(bitmap, 0, 0);
      const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return Object.freeze({
        width: bitmap.width,
        height: bitmap.height,
        data: imageData.data,
      });
    } finally {
      bitmap.close?.();
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Failed to decode Eames texture image ${url}.`));
      element.src = objectUrl;
    });
    const canvas = Object.assign(document.createElement("canvas"), {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    });
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("Unable to create 2D context for texture decode.");
    }
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return Object.freeze({
      width: canvas.width,
      height: canvas.height,
      data: imageData.data,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function resolveMaterialTexture(document, textureRef, imageResources) {
  if (!textureRef || typeof textureRef.index !== "number") {
    return null;
  }
  const texture = document.textures?.[textureRef.index] ?? null;
  const sourceIndex = texture?.source;
  if (typeof sourceIndex !== "number") {
    return null;
  }
  const pixels = imageResources.get(sourceIndex) ?? null;
  if (!pixels) {
    return null;
  }
  return Object.freeze({
    texCoord: textureRef.texCoord ?? 0,
    scale: textureRef.scale,
    strength: textureRef.strength,
    width: pixels.width,
    height: pixels.height,
    data: pixels.data,
  });
}

function materialInfo(document, primitive, imageResources) {
  const material = document.materials?.[primitive.material] ?? null;
  const factor = material?.pbrMetallicRoughness?.baseColorFactor ?? [0.56, 0.33, 0.22, 1];
  const specularExtension = material?.extensions?.KHR_materials_specular ?? null;
  const clearcoatExtension = material?.extensions?.KHR_materials_clearcoat ?? null;
  const sheenExtension = material?.extensions?.KHR_materials_sheen ?? null;
  const transmissionExtension = material?.extensions?.KHR_materials_transmission ?? null;
  const iorExtension = material?.extensions?.KHR_materials_ior ?? null;
  const emissiveFactor = Array.isArray(material?.emissiveFactor) ? material.emissiveFactor : [0, 0, 0];
  return {
    name: material?.name ?? "default-material",
    color: {
      r: factor[0],
      g: factor[1],
      b: factor[2],
      a: factor[3] ?? 1,
    },
    opacity: factor[3] ?? 1,
    emissive: {
      r: emissiveFactor[0] ?? 0,
      g: emissiveFactor[1] ?? 0,
      b: emissiveFactor[2] ?? 0,
      a: 1,
    },
    roughness:
      typeof material?.pbrMetallicRoughness?.roughnessFactor === "number"
        ? material.pbrMetallicRoughness.roughnessFactor
        : 0.92,
    metallic:
      typeof material?.pbrMetallicRoughness?.metallicFactor === "number"
        ? material.pbrMetallicRoughness.metallicFactor
        : 0.08,
    specular:
      typeof specularExtension?.specularFactor === "number"
        ? specularExtension.specularFactor
        : 1,
    specularColor: Array.isArray(specularExtension?.specularColorFactor)
      ? specularExtension.specularColorFactor
      : [1, 1, 1],
    transmission:
      typeof transmissionExtension?.transmissionFactor === "number"
        ? transmissionExtension.transmissionFactor
        : 0,
    ior: typeof iorExtension?.ior === "number" ? iorExtension.ior : 1.45,
    sheenColor: Array.isArray(sheenExtension?.sheenColorFactor)
      ? sheenExtension.sheenColorFactor
      : [0, 0, 0],
    clearcoat:
      typeof clearcoatExtension?.clearcoatFactor === "number"
        ? clearcoatExtension.clearcoatFactor
        : 0,
    clearcoatRoughness:
      typeof clearcoatExtension?.clearcoatRoughnessFactor === "number"
        ? clearcoatExtension.clearcoatRoughnessFactor
        : 0.08,
    baseColorTexture: resolveMaterialTexture(
      document,
      material?.pbrMetallicRoughness?.baseColorTexture,
      imageResources
    ),
    metallicRoughnessTexture: resolveMaterialTexture(
      document,
      material?.pbrMetallicRoughness?.metallicRoughnessTexture,
      imageResources
    ),
    normalTexture: resolveMaterialTexture(document, material?.normalTexture, imageResources),
    occlusionTexture: resolveMaterialTexture(document, material?.occlusionTexture, imageResources),
    emissiveTexture: resolveMaterialTexture(document, material?.emissiveTexture, imageResources),
  };
}

function computeBounds(positions) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let index = 0; index < positions.length; index += 3) {
    min[0] = Math.min(min[0], positions[index]);
    min[1] = Math.min(min[1], positions[index + 1]);
    min[2] = Math.min(min[2], positions[index + 2]);
    max[0] = Math.max(max[0], positions[index]);
    max[1] = Math.max(max[1], positions[index + 1]);
    max[2] = Math.max(max[2], positions[index + 2]);
  }
  return { min, max };
}

function createIdentityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[0 * 4 + row] * b[column * 4 + 0] +
        a[1 * 4 + row] * b[column * 4 + 1] +
        a[2 * 4 + row] * b[column * 4 + 2] +
        a[3 * 4 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function composeNodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return [...node.matrix];
  }
  const translation = Array.isArray(node.translation) ? node.translation : [0, 0, 0];
  const rotation = Array.isArray(node.rotation) ? node.rotation : [0, 0, 0, 1];
  const scale = Array.isArray(node.scale) ? node.scale : [1, 1, 1];
  const [x, y, z, w] = rotation;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * scale[0],
    (xy + wz) * scale[0],
    (xz - wy) * scale[0],
    0,
    (xy - wz) * scale[1],
    (1 - (xx + zz)) * scale[1],
    (yz + wx) * scale[1],
    0,
    (xz + wy) * scale[2],
    (yz - wx) * scale[2],
    (1 - (xx + yy)) * scale[2],
    0,
    translation[0],
    translation[1],
    translation[2],
    1,
  ];
}

function transformPosition(position, matrix) {
  return [
    matrix[0] * position[0] + matrix[4] * position[1] + matrix[8] * position[2] + matrix[12],
    matrix[1] * position[0] + matrix[5] * position[1] + matrix[9] * position[2] + matrix[13],
    matrix[2] * position[0] + matrix[6] * position[1] + matrix[10] * position[2] + matrix[14],
  ];
}

function transformNormal(normal, matrix) {
  const transformed = [
    matrix[0] * normal[0] + matrix[4] * normal[1] + matrix[8] * normal[2],
    matrix[1] * normal[0] + matrix[5] * normal[1] + matrix[9] * normal[2],
    matrix[2] * normal[0] + matrix[6] * normal[1] + matrix[10] * normal[2],
  ];
  const length = Math.hypot(transformed[0], transformed[1], transformed[2]) || 1;
  return [transformed[0] / length, transformed[1] / length, transformed[2] / length];
}

function collectPrimitives(document, buffers, imageResources) {
  const scene = document.scenes?.[document.scene ?? 0];
  if (!scene || !Array.isArray(scene.nodes)) {
    throw new Error("Eames glTF must expose a default scene.");
  }
  const primitives = [];
  let modelName = "eames-lounge-chair-ottoman";

  function visit(nodeIndex, parentMatrix) {
    const node = document.nodes?.[nodeIndex];
    if (!node) {
      throw new Error(`glTF node ${nodeIndex} is missing.`);
    }
    const worldMatrix = multiplyMatrices(parentMatrix, composeNodeMatrix(node));
    if (typeof node.name === "string" && node.name.length > 0) {
      modelName = node.name;
    }
    if (typeof node.mesh === "number") {
      const mesh = document.meshes?.[node.mesh];
      mesh.primitives.forEach((primitive, primitiveIndex) => {
        const positions = readAccessor(document, primitive.attributes.POSITION, buffers);
        const normals =
          typeof primitive.attributes.NORMAL === "number"
            ? readAccessor(document, primitive.attributes.NORMAL, buffers)
            : null;
        const uvs =
          typeof primitive.attributes.TEXCOORD_0 === "number"
            ? readAccessor(document, primitive.attributes.TEXCOORD_0, buffers)
            : null;
        const transformedPositions = [];
        const transformedNormals = [];
        for (let index = 0; index < positions.length; index += 3) {
          const point = transformPosition(
            [positions[index], positions[index + 1], positions[index + 2]],
            worldMatrix
          );
          transformedPositions.push(point[0], point[1], point[2]);
          if (normals) {
            const normal = transformNormal(
              [normals[index], normals[index + 1], normals[index + 2]],
              worldMatrix
            );
            transformedNormals.push(normal[0], normal[1], normal[2]);
          }
        }
        const indices =
          typeof primitive.indices === "number"
            ? readAccessor(document, primitive.indices, buffers).map((value) => Number(value))
            : Array.from({ length: transformedPositions.length / 3 }, (_, index) => index);
        primitives.push({
          name: `${node.name ?? mesh.name ?? "mesh"}-${primitiveIndex}`,
          positions: transformedPositions,
          indices,
          normals: transformedNormals.length > 0 ? transformedNormals : null,
          uvs,
          material: materialInfo(document, primitive, imageResources),
          bounds: computeBounds(transformedPositions),
        });
      });
    }
    if (Array.isArray(node.children)) {
      for (const childIndex of node.children) {
        visit(childIndex, worldMatrix);
      }
    }
  }

  for (const nodeIndex of scene.nodes) {
    visit(nodeIndex, createIdentityMatrix());
  }
  return { modelName, primitives };
}

async function loadDocument(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Eames glTF: ${response.status} ${response.statusText}`);
  }
  return {
    document: await response.json(),
    baseUrl: new URL(response.url),
  };
}

export async function loadEamesGltfModel(url) {
  const { document, baseUrl } = await loadDocument(url);
  const buffers = await Promise.all(
    (document.buffers ?? []).map(async (buffer) => {
      const response = await fetch(new URL(buffer.uri, baseUrl));
      if (!response.ok) {
        throw new Error(`Failed to load Eames buffer: ${response.status} ${response.statusText}`);
      }
      return response.arrayBuffer();
    })
  );
  const imageResources = new Map();
  await Promise.all(
    (document.images ?? []).map(async (image, index) => {
      if (typeof image?.uri !== "string") {
        return;
      }
      imageResources.set(index, await decodeTexturePixels(new URL(image.uri, baseUrl)));
    })
  );
  const scene = collectPrimitives(document, buffers, imageResources);
  const aggregatePositions = [];
  const aggregateIndices = [];
  for (const primitive of scene.primitives) {
    const vertexOffset = aggregatePositions.length / 3;
    for (const value of primitive.positions) {
      aggregatePositions.push(value);
    }
    for (const index of primitive.indices) {
      aggregateIndices.push(index + vertexOffset);
    }
  }
  return {
    name: scene.modelName,
    positions: aggregatePositions,
    indices: aggregateIndices,
    bounds: computeBounds(aggregatePositions),
    color: scene.primitives[0]?.material?.color ?? { r: 0.56, g: 0.33, b: 0.22, a: 1 },
    physics: {},
    primitives: scene.primitives,
  };
}
