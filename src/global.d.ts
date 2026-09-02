import type { Locale } from "./i18n/config";
import type messages from "./messages/nl.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
