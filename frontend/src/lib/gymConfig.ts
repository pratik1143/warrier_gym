export interface GymConfig {
  name: string;
  shortName: string;
  logo: string;
  logoAlt: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  country: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  website: string;
}

export const gymConfig: GymConfig = {
  name: "The Warrior Gym",
  shortName: "Warrior Gym",
  logo: "/gymlogo.png",
  logoAlt: "The Warrior Gym Logo",
  primaryColor: "#DC2626", // Crimson Red
  secondaryColor: "#0F172A", // Slate/Onyx
  accentColor: "#F59E0B", // Amber Gold
  timezone: "Asia/Kolkata",
  currency: "INR",
  currencySymbol: "₹",
  country: "India",
  supportEmail: "support@thewarriorgym.in",
  supportPhone: "+91 98765 43210",
  address: "The Warrior Gym Complex, Sector 70, Mohali, Punjab",
  website: "https://thewarriorgym.in"
};

export default gymConfig;
