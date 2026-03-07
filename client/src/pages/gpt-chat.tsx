import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Send,
  Loader2,
  MessageSquare,
  Trash2,
  Bot,
  User,
} from "lucide-react";

type ConversationWithMessages = Conversation & { messages: Message[] };

export default function GptChatPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConv, isLoading: convLoading } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/conversations", selectedId],
    enabled: selectedId !== null,
  });

  const createConv = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
      return await res.json();
    },
    onSuccess: (conv: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedId(conv.id);
    },
  });

  const deleteConv = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setSelectedId(null);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, streamingContent]);

  async function handleSend() {
    if (!input.trim() || !selectedId || isStreaming) return;
    const text = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: text }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullResponse += event.content;
              setStreamingContent(fullResponse);
            }
            if (event.done) {
              setStreamingContent("");
              setIsStreaming(false);
              queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedId] });
            }
            if (event.error) {
              throw new Error(event.error);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsStreaming(false);
      setStreamingContent("");
    }

    queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedId] });
  }

  const messages = activeConv?.messages || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">GPT Assistant</h2>
        <p className="text-muted-foreground mt-1">Chat with your AI assistant</p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        <Card className="w-64 shrink-0 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Conversations</CardTitle>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => createConv.mutate()}
                disabled={createConv.isPending}
                data-testid="button-new-chat"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {convsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (conversations || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 px-3">
                  No conversations yet. Click + to start.
                </p>
              ) : (
                <div className="px-2 pb-2">
                  {(conversations || []).map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-2 rounded-md transition-colors ${
                        selectedId === conv.id ? "bg-accent" : ""
                      }`}
                    >
                      <button
                        onClick={() => setSelectedId(conv.id)}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-left text-sm truncate"
                        data-testid={`conv-${conv.id}`}
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-foreground">{conv.title}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0 mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConv.mutate(conv.id);
                        }}
                        data-testid={`button-delete-conv-${conv.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col min-w-0">
          {selectedId ? (
            <>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {activeConv?.title || "Chat"}
                </CardTitle>
              </CardHeader>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {convLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 && !streamingContent ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Bot className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mb-1">Start chatting</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Type your message below to start a conversation with the AI assistant.
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
                      ))}
                      {streamingContent && (
                        <ChatBubble role="assistant" content={streamingContent} isStreaming />
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    data-testid="input-chat-message"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="resize-none text-sm min-h-[2.5rem]"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button
                    data-testid="button-send-chat"
                    size="icon"
                    disabled={!input.trim() || isStreaming}
                    onClick={handleSend}
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bot className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">GPT Assistant</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Select an existing conversation or start a new one.
              </p>
              <Button
                onClick={() => createConv.mutate()}
                disabled={createConv.isPending}
                data-testid="button-start-chat"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function ChatBubble({
  role,
  content,
  isStreaming = false,
}: {
  role: string;
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={`rounded-lg px-4 py-2.5 max-w-[75%] ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-text-bottom" />}
        </p>
      </div>
      {isUser && (
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
