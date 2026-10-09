import { redirect } from 'next/navigation';

// ponytail: registrace je teď onboarding se jménem na /start
export default function RegisterPage() {
  redirect('/start');
}
