import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');
    
if (user === 'bridgecoach' && pwd === 'test123') {
      return NextResponse.next();
    }
  }

  return new NextResponse('Toegang vereist', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="BridgeCoach"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};