import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";

const API = "http://localhost:5000/api/email";

const COLORS = ["#e94560", "#1a1a2e", "#4ade80", "#f59e0b", "#8b5cf6", "#06b6d4"];

function MetricCard({ label, value, suffix, color }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-gray-900"}`}>
        {value}{suffix}
      </p>
    </div>
  );
}

export default function EmailAnalytics() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("campaign");
  const [overview, setOverview] = useState(null);
  const [campaignMetrics, setCampaignMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, dateRange]);

  async function fetchAnalytics() {
    try {
      setLoading(true);

      if (campaignId) {
        const res = await axios.get(`${API}/analytics/campaign/${campaignId}`);
        setCampaignMetrics(res.data.metrics);
      }

      const endDate = new Date().toISOString();
      const startDate = new Date();
      if (dateRange === "7d") startDate.setDate(startDate.getDate() - 7);
      else if (dateRange === "30d") startDate.setDate(startDate.getDate() - 30);
      else startDate.setDate(startDate.getDate() - 90);

      const res = await axios.get(`${API}/analytics/overview`, {
        params: { startDate: startDate.toISOString(), endDate },
      });
      setOverview(res.data.analytics);
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

  const metrics = campaignMetrics || overview?.totals || {};
  const daily = overview?.daily || [];

  const pieData = [
    { name: "Opened", value: parseInt(metrics.opened) || 0 },
    { name: "Clicked", value: parseInt(metrics.clicked) || 0 },
    { name: "Bounced", value: parseInt(metrics.bounced) || 0 },
    { name: "Unsubscribed", value: parseInt(metrics.unsubscribed) || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {campaignId ? "Campaign Analytics" : "Email Analytics"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {campaignId ? `Campaign: ${campaignId}` : "Overview of all email campaigns"}
          </p>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                dateRange === range ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500"
              }`}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <MetricCard label="Sent" value={metrics.sent || 0} />
        <MetricCard label="Delivered" value={metrics.delivered || 0} />
        <MetricCard label="Opened" value={metrics.uniqueOpens || metrics.opened || 0} color="text-green-600" />
        <MetricCard label="Clicked" value={metrics.uniqueClicks || metrics.clicked || 0} color="text-blue-600" />
        <MetricCard label="Open Rate" value={metrics.openRate || overview?.openRate || "0.00"} suffix="%" color="text-green-600" />
        <MetricCard label="Click Rate" value={metrics.clickRate || overview?.clickRate || "0.00"} suffix="%" color="text-blue-600" />
        <MetricCard label="Bounce Rate" value={metrics.bounceRate || overview?.bounceRate || "0.00"} suffix="%" color="text-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Email Activity</h2>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#1a1a2e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="opened" stroke="#4ade80" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicked" stroke="#e94560" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No data available for this period
            </div>
          )}
        </div>

        {/* Engagement Breakdown Pie */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Engagement Breakdown</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No engagement data yet
            </div>
          )}
        </div>
      </div>

      {/* Bar Chart - Sent vs Delivered vs Bounced */}
      {daily.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
          <h2 className="text-lg font-semibold mb-4">Delivery Performance</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sent" fill="#1a1a2e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="delivered" fill="#4ade80" radius={[2, 2, 0, 0]} />
              <Bar dataKey="bounced" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
