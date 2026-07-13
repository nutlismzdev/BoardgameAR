import { resolveApiAssetUrl } from '@/core/api';
import { radius } from '@/theme/tokens';

// ภาพประกอบคำถาม (ใช้ซ้ำทั้งการ์ดฟ้า/สาระ ใน CardModal และช่องทอง AR)
// - ว่าง/ไม่มี URL → ไม่เรนเดอร์อะไร (คำถามข้อความล้วนก็ยังทำงานปกติ)
// - โหลดรูปไม่ได้ → ซ่อนตัวเอง (กันไอคอนรูปเสีย)
export function QuestionImage({ url, maxHeight = 220 }: { url?: string; maxHeight?: number }) {
  const src = resolveApiAssetUrl(url);
  if (!src) return null;
  return (
    <img
      src={src}
      alt="ภาพประกอบคำถาม"
      loading="lazy"
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
      style={{
        display: 'block',
        maxWidth: '100%',
        maxHeight,
        margin: '0 auto 14px',
        borderRadius: radius.md,
        objectFit: 'contain',
        background: 'rgba(0,0,0,.04)',
      }}
    />
  );
}
