import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  FlaskConical,
  Brain,
  BookOpen,
  FileText,
  Settings2,
  CreditCard,
  Hash,
  Table2,
  Shield,
  ChevronDown,
  ChevronUp,
  Link2,
  Unlink,
  Copy,
  ExternalLink,
} from "lucide-react";
import { SiOpenai, SiGoogle, SiStripe, SiSlack } from "react-icons/si";

interface AIProviderSettings {
  providerType: string;
  providerEnabled: boolean;
  providerModel: string;
  hasCustomKey: boolean;
  hasReplitKey: boolean;
  gptEnabled: boolean;
  examplesCount: number;
  hasInstructions: boolean;
}

const PROVIDER_OPTIONS = [
  { value: "replit", label: "Replit AI (Built-in)", icon: Zap, description: "Uses Replit's built-in OpenAI integration", color: "text-blue-500" },
  { value: "openai", label: "OpenAI", icon: SiOpenai, description: "Direct OpenAI API with your own key", color: "text-green-600" },
  { value: "gemini", label: "Google Gemini", icon: SiGoogle, description: "Google's Gemini AI models", color: "text-yellow-500" },
  { value: "grok", label: "xAI Grok", icon: Brain, description: "xAI's Grok models", color: "text-purple-500" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  replit: ["gpt-5.2", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o", "gpt-4o-mini", "o4-mini"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
  grok: ["grok-3", "grok-3-mini"],
};

function SectionToggle({ title, icon: Icon, iconColor, status, children }: {
  title: string;
  icon: any;
  iconColor?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card data-testid={`card-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <button
        className="w-full text-left"
        onClick={() => setOpen(!open)}
        data-testid={`button-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon className={`h-5 w-5 ${iconColor || ""}`} />
              {title}
            </CardTitle>
            <div className="flex items-center gap-3">
              {status}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function SlackSection() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [userTokenInputs, setUserTokenInputs] = useState(["", "", ""]);
  const [appToken, setAppToken] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");

  type SlackStatus = {
    connected: boolean;
    team?: string;
    botId?: string;
    userTokenConnected?: boolean;
    userTokens?: { slot: number; connected: boolean; user?: string }[];
    appTokenConnected?: boolean;
    socketModeActive?: boolean;
  };

  const { data: status } = useQuery<SlackStatus>({
    queryKey: ["/api/slack/status"],
    refetchInterval: 10000,
  });

  const connectMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/slack/connect", { token });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: "Slack connected" });
      setBotToken("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/slack/disconnect", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: "Slack disconnected" });
    },
  });

  const connectUserMutation = useMutation({
    mutationFn: async ({ token, slot }: { token: string; slot: number }) => {
      const res = await apiRequest("POST", "/api/slack/connect-user-token", { token, slot });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: `User ${vars.slot} token connected` });
      setUserTokenInputs(prev => { const n = [...prev]; n[vars.slot - 1] = ""; return n; });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const disconnectUserMutation = useMutation({
    mutationFn: async (slot: number) => { await apiRequest("POST", "/api/slack/disconnect-user-token", { slot }); },
    onSuccess: (_data, slot) => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: `User ${slot} token removed` });
    },
  });

  const connectAppMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", "/api/slack/connect-app-token", { token });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: "Socket Mode activated", description: "Real-time updates are now live" });
      setAppToken("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const disconnectAppMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/slack/disconnect-app-token", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/status"] });
      toast({ title: "Socket Mode disconnected" });
    },
  });

  const { data: oauthCreds } = useQuery<{ hasCredentials: boolean; clientIdPreview: string | null }>({
    queryKey: ["/api/slack/oauth-credentials"],
    refetchInterval: 30000,
  });

  const { data: installUrl } = useQuery<{ url: string; redirectUri: string }>({
    queryKey: ["/api/slack/oauth-install-url"],
    enabled: !!(oauthCreds?.hasCredentials),
  });

  const saveCredsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/slack/set-oauth-credentials", { clientId: oauthClientId, clientSecret: oauthClientSecret });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/oauth-credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slack/oauth-install-url"] });
      toast({ title: "OAuth credentials saved" });
      setOauthClientId("");
      setOauthClientSecret("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const connected = status?.connected || false;
  const userTokens = status?.userTokens || [{ slot: 1, connected: false }, { slot: 2, connected: false }, { slot: 3, connected: false }];
  const activeCount = userTokens.filter(t => t.connected).length;

  return (
    <SectionToggle
      title="Slack"
      icon={SiSlack}
      iconColor="text-[#4A154B]"
      status={connected ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-slack-status">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground" data-testid="badge-slack-status">Not Connected</Badge>
      )}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Bot Token</Label>
          {connected ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex-1">
                <p className="text-sm">Workspace: <strong>{status?.team || "Connected"}</strong></p>
                <p className="text-xs text-muted-foreground mt-0.5">Bot token is configured and active</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-slack"
              >
                {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="xoxb-..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                data-testid="input-slack-bot-token"
              />
              <Button
                onClick={() => connectMutation.mutate(botToken)}
                disabled={!botToken.trim() || connectMutation.isPending}
                data-testid="button-connect-slack"
              >
                {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                Connect
              </Button>
            </div>
          )}
        </div>

        {connected && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">User Token Pool — Round-Robin Load Balancer</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Each user token has its own rate limit. Active tokens share the load evenly.</p>
              </div>
              <Badge
                className={activeCount > 0 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-muted text-muted-foreground"}
                data-testid="badge-user-tokens-active"
              >
                {activeCount}/3 active
              </Badge>
            </div>
            <div className="space-y-2">
              {userTokens.map((ut) => (
                <div key={ut.slot} className="rounded-lg border p-3 space-y-2" data-testid={`card-user-token-${ut.slot}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">User {ut.slot}</span>
                    {ut.connected && (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs" data-testid={`badge-user-token-status-${ut.slot}`}>
                        <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> {ut.user || "Connected"}
                      </Badge>
                    )}
                  </div>
                  {ut.connected ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Token is active and receiving API calls</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectUserMutation.mutate(ut.slot)}
                        disabled={disconnectUserMutation.isPending}
                        data-testid={`button-disconnect-user-token-${ut.slot}`}
                      >
                        {disconnectUserMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="xoxp-..."
                        value={userTokenInputs[ut.slot - 1]}
                        onChange={(e) => setUserTokenInputs(prev => { const n = [...prev]; n[ut.slot - 1] = e.target.value; return n; })}
                        data-testid={`input-user-token-${ut.slot}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectUserMutation.mutate({ token: userTokenInputs[ut.slot - 1], slot: ut.slot })}
                        disabled={!userTokenInputs[ut.slot - 1].trim() || connectUserMutation.isPending}
                        data-testid={`button-connect-user-token-${ut.slot}`}
                      >
                        {connectUserMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {connected && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-sm font-medium">OAuth Quick Install — Add Other Users</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Let other Slack workspace members authorize with one click. Get Client ID &amp; Secret from <strong>api.slack.com → Basic Information</strong>.
              </p>
            </div>
            {!oauthCreds?.hasCredentials ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Client ID</Label>
                    <Input
                      placeholder="1234567890.123..."
                      value={oauthClientId}
                      onChange={(e) => setOauthClientId(e.target.value)}
                      data-testid="input-oauth-client-id"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={oauthClientSecret}
                      onChange={(e) => setOauthClientSecret(e.target.value)}
                      data-testid="input-oauth-client-secret"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveCredsMutation.mutate()}
                  disabled={!oauthClientId.trim() || !oauthClientSecret.trim() || saveCredsMutation.isPending}
                  data-testid="button-save-oauth-credentials"
                >
                  {saveCredsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save Credentials
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span>Credentials saved <span className="text-muted-foreground">({oauthCreds.clientIdPreview})</span></span>
                </div>
                {installUrl && (
                  <div className="space-y-2">
                    <div className="rounded-lg border p-3 space-y-2 bg-amber-50 dark:bg-amber-950/20">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Step 1 — Add this Redirect URL in Slack</p>
                      <p className="text-xs text-muted-foreground">Manage Distribution → Add OAuth Redirect URLs → paste this:</p>
                      <div className="flex gap-2">
                        <Input readOnly value={installUrl.redirectUri} className="text-xs font-mono h-7" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(installUrl.redirectUri); toast({ title: "Redirect URL copied!" }); }}
                          data-testid="button-copy-redirect-url"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-xs font-semibold">Step 2 — Share this install link</p>
                      <p className="text-xs text-muted-foreground">Send this link to each Slack teammate. They click it, click Allow, done — their token saves automatically to the next empty slot.</p>
                      <div className="flex gap-2">
                        <Input readOnly value={installUrl.url} className="text-xs h-7" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(installUrl.url); toast({ title: "Install link copied!" }); }}
                          data-testid="button-copy-install-url"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 shrink-0"
                          onClick={() => window.open(installUrl.url, "_blank")}
                          data-testid="button-open-install-url"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {connected && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Socket Mode — Real-time Updates</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Instantly syncs new messages, replies &amp; reactions from Slack to all users
                </p>
              </div>
              {status?.socketModeActive && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs shrink-0">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                  Live
                </Badge>
              )}
            </div>
            {status?.appTokenConnected ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="flex-1">
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {status?.socketModeActive ? "Connected & receiving real-time events" : "Token saved — reconnecting…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">App-level token (xapp-...) configured</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectAppMutation.mutate()}
                  disabled={disconnectAppMutation.isPending}
                  data-testid="button-disconnect-slack-app"
                >
                  {disconnectAppMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="xapp-1-..."
                    value={appToken}
                    onChange={(e) => setAppToken(e.target.value)}
                    data-testid="input-slack-app-token"
                  />
                  <Button
                    variant="outline"
                    onClick={() => connectAppMutation.mutate(appToken)}
                    disabled={!appToken.trim() || connectAppMutation.isPending}
                    data-testid="button-connect-slack-app"
                  >
                    {connectAppMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Activate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get this from <strong>api.slack.com/apps</strong> → Socket Mode → Generate App-level Token (scope: <code>connections:write</code>)
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionToggle>
  );
}

function StripeSection() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");

  const { data: status } = useQuery<{ connected: boolean; source: string }>({
    queryKey: ["/api/stripe-payments/status"],
  });

  const connectMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", "/api/stripe-payments/connect", { apiKey: key });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payments/status"] });
      toast({ title: "Stripe connected" });
      setApiKey("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/stripe-payments/disconnect", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-payments/status"] });
      toast({ title: "Stripe disconnected" });
    },
  });

  const connected = status?.connected || false;
  const source = status?.source || "none";

  return (
    <SectionToggle
      title="Stripe"
      icon={SiStripe}
      iconColor="text-[#635BFF]"
      status={connected ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-stripe-status">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected ({source === "integration" ? "Replit" : "API Key"})
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground" data-testid="badge-stripe-status">Not Connected</Badge>
      )}
    >
      <div className="space-y-3">
        {source === "integration" ? (
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Connected via Replit Integration
            </p>
            <p className="text-xs text-muted-foreground mt-1">Stripe is connected through Replit's built-in connector. No manual key needed.</p>
          </div>
        ) : connected && source === "api_key" ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex-1">
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected with API Key
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-stripe"
            >
              {disconnectMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
              Disconnect
            </Button>
          </div>
        ) : (
          <div>
            <Label className="text-sm font-medium">Stripe Secret Key</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                type="password"
                placeholder="sk_live_... or sk_test_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-stripe-key"
              />
              <Button
                onClick={() => connectMutation.mutate(apiKey)}
                disabled={!apiKey.trim() || connectMutation.isPending}
                data-testid="button-connect-stripe"
              >
                {connectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                Connect
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionToggle>
  );
}

function GoogleSheetsSection() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [startRow, setStartRow] = useState("");

  const { data: config } = useQuery<any>({
    queryKey: ["/api/gsheets/config"],
  });

  const hasConnection = config?.hasCredentials && config?.spreadsheetId;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (spreadsheetId.trim()) payload.spreadsheetId = spreadsheetId.trim();
      else if (config?.spreadsheetId) payload.spreadsheetId = config.spreadsheetId;
      if (sheetName.trim()) payload.sheetName = sheetName.trim();
      else if (config?.sheetName) payload.sheetName = config.sheetName;
      payload.startRow = startRow.trim() ? parseInt(startRow) : (config?.startRow || 2);
      if (credentials.trim()) payload.credentials = credentials.trim();
      await apiRequest("POST", "/api/gsheets/config", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gsheets/config"] });
      toast({ title: "Google Sheets settings saved" });
      setCredentials("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gsheets/test", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) toast({ title: "Connection successful", description: `Sheet: ${data.sheetName}` });
      else toast({ title: "Test failed", description: data.error, variant: "destructive" });
    },
    onError: (err: Error) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/gsheets/disconnect", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gsheets/config"] });
      toast({ title: "Google Sheets disconnected" });
    },
  });

  return (
    <SectionToggle
      title="Google Sheets"
      icon={Table2}
      iconColor="text-green-600"
      status={hasConnection ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-gsheets-status">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground" data-testid="badge-gsheets-status">Not Configured</Badge>
      )}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Sync CV Report data to Google Sheets. Column mapping is configured on the API Keys page.</p>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Service Account JSON Credentials</Label>
          <Textarea
            placeholder={hasConnection ? "Credentials already saved. Paste new JSON to update..." : '{"type": "service_account", "project_id": "...", ...}'}
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            data-testid="input-gsheets-credentials"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Spreadsheet ID</Label>
            <Input
              placeholder={config?.spreadsheetId || "Spreadsheet ID"}
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              data-testid="input-gsheets-spreadsheet-id"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sheet Name</Label>
            <Input
              placeholder={config?.sheetName || "Sheet1"}
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              data-testid="input-gsheets-sheet-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start Row</Label>
            <Input
              type="number"
              placeholder={config?.startRow?.toString() || "2"}
              value={startRow}
              onChange={(e) => setStartRow(e.target.value)}
              data-testid="input-gsheets-start-row"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-gsheets"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !hasConnection}
            data-testid="button-test-gsheets"
          >
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            Test
          </Button>
          {hasConnection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-gsheets"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </SectionToggle>
  );
}

