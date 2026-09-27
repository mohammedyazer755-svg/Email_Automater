import { ImageResponse } from 'next/og';
export const alt = 'MailAutomator — From spreadsheet to meaningful email';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: 90,
        background: 'linear-gradient(130deg,#eef2ff,#ffffff)',
        color: '#0f172a',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 30, color: '#4f46e5', marginBottom: 36 }}>MailAutomator</div>
      <div style={{ fontSize: 70, fontWeight: 700, lineHeight: 1.1 }}>
        From spreadsheet to meaningful email.
      </div>
      <div style={{ fontSize: 28, color: '#64748b', marginTop: 32 }}>
        Clean contacts. Thoughtful campaigns. Reliable delivery.
      </div>
    </div>,
    size,
  );
}
