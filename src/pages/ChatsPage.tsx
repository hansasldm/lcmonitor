import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { chatApi, ChatGroup, ChatMessage, ChatMember } from "@/lib/chat-api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, Users, ArrowLeft, UserPlus, UserMinus, Phone, Video } from "lucide-react";
import { format } from "date-fns";
import { adminApi } from "@/lib/admin-api";
import { useWebRTC } from "@/hooks/useWebRTC";
import { CallScreen } from "@/components/chat/CallScreen";
import { IncomingCallDialog } from "@/components/chat/IncomingCallDialog";

export default function ChatsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create group state
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupType, setNewGroupType] = useState("GENERAL");

  // Add member state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; first_name: string; last_name: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");

  const loadGroups = useCallback(async () => {
    try {
      const { groups } = await chatApi.getGroups();
      setGroups(groups);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadMessages = useCallback(async (groupId: string) => {
    try {
      const { messages } = await chatApi.getMessages(groupId);
      setMessages(messages);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load messages", variant: "destructive" });
    }
  }, [toast]);

  const loadMembers = useCallback(async (groupId: string) => {
    try {
      const { members } = await chatApi.getMembers(groupId);
      setMembers(members);
    } catch (err: unknown) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Load messages when group selected
  useEffect(() => {
    if (!selectedGroup) return;
    loadMessages(selectedGroup.id);
    loadMembers(selectedGroup.id);
  }, [selectedGroup, loadMessages, loadMembers]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedGroup) return;

    const channel = supabase
      .channel(`chat-${selectedGroup.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `group_id=eq.${selectedGroup.id}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Fetch sender info
          const existingSender = messages.find((m) => m.sender_id === newMsg.sender_id)?.sender;
          if (existingSender) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg, sender: existingSender }];
            });
          } else {
            // Reload to get sender info
            await loadMessages(selectedGroup.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, messages, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedGroup || sending) return;
    setSending(true);
    try {
      await chatApi.sendMessage(selectedGroup.id, messageText.trim());
      setMessageText("");
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await chatApi.createGroup({ name: newGroupName.trim(), description: newGroupDesc.trim() || undefined, group_type: newGroupType });
      setCreateOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupType("GENERAL");
      loadGroups();
      toast({ title: "Group created" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create group", variant: "destructive" });
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUserId) return;
    try {
      await chatApi.addMembers(selectedGroup.id, [selectedUserId]);
      setAddMemberOpen(false);
      setSelectedUserId("");
      loadMembers(selectedGroup.id);
      toast({ title: "Member added" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await chatApi.removeMember(selectedGroup.id, userId);
      loadMembers(selectedGroup.id);
      toast({ title: "Member removed" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const loadAllUsers = async () => {
    try {
      const { users } = await adminApi.getUsers();
      setAllUsers(users);
    } catch { /* ignore */ }
  };

  const isAdmin = user?.role === "ADMIN";

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading chats...</div>;
  }

  // Chat window view
  if (selectedGroup) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedGroup(null); setMessages([]); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">{selectedGroup.name}</h2>
            {selectedGroup.description && (
              <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMembers(!showMembers)}>
            <Users className="h-4 w-4 mr-1" />
            {members.length}
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages area */}
          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">No messages yet. Start the conversation!</div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                          {!isMe && (
                            <div className="text-xs font-medium mb-1 opacity-70">
                              {msg.sender ? `${msg.sender.first_name} ${msg.sender.last_name}` : "Unknown"}
                            </div>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                          <div className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {format(new Date(msg.created_at), "h:mm a")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  autoFocus
                />
                <Button type="submit" disabled={!messageText.trim() || sending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Members sidebar */}
          {showMembers && (
            <div className="w-64 border-l border-border bg-card p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Members</h3>
                {isAdmin && (
                  <Dialog open={addMemberOpen} onOpenChange={(o) => { setAddMemberOpen(o); if (o) loadAllUsers(); }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent>
                          {allUsers
                            .filter((u) => !members.some((m) => m.user_id === u.id))
                            .map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.first_name} {u.last_name} ({u.email})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddMember} disabled={!selectedUserId}>Add</Button>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-foreground">
                        {m.user ? `${m.user.first_name} ${m.user.last_name}` : "Unknown"}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                    </div>
                    {isAdmin && m.user_id !== user?.id && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveMember(m.user_id)}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Group list view
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chats</h1>
          <p className="text-muted-foreground text-sm">Group conversations</p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> New Group</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Chat Group</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Group name" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} placeholder="What's this group for?" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newGroupType} onValueChange={setNewGroupType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="TEAM">Team</SelectItem>
                      <SelectItem value="PROJECT">Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="w-full">Create Group</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-foreground mb-1">No chat groups yet</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Create a group to get started." : "Ask an admin to add you to a group."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedGroup(group)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{group.description}</p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">{group.group_type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