function PtFinderSection() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [headerRow, setHeaderRow] = useState("");
  const [refundsSheetName, setRefundsSheetName] = useState("");
  const [refundsHeaderRow, setRefundsHeaderRow] = useState("");

  const { data: config } = useQuery<any>({
    queryKey: ["/api/pt-finder/config"],
  });

  const hasConnection = config?.hasCredentials && config?.spreadsheetId;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (spreadsheetId.trim()) payload.spreadsheetId = spreadsheetId.trim();
      else if (config?.spreadsheetId) payload.spreadsheetId = config.spreadsheetId;
      if (sheetName.trim()) payload.sheetName = sheetName.trim();
      else if (config?.sheetName) payload.sheetName = config.sheetName;
      payload.headerRow = headerRow.trim() ? parseInt(headerRow) : (config?.headerRow || 1);
      if (refundsSheetName.trim()) payload.refundsSheetName = refundsSheetName.trim();
      else if (config?.refundsSheetName) payload.refundsSheetName = config.refundsSheetName;
      payload.refundsHeaderRow = refundsHeaderRow.trim() ? parseInt(refundsHeaderRow) : (config?.refundsHeaderRow || 1);
      if (credentials.trim()) payload.credentials = credentials.trim();
      await apiRequest("POST", "/api/pt-finder/config", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-finder/config"] });
      toast({ title: "PT Finder settings saved" });
      setCredentials("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pt-finder/test", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success || data.headers) toast({ title: "Connection successful", description: `Headers: ${(data.headers || []).slice(0, 5).join(", ")}...` });
      else toast({ title: "Test failed", description: data.error, variant: "destructive" });
    },
    onError: (err: Error) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/pt-finder/disconnect", {}); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pt-finder/config"] });
      toast({ title: "PT Finder disconnected" });
    },
  });

  return (
    <SectionToggle
      title="PT Finder"
      icon={Table2}
      iconColor="text-blue-600"
      status={hasConnection ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-ptfinder-status">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground" data-testid="badge-ptfinder-status">Not Configured</Badge>
      )}
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Connect to a Google Sheet for patient record lookup (PT Finder database)</p>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Service Account JSON Credentials</Label>
          <Textarea
            placeholder={hasConnection ? "Credentials already saved. Paste new JSON to update..." : '{"type": "service_account", "project_id": "...", ...}'}
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            data-testid="input-ptfinder-credentials"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Spreadsheet ID</Label>
            <Input
              placeholder={config?.spreadsheetId || "Spreadsheet ID"}
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              data-testid="input-ptfinder-spreadsheet-id"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sheet Name</Label>
            <Input
              placeholder={config?.sheetName || "Sheet1"}
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              data-testid="input-ptfinder-sheet-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Header Row</Label>
            <Input
              type="number"
              placeholder={config?.headerRow?.toString() || "1"}
              value={headerRow}
              onChange={(e) => setHeaderRow(e.target.value)}
              data-testid="input-ptfinder-header-row"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Refunds Sheet Name</Label>
            <Input
              placeholder={config?.refundsSheetName || "Refunds tab name (optional)"}
              value={refundsSheetName}
              onChange={(e) => setRefundsSheetName(e.target.value)}
              data-testid="input-ptfinder-refunds-sheet-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Refunds Header Row</Label>
            <Input
              type="number"
              placeholder={config?.refundsHeaderRow?.toString() || "1"}
              value={refundsHeaderRow}
              onChange={(e) => setRefundsHeaderRow(e.target.value)}
              data-testid="input-ptfinder-refunds-header-row"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-ptfinder"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !hasConnection}
            data-testid="button-test-ptfinder"
          >
            {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
            Test
          </Button>
          {hasConnection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-ptfinder"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </SectionToggle>
  );
}

