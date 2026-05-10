import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:5000/api/email";

function DnsRecordRow({ label, record }) {
  const [copied, setCopied] = useState(false);

  function copyValue(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-white border">{record.type}</span>
        </div>
        {record.verified ? (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
        ) : (
          <span className="text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">Pending</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div>
          <span className="text-xs text-gray-500">Host:</span>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs bg-white border rounded px-2 py-1 flex-1 font-mono overflow-auto">
              {record.host}
            </code>
            <button onClick={() => copyValue(record.host)} className="text-xs text-blue-600 hover:underline shrink-0">
              Copy
            </button>
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Value:</span>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs bg-white border rounded px-2 py-1 flex-1 font-mono overflow-auto break-all">
              {record.value}
            </code>
            <button onClick={() => copyValue(record.value)} className="text-xs text-blue-600 hover:underline shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DomainSettings() {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState(null);

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/domains`);
      setDomains(res.data.domains || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      setAdding(true);
      await axios.post(`${API}/domains`, {
        domain: newDomain.trim(),
        storeId: "tsg-api.myshopify.com",
      });
      toast.success("Domain added! Configure DNS records below.");
      setNewDomain("");
      fetchDomains();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add domain");
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(id) {
    try {
      setVerifying(id);
      const res = await axios.post(`${API}/domains/${id}/verify`);
      if (res.data.allVerified) {
        toast.success("Domain verified successfully!");
      } else {
        const failed = [];
        if (!res.data.results.spf) failed.push("SPF");
        if (!res.data.results.dkim) failed.push("DKIM");
        if (!res.data.results.dmarc) failed.push("DMARC");
        toast.error(`Verification incomplete: ${failed.join(", ")} not found. DNS changes may take up to 48 hours to propagate.`);
      }
      fetchDomains();
    } catch (err) {
      toast.error("Verification failed");
    } finally {
      setVerifying(null);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm("Remove this domain?")) return;
    try {
      await axios.delete(`${API}/domains/${id}`);
      toast.success("Domain removed");
      fetchDomains();
    } catch (err) {
      toast.error("Failed to remove domain");
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e94560]" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Sending Domains</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your custom domain to send emails from your own address
        </p>
      </div>

      {/* Add Domain Form */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-3">Add Sending Domain</h2>
        <p className="text-sm text-gray-500 mb-4">
          Enter the domain you want to send emails from. You'll need to add DNS records to verify ownership.
        </p>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. mail.yourdomain.com"
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#e94560]"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-[#e94560] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#d63950] disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding..." : "Add Domain"}
          </button>
        </form>
      </div>

      {/* Domains List */}
      {domains.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
          <p>No domains configured yet. Add your first sending domain above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {domains.map((domain) => (
            <div key={domain.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{domain.domain}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      domain.status === "verified"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {domain.status === "verified" ? "Verified" : "Pending Verification"}
                    </span>
                    <span className="text-xs text-gray-400">
                      Added {new Date(domain.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleVerify(domain.id)}
                    disabled={verifying === domain.id}
                    className="border text-sm px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {verifying === domain.id ? "Checking..." : "Verify DNS"}
                  </button>
                  <button
                    onClick={() => handleRemove(domain.id)}
                    className="text-sm text-gray-400 hover:text-red-500 px-3"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* DNS Records */}
              <div className="p-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Add these DNS records to your domain registrar:
                </h4>
                <div className="space-y-3">
                  <DnsRecordRow label="SPF" record={domain.dnsRecords.spf} />
                  <DnsRecordRow label="DKIM" record={domain.dnsRecords.dkim} />
                  <DnsRecordRow label="DMARC" record={domain.dnsRecords.dmarc} />
                </div>

                {domain.status !== "verified" && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> DNS changes can take up to 48 hours to propagate.
                      After adding all records, click "Verify DNS" to check.
                    </p>
                  </div>
                )}

                {/* Warmup Info */}
                {domain.status === "verified" && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-green-800 mb-1">Domain Warmup</h5>
                    <p className="text-sm text-green-700">
                      Stage: <strong>{domain.warmup.stage}</strong> |
                      Daily limit: <strong>{domain.warmup.dailyLimit} emails</strong>
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Start with low volumes and gradually increase over 2-4 weeks for best deliverability.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
