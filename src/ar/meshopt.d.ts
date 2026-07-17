// @types/three (0.152) ไม่มี typing ของ meshopt decoder — ประกาศ subpath ที่เราใช้เป็น any
// (โมเดลบทเรียน .glb บีบด้วย EXT_meshopt_compression → GLTFLoader ต้องมี decoder ตัวนี้)
declare module 'three/examples/jsm/libs/meshopt_decoder.module.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MeshoptDecoder: any;
}
