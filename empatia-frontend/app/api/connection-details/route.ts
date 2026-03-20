import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { auth } from '@/auth';
import pool from '@/lib/db';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const MONTHLY_LIMIT_MINUTES = 1800;

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) throw new Error('LIVEKIT_URL is not defined');
    if (API_KEY === undefined) throw new Error('LIVEKIT_API_KEY is not defined');
    if (API_SECRET === undefined) throw new Error('LIVEKIT_API_SECRET is not defined');

    // Require authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const userId = session.user.id;

    // Parse agent config from request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name;
    const requestedName: string | undefined = body?.name;

    // Subscription + usage check (patients only)
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT u.user_type,
                cp.subscription_status, cp.subscription_tier, cp.trial_ends_at,
                COALESCE(
                  (SELECT minutes_used FROM patient_usage
                   WHERE patient_id = u.id
                     AND year_month = TO_CHAR(NOW(), 'YYYY-MM')),
                  0
                ) AS minutes_used
         FROM users u
         LEFT JOIN caregiver_profiles cp ON cp.user_id = u.caregiver_id
         WHERE u.id = $1::uuid`,
        [userId]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
      }

      const { user_type, subscription_status, subscription_tier, trial_ends_at, minutes_used } =
        res.rows[0];

      // Only restrict patients (caregivers can connect freely for testing)
      if (user_type === 'patient') {
        // Check subscription is active
        if (!subscription_status || subscription_status !== 'active') {
          return NextResponse.json({ error: 'SUBSCRIPTION_INACTIVE' }, { status: 403 });
        }

        // Check trial expiry (trial = active status + trial_ends_at set)
        if (trial_ends_at && new Date(trial_ends_at) < new Date()) {
          return NextResponse.json({ error: 'TRIAL_EXPIRED' }, { status: 403 });
        }

        // Check monthly usage limit
        if (Number(minutes_used) >= MONTHLY_LIMIT_MINUTES) {
          return NextResponse.json(
            {
              error: 'USAGE_LIMIT_REACHED',
              minutesUsed: Number(minutes_used),
              limit: MONTHLY_LIMIT_MINUTES,
            },
            { status: 403 }
          );
        }
      }
    } finally {
      client.release();
    }

    const participantIdentity = userId;
    const participantName = requestedName || session.user.name || 'user';
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    console.log('Connection Request:', { participantIdentity, participantName });

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantToken,
      participantName,
    };
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName?: string
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
