import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import EmailCampaigns from "./pages/EmailCampaigns";
import EmailTemplates from "./pages/EmailTemplates";
import EmailBuilder from "./pages/EmailBuilder";
import EmailAnalytics from "./pages/EmailAnalytics";
import EmailSubscribers from "./pages/EmailSubscribers";
import DomainSettings from "./pages/DomainSettings";
import JourneyBuilder from "./pages/JourneyBuilder";
import ABTesting from "./pages/ABTesting";
import BackInStock from "./pages/BackInStock";
import CrossSellRules from "./pages/CrossSellRules";

const navLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/email/campaigns", label: "Campaigns" },
  { to: "/email/templates", label: "Templates" },
  { to: "/journeys", label: "Journeys" },
  { to: "/email/ab-tests", label: "A/B Testing" },
  { to: "/email/analytics", label: "Analytics" },
  { to: "/email/subscribers", label: "Subscribers" },
  { to: "/email/domains", label: "Domains" },
  { to: "/email/back-in-stock", label: "Back-in-Stock" },
  { to: "/email/cross-sell", label: "Cross-Sell" },
];

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: "#363636", color: "#fff" },
          success: { duration: 3000, iconTheme: { primary: "#4ade80", secondary: "#fff" } },
          error: { duration: 4000, iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 bg-[#1a1a2e] text-white flex flex-col shrink-0">
          <div className="p-6 border-b border-white/10">
            <h1 className="text-xl font-bold tracking-tight">Shopify Marketing</h1>
            <p className="text-xs text-gray-400 mt-1">Email & WhatsApp Platform</p>
          </div>
          <nav className="flex-1 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `block px-6 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-[#e94560] text-white font-semibold"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10 text-xs text-gray-500">
            v1.0 — Email + WhatsApp
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/email/campaigns" element={<EmailCampaigns />} />
            <Route path="/email/templates" element={<EmailTemplates />} />
            <Route path="/email/builder" element={<EmailBuilder />} />
            <Route path="/email/builder/:templateId" element={<EmailBuilder />} />
            <Route path="/email/analytics" element={<EmailAnalytics />} />
            <Route path="/email/subscribers" element={<EmailSubscribers />} />
            <Route path="/email/domains" element={<DomainSettings />} />
            <Route path="/journeys" element={<JourneyBuilder />} />
            <Route path="/email/ab-tests" element={<ABTesting />} />
            <Route path="/email/back-in-stock" element={<BackInStock />} />
            <Route path="/email/cross-sell" element={<CrossSellRules />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
