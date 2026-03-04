import { ImageResponse } from 'next/og';

/**
 * Dynamic Open Graph image for NextCalc Pro.
 *
 * Generates a 1200x630 branded OG image using Next.js ImageResponse API.
 * Uses sRGB gradient colors inspired by the OKLCH primary palette
 * (oklch(0.55 0.27 264) ~ #2563EB, oklch(0.65 0.22 264) ~ #3B82F6).
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
 */

export const alt = 'NextCalc Pro - Advanced Scientific Calculator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        // Deep navy-to-indigo gradient (sRGB approximation of OKLCH palette)
        background:
          'linear-gradient(135deg, #0A0F1E 0%, #111936 25%, #1A1F4B 50%, #1E2A6E 75%, #162050 100%)',
      }}
    >
      {/* Decorative gradient orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          right: '-80px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0) 70%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-160px',
          left: '-100px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0) 70%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '200px',
          left: '600px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0) 70%)',
          display: 'flex',
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: 'absolute',
          inset: '0',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          display: 'flex',
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          padding: '40px',
        }}
      >
        {/* Logo / Brand Mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '88px',
            height: '88px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              fontSize: '44px',
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            NC
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            textAlign: 'center',
            marginBottom: '16px',
            display: 'flex',
          }}
        >
          NextCalc Pro
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '26px',
            fontWeight: 400,
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: '700px',
            display: 'flex',
          }}
        >
          Advanced Scientific Calculator
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            marginTop: '36px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['Symbolic Math', 'GPU Plotting', 'WASM Precision', 'Real-time CAS'].map((feature) => (
            <div
              key={feature}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 22px',
                borderRadius: '999px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: '18px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          height: '4px',
          background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 33%, #EC4899 66%, #F97316 100%)',
          display: 'flex',
        }}
      />
    </div>,
    {
      ...size,
    },
  );
}
