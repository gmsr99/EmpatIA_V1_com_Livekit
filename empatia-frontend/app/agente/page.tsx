import { auth } from '@/auth';
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

  return (
    <ElderlyVoiceAgent
      userName={session.user.name?.split(' ')[0] ?? 'Amigo'}
      userId={session.user.id}
    />
  );
}
