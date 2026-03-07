import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Download, ImagePlus, Trash2, FileImage, Eye, EyeOff } from "lucide-react";
import html2canvas from "html2canvas";

export default function DisputesDocPage() {
  const { toast } = useToast();
  const { can } = usePermissions();
  const [screenshot1, setScreenshot1] = useState<string | null>(null);
  const [screenshot2, setScreenshot2] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const templateRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback((slot: 1 | 2) => {
    return (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (slot === 1) setScreenshot1(dataUrl);
            else setScreenshot2(dataUrl);
            toast({ title: `Screenshot ${slot} pasted` });
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
  }, [toast]);

  const handleFileUpload = useCallback((slot: 1 | 2) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (slot === 1) setScreenshot1(dataUrl);
        else setScreenshot2(dataUrl);
        toast({ title: `Screenshot ${slot} uploaded` });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };
  }, [toast]);

  const downloadPNG = async () => {
    if (!templateRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(templateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 850,
        height: 1100,
      });
      const link = document.createElement("a");
      link.download = "trimrx-customer-authorization.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Document downloaded as PNG" });
    } catch (err) {
      toast({ title: "Download failed", description: String(err), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileImage className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-disputes-doc-title">Disputes Doc</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            data-testid="button-toggle-preview"
          >
            {showPreview ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          <Button
            onClick={downloadPNG}
            disabled={generating || (!screenshot1 && !screenshot2)}
            data-testid="button-download-png"
          >
            <Download className="h-4 w-4 mr-2" />
            {generating ? "Generating..." : "Download PNG"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Screenshot 1 (Left Side - Patient Info)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              onPaste={handlePaste(1)}
              onClick={(e) => (e.currentTarget as HTMLDivElement).focus()}
              tabIndex={0}
              data-testid="paste-area-1"
            >
              {screenshot1 ? (
                <div className="relative w-full">
                  <img src={screenshot1} alt="Screenshot 1" className="max-h-[200px] mx-auto rounded" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); setScreenshot1(null); }}
                    data-testid="button-remove-ss1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">Click here and press Ctrl+V to paste, or upload below</p>
                </>
              )}
            </div>
            <label className="mt-2 block">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(1)} data-testid="input-upload-1" />
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <span><ImagePlus className="h-3 w-3 mr-1" /> Upload Image</span>
              </Button>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Screenshot 2 (Right Side - Healthcare Intake)</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-4 min-h-[120px] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              onPaste={handlePaste(2)}
              onClick={(e) => (e.currentTarget as HTMLDivElement).focus()}
              tabIndex={0}
              data-testid="paste-area-2"
            >
              {screenshot2 ? (
                <div className="relative w-full">
                  <img src={screenshot2} alt="Screenshot 2" className="max-h-[200px] mx-auto rounded" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={(e) => { e.stopPropagation(); setScreenshot2(null); }}
                    data-testid="button-remove-ss2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">Click here and press Ctrl+V to paste, or upload below</p>
                </>
              )}
            </div>
            <label className="mt-2 block">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload(2)} data-testid="input-upload-2" />
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <span><ImagePlus className="h-3 w-3 mr-1" /> Upload Image</span>
              </Button>
            </label>
          </CardContent>
        </Card>
      </div>

      <div style={showPreview ? {} : { position: "absolute", left: "-9999px", top: "-9999px" }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" data-testid="text-preview-title">Document Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center overflow-auto">
            <div
              ref={templateRef}
              style={{
                width: "850px",
                height: "1100px",
                background: "#ffffff",
                position: "relative",
                fontFamily: "'Arial', 'Helvetica', sans-serif",
                overflow: "hidden",
              }}
            >
              <svg
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                viewBox="0 0 850 1100"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="swirlDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1b2e4a" />
                    <stop offset="100%" stopColor="#2d5a8e" />
                  </linearGradient>
                  <linearGradient id="swirlMid" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2d5a8e" />
                    <stop offset="100%" stopColor="#4a8bc2" />
                  </linearGradient>
                  <linearGradient id="swirlLight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4a8bc2" />
                    <stop offset="100%" stopColor="#7bb5e0" />
                  </linearGradient>
                </defs>

                {/* Top-right corner swoosh curves */}
                <path d="M 850 0 L 850 180 C 830 140 780 80 720 50 C 680 30 650 25 620 30 C 660 15 710 0 850 0 Z" fill="url(#swirlDark)" />
                <path d="M 850 0 L 850 130 C 840 100 800 60 750 35 C 720 20 700 18 680 22 C 710 8 740 0 850 0 Z" fill="url(#swirlMid)" />
                <path d="M 850 0 L 850 80 C 845 65 820 40 790 25 C 770 15 755 12 740 15 C 760 5 780 0 850 0 Z" fill="url(#swirlLight)" />

                {/* Bottom-left corner swoosh curves */}
                <path d="M 0 1100 L 0 920 C 20 960 70 1020 130 1050 C 170 1070 200 1075 230 1070 C 190 1085 140 1100 0 1100 Z" fill="url(#swirlDark)" />
                <path d="M 0 1100 L 0 970 C 15 990 50 1030 100 1055 C 130 1070 150 1075 170 1072 C 140 1085 110 1100 0 1100 Z" fill="url(#swirlMid)" />
                <path d="M 0 1100 L 0 1020 C 10 1030 35 1055 70 1070 C 90 1078 100 1080 115 1078 C 95 1088 70 1100 0 1100 Z" fill="url(#swirlLight)" />

                {/* Bottom-right corner swoosh curves */}
                <path d="M 850 1100 L 850 920 C 830 960 780 1020 720 1050 C 680 1070 650 1075 620 1070 C 660 1085 710 1100 850 1100 Z" fill="url(#swirlDark)" />
                <path d="M 850 1100 L 850 970 C 835 990 800 1030 750 1055 C 720 1070 700 1075 680 1072 C 710 1085 740 1100 850 1100 Z" fill="url(#swirlMid)" />
                <path d="M 850 1100 L 850 1020 C 840 1030 815 1055 780 1070 C 760 1078 750 1080 735 1078 C 755 1088 780 1100 850 1100 Z" fill="url(#swirlLight)" />

                {/* Subtle center circle */}
                <circle cx="350" cy="620" r="280" fill="none" stroke="#d0dce8" strokeWidth="1" opacity="0.4" />
                <circle cx="350" cy="620" r="260" fill="none" stroke="#d0dce8" strokeWidth="0.5" opacity="0.25" />
              </svg>

              <div style={{ position: "relative", zIndex: 1, padding: "50px 60px" }}>
                <div style={{ marginBottom: "4px" }}>
                  <span style={{
                    fontSize: "56px",
                    letterSpacing: "1px",
                    fontFamily: "'Arial', sans-serif",
                  }}>
                    <span style={{ fontWeight: "900", color: "#1a2a3e" }}>trim</span>
                    <span style={{ fontWeight: "300", color: "#6a8aa8" }}>rx</span>
                  </span>
                </div>
                <div style={{
                  fontSize: "24px",
                  color: "#3a4a5c",
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontWeight: "400",
                  marginBottom: "40px",
                  letterSpacing: "0.3px",
                }}>
                  Customer Authorization Confirmation
                </div>

                <div style={{
                  display: "flex",
                  gap: "30px",
                  minHeight: "620px",
                  alignItems: "flex-start",
                }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {screenshot1 ? (
                      <img
                        src={screenshot1}
                        alt="Patient Info"
                        style={{ width: "100%", height: "auto", maxHeight: "620px", objectFit: "contain" }}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div style={{
                        height: "420px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px dashed #ccc",
                        borderRadius: "8px",
                        color: "#999",
                        fontSize: "14px",
                      }}>
                        Screenshot 1 will appear here
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    {screenshot2 ? (
                      <img
                        src={screenshot2}
                        alt="Healthcare Intake"
                        style={{ width: "100%", height: "auto", maxHeight: "620px", objectFit: "contain" }}
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div style={{
                        height: "420px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px dashed #ccc",
                        borderRadius: "8px",
                        color: "#999",
                        fontSize: "14px",
                      }}>
                        Screenshot 2 will appear here
                      </div>
                    )}
                  </div>
                </div>

                <div style={{
                  position: "absolute",
                  bottom: "100px",
                  left: "60px",
                  right: "200px",
                  fontSize: "11px",
                  color: "#333",
                  lineHeight: "1.6",
                  fontFamily: "'Arial', sans-serif",
                  letterSpacing: "0.2px",
                }}>
                  <p style={{ margin: 0 }}>I understand that my information is never shared, is protected by HIPAA and agree to the terms and privacy policies and to be contacted as necessary by TrimRx and its medical partners and can opt-out at anytime.</p>
                  <p style={{ marginTop: "3px", fontWeight: "bold" }}>true</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
