import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Hash,
  Lock,
  MessageSquare,
  Send,
  Loader2,
  Unplug,
  ChevronRight,
  ArrowLeft,
  Users,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SlackStatus = {
  connected: boolean;
  team?: string;
  user?: string;
  teamId?: string;
  error?: string;
  userTokenConnected?: boolean;
  userTokenUser?: string;
};

type SlackChannel = {
  id: string;
  name: string;
  is_private: boolean;
  is_im: boolean;
  is_mpim: boolean;
  topic: string;
  purpose: string;
  num_members: number;
};

type SlackReaction = {
  name: string;
  count: number;
  users: string[];
};

type SlackAttachment = {
  title: string;
  text: string;
  title_link: string;
  color: string;
  service_name: string;
};

type SlackMessage = {
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
  reply_count: number;
  reactions: SlackReaction[];
  files: { name: string; url: string; mimetype: string }[];
  attachments: SlackAttachment[];
};

type SlackReply = {
  ts: string;
  user: string;
  text: string;
  reactions: SlackReaction[];
};

type SlackUsers = Record<string, { name: string; avatar: string; real_name: string }>;

export default function SlackPage() {
  const { data: status, isLoading: statusLoading } = useQuery<SlackStatus>({
    queryKey: ["/api/slack/status"],
  });

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Slack</h2>
          <p className="text-muted-foreground mt-1">Browse and manage Slack messages</p>
        </div>
        <Card className="max-w-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Unplug className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1" data-testid="text-slack-not-connected">Slack Not Connected</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Connect your Slack workspace to browse channels and messages.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <SlackWorkspace status={status} />;
}

