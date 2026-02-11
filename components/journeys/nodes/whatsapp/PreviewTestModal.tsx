"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  Smartphone,
  UserCircle2,
} from "lucide-react";

import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WhatsAppBodyField, WhatsAppTemplate } from "@/lib/types/whatsapp-config";
import type { TestUser } from "@/lib/types/test-mode";
import { cn } from "@/lib/utils";
import {
  countTemplateCharacters,
  normalizeVariableToken,
  renderTemplateWithVariables,
} from "@/lib/whatsapp/template-utils";

interface PreviewTestModalProps {
  open: boolean;
  onClose: () => void;
  template: WhatsAppTemplate | null;
  variablePreview: Record<string, string>;
  variablePlaceholders: string[];
  journeyId?: string;
  sendingTest: boolean;
  onSendTest: (payload: {
    phone: string;
    variables: Record<string, string>;
    bodyFields?: WhatsAppBodyField[];
    profileId?: string;
  }) => Promise<unknown>;
  mediaUrl?: string;
  useDynamicMedia?: boolean;
  bodyFields?: WhatsAppBodyField[];
}

interface TestResultState {
  status: "success" | "error";
  message: string;
  details?: string;
}

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

function formatPreviewTimestamp(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export function PreviewTestModal({
  open,
  onClose,
  template,
  variablePreview,
  variablePlaceholders,
  journeyId,
  sendingTest,
  onSendTest,
  mediaUrl,
  useDynamicMedia,
  bodyFields = [],
}: PreviewTestModalProps) {
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const [recipientMode, setRecipientMode] = useState<"profile" | "manual">("manual");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>({});
  const [variableErrors, setVariableErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<TestResultState | null>(null);

  const requiredVariables = useMemo(
    () => variablePlaceholders.map(normalizeVariableToken),
    [variablePlaceholders],
  );

  const defaultVariableMap = useMemo(() => {
    if (!requiredVariables.length) return {};
    return requiredVariables.reduce<Record<string, string>>((acc, variable) => {
      acc[variable] = variablePreview[variable] ?? "";
      return acc;
    }, {});
  }, [requiredVariables, variablePreview]);

  useEffect(() => {
    if (!open) return;
    setVariableInputs(defaultVariableMap);
    setVariableErrors({});
    setTestResult(null);
    setPhoneError(null);
    if (journeyId) {
      setLoadingProfiles(true);
      setProfilesError(null);
      const controller = new AbortController();
      fetch(`/api/test-mode/test-users?journeyId=${journeyId}`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.error ?? "Unable to load test profiles.");
          }
          return response.json();
        })
        .then(payload => {
          if (!payload?.testUsers) return;
          setTestUsers(payload.testUsers as TestUser[]);
          if ((payload.testUsers as TestUser[]).length) {
            setRecipientMode("profile");
            setSelectedProfileId((payload.testUsers as TestUser[])[0].id);
            setManualPhone((payload.testUsers as TestUser[])[0].phone);
          } else {
            setRecipientMode("manual");
            setSelectedProfileId(null);
          }
        })
        .catch(error => {
          if (controller.signal.aborted) return;
          setProfilesError(error instanceof Error ? error.message : "Failed to load test profiles.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingProfiles(false);
        });
      return () => controller.abort();
    }
    setTestUsers([]);
    setRecipientMode("manual");
    setSelectedProfileId(null);
  }, [defaultVariableMap, journeyId, open]);

  useEffect(() => {
    setVariableInputs(defaultVariableMap);
  }, [defaultVariableMap]);

  const selectedProfile = useMemo(
    () => testUsers.find(user => user.id === selectedProfileId) ?? null,
    [selectedProfileId, testUsers],
  );

  useEffect(() => {
    if (recipientMode === "profile" && selectedProfile?.phone) {
      setManualPhone(selectedProfile.phone);
    }
  }, [recipientMode, selectedProfile]);

  const renderedMessage = useMemo(
    () => renderTemplateWithVariables(template, variableInputs),
    [template, variableInputs],
  );

  const characterCount = useMemo(
    () => countTemplateCharacters(template, variableInputs),
    [template, variableInputs],
  );

  const handleVariableChange = (variable: string, value: string) => {
    setVariableInputs(prev => ({
      ...prev,
      [variable]: value,
    }));
    setVariableErrors(prev => {
      const next = { ...prev };
      delete next[variable];
      return next;
    });
  };

  const validateInputs = (): boolean => {
    const targetPhone = manualPhone.trim();
    const nextErrors: Record<string, string> = {};
    requiredVariables.forEach(variable => {
      if (!variableInputs[variable]?.trim()) {
        nextErrors[variable] = "Required";
      }
    });
    const phoneValidationError = targetPhone ? (PHONE_REGEX.test(targetPhone) ? null : "Enter a valid WhatsApp number with country code.") : "Phone number is required.";

    setVariableErrors(nextErrors);
    setPhoneError(phoneValidationError);
    return Object.keys(nextErrors).length === 0 && !phoneValidationError;
  };

  const handleSendTest = async () => {
    setTestResult(null);
    if (!validateInputs()) return;

    try {
      await onSendTest({
        phone: manualPhone.trim(),
        variables: variableInputs,
        bodyFields,
        profileId: recipientMode === "profile" ? selectedProfileId ?? undefined : undefined,
      });
      setTestResult({
        status: "success",
        message: "Test message sent successfully!",
      });
    } catch (error) {
      setTestResult({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to send test message.",
      });
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Preview & Test Message"
      subtitle="Render the final WhatsApp experience and send a test to yourself or a QA profile."
    >
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="space-y-4 rounded-3xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
          <header className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Final WhatsApp Preview</p>
              <h3 className="text-lg font-semibold text-[#3A3028]">
                {template?.name ?? "Select a template"}
              </h3>
            </div>
            <Badge className="rounded-full bg-[#F5F3EE] text-[#826A5E]">
              {template?.language?.toUpperCase() ?? "LANG"}
            </Badge>
          </header>

          <div className="rounded-[36px] border-[10px] border-black bg-[#E9ECEF] shadow-xl">
            <div className="h-[24px] rounded-t-[26px] bg-black" />
            <div className="space-y-4 px-4 py-5">
              <div className="flex items-center gap-3 rounded-2xl bg-[#075E54] px-4 py-3 text-white">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{template?.name ?? "WhatsApp Template"}</p>
                  <p className="text-xs text-white/80">WhatsApp Business</p>
                </div>
              </div>

              {template?.hasMediaHeader ? (
                <div className="overflow-hidden rounded-2xl border border-[#D6CDC3] bg-[#FAF7F2]">
                  {mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt={template.name} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center text-xs text-[#8B7F76]">
                      {useDynamicMedia ? "Dynamic media will be inserted at send time." : "No media selected."}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="rounded-2xl rounded-bl-none bg-white px-4 py-3 text-sm text-[#3A3028] shadow">
                  {renderedMessage || "Configure template variables to preview the final message."}
                  <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[#7C6F66]">
                    <span>{formatPreviewTimestamp()}</span>
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 text-[#53BDEB]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="1 12 5 16 12 7" />
                      <polyline points="12 12 16 16 23 7" />
                    </svg>
                  </div>
                </div>
                {template?.footer ? (
                  <div className="w-fit rounded-2xl bg-white px-3 py-2 text-[11px] text-[#8B7F76] shadow">
                    {template.footer}
                  </div>
                ) : null}
                {template?.buttons?.length ? (
                  <div className="flex flex-col gap-2">
                    {template.buttons.map(button => (
                      <button
                        key={button.id}
                        type="button"
                        className={cn(
                          "w-full rounded-full border px-4 py-2 text-sm font-medium tracking-wide",
                          button.type?.toLowerCase().includes("quick")
                            ? "border-[#D4A574] bg-[#FDF6ED] text-[#935E0D]"
                            : "border-[#E8E4DE] bg-white text-[#3A3028]",
                        )}
                      >
                        {button.label || button.text || "Button"}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="h-[30px] rounded-b-[26px] bg-[#D0D3D4]" />
          </div>

          <dl className="grid gap-4 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4 text-sm text-[#4A4139] md:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">Template</dt>
              <dd>{template?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">Category</dt>
              <dd>{template?.category ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">Variables</dt>
              <dd>{requiredVariables.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">Characters</dt>
              <dd>{characterCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.2em] text-[#B9AA9F]">Body sections</dt>
              <dd>{bodyFields.length || 1}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4 rounded-3xl border border-[#E8E4DE] bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Send test message</p>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#3A3028]">
              <Phone className="h-4 w-4 text-[#D4A574]" />
              Recipient
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1",
                  recipientMode === "profile" ? "border-[#D4A574] bg-[#FDF0DF] text-[#8B5E2F]" : "border-[#E8E4DE] text-[#6B5D54]",
                )}
                onClick={() => setRecipientMode("profile")}
                disabled={!testUsers.length}
              >
                Test Profile
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1",
                  recipientMode === "manual" ? "border-[#D4A574] bg-[#FDF0DF] text-[#8B5E2F]" : "border-[#E8E4DE] text-[#6B5D54]",
                )}
                onClick={() => setRecipientMode("manual")}
              >
                Manual Entry
              </button>
            </div>
            {recipientMode === "profile" ? (
              <div className="space-y-3 rounded-2xl border border-[#E8E4DE] bg-[#FAF9F6] p-4">
                {loadingProfiles ? (
                  <div className="flex items-center gap-2 text-sm text-[#8B7F76]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading test profiles…
                  </div>
                ) : testUsers.length ? (
                  <>
                    <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">Select profile</Label>
                    <select
                      className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#4A4139]"
                      value={selectedProfileId ?? ""}
                      onChange={event => setSelectedProfileId(event.target.value)}
                    >
                      {testUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.phone || user.email || user.id}
                        </option>
                      ))}
                    </select>
                    {selectedProfile ? (
                      <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm text-[#4A4139]">
                        <UserCircle2 className="h-8 w-8 text-[#D4A574]" />
                        <div>
                          <p className="font-semibold">{selectedProfile.name ?? "Unnamed profile"}</p>
                          <p className="text-xs text-[#8B7F76]">{selectedProfile.phone || selectedProfile.email || "No contact details"}</p>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-[#8B7F76]">
                    No test profiles yet. Add one from the Test Mode workspace to unlock quick targeting.
                  </p>
                )}
                {profilesError ? (
                  <p className="text-xs text-[#C05621]">{profilesError}</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-[0.25em] text-[#B9AA9F]">
                Phone number (E.164)
              </Label>
              <Input
                value={manualPhone}
                onChange={event => setManualPhone(event.target.value)}
                placeholder="+1 202 555 0145"
                className={cn(phoneError ? "border-red-300 focus-visible:ring-red-200" : undefined)}
              />
              <p className={cn("text-xs", phoneError ? "text-[#C05621]" : "text-[#8B7F76]")}>
                Include country code. e.g., +14155552671
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-[#B9AA9F]">Fill variables</p>
              <Badge className="rounded-full bg-[#F5F3EE] text-[#826A5E]">{requiredVariables.length} required</Badge>
            </div>
            {requiredVariables.length ? (
              <ScrollArea className="max-h-60 rounded-2xl border border-[#E8E4DE]">
                <div className="divide-y divide-[#F0ECE6]">
                  {requiredVariables.map(variable => (
                    <div key={variable} className="flex items-start gap-3 bg-white px-4 py-3">
                      <div className="w-24">
                        <Badge className="rounded-full bg-[#F5F3EE] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8B7F76]">
                          {variable}
                        </Badge>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Input
                          value={variableInputs[variable] ?? ""}
                          onChange={event => handleVariableChange(variable, event.target.value)}
                          placeholder="Enter preview value"
                          className={cn(variableErrors[variable] ? "border-red-300 focus-visible:ring-red-200" : undefined)}
                        />
                        <p className="text-[11px] text-[#8B7F76]">Used in preview and sent test message.</p>
                        {variableErrors[variable] ? (
                          <p className="text-[11px] text-[#C05621]">{variableErrors[variable]}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E8E4DE] bg-[#FAF9F6] px-4 py-6 text-sm text-[#8B7F76]">
                This template does not require variables.
              </div>
            )}
          </div>

          {testResult ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm",
                testResult.status === "success"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-700",
              )}
            >
              {testResult.status === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4" />
              )}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.details ? <p className="text-xs">{testResult.details}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-[#8B7F76]">
              Template must be selected and variables mapped before sending a test.
            </div>
            <Button
              type="button"
              onClick={handleSendTest}
              disabled={sendingTest || !template}
              className="bg-[#D4A574] text-white hover:bg-[#B8835D]"
            >
              {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Test Message
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}


