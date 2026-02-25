import type { Metadata } from 'next';
import { ProfileClient } from './profile-client';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your NextCalc profile — stats, achievements, and analytics.',
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen relative" aria-label="User profile dashboard">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(at 20% 30%, oklch(0.55 0.27 264 / 0.06) 0%, transparent 50%),
            radial-gradient(at 80% 70%, oklch(0.58 0.22 300 / 0.05) 0%, transparent 50%)
          `,
        }}
      />
      <div className="fixed inset-0 -z-10 noise pointer-events-none" aria-hidden="true" />
      <ProfileClient />
    </main>
  );
}