function SlackWorkspace({ status }: { status: SlackStatus }) {
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const { toast } = useToast();

  const { data: channels, isLoading: channelsLoading, error: channelsError } = useQuery<SlackChannel[]>({
    queryKey: ["/api/slack/channels"],
  });

  const { data: slackUsers } = useQuery<SlackUsers>({
    queryKey: ["/api/slack/users"],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Slack</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" data-testid="badge-slack-team">{status.team}</Badge>
            <span className="text-sm text-muted-foreground">Connected as {status.user}</span>
          </div>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700" data-testid="badge-slack-connected">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        <Card className="w-72 shrink-0 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Channels</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {channelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : channelsError ? (
                <p className="text-sm text-destructive text-center py-4 px-3" data-testid="text-channels-error">Failed to load channels</p>
              ) : (
                <div className="px-2 pb-2">
                  {(channels || []).map((ch) => (
                    <button
                      key={ch.id}
                      data-testid={`channel-${ch.name}`}
                      onClick={() => setSelectedChannel(ch)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                        selectedChannel?.id === ch.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {ch.is_private ? (
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col min-w-0">
          {selectedChannel ? (
            <ChannelMessages
              channel={selectedChannel}
              slackUsers={slackUsers || {}}
              onBack={() => setSelectedChannel(null)}
            />
          ) : (
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Select a channel</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a channel from the left to view messages, replies, and reactions.
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      <ReplyTemplatesManager />
    </div>
  );
}

type ReplyTemplate = { id: string; subject: string; text: string };

function ReplyTemplatesManager() {
  const { toast } = useToast();
  const [newSubject, setNewSubject] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editText, setEditText] = useState("");

  const { data: templates, isLoading } = useQuery<ReplyTemplate[]>({
    queryKey: ["/api/slack/reply-templates"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { subject: string; text: string }) => {
      const res = await apiRequest("POST", "/api/slack/reply-templates", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/slack/reply-templates"], data);
      setNewSubject("");
      setNewText("");
      toast({ title: "Template added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add template", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, subject, text }: { id: string; subject: string; text: string }) => {
      const res = await apiRequest("PUT", `/api/slack/reply-templates/${id}`, { subject, text });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/slack/reply-templates"], data);
      setEditingId(null);
      toast({ title: "Template updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/slack/reply-templates/${id}`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/slack/reply-templates"], data);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Reply Templates
        </CardTitle>
        <CardDescription>
          Create reusable reply templates. Select a template when replying to messages to auto-fill the reply text.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Input
            placeholder="Subject name"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            data-testid="input-template-subject"
          />
          <Textarea
            placeholder="Template text..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={2}
            className="resize-none"
            data-testid="input-template-text"
          />
          <Button
            onClick={() => addMutation.mutate({ subject: newSubject.trim(), text: newText.trim() })}
            disabled={!newSubject.trim() || !newText.trim() || addMutation.isPending}
            data-testid="button-add-template"
          >
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>

        <Separator />

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-templates">
            No templates yet. Add one above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="border rounded-lg p-3" data-testid={`template-${t.id}`}>
                {editingId === t.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      data-testid={`input-edit-subject-${t.id}`}
                    />
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="resize-none"
                      data-testid={`input-edit-text-${t.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate({ id: t.id, subject: editSubject.trim(), text: editText.trim() })}
                        disabled={!editSubject.trim() || !editText.trim() || updateMutation.isPending}
                        data-testid={`button-save-template-${t.id}`}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${t.id}`}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm" data-testid={`text-template-subject-${t.id}`}>{t.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap" data-testid={`text-template-text-${t.id}`}>{t.text}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => { setEditingId(t.id); setEditSubject(t.subject); setEditText(t.text); }}
                        data-testid={`button-edit-template-${t.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(t.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-template-${t.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelMessages({
  channel,
  slackUsers,
  onBack,
}: {
  channel: SlackChannel;
  slackUsers: SlackUsers;
  onBack: () => void;
}) {
  const [threadTs, setThreadTs] = useState<string | null>(null);

  const { data: messages, isLoading, error: messagesError } = useQuery<SlackMessage[]>({
    queryKey: ["/api/slack/channels", channel.id, "messages"],
  });

  return (
    <>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="lg:hidden"
            data-testid="button-back-channels"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            {channel.is_private ? (
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <CardTitle className="text-base truncate">{channel.name}</CardTitle>
          </div>
          {channel.num_members > 0 && (
            <Badge variant="outline" className="ml-auto shrink-0">
              <Users className="h-3 w-3 mr-1" />
              {channel.num_members}
            </Badge>
          )}
        </div>
        {channel.topic && (
          <p className="text-xs text-muted-foreground truncate mt-1">{channel.topic}</p>
        )}
      </CardHeader>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messagesError ? (
                <p className="text-sm text-destructive text-center py-8" data-testid="text-messages-error">Failed to load messages</p>
              ) : (messages || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages in this channel</p>
              ) : (
                (messages || []).map((msg) => (
                  <MessageItem
                    key={msg.ts}
                    message={msg}
                    slackUsers={slackUsers}
                    channelId={channel.id}
                    onOpenThread={() => setThreadTs(msg.ts)}
                    isActive={threadTs === msg.ts}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {threadTs && (
          <>
            <Separator orientation="vertical" />
            <ThreadPanel
              channelId={channel.id}
              threadTs={threadTs}
              slackUsers={slackUsers}
              onClose={() => setThreadTs(null)}
            />
          </>
        )}
      </div>
    </>
  );
}

function MessageItem({
  message,
  slackUsers,
  channelId,
  onOpenThread,
  isActive,
}: {
  message: SlackMessage;
  slackUsers: SlackUsers;
  channelId: string;
  onOpenThread: () => void;
  isActive: boolean;
}) {
  const user = slackUsers[message.user];
  const time = formatSlackTime(message.ts);

  return (
    <div
      data-testid={`message-${message.ts}`}
      className={`group rounded-md p-3 transition-colors ${
        isActive ? "bg-accent/50" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-md" />
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {(user?.name || message.user || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {user?.real_name || user?.name || message.user}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <div className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
            <SlackText text={message.text} slackUsers={slackUsers} />
          </div>

          {message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att, i) => (
                <div
                  key={i}
                  className="border-l-2 pl-3 py-1"
                  style={{ borderColor: att.color ? `#${att.color}` : undefined }}
                >
                  {att.service_name && (
                    <p className="text-xs text-muted-foreground">{att.service_name}</p>
                  )}
                  {att.title && (
                    <p className="text-sm font-medium text-primary">
                      {att.title_link ? (
                        <a href={att.title_link} target="_blank" rel="noopener noreferrer" className="underline">
                          {att.title}
                        </a>
                      ) : att.title}
                    </p>
                  )}
                  {att.text && (
                    <p className="text-sm text-muted-foreground">{att.text}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {message.reactions.map((r) => (
              <ReactionBadge key={r.name} reaction={r} channelId={channelId} messageTs={message.ts} />
            ))}

            {message.reply_count > 0 && (
              <button
                onClick={onOpenThread}
                data-testid={`button-thread-${message.ts}`}
                className="flex items-center gap-1 text-xs text-primary font-medium"
              >
                <MessageSquare className="h-3 w-3" />
                {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadPanel({
  channelId,
  threadTs,
  slackUsers,
  onClose,
}: {
  channelId: string;
  threadTs: string;
  slackUsers: SlackUsers;
  onClose: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();

  const { data: replies, isLoading } = useQuery<SlackReply[]>({
    queryKey: ["/api/slack/channels", channelId, "replies", threadTs],
  });

  const replyMutation = useMutation({
    mutationFn: async (text: string) => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/reply`, {
        thread_ts: threadTs,
        text,
      });
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({
        queryKey: ["/api/slack/channels", channelId, "replies", threadTs],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/slack/channels", channelId, "messages"],
      });
      toast({ title: "Reply sent!" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send reply", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="w-80 flex flex-col shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-foreground">Thread</h3>
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-thread">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (replies || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No replies yet</p>
          ) : (
            (replies || []).map((reply) => {
              const user = slackUsers[reply.user];
              return (
                <div key={reply.ts} className="flex gap-2" data-testid={`reply-${reply.ts}`}>
                  <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="h-7 w-7 rounded-md" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {(user?.name || reply.user || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {user?.real_name || user?.name || reply.user}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatSlackTime(reply.ts)}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap break-words">
                      <SlackText text={reply.text} slackUsers={slackUsers} />
                    </p>
                    {reply.reactions.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {reply.reactions.map((r) => (
                          <ReactionBadge key={r.name} reaction={r} channelId={channelId} messageTs={reply.ts} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            data-testid="input-reply"
            placeholder="Reply in thread..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="resize-none text-sm min-h-[2.5rem]"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && replyText.trim()) {
                e.preventDefault();
                replyMutation.mutate(replyText.trim());
              }
            }}
          />
          <Button
            data-testid="button-send-reply"
            size="icon"
            disabled={!replyText.trim() || replyMutation.isPending}
            onClick={() => replyText.trim() && replyMutation.mutate(replyText.trim())}
          >
            {replyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReactionBadge({
  reaction,
  channelId,
  messageTs,
}: {
  reaction: SlackReaction;
  channelId: string;
  messageTs: string;
}) {
  const { toast } = useToast();

  const addReaction = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/slack/channels/${channelId}/react`, {
        timestamp: messageTs,
        name: reaction.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack/channels", channelId, "messages"] });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't add reaction", description: err.message, variant: "destructive" });
    },
  });

  return (
    <button
      onClick={() => addReaction.mutate()}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-foreground border border-transparent"
      data-testid={`reaction-${reaction.name}`}
    >
      <span>:{reaction.name}:</span>
      <span className="font-medium">{reaction.count}</span>
    </button>
  );
}

function SlackText({ text, slackUsers }: { text: string; slackUsers: SlackUsers }) {
  const parts = text.split(/(<@[A-Z0-9]+>)/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^<@([A-Z0-9]+)>$/);
        if (match) {
          const user = slackUsers[match[1]];
          return (
            <span key={i} className="text-primary font-medium">
              @{user?.real_name || user?.name || match[1]}
            </span>
          );
        }
        const linkParts = part.split(/(<https?:\/\/[^>|]+(?:\|[^>]+)?>)/g);
        return linkParts.map((lp, j) => {
          const linkMatch = lp.match(/^<(https?:\/\/[^>|]+)(?:\|([^>]+))?>$/);
          if (linkMatch) {
            return (
              <a
                key={`${i}-${j}`}
                href={linkMatch[1]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {linkMatch[2] || linkMatch[1]}
              </a>
            );
          }
          return <span key={`${i}-${j}`}>{lp}</span>;
        });
      })}
    </>
  );
}

function formatSlackTime(ts: string): string {
  const timestamp = parseFloat(ts) * 1000;
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return time;

  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}
