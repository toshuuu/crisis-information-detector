import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n
    .use(initReactI18next)
    .init({
        lng: "en",
        fallbackLng: "en",
        resources: {
            en: {
                translation: {
                    reportCrisis: "Report Crisis",
                    nearbyIncidents: "Nearby Incidents"
                }
            },
            hi: {
                translation: {
                    reportCrisis: "संकट की रिपोर्ट करें",
                    nearbyIncidents: "आस-पास की घटनाएँ"
                }
            },
            mr: {
                translation: {
                    reportCrisis: "आपत्तीची नोंद करा",
                    nearbyIncidents: "जवळील घटना"
                }
            }
        },
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;