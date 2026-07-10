import { useEffect, useState } from 'react';

// ขนาด viewport ที่อัปเดตเมื่อ resize/หมุนจอ — ใช้แทนการอ่าน window.innerWidth
// ตรง ๆ ระหว่าง render (ซึ่งจะค้างค่าเก่าถ้าไม่มี re-render)
export function useViewportSize(): { w: number; h: number } {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [size, setSize] = useState(get);

  useEffect(() => {
    const onResize = () => setSize(get());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return size;
}