function CareValidateSection() {
  const { toast } = useToast();
  const [token, setToken] = useState("");

  const { data: tokenStatus } = useQuery<{ hasToken: boolean }>({
    queryKey: ["/api/carevalidate/token-status"],
  });

  const saveMutation = useMutation({
    mutationFn: async (t: string) => {
      await apiRequest("POST", "/api/carevalidate/token", { token: t });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carevalidate/token-status"] });
      toast({ title: "CareValidate token saved" });
      setToken("");
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/carevalidate/token");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carevalidate/token-status"] });
      toast({ title: "CareValidate token cleared" });
    },
    onError: (err: Error) => toast({ title: "Failed to clear token", description: err.message, variant: "destructive" }),
  });

  const hasToken = tokenStatus?.hasToken || false;

  return (
    <SectionToggle
      title="CareValidate"
      icon={Shield}
      iconColor="text-teal-600"
      status={hasToken ? (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-cv-status">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Token Set
        </Badge>
      ) : (
        <Badge variant="secondary" className="bg-muted text-muted-foreground" data-testid="badge-cv-status">No Token</Badge>
      )}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">CareValidate bearer token for fetching case data. Tokens typically expire every hour and need to be refreshed.</p>

        {hasToken ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex-1">
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Bearer token is configured
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Token expires hourly — update when fetch fails</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              data-testid="button-clear-cv-token"
            >
              Clear
            </Button>
          </div>
        ) : null}

        <div>
          <Label className="text-sm font-medium">{hasToken ? "Update Token" : "Bearer Token"}</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="password"
              placeholder="Paste CareValidate bearer token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              data-testid="input-cv-token"
            />
            <Button
              onClick={() => saveMutation.mutate(token)}
              disabled={!token.trim() || saveMutation.isPending}
              data-testid="button-save-cv-token"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {hasToken ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </SectionToggle>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModel, setCustomModel] = useState("");

  const { data: settings, isLoading } = useQuery<AIProviderSettings>({
    queryKey: ["/api/ai-provider/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      await apiRequest("POST", "/api/ai-provider/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-provider/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-provider/test", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: `Connection successful`, description: `Provider: ${data.provider} | Model: ${data.model}` });
      } else {
        toast({ title: "Test failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentProvider = PROVIDER_OPTIONS.find((p) => p.value === settings.providerType) || PROVIDER_OPTIONS[0];
  const models = MODEL_SUGGESTIONS[settings.providerType] || MODEL_SUGGESTIONS.openai;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
          Integrations
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all API keys, tokens, and service connections in one place.
        </p>
      </div>

      <SlackSection />
      <StripeSection />
      <GoogleSheetsSection />
      <PtFinderSection />
      <CareValidateSection />

      <Card data-testid="card-active-provider">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              AI Provider
            </CardTitle>
            <div className="flex items-center gap-3">
              <Label htmlFor="provider-toggle" className="text-sm text-muted-foreground">
                {settings.providerEnabled ? "Enabled" : "Disabled"}
              </Label>
              <Switch
                id="provider-toggle"
                checked={settings.providerEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ providerEnabled: checked })}
                data-testid="switch-provider-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center bg-background border ${currentProvider.color}`}>
              <currentProvider.icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{currentProvider.label}</span>
                {settings.providerEnabled ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-status">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" data-testid="badge-status">
                    <XCircle className="h-3 w-3 mr-1" /> Disabled
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{currentProvider.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Model: <strong className="text-foreground">{settings.providerModel}</strong></span>
                <span>&bull;</span>
                {settings.providerType === "replit" ? (
                  <span>API Key: {settings.hasReplitKey ? <span className="text-green-600">Configured via Replit</span> : <span className="text-red-500">Not configured</span>}</span>
                ) : (
                  <span>API Key: {settings.hasCustomKey ? <span className="text-green-600">Configured</span> : <span className="text-red-500">Not set</span>}</span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !settings.providerEnabled}
              data-testid="button-test-connection"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-provider-selection">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Select Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {PROVIDER_OPTIONS.map((provider) => {
              const isSelected = settings.providerType === provider.value;
              const isAvailable = provider.value === "replit" ? settings.hasReplitKey : true;
              return (
                <button
                  key={provider.value}
                  onClick={() => {
                    if (!isSelected) {
                      const defaultModel = MODEL_SUGGESTIONS[provider.value]?.[0] || "gpt-4o";
                      updateMutation.mutate({ providerType: provider.value, providerModel: defaultModel });
                    }
                  }}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  } ${!isAvailable && provider.value === "replit" ? "opacity-50" : ""}`}
                  data-testid={`button-provider-${provider.value}`}
                >
                  <div className="flex items-center gap-3">
                    <provider.icon className={`h-5 w-5 ${provider.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{provider.label}</span>
                        {isSelected && <Badge variant="secondary" className="text-[10px]">Selected</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{provider.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-sm font-medium">Model</Label>
              <div className="flex gap-2 mt-1.5">
                <Select
                  value={models.includes(settings.providerModel) ? settings.providerModel : "custom"}
                  onValueChange={(v) => {
                    if (v === "custom") return;
                    updateMutation.mutate({ providerModel: v });
                  }}
                >
                  <SelectTrigger className="flex-1" data-testid="select-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                    {!models.includes(settings.providerModel) && (
                      <SelectItem value="custom">{settings.providerModel} (custom)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Input
                    placeholder="Custom model name..."
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-[200px]"
                    data-testid="input-custom-model"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={!customModel.trim()}
                    onClick={() => {
                      updateMutation.mutate({ providerModel: customModel.trim() });
                      setCustomModel("");
                    }}
                    data-testid="button-set-model"
                  >
                    Set
                  </Button>
                </div>
              </div>
            </div>

            {settings.providerType !== "replit" && (
              <div>
                <Label className="text-sm font-medium">API Key</Label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder={settings.hasCustomKey ? "••••••••••••••••••••••" : "Enter your API key..."}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="pr-10"
                      data-testid="input-api-key"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-api-key-visibility"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9"
                    disabled={!apiKeyInput.trim() || updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate({ apiKey: apiKeyInput.trim() });
                      setApiKeyInput("");
                    }}
                    data-testid="button-save-key"
                  >
                    Save Key
                  </Button>
                </div>
                {settings.hasCustomKey && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> API key is saved
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-training">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Training Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            The AI provider uses Custom GPT instructions and Reference Examples from CV Support to classify cases.
            Any provider you select will use the same training data.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Custom GPT Instructions</span>
              </div>
              {settings.hasInstructions ? (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" data-testid="badge-instructions">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Configured
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" data-testid="badge-instructions">
                  Not set
                </Badge>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Manage instructions in CV Support page
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Reference Examples</span>
              </div>
              <Badge
                className={settings.examplesCount > 0
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                }
                data-testid="badge-examples"
              >
                {settings.examplesCount > 0 ? (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> {settings.examplesCount} examples</>
                ) : (
                  "No examples"
                )}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Add examples in CV Support page
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
