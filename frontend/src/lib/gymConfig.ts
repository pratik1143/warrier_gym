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
  primaryColor: "#F97316", // Warrior Orange
  secondaryColor: "#FFFFFF", // White
  accentColor: "#EA580C", // Deep Orange
  timezone: "Asia/Kolkata",
  currency: "INR",
  currencySymbol: "₹",
  country: "India",
  supportEmail: "Ramansingh6158@gmail.com",
  supportPhone: "+91 98170 23336",
  address: "The Warrior Gym, SCO 30, 31, Sector 89, Mohali, Punjab 140308",
  website: "https://thewarriorgym.in"
};

export default gymConfig;
