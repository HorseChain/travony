let META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

export async function refreshAccessToken(): Promise<{ success: boolean; error?: string }> {
  if (!META_ACCESS_TOKEN || !META_APP_ID || !META_APP_SECRET) {
    return { success: false, error: "Missing META_ACCESS_TOKEN, META_APP_ID, or META_APP_SECRET" };
  }

  try {
    const res = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${META_ACCESS_TOKEN}`
    );
    const data = await res.json();

    if (data.access_token) {
      META_ACCESS_TOKEN = data.access_token;
      process.env.META_ACCESS_TOKEN = data.access_token;
      console.log("[Instagram] Token refreshed successfully, expires in:", data.expires_in, "seconds");
      return { success: true };
    }
    return { success: false, error: data.error?.message || "Failed to refresh token" };
  } catch (error: any) {
    console.error("[Instagram] Token refresh error:", error);
    return { success: false, error: error.message };
  }
}

export function getOAuthUrl(redirectUri: string): string | null {
  if (!META_APP_ID) return null;
  const scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts,business_management,public_profile";
  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&auth_type=rerequest`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  if (!META_APP_ID || !META_APP_SECRET) {
    return { success: false, error: "Missing META_APP_ID or META_APP_SECRET" };
  }

  try {
    const shortRes = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${META_APP_SECRET}&code=${code}`
    );
    const shortData = await shortRes.json();

    if (!shortData.access_token) {
      return { success: false, error: shortData.error?.message || "Failed to get short-lived token" };
    }

    const longRes = await fetch(
      `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();

    const finalToken = longData.access_token || shortData.access_token;
    META_ACCESS_TOKEN = finalToken;
    process.env.META_ACCESS_TOKEN = finalToken;
    console.log("[Instagram] New token obtained, expires in:", longData.expires_in || "unknown", "seconds");

    await discoverInstagramAccount();

    return { success: true, accessToken: finalToken };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function setToken(token: string) {
  META_ACCESS_TOKEN = token;
  process.env.META_ACCESS_TOKEN = token;
}

export async function discoverInstagramAccount(): Promise<{ success: boolean; igAccountId?: string; error?: string }> {
  if (!META_ACCESS_TOKEN) {
    return { success: false, error: "No access token" };
  }

  try {
    const pagesRes = await fetch(
      `${GRAPH_API_URL}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${META_ACCESS_TOKEN}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.data && pagesData.data.length > 0) {
      for (const page of pagesData.data) {
        if (page.instagram_business_account) {
          const igId = page.instagram_business_account.id;
          process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = igId;
          console.log("[Instagram] Discovered IG Business Account:", igId, "from page:", page.name);
          return { success: true, igAccountId: igId };
        }
      }
      console.log("[Instagram] Pages found but none have Instagram Business Account linked");
      return { success: false, error: "No Instagram Business Account linked to any Facebook Page. Link your Instagram to a Facebook Page first." };
    }

    console.log("[Instagram] No Facebook Pages found for this user");
    return { success: false, error: "No Facebook Pages found. You need a Facebook Page connected to your Instagram Business Account." };
  } catch (error: any) {
    console.error("[Instagram] Discover error:", error);
    return { success: false, error: error.message };
  }
}

interface InstagramPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

interface MediaContainerResult {
  id?: string;
  error?: { message: string; code: number };
}

export async function postImageToInstagram(
  imageUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }

  try {
    const containerRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const containerData: MediaContainerResult = await containerRes.json();

    if (!containerData.id) {
      return {
        success: false,
        error: containerData.error?.message || "Failed to create media container",
      };
    }

    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `${GRAPH_API_URL}/${containerData.id}?fields=status_code&access_token=${META_ACCESS_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || "FINISHED";
      attempts++;
    }

    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish",
    };
  } catch (error: any) {
    console.error("[Instagram] Post error:", error);
    return { success: false, error: error.message };
  }
}

export async function postCarouselToInstagram(
  imageUrls: string[],
  caption: string
): Promise<InstagramPostResult> {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }

  try {
    const containerIds: string[] = [];
    for (const url of imageUrls) {
      const res = await fetch(
        `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: META_ACCESS_TOKEN,
          }),
        }
      );
      const data = await res.json();
      if (data.id) containerIds.push(data.id);
    }

    if (containerIds.length === 0) {
      return { success: false, error: "Failed to create carousel items" };
    }

    await new Promise((r) => setTimeout(r, 5000));

    const carouselRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: containerIds,
          caption,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const carouselData = await carouselRes.json();

    if (!carouselData.id) {
      return {
        success: false,
        error: carouselData.error?.message || "Failed to create carousel",
      };
    }

    await new Promise((r) => setTimeout(r, 3000));

    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish carousel",
    };
  } catch (error: any) {
    console.error("[Instagram] Carousel error:", error);
    return { success: false, error: error.message };
  }
}

export async function postReelToInstagram(
  videoUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { success: false, error: "Instagram credentials not configured" };
  }

  try {
    const containerRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "REELS",
          video_url: videoUrl,
          caption,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const containerData = await containerRes.json();

    if (!containerData.id) {
      return {
        success: false,
        error: containerData.error?.message || "Failed to create reel container",
      };
    }

    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 60) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusRes = await fetch(
        `${GRAPH_API_URL}/${containerData.id}?fields=status_code&access_token=${META_ACCESS_TOKEN}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code || "FINISHED";
      attempts++;
    }

    const publishRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );
    const publishData = await publishRes.json();

    if (publishData.id) {
      return { success: true, postId: publishData.id };
    }
    return {
      success: false,
      error: publishData.error?.message || "Failed to publish reel",
    };
  } catch (error: any) {
    console.error("[Instagram] Reel error:", error);
    return { success: false, error: error.message };
  }
}

export async function getInstagramInsights(): Promise<any> {
  if (!META_ACCESS_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return { error: "Instagram credentials not configured" };
  }

  try {
    const profileRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=username,name,media_count,profile_picture_url&access_token=${META_ACCESS_TOKEN}`
    );
    const profile = await profileRes.json();

    if (profile.error) {
      const basicRes = await fetch(
        `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}?fields=id,name&access_token=${META_ACCESS_TOKEN}`
      );
      const basicProfile = await basicRes.json();
      if (!basicProfile.error) {
        return {
          success: true,
          profile: { ...basicProfile, username: basicProfile.name || "connected" },
          recentPosts: [],
        };
      }
      return { error: profile.error.message };
    }

    const mediaRes = await fetch(
      `${GRAPH_API_URL}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=10&access_token=${META_ACCESS_TOKEN}`
    );
    const media = await mediaRes.json();

    return {
      success: true,
      profile,
      recentPosts: media.data || [],
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

let FB_PAGE_ACCESS_TOKEN: string | null = null;
let FB_PAGE_ID: string | null = null;
let FB_PAGE_NAME: string | null = null;

export function setPageToken(token: string) {
  FB_PAGE_ACCESS_TOKEN = token;
}

export function setPageInfo(pageId: string, pageName: string) {
  FB_PAGE_ID = pageId;
  FB_PAGE_NAME = pageName;
}

export function getPageToken(): string | null {
  return FB_PAGE_ACCESS_TOKEN;
}

export function getPageInfo(): { pageId: string | null; pageName: string | null; hasToken: boolean } {
  return { pageId: FB_PAGE_ID, pageName: FB_PAGE_NAME, hasToken: !!FB_PAGE_ACCESS_TOKEN };
}

export async function saveAndValidatePageToken(token: string): Promise<{ success: boolean; pageId?: string; pageName?: string; error?: string }> {
  try {
    const meRes = await fetch(`${GRAPH_API_URL}/me?fields=id,name&access_token=${token}`);
    const meData = await meRes.json();

    if (meData.error) {
      return { success: false, error: meData.error.message };
    }

    console.log(`[Facebook] Token belongs to: ${meData.name} (ID: ${meData.id})`);

    const pagesRes = await fetch(`${GRAPH_API_URL}/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${token}`);
    const pagesData = await pagesRes.json();

    if (pagesData.data && pagesData.data.length > 0) {
      const page = pagesData.data[0];
      FB_PAGE_ID = page.id;
      FB_PAGE_NAME = page.name;
      FB_PAGE_ACCESS_TOKEN = page.access_token;
      console.log(`[Facebook] Found page: ${page.name} (ID: ${page.id}) - using page access token`);

      if (META_APP_ID && META_APP_SECRET) {
        try {
          const longRes = await fetch(
            `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${page.access_token}`
          );
          const longData = await longRes.json();
          if (longData.access_token) {
            FB_PAGE_ACCESS_TOKEN = longData.access_token;
            console.log("[Facebook] Exchanged for long-lived page token (never expires)");
          }
        } catch (e) {
          console.log("[Facebook] Could not exchange for long-lived token, using short-lived");
        }
      }

      return { success: true, pageId: page.id, pageName: page.name };
    }

    const isPage = meData.id && !meData.id.startsWith("1") ? false : true;
    const checkPageRes = await fetch(`${GRAPH_API_URL}/${meData.id}?fields=id,name,category,fan_count&access_token=${token}`);
    const checkPageData = await checkPageRes.json();

    if (checkPageData.category || checkPageData.fan_count !== undefined) {
      FB_PAGE_ACCESS_TOKEN = token;
      FB_PAGE_ID = meData.id;
      FB_PAGE_NAME = meData.name;
      console.log(`[Facebook] Token IS a page token for: ${meData.name} (ID: ${meData.id})`);

      if (META_APP_ID && META_APP_SECRET) {
        try {
          const longRes = await fetch(
            `${GRAPH_API_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${token}`
          );
          const longData = await longRes.json();
          if (longData.access_token) {
            FB_PAGE_ACCESS_TOKEN = longData.access_token;
            console.log("[Facebook] Exchanged for long-lived page token");
          }
        } catch (e) {}
      }

      return { success: true, pageId: meData.id, pageName: meData.name };
    }

    FB_PAGE_ACCESS_TOKEN = token;
    FB_PAGE_ID = meData.id;
    FB_PAGE_NAME = meData.name;
    console.log(`[Facebook] Saved token for user: ${meData.name} (no pages found - user may need to select pages in Graph API Explorer)`);
    return {
      success: true,
      pageId: meData.id,
      pageName: meData.name,
      error: "Token saved but no Facebook Pages found. In Graph API Explorer, make sure to select 'pages_manage_posts' permission and choose your 'travoney' page."
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPageStatus(): Promise<any> {
  if (!FB_PAGE_ACCESS_TOKEN || !FB_PAGE_ID) {
    return { connected: false, pageId: null, pageName: null };
  }

  try {
    const res = await fetch(`${GRAPH_API_URL}/${FB_PAGE_ID}?fields=id,name,fan_count,followers_count,link&access_token=${FB_PAGE_ACCESS_TOKEN}`);
    const data = await res.json();

    if (data.error) {
      return { connected: false, pageId: FB_PAGE_ID, pageName: FB_PAGE_NAME, error: data.error.message };
    }

    return {
      connected: true,
      pageId: data.id,
      pageName: data.name,
      fanCount: data.fan_count || 0,
      followersCount: data.followers_count || 0,
      link: data.link || null,
    };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

export async function postToFacebookPage(
  message: string,
  link?: string,
  imageUrl?: string
): Promise<InstagramPostResult> {
  const token = FB_PAGE_ACCESS_TOKEN || META_ACCESS_TOKEN;
  const pageId = FB_PAGE_ID;

  if (!token || !pageId) {
    return { success: false, error: "Facebook Page token not configured. Go to /connect-instagram to set up." };
  }

  try {
    if (imageUrl) {
      const res = await fetch(`${GRAPH_API_URL}/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl, message, access_token: token }),
      });
      const data = await res.json();
      if (data.id || data.post_id) {
        return { success: true, postId: data.post_id || data.id };
      }
      return { success: false, error: data.error?.message || "Failed to post photo" };
    }

    const body: any = { message, access_token: token };
    if (link) body.link = link;

    const res = await fetch(`${GRAPH_API_URL}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.id) {
      return { success: true, postId: data.id };
    }
    return {
      success: false,
      error: data.error?.message || "Failed to post to Facebook",
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
