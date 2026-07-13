// mind-ar ไม่มี type declarations — ประกาศ subpath ที่เราใช้ (three build) เป็น any
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MindARThree: any;
}
