export const homeSchemas = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://thewarriorgym.in/#organization",
      "name": "The Warrior Gym",
      "url": "https://thewarriorgym.in/",
      "email": "thewarriorgym@gmail.com",
      "telephone": "+91-9779333155"
    },
    {
      "@type": "Gym",
      "@id": "https://thewarriorgym.in/#gym",
      "name": "The Warrior Gym",
      "url": "https://thewarriorgym.in/",
      "description": "The Warrior Gym is one of the best gyms in Mohali near Landran Road and Airport Road offering personal training, strength training, weight loss, CrossFit, cardio and functional fitness.",
      "telephone": "+91-9779333155",
      "email": "thewarriorgym@gmail.com",
      "priceRange": "₹₹",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "2nd Floor, MNB Group, SCO 16-17, Landran Road, Sohana",
        "addressLocality": "Sahibzada Ajit Singh Nagar",
        "addressRegion": "Punjab",
        "postalCode": "140308",
        "addressCountry": "IN"
      },
      "areaServed": [
        "Mohali",
        "Sohana",
        "Landran Road",
        "Airport Road",
        "Chandigarh",
        "Kharar"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://thewarriorgym.in/#website",
      "name": "The Warrior Gym",
      "url": "https://thewarriorgym.in/"
    }
  ]
};

export const aboutSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About The Warrior Gym",
  "url": "https://thewarriorgym.in/about"
};

export const servicesSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Gym Services",
  "url": "https://thewarriorgym.in/services"
};

export const packagesSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Gym Membership Packages",
  "url": "https://thewarriorgym.in/packages"
};

export const teamSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "The Warrior Gym Team",
  "url": "https://thewarriorgym.in/team"
};

export const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact The Warrior Gym",
  "url": "https://thewarriorgym.in/contact"
};

export const appSchema = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "name": "The Warrior Gym App",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Android, iOS"
};

export const privacySchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Privacy Policy - The Warrior Gym",
  "url": "https://thewarriorgym.in/privacy-policy"
};

export const termsSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Terms and Conditions - The Warrior Gym",
  "url": "https://thewarriorgym.in/terms"
};
