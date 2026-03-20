import { auth } from '@/auth';
import pool from '@/lib/db';
import { ElderlyLogin } from '@/components/agente/elderly-login';
import { ElderlyVoiceAgent } from '@/components/agente/elderly-voice-agent';

export const metadata = {
  title: 'EmpatIA',
  description: 'A sua companhia de confiança',
};

export default async function AgentePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return <ElderlyLogin />;
  }

  // Check subscription status and monthly usage before rendering the agent
  let blockedReason: string | null = null;
  let minutesUsed = 0;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT u.user_type,
              cp.subscription_status, cp.trial_ends_at,
              COALESCE(
                (SELECT minutes_used FROM patient_usage
                 WHERE patient_id = u.id
                   AND year_month = TO_CHAR(NOW(), 'YYYY-MM')),
                0
              ) AS minutes_used
       FROM users u
       LEFT JOIN caregiver_profiles cp ON cp.user_id = u.caregiver_id
       WHERE u.id = $1::uuid`,
      [session.user.id]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      minutesUsed = Number(row.minutes_used);

      if (row.user_type === 'patient') {
        if (!row.subscription_status || row.subscription_status !== 'active') {
          blockedReason = 'SUBSCRIPTION_INACTIVE';
        } else if (row.trial_ends_at && new Date(row.trial_ends_at) < new Date()) {
          blockedReason = 'TRIAL_EXPIRED';
        } else if (minutesUsed >= 1800) {
          blockedReason = 'USAGE_LIMIT_REACHED';
        }
      }
    }
  } catch (e) {
    console.error('AgentePage usage check error:', e);
  } finally {
    client.release();
  }

  return (
    <ElderlyVoiceAgent
      userName={session.user.name?.split(' ')[0] ?? 'Amigo'}
      userId={session.user.id}
      initialBlockedReason={blockedReason}
      minutesUsed={minutesUsed}
    />
  );
}
