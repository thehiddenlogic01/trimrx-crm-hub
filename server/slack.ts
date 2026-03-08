import { WebClient } from "@slack/web-api";
import { type Express, type Request, type Response } from "express";
import { storage } from "./storage";

const SLACK_TOKEN_KEY = "slack_bot_token";
const SLACK_USER_TOKEN_KEY = "slack_user_token";

let cachedBotClient: { client: WebClient; token: string } | null = null;
let cachedUserClient: { client: WebClient; token: string } | null = null;

function getSlackClient(token: string) {
  return new WebClient(token, {
    retryConfig: { retries: 3, factor: 2 },
    rejectRateLimitedCalls: false,
  });
}

function getBotClient(token: string): WebClient {
  if (cachedBotClient && cachedBotClient.token === token) return cachedBotClient.client;
  const client = getSlackClient(token);
  cachedBotClient = { client, token };
  return client;
}

function getCachedUserClient(token: string): WebClient {
  if (cachedUserClient && cachedUserClient.token === token) return cachedUserClient.client;
  const client = getSlackClient(token);
  cachedUserClient = { client, token };
  return client;
}

async function requireSlack(req: Request, res: Response): Promise<WebClient | null> {
  const token = await storage.getSetting(SLACK_TOKEN_KEY);
  if (!token) {
    res.status(400).json({ message: "Slack is not connected. Please add your Bot Token first." });
    return null;
  }
  return getBotClient(token);
}

async function getUserSlackClient(): Promise<WebClient | null> {
  const token = await storage.getSetting(SLACK_USER_TOKEN_KEY);
  if (!token) return null;
  return getCachedUserClient(token);
}

const slackQueue: (() => Promise<void>)[] = [];
let activeSlackCalls = 0;
const MAX_CONCURRENT_SLACK = 10;

function enqueueSlackCall<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      activeSlackCalls++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        activeSlackCalls--;
        processQueue();
      }
    };
    if (activeSlackCalls < MAX_CONCURRENT_SLACK) {
      run();
    } else {
      slackQueue.push(run);
    }
  });
}

function processQueue() {
  while (activeSlackCalls < MAX_CONCURRENT_SLACK && slackQueue.length > 0) {
    const next = slackQueue.shift();
    if (next) next();
  }
}

