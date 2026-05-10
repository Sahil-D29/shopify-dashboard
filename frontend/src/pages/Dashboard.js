import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:5000/api";

function StatCard({ title, value, subtitle, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border p-5 ${onClick ? "cursor-pointer hover:shadow-md" : ""} transition-shadow`}
    >
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function QuickAction({ label, desc, to, navigate }) {
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-start gap-3 bg-white rounded-xl border p-4 hover:shadow-md hover:border-[#e94560] transition-all text-left w-full"
    >
      <div>
        <p className="font-medium text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [shopData, setShopData] = useState({ products: 0, customers: 0, orders: 0, abandoned: 0 });
  const [emailStats, setEmailStats] = useState(null);
  const [subscribers, setSubscribers] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      const [prodRes, custRes, ordRes, abRes, emailRes, subRes, campRes] = await Promise.all([
        axios.get(`${API}/shopify/products`).catch(() => ({ data: [] })),
        axios.get(`${API}/shopify/customers`).catch(() => ({ data: [] })),
        axios.get(`${API}/shopify/orders`).catch(() => ({ data: [] })),
        axios.get(`${API}/shopify/abandoned`).catch(() => ({ data: [] })),
        axios.get(`${API}/email/analytics/overview`, {
          params: { startDate: new Date(Date.now() - 30 * 86400000).toISOString(), endDate: new Date().toISOString() },
        }).catch(() => ({ data: { analytics: null } })),
        axios.get(`${API}/email/subscribers`, { params: { page: 1, limit: 1 } }).catch(() => ({ data: { total: 0 } })),
        axios.get(`${API}/campaigns`).catch(() => ({ data: { campaigns: [] } })),
      ]);

      setShopData({
        products: Array.isArray(prodRes.data) ? prodRes.data.length : 0,
        customers: Array.isArray(custRes.data) ? custRes.data.length : 0,
        orders: Array.isArray(ordRes.data) ? ordRes.data.length : 0,
        abandoned: Array.isArray(abRes.data) ? abRes.data.length : 0,
      });
      setEmailStats(emailRes.data?.analytics || null);
      setSubscribers(subRes.data?.total || 0);
      setCampaigns(campRes.data?.campaigns || campRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#e94560]" />
      </div>
    );
  }

  const totals = emailStats?.totals || {};
  const recentCampaigns = (Array.isArray(campaigns) ? campaigns : []).slice(0, 5);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your Shopify store and email marketing</p>
      </div>

      {/* Shopify Store Stats */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Store Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Products" value={shopData.products} />
        <StatCard title="Customers" value={shopData.customers} />
        <StatCard title="Orders" value={shopData.orders} />
        <StatCard title="Abandoned Carts" value={shopData.abandoned} color="text-orange-500" />
      </div>

      {/* Email Marketing Stats */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Email Marketing (Last 30 Days)</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Subscribers"
          value={subscribers}
          onClick={() => navigate("/email/subscribers")}
        />
        <StatCard title="Emails Sent" value={totals.sent || 0} />
        <StatCard title="Delivered" value={totals.delivered || 0} />
        <StatCard
          title="Open Rate"
          value={`${emailStats?.openRate || "0.0"}%`}
          color="text-green-600"
          onClick={() => navigate("/email/analytics")}
        />
        <StatCard
          title="Click Rate"
          value={`${emailStats?.clickRate || "0.0"}%`}
          color="text-blue-600"
          onClick={() => navigate("/email/analytics")}
        />
        <StatCard
          title="Bounce Rate"
          value={`${emailStats?.bounceRate || "0.0"}%`}
          color="text-red-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Recent Campaigns</h3>
            <button
              onClick={() => navigate("/email/campaigns")}
              className="text-xs text-[#e94560] hover:underline font-medium"
            >
              View All
            </button>
          </div>
          {recentCampaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No campaigns yet. Create your first campaign!
            </div>
          ) : (
            <div className="divide-y">
              {recentCampaigns.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.channel || "email"} | {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.status === "COMPLETED" ? "bg-green-100 text-green-700"
                    : c.status === "RUNNING" ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {c.status || "DRAFT"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction
              label="Create Email Campaign"
              desc="Send targeted emails to your subscriber segments"
              to="/email/campaigns"
              navigate={navigate}
            />
            <QuickAction
              label="Build Email Template"
              desc="Design beautiful emails with drag-and-drop builder"
              to="/email/builder"
              navigate={navigate}
            />
            <QuickAction
              label="Create Journey"
              desc="Set up automated multi-channel flows"
              to="/journeys"
              navigate={navigate}
            />
            <QuickAction
              label="Run A/B Test"
              desc="Test subject lines and content to optimize engagement"
              to="/email/ab-tests"
              navigate={navigate}
            />
            <QuickAction
              label="Connect Domain"
              desc="Set up SPF, DKIM, DMARC for your sending domain"
              to="/email/domains"
              navigate={navigate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
