import { NextRequest, NextResponse } from "next/server";

const AUTH_REALM = "Website Roast AI Admin";

function parseBasicAuth(header: string | null): {
  username: string;
  password: string;
} | null {
  if (!header) {
    return null;
  }

  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return null;
  }

  try {
    const decoded = atob(match[1]);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function unauthorizedResponse(): NextResponse {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${AUTH_REALM}", charset="UTF-8"`,
    },
  });
}

export function proxy(request: NextRequest): NextResponse {
  const adminUser = process.env.ADMIN_DASH_USER?.trim();
  const adminPassword = process.env.ADMIN_DASH_PASSWORD?.trim();

  if (!adminUser || !adminPassword) {
    return new NextResponse(
      "Admin dashboard auth is not configured. Set ADMIN_DASH_USER and ADMIN_DASH_PASSWORD.",
      { status: 503 },
    );
  }

  const auth = parseBasicAuth(request.headers.get("authorization"));
  if (!auth) {
    return unauthorizedResponse();
  }

  if (auth.username !== adminUser || auth.password !== adminPassword) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/analytics/:path*", "/api/track/summary"],
};
