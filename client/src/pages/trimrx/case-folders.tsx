import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  FileText,
  Download,
  ArrowLeft,
  Loader2,
  File,
  Image,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Clipboard,
  X,
} from "lucide-react";

type CaseFolder = {
  id: number;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

type CaseFileInfo = {
  id: number;
  folderId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
};

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("spreadsheet") || fileType.includes("csv") || fileType.includes("excel")) return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CaseFoldersPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [selectedFolder, setSelectedFolder] = useState<CaseFolder | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderEmail, setFolderEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pastedFiles, setPastedFiles] = useState<{ file: globalThis.File; name: string }[]>([]);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!selectedFolder) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const newFiles: { file: globalThis.File; name: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
          const baseName = file.name.includes(".") ? file.name.substring(0, file.name.lastIndexOf(".")) : file.name;
          newFiles.push({ file, name: baseName || `pasted-file-${Date.now()}` });
        }
      }
    }
    if (newFiles.length > 0) {
      e.preventDefault();
      setPastedFiles((prev) => [...prev, ...newFiles]);
    }
  }, [selectedFolder]);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const { data: folders, isLoading: foldersLoading } = useQuery<CaseFolder[]>({
    queryKey: ["/api/case-folders"],
  });

  const { data: files, isLoading: filesLoading } = useQuery<CaseFileInfo[]>({
    queryKey: ["/api/case-folders", selectedFolder?.id, "files"],
    enabled: !!selectedFolder,
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const res = await apiRequest("POST", "/api/case-folders", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-folders"] });
      toast({ title: "Folder created" });
      setCreateDialogOpen(false);
      setFolderName("");
      setFolderEmail("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create folder", description: err.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/case-folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-folders"] });
      setSelectedFolder(null);
      toast({ title: "Folder deleted" });
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ folderId, file }: { folderId: number; file: globalThis.File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/case-folders/${folderId}/files`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-folders", selectedFolder?.id, "files"] });
      toast({ title: "File uploaded" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/case-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-folders", selectedFolder?.id, "files"] });
      toast({ title: "File deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/case-folders/${id}/status`, { status });
      return await res.json();
    },
    onSuccess: (updated: CaseFolder) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-folders"] });
      setSelectedFolder(updated);
      toast({ title: updated.status === "ready" ? "Marked as Ready to Submit" : "Marked as Pending" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || !selectedFolder) return;
    for (let i = 0; i < fileList.length; i++) {
      uploadFileMutation.mutate({ folderId: selectedFolder.id, file: fileList[i] });
    }
    e.target.value = "";
  }

  function handleDownload(fileId: number, fileName: string) {
    const a = document.createElement("a");
    a.href = `/api/case-files/${fileId}/download`;
    a.download = fileName;
    a.click();
  }

  const filteredFolders = (folders || []).filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  if (selectedFolder) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedFolder(null)} data-testid="button-back-folders">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-folder-name">{selectedFolder.name}</h1>
              {selectedFolder.status === "ready" ? (
                <Badge className="bg-green-100 text-green-700 border-green-300 gap-1" data-testid="badge-ready">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready to Submit
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1" data-testid="badge-pending">
                  <Clock className="h-3 w-3" />
                  Pending
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{selectedFolder.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {can("case-folders", "upload") && (
            <>
              <Button
                onClick={() => document.getElementById("file-upload-input")?.click()}
                disabled={uploadFileMutation.isPending}
                data-testid="button-upload-file"
              >
                {uploadFileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload Files
              </Button>
              <input
                id="file-upload-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}
          {can("case-folders", "edit") && (
            selectedFolder.status === "ready" ? (
              <Button
                variant="outline"
                onClick={() => updateStatusMutation.mutate({ id: selectedFolder.id, status: "pending" })}
                disabled={updateStatusMutation.isPending}
                data-testid="button-undo-ready"
              >
                {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
                Undo Ready
              </Button>
            ) : (
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => updateStatusMutation.mutate({ id: selectedFolder.id, status: "ready" })}
                disabled={updateStatusMutation.isPending}
                data-testid="button-mark-ready"
              >
                {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Mark as Ready
              </Button>
            )
          )}
          {can("case-folders", "delete") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete folder "${selectedFolder.name}" and all its files?`)) {
                  deleteFolderMutation.mutate(selectedFolder.id);
                }
              }}
              data-testid="button-delete-folder"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Folder
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Files ({files?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !files || files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No files yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Click "Upload Files" to add documents to this folder.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {files.map((file) => {
                  const IconComponent = getFileIcon(file.fileType);
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      data-testid={`file-item-${file.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <IconComponent className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-sm font-medium truncate max-w-[300px]">{file.fileName}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>{file.fileName}</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.fileSize)} · {new Date(file.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(file.id, file.fileName)}
                          data-testid={`button-download-${file.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {can("case-folders", "delete") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm(`Delete "${file.fileName}"?`)) {
                                deleteFileMutation.mutate(file.id);
                              }
                            }}
                            data-testid={`button-delete-file-${file.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div
              ref={dropZoneRef}
              className="mt-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors border-muted-foreground/25 hover:border-primary/50"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedFiles = Array.from(e.dataTransfer.files).map((f) => {
                  const baseName = f.name.includes(".") ? f.name.substring(0, f.name.lastIndexOf(".")) : f.name;
                  return { file: f, name: baseName };
                });
                if (droppedFiles.length > 0) {
                  setPastedFiles((prev) => [...prev, ...droppedFiles]);
                }
              }}
              data-testid="paste-drop-zone"
            >
              <Clipboard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                Paste or drag files here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ctrl+V to paste images from clipboard, or drag & drop files
              </p>
            </div>

            {pastedFiles.length > 0 && (
              <div className="mt-4 space-y-3" data-testid="pasted-files-section">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Pasted / Dropped Files ({pastedFiles.length})</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPastedFiles([])}
                      data-testid="button-clear-pasted"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!selectedFolder) return;
                        pastedFiles.forEach(({ file, name }) => {
                          const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
                          const renamedFile = new globalThis.File([file], name + ext, { type: file.type });
                          uploadFileMutation.mutate({ folderId: selectedFolder.id, file: renamedFile });
                        });
                        setPastedFiles([]);
                      }}
                      disabled={uploadFileMutation.isPending}
                      data-testid="button-upload-pasted"
                    >
                      {uploadFileMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                      Upload All
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {pastedFiles.map(({ file, name }, idx) => {
                    const isImage = file.type.startsWith("image/");
                    const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
                    return (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30" data-testid={`pasted-file-${idx}`}>
                        {isImage ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={name}
                            className="h-10 w-10 object-cover rounded border flex-shrink-0"
                          />
                        ) : (
                          <File className="h-10 w-10 text-muted-foreground flex-shrink-0 p-2 border rounded" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <Input
                              value={name}
                              onChange={(e) => {
                                setPastedFiles((prev) => prev.map((p, i) => i === idx ? { ...p, name: e.target.value } : p));
                              }}
                              className="h-7 text-sm font-medium"
                              data-testid={`input-rename-${idx}`}
                            />
                            <span className="text-xs text-muted-foreground flex-shrink-0">{ext}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{formatFileSize(file.size)} · {file.type || "unknown"}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPastedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          data-testid={`button-remove-pasted-${idx}`}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Case Folder</h1>
        <p className="text-muted-foreground mt-1">Manage dispute case folders and files</p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search-folders"
        />
        {can("case-folders", "add") && (
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-folder">
            <Plus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Folders ({filteredFolders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {foldersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No folders yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Click "New Folder" to create your first case folder.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFolders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    folder.status === "ready" ? "border-green-300 bg-green-50/50" : ""
                  }`}
                  onClick={() => setSelectedFolder(folder)}
                  data-testid={`folder-item-${folder.id}`}
                >
                  <FolderOpen className={`h-8 w-8 flex-shrink-0 ${folder.status === "ready" ? "text-green-600" : "text-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{folder.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{folder.email}</p>
                  </div>
                  {folder.status === "ready" && (
                    <Badge className="bg-green-100 text-green-700 border-green-300 gap-1 flex-shrink-0 text-xs" data-testid={`badge-ready-${folder.id}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      Ready
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-email">Email</Label>
              <Input
                id="folder-email"
                placeholder="customer@example.com"
                value={folderEmail}
                onChange={(e) => {
                  setFolderEmail(e.target.value);
                  if (!folderName || folderName === folderEmail) {
                    setFolderName(e.target.value);
                  }
                }}
                data-testid="input-folder-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="Folder name (defaults to email)"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                data-testid="input-folder-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createFolderMutation.mutate({ name: folderName || folderEmail, email: folderEmail })}
              disabled={!folderEmail.trim() || createFolderMutation.isPending}
              data-testid="button-confirm-create-folder"
            >
              {createFolderMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
