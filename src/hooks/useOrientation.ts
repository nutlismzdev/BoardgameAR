import { useEffect, useState } from 'react';
import type { Orientation } from '@/core/types';

// ตรวจการหมุนจอ — คืน 'portrait' | 'landscape'
// ใช้เลือกไฟล์ Layout อิสระ (ไม่ใช่แค่ media query บีบ layout เดียว)
export function useOrientation(): Orientation {
  const get = (): Orientation =>
    window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';

  const [orientation, setOrientation] = useState<Orientation>(get);

  useEffect(() => {
    const onResize = () => setOrientation(get());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return orientation;
}
