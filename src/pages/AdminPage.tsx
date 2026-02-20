import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";

const AdminPage = () => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("user_id", user.id);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/screenshots`,
        {
          method: "POST",
          headers: { ...getAuthHeaders() },
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      console.log("Screenshot upload response:", data);
      setMessage({ type: "success", text: `Screenshot uploaded! Path: ${data.screenshot.storage_path}` });
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      console.error("Screenshot upload error:", err);
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">User management coming soon.</p>
        </CardContent>
      </Card>

      <Card className="border-dashed border-2 border-accent">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Test Screenshot Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={fileRef}
            type="file"
            accept="image/png, image/jpeg"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? "Uploading…" : "Upload Screenshot"}
          </Button>
          {message && (
            <div
              className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                message.type === "success"
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;
