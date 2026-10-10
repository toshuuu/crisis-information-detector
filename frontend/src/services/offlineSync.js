import axios from "axios";

const rawApiUrl =
    import.meta.env.VITE_API_URL ||
    "https://crisis-misinformation-detector.onrender.com/api";

const API_BASE_URL = rawApiUrl.endsWith("/api")
    ? rawApiUrl
    : `${rawApiUrl.replace(/\/$/, "")}/api`;

export const syncOfflineReports = async () => {
    const offlineReports =
        JSON.parse(localStorage.getItem("offlineReports")) || [];

    if (offlineReports.length === 0) {
        return;
    }

    console.log(`Found ${offlineReports.length} offline reports.`);

    try {
        for (const report of offlineReports) {
            await axios.post(`${API_BASE_URL}/reports`, report);
        }

        localStorage.removeItem("offlineReports");

        console.log("All offline reports synced successfully.");
        alert("Offline reports synced successfully!");

    } catch (err) {
        console.error("Failed to sync offline reports:", err);
    }
};