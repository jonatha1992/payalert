import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { bootstrapOwner, getServiceClient } from '@/lib/server/bootstrapOwner';
import { safeInternalPath } from '@/lib/server/safeRedirect';

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));

  const cookieResponse = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => {
        cookies.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          cookieResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const failedRedirect = NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));
    cookieResponse.cookies.getAll().forEach((cookie) => failedRedirect.cookies.set(cookie));
    return failedRedirect;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || !user.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));
  }

  const service = getServiceClient();
  const { data: existingProfile, error: profileError } = await service.from('users').select('id').eq('id', user.id).maybeSingle();
  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=oauth_callback_failed', request.url));
  }
  if (!existingProfile) {
    try {
      await bootstrapOwner(service, user);
    } catch (error) {
      await supabase.auth.signOut();
      const reason = error instanceof Error && error.message === 'signup_not_allowed' ? 'signup_not_allowed' : 'oauth_callback_failed';
      return NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    }
  }

  const redirect = NextResponse.redirect(new URL(safeInternalPath(request.nextUrl.searchParams.get('next')), request.url));
  cookieResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
