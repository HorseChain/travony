const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const TIKTOK_API_URL = "https://open.tiktokapis.com/v2";
const TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize";

interface TikTokTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  open_id: string;
}

let storedTokens: TikTokTokens | null = null;

export function getAuthUrl(redirectUri: string, state: string = "tiktok_auth"): string {
  if (!TIKTOK_CLIENT_KEY) return "";

  const params = new URLSearchParams({
    client_key: TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: "user.info.basic,video.publish,video.upload",
    redirect_uri: redirectUri,
    state,
  });

  return `${TIKTOK_AUTH_URL}/?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ success: boolean; tokens?: TikTokTokens; error?: string }> {
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return { success: false, error: "TikTok credentials not configured" };
  }

  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = await response.json();

    if (data.access_token) {
      storedTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        open_id: data.open_id,
      };
      return { success: true, tokens: storedTokens };
    }

    return { success: false, error: data.error_description || data.error || "Token exchange failed" };
  } catch (error: any) {
    console.error("[TikTok] Token exchange error:", error);
    return { success: false, error: error.message };
  }
}

export async function refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
  if (!storedTokens?.refresh_token || !TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return { success: false, error: "No refresh token or credentials available" };
  }

  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: storedTokens.refresh_token,
      }).toString(),
    });

    const data = await response.json();

    if (data.access_token) {
      storedTokens = {
        ...storedTokens,
        access_token: data.access_token,
        refresh_token: data.refresh_token || storedTokens.refresh_token,
        expires_in: data.expires_in,
      };
      return { success: true };
    }

    return { success: false, error: data.error_description || "Refresh failed" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function postVideoToTikTok(
  videoUrl: string,
  title: string
): Promise<{ success: boolean; publishId?: string; error?: string }> {
  if (!storedTokens?.access_token) {
    return { success: false, error: "Not authenticated. Please connect TikTok first." };
  }

  try {
    const initResponse = await fetch(`${TIKTOK_API_URL}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
    });

    const initData = await initResponse.json();

    if (initData.data?.publish_id) {
      return { success: true, publishId: initData.data.publish_id };
    }

    return {
      success: false,
      error: initData.error?.message || initData.error?.code || "Failed to init video post",
    };
  } catch (error: any) {
    console.error("[TikTok] Post error:", error);
    return { success: false, error: error.message };
  }
}

export async function postPhotoToTikTok(
  imageUrls: string[],
  title: string
): Promise<{ success: boolean; publishId?: string; error?: string }> {
  if (!storedTokens?.access_token) {
    return { success: false, error: "Not authenticated. Please connect TikTok first." };
  }

  try {
    const initResponse = await fetch(`${TIKTOK_API_URL}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.substring(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_images: imageUrls,
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });

    const initData = await initResponse.json();

    if (initData.data?.publish_id) {
      return { success: true, publishId: initData.data.publish_id };
    }

    return {
      success: false,
      error: initData.error?.message || initData.error?.code || "Failed to post photos",
    };
  } catch (error: any) {
    console.error("[TikTok] Photo post error:", error);
    return { success: false, error: error.message };
  }
}

export async function getUserInfo(): Promise<any> {
  if (!storedTokens?.access_token) {
    return { connected: false, error: "Not authenticated" };
  }

  try {
    const response = await fetch(`${TIKTOK_API_URL}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
      headers: {
        "Authorization": `Bearer ${storedTokens.access_token}`,
      },
    });

    const data = await response.json();

    if (data.data?.user) {
      return { connected: true, user: data.data.user };
    }

    return { connected: false, error: data.error?.message || "Failed to get user info" };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

export function isConnected(): boolean {
  return !!storedTokens?.access_token;
}

export function setTokens(tokens: TikTokTokens): void {
  storedTokens = tokens;
}

export function getStoredTokens(): TikTokTokens | null {
  return storedTokens;
}
