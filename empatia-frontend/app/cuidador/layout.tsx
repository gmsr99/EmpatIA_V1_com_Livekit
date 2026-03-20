import { auth } from '@/auth';
import { CaregiverLogin } from '@/components/cuidador/caregiver-login';

export default async function CuidadorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    return <CaregiverLogin />;
  }

  return <>{children}</>;
}