export function setupSlackRoutes(app: Express) {
  app.get("/api/slack/status", async (_req, res) => {
    const token = await storage.getSetting(SLACK_TOKEN_KEY);
    const userToken = await storage.getSetting(SLACK_USER_TOKEN_KEY);
    if (!token) {
      return res.json({ connected: false, userTokenConnected: false });
    }
    try {
      const client = getSlackClient(token);
      const auth = await client.auth.test();
      let userTokenInfo: { connected: boolean; user?: string } = { connected: false };
      if (userToken) {
        try {
          const userClient = getSlackClient(userToken);
          const userAuth = await userClient.auth.test();
          userTokenInfo = { connected: true, user: userAuth.user as string };
        } catch {
          userTokenInfo = { connected: false };
        }
      }
      return res.json({
        connected: true,
        team: auth.team,
        user: auth.user,
        teamId: auth.team_id,
        userTokenConnected: userTokenInfo.connected,
        userTokenUser: userTokenInfo.user,
      });
    } catch {
      return res.json({ connected: false, error: "Invalid token", userTokenConnected: false });
    }
  });

  app.post("/api/slack/connect", async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Bot token is required" });
    }
    try {
      const client = getSlackClient(token);
      const auth = await client.auth.test();
      await storage.setSetting(SLACK_TOKEN_KEY, token);
      return res.json({
        connected: true,
        team: auth.team,
        user: auth.user,
        teamId: auth.team_id,
      });
    } catch {
      return res.status(400).json({ message: "Invalid Slack Bot Token. Please check and try again." });
    }
  });

  app.post("/api/slack/connect-user-token", async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== "string" || !token.startsWith("xoxp-")) {
      return res.status(400).json({ message: "Valid User OAuth Token (xoxp-...) is required" });
    }
    try {
      const client = getSlackClient(token);
      const auth = await client.auth.test();
      await storage.setSetting(SLACK_USER_TOKEN_KEY, token);
      return res.json({
        connected: true,
        user: auth.user,
      });
    } catch {
      return res.status(400).json({ message: "Invalid User OAuth Token. Please check and try again." });
    }
  });

  app.post("/api/slack/disconnect-user-token", async (_req, res) => {
    await storage.deleteSetting(SLACK_USER_TOKEN_KEY);
    cachedUserClient = null;
    return res.json({ connected: false });
  });

  app.post("/api/slack/disconnect", async (_req, res) => {
    await storage.deleteSetting(SLACK_TOKEN_KEY);
    cachedBotClient = null;
    return res.json({ connected: false });
  });

  app.get("/api/slack/channels", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const types = (req.query.types as string) || "public_channel,private_channel";
      const result = await client.conversations.list({
        types,
        limit: 200,
        exclude_archived: true,
      });
      const channels = (result.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name || ch.id,
        is_private: ch.is_private,
        is_im: ch.is_im,
        is_mpim: ch.is_mpim,
        topic: ch.topic?.value || "",
        purpose: ch.purpose?.value || "",
        num_members: ch.num_members || 0,
      }));
      return res.json(channels);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch channels" });
    }
  });

  const dateCache: Record<string, { data: any[]; fetchedAt: number }> = {};
  const DATE_CACHE_TTL = 5 * 60 * 1000;

  const replyCache: Record<string, { data: any[]; fetchedAt: number }> = {};
  const REPLY_CACHE_TTL = 5 * 60 * 1000;

  const parentMsgCache: Record<string, { text: string; user: string }> = {};

  function parentCacheKey(channelId: string, ts: string) {
    return `${channelId}:${ts}`;
  }

  function formatMessage(msg: any, channelId: string, msgByTs: Record<string, any>) {
    const isReply = msg.thread_ts && msg.thread_ts !== msg.ts;
    let parentText = "";
    let parentUser = "";
    if (isReply) {
      const parentInList = msgByTs[msg.thread_ts];
      if (parentInList) {
        parentText = (parentInList.text || "").slice(0, 200);
        parentUser = parentInList.user || "";
      } else {
        const cached = parentMsgCache[parentCacheKey(channelId, msg.thread_ts)];
        if (cached) {
          parentText = cached.text.slice(0, 200);
          parentUser = cached.user;
        }
      }
    }
    return {
      ts: msg.ts,
      user: msg.user,
      text: msg.text || "",
      thread_ts: msg.thread_ts,
      reply_count: msg.reply_count || 0,
      parent_text: isReply ? parentText : undefined,
      parent_user: isReply ? parentUser : undefined,
      reactions: (msg.reactions || []).map((r: any) => ({
        name: r.name,
        count: r.count,
        users: r.users,
      })),
      files: (msg.files || []).map((f: any) => ({
        name: f.name,
        url: f.url_private,
        mimetype: f.mimetype,
      })),
      attachments: (msg.attachments || []).map((a: any) => ({
        title: a.title,
        text: a.text,
        title_link: a.title_link,
        color: a.color,
        service_name: a.service_name,
      })),
    };
  }

  const PARALLEL_BATCH = 5;

  async function fetchAndCacheParents(client: any, channelId: string, parentTsList: string[]) {
    for (let i = 0; i < parentTsList.length; i += PARALLEL_BATCH) {
      const batch = parentTsList.slice(i, i + PARALLEL_BATCH);
      if (i > 0) await new Promise(r => setTimeout(r, 400));
      const results = await Promise.allSettled(
        batch.map((parentTs) =>
          enqueueSlackCall(() => client.conversations.history({
            channel: channelId,
            latest: parentTs,
            oldest: parentTs,
            inclusive: true,
            limit: 1,
          }).then((r: any) => ({ parentTs, msg: r.messages?.[0] })))
        )
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.msg) {
          parentMsgCache[parentCacheKey(channelId, r.value.parentTs)] = {
            text: r.value.msg.text || "",
            user: r.value.msg.user || "",
          };
        }
      }
    }
  }

  app.get("/api/slack/channels/:channelId/messages", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const { channelId } = req.params;
      const dateStr = req.query.date as string | undefined;
      const forceRefresh = req.query.force === "1";

      if (dateStr) {
        const cacheKey = `${channelId}:${dateStr}`;
        const cached = dateCache[cacheKey];
        if (!forceRefresh && cached && (Date.now() - cached.fetchedAt) < DATE_CACHE_TTL) {
          return res.json(cached.data);
        }

        const dayStart = new Date(dateStr + "T00:00:00-06:00");
        const dayEnd = new Date(dateStr + "T23:59:59-06:00");
        if (isNaN(dayStart.getTime())) {
          return res.json([]);
        }
        const oldest = String(dayStart.getTime() / 1000);
        const latest = String(dayEnd.getTime() / 1000);

        let allRawMessages: any[] = [];
        let cursor: string | undefined;
        let page = 0;
        do {
          const params: any = { channel: channelId, limit: 200, oldest, latest };
          if (cursor) params.cursor = cursor;
          const result = await client.conversations.history(params);
          allRawMessages = allRawMessages.concat(result.messages || []);
          cursor = result.has_more ? result.response_metadata?.next_cursor : undefined;
          page++;
        } while (cursor && page < 30);
        allRawMessages.sort((a, b) => Number(a.ts) - Number(b.ts));

        const msgByTs: Record<string, any> = {};
        for (const msg of allRawMessages) {
          msgByTs[msg.ts] = msg;
        }

        const parentTsToFetch: string[] = [];
        for (const msg of allRawMessages) {
          if (msg.thread_ts && msg.thread_ts !== msg.ts && !msgByTs[msg.thread_ts]) {
            const pk = parentCacheKey(channelId, msg.thread_ts);
            if (forceRefresh || !parentMsgCache[pk]) {
              if (!parentTsToFetch.includes(msg.thread_ts)) parentTsToFetch.push(msg.thread_ts);
            }
          }
        }

        await fetchAndCacheParents(client, channelId, parentTsToFetch);

        const messages = allRawMessages.map((msg) => formatMessage(msg, channelId, msgByTs));
        dateCache[cacheKey] = { data: messages, fetchedAt: Date.now() };
        return res.json(messages);
      }

      const historyParams: any = { channel: channelId, limit: 50 };
      const result = await client.conversations.history(historyParams);
      const allRawMessages = result.messages || [];
      allRawMessages.sort((a: any, b: any) => Number(a.ts) - Number(b.ts));
      const msgByTs: Record<string, any> = {};
      for (const msg of allRawMessages) {
        msgByTs[msg.ts] = msg;
      }

      const parentTsToFetch: string[] = [];
      for (const msg of allRawMessages) {
        if (msg.thread_ts && msg.thread_ts !== msg.ts && !msgByTs[msg.thread_ts]) {
          const pk = parentCacheKey(channelId, msg.thread_ts);
          if (!parentMsgCache[pk]) {
            if (!parentTsToFetch.includes(msg.thread_ts)) parentTsToFetch.push(msg.thread_ts);
          }
        }
      }

      await fetchAndCacheParents(client, channelId, parentTsToFetch);

      const messages = allRawMessages.map((msg) => formatMessage(msg, channelId, msgByTs));
      return res.json(messages);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch messages" });
    }
  });

  app.get("/api/slack/channels/:channelId/replies/:threadTs", async (req, res) => {
    const botClient = await requireSlack(req, res);
    if (!botClient) return;
    try {
      const { channelId, threadTs } = req.params;
      const force = req.query.force === "1";
      const cacheKey = `${channelId}:${threadTs}`;
      if (!force && replyCache[cacheKey] && Date.now() - replyCache[cacheKey].fetchedAt < REPLY_CACHE_TTL) {
        return res.json(replyCache[cacheKey].data);
      }
      const userClient = await getUserSlackClient();
      const client = userClient || botClient;
      const result = await enqueueSlackCall(() => client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 100,
      }));
      const messages = (result.messages || []).slice(1).map((msg: any) => ({
        ts: msg.ts,
        user: msg.user,
        text: msg.text || "",
        bot_id: msg.bot_id || null,
        reactions: (msg.reactions || []).map((r: any) => ({
          name: r.name,
          count: r.count,
          users: r.users,
        })),
        files: (msg.files || []).map((f: any) => ({
          name: f.name,
          url: f.url_private,
          mimetype: f.mimetype,
        })),
      }));
      replyCache[cacheKey] = { data: messages, fetchedAt: Date.now() };
      return res.json(messages);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch replies" });
    }
  });

  const TRACKER_PATTERNS = [
    "i have added the account to our tracker",
    "i have added the account o our tracker",
    "added the account to our tracker",
    "added the account o our tracker",
    "added your account to our tracker",
  ];
  function textMatchesTracker(text: string): boolean {
    const lower = text.toLowerCase();
    return TRACKER_PATTERNS.some((p) => lower.includes(p));
  }
  const replyScanCache: Record<string, { result: { matchedBy: string } | null; fetchedAt: number }> = {};
  const REPLY_SCAN_CACHE_TTL = 5 * 60 * 1000;

  app.post("/api/slack/clear-scan-cache", async (_req, res) => {
    for (const key of Object.keys(replyScanCache)) {
      delete replyScanCache[key];
    }
    res.json({ cleared: true });
  });

  app.post("/api/slack/channels/:channelId/scan-replies", async (req, res) => {
    const botClient = await requireSlack(req, res);
    if (!botClient) return;
    try {
      const { channelId } = req.params;
      const { messageTimestamps, filter } = req.body as { messageTimestamps: string[]; filter: string };
      if (!messageTimestamps || !Array.isArray(messageTimestamps)) {
        return res.status(400).json({ message: "messageTimestamps array required" });
      }

      const userClient = await getUserSlackClient();
      const client = userClient || botClient;

      if (!usersCache || (Date.now() - usersCache.fetchedAt) >= USERS_CACHE_TTL) {
        const users: Record<string, { name: string; avatar: string; real_name: string; display_name: string }> = {};
        let cursor: string | undefined = undefined;
        do {
          const result: any = await botClient.users.list({ limit: 200, cursor });
          for (const member of result.members || []) {
            if (member.id) {
              users[member.id] = {
                name: member.name || member.id,
                real_name: member.real_name || member.profile?.real_name || member.name || member.id,
                display_name: member.profile?.display_name || "",
                avatar: member.profile?.image_48 || "",
              };
            }
          }
          cursor = result.response_metadata?.next_cursor;
        } while (cursor);
        usersCache = { data: users, fetchedAt: Date.now() };
      }

      const karlaIds: string[] = [];
      const emilioIds: string[] = [];
      const oliaIds: string[] = [];
      for (const [id, u] of Object.entries(usersCache.data)) {
        const rn = (u.real_name || "").toLowerCase();
        const dn = (u.display_name || "").toLowerCase();
        const n = (u.name || "").toLowerCase();
        const allNames = `${rn} ${dn} ${n}`;
        if (allNames.includes("karla") && allNames.includes("garibay")) {
          karlaIds.push(id);
        }
        if ((allNames.includes("emilio") && allNames.includes("rodriguez")) || (n.includes("emilio") && allNames.includes("trimrx"))) {
          emilioIds.push(id);
        }
        if (allNames.includes("olia") && allNames.includes("orlowska")) {
          oliaIds.push(id);
        }
      }
      const managedByIds = new Set([...karlaIds, ...emilioIds]);
      const oliaIdSet = new Set(oliaIds);

      const matched: Record<string, { matchedBy: string }> = {};
      const now = Date.now();
      const toFetch: string[] = [];

      for (const ts of messageTimestamps) {
        const cacheKey = `${channelId}:${filter}:${ts}`;
        const cached = replyScanCache[cacheKey];
        if (cached && (now - cached.fetchedAt) < REPLY_SCAN_CACHE_TTL) {
          if (cached.result) matched[ts] = cached.result;
        } else {
          toFetch.push(ts);
        }
      }

      const batchSize = 4;
      let scanned = messageTimestamps.length - toFetch.length;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        if (i > 0) await new Promise(r => setTimeout(r, 600));
        const results = await Promise.all(
          batch.map(async (ts) => {
            try {
              const result = await enqueueSlackCall(() => client.conversations.replies({
                channel: channelId,
                ts,
                limit: 50,
              }));
              const replies = (result.messages || []).slice(1);
              if (filter === "managed-karla-emi") {
                for (const reply of replies) {
                  const userId = reply.user;
                  const text = (reply.text || "").toLowerCase();
                  if (managedByIds.has(userId) && textMatchesTracker(text)) {
                    const userName = usersCache!.data[userId]?.real_name || usersCache!.data[userId]?.name || userId;
                    return { ts, match: { matchedBy: userName } as { matchedBy: string } };
                  }
                }
              }
              if (filter === "not-managed-karla-emi") {
                const isManagedByKarlaEmi = replies.some((reply) => {
                  const userId = reply.user;
                  const text = (reply.text || "").toLowerCase();
                  return managedByIds.has(userId) && textMatchesTracker(text);
                });
                if (!isManagedByKarlaEmi) {
                  return { ts, match: { matchedBy: "Not managed" } as { matchedBy: string } };
                }
              }
              if (filter === "with-close-case") {
                const closePatterns = ["closed", "i have closed the account", "close case", "account has been closed"];
                for (const reply of replies) {
                  const text = (reply.text || "").toLowerCase();
                  if (closePatterns.some((p) => text.includes(p))) {
                    const userId = reply.user || "";
                    const userName = usersCache!.data[userId]?.real_name || usersCache!.data[userId]?.name || userId;
                    return { ts, match: { matchedBy: userName } as { matchedBy: string } };
                  }
                }
              }
              if (filter === "without-close-case") {
                const closePatterns = ["closed", "i have closed the account", "close case", "account has been closed"];
                const hasClose = replies.some((reply) => {
                  const text = (reply.text || "").toLowerCase();
                  return closePatterns.some((p) => text.includes(p));
                });
                if (!hasClose) {
                  return { ts, match: { matchedBy: "No close" } as { matchedBy: string } };
                }
              }
              if (filter === "active-payment") {
                const activePatterns = ["payment has been captured", "this is an active treatment", "active treatment"];
                const excludeClosePatterns = ["closed", "i have closed the account", "close case", "account has been closed"];
                const excludeRetentionPatterns = ["patient has been assigned to retention"];
                const hasExclude = replies.some((reply) => {
                  const text = (reply.text || "").toLowerCase();
                  return excludeClosePatterns.some((p) => text.includes(p)) ||
                    excludeRetentionPatterns.some((p) => text.includes(p));
                });
                if (!hasExclude) {
                  for (const reply of replies) {
                    const text = (reply.text || "").toLowerCase();
                    const mentionsOlia = oliaIdSet.size > 0 && (
                      oliaIds.some((oid) => (reply.text || "").includes(`<@${oid}>`)) ||
                      text.includes("olia") ||
                      text.includes("orlowska")
                    );
                    if (mentionsOlia && activePatterns.some((p) => text.includes(p))) {
                      const userId = reply.user || "";
                      const userName = usersCache!.data[userId]?.real_name || usersCache!.data[userId]?.name || userId;
                      return { ts, match: { matchedBy: userName } as { matchedBy: string } };
                    }
                  }
                }
              }
              return { ts, match: null };
            } catch {
              return { ts, match: null };
            }
          })
        );
        for (const r of results) {
          const cacheKey = `${channelId}:${filter}:${r.ts}`;
          replyScanCache[cacheKey] = { result: r.match, fetchedAt: now };
          if (r.match) matched[r.ts] = r.match;
        }
        scanned += batch.length;
      }

      return res.json({ matched, total: messageTimestamps.length, matchedCount: Object.keys(matched).length });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to scan replies" });
    }
  });

  let usersCache: { data: Record<string, { name: string; avatar: string; real_name: string; display_name: string }>; fetchedAt: number } | null = null;
  const USERS_CACHE_TTL = 30 * 60 * 1000;

  app.get("/api/slack/users", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const now = Date.now();
      if (usersCache && (now - usersCache.fetchedAt) < USERS_CACHE_TTL) {
        return res.json(usersCache.data);
      }
      const users: Record<string, { name: string; avatar: string; real_name: string; display_name: string }> = {};
      let cursor: string | undefined = undefined;
      do {
        const result: any = await client.users.list({ limit: 200, cursor });
        for (const member of result.members || []) {
          if (member.id) {
            users[member.id] = {
              name: member.name || member.id,
              real_name: member.real_name || member.profile?.real_name || member.name || member.id,
              display_name: member.profile?.display_name || "",
              avatar: member.profile?.image_48 || "",
            };
          }
        }
        cursor = result.response_metadata?.next_cursor;
      } while (cursor);
      usersCache = { data: users, fetchedAt: now };
      return res.json(users);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to fetch users" });
    }
  });

  const channelCache: Record<string, { messages: any[]; fetchedAt: number; fetching: Promise<any[]> | null }> = {};
  const CACHE_TTL = 5 * 60 * 1000;

  async function getChannelMessages(client: any, channelId: string): Promise<any[]> {
    const now = Date.now();
    const cached = channelCache[channelId];
    if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
      return cached.messages;
    }
    if (cached?.fetching) {
      return cached.fetching;
    }
    const fetchPromise = (async () => {
      let allMessages: any[] = [];
      let cursor: string | undefined;
      const maxPages = 50;
      let page = 0;
      do {
        const result = await client.conversations.history({
          channel: channelId,
          limit: 200,
          cursor,
        });
        allMessages = allMessages.concat(result.messages || []);
        cursor = result.has_more ? result.response_metadata?.next_cursor : undefined;
        page++;
      } while (cursor && page < maxPages);
      channelCache[channelId] = { messages: allMessages, fetchedAt: Date.now(), fetching: null };
      return allMessages;
    })();
    if (!channelCache[channelId]) {
      channelCache[channelId] = { messages: [], fetchedAt: 0, fetching: fetchPromise };
    } else {
      channelCache[channelId].fetching = fetchPromise;
    }
    return fetchPromise;
  }

  app.get("/api/slack/channels/:channelId/search", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const { channelId } = req.params;
      const queryRaw = (req.query.q as string || "").trim();
      if (!queryRaw) {
        return res.json([]);
      }

      const userClient = await getUserSlackClient();
      if (userClient) {
        try {
          let channelName = channelId;
          try {
            const info = await client.conversations.info({ channel: channelId });
            channelName = (info.channel as any)?.name || channelId;
          } catch {}
          const searchQuery = `in:${channelName} ${queryRaw}`;
          const searchResult = await userClient.search.messages({
            query: searchQuery,
            sort: "timestamp",
            sort_dir: "desc",
            count: 50,
          });
          const matches = (searchResult as any).messages?.matches || [];

          const needFetch = matches.map((m: any) => m.ts as string);

          const fetchedByTs: Record<string, any> = {};
          const ENRICH_BATCH = 5;
          for (let i = 0; i < needFetch.length; i += ENRICH_BATCH) {
            const batch = needFetch.slice(i, i + ENRICH_BATCH);
            const results = await Promise.allSettled(
              batch.map((ts) =>
                client.conversations.history({
                  channel: channelId,
                  latest: ts,
                  oldest: ts,
                  inclusive: true,
                  limit: 1,
                }).then((r: any) => ({ ts, msg: r.messages?.[0] }))
              )
            );
            for (const r of results) {
              if (r.status === "fulfilled" && r.value.msg) {
                fetchedByTs[r.value.ts] = r.value.msg;
              }
            }
          }

          const allByTs = { ...fetchedByTs };
          const parentTsToFetch: string[] = [];
          for (const m of matches) {
            if (m.thread_ts && m.thread_ts !== m.ts) {
              const pk = parentCacheKey(channelId, m.thread_ts);
              if (!allByTs[m.thread_ts] && !parentMsgCache[pk]) {
                parentTsToFetch.push(m.thread_ts);
              }
            }
          }
          if (parentTsToFetch.length > 0) {
            await fetchAndCacheParents(client, channelId, [...new Set(parentTsToFetch)]);
          }

          const messages = matches.map((msg: any) => {
            const realtime = allByTs[msg.ts];
            const source = realtime
              ? { ...realtime, reply_count: realtime.reply_count || msg.reply_count || 0 }
              : msg;
            return formatMessage(source, channelId, allByTs);
          });
          return res.json(messages);
        } catch {
          // User token failed (expired/revoked) — fall through to bot cache search
        }
      }

      const queryLower = queryRaw.toLowerCase();
      const queryTerms = queryLower.split("|").map((t) => t.trim()).filter(Boolean);
      if (queryTerms.length === 0) {
        return res.json([]);
      }
      const allMessages = await getChannelMessages(client, channelId);
      const matched = allMessages.filter((msg) => {
        const text = (msg.text || "").toLowerCase();
        const attText = (msg.attachments || []).map((a: any) => `${a.title || ""} ${a.text || ""} ${a.title_link || ""}`).join(" ").toLowerCase();
        const combined = text + " " + attText;
        return queryTerms.some((term) => combined.includes(term));
      });
      matched.sort((a: any, b: any) => Number(a.ts) - Number(b.ts));
      const sliced = matched.slice(0, 50);
      const msgByTs: Record<string, any> = {};
      for (const m of allMessages) { msgByTs[m.ts] = m; }
      const parentTsToFetch: string[] = [];
      for (const m of sliced) {
        if (m.thread_ts && m.thread_ts !== m.ts) {
          const pk = parentCacheKey(channelId, m.thread_ts);
          if (!msgByTs[m.thread_ts] && !parentMsgCache[pk]) {
            parentTsToFetch.push(m.thread_ts);
          }
        }
      }
      if (parentTsToFetch.length > 0) {
        await fetchAndCacheParents(client, channelId, [...new Set(parentTsToFetch)]);
      }
      const messages = sliced.map((msg) => formatMessage(msg, channelId, msgByTs));
      return res.json(messages);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to search messages" });
    }
  });

  app.post("/api/slack/channels/:channelId/reply", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    const { thread_ts, text } = req.body;
    if (!thread_ts || typeof thread_ts !== "string") {
      return res.status(400).json({ message: "thread_ts is required" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }
    try {
      const { channelId } = req.params;

      let processedText = text.trim();

      let users: Record<string, { name: string; real_name: string; display_name: string; avatar?: string }> = {};
      if (usersCache && (Date.now() - usersCache.fetchedAt) < USERS_CACHE_TTL) {
        users = usersCache.data;
      } else {
        try {
          const allUsers: Record<string, { name: string; avatar: string; real_name: string; display_name: string }> = {};
          let cursor: string | undefined = undefined;
          do {
            const result: any = await client.users.list({ limit: 200, cursor });
            for (const member of result.members || []) {
              if (member.id) {
                allUsers[member.id] = {
                  name: member.name || member.id,
                  real_name: member.real_name || member.profile?.real_name || member.name || member.id,
                  display_name: member.profile?.display_name || "",
                  avatar: member.profile?.image_48 || "",
                };
              }
            }
            cursor = result.response_metadata?.next_cursor;
          } while (cursor);
          usersCache = { data: allUsers, fetchedAt: Date.now() };
          users = allUsers;
        } catch {}
      }

      const allNameEntries: { id: string; nameStr: string }[] = [];
      for (const [id, u] of Object.entries(users)) {
        const names = new Set<string>();
        if (u.display_name) names.add(u.display_name);
        if (u.real_name) names.add(u.real_name);
        if (u.name) names.add(u.name);
        for (const n of names) {
          allNameEntries.push({ id, nameStr: n });
        }
      }
      allNameEntries.sort((a, b) => b.nameStr.length - a.nameStr.length);

      for (const entry of allNameEntries) {
        const escaped = entry.nameStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`@${escaped}(?!\\w)`, "gi");
        processedText = processedText.replace(pattern, `<@${entry.id}>`);
      }

      await client.chat.postMessage({
        channel: channelId,
        text: processedText,
        thread_ts,
      });
      const patchReplyCount = (messages: any[]) => {
        for (const msg of messages) {
          if (msg.ts === thread_ts) {
            msg.reply_count = (msg.reply_count || 0) + 1;
            break;
          }
        }
      };
      const cached = channelCache[channelId];
      if (cached?.messages) patchReplyCount(cached.messages);
      for (const [key, entry] of Object.entries(dateCache)) {
        if (key.startsWith(channelId + ":") && entry.data) patchReplyCount(entry.data);
      }
      delete replyCache[`${channelId}:${thread_ts}`];
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to send reply" });
    }
  });

  app.post("/api/slack/channels/:channelId/send", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    const { channelId } = req.params;
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Message text is required" });
    }
    try {
      let processedText = text.trim();

      let users: Record<string, { name: string; real_name: string; display_name: string }> = {};
      if (usersCache && (Date.now() - usersCache.fetchedAt) < USERS_CACHE_TTL) {
        users = usersCache.data;
      } else {
        try {
          const allUsers: Record<string, { name: string; avatar: string; real_name: string; display_name: string }> = {};
          let cursor: string | undefined = undefined;
          do {
            const result: any = await client.users.list({ limit: 200, cursor });
            for (const member of result.members || []) {
              if (member.id) {
                allUsers[member.id] = {
                  name: member.name || member.id,
                  real_name: member.real_name || member.profile?.real_name || member.name || member.id,
                  display_name: member.profile?.display_name || "",
                  avatar: member.profile?.image_48 || "",
                };
              }
            }
            cursor = result.response_metadata?.next_cursor;
          } while (cursor);
          usersCache = { data: allUsers, fetchedAt: Date.now() };
          users = allUsers;
        } catch {}
      }

      const allNameEntries: { id: string; nameStr: string }[] = [];
      for (const [id, u] of Object.entries(users)) {
        const names = new Set<string>();
        if (u.display_name) names.add(u.display_name);
        if (u.real_name) names.add(u.real_name);
        if (u.name) names.add(u.name);
        for (const n of names) {
          allNameEntries.push({ id, nameStr: n });
        }
      }
      allNameEntries.sort((a, b) => b.nameStr.length - a.nameStr.length);

      for (const entry of allNameEntries) {
        const escaped = entry.nameStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`@${escaped}(?!\\w)`, "gi");
        processedText = processedText.replace(pattern, `<@${entry.id}>`);
      }

      await client.chat.postMessage({
        channel: channelId,
        text: processedText,
      });
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to send message" });
    }
  });

  app.get("/api/slack/file-proxy", async (req, res) => {
    const token = await storage.getSetting(SLACK_TOKEN_KEY);
    if (!token) {
      return res.status(400).json({ message: "Slack not connected" });
    }
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://files.slack.com/")) {
      return res.status(400).json({ message: "Invalid file URL" });
    }
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return res.status(response.status).json({ message: "Failed to fetch file" });
      }
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to proxy file" });
    }
  });

  let cachedBotUserId: string | undefined;
  async function getBotUserId(client: any): Promise<string | undefined> {
    if (cachedBotUserId) return cachedBotUserId;
    try {
      const authResult = await client.auth.test();
      cachedBotUserId = authResult.user_id as string;
      return cachedBotUserId;
    } catch (_) {
      return undefined;
    }
  }

  app.post("/api/slack/conversations/open", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "userIds array is required" });
    }
    try {
      const result = await client.conversations.open({
        users: userIds.join(","),
        return_im: false,
      });
      const channel = result.channel as any;
      return res.json({
        success: true,
        conversationId: channel?.id,
        already_open: result.already_open || false,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to open conversation" });
    }
  });

  function patchReactionInList(messages: any[], timestamp: string, reactionName: string, add: boolean, botUserId?: string) {
    for (const msg of messages) {
      if (msg.ts === timestamp) {
        if (!msg.reactions) msg.reactions = [];
        if (add) {
          const existing = msg.reactions.find((r: any) => r.name === reactionName);
          if (existing) {
            if (botUserId && !existing.users.includes(botUserId)) {
              existing.users.push(botUserId);
              existing.count = existing.users.length;
            }
          } else {
            msg.reactions.push({ name: reactionName, count: 1, users: [botUserId || "bot"] });
          }
        } else {
          const existing = msg.reactions.find((r: any) => r.name === reactionName);
          if (existing) {
            if (botUserId) {
              existing.users = existing.users.filter((u: string) => u !== botUserId);
              existing.count = existing.users.length;
            } else {
              existing.count = Math.max(0, existing.count - 1);
            }
            if (existing.count <= 0) {
              msg.reactions = msg.reactions.filter((r: any) => r.name !== reactionName);
            }
          }
        }
        break;
      }
    }
  }

  function patchCachedReaction(channelId: string, timestamp: string, reactionName: string, add: boolean, botUserId?: string) {
    const cached = channelCache[channelId];
    if (cached?.messages) {
      patchReactionInList(cached.messages, timestamp, reactionName, add, botUserId);
    }
    for (const [key, entry] of Object.entries(dateCache)) {
      if (key.startsWith(channelId + ":") && entry.data) {
        patchReactionInList(entry.data, timestamp, reactionName, add, botUserId);
      }
    }
  }

  app.post("/api/slack/channels/:channelId/react", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    const { timestamp, name } = req.body;
    if (!timestamp || typeof timestamp !== "string") {
      return res.status(400).json({ message: "timestamp is required" });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "reaction name is required" });
    }
    const { channelId } = req.params;
    const botUserId = await getBotUserId(client);
    try {
      await client.reactions.add({
        channel: channelId,
        timestamp,
        name,
      });
      patchCachedReaction(channelId, timestamp, name, true, botUserId);
      return res.json({ ok: true });
    } catch (err: any) {
      if (err.data?.error === "already_reacted") {
        patchCachedReaction(channelId, timestamp, name, true, botUserId);
        return res.json({ ok: true, already: true });
      }
      return res.status(500).json({ message: err.message || "Failed to add reaction" });
    }
  });

  app.post("/api/slack/channels/:channelId/unreact", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    const { timestamp, name } = req.body;
    if (!timestamp || typeof timestamp !== "string") {
      return res.status(400).json({ message: "timestamp is required" });
    }
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "reaction name is required" });
    }
    const { channelId } = req.params;
    const botUserId = await getBotUserId(client);
    try {
      await client.reactions.remove({
        channel: channelId,
        timestamp,
        name,
      });
      patchCachedReaction(channelId, timestamp, name, false, botUserId);
      return res.json({ ok: true });
    } catch (err: any) {
      if (err.data?.error === "no_reaction") {
        patchCachedReaction(channelId, timestamp, name, false, botUserId);
        return res.json({ ok: true, already: true });
      }
      return res.status(500).json({ message: err.message || "Failed to remove reaction" });
    }
  });

  app.delete("/api/slack/channels/:channelId/messages/:ts", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const { channelId, ts } = req.params;
      await client.chat.delete({
        channel: channelId,
        ts,
      });
      const cached = channelCache[channelId];
      if (cached?.messages) {
        cached.messages = cached.messages.filter((m: any) => m.ts !== ts);
      }
      for (const [key, entry] of Object.entries(dateCache)) {
        if (key.startsWith(channelId + ":") && entry.data) {
          entry.data = entry.data.filter((m: any) => m.ts !== ts);
        }
      }
      for (const key of Object.keys(replyCache)) {
        if (key.startsWith(channelId + ":")) delete replyCache[key];
      }
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete message" });
    }
  });

  app.patch("/api/slack/channels/:channelId/messages/:ts", async (req, res) => {
    const client = await requireSlack(req, res);
    if (!client) return;
    try {
      const { channelId, ts } = req.params;
      const { text } = req.body;
      if (!text?.trim()) {
        return res.status(400).json({ message: "Message text is required" });
      }
      await client.chat.update({
        channel: channelId,
        ts,
        text: text.trim(),
      });
      const updateCachedMsg = (msgs: any[]) => {
        const msg = msgs.find((m: any) => m.ts === ts);
        if (msg) msg.text = text.trim();
      };
      const cached = channelCache[channelId];
      if (cached?.messages) updateCachedMsg(cached.messages);
      for (const [key, entry] of Object.entries(dateCache)) {
        if (key.startsWith(channelId + ":") && entry.data) updateCachedMsg(entry.data);
      }
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to edit message" });
    }
  });

  const REPLY_TEMPLATES_KEY = "slack_reply_templates";

  app.get("/api/slack/reply-templates", async (_req, res) => {
    try {
      const raw = await storage.getSetting(REPLY_TEMPLATES_KEY);
      const templates = raw ? JSON.parse(raw) : [];
      return res.json(templates);
    } catch {
      return res.json([]);
    }
  });

  app.post("/api/slack/reply-templates", async (req, res) => {
    try {
      const { subject, text } = req.body;
      if (!subject || !text) {
        return res.status(400).json({ message: "Subject and text are required" });
      }
      const raw = await storage.getSetting(REPLY_TEMPLATES_KEY);
      const templates: { id: string; subject: string; text: string }[] = raw ? JSON.parse(raw) : [];
      const newTemplate = { id: Date.now().toString(), subject: subject.trim(), text: text.trim() };
      templates.push(newTemplate);
      await storage.setSetting(REPLY_TEMPLATES_KEY, JSON.stringify(templates));
      return res.json(templates);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to save template" });
    }
  });

  app.put("/api/slack/reply-templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { subject, text } = req.body;
      if (!subject || !text) {
        return res.status(400).json({ message: "Subject and text are required" });
      }
      const raw = await storage.getSetting(REPLY_TEMPLATES_KEY);
      const templates: { id: string; subject: string; text: string }[] = raw ? JSON.parse(raw) : [];
      const idx = templates.findIndex((t) => t.id === id);
      if (idx === -1) {
        return res.status(404).json({ message: "Template not found" });
      }
      templates[idx] = { id, subject: subject.trim(), text: text.trim() };
      await storage.setSetting(REPLY_TEMPLATES_KEY, JSON.stringify(templates));
      return res.json(templates);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to update template" });
    }
  });

  app.delete("/api/slack/reply-templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const raw = await storage.getSetting(REPLY_TEMPLATES_KEY);
      let templates: { id: string; subject: string; text: string }[] = raw ? JSON.parse(raw) : [];
      templates = templates.filter((t) => t.id !== id);
      await storage.setSetting(REPLY_TEMPLATES_KEY, JSON.stringify(templates));
      return res.json(templates);
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Failed to delete template" });
    }
  });

}
